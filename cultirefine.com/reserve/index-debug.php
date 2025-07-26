<?php
/**
 * index.phpのデバッグ版
 * 500エラーの原因を特定するため、各段階でエラーチェックを行う
 */

// エラー表示を有効化（デバッグ用）
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

echo "<h1>index.php デバッグモード</h1>";

// 1. config.phpの読み込み
echo "<h2>Step 1: config.php読み込み</h2>";
try {
    if (!file_exists(__DIR__ . '/line-auth/config.php')) {
        die('エラー: config.phpが見つかりません');
    }
    require_once __DIR__ . '/line-auth/config.php';
    echo "<p style='color: green;'>✓ config.php読み込み成功</p>";
    echo "<p>GAS_DEPLOYMENT_ID: " . (defined('GAS_DEPLOYMENT_ID') && !empty(GAS_DEPLOYMENT_ID) ? '設定済み' : '<span style="color: red;">未設定</span>') . "</p>";
    echo "<p>GAS_API_KEY: " . (defined('GAS_API_KEY') && !empty(GAS_API_KEY) ? '設定済み' : '<span style="color: red;">未設定</span>') . "</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ config.php読み込みエラー: " . $e->getMessage() . "</p>";
    exit;
}

// 2. SessionManagerの読み込み
echo "<h2>Step 2: SessionManager読み込み</h2>";
try {
    if (!file_exists(__DIR__ . '/line-auth/SessionManager.php')) {
        die('エラー: SessionManager.phpが見つかりません');
    }
    require_once __DIR__ . '/line-auth/SessionManager.php';
    echo "<p style='color: green;'>✓ SessionManager.php読み込み成功</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ SessionManager.php読み込みエラー: " . $e->getMessage() . "</p>";
    exit;
}

// 3. logger.phpの読み込み
echo "<h2>Step 3: logger.php読み込み</h2>";
try {
    if (!file_exists(__DIR__ . '/line-auth/logger.php')) {
        die('エラー: logger.phpが見つかりません');
    }
    require_once __DIR__ . '/line-auth/logger.php';
    echo "<p style='color: green;'>✓ logger.php読み込み成功</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ logger.php読み込みエラー: " . $e->getMessage() . "</p>";
    exit;
}

// 4. SessionManagerインスタンスの作成
echo "<h2>Step 4: SessionManager初期化</h2>";
try {
    $sessionManager = SessionManager::getInstance();
    $logger = new Logger();
    echo "<p style='color: green;'>✓ SessionManagerとLogger初期化成功</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ 初期化エラー: " . $e->getMessage() . "</p>";
    exit;
}

// 5. セッション開始
echo "<h2>Step 5: セッション開始</h2>";
try {
    $sessionManager->startSession();
    echo "<p style='color: green;'>✓ セッション開始成功</p>";
    echo "<p>セッションID: " . session_id() . "</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ セッション開始エラー: " . $e->getMessage() . "</p>";
    exit;
}

// 6. LINE認証チェック
echo "<h2>Step 6: LINE認証チェック</h2>";
if (!$sessionManager->isLINEAuthenticated()) {
    echo "<p style='color: orange;'>LINE認証されていません。通常はリダイレクトされます。</p>";
    echo "<p><a href='/reserve/line-auth/'>LINE認証ページへ</a></p>";
    exit;
}
echo "<p style='color: green;'>✓ LINE認証済み</p>";

// 7. ユーザー情報取得
echo "<h2>Step 7: ユーザー情報取得</h2>";
$lineUserId = $sessionManager->getLINEUserId();
$displayName = $sessionManager->getLINEDisplayName();
$userData = $sessionManager->getUserData();

echo "<p>LINE User ID: " . ($lineUserId ? $lineUserId : '<span style="color: red;">未設定</span>') . "</p>";
echo "<p>Display Name: " . ($displayName ? $displayName : '<span style="color: red;">未設定</span>') . "</p>";
echo "<p>User Data: " . ($userData ? '取得済み' : '<span style="color: red;">未取得</span>') . "</p>";

if (!$userData) {
    echo "<p style='color: orange;'>ユーザーデータがありません。通常はLINE認証をやり直します。</p>";
    exit;
}

// 8. GasApiClient読み込み
echo "<h2>Step 8: GasApiClient読み込み</h2>";
try {
    require_once __DIR__ . '/line-auth/GasApiClient.php';
    echo "<p style='color: green;'>✓ GasApiClient.php読み込み成功</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ GasApiClient.php読み込みエラー: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    exit;
}

// 9. GasApiClientインスタンス化
echo "<h2>Step 9: GasApiClientインスタンス化</h2>";
try {
    // 環境変数の確認
    if (!defined('GAS_DEPLOYMENT_ID') || empty(GAS_DEPLOYMENT_ID)) {
        throw new Exception('GAS_DEPLOYMENT_IDが設定されていません');
    }
    if (!defined('GAS_API_KEY') || empty(GAS_API_KEY)) {
        throw new Exception('GAS_API_KEYが設定されていません');
    }
    
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    echo "<p style='color: green;'>✓ GasApiClientインスタンス化成功</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ GasApiClientインスタンス化エラー: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    exit;
}

// 10. GAS API呼び出し
echo "<h2>Step 10: GAS API呼び出しテスト</h2>";
try {
    $currentUserVisitorId = $userData['visitor_id'] ?? $userData['id'] ?? null;
    echo "<p>Current User Visitor ID: " . ($currentUserVisitorId ? $currentUserVisitorId : '<span style="color: red;">未設定</span>') . "</p>";
    
    if ($currentUserVisitorId) {
        echo "<p>getUserFullInfo()を呼び出し中...</p>";
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
        
        if ($userInfo['status'] === 'success') {
            echo "<p style='color: green;'>✓ GAS API呼び出し成功</p>";
            echo "<p>レスポンスデータキー: " . implode(', ', array_keys($userInfo['data'] ?? [])) . "</p>";
        } else {
            echo "<p style='color: orange;'>GAS APIエラー: " . ($userInfo['error']['message'] ?? '不明なエラー') . "</p>";
        }
    } else {
        echo "<p style='color: orange;'>visitor_idがないため、GAS API呼び出しをスキップ</p>";
    }
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ GAS API呼び出しエラー: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    exit;
}

echo "<hr>";
echo "<h2>デバッグ完了</h2>";
echo "<p style='color: green;'>✓ すべてのステップが正常に完了しました</p>";
echo "<p><a href='/reserve/'>通常のindex.phpに戻る</a></p>";
?>