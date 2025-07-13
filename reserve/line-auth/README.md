# LINE認証システム

## 概要
LINEアプリのリッチメニューから予約システムにアクセスする際のLINE認証を行うシステムです。

## 機能
1. LINE OAuth 2.0による認証
2. LINEユーザーIDの取得
3. 外部APIと連携してユーザー情報を取得
4. セッション管理

## セットアップ

### 1. 環境変数の設定
`.env.example`を`.env`にコピーして、必要な情報を設定してください：

```bash
cp .env.example .env
```

### 2. LINE Developersの設定
- LINE LoginチャンネルでコールバックURLを設定
- 例: `https://your-domain.com/reserve/line-auth/callback.php`

### 3. ローカル開発環境での実行
```bash
# プロジェクトルートから
php -S localhost:8000

# 注意: HTTPSが必要な場合はngrokなどを使用
```

## ファイル構成
- `index.php` - エントリーポイント（LINE認証開始）
- `callback.php` - LINE認証コールバック処理
- `LineAuth.php` - LINE認証関連のクラス
- `ExternalApi.php` - 外部API連携クラス
- `config.php` - 設定ファイル

## セキュリティ考慮事項
- HTTPS必須
- state パラメータによるCSRF対策
- セッションのセキュリティ設定
- 環境変数による秘密情報の管理