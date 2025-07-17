// screens/patient-selection.js
// 患者選択画面モジュール

import { appState } from '../core/app-state.js';
import { showModal } from '../core/ui-helpers.js';
import { createElement } from '../core/ui-helpers.js';

export function initPatientSelectionScreen() {
    var pairModeSwitch = document.getElementById('pair-mode-switch');
    var proceedBtn = document.getElementById('proceed-patients-btn');
    var addPatientBtn = document.getElementById('add-patient-btn');
    var description = document.getElementById('patient-selection-description');

    if (!pairModeSwitch || !proceedBtn || !addPatientBtn || !description) return;

    // PHPから取得したデータを利用
    if (window.APP_CONFIG && window.APP_CONFIG.companyPatients) {
        appState.allPatients = window.APP_CONFIG.companyPatients.map(function(patient) {
            return {
                id: patient.id,
                name: patient.name,
                lastVisit: patient.lastVisit || null,
                isNew: patient.isNew || false,
                isVisible: patient.isVisible !== false, // 公開設定がfalseでない限りtrue
                companyId: patient.companyId
            };
        });
        
        console.log('Loaded ' + appState.allPatients.length + ' patients from PHP');
        
        // 権限チェック：サブ会員の場合は公開設定がfalseの患者を除外
        if (window.APP_CONFIG.userRole === 'sub') {
            appState.allPatients = appState.allPatients.filter(function(patient) {
                return patient.isVisible;
            });
            console.log('Filtered to ' + appState.allPatients.length + ' visible patients for sub member');
        }
    }

    // エラーメッセージの表示
    if (window.APP_CONFIG && window.APP_CONFIG.errorMessage) {
        var errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
        errorDiv.textContent = window.APP_CONFIG.errorMessage;
        
        var container = document.getElementById('patients-list');
        if (container && container.parentNode) {
            container.parentNode.insertBefore(errorDiv, container);
        }
    }

    pairModeSwitch.addEventListener('change', function(e) {
        appState.isPairBookingMode = e.target.checked;
        description.textContent = appState.isPairBookingMode
            ? "ペア予約のため、2名の来院者を選択してください。"
            : "今回同時に予約する来院者を選択してください。";
        
        // Reset selected patients when mode changes
        appState.selectedPatientsForBooking = [];
        updatePatientsList();
        updateProceedButton();
    });

    addPatientBtn.addEventListener('click', function() {
        showModal('add-patient-modal');
    });

    proceedBtn.addEventListener('click', function() {
        var selected = appState.selectedPatientsForBooking;
        
        if (appState.isPairBookingMode && selected.length !== 2) {
            alert("ペア予約では、ちょうど2名の来院者を選択してください。");
            return;
        }
        if (!appState.isPairBookingMode && selected.length === 0) {
            alert("少なくとも1名の来院者を選択してください。");
            return;
        }

        // Initialize bookings
        appState.bookings = selected.map(function(patient) {
            return {
                patientId: patient.id,
                patientName: patient.name,
                treatment: null,
                selectedDate: null,
                selectedTime: null,
                pairRoomDesired: appState.isPairBookingMode,
                status: "pending"
            };
        });

        // 修正点: 複数選択時の分岐処理を変更
        if (appState.isPairBookingMode) {
            appState.setScreen('pair-booking');
        } else if (selected.length === 1) {
            // 1名の場合は従来通り個別予約画面
            appState.currentPatientIndexForBooking = 0;
            appState.setScreen('menu-calendar');
        } else {
            // 複数名の場合は一括予約画面
            appState.setScreen('bulk-booking');
        }
    });

    updatePatientsList();
}

