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
     */
    public function getUserData(string $lineUserId): ?array
    {
        // モックモードの場合
        if (MOCK_MODE) {
            return $this->getMockUserData($lineUserId);
        }
        
        // GAS APIを使用してユーザー情報を取得
        $result = $this->gasApi->getUserFullInfo($lineUserId);
        
        if ($result['status'] === 'error') {
            if ($result['error']['code'] === 'USER_NOT_FOUND') {
                return null;
            }
            throw new Exception($result['error']['message']);
        }
        
        // GAS APIのデータ構造を旧ExternalApi互換形式に変換
        $gasData = $result['data'];
        return [
            'id' => $gasData['user']['id'] ?? null,
            'line_user_id' => $lineUserId,
            'name' => $gasData['user']['name'] ?? null,
            'email' => $gasData['user']['email'] ?? null,
            'phone' => $gasData['user']['phone'] ?? null,
            'created_at' => $gasData['user']['created_at'] ?? date('Y-m-d H:i:s')
        ];
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