<?php
/**
 * 直接GAS API呼び出しテスト
 * reserve/index.phpと同じ方式で直接GAS APIを呼び出す
 */

require_once __DIR__ . '/line-auth/config.php';

// HTMLヘッダー
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>直接GAS API呼び出しテスト</title>
    <style>
        body { 
            font-family: 'Segoe UI', sans-serif; 
            padding: 20px; 
            background: #f0f2f5;
            max-width: 1200px;
            margin: 0 auto;
        }
        .test-card {
            background: white;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .success { color: #10b981; font-weight: 600; }
        .error { color: #ef4444; font-weight: 600; }
        .warning { color: #f59e0b; font-weight: 600; }
        .info { color: #3b82f6; }
        pre { 
            background: #f8fafc; 
            padding: 12px; 
            border-radius: 6px; 
            overflow-x: auto;
            border: 1px solid #e5e7eb;
            font-size: 13px;
        }
        h1 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 0; }
        .metric {
            display: inline-block;
            margin-right: 20px;
            padding: 8px 16px;
            background: #f3f4f6;
            border-radius: 6px;
            font-size: 14px;
        }
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .comparison-table th,
        .comparison-table td {
            padding: 10px;
            text-align: left;
            border: 1px solid #e5e7eb;
        }
        .comparison-table th {
            background: #f3f4f6;
            font-weight: 600;
        }
    </style>
</head>
<body>

<h1>🚀 直接GAS API呼び出しテスト</h1>

<?php
/**
 * GAS APIを直接呼び出す関数（index.phpと同じ）
 */
function callGasApiDirect($path, $showDebug = false) {
    $startTime = microtime(true);
    
    // 定数が定義されているか確認
    if (!defined('GAS_DEPLOYMENT_ID') || !defined('GAS_API_KEY')) {
        return [
            'status' => 'error',
            'error' => [
                'code' => 'CONFIG_ERROR',
                'message' => 'GAS API credentials not configured'
            ],
            'elapsed_time' => 0
        ];
    }
    
    // GAS APIのURLを構築
    $url = "https://script.google.com/macros/s/" . GAS_DEPLOYMENT_ID . "/exec";
    $url .= "?path=" . urlencode($path);
    $url .= "&Authorization=" . urlencode("Bearer " . GAS_API_KEY);
    
    if ($showDebug) {
        echo '<div class="info">Request URL (masked): ' . htmlspecialchars(substr($url, 0, 100)) . '...</div>';
    }
    
    // cURLの設定
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . GAS_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_VERBOSE => false
    ]);
    
    // リクエスト実行
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    $endTime = microtime(true);
    $elapsedTime = round(($endTime - $startTime) * 1000, 2);
    
    // エラーチェック
    if ($curlError) {
        return [
            'status' => 'error',
            'error' => [
                'code' => 'CURL_ERROR',
                'message' => 'ネットワークエラー: ' . $curlError
            ],
            'elapsed_time' => $elapsedTime
        ];
    }
    
    if ($httpCode !== 200) {
        return [
            'status' => 'error',
            'error' => [
                'code' => 'HTTP_ERROR',
                'message' => "HTTPエラー: {$httpCode}",
                'response' => substr($response, 0, 500)
            ],
            'elapsed_time' => $elapsedTime
        ];
    }
    
    // JSONパース
    $result = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'status' => 'error',
            'error' => [
                'code' => 'JSON_ERROR',
                'message' => 'JSONパースエラー: ' . json_last_error_msg()
            ],
            'elapsed_time' => $elapsedTime
        ];
    }
    
    $result['elapsed_time'] = $elapsedTime;
    return $result;
}

// テスト1: 直接API呼び出し
echo '<div class="test-card">';
echo '<h2>テスト1: 直接GAS API呼び出し (/api/menus/all-structured)</h2>';

$directResult = callGasApiDirect('/api/menus/all-structured', true);

echo '<div class="metric"><strong>処理時間:</strong> ' . $directResult['elapsed_time'] . 'ms</div>';

