$(document).ready(function() {
    // 初期状態で.doc_cont_itemを非表示にする
    $('.doc_cont_item').hide();
    
    // .doc_cont_folderクリック時のイベント
    $('.doc_cont_folder').click(function() {
        // 次の.doc_cont_itemをスライドトグル
        $(this).next('.doc_cont_item').slideToggle();
        
        // アクティブクラスの切り替え（矢印の向きなどのスタイル用）
        $(this).toggleClass('active');
    });
});