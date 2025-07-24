<?php
// セッションを最初に開始（config.phpより前に）
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// セッションIDを記録
$callbackSessionId = session_id();

require_once 'config.php';
require_once 'url-helper.php';
require_once 'LineAuth.php';
require_once 'ExternalApi.php';
require_once 'logger.php';

$logger = new Logger();

// セッションIDの確認
$logger->info('Callback開始 - セッション情報', [
    'callback_session_id' => $callbackSessionId,
    'current_session_id' => session_id(),
    'session_status' => session_status(),
    'has_oauth_state' => isset($_SESSION['oauth_state'])
]);

// エラーハンドリング
if (isset($_GET['error'])) {
    die('認証エラー: ' . htmlspecialchars($_GET['error']));
}

// state検証
if (!isset($_GET['state']) || !isset($_SESSION['oauth_state']) || $_GET['state'] !== $_SESSION['oauth_state']) {
    $logger->error('State検証失敗', [
        'get_state' => $_GET['state'] ?? 'not_set',
        'session_oauth_state' => $_SESSION['oauth_state'] ?? 'not_set',
        'session_id' => session_id()
    ]);
    die('不正なリクエストです');
}

// 認証コードの確認
if (!isset($_GET['code'])) {
    die('認証コードが取得できませんでした');
}

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

// セッションに保存
$_SESSION['line_user_id'] = $lineUserId;
$_SESSION['line_display_name'] = $displayName;
$_SESSION['line_picture_url'] = $pictureUrl;

// セッションデバッグ情報をログに記録
$logger->info('LINE認証コールバック開始', [
    'line_user_id' => $lineUserId,
    'display_name' => $displayName,
    'session_id' => session_id(),
    'session_status' => session_status(),
    'session_save_path' => session_save_path(),
    'session_name' => session_name()
]);

// セッションデータを明示的に保存
session_write_close();
session_start();

// GAS APIからユーザー情報を取得
$externalApi = new ExternalApi();
$userData = null;
$gasApiError = false;

try {
    $logger->info('GAS APIへのユーザー情報問い合わせ', [
        'line_user_id' => $lineUserId
    ]);
    
    $userData = $externalApi->getUserData($lineUserId);
    
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
            'line_user_id' => $lineUserId
        ]);
    } else {
        $logger->info('GAS APIでユーザー未発見（正常ケース）', [
            'line_user_id' => $lineUserId,
            'response_type' => gettype($userData)
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

// 正常処理
if ($userData) {
    // 既存ユーザーの場合
    $_SESSION['user_data'] = $userData;
    
    // セッションデータを明示的に保存
    session_write_close();
    
    $logger->info('既存ユーザーとして予約ページへリダイレクト', [
        'user_id' => $userData['id'] ?? $userData['visitor_id'] ?? 'unknown',
        'visitor_id' => $userData['visitor_id'] ?? null,
        'has_user_data' => true,
        'session_id' => session_id(),
        'session_data_keys' => array_keys($_SESSION)
    ]);
    
    // 予約ページへリダイレクト
    header('Location: ' . getRedirectUrl('/reserve/'));
} else {
    // 新規ユーザーの場合（GAS APIエラーではない）
    $logger->info('未登録ユーザーとして登録案内ページへ', [
        'line_user_id' => $lineUserId,
        'session_id' => session_id(),
        'gas_api_response' => 'null'
    ]);
    
    // セッション情報が正しく設定されていることを確認
    $logger->info('セッション状態確認', [
        'session_data' => array_keys($_SESSION),
        'line_user_id_set' => isset($_SESSION['line_user_id']),
        'line_user_id_value' => $_SESSION['line_user_id'] ?? 'not_set'
    ]);
    
    // 追加デバッグ: LINEプロフィール情報を確認
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        $logger->info('LINEプロフィール情報確認', [
            'display_name' => $_SESSION['line_display_name'] ?? 'not_set',
            'picture_url' => isset($_SESSION['line_picture_url']) ? 'set' : 'not_set'
        ]);
    }
    
    header('Location: ' . getRedirectUrl('/reserve/not-registered.php'));
}
exit;