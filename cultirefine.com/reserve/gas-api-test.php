<?php
/**
 * GAS API接続診断ページ
 * HTTP 500エラーの原因特定用
 */

session_start();

// デバッグモードを強制的に有効化
define('DEBUG_MODE', true);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 必要なファイルを読み込み
require_once __DIR__ . '/line-auth/config.php';
require_once __DIR__ . '/line-auth/logger.php';
require_once __DIR__ . '/line-auth/GasApiClient.php';

$logger = new Logger();

// テスト用の認証情報を設定（デバッグ専用）
if (!isset($_SESSION['line_user_id'])) {
    $_SESSION['line_user_id'] = 'test_user_' . uniqid();
    $_SESSION['line_display_name'] = 'テストユーザー';
    $_SESSION['line_auth_time'] = time();
    $logger->warning('[GAS API Test] Using test authentication');
}

// 診断結果を格納する配列
$diagnostics = [
    'timestamp' => date('Y-m-d H:i:s'),
    'session' => [],
    'config' => [],
    'gas_api' => [],
    'connectivity' => []
];

// セッション診断
$diagnostics['session'] = [
    'session_id' => session_id(),
    'session_status' => session_status(),
    'line_user_id' => $_SESSION['line_user_id'] ?? 'not_set',
    'line_auth_time' => $_SESSION['line_auth_time'] ?? null,
    'session_age_seconds' => isset($_SESSION['line_auth_time']) ? time() - $_SESSION['line_auth_time'] : null,
    'session_valid' => isset($_SESSION['line_user_id']) && !empty($_SESSION['line_user_id'])
];

// 設定診断
$diagnostics['config'] = [
    'gas_deployment_id' => defined('GAS_DEPLOYMENT_ID') ? 'SET (' . strlen(GAS_DEPLOYMENT_ID) . ' chars)' : 'NOT_SET',
    'gas_api_key' => defined('GAS_API_KEY') ? 'SET (' . strlen(GAS_API_KEY) . ' chars)' : 'NOT_SET',
    'debug_mode' => defined('DEBUG_MODE') ? DEBUG_MODE : false,
    'php_version' => PHP_VERSION,
    'curl_available' => function_exists('curl_init')
];

// GAS API診断
try {
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    $diagnostics['gas_api']['client_initialized'] = true;
    
    // ヘルスチェック
    try {
        $healthCheck = $gasApi->makeRequest('GET', '/api/health');
        $diagnostics['gas_api']['health_check'] = $healthCheck;
        $diagnostics['connectivity']['health_status'] = $healthCheck['status'] ?? 'unknown';
    } catch (Exception $e) {
        $diagnostics['gas_api']['health_check_error'] = $e->getMessage();
        $diagnostics['connectivity']['health_status'] = 'failed';
    }
    
    // getAllStructuredMenusテスト
    try {
        $startTime = microtime(true);
        $menuResult = $gasApi->getAllStructuredMenus();
        $endTime = microtime(true);
        
        $diagnostics['gas_api']['get_all_structured_menus'] = [
            'status' => $menuResult['status'] ?? 'unknown',
            'has_data' => isset($menuResult['data']),
            'response_time_ms' => round(($endTime - $startTime) * 1000, 2),
            'response_size' => strlen(json_encode($menuResult))
        ];
        
        if (isset($menuResult['data'])) {
            $menuCount = 0;
            if (isset($menuResult['data']['withTicket']['categories'])) {
                foreach ($menuResult['data']['withTicket']['categories'] as $cat) {
                    $menuCount += count($cat['menus'] ?? []);
                }
            }
            if (isset($menuResult['data']['withoutTicket']['categories'])) {
                foreach ($menuResult['data']['withoutTicket']['categories'] as $cat) {
                    $menuCount += count($cat['menus'] ?? []);
                }
            }
            $diagnostics['gas_api']['menu_count'] = $menuCount;
        }
        
        if ($menuResult['status'] === 'success') {
            $diagnostics['connectivity']['menu_api_status'] = 'success';
        } else {
            $diagnostics['connectivity']['menu_api_status'] = 'failed';
            $diagnostics['gas_api']['menu_api_error'] = $menuResult['error'] ?? 'Unknown error';
        }
        
    } catch (Exception $e) {
        $diagnostics['gas_api']['get_all_structured_menus_error'] = $e->getMessage();
        $diagnostics['connectivity']['menu_api_status'] = 'failed';
    }
    
} catch (Exception $e) {
    $diagnostics['gas_api']['client_initialization_error'] = $e->getMessage();
    $diagnostics['connectivity']['api_client_status'] = 'failed';
}

