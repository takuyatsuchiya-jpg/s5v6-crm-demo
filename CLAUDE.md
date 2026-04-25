# CLAUDE.md — ひとり営業用 顧客管理アプリ

このファイルは実装時に毎回読まれる前提のプロジェクトルール。判断に直結する内容のみを記載する。

---

## 1. 技術スタック

- **HTML**: `index.html` 1枚でマークアップとビュー骨格を定義
- **JavaScript**: vanilla JS のみ（ES Modules）。React / Vue / Svelte / Alpine.js 等の UI フレームワークは使わない
- **CSS**: Tailwind CSS を CDN から読み込む。独自スタイルは `styles.css` に最小限のみ
- **永続化**: Supabase（PostgreSQL + REST）。`@supabase/supabase-js` クライアント経由でアクセスする
- **ビルド**: Vite。`npm run dev` で開発サーバー、`npm run build` で本番ビルド
- **環境変数**: Vite の `import.meta.env` で読む。鍵は `.env` に置き、`.gitignore` で除外

---

## 2. ディレクトリ構成

```
s5v6-crm-demo/
├── CLAUDE.md            # このファイル（プロジェクトルール）
├── spec.md              # 機能仕様書
├── supabase_setup.sql   # Supabase 初期セットアップ SQL（テーブル/RLS/seed）
├── index.html           # マークアップ。Vite のエントリ HTML
├── styles.css           # Tailwindで表現しづらい微調整のみ
├── package.json         # Vite / @supabase/supabase-js 依存
├── .env                 # VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY（gitignore対象）
├── .env.example         # .env のテンプレート（git管理）
├── .gitignore           # node_modules / dist / .env を除外
└── src/
    ├── supabase.js      # Supabase クライアント初期化（シングルトン）
    └── app.js           # アプリ全体のロジック（状態管理・描画・イベント・DB I/O）
```

各ファイルの責務:

| ファイル | 書くもの | 書かないもの |
|---|---|---|
| `index.html` | ビュータブ、左右ペインの器、各モードのテンプレート（`<template>` タグ推奨） | 具体ロジック、インラインJS |
| `src/supabase.js` | `createClient` の呼び出しとエクスポートのみ | 業務ロジック |
| `src/app.js` | 状態管理、描画関数、イベントハンドラ、Supabase CRUD 関数 | マークアップの直書き HTML（テンプレートから clone する） |
| `styles.css` | Tailwind で表現できない微調整（左アクセントライン 3px 等） | Tailwind で済むスタイル |

---

## 3. コーディング規約

### モジュール方式
- `src/app.js` は ES Modules で書く（`<script type="module">` で読み込む）
- 旧 IIFE ラッパーは使わない（モジュールスコープが既に閉じているため不要）
- `'use strict';` も書かない（モジュールでは自動で strict）

### ビュー・モード切替方式
- 2つのビュー（顧客／パイプライン）は **CSSの `hidden` クラス付け外し** で切替
- 右ペインの4モード（空状態 / 顧客詳細 / 顧客フォーム / 商談フォーム）も同じく `hidden` 切替
- URLルーティングやハッシュは使わない

### ID命名規則
接頭辞で役割を分類し、kebab-case で書く。

| 接頭辞 | 用途 | 例 |
|---|---|---|
| `view-*` | ビュー単位のルート要素 | `view-customers`, `view-pipeline` |
| `pane-*` | ビュー内のペイン・モード領域 | `pane-customer-list`, `pane-detail`, `pane-customer-form`, `pane-deal-form`, `pane-empty` |
| `input-*` | フォーム入力要素 | `input-company`, `input-contact`, `input-deal-title`, `input-deal-amount` |
| `btn-*` | ボタン類 | `btn-new-customer`, `btn-save-customer`, `btn-delete-customer`, `btn-add-deal` |

### 関数の長さ
- 1関数 **50行以内**。超えたら分割する
- ネストは 3段階まで。早期リターンで平坦化する

### 変数宣言
- `const` を優先。再代入が必要な場合のみ `let`
- `var` 禁止

### 非同期処理
- Supabase 呼び出しは `async/await` で書く
- エラーは握りつぶさず、`error` を返り値で受け取って最低でも `console.error`

### コメント方針
- **WHY を書く**（なぜこの実装か、仕様上の制約）
- **WHAT は書かない**（関数名・変数名で表現する）
- コメントアウトされた古いコードは残さない

### データI/O
- Supabase クライアントは `src/supabase.js` で初期化し、`src/app.js` から import する
- CRUD 関数（`fetchCustomers` / `createDeal` 等）は `src/app.js` 内に集約し、画面描画コードから直接 `supabase.from(...)` を呼ばない
- データ変更（INSERT/UPDATE/DELETE）後は対応リストを再フェッチして再描画する（楽観更新はしない）

