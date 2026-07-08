import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Smartphone, 
  Calendar, 
  ShieldAlert, 
  Settings, 
  RefreshCw,
  LogOut,
  Database,
  User,
  Activity,
  Rss,
  Tag,
  PackageOpen,
  Menu,
  FileSpreadsheet,
  FolderOpen,
  ExternalLink,
  DoorOpen
} from 'lucide-react';
import { 
  Teacher, 
  Resource, 
  Reservation, 
  InspectionLog, 
  SOSRequest, 
  NFCHistoryEvent 
} from './types';

// Importing Tab Components
import Dashboard from './components/Dashboard';
import NfcSimulator from './components/NfcSimulator';
import ReservationCalendar from './components/ReservationCalendar';
import SafetyInspection from './components/SafetyInspection';
import ResourceManager from './components/ResourceManager';
import ResourceRegister from './components/ResourceRegister';
import EquipmentUsage from './components/EquipmentUsage';
import ClassroomUsage from './components/ClassroomUsage';

export default function App() {
  // View/Viewport Mode: 'desktop' (PC view) or 'mobile' (smartphone simulator view)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Backend Data State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inspectionLogs, setInspectionLogs] = useState<InspectionLog[]>([]);
  const [sosRequests, setSosRequests] = useState<SOSRequest[]>([]);
  const [nfcHistory, setNfcHistory] = useState<NFCHistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sheetsConfig, setSheetsConfig] = useState<{ hasToken: boolean; spreadsheetId: string | null; spreadsheetUrl: string | null }>({
    hasToken: false,
    spreadsheetId: null,
    spreadsheetUrl: null
  });

  // Active Simulated Logged-In Teacher State
  const [loggedInTeacherId, setLoggedInTeacherId] = useState<string>('');

  // Pre-selected resource for safety inspection (routed from NFC scanner)
  const [preselectedResourceId, setPreselectedResourceId] = useState<string>('');

  // Fetch data from backend
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/data');
      if (response.ok) {
        const data = await response.json();
        setTeachers(data.teachers || []);
        setResources(data.resources || []);
        setReservations(data.reservations || []);
        setInspectionLogs(data.inspectionLogs || []);
        setSosRequests(data.sosRequests || []);
        setNfcHistory(data.nfcHistory || []);

        // Set default logged in teacher if not already set
        if (data.teachers && data.teachers.length > 0 && !loggedInTeacherId) {
          setLoggedInTeacherId(data.teachers[0].id);
        }
      }

      // Fetch Google Sheets config too
      const sheetsResponse = await fetch('/api/sheets/config');
      if (sheetsResponse.ok) {
        const sheetsData = await sheetsResponse.json();
        setSheetsConfig(sheetsData);
      }
    } catch (err) {
      console.error('Error fetching data from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeTeacher = teachers.find(t => t.id === loggedInTeacherId);

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans flex flex-col text-slate-900 border border-slate-200">
      {/* Top Navigation Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">School-Trace</h1>
          <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-600 rounded uppercase tracking-wider ml-2">
            学校NFC管理システム
          </span>
        </div>

        {/* Dynamic Teacher Switcher / User Profile */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle (PC / Mobile) */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setViewMode('desktop');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'desktop'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-250/30'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>🖥️</span>
              <span className="hidden sm:inline">PC</span>
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'mobile'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-indigo-600'
              }`}
            >
              <span>📱</span>
              <span className="hidden sm:inline">スマホ</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 hover:bg-slate-100 transition-all">
            <User className="w-4 h-4 text-slate-400" />
            <select
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              value={loggedInTeacherId}
              onChange={(e) => setLoggedInTeacherId(e.target.value)}
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.department})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex flex-col text-right">
            <p className="text-sm font-medium text-slate-800">
              {activeTeacher ? activeTeacher.name : '教員を選択'}
            </p>
            <p className="text-xs text-slate-500">
              {activeTeacher ? activeTeacher.department : '所属部署'}
            </p>
          </div>

          <div className={`w-10 h-10 rounded-full border border-slate-350 flex items-center justify-center text-white font-bold bg-indigo-600`}>
            {activeTeacher ? activeTeacher.name.substring(0, 1) : '?'}
          </div>

          <button 
            onClick={fetchData} 
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="データを再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      {viewMode === 'mobile' ? (
        <div className="flex-1 bg-slate-800/90 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          {/* Simulated Outer Smartphone Frame */}
          <div className="relative mx-auto w-[380px] h-[780px] bg-slate-950 rounded-[50px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border-[14px] border-slate-900 flex flex-col overflow-hidden ring-1 ring-white/15">
            {/* Speaker & Notch */}
            <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
              <div className="w-32 h-5 bg-slate-900 rounded-b-2xl flex items-center justify-center">
                <div className="w-12 h-1.5 bg-slate-800 rounded-full mb-1"></div>
              </div>
            </div>

            {/* Simulated Phone Status Bar */}
            <div className="h-10 bg-white text-slate-700 px-6 pt-3 flex justify-between items-center text-[10px] font-bold tracking-tight select-none shrink-0 border-b border-slate-100 z-40">
              <span>12:30</span>
              <span className="text-[10px] font-normal text-slate-400">School-Trace Mobile</span>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span>📶</span>
                <span className="text-[10px]">🔋 100%</span>
              </div>
            </div>

            {/* Mobile View Container inside Phone Screen */}
            <div className="flex-1 bg-slate-50 overflow-y-auto flex flex-col relative pb-16">
              <div className="flex-1 p-3 overflow-y-auto">
                {activeTab === 'dashboard' && (
                  <Dashboard 
                    teachers={teachers}
                    resources={resources}
                    reservations={reservations}
                    inspectionLogs={inspectionLogs}
                    sosRequests={sosRequests}
                    history={nfcHistory}
                    onNavigate={(tab) => setActiveTab(tab)}
                    onRefresh={fetchData}
                    sheetsConfig={sheetsConfig}
                  />
                )}

                {activeTab === 'register' && (
                  <ResourceRegister 
                    teachers={teachers}
                    resources={resources}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'nfc' && (
                  <NfcSimulator 
                    teachers={teachers}
                    resources={resources}
                    history={nfcHistory}
                    onRefresh={fetchData}
                    onSelectResourceForInspection={(resId) => {
                      setPreselectedResourceId(resId);
                      setActiveTab('safety');
                    }}
                  />
                )}

                {activeTab === 'usage' && (
                  <EquipmentUsage 
                    teachers={teachers}
                    resources={resources}
                    history={nfcHistory}
                    onRefresh={fetchData}
                    loggedInTeacherId={loggedInTeacherId}
                  />
                )}

                {activeTab === 'reservations' && (
                  <ReservationCalendar 
                    teachers={teachers}
                    resources={resources}
                    reservations={reservations}
                    onRefresh={fetchData}
                  />
                )}

                {activeTab === 'safety' && (
                  <SafetyInspection 
                    teachers={teachers}
                    resources={resources}
                    inspectionLogs={inspectionLogs}
                    onRefresh={fetchData}
                    preselectedResourceId={preselectedResourceId}
                    clearPreselectedResource={() => setPreselectedResourceId('')}
                  />
                )}

                {activeTab === 'management' && (
                  <ResourceManager 
                    teachers={teachers}
                    resources={resources}
                    onRefresh={fetchData}
                  />
                )}
              </div>
              
              {/* Simulator Bottom Nav */}
              <div className="absolute bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 shadow-lg">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    activeTab === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5 font-medium">ホーム</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('usage');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    activeTab === 'usage' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <PackageOpen className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5 font-medium">貸出・返却</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('nfc');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    activeTab === 'nfc' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5 font-medium">NFCかざす</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('safety');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    activeTab === 'safety' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5 font-medium">安全点検</span>
                </button>

                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    isMobileMenuOpen ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5 font-medium">その他</span>
                </button>
              </div>

              {/* Simulator Mobile Drawer */}
              {isMobileMenuOpen && (
                <div className="absolute inset-0 bg-slate-900/60 z-50 flex flex-col justify-end" onClick={() => setIsMobileMenuOpen(false)}>
                  <div 
                    className="bg-white rounded-t-3xl max-h-[80%] p-5 flex flex-col gap-4 shadow-2xl relative border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-10 h-1 bg-slate-350 rounded-full mx-auto mb-1"></div>
                    
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-800 text-xs">その他の機能</h3>
                      <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-600 font-bold"
                      >
                        閉じる
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 py-1">
                      <button
                        onClick={() => {
                          setActiveTab('register');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                          activeTab === 'register' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <Tag className="w-5 h-5 text-indigo-500" />
                        <span className="text-[10px]">備品登録 (NFC)</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('classroom_usage');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                          activeTab === 'classroom_usage' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <DoorOpen className="w-5 h-5 text-indigo-500" />
                        <span className="text-[10px]">特別教室利用</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('reservations');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                          activeTab === 'reservations' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <span className="text-[10px]">予約表</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('management');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                          activeTab === 'management' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <Settings className="w-5 h-5 text-indigo-500" />
                        <span className="text-[10px]">マスタ管理</span>
                      </button>

                      <button
                        onClick={() => {
                          setViewMode('desktop');
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 text-slate-600"
                      >
                        <Smartphone className="w-5 h-5 text-emerald-500" />
                        <span className="text-[10px]">PCビュー切替</span>
                      </button>
                    </div>

                    {/* Google Workspace Quick Links in Mobile Menu */}
                    <div className="border-t border-slate-100 pt-3 mt-1 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Google Workspace 連携</p>
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={sheetsConfig.spreadsheetUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!sheetsConfig.spreadsheetUrl) {
                              e.preventDefault();
                              alert('現在スプレッドシートが作成されていません。安全点検を一度実行すると自動的に作成・連携されます。');
                            }
                          }}
                          className={`flex items-center justify-center p-2 rounded-xl border gap-1.5 transition-all cursor-pointer text-[10px] font-bold ${
                            sheetsConfig.spreadsheetUrl 
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-850' 
                              : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>スプレッドシート</span>
                        </a>

                        <a
                          href="https://drive.google.com/drive/search?q=School-Trace"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center p-2 border border-blue-200 bg-blue-50 text-blue-850 rounded-xl gap-1.5 transition-all cursor-pointer text-[10px] font-bold"
                        >
                          <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Googleドライブ</span>
                        </a>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                          {activeTeacher ? activeTeacher.name.substring(0, 1) : '?'}
                        </div>
                        <div className="leading-tight">
                          <p className="font-bold text-slate-800 text-[11px]">{activeTeacher ? activeTeacher.name : '教員'}</p>
                          <p className="text-[9px] text-slate-500">{activeTeacher ? activeTeacher.department : ''}</p>
                        </div>
                      </div>
                      <select
                        className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 p-1 rounded-md focus:outline-none cursor-pointer max-w-[120px]"
                        value={loggedInTeacherId}
                        onChange={(e) => setLoggedInTeacherId(e.target.value)}
                      >
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom bar indicator line */}
            <div className="absolute bottom-1 inset-x-0 h-1 flex justify-center z-50 pointer-events-none">
              <div className="w-24 h-1 bg-slate-400 rounded-full"></div>
            </div>
          </div>
        </div>
      ) : (
        /* Normal Desktop / Responsive Layout */
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left Sidebar Navigation - hidden on real mobile devices */}
          <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex flex-col p-4 shrink-0 justify-between">
            <nav className="space-y-1 flex-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'dashboard' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Home className="w-5 h-5 shrink-0" />
                <span>ダッシュボード</span>
              </button>

              <button
                onClick={() => setActiveTab('register')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'register' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Tag className="w-5 h-5 shrink-0" />
                <span>備品登録 (NFC貼付)</span>
              </button>

              <button
                onClick={() => setActiveTab('nfc')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'nfc' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-5 h-5 shrink-0" />
                <span>NFCシミュレーター</span>
              </button>

              <button
                onClick={() => setActiveTab('usage')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'usage' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <PackageOpen className="w-5 h-5 shrink-0" />
                <span>備品使用 (貸出・返却)</span>
              </button>

              <button
                onClick={() => setActiveTab('classroom_usage')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'classroom_usage' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <DoorOpen className="w-5 h-5 shrink-0" />
                <span>特別教室利用 (利用・返却)</span>
              </button>

              <button
                onClick={() => setActiveTab('reservations')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'reservations' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Calendar className="w-5 h-5 shrink-0" />
                <span>予約スケジュール</span>
              </button>

              <button
                onClick={() => setActiveTab('safety')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'safety' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>安全点検</span>
              </button>

              <button
                onClick={() => setActiveTab('management')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeTab === 'management' 
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5 shrink-0" />
                <span>マスタ管理</span>
              </button>
            </nav>

            {/* Google Workspace Sidebar Quick Links */}
            <div className="mt-auto mb-4 p-3.5 bg-slate-850 rounded-xl border border-slate-700/35">
              <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider mb-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Google Workspace 連携
              </p>
              
              <div className="space-y-2">
                <a
                  href={sheetsConfig.spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!sheetsConfig.spreadsheetUrl) {
                      e.preventDefault();
                      alert('現在スプレッドシートが作成されていません。安全点検を一度実行すると自動的に作成・連携されます。');
                    }
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-[11px] font-bold transition-all ${
                    sheetsConfig.spreadsheetUrl
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    点検スプレッドシート
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                </a>

                <a
                  href="https://drive.google.com/drive/search?q=School-Trace"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between p-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/40 rounded-lg text-[11px] font-bold text-slate-200 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    安全点検写真フォルダ
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                </a>
              </div>
            </div>

            {/* NFC Hardware Status Block */}
            <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/30">
              <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider mb-2">NFC DEVICE STATUS</p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-xs text-white font-semibold">Web NFC Listener Active</p>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                ※スマホ/ICカードを端末にかざすと自動的に貸出・返却・バトン引継を判別処理。
              </p>
            </div>
          </aside>

          {/* Right Main Content Panel (Responsive with Bottom Nav) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-20 lg:pb-6">
              {activeTab === 'dashboard' && (
                <Dashboard 
                  teachers={teachers}
                  resources={resources}
                  reservations={reservations}
                  inspectionLogs={inspectionLogs}
                  sosRequests={sosRequests}
                  history={nfcHistory}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onRefresh={fetchData}
                  sheetsConfig={sheetsConfig}
                  onSelectResourceForInspection={(resId) => {
                    setPreselectedResourceId(resId);
                    setActiveTab('safety');
                  }}
                />
              )}

              {activeTab === 'register' && (
                <ResourceRegister 
                  teachers={teachers}
                  resources={resources}
                  onRefresh={fetchData}
                />
              )}

              {activeTab === 'nfc' && (
                <NfcSimulator 
                  teachers={teachers}
                  resources={resources}
                  history={nfcHistory}
                  onRefresh={fetchData}
                  onSelectResourceForInspection={(resId) => {
                    setPreselectedResourceId(resId);
                    setActiveTab('safety');
                  }}
                />
              )}

              {activeTab === 'usage' && (
                <EquipmentUsage 
                  teachers={teachers}
                  resources={resources}
                  history={nfcHistory}
                  onRefresh={fetchData}
                  loggedInTeacherId={loggedInTeacherId}
                  onSelectResourceForInspection={(resId) => {
                    setPreselectedResourceId(resId);
                    setActiveTab('safety');
                  }}
                />
              )}

              {activeTab === 'classroom_usage' && (
                <ClassroomUsage 
                  teachers={teachers}
                  resources={resources}
                  history={nfcHistory}
                  onRefresh={fetchData}
                  loggedInTeacherId={loggedInTeacherId}
                  onSelectResourceForInspection={(resId) => {
                    setPreselectedResourceId(resId);
                    setActiveTab('safety');
                  }}
                />
              )}

              {activeTab === 'reservations' && (
                <ReservationCalendar 
                  teachers={teachers}
                  resources={resources}
                  reservations={reservations}
                  onRefresh={fetchData}
                />
              )}

              {activeTab === 'safety' && (
                <SafetyInspection 
                  teachers={teachers}
                  resources={resources}
                  inspectionLogs={inspectionLogs}
                  onRefresh={fetchData}
                  preselectedResourceId={preselectedResourceId}
                  clearPreselectedResource={() => setPreselectedResourceId('')}
                />
              )}

              {activeTab === 'management' && (
                <ResourceManager 
                  teachers={teachers}
                  resources={resources}
                  onRefresh={fetchData}
                />
              )}
            </main>

            {/* Bottom Nav on real mobile viewport (hidden on lg size) */}
            <div className="lg:hidden shrink-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 shadow-lg">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Home className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">ホーム</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('usage');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'usage' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <PackageOpen className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">貸出・返却</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('nfc');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'nfc' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">NFCかざす</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('safety');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  activeTab === 'safety' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">安全点検</span>
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                  isMobileMenuOpen ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">その他</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Mobile View drawer menu overlay (when not using device simulator) */}
      {viewMode !== 'mobile' && isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex flex-col justify-end lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div 
            className="bg-white rounded-t-3xl max-h-[80%] p-5 flex flex-col gap-4 shadow-2xl relative border-t border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-350 rounded-full mx-auto mb-1"></div>
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-xs">その他の機能</h3>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-bold"
              >
                閉じる
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 py-1">
              <button
                onClick={() => {
                  setActiveTab('register');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                  activeTab === 'register' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                }`}
              >
                <Tag className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px]">備品登録 (NFC)</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('classroom_usage');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                  activeTab === 'classroom_usage' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                }`}
              >
                <DoorOpen className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px]">特別教室利用</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('reservations');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                  activeTab === 'reservations' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                }`}
              >
                <Calendar className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px]">予約表</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('management');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 ${
                  activeTab === 'management' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                }`}
              >
                <Settings className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px]">マスタ管理</span>
              </button>

              <button
                onClick={() => {
                  setViewMode('mobile');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl gap-1.5 transition-all cursor-pointer hover:bg-slate-50 text-slate-600"
              >
                <Smartphone className="w-5 h-5 text-emerald-500" />
                <span className="text-[10px]">スマホビュー切替</span>
              </button>
            </div>

            {/* Google Workspace Quick Links in Real Mobile Menu */}
            <div className="border-t border-slate-100 pt-3 mt-1 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Google Workspace 連携</p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={sheetsConfig.spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!sheetsConfig.spreadsheetUrl) {
                      e.preventDefault();
                      alert('現在スプレッドシートが作成されていません。安全点検を一度実行すると自動的に作成・連携されます。');
                    }
                  }}
                  className={`flex items-center justify-center p-2 rounded-xl border gap-1.5 transition-all cursor-pointer text-[10px] font-bold ${
                    sheetsConfig.spreadsheetUrl 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-850' 
                      : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>スプレッドシート</span>
                </a>

                <a
                  href="https://drive.google.com/drive/search?q=School-Trace"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center p-2 border border-blue-200 bg-blue-50 text-blue-850 rounded-xl gap-1.5 transition-all cursor-pointer text-[10px] font-bold"
                >
                  <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Googleドライブ</span>
                </a>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {activeTeacher ? activeTeacher.name.substring(0, 1) : '?'}
                </div>
                <div className="leading-tight">
                  <p className="font-bold text-slate-800 text-[11px]">{activeTeacher ? activeTeacher.name : '教員'}</p>
                  <p className="text-[9px] text-slate-500">{activeTeacher ? activeTeacher.department : ''}</p>
                </div>
              </div>
              <select
                className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 p-1 rounded-md focus:outline-none cursor-pointer max-w-[120px]"
                value={loggedInTeacherId}
                onChange={(e) => setLoggedInTeacherId(e.target.value)}
              >
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Status Bar */}
      {viewMode !== 'mobile' && (
        <footer className="hidden md:flex h-8 bg-slate-100 border-t border-slate-200 px-6 flex items-center justify-between text-[10px] font-medium text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <span>School-Trace v1.1.2-beta</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> 
              Connected to Persistent JSON Storage (db.json)
            </span>
          </div>
          <div>© 2026 School-Trace Management Systems. All rights reserved.</div>
        </footer>
      )}
    </div>
  );
}
