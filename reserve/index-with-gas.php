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
    <title>天満病院 LINE予約システム</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        teal: { 50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' }
                    }
                }
            }
        }
    </script>
    <style>
        .profile-image {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }
        .screen {
            display: none;
        }
        .screen.active {
            display: block;
        }
        .switch {
            position: relative;
            width: 44px;
            height: 24px;
            background-color: #e5e7eb;
            border-radius: 12px;
            transition: background-color 0.3s;
        }
        .switch-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background-color: white;
            border-radius: 50%;
            transition: transform 0.3s;
        }
        input:checked + .switch {
            background-color: #0d9488;
        }
        input:checked + .switch .switch-thumb {
            transform: translateX(20px);
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- ヘッダー -->
    <header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-bold">天満病院 LINE予約システム</h1>
            <div class="flex items-center space-x-3">
                <?php if ($pictureUrl): ?>
                    <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image">
                <?php endif; ?>
                <span id="user-welcome" class="hidden sm:inline">ようこそ、<span id="user-name"><?php echo htmlspecialchars($displayName); ?></span>さん</span>
                <a href="/reserve/logout.php" class="text-sm underline">ログアウト</a>
            </div>
        </div>
    </header>

    <!-- メインコンテンツ -->
    <main class="flex-1 py-6 min-h-screen flex items-start justify-center">
        <div class="container mx-auto px-4 sm:px-6">
            
            <!-- Patient Selection Screen -->
            <div id="patient-selection-screen" class="screen active">
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm max-w-2xl w-full mx-auto">
                    <div class="p-6 text-center">
                        <div class="text-4xl mb-4">👥</div>
                        <h2 class="text-2xl font-bold text-teal-700 mb-2">来院者を選択</h2>
                        <p id="patient-selection-description" class="text-gray-600">今回同時に予約する来院者を選択してください。</p>
                    </div>
                    <div class="px-6 pb-6 space-y-6">
                        <div class="bg-slate-100 border border-gray-200 rounded-md p-3">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" id="pair-mode-switch" class="sr-only">
                                <div class="switch relative w-11 h-6 bg-gray-200 rounded-full transition-colors">
                                    <div class="switch-thumb absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"></div>
                                </div>
                                <span class="text-base font-medium text-pink-600 flex items-center">
                                    <span class="mr-2">👫</span> 同部屋でのペア予約を希望する
                                </span>
                            </label>
                        </div>

                        <div id="patients-list" class="max-h-80 overflow-y-auto space-y-3 pr-2"></div>

                        <button id="add-patient-btn" class="w-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md flex items-center justify-center">
                            <span class="mr-2">➕</span> 新しい来院者を追加
                        </button>

                        <button id="proceed-patients-btn" class="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 px-4 rounded-md font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            <span id="proceed-text">選択した0名の予約へ進む</span>
                            <span class="ml-2">➡️</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 他のスクリーンはここに追加 -->
            
        </div>
    </main>

    <!-- デバッグ情報（開発環境のみ） -->
    <?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
        <div class="fixed bottom-4 right-4 bg-gray-800 text-white p-2 text-xs rounded">
            <p>LINE ID: <?php echo substr($lineUserId, 0, 10); ?>...</p>
            <p>Session ID: <?php echo session_id(); ?></p>
            <p>Mode: GAS API連携</p>
        </div>
    <?php endif; ?>

    <!-- JavaScript Modules -->
    <script type="module">
        import { initializeAppWithGasApi } from '/cultirefine.com/reserve/js/init-with-gas.js';
        import { initPatientSelectionScreen } from '/cultirefine.com/reserve/js/screens/patient-selection.js';
        import { initAddPatientModal } from '/cultirefine.com/reserve/js/components/modal.js';
        
        // DOM読み込み完了後に初期化
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('[App] Starting GAS API integration');
            
            // GAS APIで初期化
            await initializeAppWithGasApi();
            
            // 各スクリーンを初期化
            initPatientSelectionScreen();
            initAddPatientModal();
            
            console.log('[App] App initialization completed');
        });
    </script>
</body>
</html>