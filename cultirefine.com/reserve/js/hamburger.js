$(document).ready(function() {
    // ハンバーガーメニューのクリックイベント
    $('#hamburger').on('click', function() {
        $(this).toggleClass('active');
        $('#header-menu').toggleClass('open');
        $('body').toggleClass('menu-open');
    });
    
    // メニュー外をクリックした際にメニューを閉じる
    $(document).on('click', function(e) {
        if (!$(e.target).closest('nav').length) {
            $('#hamburger').removeClass('active');
            $('#header-menu').removeClass('open');
            $('body').removeClass('menu-open');
        }
    });
    
    // ESCキーでメニューを閉じる
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('#hamburger').removeClass('active');
            $('#header-menu').removeClass('open');
            $('body').removeClass('menu-open');
        }
    });
    
    // ウィンドウリサイズ時の処理（デスクトップサイズになったらメニューを閉じる）
    $(window).on('resize', function() {
        if ($(window).width() > 768) {
            $('#hamburger').removeClass('active');
            $('#header-menu').removeClass('open');
            $('body').removeClass('menu-open');
        }
    });
});