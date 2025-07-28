<?php
// エラー表示を有効化（デバッグ用）
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// echo "<!-- Callback処理開始 -->\n"; // header()前の出力を防ぐため削除

require_once 'config.php';
require_once 'url-helper.php';
require_once 'LineAuth.php';
require_once 'ExternalApi.php';
require_once 'logger.php';
// require_once 'SessionManager.php'; // 使用していないため削除

// echo "<!-- 必要なファイル読み込み完了 -->\n"; // header()前の出力を防ぐため削除

$logger = new Logger();

// 直接session_start()を使用（index.phpと同じ方法）
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
$callbackSessionId = session_id();

// echo "<!-- セッション開始完了: " . $callbackSessionId . " -->\n"; // header()前の出力を防ぐため削除

// 詳細セッション情報
$logger->info('Callback開始 - セッション情報（直接セッション版）', [
    'callback_session_id' => $callbackSessionId,
    'current_session_id' => session_id(),
    'session_status' => session_status(),
    'session_name' => session_name(),
    'session_save_path' => session_save_path(),
    'has_oauth_state' => isset($_SESSION['oauth_state']),
    'oauth_state_value' => $_SESSION['oauth_state'] ?? 'not_set',
    'get_state' => $_GET['state'] ?? 'not_set',
    'session_keys' => array_keys($_SESSION),
    'session_data_preview' => array_slice($_SESSION, 0, 5, true),
    'cookie_params' => session_get_cookie_params(),
    'request_cookies' => $_COOKIE[session_name()] ?? 'not_set',
    'php_session_id_cookie' => $_COOKIE['PHPSESSID'] ?? 'not_set',
    'direct_session_used' => true
]);

// エラーハンドリング
if (isset($_GET['error'])) {
    // echo "<!-- LINE認証エラー検出 -->\n"; // header()前の出力を防ぐため削除
    die('認証エラー: ' . htmlspecialchars($_GET['error']));
}

// echo "<!-- エラーハンドリング通過 -->\n"; // header()前の出力を防ぐため削除

// state検証
// echo "<!-- State検証開始: GET=" . ($_GET['state'] ?? 'not_set') . ", SESSION=" . ($_SESSION['oauth_state'] ?? 'not_set') . " -->\n"; // header()前の出力を防ぐため削除
if (!isset($_GET['state']) || !isset($_SESSION['oauth_state']) || $_GET['state'] !== $_SESSION['oauth_state']) {
    $logger->error('State検証失敗', [
        'get_state' => $_GET['state'] ?? 'not_set',
        'session_oauth_state' => $_SESSION['oauth_state'] ?? 'not_set',
        'session_id' => session_id(),
        'state_match' => (isset($_GET['state']) && isset($_SESSION['oauth_state'])) ? 
            ($_GET['state'] === $_SESSION['oauth_state'] ? 'true' : 'false') : 'cannot_compare',
        'session_all_keys' => array_keys($_SESSION)
    ]);
    
    // より詳細なエラーメッセージ
    $errorMessage = '不正なリクエストです。';
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        $errorMessage .= '<br>デバッグ情報:<br>';
        $errorMessage .= 'GET state: ' . htmlspecialchars($_GET['state'] ?? 'not_set') . '<br>';
        $errorMessage .= 'Session state: ' . htmlspecialchars($_SESSION['oauth_state'] ?? 'not_set') . '<br>';
        $errorMessage .= 'Session ID: ' . htmlspecialchars(session_id()) . '<br>';
    }
    die($errorMessage);
}

// echo "<!-- State検証成功 -->\n"; // header()前の出力を防ぐため削除

// 認証コードの確認
if (!isset($_GET['code'])) {
    // echo "<!-- 認証コード未取得エラー -->\n"; // header()前の出力を防ぐため削除
    die('認証コードが取得できませんでした');
}

// echo "<!-- 認証コード取得成功: " . substr($_GET['code'], 0, 10) . "... -->\n"; // header()前の出力を防ぐため削除

$lineAuth = new LineAuth();

// アクセストークンを取得
$tokenData = $lineAuth->getAccessToken($_GET['code']);
if (!$tokenData) {
    die('アクセストークンの取得に失敗しました');
}

