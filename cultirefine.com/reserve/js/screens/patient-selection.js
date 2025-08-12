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
    
    // PHPで生成された患者アイテムにイベントを設定
    setupPatientItemEvents();

    // appStateから会社別来院者データを取得（GAS API経由）
    // appState.allPatientsは既にgas-api.jsのmapGasDataToAppStateで設定されている
    if (appState.allPatients && appState.allPatients.length > 0) {
        console.log('Loaded ' + appState.allPatients.length + ' visitors from appState (GAS API)');
        
        // 権限チェック：サブ会員の場合は公開設定がfalseの患者を除外
        if (appState.membershipInfo && appState.membershipInfo.memberType === 'sub') {
            appState.allPatients = appState.allPatients.filter(function(patient) {
                // is_publicがtrueまたは明示的に設定されていない場合のみ表示
                return patient.is_public === true || (patient.is_public !== false && typeof patient.is_public === 'undefined');
            });
            console.log('Filtered to ' + appState.allPatients.length + ' visible patients for sub member');
        }
    } else {
        // フォールバック：PHPから取得したデータを利用（旧方式）
        if (window.APP_CONFIG && window.APP_CONFIG.companyPatients) {
            appState.allPatients = window.APP_CONFIG.companyPatients.map(function(visitor) {
                return {
                    id: visitor.visitor_id,
                    name: visitor.name,
                    kana: visitor.kana,
                    gender: visitor.gender,
                    is_public: visitor.is_public,
                    lastVisit: visitor.last_visit || null,
                    isNew: visitor.is_new || false,
                    isVisible: visitor.is_public !== false, // 公開設定がfalseでない限りtrue
                    companyId: visitor.company_id,
                    member_type: visitor.member_type
                };
            });
            
            console.log('Loaded ' + appState.allPatients.length + ' visitors from PHP (fallback)');
            
            // 権限チェック：サブ会員の場合は公開設定がfalseの患者を除外
            if (window.APP_CONFIG.userRole === 'sub') {
                appState.allPatients = appState.allPatients.filter(function(patient) {
                    // is_publicがtrueまたは明示的に設定されていない場合のみ表示
                    return patient.is_public === true || (patient.is_public !== false && typeof patient.is_public === 'undefined');
                });
                console.log('Filtered to ' + appState.allPatients.length + ' visible patients for sub member');
            }
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
        
        // 選択された患者データの整合性をチェック
        console.log('[proceedBtn] Selected patients before validation:', selected);
        
        // 無効な患者データ（idが未定義）を除去
        var validSelected = selected.filter(function(patient) {
            if (!patient || !patient.id) {
                console.error('[proceedBtn] Invalid patient data found:', patient);
                return false;
            }
            return true;
        });
        
        if (validSelected.length !== selected.length) {
            console.warn('[proceedBtn] Removed invalid patients, updating selectedPatientsForBooking');
            appState.selectedPatientsForBooking = validSelected;
            selected = validSelected;
        }
        
        if (appState.isPairBookingMode && selected.length !== 2) {
            alert("ペア予約では、ちょうど2名の来院者を選択してください。");
            return;
        }
        if (!appState.isPairBookingMode && selected.length === 0) {
            alert("少なくとも1名の来院者を選択してください。");
            return;
        }

        // Initialize bookings with validation
        console.log('[proceedBtn] Creating bookings for patients:', selected);
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
    
    // PHPで生成されたHTMLがある場合は保持
    var isPhpGenerated = container.hasAttribute('data-php-generated');
    var hasPhpGeneratedContent = container.querySelector('.patient-item[data-patient-id]');
    var hasLoadingIndicator = container.querySelector('#loading-company-visitors');
    
    // デバッグ情報
    console.log('[updatePatientsList] 状態確認:', {
        isPhpGenerated: isPhpGenerated,
        hasPhpGeneratedContent: !!hasPhpGeneratedContent,
        hasLoadingIndicator: !!hasLoadingIndicator,
        isLoadingCompanyVisitors: window.isLoadingCompanyVisitors,
        companyPatientsEmpty: window.APP_CONFIG ? window.APP_CONFIG.isCompanyPatientsEmpty : 'unknown',
        allPatientsCount: appState.allPatients.length
    });
    
    // PHPで生成されたコンテンツがあり、かつローディング中でない場合
    // ただし、ローディング表示しかない場合はJavaScriptで再生成
    if ((isPhpGenerated || hasPhpGeneratedContent) && !window.isLoadingCompanyVisitors && !hasLoadingIndicator) {
        console.log('[updatePatientsList] PHP生成コンテンツを保持');
        
        // イベントリスナーを設定
        setupPatientItemEvents();
        return;
    }
    
    // ローディング表示のみでデータがある場合はJavaScriptで生成
    if (hasLoadingIndicator && appState.allPatients.length > 0 && !window.isLoadingCompanyVisitors) {
        console.log('[updatePatientsList] ローディング表示をJavaScript生成コンテンツに置き換え');
        // JavaScriptで生成するために続行
    } else if ((isPhpGenerated || hasPhpGeneratedContent || hasLoadingIndicator) && !window.isLoadingCompanyVisitors) {
        return;
    }
    
    // ローディング中でかつローディングインジケータがある場合も保持
    if (window.isLoadingCompanyVisitors && hasLoadingIndicator) {
        console.log('[updatePatientsList] ローディング中のためスキップ');
        return;
    }
    
    // JavaScriptでの更新が必要な場合のみクリア
    container.innerHTML = '';

    // ログインユーザーを最初に追加
    if (window.APP_CONFIG && window.APP_CONFIG.displayName) {
        var currentUser = {
            id: 'current-user',
            name: window.APP_CONFIG.displayName,
            kana: '',
            gender: '',
            isPublic: true,
            lastVisit: null,
            isNew: false,
            isVisible: true,
            isCurrentUser: true
        };
        
        // ログインユーザーが既に来院者リストにいないか確認
        // visitor_idがある場合はvisitor_idで、ない場合は名前で重複チェック
        var userExists = appState.allPatients.some(function(patient) {
            if (window.APP_CONFIG && window.APP_CONFIG.currentUserVisitorId && patient.id) {
                return patient.id === window.APP_CONFIG.currentUserVisitorId;
            }
            return patient.name === currentUser.name;
        });
        
        if (!userExists) {
            // ログインユーザーのカードを表示
            var userElement = createElement('div', 
                'patient-item flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-all border-gray-200 hover:bg-slate-50'
            );
            
            var isSelected = appState.selectedPatientsForBooking.some(function(p) { return p.id === currentUser.id; });
            if (isSelected) {
                userElement.classList.add('selected', 'bg-teal-50', 'border-teal-500');
                userElement.classList.remove('border-gray-200', 'hover:bg-slate-50');
            }
            
            var isDisabled = appState.isPairBookingMode && 
                              appState.selectedPatientsForBooking.length >= 2 && 
                              !isSelected;
            
            userElement.innerHTML = 
                '<input type="checkbox" class="patient-checkbox" ' +
                (isSelected ? 'checked' : '') + ' ' +
                (isDisabled ? 'disabled' : '') +
                ' data-patient-id="' + currentUser.id + '">' +
                '<div class="flex-1 cursor-pointer">' +
                    '<div class="flex items-center justify-between">' +
                        '<div>' +
                            '<span class="font-medium">' + currentUser.name + ' (ご本人)</span>' +
                            '<span class="text-xs text-teal-600 ml-2">ログイン中のユーザー</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            userElement.addEventListener('click', function() {
                var disabled = appState.isPairBookingMode && 
                              appState.selectedPatientsForBooking.length >= 2 && 
                              !appState.selectedPatientsForBooking.some(function(p) { return p.id === currentUser.id; });
                if (disabled) {
                    alert("ペア予約では2名まで選択できます。");
                } else {
                    togglePatientSelection(currentUser.id);
                }
            });
            
            container.appendChild(userElement);
            
            // 区切り線を追加
            if (appState.allPatients.length > 0) {
                var divider = document.createElement('hr');
                divider.className = 'my-3 border-gray-200';
                container.appendChild(divider);
            }
        }
    }

    // ローディング状態のチェック
    if (window.isLoadingCompanyVisitors) {
        var loadingState = document.createElement('div');
        loadingState.className = 'text-center py-8 text-gray-500';
        loadingState.innerHTML = 
            '<div class="text-4xl mb-4">⏳</div>' +
            '<p>会社別来院者データを取得しています。</p>' +
            '<p class="text-sm mt-2">しばらくお待ちください...</p>';
        container.appendChild(loadingState);
        return;
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
        
        // ダミーデータをスキップ（「既存～」などを含む名前）
        if (patient.name && (patient.name.includes('既存') || patient.name.includes('ダミー') || patient.name.includes('テスト'))) {
            console.log('Skipping dummy patient data:', patient.name);
            continue;
        }
        
        // サブ会員の場合、非公開の来院者はスキップ
        if (window.APP_CONFIG && window.APP_CONFIG.userRole === 'sub' && patient.is_public === false) {
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
        
        // 会員種別ラベルの表示
        var memberTypeText = '';
        if (patient.member_type === 'sub') {
            memberTypeText = '<span class="text-xs text-blue-600 ml-2">(サブ会員)</span>';
        } else if (patient.member_type === 'main') {
            memberTypeText = '<span class="text-xs text-green-600 ml-2">(本会員)</span>';
        }
        
        // 公開設定トグルボタンの表示制御
        var toggleButton = '';
        
        // デバッグ情報を出力
        console.log('[Toggle Debug] Patient:', patient.name, {
            'patient.id': patient.id,
            'patient.member_type': patient.member_type,
            'window.APP_CONFIG': window.APP_CONFIG,
            'APP_CONFIG.userRole': window.APP_CONFIG ? window.APP_CONFIG.userRole : 'undefined',
            'APP_CONFIG.currentUserVisitorId': window.APP_CONFIG ? window.APP_CONFIG.currentUserVisitorId : 'undefined'
        });
        
        // 表示条件：
        // 1. 現在のユーザーが本会員である
        // 2. 対象の患者が本会員ではない（本会員へのトグルボタンは表示しない）
        // 3. 対象の患者が現在のユーザー自身ではない
        var isCurrentUserMainMember = window.APP_CONFIG && window.APP_CONFIG.userRole === 'main';
        var isPatientMainMember = patient.member_type === 'main' || patient.member_type === '本会員';
        var isCurrentUser = patient.id === 'current-user' || 
                           (window.APP_CONFIG && window.APP_CONFIG.currentUserVisitorId && patient.id === window.APP_CONFIG.currentUserVisitorId);
        
        // デバッグ時は時的に簡素化（本会員のみ、サブ会員に表示）
        var shouldShowToggle = isCurrentUserMainMember && patient.member_type === 'sub';
        
        // 元の条件（コメントアウト）
        // var shouldShowToggle = isCurrentUserMainMember && !isPatientMainMember && !isCurrentUser;
        
        console.log('[Toggle Debug] Conditions:', {
            'isCurrentUserMainMember': isCurrentUserMainMember,
            'isPatientMainMember': isPatientMainMember,
            'isCurrentUser': isCurrentUser,
            'shouldShowToggle': shouldShowToggle
        });
        
        if (shouldShowToggle) {
            var toggleId = 'toggle-' + patient.id;
            var loadingId = 'loading-' + patient.id;
            toggleButton = 
                '<div class="ml-2 flex items-center">' +
                    '<span class="text-xs text-gray-500 mr-1">公開:</span>' +
                    '<div class="relative">' +
                        '<label class="toggle-switch" for="' + toggleId + '">' +
                            '<input type="checkbox" id="' + toggleId + '" class="toggle-checkbox" ' +
                            (patient.is_public ? 'checked' : '') + ' ' +
                            'data-visitor-id="' + patient.id + '" ' +
                            'data-patient-name="' + patient.name + '">' +
                            '<span class="toggle-slider"></span>' +
                        '</label>' +
                        '<span id="' + loadingId + '" class="hidden text-xs text-blue-600 ml-2 flex items-center">' +
                            '<svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
                                '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
                                '<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
                            '</svg>' +
                            '処理中...' +
                        '</span>' +
                    '</div>' +
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
                        memberTypeText +
                    '</div>' +
                    toggleButton +
                '</div>' +
            '</div>';

        // 親要素のクリックイベントを設定（トグルボタンがクリックされた場合はスキップ）
        patientElement.addEventListener('click', function(patientId) {
            return function(e) {
                // トグルボタンまたはその内部要素がクリックされた場合はスキップ
                if (e.target.closest('.toggle-switch')) {
                    return;
                }
                
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
        
        // トグルボタンのイベントリスナーを追加（表示されている場合のみ）
        if (shouldShowToggle) {
            var toggleCheckbox = patientElement.querySelector('.toggle-checkbox');
            if (toggleCheckbox) {
                toggleCheckbox.addEventListener('click', function(e) {
                    e.stopPropagation(); // 親要素のクリックイベントを防ぐ
                });
                
                toggleCheckbox.addEventListener('change', function(e) {
                    var visitorId = this.getAttribute('data-visitor-id');
                    var patientName = this.getAttribute('data-patient-name');
                    var isPublic = this.checked;
                    console.log('Toggle changed:', visitorId, isPublic); // デバッグ用
                    updateVisitorPublicStatus(visitorId, isPublic, patientName);
                });
            }
        }
    }
}

export function togglePatientSelection(patientId) {
    console.log('[togglePatientSelection] Called with patientId:', patientId);
    console.log('[togglePatientSelection] Current selectedPatientsForBooking:', appState.selectedPatientsForBooking);
    console.log('[togglePatientSelection] All patients count:', appState.allPatients.length);
    
    var patient;
    
    // ログインユーザーの場合
    if (patientId === 'current-user') {
        patient = {
            id: 'current-user',
            name: window.APP_CONFIG.displayName,
            kana: '',
            gender: '',
            isPublic: true,
            lastVisit: null,
            isNew: false,
            isVisible: true,
            isCurrentUser: true
        };
    } else {
        patient = appState.allPatients.find(function(p) { return p.id === patientId; });
        
        // 患者が見つからない場合のログ
        if (!patient) {
            console.error('[togglePatientSelection] Patient not found in allPatients for ID:', patientId);
            console.log('[togglePatientSelection] Available patients:', appState.allPatients.map(p => ({id: p.id, name: p.name})));
            
            // PHP生成のHTMLから患者情報を取得して追加
            var patientElement = document.querySelector('.patient-item[data-patient-id="' + patientId + '"]');
            if (patientElement) {
                var nameElement = patientElement.querySelector('.font-medium');
                if (nameElement) {
                    patient = {
                        id: patientId,
                        name: nameElement.textContent,
                        kana: '',
                        gender: '',
                        is_public: true,
                        lastVisit: null,
                        isNew: false,
                        isVisible: true,
                        member_type: patientElement.textContent.includes('(本会員)') ? 'main' : 'sub'
                    };
                    console.log('[togglePatientSelection] Created patient from DOM:', patient);
                    appState.allPatients.push(patient);
                }
            }
        }
    }
    
    // 患者オブジェクトの検証
    if (!patient) {
        console.error('[togglePatientSelection] Patient is undefined for ID:', patientId);
        return;
    }
    
    if (!patient.id) {
        console.error('[togglePatientSelection] Patient object has no ID:', patient);
        return;
    }
    
    console.log('[togglePatientSelection] Using patient:', patient);
    
    var isSelected = appState.selectedPatientsForBooking.some(function(p) { return p.id === patientId; });

    if (isSelected) {
        console.log('[togglePatientSelection] Removing patient from selection:', patientId);
        appState.selectedPatientsForBooking = appState.selectedPatientsForBooking.filter(function(p) { return p.id !== patientId; });
    } else {
        if (appState.isPairBookingMode && appState.selectedPatientsForBooking.length >= 2) {
            alert("ペア予約では2名まで選択できます。");
            return;
        }
        console.log('[togglePatientSelection] Adding patient to selection:', patient);
        appState.selectedPatientsForBooking.push(patient);
    }

    console.log('[togglePatientSelection] Final selectedPatientsForBooking:', appState.selectedPatientsForBooking);
    console.log('[togglePatientSelection] Total selected count:', appState.selectedPatientsForBooking.length);

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
async function updateVisitorPublicStatus(visitorId, isPublic, patientName = '') {
    try {
        // UI上でローディング状態を示す
        var toggleElement = document.querySelector('[data-visitor-id="' + visitorId + '"]');
        var loadingElement = document.getElementById('loading-' + visitorId);
        
        if (toggleElement) {
            toggleElement.disabled = true;
        }
        
        if (loadingElement) {
            // 具体的なローディングメッセージを表示
            var actionText = isPublic ? '公開にしています' : '非公開にしています';
            var displayName = patientName || '患者';
            loadingElement.innerHTML = 
                '<svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
                    '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
                    '<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
                '</svg>' +
                displayName + 'の公開設定を' + actionText + '。';
            loadingElement.classList.remove('hidden');
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
            var displayName = patientName || '患者';
            var successMessage = isPublic ? 
                displayName + 'の公開設定を公開に変更しました' : 
                displayName + 'の公開設定を非公開に変更しました';
            showStatusMessage(successMessage, 'success');
            
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
        var loadingElement = document.getElementById('loading-' + visitorId);
        
        if (toggleElement) {
            toggleElement.disabled = false;
        }
        
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    }
}

/**
 * PHPで生成された患者アイテムにイベントを設定
 */
function setupPatientItemEvents() {
    console.log('[setupPatientItemEvents] 開始');
    
    // 全ての患者アイテムを取得
    var patientItems = document.querySelectorAll('.patient-item[data-patient-id]');
    console.log('[setupPatientItemEvents] 患者アイテム数:', patientItems.length);
    
    patientItems.forEach(function(item) {
        var patientId = item.getAttribute('data-patient-id');
        var checkbox = item.querySelector('.patient-checkbox');
        
        // visitor_idが正しく取得されているかチェック
        if (!patientId) {
            console.error('[setupPatientItemEvents] patientId is undefined for item:', item);
            return; // この患者アイテムをスキップ
        }
        
        console.log('[setupPatientItemEvents] Processing patient ID:', patientId);
        
        if (!item.hasAttribute('data-event-attached')) {
            item.setAttribute('data-event-attached', 'true');
            
            // アイテム全体のクリックイベント
            item.addEventListener('click', function(e) {
                // トグルボタンやチェックボックス自体がクリックされた場合はスキップ
                if (e.target.closest('.toggle-switch') || e.target.classList.contains('patient-checkbox')) {
                    return;
                }
                
                console.log('[Patient Click] ID:', patientId);
                
                // 患者データを構築
                var patientData = {
                    id: patientId,
                    name: item.querySelector('.font-medium').textContent,
                    kana: '',
                    gender: '',
                    is_public: true,
                    lastVisit: null,
                    isNew: false,
                    isVisible: true,
                    member_type: ''
                };
                
                // member_typeを判定
                if (item.textContent.includes('(本会員)')) {
                    patientData.member_type = 'main';
                } else if (item.textContent.includes('(サブ会員)')) {
                    patientData.member_type = 'sub';
                }
                
                // appState.allPatientsに追加または更新
                var existingPatient = appState.allPatients.find(p => p.id === patientId);
                if (!existingPatient) {
                    console.log('[setupPatientItemEvents] Adding patient to allPatients:', patientData);
                    appState.allPatients.push(patientData);
                } else {
                    // 既存のデータを使用
                    console.log('[setupPatientItemEvents] Using existing patient data:', existingPatient);
                    patientData = existingPatient;
                }
                
                // ペアモードの制限チェック
                var disabled = appState.isPairBookingMode && 
                              appState.selectedPatientsForBooking.length >= 2 && 
                              !appState.selectedPatientsForBooking.some(function(p) { return p.id === patientId; });
                
                if (disabled) {
                    alert("ペア予約では2名まで選択できます。");
                } else {
                    togglePatientSelection(patientId);
                    
                    // チェックボックスの状態を更新
                    if (checkbox) {
                        var isSelected = appState.selectedPatientsForBooking.some(p => p.id === patientId);
                        checkbox.checked = isSelected;
                    }
                    
                    // UIの更新
                    updatePatientItemUI(item, patientId);
                }
            });
            
            // チェックボックスの変更イベント
            if (checkbox) {
                checkbox.addEventListener('change', function(e) {
                    e.stopPropagation();
                    console.log('[Checkbox Change] ID:', patientId);
                    togglePatientSelection(patientId);
                    updatePatientItemUI(item, patientId);
                });
            }
        }
    });
    
    // トグルボタンのイベントも設定
    attachToggleEventListeners();
}

/**
 * 患者アイテムのUIを更新
 */
function updatePatientItemUI(item, patientId) {
    // visitor_idとselectedPatientsForBookingの整合性をチェック
    if (!patientId) {
        console.error('[updatePatientItemUI] patientId is undefined');
        return;
    }
    
    // 選択済み患者リストの各患者にidがあることを確認
    console.log('[updatePatientItemUI] Checking selected patients for patient ID:', patientId);
    console.log('[updatePatientItemUI] Selected patients:', appState.selectedPatientsForBooking);
    
    var invalidPatients = appState.selectedPatientsForBooking.filter(p => !p || !p.id);
    if (invalidPatients.length > 0) {
        console.error('[updatePatientItemUI] Found patients without ID:', invalidPatients);
        // 無効な患者データを除去
        appState.selectedPatientsForBooking = appState.selectedPatientsForBooking.filter(p => p && p.id);
    }
    
    var isSelected = appState.selectedPatientsForBooking.some(p => p.id === patientId);
    
    if (isSelected) {
        item.classList.add('selected', 'bg-teal-50', 'border-teal-500');
        item.classList.remove('border-gray-200', 'hover:bg-slate-50');
    } else {
        item.classList.remove('selected', 'bg-teal-50', 'border-teal-500');
        item.classList.add('border-gray-200', 'hover:bg-slate-50');
    }
    
    updateProceedButton();
}

/**
 * トグルボタンのイベントリスナーを設定
 */
function attachToggleEventListeners() {
    // PHPで生成されたトグルボタンにイベントリスナーが設定されているか確認
    var toggleCheckboxes = document.querySelectorAll('.toggle-checkbox');
    
    toggleCheckboxes.forEach(function(checkbox) {
        // 既にイベントリスナーが設定されているか確認
        if (!checkbox.hasAttribute('data-listener-attached')) {
            checkbox.setAttribute('data-listener-attached', 'true');
            
            checkbox.addEventListener('click', function(e) {
                e.stopPropagation(); // 親要素のクリックイベントを防ぐ
            });
            
            checkbox.addEventListener('change', function(e) {
                var visitorId = this.getAttribute('data-visitor-id');
                var patientName = this.getAttribute('data-patient-name');
                var isPublic = this.checked;
                console.log('Toggle changed:', visitorId, isPublic); // デバッグ用
                updateVisitorPublicStatus(visitorId, isPublic, patientName);
            });
        }
    });
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
