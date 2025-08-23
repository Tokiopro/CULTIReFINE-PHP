# プロジェクト概要

## 基本情報
- **プロジェクト名**: CULTIReFINE-PHP（天満病院予約システム）
- **目的**: LINE認証と連携した医療予約管理システム
- **デプロイ先**: さくらサーバー

## 技術スタック
- **フロントエンド**: Vanilla JavaScript (ES6モジュール), HTML5, CSS3
- **バックエンド**: PHP, Google Apps Script (GAS API)
- **認証**: LINE Login OAuth 2.0
- **データストア**: Google Sheets (GAS経由)
- **外部連携**: Medical Force API

## 環境構成
1. **cultirefine.com/** - 本番用（静的HTML版）
   - 静的HTMLファイルで構成
   - JavaScript モジュールは CDN から読み込み
   - PHPを使用しない軽量版

2. **reserve/** - 開発・本番用（PHP版）
   - LINE認証機能付き
   - PHP セッション管理
   - 環境変数による設定管理

## アーキテクチャ
### PHPバックエンド構成
```
reserve/
├── line-auth/          # LINE認証関連
│   ├── LineAuth.php    # LINE OAuth実装
│   ├── GasApiClient.php # GAS API クライアント
│   ├── ExternalApi.php  # API統合レイヤー
│   └── callback.php    # LINE認証コールバック
├── api-bridge.php      # API通信ブリッジ
└── index.php           # メインエントリー
```

### JavaScript フロントエンド構成
```
js/
├── core/               # コアユーティリティ
├── components/         # UIコンポーネント
├── screens/            # 画面別ロジック
├── data/               # データ層
└── main.js             # エントリーポイント
```