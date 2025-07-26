<?php
require_once 'config.php';
require_once 'LineAuth.php';
require_once 'logger.php';

$logger = new Logger();

// 直接session_start()を使用（シンプル化）
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// デバッグログ
$logger->info('[LINE Auth] OAuth開始（直接セッション版）', [
    'session_id' => session_id(),
    'session_status' => session_status(),
    'session_name' => session_name(),
    'session_save_path' => session_save_path(),
    'session_data_keys' => array_keys($_SESSION),
    'direct_session_used' => true
]);

$lineAuth = new LineAuth();

// state パラメータを生成してセッションに保存
$state = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;

// LINE認証URLを生成
$authUrl = $lineAuth->getAuthorizationUrl($state);

// 詳細デバッグログ
$logger->info('[LINE Auth] OAuth state生成・保存（詳細）', [
    'generated_state' => $state,
    'session_id' => session_id(),
    'session_oauth_state_set' => isset($_SESSION['oauth_state']),
    'session_oauth_state_value' => $_SESSION['oauth_state'] ?? 'not_set',
    'session_all_keys' => array_keys($_SESSION),
    'auth_url' => $authUrl,
    'action' => 'redirect_to_line'
]);

// LINE認証ページへリダイレクト
header('Location: ' . $authUrl);
exit;