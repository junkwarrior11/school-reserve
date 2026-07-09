// ============================================================
//  School-Trace — Vanilla JS SPA
// ============================================================

// ─── State ──────────────────────────────────────────────────
const state = {
  teachers: [], resources: [], reservations: [],
  inspectionLogs: [], sosRequests: [], nfcHistory: [],
  activeTab: 'dashboard',
  viewMode: 'desktop',   // 'desktop' | 'mobile'
  loggedInTeacherId: '',
  loading: false,
};

// ─── API helpers ────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

async function fetchData() {
  state.loading = true;
  render();
  try {
    const data = await api('/api/data');
    state.teachers     = data.teachers || [];
    state.resources    = data.resources || [];
    state.reservations = data.reservations || [];
    state.inspectionLogs = data.inspectionLogs || [];
    state.sosRequests  = data.sosRequests || [];
    state.nfcHistory   = data.nfcHistory || [];
    if (!state.loggedInTeacherId && state.teachers.length)
      state.loggedInTeacherId = state.teachers[0].id;
  } finally {
    state.loading = false;
    render();
  }
}

// ─── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="fa ${type==='success'?'fa-check-circle':type==='error'?'fa-times-circle':type==='warning'?'fa-exclamation-triangle':'fa-info-circle'} mr-2"></i>${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Helpers ────────────────────────────────────────────────
function getTeacher(id) { return state.teachers.find(t => t.id === id); }
function getResource(id) { return state.resources.find(r => r.id === id); }
function fmtDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('ja-JP', {month:'2-digit',day:'2-digit'}); }
function fmtDateTime(iso) { if (!iso) return '—'; return new Date(iso).toLocaleString('ja-JP', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function today() { return new Date().toISOString().split('T')[0]; }

function statusBadge(status) {
  const map = {
    available: ['bg-emerald-100 text-emerald-700','利用可'],
    checked_out: ['bg-indigo-100 text-indigo-700','使用中'],
    maintenance: ['bg-amber-100 text-amber-700','整備中'],
  };
  const [cls, label] = map[status] || ['bg-slate-100 text-slate-600', status];
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

function overallBadge(s) {
  const map = {ok:['bg-emerald-100 text-emerald-700','良好'],caution:['bg-amber-100 text-amber-700','要確認'],ng:['bg-red-100 text-red-700','要修理']};
  const [cls, label] = map[s] || ['bg-slate-100','—'];
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

function teacherAvatar(teacherId, small = false) {
  const t = getTeacher(teacherId);
  if (!t) return `<div class="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-white">?</div>`;
  const colors = { indigo:'bg-indigo-500', emerald:'bg-emerald-500', blue:'bg-blue-500', rose:'bg-rose-500', amber:'bg-amber-500', purple:'bg-purple-500', teal:'bg-teal-500' };
  const bg = colors[t.color] || 'bg-indigo-500';
  const sz = small ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return `<div class="${sz} rounded-full ${bg} flex items-center justify-center font-bold text-white shrink-0" title="${t.name}">${t.name[0]}</div>`;
}

// ─── Main Render ────────────────────────────────────────────
function render() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = `
    <div id="toast-container"></div>
    <div class="w-full min-h-screen flex flex-col">
      ${renderHeader()}
      ${state.viewMode === 'mobile' ? renderMobileFrame() : renderDesktop()}
    </div>
    ${renderModal()}
  `;
  bindEvents();
}

// ─── Header ─────────────────────────────────────────────────
function renderHeader() {
  const loggedTeacher = getTeacher(state.loggedInTeacherId);
  const colors = { indigo:'bg-indigo-500', emerald:'bg-emerald-500', blue:'bg-blue-500', rose:'bg-rose-500', amber:'bg-amber-500', purple:'bg-purple-500', teal:'bg-teal-500' };
  const avatarBg = loggedTeacher ? (colors[loggedTeacher.color] || 'bg-indigo-500') : 'bg-slate-400';
  const sosCount = state.sosRequests.length;
  return `
  <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20 shadow-sm sticky top-0">
    <div class="flex items-center gap-3">
      <div class="bg-indigo-600 p-2 rounded-xl text-white shadow-sm">
        <i class="fa fa-clipboard-list text-base"></i>
      </div>
      <div>
        <h1 class="text-lg font-bold tracking-tight text-slate-800 leading-none">School-Trace</h1>
        <span class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">学校QR管理システム</span>
      </div>
    </div>
    <div class="flex items-center gap-2 sm:gap-3">
      ${sosCount > 0 ? `<button onclick="setTab('dashboard')" class="relative flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-100 transition-all">
        <i class="fa fa-bell animate-bounce"></i>
        <span class="hidden sm:inline">緊急呼び出し</span>
        <span class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">${sosCount}</span>
      </button>` : ''}
      <div class="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
        <button onclick="setViewMode('desktop')" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${state.viewMode==='desktop'?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}">
          <i class="fa fa-desktop"></i><span class="hidden sm:inline ml-1">PC</span>
        </button>
        <button onclick="setViewMode('mobile')" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${state.viewMode==='mobile'?'bg-indigo-600 text-white shadow-sm':'text-slate-500 hover:text-indigo-600'}">
          <i class="fa fa-mobile-screen"></i><span class="hidden sm:inline ml-1">スマホ</span>
        </button>
      </div>
      <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
        <i class="fa fa-user text-slate-400 text-xs"></i>
        <select onchange="setLoggedTeacher(this.value)" class="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer max-w-[120px]">
          ${state.teachers.map(t => `<option value="${t.id}" ${t.id===state.loggedInTeacherId?'selected':''}>${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-sm shrink-0">
        ${loggedTeacher ? loggedTeacher.name[0] : '?'}
      </div>
      <button onclick="fetchData()" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors" title="更新">
        <i class="fa fa-rotate-right text-sm ${state.loading ? 'animate-spin text-indigo-500' : ''}"></i>
      </button>
    </div>
  </header>`;
}

// ─── Sidebar nav (desktop) ──────────────────────────────────
const TABS = [
  { id:'dashboard',   icon:'fa-house',         label:'ダッシュボード' },
  { id:'nfc',         icon:'fa-qrcode',        label:'QRスキャン' },
  { id:'reservations',icon:'fa-calendar-days', label:'予約カレンダー' },
  { id:'safety',      icon:'fa-shield-halved', label:'安全点検' },
  { id:'management',  icon:'fa-gears',         label:'リソース管理' },
  { id:'register',    icon:'fa-plus-circle',   label:'新規登録' },
  { id:'equipment',   icon:'fa-box-archive',   label:'備品使用状況' },
  { id:'classroom',   icon:'fa-door-open',     label:'教室使用状況' },
];

function renderDesktop() {
  return `
  <div class="flex flex-1 overflow-hidden">
    <aside class="w-56 shrink-0 bg-white border-r border-slate-100 flex flex-col py-4 gap-1 px-3 hidden md:flex overflow-y-auto">
      ${TABS.map(t => `
        <button onclick="setTab('${t.id}')" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left
          ${state.activeTab===t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}">
          <i class="fa ${t.icon} w-4 text-center ${state.activeTab===t.id ? 'text-indigo-600' : 'text-slate-400'}"></i>
          ${t.label}
        </button>
      `).join('')}
    </aside>
    <main class="flex-1 overflow-y-auto p-4 sm:p-6">
      <div class="max-w-6xl mx-auto">
        ${renderTabContent(state.activeTab)}
      </div>
    </main>
  </div>
  ${renderBottomNavMobile()}`;
}

function renderBottomNavMobile() {
  const mobileTabs = TABS.slice(0, 5);
  return `
  <nav class="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 h-16 z-30 shadow-lg">
    ${mobileTabs.map(t => `
      <button onclick="setTab('${t.id}')" class="flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-all rounded-lg
        ${state.activeTab===t.id ? 'text-indigo-600' : 'text-slate-500'}">
        <i class="fa ${t.icon} text-lg"></i>
        <span class="text-[9px] font-semibold leading-none">${t.label.length>5?t.label.slice(0,5)+'…':t.label}</span>
      </button>
    `).join('')}
  </nav>`;
}

// ─── Mobile Frame ────────────────────────────────────────────
function renderMobileFrame() {
  return `
  <div class="flex-1 bg-slate-700 flex items-start justify-center p-6 overflow-y-auto">
    <div class="phone-frame" style="margin-top:16px;">
      <div class="absolute top-0 inset-x-0 h-6 flex justify-center z-50 pointer-events-none">
        <div class="w-28 h-5 bg-slate-900 rounded-b-2xl flex items-center justify-center">
          <div class="w-10 h-1 bg-slate-800 rounded-full"></div>
        </div>
      </div>
      <div class="h-9 bg-white px-5 pt-3 flex justify-between items-center text-[10px] font-bold text-slate-700 select-none border-b border-slate-100 z-40 relative">
        <span>12:34</span>
        <span class="text-slate-400">School-Trace</span>
        <span>🔋 100%</span>
      </div>
      <div class="bg-slate-50 overflow-y-auto flex flex-col" style="height:calc(780px - 64px - 36px - 56px);">
        <div class="p-3 fade-in">
          ${renderTabContent(state.activeTab, true)}
        </div>
      </div>
      <nav class="bg-white border-t border-slate-200 flex items-center justify-around h-14 z-40 relative shadow-lg">
        ${TABS.slice(0,5).map(t => `
          <button onclick="setTab('${t.id}')" class="flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-all
            ${state.activeTab===t.id ? 'text-indigo-600' : 'text-slate-400'}">
            <i class="fa ${t.icon} text-base"></i>
            <span class="text-[9px] font-semibold">${t.label.length>5?t.label.slice(0,5)+'…':t.label}</span>
          </button>
        `).join('')}
      </nav>
    </div>
  </div>`;
}

// ─── Tab Routing ─────────────────────────────────────────────
function renderTabContent(tab, isMobile = false) {
  if (state.loading) return `<div class="flex items-center justify-center h-40"><div class="spinner"></div><span class="ml-3 text-slate-500 text-sm">読み込み中...</span></div>`;
  switch (tab) {
    case 'dashboard':    return renderDashboard(isMobile);
    case 'nfc':          return renderNFC(isMobile);
    case 'reservations': return renderReservations(isMobile);
    case 'safety':       return renderSafety(isMobile);
    case 'management':   return renderManagement(isMobile);
    case 'register':     return renderRegister(isMobile);
    case 'equipment':    return renderEquipment(isMobile);
    case 'classroom':    return renderClassroom(isMobile);
    default:             return renderDashboard(isMobile);
  }
}

// ─── Navigation helpers ──────────────────────────────────────
function setTab(tab) { state.activeTab = tab; render(); }
function setViewMode(m) { state.viewMode = m; render(); }
function setLoggedTeacher(id) { state.loggedInTeacherId = id; render(); }

// ─── Modal State ────────────────────────────────────────────
let modalContent = null;
function showModal(html) { modalContent = html; render(); }
function closeModal() { modalContent = null; render(); }
function renderModal() {
  if (!modalContent) return '';
  return `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal-box slide-in">${modalContent}</div></div>`;
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard(isMobile) {
  const todayStr = today();
  const totalRes = state.resources.length;
  const checkedOut = state.resources.filter(r => r.status === 'checked_out').length;
  const todayRes = state.reservations.filter(r => r.date === todayStr).length;
  const alarms = state.inspectionLogs.filter(l => (l.overall_status==='ng'||l.overall_status==='caution') && l.repair_status!=='fixed');
  const sos = state.sosRequests;
  const recentHistory = state.nfcHistory.slice(0, isMobile ? 5 : 10);

  const kpis = [
    { icon:'fa-box-archive', label:'備品・教室', value:totalRes, color:'text-indigo-600 bg-indigo-50', sub:'登録リソース' },
    { icon:'fa-circle-check', label:'利用中', value:checkedOut, color:'text-blue-600 bg-blue-50', sub:'現在貸出中' },
    { icon:'fa-calendar-check', label:'本日の予約', value:todayRes, color:'text-emerald-600 bg-emerald-50', sub:'時限予約数' },
    { icon:'fa-triangle-exclamation', label:'要確認', value:alarms.length, color:'text-amber-600 bg-amber-50', sub:'点検アラート' },
  ];

  return `
  <div class="space-y-${isMobile?'3':'5'}">
    <!-- KPI Cards -->
    <div class="grid grid-cols-2 ${isMobile?'gap-2':'gap-4 sm:grid-cols-4'}">
      ${kpis.map(k => `
        <div class="card flex items-center gap-3 ${isMobile?'p-3':''}">
          <div class="w-11 h-11 rounded-xl ${k.color} flex items-center justify-center shrink-0">
            <i class="fa ${k.icon} text-lg"></i>
          </div>
          <div>
            <p class="text-2xl font-bold text-slate-800 leading-none">${k.value}</p>
            <p class="text-xs text-slate-500 mt-0.5">${k.sub}</p>
          </div>
        </div>
      `).join('')}
    </div>

    ${sos.length > 0 ? `
    <!-- SOS Alerts -->
    <div class="bg-red-50 border border-red-200 rounded-2xl p-4">
      <h3 class="font-bold text-red-700 flex items-center gap-2 mb-3">
        <i class="fa fa-bell animate-bounce"></i> 緊急呼び出し・待機申請 (${sos.length}件)
      </h3>
      <div class="space-y-2">
        ${sos.map(s => {
          const r = getResource(s.resource_id); const t = getTeacher(s.teacher_id);
          return `<div class="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-red-100">
            <div class="flex items-center gap-2">
              ${teacherAvatar(s.teacher_id, true)}
              <div>
                <p class="text-sm font-semibold text-slate-800">${t?.name||'不明'}</p>
                <p class="text-xs text-slate-500">${r?.name||'不明'} · ${fmtDateTime(s.requested_at)}</p>
              </div>
            </div>
            <button onclick="resolveSOS('${s.id}')" class="btn-sm btn-success text-xs">解決</button>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    ${alarms.length > 0 ? `
    <!-- Inspection Alarms -->
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <h3 class="font-bold text-amber-700 flex items-center gap-2 mb-3">
        <i class="fa fa-triangle-exclamation"></i> 点検アラート (${alarms.length}件)
      </h3>
      <div class="space-y-2">
        ${alarms.slice(0, isMobile?3:5).map(l => {
          const r = getResource(l.resource_id);
          return `<div class="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
            <div>
              <p class="text-sm font-semibold text-slate-800">${r?.name||'不明'}</p>
              <p class="text-xs text-slate-500">${fmtDate(l.date)} · ${overallBadge(l.overall_status)}</p>
            </div>
            <button onclick="setTab('safety')" class="btn-sm btn-secondary text-xs">詳細</button>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Today's Reservations -->
    <div class="card">
      <h3 class="font-bold text-slate-800 flex items-center gap-2 mb-3">
        <i class="fa fa-calendar-days text-indigo-600"></i> 本日の予約
      </h3>
      ${state.reservations.filter(r=>r.date===todayStr).length === 0
        ? '<p class="text-sm text-slate-400 text-center py-3">本日の予約はありません</p>'
        : `<div class="space-y-2">${state.reservations.filter(r=>r.date===todayStr)
            .sort((a,b)=>a.period-b.period)
            .map(r => {
              const res = getResource(r.resource_id); const t = getTeacher(r.teacher_id);
              return `<div class="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <span class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">${r.period}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate">${res?.name||'不明'}</p>
                  <p class="text-xs text-slate-500 truncate">${t?.name||'不明'} · ${r.purpose}</p>
                </div>
              </div>`;
            }).join('')}</div>`
      }
    </div>

    <!-- Recent NFC Activity -->
    <div class="card">
      <h3 class="font-bold text-slate-800 flex items-center gap-2 mb-3">
        <i class="fa fa-rss text-indigo-600"></i> 最近の操作履歴
      </h3>
      ${recentHistory.length === 0
        ? '<p class="text-sm text-slate-400 text-center py-3">履歴がありません</p>'
        : `<div class="space-y-1.5">${recentHistory.map(h => {
            const r = getResource(h.resource_id); const t = getTeacher(h.teacher_id);
            const actionMap = { check_out:['fa-arrow-right-from-bracket','text-blue-600','貸出'], check_in:['fa-arrow-right-to-bracket','text-emerald-600','返却'], baton:['fa-arrows-left-right','text-purple-600','引継'] };
            const [icon, color, label] = actionMap[h.action] || ['fa-circle','text-slate-500','操作'];
            return `<div class="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
              <i class="fa ${icon} ${color} w-4 text-center text-sm"></i>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-semibold text-slate-800">${r?.name||'不明'}</span>
                <span class="text-xs text-slate-500 ml-2">${t?.name||'不明'} · ${label}</span>
              </div>
              <span class="text-xs text-slate-400 shrink-0">${fmtDateTime(h.timestamp)}</span>
            </div>`;
          }).join('')}</div>`
      }
    </div>
  </div>`;
}

async function resolveSOS(id) {
  await api('/api/sos/resolve', { method:'POST', body:{ id } });
  toast('緊急呼び出しを解決しました', 'success');
  await fetchData();
}

// ─── NFC SIMULATOR ───────────────────────────────────────────
function renderNFC(isMobile) {
  const selTeacher = state.loggedInTeacherId;
  const selResource = window._nfcSelectedResource || '';
  const scanMode = window._nfcScanMode || 'nfc';
  const scanResult = window._nfcScanResult || null;

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <i class="fa fa-qrcode text-indigo-600"></i> QRコードスキャン
      </h2>
    </div>

    <div class="${isMobile?'space-y-3':'grid grid-cols-2 gap-5'}">
      <!-- Scanner Panel -->
      <div class="card space-y-4">
        <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
          <i class="fa fa-qrcode text-indigo-500"></i> QRコード読取シミュレーター
        </h3>

        <!-- Teacher select -->
        <div>
          <label class="form-label">操作教員</label>
          <select class="form-select" onchange="window._nfcSelectedTeacher=this.value" id="nfc-teacher-sel">
            <option value="">教員を選択...</option>
            ${state.teachers.map(t => `<option value="${t.id}" ${t.id===selTeacher?'selected':''}>${t.name} (${t.department})</option>`).join('')}
          </select>
        </div>

        <!-- Resource select -->
        <div>
          <label class="form-label">備品・教室を選択</label>
          <select class="form-select" onchange="window._nfcSelectedResource=this.value" id="nfc-resource-sel">
            <option value="">QRコードIDで選択...</option>
            ${state.resources.map(r => `<option value="${r.qr_code_id||r.id}" ${(r.qr_code_id||r.id)===selResource?'selected':''}>${r.name} [${r.qr_code_id||'QRなし'}]</option>`).join('')}
          </select>
        </div>

        <!-- Scan button -->
        <button onclick="doNFCScan()" id="nfc-scan-btn"
          class="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-3 text-base shadow-sm"
          style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
          <span class="relative flex h-5 w-5">
            <span class="nfc-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span class="relative inline-flex rounded-full h-5 w-5 bg-white/30 items-center justify-center">
              <i class="fa fa-qrcode text-sm text-white"></i>
            </span>
          </span>
          QRコードをスキャン
        </button>

        ${scanResult ? `
        <div class="rounded-xl p-3 border-2 ${scanResult.success?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'} slide-in">
          <div class="flex items-start gap-2">
            <i class="fa fa-${scanResult.success?'circle-check text-emerald-500':'circle-xmark text-red-500'} mt-0.5"></i>
            <div>
              ${scanResult.action ? `<span class="text-xs font-bold uppercase px-1.5 py-0.5 rounded bg-white/70 text-slate-600 mb-1 inline-block">${scanResult.action==='check_out'?'貸出':scanResult.action==='check_in'?'返却':'引継'}</span>` : ''}
              <p class="text-sm font-semibold ${scanResult.success?'text-emerald-800':'text-red-800'}">${scanResult.message}</p>
            </div>
          </div>
        </div>` : ''}
      </div>

      <!-- Resources Status -->
      <div class="card space-y-3">
        <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
          <i class="fa fa-list-check text-indigo-500"></i> リソース状態一覧
        </h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${state.resources.map(r => {
            const teacher = r.current_teacher_id ? getTeacher(r.current_teacher_id) : null;
            return `<div class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.category==='classroom'?'bg-blue-100 text-blue-600':'bg-violet-100 text-violet-600'}">
                <i class="fa fa-${r.category==='classroom'?'door-open':'box-archive'} text-sm"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-800 truncate">${r.name}</p>
                <p class="text-xs text-slate-500 truncate">${r.qr_code_id||'QRなし'}</p>
              </div>
              <div class="shrink-0 flex flex-col items-end gap-1">
                ${statusBadge(r.status)}
                ${teacher ? `<span class="text-xs text-slate-500">${teacher.name}</span>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- NFC History -->
    <div class="card">
      <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
        <i class="fa fa-clock-rotate-left text-indigo-500"></i> 最近のQR操作履歴
      </h3>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr>
            <th>日時</th><th>備品・教室</th><th>操作者</th><th>アクション</th>
          </tr></thead>
          <tbody>
            ${state.nfcHistory.slice(0, 20).map(h => {
              const r = getResource(h.resource_id); const t = getTeacher(h.teacher_id);
              const actionMap = { check_out:['bg-blue-100 text-blue-700','貸出'], check_in:['bg-emerald-100 text-emerald-700','返却'], baton:['bg-purple-100 text-purple-700','引継'] };
              const [cls, label] = actionMap[h.action] || ['bg-slate-100','操作'];
              return `<tr>
                <td class="text-slate-500">${fmtDateTime(h.timestamp)}</td>
                <td class="font-semibold">${r?.name||h.resource_id}</td>
                <td>${teacherAvatar(h.teacher_id, true)} <span class="ml-1 text-sm">${t?.name||'不明'}</span></td>
                <td><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}">${label}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

async function doNFCScan() {
  const teacherId = document.getElementById('nfc-teacher-sel')?.value || state.loggedInTeacherId;
  const tagId = document.getElementById('nfc-resource-sel')?.value;
  if (!tagId) { toast('QRコードを選択してください', 'warning'); return; }
  if (!teacherId) { toast('教員を選択してください', 'warning'); return; }

  const btn = document.getElementById('nfc-scan-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> スキャン中...'; }

  try {
    const res = await api('/api/nfc/tap', { method:'POST', body:{ tagId, teacherId } });
    window._nfcScanResult = { success: res.success, message: res.message, action: res.action };
    if (res.success) toast(res.message, 'success');
    else toast(res.message, 'error');
    await fetchData();
  } catch(e) {
    window._nfcScanResult = { success:false, message:'通信エラーが発生しました' };
    toast('通信エラー', 'error');
    render();
  }
}

// ─── RESERVATIONS ────────────────────────────────────────────
let _reserveDate = today();
let _reserveTeacher = '';
let _reserveResource = '';
let _reservePeriod = 1;
let _reservePurpose = '';

function renderReservations(isMobile) {
  const periods = [1,2,3,4,5,6];
  const periodLabels = ['1限','2限','3限','4限','5限','6限'];
  const todayReservations = state.reservations.filter(r => r.date === _reserveDate);

  // Build grid data: resource × period
  const gridData = {};
  state.resources.forEach(r => {
    gridData[r.id] = {};
    periods.forEach(p => {
      const res = todayReservations.find(rv => rv.resource_id===r.id && rv.period===p);
      gridData[r.id][p] = res || null;
    });
  });

  const prevDay = () => { const d = new Date(_reserveDate); d.setDate(d.getDate()-1); _reserveDate = d.toISOString().split('T')[0]; setTab('reservations'); };
  const nextDay = () => { const d = new Date(_reserveDate); d.setDate(d.getDate()+1); _reserveDate = d.toISOString().split('T')[0]; setTab('reservations'); };

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <i class="fa fa-calendar-days text-indigo-600"></i> 予約カレンダー
      </h2>
      <button onclick="showAddReservationModal()" class="btn-primary btn-sm">
        <i class="fa fa-plus"></i> 新規予約
      </button>
    </div>

    <!-- Date Navigator -->
    <div class="flex items-center justify-center gap-4">
      <button onclick="(${prevDay.toString()})()" class="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all">
        <i class="fa fa-chevron-left text-slate-600"></i>
      </button>
      <div class="text-center">
        <p class="text-lg font-bold text-slate-800">${new Date(_reserveDate).toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short'})}</p>
        ${_reserveDate === today() ? '<span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">今日</span>' : ''}
      </div>
      <button onclick="(${nextDay.toString()})()" class="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all">
        <i class="fa fa-chevron-right text-slate-600"></i>
      </button>
    </div>

    <!-- Calendar Grid -->
    <div class="card overflow-x-auto">
      <table class="w-full text-xs min-w-[600px]">
        <thead>
          <tr>
            <th class="px-3 py-2 text-left text-slate-500 font-semibold w-40">備品・教室</th>
            ${periods.map(p => `<th class="px-2 py-2 text-center text-slate-500 font-semibold">${periodLabels[p-1]}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${state.resources.map(r => `
            <tr class="border-t border-slate-50">
              <td class="px-3 py-2">
                <p class="font-semibold text-slate-800 text-xs">${r.name}</p>
                <p class="text-slate-400" style="font-size:10px;">${r.location}</p>
              </td>
              ${periods.map(p => {
                const res = gridData[r.id][p];
                const teacher = res ? getTeacher(res.teacher_id) : null;
                return `<td class="px-1 py-1.5" onclick="handlePeriodClick('${r.id}',${p})">
                  ${res
                    ? `<div class="h-12 rounded-lg bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-center cursor-default px-1 group relative">
                        <span class="text-indigo-700 font-bold text-center leading-tight" style="font-size:9px;">${teacher?.name||'?'}</span>
                        <span class="text-indigo-500 text-center truncate w-full text-center" style="font-size:8px;">${res.purpose}</span>
                        <button onclick="event.stopPropagation();deleteReservation('${res.id}')" class="absolute top-0 right-0 w-4 h-4 bg-red-400 text-white rounded-full text-[8px] hidden group-hover:flex items-center justify-center -mt-1 -mr-1">✕</button>
                      </div>`
                    : `<div class="h-12 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer flex items-center justify-center">
                        <i class="fa fa-plus text-slate-300 text-xs"></i>
                      </div>`
                  }
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Today's reservations list -->
    <div class="card">
      <h3 class="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
        <i class="fa fa-list text-indigo-500"></i> 予約一覧 (${todayReservations.length}件)
      </h3>
      ${todayReservations.length === 0
        ? '<p class="text-sm text-slate-400 text-center py-4">この日の予約はありません</p>'
        : `<div class="space-y-2">
          ${todayReservations.sort((a,b)=>a.period-b.period).map(r => {
            const res = getResource(r.resource_id); const t = getTeacher(r.teacher_id);
            return `<div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">${r.period}限</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-slate-800 truncate">${res?.name||'不明'}</p>
                <p class="text-xs text-slate-500 truncate">${t?.name||'不明'} · ${r.purpose}</p>
              </div>
              <button onclick="deleteReservation('${r.id}')" class="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-all">
                <i class="fa fa-trash-can text-xs"></i>
              </button>
            </div>`;
          }).join('')}
        </div>`
      }
    </div>
  </div>`;
}

function handlePeriodClick(resourceId, period) {
  _reserveResource = resourceId;
  _reservePeriod = period;
  showAddReservationModal();
}

function showAddReservationModal() {
  showModal(`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-slate-800">新規予約</h3>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">✕</button>
      </div>
      <div>
        <label class="form-label">日付</label>
        <input type="date" class="form-input" id="m-res-date" value="${_reserveDate}">
      </div>
      <div>
        <label class="form-label">予約者</label>
        <select class="form-select" id="m-res-teacher">
          <option value="">教員を選択...</option>
          ${state.teachers.map(t=>`<option value="${t.id}" ${t.id===state.loggedInTeacherId?'selected':''}>${t.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">備品・教室</label>
        <select class="form-select" id="m-res-resource">
          <option value="">選択...</option>
          ${state.resources.map(r=>`<option value="${r.id}" ${r.id===_reserveResource?'selected':''}>${r.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">時限</label>
        <select class="form-select" id="m-res-period">
          ${[1,2,3,4,5,6].map(p=>`<option value="${p}" ${p===_reservePeriod?'selected':''}>${p}限</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">利用目的</label>
        <input type="text" class="form-input" id="m-res-purpose" placeholder="例：3年生 物理実験" value="">
      </div>
      <div class="flex gap-3 pt-2">
        <button onclick="closeModal()" class="btn-secondary flex-1">キャンセル</button>
        <button onclick="submitReservation()" class="btn-primary flex-1">予約する</button>
      </div>
    </div>
  `);
}

async function submitReservation() {
  const date = document.getElementById('m-res-date')?.value;
  const teacherId = document.getElementById('m-res-teacher')?.value;
  const resourceId = document.getElementById('m-res-resource')?.value;
  const period = parseInt(document.getElementById('m-res-period')?.value);
  const purpose = document.getElementById('m-res-purpose')?.value?.trim();

  if (!date || !teacherId || !resourceId || !purpose) { toast('すべての項目を入力してください','warning'); return; }

  const res = await api('/api/reservations', { method:'POST', body:{ resourceId, teacherId, date, period, purpose } });
  if (res.success) { toast('予約を登録しました','success'); closeModal(); _reserveDate = date; await fetchData(); }
  else toast(res.message || '予約の登録に失敗しました', 'error');
}

async function deleteReservation(id) {
  if (!confirm('この予約を削除しますか？')) return;
  await api(`/api/reservations/${id}`, { method:'DELETE' });
  toast('予約を削除しました','success');
  await fetchData();
}

// ─── SAFETY INSPECTION ───────────────────────────────────────
let _inspectTab = 'new';
let _inspectResource = '';
let _inspectTeacher = '';
let _inspectStatus = 'ok';
let _inspectComment = '';
let _inspectItems = [];

const DEFAULT_ITEMS = {
  classroom: ['非常扉周りに避難の妨げとなる物がないか','窓・照明・防球ネット等の破損はないか','消火器の配置状況・使用期限の確認','備品・机・椅子の破損や危険な状態がないか','電気設備・コンセントの状態確認'],
  equipment: ['本体の外観に割れ・破損・汚れがないか','電源・バッテリーの状態確認','付属品・消耗品の残量と期限確認','動作確認（正常に動くか）','保管場所・整理整頓の確認'],
};

function initInspectItems(resourceId) {
  const r = getResource(resourceId);
  if (!r) return;
  const template = r.category === 'classroom' ? DEFAULT_ITEMS.classroom : DEFAULT_ITEMS.equipment;
  const customItems = r.custom_inspection_items || [];
  const allItems = customItems.length > 0 ? customItems : template;
  _inspectItems = allItems.map((title, i) => ({ id: String(i+1), title, status:'ok', comment:'' }));
}

function renderSafety(isMobile) {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <i class="fa fa-shield-halved text-indigo-600"></i> 安全点検
      </h2>
    </div>

    <div class="flex gap-2 bg-slate-100 p-1 rounded-xl">
      <button onclick="window._inspectTab='new';setTab('safety')" class="flex-1 py-2 rounded-lg text-sm font-bold transition-all ${_inspectTab==='new'?'bg-white text-slate-800 shadow-sm':'text-slate-500'}">新規点検</button>
      <button onclick="window._inspectTab='history';setTab('safety')" class="flex-1 py-2 rounded-lg text-sm font-bold transition-all ${_inspectTab==='history'?'bg-white text-slate-800 shadow-sm':'text-slate-500'}">点検履歴</button>
    </div>

    ${(_inspectTab||'new') === 'new' ? renderNewInspection(isMobile) : renderInspectionHistory(isMobile)}
  </div>`;
}

function renderNewInspection(isMobile) {
  return `
  <div class="space-y-4">
    <div class="card space-y-4">
      <h3 class="font-semibold text-slate-700 text-sm">点検情報入力</h3>
      <div class="${isMobile?'space-y-3':'grid grid-cols-2 gap-4'}">
        <div>
          <label class="form-label">点検対象</label>
          <select class="form-select" id="insp-resource" onchange="onInspResourceChange(this.value)">
            <option value="">選択...</option>
            ${state.resources.map(r=>`<option value="${r.id}" ${r.id===_inspectResource?'selected':''}>${r.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">点検者</label>
          <select class="form-select" id="insp-teacher">
            <option value="">選択...</option>
            ${state.teachers.map(t=>`<option value="${t.id}" ${t.id===(state.loggedInTeacherId||_inspectTeacher)?'selected':''}>${t.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div>
        <label class="form-label">総合評価</label>
        <div class="flex gap-2">
          ${[['ok','良好','emerald'],['caution','要確認','amber'],['ng','要修理','red']].map(([v,l,c])=>`
            <button onclick="window._inspectStatus='${v}'; setTab('safety')" class="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${_inspectStatus===v?`border-${c}-500 bg-${c}-50 text-${c}-700`:`border-slate-200 text-slate-500 hover:border-slate-300`}">
              <i class="fa fa-${v==='ok'?'circle-check':v==='caution'?'triangle-exclamation':'circle-xmark'} mr-1"></i>${l}
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    ${_inspectItems.length > 0 ? `
    <div class="card space-y-3">
      <h3 class="font-semibold text-slate-700 text-sm flex items-center justify-between">
        <span>点検チェックリスト (${_inspectItems.length}項目)</span>
      </h3>
      <div class="space-y-3">
        ${_inspectItems.map((item, idx) => `
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p class="text-sm font-semibold text-slate-800 mb-2">${idx+1}. ${item.title}</p>
            <div class="flex gap-1.5 mb-2">
              ${[['ok','◯良'],['caution','△注意'],['ng','✕要修理']].map(([v,l])=>`
                <button onclick="setItemStatus(${idx},'${v}')" class="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${item.status===v?v==='ok'?'bg-emerald-500 text-white border-emerald-500':v==='caution'?'bg-amber-500 text-white border-amber-500':'bg-red-500 text-white border-red-500':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}">
                  ${l}
                </button>
              `).join('')}
            </div>
            <input type="text" placeholder="コメント（任意）" class="form-input text-xs py-1.5"
              value="${item.comment}" onchange="setItemComment(${idx},this.value)">
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="card space-y-3">
      <label class="form-label">特記事項・総合コメント</label>
      <textarea class="form-input min-h-20 resize-none" id="insp-comment" placeholder="点検の詳細コメントを入力...">${_inspectComment}</textarea>
    </div>

    <button onclick="submitInspection()" class="w-full btn-primary py-3 text-base rounded-xl">
      <i class="fa fa-shield-check mr-2"></i> 点検記録を保存する
    </button>
  </div>`;
}

function renderInspectionHistory(isMobile) {
  const logs = state.inspectionLogs.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
  return `
  <div class="card">
    <div class="space-y-3 max-h-[600px] overflow-y-auto">
      ${logs.length === 0
        ? '<p class="text-sm text-slate-400 text-center py-8">点検記録がありません</p>'
        : logs.map(l => {
            const r = getResource(l.resource_id); const t = getTeacher(l.teacher_id);
            const repairMap = {none:'',pending:'<span class="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">修繕中</span>',fixed:'<span class="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">修繕済</span>'};
            return `<div class="p-4 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all bg-slate-50">
              <div class="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p class="font-bold text-slate-800 text-sm">${r?.name||'不明'}</p>
                  <p class="text-xs text-slate-500">${t?.name||'不明'} · ${fmtDateTime(l.date)}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  ${overallBadge(l.overall_status)}
                  ${repairMap[l.repair_status]||''}
                </div>
              </div>
              ${l.general_comment ? `<p class="text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-100 mb-2">${l.general_comment}</p>` : ''}
              <div class="flex gap-2">
                ${l.repair_status === 'pending' ? `<button onclick="markRepairFixed('${l.id}')" class="btn-success btn-sm text-xs">修繕完了にする</button>` : ''}
                <button onclick="deleteInspection('${l.id}')" class="btn-danger btn-sm text-xs">削除</button>
              </div>
            </div>`;
          }).join('')
      }
    </div>
  </div>`;
}

function onInspResourceChange(resourceId) {
  _inspectResource = resourceId;
  initInspectItems(resourceId);
  setTab('safety');
}
function setItemStatus(idx, status) { _inspectItems[idx].status = status; setTab('safety'); }
function setItemComment(idx, val) { _inspectItems[idx].comment = val; }

async function submitInspection() {
  const resourceId = document.getElementById('insp-resource')?.value;
  const teacherId = document.getElementById('insp-teacher')?.value;
  const comment = document.getElementById('insp-comment')?.value?.trim();
  if (!resourceId || !teacherId) { toast('点検対象と点検者を選択してください','warning'); return; }

  const body = {
    resourceId, teacherId,
    overallStatus: _inspectStatus || 'ok',
    items: _inspectItems,
    generalComment: comment,
    date: new Date().toISOString(),
  };
  const res = await api('/api/inspection', { method:'POST', body });
  if (res.success) {
    toast('点検記録を保存しました','success');
    _inspectResource = ''; _inspectItems = []; _inspectComment = ''; _inspectStatus = 'ok';
    window._inspectTab = 'history';
    await fetchData();
  } else toast(res.message || '保存に失敗しました', 'error');
}

async function markRepairFixed(id) {
  const note = prompt('修繕完了のメモを入力してください（任意）:') || '修繕完了';
  await api('/api/inspection/fix', { method:'POST', body:{ id, repairNote: note } });
  toast('修繕完了としてマークしました','success');
  await fetchData();
}

async function deleteInspection(id) {
  if (!confirm('この点検記録を削除しますか？')) return;
  await api(`/api/inspection/${id}`, { method:'DELETE' });
  toast('点検記録を削除しました','success');
  await fetchData();
}

// ─── RESOURCE MANAGEMENT ─────────────────────────────────────
function renderManagement(isMobile) {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <i class="fa fa-gears text-indigo-600"></i> リソース管理
      </h2>
    </div>

    <!-- Resource list -->
    <div class="card">
      <h3 class="font-bold text-slate-700 text-sm mb-4">備品・教室一覧</h3>
      <div class="space-y-2">
        ${state.resources.map(r => {
          const teacher = r.current_teacher_id ? getTeacher(r.current_teacher_id) : null;
          return `<div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 bg-slate-50 transition-all">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.category==='classroom'?'bg-blue-100 text-blue-600':'bg-violet-100 text-violet-600'}">
              <i class="fa fa-${r.category==='classroom'?'door-open':'box-archive'}"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-slate-800 text-sm truncate">${r.name}</p>
              <p class="text-xs text-slate-500 truncate">${r.subject||'共通'} · QR: ${r.qr_code_id||'なし'}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              ${statusBadge(r.status)}
              ${teacher ? `<span class="text-xs text-slate-500">${teacher.name}</span>` : ''}
              <button onclick="showEditResourceModal('${r.id}')" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center transition-all">
                <i class="fa fa-pen text-xs"></i>
              </button>
              <button onclick="deleteResource('${r.id}')" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:text-red-500 flex items-center justify-center transition-all">
                <i class="fa fa-trash text-xs"></i>
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Teacher management -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-slate-700 text-sm">教員一覧</h3>
        <button onclick="showAddTeacherModal()" class="btn-primary btn-sm"><i class="fa fa-plus mr-1"></i>追加</button>
      </div>
      <div class="space-y-2">
        ${state.teachers.map(t => {
          const colors = { indigo:'bg-indigo-500', emerald:'bg-emerald-500', blue:'bg-blue-500', rose:'bg-rose-500', amber:'bg-amber-500', purple:'bg-purple-500', teal:'bg-teal-500' };
          return `<div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <div class="w-9 h-9 rounded-full ${colors[t.color]||'bg-indigo-500'} flex items-center justify-center text-white font-bold shrink-0">${t.name[0]}</div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-slate-800 text-sm">${t.name}</p>
              <p class="text-xs text-slate-500">${t.department}</p>
            </div>
            <button onclick="deleteTeacher('${t.id}')" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:text-red-500 flex items-center justify-center transition-all">
              <i class="fa fa-trash text-xs"></i>
            </button>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

function showEditResourceModal(id) {
  const r = getResource(id);
  if (!r) return;
  showModal(`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-slate-800">備品・教室を編集</h3>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
      </div>
      <div><label class="form-label">名前</label><input class="form-input" id="er-name" value="${r.name}"></div>
      <div><label class="form-label">設置場所</label><input class="form-input" id="er-location" value="${r.location}"></div>
      <div><label class="form-label">教科</label><input class="form-input" id="er-subject" value="${r.subject||''}"></div>
      <div><label class="form-label">QRコードID</label><input class="form-input" id="er-qr" value="${r.qr_code_id||''}"></div>
      <div><label class="form-label">状態</label>
        <select class="form-select" id="er-status">
          <option value="available" ${r.status==='available'?'selected':''}>利用可</option>
          <option value="checked_out" ${r.status==='checked_out'?'selected':''}>使用中</option>
          <option value="maintenance" ${r.status==='maintenance'?'selected':''}>整備中</option>
        </select>
      </div>
      <div class="flex gap-3 pt-2">
        <button onclick="closeModal()" class="btn-secondary flex-1">キャンセル</button>
        <button onclick="saveResource('${id}')" class="btn-primary flex-1">保存する</button>
      </div>
    </div>
  `);
}

async function saveResource(id) {
  const r = getResource(id);
  const body = {
    id,
    name: document.getElementById('er-name')?.value,
    location: document.getElementById('er-location')?.value,
    subject: document.getElementById('er-subject')?.value,
    qr_code_id: document.getElementById('er-qr')?.value || null,
    status: document.getElementById('er-status')?.value,
    category: r?.category,
  };
  const res = await api('/api/resources', { method:'POST', body });
  if (res.success) { toast('リソースを更新しました','success'); closeModal(); await fetchData(); }
  else toast('更新に失敗しました','error');
}

async function deleteResource(id) {
  if (!confirm('このリソースを削除しますか？関連する予約・SOS申請も削除されます。')) return;
  await api(`/api/resources/${id}`, { method:'DELETE' });
  toast('リソースを削除しました','success');
  await fetchData();
}

function showAddTeacherModal() {
  showModal(`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-slate-800">教員を追加</h3>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
      </div>
      <div><label class="form-label">氏名</label><input class="form-input" id="at-name" placeholder="例：田中 太郎"></div>
      <div><label class="form-label">所属部署</label><input class="form-input" id="at-dept" placeholder="例：数学"></div>

      <div class="flex gap-3 pt-2">
        <button onclick="closeModal()" class="btn-secondary flex-1">キャンセル</button>
        <button onclick="addTeacher()" class="btn-primary flex-1">追加する</button>
      </div>
    </div>
  `);
}

async function addTeacher() {
  const name = document.getElementById('at-name')?.value?.trim();
  const department = document.getElementById('at-dept')?.value?.trim();
  if (!name || !department) { toast('氏名と所属は必須です','warning'); return; }
  const res = await api('/api/teachers', { method:'POST', body:{ name, department } });
  if (res.success) { toast('教員を追加しました','success'); closeModal(); await fetchData(); }
  else toast('追加に失敗しました','error');
}

async function deleteTeacher(id) {
  if (!confirm('この教員を削除しますか？')) return;
  await api(`/api/teachers/${id}`, { method:'DELETE' });
  toast('教員を削除しました','success');
  await fetchData();
}

// ─── RESOURCE REGISTER ───────────────────────────────────────
function renderRegister(isMobile) {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <i class="fa fa-plus-circle text-indigo-600"></i> リソース新規登録
      </h2>
    </div>
    <div class="card space-y-4">
      <div>
        <label class="form-label">種別 <span class="text-red-500">*</span></label>
        <div class="flex gap-3">
          <label class="flex items-center gap-2 flex-1 p-3 rounded-xl border-2 cursor-pointer transition-all hover:border-indigo-200" id="cat-equipment-label">
            <input type="radio" name="reg-cat" value="equipment" checked onchange="updateRegisterUI('equipment')">
            <i class="fa fa-box-archive text-violet-500"></i>
            <span class="font-semibold text-sm">備品</span>
          </label>
          <label class="flex items-center gap-2 flex-1 p-3 rounded-xl border-2 cursor-pointer transition-all hover:border-indigo-200" id="cat-classroom-label">
            <input type="radio" name="reg-cat" value="classroom" onchange="updateRegisterUI('classroom')">
            <i class="fa fa-door-open text-blue-500"></i>
            <span class="font-semibold text-sm">教室</span>
          </label>
        </div>
      </div>
      <div><label class="form-label">名前 <span class="text-red-500">*</span></label><input class="form-input" id="reg-name" placeholder="例：理科室"></div>
      <div id="reg-location-wrap"><label class="form-label">設置場所</label><input class="form-input" id="reg-location" placeholder="例：本館3階"></div>
      <div><label class="form-label">教科</label><input class="form-input" id="reg-subject" placeholder="例：理科" value="共通"></div>
      <div><label class="form-label">QRコードID</label><input class="form-input" id="reg-qr" placeholder="例：QR_001"></div>
      <button onclick="submitRegister()" class="w-full btn-primary py-3 rounded-xl text-base">
        <i class="fa fa-plus mr-2"></i> 登録する
      </button>
    </div>
  </div>`;
}

function updateRegisterUI(cat) {
  const wrap = document.getElementById('reg-location-wrap');
  if (wrap) wrap.style.display = cat === 'equipment' ? '' : 'none';
}

async function submitRegister() {
  const catEl = document.querySelector('input[name="reg-cat"]:checked');
  const category = catEl?.value || 'equipment';
  const name     = document.getElementById('reg-name')?.value?.trim();
  const location = category === 'equipment' ? (document.getElementById('reg-location')?.value?.trim() || '') : '';
  const subject  = document.getElementById('reg-subject')?.value?.trim() || '共通';
  const qr_code_id = document.getElementById('reg-qr')?.value?.trim() || null;

  if (!name) { toast('名前は必須です', 'warning'); return; }
  const res = await api('/api/resources', { method:'POST', body:{ name, location, subject, qr_code_id, category } });
  if (res.success) {
    toast('登録しました', 'success');
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-location').value = '';
    document.getElementById('reg-subject').value = '共通';
    document.getElementById('reg-qr').value = '';
    await fetchData();
  } else toast('登録に失敗しました', 'error');
}

// ─── EQUIPMENT USAGE ─────────────────────────────────────────
function renderEquipment(isMobile) {
  const equipment = state.resources.filter(r => r.category === 'equipment');
  return `
  <div class="space-y-4">
    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
      <i class="fa fa-box-archive text-indigo-600"></i> 備品使用状況
    </h2>
    <div class="grid ${isMobile?'grid-cols-1':'grid-cols-2 sm:grid-cols-3'} gap-3">
      ${equipment.map(r => {
        const teacher = r.current_teacher_id ? getTeacher(r.current_teacher_id) : null;
        const inUse = r.status === 'checked_out';
        return `<div class="card flex items-center gap-4 py-4">
          <div class="w-11 h-11 rounded-xl ${inUse ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'} flex items-center justify-center shrink-0">
            <i class="fa fa-box-archive text-lg"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-slate-800 text-base leading-tight truncate">${r.name}</p>
            <div class="mt-1">
              ${teacher
                ? `<div class="flex items-center gap-1.5">${teacherAvatar(r.current_teacher_id, true)}<span class="text-sm font-semibold text-indigo-600">${teacher.name}</span></div>`
                : `<span class="text-sm text-slate-400">未使用</span>`
              }
            </div>
          </div>
          ${statusBadge(r.status)}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ─── CLASSROOM USAGE ─────────────────────────────────────────
function renderClassroom(isMobile) {
  const classrooms = state.resources.filter(r => r.category === 'classroom');
  return `
  <div class="space-y-4">
    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
      <i class="fa fa-door-open text-indigo-600"></i> 教室使用状況
    </h2>
    <div class="grid ${isMobile?'grid-cols-1':'grid-cols-2'} gap-4">
      ${classrooms.map(r => {
        const teacher = r.current_teacher_id ? getTeacher(r.current_teacher_id) : null;
        const useCount = state.nfcHistory.filter(h => h.resource_id === r.id).length;
        const recentLogs = state.nfcHistory.filter(h => h.resource_id === r.id).slice(0, 5);
        const todayRes = state.reservations.filter(rv => rv.resource_id===r.id && rv.date===today()).sort((a,b)=>a.period-b.period);
        return `<div class="card space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <i class="fa fa-door-open"></i>
              </div>
              <div>
                <p class="font-bold text-slate-800 text-sm">${r.name}</p>
                <p class="text-xs text-slate-500">${r.location} · ${r.subject||'共通'}</p>
              </div>
            </div>
            ${statusBadge(r.status)}
          </div>

          ${teacher ? `<div class="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2">
            ${teacherAvatar(r.current_teacher_id,true)}
            <span class="text-sm font-semibold text-indigo-700">${teacher.name} が使用中</span>
            <span class="text-xs text-indigo-500 ml-auto">${fmtDateTime(r.last_checked_out_at)}</span>
          </div>` : ''}

          ${todayRes.length > 0 ? `
          <div>
            <p class="text-xs font-semibold text-slate-500 mb-1.5">本日の予約</p>
            <div class="flex gap-1.5">
              ${todayRes.map(rv => `<span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">${rv.period}限</span>`).join('')}
            </div>
          </div>` : ''}

          <div class="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
            <span>総利用回数</span>
            <span class="font-bold text-slate-700">${useCount}回</span>
          </div>

          ${recentLogs.length > 0 ? `
          <div class="space-y-1">
            <p class="text-xs font-semibold text-slate-500">最近の使用履歴</p>
            ${recentLogs.map(h => {
              const t = getTeacher(h.teacher_id);
              const actionMap = {check_out:'入室',check_in:'退室',baton:'引継'};
              return `<div class="flex items-center justify-between text-xs">
                <span class="text-slate-600">${t?.name||'不明'} · ${actionMap[h.action]||h.action}</span>
                <span class="text-slate-400">${fmtDateTime(h.timestamp)}</span>
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ─── Bind Events ─────────────────────────────────────────────
function bindEvents() {
  // global window shortcut bindings (inspection tab toggle)
  window._inspectTab = window._inspectTab || 'new';
}

// ─── Init ────────────────────────────────────────────────────
window.setTab = setTab;
window.setViewMode = setViewMode;
window.setLoggedTeacher = setLoggedTeacher;
window.closeModal = closeModal;
window.showModal = showModal;
window.resolveSOS = resolveSOS;
window.doNFCScan = doNFCScan;
window.showAddReservationModal = showAddReservationModal;
window.handlePeriodClick = handlePeriodClick;
window.submitReservation = submitReservation;
window.deleteReservation = deleteReservation;
window.onInspResourceChange = onInspResourceChange;
window.setItemStatus = setItemStatus;
window.setItemComment = setItemComment;
window.submitInspection = submitInspection;
window.markRepairFixed = markRepairFixed;
window.deleteInspection = deleteInspection;
window.showEditResourceModal = showEditResourceModal;
window.saveResource = saveResource;
window.deleteResource = deleteResource;
window.showAddTeacherModal = showAddTeacherModal;
window.addTeacher = addTeacher;
window.deleteTeacher = deleteTeacher;
window.submitRegister = submitRegister;
window._inspectTab = 'new';
window._nfcScanMode = 'qr';

// initial load
fetchData();
