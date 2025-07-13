// Application State
let appState = {
    userStatus: 'unknown',
    authDetails: {},
    currentStep: 0,
    selectedTreatments: [],
    selectedDate: null,
    selectedTime: null,
    customerInfo: {
        name: '',
        phone: '',
        bookingType: 'member_self',
        companionCount: 0
    },
    reservationDetails: null
};

// Treatment Categories Data
const treatmentCategories = [
    {
        id: "cat1",
        name: "自院オリジナル幹細胞培養上清液 点滴 (初回の方)",
        items: [
            { id: "t1", name: "免疫活力インフィニティ 3cc (初回)", duration: "約120分", price: "プラチナプラン内" },
            { id: "t2", name: "免疫活力インフィニティ 6cc (初回)", duration: "約120分", price: "プラチナプラン内" },
            { id: "t3", name: "免疫再生プレミア 1cc (初回)", duration: "約120分", price: "80,000円 (20%OFF価格)" },
            { id: "t4", name: "神経プレミア 1cc (初回)", duration: "約120分", price: "80,000円 (20%OFF価格)" }
        ]
    },
    {
        id: "cat2",
        name: "自院オリジナル幹細胞培養上清液 点滴 (2回目以降の方)",
        items: [
            { id: "t5", name: "免疫活力インフィニティ 3cc (2回目以降)", duration: "約90分", price: "会員価格" },
            { id: "t6", name: "免疫再生プレミア 1cc (2回目以降)", duration: "約90分", price: "会員価格" }
        ]
    },
    {
        id: "cat3",
        name: "NAD+注射 (初回の方)",
        items: [
            { id: "t7", name: "NAD+注射 100mg", duration: "約60分", price: "30,000円" },
            { id: "t8", name: "NAD+注射 200mg", duration: "約90分", price: "55,000円" }
        ]
    }
];

// Time Slots Data
const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Generate mock time slots data
const generateTimeSlots = () => {
    const timeSlotsData = {};
    const today = new Date();
    
    // Generate data for next 30 days
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateKey = formatDateKey(date);
        
        timeSlotsData[dateKey] = [
            { time: "10:00", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "10:30", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "11:00", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "11:30", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "12:00", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "12:30", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "13:00", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "13:30", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "14:00", status: Math.random() > 0.5 ? "available" : "unavailable" },
            { time: "14:30", status: Math.random() > 0.5 ? "available" : "unavailable" }
        ];
    }
    
    return timeSlotsData;
};

const timeSlotsData = generateTimeSlots();

// Utility Functions
const showScreen = (screenId) => {
    const screens = ['loginScreen', 'homeScreen', 'reservationSteps', 'completionScreen'];
    screens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle('hidden', id !== screenId);
        }
    });
};

const updateStepIndicator = (currentStep) => {
    const steps = [
        { id: 'step1', name: 'メニューの選択' },
        { id: 'step2', name: '日時選択' },
        { id: 'step3', name: 'お客様情報の入力' },
        { id: 'step4', name: '予約内容確認' }
    ];
    
    steps.forEach((step, index) => {
        const circle = document.getElementById(`${step.id}-circle`);
        const text = document.getElementById(`${step.id}-text`);
        const connector = document.getElementById(`connector${index + 1}`);
        
        if (circle && text) {
            if (currentStep > index + 1) {
                // Completed step
                circle.className = 'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 bg-teal-500 border-teal-500 text-white';
                text.className = 'mt-2 text-xs sm:text-sm text-center text-gray-500';
            } else if (currentStep === index + 1) {
                // Current step
                circle.className = 'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 bg-white border-teal-500 text-teal-500';
                text.className = 'mt-2 text-xs sm:text-sm text-center text-teal-600 font-semibold';
            } else {
                // Future step
                circle.className = 'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 bg-gray-200 border-gray-300 text-gray-500';
                text.className = 'mt-2 text-xs sm:text-sm text-center text-gray-500';
            }
        }
        
        if (connector) {
            connector.className = currentStep > index + 1 ? 
                'flex-1 h-1 bg-teal-500 max-w-12 sm:max-w-16 md:max-w-20' : 
                'flex-1 h-1 bg-gray-300 max-w-12 sm:max-w-16 md:max-w-20';
        }
    });
    
    // Update step title
    const stepTitle = document.getElementById('stepTitle');
    if (stepTitle && steps[currentStep - 1]) {
        stepTitle.textContent = steps[currentStep - 1].name;
    }
};

