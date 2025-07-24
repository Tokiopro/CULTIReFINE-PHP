<?php

require_once 'GasApiClient.php';

/**
 * ExternalApiクラス
 * GasApiClientへのアダプターとして動作
 */
class ExternalApi
{
    private GasApiClient $gasApi;
    
    public function __construct()
    {
        $this->gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    }
    
    /**
     * LINE IDから外部APIでユーザー情報を取得
     * 
     * @param string $lineUserId LINE User ID
     * @return array|null ユーザーデータ（見つからない場合null、エラー時は例外を投げる）
     * @throws Exception GAS APIエラー、ネットワークエラー等
     */
    public function getUserData(string $lineUserId): ?array
    {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[ExternalApi] getUserData called with LINE User ID: ' . $lineUserId);
        }
        
        // モックモードの場合
        if (MOCK_MODE) {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[ExternalApi] Using mock mode');
            }
            return $this->getMockUserData($lineUserId);
        }
        
        try {
            // GAS APIを使用してユーザー情報を取得
            $result = $this->gasApi->getUserFullInfo($lineUserId);
            
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[ExternalApi] GAS API response: ' . json_encode([
                    'status' => $result['status'] ?? 'no_status',
                    'has_data' => isset($result['data']),
                    'error_code' => $result['error']['code'] ?? null,
                    'error_message' => $result['error']['message'] ?? null
                ]));
                
                // 詳細なレスポンス情報
                error_log('[ExternalApi] Full response keys: ' . implode(', ', array_keys($result ?? [])));
                if (isset($result['data'])) {
                    error_log('[ExternalApi] Data keys: ' . implode(', ', array_keys($result['data'])));
                    // フラット形式の確認
                    if (isset($result['data']['visitor_id'])) {
                        error_log('[ExternalApi] Found visitor_id in flat format: ' . $result['data']['visitor_id']);
                    }
                }
            }
            
            // エラー処理
            if ($result['status'] === 'error') {
                $errorCode = $result['error']['code'] ?? '';
                $errorMessage = $result['error']['message'] ?? 'Unknown error';
                $errorDetails = $result['error']['details'] ?? null;
                
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('[ExternalApi] GAS API Error:');
                    error_log('[ExternalApi]   Code: ' . $errorCode);
                    error_log('[ExternalApi]   Message: ' . $errorMessage);
                    error_log('[ExternalApi]   Details: ' . json_encode($errorDetails));
                }
                
                // ユーザー未発見の場合はnullを返す（正常なケース）
                if ($errorCode === 'USER_NOT_FOUND' || $errorCode === 'NOT_FOUND' || 
                    strpos($errorMessage, '指定されたLINE IDのユーザーが見つかりません') !== false) {
                    if (defined('DEBUG_MODE') && DEBUG_MODE) {
                        error_log('[ExternalApi] User not found in GAS API (normal case): ' . $lineUserId);
                    }
                    return null;
                }
                
                // その他のエラーは例外として投げる
                $detailMessage = "GAS API Error [{$errorCode}]: {$errorMessage}";
                error_log('[ExternalApi] ' . $detailMessage);
                throw new Exception($detailMessage);
            }
            
            // 成功時のデータ変換
            if (!isset($result['data']) || !is_array($result['data'])) {
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('[ExternalApi] Invalid response: missing data field');
                }
                throw new Exception('GAS API returned invalid data structure');
            }
            
            $gasData = $result['data'];
            
            // 新形式のレスポンスに対応（フラット構造）
            if (isset($gasData['visitor_id']) || isset($gasData['visitor_name'])) {
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('[ExternalApi] Detected new flat format response from GAS API');
                    error_log('[ExternalApi] visitor_id: ' . ($gasData['visitor_id'] ?? 'not_set'));
                    error_log('[ExternalApi] visitor_name: ' . ($gasData['visitor_name'] ?? 'not_set'));
                    error_log('[ExternalApi] member_type: ' . ($gasData['member_type'] ?? 'not_set'));
                }
                
                // 新形式のデータをそのまま返す
                return $gasData;
            }
            
            // 旧形式のデータ構造の検証
            if (!isset($gasData['user']) || !is_array($gasData['user'])) {
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('[ExternalApi] Invalid user data structure from GAS API: ' . json_encode($gasData));
                }
                // データ構造が期待通りでない場合もユーザー未発見として扱う
                return null;
            }
            
            // GAS APIのデータ構造を旧ExternalApi互換形式に変換
            $userData = [
                'id' => $gasData['user']['id'] ?? $gasData['visitor']['visitor_id'] ?? null,
                'visitor_id' => $gasData['user']['id'] ?? $gasData['visitor']['visitor_id'] ?? null,
                'line_user_id' => $lineUserId,
                'name' => $gasData['user']['name'] ?? $gasData['visitor']['visitor_name'] ?? null,
                'visitor_name' => $gasData['user']['name'] ?? $gasData['visitor']['visitor_name'] ?? null,
                'email' => $gasData['user']['email'] ?? null,
                'phone' => $gasData['user']['phone'] ?? null,
                'created_at' => $gasData['user']['created_at'] ?? date('Y-m-d H:i:s'),
                'member_type' => $gasData['user']['member_type'] ?? $gasData['visitor']['member_type'] ?? 'sub'
            ];
            
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[ExternalApi] Successfully converted user data: ' . json_encode($userData));
                error_log('[ExternalApi] Returning user data with visitor_id: ' . ($userData['visitor_id'] ?? 'null'));
            }
            
            return $userData;
            
        } catch (Exception $e) {
            // 既にログ出力済みでない場合のみログ出力
            if (strpos($e->getMessage(), 'GAS API Error') !== 0) {
                error_log('[ExternalApi] Exception in getUserData: ' . $e->getMessage());
            }
            
            // すべての例外を再投げ
            throw $e;
        }
    }
    
    /**
     * 予約情報を取得
     */
    public function getReservations(string $userId): ?array
    {
        // GAS APIは全情報APIから予約情報を取得
        $lineUserId = $this->getLineUserIdFromUserId($userId);
        if (!$lineUserId) {
            return null;
        }
        
        $result = $this->gasApi->getUserFullInfo($lineUserId);
        
        if ($result['status'] === 'error') {
            return null;
        }
        
        return $result['data']['upcoming_reservations'] ?? [];
    }
    
    /**
     * 新規ユーザーを登録
     * LINE認証時に呼び出され、Medical Force APIとGAS APIの両方に登録
     */
    public function createUser(array $userData): ?array
    {
        try {
            // Step 1: Medical Force APIで来院者を作成（モック実装）
            // 実際の実装では、Medical Force APIを呼び出してvisitor_idを取得
            $medicalForceVisitorId = 'MF' . time(); // モックID
            
            // Step 2: 名前の分割処理
            $nameParts = explode(' ', $userData['name'] ?? '', 2);
            $lastName = $nameParts[0] ?? $userData['name'] ?? '';
            $firstName = $nameParts[1] ?? '';
            
            // カナが提供されない場合は名前をそのまま使用（暫定対応）
            $lastNameKana = $lastName;
            $firstNameKana = $firstName;
            
            // Step 3: GAS APIに来院者を登録
            $gasApiData = [
                'path' => 'api/visitors',
                'api_key' => GAS_API_KEY,
                'visitor_id' => $medicalForceVisitorId,
                'last_name' => $lastName,
                'first_name' => $firstName ?: '未設定', // 名がない場合のデフォルト
                'last_name_kana' => $lastNameKana,
                'first_name_kana' => $firstNameKana ?: 'ミセッテイ',
                'email' => $userData['email'] ?? '',
                'phone' => $userData['phone'] ?? '',
                'gender' => 'other', // LINEプロフィールから性別は取得できないため
                'publicity_status' => 'private',
                'notes' => 'LINE認証により自動登録'
            ];
            
            $result = $this->gasApi->createVisitorToSheet($gasApiData);
            
            if ($result['status'] === 'error') {
                error_log('GAS API visitor creation failed: ' . json_encode($result));
                
                // エラーが発生してもLINE認証は継続（ユーザー体験を優先）
                // ただし、ログに記録して後で対応できるようにする
                return [
                    'id' => $medicalForceVisitorId,
                    'line_user_id' => $userData['line_user_id'],
                    'name' => $userData['name'],
                    'email' => $userData['email'] ?? '',
                    'phone' => $userData['phone'] ?? '',
                    'created_at' => date('Y-m-d H:i:s'),
                    'gas_registration_failed' => true
                ];
            }
            
            // 成功時の情報を返す
            return [
                'id' => $medicalForceVisitorId,
                'line_user_id' => $userData['line_user_id'],
                'name' => $userData['name'],
                'email' => $userData['email'] ?? '',
                'phone' => $userData['phone'] ?? '',
                'created_at' => date('Y-m-d H:i:s')
            ];
            
        } catch (Exception $e) {
            error_log('Error creating user: ' . $e->getMessage());
            
            // エラーが発生してもnullは返さず、最低限の情報を返す
            return [
                'id' => 'temp_' . time(),
                'line_user_id' => $userData['line_user_id'],
                'name' => $userData['name'],
                'email' => $userData['email'] ?? '',
                'phone' => $userData['phone'] ?? '',
                'created_at' => date('Y-m-d H:i:s'),
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * モックユーザーデータを返す
     */
    private function getMockUserData(string $lineUserId): array
    {
        return [
            'id' => 'mock_user_' . substr($lineUserId, 0, 8),
            'line_user_id' => $lineUserId,
            'name' => 'テストユーザー',
            'email' => 'test@example.com',
            'phone' => '090-0000-0000',
            'created_at' => date('Y-m-d H:i:s')
        ];
    }
    
    /**
     * ユーザーIDからLINE IDを取得するヘルパー
     */
    private function getLineUserIdFromUserId(string $userId): ?string
    {
        // 通常はセッションから取得
        if (isset($_SESSION['line_user_id'])) {
            return $_SESSION['line_user_id'];
        }
        
        // TODO: userIdからLINE IDを逆引きするAPIが必要
        return null;
    }
}