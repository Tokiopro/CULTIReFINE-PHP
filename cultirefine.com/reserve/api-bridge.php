<?php
/**
 * JavaScript用API Bridge
 * フロントエンドからのAPI呼び出しを受けてGAS APIに中継
 */

session_start();

// 常にJSONレスポンスを保証するため、エラーハンドラーを設定
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// 致命的エラーもJSONで返すように設定
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && ($error['type'] & (E_ERROR | E_PARSE | E_CORE_ERROR | E_COMPILE_ERROR))) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => [
                'code' => 500,
                'message' => 'サーバーエラーが発生しました'
            ]
        ]);
    }
});

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
require_once 'line-auth/MedicalForceApiClient.php';
require_once 'line-auth/MedicalForceSyncService.php';
require_once 'line-auth/LineMessagingService.php';
require_once 'line-auth/FlexMessageTemplates.php';
require_once 'line-auth/NotificationSettingsManager.php';
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
            
        case 'createReservations':
            $result = handleCreateReservations(getJsonInput());
            break;
            
        case 'getReservationHistory':
            $result = handleGetReservationHistory($gasApi, $lineUserId, $_GET);
            break;
            
        case 'getAvailableSlots':
            $result = handleGetAvailableSlots($gasApi, getJsonInput());
            break;
            
        case 'testMedicalForceConnection':
            $result = handleTestMedicalForceConnection();
            break;
            
        case 'debugGasApi':
            $result = handleDebugGasApi($gasApi, $lineUserId);
            break;
            
        case 'debugSession':
            $result = handleDebugSession();
            break;
            
        case 'syncMedicalForceReservations':
            $result = handleSyncMedicalForceReservations(getJsonInput());
            break;
            
        case 'checkMedicalForceSyncStatus':
            $result = handleCheckMedicalForceSyncStatus();
            break;
            
        case 'sendLineNotification':
            $result = handleSendLineNotification($gasApi, getJsonInput());
            break;
            
        case 'sendBroadcastNotification':
            $result = handleSendBroadcastNotification($gasApi, getJsonInput());
            break;
            
        case 'getNotificationSettings':
            $result = handleGetNotificationSettings($gasApi, $_GET);
            break;
            
        case 'updateNotificationSettings':
            $result = handleUpdateNotificationSettings($gasApi, getJsonInput());
            break;
            
        case 'getNotificationTemplates':
            $result = handleGetNotificationTemplates($gasApi);
            break;
            
        case 'testLineConnection':
            $result = handleTestLineConnection($gasApi);
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
    $patientId = $params['patient_id'] ?? '';
    $treatmentId = $params['treatment_id'] ?? '';
    $date = $params['date'] ?? '';
    $pairRoom = ($params['pair_room'] ?? 'false') === 'true';
    $timeSpacing = (int)($params['time_spacing'] ?? 5);
    
    if (empty($patientId) || empty($treatmentId) || empty($date)) {
        throw new Exception('patient_id、treatment_idとdateが必要です', 400);
    }
    
    $result = $gasApi->getAvailability($patientId, $treatmentId, $date, $pairRoom, $timeSpacing);
    
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
 * 2段階で処理：(1) Medical Force APIで来院者作成 → (2) GAS APIで登録
 */
