$(document).ready(function() {
    // ステータスに応じたクラスを付与する関数
    function addStatusClasses() {
        $('.his_cont_detail_status').each(function() {
            var statusText = $(this).find('span').text().trim();
            var $statusElement = $(this);
            
            // 既存のステータスクラスを削除
            $statusElement.removeClass('canceled visited reserved');
            
            // ステータステキストに応じてクラスを追加
            switch(statusText) {
                case 'キャンセル済み':
                    $statusElement.addClass('canceled');
                    break;
                case '来院済み':
                    $statusElement.addClass('visited');
                    break;
                case '予約済み':
                    $statusElement.addClass('reserved');
                    break;
            }
        });
    }
    
    // 初期化時にクラスを付与
    addStatusClasses();
    
    // 絞り込み機能
    function filterHistory() {
        var nameFilter = $('#sort_name').val().toLowerCase().trim();
        var statusFilter = $('#sort_status').val();
        
        $('.history_item').each(function() {
            var $item = $(this);
            
            // 来院者名の取得（実際のHTML構造に合わせて修正）
            var visitorName = $item.find('.his_cont_detail_visiter .his_visiter_name').text().toLowerCase();
            
            // ステータステキストの取得
            var statusText = $item.find('.his_cont_detail_status span').text().trim();
            
            // フィルタリング条件をチェック
            var showItem = true;
            
            // 名前でのフィルタリング
            if (nameFilter !== '' && visitorName.indexOf(nameFilter) === -1) {
                showItem = false;
            }
            
            // ステータスでのフィルタリング
            if (statusFilter !== '' && statusText !== statusFilter) {
                showItem = false;
            }
            
            // 表示/非表示を切り替え
            if (showItem) {
                $item.show();
            } else {
                $item.hide();
            }
        });
    }
    
    // リアルタイム検索（入力時）
    $('#sort_name').on('input', function() {
        filterHistory();
    });
    
    // ステータス選択時
    $('#sort_status').on('change', function() {
        filterHistory();
    });
    
    // フォームリセット時
    $('#sort_form').on('reset', function() {
        // リセット後に少し待ってからフィルタリングを実行
        setTimeout(function() {
            filterHistory();
        }, 10);
    });
    
    // 結果件数を表示する機能
    function updateResultCount() {
        var visibleItems = $('.history_item:visible').length;
        var totalItems = $('.history_item').length;
        
        // 結果件数表示エリアが存在しない場合は作成
        if ($('#result_count').length === 0) {
            $('.his_cont_wrap h2').after('<div id="result_count" class="text-sm text-gray-600 mb-1 text-right"></div>');
        }
        
        $('#result_count').text('検索結果: ' + visibleItems + '件 / 全' + totalItems + '件');
    }
    
    // フィルタリング関数を拡張して結果件数も更新
    var originalFilterHistory = filterHistory;
    filterHistory = function() {
        originalFilterHistory();
        updateResultCount();
    };
    
    // 初期表示時の結果件数
    updateResultCount();
    
    // デバッグ用：初期状態の確認
    console.log('総アイテム数:', $('.history_item').length);
    console.log('最初のアイテムの来院者名:', $('.history_item').first().find('.his_cont_detail_visiter .his_visiter_name').text());
    console.log('最初のアイテムのステータス:', $('.history_item').first().find('.his_cont_detail_status span').text());
});