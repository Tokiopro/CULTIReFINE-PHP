# PHP-GAS連携API 共通仕様

## 認証方式

全てのAPIで共通のAPIキー認証を使用します。

**認証ヘッダー**
```
X-API-Key: {your_api_key}
```

**ベースURL**
```
https://script.google.com/macros/s/{deployment_id}/exec
```

## 共通エラーコード一覧

| エラーコード | 説明 | HTTPステータス |
|-------------|------|--------------|
| INVALID_API_KEY | APIキーが無効 | 401 |
| INVALID_REQUEST | リクエストパラメータ不正 | 400 |
| PATIENT_NOT_FOUND | 患者が見つからない | 404 |
| MENU_NOT_FOUND | メニューが見つからない | 404 |
| ROOM_NOT_AVAILABLE | 部屋が利用不可 | 409 |
| TREATMENT_INTERVAL_VIOLATION | 施術間隔制限違反 | 409 |
| RESERVATION_CONFLICT | 予約競合 | 409 |
| INSUFFICIENT_TICKETS | チケット不足 | 409 |
| MEDICAL_FORCE_API_ERROR | Medical Force API エラー | 502 |
| SPREADSHEET_SYNC_ERROR | スプレッドシート同期エラー | 500 |
| INTERNAL_ERROR | サーバー内部エラー | 500 |

## エラーレスポンス形式

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ（日本語）",
    "details": "詳細情報またはオブジェクト"
  }
}
```

## 実装上の注意点

### 1. 認証
- 全APIでAPIキー認証が必須
- APIキーはスクリプトプロパティで管理
- 不正なAPIキーの場合は401エラーを返却

### 2. データ同期
- 予約作成時はMedical Force APIとスプレッドシート両方に同期
- 同期失敗時はロールバック処理を実装
- スプレッドシートは副次的なキャッシュとして扱う

### 3. エラーハンドリング
- 構造化されたエラーレスポンス
- 代替案の提示（空き時間など）
- 詳細なエラーログの記録

### 4. パフォーマンス
- バッチ処理によるスプレッドシート操作最適化
- キャッシュ機能の活用（5分間）
- 不要なAPI呼び出しの削減

### 5. ログ
- 全API呼び出しをログに記録
- エラー詳細の保存
- デバッグ用のトレースID付与

### 6. 文字エンコーディング
- UTF-8を使用
- 日本語の適切な処理
- URLエンコーディングの考慮

### 7. タイムアウト
- デフォルトタイムアウト: 30秒
- 長時間処理の場合は非同期処理を検討

### 8. レート制限
- 1分あたり60リクエストまで
- 制限超過時は429エラーを返却