function handleCreateVisitor(GasApiClient $gasApi, string $lineUserId, array $visitorData): array
{
    try {
        // Step 1: フロントエンドからの基本データを検証
        $required = ['last_name', 'first_name', 'gender'];
        foreach ($required as $field) {
            if (empty($visitorData[$field])) {
                throw new Exception("必須フィールド '{$field}' が不足しています", 400);
            }
        }
        
        // 姓名カナの検証（オプション）
        if (!empty($visitorData['last_name_kana']) && empty($visitorData['first_name_kana'])) {
            throw new Exception("姓のカナが入力されている場合、名のカナも入力してください", 400);
        }
        if (!empty($visitorData['first_name_kana']) && empty($visitorData['last_name_kana'])) {
            throw new Exception("名のカナが入力されている場合、姓のカナも入力してください", 400);
        }
        
        // Step 2: Medical Force APIで来院者を作成（OAuth 2.0対応）
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL, 
            MEDICAL_FORCE_API_KEY,
            MEDICAL_FORCE_CLIENT_ID,
            MEDICAL_FORCE_CLIENT_SECRET,
            getenv('CLINIC_ID') ?: ''
        );
        
        // Medical Force API用のデータを構築（互換性のため）
        $medicalForceData = [
            'name' => $visitorData['last_name'] . ' ' . $visitorData['first_name'],
            'kana' => !empty($visitorData['last_name_kana']) && !empty($visitorData['first_name_kana']) 
                ? $visitorData['last_name_kana'] . ' ' . $visitorData['first_name_kana'] 
                : '',
            'gender' => $visitorData['gender']
        ];
        
        // オプションフィールドを追加
        if (!empty($visitorData['birthday'])) {
            $medicalForceData['birthday'] = $visitorData['birthday'];
        }
        if (!empty($visitorData['email'])) {
            $medicalForceData['email'] = $visitorData['email'];
        }
        if (!empty($visitorData['phone'])) {
            $medicalForceData['phone'] = $visitorData['phone'];
        }
        
        $medicalForceResult = $medicalForceApi->createVisitor($medicalForceData);
        
        if (!$medicalForceResult['success']) {
            throw new Exception(
                "Medical Force API エラー: " . $medicalForceResult['message'],
                400
            );
        }
        
        $visitorId = $medicalForceResult['visitor_id'];
        
        // Step 3: Medical Forceから取得したIDを使ってGAS APIに登録
        // 個別入力された姓名を取得
        $lastName = trim($visitorData['last_name']);
        $firstName = trim($visitorData['first_name']);
        $lastNameKana = trim($visitorData['last_name_kana'] ?? '');
        $firstNameKana = trim($visitorData['first_name_kana'] ?? '');
        
        // 性別の変換（フロントエンドの形式からAPI形式へ）
        $genderMap = [
            'MALE' => 'male',
            'FEMALE' => 'female',
            'male' => 'male',
            'female' => 'female'
        ];
        $gender = $genderMap[strtoupper($visitorData['gender'] ?? '')] ?? 'other';
        
        // ユーザー情報を取得して会社情報を設定
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
        
        // GAS APIの標準形式レスポンスをチェック
        if ($userInfo['status'] !== 'success') {
            if (DEBUG_MODE) {
                error_log('[handleCreateVisitor] GAS API failed: ' . json_encode($userInfo));
            }
            throw new Exception('ユーザー情報の取得に失敗しました（GAS API）', 500);
        }
        
        $membershipInfo = $userInfo['data']['membership_info'] ?? null;
        
        if (DEBUG_MODE) {
            error_log('[handleCreateVisitor] Membership info: ' . json_encode($membershipInfo));
        }
        
        // GAS API用のデータを準備
        $gasApiData = [
            'path' => 'api/visitors',
            'api_key' => GAS_API_KEY,
            'visitor_id' => $visitorId, // Medical Forceから受け取ったID
            'last_name' => $lastName,
            'first_name' => $firstName,
            'last_name_kana' => $lastNameKana,
            'first_name_kana' => $firstNameKana,
            'gender' => $gender,
            'publicity_status' => 'private', // デフォルトは非公開
            'notes' => 'Medical Force経由で登録'
        ];
        
        // オプションフィールドの追加
        if (!empty($visitorData['email'])) {
            $gasApiData['email'] = $visitorData['email'];
        }
        if (!empty($visitorData['phone'])) {
            $gasApiData['phone'] = $visitorData['phone'];
        }
        if (!empty($visitorData['birthday'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitorData['birthday'])) {
                throw new Exception('誕生日はYYYY-MM-DD形式で入力してください', 400);
            }
            $gasApiData['birth_date'] = $visitorData['birthday'];
        }
        
        // 会社情報がある場合は追加
        if ($membershipInfo && !empty($membershipInfo['company_id'])) {
            $gasApiData['company_id'] = $membershipInfo['company_id'];
            $gasApiData['member_type'] = $membershipInfo['member_type'] ?? 'sub'; // デフォルトはサブ会員
        }
        
        // Step 4: GAS APIに登録
        $result = $gasApi->createVisitorToSheet($gasApiData);
        
        // レスポンス形式の統一処理
        $hasError = false;
        $errorMessage = '';
        
        if (isset($result['status']) && $result['status'] === 'error') {
            $hasError = true;
            $errorMessage = $result['error']['message'] ?? 'GAS APIエラー';
        } elseif (isset($result['success']) && !$result['success']) {
            $hasError = true;
            $errorMessage = $result['message'] ?? $result['error'] ?? 'GAS APIエラー';
        } elseif (!isset($result['status']) && !isset($result['success'])) {
            // レスポンス形式が不明な場合はエラーとして扱う
            $hasError = true;
            $errorMessage = 'GAS API レスポンス形式エラー';
            error_log('GAS API Response Format Error: ' . json_encode($result));
        }
        
        if ($hasError) {
            // GAS API登録に失敗した場合、Medical Forceでの作成は成功しているため
            // ロールバックが必要な場合は考慮する（現時点では警告ログのみ）
            error_log("警告: Medical Force作成成功、GAS API登録失敗: visitor_id={$visitorId}");
            
            // エラーメッセージをより分かりやすく
            if (strpos($errorMessage, 'DUPLICATE_EMAIL') !== false) {
                throw new Exception('このメールアドレスは既に登録されています（GAS API）', 400);
            } else if (strpos($errorMessage, 'INVALID_COMPANY') !== false) {
                throw new Exception('指定された会社が見つかりません（GAS API）', 400);
            } else {
                throw new Exception("GAS API登録エラー: {$errorMessage}", 500);
            }
        }
        
        // JavaScriptが期待する形式でレスポンスを返す
        return [
            'success' => true,
            'message' => '来院者が正常に登録されました（Medical Force & GAS API）',
            'data' => [
                'visitor_id' => $visitorId,
                'last_name' => $lastName,
                'first_name' => $firstName,
                'name' => $lastName . ' ' . $firstName, // 互換性のため
                'kana' => !empty($lastNameKana) && !empty($firstNameKana) 
                    ? $lastNameKana . ' ' . $firstNameKana 
                    : '',
                'gender' => $visitorData['gender'],
                'company_id' => $gasApiData['company_id'] ?? null,
                'is_new' => true
            ]
        ];
        
    } catch (Exception $e) {
        // エラーハンドリングの強化
        error_log("来院者登録エラー: " . $e->getMessage());
        error_log("スタックトレース: " . $e->getTraceAsString());
        
        // エラーメッセージにソースを明記
        $message = $e->getMessage();
        if (strpos($message, 'GAS API') === false && strpos($message, 'Medical Force') === false) {
            $message = "PHP処理エラー: " . $message;
        }
        
        throw new Exception($message, $e->getCode() ?: 500);
    }
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
    
    $userRole = $companyInfo['member_type'] === 'main' ? 'main' : 'sub';
    
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
    if ($companyInfo['member_type'] !== 'main') {
        throw new Exception('公開設定の変更は本会員のみ可能です', 403);
    }
    
    // 会社IDを取得
    $companyId = $companyInfo['company_id'];
    if (!$companyId) {
        throw new Exception('会社IDが見つかりません', 400);
    }
    
    $visitorId = $requestData['visitor_id'];
    $isPublic = (bool)$requestData['is_public'];
    
    // 新しいGAS API仕様に合わせて呼び出し
    $result = $gasApi->updateVisitorVisibility($companyId, $visitorId, $isPublic);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return [
        'success' => true,
        'message' => $isPublic ? '来院者を公開に設定しました' : '来院者を非公開に設定しました',
        'data' => $result['data'] ?? []
    ];
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
		//チケット情報
		'ticketInfo' => array_map(function($ticket) {
        return [
            'treatment_id' => $ticket['treatment_id'] ?? '',
            'treatment_name' => $ticket['treatment_name'] ?? '',
            'remaining_count' => $ticket['remaining_count'] ?? 0,
            'used_count' => $ticket['used_count'] ?? 0,
            'available_count' => max(0, ($ticket['remaining_count'] ?? 0) - ($ticket['used_count'] ?? 0)),
            'last_used_date' => $ticket['last_used_date'] ?? 0
        ];
    }, $gasData['ticketInfo'] ?? []),
		//書類情報
    'docsinfo' => array_map(function($doc) {
        return [
            'docs_id' => $doc['docs_id'] ?? '',
            'docs_name' => $doc['docs_name'] ?? '',
            'docs_url' => $doc['docs_url'] ?? '',
            'created_at' => $doc['created_at'] ?? '',
            'treatment_name' => $doc['treatment_name'] ?? '',
            'notes' => $doc['notes'] ?? ''
        ];
    }, $gasData['docsinfo'] ?? []),
		//予約履歴情報
    'ReservationHistory' => array_map(function($history) {
        return [
            'history_id' => $history['history_id'] ?? '',
            'reservename' => $history['reservename'] ?? '',
            'reservedate' => $history['reservedate'] ?? '',
            'reservetime' => $history['reservetime'] ?? '',
            'reservestatus' => $history['reservestatus'] ?? '',
            'reservepatient' => $history['reservepatient'] ?? '',
            'patient_id' => $history['patient_id'] ?? '',
            'patient_name' => $history['patient_name'] ?? '',
            'visitor_id' => $history['visitor_id'] ?? '',
            'end_time' => $history['end_time'] ?? '',
            'created_at' => $history['created_at'] ?? '',
            'notes' => $history['notes'] ?? '',
            'company_id' => $history['company_id'] ?? ''
        ];
    }, $gasData['ReservationHistory'] ?? []),
        'membershipInfo' => [
            'isMember' => $gasData['membership_info']['is_member'] ?? false,
            'memberType' => $gasData['membership_info']['member_type'] ?? '',
            'companyId' => $gasData['membership_info']['company_id'] ?? '',
            'companyName' => $gasData['membership_info']['company_name'] ?? '',
            'ticketBalance' => $gasData['membership_info']['ticket_balance'] ?? [],
        ],
        
    ];
}

/**
 * 患者別メニュー取得
 */
function handleGetPatientMenus(GasApiClient $gasApi, array $params): array
{
    // POSTリクエストの場合、JSONボディからパラメータを取得
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $jsonInput = getJsonInput();
        $params = $jsonInput['params'] ?? $params;
    }
    
    // 新しいAPI仕様に対応
    if (isset($params['path']) && preg_match('/api\/patients\/([^\/]+)\/menus/', $params['path'], $matches)) {
        $visitorId = $matches[1];
    } else {
        $visitorId = $params['visitor_id'] ?? '';
    }
    
    $companyId = $params['company_id'] ?? '';
    
    if (empty($visitorId)) {
        throw new Exception('visitor_idが必要です', 400);
    }
    
    $result = $gasApi->getPatientMenus($visitorId, $companyId);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    // 新しいAPI形式のレスポンスをそのまま返す
    return $result['data'];
}

/**
 * カレンダー空き情報取得
 */
function handleGetAvailableSlots(GasApiClient $gasApi, array $params): array
{
    // POSTリクエストのパラメータを取得
    $requestParams = $params['params'] ?? $params;
    
    // パスからvisitorIdを抽出
    if (isset($requestParams['path']) && preg_match('/api\/patients\/([^\/]+)\/available-slots/', $requestParams['path'], $matches)) {
        $visitorId = $matches[1];
    } else {
        $visitorId = $requestParams['visitor_id'] ?? '';
    }
    
    if (empty($visitorId)) {
        throw new Exception('visitor_idが必要です', 400);
    }
    
    if (empty($requestParams['date'])) {
        throw new Exception('dateが必要です', 400);
    }
    
    // 複数メニューか単一メニューかを判定
    $menuIds = $requestParams['menu_ids'] ?? [];
    if (empty($menuIds) && !empty($requestParams['menu_id'])) {
        $menuIds = [$requestParams['menu_id']];
    }
    
    if (empty($menuIds)) {
        throw new Exception('menu_idまたはmenu_idsが必要です', 400);
    }
    
    // 複数メニューの場合
    if (count($menuIds) > 1) {
        return handleMultipleMenuAvailability($gasApi, $visitorId, $requestParams);
    }
    
    // 単一メニューの場合はMedical Force APIを直接呼び出し
    return handleSingleMenuAvailability($menuIds[0], $requestParams);
}

/**
 * 単一メニューの空き情報取得（Medical Force API直接呼び出し）
 */
function handleSingleMenuAvailability(string $menuId, array $params): array
{
    try {
        // Medical Force APIクライアントを初期化
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            MEDICAL_FORCE_API_KEY ?? '',
            MEDICAL_FORCE_CLIENT_ID ?? '',
            MEDICAL_FORCE_CLIENT_SECRET ?? '',
            getenv('CLINIC_ID') ?: ''
        );
        
        // 日付範囲を計算
        $startDate = $params['date'];
        $dateRange = $params['date_range'] ?? 7;
        $endDate = date('Y-m-d', strtotime($startDate . ' +' . ($dateRange - 1) . ' days'));
        
        // Medical Force API用のリクエストボディを構築
        $requestBody = [
            'epoch_from_keydate' => $startDate,
            'epoch_to_keydate' => $endDate,
            'time_spacing' => '5', // 5分間隔
            'menus' => [[
                'menu_id' => $menuId
                // staff_ids は空配列（オプション）
            ]]
        ];
        
        // Medical Force APIを呼び出し
        $vacancies = $medicalForceApi->getVacancies($requestBody);
        
        // レスポンス形式を統一
        return [
            'available_slots' => $vacancies,
            'source' => 'medical_force',
            'menu_count' => 1,
            'menu_ids' => [$menuId]
        ];
        
    } catch (Exception $e) {
        error_log('[Single Menu Availability Error] ' . $e->getMessage());
        throw new Exception('空き情報の取得に失敗しました: ' . $e->getMessage(), 500);
    }
}

/**
 * 複数メニューの空き情報取得（予約履歴から計算）
 */
function handleMultipleMenuAvailability(GasApiClient $gasApi, string $visitorId, array $params): array
{
    try {
        // 日付範囲を計算
        $startDate = $params['date'];
        $dateRange = $params['date_range'] ?? 7;
        $totalDuration = $params['total_duration'] ?? 0;
        $menuIds = $params['menu_ids'];
        
        if ($totalDuration <= 0) {
            throw new Exception('複数メニューの場合はtotal_durationが必要です', 400);
        }
        
        // GAS APIから予約履歴を取得
        $endDate = date('Y-m-d', strtotime($startDate . ' +' . ($dateRange - 1) . ' days'));
        $reservationResult = $gasApi->getReservationsByDateRange($startDate, $endDate);
        
        if ($reservationResult['status'] === 'error') {
            throw new Exception($reservationResult['error']['message'], 500);
        }
        
        $reservations = $reservationResult['data'] ?? [];
        
        // 5分毎のタイムスロットを生成して空き判定
        $availableSlots = calculateMultipleMenuAvailableSlots(
            $startDate,
            $dateRange,
            $totalDuration,
            $reservations
        );
        
        return [
            'available_slots' => $availableSlots,
            'source' => 'calculated',
            'menu_count' => count($menuIds),
            'menu_ids' => $menuIds,
            'total_duration' => $totalDuration
        ];
        
    } catch (Exception $e) {
        error_log('[Multiple Menu Availability Error] ' . $e->getMessage());
        throw new Exception('複数メニューの空き情報取得に失敗しました: ' . $e->getMessage(), 500);
    }
}

/**
 * 複数メニュー用の空き時間計算
 */
function calculateMultipleMenuAvailableSlots(string $startDate, int $dateRange, int $totalDuration, array $reservations): array
{
    $availableSlots = [];
    
    // 営業時間設定（環境変数から取得、デフォルト値設定）
    $openTime = getenv('CLINIC_OPEN_TIME') ?: '09:00';
    $closeTime = getenv('CLINIC_CLOSE_TIME') ?: '18:00';
    
    for ($i = 0; $i < $dateRange; $i++) {
        $currentDate = date('Y-m-d', strtotime($startDate . ' +' . $i . ' days'));
        
        // 土日をスキップ（オプション）
        $dayOfWeek = date('w', strtotime($currentDate));
        if ($dayOfWeek == 0 || $dayOfWeek == 6) { // 日曜日または土曜日
            continue;
        }
        
        $availableSlots[$currentDate] = [];
        
        // 5分刻みのタイムスロットを生成
        $startTime = strtotime($currentDate . ' ' . $openTime);
        $endTime = strtotime($currentDate . ' ' . $closeTime);
        $slotDuration = 5 * 60; // 5分間
        
        for ($time = $startTime; $time < $endTime; $time += $slotDuration) {
            $timeSlot = date('H:i', $time);
            
            // この時間から合計施術時間分の連続した空きがあるかチェック
            if (isTimeSlotAvailable($currentDate, $timeSlot, $totalDuration, $reservations)) {
                $availableSlots[$currentDate][$timeSlot] = 'ok';
            } else {
                $availableSlots[$currentDate][$timeSlot] = 'ng';
            }
        }
    }
    
    return $availableSlots;
}

/**
 * 指定時間から必要時間分の空きがあるかチェック
 */
function isTimeSlotAvailable(string $date, string $startTime, int $durationMinutes, array $reservations): bool
{
    $startDateTime = strtotime($date . ' ' . $startTime);
    $endDateTime = $startDateTime + ($durationMinutes * 60);
    
    // 該当日の予約をフィルタ
    $dayReservations = array_filter($reservations, function($reservation) use ($date) {
        return isset($reservation['reservation_date']) && $reservation['reservation_date'] === $date;
    });
    
    // 各予約と時間的な重複がないかチェック
    foreach ($dayReservations as $reservation) {
        $reservationStart = strtotime($date . ' ' . $reservation['reservation_time']);
        $reservationDuration = ($reservation['duration_minutes'] ?? 60) * 60;
        $reservationEnd = $reservationStart + $reservationDuration;
        
        // 重複チェック
        if (($startDateTime < $reservationEnd) && ($endDateTime > $reservationStart)) {
            return false; // 重複あり
        }
    }
    
    return true; // 空きあり
}

/**
 * 予約作成（単一・複数対応）
 */
function handleCreateReservations(array $params): array
{
    try {
        // Medical Force APIクライアントを初期化
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            MEDICAL_FORCE_API_KEY ?? '',
            MEDICAL_FORCE_CLIENT_ID ?? '',
            MEDICAL_FORCE_CLIENT_SECRET ?? '',
            getenv('CLINIC_ID') ?: ''
        );
        
        // 単一予約か複数予約かを判定
        if (isset($params['reservations']) && is_array($params['reservations'])) {
            // 複数予約の場合
            return handleMultipleReservations($medicalForceApi, $params['reservations']);
        } else {
            // 単一予約の場合
            return handleSingleReservation($medicalForceApi, $params);
        }
        
    } catch (Exception $e) {
        error_log('[Reservation Handler Error] ' . $e->getMessage());
        return [
            'success' => false,
            'message' => $e->getMessage(),
            'code' => $e->getCode()
        ];
    }
}

/**
 * 単一予約処理
 */
function handleSingleReservation(MedicalForceApiClient $medicalForceApi, array $reservationData): array
{
    try {
        $result = $medicalForceApi->createReservation($reservationData);
        
        if ($result['success']) {
            return [
                'success' => true,
                'reservation_id' => $result['reservation_id'],
                'message' => '予約が正常に作成されました',
                'total_attempted' => 1,
                'successful' => 1,
                'failed' => 0,
                'results' => [$result],
                'errors' => []
            ];
        } else {
            return [
                'success' => false,
                'message' => $result['message'],
                'total_attempted' => 1,
                'successful' => 0,
                'failed' => 1,
                'results' => [],
                'errors' => [[
                    'visitor_id' => $reservationData['visitor_id'] ?? 'unknown',
                    'start_at' => $reservationData['start_at'] ?? 'unknown',
                    'error' => $result['message']
                ]]
            ];
        }
        
    } catch (Exception $e) {
        error_log('[Single Reservation Error] ' . $e->getMessage());
        return [
            'success' => false,
            'message' => $e->getMessage(),
            'total_attempted' => 1,
            'successful' => 0,
            'failed' => 1,
            'results' => [],
            'errors' => [[
                'visitor_id' => $reservationData['visitor_id'] ?? 'unknown',
                'start_at' => $reservationData['start_at'] ?? 'unknown',
                'error' => $e->getMessage()
            ]]
        ];
    }
}

/**
 * 複数予約処理（エラー時も継続）
 */
