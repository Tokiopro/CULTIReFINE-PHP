// screens/single-booking-completion-adapter.js
// 新しい予約システムのデータを既存の完了画面で表示するためのアダプター

/**
 * 新形式のデータを既存形式に変換
 */
export function adaptNewCompletionData() {
    // LocalStorageから新形式のデータを確認
    const completionDataStr = localStorage.getItem('clutirefine_completion_data');
    if (!completionDataStr) return;
    
    const completionData = JSON.parse(completionDataStr);
    
    // 新形式のデータ構造を確認
    if (completionData.patientId && !completionData.bookings[0].patientName) {
        // 既存形式に変換
        const adaptedData = {
            reservationId: completionData.reservationId,
            lineUser: {
                displayName: '患者 ' + completionData.patientId
            },
            bookings: completionData.bookings.map(booking => ({
                patientName: '患者 ' + completionData.patientId,
                treatment: {
                    name: booking.menuName,
                    duration: booking.duration + '分'
                },
                selectedDate: completionData.selectedDate,
                selectedTime: booking.startTime,
                endTime: booking.endTime
            })),
            completedAt: completionData.completedAt
        };
        
        // 既存形式で上書き保存
        localStorage.setItem('clutirefine_completion_data', JSON.stringify(adaptedData));
        
        // ページをリロードして既存のスクリプトで処理
        window.location.reload();
    }
}

// ページ読み込み時に実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', adaptNewCompletionData);
} else {
    adaptNewCompletionData();
}