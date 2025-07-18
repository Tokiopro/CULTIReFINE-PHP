<?php

/**
 * GAS API通信クラス
 * 天満病院予約システム用
 */
class GasApiClient
{
    private string $baseUrl;
    private string $apiKey;
    private int $cacheLifetime;
    private string $cacheDir;
    
    public function __construct(string $deploymentId, string $apiKey, int $cacheLifetime = 300)
    {
        $this->baseUrl = "https://script.google.com/macros/s/{$deploymentId}/exec";
        $this->apiKey = $apiKey;
        $this->cacheLifetime = $cacheLifetime; // 5分
        $this->cacheDir = __DIR__ . '/cache';
        $this->ensureCacheDirectory();
    }
    
    private function ensureCacheDirectory(): void
    {
        if (!is_dir($this->cacheDir)) {
            mkdir($this->cacheDir, 0755, true);
        }
    }
    
    /**
     * LINE IDから全ユーザー情報を一括取得
     */
    public function getUserFullInfo(string $lineUserId): array
    {
        $cacheKey = "user_full_{$lineUserId}";
        
        // キャッシュチェック
        if ($cachedData = $this->getFromCache($cacheKey)) {
            return $cachedData;
        }
        
        $path = "api/users/line/" . urlencode($lineUserId) . "/full";
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            // 成功時のみキャッシュ
            $this->saveToCache($cacheKey, $result);
        }
        
