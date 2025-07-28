# Medical Force API ローカルテスト手順

## セットアップ

1. **必要なパッケージをインストール**
```bash
npm run setup-test
# または
npm install axios dotenv
```

2. **環境変数を設定**

`.env`ファイルを作成（`.env.example`を参考に）:
```bash
cp .env.example .env
```

`.env`ファイルを編集して、実際の認証情報を入力:
```
MEDICAL_FORCE_CLIENT_ID=実際のクライアントID
MEDICAL_FORCE_CLIENT_SECRET=実際のクライアントシークレット
CLINIC_ID=実際のクリニックID
```

## 実行

```bash
npm run test-api
# または
node test-api.js
```

## テスト内容

1. **アクセストークン取得**
   - OAuth 2.0認証でアクセストークンを取得

2. **クリニック情報確認**
   - clinic_idが正しいか確認

3. **患者一覧取得**
   - 現在登録されている患者を表示
   - レスポンス形式を確認

4. **テスト患者登録**（オプション）
   - 患者が0件の場合、テスト患者を登録するか選択

## 出力例

```
Medical Force API テスト開始
=====================================

=== 設定確認 ===
API URL: https://api.medical-force.com
Clinic ID: bb0e6fa208af4c1ab2c28b9e4377ba18
Client ID: f7a9b2c5d8...

=== アクセストークン取得 ===
✓ アクセストークン取得成功
  トークンタイプ: Bearer
  有効期限: 3600秒

=== クリニック情報確認 ===
✓ クリニック情報取得成功
  クリニックID: bb0e6fa208af4c1ab2c28b9e4377ba18
  クリニック名: テストクリニック

=== 患者一覧取得 ===
✓ 患者一覧取得成功
  レスポンス構造: ["items","count"]
  患者数: 0件
  総件数: 0件
```

## トラブルシューティング

- **401エラー**: 認証情報を確認
- **患者が表示されない**: clinic_idを確認
- **接続エラー**: ネットワーク接続を確認