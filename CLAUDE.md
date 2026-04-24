# CLAUDE.md — ひとり営業用 顧客管理アプリ

このファイルは実装時に毎回読まれる前提のプロジェクトルール。判断に直結する内容のみを記載する。

---

## 1. 技術スタック

- **HTML**: `index.html` 1枚でマークアップとビュー骨格を定義
- **JavaScript**: vanilla JS のみ。フレームワーク（React / Vue 等）は使わない
- **CSS**: Tailwind CSS を CDN から読み込む。独自スタイルは `styles.css` に最小限のみ
- **永続化**: ブラウザの `localStorage` のみ。サーバー・DB・外部API は一切使わない
- **ビルド**: なし。ブラウザで `index.html` を開けば動くこと

---

## 2. ディレクトリ構成

```
s5v6-crm-demo/
├── CLAUDE.md       # このファイル（プロジェクトルール）
├── spec.md         # 機能仕様書
├── index.html      # マークアップ。2つのビュー骨格＋右ペインのモード別テンプレートを内包
├── app.js          # アプリ全体のロジック（状態管理・描画・イベント・localStorage I/O）
└── styles.css      # Tailwindで表現しづらい微調整のみ（ステータスバッジ左アクセントライン等）
```

各ファイルの責務:

| ファイル | 書くもの | 書かないもの |
|---|---|---|
| `index.html` | ビュータブ、左右ペインの器、各モードのテンプレート（`<template>` タグ推奨） | 具体ロジック、インラインJS |
| `app.js` | 状態管理、描画関数、イベントハンドラ、localStorage I/O、初期データ投入 | マークアップの直書き HTML（テンプレートから clone する） |
| `styles.css` | Tailwind で表現できない微調整（左アクセントライン 3px 等） | Tailwind で済むスタイル |

---

## 3. コーディング規約

### ビュー・モード切替方式
- 2つのビュー（顧客／パイプライン）は **CSSの `hidden` クラス付け外し** で切替
- 右ペインの4モード（空状態 / 顧客詳細 / 顧客フォーム / 商談フォーム）も同じく `hidden` 切替
- URLルーティングやハッシュは使わない（SPAライブラリ不要の範囲に留める）

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

### グローバル汚染禁止
- `app.js` 全体を **即時実行関数 (IIFE)** で包む
  ```js
  (() => {
    'use strict';
    // すべてここに書く
  })();
  ```
- 意図的にグローバル公開する変数・関数は作らない

### コメント方針
- **WHY を書く**（なぜこの実装か、仕様上の制約）
- **WHAT は書かない**（関数名・変数名で表現する）
- コメントアウトされた古いコードは残さない

### データI/O
- localStorage の read/write は専用関数（例: `loadCustomers()` / `saveCustomers()`）に集約
- 直接 `localStorage.getItem` を画面側から呼ばない

---

## 4. データ構造

### 顧客 Customer

```js
{
  id: string,          // 自動採番（例: `c_${Date.now()}_${rand}`）
  company: string,     // 会社名（必須）
  contact: string,     // 担当者名（必須）
  title: string,       // 役職（任意）
  email: string,       // メール（任意）
  phone: string,       // 電話（任意）
  memo: string,        // メモ（任意、複数行）
  createdAt: string    // ISO文字列（自動付与）
}
```

### 商談 Deal

```js
{
  id: string,          // 自動採番（例: `d_${Date.now()}_${rand}`）
  customerId: string,  // 顧客ID（必須、1対多の紐付け）
  title: string,       // 商談タイトル（必須）
  amount: number|null, // 金額 円（任意、整数）
  status: 'lead' | 'proposal' | 'won',  // 必須
  followup: string,    // フォローアップメモ（任意、複数行）
  createdAt: string,   // ISO文字列（自動付与）
  updatedAt: string    // ISO文字列（保存の都度更新）
}
```

### localStorage キー

| キー | 中身 |
|---|---|
| `crm-customers` | Customer[] を JSON.stringify して保存 |
| `crm-deals` | Deal[] を JSON.stringify して保存 |

### 1対多の紐付け方針
- Deal 側が `customerId` を持つ（外部キー方式）
- Customer 側には商談IDの配列を持たせない（正規化を保つ）
- 顧客削除時は `crm-deals` から該当 `customerId` のレコードを全件連鎖削除する

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
- カード左辺に **3px 幅** の縦ラインをステータス色で付ける（`styles.css` で `border-left: 3px solid` を使う）

### 選択中の顧客カード
- 背景 `#fdf2ec`（オレンジの淡色）、左辺にアクセントカラーの3pxライン

---

## 6. やってはいけないこと

- ❌ **npm / yarn / pnpm の使用**：`package.json` は作らない
- ❌ **ビルドツール**（Vite / webpack / Rollup 等）：使わない
- ❌ **サーバーサイド**（Node / Python / PHP 等）：一切書かない
- ❌ **外部API 呼び出し**（`fetch` で外部ドメインを叩く等）：しない
- ❌ **フレームワーク**（React / Vue / Svelte / Alpine.js 等）：import しない
- ❌ **CDN経由の追加ライブラリ**：Tailwind CSS 以外は原則なし
- ❌ **モバイル対応**（レスポンシブ・タッチイベント）：対象外
- ❌ **ドラッグ＆ドロップ**（HTML5 DnD API）：クリックで代替する
- ❌ **CSV・JSON のインポート/エクスポート機能**：作らない
- ❌ **ログイン・認証**：作らない
- ❌ **グローバル変数**：IIFE で閉じる
- ❌ **`any` 相当の雑な型扱い**（JS だが、JSDoc で意図を書いてもよい）
- ❌ **エラーの握りつぶし**：localStorage I/O 失敗時は最低でも `console.error`
