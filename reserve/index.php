<?php
session_start();

// LINE認証チェック
if (!isset($_SESSION['line_user_id'])) {
    // 未認証の場合はLINE認証へリダイレクト
    header('Location: /reserve/line-auth/');
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
    <title>天満病院 予約システム</title>
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
            <h1 class="text-xl font-bold">天満病院 予約システム</h1>
            <div class="flex items-center space-x-3">
                <?php if ($pictureUrl): ?>
                    <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image">
                <?php endif; ?>
                <span><?php echo htmlspecialchars($displayName); ?>さん</span>
                <a href="/reserve/logout.php" class="text-sm underline">ログアウト</a>
            </div>
        </div>
    </header>

    <!-- メインコンテンツ -->
    <main class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-2xl font-bold mb-4">ようこそ、<?php echo htmlspecialchars($displayName); ?>さん</h2>
            
            <?php if ($userData): ?>
                <div class="mb-6 p-4 bg-gray-50 rounded">
                    <h3 class="font-semibold mb-2">登録情報</h3>
                    <p>お名前: <?php echo htmlspecialchars($userData['name'] ?? ''); ?></p>
                    <p>メールアドレス: <?php echo htmlspecialchars($userData['email'] ?? ''); ?></p>
                    <p>電話番号: <?php echo htmlspecialchars($userData['phone'] ?? ''); ?></p>
                </div>
            <?php endif; ?>

            <div class="space-y-4">
                <a href="/cultirefine.com/reserve/" class="block w-full bg-teal-600 text-white text-center py-3 px-6 rounded-lg hover:bg-teal-700 transition">
                    新規予約を作成
                </a>
                
                <a href="/reserve/history.php" class="block w-full bg-gray-200 text-gray-800 text-center py-3 px-6 rounded-lg hover:bg-gray-300 transition">
                    予約履歴を確認
                </a>
                
                <a href="/reserve/profile.php" class="block w-full bg-gray-200 text-gray-800 text-center py-3 px-6 rounded-lg hover:bg-gray-300 transition">
                    プロフィール編集
                </a>
            </div>
        </div>

        <?php if (isset($_SESSION['success_message'])): ?>
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <?php 
                echo htmlspecialchars($_SESSION['success_message']);
                unset($_SESSION['success_message']);
                ?>
            </div>
        <?php endif; ?>
    </main>

    <!-- デバッグ情報（開発環境のみ） -->
    <?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
        <div class="fixed bottom-4 right-4 bg-gray-800 text-white p-2 text-xs rounded">
            <p>LINE ID: <?php echo substr($lineUserId, 0, 10); ?>...</p>
            <p>Session ID: <?php echo session_id(); ?></p>
        </div>
    <?php endif; ?>
</body>
</html>