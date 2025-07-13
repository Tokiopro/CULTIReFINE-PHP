# よく使うコマンド集 - 天満病院PHPプロジェクト

## 🔐 SSH接続

### 基本接続
```bash
# さくらサーバーに接続
ssh tenma-hospital

# パスワード認証で接続（公開鍵認証が失敗した場合）
ssh -o PreferredAuthentications=password cultirefine@cultirefine.sakura.ne.jp
```

### SSH鍵の管理
```bash
# SSH鍵をエージェントに追加
ssh-add ~/.ssh/tenma-hospital-new

# 登録されている鍵を確認
ssh-add -l

# 鍵の権限を修正
chmod 600 ~/.ssh/tenma-hospital-new
```

## 🚀 デプロイ

### スクリプトを使用
```bash
# デプロイスクリプトを実行
./deploy.sh
```

### 手動でrsync
```bash
# 本番環境へアップロード（ドライラン）
rsync -avzn --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  ./ tenma-hospital:/home/cultirefine/www/

# 実際にアップロード（-nを削除）
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  ./ tenma-hospital:/home/cultirefine/www/
```

## 📁 VSCode SFTP拡張機能

### よく使うコマンド（Cmd+Shift+P）
| コマンド | 説明 |
|---------|------|
| `SFTP: Config` | 設定ファイルを開く |
| `SFTP: List All` | リモートファイル一覧を表示 |
| `SFTP: Upload Active File` | 現在開いているファイルをアップロード |
| `SFTP: Upload Changed Files` | 変更されたファイルをアップロード |
| `SFTP: Upload Folder` | フォルダをアップロード |
| `SFTP: Download` | ファイルをダウンロード |
| `SFTP: Sync Local -> Remote` | ローカル→リモート同期 |
| `SFTP: Sync Remote -> Local` | リモート→ローカル同期 |
| `SFTP: Diff` | ローカルとリモートの差分表示 |

### 右クリックメニュー
- ファイル/フォルダを右クリック → `Upload File/Folder`
- エクスプローラーで右クリック → `Sync Local -> Remote`

### 自動アップロード設定
`.vscode/sftp.json` で `"uploadOnSave": true` に変更すると保存時に自動アップロード

## 🔧 Git操作

### 基本操作
```bash
# ステータス確認
git status

# 変更を追加
git add .

# コミット
git commit -m "機能: 〇〇を追加"

# 変更内容を確認
git diff

# コミット履歴
git log --oneline -10
```

### デプロイ前チェックリスト
```bash
# 1. 変更内容を確認
git status
git diff

# 2. テスト実行（PHPの構文チェック）
find . -name "*.php" -exec php -l {} \;

# 3. 不要なファイルがないか確認
ls -la

# 4. デプロイ実行
./deploy.sh
```

## 🛠️ トラブルシューティング

### SSH接続できない
```bash
# 詳細なデバッグ情報を表示
ssh -vvv tenma-hospital

# known_hostsをクリア（ホスト鍵が変更された場合）
ssh-keygen -R cultirefine.sakura.ne.jp

# SSH設定を確認
cat ~/.ssh/config | grep -A5 tenma-hospital
```

### デプロイが失敗する
```bash
# SSH接続テスト
ssh tenma-hospital "echo 'Connection OK'"

# リモートディレクトリを確認
ssh tenma-hospital "ls -la /home/cultirefine/www/"

# 権限を確認
ssh tenma-hospital "whoami && pwd"
```

### SFTP拡張機能のエラー
1. コマンドパレット → `Developer: Reload Window`
2. `.vscode/sftp.json` の設定を確認
3. 秘密鍵のパスと権限を確認

## 📝 その他の便利なコマンド

### ファイル検索
```bash
# PHPファイルを検索
find . -name "*.php" | grep -v vendor

# 文字列を含むファイルを検索
grep -r "検索文字列" --include="*.php" .
```

### リモートでの作業
```bash
# リモートでコマンド実行
ssh tenma-hospital "cd /home/cultirefine/www && ls -la"

# ログファイルを確認
ssh tenma-hospital "tail -f /path/to/error.log"
```

### バックアップ
```bash
# リモートファイルをローカルにバックアップ
rsync -avz tenma-hospital:/home/cultirefine/www/ ./backup/

# 特定のファイルのみダウンロード
scp tenma-hospital:/home/cultirefine/www/config.php ./
```

## 🎯 推奨ワークフロー

1. **開発開始時**
   ```bash
   # 最新の状態を取得
   cd /Users/ash-_/プログラミング/天満病院/PHP
   git pull（リモートリポジトリがある場合）
   ```

2. **開発中**
   - VSCodeで編集
   - Cmd+S で保存
   - `SFTP: Upload Active File` でアップロード
   - ブラウザで動作確認

3. **作業終了時**
   ```bash
   # 変更をコミット
   git add .
   git commit -m "作業内容を記述"
   
   # 最終デプロイ
   ./deploy.sh
   ```

## ⚡ クイックリファレンス

```bash
# よく使うエイリアス（.zshrcに追加可能）
alias tenma='ssh tenma-hospital'
alias deploy='cd /Users/ash-_/プログラミング/天満病院/PHP && ./deploy.sh'
```