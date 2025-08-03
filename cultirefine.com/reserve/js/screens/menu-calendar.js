// screens/menu-calendar.js
// メニュー・カレンダー画面モジュール（個別予約）

import { appState } from '../core/app-state.js';
import { Calendar, calendars } from '../components/calendar.js';
import { createTreatmentAccordion } from '../components/treatment-accordion.js';
import { showAlert, hideAlert, createElement } from '../core/ui-helpers.js';
import { mockCheckTreatmentInterval, mockCheckSlotAvailability, getPatientMenus, getAvailableSlots } from '../data/gas-api.js';
import { formatDateKey } from '../data/treatment-data.js';
import { loadPatientMenus } from '../components/patient-menu-loader.js';

export function initMenuCalendarScreen() {
    console.log('initMenuCalendarScreen called');
    
    var backBtn = document.getElementById('back-to-patients-btn');
    var nextBtn = document.getElementById('next-menu-calendar-btn');
    var pairRoomSwitch = document.getElementById('pair-room-switch');

    // 必須要素のチェック（pairRoomSwitchは除外）
    if (!backBtn || !nextBtn) {
        console.warn('Required menu calendar screen elements not found:', {
            backBtn: !!backBtn,
            nextBtn: !!nextBtn,
            pairRoomSwitch: !!pairRoomSwitch
        });
        return;
    }
    
    console.log('Menu calendar screen initialization continuing with:', {
        backBtn: true,
        nextBtn: true,
        pairRoomSwitch: !!pairRoomSwitch
    });

    backBtn.addEventListener('click', function() {
        if (appState.currentPatientIndexForBooking > 0) {
            appState.currentPatientIndexForBooking--;
            updateMenuCalendarScreen();
        } else {
            appState.setScreen('patient-selection');
        }
    });

    nextBtn.addEventListener('click', function() {
        var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
        var treatments = appState.selectedTreatments[currentPatient.id] || [];
        var date = appState.selectedDates[currentPatient.id];
        var times = appState.selectedTimes[currentPatient.id];

        if (treatments.length === 0 || !date || !times) {
            alert("メニュー、日付、時間を選択してください。");
            return;
        }

        // 複数メニュー対応: booking情報を更新
        if (treatments.length === 1) {
            // 単一メニュー（後方互換性）
            const selectedTime = typeof times === 'string' ? times : times[treatments[0].id];
            appState.bookings[appState.currentPatientIndexForBooking] = Object.assign(
                appState.bookings[appState.currentPatientIndexForBooking] || {},
                {
                    treatment: treatments[0],
                    selectedDate: date,
                    selectedTime: selectedTime,
                    pairRoomDesired: appState.pairRoomDesired[currentPatient.id] || false
                }
            );
        } else {
            // 複数メニュー
            appState.bookings[appState.currentPatientIndexForBooking] = {
                patientId: currentPatient.id,
                patientName: currentPatient.name,
                treatments: treatments,
                selectedDate: date,
                selectedTimes: times,
                pairRoomDesired: appState.pairRoomDesired[currentPatient.id] || false
            };
        }

        if (appState.currentPatientIndexForBooking < appState.selectedPatientsForBooking.length - 1) {
            appState.currentPatientIndexForBooking++;
            updateMenuCalendarScreen();
        } else {
            // Save data and go to confirmation page
            appState.saveToStorage();
            window.location.href = 'confirmation.html';
        }
    });

    // pairRoomSwitchは存在する場合のみイベントリスナーを登録
    if (pairRoomSwitch) {
        pairRoomSwitch.addEventListener('change', function(e) {
            var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
            appState.pairRoomDesired[currentPatient.id] = e.target.checked;
            // Re-check time slots when pair room preference changes
            var date = appState.selectedDates[currentPatient.id];
            if (date) {
                checkAndUpdateTimeSlots(currentPatient.id, date);
            }
        });
    } else {
        console.log('pairRoomSwitch not found, skipping pair room functionality');
    }

    console.log('Calling updateMenuCalendarScreen from initMenuCalendarScreen');
    updateMenuCalendarScreen();
}

