<?php
/**
 * GAS専用同期エンドポイント
 * Google Apps Scriptからの同期リクエストを処理
 * LINEセッション認証を必要としない
 */

// エラーレポーティング設定
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// 実行時間とメモリ制限を緩和
set_time_limit(300); // 5分
ini_set('memory_limit', '512M');

// 必要なファイルを読み込み
require_once __DIR__ . '/line-auth/env-loader.php';
require_once __DIR__ . '/line-auth/config.php';
require_once __DIR__ . '/line-auth/GasApiClient.php';
require_once __DIR__ . '/line-auth/MedicalForceApiClient.php';
require_once __DIR__ . '/line-auth/MedicalForceSyncService.php';

// CORS設定（GASからのアクセスを許可）
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// OPTIONSリクエストへの対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ログ記録用関数
function logSyncActivity($action, $status, $details = []) {
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'action' => $action,
        'status' => $status,
        'details' => $details,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    
    error_log('[GAS Sync] ' . json_encode($logData));
}

// Bearer token認証チェック
function authenticateGasRequest(): bool {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (empty($authHeader)) {
        logSyncActivity('auth_check', 'failed', ['reason' => 'missing_auth_header']);
        return false;
    }
    
    // Bearer tokenを抽出
    if (!preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        logSyncActivity('auth_check', 'failed', ['reason' => 'invalid_auth_format']);
        return false;
    }
    
    $token = $matches[1];
    $expectedToken = getenv('GAS_API_KEY') ?: GAS_API_KEY;
    
    if ($token !== $expectedToken) {
        logSyncActivity('auth_check', 'failed', ['reason' => 'invalid_token']);
        return false;
    }
    
    logSyncActivity('auth_check', 'success');
    return true;
}

// レート制限チェック（1分間に1回まで）
function checkRateLimit(): bool {
    $rateLimitFile = sys_get_temp_dir() . '/gas_sync_rate_limit.txt';
    
    if (file_exists($rateLimitFile)) {
        $lastSync = (int)file_get_contents($rateLimitFile);
        $timeDiff = time() - $lastSync;
        
        if ($timeDiff < 60) {
            logSyncActivity('rate_limit', 'blocked', ['wait_seconds' => 60 - $timeDiff]);
            return false;
        }
    }
    
    file_put_contents($rateLimitFile, time());
    return true;
}

// 進捗状態の保存と読み込み
function saveProgressState($state) {
    $progressFile = sys_get_temp_dir() . '/sync_progress_' . date('Ymd') . '.json';
    file_put_contents($progressFile, json_encode($state));
}

function loadProgressState() {
    $progressFile = sys_get_temp_dir() . '/sync_progress_' . date('Ymd') . '.json';
    if (file_exists($progressFile)) {
        return json_decode(file_get_contents($progressFile), true);
    }
    return null;
}

// メイン処理
try {
    // 認証チェック
    if (!authenticateGasRequest()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => ['message' => '認証エラー: 有効なAPIキーが必要です']
        ]);
        exit;
    }
    
    // リクエストデータを取得
    $rawData = file_get_contents('php://input');
    $requestData = json_decode($rawData, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON request: ' . json_last_error_msg(), 400);
    }
    
    $action = $requestData['action'] ?? '';
    $params = $requestData['params'] ?? [];
    
    logSyncActivity('request', 'received', ['action' => $action]);
    
    // アクション処理
    switch ($action) {
        case 'syncMedicalForceReservations':
            // レート制限チェック
            if (!checkRateLimit()) {
                http_response_code(429);
                echo json_encode([
                    'success' => false,
                    'error' => ['message' => 'レート制限: 1分間に1回まで同期可能です']
                ]);
                exit;
            }
            
            $result = handleSyncReservations($params);
            break;
            
        case 'checkSyncStatus':
            $result = handleCheckSyncStatus();
            break;
            
        case 'getSyncProgress':
            $result = handleGetSyncProgress();
            break;
            
        default:
            throw new Exception("不明なアクション: {$action}", 400);
    }
    
    // 成功レスポンス
    echo json_encode($result);
    
} catch (Exception $e) {
    logSyncActivity('error', 'exception', [
        'message' => $e->getMessage(),
        'code' => $e->getCode()
    ]);
    
    http_response_code($e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500);
    echo json_encode([
        'success' => false,
        'error' => [
            'message' => $e->getMessage(),
            'code' => $e->getCode()
        ]
    ]);
}

