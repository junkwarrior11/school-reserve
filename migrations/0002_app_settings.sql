-- アプリ設定KV（Google Sheet/Drive IDなどを動的保存）
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