export async function updateMenuCalendarScreen() {
    console.log('updateMenuCalendarScreen called');
    console.log('Selected patients:', appState.selectedPatientsForBooking);
    console.log('Current patient index:', appState.currentPatientIndexForBooking);
    
    var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
    
    if (!currentPatient) {
        console.error('No current patient found at index:', appState.currentPatientIndexForBooking);
        return;
    }
    
    console.log('Current patient:', currentPatient);
    
    var description = document.getElementById('menu-calendar-description');
    var backButtonText = document.getElementById('back-button-text');
    var nextButtonText = document.getElementById('next-button-text');

    if (!description || !backButtonText || !nextButtonText) {
        console.error('Required UI elements not found:', {
            description: !!description,
            backButtonText: !!backButtonText,
            nextButtonText: !!nextButtonText
        });
        return;
    }

    description.innerHTML = 
        '<span>👤</span> ' + currentPatient.name + '様 ' +
        '(' + (appState.currentPatientIndexForBooking + 1) + '/' + appState.selectedPatientsForBooking.length + '人目) の予約';

    backButtonText.textContent = appState.currentPatientIndexForBooking === 0 
        ? "来院者選択へ戻る" 
        : "前の来院者へ";

    nextButtonText.textContent = appState.currentPatientIndexForBooking < appState.selectedPatientsForBooking.length - 1
        ? "次の来院者の予約へ"
        : "予約内容の確認へ";

    // 患者別メニューを取得して表示
    // current-userの場合は実際のvisitor_idを使用
    const actualPatientId = currentPatient.id === 'current-user' 
        ? (window.APP_CONFIG?.currentUserVisitorId || currentPatient.id)
        : currentPatient.id;
    
    console.log('Menu-calendar: Getting menus for patient:', currentPatient.name, 'ID:', actualPatientId);
    await displayPatientMenus(actualPatientId);
    
    // Initialize calendar - always create a fresh instance for each patient
    calendars['calendar'] = new Calendar('calendar', function(date) {
        selectDate(currentPatient.id, date);
    }, {
        showAvailability: true,
        onMonthChange: function(newDate) {
            console.log('[Calendar] Month changed to:', newDate);
            // 月が変更された時に空き情報を再取得
            var actualPatientId = currentPatient.id === 'current-user' 
                ? (window.APP_CONFIG?.currentUserVisitorId || currentPatient.id)
                : currentPatient.id;
            var selectedMenus = appState.selectedTreatments[currentPatient.id] || [];
            console.log('[Calendar] Month change - patientId:', actualPatientId, 'selectedMenus:', selectedMenus.length);
            if (selectedMenus.length > 0) {
                loadCalendarAvailability(actualPatientId, selectedMenus);
            }
        }
    });
    
    // 選択されたメニューがある場合は空き情報を取得
    var selectedMenus = appState.selectedTreatments[currentPatient.id] || [];
    if (selectedMenus.length > 0) {
        await loadCalendarAvailability(actualPatientId, selectedMenus);
    }
    
    // Restore selections
    var date = appState.selectedDates[currentPatient.id];
    var time = appState.selectedTimes[currentPatient.id];
    var pairRoom = appState.pairRoomDesired[currentPatient.id];

    console.log('Restoring selections for patient:', currentPatient.name);
    console.log('Selected menus:', selectedMenus);
    console.log('Date:', date);
    console.log('Time:', time);

    // Reset pair room switch
    var pairRoomSwitch = document.getElementById('pair-room-switch');
    if (pairRoomSwitch) {
        pairRoomSwitch.checked = !!pairRoom;
    }

    // Restore treatment selection
    if (selectedMenus && selectedMenus.length > 0) {
        setTimeout(function() {
            // 複数メニュー対応: 選択済みメニューをハイライト
            highlightSelectedMenus(currentPatient.id);
            updateSelectedMenusDisplay(currentPatient.id);
        }, 200);
    }
    
    // Restore date selection
    if (date) {
        calendars['calendar'].setSelectedDate(date);
        setTimeout(function() {
            checkAndUpdateTimeSlots(currentPatient.id, date);
        }, 300);
    }
    
    // Initial button state update
    setTimeout(function() {
        updateNextButtonState();
    }, 400);
}

