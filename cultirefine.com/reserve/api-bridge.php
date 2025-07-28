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
            
        case 'validateGasConfiguration':
            $result = handleValidateGasConfiguration($gasApi);
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
            'trace' => $e->getTraceAsString(),
            'action' => $action ?? 'unknown',
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'get_params' => $_GET,
            'post_data' => getJsonInput(),
            'session_data' => [
                'line_user_id' => $_SESSION['line_user_id'] ?? 'not_set',
                'company_info' => $_SESSION['company_info'] ?? 'not_set'
            ],
            'environment' => [
                'DEBUG_MODE' => DEBUG_MODE,
                'MOCK_MODE' => MOCK_MODE,
                'MOCK_MEDICAL_FORCE' => MOCK_MEDICAL_FORCE,
                'CLINIC_ID' => getenv('CLINIC_ID') ?: 'NOT_SET',
                'MEDICAL_FORCE_API_URL' => MEDICAL_FORCE_API_URL,
                'MEDICAL_FORCE_CLIENT_ID' => !empty(MEDICAL_FORCE_CLIENT_ID) ? 'SET (' . strlen(MEDICAL_FORCE_CLIENT_ID) . ' chars)' : 'NOT_SET',
                'MEDICAL_FORCE_CLIENT_SECRET' => !empty(MEDICAL_FORCE_CLIENT_SECRET) ? 'SET' : 'NOT_SET'
            ]
        ];
        
        // コンソール用の詳細エラーログ
        error_log('[API_BRIDGE_ERROR] ==================== DEBUG START ====================');
        error_log('[API_BRIDGE_ERROR] Action: ' . ($action ?? 'unknown'));
        error_log('[API_BRIDGE_ERROR] Error Message: ' . $e->getMessage());
        error_log('[API_BRIDGE_ERROR] Error Code: ' . $statusCode);
        error_log('[API_BRIDGE_ERROR] File: ' . $e->getFile() . ':' . $e->getLine());
        error_log('[API_BRIDGE_ERROR] Request Method: ' . $_SERVER['REQUEST_METHOD']);
        error_log('[API_BRIDGE_ERROR] GET Params: ' . json_encode($_GET));
        error_log('[API_BRIDGE_ERROR] POST Data: ' . json_encode(getJsonInput()));
        error_log('[API_BRIDGE_ERROR] Session Data: ' . json_encode([
            'line_user_id' => $_SESSION['line_user_id'] ?? 'not_set',
            'company_info' => $_SESSION['company_info'] ?? 'not_set'
        ]));
        error_log('[API_BRIDGE_ERROR] Environment Variables:');
        error_log('[API_BRIDGE_ERROR]   - CLINIC_ID: ' . (getenv('CLINIC_ID') ?: 'NOT_SET'));
        error_log('[API_BRIDGE_ERROR]   - MEDICAL_FORCE_CLIENT_ID: ' . (!empty(MEDICAL_FORCE_CLIENT_ID) ? 'SET' : 'NOT_SET'));
        error_log('[API_BRIDGE_ERROR]   - MEDICAL_FORCE_CLIENT_SECRET: ' . (!empty(MEDICAL_FORCE_CLIENT_SECRET) ? 'SET' : 'NOT_SET'));
        error_log('[API_BRIDGE_ERROR] Stack Trace:');
        error_log($e->getTraceAsString());
        error_log('[API_BRIDGE_ERROR] ==================== DEBUG END ====================');
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
    
    $mappedData = mapGasUserDataToJs($result['data']);
    
    // 会社情報をセッションに保存
    if (isset($mappedData['membershipInfo']) && !empty($mappedData['membershipInfo']['companyId'])) {
        $_SESSION['company_info'] = [
            'company_id' => $mappedData['membershipInfo']['companyId'],
            'company_name' => $mappedData['membershipInfo']['companyName'],
            'member_type' => $mappedData['membershipInfo']['memberType']
        ];
        $_SESSION['user_role'] = $mappedData['membershipInfo']['memberType'] === 'main' ? 'main' : 'sub';
        
        // デバッグログ
        if (DEBUG_MODE) {
            error_log('[handleGetUserFullInfo] Company info saved to session: ' . json_encode($_SESSION['company_info']));
        }
    }
    
    return $mappedData;
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
        // デバッグ: フロントエンドから受信したデータ
        if (DEBUG_MODE) {
            error_log('[handleCreateVisitor] Received data from frontend: ' . json_encode($visitorData));
        }
        
        // Step 1: フロントエンドからの基本データを検証（簡素化：姓、名、性別のみ）
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
        
        // Step 2: 先にユーザー情報を取得して会社情報を準備
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
        
        // GAS APIの標準形式レスポンスをチェック
        if ($userInfo['status'] !== 'success') {
            if (DEBUG_MODE) {
                error_log('[handleCreateVisitor] GAS API failed: ' . json_encode($userInfo));
            }
            throw new Exception('ユーザー情報の取得に失敗しました（GAS API）', 500);
        }
        
        $membershipInfo = $userInfo['data']['membership_info'] ?? null;
        $companyId = $membershipInfo['company_id'] ?? '';
        $companyName = $membershipInfo['company_name'] ?? '';
        $memberType = $membershipInfo['member_type'] ?? 'sub';
        
        if (DEBUG_MODE) {
            error_log('[handleCreateVisitor] Company info - ID: ' . $companyId . ', Name: ' . $companyName . ', Type: ' . $memberType);
        }
        
        // Step 3: Medical Force APIで来院者を作成（OAuth 2.0対応）
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
        
        if (DEBUG_MODE) {
            error_log('[handleCreateVisitor] Medical Force visitor created with ID: ' . $visitorId);
        }
        
        // Step 4: 完全な会社別来院者データを作成してGASに送信（ユーザー提案のアーキテクチャ）
        $lastName = trim($visitorData['last_name']);
        $firstName = trim($visitorData['first_name']);
        $lastNameKana = trim($visitorData['last_name_kana'] ?? '');
        $firstNameKana = trim($visitorData['first_name_kana'] ?? '');
        $fullName = $lastName . ' ' . $firstName;
        
        // 性別の変換（フロントエンドの形式からAPI形式へ）
        $genderMap = [
            'MALE' => 'male',
            'FEMALE' => 'female',
            'male' => 'male',
            'female' => 'female'
        ];
        $gender = $genderMap[strtoupper($visitorData['gender'] ?? '')] ?? 'other';
        
        // 現在の日時（JST）
        $currentDateTime = (new DateTime('now', new DateTimeZone('Asia/Tokyo')))->format('Y-m-d H:i:s');
        
        // 会社別来院者情報の完全なデータ構造を準備（ユーザー提供のヘッダーに対応）
        $companyVisitorData = [
            'path' => '/api/visitors',
            'api_key' => GAS_API_KEY,
            'visitor_id' => $visitorId, // Medical Forceから受け取ったID
            'company_id' => $companyId, // 会社ID
            'company_name' => $companyName, // 会社名
            'full_name' => $fullName, // 氏名（結合済み）
            'line_id' => $lineUserId, // LINE_ID
            'member_type' => $memberType === 'main' ? 'メイン会員' : 'サブ会員', // 会員種別
            'publicity_status' => '非公開', // 公開設定（デフォルトは非公開）
            'position' => '', // 役職（空文字）
            'registration_date' => $currentDateTime, // 登録日時
            'updated_date' => $currentDateTime, // 更新日時
            'expiry_date' => '', // 有効期限（空文字）
            'is_used' => 'false', // 使用済み（初期値はfalse）
            'line_display_name' => $userInfo['data']['user']['name'] ?? '', // LINE表示名
            'link_date' => $currentDateTime, // 紐付け日時
            'url' => '', // URL（空文字）
            'connection_status' => 'active', // 連携ステータス
            'line_connection_url' => '', // LINE連携用URLリンク（空文字）
            'status' => 'active', // ステータス
            'created_date' => $currentDateTime, // 作成日時
            'link_url' => '', // リンクURL（空文字）
            'notes' => 'Medical Force経由で登録 - 簡素化フロー'
        ];
        
        // オプションフィールドの追加
        if (!empty($visitorData['email'])) {
            $companyVisitorData['email'] = $visitorData['email'];
        }
        if (!empty($visitorData['phone'])) {
            $companyVisitorData['phone'] = $visitorData['phone'];
        }
        if (!empty($visitorData['birthday'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitorData['birthday'])) {
                throw new Exception('誕生日はYYYY-MM-DD形式で入力してください', 400);
            }
            $companyVisitorData['birth_date'] = $visitorData['birthday'];
        }
        
        // デバッグ: GAS APIに送信する完全なデータを確認
        if (DEBUG_MODE) {
            error_log('[handleCreateVisitor] Complete company visitor data for GAS API: ' . json_encode($companyVisitorData));
        }
        
        // Step 5: 完全な会社別来院者データをGAS APIに送信（ユーザー提案のアーキテクチャ）
        $result = $gasApi->createVisitorToSheet($companyVisitorData);
        
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
            error_log("GAS API Error Details: " . json_encode($result));
            
            // より詳細なエラー分析とユーザーフレンドリーなメッセージ
            if (strpos($errorMessage, 'APIキーが無効') !== false || 
                strpos($errorMessage, 'Invalid API key') !== false ||
                strpos($errorMessage, 'INVALID_API_KEY') !== false ||
                strpos($errorMessage, 'Unauthorized') !== false) {
                
                // 詳細なAPIキー問題の診断
                $apiKeyDiagnosis = [
                    'configured_api_key_length' => strlen(GAS_API_KEY),
                    'configured_deployment_id' => GAS_DEPLOYMENT_ID,
                    'sent_api_key' => $companyVisitorData['api_key'] ?? 'not_sent'
                ];
                
                error_log("API Key診断情報: " . json_encode($apiKeyDiagnosis));
                
                throw new Exception('GAS API設定エラー: APIキーが無効または未設定です。管理者にGAS側のPHP_API_KEYSスクリプトプロパティ設定を確認するよう連絡してください。', 500);
                
            } else if (strpos($errorMessage, '必須パラメータが不足') !== false || 
                       strpos($errorMessage, 'INVALID_REQUEST') !== false) {
                
                error_log("必須パラメータエラー - 送信データ: " . json_encode($companyVisitorData));
                throw new Exception('データ形式エラー: 必須フィールドが不足しています。' . $errorMessage, 400);
                
            } else if (strpos($errorMessage, 'DUPLICATE_EMAIL') !== false) {
                throw new Exception('このメールアドレスは既に登録されています（GAS API）', 400);
            } else if (strpos($errorMessage, 'INVALID_COMPANY') !== false) {
                throw new Exception('指定された会社が見つかりません（GAS API）', 400);
            } else if (strpos($errorMessage, 'JSON_DECODE_ERROR') !== false) {
                throw new Exception('データ処理エラーが発生しました。管理者にお問い合わせください。（GAS API通信エラー）', 500);
            } else if (strpos($errorMessage, 'CURL_ERROR') !== false || 
                       strpos($errorMessage, 'HTTP_ERROR') !== false) {
                throw new Exception('外部サービスとの通信に失敗しました。しばらく時間をおいて再度お試しください。', 500);
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
    // セッションから既に取得済みの会社情報を使用
    if (!isset($_SESSION['company_info']) || !isset($_SESSION['user_role'])) {
        // セッションにない場合のみ取得
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
        if ($userInfo['status'] !== 'success') {
            throw new Exception('ユーザー情報の取得に失敗しました', 500);
        }
        
        $companyInfo = $userInfo['data']['membership_info'] ?? null;
        if (!$companyInfo || empty($companyInfo['company_id'])) {
            // デバッグ用：取得したデータの構造を確認
            if (DEBUG_MODE) {
                error_log('[handleGetCompanyVisitors] User info data keys: ' . implode(', ', array_keys($userInfo['data'] ?? [])));
                error_log('[handleGetCompanyVisitors] Membership info: ' . json_encode($companyInfo));
            }
            throw new Exception('会社情報が見つかりません', 400);
        }
        
        // セッションに保存
        $_SESSION['company_info'] = $companyInfo;
        $_SESSION['user_role'] = $companyInfo['member_type'] === 'main' ? 'main' : 'sub';
    }
    
    $companyId = $_SESSION['company_info']['company_id'];
    $userRole = $_SESSION['user_role'];
    
    // デバッグログ追加
    error_log('[handleGetCompanyVisitors] Company ID: ' . $companyId . ', Role: ' . $userRole);
    
    $result = $gasApi->getPatientsByCompany($companyId, $userRole);
    
    if ($result['status'] === 'error') {
        throw new Exception($result['error']['message'], 500);
    }
    
    // デバッグログ：返されたデータを確認
    error_log('[handleGetCompanyVisitors] Result data count: ' . count($result['data'] ?? []));
    
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
    // visitor構造に対応
    $visitor = $gasData['visitor'] ?? null;
    $company = $gasData['company'] ?? null;
    return [
        // 基本ユーザー情報（visitor構造から取得）
        'user' => [
            'id' => $visitor['visitor_id'] ?? '',
            'name' => $visitor['visitor_name'] ?? '',
            'email' => $visitor['email'] ?? '',
            'phone' => $visitor['phone'] ?? '',
            'lineDisplayName' => $gasData['line_display_name'] ?? '',
            'linePictureUrl' => $gasData['line_picture_url'] ?? '',
        ],
        
        // 患者情報（visitor構造から取得）
        'patientInfo' => [
            'id' => $visitor['visitor_id'] ?? '',
            'name' => $visitor['visitor_name'] ?? '',
            'kana' => $visitor['visitor_kana'] ?? '',
            'birthDate' => $visitor['birth_date'] ?? '',
            'age' => $visitor['age'] ?? 0,
            'gender' => $visitor['gender'] ?? '',
            'isNew' => empty($gasData['ReservationHistory']),
            'lastVisitDate' => isset($gasData['ReservationHistory'][0]['reservedate']) ? $gasData['ReservationHistory'][0]['reservedate'] : null,
            'chartNumber' => $visitor['chart_number'] ?? '',
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
    /*'docsinfo' => [
    'foldername' => array_values(array_map(function($folderName, $docs) {
		return [
            'name' => $docs['name'] ?? '',
            'documents' => array_map(function($doc) {
        return [
            'docs_id' => $doc['docs_id'] ?? '',
            'docs_name' => $doc['docs_name'] ?? '',
            'docs_url' => $doc['docs_url'] ?? '',
            'created_at' => $doc['created_at'] ?? '',
            'treatment_name' => $doc['treatment_name'] ?? '',
            'notes' => $doc['notes'] ?? ''
        ];
			},$gasData['documents'] ?? []),
			];
    }, $gasData['docsinfo'] ?? [])
	],*/
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
            'isMember' => !empty($company),
            'memberType' => isset($visitor['member_type']) && $visitor['member_type'] === true ? 'main' : 'sub',
            'companyId' => $company['company_id'] ?? '',
            'companyName' => $company['name'] ?? '',
            'ticketBalance' => [],
        ],
        
        // 会社別来院者情報（GAS APIが返す場合）
        'companyVisitors' => isset($gasData['companyVisitors']) ? array_values(array_filter(
            array_map(function($visitor) {
                return [
                    'id' => $visitor['visitorId'] ?? $visitor['visitor_id'] ?? '',
                    'visitor_id' => $visitor['visitorId'] ?? $visitor['visitor_id'] ?? '',
                    'name' => $visitor['visitorName'] ?? $visitor['visitor_name'] ?? $visitor['name'] ?? '',
                    'kana' => $visitor['visitorKana'] ?? $visitor['visitor_kana'] ?? $visitor['kana'] ?? '',
                    'gender' => $visitor['gender'] ?? '',
                    'is_public' => $visitor['isPublic'] ?? $visitor['is_public'] ?? true,
                    'last_visit' => $visitor['lastVisitDate'] ?? $visitor['last_visit_date'] ?? null,
                    'is_new' => $visitor['isNew'] ?? $visitor['is_new'] ?? false,
                    'company_id' => $visitor['companyId'] ?? $visitor['company_id'] ?? '',
                    'member_type' => $visitor['memberType'] ?? $visitor['member_type'] ?? false
                ];
            }, $gasData['companyVisitors']),
            function($mappedVisitor) use ($gasData) {
                // 現在のユーザーIDを取得
                $currentUserId = $gasData['visitor']['visitor_id'] ?? '';
                // 現在のユーザーを除外（visitor_idで比較）
                return $mappedVisitor['visitor_id'] !== $currentUserId;
            }
        )) : [],
        
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
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('[DEBUG_AVAILABLE_SLOTS] ========== START handleGetAvailableSlots ==========');
        error_log('[DEBUG_AVAILABLE_SLOTS] Input params: ' . json_encode($params));
        error_log('[DEBUG_AVAILABLE_SLOTS] Params type: ' . gettype($params));
        error_log('[DEBUG_AVAILABLE_SLOTS] Params keys: ' . implode(', ', array_keys($params)));
    }
    
    // POSTリクエストのパラメータを取得
    $requestParams = $params['params'] ?? $params;
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('[DEBUG_AVAILABLE_SLOTS] Request params after extraction: ' . json_encode($requestParams));
        error_log('[DEBUG_AVAILABLE_SLOTS] Request params type: ' . gettype($requestParams));
        if (is_array($requestParams)) {
            error_log('[DEBUG_AVAILABLE_SLOTS] Request params keys: ' . implode(', ', array_keys($requestParams)));
        }
    }
    
    // パスからvisitorIdを抽出
    if (isset($requestParams['path']) && preg_match('/api\/patients\/([^\/]+)\/available-slots/', $requestParams['path'], $matches)) {
        $visitorId = $matches[1];
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_AVAILABLE_SLOTS] Visitor ID extracted from path: ' . $visitorId);
        }
    } else {
        $visitorId = $requestParams['visitor_id'] ?? '';
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_AVAILABLE_SLOTS] Visitor ID from parameter: ' . $visitorId);
            error_log('[DEBUG_AVAILABLE_SLOTS] Path parameter: ' . ($requestParams['path'] ?? 'NOT SET'));
        }
    }
    
    if (empty($visitorId)) {
        error_log('[ERROR_AVAILABLE_SLOTS] Missing required parameter: visitor_id');
        error_log('[ERROR_AVAILABLE_SLOTS] Request params: ' . json_encode($requestParams));
        throw new Exception('visitor_idが必要です', 400);
    }
    
    if (empty($requestParams['date'])) {
        error_log('[ERROR_AVAILABLE_SLOTS] Missing required parameter: date');
        error_log('[ERROR_AVAILABLE_SLOTS] Request params: ' . json_encode($requestParams));
        throw new Exception('dateが必要です', 400);
    }
    
    // 複数メニューか単一メニューかを判定
    $menuIds = $requestParams['menu_ids'] ?? [];
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('[DEBUG_AVAILABLE_SLOTS] menu_ids from request: ' . json_encode($menuIds));
        error_log('[DEBUG_AVAILABLE_SLOTS] menu_ids type: ' . gettype($menuIds));
    }
    
    if (empty($menuIds) && !empty($requestParams['menu_id'])) {
        $menuIds = [$requestParams['menu_id']];
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_AVAILABLE_SLOTS] Using single menu_id, converted to array: ' . json_encode($menuIds));
        }
    }
    
    if (empty($menuIds)) {
        error_log('[ERROR_AVAILABLE_SLOTS] Missing required parameter: menu_id or menu_ids');
        error_log('[ERROR_AVAILABLE_SLOTS] Request params: ' . json_encode($requestParams));
        throw new Exception('menu_idまたはmenu_idsが必要です', 400);
    }
    
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('[DEBUG_AVAILABLE_SLOTS] Final menuIds: ' . json_encode($menuIds));
        error_log('[DEBUG_AVAILABLE_SLOTS] Total duration: ' . ($requestParams['total_duration'] ?? '0'));
        error_log('[DEBUG_AVAILABLE_SLOTS] Date: ' . $requestParams['date']);
        error_log('[DEBUG_AVAILABLE_SLOTS] Date range: ' . ($requestParams['date_range'] ?? '7'));
        error_log('[DEBUG_AVAILABLE_SLOTS] Calling handleMenuAvailability...');
    }
    
    try {
        $result = handleMenuAvailability($menuIds, $requestParams);
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_AVAILABLE_SLOTS] handleMenuAvailability completed successfully');
            error_log('[DEBUG_AVAILABLE_SLOTS] Result keys: ' . implode(', ', array_keys($result)));
            error_log('[DEBUG_AVAILABLE_SLOTS] ========== END handleGetAvailableSlots ==========');
        }
        
        return $result;
    } catch (Exception $e) {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[ERROR_AVAILABLE_SLOTS] Exception in handleMenuAvailability: ' . $e->getMessage());
            error_log('[ERROR_AVAILABLE_SLOTS] Exception code: ' . $e->getCode());
            error_log('[ERROR_AVAILABLE_SLOTS] Exception file: ' . $e->getFile() . ':' . $e->getLine());
            error_log('[ERROR_AVAILABLE_SLOTS] ========== END handleGetAvailableSlots (ERROR) ==========');
        }
        throw $e;
    }
}

