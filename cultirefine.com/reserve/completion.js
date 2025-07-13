// CLUTIREFINEクリニック予約システム - 予約完了画面 JavaScript
// エンコーディング: UTF-8

// =====================================
// データ読み込み
// =====================================

var StorageManager = {
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
// メイン処理
// =====================================

var completionData = null;

function loadCompletionData() {
    completionData = StorageManager.load('clutirefine_completion_data');
    
    if (!completionData || !completionData.bookings || completionData.bookings.length === 0) {
        alert('予約完了データが見つかりません。');
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

function updateCompletionScreen() {
    if (!completionData) return;
    
    var reservationNumberElement = document.getElementById('reservation-number');
    var completionMessageElement = document.getElementById('completion-message');
    var completedBookingsContainer = document.getElementById('completed-bookings');
    var userNameElement = document.getElementById('user-name');

    if (!reservationNumberElement || !completionMessageElement || !completedBookingsContainer) return;

    // Update user name
    if (userNameElement && completionData.lineUser) {
        userNameElement.textContent = completionData.lineUser.displayName;
    }

    // Set reservation number
    var reservationNumber = completionData.reservationId || ('RES-' + Date.now().toString().slice(-6));
    reservationNumberElement.textContent = reservationNumber;
    
    // Set completion message
    var patientNames = completionData.bookings.map(function(b) { return b.patientName; }).join('様、');
    completionMessageElement.textContent = patientNames + '様のご予約を承りました。詳細はLINEメッセージでもお送りしました。';

    // Populate completed bookings
    completedBookingsContainer.innerHTML = '';
    
    for (var i = 0; i < completionData.bookings.length; i++) {
        var booking = completionData.bookings[i];
        var bookingElement = document.createElement('div');
        bookingElement.className = 'completed-booking p-3 border border-gray-200 rounded-md bg-slate-50';
        
        var selectedDate = '';
        if (booking.selectedDate) {
            var date = new Date(booking.selectedDate);
            selectedDate = date.toLocaleDateString('ja-JP');
        }
        
        bookingElement.innerHTML = 
            '<p class="patient-name font-medium text-teal-700">' + (booking.patientName || '名前未設定') + ' 様</p>' +
            '<p class="booking-detail text-sm">' + (booking.treatment ? booking.treatment.name : '施術未設定') + '</p>' +
            '<p class="booking-detail text-sm">' + selectedDate + ' ' + (booking.selectedTime || '時間未設定') + '</p>' +
            '<button class="calendar-download-btn text-xs text-teal-600 hover:text-teal-700 underline cursor-pointer bg-none border-none p-0 mt-1" onclick="downloadCalendarEvent(' + i + ')">' +
                '📅 カレンダーに追加 (.ics)' +
            '</button>';
        
        completedBookingsContainer.appendChild(bookingElement);
    }
}

function downloadCalendarEvent(bookingIndex) {
    if (!completionData || !completionData.bookings[bookingIndex]) return;
    
    var booking = completionData.bookings[bookingIndex];
    if (!booking.selectedDate || !booking.selectedTime || !booking.treatment) return;

    var startDate = new Date(booking.selectedDate);
    var timeParts = booking.selectedTime.split(':');
    var hours = parseInt(timeParts[0], 10);
    var minutes = parseInt(timeParts[1], 10);
    startDate.setHours(hours, minutes, 0, 0);

    var endDate = new Date(startDate);
    var durationMinutes = 60; // Default duration
    if (booking.treatment.duration) {
        var durationMatch = booking.treatment.duration.match(/(\d+)/);
        durationMinutes = durationMatch ? parseInt(durationMatch[1], 10) : 60;
    }
    endDate.setMinutes(startDate.getMinutes() + durationMinutes);

    function formatDateICS(date) {
        return date.toISOString().replace(/-|:|\.\d{3}/g, '');
    }

    var icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CLUTIREFINEクリニック//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        'UID:' + new Date().getTime() + '@clutirefine.com',
        'DTSTAMP:' + formatDateICS(new Date()),
        'DTSTART:' + formatDateICS(startDate),
        'DTEND:' + formatDateICS(endDate),
        'SUMMARY:CLUTIREFINEクリニック予約: ' + booking.treatment.name + ' (' + booking.patientName + '様)',
        'DESCRIPTION:CLUTIREFINEクリニックでのご予約です。詳細はクリニックにご確認ください。',
        'LOCATION:CLUTIREFINEクリニック (東京都中央区銀座X-X-X)',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');

    var blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'clutirefine_booking_' + booking.patientName + '.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function initCompletionScreen() {
    var bookAnotherBtn = document.getElementById('book-another-btn');
    var logoutBtn = document.getElementById('logout-btn');

    if (bookAnotherBtn) {
        bookAnotherBtn.addEventListener('click', function() {
            // Clear all stored data
            StorageManager.remove('clutirefine_booking_data');
            StorageManager.remove('clutirefine_completion_data');
            
            // Go back to main page
            window.location.href = 'index.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Clear all stored data
            StorageManager.remove('clutirefine_booking_data');
            StorageManager.remove('clutirefine_completion_data');
            
            // Go back to login
            window.location.href = 'index.html';
        });
    }
}

// =====================================
// 初期化
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Completion page loaded');
    
    // Set current year
    var currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    // Load and validate data
    if (loadCompletionData()) {
        updateCompletionScreen();
        initCompletionScreen();
    }
});

// Backup initialization
window.addEventListener('load', function() {
    if (!completionData) {
        console.log('Backup initialization for completion page');
        if (loadCompletionData()) {
            updateCompletionScreen();
        }
    }
});

// Make downloadCalendarEvent globally accessible
window.downloadCalendarEvent = downloadCalendarEvent;