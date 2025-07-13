jQuery(document).ready(function() {
    // モーダルを開く
    $('#open_total').on('click', function(e) {
        e.preventDefault();
        $('#modal_total').addClass('active');
    });
    
    $('#open_reserved').on('click', function(e) {
        e.preventDefault();
        $('#modal_reserved').addClass('active');
    });
    
    $('#open_used').on('click', function(e) {
        e.preventDefault();
        $('#modal_used').addClass('active');
    });
    
    // モーダルを閉じる（全ての閉じるボタンに対応）
    $('.modal_close button').on('click', function() {
        $(this).closest('[id^="modal_"]').removeClass('active');
    });
    
    // 背景クリックでモーダルを閉じる
    $('[id^="modal_"]').on('click', function(e) {
        if (e.target === this) {
            $(this).removeClass('active');
        }
    });
    
    // Escキーでモーダルを閉じる
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('[id^="modal_"].active').removeClass('active');
        }
    });
    
});