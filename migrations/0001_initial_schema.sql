-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  nfc_tag_id TEXT,
  color TEXT DEFAULT 'indigo',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Resources table (classrooms and equipment)
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('equipment', 'classroom')),
  location TEXT NOT NULL,
  subject TEXT DEFAULT '共通',
  nfc_tag_id TEXT,
  qr_code_id TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'checked_out', 'maintenance')),
  current_teacher_id TEXT,
  last_checked_out_at TEXT,
  custom_inspection_items TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  date TEXT NOT NULL,
  period INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Inspection logs table
CREATE TABLE IF NOT EXISTS inspection_logs (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  date TEXT NOT NULL,
  overall_status TEXT NOT NULL DEFAULT 'ok' CHECK(overall_status IN ('ok', 'caution', 'ng')),
  items TEXT NOT NULL DEFAULT '[]',
  general_comment TEXT DEFAULT '',
  photo_url TEXT,
  repair_status TEXT NOT NULL DEFAULT 'none' CHECK(repair_status IN ('none', 'pending', 'fixed')),
  repair_note TEXT,
  ai_suggestions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- SOS requests table
CREATE TABLE IF NOT EXISTS sos_requests (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  notified INTEGER DEFAULT 0,
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- NFC history events table
CREATE TABLE IF NOT EXISTS nfc_history (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('check_out', 'check_in', 'baton')),
  timestamp TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_resource ON reservations(resource_id);
CREATE INDEX IF NOT EXISTS idx_inspection_resource ON inspection_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_nfc_history_resource ON nfc_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_nfc_history_timestamp ON nfc_history(timestamp);
