# 天満病院 LINE認証予約システム - GAS API仕様書

## プロジェクト概要

### システム構成
- **フロントエンド**: PHP LINE認証システム
- **バックエンド**: Google Apps Script (GAS) Web App
- **データ管理**: Google Spreadsheet
- **認証**: LINE Login OAuth 2.0

### 目的
LINEアプリから病院の予約システムにアクセスし、ユーザー認証後に予約を行うシステムのバックエンドAPIを提供する。

## 技術仕様

### GAS Web App設定
```javascript
// デプロイ設定
// 実行者: 自分
// アクセス許可: 全員（匿名ユーザーを含む）
// バージョン: 新しいバージョンを作成
```

### 基本構造
```javascript
function doGet(e) {
  return handleRequest('GET', e);
}

function doPost(e) {
  return handleRequest('POST', e);
}

function handleRequest(method, e) {
  // CORS対応
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // 認証チェック
    if (!validateApiKey(e)) {
      return createErrorResponse(401, 'Unauthorized');
    }
    
    // ルーティング処理
    const result = routeRequest(method, e);
    return response.setContent(JSON.stringify(result));
    
  } catch (error) {
    Logger.log('API Error: ' + error.toString());
    return createErrorResponse(500, 'Internal Server Error');
  }
}
```

## API認証

### Bearer Token認証
```javascript
function validateApiKey(e) {
  const authHeader = e.parameter.headers?.Authorization || 
                     e.postData?.headers?.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  const validToken = PropertiesService.getScriptProperties().getProperty('API_KEY');
  
  return token === validToken;
}
```

### 設定方法
1. GASエディタで「プロジェクトの設定」→「スクリプト プロパティ」
2. `API_KEY`という名前で任意の文字列を設定（例：`your_secure_api_key_here`）

## 必要なAPI エンドポイント

### 1. ユーザー情報取得・登録

#### GET /users/line/{lineUserId}
**目的**: LINE IDからユーザー情報を取得

**URLパラメータ**:
- `lineUserId`: LINEユーザーID

**レスポンス**:
```json
// ユーザーが存在する場合 (HTTP 200)
{
  "id": "user_001",
  "line_user_id": "U423d10aeba6ed5...",
  "name": "田中太郎",
  "email": "tanaka@example.com", 
  "phone": "090-0000-0000",
  "line_display_name": "田中太郎",
  "line_picture_url": "https://profile.line-scdn.net/...",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}

// ユーザーが存在しない場合 (HTTP 404)
{
  "error": true,
  "message": "ユーザーが見つかりません",
  "code": "USER_NOT_FOUND"
}
```

#### POST /users
**目的**: 新規ユーザー登録

**リクエストボディ**:
```json
{
  "line_user_id": "U423d10aeba6ed5...",
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "phone": "090-0000-0000", 
  "line_display_name": "田中太郎",
  "line_picture_url": "https://profile.line-scdn.net/..."
}
```

