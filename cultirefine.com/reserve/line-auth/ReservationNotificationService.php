<?php

/**
 * 予約通知統合サービス
 * 予約の作成・キャンセル・変更時の通知を管理
 */
class ReservationNotificationService
{
    private LineMessagingService $lineMessaging;
    private NotificationSettingsManager $settings;
    private GasApiClient $gasApi;
    
    public function __construct(LineMessagingService $lineMessaging, NotificationSettingsManager $settings, GasApiClient $gasApi)
    {
        $this->lineMessaging = $lineMessaging;
        $this->settings = $settings;
        $this->gasApi = $gasApi;
    }
    
    /**
     * 予約作成時の通知を送信
     * 
     * @param array $reservationData 予約データ
     * @return array 送信結果
     */
    public function sendReservationCreatedNotification(array $reservationData): array
    {
        try {
            $results = [];
            
            // 運営グループIDを取得
            $groupId = $this->lineMessaging->getOperationGroupId();
            
            if (empty($groupId)) {
                return [
                    'success' => false,
                    'error' => ['message' => '運営グループIDが設定されていません']
                ];
            }
            
            // 運営グループに通知
            $result = $this->lineMessaging->sendReservationCreatedNotification($reservationData, $groupId);
            $results['operation_group'] = $result;
            
            // 通知履歴を記録
            $this->recordNotification('reservation_created', $reservationData, $result);
            
            return [
                'success' => $result['success'],
                'results' => $results,
                'message' => $result['success'] ? '予約作成通知を送信しました' : '予約作成通知の送信に失敗しました'
            ];
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Creation notification error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * 予約キャンセル時の通知を送信
     * 
     * @param array $reservationData 予約データ
     * @return array 送信結果
     */
    public function sendReservationCancelledNotification(array $reservationData): array
    {
        try {
            $results = [];
            
            // 運営グループIDを取得
            $groupId = $this->lineMessaging->getOperationGroupId();
            
            if (empty($groupId)) {
                return [
                    'success' => false,
                    'error' => ['message' => '運営グループIDが設定されていません']
                ];
            }
            
            // 運営グループに通知
            $result = $this->lineMessaging->sendReservationCancelledNotification($reservationData, $groupId);
            $results['operation_group'] = $result;
            
            // 通知履歴を記録
            $this->recordNotification('reservation_cancelled', $reservationData, $result);
            
            return [
                'success' => $result['success'],
                'results' => $results,
                'message' => $result['success'] ? '予約キャンセル通知を送信しました' : '予約キャンセル通知の送信に失敗しました'
            ];
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Cancellation notification error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * 予約変更時の通知を送信
     * 
     * @param array $oldReservationData 変更前の予約データ
     * @param array $newReservationData 変更後の予約データ
     * @return array 送信結果
     */
    public function sendReservationModifiedNotification(array $oldReservationData, array $newReservationData): array
    {
        try {
            $results = [];
            
            // 運営グループIDを取得
            $groupId = $this->lineMessaging->getOperationGroupId();
            
            if (empty($groupId)) {
                return [
                    'success' => false,
                    'error' => ['message' => '運営グループIDが設定されていません']
                ];
            }
            
            // 運営グループに通知
            $result = $this->lineMessaging->sendReservationModifiedNotification($oldReservationData, $newReservationData, $groupId);
            $results['operation_group'] = $result;
            
            // 通知履歴を記録
            $this->recordNotification('reservation_modified', $newReservationData, $result);
            
            return [
                'success' => $result['success'],
                'results' => $results,
                'message' => $result['success'] ? '予約変更通知を送信しました' : '予約変更通知の送信に失敗しました'
            ];
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Modification notification error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * 通知履歴を記録
     * 
     * @param string $notificationType 通知タイプ
     * @param array $reservationData 予約データ
     * @param array $result 送信結果
     */
    private function recordNotification(string $notificationType, array $reservationData, array $result): void
    {
        try {
            $historyData = [
                'notification_type' => $notificationType,
                'reservation_id' => $reservationData['reservation_id'] ?? '',
                'patient_name' => $reservationData['patient_name'] ?? '',
                'date' => $reservationData['date'] ?? '',
                'time' => $reservationData['time'] ?? '',
                'success' => $result['success'],
                'error_message' => $result['success'] ? '' : ($result['error']['message'] ?? ''),
                'sent_at' => date('Y-m-d H:i:s'),
                'source' => 'php_reservation_notification_service'
            ];
            
            $this->settings->recordNotificationHistory($historyData);
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Failed to record history: ' . $e->getMessage());
        }
    }
    
    /**
     * 通知設定を確認
     * 
     * @param string $notificationType 通知タイプ
     * @return bool 通知が有効かどうか
     */
    public function isNotificationEnabled(string $notificationType): bool
    {
        try {
            $settings = $this->settings->getNotificationSettings($notificationType);
            return $settings['enabled'] ?? true;
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Failed to check settings: ' . $e->getMessage());
            return true; // デフォルトで有効
        }
    }
    
    /**
     * テスト通知を送信
     * 
     * @param string $notificationType 通知タイプ
     * @return array 送信結果
     */
    public function sendTestNotification(string $notificationType): array
    {
        try {
            // テスト用のダミーデータを作成
            $testReservationData = [
                'reservation_id' => 'TEST_' . uniqid(),
                'patient_name' => 'テスト　太郎',
                'booker_name' => 'テスト　花子',
                'date' => date('Y年n月j日'),
                'time' => date('H:i'),
                'menu_name' => '美容施術（テスト）',
                'staff_name' => 'テストスタッフ',
                'duration' => 60,
                'notes' => 'これはテスト通知です',
                'is_main_member' => true,
                'company_name' => 'テスト会社'
            ];
            
            switch ($notificationType) {
                case 'reservation_created':
                    return $this->sendReservationCreatedNotification($testReservationData);
                    
                case 'reservation_cancelled':
                    $testReservationData['cancel_reason'] = 'テスト用キャンセル理由';
                    return $this->sendReservationCancelledNotification($testReservationData);
                    
                case 'reservation_modified':
                    $oldData = $testReservationData;
                    $newData = $testReservationData;
                    $newData['date'] = date('Y年n月j日', strtotime('+1 day'));
                    $newData['time'] = '15:00';
                    $newData['menu_name'] = '変更後の美容施術（テスト）';
                    return $this->sendReservationModifiedNotification($oldData, $newData);
                    
                default:
                    return [
                        'success' => false,
                        'error' => ['message' => '不明な通知タイプです: ' . $notificationType]
                    ];
            }
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Test notification error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * 通知統計を取得
     * 
     * @param string $dateFrom 開始日 (Y-m-d)
     * @param string $dateTo 終了日 (Y-m-d)
     * @return array 統計データ
     */
    public function getNotificationStats(string $dateFrom, string $dateTo): array
    {
        try {
            // GAS APIから統計データを取得
            $result = $this->gasApi->getNotificationStats($dateFrom, $dateTo);
            
            if (isset($result['status']) && $result['status'] === 'success') {
                return $result['data'] ?? [];
            }
            
            return [];
            
        } catch (Exception $e) {
            error_log('[Reservation Notification] Failed to get stats: ' . $e->getMessage());
            return [];
        }
    }
}