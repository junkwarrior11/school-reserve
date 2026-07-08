import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { 
  Teacher, 
  Resource, 
  Reservation, 
  InspectionLog, 
  SOSRequest, 
  NFCHistoryEvent 
} from './src/types.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Persistent File Storage Path
const DB_FILE = path.join(process.cwd(), 'db.json');

// Memory Data Structures
let teachers: Teacher[] = [];
let resources: Resource[] = [];
let reservations: Reservation[] = [];
let inspectionLogs: InspectionLog[] = [];
let sosRequests: SOSRequest[] = [];
let nfcHistory: NFCHistoryEvent[] = [];

// Initial Seed Data
const initialTeachers: Teacher[] = [
  { id: 'T1', name: '佐藤 健一', department: '理科', nfcTagId: 'NFC_SATO_123', color: 'indigo' },
  { id: 'T2', name: '鈴木 美咲', department: '体育', nfcTagId: 'NFC_SUZUKI_456', color: 'emerald' },
  { id: 'T3', name: '高橋 蓮', department: '情報技術', nfcTagId: 'NFC_TAKAHASHI_789', color: 'blue' },
  { id: 'T4', name: '渡辺 裕子', department: '図工・美術', nfcTagId: 'NFC_WATANABE_999', color: 'rose' },
];

const initialResources: Resource[] = [
  { id: 'R1', name: '理科室 (第1物理化学室)', category: 'classroom', location: '本館2階', subject: '理科', nfcTagId: 'TAG_SCI_ROOM', qrCodeId: 'QR_SCI_ROOM', status: 'available' },
  { id: 'R2', name: '体育館 (第1アリーナ)', category: 'classroom', location: '体育館棟', subject: '体育', nfcTagId: 'TAG_GYM_ROOM', qrCodeId: 'QR_GYM_ROOM', status: 'available' },
  { id: 'R3', name: '3Dプリンター (Form 3+)', category: 'equipment', location: '情報室3階', subject: '情報技術', nfcTagId: 'TAG_EQ_3DPRINTER', qrCodeId: 'QR_EQ_3DPRINTER', status: 'checked_out', currentTeacherId: 'T3', lastCheckedOutAt: new Date(Date.now() - 3600000 * 3).toISOString() },
  { id: 'R4', name: 'AED訓練用デモ機', category: 'equipment', location: '保健室', subject: '保健体育', nfcTagId: 'TAG_EQ_AED', qrCodeId: 'QR_EQ_AED', status: 'available' },
  { id: 'R5', name: '双眼実体顕微鏡カート', category: 'equipment', location: '理科準備室', subject: '理科', nfcTagId: 'TAG_EQ_MICROSCOPE', qrCodeId: 'QR_EQ_MICROSCOPE', status: 'available' },
  { id: 'R6', name: 'タブレット保管カート (40台)', category: 'equipment', location: '職員室裏保管庫', subject: '共通', nfcTagId: 'TAG_EQ_TABLET_CART', qrCodeId: 'QR_EQ_TABLET_CART', status: 'available' },
];

const initialReservations: Reservation[] = [
  { id: 'RES1', resourceId: 'R1', teacherId: 'T1', date: new Date().toISOString().split('T')[0], period: 3, purpose: '3年生 物理：自由落下実験' },
  { id: 'RES2', resourceId: 'R2', teacherId: 'T2', date: new Date().toISOString().split('T')[0], period: 5, purpose: '1年生 バスケットボール授業' },
  { id: 'RES3', resourceId: 'R3', teacherId: 'T3', date: new Date().toISOString().split('T')[0], period: 2, purpose: '情報クラブ：モデリング出力' },
];

