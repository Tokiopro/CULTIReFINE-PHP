// main.js
// メイン初期化・統合ファイル

// Core modules
import './core/polyfills.js';
import { appState } from './core/app-state.js';

// Components
import { calendarPreviousMonth, calendarNextMonth, calendarSelectDate } from './components/calendar.js';
import { toggleAccordion, createTreatmentAccordion } from './components/treatment-accordion.js';
import { initAddPatientModal } from './components/modal.js';

// Screens
import { 
    initPatientSelectionScreen, 
    updatePatientsList, 
    updateProceedButton,
    togglePatientSelection 
} from './screens/patient-selection.js';
import { 
    initMenuCalendarScreen,
    selectTimeSlot,
    updateNextButtonState
} from './screens/menu-calendar.js';

// GAS API and data
import { mockCheckTreatmentInterval, getUserFullInfo, mapGasDataToAppState } from './data/gas-api.js';
import { showAlert, hideAlert } from './core/ui-helpers.js';

// =====================================
// Treatment Selection Handler
// =====================================

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
        
        if (window.updateBulkNextButtonState) {
            window.updateBulkNextButtonState();
        }
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
        
        if (window.updatePairNextButtonState) {
            window.updatePairNextButtonState();
        }
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

// =====================================
// Screen Initializers Map
// =====================================

var screenInitializers = {
    'menu-calendar': initMenuCalendarScreen,
    'pair-booking': function() {
        // Import and initialize pair booking if needed
        import('./screens/pair-booking.js').then(function(module) {
            module.initPairBookingScreen();
        });
    },
    'bulk-booking': function() {
        // Import and initialize bulk booking if needed
        import('./screens/bulk-booking.js').then(function(module) {
            module.initBulkBookingScreen();
        });
    }
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
// Global Functions for HTML
// =====================================

// Make functions globally accessible for inline event handlers
window.toggleAccordion = toggleAccordion;
window.selectTreatment = selectTreatment;
window.selectTimeSlot = selectTimeSlot;
window.calendarPreviousMonth = calendarPreviousMonth;
window.calendarNextMonth = calendarNextMonth;
window.calendarSelectDate = calendarSelectDate;

// Make functions available for modal.js
window.updatePatientsList = updatePatientsList;
window.updateProceedButton = updateProceedButton;

// =====================================
// Application Initialization
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