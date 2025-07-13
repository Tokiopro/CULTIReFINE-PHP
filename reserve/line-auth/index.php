<?php
require_once 'config.php';
require_once 'LineAuth.php';

$lineAuth = new LineAuth();

// リッチメニューからのアクセスを処理
// state パラメータを生成してセッションに保存
$state = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;

// LINE認証URLを生成
$authUrl = $lineAuth->getAuthorizationUrl($state);

// LINE認証ページへリダイレクト
header('Location: ' . $authUrl);
exit;