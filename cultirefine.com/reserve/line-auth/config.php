<?php
// エラー表示設定（デバッグ用）
error_reporting(E_ALL);
ini_set('display_errors', 0); // 本番環境では0にする
ini_set('log_errors', 1);

// .envファイルを読み込む
require_once __DIR__ . '/env-loader.php';
$envPath = __DIR__ . '/.env';
if (!file_exists($envPath)) {
    // .envファイルが存在しない場合のエラーハンドリング
    error_log('[Config] .env file not found at: ' . $envPath);
    // デフォルト値を設定
}
EnvLoader::load($envPath);

// URLヘルパーを読み込む
require_once __DIR__ . '/url-helper.php';

// LINE認証設定（デフォルト値付き）
define('LINE_CHANNEL_ID', getenv('LINE_CHANNEL_ID') ?: '');
define('LINE_CHANNEL_SECRET', getenv('LINE_CHANNEL_SECRET') ?: '');

// コールバックURLを動的に生成
define('LINE_CALLBACK_URL', getLineCallbackUrl());

// セッション設定（参考値：SessionManagerで実際の設定を行う）
define('SESSION_LIFETIME', 3600); // 1時間

// 注意: セッション開始処理はSessionManagerが一元管理するため、ここでは行わない

// GAS API設定（デフォルト値付き）
define('GAS_DEPLOYMENT_ID', getenv('GAS_DEPLOYMENT_ID') ?: '');
define('GAS_API_KEY', getenv('GAS_API_KEY') ?: '');

// Medical Force API設定
define('MEDICAL_FORCE_API_URL', getenv('MEDICAL_FORCE_API_URL') ?: 'https://api.medical-force.com');
define('MEDICAL_FORCE_API_KEY', getenv('MEDICAL_FORCE_API_KEY') ?: '');
define('MEDICAL_FORCE_CLIENT_ID', getenv('MEDICAL_FORCE_CLIENT_ID') ?: '');
define('MEDICAL_FORCE_CLIENT_SECRET', getenv('MEDICAL_FORCE_CLIENT_SECRET') ?: '');

// クリニック営業時間設定
define('CLINIC_OPEN_TIME', getenv('CLINIC_OPEN_TIME') ?: '09:00');
define('CLINIC_CLOSE_TIME', getenv('CLINIC_CLOSE_TIME') ?: '19:00');

// 開発環境設定
define('DEBUG_MODE', getenv('DEBUG_MODE') === 'true');
define('MOCK_MODE', getenv('MOCK_MODE') === 'true'); // モックモード
define('MOCK_MEDICAL_FORCE', getenv('MOCK_MEDICAL_FORCE') === 'true'); // Medical Force モックモード

// 必須設定の確認（より詳細なエラーメッセージ）
$requiredConfigs = [
    'LINE_CHANNEL_ID' => LINE_CHANNEL_ID,
    'LINE_CHANNEL_SECRET' => LINE_CHANNEL_SECRET,
    'LINE_CALLBACK_URL' => LINE_CALLBACK_URL
];

$missingConfigs = [];
foreach ($requiredConfigs as $name => $value) {
    if (empty($value)) {
        $missingConfigs[] = $name;
    }
}

if (!empty($missingConfigs)) {
    $errorMessage = "設定エラー: 以下の必須設定が不足しています:\n" . implode(', ', $missingConfigs);
    error_log('[Config] ' . $errorMessage);
    
    // より詳細なエラーページを表示
    header('HTTP/1.1 500 Internal Server Error');
    echo "<h1>設定エラー</h1>";
    echo "<p>システムの設定が不完全です。管理者にお問い合わせください。</p>";
    if (DEBUG_MODE) {
        echo "<pre>" . htmlspecialchars($errorMessage) . "</pre>";
        echo "<p>.envファイルのパス: " . htmlspecialchars($envPath) . "</p>";
    }
    exit(1);
}

