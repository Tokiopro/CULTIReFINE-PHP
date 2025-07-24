<?php
// セッションを最初に開始
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once 'config.php';
require_once 'LineAuth.php';

// デバッグログ
if (defined('DEBUG_MODE') && DEBUG_MODE) {
    error_log('[LINE Auth] Starting OAuth flow, session_id: ' . session_id());
    error_log('[LINE Auth] Session status: ' . session_status());
    error_log('[LINE Auth] Session data keys: ' . implode(', ', array_keys($_SESSION)));
}

$lineAuth = new LineAuth();

// リッチメニューからのアクセスを処理
// state パラメータを生成してセッションに保存
$state = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;

// LINE認証URLを生成
$authUrl = $lineAuth->getAuthorizationUrl($state);

// デバッグログ
if (defined('DEBUG_MODE') && DEBUG_MODE) {
    error_log('[LINE Auth] OAuth state saved: ' . $state);
    error_log('[LINE Auth] Session ID before redirect: ' . session_id());
    error_log('[LINE Auth] Redirecting to LINE Auth URL');
}

// セッションを明示的に保存
session_write_close();

// LINE認証ページへリダイレクト
header('Location: ' . $authUrl);
exit;