if (isset($directResult['status']) && $directResult['status'] === 'success') {
    echo '<p class="success">✅ 成功</p>';
    
    if (isset($directResult['data'])) {
        $data = $directResult['data'];
        
        // メニュー数の集計
        $withTicketCount = 0;
        $withoutTicketCount = 0;
        
        if (isset($data['withTicket']['categories'])) {
            foreach ($data['withTicket']['categories'] as $category) {
                $withTicketCount += count($category['menus'] ?? []);
            }
        }
        
        if (isset($data['withoutTicket']['categories'])) {
            foreach ($data['withoutTicket']['categories'] as $category) {
                $withoutTicketCount += count($category['menus'] ?? []);
            }
        }
        
        echo '<div style="margin-top: 15px;">';
        echo '<div class="metric"><strong>チケット付与メニュー:</strong> ' . $withTicketCount . '件</div>';
        echo '<div class="metric"><strong>通常メニュー:</strong> ' . $withoutTicketCount . '件</div>';
        echo '<div class="metric"><strong>合計:</strong> ' . ($withTicketCount + $withoutTicketCount) . '件</div>';
        echo '</div>';
    }
} else {
    echo '<p class="error">❌ エラー</p>';
    
    if (isset($directResult['error'])) {
        echo '<div style="margin-top: 15px;">';
        echo '<p class="error">エラーコード: ' . htmlspecialchars($directResult['error']['code'] ?? 'UNKNOWN') . '</p>';
        echo '<p class="error">エラーメッセージ: ' . htmlspecialchars($directResult['error']['message'] ?? 'Unknown error') . '</p>';
        
        if (isset($directResult['error']['response'])) {
            echo '<details>';
            echo '<summary style="cursor: pointer; color: #3b82f6;">レスポンス詳細</summary>';
            echo '<pre>' . htmlspecialchars($directResult['error']['response']) . '</pre>';
            echo '</details>';
        }
        echo '</div>';
    }
}

echo '</div>';

// テスト2: GasApiClientとの比較（オプション）
if (class_exists('GasApiClient')) {
    echo '<div class="test-card">';
    echo '<h2>テスト2: GasApiClientとの比較</h2>';
    
    require_once __DIR__ . '/line-auth/GasApiClient.php';
    
    $startTime = microtime(true);
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    $clientResult = $gasApi->getAllStructuredMenus();
    $clientTime = round((microtime(true) - $startTime) * 1000, 2);
    
    echo '<table class="comparison-table">';
    echo '<tr><th>項目</th><th>直接呼び出し</th><th>GasApiClient</th></tr>';
    echo '<tr>';
    echo '<td>処理時間</td>';
    echo '<td>' . $directResult['elapsed_time'] . 'ms</td>';
    echo '<td>' . $clientTime . 'ms</td>';
    echo '</tr>';
    echo '<tr>';
    echo '<td>ステータス</td>';
    echo '<td>' . ($directResult['status'] ?? 'N/A') . '</td>';
    echo '<td>' . ($clientResult['status'] ?? 'N/A') . '</td>';
    echo '</tr>';
    echo '<tr>';
    echo '<td>データ取得</td>';
    echo '<td>' . (isset($directResult['data']) ? '✅' : '❌') . '</td>';
    echo '<td>' . (isset($clientResult['data']) ? '✅' : '❌') . '</td>';
    echo '</tr>';
    echo '</table>';
    
    echo '</div>';
}

// テスト3: 他のエンドポイントテスト
echo '<div class="test-card">';
echo '<h2>テスト3: 他のエンドポイントテスト</h2>';

$endpoints = [
    '/api/health' => 'ヘルスチェック',
    '/api/menus/all' => '全メニュー取得（旧形式）',
];

foreach ($endpoints as $endpoint => $description) {
    echo '<div style="margin: 10px 0; padding: 10px; background: #f9fafb; border-radius: 4px;">';
    echo '<strong>' . $description . ' (' . $endpoint . ')</strong><br>';
    
    $result = callGasApiDirect($endpoint);
    
    if (isset($result['status']) && $result['status'] === 'success') {
        echo '<span class="success">✅ 成功</span> ';
        echo '<span class="info">(' . $result['elapsed_time'] . 'ms)</span>';
    } else {
        echo '<span class="error">❌ エラー: ' . ($result['error']['message'] ?? 'Unknown') . '</span> ';
        echo '<span class="info">(' . $result['elapsed_time'] . 'ms)</span>';
    }
    echo '</div>';
}

echo '</div>';

// 環境情報
echo '<div class="test-card">';
echo '<h2>環境情報</h2>';
echo '<p><strong>PHP Version:</strong> ' . phpversion() . '</p>';
echo '<p><strong>cURL Version:</strong> ';
$curlVersion = curl_version();
echo $curlVersion['version'] . ' (' . $curlVersion['ssl_version'] . ')</p>';
echo '<p><strong>GAS_DEPLOYMENT_ID:</strong> ' . (GAS_DEPLOYMENT_ID ? substr(GAS_DEPLOYMENT_ID, 0, 20) . '...' : 'Not set') . '</p>';
echo '<p><strong>GAS_API_KEY:</strong> ' . (GAS_API_KEY ? 'Set (' . strlen(GAS_API_KEY) . ' chars)' : 'Not set') . '</p>';
echo '<p><strong>DEBUG_MODE:</strong> ' . (DEBUG_MODE ? 'true' : 'false') . '</p>';
echo '</div>';
?>

</body>
</html>