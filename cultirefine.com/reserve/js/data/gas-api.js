// data/gas-api.js
// GAS API通信モジュール（mock-api.jsの置き換え）

// API基底URL
const API_BASE_URL = '/cultirefine.com/reserve/api-bridge.php';

/**
 * 遅延処理（UIの一貫性のため）
 */
export function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

/**
 * API呼び出し共通関数
 */
async function apiCall(action, params = {}, method = 'GET', data = null) {
    const url = new URL(API_BASE_URL, window.location.origin);
    url.searchParams.set('action', action);
    
    // GETパラメータを追加
    if (method === 'GET' && params) {
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });
    }
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'same-origin' // セッションCookieを含める
    };
    
    // POSTデータを追加
    if (method === 'POST' && data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url.toString(), options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error?.message || 'APIエラーが発生しました');
        }
        
        return result.data;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

/**
 * ユーザー全情報取得
 */
export async function getUserFullInfo() {
    console.log('[GAS API] Getting user full info');
    
    try {
        const data = await apiCall('getUserFullInfo');
        console.log('[GAS API] User data received:', data);
        return { success: true, data: data };
    } catch (error) {
        console.error('[GAS API] Error getting user info:', error);
        return { success: false, message: error.message };
    }
}

/**
 * 患者追加（実際のAPI連携）
 */
export async function mockAddPatient(patientData) {
    console.log('[GAS API] Adding patient:', patientData);
    
    try {
        // 必須フィールドのチェック
        if (!patientData.name || !patientData.kana || !patientData.gender) {
            throw new Error('必須フィールドが不足しています');
        }
        
        const visitorData = {
            name: patientData.name,
            kana: patientData.kana,
            gender: patientData.gender
        };
        
        // オプションフィールドの追加
        if (patientData.birthday) {
            visitorData.birthday = patientData.birthday;
        }
        
        const data = await apiCall('createVisitor', {}, 'POST', visitorData);
        
        // レスポンスデータを既存のフォーマットに変換
        const newPatient = {
            id: data.visitor_id,
            name: data.name,
            kana: data.kana,
            isNew: true,
            lastVisit: null,
            isVisible: true,
            companyId: data.company_id
        };
        
        console.log('[GAS API] Patient added successfully:', newPatient);
        return { 
            success: true, 
            patient: newPatient, 
            message: "来院者が正常に登録されました。" 
        };
        
    } catch (error) {
        console.error('[GAS API] Error adding patient:', error);
        return { 
            success: false, 
            message: error.message || "来院者の登録に失敗しました。" 
        };
    }
}

/**
 * 施術間隔チェック
 */
export async function mockCheckTreatmentInterval(patientId, treatmentId, desiredDate) {
    console.log('[GAS API] Checking treatment interval for:', patientId, treatmentId, desiredDate);
    
    try {
        // ユーザー情報から施術履歴を取得
        const userInfo = await getUserFullInfo();
        
        if (!userInfo.success) {
            throw new Error('ユーザー情報の取得に失敗しました');
        }
        
        const treatmentHistory = userInfo.data.treatmentHistory || [];
        const availableTreatments = userInfo.data.availableTreatments || [];
        
        // 指定された施術の情報を取得
        const treatment = availableTreatments.find(t => t.treatmentId === treatmentId);
        
        if (!treatment) {
            return { 
                success: false, 
                isValid: false, 
                message: "指定された施術が見つかりません" 
            };
        }
        
        // 予約可能かチェック
        if (!treatment.canBook) {
            return { 
                success: false, 
                isValid: false, 
                message: treatment.reason || "この施術は現在予約できません" 
            };
        }
        
        // 指定日が次回可能日以降かチェック
        const nextAvailable = new Date(treatment.nextAvailableDate);
        const desired = new Date(desiredDate);
        
        if (desired < nextAvailable) {
            return { 
                success: false, 
                isValid: false, 
                message: `この施術は${treatment.nextAvailableDate}以降に予約可能です` 
            };
        }
        
        return { success: true, isValid: true };
        
    } catch (error) {
        console.error('[GAS API] Error checking treatment interval:', error);
        return { 
            success: false, 
            isValid: false, 
            message: "施術間隔のチェックに失敗しました" 
        };
    }
}

/**
 * 空き時間確認
 */