// ユーザープロフィールを取得
$profile = $lineAuth->getUserProfile($tokenData['access_token']);
if (!$profile) {
    die('ユーザー情報の取得に失敗しました');
}

// LINE IDを取得
$lineUserId = $profile['userId'];
$displayName = $profile['displayName'];
$pictureUrl = $profile['pictureUrl'] ?? null;

// 直接セッションにLINE認証情報を保存
$_SESSION['line_user_id'] = $lineUserId;
$_SESSION['line_display_name'] = $displayName;
$_SESSION['line_picture_url'] = $pictureUrl;
$_SESSION['line_auth_time'] = time();

// セッションデバッグ情報をログに記録
$logger->info('LINE認証コールバック - セッションに保存', [
    'line_user_id' => $lineUserId,
    'display_name' => $displayName,
    'session_id' => session_id(),
    'session_status' => session_status(),
    'session_save_path' => session_save_path(),
    'session_name' => session_name(),
    'session_line_user_id_set' => isset($_SESSION['line_user_id']),
    'session_all_keys' => array_keys($_SESSION)
]);

// GAS APIからユーザー情報を取得
// echo "<!-- GAS API処理開始 -->\n"; // header()前の出力を防ぐため削除

$externalApi = new ExternalApi();
$userData = null;
$gasApiError = false;

