# Supabase + Vite 移行 — 実装計画

## ゴール
- localStorage 永続化を Supabase 永続化に置き換える
- Vite を導入し `npm run dev` で起動できるようにする
- 商談一覧は `select('*, customers(company)')` で取得し、商談カードに会社名を表示する

## チェックリスト

### 1. プロジェクトルール改訂
- [x] 既存ファイル把握（index.html / app.js / styles.css / supabase_setup.sql）
- [ ] CLAUDE.md を Vite + Supabase 方針に書き換え
  - 技術スタック節：Vite / Supabase 追加、localStorage 撤去
  - ディレクトリ構成節：package.json / .env / src/ を追加
  - データ構造節：snake_case + UUID + name/customer_id/memo に修正
  - 「やってはいけないこと」節：npm/Vite/外部API禁止を削除、UIフレームワーク禁止は維持

### 2. ビルド環境（Vite）
- [ ] `.gitignore` 作成（`.env` / `node_modules` / `dist`）
- [ ] `.env` 作成（`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`）
- [ ] `.env.example` 作成（鍵は空のサンプル）
- [ ] `package.json` 作成（vite / @supabase/supabase-js）

### 3. ソース構成
- [ ] `src/supabase.js` — Supabase クライアント初期化
- [ ] 旧 `app.js` を `src/app.js` に移動して Supabase 対応に書き換え
  - ESM 化（IIFE 撤去）
  - `loadCustomers/saveCustomers/loadDeals/saveDeals` → 非同期 CRUD 関数に置き換え
  - `seedIfEmpty()` 削除（DB側で投入済み）
  - フィールド名 `contact → name` `customerId → customer_id` `followup → memo` `createdAt/updatedAt → created_at/updated_at`
  - 商談取得に `select('*, customers(company)')` を使い、カード表示で `d.customers.company` を参照
  - 状態変更操作（追加/更新/削除/ステータス移動）は DB 反映後に再フェッチ→再描画
- [ ] `index.html` を `<script type="module" src="/src/app.js">` に変更

### 4. 動作確認
- [ ] `npm install`
- [ ] `npm run dev` が起動することを確認
- [ ] CLAUDE.md と整合する形で完成

## 設計メモ

### データI/O 関数（src/app.js 内）
```
fetchCustomers()     -> select * order by created_at desc
fetchDeals()         -> select *, customers(company) order by created_at desc
createCustomer(v)    -> insert single, returning row
updateCustomer(id,v) -> update by id
deleteCustomer(id)   -> delete by id（deals は FK ON DELETE CASCADE で連鎖）
createDeal(v)        -> insert single
updateDeal(id,v)     -> update by id
deleteDeal(id)       -> delete by id
```

### UI ラベル維持
- HTML の input ID は `input-deal-followup` のままだが、内部キー名は `memo` に揃える（DB列名と一致）。UIラベル「フォローアップメモ」は維持。

### エラー時方針
- Supabase エラーは `console.error` + `alert` で最低限ユーザーに通知（CRM デモ用途なので軽め）
- 接続失敗時はリストが空のまま表示、操作後の再フェッチで復帰可能