---

## 4. データ構造

Supabase のテーブル定義（`supabase_setup.sql` 準拠）に合わせる。**フィールド名は snake_case のまま JS でも扱う**（API レスポンスをそのまま使うため）。

### 顧客 customers

```js
{
  id: string,           // uuid（DB側で gen_random_uuid()）
  company: string,      // 会社名（必須）
  name: string,         // 担当者名（必須）
  title: string|null,   // 役職
  email: string|null,
  phone: string|null,
  memo: string|null,
  created_at: string    // timestamptz（ISO文字列）
}
```

### 商談 deals

```js
{
  id: string,                           // uuid
  customer_id: string,                  // customers.id への FK（ON DELETE CASCADE）
  title: string,                        // 必須
  amount: number|null,                  // bigint（円）
  status: 'lead'|'proposal'|'won',      // CHECK制約あり
  memo: string|null,                    // フォローアップメモ（UIラベルは「フォローアップメモ」）
  created_at: string,
  updated_at: string                    // トリガで自動更新
}
```

### JOIN 取得形式
商談一覧取得時は次のクエリを使い、カードに会社名を表示する：

```js
supabase.from('deals').select('*, customers(company)')
```

レスポンスの各 deal は `customers: { company: '...' }` を持つ。

### 1対多の紐付け方針
- `deals.customer_id` で外部キー紐付け（`ON DELETE CASCADE`）
- 顧客削除時は DB 側で連鎖削除されるため、JS 側で deals を消す処理は不要

---

## 5. デザイン規約

### 配色

| 用途 | 色 |
|---|---|
| 基調 | 白 (`#ffffff`) / 薄グレー背景 (`#f8f8f7`) |
| アクセント | `#c15f3c`（Claudeオレンジ） |
| テキスト主 | `#1f1f1f` 前後 |
| テキスト副 | Tailwind の `text-gray-500` / `text-gray-600` |
| 区切り線 | `border-gray-200` |

### フォント
- `"游ゴシック", "Yu Gothic", "Hiragino Sans", sans-serif`
- `body` に指定する

### レイアウト
- 顧客ビュー: 左ペイン **固定 340px**、右ペイン **flex-1**
- パイプラインビュー: 3列を `grid-cols-3` で等幅配置

### 角丸・影
- すべて `rounded-lg`（8px）で統一
- 影は `shadow-sm` までに抑える。`shadow-md` 以上は使わない

### ボタン
- プライマリ: 背景 `#c15f3c`、文字白、`rounded-lg`、`px-4 py-2`
- セカンダリ: 枠線 `border-gray-300`、文字 `text-gray-700`、背景白
- 危険（削除）: 文字 `text-red-600`、枠線 `border-red-300`、背景白

### ステータスバッジ

| ステータス | 表示 | 色 |
|---|---|---|
| `lead` | 見込み | 背景 `bg-gray-100` / 文字 `text-gray-700` |
| `proposal` | 提案 | 背景 `bg-orange-100` / 文字 `#c15f3c` |
| `won` | 成約 | 背景 `bg-green-100` / 文字 `text-green-700` |

バッジ形状: `rounded-full px-2 py-0.5 text-xs`

### 商談カードの左アクセントライン
- カード左辺に **3px 幅** の縦ラインをステータス色で付ける（`styles.css` の `border-left: 3px solid`）

### 選択中の顧客カード
- 背景 `#fdf2ec`（オレンジの淡色）、左辺にアクセントカラーの3pxライン

---

## 6. やってはいけないこと

- ❌ **UIフレームワーク**（React / Vue / Svelte / Alpine.js 等）：import しない。vanilla JS で書く
- ❌ **`.env` を git に commit する**：必ず `.gitignore` で除外する
- ❌ **Supabase 鍵をソースに直書き**：`import.meta.env.VITE_*` 経由で読む
- ❌ **Service Role Key の使用**：ブラウザに置けないため、Publishable key（anon）のみ使う
- ❌ **画面描画コードから直接 `supabase.from(...)` を呼ぶ**：CRUD 関数経由にする
- ❌ **モバイル対応**（レスポンシブ・タッチイベント）：対象外
- ❌ **ドラッグ＆ドロップ**（HTML5 DnD API）：クリックで代替する
- ❌ **CSV・JSON のインポート/エクスポート機能**：作らない
- ❌ **ログイン・認証**：作らない（RLS は anon 全許可で運用）
- ❌ **`any` 相当の雑な型扱い**（JS だが、JSDoc で意図を書いてもよい）
- ❌ **エラーの握りつぶし**：DB I/O 失敗時は最低でも `console.error`、画面通知すべきものは `alert`
- ❌ **楽観更新**：UI 先反映 → DB 反映の順は使わない。DB 反映 → 再フェッチ → 再描画 の順
