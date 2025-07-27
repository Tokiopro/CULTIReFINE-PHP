<?php
// SessionManagerを使用してセッション管理
require_once __DIR__ . '/line-auth/SessionManager.php';
$sessionManager = SessionManager::getInstance();
$sessionManager->startSession();

// エラーメッセージを取得
$errorMessage = $_SESSION['error_message'] ?? 'エラーが発生しました。';
unset($_SESSION['error_message']);

// LINE認証状態を確認
$isAuthenticated = $sessionManager->isLINEAuthenticated();
$displayName = $sessionManager->getLINEDisplayName();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>エラー - 天満病院 予約システム</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            <div class="bg-white p-8 rounded-lg shadow-md">
                <div class="text-center">
                    <svg class="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                        </path>
                    </svg>
                    
                    <h2 class="mt-4 text-2xl font-bold text-gray-900">
                        エラーが発生しました
                    </h2>
                    
                    <p class="mt-2 text-gray-600">
                        <?php echo htmlspecialchars($errorMessage); ?>
                    </p>
                </div>
                
                <div class="mt-6 space-y-3">
                    <?php if ($isAuthenticated): ?>
                        <a href="/reserve/" 
                           class="block w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                            ホームに戻る
                        </a>
                    <?php else: ?>
                        <a href="/reserve/line-auth/" 
                           class="block w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                            ログインページに戻る
                        </a>
                    <?php endif; ?>
                    
                    <a href="javascript:history.back()" 
                       class="block w-full text-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                        前のページに戻る
                    </a>
                </div>
                
                <?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
                    <div class="mt-6 p-4 bg-gray-100 rounded text-xs text-gray-600">
                        <p class="font-semibold">デバッグ情報:</p>
                        <p>Session ID: <?php echo session_id(); ?></p>
                        <p>認証状態: <?php echo $isAuthenticated ? '認証済み' : '未認証'; ?></p>
                        <?php if ($displayName): ?>
                            <p>ユーザー: <?php echo htmlspecialchars($displayName); ?></p>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</body>
</html>