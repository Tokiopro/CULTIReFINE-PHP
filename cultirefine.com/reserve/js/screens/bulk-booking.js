// screens/bulk-booking.js
// 一括予約画面モジュール（3名以上の複数患者対応）

import { appState } from '../core/app-state.js';
import { Calendar, calendars } from '../components/calendar.js';
import { createTreatmentAccordion } from '../components/treatment-accordion.js';
import { showAlert, hideAlert, createElement } from '../core/ui-helpers.js';
import { mockCheckTreatmentInterval, mockCheckSlotAvailability } from '../data/gas-api.js';
import { formatDateKey } from '../data/treatment-data.js';

export function initBulkBookingScreen() {
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

export function selectBulkTimeSlot(time) {
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

export function updateBulkNextButtonState() {
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