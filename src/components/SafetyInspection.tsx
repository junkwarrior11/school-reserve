import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Wrench, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ClipboardList, 
  HelpCircle,
  Clock,
  User,
  Lightbulb,
  Cpu,
  Camera,
  Video,
  RotateCcw,
  Trash2,
  Image,
  ExternalLink,
  RefreshCw,
  Check
} from 'lucide-react';
import { Teacher, Resource, InspectionLog, InspectionItem } from '../types';

interface SafetyInspectionProps {
  teachers: Teacher[];
  resources: Resource[];
  inspectionLogs: InspectionLog[];
  onRefresh: () => void;
  preselectedResourceId?: string;
  clearPreselectedResource?: () => void;
}

export default function SafetyInspection({ 
  teachers, 
  resources, 
  inspectionLogs, 
  onRefresh,
  preselectedResourceId,
  clearPreselectedResource
}: SafetyInspectionProps) {
  // Tabs: 'new_inspection' | 'history'
  const [activeSubTab, setActiveSubTab] = useState<'new_inspection' | 'history'>('new_inspection');

  // New Inspection State
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [overallStatus, setOverallStatus] = useState<'ok' | 'caution' | 'ng'>('ok');
  const [generalComment, setGeneralComment] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Active checklist template: 'classroom' | 'workspace' | 'equipment' | 'custom'
  const [selectedTemplate, setSelectedTemplate] = useState<'classroom' | 'workspace' | 'equipment' | 'custom'>('classroom');

  // Master management editing states for customized items
  const [isEditingMaster, setIsEditingMaster] = useState<boolean>(false);
  const [masterEditingItems, setMasterEditingItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState<string>('');

  // Dynamic items based on resource category
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);

  // Repair note state
  const [activeRepairLogId, setActiveRepairLogId] = useState<string | null>(null);
  const [repairNoteInput, setRepairNoteInput] = useState<string>('');
  const [isSubmittingRepair, setIsSubmittingRepair] = useState<boolean>(false);

  // Camera State
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Google Sheets configuration state
  const [sheetsConfig, setSheetsConfig] = useState<{ hasToken: boolean; spreadsheetId: string | null; spreadsheetUrl: string | null }>({
    hasToken: false,
    spreadsheetId: null,
    spreadsheetUrl: null
  });
  const [reconnecting, setReconnecting] = useState<boolean>(false);

  const fetchSheetsConfig = async () => {
    try {
      const response = await fetch('/api/sheets/config');
      if (response.ok) {
        const data = await response.json();
        setSheetsConfig(data);
      }
    } catch (e) {
      console.error('Error fetching sheets config:', e);
    }
  };

  const handleReconnectSheets = async () => {
    setReconnecting(true);
    try {
      const response = await fetch('/api/sheets/reconnect', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        alert('Googleスプレッドシートの再連携・同期テストに成功しました！');
        fetchSheetsConfig();
      } else {
        alert(data.message || '再連携に失敗しました。');
      }
    } catch (err) {
      alert('再連携リクエスト中にエラーが発生しました。');
    } finally {
      setReconnecting(false);
    }
  };

  useEffect(() => {
    fetchSheetsConfig();
  }, [inspectionLogs]);

  // Auto-load preselected resource from NFC simulator
  useEffect(() => {
    if (preselectedResourceId) {
      handleResourceChange(preselectedResourceId);
      if (clearPreselectedResource) {
        clearPreselectedResource();
      }
    }
  }, [preselectedResourceId]);

  // Standard static check templates from the paper form
  const defaultClassroomItems = [
    '窓や戸の開閉に支障はないか。破損は、ないか。',
    '机、椅子に破損やネジのゆるみはないか。',
    '教室後ろの掲示板、窓下のかべなどに画鋲の針が出ていないか。',
    '吊りテレビ、スクリーン、扇風機に落下の危険はないか。',
    '戸棚類は倒れる危険はないか。',
    '必要な箇所の施錠ができるか。',
    'コンセントにほこり等がたまっていないか。',
    '防犯ブザーは鳴るか。'
  ];

  const defaultWorkspaceItems = [
    '通行の妨げになるものはないか。',
    '窓や戸の開閉に支障はないか。破損はないか。',
    '手すりの異常、破損はないか。',
    '掲示板等に画鋲の針が出ていないか。',
    '落下や倒れる危険のあるものはないか。',
    '児童がよじ登る危険のあるものはないか。',
    '必要な箇所の施錠ができるか。'
  ];

  const defaultEquipmentItems = [
    '外観（筐体、コード、ネジ等の接合部）に異常な破損・緩みはないか。',
    '電源を入れて異音や異常な発熱、異臭がしないか。',
    '使用期限や消耗部品の消耗度合いは適正範囲内か。',
    '安全カバーや安全スイッチ、ブレーキ機構は正常に機能するか。'
  ];

  const startCamera = async () => {
    setCameraError('');
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Error accessing camera', err);
      setCameraError('カメラの起動に失敗しました。ブラウザのカメラパーミッションを許可するか、デバイスにカメラが正しく接続されていることを確認してください。');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        const dateStr = new Date().toLocaleString('ja-JP') + ' [School-Trace 安全点検記録]';
        ctx.fillText(dateStr, 20, canvas.height - 15);

        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotoUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const generateMockPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#f1f5f9');
      grad.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, 600, 440);

      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#1e293b';
        ctx.beginPath();
        ctx.moveTo(30 + i * 40, 30);
        ctx.lineTo(70 + i * 40, 30);
        ctx.lineTo(30 + i * 40, 60);
        ctx.lineTo(0 + i * 40, 60);
        ctx.fill();
      }

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('【安全点検 記録写真】', 320, 180);

      const res = resources.find(r => r.id === selectedResourceId);
      ctx.font = '20px sans-serif';
      ctx.fillText(`対象: ${res ? res.name : '未選択リソース'}`, 320, 230);
      ctx.fillText(`設置場所: ${res ? res.location : '校内'}`, 320, 270);

      ctx.fillStyle = '#e11d48';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('● 異常箇所 / 現地状況エビデンス', 320, 330);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(20, 400, 600, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      const dateStr = new Date().toLocaleString('ja-JP') + ' [School-Trace 安全点検記録 - 仮想キャプチャ]';
      ctx.fillText(dateStr, 40, 425);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setPhotoUrl(dataUrl);
    }
  };

  // Helper to load items of a specific template
  const loadChecklistItems = (templateType: 'classroom' | 'workspace' | 'equipment' | 'custom') => {
    let defaultTitles: string[] = [];
    if (templateType === 'classroom') {
      defaultTitles = defaultClassroomItems;
    } else if (templateType === 'workspace') {
      defaultTitles = defaultWorkspaceItems;
    } else if (templateType === 'equipment') {
      defaultTitles = defaultEquipmentItems;
    } else {
      // Load custom items if configured, otherwise fallback to classroom standard template
      const res = resources.find(r => r.id === selectedResourceId);
      defaultTitles = res?.customInspectionItems && res.customInspectionItems.length > 0
        ? res.customInspectionItems
        : defaultClassroomItems;
    }

    const items: InspectionItem[] = defaultTitles.map((title, idx) => ({
      id: String(idx + 1),
      title,
      status: 'ok',
      comment: ''
    }));
    setInspectionItems(items);
  };

  // When a resource is selected, populate checklist template
  const handleResourceChange = (resId: string) => {
    setSelectedResourceId(resId);
    setIsEditingMaster(false); // Close editor on change
    if (!resId) {
      setInspectionItems([]);
      return;
    }
    const res = resources.find(r => r.id === resId);
    
    if (res?.customInspectionItems && res.customInspectionItems.length > 0) {
      setSelectedTemplate('custom');
      const items: InspectionItem[] = res.customInspectionItems.map((title, idx) => ({
        id: String(idx + 1),
        title,
        status: 'ok',
        comment: ''
      }));
      setInspectionItems(items);
      return;
    }

    const templateType = res?.category === 'classroom' ? 'classroom' : 'equipment';
    setSelectedTemplate(templateType);
    
    let defaultTitles: string[] = [];
    if (templateType === 'classroom') {
      defaultTitles = defaultClassroomItems;
    } else {
      defaultTitles = defaultEquipmentItems;
    }

    const items: InspectionItem[] = defaultTitles.map((title, idx) => ({
      id: String(idx + 1),
      title,
      status: 'ok',
      comment: ''
    }));
    setInspectionItems(items);
  };

  // Save custom items list to master database
  const handleSaveCustomMaster = async (itemsList: string[]) => {
    if (!selectedResourceId) return;
    const res = resources.find(r => r.id === selectedResourceId);
    if (!res) return;

    try {
      const updatedResource: Resource = {
        ...res,
        customInspectionItems: itemsList.filter(item => item.trim() !== '')
      };

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedResource)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onRefresh(); // Refresh state in parent App.tsx
        alert('この教室の安全点検項目マスタを更新しました！');
        setIsEditingMaster(false);
        
        // Reload currently selected resource checklist items
        const updatedItems: InspectionItem[] = updatedResource.customInspectionItems!.map((title, idx) => ({
          id: String(idx + 1),
          title,
          status: 'ok',
          comment: ''
        }));
        setInspectionItems(updatedItems);
        setSelectedTemplate('custom');
      } else {
        alert(data.message || '点検項目マスタの保存に失敗しました。');
      }
    } catch (err) {
      alert('通信に失敗しました。');
    }
  };

  // Reset custom items back to standard template
  const handleResetToStandard = async () => {
    if (!selectedResourceId) return;
    const res = resources.find(r => r.id === selectedResourceId);
    if (!res) return;

    if (!window.confirm('この教室の点検項目を「標準テンプレート（標準項目）」に戻してもよろしいですか？（カスタム設定した項目は削除されます）')) {
      return;
    }

    try {
      const updatedResource: Resource = {
        ...res,
        customInspectionItems: undefined
      };

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedResource)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onRefresh();
        alert('点検項目を標準テンプレートにリセットしました。');
        setIsEditingMaster(false);

        // Reset local checklist
        const templateType = res.category === 'classroom' ? 'classroom' : 'equipment';
        setSelectedTemplate(templateType);
        let defaultTitles: string[] = [];
        if (templateType === 'classroom') {
          defaultTitles = defaultClassroomItems;
        } else {
          defaultTitles = defaultEquipmentItems;
        }
        const updatedItems: InspectionItem[] = defaultTitles.map((title, idx) => ({
          id: String(idx + 1),
          title,
          status: 'ok',
          comment: ''
        }));
        setInspectionItems(updatedItems);
      } else {
        alert(data.message || 'リセットに失敗しました。');
      }
    } catch (err) {
      alert('通信に失敗しました。');
    }
  };

  const handleItemStatusChange = (id: string, status: 'ok' | 'caution' | 'ng' | 'A' | 'B' | 'C') => {
    setInspectionItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, status };
        return updatedItem;
      }
      return item;
    }));
  };

  const handleItemCommentChange = (id: string, comment: string) => {
    setInspectionItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, comment };
      }
      return item;
    }));
  };

  // Submit Safety Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId) {
      alert('対象 of 備品・特別教室を選択してください。');
      return;
    }
    if (!selectedTeacherId) {
      alert('点検者の教員を選択してください。');
      return;
    }

    // Determine logical overall status based on checklist items
    let calculatedOverallStatus: 'ok' | 'caution' | 'ng' = 'ok';
    if (inspectionItems.some(i => i.status === 'ng' || i.status === 'A')) {
      calculatedOverallStatus = 'ng';
    } else if (inspectionItems.some(i => i.status === 'caution' || i.status === 'B' || i.status === 'C')) {
      calculatedOverallStatus = 'caution';
    }

    try {
      const payload = {
        resourceId: selectedResourceId,
        teacherId: selectedTeacherId,
        overallStatus: calculatedOverallStatus,
        items: inspectionItems,
        generalComment: generalComment.trim() || '異常ありません。良好です。',
        photoUrl
      };

      const response = await fetch('/api/inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(`安全点検報告を保存しました！\n\n【クラウド同期状況】\n${data.message || '保存が完了しました。'}`);
        // Reset state
        setSelectedResourceId('');
        setSelectedTeacherId('');
        setGeneralComment('');
        setInspectionItems([]);
        setPhotoUrl(null);
        onRefresh();
        fetchSheetsConfig();
        setActiveSubTab('history');
      } else {
        alert(data.message || '安全点検報告の送信に失敗しました。');
      }
    } catch (err) {
      alert('安全点検報告の送信中にエラーが発生しました。');
    }
  };

  // Repair Fix submission
  const handleSubmitRepairFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepairLogId) return;

    setIsSubmittingRepair(true);
    try {
      const response = await fetch('/api/inspection/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRepairLogId,
          repairNote: repairNoteInput.trim() || '修繕点検・交換対応が完了しました。'
        })
      });

      const data = await response.json();
      setIsSubmittingRepair(false);
      if (response.ok && data.success) {
        alert('修繕・修理対応完了を報告しました！');
        setActiveRepairLogId(null);
        setRepairNoteInput('');
        onRefresh();
      } else {
        alert(data.message || '修繕報告に失敗しました。');
      }
    } catch (e) {
      setIsSubmittingRepair(false);
      alert('修繕報告中に通信エラーが発生しました。');
    }
  };

  return (
    <div className="space-y-6" id="safety-inspection-container">
      {/* Upper Navigation Tabs */}
      <div className="flex bg-slate-200/60 p-1 rounded-xl max-w-sm">
        <button
          onClick={() => setActiveSubTab('new_inspection')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'new_inspection' 
              ? 'bg-white shadow-sm text-indigo-700' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          新規安全点検の報告
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'history' 
              ? 'bg-white shadow-sm text-indigo-700' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          点検履歴・修繕対応
        </button>
      </div>

      {/* Google Sheets Status Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${sheetsConfig.hasToken ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-800 text-sm">
                Google Sheets / Google Drive クラウド同期状況
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                sheetsConfig.hasToken ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {sheetsConfig.hasToken ? '連携有効' : 'ローカル保存のみ'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {sheetsConfig.hasToken 
                ? '安全点検が完了すると、自動的に「School-Trace 安全点検記録」Googleスプレッドシートに記録が追記され、写真がGoogle Driveに保管されます。'
                : 'Google Workspace 連携の承認トークンがありません。安全点検はローカルデータベース（db.json）にのみ記録されます。連携には、設定メニューからGoogle Sheets/Driveへのアクセス権限を許可してください。'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sheetsConfig.hasToken && sheetsConfig.spreadsheetUrl && (
            <a
              href={sheetsConfig.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              スプレッドシートを開く
            </a>
          )}
          {sheetsConfig.hasToken && (
            <button
              type="button"
              onClick={handleReconnectSheets}
              disabled={reconnecting}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
              title="スプレッドシートを再接続・新規作成します"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
              {reconnecting ? '同期中...' : '再連携・同期テスト'}
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'new_inspection' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Monthly Inspection Progress Dashboard Section */}
          <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  {new Date().getMonth() + 1}月度 教室・施設 安全点検実施状況 (月ごとの巡回状況)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  安全点検義務がある特別教室・施設の月間点検状況を一覧化しています。NFC読み取りまたはリストから点検を行えます。
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>今月の進捗:</span>
                <span className="text-indigo-600 font-bold">
                  {resources.filter(r => r.category === 'classroom').filter(r => {
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    return inspectionLogs.some(log => log.resourceId === r.id && new Date(log.date).getMonth() === currentMonth && new Date(log.date).getFullYear() === currentYear);
                  }).length} / {resources.filter(r => r.category === 'classroom').length}
                </span>
                <span className="text-slate-300">|</span>
                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px]">
                  {Math.round((resources.filter(r => r.category === 'classroom').filter(r => {
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    return inspectionLogs.some(log => log.resourceId === r.id && new Date(log.date).getMonth() === currentMonth && new Date(log.date).getFullYear() === currentYear);
                  }).length / (resources.filter(r => r.category === 'classroom').length || 1)) * 100)}% 完了
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.filter(r => r.category === 'classroom').map(room => {
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const inspectionThisMonth = inspectionLogs.find(log => log.resourceId === room.id && new Date(log.date).getMonth() === currentMonth && new Date(log.date).getFullYear() === currentYear);
                const isInspected = !!inspectionThisMonth;

                return (
                  <div
                    key={room.id}
                    className={`p-4 border rounded-xl flex flex-col justify-between gap-3 transition-all ${
                      isInspected 
                        ? 'bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/40' 
                        : 'bg-slate-50/40 border-slate-200/80 hover:bg-slate-50/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs">
                            {room.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">{room.location}</p>
                        </div>
                        {isInspected ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> 点検済み
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            未点検
                          </span>
                        )}
                      </div>

                      {isInspected && inspectionThisMonth && (
                        <div className="mt-2.5 space-y-1 bg-white p-2 rounded border border-emerald-100 text-[10px] text-slate-600">
                          <div className="flex justify-between">
                            <span className="font-medium text-slate-500">点検日:</span>
                            <span>{new Date(inspectionThisMonth.date).toLocaleDateString('ja-JP')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-slate-500">点検者:</span>
                            <span>{teachers.find(t => t.id === inspectionThisMonth.teacherId)?.name || '教員'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-slate-500">判定:</span>
                            <span className={`font-bold ${
                              inspectionThisMonth.overallStatus === 'ok' ? 'text-emerald-600' : inspectionThisMonth.overallStatus === 'caution' ? 'text-amber-500' : 'text-rose-500'
                            }`}>
                              {inspectionThisMonth.overallStatus === 'ok' ? '良好 (OK)' : inspectionThisMonth.overallStatus === 'caution' ? '注意 (Caution)' : '要修理 (NG)'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          handleResourceChange(room.id);
                          // Scroll smoothly to form
                          document.getElementById('safety-form-container')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                          isInspected
                            ? 'text-slate-600 hover:bg-slate-150 bg-slate-100'
                            : 'text-white bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isInspected ? '再点検する' : '点検を開始'} &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Form Left */}
          <div id="safety-form-container" className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5.5 h-5.5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800 text-base">安全点検の記録と実施</h3>
              </div>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-6">
              {/* Top Selectors Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    点検対象のリソース
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={selectedResourceId}
                    onChange={(e) => handleResourceChange(e.target.value)}
                  >
                    <option value="">-- 点検対象を選択 --</option>
                    {resources.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.location})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    点検実施者（教員）
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                  >
                    <option value="">-- 点検者を選択 --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template Selection Tabs */}
              {selectedResourceId && (
                <div className="space-y-1.5 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-indigo-600" />
                    点検チェックリスト（用紙）を選択
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {resources.find(r => r.id === selectedResourceId)?.customInspectionItems?.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplate('custom');
                          loadChecklistItems('custom');
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                          selectedTemplate === 'custom'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>✨ 教室個別カスタム項目</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplate('classroom');
                        loadChecklistItems('classroom');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                        selectedTemplate === 'classroom'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>🏫 教室（一般教室・特別教室）</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplate('workspace');
                        loadChecklistItems('workspace');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                        selectedTemplate === 'workspace'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>👥 ワークスペース（廊下・共有）</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplate('equipment');
                        loadChecklistItems('equipment');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                        selectedTemplate === 'equipment'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>🛠️ 貸出備品・ICT機材用</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Individual Classroom Inspection Items Master Settings Editor */}
              {selectedResourceId && (() => {
                const res = resources.find(r => r.id === selectedResourceId);
                if (!res) return null;
                const hasCustom = res.customInspectionItems && res.customInspectionItems.length > 0;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-2 flex-wrap gap-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        ⚙️ {res.name} 個別点検項目のマスタ管理
                      </h4>
                      {!isEditingMaster && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const itemsToEdit = hasCustom 
                                ? [...res.customInspectionItems!] 
                                : inspectionItems.map(i => i.title);
                              setMasterEditingItems(itemsToEdit);
                              setIsEditingMaster(true);
                            }}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            🔧 点検マスタを編集
                          </button>
                          {hasCustom && (
                            <button
                              type="button"
                              onClick={handleResetToStandard}
                              className="bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
                            >
                              ♻️ 標準項目に戻す
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {!isEditingMaster ? (
                      <div className="text-[11px] text-slate-600 font-medium">
                        {hasCustom ? (
                          <div className="flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50/50 p-2 rounded-xl border border-indigo-100/50">
                            <span>✨ 教室専用のカスタム点検項目が登録されています。</span>
                          </div>
                        ) : (
                          <p>
                            💡 教室独自の点検項目をマスタ登録・編集できます。
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">マスタ項目のカスタマイズ編集</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {masterEditingItems.length} 項目設定中
                          </span>
                        </div>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {masterEditingItems.map((itemText, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="bg-slate-100 text-slate-500 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-mono">
                                {index + 1}
                              </span>
                              <input
                                type="text"
                                value={itemText}
                                onChange={(e) => {
                                  const updated = [...masterEditingItems];
                                  updated[index] = e.target.value;
                                  setMasterEditingItems(updated);
                                }}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = masterEditingItems.filter((_, idx) => idx !== index);
                                  setMasterEditingItems(updated);
                                }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 transition-colors cursor-pointer"
                                title="この項目を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add New Item Input */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <input
                            type="text"
                            placeholder="例: プロジェクター・スクリーンの昇降装置は作動するか。"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newItemText.trim()) {
                                  setMasterEditingItems([...masterEditingItems, newItemText.trim()]);
                                  setNewItemText('');
                                }
                              }
                            }}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newItemText.trim()) {
                                setMasterEditingItems([...masterEditingItems, newItemText.trim()]);
                                setNewItemText('');
                              }
                            }}
                            className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            追加
                          </button>
                        </div>

                        {/* Actions for Editor */}
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingMaster(false)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (masterEditingItems.length === 0) {
                                alert('点検項目は少なくとも1つ以上必要です。');
                                return;
                              }
                              handleSaveCustomMaster(masterEditingItems);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            マスタに保存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Checklist Container */}
              {inspectionItems.length > 0 && (
                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/35 shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-150 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      📑 安全点検項目シート (
                      {selectedTemplate === 'classroom' ? '教室用' : selectedTemplate === 'workspace' ? 'ワークスペース用' : selectedTemplate === 'equipment' ? '備品用' : '教室別カスタム項目'}
                      )
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">
                      {inspectionItems.length} 項目
                    </span>
                  </div>

                  {/* Rating Legend matching the paper form */}
                  <div className="bg-slate-100/60 border-b border-slate-150 p-4 text-xs space-y-2.5">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block">
                      【判定基準（従来の紙の安全点検表に準拠）】
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 font-medium text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 flex items-center justify-center rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] shrink-0">◯</span>
                        <span>異常なし</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 flex items-center justify-center rounded-md bg-amber-100 text-amber-800 font-bold font-mono text-[11px] shrink-0">C</span>
                        <span>対応の検討（危険性は低い）が必要</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 flex items-center justify-center rounded-md bg-orange-100 text-orange-800 font-bold font-mono text-[11px] shrink-0">B</span>
                        <span>緊急性は低い（けがの可能性）が対応が必要</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 flex items-center justify-center rounded-md bg-rose-100 text-rose-800 font-bold font-mono text-[11px] shrink-0">A</span>
                        <span>緊急の対処（生命に関わる）が必要</span>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {inspectionItems.map((item, idx) => (
                      <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50/20 transition-colors">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 font-mono mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-slate-800 text-xs font-semibold leading-relaxed">
                              {item.title}
                            </span>
                          </div>
                          
                          {/* Item Comment Field */}
                          <input
                            type="text"
                            placeholder="補足・異常時の状況コメント (任意)"
                            className="w-full text-slate-600 bg-transparent placeholder-slate-400 focus:outline-none border-b border-transparent focus:border-indigo-400/50 py-1 text-xs"
                            value={item.comment}
                            onChange={(e) => handleItemCommentChange(item.id, e.target.value)}
                          />
                        </div>

                        {/* Radio Selector for Status matching the paper checklist */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleItemStatusChange(item.id, 'ok')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                              item.status === 'ok'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="異常なし"
                          >
                            <span className="text-sm">◯</span>
                            <span>異常なし</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemStatusChange(item.id, 'C')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                              item.status === 'C' || item.status === 'caution'
                                ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="C: 対応の検討が必要（危険性は低い）"
                          >
                            <span className="font-mono text-sm">C</span>
                            <span>要検討</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemStatusChange(item.id, 'B')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                              item.status === 'B'
                                ? 'bg-orange-50 border-orange-200 text-orange-700 font-bold shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="B: 緊急性は低いが、対応が必要（けがの可能性）"
                          >
                            <span className="font-mono text-sm">B</span>
                            <span>要対応</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemStatusChange(item.id, 'A')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                              item.status === 'A' || item.status === 'ng'
                                ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold shadow-xs animate-pulse'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="A: 緊急の対処が必要（生命に関わる）"
                          >
                            <span className="font-mono text-sm">A</span>
                            <span>緊急対処</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo Evidence Section with camera functionality */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-500" />
                  現地状況・エビデンス写真の記録（任意）
                </label>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  {/* Streaming video for camera check-in */}
                  {showCamera && (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-w-md mx-auto border border-slate-800 shadow-inner flex flex-col justify-end">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      
                      {cameraError && (
                        <p className="absolute inset-0 p-4 text-xs font-medium bg-rose-950/80 text-rose-200 flex items-center justify-center text-center">
                          {cameraError}
                        </p>
                      )}

                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/85 p-3 flex justify-between gap-2 items-center">
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> REC ACTIVE
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            disabled={!!cameraError}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            シャッターを切る
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview of captured photo */}
                  {photoUrl && !showCamera && (
                    <div className="relative max-w-sm mx-auto rounded-xl overflow-hidden border border-slate-300 shadow-md group">
                      <img 
                        src={photoUrl} 
                        alt="点検記録エビデンス" 
                        className="w-full object-cover aspect-video" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPhotoUrl(null)}
                          className="bg-rose-600/90 hover:bg-rose-700 text-white p-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer animate-fade-in"
                          title="写真を削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 p-2 text-[10px] text-white font-mono text-center">
                        点検写真エビデンスがセットされました
                      </div>
                    </div>
                  )}

                  {/* Buttons to trigger camera or generate programmatically */}
                  {!showCamera && (
                    <div className="flex flex-wrap gap-2.5 justify-center">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:bg-slate-50 active:scale-95"
                      >
                        <Camera className="w-4 h-4 text-indigo-500" />
                        実機のカメラを起動して撮影
                      </button>
                      <button
                        type="button"
                        onClick={generateMockPhoto}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Image className="w-4 h-4 text-amber-500" />
                        現地安全異常（サンプル写真）を自動生成
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Overall general comment */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  総合点検コメント / 所見（任意）
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 min-h-[100px]"
                  placeholder="点検の全体的な状況、または修理手配などの段取りについてのメモをご記入ください..."
                  value={generalComment}
                  onChange={(e) => setGeneralComment(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedResourceId || !selectedTeacherId}
                className={`w-full font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 ${
                  !selectedResourceId || !selectedTeacherId
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-150'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                安全点検の報告書を送信する
              </button>
            </form>
          </div>

          {/* Quick Guide / Instructions on Right */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-800 text-white rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-sm">School-Trace 安全点検ガイド</h4>
              </div>
              <p className="text-xs text-slate-350 leading-relaxed">
                備品や教室のNFCタグをスマートフォン等の端末で読み取ることで、瞬時にその場所の点検項目をロードして確認報告を行うことができます。
              </p>
              <div className="border-t border-slate-700/60 pt-3 space-y-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-indigo-400 shrink-0 font-bold">1.</span>
                  <p className="text-slate-300">点検対象の備品または特別教室を選択します。</p>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-indigo-400 shrink-0 font-bold">2.</span>
                  <p className="text-slate-300">表示された標準チェックシートの各項目を確認し、判定を入力します。</p>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-indigo-400 shrink-0 font-bold">3.</span>
                  <p className="text-slate-300">必要に応じてカメラで現地写真エビデンスを撮影して送信します。</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-slate-400" />
                現在の修繕対応待ちタスク
              </h4>
              
              <div className="space-y-3">
                {inspectionLogs.filter(l => l.repairStatus === 'pending').length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    現在、要修繕・未対応の不具合はありません。良好です。
                  </p>
                ) : (
                  inspectionLogs
                    .filter(l => l.repairStatus === 'pending')
                    .map(log => {
                      const res = resources.find(r => r.id === log.resourceId);
                      return (
                        <div key={log.id} className="p-3 bg-rose-50/55 border border-rose-100 rounded-xl space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 truncate" title={res?.name}>
                              {res ? res.name : '特別教室'}
                            </span>
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1 rounded">
                              {log.overallStatus === 'ng' ? 'NG' : '注意'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {log.generalComment}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSubTab('history');
                              setActiveRepairLogId(log.id);
                            }}
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                          >
                            対応を記録する &rarr;
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* History Log Feed Left (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                安全点検報告 & 修理対応履歴
              </h3>

              <div className="space-y-4">
                {inspectionLogs.length === 0 ? (
                  <p className="text-slate-400 text-center py-12 text-sm">
                    点検報告記録はありません。
                  </p>
                ) : (
                  inspectionLogs.map(log => {
                    const res = resources.find(r => r.id === log.resourceId);
                    const inspector = teachers.find(t => t.id === log.teacherId);
                    const isRepaired = log.repairStatus === 'fixed';
                    const hasIssues = log.overallStatus === 'ng' || log.overallStatus === 'caution';

                    return (
                      <div 
                        key={log.id} 
                        className={`p-4 border rounded-2xl space-y-3 transition-all ${
                          isRepaired 
                            ? 'bg-slate-50/50 border-slate-200' 
                            : hasIssues 
                              ? 'bg-rose-50/20 border-rose-200/60' 
                              : 'bg-white border-slate-200'
                        }`}
                      >
                        {/* Header metadata row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="space-y-0.5">
                            <h4 className="font-bold text-slate-800 text-sm">
                              {res ? res.name : `不明な備品 (${log.resourceId})`}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {inspector ? inspector.name : '不明な教員'} ({inspector?.department})
                              </span>
                              <span>·</span>
                              <span>
                                {new Date(log.date).toLocaleDateString('ja-JP')} {new Date(log.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5">
                            {/* Status badge */}
                            {log.overallStatus === 'ok' ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <CheckCircle className="w-3 h-3" /> 点検OK
                              </span>
                            ) : log.overallStatus === 'caution' ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> 点検注意
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <XCircle className="w-3 h-3 animate-pulse" /> 点検NG
                              </span>
                            )}

                            {/* Repair status badge */}
                            {hasIssues && (
                              isRepaired ? (
                                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Wrench className="w-3 h-3" /> 修繕完了
                                </span>
                              ) : (
                                <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                                  <Wrench className="w-3 h-3" /> 未対応 (修繕待ち)
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {/* General Comment */}
                        <div className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          {log.generalComment}
                        </div>

                        {/* Saved photo display */}
                        {log.photoUrl && (
                          <div className="mt-2 max-w-xs rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                            <img 
                              src={log.photoUrl} 
                              alt="点検エビデンス写真" 
                              className="w-full object-cover aspect-video hover:scale-[1.03] transition-all duration-300" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {/* Checklist item mini list */}
                        <div className="space-y-1.5">
                          {log.items.map(it => (
                            <div key={it.id} className="flex items-center justify-between text-[11px] py-1 border-b border-dashed border-slate-100/80">
                              <span className="text-slate-600 truncate mr-4">
                                {it.title}
                              </span>
                              <div className="flex items-center gap-2">
                                {it.comment && <span className="text-slate-400 italic text-[10px]" title={it.comment}>({it.comment})</span>}
                                {it.status === 'ok' ? (
                                  <span className="text-emerald-600 font-bold flex items-center gap-0.5">◯ 異常なし</span>
                                ) : it.status === 'C' ? (
                                  <span className="text-amber-500 font-bold flex items-center gap-0.5">C 要検討</span>
                                ) : it.status === 'B' ? (
                                  <span className="text-orange-500 font-bold flex items-center gap-0.5">B 要対応</span>
                                ) : it.status === 'A' ? (
                                  <span className="text-rose-600 font-bold flex items-center gap-0.5 animate-pulse">A 緊急対処</span>
                                ) : it.status === 'caution' ? (
                                  <span className="text-amber-500 font-bold flex items-center gap-0.5">▲ 注意</span>
                                ) : (
                                  <span className="text-rose-500 font-bold flex items-center gap-0.5">✖ NG</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Repair note display */}
                        {log.repairNote && (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-950 rounded-xl text-xs space-y-1">
                            <span className="font-bold text-[11px] block text-emerald-800">🛠️ 修繕・完了メモ:</span>
                            <p className="leading-relaxed">{log.repairNote}</p>
                          </div>
                        )}

                        {/* Actions drawer (marking complete) */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {hasIssues && !isRepaired && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRepairLogId(log.id);
                                setRepairNoteInput(log.repairNote || '');
                              }}
                              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              修繕作業の完了を報告
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Helper Repair Completion Form Right (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Repair Completion Form */}
            {activeRepairLogId && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Wrench className="w-4 h-4 text-indigo-600" />
                  修理・修繕完了の記録報告
                </h4>

                <form onSubmit={handleSubmitRepairFix} className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">対象の点検不具合</span>
                    <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded">
                      ID: {activeRepairLogId}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      実施した修繕内容・措置メモ
                    </label>
                    <textarea
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 min-h-[80px]"
                      placeholder="例: 交換用のほつれ補修用強力シールテープを貼り、安全を再確認しました。"
                      value={repairNoteInput}
                      onChange={(e) => setRepairNoteInput(e.target.value)}
                    />
                  </div>

                  {isSubmittingRepair ? (
                    <p className="text-xs text-indigo-500 font-semibold animate-pulse">報告を保存中...</p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setActiveRepairLogId(null); setRepairNoteInput(''); }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs"
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors"
                      >
                        完了を確定
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
