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
        
        // デバッグ: 入力値確認
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] getUserFullInfo called with LINE User ID: {$lineUserId}");
            error_log("[GAS API] Cache key: {$cacheKey}");
        }
        
        // キャッシュチェック
        if ($cachedData = $this->getFromCache($cacheKey)) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] Returning cached data for: {$lineUserId}");
            }
            return $cachedData;
        }
        
        $path = "/api/users/line/" . urlencode($lineUserId) . "/full";
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] Making request to path: {$path}");
            error_log("[GAS API] Base URL: {$this->baseUrl}");
            error_log("[GAS API] Full URL: {$this->baseUrl}{$path}");
        }
        
        $result = $this->makeRequest('GET', $path);
        
        // デバッグ: レスポンス詳細
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] Response status: " . ($result['status'] ?? 'no_status'));
            error_log("[GAS API] Response keys: " . implode(', ', array_keys($result)));
            if (isset($result['error'])) {
                error_log("[GAS API] Error details: " . json_encode($result['error']));
            }
            if (isset($result['data'])) {
                error_log("[GAS API] Data keys: " . implode(', ', array_keys($result['data'])));
            }
        }
        
        //if ($result['status'] === 'success') {
		// 修正後：先に正規化してからstatusをチェック
$normalizedResult = $this->normalizeGasApiResponse($result);
if (isset($normalizedResult['status']) && $normalizedResult['status'] === 'success') {
            // 成功時のみキャッシュ
            $this->saveToCache($cacheKey, $result);
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] Data cached successfully for: {$lineUserId}");
            }
        } else {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] Request failed, not caching. Status: " . ($result['status'] ?? 'unknown'));
            }
        }
        
        // レスポンス形式を標準化
        $normalizedResult = $this->normalizeGasApiResponse($result);
        
        return $normalizedResult;
    }
    
    /**
     * GAS APIレスポンスを標準形式に変換
     */
    private function normalizeGasApiResponse(array $response): array
    {
        // デバッグ: 変換前のレスポンス
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] Normalizing response with keys: " . implode(', ', array_keys($response)));
        }
        
        // 既に標準形式（status + data構造）の場合はそのまま返す
        if (isset($response['status']) && isset($response['data'])) {
            return $response;
        }
        
        // エラーレスポンスの場合
        if (isset($response['status']) && $response['status'] === 'error') {
            return $response;
        }
        
        // 実際のGAS APIレスポンス形式を標準形式に変換
        if (isset($response['visitor']) || isset($response['company'])) {
            $normalizedResponse = [
                'status' => 'success',
                'data' => []
            ];
            
            // visitor情報を user と patient_info に分割
            if (isset($response['visitor'])) {
                $visitor = $response['visitor'];
                $normalizedResponse['data']['user'] = [
                    'id' => $visitor['visitor_id'] ?? '',
                    'name' => $visitor['visitor_name'] ?? '',
                ];
                
                $normalizedResponse['data']['patient_info'] = [
                    'id' => $visitor['visitor_id'] ?? '',
                    'is_new' => true // 来院者情報があれば登録済み
                ];
            }
            
            // company情報を membership_info に変換
            if (isset($response['company'])) {
                $company = $response['company'];
                $normalizedResponse['data']['membership_info'] = [
                    'is_member' => true,
                    'company_id' => $company['company_id'] ?? '',
                    'company_name' => $company['name'] ?? '',
                    'member_type' => isset($response['visitor']['member_type']) && $response['visitor']['member_type'] === true ? '本会員' : 'サブ会員'
                ];
            }
            
            // その他の情報も追加
            /*if (isset($response['ticketInfo'])) {
                $normalizedResponse['data']['membership_info']['ticket_balance'] = $response['ticketInfo'];
            }
            
            if (isset($response['ReservationHistory'])) {
                $normalizedResponse['data']['upcoming_reservations'] = $response['ReservationHistory'];
            }
            
            if (isset($response['docsinfo'])) {
                $normalizedResponse['data']['documents'] = $response['docsinfo'];
            }*/
            
            // 施術履歴と利用可能施術は空配列で初期化（必要に応じて後で追加）
            $normalizedResponse['data']['treatment_history'] = [];
            $normalizedResponse['data']['available_treatments'] = [];
            
            // 統計情報も空で初期化
            $normalizedResponse['data']['statistics'] = [
                'total_visits' => 0,
                'total_treatments' => [],
                'last_30_days_visits' => 0,
                'favorite_treatment' => ''
            ];
            
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] Normalized response structure: " . implode(', ', array_keys($normalizedResponse['data'])));
                if (isset($normalizedResponse['data']['membership_info'])) {
                    error_log("[GAS API] Membership info: " . json_encode($normalizedResponse['data']['membership_info']));
                }
            }
            
            return $normalizedResponse;
        }
        
        // その他の場合はエラーとして扱う
        return [
            'status' => 'error',
            'error' => [
                'code' => 'INVALID_RESPONSE_FORMAT',
                'message' => 'GAS APIからの予期しないレスポンス形式です',
                'details' => $response
            ]
        ];
    }
    
    /**
     * 予約作成
     */
    public function createReservation(array $reservationData): array
    {
        $path = "/api/reservations";
        return $this->makeRequest('POST', $path, $reservationData);
    }
    
    /**
     * 予約キャンセル
     */
    public function cancelReservation(string $reservationId): array
    {
        $path = "/api/reservations/{$reservationId}";
        return $this->makeRequest('DELETE', $path);
    }
    
    /**
     * 空き時間検索
     * @param string $patientId 患者ID
     * @param string $treatmentId 施術ID
     * @param string $date 日付
     * @param bool $pairRoom ペア施術希望
     * @param int $timeSpacing 時間間隔（分）
     */
    public function getAvailability(string $patientId, string $treatmentId, string $date, bool $pairRoom = false, int $timeSpacing = 5): array
    {
        $cacheKey = "availability_{$patientId}_{$treatmentId}_{$date}_" . ($pairRoom ? '1' : '0') . "_{$timeSpacing}";
        
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
        
        // 新しいAPIでは患者IDベースのエンドポイントを使用
        $path = "/api/patients/{$patientId}/available-slots?" . http_build_query($params);
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 60);
        }
        
        return $result;
    }
    
    /**
     * 書類一覧取得（フォルダ階層対応）
     */
	/*
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
        
        $path = "/api/documents?" . http_build_query($params);
        $result = $this->makeRequest('GET', $path);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 300);
        }
        
        return $result;
    }
    */
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
        
        $path = "/api/company/{$companyId}/visitors";
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
        $path = "/api/visitors";
        
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
        // 新しいAPI v1ではPUTメソッドを使用
        $path = "/api/company/{$companyId}/visitors/{$visitorId}/visibility";
        
        $requestData = [
            'is_public' => $isPublic
        ];
        
        $result = $this->makeRequest('PUT', $path, $requestData);
        
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
        
        // デバッグ: リクエスト開始
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] makeRequest START");
            error_log("[GAS API] Method: {$method}");
            error_log("[GAS API] Path: {$path}");
            error_log("[GAS API] Base URL: {$this->baseUrl}");
            error_log("[GAS API] Data: " . ($data ? json_encode($data) : 'null'));
        }
        
        // 認証が必要なエンドポイントの場合、URLパラメータでAPIキーを送信
        if ($path !== '/api/health') {
            $url .= "&Authorization=" . urlencode("Bearer " . $this->apiKey);
        }
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] Final URL: {$url}");
        }
        
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'User-Agent: TenmaBYOIN-LINE-System/1.0'
        ];
        
        // GETリクエストでデータがある場合はURLパラメータとして追加
        if ($method === 'GET' && $data) {
            foreach ($data as $key => $value) {
                $url .= "&" . urlencode($key) . "=" . urlencode($value);
            }
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] URL with GET params: {$url}");
            }
        }
        
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
        $curlInfo = curl_getinfo($ch);
        curl_close($ch);
        
        // デバッグ: レスポンス詳細
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[GAS API] HTTP Code: {$httpCode}");
            error_log("[GAS API] cURL Error: " . ($curlError ?: 'none'));
            error_log("[GAS API] Response (first 500 chars): " . substr($response, 0, 500));
            error_log("[GAS API] Total time: " . $curlInfo['total_time']);
            error_log("[GAS API] Connect time: " . $curlInfo['connect_time']);
        }
        
        // cURLエラーチェック
        if ($response === false) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] cURL failed completely");
                error_log("[GAS API] cURL info: " . json_encode($curlInfo));
            }
            return [
                'status' => 'error',
                'error' => [
                    'code' => 'CURL_ERROR',
                    'message' => 'API通信に失敗しました: ' . $curlError,
                    'details' => $curlInfo
                ]
            ];
        }
        
        // HTTPステータスコードチェック
        if ($httpCode !== 200) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[GAS API] HTTP Error {$httpCode}");
                error_log("[GAS API] Error response: {$response}");
            }
            return [
                'status' => 'error',
                'error' => [
                    'code' => 'HTTP_ERROR',
                    'message' => "APIエラー (HTTP {$httpCode})",
                    'details' => $response,
                    'http_code' => $httpCode
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
     * 来院者をスプレッドシートに登録
     * Medical Force APIで作成された来院者をGAS API経由でスプレッドシートに登録
     */
    public function createVisitorToSheet(array $visitorData): array
    {
        // 必須パラメータの検証
        $required = ['path', 'api_key', 'visitor_id', 'last_name', 'first_name', 
                    'last_name_kana', 'first_name_kana', 'publicity_status'];
        
        foreach ($required as $field) {
            if (empty($visitorData[$field])) {
                return [
                    'status' => 'error',
                    'error' => [
                        'code' => 'INVALID_REQUEST',
                        'message' => "必須パラメータ '{$field}' が不足しています",
                        'details' => '必須フィールド: ' . implode(', ', $required)
                    ]
                ];
            }
        }
        
        // APIパスの設定
        $path = $visitorData['path'];
        unset($visitorData['path']); // pathはURLパラメータなので除外
        
        try {
            // POSTリクエストで送信
            $result = $this->makeRequest('POST', $path, $visitorData);
            
            if ($result['status'] === 'success') {
                // 成功時はキャッシュをクリア（関連するキャッシュを削除）
                $this->clearCache("visitors_*");
                $this->clearCache("user_full_info_*");
            }
            
            return $result;
            
        } catch (Exception $e) {
            return [
                'status' => 'error',
                'error' => [
                    'code' => 'API_ERROR',
                    'message' => 'GAS APIとの通信に失敗しました',
                    'details' => $e->getMessage()
                ]
            ];
        }
    }
    
    /**
     * カレンダー空き情報取得
     */
    public function getAvailableSlots(string $visitorId, array $params): array
    {
        $cacheKey = "available_slots_{$visitorId}_" . md5(json_encode($params));
        
        // キャッシュチェック（5分）
        if ($cachedData = $this->getFromCache($cacheKey, 300)) {
            return $cachedData;
        }
        
        // パラメータを整理
        $apiParams = [
            'path' => $params['path'] ?? "api/patients/{$visitorId}/available-slots",
            'api_key' => $params['api_key'] ?? $this->apiKey,
            'menu_id' => $params['menu_id'],
            'date' => $params['date'],
            'date_range' => $params['date_range'] ?? 7,
            'include_room_info' => $params['include_room_info'] ?? false,
            'pair_booking' => $params['pair_booking'] ?? false,
            'allow_multiple_same_day' => $params['allow_multiple_same_day'] ?? false
        ];
        
        // GETリクエストとして送信
        $result = $this->makeRequest('GET', $apiParams['path'], $apiParams);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 300);
        }
        
        return $result;
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
        
        // APIキーと会社IDをデータパラメータとして設定
        $data = ['api_key' => $this->apiKey];
        if ($companyId) {
            $data['company_id'] = $companyId;
        }
        
        $result = $this->makeRequest('GET', $path, $data);
        
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
        $path = "/api/reservations";
        
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
        $path = "api/company/{$companyId}/visitors/{$visitorId}/visibility";
        
        $requestData = [
            'is_public' => $isPublic
        ];
        
        return $this->makeRequest('POST', $path, $requestData);
    }
    
    /**
     * 予約履歴一覧を取得
     */
	/*
    public function getReservationHistory(string $memberType, string $date, string $companyId): array
    {
        $cacheKey = "reservation_history_{$companyId}_{$memberType}_{$date}";
        
        // キャッシュチェック（10分）
        if ($cachedData = $this->getFromCache($cacheKey, 600)) {
            return $cachedData;
        }
        
        $path = "/api/reservations/history";
        
        // パラメータはmakeRequestの第3引数として渡す
        $params = [
            'member_type' => $memberType,
            'date' => $date,
            'company_id' => $companyId
        ];
        
        $result = $this->makeRequest('GET', $path, $params);
        
        if ($result['status'] === 'success') {
            $this->saveToCache($cacheKey, $result, 600);
        }
        
        return $result;
    }
    */
    /**
     * API接続テスト
     */
    public function testConnection(): array
    {
        $testData = [
            'timestamp' => time(),
            'test' => true
        ];
        
        // ヘルスチェックエンドポイント
        $path = "/api/health";
        return $this->makeRequest('GET', $path);
    }
}
