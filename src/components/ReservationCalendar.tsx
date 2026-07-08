import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  User, 
  Clock, 
  Info, 
  ChevronLeft, 
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { Teacher, Resource, Reservation } from '../types';

interface ReservationCalendarProps {
  teachers: Teacher[];
  resources: Resource[];
  reservations: Reservation[];
  onRefresh: () => void;
}

export default function ReservationCalendar({ teachers, resources, reservations, onRefresh }: ReservationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [purpose, setPurpose] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const periods = [1, 2, 3, 4, 5, 6];

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleGridClick = (resourceId: string, period: number) => {
    setSelectedResourceId(resourceId);
    setSelectedPeriod(period);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedTeacherId) {
      setErrorMsg('予約者の教員を選択してください。');
      return;
    }
    if (!selectedResourceId) {
      setErrorMsg('予約する備品・特別教室を選択してください。');
      return;
    }
    if (!purpose.trim()) {
      setErrorMsg('利用目的を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceId: selectedResourceId,
          teacherId: selectedTeacherId,
          date: selectedDate,
          period: Number(selectedPeriod),
          purpose: purpose.trim(),
        }),
      });

      const data = await response.json();
      setIsSubmitting(false);

      if (response.ok && data.success) {
        setSuccessMsg('予約を正常に登録しました！');
        setPurpose('');
        onRefresh();
      } else {
        setErrorMsg(data.message || '予約登録に失敗しました。');
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('サーバーとの通信に失敗しました。');
    }
  };

  const handleDeleteReservation = async (id: string) => {
    if (!window.confirm('この予約をキャンセルしてもよろしいですか？')) return;

    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onRefresh();
        setSuccessMsg('予約をキャンセルしました。');
      } else {
        setErrorMsg('削除に失敗しました。');
      }
    } catch (err) {
      setErrorMsg('削除通信に失敗しました。');
    }
  };

  // Helper to find reservation for resource + period + selectedDate
  const getReservation = (resourceId: string, period: number) => {
    return reservations.find(r => 
      r.resourceId === resourceId && 
      Number(r.period) === Number(period) && 
      r.date === selectedDate
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8" id="reservation-calendar-container">
      {/* Date Navigation & Interactive Grid Left */}
      <div className="xl:col-span-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          {/* Header & Date Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">予約スケジュール</h3>
            </div>
            
            <div className="flex items-center gap-2 self-center sm:self-auto">
              <button
                onClick={handlePrevDay}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                title="前日"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleNextDay}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                title="翌日"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Timetable Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/50">
                  <th className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider w-[220px]">
                    特別教室・備品名
                  </th>
                  {periods.map(p => (
                    <th key={p} className="py-3 px-2 text-center font-semibold text-xs text-slate-500 uppercase tracking-wider">
                      {p}限
                      <span className="block font-normal text-[10px] text-slate-400 font-mono mt-0.5">
                        {p === 1 && '08:50-'}
                        {p === 2 && '09:50-'}
                        {p === 3 && '10:50-'}
                        {p === 4 && '11:50-'}
                        {p === 5 && '13:30-'}
                        {p === 6 && '14:30-'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resources.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sm text-slate-400">
                      リソースが登録されていません。「マスタ管理」で追加してください。
                    </td>
                  </tr>
                ) : (
                  resources.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50/40 group transition-all">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800 text-sm">{res.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${res.category === 'classroom' ? 'bg-indigo-400' : 'bg-emerald-400'}`}></span>
                          {res.category === 'classroom' ? '特別教室' : '共通備品'}・{res.location}
                        </div>
                      </td>
                      {periods.map(period => {
                        const reservation = getReservation(res.id, period);
                        const teacher = reservation ? teachers.find(t => t.id === reservation.teacherId) : null;
                        const isSelectedCell = selectedResourceId === res.id && selectedPeriod === period;

                        return (
                          <td 
                            key={period} 
                            onClick={() => handleGridClick(res.id, period)}
                            className={`py-2 px-1 text-center transition-all cursor-pointer border-l border-slate-100/55 ${
                              reservation 
                                ? 'bg-indigo-50/40 hover:bg-indigo-50 text-indigo-950' 
                                : isSelectedCell 
                                  ? 'bg-amber-50 border-2 border-amber-400/70' 
                                  : 'hover:bg-slate-50 text-slate-400'
                            }`}
                          >
                            {reservation ? (
                              <div className="p-1.5 rounded-lg text-[11px] leading-snug">
                                <div className="font-bold text-slate-800 flex items-center justify-center gap-0.5">
                                  <User className="w-3 h-3 text-indigo-500 shrink-0" />
                                  {teacher ? teacher.name : '教員'}
                                </div>
                                <div className="text-[10px] text-indigo-600 mt-1 line-clamp-2 leading-relaxed" title={reservation.purpose}>
                                  {reservation.purpose}
                                </div>
                              </div>
                            ) : (
                              <div className="py-4 text-[10px] opacity-0 group-hover:opacity-100 text-slate-400 flex flex-col items-center justify-center gap-0.5">
                                <Plus className="w-3 h-3" />
                                <span className="text-[9px]">予約</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>


        </div>
      </div>

      {/* Booking Form & Reservation List Right */}
      <div className="xl:col-span-4 space-y-6">
        {/* Reservation Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5 text-xs">
            <Plus className="w-4 h-4 text-indigo-600" />
            新規予約
          </h3>

          <form onSubmit={handleAddReservation} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                予約日
              </label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold"
                value={selectedDate}
                disabled
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  特別教室・備品
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                >
                  <option value="">-- 選択 --</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  予約時限
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                >
                  {periods.map(p => (
                    <option key={p} value={p}>
                      {p}限
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                予約者の教員
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
              >
                <option value="">-- 教員を選択 --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                利用目的 / 授業名
              </label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                placeholder="例: 3年実験、ITクラブ活動など"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-500 bg-rose-50 p-2.5 rounded-lg font-medium">{errorMsg}</p>
            )}
            {successMsg && (
              <p className="text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-lg font-medium">{successMsg}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? '登録中...' : '予約を確定する'}
            </button>
          </form>
        </div>

        {/* Selected Date's Reservation List */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5 text-xs">
            <Clock className="w-4 h-4 text-slate-500" />
            予約一覧
          </h3>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {reservations.filter(r => r.date === selectedDate).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                予約はありません。
              </p>
            ) : (
              reservations
                .filter(r => r.date === selectedDate)
                .sort((a, b) => a.period - b.period)
                .map(rv => {
                  const res = resources.find(r => r.id === rv.resourceId);
                  const teacher = teachers.find(t => t.id === rv.teacherId);
                  
                  return (
                    <div 
                      key={rv.id} 
                      className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {rv.period}限
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {res ? res.name : '不明な備品'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {rv.purpose}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-300" />
                          {teacher ? `${teacher.name} (${teacher.department})` : '不明な教員'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteReservation(rv.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors"
                        title="キャンセル"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