export function selectTreatmentProgrammatically(patientId, treatment) {
    appState.selectedTreatments[patientId] = treatment;
    
    // Find and mark the correct treatment as selected
    var treatmentItems = document.querySelectorAll('.treatment-item');
    for (var i = 0; i < treatmentItems.length; i++) {
        var item = treatmentItems[i];
        var radio = item.querySelector('input[type="radio"]');
        if (radio && radio.value === treatment.id) {
            item.classList.add('selected');
            radio.checked = true;
        } else {
            item.classList.remove('selected');
            if (radio) radio.checked = false;
        }
    }

    // Show date-time selection section
    var dateTimeSection = document.getElementById('date-time-selection');
    if (dateTimeSection) {
        dateTimeSection.classList.remove('hidden');
    }
    
    hideAlert('interval-error');
    updateNextButtonState();
}

export function selectDate(patientId, date) {
    console.log('[SelectDate] Called for patient:', patientId, 'date:', date);
    appState.selectedDates[patientId] = date;
    appState.selectedTimes[patientId] = null; // Reset time selection
    
    // 日付が選択されたことを明示的に表示
    const dateString = date ? date.toISOString().split('T')[0] : 'no date';
    console.log('[SelectDate] Date saved as:', dateString, 'for patient:', patientId);
    
    checkAndUpdateTimeSlots(patientId, date).then(function() {
        console.log('[SelectDate] Time slots updated, updating button state');
        updateNextButtonState();
    }).catch(function(error) {
        console.error('[SelectDate] Error updating time slots:', error);
    });
}

