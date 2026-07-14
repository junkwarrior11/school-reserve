import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// ─── Utility ────────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── GET /api/data ───────────────────────────────────────────────────────────

app.get('/api/data', async (c) => {
  const db = c.env.DB
  const [teachers, resources, reservations, inspectionLogs, sosRequests, nfcHistory] = await Promise.all([
    db.prepare('SELECT * FROM teachers ORDER BY created_at ASC').all(),
    db.prepare('SELECT * FROM resources ORDER BY created_at ASC').all(),
    db.prepare('SELECT * FROM reservations ORDER BY date ASC, period ASC').all(),
    db.prepare('SELECT * FROM inspection_logs ORDER BY date DESC').all(),
    db.prepare('SELECT * FROM sos_requests ORDER BY requested_at DESC').all(),
    db.prepare('SELECT * FROM nfc_history ORDER BY timestamp DESC LIMIT 200').all(),
  ])
  return c.json({
    teachers: teachers.results,
    resources: resources.results.map(r => ({
      ...r,
      custom_inspection_items: JSON.parse((r.custom_inspection_items as string) || '[]')
    })),
    reservations: reservations.results,
    inspectionLogs: inspectionLogs.results.map(l => ({
      ...l,
      items: JSON.parse((l.items as string) || '[]')
    })),
    sosRequests: sosRequests.results,
    nfcHistory: nfcHistory.results,
  })
})

// ─── Teachers ────────────────────────────────────────────────────────────────

app.post('/api/teachers', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const colors = ['indigo', 'emerald', 'blue', 'rose', 'amber', 'purple', 'teal']
  const existing = await db.prepare('SELECT COUNT(*) as cnt FROM teachers').first<{ cnt: number }>()
  const color = body.color || colors[(existing?.cnt || 0) % colors.length]

  if (body.id) {
    // upsert
    await db.prepare(`
      INSERT INTO teachers (id, name, department, nfc_tag_id, color)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        department = excluded.department,
        nfc_tag_id = excluded.nfc_tag_id,
        color = excluded.color
    `).bind(body.id, body.name, body.department, body.nfc_tag_id || null, color).run()
    const row = await db.prepare('SELECT * FROM teachers WHERE id = ?').bind(body.id).first()
    return c.json({ success: true, teacher: row })
  }

  const id = uid('T')
  await db.prepare(`
    INSERT INTO teachers (id, name, department, nfc_tag_id, color) VALUES (?, ?, ?, ?, ?)
  `).bind(id, body.name, body.department, body.nfc_tag_id || null, color).run()
  const row = await db.prepare('SELECT * FROM teachers WHERE id = ?').bind(id).first()
  return c.json({ success: true, teacher: row })
})

