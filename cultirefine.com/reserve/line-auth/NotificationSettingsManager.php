<?php

/**
 * 通知設定管理クラス
 * スプレッドシートベースの通知設定の管理
 */
class NotificationSettingsManager
{
    private GasApiClient $gasApi;
    private array $cachedSettings = [];
    private int $cacheLifetime = 300; // 5分
    
    public function __construct(GasApiClient $gasApi)
    {
        $this->gasApi = $gasApi;
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
            $cacheKey = "notification_settings_{$notificationType}";
            
            // キャッシュチェック
            if (isset($this->cachedSettings[$cacheKey])) {
                $cached = $this->cachedSettings[$cacheKey];
                if (time() - $cached['timestamp'] < $this->cacheLifetime) {
                    return $cached['data'];
                }
            }
            
            // GAS APIから設定を取得
            $result = $this->gasApi->getNotificationSettings($notificationType);
            
            if (isset($result['status']) && $result['status'] === 'success') {
                $settings = $result['data'] ?? [];
                
                // キャッシュに保存
                $this->cachedSettings[$cacheKey] = [
                    'data' => $settings,
                    'timestamp' => time()
                ];
                
                return $settings;
            }
            
            return $this->getDefaultSettings($notificationType);
            
        } catch (Exception $e) {
            error_log('[Notification Settings] Error getting settings: ' . $e->getMessage());
            return $this->getDefaultSettings($notificationType);
        }
    }
    
    /**
     * 通知テンプレートを取得
     * 
     * @param string $templateType テンプレートタイプ
     * @param string $language 言語（ja, en）
     * @return array テンプレートデータ
     */
    public function getNotificationTemplate(string $templateType, string $language = 'ja'): array
    {
        try {
            $settings = $this->getNotificationSettings($templateType);
            
            $template = [
                'type' => $templateType,
                'enabled' => $settings['enabled'] ?? true,
                'title' => $settings['title'] ?? $this->getDefaultTitle($templateType),
                'message' => $settings['message'] ?? $this->getDefaultMessage($templateType),
                'use_flex_message' => $settings['use_flex_message'] ?? true,
                'timing' => $settings['timing'] ?? [],
                'conditions' => $settings['conditions'] ?? [],
                'variables' => $this->getTemplateVariables($templateType)
            ];
            
            return $template;
            
        } catch (Exception $e) {
            error_log('[Notification Settings] Error getting template: ' . $e->getMessage());
            return $this->getDefaultTemplate($templateType);
        }
    }
    
    /**
     * 通知タイミング設定を取得
     * 
     * @return array タイミング設定
     */
    public function getNotificationTiming(): array
    {
        try {
            $settings = $this->getNotificationSettings('timing');
            
            return [
                'reminder_day_before' => [
                    'enabled' => $settings['reminder_day_before_enabled'] ?? true,
                    'hour' => $settings['reminder_day_before_hour'] ?? 11,
                    'minute' => $settings['reminder_day_before_minute'] ?? 0
                ],
                'reminder_same_day' => [
                    'enabled' => $settings['reminder_same_day_enabled'] ?? true,
                    'hour' => $settings['reminder_same_day_hour'] ?? 9,
                    'minute' => $settings['reminder_same_day_minute'] ?? 0
                ],
                'post_treatment' => [
                    'enabled' => $settings['post_treatment_enabled'] ?? true,
                    'delay_hours' => $settings['post_treatment_delay_hours'] ?? 2
                ],
                'ticket_balance_warning' => [
                    'enabled' => $settings['ticket_warning_enabled'] ?? true,
                    'threshold' => $settings['ticket_warning_threshold'] ?? 3
                ]
            ];
            
        } catch (Exception $e) {
            error_log('[Notification Settings] Error getting timing: ' . $e->getMessage());
            return $this->getDefaultTiming();
        }
    }
    
    /**
     * 通知設定を更新
     * 
     * @param string $notificationType 通知タイプ
     * @param array $settings 設定データ
     * @return array 更新結果
     */
    public function updateNotificationSettings(string $notificationType, array $settings): array
    {
        try {
            // GAS APIで設定を更新
            $result = $this->gasApi->updateNotificationSettings($notificationType, $settings);
            
            if (isset($result['status']) && $result['status'] === 'success') {
                // キャッシュをクリア
                $this->clearCache($notificationType);
                
                return [
                    'success' => true,
                    'message' => '通知設定が更新されました'
                ];
            }
            
            return [
                'success' => false,
                'error' => ['message' => $result['error']['message'] ?? '設定の更新に失敗しました']
            ];
            
        } catch (Exception $e) {
            error_log('[Notification Settings] Error updating settings: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * 利用可能な通知タイプ一覧を取得
     * 
     * @return array 通知タイプ一覧
     */
    public function getAvailableNotificationTypes(): array
    {
        return [
            'reservation_confirmation' => [
                'name' => '予約確定通知',
                'description' => '予約が確定した際の通知',
                'variables' => ['patient_name', 'date', 'time', 'menu_name', 'staff_name']
            ],
            'reminder_day_before' => [
                'name' => '前日リマインダー',
                'description' => '予約前日の11時に送信される通知',
                'variables' => ['patient_name', 'date', 'time', 'menu_name', 'notes']
            ],
            'reminder_same_day' => [
                'name' => '当日リマインダー',
                'description' => '予約当日の9時に送信される通知',
                'variables' => ['patient_name', 'date', 'time', 'menu_name', 'notes']
            ],
            'ticket_balance_update' => [
                'name' => 'チケット残数更新',
                'description' => 'チケット使用時の残数通知',
                'variables' => ['patient_name', 'ticket_balance', 'ticket_usage', 'menu_name']
            ],
            'post_treatment' => [
                'name' => '施術後通知',
                'description' => '施術完了2時間後の通知',
                'variables' => ['patient_name', 'menu_name', 'staff_name', 'after_care_notes', 'next_recommendation']
            ],
            'campaign_notification' => [
                'name' => 'キャンペーン通知',
                'description' => 'キャンペーンやお知らせの通知',
                'variables' => ['patient_name', 'campaign_title', 'campaign_details', 'expiry_date']
            ]
        ];
    }
    
    /**
     * デフォルト設定を取得
     * 
     * @param string $notificationType 通知タイプ
     * @return array デフォルト設定
     */
    private function getDefaultSettings(string $notificationType): array
    {
        $defaultSettings = [
            'reservation_confirmation' => [
                'enabled' => true,
                'use_flex_message' => true,
                'title' => 'ご予約が確定しました',
                'send_immediately' => true
            ],
            'reminder_day_before' => [
                'enabled' => true,
                'use_flex_message' => true,
                'hour' => 11,
                'minute' => 0,
                'title' => '明日のご予約リマインダー'
            ],
            'reminder_same_day' => [
                'enabled' => true,
                'use_flex_message' => true,
                'hour' => 9,
                'minute' => 0,
                'title' => '本日のご予約リマインダー'
            ],
            'ticket_balance_update' => [
                'enabled' => true,
                'use_flex_message' => true,
                'warning_threshold' => 3,
                'title' => 'チケット残数の更新'
            ],
            'post_treatment' => [
                'enabled' => true,
                'use_flex_message' => true,
                'delay_hours' => 2,
                'title' => '本日はご来院ありがとうございました'
            ],
            'campaign_notification' => [
                'enabled' => false,
                'use_flex_message' => true,
                'title' => 'キャンペーンのお知らせ'
            ]
        ];
        
        return $defaultSettings[$notificationType] ?? [
            'enabled' => true,
            'use_flex_message' => true,
            'title' => 'お知らせ'
        ];
    }
    
    /**
     * デフォルトタイミング設定を取得
     * 
     * @return array デフォルトタイミング
     */
    private function getDefaultTiming(): array
    {
        return [
            'reminder_day_before' => [
                'enabled' => true,
                'hour' => 11,
                'minute' => 0
            ],
            'reminder_same_day' => [
                'enabled' => true,
                'hour' => 9,
                'minute' => 0
            ],
            'post_treatment' => [
                'enabled' => true,
                'delay_hours' => 2
            ],
            'ticket_balance_warning' => [
                'enabled' => true,
                'threshold' => 3
            ]
        ];
    }
    
    /**
     * デフォルトタイトルを取得
     * 
     * @param string $templateType テンプレートタイプ
     * @return string タイトル
     */
    private function getDefaultTitle(string $templateType): string
    {
        $titles = [
            'reservation_confirmation' => 'ご予約が確定しました',
            'reminder_day_before' => '明日のご予約リマインダー',
            'reminder_same_day' => '本日のご予約リマインダー',
            'ticket_balance_update' => 'チケット残数の更新',
            'post_treatment' => 'ご来院ありがとうございました',
            'campaign_notification' => 'キャンペーンのお知らせ'
        ];
        
        return $titles[$templateType] ?? 'お知らせ';
    }
    
    /**
     * デフォルトメッセージを取得
     * 
     * @param string $templateType テンプレートタイプ
     * @return string メッセージ
     */
    private function getDefaultMessage(string $templateType): string
    {
        $messages = [
            'reservation_confirmation' => '{patient_name}様の予約が確定しました。{date} {time}にお越しください。',
            'reminder_day_before' => '{patient_name}様、明日 {date} {time} のご予約のリマインダーです。',
            'reminder_same_day' => '{patient_name}様、本日 {date} {time} のご予約のリマインダーです。',
            'ticket_balance_update' => '{patient_name}様、チケットをご利用いただきありがとうございます。',
            'post_treatment' => '{patient_name}様、本日はご来院ありがとうございました。',
            'campaign_notification' => '{patient_name}様、お得なキャンペーンのお知らせです。'
        ];
        
        return $messages[$templateType] ?? '{patient_name}様、お知らせがあります。';
    }
    
    /**
     * テンプレート変数を取得
     * 
     * @param string $templateType テンプレートタイプ
     * @return array 利用可能な変数一覧
     */
    private function getTemplateVariables(string $templateType): array
    {
        $availableTypes = $this->getAvailableNotificationTypes();
        return $availableTypes[$templateType]['variables'] ?? ['patient_name'];
    }
    
    /**
     * デフォルトテンプレートを取得
     * 
     * @param string $templateType テンプレートタイプ
     * @return array デフォルトテンプレート
     */
    private function getDefaultTemplate(string $templateType): array
    {
        return [
            'type' => $templateType,
            'enabled' => true,
            'title' => $this->getDefaultTitle($templateType),
            'message' => $this->getDefaultMessage($templateType),
            'use_flex_message' => true,
            'timing' => [],
            'conditions' => [],
            'variables' => $this->getTemplateVariables($templateType)
        ];
    }
    
    /**
     * キャッシュをクリア
     * 
     * @param string $notificationType 通知タイプ（空の場合は全てクリア）
     */
    private function clearCache(string $notificationType = ''): void
    {
        if (empty($notificationType)) {
            $this->cachedSettings = [];
        } else {
            $cacheKey = "notification_settings_{$notificationType}";
            unset($this->cachedSettings[$cacheKey]);
        }
    }
    
    /**
     * 通知履歴を記録
     * 
     * @param array $historyData 履歴データ
     * @return array 記録結果
     */
    public function recordNotificationHistory(array $historyData): array
    {
        try {
            $data = array_merge([
                'sent_at' => date('Y-m-d H:i:s'),
                'source' => 'php_notification_service'
            ], $historyData);
            
            $result = $this->gasApi->recordNotificationHistory($data);
            
            return [
                'success' => isset($result['status']) && $result['status'] === 'success',
                'message' => $result['message'] ?? ''
            ];
            
        } catch (Exception $e) {
            error_log('[Notification Settings] Error recording history: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => ['message' => $e->getMessage()]
            ];
        }
    }
    
    /**
     * 通知が送信済みかチェック
     * 
     * @param string $reservationId 予約ID
     * @param string $notificationType 通知タイプ
     * @return bool 送信済みかどうか
     */
    public function isNotificationSent(string $reservationId, string $notificationType): bool
    {
        try {
            $result = $this->gasApi->checkNotificationHistory($reservationId, $notificationType);
            return isset($result['sent']) && $result['sent'];
            
        } catch (Exception $e) {
            error_log('[Notification Settings] Error checking history: ' . $e->getMessage());
            return false;
        }
    }
}