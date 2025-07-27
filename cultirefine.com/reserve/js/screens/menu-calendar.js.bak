// screens/menu-calendar.js
// メニュー・カレンダー画面モジュール（個別予約）

import { appState } from '../core/app-state.js';
import { Calendar, calendars } from '../components/calendar.js';
import { createTreatmentAccordion } from '../components/treatment-accordion.js';
import { showAlert, hideAlert, createElement } from '../core/ui-helpers.js';
import { mockCheckTreatmentInterval, mockCheckSlotAvailability } from '../data/gas-api.js';
import { formatDateKey } from '../data/treatment-data.js';

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

export function updateMenuCalendarScreen() {
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

export function selectTimeSlot(patientId, time) {
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

export function updateNextButtonState() {
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