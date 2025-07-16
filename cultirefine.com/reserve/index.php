<?php
session_start();
require_once __DIR__ . '/line-auth/url-helper.php';

// LINE認証チェック
if (!isset($_SESSION['line_user_id'])) {
    // 未認証の場合はLINE認証へリダイレクト
    header('Location: ' . getRedirectUrl('/reserve/line-auth/'));
    exit;
}

// ユーザー情報を取得
$lineUserId = $_SESSION['line_user_id'];
$displayName = $_SESSION['line_display_name'] ?? 'ゲスト';
$pictureUrl = $_SESSION['line_picture_url'] ?? null;
$userData = $_SESSION['user_data'] ?? null;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CLUTIREFINEクリニック 予約</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .profile-image {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- ヘッダー -->
    <header class="bg-teal-600 text-white p-4 shadow-md">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-semibold">CLUTIREFINEクリニック 予約</h1>
            <div class="flex items-center space-x-5">
                <span id="user-welcome" class="text-sm hidden sm:inline">ようこそ、
                    <?php if ($pictureUrl): ?>
                        <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image inline-block mr-1">
                    <?php endif; ?>
                    <span id="user-name"><?php echo htmlspecialchars($displayName); ?></span>様
                </span>
                <a href="./" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="form-link">予約フォーム</a>
                <a href="./document" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="docs-link">書類一覧</a>
                <a href="./ticket" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="ticket-link">チケット確認</a>
            </div>
        </div>
    </header>

    <!-- メインコンテナ -->
    <div class="container mx-auto p-6 mb-20">
        <div id="app" class="bg-white rounded-lg shadow-md p-6">
            <!-- 動的コンテンツはJavaScriptで挿入 -->
            <div class="text-center">
                <p class="text-gray-600">読み込み中...</p>
            </div>
        </div>
    </div>

    <!-- 共通モーダル -->
    <div id="common-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div id="modal-content">
                <!-- モーダルコンテンツはJavaScriptで動的に挿入 -->
            </div>
        </div>
    </div>

    <!-- スピナー -->
    <div id="loading-spinner" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    </div>

    <!-- アプリ設定 -->
    <script>
        // PHPから渡されたユーザー情報をJavaScriptで利用可能にする
        window.APP_CONFIG = {
            lineUserId: '<?php echo htmlspecialchars($lineUserId); ?>',
            displayName: '<?php echo htmlspecialchars($displayName); ?>',
            pictureUrl: <?php echo $pictureUrl ? "'" . htmlspecialchars($pictureUrl) . "'" : 'null'; ?>,
            userData: <?php echo $userData ? json_encode($userData) : 'null'; ?>,
            isAuthenticated: true,
            apiEndpoint: '/reserve/api-bridge.php'
        };
    </script>

    <!-- JavaScriptモジュール -->
    <script type="module" src="/reserve/js/init-with-gas.js"></script>
</body>
</html>