try {
    $logger->info('GAS APIへのユーザー情報問い合わせ', [
        'line_user_id' => $lineUserId
    ]);
    
    // echo "<!-- GAS API呼び出し実行 -->\n"; // header()前の出力を防ぐため削除
    $userData = $externalApi->getUserData($lineUserId);
    // echo "<!-- GAS API呼び出し完了 -->\n"; // header()前の出力を防ぐため削除
    
    // GAS APIレスポンスの詳細ログ
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        $logger->info('GAS APIレスポンス詳細', [
            'userData_is_null' => is_null($userData),
            'userData_is_array' => is_array($userData),
            'userData_keys' => is_array($userData) ? array_keys($userData) : null,
            'userData_preview' => is_array($userData) ? substr(json_encode($userData), 0, 300) : null
        ]);
    }
    
    if ($userData !== null) {
        $logger->info('GAS APIからユーザーデータ取得成功', [
            'user_id' => $userData['id'] ?? 'unknown',
            'visitor_id' => $userData['visitor_id'] ?? null,
            'name' => $userData['name'] ?? $userData['visitor_name'] ?? null,
            'member_type' => $userData['member_type'] ?? null,
            'line_user_id' => $lineUserId,
            'userData_structure' => array_keys($userData),
            'next_action' => 'redirect_to_reserve_index'
        ]);
    } else {
        $logger->info('GAS APIでユーザー未発見（正常ケース）', [
            'line_user_id' => $lineUserId,
            'response_type' => gettype($userData),
            'next_action' => 'redirect_to_not_registered'
        ]);
    }
    
} catch (Exception $e) {
    $gasApiError = true;
    $logger->error('GAS APIエラー', [
        'error' => $e->getMessage(),
        'line_user_id' => $lineUserId
    ]);
    
    // GAS APIエラーの場合は直接エラーページを表示（リダイレクトしない）
    ?>
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>システムエラー - 天満病院 予約システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-lg w-full space-y-8">
                <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div class="bg-red-500 text-white p-6 text-center">
                        <h1 class="text-2xl font-bold">システムエラー</h1>
                    </div>
                    <div class="p-6 space-y-4">
                        <p class="text-gray-700">データの取得中にエラーが発生しました。</p>
                        <div class="bg-red-50 p-4 rounded">
                            <p class="text-sm text-red-700">
                                <?php echo htmlspecialchars($e->getMessage()); ?>
                            </p>
                        </div>
                        <div class="bg-gray-100 p-4 rounded text-sm">
                            <p class="font-semibold mb-2">対処方法：</p>
                            <ul class="list-disc list-inside space-y-1">
                                <li>しばらく時間をおいてから再度お試しください</li>
                                <li>問題が続く場合は、管理者にお問い合わせください</li>
                            </ul>
                        </div>
                        <?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
                        <div class="bg-red-50 p-4 rounded text-xs">
                            <p class="font-semibold mb-2">デバッグ情報：</p>
                            <pre><?php echo htmlspecialchars(json_encode([
                                'error_type' => 'GAS_API_ERROR',
                                'message' => $e->getMessage(),
                                'line_user_id' => $lineUserId,
                                'display_name' => $displayName,
                                'session_id' => session_id(),
                                'timestamp' => date('Y-m-d H:i:s')
                            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
                        </div>
                        <?php endif; ?>
                        <div class="text-center space-x-4">
                            <a href="/reserve/" class="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
                                もう一度試す
                            </a>
                            <a href="/reserve/line-auth/" class="inline-block bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600">
                                再ログイン
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// 正常処理 - デバッグ出力付き
// echo "<!-- 正常処理開始: userData=" . (is_null($userData) ? 'null' : 'exists') . " -->\n"; // header()前の出力を防ぐため削除

if ($userData) {
    // echo "<!-- 既存ユーザー処理開始 -->\n"; // header()前の出力を防ぐため削除
    
    // 既存ユーザーの場合 - 直接セッションに保存
    $_SESSION['user_data'] = $userData;
    $_SESSION['user_data_updated'] = time();
    
    $logger->info('既存ユーザーとして予約ページへリダイレクト', [
        'user_id' => $userData['id'] ?? $userData['visitor_id'] ?? 'unknown',
        'visitor_id' => $userData['visitor_id'] ?? null,
        'user_name' => $userData['name'] ?? $userData['visitor_name'] ?? null,
        'has_user_data' => true,
        'session_id' => session_id(),
        'session_data_keys' => array_keys($_SESSION),
        'line_user_id' => $lineUserId,
        'session_line_auth_complete' => isset($_SESSION['line_user_id']),
        'redirect_target' => '/reserve/'
    ]);
    
    // echo "<!-- リダイレクト実行: /reserve/ -->\n"; // header()前の出力を防ぐため削除
    
    // 予約ページへリダイレクト - 強制的に確実にリダイレクト
    $redirectUrl = getRedirectUrl('/reserve/');
    header('Location: ' . $redirectUrl);
    exit;
} else {
    // echo "<!-- 新規ユーザー処理開始 -->\n"; // header()前の出力を防ぐため削除
    
    // 新規ユーザーの場合（GAS APIエラーではない）
    $logger->info('未登録ユーザーとして登録案内ページへ', [
        'line_user_id' => $lineUserId,
        'session_id' => session_id(),
        'gas_api_response' => 'null'
    ]);
    
    // 未登録フラグをセッションに設定（再アクセス時の処理最適化のため）
    $_SESSION['user_not_registered'] = true;
    $_SESSION['not_registered_time'] = time();
    
    // セッション情報が正しく設定されていることを確認
    $logger->info('セッション状態確認', [
        'session_data' => array_keys($_SESSION),
        'line_user_id_set' => isset($_SESSION['line_user_id']),
        'line_user_id_value' => $_SESSION['line_user_id'] ?? 'not_set',
        'user_not_registered_flag' => true
    ]);
    
    // 追加デバッグ: LINEプロフィール情報を確認
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        $logger->info('LINEプロフィール情報確認', [
            'display_name' => $_SESSION['line_display_name'] ?? 'not_set',
            'picture_url' => isset($_SESSION['line_picture_url']) ? 'set' : 'not_set'
        ]);
    }
    
    // echo "<!-- リダイレクト実行: /reserve/not-registered.php -->\n"; // header()前の出力を防ぐため削除
    
    $redirectUrl = getRedirectUrl('/reserve/not-registered.php');
    header('Location: ' . $redirectUrl);
    exit;
}

// 緊急時のフォールバック処理（ここまで到達した場合）
// echo "<!-- 緊急フォールバック: 強制的にreserve/indexへリダイレクト -->\n"; // header()前の出力を防ぐため削除
$logger->error('callback.php処理完了せずフォールバック実行', [
    'line_user_id' => $lineUserId ?? 'not_set',
    'userData_exists' => isset($userData) && $userData !== null,
    'session_id' => session_id()
]);

header('Location: /reserve/');
exit;