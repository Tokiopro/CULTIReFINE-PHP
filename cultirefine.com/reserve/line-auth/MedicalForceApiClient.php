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
    private int $timeout;
    private ?string $accessToken = null;
    private ?int $tokenExpiry = null;
    
    public function __construct(string $baseUrl, string $apiKey, string $clientId = '', string $clientSecret = '', int $timeout = 30)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        $this->timeout = $timeout;
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
        
        // OAuth 2.0クライアント認証が設定されている場合
        if (!empty($this->clientId) && !empty($this->clientSecret)) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[Medical Force OAuth] Using OAuth 2.0 authentication');
            }
            return $this->obtainOAuthToken();
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
     * OAuth 2.0 Client Credentials Grant でトークンを取得
     * 
     * @return string アクセストークン
     * @throws Exception
     */
    private function obtainOAuthToken(): string
    {
        $tokenUrl = $this->baseUrl . '/oauth/token';
        
        // RFC 6749準拠: クライアント認証はBasic認証ヘッダーで送信
        $postData = [
            'grant_type' => 'client_credentials',
            'scope' => 'api'  // 必要に応じてスコープを調整
        ];
        
        // Basic認証用のクライアント認証情報
        $clientCredentials = base64_encode($this->clientId . ':' . $this->clientSecret);
        
        $options = [
            CURLOPT_URL => $tokenUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postData),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . $clientCredentials,
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json'
            ],
            CURLOPT_SSL_VERIFYPEER => false, // 開発環境用（本番では有効にする）
        ];
        
        // デバッグ情報をログ出力
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force OAuth] Token URL: ' . $tokenUrl);
            error_log('[Medical Force OAuth] Client ID: ' . $this->clientId);
            error_log('[Medical Force OAuth] Post Data: ' . json_encode($postData));
        }
        
        $curl = curl_init();
        curl_setopt_array($curl, $options);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        
        // デバッグ情報をログ出力
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[Medical Force OAuth] HTTP Code: ' . $httpCode);
            error_log('[Medical Force OAuth] Response: ' . substr($response, 0, 500));
        }
        
        if ($error) {
            error_log('[Medical Force OAuth] cURL Error: ' . $error);
            throw new Exception("OAuth Token取得エラー (cURL): {$error}", 500);
        }
        
        if ($httpCode !== 200) {
            error_log('[Medical Force OAuth] HTTP Error: ' . $httpCode . ' - ' . $response);
            
            // より詳細なエラーメッセージを提供
            $errorDetails = json_decode($response, true);
            $errorMessage = $errorDetails['message'] ?? $errorDetails['error_description'] ?? $response;
            
            throw new Exception("OAuth Token取得エラー (HTTP {$httpCode}): {$errorMessage}", $httpCode);
        }
        
        $tokenData = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('[Medical Force OAuth] JSON Parse Error: ' . json_last_error_msg());
            throw new Exception("OAuth Token取得エラー: JSONパースエラー - " . json_last_error_msg(), 500);
        }
        
        if (!isset($tokenData['access_token'])) {
            error_log('[Medical Force OAuth] Missing access_token in response: ' . json_encode($tokenData));
            throw new Exception("OAuth Token取得エラー: access_tokenが見つかりません", 500);
        }
        
        // トークンをキャッシュ
        $this->accessToken = $tokenData['access_token'];
        $expiresIn = $tokenData['expires_in'] ?? 86400; // デフォルト24時間
        $this->tokenExpiry = time() + $expiresIn - 300; // 5分のマージンを設ける
        
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
            
            // 名前の分割処理
            $nameParts = explode(' ', trim($visitorData['name']), 2);
            $lastName = $nameParts[0] ?? '';
            $firstName = $nameParts[1] ?? '';
            
            // カナの分割処理
            $kanaParts = explode(' ', trim($visitorData['kana']), 2);
            $lastNameKana = $kanaParts[0] ?? '';
            $firstNameKana = $kanaParts[1] ?? '';
            
            // 性別の変換
            $genderMap = [
                'MALE' => 'male',
                'FEMALE' => 'female',
                'male' => 'male',
                'female' => 'female'
            ];
            $gender = $genderMap[$visitorData['gender']] ?? 'other';
            
            // Medical Force API用のデータを準備
            $requestData = [
                'last_name' => $lastName,
                'first_name' => $firstName ?: '未設定',
                'last_name_kana' => $lastNameKana,
                'first_name_kana' => $firstNameKana ?: 'ミセッテイ',
                'gender' => $gender
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
            
            // Medical Force APIに送信
            $response = $this->makeRequest('POST', '/api/visitors', $requestData);
            
            if (!$response['success']) {
                throw new Exception(
                    'Medical Force API エラー: ' . ($response['message'] ?? 'Unknown error'),
                    $response['error_code'] ?? 500
                );
            }
            
            return [
                'success' => true,
                'visitor_id' => $response['data']['visitor_id'] ?? $this->generateMockVisitorId(),
                'message' => 'Medical Force APIで来院者が作成されました',
                'data' => $response['data'] ?? []
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
        
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token,
            'Accept: application/json'
        ];
        
        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_SSL_VERIFYPEER => false, // 開発環境用（本番では有効にする）
        ];
        
        if (!empty($data) && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }
        
        $curl = curl_init();
        curl_setopt_array($curl, $options);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        
        if ($error) {
            throw new Exception("cURL Error: {$error}", 500);
        }
        
        $decodedResponse = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON response: {$response}", 500);
        }
        
        // HTTPエラーコードをチェック
        if ($httpCode >= 400) {
            throw new Exception(
                $decodedResponse['message'] ?? "HTTP Error {$httpCode}",
                $httpCode
            );
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
}