function handleMultipleReservations(MedicalForceApiClient $medicalForceApi, array $reservations): array
{
    $results = [];
    $errors = [];
    $successful = 0;
    $failed = 0;
    
    foreach ($reservations as $index => $reservation) {
        try {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log("[Multiple Reservations] Processing reservation " . ($index + 1) . "/" . count($reservations));
            }
            
            $result = $medicalForceApi->createReservation($reservation);
            
            if ($result['success']) {
                $results[] = $result;
                $successful++;
                
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log("[Multiple Reservations] Success: reservation_id = " . $result['reservation_id']);
                }
            } else {
                $errors[] = [
                    'visitor_id' => $reservation['visitor_id'] ?? 'unknown',
                    'start_at' => $reservation['start_at'] ?? 'unknown',
                    'error' => $result['message'],
                    'category' => $result['category'] ?? 'other',
                    'user_message' => $result['user_message'] ?? $result['message'],
                    'code' => $result['code'] ?? 500
                ];
                $failed++;
                
                error_log("[Multiple Reservations] Failed: " . $result['message'] . 
                         " (Category: " . ($result['category'] ?? 'other') . ")");
            }
            
        } catch (Exception $e) {
            $errors[] = [
                'visitor_id' => $reservation['visitor_id'] ?? 'unknown',
                'start_at' => $reservation['start_at'] ?? 'unknown',
                'error' => $e->getMessage(),
                'category' => 'exception',
                'user_message' => 'システムエラーが発生しました。管理者にお問い合わせください。',
                'code' => $e->getCode()
            ];
            $failed++;
            
            error_log("[Multiple Reservations] Exception: " . $e->getMessage());
            
            // エラーが発生しても継続処理
            continue;
        }
        
        // APIレート制限対策（オプション）
        if (count($reservations) > 1) {
            usleep(500000); // 0.5秒待機
        }
    }
    
    return [
        'success' => $failed === 0,
        'message' => $failed === 0 
            ? "全ての予約が正常に作成されました" 
            : "一部の予約でエラーが発生しました",
        'total_attempted' => count($reservations),
        'successful' => $successful,
        'failed' => $failed,
        'results' => $results,
        'errors' => $errors
    ];
}

/**
 * MedicalForce形式の予約作成（後方互換性）
 */
function handleCreateMedicalForceReservation(GasApiClient $gasApi, array $reservationData): array
{
    // 新しいhandleCreateReservationsに転送
    return handleCreateReservations($reservationData);
}

/**
 * 予約履歴を取得
 */
/*
function handleGetReservationHistory(GasApiClient $gasApi, string $lineUserId, array $params): array
{
    // 日付パラメータの確認（必須ではないが、指定された場合はフォーマットチェック）
    $date = $params['date'] ?? date('Y-m-d');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new Exception('日付はYYYY-MM-DD形式で指定してください', 400);
    }
    
    // ユーザー情報を取得して会社情報を確認
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    if ($userInfo['status'] !== 'success') {
        throw new Exception('ユーザー情報の取得に失敗しました', 500);
    }
    
    $companyInfo = $userInfo['data']['membership_info'] ?? null;
    if (!$companyInfo || empty($companyInfo['company_id'])) {
        throw new Exception('会社情報が見つかりません', 400);
    }
    
    // 会員種別を取得（本会員/サブ会員）
    $memberType = $companyInfo['member_type'] ?? 'sub';
    $companyId = $companyInfo['company_id'];
    
    // 予約履歴を取得
    $result = $gasApi->getReservationHistory($memberType, $date, $companyId);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    return [
        'success' => true,
        'data' => $result['data'] ?? []
    ];
}
*/
/**
 * Medical Force API接続テスト
 */
function handleTestMedicalForceConnection(): array
{
    try {
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL, 
            MEDICAL_FORCE_API_KEY,
            MEDICAL_FORCE_CLIENT_ID,
            MEDICAL_FORCE_CLIENT_SECRET,
            getenv('CLINIC_ID') ?: ''
        );
        $result = $medicalForceApi->testConnection();
        
        return [
            'medical_force_connection' => $result,
            'configuration' => [
                'api_url' => MEDICAL_FORCE_API_URL,
                'mock_mode' => defined('MOCK_MEDICAL_FORCE') && MOCK_MEDICAL_FORCE,
                'debug_mode' => DEBUG_MODE
            ]
        ];
        
    } catch (Exception $e) {
        return [
            'medical_force_connection' => [
                'success' => false,
                'message' => 'テスト実行エラー: ' . $e->getMessage()
            ],
            'configuration' => [
                'api_url' => MEDICAL_FORCE_API_URL,
                'mock_mode' => defined('MOCK_MEDICAL_FORCE') && MOCK_MEDICAL_FORCE,
                'debug_mode' => DEBUG_MODE
            ]
        ];
    }
}

/**
 * GAS API デバッグテスト
 */
function handleDebugGasApi(GasApiClient $gasApi, string $lineUserId): array
{
    try {
        $debugInfo = [
            'timestamp' => date('Y-m-d H:i:s'),
            'line_user_id' => $lineUserId,
            'session_data' => $_SESSION,
            'gas_config' => [
                'deployment_id' => GAS_DEPLOYMENT_ID ? 'configured' : 'not_configured',
                'api_key' => GAS_API_KEY ? 'configured' : 'not_configured',
                'deployment_id_value' => GAS_DEPLOYMENT_ID,
                'api_key_length' => GAS_API_KEY ? strlen(GAS_API_KEY) : 0
            ]
        ];
        
        // GAS API テスト実行
        error_log('[DEBUG API] Starting GAS API test for user: ' . $lineUserId);
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
        
        $debugInfo['gas_api_test'] = [
            'status' => $userInfo['status'] ?? 'no_status',
            'has_data' => isset($userInfo['data']),
            'data_keys' => isset($userInfo['data']) ? array_keys($userInfo['data']) : [],
            'error' => $userInfo['error'] ?? null,
            'response_size' => strlen(json_encode($userInfo))
        ];
        
        if (isset($userInfo['data']['membership_info'])) {
            $debugInfo['membership_info'] = $userInfo['data']['membership_info'];
        }
        
        return $debugInfo;
        
    } catch (Exception $e) {
        return [
            'error' => 'Debug test failed',
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ];
    }
}

