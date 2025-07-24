# GitHub Actions CI/CD セットアップガイド

このディレクトリには、天満病院 GAS プロジェクトのCI/CDワークフローが含まれています。

## ワークフロー概要

### 1. CI (ci.yml)
- **目的**: コード品質の確保
- **トリガー**: 
  - mainまたはdevelopブランチへのプッシュ
  - mainブランチへのプルリクエスト
- **実行内容**:
  - TypeScriptの型チェック
  - clasp設定の検証
  - ソースファイルの存在確認

### 2. Deploy (deploy.yml)
- **目的**: Google Apps Scriptへの自動デプロイ
- **トリガー**:
  - mainブランチへのプッシュ（コードのアップロードのみ）
  - 手動実行（新バージョンのデプロイオプション付き）
- **実行内容**:
  - claspを使用したGASへのコードプッシュ
  - オプションで新バージョンのデプロイ

## セットアップ手順

### 1. Google Cloud Platform での準備

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを選択または作成
3. Apps Script APIを有効化
4. サービスアカウントを作成（または既存のGoogleアカウントを使用）

### 2. clasp認証情報の取得

ローカル環境で以下を実行：

```bash
# claspにログイン
clasp login

# 認証情報ファイルの場所を確認
cat ~/.clasprc.json
```

このファイルの内容をコピーしておきます。

### 3. GitHub Secretsの設定

リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを追加：

#### 必須シークレット

- **CLASP_CREDENTIALS**: 
  - `~/.clasprc.json`の内容全体をコピー
  - 形式例:
    ```json
    {
      "token": {
        "access_token": "ya29.xxx...",
        "refresh_token": "1//xxx...",
        "scope": "https://www.googleapis.com/auth/...",
        "token_type": "Bearer",
        "id_token": "xxx...",
        "expiry_date": 1234567890
      },
      "oauth2ClientSettings": {
        "clientId": "xxx.apps.googleusercontent.com",
        "clientSecret": "xxx",
        "redirectUri": "http://localhost"
      },
      "isLocalCreds": false
    }
    ```

#### オプション（将来の拡張用）

- **MEDICAL_FORCE_API_KEY**: Medical Force APIキー
- **CLINIC_ID**: クリニックID

## 使用方法

### 自動デプロイ（コードプッシュのみ）

mainブランチにプッシュすると自動的に：
1. CIチェックが実行される
2. チェックが成功したらGASにコードがプッシュされる

### 手動デプロイ（新バージョンの作成）

1. GitHubリポジトリの Actions タブを開く
2. "Deploy to Google Apps Script" ワークフローを選択
3. "Run workflow" をクリック
4. "Deploy a new version" で `yes` を選択
5. "Run workflow" ボタンをクリック

## トラブルシューティング

### 認証エラーが発生する場合

1. CLASP_CREDENTIALSシークレットが正しく設定されているか確認
2. トークンの有効期限が切れていないか確認
3. 必要に応じて、ローカルで`clasp login`を再実行し、新しい認証情報を取得

### デプロイが失敗する場合

1. .clasp.jsonのscriptIdが正しいか確認
2. Google Apps Script APIが有効になっているか確認
3. 実行ログでエラーの詳細を確認

## セキュリティに関する注意

- CLASP_CREDENTIALSには機密情報が含まれているため、絶対に公開しないでください
- 定期的に認証情報を更新することを推奨します
- mainブランチは保護し、直接プッシュを制限することを推奨します

## 今後の改善案

1. **コード品質ツールの追加**
   - ESLintの設定と実行
   - Prettierによるコードフォーマット

2. **テストの追加**
   - Jestなどのテストフレームワークの導入
   - GAS関数のモックとユニットテスト

3. **通知の追加**
   - デプロイ成功/失敗時のSlack通知
   - メール通知

4. **環境管理**
   - 開発/ステージング/本番環境の分離
   - 環境ごとの設定管理