const initialInspectionLogs: InspectionLog[] = [
  {
    id: 'INSP1',
    resourceId: 'R4',
    teacherId: 'T1',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    overallStatus: 'ok',
    items: [
      { id: '1', title: '本体の外観に割れや破損、汚れがないか', status: 'ok', comment: '異常なし' },
      { id: '2', title: 'バッテリー表示灯が緑色に点滅しているか', status: 'ok', comment: '点滅を確認' },
      { id: '3', title: '電極パッドが未開封で期限内であるか', status: 'ok', comment: '使用期限2027年12月' },
    ],
    generalComment: '定期点検。動作灯も正常。いつでも使用可能な状態です。',
    repairStatus: 'none',
  },
  {
    id: 'INSP2',
    resourceId: 'R2',
    teacherId: 'T2',
    date: new Date(Date.now() - 86400000).toISOString(),
    overallStatus: 'caution',
    items: [
      { id: '1', title: '非常扉周りに避難の妨げとなる物がないか', status: 'ok', comment: 'クリア' },
      { id: '2', title: '窓や照明、防球ネットの破損はないか', status: 'caution', comment: '東側防球ネットの隅に1箇所ほつれあり。拡大する前に修繕を推奨' },
      { id: '3', title: '消火器の配置状況・使用期限の確認', status: 'ok', comment: '設置を確認' },
    ],
    generalComment: '防球ネットの一部に僅かな破れがありますが、即時の安全上の危険はありません。修繕申請を出しました。',
    repairStatus: 'pending',
    repairNote: 'ほつれ箇所の補修テープ手配中',
  }
];

const initialSosRequests: SOSRequest[] = [
  { id: 'SOS1', resourceId: 'R3', teacherId: 'T1', requestedAt: new Date(Date.now() - 1800000).toISOString(), notified: false }
];

const initialHistory: NFCHistoryEvent[] = [
  {
    id: 'H1',
    resourceId: 'R3',
    teacherId: 'T3',
    action: 'check_out',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    tagId: 'TAG_EQ_3DPRINTER'
  }
];

let spreadsheetId: string | null = null;

// Load from File or Save default seed
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      teachers = fileData.teachers || initialTeachers;
      resources = fileData.resources || initialResources;
      reservations = fileData.reservations || initialReservations;
      inspectionLogs = fileData.inspectionLogs || initialInspectionLogs;
      sosRequests = fileData.sosRequests || initialSosRequests;
      nfcHistory = fileData.nfcHistory || initialHistory;
      spreadsheetId = fileData.spreadsheetId || null;
    } catch (e) {
      console.error('Error reading database file. Loading default seeds.', e);
      loadDefaultSeeds();
    }
  } else {
    loadDefaultSeeds();
  }
}

function loadDefaultSeeds() {
  teachers = initialTeachers;
  resources = initialResources;
  reservations = initialReservations;
  inspectionLogs = initialInspectionLogs;
  sosRequests = initialSosRequests;
  nfcHistory = initialHistory;
  spreadsheetId = null;
  saveDatabase();
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      teachers,
      resources,
      reservations,
      inspectionLogs,
      sosRequests,
      nfcHistory,
      spreadsheetId
    }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing database file.', e);
  }
}

loadDatabase();

// API Endpoints
app.get('/api/data', (req, res) => {
  res.json({
    teachers,
    resources,
    reservations,
    inspectionLogs,
    sosRequests,
    nfcHistory,
    spreadsheetId
  });
});

// Teachers CRUD
app.post('/api/teachers', (req, res) => {
  const teacherData: Teacher = req.body;
  if (!teacherData.id) {
    teacherData.id = 'T_' + Date.now();
  }
  
  const existingIndex = teachers.findIndex(t => t.id === teacherData.id);
  if (existingIndex !== -1) {
    teachers[existingIndex] = { ...teachers[existingIndex], ...teacherData };
  } else {
    if (!teacherData.color) {
      const colors = ['indigo', 'emerald', 'blue', 'rose', 'amber', 'purple', 'teal'];
      teacherData.color = colors[teachers.length % colors.length];
    }
    teachers.push(teacherData);
  }
  saveDatabase();
  res.json({ success: true, teacher: teacherData });
});

app.delete('/api/teachers/:id', (req, res) => {
  const { id } = req.params;
  teachers = teachers.filter(t => t.id !== id);
  saveDatabase();
  res.json({ success: true });
});

// Resources CRUD
app.post('/api/resources', (req, res) => {
  const rData: Resource = req.body;
  if (!rData.id) {
    rData.id = 'R_' + Date.now();
  }
  
  const existingIndex = resources.findIndex(r => r.id === rData.id);
  if (existingIndex !== -1) {
    resources[existingIndex] = { ...resources[existingIndex], ...rData };
  } else {
    rData.status = rData.status || 'available';
    resources.push(rData);
  }
  saveDatabase();
  res.json({ success: true, resource: rData });
});

