<?php

/**
 * Medical Force 同期サービス
 * 予約データの同期処理をPHP側で実行
 */
class MedicalForceSyncService
{
    private MedicalForceApiClient $apiClient;
    private int $batchSize = 500;
    private int $maxRetries = 3;
    private float $retryDelay = 1.0; // 秒
    
    public function __construct(MedicalForceApiClient $apiClient)
    {
        $this->apiClient = $apiClient;
    }
    
    /**
     * 予約データを同期
     * 
     * @param array $params 同期パラメータ
     *  - date_from: 開始日 (YYYY-MM-DD)
     *  - date_to: 終了日 (YYYY-MM-DD)
     *  - offset: 開始位置（オプション）
     *  - limit: 一度に取得する件数（オプション）
     *  - visitor_id: 特定の来院者IDでフィルタ（オプション）
     * @return array 同期結果
     */
    public function syncReservations(array $params): array
    {
        $startTime = microtime(true);
        
        try {
            // パラメータの初期化
            $dateFrom = $params['date_from'] ?? date('Y-m-d');
            $dateTo = $params['date_to'] ?? date('Y-m-d', strtotime('+14 days'));
            $offset = intval($params['offset'] ?? 0);
            $limit = intval($params['limit'] ?? $this->batchSize);
            
            error_log("[MF Sync] 予約同期開始 - 期間: {$dateFrom} ~ {$dateTo}");
            
            $allReservations = [];
            $hasMore = true;
            $totalCount = 0;
            $processedCount = 0;
            $errors = [];
            
            // ページネーションで全データを取得
            while ($hasMore) {
                $retryCount = 0;
                $success = false;
                $batchData = null;
                
                // リトライ処理
                while ($retryCount < $this->maxRetries && !$success) {
                    try {
                        $batchParams = [
                            // Medical Force API形式に変換（ISO 8601形式）
                            'epoch_from' => date('c', strtotime($dateFrom . ' 00:00:00')),
                            'epoch_to' => date('c', strtotime($dateTo . ' 23:59:59')),
                            'limit' => $limit,
                            'offset' => $offset
                        ];
                        
                        // visitor_idが指定されている場合は追加
                        if (!empty($params['visitor_id'])) {
                            $batchParams['visitor_id'] = $params['visitor_id'];
                        }
                        
                        $batchData = $this->fetchReservationBatch($batchParams);
                        $success = true;
                    } catch (Exception $e) {
                        $retryCount++;
                        error_log("[MF Sync] バッチ取得エラー (リトライ {$retryCount}/{$this->maxRetries}): " . $e->getMessage());
                        
                        if ($retryCount >= $this->maxRetries) {
                            throw $e;
                        }
                        
                        // 指数バックオフで待機
                        usleep($this->retryDelay * pow(2, $retryCount - 1) * 1000000);
                    }
                }
                
                if (!$batchData || !isset($batchData['reservations'])) {
                    error_log("[MF Sync] 予約データの取得に失敗しました");
                    break;
                }
                
                $reservations = $batchData['reservations'];
                $totalCount = $batchData['total'] ?? 0;
                
                if (empty($reservations)) {
                    $hasMore = false;
                    break;
                }
                
                // データを処理
                foreach ($reservations as $reservation) {
                    try {
                        $processedReservation = $this->processReservation($reservation);
                        $allReservations[] = $processedReservation;
                        $processedCount++;
                    } catch (Exception $e) {
                        $errors[] = [
                            'reservation_id' => $reservation['id'] ?? 'unknown',
                            'error' => $e->getMessage()
                        ];
                        error_log("[MF Sync] 予約処理エラー: " . $e->getMessage());
                    }
                }
                
                $offset += count($reservations);
                
                // 進捗ログ
                error_log("[MF Sync] 進捗: {$offset}/{$totalCount} 件処理完了");
                
                // 全件取得完了または最後のバッチの場合
                if ($offset >= $totalCount || count($reservations) < $limit) {
                    $hasMore = false;
                }
                
                // API制限を考慮して少し待機
                usleep(100000); // 0.1秒
            }
            
            $endTime = microtime(true);
            $executionTime = round($endTime - $startTime, 2);
            
            error_log("[MF Sync] 同期完了 - 処理件数: {$processedCount}, 実行時間: {$executionTime}秒");
            
            return [
                'success' => true,
                'data' => [
                    'reservations' => $allReservations,
                    'summary' => [
                        'total_count' => $totalCount,
                        'processed_count' => $processedCount,
                        'error_count' => count($errors),
                        'execution_time' => $executionTime,
                        'date_range' => [
                            'from' => $dateFrom,
                            'to' => $dateTo
                        ]
                    ],
                    'errors' => $errors
                ]
            ];
            
        } catch (Exception $e) {
            error_log("[MF Sync] 同期エラー: " . $e->getMessage());
            error_log("[MF Sync] スタックトレース: " . $e->getTraceAsString());
            
            return [
                'success' => false,
                'error' => [
                    'message' => '予約同期中にエラーが発生しました: ' . $e->getMessage(),
                    'code' => $e->getCode()
                ]
            ];
        }
    }
    
    /**
     * 予約データのバッチを取得
     * 
     * @param array $params APIパラメータ
     * @return array バッチデータ
     */
    private function fetchReservationBatch(array $params): array
    {
        // Medical Force APIのエンドポイントに合わせて実装
        $response = $this->apiClient->makeRequest('GET', '/developer/reservations', $params);
        
        if (!$response['success']) {
            throw new Exception(
                'Medical Force API エラー: ' . ($response['message'] ?? 'Unknown error'),
                $response['error_code'] ?? 500
            );
        }
        
        // Medical Force APIのレスポンス形式に合わせて調整
        $data = $response['data'] ?? [];
        
        return [
            'reservations' => $data['items'] ?? [],
            'total' => $data['count'] ?? count($data['items'] ?? [])
        ];
    }
    
