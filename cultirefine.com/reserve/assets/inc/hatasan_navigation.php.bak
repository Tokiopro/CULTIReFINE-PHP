<?php
// ハンバーガーメニューのナビゲーション
$currentPath = $_SERVER['REQUEST_URI'];
$baseUrl = '/reserve';
?>

<!-- ハンバーガーメニュー（PC・モバイル共通） -->
<div class="relative">
    <button id="hamburger-btn" class="text-white hover:text-gray-200 focus:outline-none">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
    </button>
</div>

<!-- ドロップダウンメニュー（PC・モバイル共通） -->
<div id="mobile-menu" class="hidden absolute top-full right-0 bg-teal-700 shadow-lg rounded-md mt-2 min-w-48 z-50">
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
// ハンバーガーメニューの制御 - 即時実行関数でラップして確実に実行
(function() {
    function initHamburgerMenu() {
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        console.log('ハンバーガーメニュー初期化中:', { hamburgerBtn, mobileMenu });
        
        if (hamburgerBtn && mobileMenu) {
            // 既存のイベントリスナーを削除（重複防止）
            hamburgerBtn.onclick = null;
            
            hamburgerBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('ハンバーガーボタンがクリックされました');
                mobileMenu.classList.toggle('hidden');
            });
            
            // メニュー外をクリックしたら閉じる
            document.addEventListener('click', function(event) {
                if (!hamburgerBtn.contains(event.target) && !mobileMenu.contains(event.target)) {
                    mobileMenu.classList.add('hidden');
                }
            });
            
            console.log('ハンバーガーメニューが正常に初期化されました');
        } else {
            console.error('ハンバーガーメニューの要素が見つかりません:', { hamburgerBtn, mobileMenu });
        }
    }
    
    // DOMが読み込まれていれば即座に実行、そうでなければイベントを待つ
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHamburgerMenu);
    } else {
        initHamburgerMenu();
    }
})();
</script>