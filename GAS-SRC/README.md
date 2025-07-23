# Medical Force API × Google スプレッドシート連携システム

Medical Force APIとGoogleスプレッドシートを連携するGoogle Apps Script (GAS) プロジェクトです。

> **📝 Note**: このプロジェクトは clasp でローカル管理されています。詳細は [CLASP_SETUP.md](../CLASP_SETUP.md) を参照してください。

## 機能

- **患者情報管理**: 患者マスタの同期・検索・登録
- **予約管理**: 予約情報の同期・作成・空き時間確認
- **自動同期**: 定期的なデータ同期（日次・時間ごと）

## セットアップ手順

### 1. スプレッドシートの準備

1. 新しいGoogleスプレッドシートを作成
2. 「拡張機能」→「Apps Script」でスクリプトエディタを開く

### 2. GASファイルの追加

以下のファイルをスクリプトエディタに追加してください：

1. `Config.gs` - API設定管理
2. `ApiClient.gs` - API通信基盤
3. `Utils.gs` - ユーティリティ関数
4. `SpreadsheetManager.gs` - スプレッドシート管理
5. `VisitorService.gs` - 患者管理機能
6. `ReservationService.gs` - 予約管理機能
7. `Main.gs` - メイン処理とメニュー
9. `InitDialog.html` - 初期設定画面

### 3. 認証情報の設定

1. スクリプトエディタで「プロジェクトの設定」（歯車アイコン）を開く
2. 「スクリプト プロパティ」セクションで以下を追加：
   - `MEDICAL_FORCE_CLIENT_ID`: Medical ForceのクライアントID（OAuth 2.0）
   - `MEDICAL_FORCE_CLIENT_SECRET`: Medical Forceのクライアントシークレット（OAuth 2.0）
   - `CLINIC_ID`: クリニックID
   
   ※ 注意: OAuth 2.0認証を使用しています。以前の `MEDICAL_FORCE_API_KEY` は不要です。

### 4. 初期設定の実行

1. スプレッドシートに戻り、リロード
2. メニューバーに「Medical Force連携」が表示される
3. 「Medical Force連携」→「初期設定」を選択
4. ダイアログの指示に従って設定を完了

## 使用方法

### データ同期

メニューから各種同期を実行できます：

- **患者情報を同期**: 患者マスタを最新に更新
- **予約情報を同期**: 予約データを取得
- **すべてのデータを同期**: 全データを一括同期

### 自動同期の設定

```javascript
// Main.gsでsetupTriggers()を実行
setupTriggers();
```

以下のスケジュールで自動同期されます：
- 日次同期: 毎日午前2時
- 更新同期: 1時間ごと

### カスタマイズ

#### 同期する項目の追加

新しいAPIエンドポイントを追加する場合：

1. `Config.gs`のendpointsに追加
2. `ApiClient.gs`に対応するメソッドを追加
3. 必要に応じて新しいServiceクラスを作成

#### シートの構成変更

`SpreadsheetManager.gs`の各初期化メソッドでヘッダーを変更できます。

## トラブルシューティング

### 認証エラーが発生する場合

1. APIキーとクリニックIDが正しく設定されているか確認
2. APIキーの有効期限を確認
3. プランに加入しているか確認

### データが同期されない場合

1. 「実行ログ」シートでエラーを確認
2. スクリプトエディタの「実行」→「関数を実行」→「testConnection」で接続テスト

### 実行時間制限エラー

大量のデータを同期する場合、6分の実行時間制限に達することがあります。
その場合は、同期する期間や件数を調整してください。

## 注意事項

- **セキュリティ**: APIキーは必ずスクリプトプロパティに保存してください
- **医療情報**: 患者情報を扱うため、適切なアクセス制限を設定してください
- **レート制限**: APIのレート制限に注意してください

## ファイル構成

```
gas-project/
├── Config.gs              # API設定管理
├── ApiClient.gs           # API通信クライアント
├── Utils.gs               # ユーティリティ関数
├── SpreadsheetManager.gs  # スプレッドシート操作
├── VisitorService.gs      # 患者管理サービス
├── ReservationService.gs  # 予約管理サービス
├── Main.gs                # メイン処理
├── InitDialog.html        # 初期設定画面
└── README.md              # このファイル
```

## ライセンス

このプロジェクトは天満病院向けに開発されました。