/**
 * セッション情報デバッグ
 */
function handleDebugSession(): array
{
    return [
        'timestamp' => date('Y-m-d H:i:s'),
        'session_id' => session_id(),
        'session_status' => session_status(),
        'session_data' => $_SESSION,
        'server_info' => [
            'php_version' => PHP_VERSION,
            'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown',
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
            'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ],
        'environment' => [
            'debug_mode' => DEBUG_MODE,
            'mock_mode' => MOCK_MODE,
            'mock_medical_force' => defined('MOCK_MEDICAL_FORCE') ? MOCK_MEDICAL_FORCE : false
        ]
    ];
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

/**
 * Medical Force予約同期を処理
 */
function handleSyncMedicalForceReservations(array $params): array
{
    try {
        // Medical Force API設定確認
        if (!defined('MEDICAL_FORCE_API_URL') || !defined('MEDICAL_FORCE_CLIENT_ID') || !defined('MEDICAL_FORCE_CLIENT_SECRET')) {
            throw new Exception('Medical Force API設定が不完全です', 500);
        }
        
        // Medical Force APIクライアント初期化
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            '', // APIキーは使用しない
            MEDICAL_FORCE_CLIENT_ID,
            MEDICAL_FORCE_CLIENT_SECRET,
            getenv('CLINIC_ID') ?: ''
        );
        
        // 同期サービス初期化
        $syncService = new MedicalForceSyncService($medicalForceApi);
        
        // パラメータのバリデーション
        $dateFrom = $params['date_from'] ?? date('Y-m-d');
        $dateTo = $params['date_to'] ?? date('Y-m-d', strtotime('+14 days'));
        $offset = intval($params['offset'] ?? 0);
        $limit = intval($params['limit'] ?? 500);
        
        // 同期実行
        $result = $syncService->syncReservations([
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'offset' => $offset,
            'limit' => $limit
        ]);
        
        if (!$result['success']) {
            throw new Exception($result['error']['message'] ?? '同期処理に失敗しました', 500);
        }
        
        return $result['data'];
        
    } catch (Exception $e) {
        error_log('[Medical Force Sync Error] ' . $e->getMessage());
        error_log('[Medical Force Sync Error] Stack trace: ' . $e->getTraceAsString());
        
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ]
        ];
    }
}

/**
 * Medical Force同期ステータスを確認
 */
function handleCheckMedicalForceSyncStatus(): array
{
    try {
        // Medical Force API設定確認
        if (!defined('MEDICAL_FORCE_API_URL') || !defined('MEDICAL_FORCE_CLIENT_ID') || !defined('MEDICAL_FORCE_CLIENT_SECRET')) {
            return [
                'success' => false,
                'status' => [
                    'api_configured' => false,
                    'message' => 'Medical Force API設定が不完全です'
                ]
            ];
        }
        
        // Medical Force APIクライアント初期化
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            '', // APIキーは使用しない
            MEDICAL_FORCE_CLIENT_ID,
            MEDICAL_FORCE_CLIENT_SECRET,
            getenv('CLINIC_ID') ?: ''
        );
        
        // 同期サービス初期化
        $syncService = new MedicalForceSyncService($medicalForceApi);
        
        // ステータスチェック
        $result = $syncService->checkSyncStatus();
        
        return $result;
        
    } catch (Exception $e) {
        error_log('[Medical Force Status Check Error] ' . $e->getMessage());
        
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage()
            ]
        ];
    }
}

/**
 * LINE通知を送信
 */
function handleSendLineNotification(GasApiClient $gasApi, array $params): array
{
    try {
        // 必須パラメータのチェック
        if (empty($params['user_id']) || empty($params['notification_type'])) {
            throw new Exception('user_id と notification_type は必須です', 400);
        }
        
        // LINE Messaging Service初期化
        $lineService = createLineMessagingService($gasApi);
        
        $userId = $params['user_id'];
        $notificationType = $params['notification_type'];
        $data = $params['data'] ?? [];
        
        // 通知タイプに応じてメッセージを送信
        switch ($notificationType) {
            case 'reservation_confirmation':
                $result = $lineService->sendReservationConfirmation($userId, $data);
                break;
                
            case 'ticket_balance_update':
                $result = $lineService->sendTicketBalanceNotification($userId, $data);
                break;
                
            case 'reminder_day_before':
            case 'reminder_same_day':
                $timing = $notificationType === 'reminder_day_before' ? 'day_before' : 'same_day';
                $result = $lineService->sendReminderNotification($userId, $data, $timing);
                break;
                
            case 'post_treatment':
                $flexMessage = FlexMessageTemplates::createPostTreatment($data);
                $result = $lineService->sendMessage($userId, $flexMessage, $notificationType);
                break;
                
            case 'campaign_notification':
                // カスタムメッセージまたはFlexメッセージ
                if (isset($params['message'])) {
                    $message = $params['message'];
                } else {
                    // キャンペーン用のFlexメッセージを作成（将来の拡張用）
                    $message = [
                        'type' => 'text',
                        'text' => $data['message'] ?? 'キャンペーンのお知らせです'
                    ];
                }
                $result = $lineService->sendMessage($userId, $message, $notificationType);
                break;
                
            default:
                throw new Exception("未対応の通知タイプです: {$notificationType}", 400);
        }
        
        return $result;
        
    } catch (Exception $e) {
        error_log('[Line Notification Error] ' . $e->getMessage());
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ]
        ];
    }
}

