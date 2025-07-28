<?php
/**
 * 500エラーのデバッグ用ファイル
 * 
 * このファイルは一時的なデバッグ用です。
 * 問題が解決したら削除してください。
 */

// エラー表示を有効化
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

echo "<h1>500エラー デバッグ情報</h1>";
echo "<pre>";

// PHPバージョン確認
echo "PHP Version: " . PHP_VERSION . "\n\n";

// 必要なファイルの存在確認
$files = [
    'line-auth/config.php',
    'line-auth/.env',
    'line-auth/env-loader.php',
    'line-auth/SessionManager.php',
    'line-auth/logger.php',
    'line-auth/LineAuth.php',
    'line-auth/ExternalApi.php'
];

echo "ファイル存在確認:\n";
foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    echo $file . ": " . (file_exists($path) ? "OK" : "NOT FOUND") . "\n";
}
echo "\n";

// 書き込み権限確認
$dirs = [
    'line-auth/logs',
    'sessions',
    sys_get_temp_dir()
];

echo "ディレクトリ書き込み権限:\n";
foreach ($dirs as $dir) {
    $path = $dir[0] === '/' ? $dir : __DIR__ . '/' . $dir;
    echo $dir . ": ";
    if (is_dir($path)) {
        echo is_writable($path) ? "Writable" : "Not Writable";
    } else {
        echo "Not Exists";
    }
    echo "\n";
}
echo "\n";

// セッション関連の設定確認
echo "セッション設定:\n";
echo "session.save_path: " . ini_get('session.save_path') . "\n";
echo "session.gc_maxlifetime: " . ini_get('session.gc_maxlifetime') . "\n";
echo "session.cookie_lifetime: " . ini_get('session.cookie_lifetime') . "\n";
echo "\n";

// 最近のPHPエラーログを表示
$errorLog = ini_get('error_log');
if ($errorLog && file_exists($errorLog)) {
    echo "最近のエラーログ ($errorLog):\n";
    $lines = array_slice(file($errorLog), -10);
    foreach ($lines as $line) {
        echo htmlspecialchars($line);
    }
} else {
    echo "エラーログファイルが見つかりません。\n";
}

echo "</pre>";

// 実際のページロードをテスト
echo "<h2>index.php のロードテスト</h2>";
echo "<p>以下で実際のエラーが表示される場合があります：</p>";
echo '<div style="border: 1px solid red; padding: 10px; margin: 10px 0;">';

// SessionManagerのテスト
try {
    require_once __DIR__ . '/line-auth/SessionManager.php';
    $sessionManager = SessionManager::getInstance();
    echo "<p style='color: green;'>SessionManager: OK</p>";
    
    // セッション開始テスト
    $result = $sessionManager->startSession();
    echo "<p style='color: " . ($result ? "green" : "red") . ";'>Session Start: " . ($result ? "OK" : "Failed") . "</p>";
    
    // セッションエラー確認
    $errors = $sessionManager->getSessionError();
    if (!empty($errors)) {
        echo "<p style='color: orange;'>Session Warnings: " . implode(', ', $errors) . "</p>";
    }
    
    // セッション情報表示
    echo "<p>Session Info:</p>";
    echo "<ul>";
    echo "<li>Session ID: " . session_id() . "</li>";
    echo "<li>Session Name: " . session_name() . "</li>";
    echo "<li>Session Save Path: " . session_save_path() . "</li>";
    echo "<li>Session Status: " . session_status() . "</li>";
    echo "<li>Session Data Count: " . count($_SESSION) . "</li>";
    echo "</ul>";
    
} catch (Exception $e) {
    echo "<p style='color: red;'>SessionManager Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}

// config.phpのテスト
try {
    require_once __DIR__ . '/line-auth/config.php';
    echo "<p style='color: green;'>config.php: OK</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>config.php Error: " . htmlspecialchars($e->getMessage()) . "</p>";
}

// ExternalApiのテスト
try {
    require_once __DIR__ . '/line-auth/ExternalApi.php';
    echo "<p style='color: green;'>ExternalApi.php: OK</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>ExternalApi.php Error: " . htmlspecialchars($e->getMessage()) . "</p>";
}

// 実際のindex.phpを読み込み（エラーが発生する箇所を特定）
echo "<h3>index.php テスト:</h3>";
ob_start();
$errorOccurred = false;
try {
    // 注意: この部分で実際のエラーが発生する可能性があります
    require __DIR__ . '/index.php';
} catch (Exception $e) {
    $errorOccurred = true;
    echo "<p style='color: red;'>index.php Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}
$output = ob_get_clean();

if (!$errorOccurred && empty($output)) {
    echo "<p style='color: orange;'>index.php がリダイレクトまたは正常終了しました</p>";
} else {
    echo "<div style='border: 1px solid #ccc; padding: 10px;'>";
    echo $output;
    echo "</div>";
}

echo '</div>';

phpinfo();
?>