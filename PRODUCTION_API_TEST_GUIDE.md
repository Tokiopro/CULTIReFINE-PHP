# Medical Force API 本番環境テストガイド

## 概要

このガイドでは、Google Apps Script (GAS) を経由せずに直接 Medical Force API との通信を確認する方法を説明します。データ取得の問題を特定し、解決策を見つけるための包括的な診断を実施できます。

## 事前準備

### 1. Node.js 環境の確認

```bash
node --version
npm --version
```

Node.js 14.x 以上が必要です。

### 2. 必要な依存関係のインストール

```bash
npm install axios dotenv
```

### 3. 環境変数の設定

`.env.example` ファイルをコピーして `.env` ファイルを作成します：

```bash
cp .env.example .env
```

`.env` ファイルを編集し、本番環境の認証情報を設定してください：

```env
MEDICAL_FORCE_CLIENT_ID=your_actual_client_id
MEDICAL_FORCE_CLIENT_SECRET=your_actual_client_secret
CLINIC_ID=your_actual_clinic_id
```

### 4. 認証情報の取得方法

Medical Force の管理画面から以下の情報を取得してください：

1. **Client ID**: API 設定画面で確認
2. **Client Secret**: API 設定画面で確認  
3. **Clinic ID**: クリニック情報画面で確認

## テストの実行

### 基本的なテスト実行

```bash
node test-api-production.js
```

### 実行される診断項目

1. **設定検証**
   - 認証情報の設定確認
   - 必要な環境変数の存在確認

2. **OAuth 2.0 認証テスト**
   - アクセストークンの取得
   - 認証情報の有効性確認

3. **クリニック情報確認**
   - クリニックIDの有効性確認
   - クリニック情報の取得

4. **患者一覧取得（詳細診断）**
   - 基本的な患者一覧取得
   - 大量データの取得テスト
   - 削除済みデータを含む取得
   - 更新日時を指定した取得

5. **予約一覧取得**
   - 予約データの取得確認
   - データ構造の確認

6. **メニュー一覧取得**
   - メニューデータの取得確認
   - カテゴリ情報の確認

## 結果の確認

### 1. リアルタイム出力

テスト実行中に以下の情報がコンソールに表示されます：

- ✅ 成功: 緑色で表示
- ❌ 失敗: 赤色で表示  
- ⚠️ 警告: 黄色で表示

### 2. 詳細な診断結果

テスト完了後、`diagnostic-results-YYYY-MM-DD.json` ファイルが作成されます。
このファイルには以下の情報が含まれます：

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "tests": [
    {
      "name": "テスト名",
      "status": "pass|fail|warning",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "details": {
        "message": "詳細メッセージ",
        "その他の情報": "..."
      }
    }
  ],
  "summary": {
    "passed": 10,
    "failed": 2,
    "warnings": 1
  }
}
```

## 問題の診断と解決

### よくある問題と解決策

#### 1. 認証エラー（401 Unauthorized）

**症状**: 
```
✗ OAuth 2.0 認証: FAIL
エラー: 認証エラー
```

**解決策**:
- Client ID と Client Secret を再確認
- Medical Force の API 設定を確認
- 認証情報の有効期限を確認

#### 2. クリニック情報取得エラー

**症状**:
```
✗ クリニック情報取得: FAIL
使用したClinic ID: your_clinic_id
```

**解決策**:
- Clinic ID の正確性を確認
- 対象クリニックへのアクセス権限を確認
- Medical Force でクリニック情報を再確認

#### 3. データ取得エラー（403 Forbidden）

**症状**:
```
✗ 患者一覧取得: FAIL
ステータス: 403 Forbidden
```

**解決策**:
- API の利用権限を確認
- 契約プランでの API 利用制限を確認
- 必要な権限の追加を依頼

#### 4. データが0件の場合

**症状**:
```
✓ 患者一覧取得: PASS
取得件数: 0件
```

**解決策**:
- 実際にデータが存在するかを Medical Force で確認
- 検索条件を変更してテスト
- 削除済みデータの状況を確認

### 4. ネットワーク関連のエラー

**症状**:
```
✗ 患者一覧取得: FAIL
エラー: timeout of 30000ms exceeded
```

**解決策**:
- インターネット接続を確認
- ファイアウォールの設定を確認
- プロキシ設定が必要な場合は設定を追加

## 追加のデバッグ手順

### 1. cURL を使った直接テスト

アクセストークンを取得した後、cURL で直接 API をテストできます：

```bash
# アクセストークン取得
curl -X POST https://api.medical-force.com/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET"}'

# 患者一覧取得
curl -X GET "https://api.medical-force.com/developer/visitors?clinic_id=YOUR_CLINIC_ID&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

### 2. GAS 側の設定確認

本番環境のテストが成功した場合、GAS 側の設定を確認してください：

1. **スクリプトプロパティの確認**
   - GAS エディタで「プロジェクトの設定」→「スクリプトプロパティ」を確認
   - 以下の値が正しく設定されているか確認:
     - `MEDICAL_FORCE_CLIENT_ID`
     - `MEDICAL_FORCE_CLIENT_SECRET`
     - `CLINIC_ID`

2. **TokenManager の動作確認**
   - GAS エディタで `TokenManager.getAccessToken()` を実行
   - エラーが発生する場合は認証の問題

3. **ApiClient の動作確認**
   - GAS エディタで `ApiClient` を使った簡単なテストを実行

### 3. ログの確認

GAS のログを確認して詳細なエラー情報を取得：

```javascript
// GAS エディタで実行
function debugApiCall() {
  try {
    const client = new ApiClient();
    const result = client.get('/developer/visitors', { clinic_id: Config.getClinicId(), limit: 5 });
    console.log('API結果:', result);
  } catch (error) {
    console.error('APIエラー:', error);
  }
}
```

## セキュリティ上の注意事項

1. **認証情報の管理**
   - `.env` ファイルは Git にコミットしないでください
   - 本番環境の認証情報は安全に管理してください
   - テスト完了後は適切に削除してください

2. **ログの取り扱い**
   - 診断結果ファイルには機密情報が含まれる可能性があります
   - 必要に応じて適切に削除してください

3. **API 利用制限**
   - 大量のテストを実行する場合は API の利用制限に注意してください
   - 必要に応じて Medical Force に事前連絡してください

## サポート

問題が解決しない場合は、以下の情報を含めて報告してください：

1. 診断結果の JSON ファイル
2. エラーメッセージの詳細
3. 使用している環境の情報
4. 期待される動作と実際の動作の差異

この診断により、Medical Force API との通信問題を特定し、適切な解決策を見つけることができます。