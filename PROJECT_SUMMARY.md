# プロジェクト概要: CULTIReFINEクリニック 予約システム

## 1. 概要

本プロジェクトは、CULTIReFINEクリニックの顧客向けLINE連携予約システムです。LINEの認証機能を利用してユーザーを識別し、施術の予約受付、書類の確認、保有チケットの管理機能を提供します。

システムは主に2つの環境で構成されています。

1.  **`cultirefine.com/`**: 一般向けの静的なウェブサイト。
2.  **`reserve/`**: LINE認証を必要とする動的な予約システム本体 (PHP + JavaScript)。

## 2. 技術スタック

-   **フロントエンド**:
    -   HTML5
    -   CSS3 (Tailwind CSS)
    -   Vanilla JavaScript (ES6 Modules)
-   **バックエンド**:
    -   PHP 8.x
-   **API**:
    -   Google Apps Script (GAS) Web App
-   **データベース**:
    -   Google Sheets (GAS API経由で操作)
-   **認証**:
    -   LINE Login (OAuth 2.0)
-   **開発環境**:
    -   PHPビルトインサーバー (`php -S`)
    -   `ngrok` (LINE認証のHTTPS要件のため)

## 3. 主要機能

-   **LINE認証**: LINEアカウントを利用したユーザー認証。
-   **患者選択**:
    -   単独予約
    -   ペア予約（同室）
    -   複数人一括予約
-   **予約フロー**:
    -   施術メニュー選択（階層構造のアコーディオンUI）
    -   日時選択（カレンダーとタイムスロット）
    -   予約内容の確認と確定
-   **書類管理**: 登録ユーザー向けの書類（同意書など）を一覧表示・プレビュー。
-   **チケット管理**: 保有する施術チケットの枚数（合計、利用可能、予約済み、使用済み）を確認。

## 4. ディレクトリ構造と主要ファイル

```
/
├── cultirefine.com/              # 静的サイト (本番用)
│   ├── reserve/                  # 予約システムのフロントエンド部分 (HTML/JS/CSS)
│   │   ├── index.html            # 予約システムのメインHTML
│   │   ├── js/                   # JavaScript モジュール
│   │   │   ├── core/             # アプリケーションのコアロジック (状態管理、ヘルパー)
│   │   │   ├── components/       # UIコンポーネント (カレンダー, アコーディオン)
│   │   │   ├── data/             # データ層 (GAS API連携, モックデータ)
│   │   │   ├── screens/          # 画面別ロジック (患者選択, メニュー選択など)
│   │   │   └── main.js           # JSのエントリーポイント
│   │   ├── document/             # 書類一覧ページ
│   │   └── ticket/               # チケット管理ページ
│   └── ...
├── reserve/                      # 予約システムのバックエンド部分 (PHP)
│   ├── line-auth/                # LINE認証関連
│   │   ├── LineAuth.php          # LINE OAuth 2.0 処理クラス
│   │   ├── GasApiClient.php      # GAS API通信クライアント
│   │   ├── callback.php          # LINEからのコールバック処理
│   │   └── config.php            # 環境変数読み込み、設定
│   ├── api-bridge.php            # フロントエンドJSとGAS APIを中継するAPI
│   ├── index.php                 # 認証後のトップページ
│   └── ...
├── CLAUDE.md                     # AIアシスタント向けの開発ガイドライン
├── GAS_API_仕様書.md             # GAS APIの仕様定義
├── GAS_API修正指示書.md          # GAS APIの修正要件
└── start-local-server.sh         # ローカル開発サーバー起動スクリプト
```

## 5. API (Google Apps Script)

-   **認証**: Bearer Token認証（APIキーはPHP側で環境変数として管理）。
-   **レスポンス形式**: 全てJSON形式。HTMLを返さないように修正が必要（`GAS_API修正指示書.md`参照）。
-   **主要エンドポイント**:
    -   `GET /api/users/line/{lineUserId}/full`: LINEユーザーIDに紐づく全情報（患者情報、施術履歴、予約、チケットなど）を取得。
    -   `GET /api/documents/visitor/{visitorId}`: 書類一覧を取得。
    -   `GET /api/availability`: 指定日時の空き状況を確認。
    -   `POST /api/reservations`: 新規予約を作成。
    -   `DELETE /api/reservations/{reservationId}`: 予約をキャンセル。

## 6. 開発フローと注意点

-   **ローカル開発**: `start-local-server.sh` を実行してPHPのビルトインサーバーを起動する。LINE認証のテストには `ngrok` などでHTTPS化が必要。
-   **デュアル環境**: `cultirefine.com/reserve/` と `reserve/` の2つのディレクトリに同じようなJSファイル群が存在する。これは静的HTML版とPHP版でフロントエンドロジックを共有しているためで、開発時には両者の同期に注意が必要。
-   **状態管理**: フロントエンドでは、`localStorage` を利用して予約フローの途中状態を保持している (`clutirefine_booking_data`, `clutirefine_completion_data`)。
-   **API連携**: フロントエンドのJavaScriptは直接GAS APIを叩かず、PHPの `api-bridge.php` を経由して通信する。これにより、APIキーなどの機密情報をフロントエンドから隠蔽している。
