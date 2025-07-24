<?php
session_start();

// セッションデバッグ情報
$sessionDebug = [
    'session_id' => session_id(),
    'session_status' => session_status(),
    'line_user_id' => $_SESSION['line_user_id'] ?? 'not_set',
    'line_display_name' => $_SESSION['line_display_name'] ?? 'not_set',
    'session_data_count' => count($_SESSION)
];

// LINE認証チェック（セッションエラー時は直接エラー表示）
if (!isset($_SESSION['line_user_id'])) {
    error_log('[Session Error] No LINE user ID in session at not-registered.php: ' . json_encode($sessionDebug));
    
    // 直接エラーページを表示（リダイレクトしない）
    ?>
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>セッションエラー - 天満病院 予約システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-lg w-full space-y-8">
                <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div class="bg-red-500 text-white p-6 text-center">
                        <h1 class="text-2xl font-bold">セッションエラー</h1>
                    </div>
                    <div class="p-6 space-y-4">
                        <p class="text-gray-700">セッション情報が取得できませんでした。</p>
                        <div class="bg-gray-100 p-4 rounded text-sm">
                            <p class="font-semibold mb-2">対処方法：</p>
                            <ul class="list-disc list-inside space-y-1">
                                <li>ブラウザのキャッシュとCookieをクリアしてください</li>
                                <li>プライベートブラウジングモードで再度お試しください</li>
                                <li>別のブラウザでお試しください</li>
                            </ul>
                        </div>
                        <?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
                        <div class="bg-red-50 p-4 rounded text-xs">
                            <p class="font-semibold mb-2">デバッグ情報：</p>
                            <pre><?php echo htmlspecialchars(json_encode($sessionDebug, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
                        </div>
                        <?php endif; ?>
                        <div class="text-center">
                            <a href="/reserve/line-auth/" class="inline-block bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600">
                                もう一度ログインする
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

$displayName = $_SESSION['line_display_name'] ?? 'ゲスト';
$pictureUrl = $_SESSION['line_picture_url'] ?? null;
$lineUserId = $_SESSION['line_user_id'];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ユーザー登録が必要です - 天満病院 予約システム</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .profile-image {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
        }
    </style>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-lg w-full space-y-8">
            <!-- メインカード -->
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <!-- ヘッダー部分 -->
                <div class="bg-orange-500 text-white p-6 text-center">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>
                    <h1 class="text-2xl font-bold">ユーザー登録が必要です</h1>
                </div>
                
                <!-- コンテンツ部分 -->
                <div class="p-6 space-y-6">
                    <!-- ユーザー情報表示 -->
                    <div class="bg-gray-50 rounded-lg p-4 flex items-center space-x-4">
                        <?php if ($pictureUrl): ?>
                            <img src="<?php echo htmlspecialchars($pictureUrl); ?>" 
                                 alt="プロフィール画像" 
                                 class="profile-image">
                        <?php else: ?>
                            <div class="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                                <svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                            </div>
                        <?php endif; ?>
                        <div>
                            <p class="text-sm text-gray-600">LINEアカウント</p>
                            <p class="font-semibold text-lg"><?php echo htmlspecialchars($displayName); ?></p>
                            <p class="text-xs text-gray-500">ID: <?php echo substr(htmlspecialchars($lineUserId), 0, 10); ?>...</p>
                        </div>
                    </div>
                    
                    <!-- 説明文 -->
                    <div class="space-y-4 text-gray-700">
                        <p>
                            申し訳ございません。お客様のLINE IDはまだ予約システムに登録されていません。
                        </p>
                        <p>
                            予約システムをご利用いただくには、事前に管理者による登録が必要です。
                        </p>
                    </div>
                    
                    <!-- 連絡先情報 -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <h2 class="font-semibold text-blue-900 flex items-center">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            登録をご希望の方へ
                        </h2>
                        <p class="text-sm text-blue-800">
                            下記の連絡先までお問い合わせください：
                        </p>
                        <div class="space-y-2 pl-7">
                            <div class="flex items-center text-sm">
                                <svg class="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                                </svg>
                                <span class="font-medium">電話番号：</span>
                                <a href="tel:06-0000-0000" class="text-blue-600 hover:underline ml-1">06-0000-0000</a>
                            </div>
                            <div class="flex items-center text-sm">
                                <svg class="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                                <span class="font-medium">メール：</span>
                                <a href="mailto:reserve@tenma-hospital.jp" class="text-blue-600 hover:underline ml-1">reserve@tenma-hospital.jp</a>
                            </div>
                            <div class="flex items-start text-sm">
                                <svg class="w-4 h-4 mr-2 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span class="font-medium">受付時間：</span>
                                <span class="ml-1">平日 9:00-17:00</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 登録時の情報 -->
                    <div class="bg-gray-100 rounded-lg p-4 space-y-2">
                        <h3 class="font-semibold text-gray-800 text-sm">お問い合わせの際にお伝えください：</h3>
                        <ul class="text-sm text-gray-600 space-y-1 list-disc list-inside">
                            <li>お名前（フルネーム）</li>
                            <li>LINE表示名：<?php echo htmlspecialchars($displayName); ?></li>
                            <li>LINE ID（最初の10文字）：<?php echo substr(htmlspecialchars($lineUserId), 0, 10); ?>...</li>
                            <li>ご連絡先電話番号</li>
                        </ul>
                    </div>
                    
                    <!-- アクションボタン -->
                    <div class="space-y-3">
                        <a href="/reserve/logout.php" 
                           class="block w-full text-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            ログアウト
                        </a>
                        <a href="/" 
                           class="block w-full text-center py-3 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                            トップページへ戻る
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- フッター情報 -->
            <div class="text-center text-sm text-gray-500">
                <p>天満病院 予約システム</p>
                <p class="mt-1">© 2025 Tenma Hospital. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>