# Medical Force API連携プロジェクト - 開発状況

## プロジェクト概要

Medical Force APIとGoogle Apps Script (GAS)を連携させ、スプレッドシートでデータ管理を行うシステムの開発プロジェクトです。

## 完了した作業

### 1. Medical Force API調査 (2025-06-20)

#### 取得したAPIエンドポイント（28個）

Base URL: `https://api.medical-force.com`

**主要カテゴリ：**
- クリニック管理 (1)
- 患者（visitor）管理 (4)
- 予約管理 (9)
- 役務（コース）管理 (2)
- 在庫管理（薬剤・商品）(2)
- メニュー管理 (2)
- 問い合わせ管理 (1)
- 顧客管理 (1)

詳細は `api-endpoints-list.md` に記載。

### 2. GAS実装 (2025-06-20)

#### 作成したファイル構成

```
src/
├── 00_globals.js          # グローバル宣言
├── Config.js              # API設定管理
├── ApiClient.js           # API通信基盤
├── Utils.js               # ユーティリティ関数
├── SpreadsheetManager.js  # スプレッドシート管理
├── VisitorService.js      # 患者管理サービス
├── ReservationService.js  # 予約管理サービス
├── Main.js                # メイン処理・カスタムメニュー
├── InitDialog.html        # 初期設定画面
├── appsscript.json        # GAS設定
└── README.md              # 使用方法
```

#### 実装した機能

1. **基本機能**
   - API認証（Bearer Token）
   - エラーハンドリング
   - ログ記録

2. **データ管理機能**
   - 患者情報の同期・登録・検索
   - 予約情報の同期・作成・空き確認
   - 自動同期（日次・時間ごと）

3. **スプレッドシート構成**
   - 設定シート
   - 患者マスタ
   - 予約管理
   - 役務管理
   - 在庫管理
   - メニュー管理
   - 実行ログ

### 3. clasp環境構築 (2025-06-20)

#### セットアップ内容

1. **必要なパッケージ**
   - `@google/clasp` (グローバル)
   - `@types/google-apps-script` (開発用)
   - `playwright` (API調査用)

2. **設定ファイル**
   - `.clasp.json` - claspプロジェクト設定
   - `.claspignore` - アップロード除外設定
   - `tsconfig.json` - TypeScript設定
   - `package.json` - npmスクリプト

3. **npmスクリプト**
   ```json
   "login": "clasp login",
   "push": "clasp push",
   "pull": "clasp pull",
   "open": "clasp open",
   "logs": "clasp logs",
   "deploy": "clasp deploy",
   "watch": "clasp push --watch"
   ```

## 次のステップ

### 1. GASプロジェクトの作成とデプロイ

```bash
# 1. Googleアカウントでログイン
npm run login

# 2. 新規プロジェクト作成 or 既存プロジェクトのIDを設定
npm run create  # 新規の場合
# または .clasp.json にscriptIdを設定

# 3. コードをアップロード
npm run push

# 4. スプレッドシートでテスト
npm run open
```

### 2. 認証情報の設定

スクリプトプロパティに以下を設定：
- `MEDICAL_FORCE_API_KEY`: Medical ForceのAPIキー
- `CLINIC_ID`: クリニックID

### 3. 追加実装候補

#### 未実装のサービス
- `CourseService.js` - 役務（コース）管理
- `InventoryService.js` - 在庫管理
- `MenuService.js` - メニュー管理
- `InquiryService.js` - 問い合わせ管理

#### 機能拡張
- バッチ処理の最適化
- データ検証機能
- エクスポート機能（CSV/PDF）
- 通知機能（メール/Slack）
- ダッシュボード機能

### 4. テストとドキュメント

- 単体テストの作成
- 統合テストの実施
- APIリファレンスの作成
- 運用マニュアルの作成

## ファイル一覧

### ドキュメント
- `PROJECT_STATUS.md` - このファイル
- `CLASP_SETUP.md` - clasp使用方法
- `api-endpoints-list.md` - API一覧
- `api-documentation.json` - API詳細仕様
- `src/README.md` - GAS使用方法

### 設定ファイル
- `.clasp.json` - claspプロジェクト設定
- `.claspignore` - アップロード除外設定
- `tsconfig.json` - TypeScript設定
- `package.json` - npmパッケージ設定
- `src/appsscript.json` - GAS設定

### ソースコード
- `src/*.js` - GASソースコード（11ファイル）
- `src/InitDialog.html` - 初期設定UI

### ツール
- `fetch-api-docs.js` - API仕様取得スクリプト
- `clasp-test.js` - claspセットアップテスト

## 環境情報

- 作業ディレクトリ: `/Users/ash-_/プログラミング/天満病院/dev`
- Node.js: v24.1.0
- clasp: 3.0.6-alpha
- 開発日: 2025-06-20

## 注意事項

1. **セキュリティ**
   - APIキーはコードに直接記載せず、スクリプトプロパティを使用
   - 医療情報を扱うため、適切なアクセス制限を設定

2. **APIレート制限**
   - Medical Force APIのレート制限に注意
   - 大量データの同期は分割して実行

3. **実行時間制限**
   - GASの6分制限に注意
   - 長時間処理はバッチ分割を検討

## 連絡先・参考情報

- Medical Force API: https://developer.medical-force.com/
- Google Apps Script: https://developers.google.com/apps-script
- clasp: https://github.com/google/clasp