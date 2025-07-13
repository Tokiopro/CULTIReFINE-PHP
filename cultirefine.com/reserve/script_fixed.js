// CLUTIREFINEクリニック予約システム - JavaScript (修正版)
// エンコーディング: UTF-8
// 保存時は必ずUTF-8エンコーディングで保存してください

// =====================================
// ブラウザ互換性のためのポリフィル
// =====================================

// Array.from polyfill
if (!Array.from) {
    Array.from = function(arrayLike, mapFn) {
        var result = [];
        for (var i = 0; i < arrayLike.length; i++) {
            result.push(mapFn ? mapFn(arrayLike[i], i) : arrayLike[i]);
        }
        return result;
    };
}

// Object.assign polyfill
if (!Object.assign) {
    Object.assign = function(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var key in source) {
                if (source.hasOwnProperty(key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    };
}

// =====================================
// データ定義
// =====================================

var treatmentCategories = [
    {
        id: "cat1",
        name: "自院オリジナル幹細胞培養上清液 点滴 (初回の方)",
        items: [
            {
                id: "t1",
                name: "免疫活力インフィニティ 3cc (初回)",
                duration: "約120分",
                price: "プラチナプラン内",
                minIntervalDays: 7,
            },
            {
                id: "t2",
                name: "免疫活力インフィニティ 6cc (初回)",
                duration: "約120分",
                price: "プラチナプラン内",
                minIntervalDays: 7,
            },
            {
                id: "t3",
                name: "免疫再生プレミア 1cc (初回)",
                duration: "約120分",
                price: "80,000円 (20%OFF価格)",
                minIntervalDays: 14,
            },
            {
                id: "t4",
                name: "神経プレミア 1cc (初回)",
                duration: "約120分",
                price: "80,000円 (20%OFF価格)",
                minIntervalDays: 14,
            },
        ],
    },
    {
        id: "cat2",
        name: "自院オリジナル幹細胞培養上清液 点滴 (2回目以降の方)",
        items: [
            {
                id: "t5",
                name: "免疫活力インフィニティ 3cc (2回目以降)",
                duration: "約90分",
                price: "会員価格",
                minIntervalDays: 30,
            },
            {
                id: "t6",
                name: "免疫再生プレミア 1cc (2回目以降)",
                duration: "約90分",
                price: "会員価格",
                minIntervalDays: 30,
            },
        ],
    },
    {
        id: "cat3",
        name: "NAD+注射 (初回の方)",
        items: [
            { id: "t7", name: "NAD+注射 100mg", duration: "約60分", price: "30,000円" },
            { id: "t8", name: "NAD+注射 200mg", duration: "約90分", price: "55,000円" },
        ],
    },
];

function formatDateKey(date) {
    return date.toISOString().split("T")[0];
}

var generateTimeSlotsData = function() {
    var data = {};
    var today = new Date();
    
    // Generate mock data for next 30 days
    for (var i = 1; i <= 30; i++) {
        var date = new Date(today);
        date.setDate(today.getDate() + i);
        var dateKey = formatDateKey(date);
        
        data[dateKey] = [
            { time: "10:00", status: "available" },
            { time: "10:30", status: "available" },
            { time: "11:00", status: Math.random() > 0.7 ? "pair_only" : "available" },
            { time: "11:30", status: Math.random() > 0.8 ? "unavailable" : "available" },
            { time: "14:00", status: "available" },
            { time: "14:30", status: Math.random() > 0.9 ? "single_only" : "available" },
            { time: "15:00", status: "available" },
            { time: "15:30", status: "available" },
        ];
    }
    
    return data;
};

var timeSlotsData = generateTimeSlotsData();

// =====================================
// localStorage管理
// =====================================

var StorageManager = {
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('localStorage not available');
        }
    },
    
    load: function(key) {
        try {
            var data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('localStorage not available');
            return null;
        }
    },
    
    remove: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage not available');
        }
    }
};

// =====================================
// アプリケーション状態管理
// =====================================

function AppState() {
    this.currentScreen = "patient-selection";
    this.lineUser = null;
    this.allPatients = [
        { id: "p1", name: "既存 一郎", lastVisit: "2024-05-10", isNew: false },
        { id: "p2", name: "既存 花子", lastVisit: "2024-04-20", isNew: false },
        { id: "p3", name: "既存 次郎", lastVisit: "2024-03-15", isNew: false },
    ];
    this.selectedPatientsForBooking = [];
    this.bookings = [];
    this.currentPatientIndexForBooking = 0;
    this.isPairBookingMode = false;
    this.selectedTreatments = {};
    this.selectedDates = {};
    this.selectedTimes = {};
    this.pairRoomDesired = {};
}

AppState.prototype.setScreen = function(screenName) {
    this.currentScreen = screenName;
    this.updateUI();
};

AppState.prototype.setLineUser = function(user) {
    this.lineUser = user;
    this.updateUI();
};

AppState.prototype.addPatient = function(patient) {
    this.allPatients.push(patient);
};

AppState.prototype.updateUI = function() {
    console.log('Updating UI, current screen:', this.currentScreen);
    
    // Hide all screens
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }

    // Show current screen
    var currentScreenElement = document.getElementById(this.currentScreen + '-screen');
    if (currentScreenElement) {
        currentScreenElement.classList.add('active');
        console.log('Activated screen:', this.currentScreen);
    } else {
        console.error('Screen element not found:', this.currentScreen + '-screen');
    }

    // Update header
    this.updateHeader();
};

AppState.prototype.updateHeader = function() {
    var userWelcome = document.getElementById('user-welcome');
    var userName = document.getElementById('user-name');

    if (this.lineUser) {
        userWelcome.classList.remove('hidden');
        userName.textContent = this.lineUser.displayName;
    } else {
    }
};

