export interface Teacher {
  id: string;
  name: string;
  department: string;
  nfcTagId?: string;
  color?: string; // Tailwind color name like 'indigo', 'emerald', etc.
}

export interface Resource {
  id: string;
  name: string;
  category: 'equipment' | 'classroom';
  location: string;
  subject?: string; // 教科 (e.g., 理科, 体育, etc.)
  nfcTagId?: string;
  qrCodeId?: string; // QRコードID
  status: 'available' | 'checked_out' | 'maintenance';
  currentTeacherId?: string | null;
  lastCheckedOutAt?: string | null;
  customInspectionItems?: string[]; // 教室・備品ごとに設定されたカスタム点検項目
}

export interface Reservation {
  id: string;
  resourceId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  period: number; // 1 to 6
  purpose: string;
}

export interface InspectionItem {
  id: string;
  title: string;
  status: 'ok' | 'caution' | 'ng' | 'A' | 'B' | 'C';
  comment: string;
}

export interface InspectionLog {
  id: string;
  resourceId: string;
  teacherId: string;
  date: string;
  overallStatus: 'ok' | 'caution' | 'ng';
  items: InspectionItem[];
  generalComment: string;
  photoUrl?: string | null; // Base64 or mock URL
  repairStatus: 'none' | 'pending' | 'fixed';
  repairNote?: string | null;
  aiSuggestions?: string | null;
}

export interface SOSRequest {
  id: string;
  resourceId: string;
  teacherId: string;
  requestedAt: string;
  notified: boolean;
}

export interface NFCHistoryEvent {
  id: string;
  resourceId: string;
  teacherId: string;
  action: 'check_out' | 'check_in' | 'baton';
  timestamp: string;
  tagId: string;
}

export interface CheckTemplate {
  id: string;
  category: 'equipment' | 'classroom' | 'all';
  name: string;
  items: string[];
}
