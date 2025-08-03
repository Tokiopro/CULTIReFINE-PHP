# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 基本ルール

### 言語と専門性
- **応答は全て日本語で実施**。内部思考は英語で実施してより精度を高くする
- Web開発のエキスパートとして、CSS、JavaScript、React、Tailwind、Node.JS、Hugo/Markdownに精通
- 最適なツールの選択と使用に長け、不必要な重複や複雑さを避ける

## プロジェクト概要

天満病院予約システム - LINE認証と連携した医療予約管理システム
- **フロントエンド**: Vanilla JavaScript (ES6モジュール), HTML5, CSS3
- **バックエンド**: PHP, Google Apps Script (GAS API)
- **認証**: LINE Login OAuth 2.0
- **データストア**: Google Sheets (GAS経由)
- **デプロイ先**: さくらサーバー

## デュアル環境構成

本プロジェクトは2つの並行環境を持っています：

1. **cultirefine.com/** - 本番用（静的HTML版）
   - 静的HTMLファイルで構成
   - JavaScript モジュールは CDN から読み込み
   - PHPを使用しない軽量版

2. **reserve/** - 開発・本番用（PHP版）
   - LINE認証機能付き
   - PHP セッション管理
   - 環境変数による設定管理

## よく使うコマンド

### ローカル開発
```bash
# 開発サーバー起動
./start-local-server.sh
# または
php -S localhost:8000

# Node.js開発サーバー（nodemon使用）
npm run dev

# Node.js開発サーバー（通常）
npm run start

# HTTPS環境が必要な場合（LINE認証テスト用）
ngrok http 8000
```

### NPM Scripts
```bash
# テスト実行（現在未設定）
npm test

# APIテスト
npm run test-api

# テスト環境セットアップ
npm run setup-test
```

### GAS開発（clasp）
```bash
# Google Apps Scriptにログイン
npm run login

# 新規GASプロジェクト作成
npm run create

# ローカルからGASへプッシュ
npm run push

# GASからローカルへプル
npm run pull

# GASエディタを開く
npm run open

# ログを確認
npm run logs

# デプロイ
npm run deploy

# ファイル監視モード
npm run watch
```

### デプロイ
```bash
# 本番環境へデプロイ
./deploy.sh

# PHPの構文チェック
find . -name "*.php" -exec php -l {} \;

# ESLintでJavaScriptをチェック
npx eslint cultirefine.com/reserve/js/**/*.js

# TypeScriptの型チェック
npx tsc --noEmit
```

### SSH接続
```bash
# さくらサーバーに接続
ssh tenma-hospital

# 接続テスト
ssh tenma-hospital "echo 'Connection OK'"

# パスワード認証で接続（公開鍵認証が失敗した場合）
ssh -o PreferredAuthentications=password cultirefine@cultirefine.sakura.ne.jp

# SSH鍵の管理
ssh-add ~/.ssh/tenma-hospital-new
ssh-add -l  # 登録されている鍵を確認
chmod 600 ~/.ssh/tenma-hospital-new  # 鍵の権限を修正
```

### SFTP拡張機能（VSCode）
```
Cmd+Shift+P でコマンドパレットを開き：
- SFTP: Upload Active File - 現在のファイルをアップロード
- SFTP: Upload Changed Files - 変更されたファイルをアップロード
- SFTP: Sync Local -> Remote - ローカル→リモート同期
- SFTP: Diff - ローカルとリモートの差分表示
```

## プロジェクト構造

### JavaScript アーキテクチャ
```
cultirefine.com/reserve/js/
├── core/               # コアユーティリティ
│   ├── app-state.js    # アプリケーション状態管理
│   ├── storage-manager.js # ローカルストレージ管理
│   └── ui-helpers.js   # UI共通ヘルパー
├── components/         # UIコンポーネント
│   ├── calendar.js     # カレンダーコンポーネント
│   ├── modal.js        # モーダルダイアログ
│   └── treatment-accordion.js # 施術アコーディオン
├── screens/            # 画面別ロジック
│   ├── patient-selection.js # 患者選択画面
│   ├── menu-calendar.js    # メニュー・カレンダー画面
│   ├── pair-booking.js     # ペア予約画面
│   └── bulk-booking.js     # 一括予約画面
├── data/               # データ層
│   ├── gas-api.js      # GAS API通信
│   ├── mock-api.js     # モックAPI（開発用）
│   └── treatment-data.js # 施術データ定義
└── main.js             # エントリーポイント
```

### PHP バックエンド
```
reserve/
├── line-auth/          # LINE認証関連
│   ├── LineAuth.php    # LINE OAuth実装
│   ├── GasApiClient.php # GAS API クライアント
│   └── callback.php    # LINE認証コールバック
├── api-bridge.php      # API通信ブリッジ
└── index.php           # メインエントリー
```

## 環境設定

### 必須環境変数 (.env)
```bash
# LINE認証
LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CALLBACK_URL=https://your-domain.com/reserve/line-auth/callback.php

# GAS API
GAS_DEPLOYMENT_ID=your_deployment_id
GAS_API_KEY=your_api_key

# Medical Force API
MEDICAL_FORCE_API_URL=https://api.medical-force.com
MEDICAL_FORCE_API_KEY=your_api_key
MEDICAL_FORCE_CLIENT_ID=your_client_id
MEDICAL_FORCE_CLIENT_SECRET=your_client_secret