// 接続性テスト
$diagnostics['connectivity']['overall_status'] = 'unknown';
if (isset($diagnostics['connectivity']['health_status']) && isset($diagnostics['connectivity']['menu_api_status'])) {
    if ($diagnostics['connectivity']['health_status'] === 'success' && $diagnostics['connectivity']['menu_api_status'] === 'success') {
        $diagnostics['connectivity']['overall_status'] = 'healthy';
    } else {
        $diagnostics['connectivity']['overall_status'] = 'degraded';
    }
} else {
    $diagnostics['connectivity']['overall_status'] = 'failed';
}

// 推奨アクション
$recommendations = [];
if (!$diagnostics['session']['session_valid']) {
    $recommendations[] = 'セッション認証が無効です。LINE認証を完了してください。';
}
if ($diagnostics['config']['gas_deployment_id'] === 'NOT_SET') {
    $recommendations[] = 'GAS_DEPLOYMENT_IDが設定されていません。config.phpを確認してください。';
}
if ($diagnostics['config']['gas_api_key'] === 'NOT_SET') {
    $recommendations[] = 'GAS_API_KEYが設定されていません。config.phpを確認してください。';
}
if (isset($diagnostics['gas_api']['health_check_error'])) {
    $recommendations[] = 'GAS APIへの接続に失敗しています。ネットワーク設定やGAS URLを確認してください。';
}
if (isset($diagnostics['gas_api']['get_all_structured_menus_error'])) {
    $recommendations[] = 'getAllStructuredMenus APIの呼び出しに失敗しています。GAS側の実装を確認してください。';
}

