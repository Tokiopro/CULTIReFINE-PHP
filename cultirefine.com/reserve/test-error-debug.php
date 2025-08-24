<?php
/**
 * エラーデバッグ用テストファイル
 * 500エラーの原因を特定するための最小限のテスト
 */

// エラー表示を有効化
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<!DOCTYPE html>\n";
echo "<html lang=\"ja\">\n";
echo "<head><meta charset=\"UTF-8\"><title>Error Debug Test</title></head>\n";
echo "<body>\n";
echo "<h1>エラーデバッグテスト</h1>\n";

echo "<h2>1. PHP環境チェック</h2>\n";
echo "<p>PHP Version: " . phpversion() . "</p>\n";
echo "<p>Server: " . $_SERVER['SERVER_SOFTWARE'] . "</p>\n";

echo "<h2>2. config.phpの読み込みテスト</h2>\n";
try {
    require_once __DIR__ . '/line-auth/config.php';
    echo "<p style='color:green;'>✓ config.php loaded successfully</p>\n";
} catch (Exception $e) {
    echo "<p style='color:red;'>✗ Error loading config.php: " . $e->getMessage() . "</p>\n";
}

echo "<h2>3. 定数の確認</h2>\n";
echo "<p>GAS_DEPLOYMENT_ID exists: " . (defined('GAS_DEPLOYMENT_ID') ? 'Yes' : 'No') . "</p>\n";
if (defined('GAS_DEPLOYMENT_ID')) {
    echo "<p>GAS_DEPLOYMENT_ID length: " . strlen(GAS_DEPLOYMENT_ID) . " chars</p>\n";
}

echo "<p>GAS_API_KEY exists: " . (defined('GAS_API_KEY') ? 'Yes' : 'No') . "</p>\n";
if (defined('GAS_API_KEY')) {
    echo "<p>GAS_API_KEY length: " . strlen(GAS_API_KEY) . " chars</p>\n";
}

echo "<h2>4. 関数定義のテスト（tryブロック外）</h2>\n";
function testFunction($param) {
    return "Function works with param: " . $param;
}
echo "<p>" . testFunction("test") . "</p>\n";

echo "<h2>5. 定数を使用する関数のテスト</h2>\n";
function testConstantAccess() {
    if (defined('GAS_DEPLOYMENT_ID')) {
        return "Can access GAS_DEPLOYMENT_ID: " . substr(GAS_DEPLOYMENT_ID, 0, 10) . "...";
    } else {
        return "Cannot access GAS_DEPLOYMENT_ID";
    }
}
echo "<p>" . testConstantAccess() . "</p>\n";

echo "<h2>6. callGasApiDirect関数の簡易版テスト</h2>\n";
function callGasApiDirectTest($path) {
    // 定数にアクセスできるか確認
    if (!defined('GAS_DEPLOYMENT_ID') || !defined('GAS_API_KEY')) {
        return "Error: Constants not defined";
    }
    
    // URLを構築
    $url = "https://script.google.com/macros/s/" . GAS_DEPLOYMENT_ID . "/exec";
    $url .= "?path=" . urlencode($path);
    
    return "URL would be: " . substr($url, 0, 100) . "...";
}

try {
    $result = callGasApiDirectTest('/api/test');
    echo "<p style='color:green;'>✓ " . $result . "</p>\n";
} catch (Exception $e) {
    echo "<p style='color:red;'>✗ Error: " . $e->getMessage() . "</p>\n";
}

echo "<h2>7. cURL拡張の確認</h2>\n";
if (function_exists('curl_init')) {
    echo "<p style='color:green;'>✓ cURL extension is available</p>\n";
    $version = curl_version();
    echo "<p>cURL Version: " . $version['version'] . "</p>\n";
} else {
    echo "<p style='color:red;'>✗ cURL extension is not available</p>\n";
}

echo "<h2>8. エラーログの最新エントリ</h2>\n";
$errorLogPath = __DIR__ . '/error.log';
if (file_exists($errorLogPath)) {
    $lines = file($errorLogPath);
    $lastLines = array_slice($lines, -5);
    echo "<pre style='background:#f0f0f0; padding:10px;'>\n";
    foreach ($lastLines as $line) {
        echo htmlspecialchars($line);
    }
    echo "</pre>\n";
} else {
    echo "<p>Error log not found at: " . $errorLogPath . "</p>\n";
}

echo "<h2>9. index.phpの構文チェック</h2>\n";
$indexPath = __DIR__ . '/index.php';
if (file_exists($indexPath)) {
    // PHPの構文チェック（実行せずに）
    $output = shell_exec("php -l " . escapeshellarg($indexPath) . " 2>&1");
    if (strpos($output, 'No syntax errors') !== false) {
        echo "<p style='color:green;'>✓ No syntax errors in index.php</p>\n";
    } else {
        echo "<p style='color:red;'>✗ Syntax error in index.php:</p>\n";
        echo "<pre style='background:#ffe0e0; padding:10px;'>" . htmlspecialchars($output) . "</pre>\n";
    }
} else {
    echo "<p>index.php not found</p>\n";
}

echo "<h2>10. メモリとタイムアウト設定</h2>\n";
echo "<p>memory_limit: " . ini_get('memory_limit') . "</p>\n";
echo "<p>max_execution_time: " . ini_get('max_execution_time') . " seconds</p>\n";
echo "<p>post_max_size: " . ini_get('post_max_size') . "</p>\n";

echo "<hr>\n";
echo "<p style='color:green; font-weight:bold;'>All basic tests completed!</p>\n";

echo "</body>\n";
echo "</html>\n";
?>