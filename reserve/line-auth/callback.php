<?php
require_once 'config.php';
require_once 'LineAuth.php';
require_once 'ExternalApi.php';
require_once 'logger.php';

$logger = new Logger();

// エラーハンドリング
if (isset($_GET['error'])) {
    die('認証エラー: ' . htmlspecialchars($_GET['error']));
}

// state検証
if (!isset($_GET['state']) || $_GET['state'] !== $_SESSION['oauth_state']) {
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

// GAS APIからユーザー情報を取得
$externalApi = new ExternalApi();

try {
    $logger->info('GAS APIへのユーザー情報問い合わせ', ['line_user_id' => $lineUserId]);
    $userData = $externalApi->getUserData($lineUserId);
} catch (Exception $e) {
    $logger->error('GAS APIエラー', [
        'error' => $e->getMessage(),
        'line_user_id' => $lineUserId
    ]);
    
    // エラーページへリダイレクト
    $_SESSION['error_message'] = 'システムエラーが発生しました。しばらくしてからもう一度お試しください。';
    header('Location: /reserve/error.php');
    exit;
}

if ($userData) {
    $_SESSION['user_data'] = $userData;
    $logger->info('既存ユーザーとして認識', ['user_id' => $userData['id']]);
    
    // 予約ページへリダイレクト
    header('Location: /reserve/');
} else {
    // 新規ユーザーの場合の処理
    $logger->info('新規ユーザーとして登録ページへ', ['line_user_id' => $lineUserId]);
    header('Location: /reserve/registration.php');
}
exit;