export function checkAndUpdateTimeSlots(patientId, date) {
    console.log('[CheckTimeSlots] ========== START ==========');
    console.log('[CheckTimeSlots] Called for patient:', patientId, 'date:', date);
    console.log('[CheckTimeSlots] All keys in selectedTreatments:', Object.keys(appState.selectedTreatments));
    console.log('[CheckTimeSlots] Full appState.selectedTreatments:', JSON.stringify(appState.selectedTreatments));
    
    // 複数メニュー対応
    var selectedMenus = appState.selectedTreatments[patientId] || [];
    var pairRoom = appState.pairRoomDesired[patientId] || false;
    
    console.log('[CheckTimeSlots] Selected menus for', patientId, ':', selectedMenus.length, 'pairRoom:', pairRoom);
    if (selectedMenus.length > 0) {
        console.log('[CheckTimeSlots] Menu details:', selectedMenus.map(m => ({ id: m.id, name: m.name })));
    }
    
    if (selectedMenus.length === 0 || !date) {
        console.log('[CheckTimeSlots] Missing menus or date, returning early');
        
        // メニューが選択されていない場合のメッセージ表示
        if (selectedMenus.length === 0 && date) {
            showAlert('slot-availability-message', 'warning', 
                     'メニュー未選択', 
                     'まず施術メニューを選択してください。');
        }
        
        // 時間スロットを非表示
        var timeSlotsContainer = document.getElementById('time-slots');
        if (timeSlotsContainer) {
            timeSlotsContainer.classList.add('hidden');
        }
        
        return Promise.resolve();
    }

    var dateKey = formatDateKey(date);
    console.log('[CheckTimeSlots] Date key:', dateKey);
    
    // 最初のメニューで空き確認（5分間隔）
    const firstMenu = selectedMenus[0];
    console.log('[CheckTimeSlots] Checking availability for menu:', firstMenu.name || firstMenu.id);
    
    return mockCheckSlotAvailability(firstMenu.id, dateKey, pairRoom, 5).then(function(slotsResult) {
        console.log('[CheckTimeSlots] Slots result:', slotsResult);
        // Show availability message
        if (slotsResult.message) {
            var alertType = slotsResult.availableTimes.length > 0 ? 'info' : 'warning';
            showAlert('slot-availability-message', alertType, 
                     slotsResult.availableTimes.length > 0 ? '予約可能な時間' : '空き状況', 
                     slotsResult.message);
        } else {
            hideAlert('slot-availability-message');
        }

        // Update time slots
        var timeSlotsContainer = document.getElementById('time-slots');
        if (!timeSlotsContainer) {
            console.error('[CheckTimeSlots] time-slots container not found!');
            return;
        }
        
        console.log('[CheckTimeSlots] Updating time slots container, available times:', slotsResult.availableTimes.length);
        timeSlotsContainer.innerHTML = '';
        
        if (slotsResult.availableTimes.length > 0) {
            if (selectedMenus.length > 1) {
                // 複数メニューの場合
                selectedMenus.forEach((menu, index) => {
                    const menuSection = createElement('div', 'mb-4');
                    menuSection.innerHTML = `<h4 class="font-medium mb-2">${menu.name} (${menu.duration}分)</h4>`;
                    const menuSlotsGrid = createElement('div', 'grid grid-cols-3 sm:grid-cols-4 gap-2');
                    
                    slotsResult.availableTimes.forEach(time => {
                        const endTime = addMinutes(time, menu.duration);
                        const timeSlot = createElement('button', 
                            'time-slot px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-teal-50 cursor-pointer text-center text-sm transition-all'
                        );
                        timeSlot.innerHTML = `<div>${time}</div><div class="text-xs opacity-75">〜${endTime}</div>`;
                        timeSlot.dataset.menuId = menu.id;
                        timeSlot.onclick = (function(time, menuId) {
                            return function(event) {
                                selectTimeSlot(patientId, time);
                            };
                        })(time, menu.id);
                        menuSlotsGrid.appendChild(timeSlot);
                    });
                    
                    menuSection.appendChild(menuSlotsGrid);
                    timeSlotsContainer.appendChild(menuSection);
                });
            } else {
                // 単一メニューの場合
                const menu = selectedMenus[0];
                for (var i = 0; i < slotsResult.availableTimes.length; i++) {
                    var time = slotsResult.availableTimes[i];
                    const endTime = addMinutes(time, menu.duration);
                    var timeSlot = createElement('button', 
                        'time-slot px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-teal-50 cursor-pointer text-center text-sm transition-all'
                    );
                    timeSlot.innerHTML = `<div>${time}</div><div class="text-xs opacity-75">〜${endTime}</div>`;
                    timeSlot.onclick = (function(time) {
                        return function() {
                            selectTimeSlot(patientId, time);
                        };
                    })(time);
                    timeSlotsContainer.appendChild(timeSlot);
                }
            }
            timeSlotsContainer.classList.remove('hidden');
            console.log('[CheckTimeSlots] Time slots container shown with', slotsResult.availableTimes.length, 'time slots');
        } else {
            timeSlotsContainer.classList.add('hidden');
            console.log('[CheckTimeSlots] No available times, hiding time slots container');
        }
        console.log('[CheckTimeSlots] ========== END ==========');
    }).catch(function(error) {
        console.error('[CheckTimeSlots] Error in slot availability check:', error);
        console.log('[CheckTimeSlots] ========== END (ERROR) ==========');
    });
}

/**
 * 時間に分を加算
 */
function addMinutes(timeStr, minutes) {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60);
    const newMins = totalMins % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * 患者別メニューを表示
 */
