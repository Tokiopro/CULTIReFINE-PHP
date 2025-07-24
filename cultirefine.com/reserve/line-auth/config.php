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

// セッションの初期設定（一度だけ実行）
if (session_status() === PHP_SESSION_NONE) {
    // HTTPS環境の確認
    $isSecure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
                (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    
    // セッションパラメータを設定
    $sessionParams = [
        'lifetime' => SESSION_LIFETIME,
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ];
    
    // セッションクッキーパラメータを設定
    session_set_cookie_params($sessionParams);
    
    // セッションのガベージコレクション設定
    ini_set('session.gc_maxlifetime', SESSION_LIFETIME);
    
    // セッションを開始
    session_start();
    
    // デバッグ情報
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('[Config] Session started with ID: ' . session_id());
        error_log('[Config] Session cookie params: ' . json_encode($sessionParams));
    }
}

// GAS API設定
define('GAS_DEPLOYMENT_ID', getenv('GAS_DEPLOYMENT_ID'));
define('GAS_API_KEY', getenv('GAS_API_KEY'));

// Medical Force API設定
define('MEDICAL_FORCE_API_URL', getenv('MEDICAL_FORCE_API_URL') ?: 'https://api.medical-force.com');
define('MEDICAL_FORCE_API_KEY', getenv('MEDICAL_FORCE_API_KEY'));
define('MEDICAL_FORCE_CLIENT_ID', getenv('MEDICAL_FORCE_CLIENT_ID'));
define('MEDICAL_FORCE_CLIENT_SECRET', getenv('MEDICAL_FORCE_CLIENT_SECRET'));

// クリニック営業時間設定
define('CLINIC_OPEN_TIME', getenv('CLINIC_OPEN_TIME') ?: '09:00');
define('CLINIC_CLOSE_TIME', getenv('CLINIC_CLOSE_TIME') ?: '19:00');

// 開発環境設定
define('DEBUG_MODE', getenv('DEBUG_MODE') === 'true');
define('MOCK_MODE', getenv('MOCK_MODE') === 'true'); // モックモード
define('MOCK_MEDICAL_FORCE', getenv('MOCK_MEDICAL_FORCE') === 'true'); // Medical Force モックモード

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

// セッション開始の重複チェック（既に上で開始済みなのでここでは何もしない）
if (session_status() == PHP_SESSION_NONE) {
    // このブロックは通常実行されない（既にセッション開始済みのため）
    error_log('[Config] WARNING: Session was not started, starting now');
    session_start();
}