# アカウント・旅行 API

Node.js 24 / Express / MySQL。撮影画面とマイページで共通の認証状態を利用します。
実装済み：登録、ログイン、ログアウト、本人確認、本人の旅行作成・一覧、旅行別の短い動画保存・取得。
未実装：メール確認、パスワード再設定、旅行の更新・削除、公開・他人の投稿閲覧。
メールの所有確認はまだないため、登録メールが本人のものと確認済みであると扱わないでください。

## セットアップ

リポジトリ直下から `cd server` → `npm ci`。
初回のみ `.env.example` を `.env` にコピーして編集。既存の .env は上書きしないでください。

Aiven の接続情報を DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME に設定します。
DB_NAME は Aiven に存在する専用の開発用DB名（初期の defaultdb を使う場合はそれを指定）。
DB_CREATE_DATABASE=false。ローカルでDBも作りたい場合のみ true にします。
Aiven では DB_SSL=true、DB_CA_FILE にダウンロードした CA 証明書の絶対パスを指定します。
証明書検証を無効にしないでください。DB設定に VITE_ 接頭辞を付けないでください。

`npm run db:init` で profiles / trips / auth_users / auth_sessions / trip_places / trip_videos を作成します。
既存テーブルやレコードは削除しません。旧テストユーザーID 1の旅行を新規アカウントへ割り当てることもありません。
schema.sql は初期化用で、既存テーブルを別構造へ更新する移行処理ではありません。
次に `npm run dev`。ローカル API は http://127.0.0.1:3001。
PowerShell で npm.ps1 エラーが出る場合は npm.cmd を使います。

## API仕様

動画の送信・取得以外は JSON。エラーは `{ "error": "説明" }`。

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

## 3秒動画・旅行別保存（MySQL試作）

`npm run db:init` は既存データを消さず、未作成テーブルを追加します。新規は trip_places（旅行・場所名・将来用の座標）と trip_videos（撮影日時・形式・サイズ・MEDIUMBLOBの動画本体）。現在の画面は場所名の手入力で、座標や地図のピンとの連携は未実装です。

起動：serverで `npm run dev`、別のターミナルでプロジェクト直下の `npm run dev`。プロジェクト直下の .env.local に VITE_API_BASE_URL=http://127.0.0.1:3001 を設定し、server/.env の ALLOWED_ORIGINS に画面の正確なURL（例 http://localhost:5173）を設定します。別ポートの場合はそのURLを追加し、両方のサーバーを再起動してください。既存のマイページと同じAPI接続設定を使います。

動画作成画面で登録／ログイン → 旅行作成／選択 → 場所名入力 → 3秒撮影 → この旅行に保存。上部には旅行名と今日の動画を撮影日時順に表示します。「今日の動画だけ表示」を外すと全日程の動画を確認できます。表示時刻は閲覧端末のタイムゾーンです。更新後は再ログインが必要ですが保存動画は残ります。認証トークンはメモリのみです。

- GET /api/trips/:tripId/videos：本人の旅行のメタデータ一覧（BLOBを含まない）
- POST /api/trips/:tripId/videos?uploadId=UUID&capturedAt=ISO日時&place=場所名：Content-Type video/webm または video/mp4、生バイナリ、上限2097152バイト。再試行時は同じuploadIdを使用。
- GET /api/videos/:videoId/content：Bearer認証＋所有者照合後にバイナリを返す。

全APIで所有者確認。親の旅行行をFOR UPDATEでロックし、同時保存でも20本を超えないようにする。動画の一覧では本体を取得せず、再生ボタンを押した1本だけを取得。ファイル先頭の形式と容量を検査するが、完全なメディア解析は未実装。3秒はカメラの自動停止目標で、ブラウザの負荷により長くなる可能性があり、サーバー側で実際の再生時間を検証・変換していない。公開サービス化前に動画解析・ユーザー全体の容量制限・削除機能を追加すること。

DB容量には別途全体上限がある。1旅行20本の制限はDB全体の容量を保証しない。旅行数に応じてAivenの容量を確認する。画面を離れると未保存動画は失われる。


### この変更の確認手順

1. 最新ブランチを取得し、プロジェクト直下と server それぞれで `npm ci` を実行。
2. server/.env の既存接続設定を確認し、server で `npm run db:init` を実行。追加は trip_places / trip_videos の2テーブル。既存データは削除しない。接続に失敗した場合は先にホスト・稼働状態・ネットワークを確認する。
3. 両サーバーを起動し、マイページでログイン・旅行作成 → 撮影画面に移動。同じログインと旅行が使えることを確認。
4. 場所名を入力し、3秒撮影 → 再生確認 → 「この旅行に保存」。上部に撮影日時と場所が表示され、保存動画を再生できることを確認。
5. 再読み込み・再ログイン後も動画が残り、別の旅行・別のアカウントには混ざらないことを確認。
6. 「今日の動画だけ表示」の切り替えと、撮り直し・破棄・カメラを閉じる操作を確認。

自動テスト：server で `npm test`。プロジェクト直下で `node --test --test-isolation=none tests/api-client.test.mjs` と `npm run build`。
Windowsの制限環境でVite設定読込時に spawn EPERM が出る場合は `npm run build -- --configLoader native`。
実DBのAPI検証は server で `node --env-file=.env scripts/check-video-db.mjs`（テスト行はトランザクション終了時にロールバック）。この検証は保存APIとバイナリ一致を確認し、実カメラや動画の再生可否は別途ブラウザーで確認する。
