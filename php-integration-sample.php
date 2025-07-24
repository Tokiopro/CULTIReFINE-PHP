<?php
/**
 * 天満病院 GAS API クライアント - PHPサンプル実装
 * 
 * このファイルは、GAS APIを呼び出すためのPHPクライアントの実装例です。
 * 実際の使用時は、環境に合わせて調整してください。
 */

class TenmaHospitalGasApiClient {
    private $deploymentId;
    private $apiKey;
    private $baseUrl;
    
    /**
     * コンストラクタ
     * 
     * @param string $deploymentId GASのデプロイメントID
     * @param string $apiKey APIキー
     */
    public function __construct($deploymentId, $apiKey) {
        $this->deploymentId = $deploymentId;
        $this->apiKey = $apiKey;
        $this->baseUrl = "https://script.google.com/macros/s/{$deploymentId}/exec";
    }
    
    /**
     * LINE IDから全ユーザー情報を取得
     * 
     * @param string $lineUserId LINE ユーザーID
     * @return array APIレスポンス
     * @throws Exception APIエラーの場合
     */
    public function getUserFullInfo($lineUserId) {
        $url = $this->baseUrl . "?path=" . urlencode("api/users/line/{$lineUserId}/full");
        
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json'
        ];
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception('CURL Error: ' . $error);
        }
        
        if ($httpCode !== 200) {
            throw new Exception('API request failed: HTTP ' . $httpCode);
        }
        
        $result = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('JSON decode error: ' . json_last_error_msg());
        }
        
        return $result;
    }
    
    /**
     * エラーレスポンスかどうかをチェック
     * 
     * @param array $response APIレスポンス
     * @return bool エラーの場合true
     */
    public function isError($response) {
        return isset($response['status']) && $response['status'] === 'error';
    }
    
    /**
     * エラーメッセージを取得
     * 
     * @param array $response APIレスポンス
     * @return string エラーメッセージ
     */
    public function getErrorMessage($response) {
        if ($this->isError($response)) {
            return $response['error']['message'] ?? 'Unknown error';
        }
        return '';
    }
}

// =====================================
// 使用例
// =====================================

// 設定（環境変数から取得することを推奨）
$deploymentId = getenv('GAS_DEPLOYMENT_ID') ?: 'YOUR_DEPLOYMENT_ID';
$apiKey = getenv('GAS_API_KEY') ?: 'YOUR_API_KEY';

// APIクライアントの初期化
$api = new TenmaHospitalGasApiClient($deploymentId, $apiKey);

// セッションまたは他の方法でLINE IDを取得
session_start();
$lineUserId = $_SESSION['line_user_id'] ?? null;

if ($lineUserId) {
    try {
        // API呼び出し
        $result = $api->getUserFullInfo($lineUserId);
        
        if (!$api->isError($result)) {
            $userData = $result['data'];
            
            // ユーザー情報の表示例
            echo "<h1>ようこそ、{$userData['user']['name']}さん</h1>\n";
            
            // 会員情報の確認
            if ($userData['membership_info']['is_member']) {
                $membership = $userData['membership_info'];
                echo "<h2>会員情報</h2>\n";
                echo "<p>会員種別: {$membership['member_type']}</p>\n";
                echo "<p>会社名: {$membership['company_name']}</p>\n";
                echo "<p>役職: {$membership['position']}</p>\n";
                
                if ($membership['ticket_balance']) {
                    echo "<h3>チケット残高</h3>\n";
                    echo "<ul>\n";
                    echo "  <li>幹細胞チケット: {$membership['ticket_balance']['stem_cell']}枚</li>\n";
                    echo "  <li>施術チケット: {$membership['ticket_balance']['treatment']}枚</li>\n";
                    echo "  <li>点滴チケット: {$membership['ticket_balance']['drip']}枚</li>\n";
                    echo "</ul>\n";
                }
            }
            
            // 今後の予約
            if (!empty($userData['upcoming_reservations'])) {
                echo "<h2>今後の予約</h2>\n";
                echo "<ul>\n";
                foreach ($userData['upcoming_reservations'] as $reservation) {
                    echo "  <li>{$reservation['reservation_date']} {$reservation['reservation_time']} - {$reservation['treatment_name']}</li>\n";
                }
                echo "</ul>\n";
            }
            
            // 予約可能な施術
            echo "<h2>予約可能な施術</h2>\n";
            echo "<ul>\n";
            foreach ($userData['available_treatments'] as $treatment) {
                if ($treatment['can_book']) {
                    echo "  <li>{$treatment['treatment_name']} - 料金: ¥" . number_format($treatment['price']) . "</li>\n";
                } else {
                    echo "  <li class='disabled'>{$treatment['treatment_name']} - {$treatment['reason']}</li>\n";
                }
            }
            echo "</ul>\n";
            
            // 統計情報
            $stats = $userData['statistics'];
            echo "<h2>ご利用統計</h2>\n";
            echo "<p>総来院回数: {$stats['total_visits']}回</p>\n";
            echo "<p>過去30日間の来院: {$stats['last_30_days_visits']}回</p>\n";
            if ($stats['favorite_treatment']) {
                echo "<p>よく受ける施術: {$stats['favorite_treatment']}</p>\n";
            }
            
        } else {
            // エラー処理
            $errorMessage = $api->getErrorMessage($result);
            echo "<p>エラー: {$errorMessage}</p>\n";
            
            // エラーコードによる処理分岐
            if ($result['error']['code'] === 'USER_NOT_FOUND') {
                // 新規登録画面へ誘導など
                echo "<p>ユーザー登録が必要です。</p>\n";
            }
        }
        
    } catch (Exception $e) {
        // 例外処理
        error_log('GAS API Error: ' . $e->getMessage());
        echo "<p>システムエラーが発生しました。しばらくしてから再度お試しください。</p>\n";
    }
} else {
    echo "<p>LINE認証が必要です。</p>\n";
}

