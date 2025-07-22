// components/calendar.js
// カレンダーコンポーネントモジュール

export function Calendar(containerId, onDateSelect, options = {}) {
    this.container = document.getElementById(containerId);
    this.onDateSelect = onDateSelect;
    this.currentDate = new Date();
    this.selectedDate = null;
    this.containerId = containerId;
    this.availableSlots = {}; // 日付ごとの空き情報
    this.isLoading = false;
    this.options = options;
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
    
    // ローディング中の表示
    if (this.isLoading) {
        html += '<div class="calendar-loading text-center py-4">';
        html += '<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>';
        html += '<p class="mt-2 text-gray-600">空き情報を取得しています...</p>';
        html += '</div>';
    }
    
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
        var dateKey = this.formatDateKey(date);
        var isToday = date.toDateString() === today.toDateString();
        var isPast = date < today;
        var isSelected = this.selectedDate && date.toDateString() === this.selectedDate.toDateString();
        var availability = this.availableSlots[dateKey];
        
        var className = 'calendar-day relative w-10 h-10 flex flex-col items-center justify-center text-sm border-none bg-none rounded-md cursor-pointer transition-all';
        if (isToday) className += ' today bg-gray-100';
        if (isSelected) className += ' selected bg-teal-500 text-white';
        if (isPast) className += ' disabled text-gray-400 cursor-not-allowed opacity-50';
        if (!isPast && !isSelected) className += ' hover:bg-gray-100';

        html += '<button class="' + className + '" ';
        html += 'onclick="calendarSelectDate(\'' + this.containerId + '\', ' + year + ', ' + month + ', ' + day + ')"';
        if (isPast) html += ' disabled';
        html += '>';
        html += '<span>' + day + '</span>';
        
        // 空き情報のインジケーター
        if (availability && !isPast) {
            var indicatorClass = 'absolute bottom-0 w-2 h-2 rounded-full ';
            if (availability.totalSlots === 0) {
                indicatorClass += 'bg-red-500'; // 満席
            } else if (availability.totalSlots <= 3) {
                indicatorClass += 'bg-yellow-500'; // わずか
            } else {
                indicatorClass += 'bg-green-500'; // 空きあり
            }
            html += '<span class="' + indicatorClass + '"></span>';
        }
        
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

// 日付をYYYY-MM-DD形式にフォーマット
Calendar.prototype.formatDateKey = function(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
};

// 空き情報を設定
Calendar.prototype.setAvailableSlots = function(availableSlots) {
    this.availableSlots = {};
    
    if (availableSlots && Array.isArray(availableSlots)) {
        availableSlots.forEach(daySlots => {
            var totalAvailable = 0;
            if (daySlots.slots && Array.isArray(daySlots.slots)) {
                totalAvailable = daySlots.slots.filter(slot => slot.is_available).length;
            }
            this.availableSlots[daySlots.date] = {
                totalSlots: totalAvailable,
                slots: daySlots.slots || []
            };
        });
    }
    
    this.render();
};

// ローディング状態を設定
Calendar.prototype.setLoading = function(isLoading) {
    this.isLoading = isLoading;
    this.render();
};

// Global calendar instances
export const calendars = {};

// Global functions for calendar navigation
export function calendarPreviousMonth(containerId) {
    if (calendars[containerId]) {
        calendars[containerId].previousMonth();
    }
}

export function calendarNextMonth(containerId) {
    if (calendars[containerId]) {
        calendars[containerId].nextMonth();
    }
}

export function calendarSelectDate(containerId, year, month, day) {
    if (calendars[containerId]) {
        calendars[containerId].selectDate(year, month, day);
    }
}