app.delete('/api/resources/:id', (req, res) => {
  const { id } = req.params;
  resources = resources.filter(r => r.id !== id);
  // Also clean up reservations and SOS linked to it
  reservations = reservations.filter(rv => rv.resourceId !== id);
  sosRequests = sosRequests.filter(s => s.resourceId !== id);
  saveDatabase();
  res.json({ success: true });
});

// Reservations
app.post('/api/reservations', (req, res) => {
  const resData: Reservation = req.body;
  if (!resData.id) {
    resData.id = 'RES_' + Date.now();
  }

  // Double booking prevention: same resource, same date, same period
  const isOverlap = reservations.some(rv => 
    rv.id !== resData.id &&
    rv.resourceId === resData.resourceId &&
    rv.date === resData.date &&
    Number(rv.period) === Number(resData.period)
  );

  if (isOverlap) {
    return res.status(400).json({ 
      success: false, 
      message: '指定された日付と時限はすでに他の予約で埋まっています。' 
    });
  }

  const existingIndex = reservations.findIndex(rv => rv.id === resData.id);
  if (existingIndex !== -1) {
    reservations[existingIndex] = resData;
  } else {
    reservations.push(resData);
  }
  saveDatabase();
  res.json({ success: true, reservation: resData });
});

app.delete('/api/reservations/:id', (req, res) => {
  const { id } = req.params;
  reservations = reservations.filter(rv => rv.id !== id);
  saveDatabase();
  res.json({ success: true });
});

// SOS / Standby request
app.post('/api/sos', (req, res) => {
  const { resourceId, teacherId } = req.body;
  if (!resourceId || !teacherId) {
    return res.status(400).json({ success: false, message: 'ID情報が不足しています。' });
  }

  // Check if resource exists
  const resource = resources.find(r => r.id === resourceId);
  if (!resource) {
    return res.status(404).json({ success: false, message: 'リソースが見つかりません。' });
  }

  // Check if already has an active SOS from this teacher
  const existingSos = sosRequests.find(s => s.resourceId === resourceId && s.teacherId === teacherId);
  if (existingSos) {
    return res.json({ success: true, message: 'すでに呼び出し・待機申請済みです。', sos: existingSos });
  }

  const newSos: SOSRequest = {
    id: 'SOS_' + Date.now(),
    resourceId,
    teacherId,
    requestedAt: new Date().toISOString(),
    notified: false
  };

  sosRequests.push(newSos);
  saveDatabase();
  res.json({ success: true, sos: newSos });
});

app.post('/api/sos/resolve', (req, res) => {
  const { id } = req.body;
  sosRequests = sosRequests.filter(s => s.id !== id);
  saveDatabase();
  res.json({ success: true });
});

// Google Workspace API helpers
async function getGoogleAccessToken(): Promise<string | null> {
  if (process.env.GOOGLE_OAUTH_TOKEN) {
    return process.env.GOOGLE_OAUTH_TOKEN;
  }
  const tokenPaths = [
    '/workspace/credentials/token.json',
    path.join(process.cwd(), 'credentials', 'token.json'),
    path.join(process.cwd(), 'token.json'),
    '/credentials/token.json'
  ];
  for (const p of tokenPaths) {
    if (fs.existsSync(p)) {
      try {
        const fileContent = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.access_token) return parsed.access_token;
        if (parsed.token) return parsed.token;
        return fileContent.trim();
      } catch (e) {
        console.error(`Error reading token from ${p}:`, e);
      }
    }
  }
  return null;
}

async function getOrCreateSpreadsheet(accessToken: string): Promise<string | null> {
  if (spreadsheetId) {
    try {
      const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        return spreadsheetId;
      }
    } catch (e) {
      console.warn('Stored spreadsheetId check failed, searching Drive...', e);
    }
  }

  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='School-Trace 安全点検記録' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (searchRes.ok) {
      const data = await searchRes.json() as { files: { id: string }[] };
      if (data.files && data.files.length > 0) {
        spreadsheetId = data.files[0].id;
        saveDatabase();
        return spreadsheetId;
      }
    }

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: 'School-Trace 安全点検記録'
        }
      })
    });

    if (!createRes.ok) {
      console.error('Failed to create spreadsheet:', await createRes.text());
      return null;
    }

    const spreadsheet = await createRes.json() as { spreadsheetId: string };
    const newId = spreadsheet.spreadsheetId;

    // Add Headers
    const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${newId}/values/Sheet1!A1:H1?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          ['点検日時', '教室/備品名', '設置場所', '点検者', '総合評価', '点検項目詳細', '特記項目・コメント', '点検写真リンク']
        ]
      })
    });

    if (appendRes.ok) {
      spreadsheetId = newId;
      saveDatabase();
      return spreadsheetId;
    } else {
      console.error('Failed to append headers:', await appendRes.text());
    }

    return newId;
  } catch (err) {
    console.error('Error getting or creating spreadsheet:', err);
    return null;
  }
}