// =====================================
// Laravel/Symfonyなどのフレームワーク用サービスクラス例
// =====================================

/**
 * Laravel サービスプロバイダ例
 */
/*
namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GasApiService
{
    private $client;
    
    public function __construct()
    {
        $this->client = new TenmaHospitalGasApiClient(
            config('services.gas.deployment_id'),
            config('services.gas.api_key')
        );
    }
    
    public function getUserInfo($lineUserId)
    {
        // 5分間キャッシュ
        return Cache::remember("gas_user_{$lineUserId}", 300, function () use ($lineUserId) {
            try {
                $response = $this->client->getUserFullInfo($lineUserId);
                
                if ($this->client->isError($response)) {
                    Log::error('GAS API Error', [
                        'line_user_id' => $lineUserId,
                        'error' => $response['error']
                    ]);
                    return null;
                }
                
                return $response['data'];
                
            } catch (Exception $e) {
                Log::error('GAS API Exception', [
                    'line_user_id' => $lineUserId,
                    'exception' => $e->getMessage()
                ]);
                return null;
            }
        });
    }
}
*/

// =====================================
// Ajax呼び出し用エンドポイント例
// =====================================

/**
 * api/get-user-info.php
 */
/*
header('Content-Type: application/json');

session_start();

if (!isset($_SESSION['line_user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

try {
    $api = new TenmaHospitalGasApiClient(
        getenv('GAS_DEPLOYMENT_ID'),
        getenv('GAS_API_KEY')
    );
    
    $result = $api->getUserFullInfo($_SESSION['line_user_id']);
    
    if ($api->isError($result)) {
        http_response_code(400);
        echo json_encode(['error' => $api->getErrorMessage($result)]);
    } else {
        echo json_encode($result['data']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
*/

// =====================================
// JavaScript フロントエンド呼び出し例
// =====================================

/*
<script>
// Vue.js/React などでの使用例
async function fetchUserInfo() {
    try {
        const response = await fetch('/api/get-user-info.php');
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const userData = await response.json();
        
        // UIを更新
        updateUserInterface(userData);
        
    } catch (error) {
        console.error('Error fetching user info:', error);
        showErrorMessage('データの取得に失敗しました');
    }
}

function updateUserInterface(userData) {
    // ユーザー名を表示
    document.getElementById('userName').textContent = userData.user.name;
    
    // チケット残高を更新
    if (userData.membership_info.is_member) {
        const tickets = userData.membership_info.ticket_balance;
        document.getElementById('stemCellTickets').textContent = tickets.stem_cell;
        document.getElementById('treatmentTickets').textContent = tickets.treatment;
        document.getElementById('dripTickets').textContent = tickets.drip;
    }
    
    // 予約リストを更新
    const reservationList = document.getElementById('reservations');
    reservationList.innerHTML = '';
    
    userData.upcoming_reservations.forEach(reservation => {
        const li = document.createElement('li');
        li.textContent = `${reservation.reservation_date} ${reservation.reservation_time} - ${reservation.treatment_name}`;
        reservationList.appendChild(li);
    });
}
</script>
*/
?>