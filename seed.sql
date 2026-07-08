-- Seed teachers
INSERT OR IGNORE INTO teachers (id, name, department, nfc_tag_id, color) VALUES
  ('T1', '佐藤 健一', '理科', 'NFC_SATO_123', 'indigo'),
  ('T2', '鈴木 美咲', '体育', 'NFC_SUZUKI_456', 'emerald'),
  ('T3', '高橋 蓮', '情報技術', 'NFC_TAKAHASHI_789', 'blue'),
  ('T4', '渡辺 裕子', '図工・美術', 'NFC_WATANABE_999', 'rose');

-- Seed resources
INSERT OR IGNORE INTO resources (id, name, category, location, subject, nfc_tag_id, qr_code_id, status) VALUES
  ('R1', '理科室 (第1物理化学室)', 'classroom', '本館2階', '理科', 'TAG_SCI_ROOM', 'QR_SCI_ROOM', 'available'),
  ('R2', '体育館 (第1アリーナ)', 'classroom', '体育館棟', '体育', 'TAG_GYM_ROOM', 'QR_GYM_ROOM', 'available'),
  ('R3', '3Dプリンター (Form 3+)', 'equipment', '情報室3階', '情報技術', 'TAG_EQ_3DPRINTER', 'QR_EQ_3DPRINTER', 'available'),
  ('R4', 'AED訓練用デモ機', 'equipment', '保健室', '保健体育', 'TAG_EQ_AED', 'QR_EQ_AED', 'available'),
  ('R5', '双眼実体顕微鏡カート', 'equipment', '理科準備室', '理科', 'TAG_EQ_MICROSCOPE', 'QR_EQ_MICROSCOPE', 'available'),
  ('R6', 'タブレット保管カート (40台)', 'equipment', '職員室裏保管庫', '共通', 'TAG_EQ_TABLET_CART', 'QR_EQ_TABLET_CART', 'available');
