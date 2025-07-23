# クイックスタートガイド

このプロジェクトを引き継いで開発を続ける方のためのガイドです。

## 🚀 5分で開発環境を構築

### 1. プロジェクトをクローン/ダウンロード

```bash
cd /Users/ash-_/プログラミング/天満病院/dev
```

### 2. 依存関係をインストール

```bash
npm install
npm install -g @google/clasp
```

### 3. 動作確認

```bash
node clasp-test.js
```

## 📝 開発を続ける

### Medical Force APIキーを取得済みの場合

1. Googleアカウントでログイン
   ```bash
   npm run login
   ```

2. 新しいGASプロジェクトを作成
   ```bash
   npm run create
   ```
   
   または既存プロジェクトを使用する場合は `.clasp.json` を編集：
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID_HERE",
     "rootDir": "./src"
   }
   ```

3. コードをアップロード
   ```bash
   npm run push
   ```

4. Webエディタで認証情報を設定
   ```bash
   npm run open
   ```
   
   プロジェクトの設定 → スクリプトプロパティに追加：
   - `MEDICAL_FORCE_API_KEY`: APIキー
   - `CLINIC_ID`: クリニックID

5. スプレッドシートで初期設定
   - メニュー「Medical Force連携」→「初期設定」

### Medical Force APIキーを未取得の場合

1. API仕様を確認
   ```bash
   # ブラウザで確認
   open https://developer.medical-force.com/
   
   # または保存済みの仕様を確認
   cat api-endpoints-list.md
   ```

2. Medical Force社に問い合わせてAPIアクセス権を取得

## 🛠 開発作業

### 新しい機能を追加する

例：在庫管理機能を実装する場合

1. サービスクラスを作成
   ```bash
   # src/InventoryService.js を作成
   ```

2. `src/Main.js` にメニューを追加

3. アップロードしてテスト
   ```bash
   npm run push
   npm run logs  # ログを確認
   ```

### 既存機能を修正する

1. ローカルで編集
2. `npm run push` でアップロード
3. `npm run logs` でログ確認

## 📁 重要なファイル

| ファイル | 説明 |
|---------|------|
| `PROJECT_STATUS.md` | 詳細な開発状況 |
| `api-endpoints-list.md` | API一覧 |
| `src/Config.js` | API設定（エンドポイント定義） |
| `src/Main.js` | メインプログラム（メニュー定義） |

## ❓ トラブルシューティング

### clasp pushでエラー

```bash
# 再ログイン
npm run login

# .clasp.jsonのscriptIdを確認
cat .clasp.json
```

### APIエラー（401）

スクリプトプロパティの設定を確認：
- `MEDICAL_FORCE_API_KEY`
- `CLINIC_ID`

## 📞 サポート

- Medical Force API: 公式サイトから問い合わせ
- GAS/clasp: [Stack Overflow](https://stackoverflow.com/questions/tagged/google-apps-script)
- プロジェクト固有: `PROJECT_STATUS.md` 参照