export function updatePatientsList() {
    var container = document.getElementById('patients-list');
    if (!container) return;
    
    container.innerHTML = '';

    // 権限に応じた説明を表示
    if (window.APP_CONFIG && window.APP_CONFIG.userRole === 'sub') {
        var roleNotice = document.createElement('div');
        roleNotice.className = 'bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded mb-3 text-sm';
        roleNotice.innerHTML = '<strong>サブ会員</strong>: 公開設定された来院者のみ表示されています。';
        container.appendChild(roleNotice);
    } else if (window.APP_CONFIG && window.APP_CONFIG.userRole === 'main') {
        var roleNotice = document.createElement('div');
        roleNotice.className = 'bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded mb-3 text-sm';
        roleNotice.innerHTML = '<strong>本会員</strong>: 会社の全ての来院者を表示しています。';
        container.appendChild(roleNotice);
    }

    if (appState.allPatients.length === 0) {
        var emptyState = document.createElement('div');
        emptyState.className = 'text-center py-8 text-gray-500';
        emptyState.innerHTML = 
            '<div class="text-4xl mb-4">👤</div>' +
            '<p>選択可能な来院者がありません。</p>' +
            '<p class="text-sm mt-2">新しい来院者を追加するか、管理者にお問い合わせください。</p>';
        container.appendChild(emptyState);
        return;
    }

    for (var i = 0; i < appState.allPatients.length; i++) {
        var patient = appState.allPatients[i];
        var isSelected = appState.selectedPatientsForBooking.some(function(p) { return p.id === patient.id; });
        var isDisabled = appState.isPairBookingMode && 
                          appState.selectedPatientsForBooking.length >= 2 && 
                          !isSelected;

        var patientElement = createElement('div', 
            'patient-item flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-all ' +
            (isSelected ? 'selected bg-teal-50 border-teal-500' : 'border-gray-200 hover:bg-slate-50')
        );
        
        var lastVisitText = patient.lastVisit ? '(最終来院: ' + patient.lastVisit + ')' : '';
        var newText = patient.isNew ? '<span class="text-xs text-green-600 ml-2">(新規)</span>' : '';
        var visibilityText = window.APP_CONFIG && window.APP_CONFIG.userRole === 'main' && !patient.isVisible ? 
            '<span class="text-xs text-red-600 ml-2">(非公開)</span>' : '';
        
        patientElement.innerHTML = 
            '<input type="checkbox" class="patient-checkbox" ' +
            (isSelected ? 'checked' : '') + ' ' +
            (isDisabled ? 'disabled' : '') +
            ' data-patient-id="' + patient.id + '">' +
            '<div class="flex-1 cursor-pointer">' +
                '<span class="font-medium">' + patient.name + '</span>' +
                (lastVisitText ? '<span class="text-xs text-gray-500 ml-2">' + lastVisitText + '</span>' : '') +
                newText +
                visibilityText +
            '</div>';

        patientElement.addEventListener('click', function(patientId) {
            return function() {
                var disabled = appState.isPairBookingMode && 
                              appState.selectedPatientsForBooking.length >= 2 && 
                              !appState.selectedPatientsForBooking.some(function(p) { return p.id === patientId; });
                if (disabled) {
                    alert("ペア予約では2名まで選択できます。");
                } else {
                    togglePatientSelection(patientId);
                }
            };
        }(patient.id));

        container.appendChild(patientElement);
    }
}

export function togglePatientSelection(patientId) {
    var patient = appState.allPatients.find(function(p) { return p.id === patientId; });
    var isSelected = appState.selectedPatientsForBooking.some(function(p) { return p.id === patientId; });

    if (isSelected) {
        appState.selectedPatientsForBooking = appState.selectedPatientsForBooking.filter(function(p) { return p.id !== patientId; });
    } else {
        if (appState.isPairBookingMode && appState.selectedPatientsForBooking.length >= 2) {
            alert("ペア予約では2名まで選択できます。");
            return;
        }
        appState.selectedPatientsForBooking.push(patient);
    }

    updatePatientsList();
    updateProceedButton();
}

export function updateProceedButton() {
    var proceedBtn = document.getElementById('proceed-patients-btn');
    var proceedText = document.getElementById('proceed-text');
    if (!proceedBtn || !proceedText) return;
    
    var count = appState.selectedPatientsForBooking.length;
    var canProceed = appState.isPairBookingMode ? count === 2 : count > 0;

    proceedBtn.disabled = !canProceed;
    proceedText.textContent = appState.isPairBookingMode
        ? "ペア予約へ進む"
        : "選択した" + count + "名の予約へ進む";
}