async function displayPatientMenus(patientId) {
    const container = document.getElementById('treatment-categories');
    if (!container) return;
    
    // current-userの場合は実際のvisitor_idを使用
    const actualPatientId = patientId === 'current-user' 
        ? (window.APP_CONFIG?.currentUserVisitorId || patientId)
        : patientId;
    
    console.log('displayPatientMenus: patientId =', patientId, ', actualPatientId =', actualPatientId);
    
    // ローディング表示
    container.innerHTML = '<div class="text-center py-4">メニューを読み込んでいます...</div>';
    
    // メニュー選択時のコールバック
    const onMenuSelect = (menu, menuPatientId, isChecked) => {
        console.log('[MenuSelect] ========== START ==========');
        console.log('[MenuSelect] Menu:', menu.name || menu.id, 'Patient ID from menu:', menuPatientId, 'isChecked:', isChecked);
        console.log('[MenuSelect] Current patient:', currentPatient.name, 'ID:', currentPatient.id);
        console.log('[MenuSelect] actualPatientId:', actualPatientId);
        
        // current-userの場合はactualPatientIdを使用する
        const statePatientId = currentPatient.id; // 状態管理には常にcurrent-userを使用
        
        console.log('[MenuSelect] State patient ID to use:', statePatientId);
        console.log('[MenuSelect] Current appState.selectedTreatments:', Object.keys(appState.selectedTreatments));
        
        // 選択されたメニューを配列に追加
        if (!appState.selectedTreatments[statePatientId]) {
            appState.selectedTreatments[statePatientId] = [];
            console.log('[MenuSelect] Created new selectedTreatments array for:', statePatientId);
        }
        if (!appState.selectedMenuIds[statePatientId]) {
            appState.selectedMenuIds[statePatientId] = [];
        }
        
        if (isChecked) {
            // チェックされた場合は追加
            const exists = appState.selectedTreatments[statePatientId].some(t => t.id === menu.id);
            if (!exists) {
                appState.selectedTreatments[statePatientId].push(menu);
                appState.selectedMenuIds[statePatientId].push(menu.id);
                console.log('[MenuSelect] Added menu to state. Total menus:', appState.selectedTreatments[statePatientId].length);
            }
        } else {
            // チェック解除された場合は削除
            appState.selectedTreatments[statePatientId] = appState.selectedTreatments[statePatientId].filter(t => t.id !== menu.id);
            appState.selectedMenuIds[statePatientId] = appState.selectedMenuIds[statePatientId].filter(id => id !== menu.id);
            console.log('[MenuSelect] Removed menu from state. Total menus:', appState.selectedTreatments[statePatientId].length);
        }
        
        updateSelectedMenusDisplay(statePatientId);
        updateNextButtonState();
        
        // メニューが選択されたらカレンダーの空き情報を更新
        if (appState.selectedTreatments[statePatientId].length > 0) {
            // APIにはactualPatientIdを使用
            loadCalendarAvailability(actualPatientId, appState.selectedTreatments[statePatientId]);
        }
        
        console.log('[MenuSelect] Final state:', {
            statePatientId: statePatientId,
            selectedMenus: appState.selectedTreatments[statePatientId]?.length || 0,
            menuIds: appState.selectedMenuIds[statePatientId] || []
        });
        console.log('[MenuSelect] ========== END ==========');
    };
    
    // 会社IDを取得
    const companyId = appState.membershipInfo?.companyId || window.APP_CONFIG?.companyInfo?.companyId || null;
    
    // 患者別メニューをロード（実際のpatientIdを使用）
    await loadPatientMenus('treatment-categories', actualPatientId, companyId, onMenuSelect);
    
    // 選択済みメニューをハイライト
    highlightSelectedMenus(patientId);
}

/**
 * 選択されたメニューの表示を更新
 */
function updateSelectedMenusDisplay(patientId) {
    const selectedMenus = appState.selectedTreatments[patientId] || [];
    const totalDuration = selectedMenus.reduce((sum, menu) => sum + (menu.duration_minutes || menu.duration || 0), 0);
    const totalPrice = selectedMenus.reduce((sum, menu) => sum + (menu.price || 0), 0);
    
    // 選択メニュー表示エリアを更新
    const selectedMenusDisplay = document.getElementById('selected-menus-display');
    if (selectedMenusDisplay) {
        if (selectedMenus.length > 0) {
            selectedMenusDisplay.classList.remove('hidden');
            const menuList = selectedMenus.map(menu => 
                `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-teal-100 text-teal-800">
                    ${menu.name || menu.menu_name}
                    <button onclick="removeSelectedMenu('${patientId}', '${menu.id}')" class="ml-2 text-teal-600 hover:text-teal-800">
                        ×
                    </button>
                </span>`
            ).join(' ');
            
            selectedMenusDisplay.innerHTML = `
                <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <h4 class="text-sm font-semibold text-blue-800 mb-2">選択中のメニュー</h4>
                    <div class="flex flex-wrap gap-2 mb-2">${menuList}</div>
                    <p class="text-sm text-blue-700">
                        合計: ${selectedMenus.length}件 / ${totalDuration}分 / ￥${totalPrice.toLocaleString()}
                    </p>
                </div>
            `;
        } else {
            selectedMenusDisplay.classList.add('hidden');
        }
    }
    
    // エラー表示エリアを非表示に（エラー用に確保）
    const intervalError = document.getElementById('interval-error');
    if (intervalError) {
        intervalError.classList.add('hidden');
    }
    
    // 日付・時間選択セクションの表示
    const dateTimeSection = document.getElementById('date-time-selection');
    if (selectedMenus.length > 0) {
        dateTimeSection.classList.remove('hidden');
    } else {
        dateTimeSection.classList.add('hidden');
    }
}

