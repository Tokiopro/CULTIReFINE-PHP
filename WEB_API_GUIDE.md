# Medical Force Web API ガイド

## 概要

このWeb APIは、外部システムからHTTPリクエストを通じてMedical Force APIと連携するための橋渡し機能を提供します。

## セットアップ

### 1. APIキーの設定

Google Apps Scriptのスクリプトプロパティに以下を設定：

- `DEFAULT_API_KEY`: デフォルトのAPIキー（例: `YOUR_API_KEY`）
- `ALLOWED_API_KEYS`: 許可するAPIキーのリスト（カンマ区切り）

**設定手順：**
1. GASエディタで「プロジェクトの設定」（歯車アイコン）をクリック
2. 「スクリプト プロパティ」セクションで「プロパティを追加」
3. 以下を設定：
   - プロパティ: `DEFAULT_API_KEY`
   - 値: `YOUR_API_KEY`（PHP側のconfig.phpと同じ値）
4. 「保存」をクリック

### 2. Web Appとしてデプロイ

1. GASエディタで「デプロイ」→「新しいデプロイ」
2. 種類：「ウェブアプリ」を選択
3. 設定：
   - 実行ユーザー：自分
   - アクセス可能なユーザー：全員（匿名ユーザーを含む）
4. デプロイをクリック
5. Web App URLをコピー

## APIエンドポイント

### ベースURL
```
https://script.google.com/macros/s/{SCRIPT_ID}/exec
```

## 利用可能なアクション

### 1. 患者登録（createPatient）

新規患者をMedical Forceに登録します。

**リクエスト**
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "action": "createPatient",
    "patient": {
      "name": "山田 太郎",
      "name_kana": "ヤマダタロウ",
      "first_name": "太郎",
      "last_name": "山田",
      "first_name_kana": "タロウ",
      "last_name_kana": "ヤマダ",
      "gender": "MALE",
      "birthday": "1990-01-01",
      "phone": "090-1234-5678",
      "email": "yamada@example.com",
      "address": "東京都渋谷区...",
      "code": "12345",
      "karte_number": "NA3039",
      "is_subscribed": true
    }
  }'
```

**必須項目**
- `name`: 氏名
- `name_kana`: 氏名（カナ）

**レスポンス（成功）**
```json
{
  "success": true,
  "data": {
    "visitor_id": "12345678-0000-0000-0000-000000000000",
    "name": "山田 太郎",
    "message": "患者登録が完了しました"
  },
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

**レスポンス（エラー）**
```json
{
  "success": false,
  "error": {
    "message": "Name and name_kana are required",
    "code": 400
  },
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

### 2. 患者検索（searchPatient）

条件に一致する患者を検索します。

**リクエスト**
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "action": "searchPatient",
    "search": {
      "name": "山田",
      "phone": "090-1234-5678"
    }
  }'
```

**検索可能項目**
- `name`: 氏名（部分一致）
- `name_kana`: カナ（部分一致）
- `phone`: 電話番号
- `email`: メールアドレス
- `code`: 患者コード
- `karte_number`: カルテ番号

### 3. 患者情報取得（getPatient）

患者IDから患者情報を取得します。

**リクエスト**
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "action": "getPatient",
    "visitor_id": "12345678-0000-0000-0000-000000000000"
  }'
```

### 4. ヘルスチェック

APIの稼働状況を確認します。

**リクエスト**
```bash
curl "{BASE_URL}?action=health"
```

**レスポンス**
```json
{
  "status": "ok",
  "service": "Medical Force API Bridge",
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

### 5. LINE ユーザー情報取得（getLineUserInfo）

LINE認証後の一時トークンからユーザー情報を取得します。

**リクエスト**
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "action": "getLineUserInfo",
    "auth_token": "一時認証トークン（UUID）"
  }'
```

**レスポンス（成功）**
```json
{
  "success": true,
  "data": {
    "userId": "U1234567890abcdef",
    "displayName": "山田太郎",
    "pictureUrl": "https://profile.line-scdn.net/...",
    "statusMessage": "こんにちは"
  },
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

**注意事項**
- 一時認証トークンは10分間有効
- トークンは一度のみ使用可能

### 6. LINE IDで患者検索（getPatientByLineId）

LINE IDに紐づく患者情報を取得します。

**リクエスト**
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "action": "getPatientByLineId",
    "lineUserId": "U1234567890abcdef"
  }'
