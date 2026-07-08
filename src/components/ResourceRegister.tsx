import React, { useState } from 'react';
import { 
  PlusCircle, 
  Smartphone, 
  CheckCircle2, 
  Tag, 
  HelpCircle, 
  RotateCcw, 
  Layers, 
  MapPin, 
  BookOpen, 
  AlertCircle,
  QrCode,
  Rss,
  Printer,
  Sparkles,
  Search,
  Wrench
} from 'lucide-react';
import { Teacher, Resource } from '../types';

interface ResourceRegisterProps {
  teachers: Teacher[];
  resources: Resource[];
  onRefresh: () => void;
}

export default function ResourceRegister({ teachers, resources, onRefresh }: ResourceRegisterProps) {
  // Step State: 'step1_label_selection' | 'step2_details'
  const [step, setStep] = useState<'step1_label_selection' | 'step2_details'>('step1_label_selection');
  
  // Tag types selection
  const [useNfc, setUseNfc] = useState<boolean>(true);
  const [useQr, setUseQr] = useState<boolean>(true);

  // Labels States
  const [nfcTagId, setNfcTagId] = useState<string>('');
  const [qrCodeId, setQrCodeId] = useState<string>('');
  const [tagError, setTagError] = useState<string>('');

  // Form states
  const [resName, setResName] = useState<string>('');
  const [resCategory, setResCategory] = useState<'equipment' | 'classroom'>('equipment');
  const [resSubject, setResSubject] = useState<string>('共通');
  const [resLocation, setResLocation] = useState<string>('');
  
  // Loading & success message states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; nfcId?: string; qrId?: string } | null>(null);

  // Auto generate random labels
  const handleGenerateNfcTag = () => {
    const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
    setNfcTagId(`TAG_EQ_${randomHex}`);
    setTagError('');
  };

  const handleGenerateQrCode = () => {
    const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
    setQrCodeId(`QR_EQ_${randomHex}`);
    setTagError('');
  };

  const handleGenerateBoth = () => {
    const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
    const randSuffix = Math.random().toString(16).substring(2, 6).toUpperCase();
    setNfcTagId(`TAG_EQ_${randomHex}`);
    setQrCodeId(`QR_EQ_${randomHex}_${randSuffix}`);
    setTagError('');
  };

  // Process Labels Selection & proceed to info input
  const handleProceedToDetails = () => {
    if (!useNfc && !useQr) {
      setTagError('NFCタグ、またはQRコードの少なくとも一方を選択してください。');
      return;
    }

    if (useNfc && !nfcTagId.trim()) {
      setTagError('NFCタグを使用する場合は、タグIDを入力するか、「タグ生成」ボタンを押してください。');
      return;
    }

    if (useQr && !qrCodeId.trim()) {
      setTagError('QRコードを使用する場合は、QRコードIDを入力するか、「QRコード生成」ボタンを押してください。');
      return;
    }

    // Check duplicate NFC
    if (useNfc && nfcTagId.trim()) {
      const existingNfc = resources.find(r => r.nfcTagId?.toLowerCase() === nfcTagId.trim().toLowerCase());
      if (existingNfc) {
        setTagError(`このNFCタグは既に「${existingNfc.name}」に登録されています。別のIDを使用してください。`);
        return;
      }
    }

    // Check duplicate QR
    if (useQr && qrCodeId.trim()) {
      const existingQr = resources.find(r => r.qrCodeId?.toLowerCase() === qrCodeId.trim().toLowerCase());
      if (existingQr) {
        setTagError(`このQRコードは既に「${existingQr.name}」に登録されています。別のIDを使用してください。`);
        return;
      }
    }

    setTagError('');
    setStep('step2_details');
  };

  // Submit resource to backend
  const handleRegisterResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resName.trim()) {
      alert('備品名・教室名を入力してください。');
      return;
    }
    if (!resLocation.trim()) {
      alert('保管・設置場所を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Resource> = {
        name: resName.trim(),
        category: resCategory,
        location: resLocation.trim(),
        subject: resSubject,
        nfcTagId: useNfc ? nfcTagId.trim() || undefined : undefined,
        qrCodeId: useQr ? qrCodeId.trim() || undefined : undefined,
        status: 'available'
      };

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Success
        setSuccessInfo({
          name: resName.trim(),
          nfcId: useNfc ? nfcTagId.trim() : undefined,
          qrId: useQr ? qrCodeId.trim() : undefined
        });
        
        // Reset fields
        setResName('');
        setResLocation('');
        setResSubject('共通');
        setNfcTagId('');
        setQrCodeId('');
        
        // Return to step 1
        setStep('step1_label_selection');
        onRefresh();
      } else {
        const errData = await response.json();
        alert(`登録に失敗しました: ${errData.message || 'サーバーエラー'}`);
      }
    } catch (err) {
      console.error('Error registering resource:', err);
      alert('通信エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-955 to-slate-900 text-white p-4 rounded-xl shadow-sm border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
            <QrCode className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              備品登録 (NFC/QR)
            </h2>
          </div>
        </div>
      </div>

      {/* Main Grid: Registration Wizard Left, Recently Registered Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Wizard Interface */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Progress Indicators */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step === 'step1_label_selection' 
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' 
                  : 'bg-indigo-100 text-indigo-700 font-semibold'
              }`}>
                1
              </span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">識別ラベル選択</p>
              </div>
            </div>

            <div className="w-12 h-0.5 bg-slate-200 rounded"></div>

            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step === 'step2_details' 
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' 
                  : 'bg-slate-100 text-slate-400'
              }`}>
                2
              </span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">詳細情報入力</p>
              </div>
            </div>
          </div>

          {/* Success Notification Alert */}
          {successInfo && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-xl flex items-start gap-4 animate-fade-in shadow-xs">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-xs space-y-2 flex-1">
                <p className="font-extrabold text-sm text-slate-800">「{successInfo.name}」の登録完了！</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {successInfo.nfcId && (
                    <div className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center gap-2">
                      <Rss className="w-4 h-4 text-indigo-500" />
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">NFCタグ ID</span>
                        <code className="font-mono text-xs text-indigo-700 font-bold">{successInfo.nfcId}</code>
                      </div>
                    </div>
                  )}
                  {successInfo.qrId && (
                    <div className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-500" />
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">QRコード ID</span>
                        <code className="font-mono text-xs text-emerald-700 font-bold">{successInfo.qrId}</code>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setSuccessInfo(null)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all"
                  >
                    OK / 新しい登録を行う
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: NFC & QR Selector */}
          {step === 'step1_label_selection' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  1. 識別ラベル選択
                </h3>
              </div>

              {/* Tag Selection Config checkboxes */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => { setUseNfc(!useNfc); setTagError(''); }}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                    useNfc 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Rss className={`w-5 h-5 ${useNfc ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <input 
                      type="checkbox" 
                      checked={useNfc} 
                      onChange={() => {}} // handled by button click
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                    />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-slate-800">NFCタグ</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setUseQr(!useQr); setTagError(''); }}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                    useQr 
                      ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-100' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <QrCode className={`w-5 h-5 ${useQr ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <input 
                      type="checkbox" 
                      checked={useQr} 
                      onChange={() => {}} // handled by button click
                      className="rounded border-slate-300 text-emerald-600 focus:ring-indigo-500" 
                    />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-slate-800">QRコード</span>
                  </div>
                </button>
              </div>

              {/* Simulate Sticking Labels Box */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-extrabold text-amber-700">
                      スキャンシミュレータ
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (useNfc && useQr) handleGenerateBoth();
                        else if (useNfc) handleGenerateNfcTag();
                        else if (useQr) handleGenerateQrCode();
                      }}
                      disabled={!useNfc && !useQr}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      新規シール情報を生成
                    </button>
                  </div>
                </div>

                {/* Input Fields Container */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200/80 pt-4">
                  {/* NFC Input */}
                  {useNfc && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <Rss className="w-3.5 h-3.5 text-indigo-500" />
                        NFCタグID
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                          placeholder="例: TAG_EQ_884F"
                          value={nfcTagId}
                          onChange={(e) => {
                            setNfcTagId(e.target.value.toUpperCase());
                            setTagError('');
                          }}
                        />
                        <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs font-bold">N</span>
                      </div>
                    </div>
                  )}

                  {/* QR Input */}
                  {useQr && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                        QRコードID
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
                          placeholder="例: QR_EQ_ABCD"
                          value={qrCodeId}
                          onChange={(e) => {
                            setQrCodeId(e.target.value.toUpperCase());
                            setTagError('');
                          }}
                        />
                        <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs font-bold">Q</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual Stick Label preview */}
                {(nfcTagId || qrCodeId) && (
                  <div className="bg-white border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3 shadow-xs">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5" />
                      ラベルプレビュー
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                      {useQr && qrCodeId && (
                        <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-col items-center space-y-1.5 w-28 text-center shadow-xs">
                          <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded flex items-center justify-center relative overflow-hidden">
                            <QrCode className="w-12 h-12 text-slate-800" />
                            {/* Visual QR Code decorations */}
                            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-b border-r border-slate-800"></div>
                            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-b border-l border-slate-800"></div>
                            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-t border-r border-slate-800"></div>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-slate-500 truncate max-w-full block">{qrCodeId}</span>
                          <span className="bg-emerald-50 text-emerald-700 text-[8px] px-1 py-0.5 rounded font-bold border border-emerald-100">QRコード</span>
                        </div>
                      )}
 
                      {useNfc && nfcTagId && (
                        <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-col items-center space-y-1.5 w-28 text-center shadow-xs">
                          <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-2 border-2 border-dashed border-indigo-400 rounded-full animate-spin-slow"></div>
                            <Rss className="w-8 h-8 text-indigo-500" />
                          </div>
                          <span className="text-[8px] font-mono font-bold text-slate-500 truncate max-w-full block">{nfcTagId}</span>
                          <span className="bg-indigo-50 text-indigo-700 text-[8px] px-1 py-0.5 rounded font-bold border border-indigo-100">NFCシール</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
 
                {tagError && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {tagError}
                  </p>
                )}
              </div>
 
               {/* Proceed Button */}
               <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleProceedToDetails}
                  disabled={(!useNfc || !nfcTagId.trim()) && (!useQr || !qrCodeId.trim())}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  次へ &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Input Details */}
          {step === 'step2_details' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4 animate-fade-in">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                    <PlusCircle className="w-4 h-4 text-indigo-600" />
                    2. 詳細情報入力
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('step1_label_selection')}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  戻る
                </button>
              </div>

              {/* Active Labels Readonly Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {useNfc && nfcTagId && (
                  <div className="bg-indigo-50/50 border border-indigo-150 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-600 flex items-center gap-1">
                      <Rss className="w-3.5 h-3.5" /> NFCタグ
                    </span>
                    <span className="font-mono bg-white border border-indigo-200 px-2 py-0.5 rounded font-bold text-indigo-800">
                      {nfcTagId}
                    </span>
                  </div>
                )}
                {useQr && qrCodeId && (
                  <div className="bg-emerald-50/50 border border-emerald-150 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5" /> QRコード
                    </span>
                    <span className="font-mono bg-white border border-emerald-200 px-2 py-0.5 rounded font-bold text-emerald-800">
                      {qrCodeId}
                    </span>
                  </div>
                )}
              </div>

              {/* Form Input fields */}
              <form onSubmit={handleRegisterResource} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    備品名・特別教室名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 font-medium"
                    placeholder="例: デジタル天体望遠鏡 (Vixen Star-1)"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      カテゴリ <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={resCategory}
                      onChange={(e) => setResCategory(e.target.value as 'equipment' | 'classroom')}
                    >
                      <option value="equipment">貸出共通備品 (機器・教材等)</option>
                      <option value="classroom">特別教室・施設・屋外エリア</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      対象・関連教科 <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={resSubject}
                      onChange={(e) => setResSubject(e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    保管・設置場所 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder="例: 地学準備室B棚奥"
                    value={resLocation}
                    onChange={(e) => setResLocation(e.target.value)}
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep('step1_label_selection')}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmitting ? '登録処理中...' : '備品をシステムに登録する'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Right Side: Quick Reference / Recent registry & tag pasting tips */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Recently registered resources with NFC Tags / QRs */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-500" />
              登録済み備品
            </h4>

            {resources.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                登録されている備品はありません。
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
                {resources.slice().reverse().map((res) => (
                  <div key={res.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">{res.name}</p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        <span className={`px-1.5 py-0.5 rounded-sm ${
                          res.category === 'classroom' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {res.category === 'classroom' ? '特別教室' : '備品'}
                        </span>
                        <span className="font-medium text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded-sm">
                          {res.subject || '共通'}
                        </span>
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-350" />
                          {res.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {res.nfcTagId && (
                        <span className="font-mono text-[9px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1" title={`NFC: ${res.nfcTagId}`}>
                          <Rss className="w-2.5 h-2.5" />
                          {res.nfcTagId.substring(0, 10)}
                        </span>
                      )}
                      {res.qrCodeId && (
                        <span className="font-mono text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1" title={`QR: ${res.qrCodeId}`}>
                          <QrCode className="w-2.5 h-2.5" />
                          {res.qrCodeId.substring(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
