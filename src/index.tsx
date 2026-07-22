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

// ─── Inspection Landing Page ─────────────────────────────────────────────────
// スマホカメラでQRを読み取ると開く安全点検ページ
// URL例: https://school-reserve.pages.dev/inspect/QR_xxx

app.get('/inspect/:qrId', async (c) => {
  const db = c.env.DB
  const qrId = c.req.param('qrId')
  const baseUrl = new URL(c.req.url).origin

  // リソース取得
  const resource = await db.prepare(
    'SELECT * FROM resources WHERE qr_code_id = ? OR id = ?'
  ).bind(qrId, qrId).first() as any

  // 教員一覧
  const teachersRes = await db.prepare('SELECT * FROM teachers ORDER BY created_at ASC').all()
  const teachers = teachersRes.results as any[]

  // 直近の点検記録（このリソース）
  const logsRes = await db.prepare(
    'SELECT il.*, t.name as teacher_name FROM inspection_logs il LEFT JOIN teachers t ON il.teacher_id = t.id WHERE il.resource_id = ? ORDER BY il.date DESC LIMIT 5'
  ).bind(resource?.id || '').all()
  const recentLogs = logsRes.results as any[]

  // デフォルト点検項目
  const DEFAULT_ITEMS_CLASSROOM = ['非常扉周りに避難の妨げとなる物がないか','窓・照明・防球ネット等の破損はないか','消火器の配置状況・使用期限の確認','備品・机・椅子の破損や危険な状態がないか','電気設備・コンセントの状態確認']
  const DEFAULT_ITEMS_EQUIPMENT = ['本体の外観に割れ・破損・汚れがないか','電源・バッテリーの状態確認','付属品・消耗品の残量と期限確認','動作確認（正常に動くか）','保管場所・整理整頓の確認']

  const teacherOptions = teachers.map(t =>
    `<option value="${t.id}">${t.name}（${t.department}）</option>`
  ).join('')

  if (!resource) {
    return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>QR不明 | School-Trace 安全点検</title>
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

  const categoryIcon = resource.category === 'classroom' ? '🏫' : '📦'
  const categoryLabel = resource.category === 'classroom' ? '教室' : '備品'

  // カスタム点検項目 or デフォルト
  const customItems = JSON.parse(resource.custom_inspection_items || '[]')
  const inspectItems: string[] = customItems.length > 0
    ? customItems
    : (resource.category === 'classroom' ? DEFAULT_ITEMS_CLASSROOM : DEFAULT_ITEMS_EQUIPMENT)

  // 直近ログのHTML
  const recentLogsHtml = recentLogs.length === 0
    ? '<p class="text-sm text-slate-400 text-center py-3">点検記録がありません</p>'
    : recentLogs.map(l => {
        const statusMap: Record<string, [string, string]> = {
          ok:      ['#d1fae5', '✅ 良好'],
          caution: ['#fef3c7', '⚠️ 要確認'],
          ng:      ['#fee2e2', '❌ 要修理'],
        }
        const [bg, label] = statusMap[l.overall_status] || ['#f1f5f9', l.overall_status]
        const dt = new Date(l.date).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        const repairBadge = l.repair_status === 'pending'
          ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold ml-1">修繕中</span>'
          : l.repair_status === 'fixed'
            ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold ml-1">修繕済</span>'
            : ''
        return `<div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
          <div>
            <span class="text-xs font-bold px-2 py-0.5 rounded-full mr-1" style="background:${bg}">${label}</span>${repairBadge}
            <span class="text-sm text-slate-700 font-semibold">${l.teacher_name || '不明'}</span>
          </div>
          <span class="text-xs text-slate-400 shrink-0">${dt}</span>
        </div>`
      }).join('')

  const itemsJson = JSON.stringify(inspectItems)

  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${resource.name} 安全点検 | School-Trace</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
  <style>
    body { font-family: 'Hiragino Kaku Gothic Pro', 'Meiryo', system-ui, sans-serif; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    .fade-in { animation: fadeIn .3s ease-out; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin .7s linear infinite; }
    .btn-tap { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    select, textarea, input[type=text] { -webkit-appearance: none; appearance: none; }
    /* チェックリストアイテムのボタンを大きく押しやすく */
    .check-btn { min-height: 44px; }
  </style>
</head>
<body class="bg-slate-100 min-h-screen">

  <!-- ヘッダー -->
  <header class="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
    <div class="flex items-center gap-2">
      <i class="fa fa-shield-halved text-lg"></i>
      <span class="font-bold text-sm">安全点検</span>
    </div>
    <a href="${baseUrl}" class="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl font-semibold transition-all btn-tap">
      管理画面 →
    </a>
  </header>

  <main class="max-w-lg mx-auto px-4 py-5 space-y-4 fade-in pb-10">

    <!-- リソース情報カード -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
             style="background:${resource.category === 'classroom' ? '#dbeafe' : '#f3e8ff'}">
          ${categoryIcon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">${categoryLabel} · 安全点検</p>
          <h1 class="text-2xl font-bold text-slate-900 leading-tight">${resource.name}</h1>
          ${resource.location ? `<p class="text-sm text-slate-500 mt-0.5"><i class="fa fa-location-dot mr-1 text-slate-400"></i>${resource.location}</p>` : ''}
        </div>
      </div>
    </div>

    <!-- 点検フォーム -->
    <div id="inspect-form" class="space-y-4">

      <!-- 点検者 -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">
          <i class="fa fa-user-check text-indigo-500"></i> 点検者
        </h2>
        <div class="relative">
          <select id="teacher-select"
            class="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-base font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 pr-10">
            <option value="">教員を選んでください</option>
            ${teacherOptions}
          </select>
          <i class="fa fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm"></i>
        </div>
      </div>

      <!-- 総合評価 -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">
          <i class="fa fa-clipboard-check text-indigo-500"></i> 総合評価
        </h2>
        <div class="grid grid-cols-3 gap-2" id="overall-btns">
          <button onclick="setOverall('ok')" id="btn-ok"
            class="check-btn btn-tap rounded-2xl font-bold text-sm border-2 border-emerald-300 bg-emerald-50 text-emerald-700 transition-all flex flex-col items-center justify-center gap-1 py-3 ring-2 ring-emerald-400">
            <i class="fa fa-circle-check text-lg"></i><span>良好</span>
          </button>
          <button onclick="setOverall('caution')" id="btn-caution"
            class="check-btn btn-tap rounded-2xl font-bold text-sm border-2 border-slate-200 text-slate-500 transition-all flex flex-col items-center justify-center gap-1 py-3">
            <i class="fa fa-triangle-exclamation text-lg"></i><span>要確認</span>
          </button>
          <button onclick="setOverall('ng')" id="btn-ng"
            class="check-btn btn-tap rounded-2xl font-bold text-sm border-2 border-slate-200 text-slate-500 transition-all flex flex-col items-center justify-center gap-1 py-3">
            <i class="fa fa-circle-xmark text-lg"></i><span>要修理</span>
          </button>
        </div>
      </div>

      <!-- チェックリスト -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">
          <i class="fa fa-list-check text-indigo-500"></i>
          点検チェックリスト <span class="text-xs font-normal text-slate-400">(${inspectItems.length}項目)</span>
        </h2>
        <div class="space-y-3" id="checklist-container">
          ${inspectItems.map((item, idx) => `
          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p class="text-sm font-semibold text-slate-800 mb-2">${idx + 1}. ${item}</p>
            <div class="grid grid-cols-3 gap-1.5 mb-2">
              <button onclick="setItemStatus(${idx},'ok')" id="item-ok-${idx}"
                class="check-btn btn-tap rounded-xl text-xs font-bold border-2 border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300 transition-all py-2">
                ◯ 良好
              </button>
              <button onclick="setItemStatus(${idx},'caution')" id="item-caution-${idx}"
                class="check-btn btn-tap rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-500 transition-all py-2">
                △ 注意
              </button>
              <button onclick="setItemStatus(${idx},'ng')" id="item-ng-${idx}"
                class="check-btn btn-tap rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-500 transition-all py-2">
                ✕ 修理
              </button>
            </div>
            <input type="text" placeholder="コメント（任意）"
              class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-all"
              oninput="setItemComment(${idx}, this.value)" id="item-comment-${idx}">
          </div>
          `).join('')}
        </div>
      </div>

      <!-- 特記事項 -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
        <h2 class="font-bold text-slate-800 flex items-center gap-2">
          <i class="fa fa-pen-to-square text-indigo-500"></i> 特記事項・コメント
        </h2>
        <textarea id="general-comment" rows="3" placeholder="気になった点や詳細コメントを記入してください（任意）"
          class="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 transition-all resize-none"></textarea>
      </div>

      <!-- 送信ボタン -->
      <button onclick="submitInspection()" id="submit-btn"
        class="btn-tap w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm"
        style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
        <i class="fa fa-shield-check text-lg"></i>
        点検記録を保存する
      </button>
    </div>

    <!-- 完了表示 -->
    <div id="result-section" class="hidden fade-in bg-white rounded-3xl shadow-sm border border-slate-100 p-6 text-center space-y-4">
      <div id="result-icon" class="text-5xl"></div>
      <p id="result-title" class="text-xl font-bold text-slate-800"></p>
      <p id="result-sub" class="text-sm text-slate-500 leading-relaxed"></p>
      <button onclick="location.reload()"
        class="btn-tap w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all">
        もう一度点検する
      </button>
      <a href="${baseUrl}"
        class="block w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all btn-tap">
        管理画面を開く
      </a>
    </div>

    <!-- 直近の点検履歴 -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
      <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
        <i class="fa fa-clock-rotate-left text-slate-400"></i> 直近の点検記録
      </h3>
      <div>${recentLogsHtml}</div>
    </div>

  </main>

  <script>
    const RESOURCE_ID = '${resource.id}';
    const QR_ID       = '${qrId}';
    const INSPECT_ITEMS = ${itemsJson};

    // ── 状態管理 ──
    let overallStatus = 'ok';
    const itemStatuses  = INSPECT_ITEMS.map(() => 'ok');
    const itemComments  = INSPECT_ITEMS.map(() => '');

    // ── 総合評価ボタン ──
    const OVERALL_STYLES = {
      ok:      { active: 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300', inactive: 'border-slate-200 bg-white text-slate-500' },
      caution: { active: 'border-amber-300 bg-amber-50 text-amber-700 ring-2 ring-amber-300',         inactive: 'border-slate-200 bg-white text-slate-500' },
      ng:      { active: 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-300',                 inactive: 'border-slate-200 bg-white text-slate-500' },
    };
    function setOverall(val) {
      overallStatus = val;
      ['ok','caution','ng'].forEach(v => {
        const btn = document.getElementById('btn-' + v);
        if (!btn) return;
        const s = OVERALL_STYLES[v];
        btn.className = btn.className
          .replace(/border-\\S+|bg-\\S+|text-\\S+|ring-\\S+/g, '')
          .trim();
        const classes = (v === val ? s.active : s.inactive).split(' ');
        btn.classList.add(...classes);
      });
    }

    // ── チェックリストアイテム ──
    const ITEM_STYLES = {
      ok:      { active: 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300', inactive: 'border-slate-200 bg-white text-slate-500' },
      caution: { active: 'border-amber-300 bg-amber-50 text-amber-700 ring-2 ring-amber-300',         inactive: 'border-slate-200 bg-white text-slate-500' },
      ng:      { active: 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-300',                 inactive: 'border-slate-200 bg-white text-slate-500' },
    };
    function setItemStatus(idx, val) {
      itemStatuses[idx] = val;
      ['ok','caution','ng'].forEach(v => {
        const btn = document.getElementById(\`item-\${v}-\${idx}\`);
        if (!btn) return;
        const s = ITEM_STYLES[v];
        btn.className = btn.className
          .replace(/border-\\S+|bg-\\S+|text-\\S+|ring-\\S+/g, '')
          .trim();
        const classes = (v === val ? s.active : s.inactive).split(' ');
        btn.classList.add(...classes);
      });
    }
    function setItemComment(idx, val) {
      itemComments[idx] = val;
    }

    // ── 送信 ──
    async function submitInspection() {
      const teacherId = document.getElementById('teacher-select').value;
      if (!teacherId) {
        alert('点検者を選択してください');
        document.getElementById('teacher-select').focus();
        return;
      }

      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.innerHTML = \`<svg class="spinner w-6 h-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg> 保存中...\`;

      const items = INSPECT_ITEMS.map((title, i) => ({
        id: String(i + 1),
        title,
        status: itemStatuses[i],
        comment: itemComments[i],
      }));

      try {
        const res = await fetch('/api/inspection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: RESOURCE_ID,
            teacherId,
            overallStatus,
            items,
            generalComment: document.getElementById('general-comment').value.trim(),
            date: new Date().toISOString(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          showResult(true, overallStatus);
        } else {
          showResult(false, null, data.message);
        }
      } catch(e) {
        showResult(false, null, 'ネットワークエラーが発生しました。再度お試しください。');
      }
    }

    // ── 結果表示 ──
    function showResult(success, status, errMsg) {
      document.getElementById('inspect-form').classList.add('hidden');
      const section = document.getElementById('result-section');
      section.classList.remove('hidden');

      if (success) {
        const iconMap   = { ok:'✅', caution:'⚠️', ng:'🔧' };
        const titleMap  = { ok:'点検完了 — 良好', caution:'点検完了 — 要確認', ng:'点検完了 — 要修理' };
        const subMap    = {
          ok:      '安全確認が完了しました。記録を保存しました。',
          caution: '確認が必要な点があります。管理担当者に連絡してください。',
          ng:      '修理が必要な箇所があります。管理担当者に連絡し、使用を控えてください。',
        };
        document.getElementById('result-icon').textContent  = iconMap[status]  || '✅';
        document.getElementById('result-title').textContent = titleMap[status] || '点検完了';
        document.getElementById('result-sub').textContent   = subMap[status]   || '記録を保存しました。';
      } else {
        document.getElementById('result-icon').textContent  = '❌';
        document.getElementById('result-title').textContent = 'エラーが発生しました';
        document.getElementById('result-sub').textContent   = errMsg || '保存に失敗しました。';
      }
    }
  </script>
</body>
</html>`)
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

  // ── 安全点検用データ ──
  const DEFAULT_ITEMS_CLASSROOM = ['非常扉周りに避難の妨げとなる物がないか','窓・照明・防球ネット等の破損はないか','消火器の配置状況・使用期限の確認','備品・机・椅子の破損や危険な状態がないか','電気設備・コンセントの状態確認']
  const DEFAULT_ITEMS_EQUIPMENT = ['本体の外観に割れ・破損・汚れがないか','電源・バッテリーの状態確認','付属品・消耗品の残量と期限確認','動作確認（正常に動くか）','保管場所・整理整頓の確認']
  const customInspectItems = resource ? JSON.parse(resource.custom_inspection_items || '[]') : []
  const inspectItems: string[] = customInspectItems.length > 0
    ? customInspectItems
    : (resource?.category === 'classroom' ? DEFAULT_ITEMS_CLASSROOM : DEFAULT_ITEMS_EQUIPMENT)

  // 直近の点検記録
  const inspectLogsRes = resource ? await db.prepare(
    'SELECT il.*, t.name as teacher_name FROM inspection_logs il LEFT JOIN teachers t ON il.teacher_id = t.id WHERE il.resource_id = ? ORDER BY il.date DESC LIMIT 3'
  ).bind(resource.id).all() : { results: [] }
  const recentInspectLogs = inspectLogsRes.results as any[]

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
    select, textarea, input[type=text] { -webkit-appearance: none; appearance: none; }
    .check-btn { min-height: 44px; }
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

    <!-- タブ切り替え -->
    <div class="flex gap-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5">
      <button id="tab-btn-scan" onclick="switchTab('scan')"
        class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-tap bg-indigo-600 text-white shadow-sm">
        <i class="fa fa-qrcode"></i> 貸出 / 返却
      </button>
      <button id="tab-btn-inspect" onclick="switchTab('inspect')"
        class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-tap text-slate-500">
        <i class="fa fa-shield-halved"></i> 安全点検
      </button>
    </div>

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

    <!-- 貸出/返却パネル -->
    <div id="scan-panel" class="space-y-4">
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

    </div><!-- /scan-panel -->

    <!-- 安全点検パネル -->
    <div id="inspect-panel" class="hidden space-y-4">

      <!-- 点検フォーム -->
      <div id="inspect-form" class="space-y-4">

        <!-- 点検者 -->
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <h2 class="font-bold text-slate-800 flex items-center gap-2">
            <i class="fa fa-user-check text-indigo-500"></i> 点検者
          </h2>
          <div class="relative">
            <select id="inspect-teacher-select"
              class="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-base font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 pr-10">
              <option value="">教員を選んでください</option>
              ${teacherOptions}
            </select>
            <i class="fa fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm"></i>
          </div>
        </div>

        <!-- 総合評価 -->
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <h2 class="font-bold text-slate-800 flex items-center gap-2">
            <i class="fa fa-clipboard-check text-indigo-500"></i> 総合評価
          </h2>
          <div class="grid grid-cols-3 gap-2" id="overall-btns">
            <button onclick="setOverall('ok')" id="btn-ok"
              class="check-btn btn-tap rounded-2xl font-bold text-sm border-2 border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400 transition-all flex flex-col items-center justify-center gap-1 py-3">
              <i class="fa fa-circle-check text-lg"></i><span>良好</span>
            </button>
            <button onclick="setOverall('caution')" id="btn-caution"
              class="check-btn btn-tap rounded-2xl font-bold text-sm border-2 border-slate-200 text-slate-500 transition-all flex flex-col items-center justify-center gap-1 py-3">
              <i class="fa fa-triangle-exclamation text-lg"></i><span>要確認</span>
            </button>
            <button onclick="setOverall('ng')" id="btn-ng"
              class="check-btn btn-tap rounded-2xl font-bold text-sm border-2 border-slate-200 text-slate-500 transition-all flex flex-col items-center justify-center gap-1 py-3">
              <i class="fa fa-circle-xmark text-lg"></i><span>要修理</span>
            </button>
          </div>
        </div>

        <!-- チェックリスト -->
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <h2 class="font-bold text-slate-800 flex items-center gap-2">
            <i class="fa fa-list-check text-indigo-500"></i>
            点検チェックリスト <span class="text-xs font-normal text-slate-400">(${inspectItems.length}項目)</span>
          </h2>
          <div class="space-y-3" id="checklist-container">
            ${inspectItems.map((item, idx) => `
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p class="text-sm font-semibold text-slate-800 mb-2">${idx + 1}. ${item}</p>
              <div class="grid grid-cols-3 gap-1.5 mb-2">
                <button onclick="setItemStatus(${idx},'ok')" id="item-ok-${idx}"
                  class="check-btn btn-tap rounded-xl text-xs font-bold border-2 border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300 transition-all py-2">
                  ◯ 良好
                </button>
                <button onclick="setItemStatus(${idx},'caution')" id="item-caution-${idx}"
                  class="check-btn btn-tap rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-500 transition-all py-2">
                  △ 注意
                </button>
                <button onclick="setItemStatus(${idx},'ng')" id="item-ng-${idx}"
                  class="check-btn btn-tap rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-500 transition-all py-2">
                  ✕ 修理
                </button>
              </div>
              <input type="text" placeholder="コメント（任意）"
                class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-all"
                oninput="setItemComment(${idx}, this.value)" id="item-comment-${idx}">
            </div>
            `).join('')}
          </div>
        </div>

        <!-- 特記事項 -->
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <h2 class="font-bold text-slate-800 flex items-center gap-2">
            <i class="fa fa-pen-to-square text-indigo-500"></i> 特記事項・コメント
          </h2>
          <textarea id="general-comment" rows="3" placeholder="気になった点や詳細コメントを記入してください（任意）"
            class="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 transition-all resize-none"></textarea>
        </div>

        <!-- 送信ボタン -->
        <button onclick="submitInspection()" id="submit-inspect-btn"
          class="btn-tap w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm"
          style="background: linear-gradient(135deg, #10b981, #059669);">
          <i class="fa fa-shield-check text-lg"></i>
          点検記録を保存する
        </button>
      </div>

      <!-- 点検完了表示 -->
      <div id="inspect-result-section" class="hidden fade-in bg-white rounded-3xl shadow-sm border border-slate-100 p-6 text-center space-y-4">
        <div id="inspect-result-icon" class="text-5xl"></div>
        <p id="inspect-result-title" class="text-xl font-bold text-slate-800"></p>
        <p id="inspect-result-sub" class="text-sm text-slate-500 leading-relaxed"></p>
        <button onclick="resetInspect()"
          class="btn-tap w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all">
          もう一度点検する
        </button>
        <a href="${baseUrl}"
          class="block w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all btn-tap">
          管理画面を開く
        </a>
      </div>

      <!-- 直近の点検履歴 -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
          <i class="fa fa-clock-rotate-left text-slate-400"></i> 直近の点検記録
        </h3>
        <div>${recentInspectLogs.length === 0
          ? '<p class="text-sm text-slate-400 text-center py-3">点検記録がありません</p>'
          : recentInspectLogs.map(l => {
              const statusMap: Record<string, [string, string]> = {
                ok:      ['#d1fae5', '✅ 良好'],
                caution: ['#fef3c7', '⚠️ 要確認'],
                ng:      ['#fee2e2', '❌ 要修理'],
              }
              const [bg, label] = statusMap[l.overall_status] || ['#f1f5f9', l.overall_status]
              const dt = new Date(l.date).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
              return `<div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full mr-1" style="background:${bg}">${label}</span>
                  <span class="text-sm text-slate-700 font-semibold">${l.teacher_name || '不明'}</span>
                </div>
                <span class="text-xs text-slate-400 shrink-0">${dt}</span>
              </div>`
            }).join('')
        }</div>
      </div>

    </div><!-- /inspect-panel -->

  </main>

  <script>
    const RESOURCE_ID = '${resource.id}';
    const QR_ID       = '${qrId}';
    const RESOURCE_STATUS = '${resource.status}';
    const CURRENT_TEACHER_ID = '${resource.current_teacher_id || ''}';
    const INSPECT_ITEMS = ${JSON.stringify(inspectItems)};

    // ── タブ切り替え ──
    function switchTab(tab) {
      const scanPanel    = document.getElementById('scan-panel');
      const inspectPanel = document.getElementById('inspect-panel');
      const btnScan      = document.getElementById('tab-btn-scan');
      const btnInspect   = document.getElementById('tab-btn-inspect');
      if (tab === 'scan') {
        scanPanel.classList.remove('hidden');
        inspectPanel.classList.add('hidden');
        btnScan.className    = 'flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-tap bg-indigo-600 text-white shadow-sm';
        btnInspect.className = 'flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-tap text-slate-500';
      } else {
        scanPanel.classList.add('hidden');
        inspectPanel.classList.remove('hidden');
        btnScan.className    = 'flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-tap text-slate-500';
        btnInspect.className = 'flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-tap bg-emerald-600 text-white shadow-sm';
      }
    }

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

    // ══════════════════════════════════════════
    // 安全点検タブ ロジック
    // ══════════════════════════════════════════

    let overallStatus = 'ok';
    const itemStatuses = INSPECT_ITEMS.map(() => 'ok');
    const itemComments = INSPECT_ITEMS.map(() => '');

    // 総合評価ボタン スタイル
    const OVERALL_STYLES = {
      ok:      { active: 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300', inactive: 'border-slate-200 bg-white text-slate-500' },
      caution: { active: 'border-amber-300 bg-amber-50 text-amber-700 ring-2 ring-amber-300',         inactive: 'border-slate-200 bg-white text-slate-500' },
      ng:      { active: 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-300',                 inactive: 'border-slate-200 bg-white text-slate-500' },
    };
    function setOverall(val) {
      overallStatus = val;
      ['ok','caution','ng'].forEach(v => {
        const btn = document.getElementById('btn-' + v);
        if (!btn) return;
        const s = OVERALL_STYLES[v];
        btn.className = btn.className.replace(/border-\\S+|bg-\\S+|text-\\S+|ring-\\S+/g, '').trim();
        btn.classList.add(...(v === val ? s.active : s.inactive).split(' '));
      });
    }

    // チェックリストアイテム スタイル
    const ITEM_STYLES = {
      ok:      { active: 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300', inactive: 'border-slate-200 bg-white text-slate-500' },
      caution: { active: 'border-amber-300 bg-amber-50 text-amber-700 ring-2 ring-amber-300',         inactive: 'border-slate-200 bg-white text-slate-500' },
      ng:      { active: 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-300',                 inactive: 'border-slate-200 bg-white text-slate-500' },
    };
    function setItemStatus(idx, val) {
      itemStatuses[idx] = val;
      ['ok','caution','ng'].forEach(v => {
        const btn = document.getElementById(\`item-\${v}-\${idx}\`);
        if (!btn) return;
        const s = ITEM_STYLES[v];
        btn.className = btn.className.replace(/border-\\S+|bg-\\S+|text-\\S+|ring-\\S+/g, '').trim();
        btn.classList.add(...(v === val ? s.active : s.inactive).split(' '));
      });
    }
    function setItemComment(idx, val) { itemComments[idx] = val; }

    // 送信
    async function submitInspection() {
      const teacherId = document.getElementById('inspect-teacher-select').value;
      if (!teacherId) {
        alert('点検者を選択してください');
        document.getElementById('inspect-teacher-select').focus();
        return;
      }
      const btn = document.getElementById('submit-inspect-btn');
      btn.disabled = true;
      btn.innerHTML = \`<svg class="spinner w-6 h-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg> 保存中...\`;

      const items = INSPECT_ITEMS.map((title, i) => ({
        id: String(i + 1), title,
        status: itemStatuses[i],
        comment: itemComments[i],
      }));

      try {
        const res = await fetch('/api/inspection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: RESOURCE_ID,
            teacherId,
            overallStatus,
            items,
            generalComment: document.getElementById('general-comment').value.trim(),
            date: new Date().toISOString(),
          }),
        });
        const data = await res.json();
        showInspectResult(data.success, overallStatus, data.message);
      } catch(e) {
        showInspectResult(false, null, 'ネットワークエラーが発生しました。再度お試しください。');
      }
    }

    // 結果表示
    function showInspectResult(success, status, errMsg) {
      document.getElementById('inspect-form').classList.add('hidden');
      const section = document.getElementById('inspect-result-section');
      section.classList.remove('hidden');
      if (success) {
        const iconMap  = { ok:'✅', caution:'⚠️', ng:'🔧' };
        const titleMap = { ok:'点検完了 — 良好', caution:'点検完了 — 要確認', ng:'点検完了 — 要修理' };
        const subMap   = {
          ok:      '安全確認が完了しました。記録を保存しました。',
          caution: '確認が必要な点があります。管理担当者に連絡してください。',
          ng:      '修理が必要な箇所があります。管理担当者に連絡し、使用を控えてください。',
        };
        document.getElementById('inspect-result-icon').textContent  = iconMap[status]  || '✅';
        document.getElementById('inspect-result-title').textContent = titleMap[status] || '点検完了';
        document.getElementById('inspect-result-sub').textContent   = subMap[status]   || '記録を保存しました。';
      } else {
        document.getElementById('inspect-result-icon').textContent  = '❌';
        document.getElementById('inspect-result-title').textContent = 'エラーが発生しました';
        document.getElementById('inspect-result-sub').textContent   = errMsg || '保存に失敗しました。';
      }
    }

    // リセット
    function resetInspect() {
      overallStatus = 'ok';
      itemStatuses.fill('ok');
      itemComments.fill('');
      setOverall('ok');
      INSPECT_ITEMS.forEach((_, i) => setItemStatus(i, 'ok'));
      document.getElementById('general-comment').value = '';
      document.getElementById('inspect-form').classList.remove('hidden');
      document.getElementById('inspect-result-section').classList.add('hidden');
      const btn = document.getElementById('submit-inspect-btn');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-shield-check text-lg"></i> 点検記録を保存する';
    }
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
    qrCodeId: r.qr_code_id || r.id,                    // 表示用ID
    qr: `${baseUrl}/scan/${r.qr_code_id || r.id}`,      // 貸出/返却QRに埋め込むURL
    inspectQr: `${baseUrl}/inspect/${r.qr_code_id || r.id}`, // 安全点検QRに埋め込むURL
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
      padding:12px 10px;width:180px;
      display:flex;flex-direction:column;align-items:center;gap:6px;
      page-break-inside:avoid;
      transition:box-shadow .15s,border-color .15s;
      cursor:default;
    }
    .qr-card:hover{box-shadow:0 4px 14px rgba(99,102,241,.15);border-color:#a5b4fc}
    .qr-img-wrap{
      width:148px;height:148px;border-radius:10px;overflow:hidden;
      background:#f1f5f9;display:flex;align-items:center;justify-content:center;
      position:relative;
    }
    .qr-img-wrap img{width:148px;height:148px;display:block}
    .qr-spinner{
      width:28px;height:28px;border:3px solid #e2e8f0;
      border-top-color:#6366f1;border-radius:50%;
      animation:spin .7s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    /* QRタイプ切り替えタブ */
    .qr-tab-wrap{
      display:flex;width:100%;gap:4px;background:#f1f5f9;
      border-radius:8px;padding:3px;
    }
    .qr-tab-btn{
      flex:1;padding:3px 0;border:none;border-radius:6px;font-size:10px;font-weight:700;
      cursor:pointer;transition:background .12s,color .12s;
      background:transparent;color:#64748b;
    }
    .qr-tab-btn.active{background:white;color:#6366f1;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .qr-tab-btn.active.inspect{color:#10b981}
    /* ダウンロードボタン */
    .qr-dl-btn{
      width:100%;padding:5px 0;border-radius:8px;border:1px solid #e2e8f0;
      background:white;color:#6366f1;font-size:11px;font-weight:700;
      cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;
      transition:background .12s,border-color .12s;
    }
    .qr-dl-btn:hover{background:#eef2ff;border-color:#a5b4fc}
    .qr-dl-btn.inspect-mode{color:#10b981}
    .qr-dl-btn.inspect-mode:hover{background:#ecfdf5;border-color:#6ee7b7}
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
    const qrDataURLs = {};        // id → { scan: dataURL, inspect: dataURL }
    const cardTabState = {};      // id → 'scan' | 'inspect'  現在表示中タブ
    let doneCount = 0;

    // ── カード雛形を先に全件描画 ──
    const grid = document.getElementById('qr-grid');
    RESOURCES.forEach(r => {
      const card = document.createElement('div');
      card.className = 'qr-card';
      card.id = 'card-' + r.id;
      card.innerHTML =
        // QRタイプ切り替えタブ
        '<div class="qr-tab-wrap">' +
          '<button class="qr-tab-btn active" id="tab-scan-' + r.id + '" onclick="switchCardTab(\\''+r.id+'\\',\\'scan\\')">' +
            '🔑 貸出/返却' +
          '</button>' +
          '<button class="qr-tab-btn" id="tab-inspect-' + r.id + '" onclick="switchCardTab(\\''+r.id+'\\',\\'inspect\\')">' +
            '🛡 安全点検' +
          '</button>' +
        '</div>' +
        // QR画像エリア
        '<div class="qr-img-wrap" id="img-' + r.id + '"><div class="qr-spinner"></div></div>' +
        // URLラベル（現在表示中のQR URLを小さく表示）
        '<div id="url-label-' + r.id + '" style="font-size:8px;color:#94a3b8;text-align:center;word-break:break-all;line-height:1.3;max-width:156px;">' +
          '📍 貸出/返却用' +
        '</div>' +
        // ダウンロードボタン
        '<button class="qr-dl-btn" id="dl-' + r.id + '" onclick="dlOne(\\''+r.id+'\\')" disabled>' +
          '⬇ PNG保存' +
        '</button>' +
        // カード情報
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

    // QR文字列 → dataURL を返すユーティリティ
    function makeQRDataURL(text) {
      return new Promise(resolve => {
        try {
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
          document.body.appendChild(container);
          new QRCode(container, {
            text,
            width: 300, height: 300,
            colorDark: '#1e293b', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M,
          });
          requestAnimationFrame(() => {
            try {
              const canvas = container.querySelector('canvas');
              resolve(canvas ? canvas.toDataURL('image/png') : '');
            } catch(e) { resolve(''); }
            finally { document.body.removeChild(container); }
          });
        } catch(e) { resolve(''); }
      });
    }

    // 1件分（貸出/返却 + 安全点検 の2種）を生成してカードに反映
    async function generateOne(r) {
      // 貸出/返却QRと安全点検QRを並列生成
      const [scanUrl, inspectUrl] = await Promise.all([
        makeQRDataURL(r.qr),
        makeQRDataURL(r.inspectQr),
      ]);

      qrDataURLs[r.id] = { scan: scanUrl, inspect: inspectUrl };
      cardTabState[r.id] = 'scan'; // 初期表示は貸出/返却

      const imgWrap = document.getElementById('img-' + r.id);
      const dlBtn   = document.getElementById('dl-'  + r.id);
      if (scanUrl) {
        if (imgWrap) imgWrap.innerHTML = '<img src="' + scanUrl + '" alt="QR" style="width:148px;height:148px;">';
        if (dlBtn)   dlBtn.disabled = false;
      } else {
        if (imgWrap) imgWrap.innerHTML =
          '<div style="width:148px;height:148px;display:flex;align-items:center;justify-content:center;' +
          'background:#fee2e2;border-radius:8px;font-size:10px;color:#dc2626;text-align:center;padding:8px">生成エラー</div>';
      }
    }

    // タブ切り替え（貸出/返却 ↔ 安全点検）
    function switchCardTab(id, tab) {
      cardTabState[id] = tab;
      const urls = qrDataURLs[id];
      if (!urls) return; // まだ生成完了していない

      const imgWrap  = document.getElementById('img-'          + id);
      const dlBtn    = document.getElementById('dl-'           + id);
      const tabScan  = document.getElementById('tab-scan-'     + id);
      const tabInsp  = document.getElementById('tab-inspect-'  + id);
      const urlLabel = document.getElementById('url-label-'    + id);

      const isScan = tab === 'scan';
      const dataUrl = isScan ? urls.scan : urls.inspect;

      // タブボタンのアクティブ切り替え
      if (tabScan)  { tabScan.className  = 'qr-tab-btn' + (isScan  ? ' active' : ''); }
      if (tabInsp)  { tabInsp.className  = 'qr-tab-btn' + (!isScan ? ' active inspect' : ''); }

      // URL説明ラベル更新
      if (urlLabel) urlLabel.textContent = isScan ? '📍 貸出/返却用' : '🛡 安全点検用';

      // ダウンロードボタンの色切り替え
      if (dlBtn) {
        dlBtn.className = 'qr-dl-btn' + (isScan ? '' : ' inspect-mode');
      }

      // QR画像切り替え
      if (imgWrap && dataUrl) {
        imgWrap.innerHTML = '<img src="' + dataUrl + '" alt="QR" style="width:148px;height:148px;">';
      }
    }

    // ── 個別 PNG ダウンロード（現在表示中のタブのQRをDL） ──
    function dlOne(id) {
      const urls = qrDataURLs[id];
      if (!urls) return;
      const tab = cardTabState[id] || 'scan';
      const url = tab === 'scan' ? urls.scan : urls.inspect;
      if (!url) return;
      const r = RESOURCES.find(x => x.id === id);
      const suffix = tab === 'scan' ? '貸出返却' : '安全点検';
      const a = document.createElement('a');
      a.href = url;
      a.download = (r ? r.name : id) + '_' + suffix + '_QR.png';
      a.click();
    }

    // ── 全件 ZIP ダウンロード（JSZip）──
    // 貸出/返却QR と 安全点検QR の両方を別フォルダに収録
    async function downloadAllZip() {
      const btn = document.getElementById('btn-zip');
      btn.disabled = true;
      btn.textContent = '⏳ ZIP作成中...';

      const zip = new JSZip();
      const folderScan    = zip.folder('QRcodes/貸出返却');
      const folderInspect = zip.folder('QRcodes/安全点検');
      RESOURCES.forEach(r => {
        const urls = qrDataURLs[r.id];
        if (!urls) return;
        if (urls.scan) {
          folderScan.file(r.name + '_貸出返却_QR.png', urls.scan.split(',')[1], { base64: true });
        }
        if (urls.inspect) {
          folderInspect.file(r.name + '_安全点検_QR.png', urls.inspect.split(',')[1], { base64: true });
        }
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
