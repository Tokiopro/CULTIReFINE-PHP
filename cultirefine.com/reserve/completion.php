<!DOCTYPE html>
<!-- 
    CLUTIREFINEクリニック予約システム - 予約完了画面
    エンコーディング: UTF-8
    保存時は必ずUTF-8エンコーディングで保存してください
-->
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>予約完了 - CLUTIREFINEクリニック</title>
    <meta name="description" content="CLUTIREFINEクリニックの予約完了画面">
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="./assets/css/hamburger.css">
    <script>
        // Tailwind設定のカスタマイズ
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        teal: {
                            50: '#f0fdfa',
                            100: '#ccfbf1',
                            500: '#14b8a6',
                            600: '#0d9488',
                            700: '#0f766e',
                        }
                    }
                }
            }
        }
    </script>
</head>
<body>
    <!-- Header -->
    <header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-semibold">CLUTIREFINEクリニック 予約</h1>
			<?php
  include_once './assets/inc/navigation.php'; // header.phpの内容を読み込む
?>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-slate-50">
        <div class="container mx-auto px-4 sm:px-6">
            <!-- Completion Screen -->
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm max-w-xl w-full mx-auto">
                <div class="p-6 text-center">
                    <div class="text-5xl text-green-500 mb-4">✅</div>
                    <h2 class="text-2xl font-bold text-green-600 mb-2">ご予約が確定しました！</h2>
                    <p class="text-gray-600">予約番号: <span id="reservation-number" class="font-bold text-gray-700"></span></p>
                </div>
                <div class="px-6 pb-6 space-y-6">
                    <p class="text-center text-gray-700" id="completion-message"></p>

                    <div id="completed-bookings" class="space-y-3"></div>

                    <div class="border-t border-gray-200 pt-4">
                        <h4 class="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                            <span class="mr-2">🏥</span> クリニック情報
                        </h4>
                        <div class="text-sm text-gray-600 space-y-1">
                            <p>CLUTIREFINEクリニック</p>
                            <p>所在地: 大阪府大阪市北区万歳町３−１６ 天満病院グループ梅田ビル1・2階</p>
                            <a href="https://g.co/kgs/4fBEpLw" target="_blank" rel="noopener noreferrer" class="text-teal-600 hover:underline">
                                Google Mapで確認
                            </a>
                        </div>
                    </div>

                    <div class="border-t border-gray-200 pt-4">
                        <h4 class="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                            <span class="mr-2">ℹ️</span> 注意事項
                        </h4>
                        <ul class="text-xs text-gray-600 space-y-1 pl-4 list-disc">
                            <li>予約時間の10分前までにご来院ください。</li>
                            <li>キャンセルや変更は、予約日の前日までにLINEまたはお電話でご連絡ください。</li>
                            <li>体調が優れない場合は、無理せずご相談ください。</li>
                        </ul>
                    </div>

                    <button id="book-another-btn" class="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 px-8 rounded-md text-lg font-medium flex items-center justify-center">
                        <span class="mr-2">💬</span> 別の予約を取る
                    </button>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <?php
  include_once './assets/inc/footer.php'; // footer.phpの内容を読み込む
?>
    <script src="completion.js"></script>
</body>
</html>