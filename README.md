# Travel App

友人と一緒に作る旅行サービスの土台です。
HTML・CSS・JavaScript だけで動きます。インストールやビルドは不要です。
検索・予約・ログイン・データ保存はまだありません。

## サイトを開く

`index.html` をダブルクリックしてブラウザで開きます。
ファイルを編集して保存したら、ブラウザを再読み込みします。

## 編集する場所

| ファイル | 役割 | 最初に試すこと |
| --- | --- | --- |
| index.html | 文章や構成 | タイトル・旅の説明を変える |
| style.css | 色や見た目 | 色・余白を変える |
| script.js | 動き | JavaScript を追加する |

## 管理する人：GitHub の共有場所を作る

1. GitHub にログインして https://github.com/new を開く。
2. Repository name を `travel-app` にする。
3. 友人だけで作るなら **Private** を選ぶ。
4. **Add README** を有効にして **Create repository** を押す。
5. 作成したリポジトリで **Add file → Upload files** を開く。
6. このフォルダの中身をアップロードする。`travel-app` フォルダ自体ではなく、`index.html` などを直下に置く。README.md は今回のものに置き換える。`.gitignore` も含める。
7. メッセージに「旅行アプリの土台を追加」と書いて **Commit changes** で保存する。
8. **Settings → Collaborators → Add people** から友人の GitHub ユーザー名を指定して招待する。友人が招待を承諾すると push できる。

ブラウザからのアップロードでも GitHub 上にコミットが作られます。
この操作はコードの共有です。Web サイトの一般公開は別の作業です。

## みんな：最初の準備

Git をインストールし、GitHub の招待を承諾しておきます。
リポジトリの **Code → HTTPS** に表示される URL をコピーします。
ターミナルで、下の URL を自分たちのものに置き換えて実行します。

```sh
git clone https://github.com/YOUR-NAME/travel-app.git
cd travel-app
```

初めて Git を使う人は、自分の名前とメールアドレスをこのリポジトリに設定します。
公開したくない場合は GitHub のメール設定にある noreply アドレスを使えます。

```sh
git config user.name "自分の名前"
git config user.email "自分のメールアドレス"
```

## 毎回の作業：自分のブランチで編集して push

ブランチは、自分の変更を作る作業場所です。
作業中の変更をコミットし終えてから、次の作業を始めます。

```sh
git switch main
git pull --ff-only origin main
git switch -c change-title-taro
```

`change-title-taro` は例です。作業ごとに別の名前にしてください。
ファイルを編集・保存して、ブラウザで確認したら実行します。

```sh
git status
git add index.html
git commit -m "トップページの見出しを変更"
git push -u origin change-title-taro
```

`git add` には編集したファイル名を指定します。CSS を変えた場合は `git add style.css` です。
認証画面が出たら自分の GitHub アカウントでログインします。
push 後、GitHub で **Compare & pull request** → **Create pull request**。
友人に変更を見てもらい、問題なければ **Merge pull request** で main に取り込みます。
push しただけでは main は更新されません。

エラーが出たら、そのメッセージを共有してください。無理に force push する必要はありません。
最初は「文章担当」「見た目担当」など、同じファイルを同時に変えない分担が簡単です。

## 公式の案内

- リポジトリの作成：https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- 友人の招待：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository
