<?php
/**
 * JavaScript用API Bridge
 * フロントエンドからのAPI呼び出しを受けてGAS APIに中継
 */

session_start();

// CORS対応
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// OPTIONSリクエスト（プリフライト）への対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'line-auth/config.php';
require_once 'line-auth/GasApiClient.php';
require_once 'line-auth/logger.php';

$logger = new Logger();

try {
    // LINE認証チェック
    if (!isset($_SESSION['line_user_id'])) {
        throw new Exception('認証が必要です', 401);
    }
    
    $lineUserId = $_SESSION['line_user_id'];
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    // ルーティング
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'getUserFullInfo':
            $result = handleGetUserFullInfo($gasApi, $lineUserId);
            break;
            
        case 'getAvailability':
            $result = handleGetAvailability($gasApi, $_GET);
            break;
            
        case 'createReservation':
            $result = handleCreateReservation($gasApi, $lineUserId, getJsonInput());
            break;
            
        case 'cancelReservation':
            $result = handleCancelReservation($gasApi, $_GET['reservation_id'] ?? '');
            break;
            
        case 'testConnection':
            $result = handleTestConnection($gasApi);
            break;
            
        case 'createVisitor':
            $result = handleCreateVisitor($gasApi, $lineUserId, getJsonInput());
            break;
            
        case 'getCompanyVisitors':
            $result = handleGetCompanyVisitors($gasApi, $lineUserId, $_GET);
            break;
            
        case 'updateVisitorPublicStatus':
            $result = handleUpdateVisitorPublicStatus($gasApi, $lineUserId, getJsonInput());
            break;
            
        case 'getPatientMenus':
            $result = handleGetPatientMenus($gasApi, $_GET);
            break;
            
        case 'createMedicalForceReservation':
            $result = handleCreateMedicalForceReservation($gasApi, getJsonInput());
            break;
            
        default:
            throw new Exception('不正なアクションです', 400);
    }
    
    // 成功レスポンス
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
    
} catch (Exception $e) {
    $statusCode = $e->getCode() ?: 500;
    http_response_code($statusCode);
    
    $errorResponse = [
        'success' => false,
        'error' => [
            'code' => $statusCode,
            'message' => $e->getMessage()
        ]
    ];
    
    // デバッグモードでは詳細情報を追加
    if (DEBUG_MODE) {
        $errorResponse['debug'] = [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ];
    }
    
    $logger->error('API Bridge Error', [
        'action' => $action ?? 'unknown',
        'line_user_id' => $_SESSION['line_user_id'] ?? 'unknown',
        'error' => $e->getMessage()
    ]);
    
    echo json_encode($errorResponse);
}

/**
 * ユーザー全情報取得
 */
function handleGetUserFullInfo(GasApiClient $gasApi, string $lineUserId): array
{
    $result = $gasApi->getUserFullInfo($lineUserId);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 404);
    }
    
    return mapGasUserDataToJs($result['data']);
}

/**
 * 空き時間取得
 */
function handleGetAvailability(GasApiClient $gasApi, array $params): array
{
    $treatmentId = $params['treatment_id'] ?? '';
    $date = $params['date'] ?? '';
    $pairRoom = ($params['pair_room'] ?? 'false') === 'true';
    $timeSpacing = (int)($params['time_spacing'] ?? 5);
    
    if (empty($treatmentId) || empty($date)) {
        throw new Exception('treatment_idとdateが必要です', 400);
    }
    
    $result = $gasApi->getAvailability($treatmentId, $date, $pairRoom, $timeSpacing);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * 予約作成
 */
function handleCreateReservation(GasApiClient $gasApi, string $lineUserId, array $reservationData): array
{
    // ユーザー情報を追加
    $reservationData['line_user_id'] = $lineUserId;
    
    $result = $gasApi->createReservation($reservationData);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * 予約キャンセル
 */
function handleCancelReservation(GasApiClient $gasApi, string $reservationId): array
{
    if (empty($reservationId)) {
        throw new Exception('reservation_idが必要です', 400);
    }
    
    $result = $gasApi->cancelReservation($reservationId);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * 接続テスト
 */
function handleTestConnection(GasApiClient $gasApi): array
{
    return $gasApi->testConnection();
}

/**
 * 来院者登録
 */
function handleCreateVisitor(GasApiClient $gasApi, string $lineUserId, array $visitorData): array
{
    // 必須フィールドの検証
    $required = ['name', 'kana', 'gender'];
    foreach ($required as $field) {
        if (empty($visitorData[$field])) {
            throw new Exception("必須フィールド '{$field}' が不足しています", 400);
        }
    }
    
    // 性別の検証
    if (!in_array($visitorData['gender'], ['MALE', 'FEMALE'])) {
        throw new Exception("性別は 'MALE' または 'FEMALE' を指定してください", 400);
    }
    
    // ユーザー情報を取得して会社情報を設定
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    if ($userInfo['status'] !== 'success') {
        throw new Exception('ユーザー情報の取得に失敗しました', 500);
    }
    
    $companyInfo = $userInfo['data']['membership_info'] ?? null;
    if (!$companyInfo || empty($companyInfo['company_id'])) {
        throw new Exception('会社情報が見つかりません', 400);
    }
    
    // 来院者データを準備
    $visitorData['company_id'] = $companyInfo['company_id'];
    $visitorData['company_name'] = $companyInfo['company_name'];
    
    // 誕生日の形式チェック（提供されている場合）
    if (!empty($visitorData['birthday'])) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitorData['birthday'])) {
            throw new Exception('誕生日はYYYY-MM-DD形式で入力してください', 400);
        }
    }
    
    $result = $gasApi->createVisitor($visitorData);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * 会社の来院者一覧取得
 */
function handleGetCompanyVisitors(GasApiClient $gasApi, string $lineUserId, array $params): array
{
    // ユーザー情報を取得して会社情報と権限を確認
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    if ($userInfo['status'] !== 'success') {
        throw new Exception('ユーザー情報の取得に失敗しました', 500);
    }
    
    $companyInfo = $userInfo['data']['membership_info'] ?? null;
    if (!$companyInfo || empty($companyInfo['company_id'])) {
        throw new Exception('会社情報が見つかりません', 400);
    }
    
    $userRole = $companyInfo['member_type'] === '本会員' ? 'main' : 'sub';
    
    $result = $gasApi->getPatientsByCompany($companyInfo['company_id'], $userRole);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * 来院者の公開設定変更（新しいGAS API仕様対応）
 */
function handleUpdateVisitorPublicStatus(GasApiClient $gasApi, string $lineUserId, array $requestData): array
{
    // 必須フィールドの検証
    if (!isset($requestData['visitor_id']) || !isset($requestData['is_public'])) {
        throw new Exception('visitor_idとis_publicが必要です', 400);
    }
    
    // ユーザー情報を取得して権限を確認
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    if ($userInfo['status'] !== 'success') {
        throw new Exception('ユーザー情報の取得に失敗しました', 500);
    }
    
    $companyInfo = $userInfo['data']['membership_info'] ?? null;
    if (!$companyInfo) {
        throw new Exception('会社情報が見つかりません', 400);
    }
    
    // 本会員のみ公開設定を変更可能
    if ($companyInfo['member_type'] !== '本会員') {
        throw new Exception('公開設定の変更は本会員のみ可能です', 403);
    }
    
    // 会社IDを取得
    $companyId = $companyInfo['company_id'];
    if (!$companyId) {
        throw new Exception('会社IDが見つかりません', 400);
    }
    
    $visitorId = $requestData['visitor_id'];
    $isPublic = (bool)$requestData['is_public'];
    
    // 新しいAPI仕様に合わせて会社IDとビジターIDを両方渡す
    $result = $gasApi->updateVisitorPublicStatus($companyId, $visitorId, $isPublic);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * GAS APIのユーザーデータをJavaScript用にマッピング
 */
function mapGasUserDataToJs(array $gasData): array
{
    return [
        // 基本ユーザー情報
        'user' => [
            'id' => $gasData['user']['id'] ?? '',
            'name' => $gasData['user']['name'] ?? '',
            'email' => $gasData['user']['email'] ?? '',
            'phone' => $gasData['user']['phone'] ?? '',
            'lineDisplayName' => $gasData['user']['line_display_name'] ?? '',
            'linePictureUrl' => $gasData['user']['line_picture_url'] ?? '',
        ],
        
        // 患者情報
        'patientInfo' => [
            'id' => $gasData['patient_info']['id'] ?? '',
            'kana' => $gasData['patient_info']['kana'] ?? '',
            'birthDate' => $gasData['patient_info']['birth_date'] ?? '',
            'age' => $gasData['patient_info']['age'] ?? 0,
            'gender' => $gasData['patient_info']['gender'] ?? '',
            'isNew' => $gasData['patient_info']['is_new'] ?? true,
            'lastVisitDate' => $gasData['patient_info']['last_visit_date'] ?? null,
            'chartNumber' => $gasData['patient_info']['chart_number'] ?? '',
        ],
        
        // 施術履歴
        'treatmentHistory' => array_map(function($treatment) {
            return [
                'id' => $treatment['id'] ?? '',
                'treatmentId' => $treatment['treatment_id'] ?? '',
                'treatmentName' => $treatment['treatment_name'] ?? '',
                'treatmentDate' => $treatment['treatment_date'] ?? '',
                'minIntervalDays' => $treatment['min_interval_days'] ?? 0,
                'nextAvailableDate' => $treatment['next_available_date'] ?? '',
            ];
        }, $gasData['treatment_history'] ?? []),
        
        // 今後の予約
        'upcomingReservations' => array_map(function($reservation) {
            return [
                'id' => $reservation['id'] ?? '',
                'treatmentId' => $reservation['treatment_id'] ?? '',
                'treatmentName' => $reservation['treatment_name'] ?? '',
                'reservationDate' => $reservation['reservation_date'] ?? '',
                'reservationTime' => $reservation['reservation_time'] ?? '',
                'duration' => $reservation['duration'] ?? '',
                'price' => $reservation['price'] ?? '',
                'room' => $reservation['room'] ?? '',
                'status' => $reservation['status'] ?? '',
            ];
        }, $gasData['upcoming_reservations'] ?? []),
        
        // 予約可能施術
        'availableTreatments' => array_map(function($treatment) {
            return [
                'treatmentId' => $treatment['treatment_id'] ?? '',
                'treatmentName' => $treatment['treatment_name'] ?? '',
                'canBook' => $treatment['can_book'] ?? false,
                'nextAvailableDate' => $treatment['next_available_date'] ?? '',
                'price' => $treatment['price'] ?? '',
                'duration' => $treatment['duration'] ?? '',
                'reason' => $treatment['reason'] ?? null,
            ];
        }, $gasData['available_treatments'] ?? []),
        
        // 会員情報
        'membershipInfo' => [
            'isMember' => $gasData['membership_info']['is_member'] ?? false,
            'memberType' => $gasData['membership_info']['member_type'] ?? '',
            'companyId' => $gasData['membership_info']['company_id'] ?? '',
            'companyName' => $gasData['membership_info']['company_name'] ?? '',
            'ticketBalance' => $gasData['membership_info']['ticket_balance'] ?? [],
        ],
        
        // 統計情報
        'statistics' => [
            'totalVisits' => $gasData['statistics']['total_visits'] ?? 0,
            'totalTreatments' => $gasData['statistics']['total_treatments'] ?? [],
            'last30DaysVisits' => $gasData['statistics']['last_30_days_visits'] ?? 0,
            'favoriteTreatment' => $gasData['statistics']['favorite_treatment'] ?? '',
        ],
    ];
}

/**
 * 患者別メニュー取得
 */
function handleGetPatientMenus(GasApiClient $gasApi, array $params): array
{
    $visitorId = $params['visitor_id'] ?? '';
    $companyId = $params['company_id'] ?? '';
    
    if (empty($visitorId)) {
        throw new Exception('visitor_idが必要です', 400);
    }
    
    $result = $gasApi->getPatientMenus($visitorId, $companyId);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * MedicalForce形式の予約作成
 */
function handleCreateMedicalForceReservation(GasApiClient $gasApi, array $reservationData): array
{
    // 必須フィールドの検証
    if (empty($reservationData['visitor_id']) || empty($reservationData['start_at']) || empty($reservationData['menus'])) {
        throw new Exception('必須フィールドが不足しています', 400);
    }
    
    $result = $gasApi->createMedicalForceReservation($reservationData);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return $result['data'];
}

/**
 * JSON入力を取得
 */
function getJsonInput(): array
{
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('無効なJSONです', 400);
    }
    
    return $data ?? [];
}