AppState.prototype.saveToStorage = function() {
    StorageManager.save('clutirefine_booking_data', {
        lineUser: this.lineUser,
        selectedPatientsForBooking: this.selectedPatientsForBooking,
        bookings: this.bookings,
        currentPatientIndexForBooking: this.currentPatientIndexForBooking,
        isPairBookingMode: this.isPairBookingMode,
        selectedTreatments: this.selectedTreatments,
        selectedDates: this.selectedDates,
        selectedTimes: this.selectedTimes,
        pairRoomDesired: this.pairRoomDesired
    });
};

// Global app state
var appState = new AppState();

// =====================================
// Mock API Functions
// =====================================

function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

function mockAddPatient(patientData) {
    console.log("[API Mock] Adding patient:", patientData);
    return delay(500).then(function() {
        var newPatient = {
            id: "new-" + Date.now(),
            name: patientData.name,
            isNew: true,
            lastVisit: new Date().toISOString().split("T")[0],
        };
        return { success: true, patient: newPatient, message: "患者が正常に追加されました。" };
    });
}

function mockCheckTreatmentInterval(patientId, treatmentId, desiredDate) {
    console.log("[API Mock] Checking interval for patient " + patientId + ", treatment " + treatmentId + ", date " + desiredDate.toISOString());
    return delay(300).then(function() {
        // Mock logic: if treatmentId is 't1' and date is too soon
        var weekLater = new Date();
        weekLater.setDate(weekLater.getDate() + 7);
        if (treatmentId === "t1" && desiredDate < weekLater) {
            return { 
                success: false, 
                isValid: false, 
                message: "この施術は最終施術日から7日間の間隔が必要です。(サンプル)" 
            };
        }
        return { success: true, isValid: true };
    });
}

function mockCheckSlotAvailability(treatmentId, dateKey, pairRoomDesired) {
    console.log("[API Mock] Checking slots for treatment " + treatmentId + " on " + dateKey + ", pair: " + pairRoomDesired);
    return delay(400).then(function() {
        var times = ["10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00"];
        var message = "空き時間があります。";

        if (pairRoomDesired) {
            times = ["10:00", "14:00"]; // Fewer slots for pair rooms
            message = times.length > 0 ? "ペア施術可能な空き時間があります。" : "ペア施術可能な時間がありません。";
        }

        // Simulate no slots on specific dates
        var today = new Date();
        var checkDate = new Date(today);
        checkDate.setDate(today.getDate() + 5);
        if (dateKey === formatDateKey(checkDate)) {
            times = [];
            message = "指定された日付には空きがありません。";
        }

        return { success: true, availableTimes: times, message: message };
    });
}

function mockSubmitBulkReservation(bookings, lineUserId) {
    console.log("[API Mock] Submitting bulk reservations for LINE User:", lineUserId, bookings);
    return delay(1000).then(function() {
        return { 
            success: true, 
            reservationId: "MOCKRES-" + Date.now(), 
            message: "予約が正常に確定されました。" 
        };
    });
}

// =====================================
// Calendar Implementation
// =====================================

function Calendar(containerId, onDateSelect) {
    this.container = document.getElementById(containerId);
    this.onDateSelect = onDateSelect;
    this.currentDate = new Date();
    this.selectedDate = null;
    this.containerId = containerId;
    this.render();
}

Calendar.prototype.render = function() {
    var self = this;
    if (!this.container) {
        console.error('Calendar container not found: ' + this.containerId);
        return;
    }

    var today = new Date();
    var year = this.currentDate.getFullYear();
    var month = this.currentDate.getMonth();
    
    // Calculate first day and number of days
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var daysInMonth = lastDay.getDate();
    var startDay = firstDay.getDay();

    var html = '';
    html += '<div class="calendar-header flex justify-between items-center mb-4">';
    html += '<button class="calendar-nav-btn w-8 h-8 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-gray-100 rounded" onclick="calendarPreviousMonth(\'' + this.containerId + '\')">‹</button>';
    html += '<div class="calendar-month-year font-semibold text-lg text-gray-800">' + year + '年' + (month + 1) + '月</div>';
    html += '<button class="calendar-nav-btn w-8 h-8 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-gray-100 rounded" onclick="calendarNextMonth(\'' + this.containerId + '\')">›</button>';
    html += '</div>';
    html += '<div class="calendar-grid grid grid-cols-7 gap-1">';

    // Day headers
    var dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
    for (var i = 0; i < dayHeaders.length; i++) {
        html += '<div class="calendar-day-header text-center text-sm font-medium text-gray-500 py-2">' + dayHeaders[i] + '</div>';
    }

    // Empty cells for days before month starts
    for (var i = 0; i < startDay; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }

    // Days of the month
    for (var day = 1; day <= daysInMonth; day++) {
        var date = new Date(year, month, day);
        var isToday = date.toDateString() === today.toDateString();
        var isPast = date < today;
        var isSelected = this.selectedDate && date.toDateString() === this.selectedDate.toDateString();
        
        var className = 'calendar-day w-10 h-10 flex items-center justify-center text-sm border-none bg-none rounded-md cursor-pointer transition-all';
        if (isToday) className += ' today bg-gray-100';
        if (isSelected) className += ' selected bg-teal-500 text-white';
        if (isPast) className += ' disabled text-gray-400 cursor-not-allowed opacity-50';
        if (!isPast && !isSelected) className += ' hover:bg-gray-100';

        html += '<button class="' + className + '" ';
        html += 'onclick="calendarSelectDate(\'' + this.containerId + '\', ' + year + ', ' + month + ', ' + day + ')"';
        if (isPast) html += ' disabled';
        html += '>';
        html += day;
        html += '</button>';
    }

    html += '</div>';
    this.container.innerHTML = html;
};

Calendar.prototype.selectDate = function(year, month, day) {
    this.selectedDate = new Date(year, month, day);
    this.render();
    if (this.onDateSelect) {
        this.onDateSelect(this.selectedDate);
    }
};

