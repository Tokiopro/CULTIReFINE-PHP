<?php
// .envファイルを読み込む
require_once __DIR__ . '/env-loader.php';
EnvLoader::load(__DIR__ . '/.env');

// URLヘルパーを読み込む
require_once __DIR__ . '/url-helper.php';

// LINE認証設定
define('LINE_CHANNEL_ID', getenv('LINE_CHANNEL_ID'));
define('LINE_CHANNEL_SECRET', getenv('LINE_CHANNEL_SECRET'));

// コールバックURLを動的に生成
define('LINE_CALLBACK_URL', getLineCallbackUrl());

// セッション設定
define('SESSION_LIFETIME', 3600); // 1時間

// GAS API設定
define('GAS_DEPLOYMENT_ID', getenv('GAS_DEPLOYMENT_ID'));
define('GAS_API_KEY', getenv('GAS_API_KEY'));

// 開発環境設定
define('DEBUG_MODE', getenv('DEBUG_MODE') === 'true');
define('MOCK_MODE', getenv('MOCK_MODE') === 'true'); // モックモード

// 必須設定の確認
$requiredConfigs = [
    'LINE_CHANNEL_ID' => LINE_CHANNEL_ID,
    'LINE_CHANNEL_SECRET' => LINE_CHANNEL_SECRET,
    'LINE_CALLBACK_URL' => LINE_CALLBACK_URL
];

foreach ($requiredConfigs as $name => $value) {
    if (empty($value)) {
        die("エラー: {$name} が設定されていません。.envファイルを確認してください。");
    }
}

// セッション開始
if (session_status() == PHP_SESSION_NONE) {
    session_start([
        'cookie_lifetime' => SESSION_LIFETIME,
        'cookie_httponly' => true,
        'cookie_secure' => true,
        'cookie_samesite' => 'Lax'
    ]);
}