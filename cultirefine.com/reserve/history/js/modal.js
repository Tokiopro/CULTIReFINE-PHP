document.addEventListener('DOMContentLoaded', function() {
    // 予約詳細ボタンのクリックイベント
    document.querySelectorAll('.open_modal').forEach(function(btn) {
        btn.addEventListener('click', function() {
            // クリックされたボタンの親の.history_itemを取得
            const historyItem = this.closest('.history_item');
            
            if (historyItem) {
                // 各要素の値を取得
                const visiterName = historyItem.querySelector('.his_visiter_name')?.textContent || '';
                const date = historyItem.querySelector('.his_date')?.textContent || '';
                const status = historyItem.querySelector('.his_cont_detail_status span')?.textContent || '';
                const menu = historyItem.querySelector('.his_cont_detail_menu')?.textContent || '';
                
                // モーダル内の対応する要素に値を代入
                const modal = document.getElementById('modal_more');
                
                // 施術メニュー
                const modalMenu = modal.querySelector('.modal_menu p');
                if (modalMenu) modalMenu.textContent = menu;
                
                // 予約日時
                const modalDate = modal.querySelector('.modal_date p');
                if (modalDate) modalDate.textContent = date;
                
                // 来院者情報
                const modalPatient = modal.querySelector('.modal_patient_wrap p');
                if (modalPatient) modalPatient.textContent = visiterName;
                // ステータス
				const modalStatus = modal.querySelector('.modal_status p');
				if (modalStatus) modalStatus.textContent = status;
                // ステータスに応じてボタンの表示制御（オプション）
                const changeButtons = modal.querySelectorAll('.change_reserve');
                if (status === 'キャンセル済み') {
                    changeButtons.forEach(btn => btn.style.display = 'none');
				modalStatus.classList.add('cancelled');
				modalStatus.classList.remove('visited');
				modalStatus.classList.remove('reserved');
                } else if(status === '予約済み') {
                    changeButtons.forEach(btn => btn.style.display = 'flex');
				modalStatus.classList.add('reserved');
				modalStatus.classList.remove('cancelled');
				modalStatus.classList.remove('visited');
                } else {
                    changeButtons.forEach(btn => btn.style.display = 'none');
				modalStatus.classList.add('visited');
				modalStatus.classList.remove('cancelled');
				modalStatus.classList.remove('reserved');
                }
                
                // モーダルを開く
                modal.classList.add('active');
            }
        });
    });
    
    // モーダルを閉じる
    document.querySelector('#modal_more .modal_close button')?.addEventListener('click', function() {
        document.getElementById('modal_more').classList.remove('active');
    });
    
    // 背景クリックで閉じる
    document.getElementById('modal_more')?.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
    
    // Escキーで閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal_more');
            if (modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        }
    });
});