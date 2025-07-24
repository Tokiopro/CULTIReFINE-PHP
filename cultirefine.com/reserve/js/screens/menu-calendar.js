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
    var backBtn = document.getElementById('back-to-patients-btn');
    var nextBtn = document.getElementById('next-menu-calendar-btn');
    var pairRoomSwitch = document.getElementById('pair-room-switch');

    if (!backBtn || !nextBtn || !pairRoomSwitch) return;

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

    pairRoomSwitch.addEventListener('change', function(e) {
        var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
        appState.pairRoomDesired[currentPatient.id] = e.target.checked;
        // Re-check time slots when pair room preference changes
        var date = appState.selectedDates[currentPatient.id];
        if (date) {
            checkAndUpdateTimeSlots(currentPatient.id, date);
        }
    });

    updateMenuCalendarScreen();
}

export async function updateMenuCalendarScreen() {
    var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
    var description = document.getElementById('menu-calendar-description');
    var backButtonText = document.getElementById('back-button-text');
    var nextButtonText = document.getElementById('next-button-text');

    if (!description || !backButtonText || !nextButtonText) return;

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
    await displayPatientMenus(currentPatient.id);
    
    // Initialize calendar - always create a fresh instance for each patient
    calendars['calendar'] = new Calendar('calendar', function(date) {
        selectDate(currentPatient.id, date);
    }, {
        showAvailability: true
    });
    
    // 選択されたメニューがある場合は空き情報を取得
    var selectedMenus = appState.selectedTreatments[currentPatient.id] || [];
    if (selectedMenus.length > 0) {
        await loadCalendarAvailability(currentPatient.id, selectedMenus[0].id);
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
    console.log('selectDate called for patient:', patientId, 'date:', date);
    appState.selectedDates[patientId] = date;
    appState.selectedTimes[patientId] = null; // Reset time selection
    
    checkAndUpdateTimeSlots(patientId, date).then(function() {
        updateNextButtonState();
    });
}

export function checkAndUpdateTimeSlots(patientId, date) {
    // 複数メニュー対応
    var selectedMenus = appState.selectedTreatments[patientId] || [];
    var pairRoom = appState.pairRoomDesired[patientId] || false;
    
    if (selectedMenus.length === 0 || !date) {
        return Promise.resolve();
    }

    var dateKey = formatDateKey(date);
    // 最初のメニューで空き確認（5分間隔）
    const firstMenu = selectedMenus[0];
    return mockCheckSlotAvailability(firstMenu.id, dateKey, pairRoom, 5).then(function(slotsResult) {
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
        if (!timeSlotsContainer) return;
        
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
        } else {
            timeSlotsContainer.classList.add('hidden');
        }
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
    
    // ローディング表示
    container.innerHTML = '<div class="text-center py-4">メニューを読み込んでいます...</div>';
    
    // メニュー選択時のコールバック
    const onMenuSelect = (menu, patientId, isChecked) => {
        // 選択されたメニューを配列に追加
        if (!appState.selectedTreatments[patientId]) {
            appState.selectedTreatments[patientId] = [];
        }
        if (!appState.selectedMenuIds[patientId]) {
            appState.selectedMenuIds[patientId] = [];
        }
        
        if (isChecked) {
            // チェックされた場合は追加
            const exists = appState.selectedTreatments[patientId].some(t => t.id === menu.id);
            if (!exists) {
                appState.selectedTreatments[patientId].push(menu);
                appState.selectedMenuIds[patientId].push(menu.id);
            }
        } else {
            // チェック解除された場合は削除
            appState.selectedTreatments[patientId] = appState.selectedTreatments[patientId].filter(t => t.id !== menu.id);
            appState.selectedMenuIds[patientId] = appState.selectedMenuIds[patientId].filter(id => id !== menu.id);
        }
        
        updateSelectedMenusDisplay(patientId);
        updateNextButtonState();
        
        // メニューが選択されたらカレンダーの空き情報を更新
        if (appState.selectedTreatments[patientId].length > 0) {
            loadCalendarAvailability(patientId, appState.selectedTreatments[patientId]);
        }
    };
    
    // 会社IDを取得
    const companyId = appState.membershipInfo?.companyId || window.APP_CONFIG?.companyInfo?.companyId || null;
    
    // 患者別メニューをロード
    await loadPatientMenus('treatment-categories', patientId, companyId, onMenuSelect);
    
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
        // 現在の月の初日から30日分の空き情報を取得
        const currentDate = calendar.currentDate;
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const dateKey = calendar.formatDateKey(startDate);
        
        // 複数メニューの場合、メニューIDの配列と合計時間を準備
        const menuIds = selectedMenus.map(menu => menu.id || menu.menu_id);
        const totalDuration = selectedMenus.reduce((sum, menu) => sum + (menu.duration_minutes || menu.duration || 0), 0);
        
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