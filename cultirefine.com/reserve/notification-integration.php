<?php

/**
 * 予約通知統合ファイル
 * 予約関連の処理でこのファイルを include して通知機能を利用する
 */

require_once __DIR__ . '/line-auth/env-loader.php';
require_once __DIR__ . '/line-auth/GasApiClient.php';
require_once __DIR__ . '/line-auth/LineMessagingService.php';
require_once __DIR__ . '/line-auth/FlexMessageTemplates.php';
require_once __DIR__ . '/line-auth/NotificationSettingsManager.php';
require_once __DIR__ . '/line-auth/ReservationNotificationService.php';

/**
 * 予約通知サービスのインスタンスを取得
 * 
 * @return ReservationNotificationService|null
 */
function getReservationNotificationService(): ?ReservationNotificationService
{
    try {
        // 環境変数をロード
        loadEnvironmentVariables();
        
        // LINE設定を取得
        $channelAccessToken = getenv('LINE_CHANNEL_ACCESS_TOKEN');
        $channelSecret = getenv('LINE_CHANNEL_SECRET');
        
        if (empty($channelAccessToken) || empty($channelSecret)) {
            error_log('[Notification Integration] LINE credentials not configured');
            return null;
        }
        
        // GAS API設定を取得
        $gasDeploymentId = getenv('GAS_DEPLOYMENT_ID');
        $gasApiKey = getenv('GAS_API_KEY');
        
        if (empty($gasDeploymentId)) {
            error_log('[Notification Integration] GAS deployment ID not configured');
            return null;
        }
        
        // サービスインスタンスを作成
        $gasApiClient = new GasApiClient($gasDeploymentId, $gasApiKey);
        $lineMessagingService = new LineMessagingService($channelAccessToken, $channelSecret, $gasApiClient);
        $notificationSettingsManager = new NotificationSettingsManager($gasApiClient);
        
        return new ReservationNotificationService($lineMessagingService, $notificationSettingsManager, $gasApiClient);
        
    } catch (Exception $e) {
        error_log('[Notification Integration] Failed to create service: ' . $e->getMessage());
        return null;
    }
}

/**
 * 予約作成通知を送信
 * 
 * @param array $reservationData 予約データ
 * @return bool 送信成功かどうか
 */
function sendReservationCreatedNotification(array $reservationData): bool
{
    try {
        $service = getReservationNotificationService();
        if (!$service) {
            return false;
        }
        
        // 通知が有効かチェック
        if (!$service->isNotificationEnabled('reservation_created')) {
            return true; // 無効の場合は成功扱い
        }
        
        $result = $service->sendReservationCreatedNotification($reservationData);
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Notification Integration] Reservation created notification result: ' . json_encode($result));
        }
        
        return $result['success'] ?? false;
        
    } catch (Exception $e) {
        error_log('[Notification Integration] Reservation created notification error: ' . $e->getMessage());
        return false;
    }
}

/**
 * 予約キャンセル通知を送信
 * 
 * @param array $reservationData 予約データ
 * @return bool 送信成功かどうか
 */
function sendReservationCancelledNotification(array $reservationData): bool
{
    try {
        $service = getReservationNotificationService();
        if (!$service) {
            return false;
        }
        
        // 通知が有効かチェック
        if (!$service->isNotificationEnabled('reservation_cancelled')) {
            return true; // 無効の場合は成功扱い
        }
        
        $result = $service->sendReservationCancelledNotification($reservationData);
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Notification Integration] Reservation cancelled notification result: ' . json_encode($result));
        }
        
        return $result['success'] ?? false;
        
    } catch (Exception $e) {
        error_log('[Notification Integration] Reservation cancelled notification error: ' . $e->getMessage());
        return false;
    }
}

/**
 * 予約変更通知を送信
 * 
 * @param array $oldReservationData 変更前の予約データ
 * @param array $newReservationData 変更後の予約データ
 * @return bool 送信成功かどうか
 */
