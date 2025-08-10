<?php

/**
 * Medical Force API クライアント
 * 来院者管理用のAPI通信クラス
 */
class MedicalForceApiClient
{
    private string $baseUrl;
    private string $apiKey;
    private string $clientId;
    private string $clientSecret;
    private string $clinicId;
    private int $timeout;
    private ?string $accessToken = null;
    private ?int $tokenExpiry = null;
    
    public function __construct(string $baseUrl, string $apiKey, string $clientId = '', string $clientSecret = '', string $clinicId = '', int $timeout = 60)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        // clinic_idの取得優先順位: 1. 引数 2. MEDICAL_FORCE_CLINIC_ID 3. CLINIC_ID
        $this->clinicId = $clinicId ?: (defined('MEDICAL_FORCE_CLINIC_ID') ? MEDICAL_FORCE_CLINIC_ID : (getenv('MEDICAL_FORCE_CLINIC_ID') ?: getenv('CLINIC_ID') ?: ''));
        $this->timeout = $timeout;
        
        // デバッグ: clinic_id設定状況
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force API] Constructor initialized:');
            error_log('[Medical Force API]   - Base URL: ' . $this->baseUrl);
            error_log('[Medical Force API]   - Clinic ID: ' . ($this->clinicId ?: 'NOT SET (WARNING!)'));
            error_log('[Medical Force API]   - API Key: ' . (empty($this->apiKey) ? 'NOT SET' : 'SET (length: ' . strlen($this->apiKey) . ')'));
            error_log('[Medical Force API]   - Client ID: ' . (empty($this->clientId) ? 'NOT SET' : 'SET'));
        }
    }
    
    /**
     * OAuth 2.0 アクセストークンを取得
     * 
     * @return string アクセストークン
     * @throws Exception
     */
    private function getAccessToken(): string
    {
        // 既存のトークンが有効かチェック
        if ($this->accessToken && $this->tokenExpiry && time() < $this->tokenExpiry) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force OAuth] Using cached token, expires at: ' . date('Y-m-d H:i:s', $this->tokenExpiry));
            }
            return $this->accessToken;
        }
        
        // 環境変数のAPIキーがJWTトークンかチェック
        if (!empty($this->apiKey) && substr($this->apiKey, 0, 2) === 'ey') {
            // JWTトークンの有効期限をチェック
            try {
                $parts = explode('.', $this->apiKey);
                if (count($parts) === 3) {
                    $payload = base64_decode($parts[1] . str_repeat('=', 4 - strlen($parts[1]) % 4));
                    $decoded = json_decode($payload, true);
                    
                    if (isset($decoded['exp'])) {
                        $expiry = $decoded['exp'];
                        
                        if (defined('DEBUG_MODE') && DEBUG_MODE) {
                            error_log('[Medical Force OAuth] JWT token expiry check:');
                            error_log('[Medical Force OAuth] Token expires at: ' . date('Y-m-d H:i:s', $expiry));
                            error_log('[Medical Force OAuth] Current time: ' . date('Y-m-d H:i:s', time()));
                            error_log('[Medical Force OAuth] Is expired: ' . ($expiry <= time() ? 'YES' : 'NO'));
                        }
                        
                        // 強制的に新しいトークンを取得するため、常に期限切れと判定
                        // if ($expiry > time()) {
                        if (false) { // 一時的に無効化
                            // トークンがまだ有効
                            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                                error_log('[Medical Force OAuth] Using valid JWT token from env, expires at: ' . date('Y-m-d H:i:s', $expiry));
                            }
                            $this->accessToken = $this->apiKey;
                            $this->tokenExpiry = $expiry;
                            return $this->apiKey;
                        } else {
                            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                                error_log('[Medical Force OAuth] JWT token from env is expired or forced refresh (expired at: ' . date('Y-m-d H:i:s', $expiry) . ')');
                            }
                        }
                    }
                }
            } catch (Exception $e) {
                error_log('[Medical Force OAuth] Failed to decode JWT token: ' . $e->getMessage());
            }
        }
        
        // OAuth 2.0クライアント認証が設定されている場合
        if (!empty($this->clientId) && !empty($this->clientSecret)) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force OAuth] Using OAuth authentication to get new token');
            }
            
            try {
                return $this->obtainOAuthToken();
            } catch (Exception $e) {
                error_log('[Medical Force OAuth] Failed to obtain OAuth token: ' . $e->getMessage());
                error_log('[Medical Force OAuth] Error code: ' . $e->getCode());
                throw new Exception('OAuth認証に失敗しました: ' . $e->getMessage(), $e->getCode());
            }
        }
        
        // フォールバック: 従来のAPIキー認証
        if (!empty($this->apiKey)) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force OAuth] Falling back to API key authentication');
            }
            return $this->apiKey;
        }
        
        error_log('[Medical Force OAuth] No authentication credentials configured');
        throw new Exception('Medical Force API認証情報が設定されていません', 500);
    }
    
    /**
     * 認証設定の検証
     * 
     * @return array 検証結果
     */
    public function validateAuthConfiguration(): array
    {
        $result = [
            'has_oauth_credentials' => !empty($this->clientId) && !empty($this->clientSecret),
            'has_api_key' => !empty($this->apiKey),
            'preferred_method' => 'none',
            'configuration_status' => 'invalid'
        ];
        
        if ($result['has_oauth_credentials']) {
            $result['preferred_method'] = 'oauth2';
            $result['configuration_status'] = 'valid';
            $result['client_id'] = $this->clientId;
            $result['client_secret_set'] = !empty($this->clientSecret);
        } elseif ($result['has_api_key']) {
            $result['preferred_method'] = 'api_key';
            $result['configuration_status'] = 'valid';
        }
        
        return $result;
    }
    
    /**
     * Medical Force API トークンを取得
     * 
     * @return string アクセストークン
     * @throws Exception
     */
    private function obtainOAuthToken(): string
    {
        // Medical Force API トークンエンドポイント
        $tokenUrl = 'https://api.medical-force.com/token';
        
        // Medical Force API形式: JSONボディでクライアント認証情報を送信
        $postData = [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret
        ];
        
        $options = [
            CURLOPT_URL => $tokenUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($postData),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json'
            ],
            CURLOPT_SSL_VERIFYPEER => false,
        ];
        
        // デバッグ情報をログ出力
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force Token] Token URL: ' . $tokenUrl);
            error_log('[Medical Force Token] Client ID: ' . $this->clientId);
            error_log('[Medical Force Token] Request Body: ' . json_encode($postData));
        }
        
        $curl = curl_init();
        curl_setopt_array($curl, $options);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        
        // デバッグ情報をログ出力
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force Token] Response HTTP Code: ' . $httpCode);
            error_log('[Medical Force Token] Response Body: ' . substr($response, 0, 500));
            if ($error) {
                error_log('[Medical Force Token] cURL Error: ' . $error);
            }
        }
        
        if ($error) {
            error_log('[Medical Force Token] cURL Error: ' . $error);
            throw new Exception("Token取得エラー (cURL): {$error}", 500);
        }
        
        if ($httpCode !== 200) {
            error_log('[Medical Force Token] HTTP Error: ' . $httpCode . ' - ' . $response);
            
            // より詳細なエラーメッセージを提供
            $errorDetails = json_decode($response, true);
            $errorMessage = $errorDetails['message'] ?? $errorDetails['error'] ?? $response;
            
            throw new Exception("Token取得エラー (HTTP {$httpCode}): {$errorMessage}", $httpCode);
        }
        
        $tokenData = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('[Medical Force Token] JSON Parse Error: ' . json_last_error_msg());
            throw new Exception("Token取得エラー: JSONパースエラー - " . json_last_error_msg(), 500);
        }
        
        if (!isset($tokenData['access_token'])) {
            error_log('[Medical Force Token] Missing access_token in response: ' . json_encode($tokenData));
            throw new Exception("Token取得エラー: access_tokenが見つかりません", 500);
        }
        
        // トークンをキャッシュ
        $this->accessToken = $tokenData['access_token'];
        $expiresIn = $tokenData['expires_in'] ?? 86400; // デフォルト24時間
        $this->tokenExpiry = time() + $expiresIn - 300; // 5分のマージンを設ける
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force Token] Token obtained successfully, expires at: ' . date('Y-m-d H:i:s', $this->tokenExpiry));
        }
        
        return $this->accessToken;
    }
    
    /**
     * 来院者を作成
     * 
     * @param array $visitorData 来院者データ
     * @return array API response
     */
    public function createVisitor(array $visitorData): array
    {
        try {
            // 必須フィールドの検証
            $required = ['name', 'kana', 'gender'];
            foreach ($required as $field) {
                if (empty($visitorData[$field])) {
                    throw new Exception("必須フィールド '{$field}' が不足しています", 400);
                }
            }
            
            // 性別の検証と変換（GAS側と同じ形式）
            $validGenders = ['MALE', 'FEMALE', 'male', 'female'];
            $gender = strtoupper($visitorData['gender']);
            
            if (!in_array($visitorData['gender'], $validGenders)) {
                error_log('[Medical Force API] Invalid gender value: ' . $visitorData['gender']);
                throw new Exception("無効な性別値が指定されました: " . $visitorData['gender'] . " (有効な値: MALE, FEMALE)", 400);
            }
            
            // GAS側と同じリクエスト形式を使用
            $requestData = [
                'name' => trim($visitorData['name']),
                'name_kana' => trim($visitorData['kana']),
                'gender' => $gender  // 大文字のMALE/FEMALE
            ];
            
            // オプションフィールドの追加
            if (!empty($visitorData['email'])) {
                $requestData['email'] = $visitorData['email'];
            }
            if (!empty($visitorData['phone'])) {
                $requestData['phone'] = $visitorData['phone'];
            }
            if (!empty($visitorData['birthday'])) {
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitorData['birthday'])) {
                    $requestData['birth_date'] = $visitorData['birthday'];
                }
            }
            
            // デバッグ: リクエストデータの詳細
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force API] === Visitor Creation Request ===');
                error_log('[Medical Force API] Original data:');
                error_log('[Medical Force API]   - name: ' . $visitorData['name']);
                error_log('[Medical Force API]   - kana: ' . $visitorData['kana']);
                error_log('[Medical Force API]   - gender: ' . $visitorData['gender']);
                error_log('[Medical Force API] Converted data:');
                error_log('[Medical Force API]   - name: ' . $requestData['name']);
                error_log('[Medical Force API]   - name_kana: ' . $requestData['name_kana']);
                error_log('[Medical Force API]   - gender: ' . $requestData['gender']);
                error_log('[Medical Force API] Full request: ' . json_encode($requestData));
            }
            
            // Medical Force APIに送信（GAS側と同じエンドポイント）
            $response = $this->makeRequest('POST', '/developer/visitors', $requestData);
            
            // Medical Force APIの生レスポンスを検証
            // エラーレスポンスの場合、'error'または'message'フィールドが含まれる
            if (isset($response['error']) || (isset($response['message']) && !isset($response['visitor_id']) && !isset($response['id']))) {
                throw new Exception(
                    'Medical Force API エラー: ' . ($response['message'] ?? $response['error'] ?? 'Unknown error'),
                    400
                );
            }
            
            // 成功レスポンスの検証 - visitor_idまたはidが必須
            if (!isset($response['visitor_id']) && !isset($response['id'])) {
                error_log('[Medical Force API] Unexpected response format: ' . json_encode($response));
                throw new Exception(
                    'Medical Force API エラー: 予期しないレスポンス形式です（visitor_idが含まれていません）',
                    500
                );
            }
            
            // visitor_idの取得（'visitor_id'または'id'フィールドから）
            $visitorId = $response['visitor_id'] ?? $response['id'] ?? null;
            if (!$visitorId) {
                throw new Exception('Medical Force API エラー: visitor_idが返されませんでした', 500);
            }
            
            // デバッグ: 成功レスポンスの詳細
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force API] Visitor created successfully:');
                error_log('[Medical Force API]   - Visitor ID: ' . $visitorId);
                error_log('[Medical Force API]   - Full response: ' . json_encode($response));
            }
            
            return [
                'success' => true,
                'visitor_id' => $visitorId,
                'message' => 'Medical Force APIで来院者が作成されました',
                'data' => $response  // 生のレスポンス全体を含める
            ];
            
        } catch (Exception $e) {
            error_log('[Medical Force API] Error creating visitor: ' . $e->getMessage());
            
            // エラーの種類に応じて処理を分岐
            if ($e->getCode() === 400) {
                // バリデーションエラー
                return [
                    'success' => false,
                    'error_type' => 'validation_error',
                    'message' => $e->getMessage()
                ];
            } else {
                // API通信エラー等
                return [
                    'success' => false,
                    'error_type' => 'api_error',
                    'message' => 'Medical Force APIとの通信に失敗しました: ' . $e->getMessage()
                ];
            }
        }
    }
    
    /**
     * 来院者情報を取得
     * 
     * @param string $visitorId 来院者ID
     * @return array API response
     */
    public function getVisitor(string $visitorId): array
    {
        try {
            if (empty($visitorId)) {
                throw new Exception('visitor_idが必要です', 400);
            }
            
            $response = $this->makeRequest('GET', "/api/visitors/{$visitorId}");
            
            if (!$response['success']) {
                throw new Exception(
                    'Medical Force API エラー: ' . ($response['message'] ?? 'Visitor not found'),
                    $response['error_code'] ?? 404
                );
            }
            
            return [
                'success' => true,
                'data' => $response['data'] ?? []
            ];
            
        } catch (Exception $e) {
            error_log('[Medical Force API] Error getting visitor: ' . $e->getMessage());
            
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * HTTP リクエストを実行
     * 
     * @param string $method HTTP メソッド
     * @param string $endpoint エンドポイント
     * @param array $data リクエストデータ
     * @return array レスポンス
     */
    private function makeRequest(string $method, string $endpoint, array $data = []): array
    {
        $url = $this->baseUrl . $endpoint;
        
        // デバッグモードの場合はモックレスポンスを返す
        if (defined('DEBUG_MODE') && DEBUG_MODE && defined('MOCK_MEDICAL_FORCE') && MOCK_MEDICAL_FORCE) {
            return $this->getMockResponse($method, $endpoint, $data);
        }
        
        // OAuth 2.0 アクセストークンを取得
        $token = $this->getAccessToken();
        
        // GAS側と同じシンプルなヘッダー構成
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $token
        ];
        
        // clinic_idはヘッダーではなくリクエストボディに含める（GAS側と同じ方式）
        if (!empty($this->clinicId)) {
            if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
                // POSTの場合はリクエストボディに含める
                $data['clinic_id'] = $this->clinicId;
            } else {
                // GETの場合はクエリパラメータに含める（GAS側では自動処理）
                $separator = strpos($url, '?') !== false ? '&' : '?';
                $url .= $separator . 'clinic_id=' . urlencode($this->clinicId);
            }
        } else {
            // clinic_idが必須の場合はエラーとする
            error_log('[Medical Force API] ERROR: clinic_id is required but not set');
            throw new Exception('Medical Force API: clinic_id is required', 400);
        }
        
        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_SSL_VERIFYPEER => false,
        ];
        
        if (!empty($data) && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }
        
        // デバッグ: 送信されるリクエストの詳細をログ（GAS側と同様）
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force API] ===== Request Details (GAS Compatible) =====');
            error_log('[Medical Force API] URL: ' . $url);
            error_log('[Medical Force API] Method: ' . $method);
            error_log('[Medical Force API] Headers: ' . json_encode($headers));
            if (!empty($data)) {
                error_log('[Medical Force API] Request Body: ' . json_encode($data));
            }
            error_log('[Medical Force API] Clinic ID: ' . ($this->clinicId ?: 'NOT SET'));
            error_log('[Medical Force API] Token (first 20 chars): ' . substr($token, 0, 20) . '...');
            error_log('[Medical Force API] =========================');
        }
        
        $curl = curl_init();
        curl_setopt_array($curl, $options);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        
        if ($error) {
            error_log('[Medical Force API] cURL Error occurred: ' . $error);
            throw new Exception("cURL Error: {$error}", 500);
        }
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force API] ===== Response Details =====');
            error_log('[Medical Force API] HTTP Code: ' . $httpCode);
            error_log('[Medical Force API] Response body: ' . $response);
            error_log('[Medical Force API] ===========================');
        }
        
        $decodedResponse = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('[Medical Force API] JSON decode error: ' . json_last_error_msg());
            error_log('[Medical Force API] Raw response: ' . $response);
            throw new Exception("Invalid JSON response: " . json_last_error_msg(), 500);
        }
        
        // HTTPエラーコードをチェック
        if ($httpCode >= 400) {
            $errorMessage = $decodedResponse['message'] ?? "HTTP Error {$httpCode}";
            
            // 詳細なエラー情報をログに記録
            error_log('[Medical Force API] HTTP Error ' . $httpCode . ': ' . $errorMessage);
            error_log('[Medical Force API] Full error response: ' . json_encode($decodedResponse));
            
            if ($httpCode === 401) {
                error_log('[Medical Force API] 401 Unauthorized - OAuth token may be invalid or expired');
                error_log('[Medical Force API] Token used: ' . substr($token, 0, 20) . '...');
                throw new Exception("認証エラー: " . $errorMessage, 401);
            } elseif ($httpCode === 403) {
                error_log('[Medical Force API] 403 Forbidden - Check clinic_id and permissions');
                error_log('[Medical Force API] Clinic ID used: ' . $this->clinicId);
                throw new Exception("権限エラー: " . $errorMessage, 403);
            } elseif ($httpCode === 404) {
                error_log('[Medical Force API] 404 Not Found - Check endpoint: ' . $endpoint);
                throw new Exception("エンドポイントが見つかりません: " . $errorMessage, 404);
            } else {
                throw new Exception($errorMessage, $httpCode);
            }
        }
        
        return $decodedResponse;
    }
    
    /**
     * モック レスポンスを生成（開発用）
     * 
     * @param string $method HTTP メソッド
     * @param string $endpoint エンドポイント
     * @param array $data リクエストデータ
     * @return array モック レスポンス
     */
    private function getMockResponse(string $method, string $endpoint, array $data = []): array
    {
        if ($method === 'POST' && strpos($endpoint, '/api/visitors') === 0) {
            // 来院者作成のモック
            $mockVisitorId = $this->generateMockVisitorId();
            
            return [
                'success' => true,
                'data' => [
                    'visitor_id' => $mockVisitorId,
                    'last_name' => $data['last_name'] ?? '',
                    'first_name' => $data['first_name'] ?? '',
                    'gender' => $data['gender'] ?? 'other',
                    'created_at' => date('Y-m-d H:i:s')
                ],
                'message' => 'Mock: 来院者が作成されました'
            ];
        }
        
        if ($method === 'GET' && preg_match('/\/api\/visitors\/(.+)/', $endpoint, $matches)) {
            // 来院者取得のモック
            $visitorId = $matches[1];
            
            return [
                'success' => true,
                'data' => [
                    'visitor_id' => $visitorId,
                    'last_name' => 'テスト',
                    'first_name' => 'ユーザー',
                    'gender' => 'other',
                    'created_at' => date('Y-m-d H:i:s')
                ]
            ];
        }
        
        return [
            'success' => false,
            'message' => 'Mock: エンドポイントが見つかりません'
        ];
    }
    
    /**
     * モック用の来院者IDを生成
     * 
     * @return string
     */
    private function generateMockVisitorId(): string
    {
        return 'MF_' . date('YmdHis') . '_' . substr(md5(uniqid()), 0, 6);
    }
    
    /**
     * OAuth 2.0認証テスト
     * 
     * @return array テスト結果
     */
    public function testOAuthAuthentication(): array
    {
        try {
            // 認証設定の検証
            $authConfig = $this->validateAuthConfiguration();
            
            // OAuth 2.0トークンの取得をテスト
            $token = $this->getAccessToken();
            
            return [
                'success' => true,
                'message' => 'Medical Force API認証成功',
                'authentication_method' => $authConfig['preferred_method'],
                'configuration' => $authConfig,
                'has_token' => !empty($token),
                'token_cached' => $this->accessToken !== null,
                'expires_at' => $this->tokenExpiry ? date('Y-m-d H:i:s', $this->tokenExpiry) : null,
                'token_length' => strlen($token),
            ];
            
        } catch (Exception $e) {
            $authConfig = $this->validateAuthConfiguration();
            
            return [
                'success' => false,
                'message' => 'Medical Force API認証失敗: ' . $e->getMessage(),
                'authentication_method' => $authConfig['preferred_method'],
                'configuration' => $authConfig,
                'error_code' => $e->getCode()
            ];
        }
    }
    
    /**
     * API接続テスト
     * 
     * @return array テスト結果
     */
    public function testConnection(): array
    {
        try {
            // まずOAuth認証をテスト
            $authTest = $this->testOAuthAuthentication();
            
            if (!$authTest['success']) {
                return $authTest;
            }
            
            // ヘルスチェックエンドポイントを呼び出し
            $response = $this->makeRequest('GET', '/api/health');
            
            return [
                'success' => true,
                'message' => 'Medical Force API接続成功',
                'authentication' => $authTest,
                'data' => $response
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Medical Force API接続失敗: ' . $e->getMessage(),
                'authentication' => $this->testOAuthAuthentication()
            ];
        }
    }
    
    /**
     * 空き時間一覧を取得（Medical Force API）
     * 
     * @param array $requestBody リクエストボディ
     * @return array 空き時間情報
     * @throws Exception
     */
    public function getVacancies(array $requestBody): array
    {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force API] Getting vacancies with body: ' . json_encode($requestBody));
        }
        
        try {
            $response = $this->makeRequest('POST', '/developer/vacancies', $requestBody);
            
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force API] Vacancies response: ' . json_encode($response));
            }
            
            // レスポンスがそのまま空き時間情報の場合
            if (is_array($response) && !isset($response['error'])) {
                return $response;
            }
            
            // エラーレスポンスの場合
            if (isset($response['message'])) {
                throw new Exception('Medical Force API Error: ' . $response['message'], 400);
            }
            
            throw new Exception('Unexpected response format from Medical Force API', 500);
            
        } catch (Exception $e) {
            error_log('[Medical Force API] Vacancies error: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * 予約を作成（Medical Force API）
     * 
     * @param array $reservationData 予約データ
     * @return array 予約作成結果
     * @throws Exception
     */
    public function createReservation(array $reservationData): array
    {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force API] Creating reservation with data: ' . json_encode($reservationData));
        }
        
        try {
            // 必須フィールドの検証
            $requiredFields = ['visitor_id', 'start_at', 'menus'];
            foreach ($requiredFields as $field) {
                if (!isset($reservationData[$field])) {
                    throw new Exception("必須フィールド '{$field}' が不足しています", 400);
                }
            }
            
            // menusが配列で、各要素にmenu_idが含まれているかチェック
            if (!is_array($reservationData['menus']) || empty($reservationData['menus'])) {
                throw new Exception('menus は空でない配列である必要があります', 400);
            }
            
            foreach ($reservationData['menus'] as $menu) {
                if (!isset($menu['menu_id'])) {
                    throw new Exception('各メニューには menu_id が必要です', 400);
                }
            }
            
            // デフォルト値を設定
            $requestData = array_merge([
                'note' => '天満病院予約システムからの予約',
                'is_online' => false
            ], $reservationData);
            
            $response = $this->makeRequest('POST', '/developer/reservations', $requestData);
            
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force API] Reservation created successfully: ' . json_encode($response));
            }
            
            // 成功レスポンスの場合
            if (isset($response['reservation_id'])) {
                return [
                    'success' => true,
                    'reservation_id' => $response['reservation_id'],
                    'message' => '予約が正常に作成されました'
                ];
            }
            
            // エラーレスポンスの場合
            if (isset($response['message'])) {
                $detailedError = $this->parseApiError($response);
                throw new Exception($detailedError, 400);
            }
            
            throw new Exception('Unexpected response format from Medical Force API', 500);
            
        } catch (Exception $e) {
            error_log('[Medical Force API] Reservation creation error: ' . $e->getMessage());
            
            // エラーレスポンスを統一フォーマットで返す
            $errorDetails = $this->categorizeError($e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'code' => $e->getCode(),
                'category' => $errorDetails['category'],
                'user_message' => $errorDetails['user_message']
            ];
        }
    }
    
    /**
     * APIエラーレスポンスを解析してより詳細なエラーメッセージを生成
     */
    private function parseApiError(array $response): string
    {
        $message = $response['message'] ?? 'Unknown API error';
        $errors = $response['errors'] ?? [];
        
        // 具体的なエラー情報があれば追加
        if (!empty($errors)) {
            if (is_array($errors)) {
                $errorDetails = [];
                foreach ($errors as $field => $fieldErrors) {
                    if (is_array($fieldErrors)) {
                        $errorDetails[] = "{$field}: " . implode(', ', $fieldErrors);
                    } else {
                        $errorDetails[] = "{$field}: {$fieldErrors}";
                    }
                }
                if (!empty($errorDetails)) {
                    $message .= ' (' . implode('; ', $errorDetails) . ')';
                }
            }
        }
        
        return $message;
    }
    
    
    /**
     * エラーメッセージをカテゴリ別に分類
     */
    private function categorizeError(string $errorMessage): array
    {
        $msg = strtolower($errorMessage);
        
        if (strpos($msg, 'time slot not available') !== false || 
            strpos($msg, 'already booked') !== false ||
            strpos($msg, '時間が重複') !== false) {
            return [
                'category' => 'time_conflict',
                'user_message' => '選択した時間は既に予約済みです。他の時間をお選びください。'
            ];
        }
        
        if (strpos($msg, 'visitor not found') !== false ||
            strpos($msg, 'patient not found') !== false ||
            strpos($msg, '患者が見つかりません') !== false) {
            return [
                'category' => 'patient_not_found',
                'user_message' => '患者情報が見つかりません。患者登録を確認してください。'
            ];
        }
        
        if (strpos($msg, 'invalid menu') !== false ||
            strpos($msg, 'menu not found') !== false ||
            strpos($msg, 'メニューが無効') !== false) {
            return [
                'category' => 'invalid_menu',
                'user_message' => '選択されたメニューが無効です。メニューを再選択してください。'
            ];
        }
        
        if (strpos($msg, 'insufficient tickets') !== false ||
            strpos($msg, 'チケット不足') !== false) {
            return [
                'category' => 'insufficient_tickets',
                'user_message' => 'チケットが不足しています。チケットをご購入ください。'
            ];
        }
        
        if (strpos($msg, 'business hours') !== false ||
            strpos($msg, '営業時間外') !== false) {
            return [
                'category' => 'outside_business_hours',
                'user_message' => '営業時間外の予約です。営業時間内の時間をお選びください。'
            ];
        }
        
        if (strpos($msg, 'past date') !== false ||
            strpos($msg, '過去の日付') !== false) {
            return [
                'category' => 'past_date',
                'user_message' => '過去の日付には予約できません。未来の日付をお選びください。'
            ];
        }
        
        if (strpos($msg, 'interval') !== false ||
            strpos($msg, '間隔') !== false) {
            return [
                'category' => 'treatment_interval',
                'user_message' => '施術間隔の規則に違反しています。前回の施術から十分な期間をおいてください。'
            ];
        }
        
        // その他のエラー
        return [
            'category' => 'other',
            'user_message' => $errorMessage
        ];
    }
}