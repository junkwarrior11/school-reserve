import React from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  ArrowRight, 
  User, 
  Bookmark, 
  Plus, 
  Smartphone,
  Shield,
  Activity,
  CalendarDays,
  FileSpreadsheet,
  FolderOpen,
  ExternalLink,
  MapPin,
  Users,
  ShieldCheck
} from 'lucide-react';
import { Teacher, Resource, Reservation, InspectionLog, SOSRequest, NFCHistoryEvent } from '../types';

interface DashboardProps {
  teachers: Teacher[];
  resources: Resource[];
  reservations: Reservation[];
  inspectionLogs: InspectionLog[];
  sosRequests: SOSRequest[];
  history: NFCHistoryEvent[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
  sheetsConfig: { hasToken: boolean; spreadsheetId: string | null; spreadsheetUrl: string | null };
  onSelectResourceForInspection?: (resId: string) => void;
}

export default function Dashboard({ 
  teachers, 
  resources, 
  reservations, 
  inspectionLogs, 
  sosRequests, 
  history,
  onNavigate,
  onRefresh,
  sheetsConfig,
  onSelectResourceForInspection
}: DashboardProps) {

  // Current Date string
  const todayStr = new Date().toISOString().split('T')[0];

  // Stats calculations
  const totalResources = resources.length;
  const checkedOutResources = resources.filter(r => r.status === 'checked_out').length;
  const availableResources = totalResources - checkedOutResources;
  const todayReservationsCount = reservations.filter(r => r.date === todayStr).length;

  // Active alarms (inspections with caution or ng & pending repair)
  const activeAlarms = inspectionLogs.filter(log => 
    (log.overallStatus === 'ng' || log.overallStatus === 'caution') && 
    log.repairStatus !== 'fixed'
  );

  // Active SOS / Wait requests
  const activeSOS = sosRequests;

  const handleResolveSOS = async (sosId: string) => {
    try {
      const response = await fetch('/api/sos/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sosId })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6" id="dashboard-tab-content">
      {/* Google Workspace Cloud Integration Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100 shrink-0">
            <FileSpreadsheet className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-slate-800 text-sm">
                Google Workspace クラウド連携
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                sheetsConfig.hasToken ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {sheetsConfig.hasToken ? '同期中' : 'ローカル保存のみ'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              安全点検の記録・貸出データはスプレッドシートに、現場写真や添付画像はGoogleドライブにリアルタイム保存されます。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            className={`text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-xs ${
              sheetsConfig.spreadsheetUrl 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            スプレッドシートを見る
          </a>

          <a
            href="https://drive.google.com/drive/search?q=School-Trace"
            target="_blank"
            rel="noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            Googleドライブを見る
          </a>
        </div>
      </div>

      {/* Upper Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">総保有備品・教室</span>
            <div className="text-2xl font-bold text-slate-800">{totalResources}</div>
            <span className="text-[11px] text-slate-400">登録済みの備品と教室</span>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
            <Bookmark className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">現在貸出中</span>
            <div className="text-2xl font-bold text-blue-600">{checkedOutResources}</div>
            <span className="text-[11px] text-blue-500 font-medium">
              稼働率 {totalResources > 0 ? Math.round((checkedOutResources / totalResources) * 100) : 0}%
            </span>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">本日の予約</span>
            <div className="text-2xl font-bold text-emerald-600">{todayReservationsCount}</div>
            <span className="text-[11px] text-slate-400">本日の予約件数</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">要修繕・注意アラート</span>
            <div className={`text-2xl font-bold ${activeAlarms.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {activeAlarms.length}
            </div>
            <span className="text-[11px] text-slate-400">未修繕のアラート数</span>
          </div>
          <div className={`p-3 rounded-xl ${activeAlarms.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
            <Shield className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Active Loans & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Loans Left (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
              現在の貸出状況
            </h2>
            <button 
              onClick={() => onNavigate('usage')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              貸出・返却 &rarr;
            </button>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/40 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-150">
                <tr>
                  <th className="px-5 py-3.5">リソース名</th>
                  <th className="px-5 py-3.5">現在の借用教員</th>
                  <th className="px-5 py-3.5">貸出開始時刻</th>
                  <th className="px-5 py-3.5 text-right">待機/SOS状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resources.filter(r => r.status === 'checked_out').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-xs text-slate-400 font-medium">
                      貸出中の備品はありません
                    </td>
                  </tr>
                ) : (
                  resources
                    .filter(r => r.status === 'checked_out')
                    .map(res => {
                      const teacher = teachers.find(t => t.id === res.currentTeacherId);
                      const resSos = activeSOS.filter(s => s.resourceId === res.id);

                      return (
                        <tr key={res.id} className="hover:bg-slate-50/70 transition-all">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-slate-800 text-sm block">
                              {res.name}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${res.category === 'classroom' ? 'bg-indigo-400' : 'bg-emerald-400'}`}></span>
                              {res.category === 'classroom' ? '特別教室' : '共通備品'} · {res.location}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {teacher ? (
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full bg-${teacher.color || 'indigo'}-500`}></span>
                                <span className="font-medium text-slate-700 text-sm">
                                  {teacher.name}
                                </span>
                                <span className="text-xs text-slate-400">({teacher.department})</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">不明な教員</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {res.lastCheckedOutAt 
                                  ? new Date(res.lastCheckedOutAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
                                  : '-'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono ml-1">
                                ({res.lastCheckedOutAt ? new Date(res.lastCheckedOutAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : ''})
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {resSos.length > 0 ? (
                              <div className="inline-flex flex-col items-end gap-1">
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide animate-pulse">
                                  SOS: 待機教員あり
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {resSos.map(s => {
                                    const t = teachers.find(x => x.id === s.teacherId);
                                    return t ? t.name : '教員';
                                  }).join(', ')} が待機中
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">なし</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alarms and Standby Queue Right (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Active Alarms */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1">
            <div className="p-4 border-b border-slate-100 bg-rose-50/40 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-600" />
                <h2 className="font-bold text-rose-800 text-sm">危険・点検アラート (未修繕)</h2>
              </div>
              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {activeAlarms.length} 件
              </span>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[300px]">
              {activeAlarms.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                  <CheckCircle className="w-6 h-6 text-emerald-500 stroke-[1.5]" />
                  <span>異常なし</span>
                </div>
              ) : (
                activeAlarms.map(log => {
                  const res = resources.find(r => r.id === log.resourceId);
                  const isNg = log.overallStatus === 'ng';
                  
                  return (
                    <div 
                      key={log.id} 
                      className={`p-3 bg-slate-50 border-l-4 rounded-r-lg transition-all ${isNg ? 'border-rose-500' : 'border-amber-400'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isNg ? 'text-rose-700' : 'text-amber-700'}`}>
                          {isNg ? 'NG: 使用中止推奨' : '要注意: 早期修繕'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(log.date).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        {res ? res.name : `不明なリソース (${log.resourceId})`}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {log.generalComment || '特記事項なし'}
                      </p>
                      {log.repairNote && (
                        <p className="text-[9px] bg-white text-slate-500 px-1.5 py-0.5 rounded mt-1.5 border border-slate-100 font-medium">
                          対応状況: {log.repairNote}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50 text-center rounded-b-xl">
              <button 
                onClick={() => onNavigate('safety')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 w-full"
              >
                詳細・報告 &rarr;
              </button>
            </div>
          </div>

          {/* SOS / Next Standby Queue */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1">
            <div className="p-4 border-b border-slate-100 bg-indigo-50/40 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-slate-800 text-sm">次使います（待機・SOS）</h2>
              </div>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {activeSOS.length} 件
              </span>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[300px]">
              {activeSOS.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  待機申請はありません
                </div>
              ) : (
                activeSOS.map(sos => {
                  const res = resources.find(r => r.id === sos.resourceId);
                  const requester = teachers.find(t => t.id === sos.teacherId);
                  const currentHolder = res?.currentTeacherId ? teachers.find(t => t.id === res.currentTeacherId) : null;

                  return (
                    <div key={sos.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          {res ? res.name : '不明な備品'}
                        </span>
                        <button
                          onClick={() => handleResolveSOS(sos.id)}
                          className="text-[10px] text-slate-400 hover:text-indigo-600 hover:underline"
                        >
                          解消
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div>
                          申請者: <span className="font-semibold text-slate-700">{requester ? requester.name : '不明'}</span>
                        </div>
                        <div>
                          利用中: <span className="font-semibold text-slate-700">{currentHolder ? currentHolder.name : '返却済'}</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span>申請時刻: {new Date(sos.requestedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🏫 特別教室の使用状況セクション (NFC/QR連動) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col" id="classroom-status-panel">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Users className="w-4 h-4" />
            </span>
            特別教室の使用状況（NFC/QR連動）
          </h2>
          <button 
            onClick={() => onNavigate('classroom_usage')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            教室の利用・返却へ &rarr;
          </button>
        </div>

        <div className="p-5">
          {resources.filter(r => r.category === 'classroom').length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              登録されている特別教室はありません。マスタ管理で登録してください。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources
                .filter(r => r.category === 'classroom')
                .map(room => {
                  const isUsed = room.status === 'checked_out';
                  const userTeacher = isUsed ? teachers.find(t => t.id === room.currentTeacherId) : null;
                  const useTime = isUsed && room.lastCheckedOutAt
                    ? new Date(room.lastCheckedOutAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const useDate = isUsed && room.lastCheckedOutAt
                    ? new Date(room.lastCheckedOutAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                    : null;

                  return (
                    <div 
                      key={room.id}
                      className={`p-4 border rounded-xl flex flex-col justify-between transition-all hover:shadow-md ${
                        isUsed 
                          ? 'border-rose-100 bg-rose-50/30' 
                          : 'border-slate-150 bg-white'
                      }`}
                    >
                      <div>
                        {/* Status badge & title */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                            isUsed 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isUsed ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                            {isUsed ? '使用中' : '空き'}
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-300" />
                            {room.location}
                          </span>
                        </div>

                        {/* Room Name */}
                        <h3 className="font-extrabold text-slate-800 text-sm mt-1">
                          {room.name}
                        </h3>

                        {/* Usage details */}
                        <div className="mt-3 min-h-[48px]">
                          {isUsed && userTeacher ? (
                            <div className="flex items-start gap-2 bg-white/70 border border-rose-50 p-2.5 rounded-xl">
                              <div className={`w-6 h-6 rounded-full bg-${userTeacher.color || 'indigo'}-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5`}>
                                {userTeacher.name.substring(0, 1)}
                              </div>
                              <div className="leading-tight">
                                <p className="font-bold text-slate-700 text-xs">
                                  {userTeacher.name} 先生
                                </p>
                                <p className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <span>{userTeacher.department}</span>
                                  <span>•</span>
                                  <span className="font-semibold font-mono text-rose-600">{useTime}から利用中 ({useDate})</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 font-medium pt-2">
                              現在利用可能です。NFC/QRスキャンで利用開始できます。
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Action Shortcuts */}
                      <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectResourceForInspection) {
                              onSelectResourceForInspection(room.id);
                            } else {
                              onNavigate('safety');
                            }
                          }}
                          className="flex-1 py-1.5 text-[11px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-150 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          安全点検
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => onNavigate('classroom_usage')}
                          className="flex-1 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          利用/返却
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Today's Schedule Overview Bottom */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <CalendarDays className="w-5 h-5 text-indigo-500" />
            本日のスケジュール
          </h2>
          <button 
            onClick={() => onNavigate('reservations')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            予約表 &rarr;
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(p => {
            const periodReservations = reservations.filter(r => r.date === todayStr && Number(r.period) === Number(p));
            
            return (
              <div 
                key={p} 
                className={`p-3.5 border rounded-xl flex flex-col justify-between min-h-[110px] transition-all ${
                  periodReservations.length > 0 
                    ? 'bg-indigo-50/50 border-indigo-100' 
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">第{p}時限</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {p === 1 && '08:50'}
                      {p === 2 && '09:50'}
                      {p === 3 && '10:50'}
                      {p === 4 && '11:50'}
                      {p === 5 && '13:30'}
                      {p === 6 && '14:30'}
                    </span>
                  </div>
                  
                  {periodReservations.length === 0 ? (
                    <span className="text-xs text-slate-350 italic font-normal block my-1">なし</span>
                  ) : (
                    <div className="space-y-1.5">
                      {periodReservations.map(rv => {
                        const res = resources.find(r => r.id === rv.resourceId);
                        const teacher = teachers.find(t => t.id === rv.teacherId);
                        return (
                          <div key={rv.id} className="text-left">
                            <span className="text-xs font-bold text-indigo-950 block truncate" title={res?.name}>
                              {res ? res.name : '特別教室'}
                            </span>
                            <span className="text-[10px] text-indigo-600 block truncate" title={rv.purpose}>
                              {teacher ? teacher.name : '教員'}: {rv.purpose}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