async function uploadImageToDrive(accessToken: string, base64DataUrl: string, fileName: string): Promise<string | null> {
  try {
    const matches = base64DataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }
    const mimeType = matches[1];
    const base64Content = matches[2];

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: mimeType
    };

    const multipartRequestBody = Buffer.concat([
      Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)),
      Buffer.from('\r\n' + delimiter + `Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
      Buffer.from(base64Content),
      Buffer.from(closeDelimiter)
    ]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartRequestBody.length.toString()
      },
      body: multipartRequestBody
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Drive Upload Failed:', errText);
      return null;
    }

    const file = await res.json() as { id: string };
    
    // Set file permissions to anyone with link read (anyone can view, let's keep it safe)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (e) {
      console.warn('Could not set permissions for file:', file.id, e);
    }

    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?fields=webViewLink`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (metaRes.ok) {
      const meta = await metaRes.json() as { webViewLink: string };
      return meta.webViewLink;
    }

    return `https://drive.google.com/file/d/${file.id}/view`;
  } catch (error) {
    console.error('Error uploading image to Google Drive:', error);
    return null;
  }
}

async function appendInspectionToSheet(
  accessToken: string,
  spreadId: string,
  log: InspectionLog,
  resourceName: string,
  location: string,
  teacherName: string,
  photoDriveLink: string | null
): Promise<boolean> {
  try {
    const formattedDate = new Date(log.date).toLocaleString('ja-JP');
    const itemsSummary = log.items.map(item => {
      let statusStr = '良 (◯)';
      if (item.status === 'C') statusStr = 'C要検討';
      else if (item.status === 'B') statusStr = 'B要対応';
      else if (item.status === 'A') statusStr = 'A緊急対処';
      else if (item.status === 'caution') statusStr = '注意';
      else if (item.status === 'ng') statusStr = '要修理';
      return `・${item.title}: [${statusStr}] ${item.comment || ''}`;
    }).join('\n');
    const statusMap = { ok: '良好 (◯)', caution: '要確認 (Caution)', ng: '要修理 (NG/A)' };
    const overallStr = statusMap[log.overallStatus] || log.overallStatus;

    const row = [
      formattedDate,
      resourceName,
      location,
      teacherName,
      overallStr,
      itemsSummary,
      log.generalComment,
      photoDriveLink || (log.photoUrl && log.photoUrl.startsWith('http') ? log.photoUrl : '')
    ];

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadId}/values/Sheet1!A:H:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: 'Sheet1!A:H',
        majorDimension: 'ROWS',
        values: [row]
      })
    });

    if (!res.ok) {
      console.error('Failed to append log row to sheet:', await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error appending safety inspection to sheet:', error);
    return false;
  }
}