Calendar.prototype.previousMonth = function() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
};

Calendar.prototype.nextMonth = function() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
};

Calendar.prototype.setSelectedDate = function(date) {
    this.selectedDate = date;
    if (date) {
        this.currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
    }
    this.render();
};

// Global calendar instances
var calendars = {};

// Global functions for calendar navigation
function calendarPreviousMonth(containerId) {
    if (calendars[containerId]) {
        calendars[containerId].previousMonth();
    }
}

function calendarNextMonth(containerId) {
    if (calendars[containerId]) {
        calendars[containerId].nextMonth();
    }
}

function calendarSelectDate(containerId, year, month, day) {
    if (calendars[containerId]) {
        calendars[containerId].selectDate(year, month, day);
    }
}

// =====================================
// UI Helper Functions
// =====================================

function createElement(tag, className, innerHTML) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
}

function showModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function showAlert(containerId, type, title, message) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var alertClasses = {
        'info': 'bg-teal-50 border-l-4 border-teal-500 p-4 rounded',
        'warning': 'bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded',
        'error': 'bg-red-50 border-l-4 border-red-500 p-4 rounded'
    };

    container.className = alertClasses[type] || alertClasses['info'];
    var colorClass = type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'teal';
    container.innerHTML = '<h4 class="text-sm font-semibold text-' + colorClass + '-800">' + title + '</h4>' +
                         '<p class="text-xs text-' + colorClass + '-600">' + message + '</p>';
    container.classList.remove('hidden');
}

function hideAlert(containerId) {
    var container = document.getElementById(containerId);
    if (container) {
        container.classList.add('hidden');
    }
}

// =====================================
// Screen-specific Functions
// =====================================

