<?php
/**
 * GAS エンドポイント デバッグテスト
 * api/menus/all-structured エンドポイントの動作確認
 */

require_once __DIR__ . '/line-auth/config.php';
require_once __DIR__ . '/line-auth/GasApiClient.php';

echo "<!DOCTYPE html>\n";
echo "<html lang=\"ja\">\n";
echo "<head>\n";
echo "<meta charset=\"UTF-8\">\n";
echo "<title>GAS エンドポイントテスト</title>\n";
echo "<style>\n";
echo "body { font-family: monospace; padding: 20px; background: #f5f5f5; }\n";
echo ".success { color: green; font-weight: bold; }\n";
echo ".error { color: red; font-weight: bold; }\n";
echo ".info { color: blue; }\n";
echo ".warning { color: orange; }\n";
echo "pre { background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px; overflow-x: auto; }\n";
echo ".test-section { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n";
echo "</style>\n";
echo "</head>\n";
echo "<body>\n";

echo "<h1>GAS エンドポイントテスト - api/menus/all-structured</h1>\n";

// テスト1: 環境変数確認
echo "<div class=\"test-section\">\n";
echo "<h2>テスト1: 環境変数確認</h2>\n";
if (GAS_DEPLOYMENT_ID && GAS_API_KEY) {
    echo "<p class=\"success\">✅ 環境変数が設定されています</p>\n";
    echo "<p class=\"info\">GAS_DEPLOYMENT_ID: " . substr(GAS_DEPLOYMENT_ID, 0, 20) . "...</p>\n";
    echo "<p class=\"info\">GAS_API_KEY: " . substr(GAS_API_KEY, 0, 10) . "...</p>\n";
} else {
    echo "<p class=\"error\">❌ 環境変数が設定されていません</p>\n";
    if (!GAS_DEPLOYMENT_ID) echo "<p class=\"error\">GAS_DEPLOYMENT_ID が未設定</p>\n";
    if (!GAS_API_KEY) echo "<p class=\"error\">GAS_API_KEY が未設定</p>\n";
    echo "</div></body></html>";
    exit;
}
echo "</div>\n";

// テスト2: GasApiClient インスタンス作成
echo "<div class=\"test-section\">\n";
echo "<h2>テスト2: GasApiClient インスタンス作成</h2>\n";
try {
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    echo "<p class=\"success\">✅ GasApiClient インスタンスを作成しました</p>\n";
} catch (Exception $e) {
    echo "<p class=\"error\">❌ インスタンス作成エラー: " . htmlspecialchars($e->getMessage()) . "</p>\n";
    echo "</div></body></html>";
    exit;
}
echo "</div>\n";

// テスト3: getAllStructuredMenus() 呼び出し
echo "<div class=\"test-section\">\n";
echo "<h2>テスト3: getAllStructuredMenus() API呼び出し</h2>\n";

echo "<p class=\"info\">API呼び出し中...</p>\n";

// タイマー開始
$startTime = microtime(true);