**レスポンス**:
```json
// 成功 (HTTP 201)
{
  "id": "user_002",
  "line_user_id": "U423d10aeba6ed5...",
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "phone": "090-0000-0000",
  "line_display_name": "田中太郎", 
  "line_picture_url": "https://profile.line-scdn.net/...",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

### 2. 患者情報管理

#### GET /users/{userId}/patients
**目的**: ユーザーに紐づく患者リストを取得

**レスポンス**:
```json
[
  {
    "id": "patient_001",
    "user_id": "user_001", 
    "name": "田中太郎",
    "last_visit": "2024-12-01",
    "is_new": false,
    "created_at": "2025-01-01T00:00:00Z"
  },
  {
    "id": "patient_002",
    "user_id": "user_001",
    "name": "田中花子", 
    "last_visit": null,
    "is_new": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

#### POST /users/{userId}/patients
**目的**: 新規患者を追加

**リクエストボディ**:
```json
{
  "name": "田中次郎",
  "is_new": true
}
```

### 3. 施術履歴管理

#### GET /patients/{patientId}/treatments
**目的**: 患者の施術履歴を取得

**レスポンス**:
```json
[
  {
    "id": "treatment_history_001",
    "patient_id": "patient_001",
    "treatment_id": "tkt_sc_1cc",
    "treatment_name": "幹細胞培養上清液 1cc",
    "treatment_date": "2024-12-01",
    "min_interval_days": 14,
    "next_available_date": "2024-12-15"
  }
]
```

#### POST /patients/{patientId}/treatments
**目的**: 施術履歴を記録

**リクエストボディ**:
```json
{
  "treatment_id": "tkt_sc_2cc",
  "treatment_name": "幹細胞培養上清液 2cc", 
  "treatment_date": "2025-01-15",
  "min_interval_days": 14
}
```

### 4. 予約管理

#### GET /reservations?user_id={userId}
**目的**: ユーザーの予約一覧を取得

**レスポンス**:
```json
[
  {
    "id": "reservation_001",
    "user_id": "user_001",
    "patient_id": "patient_001", 
    "treatment_id": "tkt_sc_1cc",
    "treatment_name": "幹細胞培養上清液 1cc",
    "reservation_date": "2025-01-15",
    "reservation_time": "14:00",
    "duration": "約90分",
    "price": "80,000円",
    "is_pair_booking": false,
    "status": "confirmed",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

#### POST /reservations
**目的**: 新規予約を作成

**リクエストボディ**:
```json
{
  "user_id": "user_001",
  "patient_id": "patient_001",
  "treatment_id": "tkt_sc_1cc", 
  "treatment_name": "幹細胞培養上清液 1cc",
  "reservation_date": "2025-01-15",
  "reservation_time": "14:00",
  "duration": "約90分",
  "price": "80,000円",
  "is_pair_booking": false
}
```

### 5. 施術間隔チェック

#### GET /patients/{patientId}/treatment-interval/{treatmentId}?date=2025-01-15
**目的**: 施術間隔をチェック

**レスポンス**:
```json
// 予約可能
{
  "is_valid": true,
  "message": "予約可能です",
  "last_treatment_date": "2024-12-01", 
  "min_interval_days": 14,
  "next_available_date": "2024-12-15"
}

// 予約不可
{
  "is_valid": false,
  "message": "最後の施術から14日経過していません",
  "last_treatment_date": "2025-01-10",
  "min_interval_days": 14, 
  "next_available_date": "2025-01-24"
}
```

### 6. 空き時間確認

#### GET /availability?treatment_id=tkt_sc_1cc&date=2025-01-15&pair_room=false
**目的**: 指定日の空き時間を確認

**レスポンス**:
```json
{
  "available": true,
  "available_times": ["10:00", "10:30", "14:00", "14:30"],
  "message": "空き時間があります"
}
```

## データ管理（Google Spreadsheet）

### 推奨シート構成

#### 1. Users シート
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 |
|-----|-----|-----|-----|-----|-----|-----|-----|
| id | line_user_id | name | email | phone | line_display_name | line_picture_url | created_at |

#### 2. Patients シート
| A列 | B列 | C列 | D列 | E列 | F列 |
|-----|-----|-----|-----|-----|-----|
| id | user_id | name | last_visit | is_new | created_at |

#### 3. TreatmentHistory シート
| A列 | B列 | C列 | D列 | E列 | F列 | G列 |
|-----|-----|-----|-----|-----|-----|-----|
| id | patient_id | treatment_id | treatment_name | treatment_date | min_interval_days | created_at |

#### 4. Reservations シート
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 | I列 | J列 | K列 | L列 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| id | user_id | patient_id | treatment_id | treatment_name | reservation_date | reservation_time | duration | price | is_pair_booking | status | created_at |

## 実装例

### ルーティング処理
```javascript
function routeRequest(method, e) {
  const path = e.parameter.path || '';
  const pathParts = path.split('/').filter(p => p);
  
  if (method === 'GET') {
    if (pathParts[0] === 'users' && pathParts[1] === 'line' && pathParts[2]) {
      return getUserByLineId(pathParts[2]);
    }
    if (pathParts[0] === 'users' && pathParts[2] === 'patients') {
      return getPatients(pathParts[1]);
    }
    if (pathParts[0] === 'patients' && pathParts[2] === 'treatments') {
      return getTreatmentHistory(pathParts[1]);
    }
    // 他のエンドポイント...
  }
  
  if (method === 'POST') {
    if (pathParts[0] === 'users') {
      return createUser(JSON.parse(e.postData.contents));
    }
    // 他のエンドポイント...
  }
  
  return createErrorResponse(404, 'Not Found');
}
```

### ユーザー取得処理例
```javascript
function getUserByLineId(lineUserId) {
  const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID').getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === lineUserId) { // B列: line_user_id
      return {
        id: data[i][0],
        line_user_id: data[i][1],
        name: data[i][2],
        email: data[i][3],
        phone: data[i][4],
        line_display_name: data[i][5],
        line_picture_url: data[i][6],
        created_at: data[i][7]
      };
    }
  }
  
  return createErrorResponse(404, 'ユーザーが見つかりません', 'USER_NOT_FOUND');
}
```

### エラーレスポンス作成
```javascript
function createErrorResponse(statusCode, message, code = null) {
  return {
    error: true,
    message: message,
    code: code,
    status: statusCode
  };
}
```

## テスト方法

### 1. デプロイ後のテスト
```bash
# ユーザー取得テスト
curl -H "Authorization: Bearer your_api_key" \
  "https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec?path=users/line/U423d10aeba6ed5"

# ユーザー作成テスト  
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"line_user_id":"U123","name":"テストユーザー","email":"test@example.com","phone":"090-0000-0000"}' \
  "https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec?path=users"
```

### 2. ログ確認
```javascript
function checkLogs() {
  const logs = Logger.getLog();
  console.log(logs);
}
```

## 注意事項

1. **スプレッドシートID**: 実装時に実際のスプレッドシートIDに置き換える
2. **APIキー**: 強力なランダム文字列を生成して使用
3. **エラーハンドリング**: 各処理で適切な例外処理を実装
4. **データ検証**: 入力値の妥当性チェックを実装
5. **ログ出力**: デバッグ用のログを適切に出力

この仕様に基づいて実装していただければ、PHPのLINE認証システムと完全に連携できます。