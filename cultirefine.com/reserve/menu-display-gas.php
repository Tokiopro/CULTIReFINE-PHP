<?php
/**
 * メニュー表示ページ - GasApiClient直接使用版
 * GasApiClientを使用してgetAllStructuredMenusを呼び出し、メニューを表示
 */

// セッション開始（公開APIだが、デバッグ用にセッション情報も表示）
session_start();

// 必要なファイルを読み込み
require_once __DIR__ . '/line-auth/config.php';
require_once __DIR__ . '/line-auth/logger.php';
require_once __DIR__ . '/line-auth/GasApiClient.php';

// ロガー初期化
$logger = new Logger();

// デバッグモードを有効化
define('DEBUG_MODE', true);

// 実行開始時刻
$startTime = microtime(true);

// GasApiClientをインスタンス化
try {
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    $clientInitialized = true;
    $initError = null;
    
    if (DEBUG_MODE) {
        error_log('[Menu Display] GasApiClient initialized successfully');
        error_log('[Menu Display] GAS_DEPLOYMENT_ID: ' . (GAS_DEPLOYMENT_ID ? 'SET (' . strlen(GAS_DEPLOYMENT_ID) . ' chars)' : 'NOT SET'));
        error_log('[Menu Display] GAS_API_KEY: ' . (GAS_API_KEY ? 'SET (' . strlen(GAS_API_KEY) . ' chars)' : 'NOT SET'));
    }
} catch (Exception $e) {
    $clientInitialized = false;
    $initError = $e->getMessage();
    error_log('[Menu Display] Failed to initialize GasApiClient: ' . $initError);
}

// メニューデータを取得
$menuData = null;
$apiError = null;
$apiResponseTime = 0;

if ($clientInitialized) {
    try {
        $apiStartTime = microtime(true);
        
        // getAllStructuredMenusを呼び出し
        $menuResult = $gasApi->getAllStructuredMenus();
        
        $apiEndTime = microtime(true);
        $apiResponseTime = round(($apiEndTime - $apiStartTime) * 1000, 2); // ミリ秒
        
        if (DEBUG_MODE) {
            error_log('[Menu Display] getAllStructuredMenus response received in ' . $apiResponseTime . 'ms');
            error_log('[Menu Display] Response status: ' . ($menuResult['status'] ?? 'no_status'));
            error_log('[Menu Display] Response keys: ' . implode(', ', array_keys($menuResult)));
        }
        
        if ($menuResult['status'] === 'success' && isset($menuResult['data'])) {
            $menuData = $menuResult['data'];
            
            // メニュー数をカウント
            $withTicketCount = 0;
            $withoutTicketCount = 0;
            
            if (isset($menuData['withTicket']['categories'])) {
                foreach ($menuData['withTicket']['categories'] as $category) {
                    $withTicketCount += count($category['menus'] ?? []);
                }
            }
            
            if (isset($menuData['withoutTicket']['categories'])) {
                foreach ($menuData['withoutTicket']['categories'] as $category) {
                    $withoutTicketCount += count($category['menus'] ?? []);
                }
            }
            
            if (DEBUG_MODE) {
                error_log('[Menu Display] Successfully retrieved menus - WithTicket: ' . $withTicketCount . ', WithoutTicket: ' . $withoutTicketCount);
            }
        } else {
            $apiError = $menuResult['error'] ?? 'メニューデータの取得に失敗しました';
            error_log('[Menu Display] API Error: ' . $apiError);
        }
        
    } catch (Exception $e) {
        $apiError = $e->getMessage();
        error_log('[Menu Display] Exception during API call: ' . $apiError);
        error_log('[Menu Display] Stack trace: ' . $e->getTraceAsString());
    }
}