try {
    // API呼び出し
    $result = $gasApi->getAllStructuredMenus();
    
    // タイマー終了
    $endTime = microtime(true);
    $elapsedTime = round(($endTime - $startTime) * 1000, 2);
    
    echo "<p class=\"info\">処理時間: {$elapsedTime}ms</p>\n";
    
    // レスポンス解析
    if (isset($result['status'])) {
        if ($result['status'] === 'success') {
            echo "<p class=\"success\">✅ API呼び出し成功</p>\n";
            
            // データ構造の確認
            if (isset($result['data'])) {
                echo "<h3>データ構造:</h3>\n";
                echo "<pre>";
                echo "トップレベルキー: " . implode(', ', array_keys($result['data'])) . "\n";
                
                if (isset($result['data']['withTicket'])) {
                    echo "\nwithTicket セクション:\n";
                    if (isset($result['data']['withTicket']['categories'])) {
                        $catCount = count($result['data']['withTicket']['categories']);
                        echo "  カテゴリ数: {$catCount}\n";
                        
                        $totalMenus = 0;
                        foreach ($result['data']['withTicket']['categories'] as $cat) {
                            $menuCount = count($cat['menus'] ?? []);
                            $totalMenus += $menuCount;
                            echo "  - " . ($cat['category_name'] ?? 'Unknown') . ": {$menuCount} メニュー\n";
                        }
                        echo "  合計メニュー数: {$totalMenus}\n";
                    }
                }
                
                if (isset($result['data']['withoutTicket'])) {
                    echo "\nwithoutTicket セクション:\n";
                    if (isset($result['data']['withoutTicket']['categories'])) {
                        $catCount = count($result['data']['withoutTicket']['categories']);
                        echo "  カテゴリ数: {$catCount}\n";
                        
                        $totalMenus = 0;
                        foreach ($result['data']['withoutTicket']['categories'] as $cat) {
                            $menuCount = count($cat['menus'] ?? []);
                            $totalMenus += $menuCount;
                            echo "  - " . ($cat['category_name'] ?? 'Unknown') . ": {$menuCount} メニュー\n";
                        }
                        echo "  合計メニュー数: {$totalMenus}\n";
                    }
                }
                echo "</pre>\n";
            } else {
                echo "<p class=\"warning\">⚠️ データフィールドが存在しません</p>\n";
            }
            
        } else if ($result['status'] === 'error') {
            echo "<p class=\"error\">❌ APIエラー</p>\n";
            
            if (isset($result['error'])) {
                echo "<h3>エラー詳細:</h3>\n";
                echo "<pre class=\"error\">";
                if (is_array($result['error'])) {
                    echo "コード: " . ($result['error']['code'] ?? 'N/A') . "\n";
                    echo "メッセージ: " . ($result['error']['message'] ?? 'N/A') . "\n";
                    if (isset($result['error']['details'])) {
                        echo "詳細: " . $result['error']['details'] . "\n";
                    }
                } else {
                    echo $result['error'];
                }
                echo "</pre>\n";
                
                // NOT_FOUND エラーの場合の追加情報
                if (isset($result['error']['code']) && $result['error']['code'] === 'NOT_FOUND') {
                    echo "<div style='background: #fff3cd; padding: 10px; border: 1px solid #ffc107; border-radius: 5px; margin-top: 10px;'>\n";
                    echo "<p class=\"warning\"><strong>⚠️ エンドポイントが見つかりません</strong></p>\n";
                    echo "<p>考えられる原因:</p>\n";
                    echo "<ol>\n";
                    echo "<li>GAS側のPhpIntegrationApi.jsでルーティングが正しく設定されていない</li>\n";
                    echo "<li>パスの形式が正しくない（スペースや特殊文字が含まれている）</li>\n";
                    echo "<li>GASのデプロイが最新でない</li>\n";
                    echo "</ol>\n";
                    echo "<p>GAS側のログを確認してください。</p>\n";
                    echo "</div>\n";
                }
            }
        } else {
            echo "<p class=\"warning\">⚠️ 不明なステータス: " . htmlspecialchars($result['status']) . "</p>\n";
        }
    } else {
        echo "<p class=\"error\">❌ レスポンスにstatusフィールドがありません</p>\n";
        echo "<h3>完全なレスポンス:</h3>\n";
        echo "<pre>";
        echo htmlspecialchars(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo "</pre>\n";
    }
    
} catch (Exception $e) {
    $endTime = microtime(true);
    $elapsedTime = round(($endTime - $startTime) * 1000, 2);
    
    echo "<p class=\"info\">処理時間: {$elapsedTime}ms</p>\n";
    echo "<p class=\"error\">❌ 例外が発生しました</p>\n";
    echo "<pre class=\"error\">";
    echo "メッセージ: " . htmlspecialchars($e->getMessage()) . "\n";
    echo "ファイル: " . $e->getFile() . "\n";
    echo "行: " . $e->getLine() . "\n";
    echo "スタックトレース:\n" . htmlspecialchars($e->getTraceAsString());
    echo "</pre>\n";
}
echo "</div>\n";

// テスト4: 直接cURL呼び出し（比較用）
echo "<div class=\"test-section\">\n";
echo "<h2>テスト4: 直接cURL呼び出し（デバッグ用）</h2>\n";

$url = "https://script.google.com/macros/s/" . GAS_DEPLOYMENT_ID . "/exec";
$fullUrl = $url . "?path=" . urlencode("api/menus/all-structured") . "&Authorization=" . urlencode("Bearer " . GAS_API_KEY);

echo "<p class=\"info\">リクエストURL（一部マスク）:</p>\n";
echo "<pre>" . substr($fullUrl, 0, 100) . "...</pre>\n";

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $fullUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . GAS_API_KEY,
        'Content-Type: application/json'
    ],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true
]);

$startTime = microtime(true);
$response = curl_exec($ch);
$endTime = microtime(true);
$elapsedTime = round(($endTime - $startTime) * 1000, 2);

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

echo "<p class=\"info\">処理時間: {$elapsedTime}ms</p>\n";
echo "<p class=\"info\">HTTPステータス: {$httpCode}</p>\n";

if ($curlError) {
    echo "<p class=\"error\">cURLエラー: " . htmlspecialchars($curlError) . "</p>\n";
} else if ($httpCode === 200) {
    echo "<p class=\"success\">✅ HTTP通信成功</p>\n";
    
    $jsonData = json_decode($response, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        if (isset($jsonData['status'])) {
            if ($jsonData['status'] === 'success') {
                echo "<p class=\"success\">✅ エンドポイント正常動作</p>\n";
            } else {
                echo "<p class=\"error\">❌ エンドポイントエラー</p>\n";
                if (isset($jsonData['error'])) {
                    echo "<pre class=\"error\">";
                    echo htmlspecialchars(json_encode($jsonData['error'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                    echo "</pre>\n";
                }
            }
        }
    } else {
        echo "<p class=\"error\">JSONパースエラー: " . json_last_error_msg() . "</p>\n";
        echo "<pre>レスポンス先頭500文字:\n" . htmlspecialchars(substr($response, 0, 500)) . "</pre>\n";
    }
} else {
    echo "<p class=\"error\">❌ HTTPエラー: {$httpCode}</p>\n";
}
echo "</div>\n";

// まとめ
echo "<div class=\"test-section\">\n";
echo "<h2>診断結果</h2>\n";
echo "<p>上記のテスト結果を確認して、エラーの原因を特定してください。</p>\n";
echo "<p>特に「NOT_FOUND」エラーが出ている場合は、GAS側のPhpIntegrationApi.jsのデバッグログを確認することをお勧めします。</p>\n";
echo "</div>\n";

echo "</body>\n";
echo "</html>\n";
?>