/**
 * 選択済みメニューをハイライト
 */
function highlightSelectedMenus(patientId) {
    const selectedMenuIds = appState.selectedMenuIds[patientId] || [];
    selectedMenuIds.forEach(menuId => {
        const menuElement = document.querySelector(`[data-menu-id="${menuId}"]`);
        if (menuElement) {
            menuElement.classList.add('selected', 'bg-blue-100', 'border-blue-500');
        }
    });
}

export function selectTimeSlot(patientId, time) {
    console.log('selectTimeSlot called for patient:', patientId, 'time:', time);
    
    // 複数メニュー対応: 現在選択中のメニューIDを取得
    const currentMenuId = event.currentTarget?.dataset?.menuId;
    
    if (!appState.selectedTimes[patientId]) {
        appState.selectedTimes[patientId] = {};
    }
    
    if (currentMenuId) {
        appState.selectedTimes[patientId][currentMenuId] = time;
    } else {
        // 後方互換性のため、単一の時間も保存
        appState.selectedTimes[patientId] = time;
    }
    
    // Update UI
    var timeSlots = document.querySelectorAll('.time-slot');
    for (var i = 0; i < timeSlots.length; i++) {
        timeSlots[i].classList.remove('selected', 'bg-teal-600', 'text-white');
        timeSlots[i].classList.add('bg-white', 'hover:bg-teal-50');
    }
    
    // Find clicked element and mark as selected
    var clickedElement = event && event.currentTarget ? event.currentTarget : null;
    if (clickedElement) {
        clickedElement.classList.add('selected', 'bg-teal-600', 'text-white');
        clickedElement.classList.remove('bg-white', 'hover:bg-teal-50');
    }
    
    // Force update button state after time selection
    setTimeout(function() {
        updateNextButtonState();
    }, 50);
}

export function updateNextButtonState() {
    var nextBtn = document.getElementById('next-menu-calendar-btn');
    if (!nextBtn) return;
    
    var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
    if (!currentPatient) return;
    
    // 複数メニュー対応
    const selectedMenus = appState.selectedTreatments[currentPatient.id] || [];
    const selectedDate = appState.selectedDates[currentPatient.id];
    const selectedTimes = appState.selectedTimes[currentPatient.id];
    
    let hasAllRequired = false;
    
    if (selectedMenus.length > 0 && selectedDate) {
        if (typeof selectedTimes === 'string') {
            // 後方互換性: 単一の時間が選択されている
            hasAllRequired = true;
        } else if (typeof selectedTimes === 'object' && selectedTimes !== null) {
            // 複数メニュー: すべてのメニューに時間が選択されているか確認
            const allMenusHaveTime = selectedMenus.every(menu => selectedTimes[menu.id]);
            hasAllRequired = allMenusHaveTime;
        }
    }
    
    console.log('UpdateNextButtonState for patient:', currentPatient.name, 'hasAllRequired:', hasAllRequired);
    console.log('Treatments:', selectedMenus);
    console.log('Date:', selectedDate);
    console.log('Times:', selectedTimes);
    
    nextBtn.disabled = !hasAllRequired;
    
    // ボタンのテキストを更新
    if (hasAllRequired) {
        nextBtn.innerHTML = '予約内容を確認する <span class="ml-2">➡️</span>';
    } else {
        nextBtn.innerHTML = '予約内容の確認へ <span class="ml-2">➡️</span>';
    }
}

