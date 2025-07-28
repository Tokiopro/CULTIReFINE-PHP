// screens/pair-booking.js
// ペア予約画面モジュール

import { appState } from '../core/app-state.js';
import { Calendar, calendars } from '../components/calendar.js';
import { createTreatmentAccordion } from '../components/treatment-accordion.js';
import { showAlert, hideAlert, createElement } from '../core/ui-helpers.js';
import { mockCheckTreatmentInterval, mockCheckSlotAvailability } from '../data/gas-api.js';
import { formatDateKey } from '../data/treatment-data.js';

export function initPairBookingScreen() {
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

        // ペア予約データを準備
        const reservationData = {
            type: 'multiple',
            selectedDate: date,
            selectedTime: time,
            pairBooking: true,
            patients: [
                {
                    id: patient1.id,
                    name: patient1.name,
                    selectedMenus: Array.isArray(treatment1) ? treatment1 : [treatment1]
                },
                {
                    id: patient2.id,
                    name: patient2.name,
                    selectedMenus: Array.isArray(treatment2) ? treatment2 : [treatment2]
                }
            ]
        };

        // 確認モーダルを表示
        import('../components/reservation-confirm.js').then(function(module) {
            module.showReservationConfirmModal(reservationData, async function(data) {
                const mainModule = await import('../main.js');
                await mainModule.createMultipleReservations(data);
            });
        });
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

    // current-userの場合は実際のvisitor_idを使用
    const actualPatient1Id = patient1.id === 'current-user' 
        ? (window.APP_CONFIG?.currentUserVisitorId || patient1.id)
        : patient1.id;
    const actualPatient2Id = patient2.id === 'current-user' 
        ? (window.APP_CONFIG?.currentUserVisitorId || patient2.id)
        : patient2.id;
    
    console.log('Pair booking: patient1', patient1.id, 'actualId:', actualPatient1Id);
    console.log('Pair booking: patient2', patient2.id, 'actualId:', actualPatient2Id);
    
    createTreatmentAccordion('patient1-treatments', actualPatient1Id);
    createTreatmentAccordion('patient2-treatments', actualPatient2Id);
    
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

export function selectPairTimeSlot(time) {
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

export function updatePairNextButtonState() {
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