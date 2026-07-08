import React, { useState } from 'react';
import { 
  UserPlus, 
  Plus, 
  Trash2, 
  Tag, 
  Key, 
  Settings, 
  PlusCircle, 
  Edit, 
  Folder,
  MapPin,
  Users,
  Box,
  CheckCircle,
  HelpCircle,
  Server,
  QrCode
} from 'lucide-react';
import { Teacher, Resource } from '../types';

interface ResourceManagerProps {
  teachers: Teacher[];
  resources: Resource[];
  onRefresh: () => void;
}

export default function ResourceManager({ teachers, resources, onRefresh }: ResourceManagerProps) {
  // Tabs: 'resources' | 'teachers'
  const [activeSubTab, setActiveSubTab] = useState<'resources' | 'teachers'>('resources');

  // Teacher Form State
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherDept, setTeacherDept] = useState<string>('');
  const [teacherTag, setTeacherTag] = useState<string>('');
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);

  // Resource Form State
  const [resName, setResName] = useState<string>('');
  const [resCategory, setResCategory] = useState<'equipment' | 'classroom'>('equipment');
  const [resLocation, setResLocation] = useState<string>('');
  const [resSubject, setResSubject] = useState<string>('共通');
  const [resTag, setResTag] = useState<string>('');
  const [resQr, setResQr] = useState<string>('');
  const [editingResId, setEditingResId] = useState<string | null>(null);

  // NFC Associate State
  const [assocTargetType, setAssocTargetType] = useState<'teacher' | 'resource'>('resource');
  const [assocTargetId, setAssocTargetId] = useState<string>('');
  const [assocTagId, setAssocTagId] = useState<string>('');
  const [assocMsg, setAssocMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Status Alerts
  const [alertMsg, setAlertMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Add or Edit Teacher
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    if (!teacherName.trim() || !teacherDept.trim()) {
      setAlertMsg({ success: false, text: 'お名前と所属部署・担当教科を入力してください。' });
      return;
    }

    try {
      const payload: Partial<Teacher> = {
        name: teacherName.trim(),
        department: teacherDept.trim(),
        nfcTagId: teacherTag.trim() || undefined,
      };

      if (editingTeacherId) {
        payload.id = editingTeacherId;
      }

      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAlertMsg({ success: true, text: editingTeacherId ? '教員情報を更新しました。' : '新しい教員を登録しました。' });
        setTeacherName('');
        setTeacherDept('');
        setTeacherTag('');
        setEditingTeacherId(null);
        onRefresh();
      } else {
        setAlertMsg({ success: false, text: data.message || '保存に失敗しました。' });
      }
    } catch (e) {
      setAlertMsg({ success: false, text: '通信に失敗しました。' });
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async (id: string) => {
    if (!window.confirm('この教員を削除してもよろしいですか？（※貸出中の備品や予約がある場合は適宜引き継ぎを行ってください）')) return;
    setAlertMsg(null);

    try {
      const response = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setAlertMsg({ success: true, text: '教員を削除しました。' });
        onRefresh();
      } else {
        setAlertMsg({ success: false, text: '削除に失敗しました。' });
      }
    } catch (e) {
      setAlertMsg({ success: false, text: '通信に失敗しました。' });
    }
  };

  // Add or Edit Resource
  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    if (!resName.trim() || !resLocation.trim()) {
      setAlertMsg({ success: false, text: 'リソース名と保管場所を入力してください。' });
      return;
    }

    try {
      const payload: Partial<Resource> = {
        name: resName.trim(),
        category: resCategory,
        location: resLocation.trim(),
        subject: resSubject.trim() || '共通',
        nfcTagId: resTag.trim() || undefined,
        qrCodeId: resQr.trim() || undefined,
      };

      if (editingResId) {
        payload.id = editingResId;
      }

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAlertMsg({ success: true, text: editingResId ? 'リソース情報を更新しました。' : '新しいリソースを登録しました。' });
        setResName('');
        setResLocation('');
        setResSubject('共通');
        setResTag('');
        setResQr('');
        setEditingResId(null);
        onRefresh();
      } else {
        setAlertMsg({ success: false, text: data.message || '保存に失敗しました。' });
      }
    } catch (e) {
      setAlertMsg({ success: false, text: '通信に失敗しました。' });
    }
  };

  // Delete Resource
  const handleDeleteResource = async (id: string) => {
    if (!window.confirm('この備品・特別教室を削除してもよろしいですか？（※関連する予約等も削除されます）')) return;
    setAlertMsg(null);

    try {
      const response = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setAlertMsg({ success: true, text: 'リソースを削除しました。' });
        onRefresh();
      } else {
        setAlertMsg({ success: false, text: '削除に失敗しました。' });
      }
    } catch (e) {
      setAlertMsg({ success: false, text: '通信に失敗しました。' });
    }
  };

  // Associate NFC Tag directly
  const handleAssociateNfc = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssocMsg(null);

    if (!assocTargetId || !assocTagId.trim()) {
      setAssocMsg({ success: false, text: '対象IDとNFCタグIDを入力・選択してください。' });
      return;
    }

    try {
      const response = await fetch('/api/nfc/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: assocTargetType,
          targetId: assocTargetId,
          tagId: assocTagId.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAssocMsg({ success: true, text: data.message || '紐付け完了しました。' });
        setAssocTagId('');
        onRefresh();
      } else {
        setAssocMsg({ success: false, text: data.message || '紐付けに失敗しました。' });
      }
    } catch (e) {
      setAssocMsg({ success: false, text: '通信エラーが発生しました。' });
    }
  };

  return (
    <div className="space-y-6" id="resource-manager-container">
      {/* Tab Selectors */}
      <div className="flex bg-slate-200/60 p-1 rounded-xl max-w-xs">
        <button
          onClick={() => { setActiveSubTab('resources'); setAlertMsg(null); }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'resources' 
              ? 'bg-white shadow-sm text-indigo-700' 
              : 'text-slate-600'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          備品・教室
        </button>
        <button
          onClick={() => { setActiveSubTab('teachers'); setAlertMsg(null); }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'teachers' 
              ? 'bg-white shadow-sm text-indigo-700' 
              : 'text-slate-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          教職員
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left: Interactive List and Grid (8 Cols) */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {activeSubTab === 'resources' ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-indigo-600" />
                  備品・教室 ({resources.length})
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">リソース名</th>
                        <th className="py-3 px-4">対象教科</th>
                        <th className="py-3 px-4">カテゴリ</th>
                        <th className="py-3 px-4">保管・設置場所</th>
                        <th className="py-3 px-4">NFCタグID</th>
                        <th className="py-3 px-4">QRコードID</th>
                        <th className="py-3 px-4 text-right">アクション</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resources.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                            登録されているリソースはありません。
                          </td>
                        </tr>
                      ) : (
                        resources.map(res => (
                          <tr key={res.id} className="hover:bg-slate-50/40 text-sm">
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {res.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {res.subject || '共通'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                res.category === 'classroom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {res.category === 'classroom' ? '特別教室・施設' : '貸出共通備品'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {res.location}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              {res.nfcTagId ? (
                                <span className="inline-flex items-center text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                                  <Tag className="w-3 h-3 mr-1 shrink-0" /> {res.nfcTagId}
                                </span>
                              ) : (
                                <span className="text-slate-400">🏷️ 未紐付け</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              {res.qrCodeId ? (
                                <span className="inline-flex items-center text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                  <QrCode className="w-3 h-3 mr-1 shrink-0" /> {res.qrCodeId}
                                </span>
                              ) : (
                                <span className="text-slate-400">📷 未紐付け</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingResId(res.id);
                                  setResName(res.name);
                                  setResCategory(res.category);
                                  setResLocation(res.location);
                                  setResSubject(res.subject || '共通');
                                  setResTag(res.nfcTagId || '');
                                  setResQr(res.qrCodeId || '');
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50"
                                title="編集"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteResource(res.id)}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-50"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  教職員 ({teachers.length})
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">教職員氏名</th>
                        <th className="py-3 px-4">所属部署 / 担当科目</th>
                        <th className="py-3 px-4">NFCタグID (教職員証など)</th>
                        <th className="py-3 px-4 text-right">アクション</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                            登録されている教職員はいません。
                          </td>
                        </tr>
                      ) : (
                        teachers.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/40 text-sm">
                            <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full bg-${t.color || 'indigo'}-500`}></span>
                              {t.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {t.department}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              {t.nfcTagId ? (
                                <span className="inline-flex items-center text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
                                  <Tag className="w-3 h-3 mr-1 shrink-0" /> {t.nfcTagId}
                                </span>
                              ) : (
                                <span className="text-slate-400">🏷️ 未紐付け</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingTeacherId(t.id);
                                  setTeacherName(t.name);
                                  setTeacherDept(t.department);
                                  setTeacherTag(t.nfcTagId || '');
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50"
                                title="編集"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeacher(t.id)}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-50"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Registration Form & Direct NFC Association (4 Cols) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Registration / Modification Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5 text-xs">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              {activeSubTab === 'resources' 
                ? (editingResId ? '備品・教室の編集' : '備品・教室の追加') 
                : (editingTeacherId ? '教職員の編集' : '教職員の追加')}
            </h3>

            {activeSubTab === 'resources' ? (
              <form onSubmit={handleSaveResource} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    リソース名
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder="例: iPadカート D (30台)"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    カテゴリ
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={resCategory}
                    onChange={(e) => setResCategory(e.target.value as 'equipment' | 'classroom')}
                  >
                    <option value="equipment">貸出共通備品</option>
                    <option value="classroom">特別教室・施設</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    対象・関連教科
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    保管・設置場所
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder="例: 職員室裏保管庫"
                    value={resLocation}
                    onChange={(e) => setResLocation(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    NFCタグID (省略可)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 font-mono"
                    placeholder="例: TAG_EQ_IPAD_D"
                    value={resTag}
                    onChange={(e) => setResTag(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    QRコードID (省略可)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 font-mono"
                    placeholder="例: QR_EQ_IPAD_D"
                    value={resQr}
                    onChange={(e) => setResQr(e.target.value.toUpperCase())}
                  />
                </div>

                {alertMsg && (
                  <p className={`text-xs p-2.5 rounded-lg font-medium ${alertMsg.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {alertMsg.text}
                  </p>
                )}

                <div className="flex gap-2">
                  {editingResId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingResId(null);
                        setResName('');
                        setResLocation('');
                        setResSubject('共通');
                        setResTag('');
                        setResQr('');
                        setAlertMsg(null);
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs"
                    >
                      キャンセル
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    {editingResId ? '変更を確定' : '登録する'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    教員氏名
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder="例: 山田 花子"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    所属部署 / 担当教科・学年
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder="例: 英語科 / 2学年副担任"
                    value={teacherDept}
                    onChange={(e) => setTeacherDept(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    NFCタグID (省略可)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 font-mono"
                    placeholder="例: NFC_YAMADA_321"
                    value={teacherTag}
                    onChange={(e) => setTeacherTag(e.target.value)}
                  />
                </div>

                {alertMsg && (
                  <p className={`text-xs p-2.5 rounded-lg font-medium ${alertMsg.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {alertMsg.text}
                  </p>
                )}

                <div className="flex gap-2">
                  {editingTeacherId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeacherId(null);
                        setTeacherName('');
                        setTeacherDept('');
                        setTeacherTag('');
                        setAlertMsg(null);
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs"
                    >
                      キャンセル
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    {editingTeacherId ? '変更を確定' : '登録する'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Quick Tag Associator */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5 text-xs">
              <Tag className="w-4 h-4 text-indigo-600" />
              NFCタグ紐付け
            </h3>

            <form onSubmit={handleAssociateNfc} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  対象カテゴリ
                </label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                      assocTargetType === 'resource' ? 'bg-white shadow-xs text-indigo-700 font-semibold' : 'text-slate-500'
                    }`}
                    onClick={() => { setAssocTargetType('resource'); setAssocTargetId(''); }}
                  >
                    備品・特別教室
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                      assocTargetType === 'teacher' ? 'bg-white shadow-xs text-indigo-700 font-semibold' : 'text-slate-500'
                    }`}
                    onClick={() => { setAssocTargetType('teacher'); setAssocTargetId(''); }}
                  >
                    教職員
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  対象を選択
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={assocTargetId}
                  onChange={(e) => setAssocTargetId(e.target.value)}
                >
                  <option value="">-- 選択してください --</option>
                  {assocTargetType === 'resource' 
                    ? resources.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.nfcTagId ? `(現: ${r.nfcTagId})` : '(タグ未登録)'}
                        </option>
                      ))
                    : teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.nfcTagId ? `(現: ${t.nfcTagId})` : '(タグ未登録)'}
                        </option>
                      ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  NFCタグID
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  placeholder="タグIDを入力"
                  value={assocTagId}
                  onChange={(e) => setAssocTagId(e.target.value)}
                />
              </div>

              {assocMsg && (
                <p className={`text-xs p-2.5 rounded-lg font-medium ${assocMsg.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                  {assocMsg.text}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-1"
              >
                <Key className="w-3.5 h-3.5" />
                紐付ける
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
