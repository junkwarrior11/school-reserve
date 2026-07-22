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

// ─── QR Scan Landing Page ────────────────────────────────────────────────────
// スマホカメラでQRを読み取ると開くページ
// URL例: https://school-reserve.pages.dev/scan/QR_xxx

app.get('/scan/:qrId', async (c) => {
  const db = c.env.DB
  const qrId = c.req.param('qrId')

  // リソース取得
  const resource = await db.prepare(
    'SELECT * FROM resources WHERE qr_code_id = ? OR id = ?'
  ).bind(qrId, qrId).first() as any

  // 教員一覧
  const teachersRes = await db.prepare('SELECT * FROM teachers ORDER BY created_at ASC').all()
  const teachers = teachersRes.results as any[]

  const teacherOptions = teachers.map(t =>
    `<option value="${t.id}">${t.name}（${t.department}）</option>`
  ).join('')

  const baseUrl = new URL(c.req.url).origin

  if (!resource) {
    // リソースが見つからない場合
    return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>QR不明 | School-Trace</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
    <div class="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
      <span class="text-3xl">❓</span>
    </div>
    <h1 class="text-xl font-bold text-slate-800">QRコードが見つかりません</h1>
    <p class="text-sm text-slate-500">QRコードID: <code class="bg-slate-100 px-1 rounded text-xs">${qrId}</code></p>
    <a href="${baseUrl}" class="inline-block w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm">
      管理アプリを開く
    </a>
  </div>
</body>
</html>`)
  }

  const categoryLabel = resource.category === 'classroom' ? '教室' : '備品'
  const categoryIcon  = resource.category === 'classroom' ? '🏫' : '📦'
  const statusMap: Record<string, [string, string]> = {
    available:   ['#d1fae5', '✅ 利用可能'],
    checked_out: ['#e0e7ff', '📌 使用中'],
    maintenance: ['#fef3c7', '🔧 整備中'],
  }
  const [statusBg, statusLabel] = statusMap[resource.status] || ['#f1f5f9', resource.status]

  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${resource.name} | School-Trace</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
  <style>
    body { font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', system-ui, sans-serif; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    .fade-in { animation: fadeIn .35s ease-out; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin .7s linear infinite; }
    .btn-tap { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    select { -webkit-appearance: none; appearance: none; }
  </style>
</head>
<body class="bg-slate-100 min-h-screen">

  <!-- ヘッダー -->
  <header class="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
    <div class="flex items-center gap-2">
      <span class="text-lg">📋</span>
      <span class="font-bold text-sm">School-Trace</span>
    </div>
    <a href="${baseUrl}" class="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl font-semibold transition-all btn-tap">
      管理画面 →
    </a>
  </header>

  <main class="max-w-lg mx-auto px-4 py-6 space-y-4 fade-in">

    <!-- リソース情報カード -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
             style="background: ${resource.category === 'classroom' ? '#dbeafe' : '#f3e8ff'}">
          ${categoryIcon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">${categoryLabel}</p>
          <h1 class="text-2xl font-bold text-slate-900 leading-tight">${resource.name}</h1>
          ${resource.location ? `<p class="text-sm text-slate-500 mt-0.5"><i class="fa fa-location-dot mr-1 text-slate-400"></i>${resource.location}</p>` : ''}
        </div>
      </div>

      <!-- 現在の状態 -->
      <div class="mt-4 rounded-2xl px-4 py-3 flex items-center justify-between" style="background:${statusBg}">
        <span class="font-bold text-sm text-slate-700">現在の状態</span>
        <span class="font-bold text-sm">${statusLabel}</span>
      </div>

      <!-- 使用中の場合：誰が使っているか -->
      <div id="current-user-section" class="${resource.status === 'checked_out' && resource.current_teacher_id ? '' : 'hidden'} mt-3 bg-indigo-50 rounded-2xl px-4 py-3">
        <p class="text-xs text-indigo-500 font-semibold mb-1">現在の使用者</p>
        <p class="text-base font-bold text-indigo-800" id="current-user-name">
          ${resource.current_teacher_id
            ? (teachers.find(t => t.id === resource.current_teacher_id)?.name || '不明')
            : ''}
        </p>
      </div>
    </div>

    <!-- 操作フォーム -->
    <div id="action-form" class="${resource.status === 'maintenance' ? 'hidden' : ''} bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-4">
      <h2 class="font-bold text-slate-800 flex items-center gap-2">
        <i class="fa fa-hand-pointer text-indigo-500"></i>
        操作する
      </h2>

      <!-- 教員選択 -->
      <div>
        <label class="block text-xs font-semibold text-slate-500 mb-2">あなたは誰ですか？</label>
        <div class="relative">
          <select id="teacher-select"
            class="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-base font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 pr-10">
            <option value="">教員を選んでください</option>
            ${teacherOptions}
          </select>
          <i class="fa fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm"></i>
        </div>
      </div>

      <!-- アクションボタン -->
      <div id="action-buttons" class="space-y-3">
        <!-- JS で動的に表示 -->
        <p class="text-sm text-slate-400 text-center py-2">↑ 教員を選択してください</p>
      </div>
    </div>

    <!-- 整備中メッセージ -->
    ${resource.status === 'maintenance' ? `
    <div class="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-center space-y-2">
      <p class="text-3xl">🔧</p>
      <p class="font-bold text-amber-800">現在整備中です</p>
      <p class="text-sm text-amber-600">整備が完了するまでご利用いただけません。</p>
    </div>` : ''}

    <!-- 結果表示 -->
    <div id="result-section" class="hidden fade-in bg-white rounded-3xl shadow-sm border border-slate-100 p-5 text-center space-y-3">
      <div id="result-icon" class="text-5xl"></div>
      <p id="result-message" class="text-lg font-bold text-slate-800"></p>
      <p id="result-sub" class="text-sm text-slate-500"></p>
      <button onclick="resetForm()"
        class="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all btn-tap mt-2">
        別の操作をする
      </button>
      <a href="${baseUrl}"
        class="block w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all btn-tap">
        管理画面を開く
      </a>
    </div>

    <!-- 最近の利用履歴 -->
    <div id="history-section" class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
      <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
        <i class="fa fa-clock-rotate-left text-slate-400"></i>
        最近の利用履歴
      </h3>
      <div id="history-list" class="space-y-2 text-sm text-slate-400 text-center py-2">
        読み込み中...
      </div>
    </div>

  </main>

  <script>
    const RESOURCE_ID = '${resource.id}';
    const QR_ID       = '${qrId}';
    const RESOURCE_STATUS = '${resource.status}';
    const CURRENT_TEACHER_ID = '${resource.current_teacher_id || ''}';

    // ── 教員選択 → ボタン表示 ──
    const sel = document.getElementById('teacher-select');
    sel.addEventListener('change', updateButtons);

    function updateButtons() {
      const teacherId = sel.value;
      const container = document.getElementById('action-buttons');
      if (!teacherId) {
        container.innerHTML = '<p class="text-sm text-slate-400 text-center py-2">↑ 教員を選択してください</p>';
        return;
      }

      if (RESOURCE_STATUS === 'available') {
        container.innerHTML = \`
          <button onclick="doAction('check_out')"
            class="btn-tap w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95"
            style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
            <i class="fa fa-arrow-right-from-bracket text-lg"></i>
            貸出・利用開始
          </button>\`;
      } else if (RESOURCE_STATUS === 'checked_out') {
        if (teacherId === CURRENT_TEACHER_ID) {
          container.innerHTML = \`
            <button onclick="doAction('check_in')"
              class="btn-tap w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95"
              style="background: linear-gradient(135deg, #10b981, #059669);">
              <i class="fa fa-arrow-right-to-bracket text-lg"></i>
              返却・利用終了
            </button>\`;
        } else {
          container.innerHTML = \`
            <button onclick="doAction('check_in')"
              class="btn-tap w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95"
              style="background: linear-gradient(135deg, #10b981, #059669);">
              <i class="fa fa-arrow-right-to-bracket text-lg"></i>
              返却・利用終了
            </button>
            <button onclick="doAction('baton')"
              class="btn-tap w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95"
              style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
              <i class="fa fa-arrows-left-right text-lg"></i>
              引継ぎ（自分が使い続ける）
            </button>\`;
        }
      }
    }

    // ── API呼び出し ──
    async function doAction(action) {
      const teacherId = document.getElementById('teacher-select').value;
      if (!teacherId) return;

      // ボタンをローディング状態に
      const buttons = document.getElementById('action-buttons');
      buttons.innerHTML = \`
        <div class="flex items-center justify-center gap-3 py-5 text-indigo-600">
          <svg class="spinner w-7 h-7 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span class="font-semibold text-base">処理中...</span>
        </div>\`;

      try {
        const endpoint = '/api/nfc/tap';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId: QR_ID, teacherId }),
        });
        const data = await res.json();
        showResult(data.success, data.message, data.action);
        if (data.success) loadHistory();
      } catch (e) {
        showResult(false, 'ネットワークエラーが発生しました。再度お試しください。', null);
      }
    }

    // ── 結果表示 ──
    function showResult(success, message, action) {
      document.getElementById('action-form').classList.add('hidden');
      const section = document.getElementById('result-section');
      section.classList.remove('hidden');

      const iconMap = {
        check_out: '✅',
        check_in:  '🔓',
        baton:     '🤝',
      };
      const subMap = {
        check_out: '利用を開始しました',
        check_in:  '返却が完了しました',
        baton:     '引継ぎを記録しました',
      };
      document.getElementById('result-icon').textContent = success ? (iconMap[action] || '✅') : '❌';
      document.getElementById('result-message').textContent = message;
      document.getElementById('result-sub').textContent = success ? (subMap[action] || '') : '';
    }

    // ── フォームリセット ──
    function resetForm() {
      location.reload();
    }

    // ── 履歴読み込み ──
    async function loadHistory() {
      try {
        const data = await fetch('/api/data').then(r => r.json());
        const history = (data.nfcHistory || []).filter(h => h.resource_id === RESOURCE_ID).slice(0, 8);
        const teachers = data.teachers || [];
        const list = document.getElementById('history-list');
        if (history.length === 0) {
          list.innerHTML = '<p class="text-sm text-slate-400 text-center py-2">利用履歴がありません</p>';
          return;
        }
        const actionLabels = { check_out: '貸出', check_in: '返却', baton: '引継' };
        const actionColors = { check_out: '#dbeafe', check_in: '#d1fae5', baton: '#ede9fe' };
        list.innerHTML = history.map(h => {
          const t = teachers.find(x => x.id === h.teacher_id);
          const label = actionLabels[h.action] || h.action;
          const color = actionColors[h.action] || '#f1f5f9';
          const dt = new Date(h.timestamp).toLocaleString('ja-JP', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          });
          return \`<div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:\${color}">\${label}</span>
              <span class="font-semibold text-slate-700 text-sm">\${t?.name || '不明'}</span>
            </div>
            <span class="text-xs text-slate-400">\${dt}</span>
          </div>\`;
        }).join('');
      } catch(e) {}
    }

    // 初期ロード
    loadHistory();
  </script>
</body>
</html>`)
})

