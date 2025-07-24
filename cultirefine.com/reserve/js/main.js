// main.js
// メイン初期化・統合ファイル

// Core modules
import './core/polyfills.js';
import { appState } from './core/app-state.js';

// Components
import { calendarPreviousMonth, calendarNextMonth, calendarSelectDate } from './components/calendar.js';
import { toggleAccordion, createTreatmentAccordion } from './components/treatment-accordion.js';
import { initAddPatientModal } from './components/modal.js';

// Screens
import { 
    initPatientSelectionScreen, 
    updatePatientsList, 
    updateProceedButton,
    togglePatientSelection 
} from './screens/patient-selection.js';
import { 
    initMenuCalendarScreen,
    selectTimeSlot,
    updateNextButtonState
} from './screens/menu-calendar.js';

// GAS API and data
import { mockCheckTreatmentInterval, getUserFullInfo, mapGasDataToAppState, createReservations } from './data/gas-api.js';
import { showAlert, hideAlert } from './core/ui-helpers.js';
import { showReservationConfirmModal } from './components/reservation-confirm.js';

// =====================================
// Treatment Selection Handler
// =====================================

function selectTreatment(patientId, treatment) {
    console.log('selectTreatment called for patient:', patientId, 'treatment:', treatment);
    appState.selectedTreatments[patientId] = treatment;
    
    // Update UI
    var treatmentItems = document.querySelectorAll('.treatment-item');
    for (var i = 0; i < treatmentItems.length; i++) {
        treatmentItems[i].classList.remove('selected');
    }
    
    var clickedElement = event && event.currentTarget ? event.currentTarget : null;
    if (clickedElement) {
        clickedElement.classList.add('selected');
        var radio = clickedElement.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    // Check current screen type
    if (appState.currentScreen === 'bulk-booking') {
        // For bulk booking, check if all patients have treatments selected
        var allSelected = appState.selectedPatientsForBooking.every(function(p) {
            return appState.selectedTreatments[p.id];
        });
        
        if (allSelected) {
            document.getElementById('bulk-date-time-selection').classList.remove('hidden');
        }
        
        if (window.updateBulkNextButtonState) {
            window.updateBulkNextButtonState();
        }
        return;
    }

    if (appState.isPairBookingMode && appState.currentScreen === 'pair-booking') {
        var patient1 = appState.selectedPatientsForBooking[0];
        var patient2 = appState.selectedPatientsForBooking[1];
        
        if (appState.selectedTreatments[patient1.id] && appState.selectedTreatments[patient2.id]) {
            document.getElementById('pair-date-time-selection').classList.remove('hidden');
            hideAlert('patient1-interval-error');
            hideAlert('patient2-interval-error');
        }
        
        if (window.updatePairNextButtonState) {
            window.updatePairNextButtonState();
        }
        return;
    }

    // Normal single patient booking logic
    var currentDate = appState.selectedDates[patientId] || new Date();
    mockCheckTreatmentInterval(patientId, treatment.id, currentDate).then(function(intervalResult) {
        if (!intervalResult.isValid) {
            showAlert('interval-error', 'error', '施術間隔エラー', intervalResult.message);
            document.getElementById('date-time-selection').classList.add('hidden');
        } else {
            hideAlert('interval-error');
            document.getElementById('date-time-selection').classList.remove('hidden');
        }

        setTimeout(function() {
            updateNextButtonState();
        }, 100);
    });
}

// =====================================
// Screen Initializers Map
// =====================================

var screenInitializers = {
    'menu-calendar': initMenuCalendarScreen,
    'pair-booking': function() {
        // Import and initialize pair booking if needed
        import('./screens/pair-booking.js').then(function(module) {
            module.initPairBookingScreen();
        });
    },
    'bulk-booking': function() {
        // Import and initialize bulk booking if needed
        import('./screens/bulk-booking.js').then(function(module) {
            module.initBulkBookingScreen();
        });
    }
};

// Override setScreen to call initializers
var originalSetScreen = appState.setScreen;
appState.setScreen = function(screenName) {
    originalSetScreen.call(this, screenName);
    
    if (screenInitializers[screenName]) {
        // Delay initialization to ensure DOM is updated
        setTimeout(function() {
            screenInitializers[screenName]();
        }, 100);
    }
};

// =====================================
// Global Functions for HTML
// =====================================

// Make functions globally accessible for inline event handlers
window.toggleAccordion = toggleAccordion;
window.selectTreatment = selectTreatment;
window.selectTimeSlot = selectTimeSlot;
window.calendarPreviousMonth = calendarPreviousMonth;
window.calendarNextMonth = calendarNextMonth;
window.calendarSelectDate = calendarSelectDate;

// Make functions available for modal.js
window.updatePatientsList = updatePatientsList;
window.updateProceedButton = updateProceedButton;

// =====================================
// Application Initialization
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Set current year in footer
    var currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    // Initialize all screens
    initPatientSelectionScreen();
    initAddPatientModal();
    
    // Set LINE user from PHP session data
    if (window.SESSION_USER_DATA) {
        appState.setLineUser({
            userId: window.SESSION_USER_DATA.lineUserId,
            displayName: window.SESSION_USER_DATA.displayName,
            pictureUrl: window.SESSION_USER_DATA.pictureUrl
        });
        
        // Fetch full user information from API
        getUserFullInfo().then(function(data) {
            mapGasDataToAppState(data);
            updatePatientsList();
        }).catch(function(error) {
            console.error('Failed to load user data:', error);
        });
    } else {
        console.error('No session user data found');
        // Redirect to login
        window.location.href = '/cultirefine.com/reserve/line-auth/';
    }
    
    // Force set initial screen to patient-selection
    appState.setScreen('patient-selection');
    
    console.log('App initialization complete');
    
    // 予約確認ボタンのイベントリスナーを設定
    setupReservationConfirmButton();
});