app.delete('/api/teachers/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM teachers WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── Resources ───────────────────────────────────────────────────────────────

app.post('/api/resources', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const customItems = JSON.stringify(body.custom_inspection_items || body.customInspectionItems || [])

  if (body.id) {
    const existing = await db.prepare('SELECT id FROM resources WHERE id = ?').bind(body.id).first()
    if (existing) {
      await db.prepare(`
        UPDATE resources SET
          name = ?, category = ?, location = ?, subject = ?,
          nfc_tag_id = ?, qr_code_id = ?, status = ?,
          current_teacher_id = ?, last_checked_out_at = ?,
          custom_inspection_items = ?
        WHERE id = ?
      `).bind(
        body.name, body.category, body.location, body.subject || '共通',
        body.nfc_tag_id || body.nfcTagId || null,
        body.qr_code_id || body.qrCodeId || null,
        body.status || 'available',
        body.current_teacher_id || body.currentTeacherId || null,
        body.last_checked_out_at || body.lastCheckedOutAt || null,
        customItems,
        body.id
      ).run()
      const row = await db.prepare('SELECT * FROM resources WHERE id = ?').bind(body.id).first()
      return c.json({ success: true, resource: row })
    }
  }

  const id = body.id || uid('R')
  const qrId = body.qr_code_id || body.qrCodeId || uid('QR')
  await db.prepare(`
    INSERT INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status, custom_inspection_items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.name, body.category, body.location || '', body.subject || '共通',
    body.nfc_tag_id || body.nfcTagId || null,
    qrId,
    body.status || 'available',
    customItems
  ).run()
  const row = await db.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first()
  return c.json({ success: true, resource: row })
})

app.delete('/api/resources/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.batch([
    db.prepare('DELETE FROM reservations WHERE resource_id = ?').bind(id),
    db.prepare('DELETE FROM sos_requests WHERE resource_id = ?').bind(id),
    db.prepare('DELETE FROM resources WHERE id = ?').bind(id),
  ])
  return c.json({ success: true })
})

// ─── Reservations ────────────────────────────────────────────────────────────

app.post('/api/reservations', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()

  // Check overlap
  const overlap = await db.prepare(`
    SELECT id FROM reservations
    WHERE resource_id = ? AND date = ? AND period = ? AND id != ?
  `).bind(
    body.resourceId || body.resource_id,
    body.date,
    Number(body.period),
    body.id || ''
  ).first()

  if (overlap) {
    return c.json({ success: false, message: '指定された日付と時限はすでに他の予約で埋まっています。' }, 400)
  }

  const id = body.id || uid('RES')
  const resourceId = body.resourceId || body.resource_id
  const teacherId = body.teacherId || body.teacher_id

  const existing = await db.prepare('SELECT id FROM reservations WHERE id = ?').bind(id).first()
  if (existing) {
    await db.prepare(`
      UPDATE reservations SET resource_id=?, teacher_id=?, date=?, period=?, purpose=? WHERE id=?
    `).bind(resourceId, teacherId, body.date, Number(body.period), body.purpose, id).run()
  } else {
    await db.prepare(`
      INSERT INTO reservations (id, resource_id, teacher_id, date, period, purpose) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, resourceId, teacherId, body.date, Number(body.period), body.purpose).run()
  }
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first()
  return c.json({ success: true, reservation: row })
})