// 全体の実行時間
$endTime = microtime(true);
$totalTime = round(($endTime - $startTime) * 1000, 2); // ミリ秒
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>メニュー表示 - GasApiClient使用版</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        .menu-card {
            transition: all 0.3s ease;
        }
        .menu-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .category-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .ticket-badge {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .no-ticket-badge {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .debug-info {
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.875rem;
        }
        .json-key { color: #9cdcfe; }
        .json-string { color: #ce9178; }
        .json-number { color: #b5cea8; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
        <!-- ヘッダー -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">
                メニュー表示 - GasApiClient直接使用版
            </h1>
            <p class="text-gray-600">
                GasApiClientのgetAllStructuredMenusメソッドを使用してメニューデータを取得・表示
            </p>
            
            <!-- 実行情報 -->
            <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">APIクライアント</p>
                    <p class="text-sm font-semibold <?php echo $clientInitialized ? 'text-green-600' : 'text-red-600'; ?>">
                        <?php echo $clientInitialized ? '初期化成功' : '初期化失敗'; ?>
                    </p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">API応答時間</p>
                    <p class="text-sm font-semibold text-gray-900">
                        <?php echo $apiResponseTime; ?>ms
                    </p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">全体実行時間</p>
                    <p class="text-sm font-semibold text-gray-900">
                        <?php echo $totalTime; ?>ms
                    </p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">取得メニュー数</p>
                    <p class="text-sm font-semibold text-gray-900">
                        <?php echo isset($withTicketCount) ? ($withTicketCount + $withoutTicketCount) : 0; ?>件
                    </p>
                </div>
            </div>
        </div>
        
        <?php if ($initError): ?>
            <!-- 初期化エラー表示 -->
            <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <div class="flex">
                    <div class="ml-3">
                        <p class="text-sm text-red-700">
                            <strong>初期化エラー:</strong> <?php echo htmlspecialchars($initError); ?>
                        </p>
                    </div>
                </div>
            </div>
        <?php endif; ?>
        
        <?php if ($apiError): ?>
            <!-- APIエラー表示 -->
            <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <div class="flex">
                    <div class="ml-3">
                        <p class="text-sm text-red-700">
                            <strong>APIエラー:</strong> <?php echo htmlspecialchars($apiError); ?>
                        </p>
                    </div>
                </div>
            </div>
        <?php endif; ?>
        
        <?php if ($menuData): ?>
            <!-- メニュー表示 -->
            <div class="grid lg:grid-cols-2 gap-6">
                <!-- チケット付きメニュー -->
                <?php if (isset($menuData['withTicket'])): ?>
                <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div class="category-header text-white p-4">
                        <h2 class="text-xl font-bold flex items-center">
                            <span class="ticket-badge px-3 py-1 rounded-full text-sm mr-3">チケット利用</span>
                            チケット付きメニュー
                        </h2>
                    </div>
                    <div class="p-4 space-y-4">
                        <?php foreach ($menuData['withTicket']['categories'] ?? [] as $category): ?>
                        <div class="border rounded-lg p-4">
                            <h3 class="font-semibold text-lg text-gray-800 mb-3">
                                <?php echo htmlspecialchars($category['categoryName']); ?>
                                <span class="text-sm text-gray-500 ml-2">
                                    (<?php echo count($category['menus'] ?? []); ?>件)
                                </span>
                            </h3>
                            <div class="space-y-2">
                                <?php foreach ($category['menus'] ?? [] as $menu): ?>
                                <div class="menu-card bg-gray-50 rounded p-3 hover:bg-gray-100">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <p class="font-medium text-gray-900">
                                                <?php echo htmlspecialchars($menu['name']); ?>
                                            </p>
                                            <?php if (!empty($menu['time'])): ?>
                                            <p class="text-sm text-gray-600">
                                                施術時間: <?php echo htmlspecialchars($menu['time']); ?>分
                                            </p>
                                            <?php endif; ?>
                                            <?php if (!empty($menu['price'])): ?>
                                            <p class="text-sm text-gray-600">
                                                価格: ¥<?php echo number_format($menu['price']); ?>
                                            </p>
                                            <?php endif; ?>
                                        </div>
                                        <div class="ml-4">
                                            <span class="text-xs text-gray-500">
                                                ID: <?php echo htmlspecialchars($menu['id'] ?? 'N/A'); ?>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>
                
                <!-- チケットなしメニュー -->
                <?php if (isset($menuData['withoutTicket'])): ?>
                <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div class="category-header text-white p-4">
                        <h2 class="text-xl font-bold flex items-center">
                            <span class="no-ticket-badge px-3 py-1 rounded-full text-sm mr-3">通常</span>
                            チケットなしメニュー
                        </h2>
                    </div>
                    <div class="p-4 space-y-4">
                        <?php foreach ($menuData['withoutTicket']['categories'] ?? [] as $category): ?>
                        <div class="border rounded-lg p-4">
                            <h3 class="font-semibold text-lg text-gray-800 mb-3">
                                <?php echo htmlspecialchars($category['categoryName']); ?>
                                <span class="text-sm text-gray-500 ml-2">
                                    (<?php echo count($category['menus'] ?? []); ?>件)
                                </span>
                            </h3>
                            <div class="space-y-2">
                                <?php foreach ($category['menus'] ?? [] as $menu): ?>
                                <div class="menu-card bg-gray-50 rounded p-3 hover:bg-gray-100">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <p class="font-medium text-gray-900">
                                                <?php echo htmlspecialchars($menu['name']); ?>
                                            </p>
                                            <?php if (!empty($menu['time'])): ?>
                                            <p class="text-sm text-gray-600">
                                                施術時間: <?php echo htmlspecialchars($menu['time']); ?>分
                                            </p>
                                            <?php endif; ?>
                                            <?php if (!empty($menu['price'])): ?>
                                            <p class="text-sm text-gray-600">
                                                価格: ¥<?php echo number_format($menu['price']); ?>
                                            </p>
                                            <?php endif; ?>
                                        </div>
                                        <div class="ml-4">
                                            <span class="text-xs text-gray-500">
                                                ID: <?php echo htmlspecialchars($menu['id'] ?? 'N/A'); ?>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        
        <?php if (DEBUG_MODE): ?>
        <!-- デバッグ情報 -->
        <div class="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">デバッグ情報</h2>
            
            <!-- 環境設定 -->
            <div class="mb-4">
                <h3 class="font-semibold text-gray-700 mb-2">環境設定</h3>
                <div class="debug-info p-4 rounded overflow-x-auto">
                    <pre><?php
                    $debugInfo = [
                        'PHP_VERSION' => PHP_VERSION,
                        'SESSION_STATUS' => session_status(),
                        'SESSION_ID' => session_id() ?: 'No session',
                        'DEBUG_MODE' => DEBUG_MODE,
                        'GAS_DEPLOYMENT_ID' => GAS_DEPLOYMENT_ID ? 'SET (' . strlen(GAS_DEPLOYMENT_ID) . ' chars)' : 'NOT SET',
                        'GAS_API_KEY' => GAS_API_KEY ? 'SET (' . strlen(GAS_API_KEY) . ' chars)' : 'NOT SET',
                        'Execution_Time' => [
                            'API_Response' => $apiResponseTime . 'ms',
                            'Total' => $totalTime . 'ms'
                        ]
                    ];
                    echo json_encode($debugInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                    ?></pre>
                </div>
            </div>
            
            <!-- APIレスポンス -->
            <?php if (isset($menuResult)): ?>
            <div class="mb-4">
                <h3 class="font-semibold text-gray-700 mb-2">APIレスポンス（生データ）</h3>
                <div class="debug-info p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
                    <pre><?php
                    echo htmlspecialchars(json_encode($menuResult, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                    ?></pre>
                </div>
            </div>
            <?php endif; ?>
            
            <!-- セッション情報 -->
            <div class="mb-4">
                <h3 class="font-semibold text-gray-700 mb-2">セッション情報</h3>
                <div class="debug-info p-4 rounded overflow-x-auto">
                    <pre><?php
                    echo json_encode($_SESSION, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                    ?></pre>
                </div>
            </div>
        </div>
        <?php endif; ?>
        
        <!-- ナビゲーション -->
        <div class="mt-6 flex gap-4 flex-wrap">
            <a href="/reserve/" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition">
                メイン画面に戻る
            </a>
            <a href="test-public-api.php" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                公開APIテスト
            </a>
            <a href="gas-api-test.php" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">
                GAS API診断
            </a>
            <button onclick="location.reload()" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition">
                再読み込み
            </button>
        </div>
    </div>
    
    <script>
        // デバッグ情報をコンソールに出力
        console.log('Menu Display Page - GasApiClient Version');
        console.log('API Response Time:', <?php echo $apiResponseTime; ?>, 'ms');
        console.log('Total Execution Time:', <?php echo $totalTime; ?>, 'ms');
        <?php if ($menuData): ?>
        console.log('Menu Data:', <?php echo json_encode($menuData); ?>);
        <?php endif; ?>
    </script>
</body>
</html>