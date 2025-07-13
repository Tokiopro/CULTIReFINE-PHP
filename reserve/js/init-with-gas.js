// init-with-gas.js
// GAS APIと連携した初期化処理

import { appState } from './core/app-state.js';
import { getUserFullInfo, mapGasDataToAppState } from './data/gas-api.js';
import { showAlert, hideAlert } from './core/ui-helpers.js';

/**
 * アプリケーション初期化（GAS API連携版）
 */
export async function initializeAppWithGasApi() {
    console.log('[Init] Initializing app with GAS API');
    
    // ローディング表示
    showLoadingState();
    
    try {
        // GAS APIからユーザー情報を取得
        const userApiResult = await getUserFullInfo();
        
        if (!userApiResult.success) {
            throw new Error(userApiResult.message || 'ユーザー情報の取得に失敗しました');
        }
        
        // GASデータをAppState用にマッピング
        const mappedData = mapGasDataToAppState(userApiResult.data);
        
        // AppStateにデータを設定
        appState.setLineUser(mappedData.user);
        
        // 患者リストを設定（既存患者 + API取得患者）
        if (mappedData.patients && mappedData.patients.length > 0) {
            appState.allPatients = mappedData.patients;
        }
        
        // ユーザー名表示を更新
        updateUserDisplay(mappedData.user);
        
        // 会員情報を表示
        updateMembershipDisplay(mappedData.membershipInfo);
        
        // 今後の予約を表示
        updateUpcomingReservations(mappedData.upcomingReservations);
        
        // 成功メッセージ
        showAlert('success', `ようこそ、${mappedData.user.name}さん！`);
        
        console.log('[Init] App initialized successfully with GAS data');
        
    } catch (error) {
        console.error('[Init] Failed to initialize app:', error);
        showAlert('error', 'データの読み込みに失敗しました: ' + error.message);
        
        // フォールバック: モックデータで初期化
        initializeWithMockData();
    } finally {
        hideLoadingState();
    }
}

/**
 * ローディング状態を表示
 */
function showLoadingState() {
    const loadingHtml = `
        <div id="loading-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-3"></div>
                <p class="text-gray-600">データを読み込んでいます...</p>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', loadingHtml);
}

/**
 * ローディング状態を非表示
 */
function hideLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

/**
 * ユーザー表示を更新
 */
function updateUserDisplay(user) {
    const userNameElement = document.getElementById('user-name');
    const userWelcomeElement = document.getElementById('user-welcome');
    
    if (userNameElement) {
        userNameElement.textContent = user.name || user.displayName;
    }
    
    if (userWelcomeElement) {
        userWelcomeElement.classList.remove('hidden');
    }
}

/**
 * 会員情報表示を更新
 */
function updateMembershipDisplay(membershipInfo) {
    if (!membershipInfo || !membershipInfo.isMember) {
        return;
    }
    
    // 会員情報表示エリアがあれば更新
    const membershipSection = document.getElementById('membership-info');
    if (!membershipSection) {
        createMembershipInfoSection(membershipInfo);
    }
}

/**
 * 会員情報セクションを作成
 */
function createMembershipInfoSection(membershipInfo) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const membershipHtml = `
        <div id="membership-info" class="bg-gradient-to-r from-yellow-100 to-yellow-200 border border-yellow-300 rounded-lg p-4 mb-6">
            <h3 class="font-semibold text-yellow-800 mb-2">会員情報</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="font-medium">会員種別:</span> ${membershipInfo.memberType}
                </div>
                <div>
                    <span class="font-medium">会社名:</span> ${membershipInfo.companyName || 'なし'}
                </div>
                ${createTicketBalanceHtml(membershipInfo.ticketBalance)}
            </div>
        </div>
    `;
    
    const firstScreen = document.getElementById('patient-selection-screen');
    if (firstScreen) {
        firstScreen.insertAdjacentHTML('beforebegin', membershipHtml);
    }
}

/**
 * チケット残高HTMLを作成
 */
function createTicketBalanceHtml(ticketBalance) {
    if (!ticketBalance || Object.keys(ticketBalance).length === 0) {
        return '';
    }
    
    let html = '<div class="col-span-2"><span class="font-medium">チケット残高:</span> ';
    const tickets = [];
    
    if (ticketBalance.stem_cell) {
        tickets.push(`幹細胞: ${ticketBalance.stem_cell}枚`);
    }
    if (ticketBalance.treatment) {
        tickets.push(`施術: ${ticketBalance.treatment}枚`);
    }
    if (ticketBalance.drip) {
        tickets.push(`点滴: ${ticketBalance.drip}枚`);
    }
    
    html += tickets.join(', ') + '</div>';
    return html;
}

/**
 * 今後の予約を表示
 */
function updateUpcomingReservations(upcomingReservations) {
    if (!upcomingReservations || upcomingReservations.length === 0) {
        return;
    }
    
    // 既存の予約表示エリアがあれば更新
    const reservationsSection = document.getElementById('upcoming-reservations');
    if (!reservationsSection) {
        createUpcomingReservationsSection(upcomingReservations);
    }
}

/**
 * 今後の予約セクションを作成
 */
function createUpcomingReservationsSection(reservations) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const reservationsHtml = `
        <div id="upcoming-reservations" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 class="font-semibold text-blue-800 mb-3">今後の予約</h3>
            <div class="space-y-2">
                ${reservations.map(reservation => `
                    <div class="bg-white rounded p-3 border border-blue-100">
                        <div class="font-medium">${reservation.treatmentName}</div>
                        <div class="text-sm text-gray-600">
                            ${reservation.reservationDate} ${reservation.reservationTime} 
                            (${reservation.duration}分)
                        </div>
                        <div class="text-sm font-medium text-blue-600">
                            ¥${parseInt(reservation.price).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    const firstScreen = document.getElementById('patient-selection-screen');
    if (firstScreen) {
        firstScreen.insertAdjacentHTML('beforebegin', reservationsHtml);
    }
}

/**
 * モックデータでの初期化（フォールバック）
 */
function initializeWithMockData() {
    console.log('[Init] Falling back to mock data initialization');
    
    // デフォルトのLINEユーザー情報
    appState.setLineUser({
        displayName: 'ゲストユーザー',
        name: 'ゲストユーザー'
    });
    
    showAlert('warning', 'デモモードで動作しています');
}