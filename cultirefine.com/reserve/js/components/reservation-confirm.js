// components/reservation-confirm.js
// 予約確認モーダルコンポーネント

import { appState } from '../core/app-state.js';

/**
 * 予約確認モーダルを表示
 * @param {Object} reservationData 予約データ
 * @param {Function} onConfirm 確定時のコールバック
 */
export function showReservationConfirmModal(reservationData, onConfirm) {
    const modal = document.getElementById('reservation-confirm-modal');
    if (!modal) {
        console.error('Reservation confirm modal not found');
        return;
    }
    
    // サマリーを表示
    displayReservationSummary(reservationData);
    
    // イベントリスナーを設定
    setupModalEventListeners(reservationData, onConfirm);
    
    // モーダルを表示
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * 予約確認モーダルを非表示
 */
export function hideReservationConfirmModal() {
    const modal = document.getElementById('reservation-confirm-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
    
    // イベントリスナーを削除
    removeModalEventListeners();
}

/**
 * 予約サマリーを表示
 */
function displayReservationSummary(reservationData) {
    const summaryContainer = document.getElementById('reservation-summary');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = '';
    
    // 単一予約か複数予約かを判定
    if (reservationData.type === 'multiple' || Array.isArray(reservationData.patients)) {
        displayMultipleReservationSummary(summaryContainer, reservationData);
    } else {
        displaySingleReservationSummary(summaryContainer, reservationData);
    }
}

/**
 * 単一予約のサマリー表示
 */
function displaySingleReservationSummary(container, data) {
    // 患者情報
    const patientDiv = document.createElement('div');
    patientDiv.className = 'bg-gray-50 rounded-lg p-4';
    patientDiv.innerHTML = `
        <h4 class="font-semibold text-gray-900 mb-2">患者情報</h4>
        <p class="text-sm text-gray-700">患者ID: ${data.patientId || 'unknown'}</p>
        <p class="text-sm text-gray-700">患者名: ${data.patientName || '---'}</p>
    `;
    container.appendChild(patientDiv);
    
    // 予約日時
    const dateTimeDiv = document.createElement('div');
    dateTimeDiv.className = 'bg-white border rounded-lg p-4';
    dateTimeDiv.innerHTML = `
        <h4 class="font-semibold text-gray-900 mb-2">予約日時</h4>
        <p class="text-lg font-medium text-teal-600">${formatDate(data.selectedDate)} ${data.selectedTime}</p>
    `;
    container.appendChild(dateTimeDiv);
    
    // 選択メニュー
    const menusDiv = document.createElement('div');
    menusDiv.className = 'bg-white border rounded-lg p-4';
    menusDiv.innerHTML = '<h4 class="font-semibold text-gray-900 mb-3">選択メニュー</h4>';
    
    const menuList = document.createElement('div');
    menuList.className = 'space-y-2';
    
    data.selectedMenus.forEach(menu => {
        const menuItem = document.createElement('div');
        menuItem.className = 'flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0';
        menuItem.innerHTML = `
            <div>
                <p class="font-medium">${menu.name || menu.menu_name}</p>
                <p class="text-sm text-gray-600">${menu.duration_minutes || menu.duration}分</p>
            </div>
            <div class="text-right">
                <p class="font-medium">¥${(menu.price || 0).toLocaleString()}</p>
            </div>
        `;
        menuList.appendChild(menuItem);
    });
    
    menusDiv.appendChild(menuList);
    
    // 合計
    const totalDuration = data.selectedMenus.reduce((sum, menu) => sum + (menu.duration_minutes || menu.duration || 0), 0);
    const totalPrice = data.selectedMenus.reduce((sum, menu) => sum + (menu.price || 0), 0);
    
    const totalDiv = document.createElement('div');
    totalDiv.className = 'bg-teal-50 rounded-lg p-4 border-l-4 border-teal-400';
    totalDiv.innerHTML = `
        <div class="flex justify-between items-center font-semibold text-teal-800">
            <span>合計時間: ${totalDuration}分</span>
            <span>合計金額: ¥${totalPrice.toLocaleString()}</span>
        </div>
    `;
    
    menusDiv.appendChild(totalDiv);
    container.appendChild(menusDiv);
}

/**
 * 複数予約のサマリー表示
 */
function displayMultipleReservationSummary(container, data) {
    // 予約日時（共通）
    const dateTimeDiv = document.createElement('div');
    dateTimeDiv.className = 'bg-white border rounded-lg p-4 mb-4';
    dateTimeDiv.innerHTML = `
        <h4 class="font-semibold text-gray-900 mb-2">予約日時</h4>
        <p class="text-lg font-medium text-teal-600">${formatDate(data.selectedDate)} ${data.selectedTime}</p>
    `;
    container.appendChild(dateTimeDiv);
    
    // 各患者の予約詳細
    const patientsDiv = document.createElement('div');
    patientsDiv.className = 'space-y-4';
    
    data.patients.forEach((patient, index) => {
        const patientDiv = document.createElement('div');
        patientDiv.className = 'bg-gray-50 rounded-lg p-4';
        
        const menus = patient.selectedMenus || [];
        const totalDuration = menus.reduce((sum, menu) => sum + (menu.duration_minutes || menu.duration || 0), 0);
        const totalPrice = menus.reduce((sum, menu) => sum + (menu.price || 0), 0);
        
        patientDiv.innerHTML = `
            <h4 class="font-semibold text-gray-900 mb-2">${patient.name || `患者${index + 1}`}</h4>
            <p class="text-sm text-gray-600 mb-2">患者ID: ${patient.id}</p>
            <div class="space-y-2">
                ${menus.map(menu => `
                    <div class="flex justify-between items-center text-sm">
                        <span>${menu.name || menu.menu_name} (${menu.duration_minutes || menu.duration}分)</span>
                        <span>¥${(menu.price || 0).toLocaleString()}</span>
                    </div>
                `).join('')}
            </div>
            <div class="mt-2 pt-2 border-t border-gray-200 flex justify-between font-medium text-sm">
                <span>小計: ${totalDuration}分</span>
                <span>¥${totalPrice.toLocaleString()}</span>
            </div>
        `;
        
        patientsDiv.appendChild(patientDiv);
    });
    
    container.appendChild(patientsDiv);
    
    // 総合計
    const grandTotalDuration = data.patients.reduce((sum, patient) => {
        return sum + (patient.selectedMenus || []).reduce((menuSum, menu) => 
            menuSum + (menu.duration_minutes || menu.duration || 0), 0);
    }, 0);
    
    const grandTotalPrice = data.patients.reduce((sum, patient) => {
        return sum + (patient.selectedMenus || []).reduce((menuSum, menu) => 
            menuSum + (menu.price || 0), 0);
    }, 0);
    
    const grandTotalDiv = document.createElement('div');
    grandTotalDiv.className = 'bg-teal-50 rounded-lg p-4 border-l-4 border-teal-400';
    grandTotalDiv.innerHTML = `
        <div class="flex justify-between items-center font-bold text-teal-800">
            <span>総合計: ${grandTotalDuration}分 (${data.patients.length}名)</span>
            <span>¥${grandTotalPrice.toLocaleString()}</span>
        </div>
    `;
    
    container.appendChild(grandTotalDiv);
}

/**
 * モーダルイベントリスナーを設定
 */
function setupModalEventListeners(reservationData, onConfirm) {
    // 閉じるボタン
    const closeBtn = document.getElementById('close-confirm-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideReservationConfirmModal);
    }
    
    // キャンセルボタン
    const cancelBtn = document.getElementById('cancel-reservation-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideReservationConfirmModal);
    }
    
    // 確定ボタン
    const confirmBtn = document.getElementById('confirm-reservation-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            handleReservationConfirm(reservationData, onConfirm);
        });
    }
    
    // ESCキーで閉じる
    document.addEventListener('keydown', handleEscKey);
}