function sendReservationModifiedNotification(array $oldReservationData, array $newReservationData): bool
{
    try {
        $service = getReservationNotificationService();
        if (!$service) {
            return false;
        }
        
        // 通知が有効かチェック
        if (!$service->isNotificationEnabled('reservation_modified')) {
            return true; // 無効の場合は成功扱い
        }
        
        $result = $service->sendReservationModifiedNotification($oldReservationData, $newReservationData);
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Notification Integration] Reservation modified notification result: ' . json_encode($result));
        }
        
        return $result['success'] ?? false;
        
    } catch (Exception $e) {
        error_log('[Notification Integration] Reservation modified notification error: ' . $e->getMessage());
        return false;
    }
}

/**
 * テスト通知を送信
 * 
 * @param string $notificationType 通知タイプ
 * @return array 送信結果
 */
function sendTestNotification(string $notificationType): array
{
    try {
        $service = getReservationNotificationService();
        if (!$service) {
            return [
                'success' => false,
                'error' => ['message' => '通知サービスの初期化に失敗しました']
            ];
        }
        
        return $service->sendTestNotification($notificationType);
        
    } catch (Exception $e) {
        error_log('[Notification Integration] Test notification error: ' . $e->getMessage());
        return [
            'success' => false,
            'error' => ['message' => $e->getMessage()]
        ];
    }
}

/**
 * 予約データを正規化（通知用の標準形式に変換）
 * 
 * @param array $rawData 生の予約データ
 * @return array 正規化された予約データ
 */
function normalizeReservationDataForNotification(array $rawData): array
{
    return [
        'reservation_id' => $rawData['id'] ?? $rawData['reservation_id'] ?? '',
        'patient_name' => $rawData['patient_name'] ?? $rawData['visitor_name'] ?? '',
        'booker_name' => $rawData['booker_name'] ?? $rawData['patient_name'] ?? $rawData['visitor_name'] ?? '',
        'date' => isset($rawData['date']) ? date('Y年n月j日', strtotime($rawData['date'])) : '',
        'time' => $rawData['time'] ?? $rawData['start_time'] ?? '',
        'menu_name' => $rawData['menu_name'] ?? $rawData['treatment_name'] ?? '',
        'staff_name' => $rawData['staff_name'] ?? $rawData['therapist_name'] ?? '',
        'duration' => $rawData['duration'] ?? $rawData['duration_minutes'] ?? 60,
        'notes' => $rawData['notes'] ?? $rawData['memo'] ?? '',
        'cancel_reason' => $rawData['cancel_reason'] ?? $rawData['cancellation_reason'] ?? '',
        'is_main_member' => $rawData['is_main_member'] ?? false,
        'company_name' => $rawData['company_name'] ?? ''
    ];
}

/**
 * 予約処理のフック関数（例）
 * 実際の予約処理ファイルでこれらの関数を呼び出す
 */

/**
 * 予約作成後のフック
 * 
 * @param array $reservationData 予約データ
 */
function onReservationCreated(array $reservationData): void
{
    $normalizedData = normalizeReservationDataForNotification($reservationData);
    $success = sendReservationCreatedNotification($normalizedData);
    
    if (!$success) {
        error_log('[Notification Hook] Failed to send reservation created notification for reservation: ' . ($reservationData['id'] ?? 'unknown'));
    }
}

/**
 * 予約キャンセル後のフック
 * 
 * @param array $reservationData 予約データ
 */
function onReservationCancelled(array $reservationData): void
{
    $normalizedData = normalizeReservationDataForNotification($reservationData);
    $success = sendReservationCancelledNotification($normalizedData);
    
    if (!$success) {
        error_log('[Notification Hook] Failed to send reservation cancelled notification for reservation: ' . ($reservationData['id'] ?? 'unknown'));
    }
}

/**
 * 予約変更後のフック
 * 
 * @param array $oldReservationData 変更前の予約データ
 * @param array $newReservationData 変更後の予約データ
 */
function onReservationModified(array $oldReservationData, array $newReservationData): void
{
    $oldNormalizedData = normalizeReservationDataForNotification($oldReservationData);
    $newNormalizedData = normalizeReservationDataForNotification($newReservationData);
    $success = sendReservationModifiedNotification($oldNormalizedData, $newNormalizedData);
    
    if (!$success) {
        error_log('[Notification Hook] Failed to send reservation modified notification for reservation: ' . ($newReservationData['id'] ?? 'unknown'));
    }
}