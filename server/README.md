# アカウント・旅行 API

Node.js 24 / Express / MySQL。画面は今回変更していません。
実装済み：登録、ログイン、ログアウト、本人確認、本人の旅行作成・一覧。
未実装：メール確認、パスワード再設定、動画保存、旅行の更新・削除、公開・他人の投稿閲覧。
メールの所有確認はまだないため、登録メールが本人のものと確認済みであると扱わないでください。

## セットアップ

リポジトリ直下から `cd server` → `npm ci`。
初回のみ `.env.example` を `.env` にコピーして編集。既存の .env は上書きしないでください。

Aiven の接続情報を DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME に設定します。
DB_NAME は Aiven に存在する専用の開発用DB名（初期の defaultdb を使う場合はそれを指定）。
DB_CREATE_DATABASE=false。ローカルでDBも作りたい場合のみ true にします。
Aiven では DB_SSL=true、DB_CA_FILE にダウンロードした CA 証明書の絶対パスを指定します。
証明書検証を無効にしないでください。DB設定に VITE_ 接頭辞を付けないでください。

`npm run db:init` で profiles / trips / auth_users / auth_sessions を作成します。
既存テーブルやレコードは削除しません。旧テストユーザーID 1の旅行を新規アカウントへ割り当てることもありません。
schema.sql は初期化用で、既存テーブルを別構造へ更新する移行処理ではありません。
次に `npm run dev`。ローカル API は http://127.0.0.1:3001。
PowerShell で npm.ps1 エラーが出る場合は npm.cmd を使います。

## API仕様

全て JSON。エラーは `{ "error": "説明" }`。

| Method | Path | 入力 | 成功時 |
| --- | --- | --- | --- |
| POST | /api/auth/register | email, password, displayName | 201: user, token, expiresAt |
| POST | /api/auth/login | email, password | 200: user, token, expiresAt |
| GET | /api/auth/me | Bearer認証 | 200: user |
| POST | /api/auth/logout | Bearer認証 | 204: 本文なし |
| GET | /api/trips | Bearer認証 | 200: trips（本人のみ、最新100件） |
| POST | /api/trips | Bearer認証、title | 201: trip（下書き） |
| GET | /api/health | なし | 200: status, database |

user は `{ id: "文字列", email, display_name }`。
パスワードは12〜128文字。表示名はtrim後1〜100文字。メールはASCII形式、trim＋小文字で保存します。
旅行 title はtrim後1〜100文字。owner_id はクライアントから指定できません。
400入力不正、401認証失敗/期限切れ、403接続元不許可、409登録競合、413サイズ超過、429試行過多、503DB等の障害。

認証は `Authorization: Bearer <token>` ヘッダー。Cookie認証ではありません。
有効期限は24時間。セッションはMySQLにハッシュだけを保存、ログアウトで現在のトークンを失効させます。
フロントではトークンをReactのメモリに保持し、localStorage・URL・ログへ保存しないでください。
この最小構成ではページの再読み込みで再ログインが必要です。永続ログインは別途設計します。
パスワードはバックエンドでscrypt＋ランダムsaltによりハッシュ化し、平文保存しません。

```js
const response = await fetch(`${API_BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await response.json();
if (!response.ok) throw new Error(data.error);
// data.token は共通のReact認証状態に保持する
const tripsResponse = await fetch(`${API_BASE}/api/trips`, {
  headers: { Authorization: `Bearer ${data.token}` },
});
```

## クラウド公開前の設定

Render想定：Root Directory=server、Build Command=npm ci、Start Command=node src/index.js。
環境変数に NODE_ENV=production、HOST=0.0.0.0、DB設定、ALLOWED_ORIGINS を設定します。
ALLOWED_ORIGINS は画面の正確な origin（例 https://example.pages.dev）。複数はカンマ区切り。末尾スラッシュは付けません。
DB_CA_FILE は Render の Secret File のパスを指定。HTTP経由でパスワードやトークンを送らずHTTPSを使います。
TRUST_PROXY_HOPS は実際のリバースプロキシ構成を確認して設定（通常のRender構成は1が候補）。無条件に trust proxy=true にしません。
IP単位で登録＋ログイン合計20回/15分まで。現状はプロセス内の制限なので、複数インスタンス運用では共有ストアが必要です。
期限切れセッションの定期削除は `DELETE FROM auth_sessions WHERE expires_at <= UTC_TIMESTAMP()` を運用側で実施します。
バックエンド・Aivenの接続確認とHTTPS実機テストが完了するまでは公開完了と扱わないでください。

## 検証

`npm test`：パスワード検証、登録・ログイン・失効、重複登録、所有者分離、入力検証、CORS、回数制限。
テストDBはメモリ上の代替実装です。MySQLのSQL実行・永続化・TLS接続は別途実DBで検証が必要です。
実DBでは2人のアカウントを登録し、互いの旅行が一覧に混ざらないこと、再起動後もログインと旅行データが残ることを確認してください。
