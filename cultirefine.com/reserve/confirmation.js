// CLUTIREFINEクリニック予約システム - 予約確認画面 JavaScript
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
    
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('localStorage not available');
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

// Mock API Functions
function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
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
// メイン処理
// =====================================

var bookingData = null;

function loadBookingData() {
    bookingData = StorageManager.load('clutirefine_booking_data');
    
    if (!bookingData || !bookingData.bookings || bookingData.bookings.length === 0) {
        alert('予約データが見つかりません。最初からやり直してください。');
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

function updateConfirmationScreen() {
    if (!bookingData) return;
    
    var summaryContainer = document.getElementById('booking-summary');
    var totalDurationElement = document.getElementById('total-duration');
    var userNameElement = document.getElementById('user-name');
    
    if (!summaryContainer || !totalDurationElement) return;
    
    // Update user name
    if (userNameElement && bookingData.lineUser) {
        userNameElement.textContent = bookingData.lineUser.displayName;
    }
    
    summaryContainer.innerHTML = '';
    var totalMinutes = 0;

    for (var i = 0; i < bookingData.bookings.length; i++) {
        var booking = bookingData.bookings[i];
        var bookingElement = document.createElement('div');
        bookingElement.className = 'booking-item p-4 border border-gray-200 rounded-lg bg-slate-50 shadow-sm';
        
        // Extract duration in minutes
        var duration = 0;
        if (booking.treatment && booking.treatment.duration) {
            var durationMatch = booking.treatment.duration.match(/(\d+)/);
            duration = durationMatch ? parseInt(durationMatch[1], 10) : 0;
        }
        totalMinutes += duration;

        var selectedDate = '';
        if (booking.selectedDate) {
            var date = new Date(booking.selectedDate);
            selectedDate = date.toLocaleDateString('ja-JP');
        }

        var pairIndicator = booking.pairRoomDesired ? 
            '<p class="pair-booking-indicator text-pink-600 font-medium">ペア施術希望</p>' : '';
        
        var conflictIndicator = booking.status === 'conflict' ? 
            '<p class="conflict-indicator text-red-600 font-medium flex items-center"><span class="mr-1">⚠️</span>時間競合の可能性あり</p>' : '';

        bookingElement.innerHTML = 
            '<h3 class="text-lg font-semibold text-teal-700 mb-2">' + (booking.patientName || '名前未設定') + ' 様</h3>' +
            '<div class="booking-details text-sm space-y-1">' +
                '<p><strong>施術メニュー:</strong> ' + (booking.treatment ? booking.treatment.name : '未選択') + '</p>' +
                '<p><strong>日時:</strong> ' + selectedDate + ' ' + (booking.selectedTime || '未選択') + '</p>' +
                pairIndicator +
                conflictIndicator +
            '</div>';

        summaryContainer.appendChild(bookingElement);
    }

    totalDurationElement.textContent = totalMinutes;
}

function initConfirmationScreen() {
    var editBtn = document.getElementById('edit-booking-btn');
    var confirmBtn = document.getElementById('confirm-booking-btn');
    var logoutBtn = document.getElementById('logout-btn');

    if (editBtn) {
        editBtn.addEventListener('click', function() {
            if (bookingData && bookingData.isPairBookingMode) {
                window.location.href = 'index.html#pair-booking';
            } else {
                window.location.href = 'index.html#menu-calendar';
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="mr-2">⏳</span> 予約確定中...';

            var lineUserId = bookingData && bookingData.lineUser ? bookingData.lineUser.userId : 'unknown';
            
            mockSubmitBulkReservation(bookingData.bookings, lineUserId).then(function(result) {
                if (result.success) {
                    // Save reservation ID
                    var completionData = {
                        reservationId: result.reservationId,
                        bookings: bookingData.bookings,
                        lineUser: bookingData.lineUser,
                        completedAt: new Date().toISOString()
                    };
                    StorageManager.save('clutirefine_completion_data', completionData);
                    
                    // Clear booking data
                    StorageManager.remove('clutirefine_booking_data');
                    
                    // Redirect to completion page
                    window.location.href = 'completion.html';
                } else {
                    alert('予約確定に失敗しました: ' + result.message);
                }
            }).catch(function(error) {
                alert('予約確定中にエラーが発生しました。');
                console.error('Booking confirmation error:', error);
            }).finally(function() {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<span class="mr-2">✅</span> この内容で予約を確定する';
            });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            StorageManager.remove('clutirefine_booking_data');
            StorageManager.remove('clutirefine_completion_data');
            window.location.href = 'index.html';
        });
    }
}

// =====================================
// 初期化
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Confirmation page loaded');
    
    // Set current year
    var currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    // Load and validate data
    if (loadBookingData()) {
        updateConfirmationScreen();
        initConfirmationScreen();
    }
});

// Backup initialization
window.addEventListener('load', function() {
    if (!bookingData) {
        console.log('Backup initialization for confirmation page');
        if (loadBookingData()) {
            updateConfirmationScreen();
        }
    }
});