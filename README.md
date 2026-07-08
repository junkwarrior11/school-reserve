# School-Trace 🏫

**学校NFC管理システム** — 備品・特別教室の貸出・予約・安全点検をNFCタグ/QRコードで一元管理するWebアプリ

## 🌐 URL

- **本番**: https://075ae33e-83f1-4b37-b6db-0d4e9eef956e.vip.gensparksite.com
- **GitHub**: https://github.com/junkwarrior11/school-reserve

## ✅ 実装済み機能

| タブ | 機能 |
|------|------|
| ダッシュボード | KPIカード・緊急SOS一覧・点検アラート・本日予約・履歴 |
| NFCシミュレーター | NFC/QRタップ操作・貸出/返却/引継・リソース状態確認 |
| 予約カレンダー | 日付ナビゲーション・時限グリッド予約・ダブルブッキング防止 |
| 安全点検 | チェックリスト点検・写真記録・修繕申請・履歴管理 |
| リソース管理 | 備品・教室CRUD・教員管理 |
| 新規登録 | 備品・教室の新規登録フォーム |
| 備品使用状況 | 教員別利用統計・最近の履歴 |
| 教室使用状況 | 入退室履歴・本日予約確認 |

## 🏗️ 技術スタック

| 分類 | 技術 |
|------|------|
| バックエンド | Hono 4.x (Cloudflare Workers) |
| データベース | Cloudflare D1 (SQLite) |
| フロントエンド | 純Vanilla JavaScript SPA |
| スタイル | TailwindCSS CDN |
| ビルド | Vite 6 |
| デプロイ | Genspark hosted (Cloudflare Workers for Platform) |

## 📊 データモデル

- `teachers` — 教員 (id, name, department, nfc_tag_id, color)
- `resources` — 備品・教室 (id, name, category, location, subject, nfc_tag_id, qr_code_id, status)
- `reservations` — 予約 (id, resource_id, teacher_id, date, period, purpose)
- `inspection_logs` — 安全点検記録 (id, resource_id, teacher_id, overall_status, items, repair_status)
- `sos_requests` — 緊急呼び出し (id, resource_id, teacher_id, requested_at)
- `nfc_history` — NFC操作履歴 (id, resource_id, teacher_id, action, timestamp, tag_id)

## 🚀 APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/data | 全データ取得 |
| POST | /api/teachers | 教員追加・更新 |
| DELETE | /api/teachers/:id | 教員削除 |
| POST | /api/resources | リソース追加・更新 |
| DELETE | /api/resources/:id | リソース削除 |
| POST | /api/reservations | 予約作成 |
| DELETE | /api/reservations/:id | 予約削除 |
| POST | /api/nfc/tap | NFC/QRタップ (貸出/返却/引継) |
| POST | /api/inspection | 安全点検記録保存 |
| POST | /api/sos | 緊急呼び出し登録 |

## 💻 ローカル開発

```bash
npm install
npm run db:migrate:local
npm run db:seed
npm run build
npm run dev:d1  # wrangler pages dev + D1 local
```

## 📦 デプロイ

Gensparkのホスティング環境（Cloudflare Workers for Platform）を使用。
D1データベースが自動プロビジョニングされます。