    /**
     * 予約データを処理してGAS用の形式に変換
     * 
     * @param array $reservation 予約データ
     * @return array 処理済みデータ
     */
    private function processReservation(array $reservation): array
    {
        // 日時フォーマット
        $startAt = $reservation['start_at'] ?? '';
        $endAt = $reservation['end_at'] ?? '';
        
        // 患者情報（Medical Force APIでは visitor がネストされている）
        $visitor = $reservation['visitor'] ?? [];
        $visitorId = $visitor['id'] ?? $reservation['visitor_id'] ?? '';
        
        // 患者名の構築（姓名を結合）
        $visitorName = '';
        if (!empty($visitor['last_name']) || !empty($visitor['first_name'])) {
            $visitorName = trim(($visitor['last_name'] ?? '') . ' ' . ($visitor['first_name'] ?? ''));
        } else {
            $visitorName = $visitor['name'] ?? $reservation['visitor_name'] ?? '';
        }
        
        // メニュー情報（menusは配列）
        $menuName = '';
        if (isset($reservation['menus']) && is_array($reservation['menus']) && !empty($reservation['menus'])) {
            $menuNames = array_map(function($menu) {
                return $menu['name'] ?? '';
            }, $reservation['menus']);
            $menuName = implode(', ', array_filter($menuNames));
        }
        
        // スタッフ情報（operationsから取得）
        $staffName = '';
        if (isset($reservation['operations']) && is_array($reservation['operations']) && !empty($reservation['operations'])) {
            $operation = $reservation['operations'][0];
            if (isset($operation['nominated_staff'])) {
                $staff = $operation['nominated_staff'];
                if (!empty($staff['last_name']) || !empty($staff['first_name'])) {
                    $staffName = trim(($staff['last_name'] ?? '') . ' ' . ($staff['first_name'] ?? ''));
                } else {
                    $staffName = $staff['name'] ?? '';
                }
            }
        }
        
        // ステータスの判定（canceled_atがあればキャンセル）
        $status = '予約';
        if (!empty($reservation['canceled_at'])) {
            $status = 'キャンセル';
        } elseif (!empty($reservation['deleted_at'])) {
            $status = '削除済み';
        }
        
        // 予約日時を日本語形式に変換
        $reserveDate = '';
        $reserveTime = '';
        if (!empty($startAt)) {
            $timestamp = strtotime($startAt);
            if ($timestamp) {
                $reserveDate = date('Y-m-d', $timestamp);
                $reserveTime = date('H:i', $timestamp);
            }
        }
        
        // GAS側で期待される形式に変換
        return [
            'reservation_id' => $reservation['id'] ?? '',
            'visitor_id' => $visitorId,
            'visitor_name' => $visitorName,
            'patient_id' => $visitorId, // patient_id = visitor_id
            'patient_name' => $visitorName,
            '患者名' => $visitorName,
            'start_at' => $startAt,
            'end_at' => $endAt,
            '予約日' => $reserveDate,
            '予約時間' => $reserveTime,
            '終了時間' => $endAt ? date('H:i', strtotime($endAt)) : '',
            'menu_name' => $menuName,
            'メニュー' => $menuName,
            'staff_name' => $staffName,
            '担当スタッフ' => $staffName,
            'status' => $status,
            'ステータス' => $status,
            'memo' => $reservation['note'] ?? '',
            'メモ' => $reservation['note'] ?? '',
            'created_at' => $reservation['created_at'] ?? '',
            '作成日時' => $reservation['created_at'] ?? '',
            'updated_at' => $reservation['updated_at'] ?? '',
            '更新日時' => $reservation['updated_at'] ?? '',
            // 追加情報（必要に応じて）
            'room_id' => '',
            'room_name' => '',
            '部屋ID' => '',
            '部屋名' => '',
            'company_id' => '',
            'company_name' => '',
            '会社ID' => '',
            '会社名' => '',
            'member_type' => '',
            '会員種別' => '',
            'is_public' => '',
            '公開設定' => '',
            // 患者属性（Medical Force APIから取得可能な場合）
            '患者属性' => $visitor['attribute'] ?? ''
        ];
    }
    
    /**
     * 増分同期（更新されたデータのみ）
     * 
     * @param array $params 同期パラメータ
     *  - last_sync_time: 前回同期時刻 (Y-m-d H:i:s)
     * @return array 同期結果
     */
    public function incrementalSync(array $params): array
    {
        $lastSyncTime = $params['last_sync_time'] ?? date('Y-m-d H:i:s', strtotime('-1 day'));
        
        error_log("[MF Sync] 増分同期開始 - 最終同期: {$lastSyncTime}");
        
        // Medical Force APIの更新日時フィルタリング
        // created_at_epoch_from/toを使用して増分同期
        $syncParams = array_merge($params, [
            'created_at_epoch_from' => date('c', strtotime($lastSyncTime)),
            'created_at_epoch_to' => date('c')
        ]);
        
        return $this->syncReservations($syncParams);
    }
    
    /**
     * 同期状態をチェック
     * 
     * @return array 状態情報
     */
    public function checkSyncStatus(): array
    {
        try {
            // API接続テスト
            $connectionTest = $this->apiClient->testConnection();
            
            return [
                'success' => true,
                'status' => [
                    'api_connected' => $connectionTest['success'],
                    'authentication' => $connectionTest['authentication'] ?? [],
                    'timestamp' => date('Y-m-d H:i:s')
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => [
                    'message' => 'ステータスチェック失敗: ' . $e->getMessage()
                ]
            ];
        }
    }
}