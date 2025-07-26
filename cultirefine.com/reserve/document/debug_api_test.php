<?php
/**
 * API通信デバッグ用テストファイル
 * document/debug_api_test.php として配置
 */

session_start();

// 設定ファイル読み込み
require_once '../line-auth/config.php';

echo "<h1>API通信デバッグテスト</h1>";

// 1. セッション確認
echo "<h2>1. セッション情報</h2>";
echo "Session ID: " . (session_id() ?: '未設定') . "<br>";
echo "Session Name: " . session_name() . "<br>";
echo "LINE User ID: " . ($_SESSION['line_user_id'] ?? '未設定') . "<br>";
echo "Session Data: <pre>" . print_r($_SESSION, true) . "</pre>";

// 2. ファイルパス確認
echo "<h2>2. ファイルパス確認</h2>";
$apiPath = '../api-bridge.php';
echo "API Bridge Path: {$apiPath}<br>";
echo "Real Path: " . (realpath($apiPath) ?: '見つかりません') . "<br>";
echo "File Exists: " . (file_exists($apiPath) ? 'はい' : 'いいえ') . "<br>";

$cachePath = '../line-auth/cache';
echo "Cache Dir Path: {$cachePath}<br>";
echo "Cache Dir Real Path: " . (realpath($cachePath) ?: '見つかりません') . "<br>";
echo "Cache Dir Exists: " . (is_dir($cachePath) ? 'はい' : 'いいえ') . "<br>";

// 3. キャッシュファイル確認
if (isset($_SESSION['line_user_id'])) {
    echo "<h2>3. キャッシュファイル確認</h2>";
    $lineUserId = $_SESSION['line_user_id'];
    $cacheKey = "user_full_{$lineUserId}";
    $cacheFile = $cachePath . '/' . md5($cacheKey) . '.cache';
    
    echo "Cache Key: {$cacheKey}<br>";
    echo "Cache File: {$cacheFile}<br>";
    echo "Cache File Exists: " . (file_exists($cacheFile) ? 'はい' : 'いいえ') . "<br>";
    
    if (file_exists($cacheFile)) {
        $cacheTime = filemtime($cacheFile);
        $age = time() - $cacheTime;
        echo "Cache Age: {$age}秒 (" . date('Y-m-d H:i:s', $cacheTime) . ")<br>";
        echo "Cache Valid: " . ($age <= 300 ? 'はい' : 'いいえ (期限切れ)') . "<br>";
        
        $cacheContent = file_get_contents($cacheFile);
        $cacheData = json_decode($cacheContent, true);
        
        if ($cacheData) {
            echo "Cache Structure: <pre>" . print_r(array_keys($cacheData), true) . "</pre>";
            if (isset($cacheData['data']['docsinfo'])) {
                echo "Docsinfo Count: " . count($cacheData['data']['docsinfo']) . "<br>";
                echo "Docsinfo Sample: <pre>" . print_r(array_slice($cacheData['data']['docsinfo'], 0, 1), true) . "</pre>";
            } else {
                echo "Docsinfo: 見つかりません<br>";
            }
        } else {
            echo "Cache Data: 解析エラー - " . json_last_error_msg() . "<br>";
        }
    }
}

// 4. 直接API呼び出しテスト
if (isset($_SESSION['line_user_id'])) {
    echo "<h2>4. 直接API呼び出しテスト</h2>";
    
    $apiUrl = realpath($apiPath) ?: $apiPath;
    
    // GETパラメータでテスト
    $testUrl = $apiPath . '?action=testConnection';
    echo "Test URL: {$testUrl}<br>";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $testUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_COOKIE => session_name() . '=' . session_id(),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'User-Agent: DebugTest/1.0'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);
    
    echo "HTTP Code: {$httpCode}<br>";
    echo "cURL Error: " . ($curlError ?: 'なし') . "<br>";
    echo "Response Length: " . strlen($response) . "<br>";
    echo "Response (first 500 chars): <pre>" . htmlspecialchars(substr($response, 0, 500)) . "</pre>";
    
    if ($response) {
        $data = json_decode($response, true);
        if ($data) {
            echo "Parsed Response: <pre>" . print_r($data, true) . "</pre>";
        } else {
            echo "JSON Parse Error: " . json_last_error_msg() . "<br>";
        }
    }
}

// 5. 設定確認
echo "<h2>5. 設定確認</h2>";
echo "DEBUG_MODE: " . (defined('DEBUG_MODE') && DEBUG_MODE ? 'ON' : 'OFF') . "<br>";
echo "GAS_DEPLOYMENT_ID: " . (defined('GAS_DEPLOYMENT_ID') ? '設定済み (' . substr(GAS_DEPLOYMENT_ID, 0, 10) . '...)' : '未設定') . "<br>";
echo "GAS_API_KEY: " . (defined('GAS_API_KEY') ? '設定済み (' . substr(GAS_API_KEY, 0, 10) . '...)' : '未設定') . "<br>";

// 6. PHPエラーログ確認
echo "<h2>6. エラーログ</h2>";
$errorLog = ini_get('error_log');
echo "Error Log Path: " . ($errorLog ?: 'デフォルト') . "<br>";

if ($errorLog && file_exists($errorLog)) {
    $logLines = array_slice(file($errorLog), -20); // 最後の20行
    echo "Recent Log Entries:<pre>" . htmlspecialchars(implode('', $logLines)) . "</pre>";
} else {
    echo "エラーログファイルが見つかりません<br>";
}

?>

<style>
body { font-family: Arial, sans-serif; margin: 20px; }
h1, h2 { color: #333; }
pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
</style>