const showStep = (stepNumber) => {
    const steps = ['step1Content', 'step2Content', 'step3Content', 'step4Content'];
    steps.forEach((stepId, index) => {
        const element = document.getElementById(stepId);
        if (element) {
            element.classList.toggle('hidden', index + 1 !== stepNumber);
        }
    });
    updateStepIndicator(stepNumber);
};

// Login Functions
const handleLogin = () => {
    const userId = document.getElementById('userId').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (userId && password) {
        appState.userStatus = 'authenticated';
        appState.authDetails = { userId };
        
        // Update UI
        document.getElementById('userIdDisplay').textContent = userId;
        document.getElementById('welcomeUserId').textContent = userId;
        document.getElementById('logoutBtn').classList.remove('hidden');
        
        showScreen('homeScreen');
    } else {
        alert('IDとパスワードを入力してください。');
    }
};

const handleLogout = () => {
    appState = {
        userStatus: 'unknown',
        authDetails: {},
        currentStep: 0,
        selectedTreatments: [],
        selectedDate: null,
        selectedTime: null,
        customerInfo: {
            name: '',
            phone: '',
            bookingType: 'member_self',
            companionCount: 0
        },
        reservationDetails: null
    };
    
    // Reset form fields
    document.getElementById('userId').value = '';
    document.getElementById('password').value = '';
    document.getElementById('logoutBtn').classList.add('hidden');
    
    showScreen('loginScreen');
};

// Menu Selection Functions
const renderMenuCategories = () => {
    const container = document.getElementById('menuCategories');
    if (!container) return;
    
    container.innerHTML = '';
    
    treatmentCategories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'border border-gray-200 rounded-md bg-white';
        
        const header = document.createElement('div');
        header.className = 'px-4 py-3 hover:bg-slate-50 rounded-t-md text-teal-700 font-medium cursor-pointer flex justify-between items-center';
        header.innerHTML = `
            <span>${category.name}</span>
            <svg class="accordion-trigger w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        `;
        
        const content = document.createElement('div');
        content.className = 'accordion-content collapsed px-4 pt-2 pb-4 border-t bg-white rounded-b-md';
        
        const itemsList = document.createElement('ul');
        itemsList.className = 'space-y-3';
        
        category.items.forEach(item => {
            const listItem = document.createElement('li');
            const isSelected = appState.selectedTreatments.some(t => t.id === item.id);
            listItem.className = `treatment-item p-3 rounded-md ${isSelected ? 'selected' : ''}`;
            
            listItem.innerHTML = `
                <label class="flex items-start space-x-3 cursor-pointer">
                    <input type="checkbox" class="checkbox mt-1" ${isSelected ? 'checked' : ''} data-item-id="${item.id}" data-category-id="${category.id}">
                    <div class="flex-1">
                        <span class="font-medium text-gray-800">${item.name}</span>
                        <p class="text-xs text-gray-600">時間目安: ${item.duration}</p>
                        <p class="text-xs text-gray-600">目安金額: ${item.price}</p>
                    </div>
                </label>
            `;
            
            const checkbox = listItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => handleTreatmentToggle(item, category.id));
            
            itemsList.appendChild(listItem);
        });
        
        content.appendChild(itemsList);
        categoryDiv.appendChild(header);
        categoryDiv.appendChild(content);
        
        // Add accordion functionality
        header.addEventListener('click', () => {
            const isExpanded = !content.classList.contains('collapsed');
            content.classList.toggle('collapsed', isExpanded);
            header.querySelector('.accordion-trigger').classList.toggle('open', !isExpanded);
        });
        
        container.appendChild(categoryDiv);
    });
    
    updateMenuNextButton();
};

const handleTreatmentToggle = (treatment, categoryId) => {
    const isSelected = appState.selectedTreatments.some(t => t.id === treatment.id);
    
    if (isSelected) {
        appState.selectedTreatments = appState.selectedTreatments.filter(t => t.id !== treatment.id);
    } else {
        appState.selectedTreatments.push({ ...treatment, categoryId });
    }
    
    // Update UI
    renderMenuCategories();
    updateMenuNextButton();
};

const updateMenuNextButton = () => {
    const nextButton = document.getElementById('nextToSchedule');
    if (nextButton) {
        nextButton.disabled = appState.selectedTreatments.length === 0;
    }
};

