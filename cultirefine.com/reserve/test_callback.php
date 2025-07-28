<?php
// test_callback_url.php - コールバックURL確認用

require_once __DIR__ . '/line-auth/config.php';

echo "<h2>LINE認証コールバックURL確認</h2>";

echo "<h3>現在の設定:</h3>";
echo "LINE_CALLBACK_URL: " . LINE_CALLBACK_URL . "<br>";
echo "getLineCallbackUrl(): " . getLineCallbackUrl() . "<br>";

echo "<h3>詳細確認:</h3>";
echo "getBaseUrl(): " . getBaseUrl() . "<br>";
echo "HTTP_HOST: " . ($_SERVER['HTTP_HOST'] ?? 'not set') . "<br>";
echo "HTTPS: " . ($_SERVER['HTTPS'] ?? 'not set') . "<br>";

echo "<h3>その他のURL生成テスト:</h3>";
echo "getFullUrl('/test'): " . getFullUrl('/test') . "<br>";
echo "getRedirectUrl('/reserve/'): " . getRedirectUrl('/reserve/') . "<br>";

// LINE認証URLの生成テスト
if (defined('LINE_CHANNEL_ID') && LINE_CHANNEL_ID) {
    require_once __DIR__ . '/line-auth/LineAuth.php';
    $lineAuth = new LineAuth();
    $testState = 'test_state_123';
    $authUrl = $lineAuth->getAuthorizationUrl($testState);
    
    echo "<h3>LINE認証URLサンプル:</h3>";
    echo "<p style='word-break: break-all;'>" . htmlspecialchars($authUrl) . "</p>";
    
    // URLを解析してコールバックURLを確認
    $parsedUrl = parse_url($authUrl);
    parse_str($parsedUrl['query'], $params);
    
    echo "<h3>認証URLパラメータ:</h3>";
    echo "redirect_uri: " . htmlspecialchars($params['redirect_uri'] ?? 'not set') . "<br>";
} else {
    echo "<p style='color: red;'>LINE_CHANNEL_IDが設定されていません</p>";
}
?>