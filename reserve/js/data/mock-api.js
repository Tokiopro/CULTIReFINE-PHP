// data/mock-api.js
// Mock API関数群

import { formatDateKey } from './treatment-data.js';

export function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

export function mockAddPatient(patientData) {
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

export function mockCheckTreatmentInterval(patientId, treatmentId, desiredDate) {
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

export function mockCheckSlotAvailability(treatmentId, dateKey, pairRoomDesired) {
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

export function mockSubmitBulkReservation(bookings, lineUserId) {
    console.log("[API Mock] Submitting bulk reservations for LINE User:", lineUserId, bookings);
    return delay(1000).then(function() {
        return { 
            success: true, 
            reservationId: "MOCKRES-" + Date.now(), 
            message: "予約が正常に確定されました。" 
        };
    });
}