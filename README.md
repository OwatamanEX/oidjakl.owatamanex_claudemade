# Desk — 便利機能ダッシュボード（PWA）

メモ/ToDo・タイマー（ポモドーロ）・電卓/単位変換・天気をひとつにまとめた、
ChromeOSにインストールできるPWA（Progressive Web App）です。

## ファイル構成

```
desk-pwa/
├── index.html      # ページ本体
├── style.css       # デザイン
├── app.js          # 動作ロジック
├── manifest.json   # PWA設定（アプリ名・アイコン・起動URLなど）
├── sw.js           # Service Worker（オフライン対応のキャッシュ制御）
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

外部APIキーは一切不要です（天気は [Open-Meteo](https://open-meteo.com/) という
登録不要・無料のAPIを使用しています）。

---

## 公開方法：GitHub Pages（無料・最短ルート）

### 1. GitHubアカウントを作る
すでに持っている場合はスキップしてください。
https://github.com/signup

### 2. 新しいリポジトリを作る
1. GitHubの右上「+」→「New repository」
2. Repository name を入力（例: `desk-pwa`）
3. Public を選択（GitHub Pagesの無料利用にはPublicが必要）
4. 「Create repository」をクリック

### 3. このフォルダの内容をアップロードする
ブラウザ操作だけで完結する方法：
1. 作成したリポジトリのページで「uploading an existing file」というリンクをクリック
2. `desk-pwa` フォルダの中身（`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icons/` フォルダ）を
   まとめてドラッグ＆ドロップ
   - **フォルダごとではなく、フォルダの中身をアップロードしてください**
     （`index.html` がリポジトリの直下に来るようにする）
3. 下部の「Commit changes」をクリック

コマンド操作に慣れている場合は、ターミナルで以下でも可能です：
```bash
cd desk-pwa
git init
git add .
git commit -m "Desk PWAを公開"
git branch -M main
git remote add origin https://github.com/【あなたのユーザー名】/desk-pwa.git
git push -u origin main
```

### 4. GitHub Pagesを有効化する
1. リポジトリの「Settings」タブを開く
2. 左メニューの「Pages」をクリック
3. 「Build and deployment」の「Source」で `Deploy from a branch` を選択
4. 「Branch」で `main` と `/ (root)` を選んで「Save」
5. 数十秒〜数分待つと、ページ上部に公開URLが表示されます
   （例: `https://【ユーザー名】.github.io/desk-pwa/`）

### 5. ChromeOSにインストールする
1. ChromeOSのChromeブラウザで上記URLを開く
2. アドレスバー右側の「インストール」アイコン（パソコンに矢印のアイコン）をクリック
   - 表示されない場合は、画面右上の「︙」メニュー →
     「アプリ」または「Desk をインストール」を選択
3. 「インストール」を押すと、ランチャー（シェルフ）にアプリとして追加されます

これでブラウザのタブを開かずに、独立したウィンドウのアプリとして起動できるようになります。

---

## 公開方法の代替案

### Netlify（ドラッグ＆ドロップで一番簡単）
1. https://app.netlify.com/drop を開く（要 無料アカウント登録）
2. `desk-pwa` フォルダをそのままブラウザにドラッグ＆ドロップ
3. 数秒で `https://ランダムな文字列.netlify.app` のURLが発行される
4. 後から「Site settings」でドメイン名（サブドメイン部分）を変更可能

### Vercel
1. https://vercel.com にGitHubアカウントでログイン
2. 「Add New」→「Project」→ 先ほどGitHubに上げたリポジトリを選択
3. 設定はデフォルトのままで「Deploy」
4. `https://プロジェクト名.vercel.app` が発行される

どちらもGitHub Pagesと同様、静的ファイルをそのまま配信するだけなので、
このプロジェクトの構成（ビルド不要・フレームワークなし）にそのまま使えます。

---

## 公開後にカスタマイズしたいとき

- **アプリ名やアイコンを変える**: `manifest.json` の `name` / `short_name` を編集し、
  `icons/` フォルダの画像を差し替える
- **配色を変える**: `style.css` の先頭 `:root{ ... }` 内の色（`--ink`, `--brass` など）を編集
- **天気のデフォルト都市を変える**: 今は検索式なので変更不要ですが、
  初期表示で自動的に特定の街を出したい場合は `app.js` の天気セクション末尾に
  `fetchWeather(緯度, 経度, '都市名')` を追記する

## 注意点

- Service Worker（オフライン対応）はHTTPS環境でのみ正常に動作します。
  GitHub Pages / Netlify / Vercel はいずれも自動でHTTPS化されるため、特別な設定は不要です。
- 自分のパソコンで`index.html`を直接ダブルクリックして開く（`file://`）と、
  PWAのインストールや天気APIの取得が正しく動かない場合があります。
  動作確認は上記でデプロイしたURL、またはローカルサーバー経由で行ってください。
