# Vercelで公開する

リポジトリのルートをViteプロジェクトとしてImportします。vercel.jsonがビルドと/apiの転送を設定します。画面とAPIは同一URLなので、公開環境にVITE_API_BASE_URLは設定しません。

VercelのEnvironment Variables（Production）に以下を設定します。値は既存のAiven接続情報を使用し、Gitには保存しません。
- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD
- DB_SSL=true
- DB_CA_PEM：AivenのCA証明書の本文。実改行またはリテラルの\nを使用可能。
- NODE_ENV=production

DB_CA_FILEにPC上のパスを指定してもクラウドから読めません。DB_CA_PEMを使用します。データベース構造は既存のままです。

GitHubのmainをProduction Branchにすると、その更新時に自動デプロイされます。アプリで公開許可した旅行・スポット動画だけが匿名閲覧可能です。HTTPSで開くとスマホのカメラ・位置情報も利用できます（ブラウザーでの許可が必要）。

現状は授業用の小規模試作です。動画は1本2MB・1旅行20本、Aivenの合計容量にも制限があります。Vercel Functionsの送受信上限4.5MB以内に収めています。公開サービスのレート制限は単一インスタンス内であり、大規模運用前には共有ストアの利用が必要です。
