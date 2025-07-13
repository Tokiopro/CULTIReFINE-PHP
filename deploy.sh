#!/bin/bash

# さくらサーバーへのPHPファイルデプロイスクリプト
# 使用方法: ./deploy.sh

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
LOCAL_DIR="/Users/ash-_/プログラミング/天満病院/PHP/"
REMOTE_DIR="/home/cultirefine/www/"
SSH_HOST="tenma-hospital"

echo -e "${YELLOW}さくらサーバーへのデプロイを開始します...${NC}"

# SSH接続テスト
echo -e "${YELLOW}SSH接続を確認中...${NC}"
if ssh -q $SSH_HOST exit; then
    echo -e "${GREEN}SSH接続: OK${NC}"
else
    echo -e "${RED}SSH接続に失敗しました${NC}"
    echo "公開鍵がサーバーに登録されているか確認してください"
    exit 1
fi

# rsyncでファイルを同期
echo -e "${YELLOW}ファイルを同期中...${NC}"
rsync -avz --delete \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'node_modules' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude 'deploy.sh' \
    --exclude '.env' \
    --exclude 'config/database.php' \
    "$LOCAL_DIR" "$SSH_HOST:$REMOTE_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}デプロイが正常に完了しました！${NC}"
else
    echo -e "${RED}デプロイ中にエラーが発生しました${NC}"
    exit 1
fi

# オプション：デプロイ後の処理
echo -e "${YELLOW}デプロイ後の処理を実行中...${NC}"
ssh $SSH_HOST << 'EOF'
    # 必要に応じてキャッシュクリアなどの処理を追加
    # cd /home/cultirefine/www/ && php artisan cache:clear
    echo "デプロイ完了時刻: $(date)"
EOF

echo -e "${GREEN}すべての処理が完了しました！${NC}"