// カレンダーの空き情報を読み込む
async function loadCalendarAvailability(patientId, selectedMenus) {
    const calendar = calendars['calendar'];
    if (!calendar) return;
    
    console.log('[LoadCalendarAvailability] Called with patientId:', patientId, 'selectedMenus:', selectedMenus);
    
    // ローディング表示
    const calendarLoadingMsg = document.getElementById('calendar-loading-message');
    if (calendarLoadingMsg) {
        calendarLoadingMsg.classList.remove('hidden');
        calendarLoadingMsg.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p class="text-sm text-blue-700 flex items-center">
                    <svg class="animate-spin h-4 w-4 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    空き情報を取得しています...
                </p>
            </div>
        `;
    }
    
    // ローディング状態を設定
    calendar.setLoading(true);
    
    try {
        // カレンダーの現在表示されている月の初日を取得
        const calendarMonth = calendar.currentDate;
        const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        
        // 今日の日付を取得
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 開始日は月の初日と今日の遅い方を使用
        const startDate = monthStart > today ? monthStart : today;
        const dateKey = calendar.formatDateKey(startDate);
        
        console.log('[LoadCalendarAvailability] Start date:', dateKey, 'Calendar month:', calendarMonth.toISOString());
        
        // 複数メニューの場合、メニューIDの配列と合計時間を準備
        const menuIds = selectedMenus.map(menu => menu.id || menu.menu_id);
        const totalDuration = selectedMenus.reduce((sum, menu) => sum + (menu.duration_minutes || menu.duration || 0), 0);
        
        console.log('[LoadCalendarAvailability] Menu IDs:', menuIds, 'Total duration:', totalDuration);
        
        // API呼び出し（複数メニュー対応）
        const result = await getAvailableSlots(patientId, menuIds, dateKey, 30, {
            pairBooking: false,
            allowMultipleSameDay: false,
            totalDuration: totalDuration
        });
        
        if (result.success && result.data) {
            const data = result.data;
            
            // カレンダーに空き情報を設定
            if (data.available_slots) {
                calendar.setAvailableSlots(data.available_slots);
                // ローディング表示を成功メッセージに変更
                if (calendarLoadingMsg) {
                    calendarLoadingMsg.innerHTML = `
                        <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                            <p class="text-sm text-green-700">
                                空き情報を取得しました
                            </p>
                        </div>
                    `;
                    // 3秒後に非表示
                    setTimeout(() => {
                        calendarLoadingMsg.classList.add('hidden');
                    }, 3000);
                }
            }
        } else {
            console.error('Failed to load availability:', result);
            if (calendarLoadingMsg) {
                calendarLoadingMsg.innerHTML = `
                    <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                        <p class="text-sm text-red-700">
                            ${result.message || '空き情報の取得に失敗しました'}
                        </p>
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading availability:', error);
        if (calendarLoadingMsg) {
            calendarLoadingMsg.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <p class="text-sm text-red-700">
                        空き情報の取得中にエラーが発生しました
                    </p>
                </div>
            `;
        }
    } finally {
        // ローディング状態を解除
        calendar.setLoading(false);
    }
}

// 選択されたメニューを削除
window.removeSelectedMenu = function(patientId, menuId) {
    if (!appState.selectedTreatments[patientId]) return;
    
    // メニューを削除
    appState.selectedTreatments[patientId] = appState.selectedTreatments[patientId].filter(t => t.id !== menuId);
    appState.selectedMenuIds[patientId] = appState.selectedMenuIds[patientId].filter(id => id !== menuId);
    
    // チェックボックスのチェックを外す
    const checkbox = document.querySelector(`input[type="checkbox"][value="${menuId}"]`);
    if (checkbox) {
        checkbox.checked = false;
    }
    
    // 表示を更新
    updateSelectedMenusDisplay(patientId);
    updateNextButtonState();
    
    // メニューがなくなったらカレンダーをリセット、残っていれば再読み込み
    if (appState.selectedTreatments[patientId].length === 0) {
        const calendar = calendars['calendar'];
        if (calendar) {
            calendar.setAvailableSlots({});
        }
        // カレンダーローディングメッセージを非表示
        const calendarLoadingMsg = document.getElementById('calendar-loading-message');
        if (calendarLoadingMsg) {
            calendarLoadingMsg.classList.add('hidden');
        }
    } else {
        // まだメニューが残っている場合は、空き情報を再読み込み
        loadCalendarAvailability(patientId, appState.selectedTreatments[patientId]);
    }
};