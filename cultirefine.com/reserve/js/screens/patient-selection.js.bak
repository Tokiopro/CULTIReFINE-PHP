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

    // PHPから取得したデータを利用（新しいGAS API形式）
    if (window.APP_CONFIG && window.APP_CONFIG.companyPatients) {
        appState.allPatients = window.APP_CONFIG.companyPatients.map(function(visitor) {
            return {
                id: visitor.visitor_id,
                name: visitor.name,
                kana: visitor.kana,
                gender: visitor.gender,
                isPublic: visitor.is_public,
                lastVisit: visitor.last_visit || null,
                isNew: visitor.is_new || false,
                isVisible: visitor.is_public !== false, // 公開設定がfalseでない限りtrue
                companyId: visitor.company_id
            };
        });
        
        console.log('Loaded ' + appState.allPatients.length + ' visitors from PHP');
        
        // 権限チェック：サブ会員の場合は公開設定がfalseの患者を除外
        if (window.APP_CONFIG.userRole === 'sub') {
            appState.allPatients = appState.allPatients.filter(function(patient) {
                // is_publicがtrueまたは明示的に設定されていない場合のみ表示
                return patient.isPublic === true || (patient.isPublic !== false && typeof patient.isPublic === 'undefined');
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
    
    // グローバル関数として登録（modal.jsから呼び出される）
    window.updatePatientsList = updatePatientsList;
    window.updateProceedButton = updateProceedButton;
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
        
        // サブ会員の場合、非公開の来院者はスキップ
        if (window.APP_CONFIG && window.APP_CONFIG.userRole === 'sub' && patient.isPublic === false) {
            continue;
        }
        
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
        
        // 本会員の場合、公開設定トグルボタンを追加
        var toggleButton = '';
        if (window.APP_CONFIG && window.APP_CONFIG.userRole === 'main') {
            var toggleId = 'toggle-' + patient.id;
            toggleButton = 
                '<div class="ml-2 flex items-center">' +
                    '<span class="text-xs text-gray-500 mr-1">公開:</span>' +
                    '<label class="toggle-switch" for="' + toggleId + '">' +
                        '<input type="checkbox" id="' + toggleId + '" class="toggle-checkbox" ' +
                        (patient.isPublic ? 'checked' : '') + ' ' +
                        'data-visitor-id="' + patient.id + '">' +
                        '<span class="toggle-slider"></span>' +
                    '</label>' +
                '</div>';
        }
        
        patientElement.innerHTML = 
            '<input type="checkbox" class="patient-checkbox" ' +
            (isSelected ? 'checked' : '') + ' ' +
            (isDisabled ? 'disabled' : '') +
            ' data-patient-id="' + patient.id + '">' +
            '<div class="flex-1 cursor-pointer">' +
                '<div class="flex items-center justify-between">' +
                    '<div>' +
                        '<span class="font-medium">' + patient.name + '</span>' +
                        (patient.kana ? '<span class="text-xs text-gray-500 ml-1">(' + patient.kana + ')</span>' : '') +
                        (lastVisitText ? '<span class="text-xs text-gray-500 ml-2">' + lastVisitText + '</span>' : '') +
                        newText +
                        visibilityText +
                    '</div>' +
                    toggleButton +
                '</div>' +
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
        
        // トグルボタンのイベントリスナーを追加（本会員のみ）
        if (window.APP_CONFIG && window.APP_CONFIG.userRole === 'main') {
            var toggleCheckbox = patientElement.querySelector('.toggle-checkbox');
            if (toggleCheckbox) {
                toggleCheckbox.addEventListener('change', function(e) {
                    e.stopPropagation(); // 親要素のクリックイベントを防ぐ
                    var visitorId = this.getAttribute('data-visitor-id');
                    var isPublic = this.checked;
                    updateVisitorPublicStatus(visitorId, isPublic);
                });
            }
        }
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

/**
 * 来院者の公開設定を変更する
 */
async function updateVisitorPublicStatus(visitorId, isPublic) {
    try {
        // UI上でローディング状態を示す
        var toggleElement = document.querySelector('[data-visitor-id="' + visitorId + '"]');
        if (toggleElement) {
            toggleElement.disabled = true;
        }
        
        // APIを呼び出し
        const response = await fetch('/reserve/api-bridge.php?action=updateVisitorPublicStatus', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                visitor_id: visitorId,
                is_public: isPublic
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // アプリケーション状態を更新
            var patient = appState.allPatients.find(function(p) { return p.id === visitorId; });
            if (patient) {
                patient.isPublic = isPublic;
                patient.isVisible = isPublic;
            }
            
            // 成功メッセージを表示
            showStatusMessage(
                isPublic ? '来院者を公開に設定しました' : '来院者を非公開に設定しました',
                'success'
            );
            
            // リストを更新
            updatePatientsList();
            
        } else {
            // エラーの場合、チェックボックスを元に戻す
            if (toggleElement) {
                toggleElement.checked = !isPublic;
            }
            
            // 新しいAPI形式のエラーメッセージに対応
            var errorMessage = '';
            if (result.error) {
                errorMessage = result.error.message || '公開設定の変更に失敗しました';
            } else {
                errorMessage = result.message || '公開設定の変更に失敗しました';
            }
            
            showStatusMessage(errorMessage, 'error');
        }
        
    } catch (error) {
        console.error('Error updating visitor public status:', error);
        
        // エラーの場合、チェックボックスを元に戻す
        var toggleElement = document.querySelector('[data-visitor-id="' + visitorId + '"]');
        if (toggleElement) {
            toggleElement.checked = !isPublic;
        }
        
        showStatusMessage('システムエラーが発生しました', 'error');
    } finally {
        // ローディング状態を解除
        var toggleElement = document.querySelector('[data-visitor-id="' + visitorId + '"]');
        if (toggleElement) {
            toggleElement.disabled = false;
        }
    }
}

/**
 * ステータスメッセージを表示する
 */
function showStatusMessage(message, type) {
    // 既存のメッセージがあれば削除
    var existingMessage = document.getElementById('status-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    var bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    var icon = type === 'success' ? 
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>' :
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>';

    var statusDiv = document.createElement('div');
    statusDiv.id = 'status-message';
    statusDiv.className = 'fixed top-20 right-4 ' + bgColor + ' text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center';
    statusDiv.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            ${icon}
        </svg>
        <span>${message}</span>
    `;

    document.body.appendChild(statusDiv);

    // 3秒後に自動的に削除
    setTimeout(function() {
        statusDiv.remove();
    }, 3000);
}