-- ============================================================
-- seed.sql — 学校予約管理システム ローカル開発用シードデータ
-- 本番DBと同一の教室・備品構成
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 教員データ（4名）
-- スキーマ: id, name, department, nfc_tag_id, color
-- ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO teachers (id, name, department, nfc_tag_id, color) VALUES
('T001', '山田 太郎', '理科',   'NFC_T001', 'indigo'),
('T002', '佐藤 花子', '音楽',   'NFC_T002', 'pink'),
('T003', '鈴木 一郎', '家庭科', 'NFC_T003', 'green'),
('T004', '田中 美咲', '情報',   'NFC_T004', 'orange');

-- ────────────────────────────────────────────────────────────
-- 普通教室（classroom）— 1〜6年生、各学年2クラス = 12件
-- ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status, custom_inspection_items) VALUES
('CLS_1A', '1年1組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_1A', 'QR_CLS_1A', 'available', '[]'),
('CLS_1B', '1年2組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_1B', 'QR_CLS_1B', 'available', '[]'),
('CLS_2A', '2年1組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_2A', 'QR_CLS_2A', 'available', '[]'),
('CLS_2B', '2年2組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_2B', 'QR_CLS_2B', 'available', '[]'),
('CLS_3A', '3年1組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_3A', 'QR_CLS_3A', 'available', '[]'),
('CLS_3B', '3年2組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_3B', 'QR_CLS_3B', 'available', '[]'),
('CLS_4A', '4年1組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_4A', 'QR_CLS_4A', 'available', '[]'),
('CLS_4B', '4年2組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_4B', 'QR_CLS_4B', 'available', '[]'),
('CLS_5A', '5年1組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_5A', 'QR_CLS_5A', 'available', '[]'),
('CLS_5B', '5年2組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_5B', 'QR_CLS_5B', 'available', '[]'),
('CLS_6A', '6年1組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_6A', 'QR_CLS_6A', 'available', '[]'),
('CLS_6B', '6年2組 普通教室', 'classroom', '', '全教科', 'TAG_CLS_6B', 'QR_CLS_6B', 'available', '[]');

-- ────────────────────────────────────────────────────────────
-- 特別支援学級・通級指導教室（classroom）— 5件
-- ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status, custom_inspection_items) VALUES
('CLS_AOZORA',  'あおぞら教室（特別支援学級・知的障害）',     'classroom', '', '特別支援', 'TAG_CLS_AOZORA',  'QR_CLS_AOZORA',  'available', '[]'),
('CLS_HIMAWARI','ひまわり教室（特別支援学級・自閉症・情緒）',  'classroom', '', '特別支援', 'TAG_CLS_HIMAWARI','QR_CLS_HIMAWARI', 'available', '[]'),
('CLS_WAKABA',  'わかば教室（特別支援学級・肢体不自由）',     'classroom', '', '特別支援', 'TAG_CLS_WAKABA',  'QR_CLS_WAKABA',  'available', '[]'),
('CLS_NOBINOB', 'のびのび教室（通級指導・LD・ADHD）',        'classroom', '', '通級指導', 'TAG_CLS_NOBINOB', 'QR_CLS_NOBINOB', 'available', '[]'),
('CLS_KOTOBA',  'ことばの教室（通級指導・言語障害）',         'classroom', '', '通級指導', 'TAG_CLS_KOTOBA',  'QR_CLS_KOTOBA',  'available', '[]');

-- ────────────────────────────────────────────────────────────
-- 特別教室・専科教室（classroom）— 6件
-- ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status, custom_inspection_items) VALUES
('CLS_RIKA',   '理科室',    'classroom', '', '理科',   'TAG_CLS_RIKA',   'QR_CLS_RIKA',   'available', '[]'),
('CLS_ONGAKU', '音楽室',    'classroom', '', '音楽',   'TAG_CLS_ONGAKU', 'QR_CLS_ONGAKU', 'available', '[]'),
('CLS_PC',     'パソコン室', 'classroom', '', '情報',   'TAG_CLS_PC',     'QR_CLS_PC',     'available', '[]'),
('CLS_TOSHO',  '図書室',    'classroom', '', '全教科', 'TAG_CLS_TOSHO',  'QR_CLS_TOSHO',  'available', '[]'),
('CLS_KATEI',  '家庭科室',  'classroom', '', '家庭科', 'TAG_CLS_KATEI',  'QR_CLS_KATEI',  'available', '[]'),
('CLS_HOKEN',  '保健室',    'classroom', '', '保健',   'TAG_CLS_HOKEN',  'QR_CLS_HOKEN',  'available', '[]');

-- ────────────────────────────────────────────────────────────
-- 普通教室のワークスペース（classroom）— 12件
-- ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status, custom_inspection_items) VALUES
('WS_1A', '1年1組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_1A', 'QR_WS_1A', 'available', '[]'),
('WS_1B', '1年2組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_1B', 'QR_WS_1B', 'available', '[]'),
('WS_2A', '2年1組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_2A', 'QR_WS_2A', 'available', '[]'),
('WS_2B', '2年2組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_2B', 'QR_WS_2B', 'available', '[]'),
('WS_3A', '3年1組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_3A', 'QR_WS_3A', 'available', '[]'),
('WS_3B', '3年2組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_3B', 'QR_WS_3B', 'available', '[]'),
('WS_4A', '4年1組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_4A', 'QR_WS_4A', 'available', '[]'),
('WS_4B', '4年2組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_4B', 'QR_WS_4B', 'available', '[]'),
('WS_5A', '5年1組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_5A', 'QR_WS_5A', 'available', '[]'),
('WS_5B', '5年2組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_5B', 'QR_WS_5B', 'available', '[]'),
('WS_6A', '6年1組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_6A', 'QR_WS_6A', 'available', '[]'),
('WS_6B', '6年2組ワークスペース', 'classroom', '', '全教科', 'TAG_WS_6B', 'QR_WS_6B', 'available', '[]');
