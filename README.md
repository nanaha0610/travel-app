# Travel App

友人と作る旅行サービスの最小限の土台です。React + Vite + JavaScript を使います。
動画一覧・撮影・地図・マイページの4画面と下部ナビゲーションを備えた共同開発用スターターです。撮影・投稿・地図・ログイン機能は未実装です。

## 最初の準備（各自1回）

Node.js 24 LTS と Git を用意し、GitHub の共同開発の招待を承諾します。
まだコピーしていない人は次を実行します。

```sh
git clone https://github.com/nanaha0610/travel-app.git
cd travel-app
```

VS Code で travel-app フォルダを開き、ターミナルで実行します。

```sh
npm ci
npm run dev
```

ターミナルに表示された Local の URL をブラウザで開きます（通常 http://localhost:5173）。
index.html のダブルクリックでは動きません。開発中はターミナルを起動したままにします。
終了は Ctrl + C。次回からは `npm run dev` だけで起動できます。
PowerShell で npm.ps1 の実行エラーが出る場合は、`npm.cmd ci`、`npm.cmd run dev` と入力してください。

## 編集する場所

| ファイル | 役割 |
| --- | --- |
| src/pages/ 内の各ページ | 4画面の文章と構成 |
| src/index.css | 色・余白などの見た目 |
| src/App.jsx | ページを組み合わせる場所 |
| src/main.jsx | React の起動処理（普段は編集不要） |
| index.html | React を表示する入口（文章は HomePage.jsx で編集） |

たとえば FeedPage.jsx の見出しを変えて Ctrl + S で保存すると、開発中の画面に反映されます。
JSX は HTML に似ていますが、class は className、br は <br /> と書きます。

## チームで作業する手順

変更が残っていない状態で、新しい作業を始めます。

```sh
git switch main
git pull --ff-only
npm ci
git switch -c edit-home-taro
```

ブランチ名は人と作業ごとに変えます。編集・保存したらブラウザで確認し、次も実行します。

```sh
npm run build
git status
git add src/pages/FeedPage.jsx
git commit -m "トップページの見出しを変更"
git push -u origin edit-home-taro
```

git add には実際に編集したファイルを指定します。
GitHub で Compare & pull request → Create pull request。
友人が確認してから Merge pull request で main に取り込みます。
エラーや競合が出たら、強制 push せずメッセージを共有します。

## AI と作るときの約束

- 全員がこのリポジトリを使い、別々に React プロジェクトを作り直さない。
- 「React + Vite + JavaScript の既存プロジェクトです」と AI に伝える。
- 1回に1機能ずつ頼み、担当ファイルと変更の理由を確認する。
- ライブラリを増やすときは相談する。package.json と package-lock.json はセットで共有する。
- node_modules と dist は GitHub に送らない。
- API キーやパスワードをコードに書かない。VITE_ で始まる環境変数もブラウザに配信されるため、秘密情報は置かない。

## 公開用ファイルの確認

```sh
npm run build
npm run preview
```

build は dist に公開用ファイルを作ります。preview はそのローカル確認です。
GitHub への push だけではサイトは公開されません。ホスティングの設定は別途行います。

## 4画面の担当ファイル

- 動画一覧：src/pages/FeedPage.jsx
- 撮影：src/pages/CreatePage.jsx
- 地図：src/pages/MapPage.jsx
- マイページ：src/pages/ProfilePage.jsx
- 共通の下部バー：src/components/BottomNav.jsx
- 共通のページ枠：src/components/PageShell.jsx
- 画面の切り替え：src/App.jsx（#feed / #create / #map / #profile）

ブラウザの戻る・進む、各画面での再読み込みにも対応しています。
以前の HomePage.jsx は参考用に残していますが、現在の画面からは使用していません。
共通ファイルを変更する場合は、先にチームで相談してください。
