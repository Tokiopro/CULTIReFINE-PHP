// screens/single-booking-confirmation.js
// 単体予約の確認画面ロジック（MedicalForce API対応）

import { createMedicalForceReservation } from '../data/gas-api.js';
import { appState } from '../core/app-state.js';
import { StorageManager } from '../core/storage-manager.js';

/**
 * 確認画面の初期化
 */
export function initSingleBookingConfirmation() {
    // セッションストレージから予約データを取得
    const reservationData = JSON.parse(sessionStorage.getItem('reservationData') || '{}');
    
    if (!reservationData.patientId || !reservationData.bookings || reservationData.bookings.length === 0) {
        alert('予約データが見つかりません。最初からやり直してください。');
        window.location.href = '/reserve/';
        return;
    }
    
    // 予約内容を表示
    displayReservationSummary(reservationData);
    
    // ボタンイベントの設定
    setupButtonEvents(reservationData);
}

/**
 * 予約内容の表示
 */
function displayReservationSummary(data) {
    const summaryContainer = document.getElementById('booking-summary');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = '';
    
    // 患者情報
    const patientDiv = document.createElement('div');
    patientDiv.className = 'bg-gray-50 rounded-lg p-4 mb-4';
    patientDiv.innerHTML = `
        <h3 class="font-bold text-lg mb-2">患者情報</h3>
        <p>患者ID: ${data.patientId}</p>
    `;
    summaryContainer.appendChild(patientDiv);
    
    // 予約日
    const dateDiv = document.createElement('div');
    dateDiv.className = 'bg-white rounded-lg shadow p-4 mb-4';
    dateDiv.innerHTML = `
        <h3 class="font-bold text-lg mb-2">予約日</h3>
        <p class="text-xl">${formatDate(data.selectedDate)}</p>
    `;
    summaryContainer.appendChild(dateDiv);
    
    // 選択されたメニュー
    const menuDiv = document.createElement('div');
    menuDiv.className = 'bg-white rounded-lg shadow p-4 mb-4';
    menuDiv.innerHTML = '<h3 class="font-bold text-lg mb-3">予約内容</h3>';
    
    data.bookings.forEach((booking, index) => {
        const bookingItem = document.createElement('div');
        bookingItem.className = 'border-b pb-3 mb-3 last:border-b-0';
        bookingItem.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-medium">${booking.menuName}</h4>
                    <p class="text-sm text-gray-600">
                        時間: ${booking.startTime} 〜 ${booking.endTime} (${booking.duration}分)
                    </p>
                    ${booking.price ? 
                        `<p class="text-sm">料金: ¥${booking.price.toLocaleString()}</p>` : 
                        `<p class="text-sm">${booking.ticketType}チケット: ${booking.requiredTickets}枚</p>`
                    }
                </div>
            </div>
        `;
        menuDiv.appendChild(bookingItem);
    });
    
    summaryContainer.appendChild(menuDiv);
    
    // 合計
    const totalDiv = document.createElement('div');
    totalDiv.className = 'bg-blue-50 rounded-lg p-4';
    totalDiv.innerHTML = `
        <div class="flex justify-between font-bold text-lg">
            <span>合計時間: ${data.totalDuration}分</span>
            <span>合計金額: ¥${data.totalPrice.toLocaleString()}</span>
        </div>
    `;
    summaryContainer.appendChild(totalDiv);
    
    // 合計時間の更新（既存のUIとの互換性）
    const totalDurationElement = document.getElementById('total-duration');
    if (totalDurationElement) {
        totalDurationElement.textContent = data.totalDuration;
    }
}

/**
 * ボタンイベントの設定
 */
function setupButtonEvents(reservationData) {
    // 編集ボタン
    const editBtn = document.getElementById('edit-booking-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            // カレンダー画面に戻る
            history.back();
        });
    }
    
    // 確定ボタン
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            confirmReservation(reservationData);
        });
    }
    
    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = '/reserve/logout.php';
        });
    }
}

/**
 * 予約確定処理
 */
async function confirmReservation(reservationData) {
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const originalBtnHtml = confirmBtn.innerHTML;
    
    // ローディング表示開始
    confirmBtn.disabled = true;
    showLoadingAnimation();
    
    try {
        // MedicalForce形式のデータを準備
        const apiData = {
            visitor_id: reservationData.patientId,
            start_at: `${reservationData.selectedDate}T${reservationData.bookings[0].startTime}:00.000Z`,
            note: '天満病院予約システムからの予約',
            is_online: false,
            menus: reservationData.bookings.map(booking => ({
                menu_id: booking.menuId,
                staff_id: null // スタッフ指定なし
            }))
        };
        
        // API呼び出し
        const result = await createMedicalForceReservation(apiData);
        
        if (result.success) {
            // 完了データを保存
            const completionData = {
                reservationId: result.reservationId,
                patientId: reservationData.patientId,
                selectedDate: reservationData.selectedDate,
                bookings: reservationData.bookings,
                totalDuration: reservationData.totalDuration,
                totalPrice: reservationData.totalPrice,
                completedAt: new Date().toISOString()
            };
            
            // LocalStorageに保存（既存の完了画面との互換性）
            StorageManager.save('clutirefine_completion_data', completionData);
            
            // セッションストレージもクリア
            sessionStorage.removeItem('reservationData');
            
            // 完了画面へ遷移
            window.location.href = '/reserve/completion.html';
        } else {
            hideLoadingAnimation();
            alert('予約の確定に失敗しました: ' + result.message);
        }
    } catch (error) {
        hideLoadingAnimation();
        console.error('Reservation error:', error);
        alert('予約処理中にエラーが発生しました。もう一度お試しください。');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalBtnHtml;
    }
}

/**
 * ローディングアニメーション表示
 */
function showLoadingAnimation() {
    // 既存のローディング要素があれば削除
    const existingLoading = document.getElementById('loading-overlay');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    // ローディングオーバーレイを作成
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-sm mx-auto text-center">
            <div class="loading-spinner-large mb-4"></div>
            <h3 class="text-lg font-bold mb-2">予約を確定しています</h3>
            <p class="text-gray-600">しばらくお待ちください...</p>
            <div class="mt-4">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // プログレスバーアニメーション
    setTimeout(() => {
        const progressFill = overlay.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = '80%';
        }
    }, 100);
}

/**
 * ローディングアニメーション非表示
 */
function hideLoadingAnimation() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * 日付フォーマット
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    return date.toLocaleDateString('ja-JP', options);
}

// スタイル追加
const style = document.createElement('style');
style.textContent = `
    .loading-spinner-large {
        display: inline-block;
        width: 60px;
        height: 60px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .progress-bar {
        width: 100%;
        height: 8px;
        background-color: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        width: 0;
        background-color: #3498db;
        transition: width 3s ease-in-out;
    }
`;
document.head.appendChild(style);