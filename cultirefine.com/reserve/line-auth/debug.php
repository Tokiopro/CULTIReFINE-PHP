<?php
require_once 'config.php';

// デバッグモードでない場合はアクセスを拒否
if (!DEBUG_MODE) {
    die('デバッグモードが無効です。');
}

header('Content-Type: text/plain; charset=utf-8');

echo "=== LINE認証システム 設定確認ツール ===\n\n";

echo "環境変数の読み込み状態:\n";
echo "------------------------\n";

$configs = [
    'LINE_CHANNEL_ID' => LINE_CHANNEL_ID,
    'LINE_CHANNEL_SECRET' => LINE_CHANNEL_SECRET,
    'LINE_CALLBACK_URL' => LINE_CALLBACK_URL,
    'GAS_DEPLOYMENT_ID' => GAS_DEPLOYMENT_ID,
    'GAS_API_KEY' => GAS_API_KEY,
    'DEBUG_MODE' => DEBUG_MODE ? 'true' : 'false',
    'MOCK_MODE' => MOCK_MODE ? 'true' : 'false'
];

foreach ($configs as $name => $value) {
    if ($name === 'LINE_CHANNEL_SECRET' || $name === 'EXTERNAL_API_KEY') {
        // 秘密情報は一部をマスク
        $displayValue = $value ? substr($value, 0, 5) . '...' . substr($value, -5) : '(未設定)';
    } else {
        $displayValue = $value ?: '(未設定)';
    }
    
    $status = $value ? '✓' : '✗';
    echo sprintf("%s %s: %s\n", $status, $name, $displayValue);
}

echo "\nPHP環境情報:\n";
echo "------------------------\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Session Status: " . (session_status() === PHP_SESSION_ACTIVE ? 'Active' : 'Inactive') . "\n";
echo "cURL Extension: " . (extension_loaded('curl') ? 'Loaded' : 'Not Loaded') . "\n";

echo "\n.envファイルの存在確認:\n";
echo "------------------------\n";
$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    echo "✓ .envファイルが存在します\n";
    echo "  パス: " . $envPath . "\n";
    echo "  更新日時: " . date('Y-m-d H:i:s', filemtime($envPath)) . "\n";
} else {
    echo "✗ .envファイルが見つかりません\n";
    echo "  期待されるパス: " . $envPath . "\n";
}

echo "\n認証URL生成テスト:\n";
echo "------------------------\n";
if (LINE_CHANNEL_ID && LINE_CALLBACK_URL) {
    require_once 'LineAuth.php';
    $lineAuth = new LineAuth();
    $testState = 'test_state_123';
    $authUrl = $lineAuth->getAuthorizationUrl($testState);
    echo "認証URL: " . substr($authUrl, 0, 100) . "...\n";
    
    // URLパラメータの確認
    $urlParts = parse_url($authUrl);
    parse_str($urlParts['query'], $params);
    echo "\nURLパラメータ:\n";
    foreach ($params as $key => $value) {
        if ($key === 'client_id') {
            echo "  - {$key}: {$value}\n";
        }
    }
} else {
    echo "✗ 必要な設定が不足しているため、認証URLを生成できません\n";
}

echo "\nGAS API接続テスト:\n";
echo "------------------------\n";

if (GAS_DEPLOYMENT_ID && GAS_API_KEY) {
    require_once 'GasApiClient.php';
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    if (MOCK_MODE) {
        echo "✓ モックモードが有効です\n";
        echo "  テストデータが使用されます\n";
    } else {
        echo "GAS Deployment ID: " . substr(GAS_DEPLOYMENT_ID, 0, 20) . "...\n";
        
        // 直接URLアクセステスト（認証なしヘルスチェック）
        $testUrl = "https://script.google.com/macros/s/" . GAS_DEPLOYMENT_ID . "/exec?path=api/health";
        echo "Test URL (Health): " . $testUrl . "\n";
        
        // 認証付きユーザー情報テストURL
        $authTestUrl = "https://script.google.com/macros/s/" . GAS_DEPLOYMENT_ID . "/exec?path=api/users/line/U423d10aeba6ed5e5b0cf420435dbab3b/full&authorization=" . urlencode("Bearer " . GAS_API_KEY);
        echo "Test URL (Auth): " . substr($authTestUrl, 0, 100) . "...\n";
        
        $ch = curl_init($testUrl);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . GAS_API_KEY,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $responseInfo = curl_getinfo($ch);
        curl_close($ch);
        
        echo "\nテスト結果:\n";
        echo "HTTP Status: {$httpCode}\n";
        
        if ($response === false) {
            echo "✗ cURLエラー: {$curlError}\n";
        } else {
            echo "Response Length: " . strlen($response) . " bytes\n";
            echo "Content Type: " . ($responseInfo['content_type'] ?? 'Unknown') . "\n";
            echo "\nResponse Preview (first 500 chars):\n";
            echo "---\n";
            echo substr($response, 0, 500) . "\n";
            echo "---\n";
            
            // JSONパーステスト
            $decoded = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                echo "✓ JSONパース成功\n";
                if (isset($decoded['status'])) {
                    echo "API Status: " . $decoded['status'] . "\n";
                }
            } else {
                echo "✗ JSONパース失敗: " . json_last_error_msg() . "\n";
            }
        }
        
        // GasApiClientクラスでのテスト
        echo "\n\nGasApiClientテスト:\n";
        $testResult = $gasApi->testConnection();
        
        if (isset($testResult['status']) && $testResult['status'] === 'success') {
            echo "✓ GAS APIに接続できました\n";
        } elseif (isset($testResult['error'])) {
            echo "✗ GAS API接続エラー: " . $testResult['error']['message'] . "\n";
            if (isset($testResult['error']['code'])) {
                echo "  エラーコード: " . $testResult['error']['code'] . "\n";
            }
            if (isset($testResult['error']['details'])) {
                echo "  詳細: " . substr($testResult['error']['details'], 0, 200) . "...\n";
            }
        } else {
            echo "⚠ 予期しないレスポンス: " . json_encode($testResult) . "\n";
        }
    }
} else {
    echo "✗ GAS APIの設定がありません\n";
}