// ─── GET /api/resource/:qrId  (ランディングページ用JSON) ─────────────────────

app.get('/api/resource/:qrId', async (c) => {
  const db = c.env.DB
  const qrId = c.req.param('qrId')
  const resource = await db.prepare(
    'SELECT * FROM resources WHERE qr_code_id = ? OR id = ?'
  ).bind(qrId, qrId).first() as any
  if (!resource) return c.json({ success: false, message: 'リソースが見つかりません' }, 404)
  resource.custom_inspection_items = JSON.parse(resource.custom_inspection_items || '[]')
  return c.json({ success: true, resource })
})

// ─── Print QR Page ───────────────────────────────────────────────────────────

app.get('/print-qr', async (c) => {
  const db = c.env.DB
  const { category } = c.req.query()
  const resources = category
    ? await db.prepare('SELECT id, name, category, location, qr_code_id FROM resources WHERE category = ? ORDER BY name ASC').bind(category).all()
    : await db.prepare('SELECT id, name, category, location, qr_code_id FROM resources ORDER BY category ASC, name ASC').all()

  const rows = (resources.results as any[])
  // QRコードにはスキャンランディングページのURLを埋め込む
  const baseUrl = new URL(c.req.url).origin
  const cardsJson = JSON.stringify(rows.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    location: r.location || '',
    qrCodeId: r.qr_code_id || r.id,              // 表示用ID
    qr: `${baseUrl}/scan/${r.qr_code_id || r.id}`, // QRに埋め込むURL
  })))

  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>QRコード一覧 | School-Trace</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Hiragino Kaku Gothic Pro','Meiryo',sans-serif;background:#f1f5f9}
    /* ── Toolbar ── */
    .toolbar{
      position:fixed;top:0;left:0;right:0;z-index:100;
      background:#1e293b;color:white;padding:10px 16px;
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      box-shadow:0 2px 10px rgba(0,0,0,0.4);
    }
    .toolbar-left{display:flex;align-items:center;gap:10px}
    .toolbar h1{font-size:15px;font-weight:700;white-space:nowrap}
    .toolbar-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .progress-text{font-size:12px;color:#94a3b8;white-space:nowrap}
    select.filter{background:#334155;color:white;border:1px solid #475569;padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer}
    .btn{border:none;padding:7px 14px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:opacity .15s}
    .btn:hover{opacity:.85}
    .btn:disabled{opacity:.4;cursor:not-allowed}
    .btn-indigo{background:#6366f1;color:white}
    .btn-emerald{background:#10b981;color:white}
    .btn-slate{background:transparent;color:#94a3b8;border:1px solid #475569}
    .btn-slate:hover{color:white;border-color:#94a3b8}
    /* ── Progress bar ── */
    .progress-bar-wrap{height:3px;background:#334155;position:fixed;top:50px;left:0;right:0;z-index:99}
    .progress-bar{height:3px;background:#6366f1;width:0%;transition:width .2s}
    /* ── Content ── */
    .content{padding:70px 16px 24px}
    .count-bar{font-size:13px;color:#64748b;margin-bottom:12px;display:flex;align-items:center;gap:8px}
    /* ── Grid ── */
    .grid{display:flex;flex-wrap:wrap;gap:10px}
    /* ── Card ── */
    .qr-card{
      background:white;border:1.5px solid #e2e8f0;border-radius:14px;
      padding:12px 10px;width:162px;
      display:flex;flex-direction:column;align-items:center;gap:6px;
      page-break-inside:avoid;
      transition:box-shadow .15s,border-color .15s;
      cursor:default;
    }
    .qr-card:hover{box-shadow:0 4px 14px rgba(99,102,241,.15);border-color:#a5b4fc}
    .qr-img-wrap{
      width:136px;height:136px;border-radius:10px;overflow:hidden;
      background:#f1f5f9;display:flex;align-items:center;justify-content:center;
      position:relative;
    }
    .qr-img-wrap img{width:136px;height:136px;display:block}
    .qr-spinner{
      width:28px;height:28px;border:3px solid #e2e8f0;
      border-top-color:#6366f1;border-radius:50%;
      animation:spin .7s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .qr-dl-btn{
      width:100%;padding:5px 0;border-radius:8px;border:1px solid #e2e8f0;
      background:white;color:#6366f1;font-size:11px;font-weight:700;
      cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;
      transition:background .12s,border-color .12s;
    }
    .qr-dl-btn:hover{background:#eef2ff;border-color:#a5b4fc}
    .qr-label{text-align:center;width:100%}
    .qr-name{font-weight:700;font-size:12px;color:#1e293b;line-height:1.3;margin-bottom:2px;word-break:break-all}
    .qr-id{font-size:8px;color:#94a3b8;font-family:monospace;word-break:break-all;margin-bottom:2px}
    .qr-loc{font-size:10px;color:#64748b}
    .qr-cat-badge{
      display:inline-block;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;margin-top:2px;
    }
    .cat-classroom{background:#dbeafe;color:#1d4ed8}
    .cat-equipment{background:#f3e8ff;color:#7e22ce}
    /* ── Print ── */
    @media print{
      .toolbar,.progress-bar-wrap,.qr-dl-btn{display:none!important}
      .content{padding:0}
      body{background:white}
      .qr-card{box-shadow:none;border-color:#cbd5e1;border-radius:8px}
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <a href="/" class="btn btn-slate" style="padding:6px 10px;font-size:12px">← 戻る</a>
      <h1>🖨️ QRコード一覧</h1>
    </div>
    <div class="toolbar-right">
      <span class="progress-text" id="prog-text">生成中...</span>
      <select class="filter" onchange="location.href='/print-qr'+(this.value?'?category='+this.value:'')">
        <option value="" ${!category?'selected':''}>すべて (${rows.length}件)</option>
        <option value="classroom" ${category==='classroom'?'selected':''}>教室のみ</option>
        <option value="equipment" ${category==='equipment'?'selected':''}>備品のみ</option>
      </select>
      <button class="btn btn-emerald" id="btn-zip" onclick="downloadAllZip()" disabled>
        ⬇ 全件ZIP
      </button>
      <button class="btn btn-indigo" onclick="window.print()">🖨️ 印刷</button>
    </div>
  </div>
  <div class="progress-bar-wrap"><div class="progress-bar" id="prog-bar"></div></div>
  <div class="content">
    <div class="count-bar">
      <span id="count-label">${rows.length} 件</span>
    </div>
    <div class="grid" id="qr-grid"></div>
  </div>

  <script>
    const RESOURCES = ${cardsJson};
    const qrDataURLs = {};   // id → dataURL (生成完了後に蓄積)
    let doneCount = 0;

    // ── カード雛形を先に全件描画 ──
    const grid = document.getElementById('qr-grid');
    RESOURCES.forEach(r => {
      const card = document.createElement('div');
      card.className = 'qr-card';
      card.id = 'card-' + r.id;
      card.innerHTML =
        '<div class="qr-img-wrap" id="img-' + r.id + '"><div class="qr-spinner"></div></div>' +
        '<button class="qr-dl-btn" id="dl-' + r.id + '" onclick="dlOne(\\''+r.id+'\\')" disabled>' +
          '⬇ PNG保存' +
        '</button>' +
        '<div class="qr-label">' +
          '<div class="qr-name">' + r.name + '</div>' +
          '<div class="qr-id">' + (r.qrCodeId || r.id) + '</div>' +
          (r.location ? '<div class="qr-loc">' + r.location + '</div>' : '') +
          '<span class="qr-cat-badge ' + (r.category==='classroom'?'cat-classroom':'cat-equipment') + '">' +
            (r.category==='classroom' ? '📚 教室' : '📦 備品') +
          '</span>' +
        '</div>';
      grid.appendChild(card);
    });

    // ── 非同期でQR画像を順次生成（バッチ処理でUIブロックを防ぐ） ──
    async function generateAll() {
      const total = RESOURCES.length;
      const bar = document.getElementById('prog-bar');
      const progText = document.getElementById('prog-text');
      const BATCH = 6; // 同時生成数

      for (let i = 0; i < total; i += BATCH) {
        const slice = RESOURCES.slice(i, i + BATCH);
        await Promise.all(slice.map(r => generateOne(r)));
        doneCount = Math.min(i + BATCH, total);
        const pct = Math.round(doneCount / total * 100);
        bar.style.width = pct + '%';
        progText.textContent = doneCount + ' / ' + total + ' 件生成済み';
        await new Promise(res => setTimeout(res, 0)); // UIスレッド解放
      }

      bar.style.background = '#10b981';
      progText.textContent = '✅ ' + total + ' 件 すべて生成完了';
      document.getElementById('btn-zip').disabled = false;
    }

    function generateOne(r) {
      return new Promise(resolve => {
        try {
          // qrcodejs: 隠しコンテナに描画 → canvas.toDataURL() で取得
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
          document.body.appendChild(container);
          new QRCode(container, {
            text: r.qr,
            width: 300, height: 300,
            colorDark: '#1e293b', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M,
          });
          requestAnimationFrame(() => {
            try {
              const canvas = container.querySelector('canvas');
              const url = canvas ? canvas.toDataURL('image/png') : '';
              document.body.removeChild(container);
              const imgWrap = document.getElementById('img-' + r.id);
              const dlBtn   = document.getElementById('dl-'  + r.id);
              if (url) {
                qrDataURLs[r.id] = url;
                if (imgWrap) imgWrap.innerHTML = '<img src="' + url + '" alt="QR" style="width:136px;height:136px;">';
                if (dlBtn)   dlBtn.disabled = false;
              } else {
                if (imgWrap) imgWrap.innerHTML =
                  '<div style="width:136px;height:136px;display:flex;align-items:center;justify-content:center;' +
                  'background:#fee2e2;border-radius:8px;font-size:10px;color:#dc2626;text-align:center;padding:8px">生成エラー</div>';
              }
            } catch(e2) {
              const imgWrap = document.getElementById('img-' + r.id);
              if (imgWrap) imgWrap.innerHTML =
                '<div style="width:136px;height:136px;display:flex;align-items:center;justify-content:center;' +
                'background:#fee2e2;border-radius:8px;font-size:10px;color:#dc2626;text-align:center;padding:8px">エラー: ' + e2.message + '</div>';
            }
            resolve();
          });
        } catch(e) {
          const imgWrap = document.getElementById('img-' + r.id);
          if (imgWrap) imgWrap.innerHTML =
            '<div style="width:136px;height:136px;display:flex;align-items:center;justify-content:center;' +
            'background:#fee2e2;border-radius:8px;font-size:10px;color:#dc2626;text-align:center;padding:8px">エラー: ' + e.message + '</div>';
          resolve();
        }
      });
    }

    // ── 個別 PNG ダウンロード ──
    function dlOne(id) {
      const url = qrDataURLs[id];
      if (!url) return;
      const r = RESOURCES.find(x => x.id === id);
      const a = document.createElement('a');
      a.href = url;
      a.download = (r ? r.name : id) + '_QR.png';
      a.click();
    }

    // ── 全件 ZIP ダウンロード（JSZip） ──
    async function downloadAllZip() {
      const btn = document.getElementById('btn-zip');
      btn.disabled = true;
      btn.textContent = '⏳ ZIP作成中...';

      const zip = new JSZip();
      const folder = zip.folder('QRcodes');
      RESOURCES.forEach(r => {
        const url = qrDataURLs[r.id];
        if (!url) return;
        // dataURL → base64
        const base64 = url.split(',')[1];
        folder.file(r.name + '_QR.png', base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'SchoolTrace_QRcodes.zip';
      a.click();

      btn.disabled = false;
      btn.textContent = '⬇ 全件ZIP';
    }

    // 起動：外部ライブラリを動的ロードしてから実行
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    async function boot() {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
        generateAll();
      } catch(e) {
        document.getElementById('prog-text').textContent = '⚠️ ライブラリの読み込みに失敗しました';
      }
    }
    boot();
  </script>
</body>
</html>`)
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
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-slate-50 font-sans text-slate-900 antialiased">
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`)
})

export default app
