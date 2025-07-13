#!/bin/bash

# ローカル開発サーバー起動スクリプト

echo "Starting PHP development server..."
echo "Server will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""
echo "Note: For LINE authentication, you need HTTPS."
echo "Consider using ngrok: ngrok http 8000"
echo ""

# PHPサーバーを起動
php -S localhost:8000