// Calendar Functions
const renderCalendar = () => {
    const container = document.getElementById('calendar');
    if (!container) return;
    
    const today = new Date();
    const currentMonth = appState.selectedDate || today;
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const monthNames = [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    
    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="flex justify-between items-center">
                <button id="prevMonth" class="p-2 hover:bg-gray-100 rounded">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                </button>
                <h3 class="text-lg font-semibold">${year}年 ${monthNames[month]}</h3>
                <button id="nextMonth" class="p-2 hover:bg-gray-100 rounded">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center">
            <div class="font-semibold text-sm text-gray-600 p-2">日</div>
            <div class="font-semibold text-sm text-gray-600 p-2">月</div>
            <div class="font-semibold text-sm text-gray-600 p-2">火</div>
            <div class="font-semibold text-sm text-gray-600 p-2">水</div>
            <div class="font-semibold text-sm text-gray-600 p-2">木</div>
            <div class="font-semibold text-sm text-gray-600 p-2">金</div>
            <div class="font-semibold text-sm text-gray-600 p-2">土</div>
        </div>
        <div id="calendarGrid" class="grid grid-cols-7 gap-1">
        </div>
    `;
    
    const grid = document.getElementById('calendarGrid');
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'p-2';
        grid.appendChild(emptyCell);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = appState.selectedDate && date.toDateString() === appState.selectedDate.toDateString();
        const isPast = date < today;
        
        const dayCell = document.createElement('div');
        dayCell.className = `calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isPast ? 'disabled' : ''}`;
        dayCell.textContent = day;
        
        if (!isPast) {
            dayCell.addEventListener('click', () => {
                appState.selectedDate = date;
                appState.selectedTime = null; // Reset time when date changes
                renderCalendar();
                renderTimeSlotTable();
                updateSelectedDateDisplay();
                updateScheduleNextButton();
            });
        }
        
        grid.appendChild(dayCell);
    }
    
    // Add month navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        const newDate = new Date(year, month - 1, 1);
        if (newDate >= new Date(today.getFullYear(), today.getMonth(), 1)) {
            renderCalendarForMonth(newDate);
        }
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        renderCalendarForMonth(new Date(year, month + 1, 1));
    });
};

const renderCalendarForMonth = (date) => {
    appState.selectedDate = date;
    renderCalendar();
};

// Time Slot Functions
const renderTimeSlotTable = () => {
    const table = document.getElementById('timeSlotTable');
    if (!table) return;
    
    const currentWeekStart = getCurrentWeekStart();
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const timeGrid = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30'];
    
    // Generate week days
    const displayDays = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(currentWeekStart);
        day.setDate(currentWeekStart.getDate() + i);
        displayDays.push(day);
    }
    
    // Create table header
    let headerHtml = '<thead><tr class="bg-slate-50"><th class="p-2 border text-xs sm:text-sm text-gray-600">時間</th>';
    displayDays.forEach(day => {
        const isSelected = appState.selectedDate && day.toDateString() === appState.selectedDate.toDateString();
        headerHtml += `<th class="p-2 border text-xs sm:text-sm text-gray-600 ${isSelected ? 'bg-teal-100' : ''}">${day.getMonth() + 1}/${day.getDate()} (${weekDays[day.getDay()]})</th>`;
    });
    headerHtml += '</tr></thead>';
    
    // Create table body
    let bodyHtml = '<tbody>';
    timeGrid.forEach(time => {
        bodyHtml += `<tr><td class="p-2 border text-xs sm:text-sm text-gray-700 font-medium">${time}</td>`;
        
        displayDays.forEach(day => {
            const dateKey = formatDateKey(day);
            const daySlots = timeSlotsData[dateKey] || [];
            const slotInfo = daySlots.find(s => s.time === time);
            const isSelected = appState.selectedDate && appState.selectedDate.toDateString() === day.toDateString() && appState.selectedTime === time;
            const isSelectedDay = appState.selectedDate && day.toDateString() === appState.selectedDate.toDateString();
            
            let displayChar = '-';
            let isClickable = false;
            
            if (slotInfo) {
                if (slotInfo.status === 'available') {
                    displayChar = '○';
                    isClickable = true;
                } else {
                    displayChar = '×';
                }
            }
            
            bodyHtml += `
                <td class="p-2 border text-lg ${isSelectedDay ? 'bg-teal-50' : ''}">
                    <button 
                        class="time-slot ${isClickable ? 'available' : 'unavailable'} ${isSelected ? 'selected' : ''}"
                        data-date="${day.toISOString()}"
                        data-time="${time}"
                        ${!isClickable ? 'disabled' : ''}
                    >
                        ${displayChar}
                    </button>
                </td>
            `;
        });
        
        bodyHtml += '</tr>';
    });
    bodyHtml += '</tbody>';
    
    table.innerHTML = headerHtml + bodyHtml;
    
    // Add click handlers for available time slots
    table.querySelectorAll('.time-slot.available').forEach(button => {
        button.addEventListener('click', () => {
            const date = new Date(button.dataset.date);
            const time = button.dataset.time;
            
            appState.selectedDate = date;
            appState.selectedTime = time;
            
            renderCalendar();
            renderTimeSlotTable();
            updateSelectedDateDisplay();
            updateScheduleNextButton();
        });
    });
};

const getCurrentWeekStart = () => {
    const d = appState.selectedDate || new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const updateSelectedDateDisplay = () => {
    const display = document.getElementById('selectedDateDisplay');
    if (display) {
        if (appState.selectedDate) {
            display.textContent = appState.selectedDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } else {
            display.textContent = '日付を選択';
        }
    }
};

const updateScheduleNextButton = () => {
    const nextButton = document.getElementById('nextToCustomer');
    if (nextButton) {
        nextButton.disabled = !appState.selectedDate || !appState.selectedTime;
    }
};

// Customer Info Functions
const updateCustomerInfoForm = () => {
    const nameInput = document.getElementById('customerName');
    const phoneInput = document.getElementById('customerPhone');
    const companionSection = document.getElementById('companionSection');
    const memberWithCompanion = document.getElementById('member_with_companion');
    
    if (nameInput) nameInput.value = appState.customerInfo.name;
    if (phoneInput) phoneInput.value = appState.customerInfo.phone;
    
    // Show/hide companion section
    if (companionSection) {
        companionSection.classList.toggle('hidden', appState.customerInfo.bookingType !== 'member_with_companion');
    }
    
    // Update companion count
    const companionSelect = document.getElementById('companionCount');
    if (companionSelect) {
        companionSelect.value = appState.customerInfo.companionCount.toString();
    }
    
    updateCustomerNextButton();
};

const updateCustomerNextButton = () => {
    const nextButton = document.getElementById('nextToConfirmation');
    if (nextButton) {
        const isValid = appState.customerInfo.name.trim() !== '' && appState.customerInfo.phone.trim() !== '';
        nextButton.disabled = !isValid;
    }
};

// Confirmation Functions
const updateConfirmationDisplay = () => {
    // Customer Info
    const customerInfoDiv = document.getElementById('confirmCustomerInfo');
    if (customerInfoDiv) {
        let userDescription = `ログインID: ${appState.authDetails.userId}`;
        if (appState.customerInfo.bookingType === 'member_self') {
            userDescription += ' (ご本人様のみ)';
        } else if (appState.customerInfo.bookingType === 'member_with_companion') {
            userDescription += ` (ご本人様 + 同伴者 ${appState.customerInfo.companionCount}名)`;
        }
        
        customerInfoDiv.innerHTML = `
            <p>お名前: ${appState.customerInfo.name}</p>
            <p>電話番号: ${appState.customerInfo.phone}</p>
            <p>予約詳細: ${userDescription}</p>
        `;
    }
    
    // Treatments
    const treatmentsDiv = document.getElementById('confirmTreatments');
    if (treatmentsDiv) {
        if (appState.selectedTreatments.length > 0) {
            const treatmentsList = appState.selectedTreatments.map(treatment => 
                `<li>${treatment.name} <span class="text-xs text-gray-500">(${treatment.duration}, ${treatment.price})</span></li>`
            ).join('');
            treatmentsDiv.innerHTML = `<ul class="list-disc list-inside space-y-1 pl-2">${treatmentsList}</ul>`;
        } else {
            treatmentsDiv.innerHTML = '<p>メニューが選択されていません。</p>';
        }
    }
    
    // Date and Time
    const dateTimeDiv = document.getElementById('confirmDateTime');
    if (dateTimeDiv) {
        const formattedDate = appState.selectedDate ? 
            appState.selectedDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            }) : '未選択';
        
        