<?php

/**
 * LINE Messaging API Service
 * LINE Messaging APIを使用したメッセージ送信サービス
 */
class LineMessagingService
{
    private string $channelAccessToken;
    private string $channelSecret;
    private GasApiClient $gasApi;
    private int $retryCount = 3;
    private float $retryDelay = 1.0; // 秒
    
    public function __construct(string $channelAccessToken, string $channelSecret, GasApiClient $gasApi)
    {
        $this->channelAccessToken = $channelAccessToken;
        $this->channelSecret = $channelSecret;
        $this->gasApi = $gasApi;
    }
    
    /**
     * LINE メッセージを送信
     * 
     * @param string $userId LINE ユーザーID
     * @param array $message メッセージオブジェクト
     * @param string $notificationType 通知タイプ
     * @return array 送信結果
     */
    public function sendMessage(string $userId, array $message, string $notificationType = ''): array
    {
        try {
            if (empty($userId)) {
                throw new Exception('LINE ユーザーIDが指定されていません', 400);
            }
            
            if (empty($message)) {
                throw new Exception('メッセージが指定されていません', 400);
            }
            
            // レート制限チェック
            if (!$this->checkRateLimit($userId)) {
                throw new Exception('レート制限により送信できません', 429);
            }
            
            // メッセージを送信
            $result = $this->sendToLineApi($userId, $message);
            
            // 送信履歴を記録
            if ($result['success']) {
                $this->recordNotificationHistory($userId, $notificationType, $message);
            }
            
            return $result;
            
        } catch (Exception $e) {
            error_log('[LINE Messaging] Error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => [
                    'message' => $e->getMessage(),
                    'code' => $e->getCode()
                ]
            ];
        }
    }
    
    /**
     * 複数ユーザーに一括送信
     * 
     * @param array $recipients 受信者リスト [['user_id' => '', 'name' => ''], ...]
     * @param array $message メッセージオブジェクト
     * @param string $notificationType 通知タイプ
     * @return array 送信結果
     */
    public function sendBroadcastMessage(array $recipients, array $message, string $notificationType = ''): array
    {
        $results = [
            'success' => [],
            'failed' => [],
            'total' => count($recipients)
        ];
        
        foreach ($recipients as $recipient) {
            $userId = $recipient['user_id'] ?? $recipient['line_id'] ?? '';
            $name = $recipient['name'] ?? 'Unknown';
            
            if (empty($userId)) {
                $results['failed'][] = [
                    'user_id' => $userId,
                    'name' => $name,
                    'error' => 'LINE ユーザーIDが不正です'
                ];
                continue;
            }
            
            $result = $this->sendMessage($userId, $message, $notificationType);
            
            if ($result['success']) {
                $results['success'][] = [
                    'user_id' => $userId,
                    'name' => $name
                ];
            } else {
                $results['failed'][] = [
                    'user_id' => $userId,
                    'name' => $name,
                    'error' => $result['error']['message'] ?? 'Unknown error'
                ];
            }
            
            // API制限対策で少し待機
            if (count($recipients) > 1) {
                usleep(100000); // 0.1秒待機
            }
        }
        
        return [
            'success' => count($results['failed']) === 0,
            'results' => $results,
            'summary' => [
                'total' => $results['total'],
                'success_count' => count($results['success']),
                'failed_count' => count($results['failed'])
            ]
        ];
    }
    
    /**
     * 予約確定通知を送信
     * 
     * @param string $userId LINE ユーザーID
     * @param array $reservationData 予約データ
     * @return array 送信結果
     */
    public function sendReservationConfirmation(string $userId, array $reservationData): array
    {
        try {
            $flexMessage = FlexMessageTemplates::createReservationConfirmation($reservationData);
            return $this->sendMessage($userId, $flexMessage, 'reservation_confirmation');
            
        } catch (Exception $e) {
            error_log('[LINE Messaging] Reservation confirmation error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * チケット残数通知を送信
     * 
     * @param string $userId LINE ユーザーID
     * @param array $ticketData チケットデータ
     * @return array 送信結果
     */
    public function sendTicketBalanceNotification(string $userId, array $ticketData): array
    {
        try {
            $flexMessage = FlexMessageTemplates::createTicketBalanceUpdate($ticketData);
            return $this->sendMessage($userId, $flexMessage, 'ticket_balance_update');
            
        } catch (Exception $e) {
            error_log('[LINE Messaging] Ticket balance notification error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * リマインダー通知を送信
     * 
     * @param string $userId LINE ユーザーID
     * @param array $reminderData リマインダーデータ
     * @param string $timing タイミング（day_before, same_day）
     * @return array 送信結果
     */
    public function sendReminderNotification(string $userId, array $reminderData, string $timing): array
    {
        try {
            $flexMessage = FlexMessageTemplates::createReminder($reminderData, $timing);
            $notificationType = $timing === 'day_before' ? 'reminder_day_before' : 'reminder_same_day';
            
            return $this->sendMessage($userId, $flexMessage, $notificationType);
            
        } catch (Exception $e) {
            error_log('[LINE Messaging] Reminder notification error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * LINE APIに実際にメッセージを送信
     * 
     * @param string $userId LINE ユーザーID
     * @param array $message メッセージオブジェクト
     * @return array 送信結果
     */
    private function sendToLineApi(string $userId, array $message): array
    {
        $url = 'https://api.line.me/v2/bot/message/push';
        
        $payload = [
            'to' => $userId,
            'messages' => [$message]
        ];
        
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->channelAccessToken,
            'X-Line-Retry-Key: ' . uniqid() // 重複送信防止
        ];
        
        $retryAttempt = 0;
        
        while ($retryAttempt < $this->retryCount) {
            try {
                $response = $this->makeHttpRequest($url, $payload, $headers);
                
                if ($response['status_code'] === 200) {
                    if (defined('DEBUG_MODE') && DEBUG_MODE) {
                        error_log('[LINE Messaging] Message sent successfully to: ' . $userId);
                    }
                    
                    return [
                        'success' => true,
                        'message' => 'メッセージが正常に送信されました'
                    ];
                }
                
                // リトライ可能なエラーかチェック
                if (!$this->isRetryableError($response['status_code'])) {
                    break;
                }
                
                $retryAttempt++;
                if ($retryAttempt < $this->retryCount) {
                    $delay = $this->retryDelay * pow(2, $retryAttempt - 1);
                    usleep($delay * 1000000);
                }
                
            } catch (Exception $e) {
                $retryAttempt++;
                if ($retryAttempt >= $this->retryCount) {
                    throw $e;
                }
                
                $delay = $this->retryDelay * pow(2, $retryAttempt - 1);
                usleep($delay * 1000000);
            }
        }
        
        // 最終的に失敗
        $errorMessage = 'LINE API送信に失敗しました';
        if (isset($response)) {
            $errorMessage .= " (Status: {$response['status_code']})";
            if (!empty($response['body'])) {
                $errorBody = json_decode($response['body'], true);
                if (isset($errorBody['message'])) {
                    $errorMessage .= " - {$errorBody['message']}";
                }
            }
        }
        
        return [
            'success' => false,
            'error' => ['message' => $errorMessage]
        ];
    }
    
    /**
     * HTTPリクエストを実行
     * 
     * @param string $url URL
     * @param array $payload ペイロード
     * @param array $headers ヘッダー
     * @return array レスポンス
     */
    private function makeHttpRequest(string $url, array $payload, array $headers): array
    {
        $options = [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false, // 開発環境用
        ];
        
        $curl = curl_init();
        curl_setopt_array($curl, $options);
        
        $response = curl_exec($curl);
        $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        
        curl_close($curl);
        
        if ($response === false) {
            throw new Exception('cURL Error: ' . $error);
        }
        
        return [
            'status_code' => $statusCode,
            'body' => $response
        ];
    }
    
    /**
     * リトライ可能なエラーかチェック
     * 
     * @param int $statusCode HTTPステータスコード
     * @return bool リトライ可能かどうか
     */
    private function isRetryableError(int $statusCode): bool
    {
        // 5xx系エラー、または429（Too Many Requests）の場合はリトライ
        return $statusCode >= 500 || $statusCode === 429;
    }
    
    /**
     * レート制限をチェック
     * 
     * @param string $userId LINE ユーザーID
     * @return bool 送信可能かどうか
     */
    private function checkRateLimit(string $userId): bool
    {
        // 簡易的なレート制限実装
        $cacheKey = "line_rate_limit_{$userId}";
        $cacheFile = sys_get_temp_dir() . "/{$cacheKey}";
        
        if (file_exists($cacheFile)) {
            $lastSent = (int)file_get_contents($cacheFile);
            $timeDiff = time() - $lastSent;
            
            // 10秒間隔制限
            if ($timeDiff < 10) {
                return false;
            }
        }
        
        // 送信時刻を記録
        file_put_contents($cacheFile, time());
        return true;
    }
    
    /**
     * 通知履歴を記録
     * 
     * @param string $userId LINE ユーザーID
     * @param string $notificationType 通知タイプ
     * @param array $message メッセージオブジェクト
     */
    private function recordNotificationHistory(string $userId, string $notificationType, array $message): void
    {
        try {
            // GAS APIを通じて通知履歴を記録
            $historyData = [
                'user_id' => $userId,
                'notification_type' => $notificationType,
                'message_type' => $message['type'] ?? 'unknown',
                'sent_at' => date('Y-m-d H:i:s'),
                'source' => 'php_line_messaging_service'
            ];
            
            $this->gasApi->recordNotificationHistory($historyData);
            
        } catch (Exception $e) {
            // 履歴記録の失敗はエラーとしない（ログのみ）
            error_log('[LINE Messaging] Failed to record history: ' . $e->getMessage());
        }
    }
    
    /**
     * 通知設定を取得
     * 
     * @param string $notificationType 通知タイプ
     * @return array 通知設定
     */
    public function getNotificationSettings(string $notificationType = ''): array
    {
        try {
            return $this->gasApi->getNotificationSettings($notificationType);
        } catch (Exception $e) {
            error_log('[LINE Messaging] Failed to get notification settings: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * 接続テスト
     * 
     * @return array テスト結果
     */
    public function testConnection(): array
    {
        try {
            $url = 'https://api.line.me/v2/bot/info';
            $headers = [
                'Authorization: Bearer ' . $this->channelAccessToken
            ];
            
            $response = $this->makeHttpRequest($url, [], $headers);
            
            if ($response['status_code'] === 200) {
                return [
                    'success' => true,
                    'message' => 'LINE Messaging API接続成功'
                ];
            } else {
                return [
                    'success' => false,
                    'error' => [
                        'message' => 'LINE Messaging API接続失敗',
                        'status_code' => $response['status_code']
                    ]
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
}