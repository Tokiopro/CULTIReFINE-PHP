# GAS API修正指示書 - 緊急対応が必要

## 🚨 現在の問題

### 1. **問題の概要**
- PHP側でGAS APIを呼び出すと、**JSONではなくHTMLページが返される**
- これにより「レスポンスの解析に失敗しました」エラーが発生
- LINE認証後のユーザー情報取得ができない状態

### 2. **現在のレスポンス（問題のあるもの）**
```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Medical Force API Bridge</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <h1>Medical Force API Bridge</h1>
  <p>このサービスは正常に動作しています。</p>
  <p>受信パラメータ: {"path":"api/health"}</p>
  <hr>
  <h3>利用可能なエンドポイント:</h3>
  <ul>
    <li>...
```

## ✅ 期待されるレスポンス形式

### 1. **成功時のレスポンス**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "data": {
    "message": "API is working"
  }
}
```

### 2. **エラー時のレスポンス**
```
HTTP/1.1 400 Bad Request (または適切なステータス)
Content-Type: application/json

{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": null
  }
}
```

## 🔧 必要な修正内容

### 1. **doGet/doPost関数の修正**

**現在の問題のある実装（推定）:**
```javascript
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>...
  `);
}
```

**正しい実装:**
```javascript
function doGet(e) {
  // JSON形式でレスポンスを返すよう設定
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // 認証チェック
    if (!validateApiKey(e)) {
      response.setContent(JSON.stringify({
        "status": "error",
        "error": {
          "code": "UNAUTHORIZED",
          "message": "認証が必要です",
          "details": null
        }
      }));
      return response;
    }
    
    // ルーティング処理
    const result = routeRequest('GET', e);
    response.setContent(JSON.stringify(result));
    return response;
    
  } catch (error) {
    Logger.log('API Error: ' + error.toString());
    response.setContent(JSON.stringify({
      "status": "error", 
      "error": {
        "code": "INTERNAL_ERROR",
        "message": "内部エラーが発生しました",
        "details": error.toString()
      }
    }));
    return response;
  }
}

function doPost(e) {
  return handleRequest('POST', e);
}
```

### 2. **ルーティング処理の実装**
```javascript
function routeRequest(method, e) {
  const path = e.parameter.path || '';
  const pathParts = path.split('/').filter(p => p);
  
  if (method === 'GET') {
    // ヘルスチェック
    if (pathParts[0] === 'api' && pathParts[1] === 'health') {
      return {
        "status": "success",
        "data": {
          "message": "API is working",
          "timestamp": new Date().toISOString(),
          "version": "1.0"
        }
      };
    }
    
    // ユーザー情報取得
    if (pathParts[0] === 'api' && pathParts[1] === 'users' && 
        pathParts[2] === 'line' && pathParts[3] && pathParts[4] === 'full') {
      return getUserFullInfo(pathParts[3]);
    }
  }
  
  // 該当するエンドポイントが見つからない
  return {
    "status": "error",
    "error": {
      "code": "NOT_FOUND",
      "message": "指定されたエンドポイントが見つかりません",
      "details": "Path: " + path
    }
  };
}
```

### 3. **認証機能の実装**
```javascript
function validateApiKey(e) {
  // ヘッダーからAPIキーを取得（GASでは制限があるため、パラメータで受け取る場合も）
  const authHeader = e.parameter.authorization || '';
  
  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  const validToken = PropertiesService.getScriptProperties().getProperty('PHP_API_KEYS');
  
  return token === validToken;
}
```

### 4. **ユーザー情報取得の実装**
```javascript
function getUserFullInfo(lineUserId) {
  try {
    // スプレッドシートからユーザー情報を取得
    const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID').getSheetByName('Users');
    // ... データ取得処理 ...
    
    return {
      "status": "success",
      "data": {
        "user": {
          "id": "VIS000001",
          "line_user_id": lineUserId,
          "name": "田中太郎",
          "email": "tanaka@example.com",
          "phone": "090-0000-0000",
          "line_display_name": "田中太郎",
          "line_picture_url": "https://...",
          "created_at": "2025-01-01T00:00:00Z",
          "updated_at": "2025-01-01T00:00:00Z"
        },
        "patient_info": {
          // 患者情報...
        },
        "treatment_history": [
          // 施術履歴...
        ],
        "upcoming_reservations": [
          // 今後の予約...
        ],
        "available_treatments": [
          // 予約可能施術...
        ],
        "membership_info": {
          // 会員情報...
        },
        "statistics": {
          // 統計情報...
        }
      }
    };
    
  } catch (error) {
    Logger.log('getUserFullInfo Error: ' + error.toString());
    return {
      "status": "error",
      "error": {
        "code": "USER_NOT_FOUND",
        "message": "ユーザー情報の取得に失敗しました",
        "details": error.toString()
      }
    };
  }
}
```

## 🔍 テスト方法

### 1. **ヘルスチェックエンドポイントのテスト**
```bash
curl -H "Authorization: Bearer php_api_key_123" \
  "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?path=api/health"
```

**期待される結果:**
```json
{
  "status": "success",
  "data": {
    "message": "API is working",
    "timestamp": "2025-01-13T05:30:00Z",
    "version": "1.0"
  }
}
```

### 2. **ユーザー情報取得のテスト**
```bash
curl -H "Authorization: Bearer php_api_key_123" \
  "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?path=api/users/line/U423d10aeba6ed5e5b0cf420435dbab3b/full"
```

## 📋 修正チェックリスト

- [ ] doGet関数がJSON形式でレスポンスを返すように修正
- [ ] doPost関数がJSON形式でレスポンスを返すように修正
- [ ] Content-Type: application/jsonが設定されている
- [ ] エラー時もJSON形式でレスポンスを返す
- [ ] api/healthエンドポイントが正常に動作する
- [ ] api/users/line/{lineUserId}/fullエンドポイントが実装されている
- [ ] 認証機能が正しく動作する
- [ ] エラーハンドリングが適切に実装されている

## 🚨 緊急度：高

この修正により、LINE認証システムが正常に動作するようになります。
現在、ユーザーがLINE認証を行っても、「システムエラーが発生しました」という画面が表示される状態です。

修正完了後、PHP側で再度接続テストを行い、正常なJSONレスポンスが返されることを確認します。