// Safety Inspection
app.post('/api/inspection', async (req, res) => {
  const log: InspectionLog = req.body;
  if (!log.id) {
    log.id = 'INSP_' + Date.now();
  }
  log.date = log.date || new Date().toISOString();
  
  if (log.overallStatus === 'ng' || log.overallStatus === 'caution') {
    log.repairStatus = 'pending';
  } else {
    log.repairStatus = 'none';
  }

  const existingIndex = inspectionLogs.findIndex(l => l.id === log.id);
  if (existingIndex !== -1) {
    inspectionLogs[existingIndex] = log;
  } else {
    inspectionLogs.push(log);
  }

  saveDatabase();

  // Try Google Sheets & Drive sync asynchronously/safely
  let sheetsSynced = false;
  let photoDriveLink: string | null = null;
  let targetSpreadsheetId: string | null = null;
  let syncMessage = '';

  try {
    const accessToken = await getGoogleAccessToken();
    if (accessToken) {
      console.log('Google OAuth Token found. Attempting Sheets sync...');
      targetSpreadsheetId = await getOrCreateSpreadsheet(accessToken);
      if (targetSpreadsheetId) {
        // Upload photo to Drive if present and starts with 'data:'
        if (log.photoUrl && log.photoUrl.startsWith('data:')) {
          const resObj = resources.find(r => r.id === log.resourceId);
          const safeName = resObj ? resObj.name.replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龠]/g, '_') : 'resource';
          const fileName = `SchoolTrace_Insp_${safeName}_${Date.now()}.jpg`;
          console.log('Uploading photo to Google Drive...', fileName);
          photoDriveLink = await uploadImageToDrive(accessToken, log.photoUrl, fileName);
          if (photoDriveLink) {
            log.photoUrl = photoDriveLink; // Update locally too!
            saveDatabase();
          }
        }

        // Find metadata for sheets
        const resObj = resources.find(r => r.id === log.resourceId);
        const resName = resObj ? resObj.name : '不明リソース';
        const resLoc = resObj ? resObj.location : '校内';
        const teacherObj = teachers.find(t => t.id === log.teacherId);
        const teacherName = teacherObj ? teacherObj.name : '不明教員';

        console.log('Appending row to Google Sheets...');
        sheetsSynced = await appendInspectionToSheet(
          accessToken,
          targetSpreadsheetId,
          log,
          resName,
          resLoc,
          teacherName,
          photoDriveLink
        );

        if (sheetsSynced) {
          syncMessage = 'Googleスプレッドシートへの同期とDriveへの写真保存に成功しました！';
        } else {
          syncMessage = '点検記録の保存はできましたが、スプレッドシートの行追加に失敗しました。';
        }
      } else {
        syncMessage = 'Googleスプレッドシートの作成・取得に失敗しました。';
      }
    } else {
      syncMessage = 'Google OAuthトークンが見つかりません。点検記録はローカルにのみ保存されました。';
    }
  } catch (syncErr: any) {
    console.error('Error during Sheets/Drive Sync:', syncErr);
    syncMessage = `Google同期中にエラーが発生しました: ${syncErr.message}`;
  }

  res.json({ 
    success: true, 
    inspectionLog: log, 
    sheetsSynced, 
    spreadsheetId: targetSpreadsheetId || spreadsheetId,
    message: syncMessage 
  });
});

app.get('/api/sheets/config', async (req, res) => {
  const token = await getGoogleAccessToken();
  let currentSpreadsheetId = spreadsheetId;
  if (token && !currentSpreadsheetId) {
    console.log('Token exists but no spreadsheet ID. Automatically locating or creating spreadsheet...');
    currentSpreadsheetId = await getOrCreateSpreadsheet(token);
  }
  res.json({
    hasToken: !!token,
    spreadsheetId: currentSpreadsheetId,
    spreadsheetUrl: currentSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}/edit` : null
  });
});

app.post('/api/sheets/reconnect', async (req, res) => {
  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Google OAuthトークンが見つかりません。Googleログインを確認してください。' });
    }
    // Force recreate/locate
    spreadsheetId = null;
    const newId = await getOrCreateSpreadsheet(accessToken);
    if (newId) {
      return res.json({ success: true, spreadsheetId: newId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newId}/edit` });
    }
    res.status(500).json({ success: false, message: 'スプレッドシートの作成・連携に失敗しました。' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/inspection/fix', (req, res) => {
  const { id, repairNote } = req.body;
  const logIndex = inspectionLogs.findIndex(l => l.id === id);
  if (logIndex !== -1) {
    inspectionLogs[logIndex].repairStatus = 'fixed';
    inspectionLogs[logIndex].repairNote = repairNote || '修繕作業が完了しました。';

    saveDatabase();
    res.json({ success: true, inspectionLog: inspectionLogs[logIndex] });
  } else {
    res.status(404).json({ success: false, message: '点検記録が見つかりません。' });
  }
});

