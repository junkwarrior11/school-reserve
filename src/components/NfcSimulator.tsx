import React, { useState } from 'react';
import { 
  Smartphone, 
  Rss, 
  ArrowLeftRight, 
  LogOut, 
  LogIn, 
  History, 
  User, 
  Cpu, 
  Tag, 
  CheckCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  QrCode,
  Scan,
  Sparkles,
  Zap,
  Printer
} from 'lucide-react';
import { Teacher, Resource, NFCHistoryEvent } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface NfcSimulatorProps {
  teachers: Teacher[];
  resources: Resource[];
  history: NFCHistoryEvent[];
  onRefresh: () => void;
  onSelectResourceForInspection?: (resId: string) => void;
}

export default function NfcSimulator({ teachers, resources, history, onRefresh, onSelectResourceForInspection }: NfcSimulatorProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  
  // Custom manual tag/qr input
  const [useCustomTag, setUseCustomTag] = useState<boolean>(false);
  const [customTagId, setCustomTagId] = useState<string>('');
  const [customLabelType, setCustomLabelType] = useState<'nfc' | 'qr'>('nfc');

  // Scanner Simulator States
  const [scanType, setScanType] = useState<'nfc' | 'qr'>('nfc'); // NFC tap vs QR camera scan
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    action?: 'check_out' | 'check_in' | 'baton';
    resourceId?: string;
    scanTypeUsed?: 'nfc' | 'qr';
  } | null>(null);

  // Quick register states for unregistered scanned tags/qrs
  const [quickRegTagId, setQuickRegTagId] = useState<string>('');
  const [quickRegQrId, setQuickRegQrId] = useState<string>('');
  const [quickRegType, setQuickRegType] = useState<'nfc' | 'qr'>('nfc');
  const [showQuickReg, setShowQuickReg] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>('');
  const [quickCategory, setQuickCategory] = useState<'equipment' | 'classroom'>('equipment');
  const [quickSubject, setQuickSubject] = useState<string>('共通');
  const [quickLocation, setQuickLocation] = useState<string>('');
  const [isQuickRegistering, setIsQuickRegistering] = useState<boolean>(false);
  const [quickRegError, setQuickRegError] = useState<string>('');

  const activeTeacher = teachers.find(t => t.id === selectedTeacherId);
  const activeResource = resources.find(r => r.id === selectedResourceId);

  // Execute scan/tap simulation
  const handleSimulateScan = async () => {
    if (!selectedTeacherId) {
      alert('操作する教員を選択してください。');
      return;
    }

    let idToScan = '';
    if (useCustomTag) {
      if (!customTagId.trim()) {
        alert(customLabelType === 'nfc' ? 'カスタムNFCタグIDを入力してください。' : 'カスタムQRコードIDを入力してください。');
        return;
      }
      idToScan = customTagId.trim();
    } else {
      if (!selectedResourceId) {
        alert('読み取り対象の備品・特別教室を選択してください。');
        return;
      }
      const res = resources.find(r => r.id === selectedResourceId);
      
      if (scanType === 'nfc') {
        if (!res?.nfcTagId) {
          alert('選択したリソースにはNFCタグが登録されていません。マスタ登録するか、QRコードスキャンをお試しください。');
          return;
        }
        idToScan = res.nfcTagId;
      } else {
        if (!res?.qrCodeId) {
          alert('選択したリソースにはQRコードが登録されていません。マスタ登録するか、NFCタップをお試しください。');
          return;
        }
        idToScan = res.qrCodeId;
      }
    }

    setIsScanning(true);
    setScanResult(null);
    setShowQuickReg(false);
    setQuickRegError('');

    // Simulate scanning/sensing duration (tactile, visual delay)
    setTimeout(async () => {
      try {
        // Look up registered resources by either NFC or QR code
        const registeredRes = resources.find(r => r.nfcTagId === idToScan || r.qrCodeId === idToScan);
        const registeredTeacher = teachers.find(t => t.nfcTagId === idToScan);

        // If unregistered label
        if (!registeredRes && !registeredTeacher) {
          setIsScanning(false);
          const scannedLabelTypeName = useCustomTag 
            ? (customLabelType === 'nfc' ? 'NFCタグ' : 'QRコード') 
            : (scanType === 'nfc' ? 'NFCタグ' : 'QRコード');
            
          setScanResult({
            success: false,
            message: `未登録の${scannedLabelTypeName} 「${idToScan}」 を検出しました。このラベルを使って、新しく備品または特別教室を簡易登録できます。`,
          });
          
          if (useCustomTag) {
            if (customLabelType === 'nfc') {
              setQuickRegTagId(idToScan);
              setQuickRegQrId('');
              setQuickRegType('nfc');
            } else {
              setQuickRegQrId(idToScan);
              setQuickRegTagId('');
              setQuickRegType('qr');
            }
          } else {
            if (scanType === 'nfc') {
              setQuickRegTagId(idToScan);
              setQuickRegQrId('');
              setQuickRegType('nfc');
            } else {
              setQuickRegQrId(idToScan);
              setQuickRegTagId('');
              setQuickRegType('qr');
            }
          }
          
          setShowQuickReg(true);
          return;
        }

        const response = await fetch('/api/nfc/tap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagId: idToScan,
            teacherId: selectedTeacherId,
          }),
        });

        const data = await response.json();
        
        setIsScanning(false);
        if (data.success) {
          setScanResult({
            success: true,
            message: data.message,
            action: data.action,
            resourceId: registeredRes?.id,
            scanTypeUsed: useCustomTag ? customLabelType : scanType
          });
          onRefresh();
        } else {
          setScanResult({
            success: false,
            message: data.message || '読み取り処理に失敗しました。',
          });
        }
      } catch (err) {
        setIsScanning(false);
        setScanResult({
          success: false,
          message: 'サーバーとの通信に失敗しました。',
        });
      }
    }, 1400);
  };

  // Quick Register Unregistered Item
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      setQuickRegError('備品名・特別教室名を入力してください。');
      return;
    }
    if (!quickLocation.trim()) {
      setQuickRegError('保管・設置場所を入力してください。');
      return;
    }
    if (!selectedTeacherId) {
      setQuickRegError('登録する担当教員を選択してください。');
      return;
    }

    setIsQuickRegistering(true);
    setQuickRegError('');

    try {
      const activeLabelId = quickRegType === 'nfc' ? quickRegTagId : quickRegQrId;
      
      const payload: Partial<Resource> = {
        name: quickName.trim(),
        category: quickCategory,
        location: quickLocation.trim(),
        subject: quickSubject,
        nfcTagId: quickRegType === 'nfc' ? activeLabelId : undefined,
        qrCodeId: quickRegType === 'qr' ? activeLabelId : undefined,
        status: 'available',
      };

      const resResponse = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await resResponse.json();

      if (resResponse.ok && resData.success) {
        // Automatically simulate direct checkout scan once registered
        const tapResponse = await fetch('/api/nfc/tap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagId: activeLabelId,
            teacherId: selectedTeacherId,
          }),
        });

        const tapData = await tapResponse.json();

        setIsQuickRegistering(false);
        setShowQuickReg(false);
        setQuickName('');
        setQuickLocation('');
        onRefresh();

        if (tapData.success) {
          setScanResult({
            success: true,
            message: `🎉 簡易マスタ登録完了！\n${quickCategory === 'classroom' ? '特別教室' : '備品'}「${payload.name}」を新規登録し、そのまま貸出利用を開始しました。\n${tapData.message}`,
            action: tapData.action,
            resourceId: resData.resource.id,
            scanTypeUsed: quickRegType
          });
        } else {
          setScanResult({
            success: true,
            message: `🎉 簡易マスタ登録が完了しました。${quickRegType === 'nfc' ? 'NFC' : 'QRコード'}が紐付けられました。`,
            resourceId: resData.resource.id,
            scanTypeUsed: quickRegType
          });
        }
      } else {
        setIsQuickRegistering(false);
        setQuickRegError(resData.message || '簡易登録に失敗しました。');
      }
    } catch (err) {
      setIsQuickRegistering(false);
      setQuickRegError('通信エラーにより登録に失敗しました。');
    }
  };

  const getActionBadge = (action: 'check_out' | 'check_in' | 'baton') => {
    switch (action) {
      case 'check_out':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <LogOut className="w-3 h-3 mr-1 animate-pulse" /> 貸出
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="nfc-simulator-container">
      {/* Simulation Controls Left */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                <Scan className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">NFC / QR スキャン</h3>
              </div>
            </div>
          </div>
 
           <div className="space-y-4">
            {/* 1. Select Teacher */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                操作する教員
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                value={selectedTeacherId}
                onChange={(e) => {
                  setSelectedTeacherId(e.target.value);
                  setScanResult(null);
                }}
              >
                <option value="">-- 教員選択 --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.department}) {t.nfcTagId ? '🏷️' : '⚠️'}
                  </option>
                ))}
              </select>
            </div>
 
            {/* Target Select Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${!useCustomTag ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'}`}
                onClick={() => {
                  setUseCustomTag(false);
                  setScanResult(null);
                }}
              >
                備品・教室を選択
              </button>
              <button
                type="button"
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${useCustomTag ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'}`}
                onClick={() => {
                  setUseCustomTag(true);
                  setScanResult(null);
                }}
              >
                手動ID入力
              </button>
            </div>

            {/* Simulated Label Selection */}
            {!useCustomTag ? (
              <div className="space-y-4">
                {/* Hardware Type Selector */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 rounded-lg border border-slate-150">
                  <button
                    type="button"
                    onClick={() => { setScanType('nfc'); setScanResult(null); }}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                      scanType === 'nfc' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <Rss className="w-3.5 h-3.5" />
                    NFC
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScanType('qr'); setScanResult(null); }}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                      scanType === 'qr' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QRコード
                  </button>
                </div>

                {/* Target dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    対象の備品・教室
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    value={selectedResourceId}
                    onChange={(e) => {
                      setSelectedResourceId(e.target.value);
                      setScanResult(null);
                    }}
                  >
                    <option value="">-- 選択 --</option>
                    {resources.map((r) => {
                      const holder = r.currentTeacherId ? teachers.find(t => t.id === r.currentTeacherId) : null;
                      const hasActiveLabel = scanType === 'nfc' ? r.nfcTagId : r.qrCodeId;
                      const labelStatusText = scanType === 'nfc' 
                        ? (r.nfcTagId ? `(NFC: ${r.nfcTagId})` : '(NFC未登録)')
                        : (r.qrCodeId ? `(QR: ${r.qrCodeId})` : '(QR未登録)');
                      
                      return (
                        <option key={r.id} value={r.id} className={!hasActiveLabel ? 'text-slate-400' : ''}>
                          {r.name} [{r.category === 'classroom' ? '特別教室' : '備品'}] 
                          ({r.status === 'available' ? ' 利用可能' : ` 貸出中: ${holder ? holder.name : '不明'}`})
                          {` ${labelStatusText}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Error/Notice prompt when the selected item doesn't have the chosen label */}
                {activeResource && scanType === 'nfc' && !activeResource.nfcTagId && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-start gap-2">
                    <HelpCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <p className="font-bold">この備品にはNFCタグが登録されていません</p>
                      <p className="text-rose-600 mt-0.5">「QRコード読取」に切り替えるか、「備品登録」タブでNFCタグシールを貼り付けてください。</p>
                    </div>
                  </div>
                )}

                {activeResource && scanType === 'qr' && !activeResource.qrCodeId && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2">
                    <QrCode className="w-4.5 h-4.5 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-bold">この備品にはQRコードラベルが登録されていません</p>
                      <p className="text-amber-600 mt-0.5">「NFCかざし読取」に切り替えるか、以下の簡易割当ボタンで即座にQRコードを印刷・貼り付けできます。</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Custom Hand-entered code
              <div className="space-y-4">
                {/* Input label style switcher */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 rounded-lg border border-slate-150">
                  <button
                    type="button"
                    onClick={() => { setCustomLabelType('nfc'); setScanResult(null); }}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                      customLabelType === 'nfc' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <Rss className="w-3.5 h-3.5" />
                    NFCタグID
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCustomLabelType('qr'); setScanResult(null); }}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                      customLabelType === 'qr' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QRコードID
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    スキャンするID
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder={customLabelType === 'nfc' ? '例: TAG_NEW_1234' : '例: QR_NEW_9988'}
                    value={customTagId}
                    onChange={(e) => {
                      setCustomTagId(e.target.value.toUpperCase());
                      setScanResult(null);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Big Tap/Scan Simulated Viewport Area */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 relative overflow-hidden">
            
            {/* Visual Indicator Background Scanners */}
            <div className="relative mb-5">
              
              {/* SCANNING ACTIVE EFFECT FOR NFC */}
              {isScanning && (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc') && (
                <>
                  <div className="absolute inset-0 bg-indigo-500/15 rounded-full animate-ping pointer-events-none scale-150"></div>
                  <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping pointer-events-none scale-125"></div>
                </>
              )}

              {/* SCANNING ACTIVE EFFECT FOR QR CODE CAMERA */}
              {isScanning && (useCustomTag ? customLabelType === 'qr' : scanType === 'qr') && (
                <div className="absolute -inset-10 border border-emerald-500/30 bg-emerald-500/5 rounded-lg flex items-center justify-center animate-pulse pointer-events-none">
                  {/* Camera Corner brackets */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500"></div>
                  {/* Scanner laser red line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-xs shadow-red-500/50 animate-bounce-y"></div>
                </div>
              )}

              {/* Scan Button Action trigger */}
              <button
                type="button"
                disabled={isScanning || !selectedTeacherId || (!useCustomTag && !selectedResourceId)}
                onClick={handleSimulateScan}
                className={`relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                  isScanning 
                    ? (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc') 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 rounded-full scale-95' 
                      : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-95'
                    : !selectedTeacherId || (!useCustomTag && !selectedResourceId)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc')
                        ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-md hover:shadow-lg shadow-indigo-100 cursor-pointer active:scale-95'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg shadow-emerald-100 cursor-pointer active:scale-95'
                }`}
              >
                {isScanning ? (
                  (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc') ? (
                    <Rss className="w-9 h-9 animate-bounce" />
                  ) : (
                    <Scan className="w-9 h-9 animate-spin" />
                  )
                ) : (
                  (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc') ? (
                    <Rss className="w-9 h-9" />
                  ) : (
                    <QrCode className="w-9 h-9" />
                  )
                )}
              </button>
            </div>
            
            <p className="text-xs font-extrabold text-slate-700">
              {isScanning 
                ? (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc')
                  ? '📱 NFC検知中...'
                  : '📷 QRスキャン中...'
                : (useCustomTag ? customLabelType === 'nfc' : scanType === 'nfc')
                  ? 'NFCタップ'
                  : 'QRスキャン'
              }
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {activeTeacher ? `${activeTeacher.name} 先生として開始` : '教員を選択してください'}
            </p>
          </div>

          {/* Result Alert panel */}
          <AnimatePresence>
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className={`mt-5 p-4 rounded-xl border flex items-start gap-3 ${
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
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs">
                      {scanResult.success 
                        ? `${scanResult.scanTypeUsed === 'nfc' ? 'NFCタッチ' : 'QRコードスキャン'} 完了` 
                        : '読取エラー / 未登録'}
                    </span>
                    {scanResult.action && getActionBadge(scanResult.action)}
                  </div>
                  <p className="text-xs mt-1 text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {scanResult.message}
                  </p>

                  {/* Shortcut to inspection if it is a resource/classroom */}
                  {scanResult.success && scanResult.resourceId && onSelectResourceForInspection && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onSelectResourceForInspection(scanResult.resourceId!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer active:scale-95 shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        安全点検へ &rarr;
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Register Unregistered Tag/QR Form */}
          <AnimatePresence>
            {showQuickReg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-150 rounded-2xl p-5 space-y-4 overflow-hidden shadow-xs"
              >
                <div className="flex items-center gap-2 border-b border-indigo-100/60 pb-2.5">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-600" />
                  <h4 className="font-extrabold text-slate-800 text-xs">
                    未登録ラベルの簡易マスタ登録
                  </h4>
                </div>
                
                <form onSubmit={handleQuickRegister} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        ラベル形式と読取ID
                      </label>
                      <div className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-700 font-bold flex items-center gap-1">
                        {quickRegType === 'nfc' ? <Rss className="w-3 h-3 text-indigo-500" /> : <QrCode className="w-3 h-3 text-emerald-500" />}
                        {quickRegType === 'nfc' ? quickRegTagId : quickRegQrId}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">カテゴリ</label>
                      <select
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={quickCategory}
                        onChange={(e) => setQuickCategory(e.target.value as 'equipment' | 'classroom')}
                      >
                        <option value="equipment">共通貸出備品 (機器・教材)</option>
                        <option value="classroom">特別教室・施設エリア</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">対象教科</label>
                      <select
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
                        value={quickSubject}
                        onChange={(e) => setQuickSubject(e.target.value)}
                      >
                        <option value="共通">共通 (全般)</option>
                        <option value="理科">理科</option>
                        <option value="体育">保健体育 / 体育</option>
                        <option value="情報技術">情報 / 技術</option>
                        <option value="図工・美術">図工・美術</option>
                        <option value="家庭科">家庭科</option>
                        <option value="音楽">音楽</option>
                        <option value="国語">国語</option>
                        <option value="数学・算数">数学・算数</option>
                        <option value="英語・外国語">英語・外国語</option>
                        <option value="社会">社会</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">備品名・特別教室名</label>
                    <input 
                      type="text"
                      required
                      placeholder="例: レゴマインドストーム EV3ロボット" 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">常時保管・設置場所</label>
                    <input 
                      type="text"
                      required
                      placeholder="例: PC教室裏 備品棚5段目" 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={quickLocation}
                      onChange={(e) => setQuickLocation(e.target.value)}
                    />
                  </div>

                  {quickRegError && (
                    <p className="text-[11px] text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg font-medium">{quickRegError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50">
                    <button
                      type="button"
                      onClick={() => { setShowQuickReg(false); setScanResult(null); }}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    >
                      閉じる
                    </button>
                    <button
                      type="submit"
                      disabled={isQuickRegistering}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {isQuickRegistering ? '簡易登録中...' : '登録して即座に貸出開始'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* History Log Right */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col h-[520px] lg:h-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-xs">履歴ログ</h3>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-mono font-bold">
            {history.length} 件
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <Clock className="w-6 h-6 mb-2 stroke-[1.5]" />
              <p className="text-xs">履歴はありません</p>
            </div>
          ) : (
            history.map((event) => {
              const res = resources.find(r => r.id === event.resourceId);
              const teacher = teachers.find(t => t.id === event.teacherId);
              const isQrLog = event.tagId.startsWith('QR_');
              
              return (
                <div 
                  key={event.id} 
                  className="bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-xl p-3 text-xs transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800 text-xs">
                      {res ? res.name : `不明な備品 (${event.resourceId})`}
                    </span>
                    {getActionBadge(event.action)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700">
                        {teacher ? teacher.name : '不明な教員'}
                      </span>
                      <span>({teacher?.department})</span>
                    </div>
                    <span>
                      {new Date(event.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1 font-semibold text-slate-500">
                      {isQrLog ? (
                        <>
                          <QrCode className="w-3 h-3 text-emerald-500" />
                          QR Code: <span className="bg-emerald-50 text-emerald-700 px-1 rounded">{event.tagId}</span>
                        </>
                      ) : (
                        <>
                          <Rss className="w-3 h-3 text-indigo-500" />
                          NFC Tag: <span className="bg-indigo-50 text-indigo-700 px-1 rounded">{event.tagId}</span>
                        </>
                      )}
                    </span>
                    <span>
                      {new Date(event.timestamp).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