/**
 * 一括LINE通知を送信
 */
function handleSendBroadcastNotification(GasApiClient $gasApi, array $params): array
{
    try {
        // 必須パラメータのチェック
        if (empty($params['recipients']) || empty($params['notification_type'])) {
            throw new Exception('recipients と notification_type は必須です', 400);
        }
        
        // LINE Messaging Service初期化
        $lineService = createLineMessagingService($gasApi);
        
        $recipients = $params['recipients'];
        $notificationType = $params['notification_type'];
        $data = $params['data'] ?? [];
        
        // メッセージを作成
        $message = createNotificationMessage($notificationType, $data);
        
        // 一括送信実行
        $result = $lineService->sendBroadcastMessage($recipients, $message, $notificationType);
        
        return $result;
        
    } catch (Exception $e) {
        error_log('[Broadcast Notification Error] ' . $e->getMessage());
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ]
        ];
    }
}

/**
 * 通知設定を取得
 */
function handleGetNotificationSettings(GasApiClient $gasApi, array $params): array
{
    try {
        $settingsManager = new NotificationSettingsManager($gasApi);
        $notificationType = $params['type'] ?? '';
        
        if ($notificationType === 'timing') {
            // タイミング設定を取得
            return $settingsManager->getNotificationTiming();
        } elseif ($notificationType === 'template') {
            // テンプレート設定を取得
            $templateType = $params['template_type'] ?? '';
            return $settingsManager->getNotificationTemplate($templateType);
        } else {
            // 通常の設定を取得
            return $settingsManager->getNotificationSettings($notificationType);
        }
        
    } catch (Exception $e) {
        error_log('[Get Notification Settings Error] ' . $e->getMessage());
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage()
            ]
        ];
    }
}

/**
 * 通知設定を更新
 */
function handleUpdateNotificationSettings(GasApiClient $gasApi, array $params): array
{
    try {
        // 必須パラメータのチェック
        if (empty($params['notification_type']) || !isset($params['settings'])) {
            throw new Exception('notification_type と settings は必須です', 400);
        }
        
        $settingsManager = new NotificationSettingsManager($gasApi);
        $notificationType = $params['notification_type'];
        $settings = $params['settings'];
        
        $result = $settingsManager->updateNotificationSettings($notificationType, $settings);
        
        return $result;
        
    } catch (Exception $e) {
        error_log('[Update Notification Settings Error] ' . $e->getMessage());
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage()
            ]
        ];
    }
}

/**
 * 通知テンプレート一覧を取得
 */
function handleGetNotificationTemplates(GasApiClient $gasApi): array
{
    try {
        $settingsManager = new NotificationSettingsManager($gasApi);
        $availableTypes = $settingsManager->getAvailableNotificationTypes();
        
        $templates = [];
        foreach ($availableTypes as $type => $info) {
            $template = $settingsManager->getNotificationTemplate($type);
            $templates[$type] = array_merge($info, $template);
        }
        
        return [
            'templates' => $templates,
            'total_count' => count($templates)
        ];
        
    } catch (Exception $e) {
        error_log('[Get Notification Templates Error] ' . $e->getMessage());
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage()
            ]
        ];
    }
}

/**
 * LINE接続テスト
 */
function handleTestLineConnection(GasApiClient $gasApi): array
{
    try {
        $lineService = createLineMessagingService($gasApi);
        $result = $lineService->testConnection();
        
        return $result;
        
    } catch (Exception $e) {
        error_log('[Test Line Connection Error] ' . $e->getMessage());
        return [
            'success' => false,
            'error' => [
                'message' => $e->getMessage()
            ]
        ];
    }
}

/**
 * LINE Messaging Serviceを作成
 */
function createLineMessagingService(GasApiClient $gasApi): LineMessagingService
{
    $channelAccessToken = getenv('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');
    $channelSecret = getenv('LINE_MESSAGING_CHANNEL_SECRET');
    
    if (empty($channelAccessToken) || empty($channelSecret)) {
        throw new Exception('LINE Messaging API設定が不完全です', 500);
    }
    
    return new LineMessagingService($channelAccessToken, $channelSecret, $gasApi);
}

/**
 * 通知タイプに応じてメッセージを作成
 */
function createNotificationMessage(string $notificationType, array $data): array
{
    switch ($notificationType) {
        case 'reservation_confirmation':
            return FlexMessageTemplates::createReservationConfirmation($data);
            
        case 'ticket_balance_update':
            return FlexMessageTemplates::createTicketBalanceUpdate($data);
            
        case 'reminder_day_before':
            return FlexMessageTemplates::createReminder($data, 'day_before');
            
        case 'reminder_same_day':
            return FlexMessageTemplates::createReminder($data, 'same_day');
            
        case 'post_treatment':
            return FlexMessageTemplates::createPostTreatment($data);
            
        case 'campaign_notification':
        default:
            // デフォルトはテキストメッセージ
            return [
                'type' => 'text',
                'text' => $data['message'] ?? 'お知らせがあります'
            ];
    }
}