// NFC Tag Operations
// Associate an NFC Tag with either a resource or teacher
app.post('/api/nfc/associate', (req, res) => {
  const { targetType, targetId, tagId } = req.body;
  if (!targetType || !targetId || !tagId) {
    return res.status(400).json({ success: false, message: '必要な情報が不足しています。' });
  }

  if (targetType === 'teacher') {
    const teacher = teachers.find(t => t.id === targetId);
    if (teacher) {
      // Check if tag is already used
      const duplicateTeacher = teachers.find(t => t.nfcTagId === tagId && t.id !== targetId);
      const duplicateResource = resources.find(r => r.nfcTagId === tagId);
      if (duplicateTeacher || duplicateResource) {
        return res.status(400).json({ success: false, message: 'このNFCタグIDはすでに他の教員または備品に紐付けられています。' });
      }
      teacher.nfcTagId = tagId;
      saveDatabase();
      return res.json({ success: true, message: '教員にNFCタグを紐付けました。', teacher });
    }
  } else if (targetType === 'resource') {
    const resource = resources.find(r => r.id === targetId);
    if (resource) {
      // Check duplicate
      const duplicateTeacher = teachers.find(t => t.nfcTagId === tagId);
      const duplicateResource = resources.find(r => r.nfcTagId === tagId && r.id !== targetId);
      if (duplicateTeacher || duplicateResource) {
        return res.status(400).json({ success: false, message: 'このNFCタグIDはすでに他の教員または備品に紐付けられています。' });
      }
      resource.nfcTagId = tagId;
      saveDatabase();
      return res.json({ success: true, message: '備品・教室にNFCタグを紐付けました。', resource });
    }
  }

  res.status(404).json({ success: false, message: '対象が見つかりませんでした。' });
});

// NFC Tap Simulator
// Automatically checks the resource state and handles: Check-out, Check-in, or Baton!
app.post('/api/nfc/tap', (req, res) => {
  const { tagId, teacherId } = req.body;
  if (!tagId || !teacherId) {
    return res.status(400).json({ success: false, message: 'NFCタグIDと操作教員の情報が必要です。' });
  }

  // 1. Find the resource linked to this tagId (can be NFC Tag ID or QR Code ID)
  const resource = resources.find(r => r.nfcTagId === tagId || r.qrCodeId === tagId);
  if (!resource) {
    return res.status(404).json({ 
      success: false, 
      message: `タグID [${tagId}] に紐づく備品や特別教室が見つかりませんでした。マスター管理でタグを紐付けてください。` 
    });
  }

  const teacher = teachers.find(t => t.id === teacherId);
  if (!teacher) {
    return res.status(404).json({ success: false, message: '操作している教員がデータベースに登録されていません。' });
  }

  let action: 'check_out' | 'check_in' | 'baton' = 'check_out';
  let message = '';
  const previousTeacherId = resource.currentTeacherId;

  if (resource.status === 'available') {
    // Perform CHECK-OUT
    resource.status = 'checked_out';
    resource.currentTeacherId = teacherId;
    resource.lastCheckedOutAt = new Date().toISOString();
    action = 'check_out';
    message = `「${resource.name}」の貸出（利用開始）を処理しました。`;
  } else if (resource.status === 'checked_out') {
    if (resource.currentTeacherId === teacherId) {
      // Perform CHECK-IN (Return)
      resource.status = 'available';
      resource.currentTeacherId = null;
      resource.lastCheckedOutAt = null;
      action = 'check_in';
      message = `「${resource.name}」の返却（利用終了）を処理しました。`;
    } else {
      // Perform BATON (Transfer to new teacher directly!)
      const oldTeacher = teachers.find(t => t.id === previousTeacherId);
      resource.currentTeacherId = teacherId;
      resource.lastCheckedOutAt = new Date().toISOString();
      action = 'baton';
      message = `「${resource.name}」を ${oldTeacher ? oldTeacher.name : '前の教員'} から ${teacher.name} へ引き継ぎ（バトン）処理しました。`;

      // Resolve any active SOS for this teacher if they just got the baton
      sosRequests = sosRequests.filter(s => !(s.resourceId === resource.id && s.teacherId === teacherId));
    }
  }

  // Record NFC History Event
  const historyEvent: NFCHistoryEvent = {
    id: 'H_' + Date.now(),
    resourceId: resource.id,
    teacherId,
    action,
    timestamp: new Date().toISOString(),
    tagId
  };

  nfcHistory.unshift(historyEvent);
  saveDatabase();

  res.json({
    success: true,
    message,
    action,
    resource,
    historyEvent
  });
});

// Serve frontend static assets or wire Vite development middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[School-Trace Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