// Patient Selection Screen
function initPatientSelectionScreen() {
    var pairModeSwitch = document.getElementById('pair-mode-switch');
    var proceedBtn = document.getElementById('proceed-patients-btn');
    var addPatientBtn = document.getElementById('add-patient-btn');
    var description = document.getElementById('patient-selection-description');

    if (!pairModeSwitch || !proceedBtn || !addPatientBtn || !description) return;

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

function updatePatientsList() {
    var container = document.getElementById('patients-list');
    if (!container) return;
    
    container.innerHTML = '';

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
        
        patientElement.innerHTML = 
            '<input type="checkbox" class="patient-checkbox" ' +
            (isSelected ? 'checked' : '') + ' ' +
            (isDisabled ? 'disabled' : '') +
            ' data-patient-id="' + patient.id + '">' +
            '<div class="flex-1 cursor-pointer">' +
                '<span class="font-medium">' + patient.name + '</span>' +
                (lastVisitText ? '<span class="text-xs text-gray-500 ml-2">' + lastVisitText + '</span>' : '') +
                newText +
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

function togglePatientSelection(patientId) {
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

function updateProceedButton() {
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

// Add Patient Modal
function initAddPatientModal() {
    var modal = document.getElementById('add-patient-modal');
    var closeBtn = document.getElementById('modal-close-btn');
    var cancelBtn = document.getElementById('cancel-add-patient-btn');
    var confirmBtn = document.getElementById('confirm-add-patient-btn');
    var nameInput = document.getElementById('new-patient-name');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !nameInput) return;

    function closeModal() {
        hideModal('add-patient-modal');
        nameInput.value = '';
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', function() {
        var name = nameInput.value.trim();
        
        if (!name) {
            alert("氏名を入力してください。");
            return;
        }
        if (/[^\p{L}\p{N}\s]/u.test(name) && !/[-']/.test(name)) {
            alert("氏名に絵文字や特殊記号は使用できません。");
            return;
        }
        if (name.length > 30) {
            alert("氏名は30文字以内で入力してください。");
            return;
        }

        mockAddPatient({ name: name }).then(function(result) {
            if (result.success && result.patient) {
                appState.addPatient(result.patient);
                
                // Auto-select if possible
                if (!appState.isPairBookingMode || appState.selectedPatientsForBooking.length < 2) {
                    appState.selectedPatientsForBooking.push(result.patient);
                }
                
                updatePatientsList();
                updateProceedButton();
                closeModal();
            } else {
                alert("患者の追加に失敗しました: " + result.message);
            }
        }).catch(function(error) {
            alert("患者の追加中にエラーが発生しました。");
        });
    });

    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Menu Calendar Screen
function initMenuCalendarScreen() {
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
        var treatment = appState.selectedTreatments[currentPatient.id];
        var date = appState.selectedDates[currentPatient.id];
        var time = appState.selectedTimes[currentPatient.id];

        if (!treatment || !date || !time) {
            alert("メニュー、日付、時間を選択してください。");
            return;
        }

        // Update booking
        appState.bookings[appState.currentPatientIndexForBooking] = Object.assign(
            appState.bookings[appState.currentPatientIndexForBooking],
            {
                treatment: treatment,
                selectedDate: date,
                selectedTime: time,
                pairRoomDesired: appState.pairRoomDesired[currentPatient.id] || false
            }
        );

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

function updateMenuCalendarScreen() {
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

    createTreatmentAccordion('treatment-categories', currentPatient.id);
    
    // Initialize calendar - always create a fresh instance for each patient
    calendars['calendar'] = new Calendar('calendar', function(date) {
        selectDate(currentPatient.id, date);
    });
    
    // Restore selections
    var treatment = appState.selectedTreatments[currentPatient.id];
    var date = appState.selectedDates[currentPatient.id];
    var time = appState.selectedTimes[currentPatient.id];
    var pairRoom = appState.pairRoomDesired[currentPatient.id];

    console.log('Restoring selections for patient:', currentPatient.name);
    console.log('Treatment:', treatment);
    console.log('Date:', date);
    console.log('Time:', time);

    // Reset pair room switch
    var pairRoomSwitch = document.getElementById('pair-room-switch');
    if (pairRoomSwitch) {
        pairRoomSwitch.checked = !!pairRoom;
    }

    // Restore treatment selection
    if (treatment) {
        setTimeout(function() {
            selectTreatmentProgrammatically(currentPatient.id, treatment);
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

// Helper function to select treatment programmatically without UI event
function selectTreatmentProgrammatically(patientId, treatment) {
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

function createTreatmentAccordion(containerId, patientId) {
    var container = document.getElementById(containerId);
    if (!container) {
        console.error('Treatment accordion container not found:', containerId);
        return;
    }
    
    container.innerHTML = '';

    for (var i = 0; i < treatmentCategories.length; i++) {
        var category = treatmentCategories[i];
        var categoryElement = createElement('div', 'border-b border-gray-200 last:border-b-0');
        
        // 修正: containerIdベースでユニークなIDを生成
        var triggerId = 'trigger-' + category.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
        var contentId = 'content-' + category.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
        
        console.log('Creating accordion for container:', containerId, 'trigger:', triggerId, 'content:', contentId);
        
        var itemsHtml = '';
        for (var j = 0; j < category.items.length; j++) {
            var item = category.items[j];
            var itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
            itemsHtml += 
                '<div class="treatment-item flex items-start space-x-3 p-3 rounded-md cursor-pointer transition-all bg-slate-50 hover:bg-slate-100" ' +
                'onclick="selectTreatment(\'' + patientId + '\', ' + itemJson + ')">' +
                    '<input type="radio" name="treatment-' + patientId + '" class="treatment-checkbox mt-0.5" value="' + item.id + '">' +
                    '<div class="flex-1">' +
                        '<div class="treatment-name font-medium text-gray-800">' + item.name + '</div>' +
                        '<div class="text-xs text-gray-600">' +
                            '時間目安: ' + item.duration + '<br>' +
                            '目安金額: ' + item.price +
                        '</div>' +
                    '</div>' +
                '</div>';
        }
        
        categoryElement.innerHTML = 
            '<button class="accordion-trigger w-full px-4 py-3 text-left font-medium hover:bg-slate-50 flex justify-between items-center" ' +
                    'id="' + triggerId + '" ' +
                    'onclick="toggleAccordion(\'' + triggerId + '\', \'' + contentId + '\')">' +
                category.name +
                '<span class="accordion-arrow">▼</span>' +
            '</button>' +
            '<div class="accordion-content hidden px-4 pt-2 pb-4 bg-white border-t border-gray-200" id="' + contentId + '">' +
                '<div class="space-y-2">' + itemsHtml + '</div>' +
            '</div>';

        container.appendChild(categoryElement);
    }
}

function toggleAccordion(triggerId, contentId) {
    var trigger = document.getElementById(triggerId);
    var content = document.getElementById(contentId);
    
    console.log('toggleAccordion called:', triggerId, contentId);
    console.log('Elements found:', !!trigger, !!content);
    
    if (!trigger || !content) {
        console.error('Accordion elements not found:', { triggerId, contentId, trigger: !!trigger, content: !!content });
        return;
    }
    
    var isActive = trigger.classList.contains('active');
    console.log('Current state:', isActive ? 'active' : 'inactive');
    
    // Close all accordions in the same container
    var container = trigger.closest('.border-gray-200') && trigger.closest('.border-gray-200').parentElement;
    if (container) {
        var allTriggers = container.querySelectorAll('.accordion-trigger');
        var allContents = container.querySelectorAll('.accordion-content');
        
        for (var i = 0; i < allTriggers.length; i++) {
            allTriggers[i].classList.remove('active');
        }
        for (var i = 0; i < allContents.length; i++) {
            allContents[i].classList.remove('active');
        }
    }
    
    // Toggle the clicked accordion
    if (!isActive) {
        trigger.classList.add('active');
        content.classList.add('active');
        console.log('Accordion opened');
    } else {
        console.log('Accordion closed');
    }
}

// Update selectTreatment to handle all booking modes
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
        
        updateBulkNextButtonState();
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
        
        updatePairNextButtonState();
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

function selectDate(patientId, date) {
    console.log('selectDate called for patient:', patientId, 'date:', date);
    appState.selectedDates[patientId] = date;
    appState.selectedTimes[patientId] = null; // Reset time selection
    
    checkAndUpdateTimeSlots(patientId, date).then(function() {
        updateNextButtonState();
    });
}

function checkAndUpdateTimeSlots(patientId, date) {
    var treatment = appState.selectedTreatments[patientId];
    var pairRoom = appState.pairRoomDesired[patientId] || false;
    
    if (!treatment || !date) {
        return Promise.resolve();
    }

    var dateKey = formatDateKey(date);
    return mockCheckSlotAvailability(treatment.id, dateKey, pairRoom).then(function(slotsResult) {
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
            for (var i = 0; i < slotsResult.availableTimes.length; i++) {
                var time = slotsResult.availableTimes[i];
                var timeSlot = createElement('button', 
                    'time-slot px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-teal-50 cursor-pointer text-center text-sm transition-all', 
                    time);
                timeSlot.onclick = (function(time) {
                    return function() {
                        selectTimeSlot(patientId, time);
                    };
                })(time);
                timeSlotsContainer.appendChild(timeSlot);
            }
            timeSlotsContainer.classList.remove('hidden');
        } else {
            timeSlotsContainer.classList.add('hidden');
        }
    });
}

function selectTimeSlot(patientId, time) {
    console.log('selectTimeSlot called for patient:', patientId, 'time:', time);
    appState.selectedTimes[patientId] = time;
    
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

function updateNextButtonState() {
    var nextBtn = document.getElementById('next-menu-calendar-btn');
    if (!nextBtn) return;
    
    var currentPatient = appState.selectedPatientsForBooking[appState.currentPatientIndexForBooking];
    if (!currentPatient) return;
    
    var hasAllRequired = 
        appState.selectedTreatments[currentPatient.id] &&
        appState.selectedDates[currentPatient.id] &&
        appState.selectedTimes[currentPatient.id];
    
    console.log('UpdateNextButtonState for patient:', currentPatient.name, 'hasAllRequired:', hasAllRequired);
    console.log('Treatment:', appState.selectedTreatments[currentPatient.id]);
    console.log('Date:', appState.selectedDates[currentPatient.id]);
    console.log('Time:', appState.selectedTimes[currentPatient.id]);
    
    nextBtn.disabled = !hasAllRequired;
}

// Pair Booking Screen
function initPairBookingScreen() {
    var backBtn = document.getElementById('back-to-patients-from-pair-btn');
    var nextBtn = document.getElementById('next-pair-booking-btn');

    if (!backBtn || !nextBtn) return;

    backBtn.addEventListener('click', function() {
        appState.setScreen('patient-selection');
    });

    nextBtn.addEventListener('click', function() {
        var patient1 = appState.selectedPatientsForBooking[0];
        var patient2 = appState.selectedPatientsForBooking[1];
        
        var treatment1 = appState.selectedTreatments[patient1.id];
        var treatment2 = appState.selectedTreatments[patient2.id];
        var date = appState.selectedDates['pair'];
        var time = appState.selectedTimes['pair'];

        if (!treatment1 || !treatment2 || !date || !time) {
            alert("両方の施術メニュー、日付、時間を選択してください。");
            return;
        }

        // Update bookings
        appState.bookings = [
            {
                patientId: patient1.id,
                patientName: patient1.name,
                treatment: treatment1,
                selectedDate: date,
                selectedTime: time,
                pairRoomDesired: true,
                status: "pending"
            },
            {
                patientId: patient2.id,
                patientName: patient2.name,
                treatment: treatment2,
                selectedDate: date,
                selectedTime: time,
                pairRoomDesired: true,
                status: "pending"
            }
        ];

        // Save data and go to confirmation page
        appState.saveToStorage();
        window.location.href = 'confirmation.html';
    });

    updatePairBookingScreen();
}

function updatePairBookingScreen() {
    var patient1 = appState.selectedPatientsForBooking[0];
    var patient2 = appState.selectedPatientsForBooking[1];
    
    var description = document.getElementById('pair-booking-description');
    var patient1Title = document.getElementById('patient1-menu-title');
    var patient2Title = document.getElementById('patient2-menu-title');
    
    if (description) {
        description.textContent = patient1.name + '様と' + patient2.name + '様の施術メニューを選択し、共通のご希望日時を指定してください。';
    }
    
    if (patient1Title) {
        patient1Title.innerHTML = '👤 ' + patient1.name + '様の施術メニュー';
    }
    
    if (patient2Title) {
        patient2Title.innerHTML = '👤 ' + patient2.name + '様の施術メニュー';
    }

    createTreatmentAccordion('patient1-treatments', patient1.id);
    createTreatmentAccordion('patient2-treatments', patient2.id);
    
    // Initialize pair calendar - always create fresh instance
    calendars['pair-calendar'] = new Calendar('pair-calendar', function(date) {
        selectPairDate(date);
    });

    // Restore previous selections if any
    var treatment1 = appState.selectedTreatments[patient1.id];
    var treatment2 = appState.selectedTreatments[patient2.id];
    var pairDate = appState.selectedDates['pair'];
    var pairTime = appState.selectedTimes['pair'];

    console.log('Restoring pair selections:');
    console.log('Treatment1:', treatment1);
    console.log('Treatment2:', treatment2);
    console.log('Date:', pairDate);
    console.log('Time:', pairTime);

    // Restore treatment selections
    if (treatment1) {
        setTimeout(function() {
            selectPairTreatmentProgrammatically(patient1.id, treatment1, 'patient1-treatments');
        }, 200);
    }
    
    if (treatment2) {
        setTimeout(function() {
            selectPairTreatmentProgrammatically(patient2.id, treatment2, 'patient2-treatments');
        }, 300);
    }

    // Check if both treatments are selected to show calendar
    setTimeout(function() {
        if (appState.selectedTreatments[patient1.id] && appState.selectedTreatments[patient2.id]) {
            document.getElementById('pair-date-time-selection').classList.remove('hidden');
            
            if (pairDate) {
                calendars['pair-calendar'].setSelectedDate(pairDate);
            }
        }
        updatePairNextButtonState();
    }, 500);
}

// Helper function for pair treatment selection
function selectPairTreatmentProgrammatically(patientId, treatment, containerId) {
    appState.selectedTreatments[patientId] = treatment;
    
    // Find and mark the correct treatment as selected in the specific container
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var treatmentItems = container.querySelectorAll('.treatment-item');
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
    
    // Check if both patients have treatments selected
    var patient1 = appState.selectedPatientsForBooking[0];
    var patient2 = appState.selectedPatientsForBooking[1];
    
    if (appState.selectedTreatments[patient1.id] && appState.selectedTreatments[patient2.id]) {
        document.getElementById('pair-date-time-selection').classList.remove('hidden');
        hideAlert('patient1-interval-error');
        hideAlert('patient2-interval-error');
    }
    
    updatePairNextButtonState();
}

function selectPairDate(date) {
    console.log('selectPairDate called with date:', date);
    appState.selectedDates['pair'] = date;
    appState.selectedTimes['pair'] = null;
    
    checkAndUpdatePairTimeSlots(date).then(function() {
        updatePairNextButtonState();
    });
}

function checkAndUpdatePairTimeSlots(date) {
    var patient1 = appState.selectedPatientsForBooking[0];
    var patient2 = appState.selectedPatientsForBooking[1];
    
    var treatment1 = appState.selectedTreatments[patient1.id];
    var treatment2 = appState.selectedTreatments[patient2.id];
    
    if (!treatment1 || !treatment2 || !date) {
        console.log('Missing requirements for pair time slots:', { treatment1, treatment2, date });
        return Promise.resolve();
    }

    console.log('Checking pair time slots for:', { treatment1: treatment1.name, treatment2: treatment2.name, date });

    // Check intervals for both patients
    return Promise.all([
        mockCheckTreatmentInterval(patient1.id, treatment1.id, date),
        mockCheckTreatmentInterval(patient2.id, treatment2.id, date)
    ]).then(function(results) {
        var interval1 = results[0];
        var interval2 = results[1];
        
        console.log('Interval check results:', { interval1, interval2 });
        
        if (!interval1.isValid) {
            showAlert('patient1-interval-error', 'error', '施術間隔エラー', interval1.message);
        } else {
            hideAlert('patient1-interval-error');
        }
        
        if (!interval2.isValid) {
            showAlert('patient2-interval-error', 'error', '施術間隔エラー', interval2.message);
        } else {
            hideAlert('patient2-interval-error');
        }

        if (!interval1.isValid || !interval2.isValid) {
            console.log('Interval validation failed, hiding time slots');
            var timeSlotsContainer = document.getElementById('pair-time-slots');
            if (timeSlotsContainer) {
                timeSlotsContainer.classList.add('hidden');
            }
            return;
        }

        // Check slot availability for pair booking
        var dateKey = formatDateKey(date);
        return mockCheckSlotAvailability(treatment1.id, dateKey, true);
    }).then(function(slotsResult) {
        if (!slotsResult) return;
        
        console.log('Pair slots result:', slotsResult);
        
        // Show availability message
        if (slotsResult.message) {
            var alertType = slotsResult.availableTimes.length > 0 ? 'info' : 'warning';
            showAlert('pair-slot-availability-message', alertType, 
                     slotsResult.availableTimes.length > 0 ? 'ペア予約可能な時間' : '空き状況', 
                     slotsResult.message);
        } else {
            hideAlert('pair-slot-availability-message');
        }

        // Update time slots
        var timeSlotsContainer = document.getElementById('pair-time-slots');
        if (!timeSlotsContainer) {
            console.error('pair-time-slots container not found');
            return;
        }
        
        timeSlotsContainer.innerHTML = '';
        
        if (slotsResult.availableTimes.length > 0) {
            console.log('Creating time slots:', slotsResult.availableTimes);
            for (var i = 0; i < slotsResult.availableTimes.length; i++) {
                var time = slotsResult.availableTimes[i];
                var timeSlot = createElement('button', 
                    'time-slot px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-teal-50 cursor-pointer text-center text-sm transition-all', 
                    time);
                timeSlot.onclick = (function(time) {
                    return function() {
                        selectPairTimeSlot(time);
                    };
                })(time);
                timeSlotsContainer.appendChild(timeSlot);
            }
            timeSlotsContainer.classList.remove('hidden');
        } else {
            console.log('No available time slots');
            timeSlotsContainer.classList.add('hidden');
        }
    }).catch(function(error) {
        console.error('Error in checkAndUpdatePairTimeSlots:', error);
    });
}

function selectPairTimeSlot(time) {
    console.log('selectPairTimeSlot called with time:', time);
    appState.selectedTimes['pair'] = time;
    
    // Update UI
    var timeSlots = document.querySelectorAll('#pair-time-slots .time-slot');
    for (var i = 0; i < timeSlots.length; i++) {
        timeSlots[i].classList.remove('selected', 'bg-teal-600', 'text-white');
        timeSlots[i].classList.add('bg-white', 'hover:bg-teal-50');
    }
    
    var clickedElement = event && event.currentTarget ? event.currentTarget : null;
    if (clickedElement) {
        clickedElement.classList.add('selected', 'bg-teal-600', 'text-white');
        clickedElement.classList.remove('bg-white', 'hover:bg-teal-50');
    }
    
    // Force update button state after time selection
    setTimeout(function() {
        updatePairNextButtonState();
    }, 50);
}

function updatePairNextButtonState() {
    var nextBtn = document.getElementById('next-pair-booking-btn');
    if (!nextBtn) return;
    
    var patient1 = appState.selectedPatientsForBooking[0];
    var patient2 = appState.selectedPatientsForBooking[1];
    
    var hasAllRequired = 
        appState.selectedTreatments[patient1.id] &&
        appState.selectedTreatments[patient2.id] &&
        appState.selectedDates['pair'] &&
        appState.selectedTimes['pair'];
    
    console.log('UpdatePairNextButtonState:', {
        treatment1: appState.selectedTreatments[patient1.id],
        treatment2: appState.selectedTreatments[patient2.id],
        date: appState.selectedDates['pair'],
        time: appState.selectedTimes['pair'],
        hasAllRequired: hasAllRequired
    });
    
    nextBtn.disabled = !hasAllRequired;
}

// =====================================
// 新規追加: 一括予約画面の関数群
// =====================================

function initBulkBookingScreen() {
    var backBtn = document.getElementById('back-to-patients-from-bulk-btn');
    var nextBtn = document.getElementById('next-bulk-booking-btn');

    if (!backBtn || !nextBtn) return;

    backBtn.addEventListener('click', function() {
        appState.setScreen('patient-selection');
    });

    nextBtn.addEventListener('click', function() {
        var allPatientsHaveSelections = true;
        var hasSharedDateTime = appState.selectedDates['bulk'] && appState.selectedTimes['bulk'];
        
        // 全ての来院者が施術を選択し、共通の日時が選択されているかチェック
        for (var i = 0; i < appState.selectedPatientsForBooking.length; i++) {
            var patient = appState.selectedPatientsForBooking[i];
            if (!appState.selectedTreatments[patient.id]) {
                allPatientsHaveSelections = false;
                break;
            }
        }

        if (!allPatientsHaveSelections || !hasSharedDateTime) {
            alert("全ての来院者の施術メニューと共通の日時を選択してください。");
            return;
        }

        // Update bookings with shared date/time
        appState.bookings = appState.selectedPatientsForBooking.map(function(patient) {
            return {
                patientId: patient.id,
                patientName: patient.name,
                treatment: appState.selectedTreatments[patient.id],
                selectedDate: appState.selectedDates['bulk'],
                selectedTime: appState.selectedTimes['bulk'],
                pairRoomDesired: false,
                status: "pending"
            };
        });

        // Save data and go to confirmation page
        appState.saveToStorage();
        window.location.href = 'confirmation.html';
    });

    updateBulkBookingScreen();
}

function updateBulkBookingScreen() {
    console.log('updateBulkBookingScreen called');
    
    var patients = appState.selectedPatientsForBooking;
    var description = document.getElementById('bulk-booking-description');
    
    console.log('Patients for bulk booking:', patients.length);
    
    if (description) {
        description.textContent = patients.map(function(p) { return p.name + '様'; }).join('、') + 
                                  'の施術メニューを選択し、共通のご希望日時を指定してください。';
    }

    // Create grid layout for multiple patients
    var container = document.getElementById('bulk-patients-grid');
    if (!container) {
        console.error('bulk-patients-grid container not found');
        return;
    }
    
    console.log('Creating patient grid for', patients.length, 'patients');
    container.innerHTML = '';
    
    // Set grid class based on number of patients
    container.className = 'bulk-patients-grid gap-4';
    if (patients.length >= 5) {
        container.classList.add('five-or-more');
    } else if (patients.length >= 4) {
        container.classList.add('four-or-more');
    } else if (patients.length >= 3) {
        container.classList.add('three-or-more');
    }

    // Create treatment selection for each patient
    for (var i = 0; i < patients.length; i++) {
        var patient = patients[i];
        var patientDiv = createElement('div', 'border border-gray-200 rounded-lg bg-white p-4');
        
        var titleId = 'bulk-patient' + (i + 1) + '-menu-title';
        var treatmentsId = 'bulk-patient' + (i + 1) + '-treatments';
        var errorId = 'bulk-patient' + (i + 1) + '-interval-error';
        
        console.log('Creating patient', i + 1, 'with IDs:', { titleId, treatmentsId, errorId });
        
        patientDiv.innerHTML = 
            '<h4 id="' + titleId + '" class="text-lg font-semibold text-teal-600 mb-3 flex items-center">' +
            '👤 ' + patient.name + '様の施術メニュー</h4>' +
            '<div id="' + treatmentsId + '" class="border border-gray-200 rounded-lg overflow-hidden"></div>' +
            '<div id="' + errorId + '" class="hidden mt-2 bg-red-50 border-l-4 border-red-500 p-2 rounded">' +
            '<h5 class="text-xs font-semibold text-red-800">施術間隔エラー</h5>' +
            '<p class="text-xs text-red-600"></p></div>';
        
        container.appendChild(patientDiv);
        
        // Create treatment accordion for this patient
        console.log('Creating treatment accordion for patient', patient.id, 'in container', treatmentsId);
        createTreatmentAccordion(treatmentsId, patient.id);
    }

    // Initialize bulk calendar
    calendars['bulk-calendar'] = new Calendar('bulk-calendar', function(date) {
        selectBulkDate(date);
    });

    // Restore previous selections
    setTimeout(function() {
        console.log('Restoring previous selections...');
        
        for (var i = 0; i < patients.length; i++) {
            var patient = patients[i];
            var treatment = appState.selectedTreatments[patient.id];
            if (treatment) {
                console.log('Restoring treatment for patient', patient.name, ':', treatment.name);
                selectBulkTreatmentProgrammatically(patient.id, treatment, 'bulk-patient' + (i + 1) + '-treatments');
            }
        }
        
        // Check if all treatments are selected to show calendar
        var allSelected = patients.every(function(p) {
            return appState.selectedTreatments[p.id];
        });
        
        console.log('All treatments selected:', allSelected);
        
        if (allSelected) {
            document.getElementById('bulk-date-time-selection').classList.remove('hidden');
            var bulkDate = appState.selectedDates['bulk'];
            if (bulkDate) {
                calendars['bulk-calendar'].setSelectedDate(bulkDate);
            }
        }
        
        updateBulkNextButtonState();
    }, 300);
}

function selectBulkTreatmentProgrammatically(patientId, treatment, containerId) {
    console.log('selectBulkTreatmentProgrammatically called:', patientId, treatment.name, containerId);
    
    appState.selectedTreatments[patientId] = treatment;
    
    var container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }
    
    var treatmentItems = container.querySelectorAll('.treatment-item');
    console.log('Found treatment items:', treatmentItems.length);
    
    for (var i = 0; i < treatmentItems.length; i++) {
        var item = treatmentItems[i];
        var radio = item.querySelector('input[type="radio"]');
        if (radio && radio.value === treatment.id) {
            item.classList.add('selected');
            radio.checked = true;
            console.log('Selected treatment item:', treatment.name);
        } else {
            item.classList.remove('selected');
            if (radio) radio.checked = false;
        }
    }
    
    // Check if all patients have treatments selected
    var allSelected = appState.selectedPatientsForBooking.every(function(p) {
        return appState.selectedTreatments[p.id];
    });
    
    console.log('All patients have treatments selected:', allSelected);
    
    if (allSelected) {
        var dateTimeSection = document.getElementById('bulk-date-time-selection');
        if (dateTimeSection) {
            dateTimeSection.classList.remove('hidden');
            console.log('Showing date-time selection');
        }
        
        // Clear any previous interval errors
        for (var i = 0; i < appState.selectedPatientsForBooking.length; i++) {
            hideAlert('bulk-patient' + (i + 1) + '-interval-error');
        }
    }
    
    updateBulkNextButtonState();
}

function selectBulkDate(date) {
    console.log('selectBulkDate called with date:', date);
    appState.selectedDates['bulk'] = date;
    appState.selectedTimes['bulk'] = null;
    
    checkAndUpdateBulkTimeSlots(date).then(function() {
        updateBulkNextButtonState();
    });
}

function checkAndUpdateBulkTimeSlots(date) {
    var patients = appState.selectedPatientsForBooking;
    
    // Check if all patients have treatments selected
    var allTreatmentsSelected = patients.every(function(p) {
        return appState.selectedTreatments[p.id];
    });
    
    if (!allTreatmentsSelected || !date) {
        return Promise.resolve();
    }

    // Check intervals for all patients
    var intervalPromises = patients.map(function(patient, index) {
        var treatment = appState.selectedTreatments[patient.id];
        return mockCheckTreatmentInterval(patient.id, treatment.id, date)
            .then(function(result) {
                var errorId = 'bulk-patient' + (index + 1) + '-interval-error';
                if (!result.isValid) {
                    showAlert(errorId, 'error', '施術間隔エラー', result.message);
                    return false;
                } else {
                    hideAlert(errorId);
                    return true;
                }
            });
    });

    return Promise.all(intervalPromises).then(function(intervalResults) {
        var allValid = intervalResults.every(function(valid) { return valid; });
        
        if (!allValid) {
            var timeSlotsContainer = document.getElementById('bulk-time-slots');
            if (timeSlotsContainer) {
                timeSlotsContainer.classList.add('hidden');
            }
            return;
        }

        // Check slot availability (use first treatment as reference)
        var firstTreatment = appState.selectedTreatments[patients[0].id];
        var dateKey = formatDateKey(date);
        return mockCheckSlotAvailability(firstTreatment.id, dateKey, false);
    }).then(function(slotsResult) {
        if (!slotsResult) return;
        
        // Show availability message
        if (slotsResult.message) {
            var alertType = slotsResult.availableTimes.length > 0 ? 'info' : 'warning';
            showAlert('bulk-slot-availability-message', alertType, 
                     slotsResult.availableTimes.length > 0 ? '予約可能な時間' : '空き状況', 
                     slotsResult.message);
        } else {
            hideAlert('bulk-slot-availability-message');
        }

        // Update time slots
        var timeSlotsContainer = document.getElementById('bulk-time-slots');
        if (!timeSlotsContainer) return;
        
        timeSlotsContainer.innerHTML = '';
        
        if (slotsResult.availableTimes.length > 0) {
            for (var i = 0; i < slotsResult.availableTimes.length; i++) {
                var time = slotsResult.availableTimes[i];
                var timeSlot = createElement('button', 
                    'time-slot px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-teal-50 cursor-pointer text-center text-sm transition-all', 
                    time);
                timeSlot.onclick = (function(time) {
                    return function() {
                        selectBulkTimeSlot(time);
                    };
                })(time);
                timeSlotsContainer.appendChild(timeSlot);
            }
            timeSlotsContainer.classList.remove('hidden');
        } else {
            timeSlotsContainer.classList.add('hidden');
        }
    });
}

function selectBulkTimeSlot(time) {
    console.log('selectBulkTimeSlot called with time:', time);
    appState.selectedTimes['bulk'] = time;
    
    // Update UI
    var timeSlots = document.querySelectorAll('#bulk-time-slots .time-slot');
    for (var i = 0; i < timeSlots.length; i++) {
        timeSlots[i].classList.remove('selected', 'bg-teal-600', 'text-white');
        timeSlots[i].classList.add('bg-white', 'hover:bg-teal-50');
    }
    
    var clickedElement = event && event.currentTarget ? event.currentTarget : null;
    if (clickedElement) {
        clickedElement.classList.add('selected', 'bg-teal-600', 'text-white');
        clickedElement.classList.remove('bg-white', 'hover:bg-teal-50');
    }
    
    setTimeout(function() {
        updateBulkNextButtonState();
    }, 50);
}

function updateBulkNextButtonState() {
    var nextBtn = document.getElementById('next-bulk-booking-btn');
    if (!nextBtn) return;
    
    var patients = appState.selectedPatientsForBooking;
    
    var hasAllTreatments = patients.every(function(p) {
        return appState.selectedTreatments[p.id];
    });
    
    var hasAllRequired = hasAllTreatments &&
        appState.selectedDates['bulk'] &&
        appState.selectedTimes['bulk'];
    
    nextBtn.disabled = !hasAllRequired;
}

// =====================================
// Screen initialization based on current screen
// =====================================

var screenInitializers = {
    'menu-calendar': initMenuCalendarScreen,
    'pair-booking': initPairBookingScreen,
    'bulk-booking': initBulkBookingScreen
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
// Event Listeners and Initialization
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
    
    // Set dummy LINE user for testing
    appState.setLineUser({
        userId: "testUser123",
        displayName: "テスト ユーザー",
        pictureUrl: "/placeholder.svg?width=100&height=100"
    });
    
    // Force set initial screen to patient-selection
    appState.setScreen('patient-selection');
    
    console.log('App initialization complete');
});

// Backup initialization for older browsers
window.addEventListener('load', function() {
    if (appState.currentScreen !== 'patient-selection') {
        console.log('Backup initialization triggered');
        appState.currentScreen = 'patient-selection';
        appState.updateUI();
    }
});

// Make functions globally accessible for inline event handlers
window.toggleAccordion = toggleAccordion;
window.selectTreatment = selectTreatment;
window.selectTimeSlot = selectTimeSlot;
window.selectPairTimeSlot = selectPairTimeSlot;
window.selectBulkTimeSlot = selectBulkTimeSlot;