```

**レスポンス（患者が存在する場合）**
```json
{
  "success": true,
  "data": {
    "visitor_id": "12345678-0000-0000-0000-000000000000",
    "name": "山田 太郎",
    "email": "yamada@example.com",
    "phone": "090-1234-5678"
  },
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

**レスポンス（患者が存在しない場合）**
```json
{
  "success": true,
  "data": null,
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

### 7. LINE連携患者の作成（createPatientWithLine）

LINE IDを含む患者情報を新規作成します。

**リクエスト**
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "action": "createPatientWithLine",
    "lineUserId": "U1234567890abcdef",
    "name": "山田 太郎",
    "email": "yamada@example.com"
  }'
```

**必須項目**
- `lineUserId`: LINE ユーザーID
- `name`: 患者名

**任意項目**
- `email`: メールアドレス

**レスポンス（成功）**
```json
{
  "success": true,
  "data": {
    "visitor_id": "12345678-0000-0000-0000-000000000000",
    "name": "山田 太郎",
    "line_user_id": "U1234567890abcdef",
    "message": "LINE連携患者が登録されました"
  },
  "timestamp": "2025-06-22T12:00:00.000Z"
}
```

**注意事項**
- カナ名は自動生成されますが、正確性のためPHP側から送信することを推奨
- LINE IDは患者のnote欄に記録されます

## エラーコード

| コード | 説明 |
|--------|------|
| 400 | Bad Request - リクエストパラメータが不正 |
| 401 | Unauthorized - APIキーが無効 |
| 405 | Method Not Allowed - 許可されていないHTTPメソッド |
| 500 | Internal Server Error - サーバー内部エラー |

## LINE認証連携

### LINE認証フロー

1. **認証URL生成（PHP側）**
```
https://access.line.me/oauth2/v2.1/authorize?
response_type=code&
client_id={LINE_CHANNEL_ID}&
redirect_uri={GAS_WEB_APP_URL}&
state={任意の値}&
scope=profile%20openid
```

2. **stateパラメータによる動作切り替え**
- 通常のstate値: HTMLページでpostMessage通知（既存動作）
- `php_redirect_`で始まるstate: PHPサイトへリダイレクト

3. **PHPリダイレクト時のパラメータ**
```
https://your-php-site.com/line-login/auth/line-callback.php?
user_id={LINEユーザーID}&
display_name={表示名}&
picture_url={プロフィール画像URL}&
auth_token={一時認証トークン}&
state={元のstate値}
```

### 必要な設定

スクリプトプロパティに以下を設定：
- `LINE_CHANNEL_ID`: LINEチャネルID
- `LINE_CHANNEL_SECRET`: LINEチャネルシークレット

## セキュリティ

1. **APIキー認証**
   - すべてのリクエストにAPIキーが必要
   - スクリプトプロパティで管理

2. **HTTPS通信**
   - Google Apps ScriptのWeb AppはHTTPS通信のみ

3. **ログ記録**
   - すべてのAPIリクエストはログに記録
   - APIキーはログに記録されない

4. **LINE認証**
   - 認証コードは一度のみ使用可能
   - 一時認証トークンは10分間有効

## 制限事項

1. **実行時間制限**
   - Google Apps Scriptの制限により、1リクエストあたり最大6分

2. **リクエストサイズ**
   - POSTデータは最大50MB

3. **同時実行数**
   - Google Apps Scriptの制限に準拠

## トラブルシューティング

### APIキーエラー
```
Invalid API key
```
→ スクリプトプロパティにAPIキーが設定されているか確認

### JSONパースエラー
```
Invalid JSON in request body
```
→ リクエストボディが正しいJSON形式か確認

### Medical Force APIエラー
```
Failed to create patient: [エラーメッセージ]
```
→ Medical Force側の認証情報（CLIENT_ID/SECRET）を確認

## サンプルコード

### Python
```python
import requests
import json

url = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
headers = {"Content-Type": "application/json"}

data = {
    "apiKey": "YOUR_API_KEY",
    "action": "createPatient",
    "patient": {
        "name": "山田 太郎",
        "name_kana": "ヤマダタロウ",
        "gender": "MALE",
        "birthday": "1990-01-01"
    }
}

response = requests.post(url, headers=headers, data=json.dumps(data))
print(response.json())
```

### JavaScript (Node.js)
```javascript
const axios = require('axios');

const url = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

const data = {
    apiKey: 'YOUR_API_KEY',
    action: 'createPatient',
    patient: {
        name: '山田 太郎',
        name_kana: 'ヤマダタロウ',
        gender: 'MALE',
        birthday: '1990-01-01'
    }
};

axios.post(url, data)
    .then(response => {
        console.log(response.data);
    })
    .catch(error => {
        console.error(error);
    });
```