import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Rss, 
  User, 
  LogIn, 
  LogOut, 
  ArrowLeftRight, 
  Smartphone, 
  History, 
  Clock, 
  CheckCircle, 
  HelpCircle, 
  Cpu, 
  Box, 
  Info, 
  Zap, 
  Sparkles,
  ArrowRight,
  RotateCcw,
  ListFilter,
  AlertTriangle,
  MapPin,
  ShieldCheck
} from 'lucide-react';
import { Teacher, Resource, NFCHistoryEvent } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface EquipmentUsageProps {
  teachers: Teacher[];
  resources: Resource[];
  history: NFCHistoryEvent[];
  onRefresh: () => void;
  loggedInTeacherId: string;
  onSelectResourceForInspection?: (resId: string) => void;
}

export default function EquipmentUsage({ 
  teachers, 
  resources, 
  history, 
  onRefresh, 
  loggedInTeacherId,
  onSelectResourceForInspection
}: EquipmentUsageProps) {
  // Device Owner / Personal Identification States
  const [deviceOwnerId, setDeviceOwnerId] = useState<string>(loggedInTeacherId || '');
  const [activeTab, setActiveTab] = useState<'scan' | 'items' | 'history'>('scan');

  // Classroom scanned modal states
  const [showClassroomChoice, setShowClassroomChoice] = useState<boolean>(false);
  const [pendingClassroom, setPendingClassroom] = useState<Resource | null>(null);
  const [pendingTeacherId, setPendingTeacherId] = useState<string>('');

  // Synchronize deviceOwnerId with App's loggedInTeacherId whenever it changes
  useEffect(() => {
    if (loggedInTeacherId) {
      setDeviceOwnerId(loggedInTeacherId);
    }
  }, [loggedInTeacherId]);

  // Scanner State
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [scanType, setScanType] = useState<'nfc' | 'qr'>('nfc');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResource, setScannedResource] = useState<Resource | null>(null);
  
  // Pending step 2: teacher selection (only if no device owner is identified)
  const [showTeacherSelector, setShowTeacherSelector] = useState<boolean>(false);
  
  // Scan execution results
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    action?: 'check_out' | 'check_in' | 'baton';
    resourceName?: string;
    resourceId?: string;
    teacherName?: string;
    scanTypeUsed?: 'nfc' | 'qr';
  } | null>(null);

  // Filter for borrowed list
  const [borrowedFilter, setBorrowedFilter] = useState<'all' | 'mine'>('all');

  const activeDeviceOwner = teachers.find(t => t.id === deviceOwnerId);

  // Trigger the simulation scanning process
  const handleSimulateScan = () => {
    if (!selectedResourceId) {
      alert('読み取り対象の備品または特別教室を選択してください。');
      return;
    }

    const targetRes = resources.find(r => r.id === selectedResourceId);
    if (!targetRes) return;

    // Check if the item has the selected tag type
    if (scanType === 'nfc' && !targetRes.nfcTagId) {
      alert('選択したリソースにはNFCタグが登録されていません。マスタ管理で登録するか、QRコードスキャンをお試しください。');
      return;
    }
    if (scanType === 'qr' && !targetRes.qrCodeId) {
      alert('選択したリソースにはQRコードが登録されていません。マスタ管理で登録するか、NFCかざしをお試しください。');
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setShowTeacherSelector(false);
    setScannedResource(null);
    setShowClassroomChoice(false);
    setPendingClassroom(null);

    // Simulate scanning delay
    setTimeout(() => {
      setIsScanning(false);

      // Intercept if it's a classroom!
      if (targetRes.category === 'classroom') {
        setPendingClassroom(targetRes);
        setPendingTeacherId(deviceOwnerId);
        setShowClassroomChoice(true);
        return;
      }

      setScannedResource(targetRes);

      // Rule: If device owner is already set (personal identification is active)
      if (deviceOwnerId) {
        // Run API checkout/return directly for this teacher!
        executeTap(targetRes, deviceOwnerId);
      } else {
        // No device owner set, proceed to Step 2: Select Teacher manually
        setShowTeacherSelector(true);
      }
    }, 1200);
  };

  // Perform API transaction
  const executeTap = async (resource: Resource, teacherId: string) => {
    try {
      const activeLabelId = scanType === 'nfc' ? resource.nfcTagId : resource.qrCodeId;
      
      const response = await fetch('/api/nfc/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: activeLabelId,
          teacherId: teacherId,
        }),
      });

      const data = await response.json();
      
      const selectedTeacher = teachers.find(t => t.id === teacherId);

      if (data.success) {
        setScanResult({
          success: true,
          message: data.message,
          action: data.action,
          resourceName: resource.name,
          resourceId: resource.id,
          teacherName: selectedTeacher?.name,
          scanTypeUsed: scanType
        });
        setSelectedResourceId('');
        setShowTeacherSelector(false);
        setScannedResource(null);
        onRefresh();
      } else {
        setScanResult({
          success: false,
          message: data.message || '貸出・返却処理に失敗しました。',
        });
      }
    } catch (err) {
      setScanResult({
        success: false,
        message: 'サーバーとの通信に失敗しました。',
      });
    }
  };

  // Handle manual select teacher to complete checkout (Step 2)
  const handleTeacherSelect = (teacherId: string) => {
    if (!scannedResource) return;
    executeTap(scannedResource, teacherId);
  };

  // Quick return handler from borrowed items list
  const handleQuickReturn = async (res: Resource) => {
    if (!res.currentTeacherId) return;
    
    // Simulate automatic scanning of the tag/QR of that resource
    const activeLabelId = res.nfcTagId || res.qrCodeId;
    if (!activeLabelId) {
      alert('この備品にはタグが登録されていません。');
      return;
    }

    try {
      const response = await fetch('/api/nfc/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: activeLabelId,
          teacherId: res.currentTeacherId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setScanResult({
          success: true,
          message: `[クイック返却完了] ${data.message}`,
          action: 'check_in',
          resourceName: res.name,
          resourceId: res.id,
          teacherName: teachers.find(t => t.id === res.currentTeacherId)?.name,
          scanTypeUsed: res.nfcTagId ? 'nfc' : 'qr'
        });
        onRefresh();
      } else {
        alert(data.message || '返却に失敗しました。');
      }
    } catch (err) {
      alert('サーバーとの通信に失敗しました。');
    }
  };

  // Get current checked out items
  const checkedOutResources = resources.filter(r => r.status === 'checked_out');
  const filteredCheckedOut = borrowedFilter === 'mine' && deviceOwnerId
    ? checkedOutResources.filter(r => r.currentTeacherId === deviceOwnerId)
    : checkedOutResources;

  const getActionBadge = (action: 'check_out' | 'check_in' | 'baton') => {
    switch (action) {
      case 'check_out':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <LogOut className="w-3 h-3 mr-1" /> 貸出
          </span>
        );
      case 'check_in':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <LogIn className="w-3 h-3 mr-1" /> 返却
          </span>
        );
      case 'baton':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            <ArrowLeftRight className="w-3 h-3 mr-1" /> 引き継ぎ
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="equipment-usage-container">
      {/* 📱 1. Top Section: Device Owner Context Selection */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-300">
              <Smartphone className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2 flex-wrap">
                個人識別（スマホ設定）
                <span className="bg-indigo-500/30 text-indigo-200 text-[9px] px-1.5 py-0.5 rounded border border-indigo-400/20">
                  個人スマホ / 常時ログイン
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                教員を設定すると、かざすだけで<strong>貸出・返却が1タップで完了</strong>します。
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <div className="bg-white/10 px-3 py-2 rounded-xl flex items-center gap-2 border border-white/10 min-w-[200px]">
              <User className="w-4 h-4 text-slate-300" />
              <select
                className="bg-transparent text-white border-none text-xs focus:outline-none w-full font-semibold cursor-pointer"
                value={deviceOwnerId}
                onChange={(e) => {
                  setDeviceOwnerId(e.target.value);
                  setScanResult(null);
                  setShowTeacherSelector(false);
                  setScannedResource(null);
                }}
              >
                <option value="" className="text-slate-800">【共有タブレットとして使用】</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id} className="text-slate-800">
                    {t.name} 先生 ({t.department})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'scan'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Rss className="w-3.5 h-3.5" />
          スキャン
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative ${
            activeTab === 'items'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          貸出中
          {checkedOutResources.length > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {checkedOutResources.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          履歴
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="font-bold text-slate-800 text-xs mb-3">貸出・返却スキャン</h3>
              
              <div className="space-y-4">
                {/* 1. Toggle Scan Type */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">読み取り方法</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setScanType('nfc')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        scanType === 'nfc' 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-slate-50 border border-slate-200 text-slate-600'
                      }`}
                    >
                      <Rss className="w-3.5 h-3.5" />
                      NFC
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanType('qr')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        scanType === 'qr' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-slate-50 border border-slate-200 text-slate-600'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QRコード
                    </button>
                  </div>
                </div>

                {/* 2. Select Resource dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    読み取る備品 / 教室
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                    value={selectedResourceId}
                    onChange={(e) => {
                      setSelectedResourceId(e.target.value);
                      setScanResult(null);
                      setShowTeacherSelector(false);
                      setScannedResource(null);
                    }}
                  >
                    <option value="">-- 選択 --</option>
                    
                    {/* Available items */}
                    <optgroup label="🟢 利用可能 (すぐ貸出可能)">
                      {resources.filter(r => r.status === 'available').map(r => {
                        const hasTag = scanType === 'nfc' ? r.nfcTagId : r.qrCodeId;
                        return (
                          <option key={r.id} value={r.id} disabled={!hasTag}>
                            {r.name} ({r.location}) {hasTag ? '' : '⚠️ タグ未登録'}
                          </option>
                        );
                      })}
                    </optgroup>

                    {/* Borrowed items */}
                    <optgroup label="🔴 貸出中 (返却またはバトン引き継ぎ可能)">
                      {resources.filter(r => r.status === 'checked_out').map(r => {
                        const hasTag = scanType === 'nfc' ? r.nfcTagId : r.qrCodeId;
                        const holder = teachers.find(t => t.id === r.currentTeacherId);
                        return (
                          <option key={r.id} value={r.id} disabled={!hasTag}>
                            {r.name} (使用者: {holder ? holder.name : '不明'}) {hasTag ? '' : '⚠️ タグ未登録'}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Big Scan Simulation Box */}
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 relative overflow-hidden">
                  
                  {/* Glowing sensor animation */}
                  <div className="relative mb-4">
                    {isScanning && (
                      <div className={`absolute inset-0 rounded-full animate-ping pointer-events-none scale-150 ${scanType === 'nfc' ? 'bg-indigo-500/20' : 'bg-emerald-500/20'}`}></div>
                    )}
                    
                    <button
                      type="button"
                      disabled={isScanning || !selectedResourceId}
                      onClick={handleSimulateScan}
                      className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                        isScanning 
                          ? scanType === 'nfc' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-lg'
                          : !selectedResourceId 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed border'
                            : scanType === 'nfc'
                              ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-md active:scale-95 cursor-pointer'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md active:scale-95 cursor-pointer'
                      }`}
                    >
                      {scanType === 'nfc' ? (
                        <Rss className={`w-10 h-10 ${isScanning ? 'animate-bounce' : ''}`} />
                      ) : (
                        <QrCode className={`w-10 h-10 ${isScanning ? 'animate-pulse' : ''}`} />
                      )}
                    </button>
                  </div>

                  <p className="text-xs font-extrabold text-slate-700">
                    {isScanning 
                      ? scanType === 'nfc' ? '📱 NFC検知中...' : '📷 QRスキャン中...'
                      : 'タップしてスキャン'
                    }
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selectedResourceId ? 'スキャン準備完了' : '備品を選択してください'}
                  </p>
                </div>
              </div>

              {/* Scan result notification panel */}
              <AnimatePresence>
                {scanResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
                      scanResult.success 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
                        : 'bg-rose-50 border-rose-100 text-rose-900'
                    }`}
                  >
                    {scanResult.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">
                          {scanResult.success ? '読取・処理成功' : '処理エラー'}
                        </span>
                        {scanResult.action && getActionBadge(scanResult.action)}
                      </div>
                      <p className="text-xs mt-1 font-semibold text-slate-800 whitespace-pre-wrap">
                        {scanResult.message}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Step 2 Selection Panel or status details */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs h-full flex flex-col">
              
              {/* Flow explanation default */}
              {!showTeacherSelector && !scannedResource && (
                <div className="space-y-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">備品利用の流れ</h4>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-600 font-bold text-[11px] flex items-center justify-center shrink-0">1</div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-700">タグやQRコードの読み取り</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-600 font-bold text-[11px] flex items-center justify-center shrink-0">2</div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-700">教員の選択（省略可）</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-600 font-bold text-[11px] flex items-center justify-center shrink-0">3</div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-700">再スキャンで即時返却</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 TEACHER SELECTOR INTERFACE */}
              {showTeacherSelector && scannedResource && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4 flex-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-indigo-600 border-b border-indigo-50 pb-2 mb-3">
                      <Sparkles className="w-4 h-4 animate-spin-slow" />
                      <h4 className="font-extrabold text-slate-800 text-xs">2. 使用する教員を選択</h4>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-3 text-xs">
                      <p className="font-bold text-slate-700">対象：</p>
                      <p className="text-indigo-900 font-extrabold text-xs mt-1 flex items-center gap-1">
                        <Box className="w-4 h-4 text-indigo-600" />
                        {scannedResource.name}
                      </p>
                    </div>

                    <p className="text-xs text-slate-500 mb-2">
                      担当教員を選択してください：
                    </p>

                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {teachers.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleTeacherSelect(t.id)}
                          className="px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded-xl text-left text-xs font-bold transition-all text-slate-700 flex items-center justify-between"
                        >
                          <span>{t.name}</span>
                          <span className="text-[9px] text-slate-400 font-normal">{t.department}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherSelector(false);
                      setScannedResource(null);
                    }}
                    className="w-full mt-3 bg-slate-100 text-slate-600 text-xs font-bold py-2 rounded-lg transition-all"
                  >
                    戻る
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📋 CURRENTLY BORROWED LIST TAB */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">貸出中の備品・教室</h3>
            </div>

            {deviceOwnerId && (
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${borrowedFilter === 'all' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                  onClick={() => setBorrowedFilter('all')}
                >
                  すべてを表示 ({checkedOutResources.length})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${borrowedFilter === 'mine' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                  onClick={() => setBorrowedFilter('mine')}
                >
                  自分の貸出品 ({checkedOutResources.filter(r => r.currentTeacherId === deviceOwnerId).length})
                </button>
              </div>
            )}
          </div>

          {filteredCheckedOut.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-150 rounded-xl">
              <Box className="w-8 h-8 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-semibold">現在貸出中の備品・教室はありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-3 px-4">備品・特別教室名</th>
                    <th className="py-3 px-4">保管・設置場所</th>
                    <th className="py-3 px-4">使用者 (教員)</th>
                    <th className="py-3 px-4">貸出日時</th>
                    <th className="py-3 px-4 text-right">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCheckedOut.map(res => {
                    const holder = teachers.find(t => t.id === res.currentTeacherId);
                    const formattedDate = res.lastCheckedOutAt 
                      ? new Date(res.lastCheckedOutAt).toLocaleString('ja-JP', { 
                          month: '2-digit', 
                          day: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      : '不明';

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${res.category === 'classroom' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                          {res.name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{res.location}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                            {holder ? holder.name : '不明'} ({holder?.department})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{formattedDate}</td>
                        <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickReturn(res)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 hover:scale-102 active:scale-98"
                          >
                            <LogIn className="w-3 h-3" />
                            返却
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 📋 HISTORY LOGS TAB */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <h3 className="font-bold text-slate-800 text-xs">貸出・返却履歴</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
              {history.length} 件
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">使用履歴はありません</p>
              </div>
            ) : (
              history.map(event => {
                const res = resources.find(r => r.id === event.resourceId);
                const teacher = teachers.find(t => t.id === event.teacherId);
                const isQr = event.tagId?.startsWith('QR_');

                return (
                  <div key={event.id} className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-100/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">
                          {res ? res.name : `不明な備品 (${event.resourceId})`}
                        </span>
                        {getActionBadge(event.action)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700">{teacher ? teacher.name : '不明な教員'} ({teacher?.department})</span>
                        <span>•</span>
                        <span>読み取り方式: {isQr ? 'QRコード' : 'NFCタグ'} ({event.tagId})</span>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 font-mono">
                      {new Date(event.timestamp).toLocaleString('ja-JP')}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 教室検出時の選択モーダル */}
      <AnimatePresence>
        {showClassroomChoice && pendingClassroom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-4">
                  <Smartphone className="w-6 h-6 shrink-0 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  特別教室の読み取り
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  特別教室がスキャンされました。操作を選択してください。
                </p>

                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl my-5 text-left">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    検出した教室
                  </div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    {pendingClassroom.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {pendingClassroom.location}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> 操作教員: {
                      teachers.find(t => t.id === (pendingTeacherId || deviceOwnerId))?.name || '【共有スマホ：利用時に教員選択】'
                    }
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClassroomChoice(false);
                      const activeTId = pendingTeacherId || deviceOwnerId;
                      if (activeTId) {
                        executeTap(pendingClassroom, activeTId);
                      } else {
                        // 共有タブレットモード：教員選択に進む
                        setScannedResource(pendingClassroom);
                        setShowTeacherSelector(true);
                      }
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    教室の利用を処理する（利用開始・返却）
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowClassroomChoice(false);
                      if (onSelectResourceForInspection) {
                        onSelectResourceForInspection(pendingClassroom.id);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    教室の安全点検を行う（点検フォームへ）
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowClassroomChoice(false);
                      setPendingClassroom(null);
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