        return $result;
    }
    
    /**
     * 予約作成
     */
    public function createReservation(array $reservationData): array
    {
        $path = "api/reservations";
        return $this->makeRequest('POST', $path, $reservationData);
    }
    
    /**
     * 予約キャンセル
     */
    public function cancelReservation(string $reservationId): array
    {
        $path = "api/reservations/{$reservationId}";
        return $this->makeRequest('DELETE', $path);
    }
    
    /**
     * 空き時間検索
     */
    public function getAvailability(string $treatmentId, string $date, bool $pairRoom = false, int $timeSpacing = 5): array
    {
        $cacheKey = "availability_{$treatmentId}_{$date}_" . ($pairRoom ? '1' : '0') . "_{$timeSpacing}";
        
        // 短時間キャッシュ（1分）
        if ($cachedData = $this->getFromCache($cacheKey, 60)) {
            return $cachedData;
        }
        
        $params = [
            'treatment_id' => $treatmentId,
            'date' => $date,
            'pair_room' => $pairRoom ? 'true' : 'false',
            'time_spacing' => $timeSpacing
        ];
        
        $path = "api/availability?" . http_build_query($params);
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 60);
        }
        
        return $result;
    }
    
    /**
     * 書類一覧取得（フォルダ階層対応）
     */
    public function getDocuments(string $visitorId): array
    {
        $cacheKey = "documents_{$visitorId}";
        
        // キャッシュチェック（5分）
        if ($cachedData = $this->getFromCache($cacheKey, 300)) {
            return $cachedData;
        }
        
        $params = [
            'visitor_id' => $visitorId
        ];
        
        $path = "api/documents?" . http_build_query($params);
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 300);
        }
        
        return $result;
    }
    
    /**
     * 会社に紐づく来院者一覧取得（新しいGAS API対応）
     */
    public function getPatientsByCompany(string $companyId, string $userRole = 'sub'): array
    {
        $cacheKey = "company_visitors_{$companyId}_{$userRole}";
        
        // キャッシュチェック（3分）
        if ($cachedData = $this->getFromCache($cacheKey, 180)) {
            return $cachedData;
        }
        
        $path = "api/company/{$companyId}/visitors";
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            // サブ会員の場合は公開設定がtrueのもののみフィルタリング
            if ($userRole === 'sub' && isset($result['data']['visitors'])) {
                $result['data']['visitors'] = array_filter($result['data']['visitors'], function($visitor) {
                    // is_publicがtrueまたは明示的に設定されていない場合（後方互換性）
                    return ($visitor['is_public'] === true) || (!isset($visitor['is_public']) && !array_key_exists('is_public', $visitor));
                });
                // 配列のキーを再構築
                $result['data']['visitors'] = array_values($result['data']['visitors']);
                $result['data']['total_count'] = count($result['data']['visitors']);
                
                // デバッグログ
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log("Sub member filtering applied. Original count: " . count($result['data']['visitors'] ?? []));
                    error_log("Filtered count: " . $result['data']['total_count']);
                }
            }
            
            $this->saveToCache($cacheKey, $result, 180);
        }
        
        return $result;
    }
    
    /**
     * 来院者登録
     */
    public function createVisitor(array $visitorData): array
    {
        $path = "api/visitors";
        
        // リクエストデータを準備
        $requestData = [
            'company_id' => $visitorData['company_id'],
            'company_name' => $visitorData['company_name'],
            'visitor' => [
                'name' => $visitorData['name'],
                'kana' => $visitorData['kana'],
                'gender' => $visitorData['gender']
            ]
        ];
        
        // オプションフィールドの追加
        if (!empty($visitorData['birthday'])) {
            $requestData['visitor']['birthday'] = $visitorData['birthday'];
        }
        
        // 姓名分割が提供されている場合
        if (!empty($visitorData['first_name'])) {
            $requestData['visitor']['first_name'] = $visitorData['first_name'];
        }
        if (!empty($visitorData['last_name'])) {
            $requestData['visitor']['last_name'] = $visitorData['last_name'];
        }
        if (!empty($visitorData['first_name_kana'])) {
            $requestData['visitor']['first_name_kana'] = $visitorData['first_name_kana'];
        }
        if (!empty($visitorData['last_name_kana'])) {
            $requestData['visitor']['last_name_kana'] = $visitorData['last_name_kana'];
        }
        
        // 連絡先情報（将来の拡張用）
        if (!empty($visitorData['email'])) {
            $requestData['visitor']['email'] = $visitorData['email'];
        }
        if (!empty($visitorData['phone'])) {
            $requestData['visitor']['phone'] = $visitorData['phone'];
        }
        if (!empty($visitorData['zipcode'])) {
            $requestData['visitor']['zipcode'] = $visitorData['zipcode'];
        }
        if (!empty($visitorData['address'])) {
            $requestData['visitor']['address'] = $visitorData['address'];
        }
        
        $result = $this->makeRequest('POST', $path, $requestData);
        
        // 成功時は関連キャッシュをクリア
        if ($result['status'] === 'success') {
            $this->clearCache("patients_company_{$visitorData['company_id']}_*");
        }
        
        return $result;
    }
    
    /**
     * 来院者の公開設定を変更（新しいGAS API仕様対応）
     */
    public function updateVisitorPublicStatus(string $companyId, string $visitorId, bool $isPublic): array
    {
        // 新しいAPI仕様に合わせてPOSTリクエストでパスを送信
        $path = "api/company/{$companyId}/visitors/{$visitorId}/visibility";
        
        $requestData = [
            'path' => $path,
            'authorization' => 'Bearer ' . $this->apiKey,
            'is_public' => $isPublic
        ];
        
        // POSTリクエストとして送信（GAS WebAppの制約により）
        $result = $this->makeRequest('POST', '', $requestData);
        
        // 成功時は関連キャッシュをクリア
        if ($result['status'] === 'success') {
            $this->clearCache("company_visitors_*");
        }
        
        return $result;
    }
    
    /**
     * HTTP リクエストを実行
     */
    private function makeRequest(string $method, string $path, ?array $data = null): array
    {
        $url = $this->baseUrl . "?path=" . urlencode($path);
        
        // 認証が必要なエンドポイントの場合、URLパラメータでAPIキーを送信
        if ($path !== 'api/health') {
            $url .= "&authorization=" . urlencode("Bearer " . $this->apiKey);
        }
        
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'User-Agent: TenmaBYOIN-LINE-System/1.0'
        ];
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3
        ]);
        
        if ($method === 'POST' && $data) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'PUT' && $data) {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        // cURLエラーチェック
        if ($response === false) {
            return [
                'status' => 'error',
                'error' => [
                    'code' => 'CURL_ERROR',
                    'message' => 'API通信に失敗しました: ' . $curlError,
                    'details' => null
                ]
            ];
        }
        
        // HTTPステータスコードチェック
        if ($httpCode !== 200) {
            return [
                'status' => 'error',
                'error' => [
                    'code' => 'HTTP_ERROR',
                    'message' => "APIエラー (HTTP {$httpCode})",
                    'details' => $response
                ]
            ];
        }
        
        // デバッグ用：生レスポンスをログに記録
        if (DEBUG_MODE) {
            error_log("GAS API Raw Response (HTTP {$httpCode}): " . substr($response, 0, 500));
        }
        
        // JSONデコード
        $decodedResponse = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $jsonError = json_last_error_msg();
            if (DEBUG_MODE) {
                error_log("JSON Decode Error: {$jsonError}");
                error_log("Response content: {$response}");
            }
            
            return [
                'status' => 'error',
                'error' => [
                    'code' => 'JSON_DECODE_ERROR',
                    'message' => "レスポンスの解析に失敗しました: {$jsonError}",
                    'details' => $response,
                    'url' => $url
                ]
            ];
        }
        
        return $decodedResponse;
    }
    
    /**
     * キャッシュから取得
     */
    private function getFromCache(string $key, int $lifetime = null): ?array
    {
        $lifetime = $lifetime ?? $this->cacheLifetime;
        $cacheFile = $this->cacheDir . '/' . md5($key) . '.cache';
        
        if (!file_exists($cacheFile)) {
            return null;
        }
        
        $cacheTime = filemtime($cacheFile);
        if (time() - $cacheTime > $lifetime) {
            unlink($cacheFile);
            return null;
        }
        
        $data = file_get_contents($cacheFile);
        return json_decode($data, true);
    }
    
    /**
     * キャッシュに保存
     */
    private function saveToCache(string $key, array $data, int $lifetime = null): void
    {
        $lifetime = $lifetime ?? $this->cacheLifetime;
        $cacheFile = $this->cacheDir . '/' . md5($key) . '.cache';
        
        file_put_contents($cacheFile, json_encode($data), LOCK_EX);
        
        // 古いキャッシュファイルを削除
        $this->cleanupOldCacheFiles();
    }
    
    /**
     * 古いキャッシュファイルをクリーンアップ
     */
    private function cleanupOldCacheFiles(): void
    {
        $files = glob($this->cacheDir . '/*.cache');
        $cutoff = time() - ($this->cacheLifetime * 2); // キャッシュ期限の2倍経過したファイル
        
        foreach ($files as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
            }
        }
    }
    
    /**
     * キャッシュをクリア
     */
    public function clearCache(string $pattern = '*'): int
    {
        $files = glob($this->cacheDir . '/' . $pattern . '.cache');
        $deleted = 0;
        
        foreach ($files as $file) {
            if (unlink($file)) {
                $deleted++;
            }
        }
        
        return $deleted;
    }
    
    /**
     * 患者別メニュー取得
     */
    public function getPatientMenus(string $visitorId, ?string $companyId = null): array
    {
        $cacheKey = "patient_menus_{$visitorId}" . ($companyId ? "_{$companyId}" : "");
        
        // キャッシュチェック（10分）
        if ($cachedData = $this->getFromCache($cacheKey, 600)) {
            return $cachedData;
        }
        
        $path = "api/patients/{$visitorId}/menus";
        
        // 会社IDがある場合はクエリパラメータに追加
        if ($companyId) {
            $path .= "?companyId={$companyId}";
        }
        
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 600);
        }
        
        return $result;
    }
    
    /**
     * MedicalForce形式で予約作成
     */
    public function createMedicalForceReservation(array $reservationData): array
    {
        $path = "developer/reservations";
        
        // MedicalForce API形式に変換
        $requestData = [
            'visitor_id' => $reservationData['visitor_id'],
            'start_at' => $reservationData['start_at'],
            'note' => $reservationData['note'] ?? '',
            'is_online' => $reservationData['is_online'] ?? false,
            'menus' => array_map(function($menu) {
                return [
                    'menu_id' => $menu['menu_id'],
                    'staff_id' => $menu['staff_id'] ?? null
                ];
            }, $reservationData['menus'])
        ];
        
        // オプションフィールド
        if (!empty($reservationData['invitation_code'])) {
            $requestData['invitation_code'] = $reservationData['invitation_code'];
        }
        if (!empty($reservationData['api_collaborator_id'])) {
            $requestData['api_collaborator_id'] = $reservationData['api_collaborator_id'];
        }
        if (!empty($reservationData['api_collaborator_reservation_id'])) {
            $requestData['api_collaborator_reservation_id'] = $reservationData['api_collaborator_reservation_id'];
        }
        
        $result = $this->makeRequest('POST', $path, $requestData);
        
        // 成功時はキャッシュをクリア
        if ($result['status'] === 'success') {
            $this->clearCache("availability_*");
            $this->clearCache("user_full_*");
        }
        
        return $result;
    }
    
    /**
     * 来院者の公開設定を更新
     */
    public function updateVisitorVisibility(string $companyId, string $visitorId, bool $isPublic): array
    {
        $requestData = [
            'path' => "api/company/{$companyId}/visitors/{$visitorId}/visibility",
            'authorization' => "Bearer {$this->apiKey}",
            'is_public' => $isPublic
        ];
        
        return $this->request($requestData, 'POST');
    }
    
    /**
     * 予約履歴一覧を取得
     */
    public function getReservationHistory(string $memberType, string $date, string $companyId): array
    {
        $cacheKey = "reservation_history_{$companyId}_{$memberType}_{$date}";
        
        // キャッシュチェック（10分）
        if ($cachedData = $this->getFromCache($cacheKey, 600)) {
            return $cachedData;
        }
        
        $params = [
            'member_type' => $memberType,
            'date' => $date,
            'company_id' => $companyId
        ];
        
        $path = "api/reservations/history?" . http_build_query($params);
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 600);
        }
        
        return $result;
    }
    
    /**
     * API接続テスト
     */
    public function testConnection(): array
    {
        $testData = [
            'timestamp' => time(),
            'test' => true
        ];
        
        // ヘルスチェックエンドポイントがある場合
        $path = "api/health";
        return $this->makeRequest('GET', $path);
    }
}