// 予約確認ボタンのイベントリスナー設定
function setupReservationConfirmButton() {
    const nextBtn = document.getElementById('next-menu-calendar-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', handleReservationConfirm);
    }
}

// 予約確認処理
function handleReservationConfirm() {
    const currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
    if (!currentPatient) return;
    
    const selectedMenus = appState.selectedTreatments[currentPatient.id] || [];
    const selectedDate = appState.selectedDates[currentPatient.id];
    const selectedTime = appState.selectedTimes[currentPatient.id];
    
    if (selectedMenus.length === 0 || !selectedDate || !selectedTime) {
        alert('メニュー、日付、時間をすべて選択してください。');
        return;
    }
    
    // 予約データを準備
    const reservationData = {
        type: 'single',
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        selectedDate: selectedDate,
        selectedTime: typeof selectedTime === 'string' ? selectedTime : selectedTime[selectedMenus[0].id],
        selectedMenus: selectedMenus
    };
    
    // 確認モーダルを表示
    showReservationConfirmModal(reservationData, async (data) => {
        await createSingleReservation(data);
    });
}

// 単一予約作成
async function createSingleReservation(reservationData) {
    try {
        // Medical Force API形式のデータを準備
        const medicalForceData = {
            visitor_id: reservationData.patientId,
            start_at: `${reservationData.selectedDate}T${reservationData.selectedTime}:00.000Z`,
            note: '天満病院予約システムからの予約',
            is_online: false,
            menus: reservationData.selectedMenus.map(menu => ({
                menu_id: menu.id || menu.menu_id,
                staff_id: null
            }))
        };
        
        const result = await createReservations(medicalForceData);
        
        if (result.success) {
            alert('予約が正常に作成されました！');
            // 完了画面への遷移など
            window.location.href = '/reserve/completion.html';
        } else {
            // エラーハンドリング
            if (result.errors && result.errors.length > 0) {
                const errorMessages = result.errors.map(error => 
                    `${error.visitor_id}: ${error.error}`
                ).join('\n');
                alert(`予約作成でエラーが発生しました:\n${errorMessages}`);
            } else {
                alert('予約作成に失敗しました: ' + result.message);
            }
        }
        
    } catch (error) {
        console.error('Reservation creation error:', error);
        alert('予約作成中にエラーが発生しました: ' + error.message);
    }
}

// 複数予約作成（ペア・一括予約対応）
export async function createMultipleReservations(reservationData) {
    try {
        console.log('Creating multiple reservations:', reservationData);
        
        // 各患者の予約データを準備（Medical Force API形式）
        const reservations = reservationData.patients.map(patient => ({
            visitor_id: patient.id,
            start_at: `${reservationData.selectedDate}T${reservationData.selectedTime}:00.000Z`,
            note: `天満病院予約システムからの予約${reservationData.pairBooking ? '（ペア予約）' : '（一括予約）'}`,
            is_online: false,
            menus: patient.selectedMenus.map(menu => ({
                menu_id: menu.id || menu.menu_id,
                staff_id: null
            }))
        }));
        
        // 複数予約APIを呼び出し
        const result = await createReservations({ reservations: reservations });
        
        if (result.success) {
            // 成功・失敗の詳細を表示
            let message = `予約処理が完了しました。\n`;
            message += `成功: ${result.successful}件\n`;
            
            if (result.failed > 0) {
                message += `失敗: ${result.failed}件\n\n`;
                message += `失敗した予約:\n`;
                
                result.errors.forEach(error => {
                    const patientName = reservationData.patients.find(p => p.id === error.visitor_id)?.name || error.visitor_id;
                    // 詳細なエラー情報があれば使用、なければfallback
                    const failureReason = error.user_message || parseFailureReason(error.error);
                    message += `• ${patientName}様: ${failureReason}\n`;
                });
                
                message += `\n正常に予約できた分は確定されています。`;
            }
            
            alert(message);
            
            // 完了画面への遷移
            window.location.href = '/reserve/completion.html';
            
        } else {
            // 全体的な失敗
            alert('予約作成に失敗しました: ' + (result.message || 'エラーが発生しました'));
        }
        
    } catch (error) {
        console.error('Multiple reservation creation error:', error);
        alert('予約作成中にエラーが発生しました: ' + error.message);
    }
}

// エラーメッセージを日本語の具体的な理由に変換
function parseFailureReason(errorMessage) {
    if (!errorMessage) return '不明なエラー';
    
    const msg = errorMessage.toLowerCase();
    
    if (msg.includes('time slot not available') || msg.includes('slot already booked')) {
        return '選択した時間が既に予約済みです';
    }
    if (msg.includes('invalid menu') || msg.includes('menu not found')) {
        return '無効なメニューが選択されています';
    }
    if (msg.includes('visitor not found') || msg.includes('patient not found')) {
        return '患者情報が見つかりません';
    }
    if (msg.includes('insufficient tickets')) {
        return 'チケットが不足しています';
    }
    if (msg.includes('duplicate reservation')) {
        return '同じ時間に既に予約があります';
    }
    if (msg.includes('business hours')) {
        return '営業時間外の予約です';
    }
    if (msg.includes('past date')) {
        return '過去の日付には予約できません';
    }
    if (msg.includes('interval')) {
        return '施術間隔の規則に違反しています';
    }
    
    // その他のエラーはそのまま返す
    return errorMessage;
}

// Backup initialization for older browsers
window.addEventListener('load', function() {
    if (appState.currentScreen !== 'patient-selection') {
        console.log('Backup initialization triggered');
        appState.currentScreen = 'patient-selection';
        appState.updateUI();
    }
});