# クリニック営業時間
CLINIC_OPEN_TIME=09:00
CLINIC_CLOSE_TIME=19:00

# デバッグ設定
DEBUG_MODE=true    # 開発時はtrue
MOCK_MODE=false    # モックAPI使用時はtrue
MOCK_MEDICAL_FORCE=false  # Medical Forceモックモード
```

### ローカルパス設定
deploy.sh内のローカルパスはユーザーごとに異なるため、必要に応じて修正してください：
```bash
LOCAL_DIR="/Users/ash-_/プログラミング/天満病院/PHP/"  # 自分の環境に合わせて変更
```

## 開発ガイドライン

### コードレビューとプランニング
1. コードを書いたり提案したりする前に、既存のコードの詳細なレビューを行い、<CODE_REVIEW>タグ内でその動作を説明
2. レビュー完了後、<PLANNING>タグ内で変更の慎重な計画を立てる
3. 変数名や文字列リテラルに注意を払い、必要でない限り変更しない
4. 規約に従って何かに名前を付ける場合は、::UPPERCASE::で囲む
5. 即座の問題解決と汎用性・柔軟性のバランスを取る

### 問題解決アプローチ
- 変更を個別の段階に分解し、各段階の後に小さなテストを提案
- 会話の中で指示された場合や例を示す必要がある場合にコードを生成
- コードなしで回答できる場合はそれを優先し、必要に応じて詳細を求める

### 曖昧さへの対処
- 不明確または曖昧な点がある場合は常に明確化を求める
- 選択肢がある場合はトレードオフや実装オプションの議論を提示
- 不必要な謝罪を避け、会話を振り返って以前の間違いを繰り返さない

### セキュリティ
1. セキュリティに十分注意を払い、データを危険にさらしたり新たな脆弱性を導入したりする可能性のあることを行わない
2. 潜在的なセキュリティリスク（例：入力処理、認証管理）がある場合は、<SECURITY_REVIEW>タグ内で理由を示しながら追加のレビューを実施
3. LINE認証トークンは適切に管理
4. GAS APIキーは環境変数で管理
5. XSS対策としてユーザー入力は適切にエスケープ
6. HTTPSを強制（.htaccessで設定済み）

### エラーハンドリング
- APIエラーは適切にキャッチし、ユーザーフレンドリーなメッセージを表示
- console.errorでデバッグ情報を記録
- LINE認証エラーは別途ハンドリング

### ファイル修正時の注意
1. どのファイルを修正するかを明示
2. 新規ファイル作成前に既存ファイルがないか確認
3. 修正において、考えられる原因をリストアップして原因を追求
4. 修正が失敗した場合はログを確認して原因をリストアップ
5. ALWAYS prefer editing existing files in the codebase
6. NEVER write new files unless explicitly required
7. NEVER proactively create documentation files (*.md) or README files

## デバッグ方法

### JavaScript
```javascript
// デバッグモード確認
if (window.DEBUG_MODE) {
    console.log('Debug info:', data);
}
```

### PHP
```php
// デバッグログ出力
if (getenv('DEBUG_MODE') === 'true') {
    error_log('Debug: ' . print_r($data, true));
}
```

### API通信確認
- ブラウザの開発者ツール > Network タブでAPIリクエストを確認
- `api-bridge.php`のログを確認
- GAS側のログも合わせて確認

## トラブルシューティング

### SSH接続できない場合
```bash
# 詳細なデバッグ情報を表示
ssh -vvv tenma-hospital

# known_hostsをクリア（ホスト鍵が変更された場合）
ssh-keygen -R cultirefine.sakura.ne.jp
```

### デプロイが失敗する場合
```bash
# SSH接続テスト
ssh tenma-hospital "echo 'Connection OK'"

# リモートディレクトリを確認
ssh tenma-hospital "ls -la /home/cultirefine/www/"
```

## 重要な実装パターン

### ES6モジュール
- すべてのJavaScriptファイルはES6モジュールとして実装
- import/export文を使用した明確な依存関係
- グローバル変数の使用を避ける

### 日本語対応
応答は全て日本語で実施。内部思考は英語で実施してより精度を高くする。

## 運用上の考慮事項

生成されるすべてのものが運用上健全であることが重要です：
- ソリューションのホスティング、管理、監視、保守方法を検討
- あらゆる段階で運用上の懸念事項を考慮
- 関連する場合はそれらを強調

### デプロイ時の確認事項
1. 環境変数が本番環境用に設定されているか
2. デバッグモードが無効になっているか
3. エラーログが適切に設定されているか
4. セキュリティ設定が適切か

## 注意事項

1. **LINE認証にはHTTPS環境が必須** - ローカル開発時はngrokを使用
2. **GAS APIには実行時間制限あり** - 6分を超える処理は避ける
3. **患者データは個人情報** - 適切なアクセス制御とログ管理を実施
4. **モバイル対応必須** - レスポンシブデザインを維持
5. **ブラウザ互換性** - モダンブラウザ（Chrome, Safari, Firefox, Edge）をサポート
6. **デュアル環境** - cultirefine.com/とreserve/の違いを理解して開発
7. **ローカルパス設定** - deploy.sh内のLOCAL_DIRは環境に応じて変更が必要