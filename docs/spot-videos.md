# スポットと動画の公開

撮影後、位置情報から半径600mの観光地・史跡・寺社・公園の候補を検索します。候補は本人が選びます。見つからない場合は場所名で検索できます。画像認識AIは使用していません。

公開チェックは初期状態でオフです。スポットを選んでも許可しなければ動画は所有者のみ閲覧できます。公開すると地図のオレンジの▶ピンからログインなしで再生できます。保存済み動画の「公開を取り消す」で新規取得を停止できます。取得済みのコピーは回収できません。実際にインターネットから利用するには別途アプリの公開が必要です。

## DB変更とチームの更新手順

既存のデータを消さず `spots`（OSMのスポットID・名前・座標）と `video_spots`（動画との対応・公開可否・許可日時）を追加します。従来の動画は非公開のままです。

server フォルダーで `npm run db:init` を実行してから API サーバーを再起動します。同じAiven DBを使う場合、テーブル作成は一度で十分です。.env は共有リポジトリに入れません。

## API

- GET /api/spots/search?q=場所名 または latitude,longitude：ログイン必須。検索結果の共通スポットIDを返す。
- POST /api/trips/:id/videos：既存の動画保存に spotId と publish=true/false を追加。省略時は非公開。
- GET /api/public/spots：公開動画があるスポットのみ、最新100件。
- GET /api/public/spots/:id/videos：公開動画20件ずつ。beforeで続き。
- GET /api/public/videos/:id/content：公開中の動画のみ。
- POST /api/videos/:id/visibility：所有者のみ、JSON {"isPublic":true/false}。

公共APIは旅行名・アカウント・撮影日時・撮影GPSを返しません。スポット中心の座標を表示します。動画そのものに映る情報や音声は公開対象です。

## 検証

serverで `node --env-file=.env scripts/check-spot-publication.mjs`。一時ユーザー・一時動画による公開、非公開、取り消し、所有権、再送、失敗時の取り消しを実DBで検証し、生成行は最後にロールバックします。

## 検索の制限

Nominatimは手動検索のみ。サーバー全体で検索を1.1秒以上間隔に制限し、結果を5分キャッシュ。利用者ごとではなくIPごとに毎分10回まで。公共サービスが混雑すると候補取得に失敗する場合があります。小規模授業用であり、利用増加時には専用の検索サービスを検討してください。

https://operations.osmfoundation.org/policies/nominatim/
https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
`SPOT_SEARCH_URL` / `SPOT_NEARBY_URL` をサーバーの環境変数で指定すると、互換の検索サービスに切り替えられます。変更後はAPIサーバーを再起動してください。