export async function mockCheckSlotAvailability(treatmentId, dateKey, pairRoomDesired, timeSpacing = 5) {
    console.log('[GAS API] Checking slot availability for:', treatmentId, dateKey, pairRoomDesired, timeSpacing);
    
    try {
        const data = await apiCall('getAvailability', {
            treatment_id: treatmentId,
            date: dateKey,
            pair_room: pairRoomDesired ? 'true' : 'false',
            time_spacing: timeSpacing
        });
        
        return {
            success: true,
            availableTimes: data.available_times || [],
            message: data.message || "空き時間を取得しました"
        };
        
    } catch (error) {
        console.error('[GAS API] Error checking availability:', error);
        return {
            success: false,
            availableTimes: [],
            message: "空き時間の確認に失敗しました"
        };
    }
}

/**
 * 一括予約送信
 */
export async function mockSubmitBulkReservation(bookings, lineUserId) {
    console.log('[GAS API] Submitting bulk reservations:', bookings, lineUserId);
    
    try {
        // 複数の予約を順次作成
        const results = [];
        
        for (const booking of bookings) {
            const reservationData = {
                patient_id: booking.patientId,
                treatment_id: booking.treatment.id,
                treatment_name: booking.treatment.name,
                reservation_date: booking.selectedDate,
                reservation_time: booking.selectedTime,
                duration: booking.treatment.duration,
                price: booking.treatment.price,
                is_pair_booking: booking.pairRoomDesired || false
            };
            
            const result = await apiCall('createReservation', {}, 'POST', reservationData);
            results.push(result);
        }
        
        return {
            success: true,
            reservationIds: results.map(r => r.id),
            message: "予約が正常に確定されました。"
        };
        
    } catch (error) {
        console.error('[GAS API] Error submitting reservations:', error);
        return {
            success: false,
            message: "予約の送信に失敗しました: " + error.message
        };
    }
}

/**
 * 予約キャンセル
 */
export async function cancelReservation(reservationId) {
    console.log('[GAS API] Cancelling reservation:', reservationId);
    
    try {
        const data = await apiCall('cancelReservation', {
            reservation_id: reservationId
        });
        
        return {
            success: true,
            data: data,
            message: "予約がキャンセルされました"
        };
        
    } catch (error) {
        console.error('[GAS API] Error cancelling reservation:', error);
        return {
            success: false,
            message: "予約のキャンセルに失敗しました: " + error.message
        };
    }
}

/**
 * 患者別メニュー取得
 */
export async function getPatientMenus(visitorId, companyId = null) {
    console.log('[GAS API] Getting patient menus for:', visitorId, companyId);
    
    try {
        const params = {
            visitor_id: visitorId
        };
        
        if (companyId) {
            params.company_id = companyId;
        }
        
        const data = await apiCall('getPatientMenus', params);
        
        console.log('[GAS API] Patient menus received:', data);
        return {
            success: true,
            data: data
        };
        
    } catch (error) {
        console.error('[GAS API] Error getting patient menus:', error);
        return {
            success: false,
            message: error.message || 'メニュー情報の取得に失敗しました'
        };
    }
}

/**
 * MedicalForce形式で予約作成
 */
export async function createMedicalForceReservation(reservationData) {
    console.log('[GAS API] Creating MedicalForce reservation:', reservationData);
    
    try {
        const data = await apiCall('createMedicalForceReservation', {}, 'POST', reservationData);
        
        return {
            success: true,
            reservationId: data.reservation_id,
            message: '予約が正常に作成されました'
        };
        
    } catch (error) {
        console.error('[GAS API] Error creating reservation:', error);
        return {
            success: false,
            message: error.message || '予約の作成に失敗しました'
        };
    }
}

/**
 * API接続テスト
 */
export async function testApiConnection() {
    console.log('[GAS API] Testing API connection');
    
    try {
        const data = await apiCall('testConnection');
        return {
            success: true,
            data: data,
            message: "API接続テスト成功"
        };
    } catch (error) {
        console.error('[GAS API] API connection test failed:', error);
        return {
            success: false,
            message: "API接続テスト失敗: " + error.message
        };
    }
}

/**
 * データマッピング用ヘルパー関数
 */
export function mapGasDataToAppState(gasData) {
    return {
        // 既存のAppStateと互換性のある形式にマッピング
        user: {
            id: gasData.user.id,
            displayName: gasData.user.lineDisplayName,
            name: gasData.user.name,
            email: gasData.user.email,
            phone: gasData.user.phone
        },
        
        patients: [{
            id: gasData.patientInfo.id,
            name: gasData.user.name,
            lastVisit: gasData.patientInfo.lastVisitDate,
            isNew: gasData.patientInfo.isNew
        }],
        
        treatmentHistory: gasData.treatmentHistory,
        availableTreatments: gasData.availableTreatments,
        membershipInfo: gasData.membershipInfo,
        upcomingReservations: gasData.upcomingReservations
    };
}