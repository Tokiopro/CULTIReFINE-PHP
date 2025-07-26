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
            var visitorName = $item.find('.his_cont_detail_visiter .his_name').text().toLowerCase();
            var statusClass = '';
            
            // ステータスクラスを取得
            var $statusElement = $item.find('.his_cont_detail_status');
            if ($statusElement.hasClass('canceled')) {
                statusClass = 'canceled';
            } else if ($statusElement.hasClass('visited')) {
                statusClass = 'visited';
            } else if ($statusElement.hasClass('reserved')) {
                statusClass = 'reserved';
            }
            
            // フィルタリング条件をチェック
            var showItem = true;
            
            // 名前でのフィルタリング
            if (nameFilter !== '' && visitorName.indexOf(nameFilter) === -1) {
                showItem = false;
            }
            
            // ステータスでのフィルタリング
            if (statusFilter !== '' && statusClass !== statusFilter) {
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
    
    // Ajax機能（サーバーサイドでの絞り込みが必要な場合）
    /*function performAjaxFilter() {
        var formData = {
            sort_name: $('#sort_name').val(),
            sort_status: $('#sort_status').val()
        };
        
        $.ajax({
            url: 'filter_history.php', // サーバーサイドのエンドポイント
            type: 'POST',
            data: formData,
            dataType: 'json',
            beforeSend: function() {
                // ローディング表示
                $('.his_cont_wrap').append('<div id="loading" class="text-center py-4">検索中...</div>');
            },
            success: function(response) {
                // ローディング削除
                $('#loading').remove();
                
                if (response.success) {
                    // サーバーから返されたHTMLで履歴アイテムを更新
                    $('.history_item').remove();
                    $('.his_cont_wrap').append(response.html);
                    
                    // 新しい要素にもクラスを付与
                    addStatusClasses();
                } else {
                    alert('検索中にエラーが発生しました: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                // ローディング削除
                $('#loading').remove();
                console.error('Ajax Error:', error);
                alert('通信エラーが発生しました。しばらく時間をおいて再度お試しください。');
            }
        });
    }
    */
    // Ajaxフィルタリングを使用する場合（オプション）
    // $('#sort_form').on('submit', function(e) {
    //     e.preventDefault();
    //     performAjaxFilter();
    // });
    
    // 検索ボタンを追加する場合
    /*if ($('#search_button').length === 0) {
        $('#sort_form .sort_form_wrap').append(
            '<div class="sort_item">' +
            '<button type="button" id="search_button" class="sort_input bg-blue-500 text-white hover:bg-blue-600 cursor-pointer">検索</button>' +
            '</div>'
        );
        
        $('#search_button').on('click', function() {
            // クライアントサイドフィルタリングの場合
            filterHistory();
            
            // Ajaxフィルタリングの場合（上記のコメントアウトを解除）
            // performAjaxFilter();
        });
    }*/
    
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
});

// 追加のCSS（スタイル調整用）
// 以下をstyles.cssに追加することを推奨
/*
.his_cont_detail_status.canceled {
    background-color: #fee2e2;
    color: #dc2626;
}

.his_cont_detail_status.visited {
    background-color: #dcfce7;
    color: #16a34a;
}

.his_cont_detail_status.reserved {
    background-color: #dbeafe;
    color: #2563eb;
}

.history_item {
    transition: opacity 0.3s ease;
}

.history_item:hidden {
    opacity: 0;
}

#loading {
    background-color: rgba(255, 255, 255, 0.8);
    padding: 20px;
    border-radius: 8px;
    margin: 20px 0;
}

.sort_input {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
}

.sort_input[type="reset"], #search_button {
    background-color: #6b7280;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;
}

.sort_input[type="reset"]:hover {
    background-color: #4b5563;
}
*/