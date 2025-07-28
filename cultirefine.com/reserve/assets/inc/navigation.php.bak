<?php
// ハンバーガーメニューのナビゲーション
$currentPath = $_SERVER['REQUEST_URI'];
$baseUrl = '/reserve';
?>
<nav class="hidden md:flex space-x-6">
    <a href="<?php echo $baseUrl; ?>" class="text-white hover:text-gray-200 transition-colors">
        📋 予約フォーム
    </a>
    <a href="<?php echo $baseUrl; ?>/document" class="text-white hover:text-gray-200 transition-colors">
        📄 書類一覧
    </a>
    <a href="<?php echo $baseUrl; ?>/ticket" class="text-white hover:text-gray-200 transition-colors">
        🎫 チケット確認
    </a>
    <a href="<?php echo $baseUrl; ?>/logout.php" class="text-white hover:text-gray-200 transition-colors">
        🚪 ログアウト
    </a>
</nav>

<!-- ハンバーガーメニュー（モバイル用） -->
<div class="md:hidden">
    <button id="hamburger-btn" class="text-white hover:text-gray-200 focus:outline-none">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
    </button>
</div>

<!-- モバイルメニュー -->
<div id="mobile-menu" class="hidden md:hidden absolute top-full left-0 right-0 bg-teal-700 shadow-lg">
    <div class="px-4 py-2 space-y-1">
        <a href="<?php echo $baseUrl; ?>" class="block px-3 py-2 text-white hover:bg-teal-600 rounded-md transition-colors">
            📋 予約フォーム
        </a>
        <a href="<?php echo $baseUrl; ?>/document" class="block px-3 py-2 text-white hover:bg-teal-600 rounded-md transition-colors">
            📄 書類一覧
        </a>
        <a href="<?php echo $baseUrl; ?>/ticket" class="block px-3 py-2 text-white hover:bg-teal-600 rounded-md transition-colors">
            🎫 チケット確認
        </a>
        <a href="<?php echo $baseUrl; ?>/logout.php" class="block px-3 py-2 text-white hover:bg-teal-600 rounded-md transition-colors">
            🚪 ログアウト
        </a>
    </div>
</div>

<script>
// ハンバーガーメニューの制御
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
        
        // メニュー外をクリックしたら閉じる
        document.addEventListener('click', function(event) {
            if (!hamburgerBtn.contains(event.target) && !mobileMenu.contains(event.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }
});
</script>