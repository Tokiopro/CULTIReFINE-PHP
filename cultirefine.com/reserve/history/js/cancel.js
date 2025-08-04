document.addEventListener('DOMContentLoaded', function() {
            const cancelBtn = document.getElementById('cancelBtn');
            const loading = document.getElementById('loading');
            const messageDiv = document.getElementById('message');

            cancelBtn.addEventListener('click', function() {
                // 確認ダイアログ
                if (!confirm('本当に予約をキャンセルしますか？「OK」でキャンセル依頼を送信します')) {
                    return;
                }

                // UI状態を変更
                cancelBtn.disabled = true;
                loading.style.display = 'inline';
                messageDiv.style.display = 'none';

                // 予約情報を取得
                const reservationData = {
                    reservation_id: document.getElementById('reservationId').textContent,
                    patient_name: document.getElementById('patient_name').textContent,
                    menu: document.getElementById('menu').textContent,
                    reserve_date: document.getElementById('reservedate').textContent
                };

                // Ajax リクエスト送信
                fetch('cancel_reservation.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(reservationData)
                })
                .then(response => response.json())
               /* .then(status => {
                    /*if (status === 'success') {*/
                        /*showMessage('予約のキャンセル依頼が完了しました。', 'success')*/
                        // 予約状態を更新
                        /*document.querySelector('#cancelBtn').textContent = 'キャンセル依頼済み'
                        document.querySelector('#cancelBtn').style.backgroundColor = '#6c757d';
                        cancelBtn.style.display = 'none';*/
                   /* } else {
                        showMessage('hogeキャンセル処理に失敗しました: ' + (status.error || '不明なエラー'), 'error');
                        cancelBtn.disabled = false;
                    }*/
                /*})*/
                .catch(error => {
                    console.error('Error:', error);
                    showMessage('通信エラーが発生しました。しばらく後に再度お試しください。', 'error');
                    cancelBtn.disabled = false;
                })
                .finally(() => {
                    loading.style.display = 'none';
					showMessage('予約のキャンセル依頼が完了しました。', 'success');
                });
            });

            function showMessage(text, type) {
                messageDiv.textContent = text;
                messageDiv.className = 'message ' + type;
                messageDiv.style.display = 'block';
            }
        });