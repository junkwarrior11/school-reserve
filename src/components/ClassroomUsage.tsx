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
  Info, 
  Zap, 
  Sparkles,
  ArrowRight,
  RotateCcw,
  ListFilter,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  DoorOpen,
  Users
} from 'lucide-react';
import { Teacher, Resource, NFCHistoryEvent } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ClassroomUsageProps {
  teachers: Teacher[];
  resources: Resource[];
  history: NFCHistoryEvent[];
  onRefresh: () => void;
  loggedInTeacherId: string;
  onSelectResourceForInspection?: (resId: string) => void;
}

export default function ClassroomUsage({ 
  teachers, 
  resources, 
  history, 
  onRefresh, 
  loggedInTeacherId,
  onSelectResourceForInspection
}: ClassroomUsageProps) {
  // Device Owner / Personal Identification States
  const [deviceOwnerId, setDeviceOwnerId] = useState<string>(loggedInTeacherId || '');
  const [activeTab, setActiveTab] = useState<'scan' | 'items' | 'history'>('scan');

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

  // Filter for classroom list
  const [classroomFilter, setClassroomFilter] = useState<'all' | 'mine'>('all');

  const activeDeviceOwner = teachers.find(t => t.id === deviceOwnerId);

  // Trigger the simulation scanning process
  const handleSimulateScan = () => {
    if (!selectedResourceId) {
      alert('読み取り対象の特別教室を選択してください。');
      return;
    }

    const targetRes = resources.find(r => r.id === selectedResourceId);
    if (!targetRes) return;

    // Check if the item has the selected tag type
    if (scanType === 'nfc' && !targetRes.nfcTagId) {
      alert('選択した特別教室にはNFCタグが登録されていません。マスタ管理で登録するか、QRコードスキャンをお試しください。');
      return;
    }
    if (scanType === 'qr' && !targetRes.qrCodeId) {
      alert('選択した特別教室にはQRコードが登録されていません。マスタ管理で登録するか、NFCタグスキャンをお試しください。');
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setShowTeacherSelector(false);
    setScannedResource(null);

    // Simulate scanning delay
    setTimeout(() => {
      setIsScanning(false);
      setScannedResource(targetRes);

      // Rule: If device owner is already set (personal identification is active)
      // We can immediately perform the tap action!
      if (deviceOwnerId) {
        executeTap(targetRes, deviceOwnerId);
      } else {
        // If shared tablet, prompt teacher selection
        setShowTeacherSelector(true);
      }
    }, 1200);
  };

  // Perform the actual API Tap call
  const executeTap = async (res: Resource, tId: string) => {
    const activeLabelId = (scanType === 'nfc' ? res.nfcTagId : res.qrCodeId) || '';
    
    try {
      const response = await fetch('/api/nfc/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: activeLabelId,
          teacherId: tId,
        }),
      });

      const data = await response.json();
      const targetTeacher = teachers.find(t => t.id === tId);

      if (data.success) {
        setScanResult({
          success: true,
          message: data.message,
          action: data.action,
          resourceName: res.name,
          resourceId: res.id,
          teacherName: targetTeacher?.name,
          scanTypeUsed: scanType
        });
        setScannedResource(null);
        setShowTeacherSelector(false);
        onRefresh();
      } else {
        setScanResult({
          success: false,
          message: data.message || '特別教室の読み取り処理に失敗しました。',
        });
      }
    } catch (err) {
      setScanResult({
        success: false,
        message: 'サーバーとの通信に失敗しました。',
      });
    }
  };

  // Execute a direct tap from list actions (e.g. Quick check-in/return from card)
  const handleQuickReturn = async (res: Resource) => {
    const activeLabelId = res.nfcTagId || res.qrCodeId || '';
    if (!activeLabelId) {
      alert('この教室にはNFCタグまたはQRコードが紐付けられていません。');
      return;
    }

    if (!res.currentTeacherId) {
      alert('現在利用中の教員情報がありません。');
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
          message: `[クリック返却完了] ${data.message}`,
          action: 'check_in',
          resourceName: res.name,
          resourceId: res.id,
          teacherName: teachers.find(t => t.id === res.currentTeacherId)?.name,
          scanTypeUsed: res.nfcTagId ? 'nfc' : 'qr'
        });
        onRefresh();
      } else {
        alert(data.message || '利用終了の処理に失敗しました。');
      }
    } catch (err) {
      alert('サーバーとの通信に失敗しました。');
    }
  };

  // Filter classrooms (category === 'classroom')
  const classrooms = resources.filter(r => r.category === 'classroom');
  
  // Occupancy State calculations
  const occupiedClassrooms = classrooms.filter(r => r.status === 'checked_out');
  const availableClassrooms = classrooms.filter(r => r.status === 'available');
  const maintenanceClassrooms = classrooms.filter(r => r.status === 'maintenance');

  const filteredOccupiedClassrooms = classroomFilter === 'mine' && deviceOwnerId
    ? occupiedClassrooms.filter(r => r.currentTeacherId === deviceOwnerId)
    : occupiedClassrooms;

  // Filter history events specifically for classrooms
  const classroomIds = classrooms.map(c => c.id);
  const classroomHistory = history.filter(h => classroomIds.includes(h.resourceId));

  const getActionBadge = (action: 'check_out' | 'check_in' | 'baton') => {
    switch (action) {
      case 'check_out':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <LogOut className="w-3 h-3 mr-1" /> 利用開始
          </span>
        );
      case 'check_in':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <LogIn className="w-3 h-3 mr-1" /> 利用終了
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
    <div className="space-y-6" id="classroom-usage-container">
      
      {/* 📱 1. Top Section: Teacher Identity Selection */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-300">
              <Smartphone className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2 flex-wrap">
                特別教室利用・個人識別設定
                <span className="bg-indigo-500/30 text-indigo-200 text-[9px] px-1.5 py-0.5 rounded border border-indigo-400/20">
                  教員用スマートフォン・常時ログイン
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                操作している教員を設定しておくと、教室プレートにスマホをかざすだけで<strong>利用開始・返却・引継が瞬時に判別処理</strong>されます。
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
                <option value="" className="text-slate-800">【共有タブレットとして使用（都度選択）】</option>
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

      {/* 📊 2. Classroom Occupancy Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
            <DoorOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">登録特別教室数</p>
            <p className="text-lg font-black text-slate-800">{classrooms.length} <span className="text-xs font-normal text-slate-500">教室</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">現在使用中</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-rose-600">{occupiedClassrooms.length}</span>
              <span className="text-xs font-normal text-slate-500">教室</span>
              <span className="text-[10px] text-slate-400 ml-auto font-semibold">
                使用率 {classrooms.length > 0 ? Math.round((occupiedClassrooms.length / classrooms.length) * 105) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">現在空き</p>
            <p className="text-lg font-black text-emerald-600">{availableClassrooms.length} <span className="text-xs font-normal text-slate-500">教室</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">要整備・メンテナンス</p>
            <p className="text-lg font-black text-amber-600">{maintenanceClassrooms.length} <span className="text-xs font-normal text-slate-500">教室</span></p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'scan'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Rss className="w-3.5 h-3.5" />
          利用状況・スキャン
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative ${
            activeTab === 'items'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          利用中一覧
          {occupiedClassrooms.length > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {occupiedClassrooms.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          特別教室利用履歴
        </button>
      </div>

      {/* Tab 1: scan/occupancy view */}
      {activeTab === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            
            {/* Simulation scanner controller */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="font-bold text-slate-800 text-xs mb-3">教室プレートのスキャン (NFC/QRシミュレーター)</h3>
              
              <div className="space-y-4">
                {/* Scan Type Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">スキャン方法を選択</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setScanType('nfc')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        scanType === 'nfc' 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Rss className="w-3.5 h-3.5 animate-pulse" />
                      NFCタグ (スマホをかざす)
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanType('qr')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        scanType === 'qr' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QRコード (カメラ読取)
                    </button>
                  </div>
                </div>

                {/* Select Classroom */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    対象の特別教室を選択
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                    value={selectedResourceId}
                    onChange={(e) => {
                      setSelectedResourceId(e.target.value);
                      setScanResult(null);
                      setShowTeacherSelector(false);
                      setScannedResource(null);
                    }}
                  >
                    <option value="">-- 特別教室を選択してください --</option>
                    {classrooms.map(c => {
                      const details = [
                        c.location,
                        c.nfcTagId ? 'NFC登録済' : '',
                        c.qrCodeId ? 'QR登録済' : '',
                        c.status === 'checked_out' ? '【使用中】' : '【空き】'
                      ].filter(Boolean).join(' • ');

                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({details})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Simulate Scan Button */}
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className={`w-full py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    scanType === 'nfc'
                      ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.99]'
                      : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.01] active:scale-[0.99]'
                  } ${isScanning ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isScanning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      スキャン中...
                    </>
                  ) : scanType === 'nfc' ? (
                    <>
                      <Rss className="w-4 h-4" />
                      NFC教室タッチシミュレーションを実行
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      QR教室スキャンシミュレーションを実行
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Scan Feedback Window */}
            <AnimatePresence mode="wait">
              {isScanning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center shadow-inner"
                >
                  <div className="w-16 h-16 bg-white border-2 border-indigo-200 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-4 animate-bounce">
                    {scanType === 'nfc' ? <Rss className="w-8 h-8 animate-pulse" /> : <QrCode className="w-8 h-8" />}
                  </div>
                  <h4 className="font-bold text-indigo-900 text-xs">プレートを読み取り中...</h4>
                  <p className="text-[10px] text-indigo-500 mt-1">電波/光学認識エンジンをシミュレートしています。そのままお待ちください。</p>
                </motion.div>
              )}

              {/* Action: Teacher Selector for Shared Tablet Mode */}
              {showTeacherSelector && scannedResource && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0 h-9 w-9 flex items-center justify-center">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-amber-900 text-xs">教員確認（共有タブレット端末モード）</h4>
                      <p className="text-[10px] text-amber-700 mt-1 leading-normal">
                        <strong>「{scannedResource.name}」</strong>が検知されました。<br />
                        この教室を操作（利用開始、返却、または引き継ぎ）する教員を選択してください。
                      </p>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {teachers.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => executeTap(scannedResource, t.id)}
                            className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg p-2 text-left transition-all cursor-pointer group"
                          >
                            <p className="font-bold text-slate-800 text-[11px] group-hover:text-indigo-700">{t.name} 先生</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{t.department}</p>
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowTeacherSelector(false);
                          setScannedResource(null);
                        }}
                        className="mt-3 text-[10px] font-bold text-slate-500 hover:text-slate-800 underline transition-all"
                      >
                        スキャンをキャンセル
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Scan Results Panel */}
              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`border rounded-xl p-5 shadow-sm ${
                    scanResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-slate-800' 
                      : 'bg-rose-50 border-rose-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      scanResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {scanResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-black text-slate-800 text-xs">
                          {scanResult.success ? '特別教室の読み取りに成功しました' : '読み取りエラー'}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-semibold font-mono uppercase bg-white/70 border border-slate-100 px-1.5 py-0.5 rounded">
                          {scanResult.scanTypeUsed === 'nfc' ? 'NFCタッチ' : 'QRコード'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed font-bold">
                        {scanResult.message}
                      </p>

                      {scanResult.success && scanResult.resourceName && (
                        <div className="mt-4 bg-white/60 rounded-lg p-3 border border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">対象教室 / 担当教員</div>
                            <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                              {scanResult.resourceName}
                            </div>
                            {scanResult.teacherName && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                担当教員: <span className="font-bold text-indigo-700">{scanResult.teacherName} 先生</span>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {onSelectResourceForInspection && scanResult.resourceId && (
                              <button
                                type="button"
                                onClick={() => onSelectResourceForInspection(scanResult.resourceId!)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                教室の安全点検を行う
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Real-time Occupancy list (right panel) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-xs">特別教室一覧 ({classrooms.length}部屋)</h3>
                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                  利用中 {occupiedClassrooms.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {classrooms.map(room => {
                  const isUsed = room.status === 'checked_out';
                  const userTeacher = isUsed ? teachers.find(t => t.id === room.currentTeacherId) : null;
                  const useTime = isUsed && room.lastCheckedOutAt
                    ? new Date(room.lastCheckedOutAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    : null;

                  return (
                    <div 
                      key={room.id}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-all hover:border-slate-300 ${
                        isUsed ? 'border-rose-100 bg-rose-50/20' : 'border-slate-150 bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isUsed ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                          <span className="font-extrabold text-slate-800 text-xs truncate">{room.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">{room.location}</span>
                          {isUsed && userTeacher && (
                            <span className="text-rose-600 font-bold">
                              {userTeacher.name} 先生が {useTime}〜利用中
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isUsed ? (
                          <button
                            type="button"
                            onClick={() => handleQuickReturn(room)}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            title="利用終了を記録"
                          >
                            利用終了
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedResourceId(room.id);
                              setScanResult(null);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            選択
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Occupied Classrooms List */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">現在使用中の特別教室一覧</h3>
              <p className="text-xs text-slate-500 mt-0.5">現在授業等で利用開始処理がなされている教室の一覧です。</p>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                onClick={() => setClassroomFilter('all')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  classroomFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                すべての教室
              </button>
              <button
                disabled={!deviceOwnerId}
                onClick={() => setClassroomFilter('mine')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  !deviceOwnerId ? 'opacity-40 cursor-not-allowed' : ''
                } ${
                  classroomFilter === 'mine' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                自分が利用中
              </button>
            </div>
          </div>

          {filteredOccupiedClassrooms.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                <DoorOpen className="w-6 h-6" />
              </div>
              <p className="text-slate-800 font-bold text-xs">使用中の教室はありません</p>
              <p className="text-slate-400 text-[10px] mt-1">スキャンタブから利用開始を記録、または教室プレートのNFCにタッチしてください。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOccupiedClassrooms.map(room => {
                const userTeacher = teachers.find(t => t.id === room.currentTeacherId);
                const useTime = room.lastCheckedOutAt
                  ? new Date(room.lastCheckedOutAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div 
                    key={room.id}
                    className="border border-rose-100 bg-rose-50/10 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                          使用中
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-300" />
                          {room.location}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-800 text-sm">{room.name}</h4>
                      
                      {userTeacher && (
                        <div className="mt-3 bg-white border border-rose-100/55 p-2.5 rounded-xl flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-full bg-${userTeacher.color || 'indigo'}-500 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5`}>
                            {userTeacher.name.substring(0, 1)}
                          </div>
                          <div className="leading-tight">
                            <p className="font-bold text-slate-700 text-xs">
                              {userTeacher.name} 先生
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              {userTeacher.department}
                            </p>
                            <p className="text-[9px] font-mono text-rose-600 font-semibold mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-rose-500" />
                              {useTime} から利用中
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickReturn(room)}
                        className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg transition-all text-center cursor-pointer"
                      >
                        利用終了 (返却)
                      </button>

                      {onSelectResourceForInspection && (
                        <button
                          type="button"
                          onClick={() => onSelectResourceForInspection(room.id)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-150 text-slate-600 hover:text-indigo-700 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                          title="安全点検を実行する"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">特別教室・NFC/QR利用履歴</h3>
              <p className="text-xs text-slate-500 mt-0.5">特別教室の入退室や引き継ぎイベントのリアルタイムログです。</p>
            </div>
          </div>

          {classroomHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              特別教室の利用履歴はありません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 pl-2">日時</th>
                    <th className="py-2.5">教室名</th>
                    <th className="py-2.5">操作教員</th>
                    <th className="py-2.5">アクション</th>
                    <th className="py-2.5 pr-2">認識ID / タグ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {classroomHistory.map(event => {
                    const roomObj = resources.find(r => r.id === event.resourceId);
                    const teacherObj = teachers.find(t => t.id === event.teacherId);
                    const formattedDate = new Date(event.timestamp).toLocaleString('ja-JP');

                    return (
                      <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pl-2 font-mono text-slate-500 text-[11px]">{formattedDate}</td>
                        <td className="py-2.5 font-bold text-slate-800">{roomObj ? roomObj.name : '削除済教室'}</td>
                        <td className="py-2.5">
                          <span className="font-semibold text-slate-750">
                            {teacherObj ? `${teacherObj.name} 先生` : '不明教員'}
                          </span>
                          <span className="text-[9px] text-slate-400 ml-1 font-medium">
                            ({teacherObj ? teacherObj.department : ''})
                          </span>
                        </td>
                        <td className="py-2.5">{getActionBadge(event.action)}</td>
                        <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-400">{event.tagId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