/**
 * モーダルイベントリスナーを削除
 */
function removeModalEventListeners() {
    document.removeEventListener('keydown', handleEscKey);
}

/**
 * ESCキーハンドラー
 */
function handleEscKey(event) {
    if (event.key === 'Escape') {
        hideReservationConfirmModal();
    }
}

/**
 * 予約確定処理
 */
async function handleReservationConfirm(reservationData, onConfirm) {
    const confirmBtn = document.getElementById('confirm-reservation-btn');
    const btnText = document.getElementById('confirm-btn-text');
    const btnSpinner = document.getElementById('confirm-btn-spinner');
    
    if (!confirmBtn || !btnText || !btnSpinner) return;
    
    // ローディング状態にする
    confirmBtn.disabled = true;
    btnText.textContent = '予約中...';
    btnSpinner.classList.remove('hidden');
    
    try {
        // 確定処理を実行
        if (onConfirm) {
            await onConfirm(reservationData);
        }
        
        // 成功時はモーダルを閉じる
        hideReservationConfirmModal();
        
    } catch (error) {
        console.error('Reservation confirmation error:', error);
        
        // より詳細なエラー表示
        let errorMessage = '予約の確定中にエラーが発生しました。\n\n';
        
        if (error.message) {
            errorMessage += 'エラー詳細: ' + error.message + '\n';
        }
        
        // ネットワークエラーやAPI エラーの場合の追加情報
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage += '\n通信エラーが発生しました。インターネット接続を確認してください。';
        } else if (error.message.includes('timeout')) {
            errorMessage += '\n処理がタイムアウトしました。しばらく待ってから再試行してください。';
        } else {
            errorMessage += '\nしばらく待ってから再試行するか、管理者にお問い合わせください。';
        }
        
        alert(errorMessage);
        
    } finally {
        // ボタンを元に戻す
        confirmBtn.disabled = false;
        btnText.textContent = '予約を確定する';
        btnSpinner.classList.add('hidden');
    }
}

/**
 * 日付フォーマット
 */
function formatDate(dateString) {
    if (!dateString) return '---';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}年${month}月${day}日 (${weekday})`;
}