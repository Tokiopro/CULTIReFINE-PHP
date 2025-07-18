// core/app-state.js
// アプリケーション状態管理モジュール

import { StorageManager } from './storage-manager.js';

export function AppState() {
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
    this.selectedTreatments = {}; // 複数メニュー対応: {patientId: [treatment1, treatment2, ...]}
    this.selectedDates = {};
    this.selectedTimes = {}; // 複数メニュー対応: {patientId: {treatmentId: time}}
    this.pairRoomDesired = {};
    this.patientMenus = {}; // 患者別メニューデータをキャッシュ
    this.selectedMenuIds = {}; // 選択されたメニューID: {patientId: [menuId1, menuId2, ...]}
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
export const appState = new AppState();