$logger->info('[GAS API Test] Diagnostic completed', $diagnostics);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GAS API接続診断 - 天満病院予約システム</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        .status-success { @apply bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium; }
        .status-failed { @apply bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium; }
        .status-degraded { @apply bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium; }
        .status-unknown { @apply bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium; }
        .diagnostic-section { @apply bg-white rounded-lg shadow p-6 mb-6; }
        .diagnostic-item { @apply flex justify-between items-center py-2 border-b border-gray-100; }
        .diagnostic-item:last-child { @apply border-b-0; }
        .code-block { @apply bg-gray-900 text-gray-100 p-4 rounded text-sm font-mono overflow-x-auto; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">GAS API接続診断</h1>
            <p class="text-gray-600">HTTP 500エラーの原因特定と解決のための診断結果</p>
            <div class="mt-4">
                <span class="text-sm text-gray-500">診断実行日時: <?php echo $diagnostics['timestamp']; ?></span>
            </div>
        </div>

        <!-- 全体ステータス -->
        <div class="diagnostic-section">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                全体ステータス
            </h2>
            <div class="text-center py-8">
                <div class="status-<?php echo $diagnostics['connectivity']['overall_status']; ?> inline-block text-lg">
                    <?php
                    switch ($diagnostics['connectivity']['overall_status']) {
                        case 'healthy': echo '正常'; break;
                        case 'degraded': echo '一部問題あり'; break;
                        case 'failed': echo '接続失敗'; break;
                        default: echo '不明'; break;
                    }
                    ?>
                </div>
            </div>
        </div>

        <!-- セッション診断 -->
        <div class="diagnostic-section">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                セッション状態
            </h2>
            <div class="space-y-2">
                <div class="diagnostic-item">
                    <span>セッションID</span>
                    <span class="font-mono text-sm"><?php echo htmlspecialchars($diagnostics['session']['session_id']); ?></span>
                </div>
                <div class="diagnostic-item">
                    <span>LINE認証状態</span>
                    <span class="status-<?php echo $diagnostics['session']['session_valid'] ? 'success' : 'failed'; ?>">
                        <?php echo $diagnostics['session']['session_valid'] ? '認証済み' : '未認証'; ?>
                    </span>
                </div>
                <div class="diagnostic-item">
                    <span>LINE User ID</span>
                    <span class="font-mono text-sm"><?php echo htmlspecialchars($diagnostics['session']['line_user_id']); ?></span>
                </div>
                <?php if ($diagnostics['session']['session_age_seconds']): ?>
                <div class="diagnostic-item">
                    <span>セッション経過時間</span>
                    <span><?php echo round($diagnostics['session']['session_age_seconds'] / 60); ?>分</span>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- 設定診断 -->
        <div class="diagnostic-section">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                設定状態
            </h2>
            <div class="space-y-2">
                <?php foreach ($diagnostics['config'] as $key => $value): ?>
                <div class="diagnostic-item">
                    <span><?php echo ucfirst(str_replace('_', ' ', $key)); ?></span>
                    <span class="font-mono text-sm"><?php echo htmlspecialchars((string)$value); ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- GAS API診断 -->
        <div class="diagnostic-section">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                </svg>
                GAS API接続
            </h2>
            <div class="space-y-2">
                <div class="diagnostic-item">
                    <span>APIクライアント初期化</span>
                    <span class="status-<?php echo isset($diagnostics['gas_api']['client_initialized']) && $diagnostics['gas_api']['client_initialized'] ? 'success' : 'failed'; ?>">
                        <?php echo isset($diagnostics['gas_api']['client_initialized']) && $diagnostics['gas_api']['client_initialized'] ? '成功' : '失敗'; ?>
                    </span>
                </div>
                
                <?php if (isset($diagnostics['gas_api']['health_check'])): ?>
                <div class="diagnostic-item">
                    <span>ヘルスチェック</span>
                    <span class="status-<?php echo $diagnostics['connectivity']['health_status'] === 'success' ? 'success' : 'failed'; ?>">
                        <?php echo $diagnostics['connectivity']['health_status']; ?>
                    </span>
                </div>
                <?php endif; ?>
                
                <?php if (isset($diagnostics['gas_api']['get_all_structured_menus'])): ?>
                <div class="diagnostic-item">
                    <span>getAllStructuredMenus</span>
                    <span class="status-<?php echo $diagnostics['connectivity']['menu_api_status'] === 'success' ? 'success' : 'failed'; ?>">
                        <?php echo $diagnostics['connectivity']['menu_api_status']; ?>
                    </span>
                </div>
                <div class="diagnostic-item">
                    <span>レスポンス時間</span>
                    <span><?php echo $diagnostics['gas_api']['get_all_structured_menus']['response_time_ms']; ?>ms</span>
                </div>
                <?php if (isset($diagnostics['gas_api']['menu_count'])): ?>
                <div class="diagnostic-item">
                    <span>取得メニュー数</span>
                    <span><?php echo $diagnostics['gas_api']['menu_count']; ?>件</span>
                </div>
                <?php endif; ?>
                <?php endif; ?>
                
                <!-- エラー情報の表示 -->
                <?php foreach ($diagnostics['gas_api'] as $key => $value): ?>
                    <?php if (strpos($key, 'error') !== false): ?>
                    <div class="diagnostic-item">
                        <span class="text-red-600"><?php echo ucfirst(str_replace('_', ' ', $key)); ?></span>
                        <span class="text-red-600 text-sm"><?php echo htmlspecialchars($value); ?></span>
                    </div>
                    <?php endif; ?>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- 推奨アクション -->
        <?php if (!empty($recommendations)): ?>
        <div class="diagnostic-section">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
                <svg class="w-6 h-6 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                推奨アクション
            </h2>
            <div class="space-y-3">
                <?php foreach ($recommendations as $index => $recommendation): ?>
                <div class="flex items-start">
                    <div class="flex-shrink-0 w-6 h-6 bg-yellow-100 text-yellow-800 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                        <?php echo $index + 1; ?>
                    </div>
                    <p class="text-gray-700"><?php echo htmlspecialchars($recommendation); ?></p>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <!-- RAW診断データ -->
        <div class="diagnostic-section">
            <h2 class="text-xl font-semibold mb-4 flex items-center">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                詳細診断データ（JSON）
            </h2>
            <div class="code-block">
                <pre><?php echo json_encode($diagnostics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); ?></pre>
            </div>
        </div>

        <!-- アクションリンク -->
        <div class="mt-8 flex gap-4 flex-wrap">
            <a href="?" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                再診断実行
            </a>
            <a href="/reserve/" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition">
                メイン画面に戻る
            </a>
            <a href="test-menu-display.php" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">
                メニューテストページ
            </a>
        </div>
    </div>

    <script>
        // デバッグ用: コンソールに診断データを出力
        console.log('GAS API Diagnostics:', <?php echo json_encode($diagnostics); ?>);
    </script>
</body>
</html>