app.delete('/api/reservations/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── SOS ─────────────────────────────────────────────────────────────────────

app.post('/api/sos', async (c) => {
  const db = c.env.DB
  const { resourceId, teacherId } = await c.req.json()
  if (!resourceId || !teacherId) {
    return c.json({ success: false, message: 'ID情報が不足しています。' }, 400)
  }

  const resource = await db.prepare('SELECT id FROM resources WHERE id = ?').bind(resourceId).first()
  if (!resource) return c.json({ success: false, message: 'リソースが見つかりません。' }, 404)

  const existing = await db.prepare(
    'SELECT * FROM sos_requests WHERE resource_id = ? AND teacher_id = ?'
  ).bind(resourceId, teacherId).first()
  if (existing) return c.json({ success: true, message: 'すでに申請済みです。', sos: existing })

  const id = uid('SOS')
  const requestedAt = new Date().toISOString()
  await db.prepare(
    'INSERT INTO sos_requests (id, resource_id, teacher_id, requested_at, notified) VALUES (?, ?, ?, ?, 0)'
  ).bind(id, resourceId, teacherId, requestedAt).run()
  const row = await db.prepare('SELECT * FROM sos_requests WHERE id = ?').bind(id).first()
  return c.json({ success: true, sos: row })
})

app.post('/api/sos/resolve', async (c) => {
  const db = c.env.DB
  const { id } = await c.req.json()
  await db.prepare('DELETE FROM sos_requests WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── Inspection ──────────────────────────────────────────────────────────────

app.post('/api/inspection', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const id = body.id || uid('INSP')
  const date = body.date || new Date().toISOString()
  const repairStatus = (body.overallStatus === 'ng' || body.overallStatus === 'caution') ? 'pending' : 'none'
  const items = JSON.stringify(body.items || [])

  const existing = await db.prepare('SELECT id FROM inspection_logs WHERE id = ?').bind(id).first()
  if (existing) {
    await db.prepare(`
      UPDATE inspection_logs SET
        resource_id=?, teacher_id=?, date=?, overall_status=?,
        items=?, general_comment=?, photo_url=?, repair_status=?,
        repair_note=?, ai_suggestions=?
      WHERE id=?
    `).bind(
      body.resourceId || body.resource_id,
      body.teacherId || body.teacher_id,
      date, body.overallStatus || body.overall_status,
      items, body.generalComment || body.general_comment || '',
      body.photoUrl || body.photo_url || null,
      repairStatus, body.repairNote || body.repair_note || null,
      body.aiSuggestions || body.ai_suggestions || null,
      id
    ).run()
  } else {
    await db.prepare(`
      INSERT INTO inspection_logs
        (id, resource_id, teacher_id, date, overall_status, items, general_comment, photo_url, repair_status, repair_note, ai_suggestions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.resourceId || body.resource_id,
      body.teacherId || body.teacher_id,
      date, body.overallStatus || body.overall_status || 'ok',
      items, body.generalComment || body.general_comment || '',
      body.photoUrl || body.photo_url || null,
      repairStatus,
      body.repairNote || body.repair_note || null,
      body.aiSuggestions || body.ai_suggestions || null
    ).run()
  }
  const row = await db.prepare('SELECT * FROM inspection_logs WHERE id = ?').bind(id).first() as any
  if (row) row.items = JSON.parse(row.items || '[]')
  return c.json({ success: true, inspectionLog: row, message: '点検記録を保存しました。' })
})

app.post('/api/inspection/fix', async (c) => {
  const db = c.env.DB
  const { id, repairNote } = await c.req.json()
  await db.prepare(
    'UPDATE inspection_logs SET repair_status=\'fixed\', repair_note=? WHERE id=?'
  ).bind(repairNote || '修繕作業が完了しました。', id).run()
  const row = await db.prepare('SELECT * FROM inspection_logs WHERE id = ?').bind(id).first() as any
  if (row) row.items = JSON.parse(row.items || '[]')
  return c.json({ success: true, inspectionLog: row })
})

app.delete('/api/inspection/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM inspection_logs WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── NFC / QR Tap ────────────────────────────────────────────────────────────

app.post('/api/nfc/tap', async (c) => {
  const db = c.env.DB
  const { tagId, teacherId } = await c.req.json()
  if (!tagId || !teacherId) {
    return c.json({ success: false, message: 'NFCタグIDと教員IDが必要です。' }, 400)
  }

  const resource = await db.prepare(
    'SELECT * FROM resources WHERE nfc_tag_id = ? OR qr_code_id = ?'
  ).bind(tagId, tagId).first() as any
  if (!resource) {
    return c.json({ success: false, message: `タグID [${tagId}] に紐づく備品・教室が見つかりません。` }, 404)
  }

  const teacher = await db.prepare('SELECT * FROM teachers WHERE id = ?').bind(teacherId).first() as any
  if (!teacher) {
    return c.json({ success: false, message: '操作教員が見つかりません。' }, 404)
  }

  let action: string
  let message: string
  const previousTeacherId = resource.current_teacher_id

  if (resource.status === 'available') {
    action = 'check_out'
    message = `「${resource.name}」の貸出（利用開始）を処理しました。`
    await db.prepare(
      'UPDATE resources SET status=\'checked_out\', current_teacher_id=?, last_checked_out_at=? WHERE id=?'
    ).bind(teacherId, new Date().toISOString(), resource.id).run()
  } else if (resource.status === 'checked_out') {
    if (resource.current_teacher_id === teacherId) {
      action = 'check_in'
      message = `「${resource.name}」の返却（利用終了）を処理しました。`
      await db.prepare(
        'UPDATE resources SET status=\'available\', current_teacher_id=NULL, last_checked_out_at=NULL WHERE id=?'
      ).bind(resource.id).run()
    } else {
      action = 'baton'
      const oldTeacher = previousTeacherId
        ? await db.prepare('SELECT name FROM teachers WHERE id = ?').bind(previousTeacherId).first() as any
        : null
      message = `「${resource.name}」を ${oldTeacher?.name || '前の教員'} から ${teacher.name} へ引き継ぎしました。`
      await db.prepare(
        'UPDATE resources SET current_teacher_id=?, last_checked_out_at=? WHERE id=?'
      ).bind(teacherId, new Date().toISOString(), resource.id).run()
      // Resolve SOS from this teacher
      await db.prepare(
        'DELETE FROM sos_requests WHERE resource_id = ? AND teacher_id = ?'
      ).bind(resource.id, teacherId).run()
    }
  } else {
    return c.json({ success: false, message: `「${resource.name}」はメンテナンス中のため操作できません。` }, 400)
  }

  // Record history
  const histId = uid('H')
  await db.prepare(
    'INSERT INTO nfc_history (id, resource_id, teacher_id, action, timestamp, tag_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(histId, resource.id, teacherId, action, new Date().toISOString(), tagId).run()

  const updatedResource = await db.prepare('SELECT * FROM resources WHERE id = ?').bind(resource.id).first() as any
  if (updatedResource) updatedResource.custom_inspection_items = JSON.parse(updatedResource.custom_inspection_items || '[]')

  return c.json({ success: true, action, message, resource: updatedResource })
})

app.post('/api/nfc/classroom', async (c) => {
  const db = c.env.DB
  const { tagId, teacherId, action } = await c.req.json()
  if (!tagId || !teacherId || !action) {
    return c.json({ success: false, message: '必要なパラメータが不足しています。' }, 400)
  }

  const resource = await db.prepare(
    'SELECT * FROM resources WHERE (nfc_tag_id = ? OR qr_code_id = ?) AND category = \'classroom\''
  ).bind(tagId, tagId).first() as any
  if (!resource) {
    return c.json({ success: false, message: '教室が見つかりません。' }, 404)
  }

  let message: string
  if (action === 'check_in') {
    await db.prepare(
      'UPDATE resources SET status=\'checked_out\', current_teacher_id=?, last_checked_out_at=? WHERE id=?'
    ).bind(teacherId, new Date().toISOString(), resource.id).run()
    message = `「${resource.name}」の入室を記録しました。`
  } else {
    await db.prepare(
      'UPDATE resources SET status=\'available\', current_teacher_id=NULL, last_checked_out_at=NULL WHERE id=?'
    ).bind(resource.id).run()
    message = `「${resource.name}」の退室を記録しました。`
  }

  const histId = uid('H')
  await db.prepare(
    'INSERT INTO nfc_history (id, resource_id, teacher_id, action, timestamp, tag_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(histId, resource.id, teacherId, action === 'check_in' ? 'check_out' : 'check_in', new Date().toISOString(), tagId).run()

  return c.json({ success: true, message })
})

app.post('/api/nfc/associate', async (c) => {
  const db = c.env.DB
  const { targetType, targetId, tagId } = await c.req.json()
  if (!targetType || !targetId || !tagId) {
    return c.json({ success: false, message: '必要な情報が不足しています。' }, 400)
  }

  if (targetType === 'teacher') {
    const dup = await db.prepare(
      'SELECT id FROM teachers WHERE nfc_tag_id = ? AND id != ?'
    ).bind(tagId, targetId).first()
    if (dup) return c.json({ success: false, message: 'このタグIDはすでに他の教員に紐付けられています。' }, 400)
    await db.prepare('UPDATE teachers SET nfc_tag_id = ? WHERE id = ?').bind(tagId, targetId).run()
    const row = await db.prepare('SELECT * FROM teachers WHERE id = ?').bind(targetId).first()
    return c.json({ success: true, message: '教員にNFCタグを紐付けました。', teacher: row })
  } else if (targetType === 'resource') {
    const dup = await db.prepare(
      'SELECT id FROM resources WHERE nfc_tag_id = ? AND id != ?'
    ).bind(tagId, targetId).first()
    if (dup) return c.json({ success: false, message: 'このタグIDはすでに他の備品に紐付けられています。' }, 400)
    await db.prepare('UPDATE resources SET nfc_tag_id = ? WHERE id = ?').bind(tagId, targetId).run()
    const row = await db.prepare('SELECT * FROM resources WHERE id = ?').bind(targetId).first()
    return c.json({ success: true, message: '備品・教室にNFCタグを紐付けました。', resource: row })
  }

  return c.json({ success: false, message: '対象が見つかりません。' }, 404)
})

// ─── Quick register (unregistered tag) ───────────────────────────────────────

app.post('/api/resources/quick-register', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const id = uid('R')
  await db.prepare(`
    INSERT INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
  `).bind(
    id, body.name, body.category || 'equipment', body.location || '未設定',
    body.subject || '共通',
    body.nfc_tag_id || body.nfcTagId || null,
    body.qr_code_id || body.qrCodeId || null
  ).run()
  const row = await db.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first()
  return c.json({ success: true, resource: row })
})

// ─── Frontend ────────────────────────────────────────────────────────────────

app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>School-Trace | 学校QR管理システム</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-slate-50 font-sans text-slate-900 antialiased">
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`)
})

export default app