/**
 * メニューの空き情報取得（Medical Force API直接呼び出し）
 * 単一・複数メニュー両対応
 */
function handleMenuAvailability($menuIds, array $params): array
{
    try {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] ========== START handleMenuAvailability ==========');
            error_log('[DEBUG_MENU_AVAILABILITY] Menu IDs: ' . json_encode($menuIds));
            error_log('[DEBUG_MENU_AVAILABILITY] Params: ' . json_encode($params));
            
            // 環境変数の確認
            error_log('[DEBUG_MENU_AVAILABILITY] Environment Configuration:');
            error_log('[DEBUG_MENU_AVAILABILITY]   - MEDICAL_FORCE_API_URL: ' . (defined('MEDICAL_FORCE_API_URL') ? MEDICAL_FORCE_API_URL : 'NOT_DEFINED'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - MEDICAL_FORCE_API_KEY: ' . (defined('MEDICAL_FORCE_API_KEY') ? 'DEFINED (' . strlen(MEDICAL_FORCE_API_KEY) . ' chars)' : 'NOT_DEFINED'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - MEDICAL_FORCE_CLIENT_ID: ' . (defined('MEDICAL_FORCE_CLIENT_ID') ? 'DEFINED (' . strlen(MEDICAL_FORCE_CLIENT_ID) . ' chars)' : 'NOT_DEFINED'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - MEDICAL_FORCE_CLIENT_SECRET: ' . (defined('MEDICAL_FORCE_CLIENT_SECRET') ? 'DEFINED' : 'NOT_DEFINED'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - MOCK_MEDICAL_FORCE: ' . (defined('MOCK_MEDICAL_FORCE') ? (MOCK_MEDICAL_FORCE ? 'TRUE' : 'FALSE') : 'NOT_DEFINED'));
            
            // getenv() を使った環境変数の確認
            error_log('[DEBUG_MENU_AVAILABILITY] Environment Variables (getenv):');
            error_log('[DEBUG_MENU_AVAILABILITY]   - CLINIC_ID (getenv): ' . (getenv('CLINIC_ID') ?: 'NOT SET'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - MEDICAL_FORCE_API_URL (getenv): ' . (getenv('MEDICAL_FORCE_API_URL') ?: 'NOT SET'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - MEDICAL_FORCE_CLIENT_ID (getenv): ' . (getenv('MEDICAL_FORCE_CLIENT_ID') ? 'SET' : 'NOT SET'));
            
            error_log('[DEBUG_MENU_AVAILABILITY] Initializing Medical Force API client...');
        }
        
        // Medical Force APIクライアントを初期化
        $clinicId = getenv('CLINIC_ID') ?: '';
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] CLINIC_ID value: "' . $clinicId . '"');
            error_log('[DEBUG_MENU_AVAILABILITY] CLINIC_ID length: ' . strlen($clinicId));
            error_log('[DEBUG_MENU_AVAILABILITY] CLINIC_ID empty check: ' . (empty($clinicId) ? 'EMPTY' : 'NOT EMPTY'));
            
            error_log('[DEBUG_MENU_AVAILABILITY] Creating Medical Force API client with parameters:');
            error_log('[DEBUG_MENU_AVAILABILITY]   - API URL: ' . MEDICAL_FORCE_API_URL);
            error_log('[DEBUG_MENU_AVAILABILITY]   - API Key length: ' . strlen(MEDICAL_FORCE_API_KEY ?? ''));
            error_log('[DEBUG_MENU_AVAILABILITY]   - Client ID length: ' . strlen(MEDICAL_FORCE_CLIENT_ID ?? ''));
            error_log('[DEBUG_MENU_AVAILABILITY]   - Client Secret set: ' . (!empty(MEDICAL_FORCE_CLIENT_SECRET) ? 'YES' : 'NO'));
            error_log('[DEBUG_MENU_AVAILABILITY]   - Clinic ID: "' . $clinicId . '"');
        }
        
        $medicalForceApi = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            MEDICAL_FORCE_API_KEY ?? '',
            MEDICAL_FORCE_CLIENT_ID ?? '',
            MEDICAL_FORCE_CLIENT_SECRET ?? '',
            $clinicId
        );
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] Medical Force API client initialized successfully');
        }
        
        // 日付範囲を計算
        $startDate = $params['date'];
        $dateRange = $params['date_range'] ?? 7;
        $endDate = date('Y-m-d', strtotime($startDate . ' +' . ($dateRange - 1) . ' days'));
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] Date calculation:');
            error_log('[DEBUG_MENU_AVAILABILITY]   - Start date: ' . $startDate);
            error_log('[DEBUG_MENU_AVAILABILITY]   - Date range: ' . $dateRange . ' days');
            error_log('[DEBUG_MENU_AVAILABILITY]   - End date: ' . $endDate);
        }
        
        // メニューIDが配列でない場合は配列に変換
        if (!is_array($menuIds)) {
            $menuIds = [$menuIds];
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('[DEBUG_MENU_AVAILABILITY] Menu IDs converted to array: ' . json_encode($menuIds));
            }
        }
        
        // Medical Force API用のリクエストボディを構築
        // 複数メニューの場合は配列で送信
        $menus = array_map(function($menuId) {
            return [
                'menu_id' => $menuId
                // staff_ids は空配列（オプション）
            ];
        }, $menuIds);
        
        $requestBody = [
            'epoch_from_keydate' => $startDate,
            'epoch_to_keydate' => $endDate,
            'time_spacing' => '5', // 5分間隔
            'menus' => $menus
        ];
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] Medical Force API request body:');
            error_log('[DEBUG_MENU_AVAILABILITY]   ' . json_encode($requestBody, JSON_PRETTY_PRINT));
            error_log('[DEBUG_MENU_AVAILABILITY] Calling Medical Force API getVacancies...');
        }
        
        // Medical Force APIを呼び出し
        $vacancies = $medicalForceApi->getVacancies($requestBody);
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] Medical Force API getVacancies completed successfully');
            error_log('[DEBUG_MENU_AVAILABILITY] Vacancies response type: ' . gettype($vacancies));
            error_log('[DEBUG_MENU_AVAILABILITY] Vacancies response (first 500 chars): ' . substr(json_encode($vacancies), 0, 500));
        }
        
        // レスポンス形式を統一
        $response = [
            'available_slots' => $vacancies,
            'source' => 'medical_force',
            'menu_count' => count($menuIds),
            'menu_ids' => $menuIds,
            'total_duration' => $params['total_duration'] ?? 0
        ];
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[DEBUG_MENU_AVAILABILITY] Final response structure:');
            error_log('[DEBUG_MENU_AVAILABILITY]   - source: ' . $response['source']);
            error_log('[DEBUG_MENU_AVAILABILITY]   - menu_count: ' . $response['menu_count']);
            error_log('[DEBUG_MENU_AVAILABILITY]   - menu_ids: ' . json_encode($response['menu_ids']));
            error_log('[DEBUG_MENU_AVAILABILITY]   - total_duration: ' . $response['total_duration']);
            error_log('[DEBUG_MENU_AVAILABILITY] ========== END handleMenuAvailability ==========');
        }
        
        return $response;
        
    } catch (Exception $e) {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('[ERROR_MENU_AVAILABILITY] ========== ERROR in handleMenuAvailability ==========');
            error_log('[ERROR_MENU_AVAILABILITY] Exception Message: ' . $e->getMessage());
            error_log('[ERROR_MENU_AVAILABILITY] Exception Code: ' . $e->getCode());
            error_log('[ERROR_MENU_AVAILABILITY] Exception File: ' . $e->getFile() . ':' . $e->getLine());
            error_log('[ERROR_MENU_AVAILABILITY] Stack Trace:');
            error_log($e->getTraceAsString());
            error_log('[ERROR_MENU_AVAILABILITY] ========== END ERROR ==========');
        }
        
        throw new Exception('空き情報の取得に失敗しました: ' . $e->getMessage(), 500);
    }
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
 * GAS設定検証
 */
function handleValidateGasConfiguration(GasApiClient $gasApi): array
{
    try {
        return $gasApi->validateConfiguration();
    } catch (Exception $e) {
        error_log('[GAS Configuration Validation Error] ' . $e->getMessage());
        return [
            'timestamp' => date('Y-m-d H:i:s'),
            'overall_status' => false,
            'error' => [
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ]
        ];
    }
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