/**
 * 予約同期処理
 */
function handleSyncReservations(array $params): array {
    try {
        // Medical Force APIクライアントを初期化
        $medicalForceClient = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            MEDICAL_FORCE_API_KEY,
            MEDICAL_FORCE_CLIENT_ID,
            MEDICAL_FORCE_CLIENT_SECRET,
            getenv('CLINIC_ID') ?: ''
        );
        
        // 同期サービスを初期化
        $syncService = new MedicalForceSyncService($medicalForceClient);
        
        // 進捗状態を確認
        $progressState = loadProgressState();
        if ($progressState && isset($progressState['in_progress']) && $progressState['in_progress']) {
            // 前回の同期が完了していない場合は再開
            $params['offset'] = $progressState['offset'] ?? 0;
            logSyncActivity('sync', 'resuming', ['offset' => $params['offset']]);
        }
        
        // 同期パラメータ設定
        $syncParams = [
            'date_from' => $params['date_from'] ?? date('Y-m-d', strtotime('-7 days')),
            'date_to' => $params['date_to'] ?? date('Y-m-d', strtotime('+7 days')),
            'offset' => $params['offset'] ?? 0,
            'limit' => 100, // チャンクサイズを100に制限
            'chunk_mode' => true
        ];
        
        logSyncActivity('sync', 'started', $syncParams);
        
        // 同期実行
        $result = $syncService->syncReservations($syncParams);
        
        if ($result['success']) {
            // 進捗を保存
            $summary = $result['data']['summary'] ?? [];
            $totalCount = $summary['total_count'] ?? 0;
            $processedCount = $summary['processed_count'] ?? 0;
            $currentOffset = $syncParams['offset'] + $processedCount;
            
            if ($currentOffset < $totalCount) {
                // まだ処理すべきデータがある
                saveProgressState([
                    'in_progress' => true,
                    'offset' => $currentOffset,
                    'total' => $totalCount,
                    'processed' => $currentOffset,
                    'started_at' => $progressState['started_at'] ?? date('Y-m-d H:i:s')
                ]);
                
                $result['data']['has_more'] = true;
                $result['data']['next_offset'] = $currentOffset;
            } else {
                // 同期完了
                saveProgressState([
                    'in_progress' => false,
                    'completed_at' => date('Y-m-d H:i:s'),
                    'total_processed' => $totalCount
                ]);
                
                $result['data']['has_more'] = false;
            }
            
            logSyncActivity('sync', 'success', $summary);
        } else {
            logSyncActivity('sync', 'failed', ['error' => $result['error'] ?? 'Unknown error']);
        }
        
        return $result;
        
    } catch (Exception $e) {
        logSyncActivity('sync', 'error', ['message' => $e->getMessage()]);
        throw $e;
    }
}

/**
 * 同期ステータス確認
 */
function handleCheckSyncStatus(): array {
    try {
        // Medical Force API接続確認
        $medicalForceClient = new MedicalForceApiClient(
            MEDICAL_FORCE_API_URL,
            MEDICAL_FORCE_API_KEY,
            MEDICAL_FORCE_CLIENT_ID,
            MEDICAL_FORCE_CLIENT_SECRET,
            getenv('CLINIC_ID') ?: ''
        );
        
        $syncService = new MedicalForceSyncService($medicalForceClient);
        $status = $syncService->checkSyncStatus();
        
        // 進捗状態も含める
        $progressState = loadProgressState();
        if ($progressState) {
            $status['progress'] = $progressState;
        }
        
        return $status;
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => ['message' => $e->getMessage()]
        ];
    }
}

/**
 * 同期進捗取得
 */
function handleGetSyncProgress(): array {
    $progressState = loadProgressState();
    
    if (!$progressState) {
        return [
            'success' => true,
            'data' => [
                'in_progress' => false,
                'message' => '進行中の同期はありません'
            ]
        ];
    }
    
    return [
        'success' => true,
        'data' => $progressState
    ];
}