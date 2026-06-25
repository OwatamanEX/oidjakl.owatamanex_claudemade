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
