<?php

// config.phpを最初に読み込み（DEBUG_MODE定義のため）
if (!file_exists(__DIR__ . '/line-auth/config.php')) {
    die('エラー: config.phpが見つかりません - パス: ' . __DIR__ . '/line-auth/config.php');
}
require_once __DIR__ . '/line-auth/config.php';

// エラー表示設定（DEBUG_MODE定義後に実行）
if (defined('DEBUG_MODE') && DEBUG_MODE) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
}

// 必要なファイルを読み込み
if (!file_exists(__DIR__ . '/line-auth/logger.php')) {
    die('エラー: logger.phpが見つかりません');
}
require_once __DIR__ . '/line-auth/logger.php';

if (!file_exists(__DIR__ . '/line-auth/url-helper.php')) {
    die('エラー: url-helper.phpが見つかりません');
}
require_once __DIR__ . '/line-auth/url-helper.php';
// SessionManagerの使用を削除（500エラー対策）
// require_once __DIR__ . '/line-auth/SessionManager.php';

$logger = new Logger();
// $sessionManager = SessionManager::getInstance();

// 直接session_start()を使用（callback.phpと統一）
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// 直接セッション確認によるLINE認証状態チェック
$isLINEAuthenticated = isset($_SESSION['line_user_id']) && !empty($_SESSION['line_user_id']);
$hasUserData = isset($_SESSION['user_data']) && !empty($_SESSION['user_data']);

// セッション状態をログに記録
$sessionDebug = [
    'session_id' => session_id(),
    'session_status' => session_status(),
    'session_name' => session_name(),
    'has_line_user_id' => $isLINEAuthenticated,
    'line_user_id_value' => $_SESSION['line_user_id'] ?? 'not_set',
    'has_user_data' => $hasUserData,
    'session_keys' => array_keys($_SESSION),
    'session_data_preview' => array_slice($_SESSION, 0, 5, true)
];

$logger->info('[Index] Session Debug（直接セッション版）', $sessionDebug);

// 直接セッションでのLINE認証チェック
if (!$isLINEAuthenticated) {
    $logger->info('[Auth Check] LINE認証が必要', [
        'reason' => 'LINE認証情報がセッションにない',
        'session_debug' => $sessionDebug
    ]);
    
    // LINE認証へリダイレクト
    header('Location: ' . getRedirectUrl('/reserve/line-auth/'));
    exit;
}

// 簡単なセッション有効性チェック（24時間以内の認証）
$isSessionValid = true;
if (isset($_SESSION['line_auth_time'])) {
    $elapsed = time() - $_SESSION['line_auth_time'];
    $sessionLifetime = 86400; // 24時間
    if ($elapsed > $sessionLifetime) {
        $isSessionValid = false;
        $logger->info('[Auth Check] セッションタイムアウト', [
            'elapsed_time' => $elapsed,
            'lifetime' => $sessionLifetime
        ]);
    }
}

if (!$isSessionValid) {
    $logger->info('[Auth Check] セッション無効', [
        'reason' => 'セッション有効期限切れ',
        'session_debug' => $sessionDebug
    ]);
    
    // セッションを破棄してLINE認証へリダイレクト
    session_destroy();
    header('Location: ' . getRedirectUrl('/reserve/line-auth/'));
    exit;
}

// 直接セッションからユーザー情報を取得
$lineUserId = $_SESSION['line_user_id'];
$displayName = $_SESSION['line_display_name'] ?? 'ゲスト';
$pictureUrl = $_SESSION['line_picture_url'] ?? null;
$userData = $_SESSION['user_data'] ?? null;

$logger->info('[Index] LINE認証成功 - セッション情報詳細', [
    'line_user_id' => $lineUserId,
    'display_name' => $displayName,
    'has_picture_url' => !empty($pictureUrl),
    'has_user_data' => !empty($userData),
    'session_id' => session_id(),
    'session_keys_count' => count($_SESSION),
    'session_all_keys' => array_keys($_SESSION),
    'line_auth_time' => $_SESSION['line_auth_time'] ?? 'not_set',
    'user_data_keys' => is_array($userData) ? array_keys($userData) : 'not_array',
    'has_user_data' => !is_null($userData)
]);

// ユーザーデータがない場合の処理改善
if (!$userData) {
    // 直接セッションで未登録フラグをチェック
    if (isset($_SESSION['user_not_registered']) && $_SESSION['user_not_registered'] === true) {
        // 未登録フラグの有効期限をチェック（24時間）
        $notRegisteredTime = $_SESSION['not_registered_time'] ?? 0;
        $timeSinceNotRegistered = time() - $notRegisteredTime;
        
        if ($timeSinceNotRegistered < 86400) { // 24時間以内
            $logger->info('[Index] 未登録ユーザーとして直接案内ページへ', [
                'line_user_id' => $lineUserId,
                'reason' => 'セッションに未登録フラグあり（24時間以内）',
                'time_since_not_registered' => $timeSinceNotRegistered
            ]);
            header('Location: ' . getRedirectUrl('/reserve/not-registered.php'));
            exit;
        } else {
            // 24時間経過した場合、フラグをクリアしてGAS APIを再チェック
            unset($_SESSION['user_not_registered'], $_SESSION['not_registered_time']);
            $logger->info('[Index] 未登録フラグの有効期限切れ、GAS APIを再チェック', [
                'line_user_id' => $lineUserId,
                'time_since_not_registered' => $timeSinceNotRegistered
            ]);
        }
    }
}

// user_dataがない場合のデバッグ情報
if (!$userData && defined('DEBUG_MODE') && DEBUG_MODE) {
    $logger->debug('[Index] user_data not found in session, will fetch from GAS API', [
        'session_data_keys' => array_keys($_SESSION),
        'session_size' => count($_SESSION)
    ]);
}

// ユーザーデータがセッションにない場合は、LINE認証を再実行
if (!$userData) {
    $logger->info('[Index] ユーザーデータなし、LINE認証をやり直し', [
        'line_user_id' => $lineUserId,
        'reason' => 'セッションにuser_dataが存在しない'
    ]);
    
    // セッションをクリアしてLINE認証からやり直し
    session_destroy();
    header('Location: ' . getRedirectUrl('/reserve/line-auth/'));
    exit;
}

// 以下はuser_dataがある場合の通常処理
$companyPatients = [];
$companyInfo = null;
$userRole = 'sub'; // デフォルトはサブ会員
$errorMessage = '';
$debugInfo = []; // デバッグ情報を初期化
$currentUserVisitorId = null; // ログインユーザーのvisitor_id

// デバッグ: データ取得前の状態
$logger->info('[Index] データ取得開始', [
    'has_user_data' => !empty($userData),
    'line_user_id' => $lineUserId
]);

// GAS APIクライアントを読み込み（user_dataの詳細情報取得用）
require_once __DIR__ . '/line-auth/GasApiClient.php';

// メニューデータを格納する変数
$menuData = null;
$menuError = null;


/**
 * GAS APIを直接呼び出す関数
 * GasApiClientを使わずに直接HTTPリクエストを送信
 */
function callGasApiDirect($path, $deploymentId, $apiKey, $logger = null) {
    $startTime = microtime(true);
    
    // GAS APIのURLを構築（引数を使用）
    $url = "https://script.google.com/macros/s/" . $deploymentId . "/exec";
    $url .= "?path=" . urlencode($path);
    $url .= "&Authorization=" . urlencode("Bearer " . $apiKey);
    
    if ($logger) {
        $logger->info('[Direct GAS API] Request started', [
            'path' => $path,
            'deployment_id' => substr($deploymentId, 0, 20) . '...',
            'api_key_length' => strlen($apiKey)
        ]);
    }
    
    // cURLの設定
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_VERBOSE => false
    ]);
    
    // リクエスト実行
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    $endTime = microtime(true);
    $elapsedTime = round(($endTime - $startTime) * 1000, 2);
    
    if ($logger) {
        $logger->info('[Direct GAS API] Request completed', [
            'http_code' => $httpCode,
            'elapsed_time_ms' => $elapsedTime,
            'response_size' => strlen($response)
        ]);
    }
    
    // エラーチェック
    if ($curlError) {
        if ($logger) {
            $logger->error('[Direct GAS API] cURL error', [
                'error' => $curlError
            ]);
        }
        return [
            'status' => 'error',
            'error' => [
                'code' => 'CURL_ERROR',
                'message' => 'ネットワークエラー: ' . $curlError
            ]
        ];
    }
    
    if ($httpCode !== 200) {
        if ($logger) {
            $logger->error('[Direct GAS API] HTTP error', [
                'http_code' => $httpCode,
                'response' => substr($response, 0, 500)
            ]);
        }
        return [
            'status' => 'error',
            'error' => [
                'code' => 'HTTP_ERROR',
                'message' => "HTTPエラー: {$httpCode}"
            ]
        ];
    }
    
    // JSONパース
    $result = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        if ($logger) {
            $logger->error('[Direct GAS API] JSON parse error', [
                'json_error' => json_last_error_msg(),
                'response_preview' => substr($response, 0, 200)
            ]);
        }
        return [
            'status' => 'error',
            'error' => [
                'code' => 'JSON_ERROR',
                'message' => 'JSONパースエラー: ' . json_last_error_msg()
            ]
        ];
    }
    
    if ($logger && isset($result['status'])) {
        $logger->info('[Direct GAS API] Response parsed', [
            'status' => $result['status'],
            'has_data' => isset($result['data']),
            'has_error' => isset($result['error'])
        ]);
    }
    
    return $result;
}

try {
    // 既存のuser_dataを使用（callback.phpで既に取得済み）
    $logger->info('[Index] セッションからユーザーデータを使用', [
        'line_user_id' => $lineUserId,
        'user_data_keys' => array_keys($userData),
        'has_visitor_id' => isset($userData['visitor_id']) || isset($userData['id'])
    ]);
    

    
    // 直接GAS APIを呼び出し
    $logger->info('[Index] Direct GAS API call for getAllStructuredMenus', [
        'method' => 'direct',
        'debug_mode' => DEBUG_MODE
    ]);
    
    // 定数が定義されているか確認
    if (!defined('GAS_DEPLOYMENT_ID') || !defined('GAS_API_KEY')) {
        $logger->error('[Index] Required GAS API constants not defined');
        throw new Exception('Configuration error: GAS API credentials not found');
    }
    
    // 関数を呼び出し（定数を引数として渡す）
    $menuResult = callGasApiDirect(
        '/api/menus/all-structured',
        GAS_DEPLOYMENT_ID,
        GAS_API_KEY,
        $logger
    );
        
        $logger->info('[Index] Direct GAS API response received', [
            'response_keys' => array_keys($menuResult ?? []),
            'status' => $menuResult['status'] ?? 'missing',
            'has_data' => isset($menuResult['data']),
            'has_error' => isset($menuResult['error']),
            'raw_response_type' => gettype($menuResult)
        ]);
        
        if ($menuResult['status'] === 'success' && isset($menuResult['data'])) {
            $menuData = $menuResult['data'];
            
            // メニュー数をカウント
            $withTicketCount = 0;
            $withoutTicketCount = 0;
            
            if (isset($menuData['withTicket']['categories'])) {
                foreach ($menuData['withTicket']['categories'] as $category) {
                    $withTicketCount += count($category['menus'] ?? []);
                }
            }
            
            if (isset($menuData['withoutTicket']['categories'])) {
                foreach ($menuData['withoutTicket']['categories'] as $category) {
                    $withoutTicketCount += count($category['menus'] ?? []);
                }
            }
            
            $logger->info('[Index] メニューデータ取得成功', [
                'withTicket_count' => $withTicketCount,
                'withoutTicket_count' => $withoutTicketCount,
                'total_count' => $withTicketCount + $withoutTicketCount
            ]);
            
            // セッションにメニューデータを保存（キャッシュとして）
            $_SESSION['menu_data'] = $menuData;
            $_SESSION['menu_data_timestamp'] = time();
            
        } else {
            // エラーの詳細を取得
            $errorDetails = [];
            if (isset($menuResult['error'])) {
                if (is_array($menuResult['error'])) {
                    // エラーコードを確認
                    $errorCode = $menuResult['error']['code'] ?? '';
                    if ($errorCode === 'NOT_FOUND') {
                        // NOT_FOUNDエラーの場合はnullを設定してJavaScript側でフォールバック
                        $menuError = null;
                        $logger->info('[Index] メニューAPI NOT_FOUND - JavaScript側でフォールバック', [
                            'error_code' => $errorCode,
                            'message' => $menuResult['error']['message'] ?? ''
                        ]);
                    } else {
                        $menuError = $menuResult['error']['message'] ?? 'メニューデータの取得に失敗しました';
                        $errorDetails = $menuResult['error'];
                    }
                } else {
                    $menuError = $menuResult['error'];
                    $errorDetails = ['message' => $menuResult['error']];
                }
            } else {
                $menuError = 'メニューデータの取得に失敗しました';
                $errorDetails = ['message' => 'Unknown error', 'result' => $menuResult];
            }
            
            $logger->error('[Index] メニューデータ取得失敗', [
                'menu_error' => $menuError,
                'error_details' => $errorDetails,
                'full_result' => $menuResult,
                'result_type' => gettype($menuResult),
                'result_size' => is_string($menuResult) ? strlen($menuResult) : (is_array($menuResult) ? count($menuResult) : 'unknown')
            ]);
            
            // デバッグ情報にエラー詳細を追加
            $debugInfo['menu_api_error'] = $errorDetails;
            
            // フォールバック: エラー時でも最小限のメニュー構造を提供
            // JavaScriptエラーを防ぐために空の構造を設定
            $menuData = [
                'withTicket' => ['categories' => []],
                'withoutTicket' => ['categories' => []],
                'error' => true,
                'message' => $menuError
            ];
            
            $logger->info('[Index] フォールバックメニュー構造を設定');
        }
    } catch (Exception $e) {
        $menuError = 'メニューデータの取得中にエラーが発生しました: ' . $e->getMessage();
        $logger->error('[Index] メニューデータ取得例外', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'gas_deployment_id' => GAS_DEPLOYMENT_ID ? 'set' : 'not set',
            'gas_api_key' => GAS_API_KEY ? 'set' : 'not set'
        ]);
        
        // デバッグ情報に例外詳細を追加
        $debugInfo['menu_api_exception'] = [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ];
        
        // フォールバック: 例外時でも最小限のメニュー構造を提供
        $menuData = [
            'withTicket' => ['categories' => []],
            'withoutTicket' => ['categories' => []],
            'error' => true,
            'message' => $menuError
        ];
        
        $logger->info('[Index] 例外処理: フォールバックメニュー構造を設定');
    }
    
    // userDataからユーザー情報を取得（callback.phpで取得済み）
    $currentUserVisitorId = $userData['visitor_id'] ?? $userData['id'] ?? null;
    
    $logger->info('[Index] ユーザー基本情報確認', [
        'current_user_visitor_id' => $currentUserVisitorId,
        'user_name' => $userData['visitor_name'] ?? $userData['name'] ?? null,
        'member_type' => $userData['member_type'] ?? 'sub'
    ]);
    
    // JavaScript側でGAS APIを呼び出すため、PHP側では呼び出さない
    // 会社情報とメンバータイプのみ設定（callback.phpで取得済みのuserDataから）
    if ($currentUserVisitorId) {
        // userDataから会社情報を構築（既にcallback.phpで取得済み）
        $companyData = $userData['company'] ?? null;
        
        if (DEBUG_MODE) {
            $logger->debug('[Index] Company data from userData', [
                'company_data' => $companyData,
                'userData_keys' => array_keys($userData)
            ]);
        }
        
        // 会社情報の処理
        if ($companyData && isset($companyData['company_id']) && !empty($companyData['company_id'])) {
            // member_typeの判定（userDataから取得）
            $isMemberType = ($userData['member_type'] ?? false) === true;
            $memberTypeLabel = $isMemberType ? '本会員' : 'サブ会員';
            
            $companyInfo = [
                'id' => $companyData['company_id'],
                'name' => $companyData['name'] ?? '不明',
                'plan' => $companyData['plan'] ?? '',
                'member_type' => $memberTypeLabel,
                'role' => $isMemberType ? 'main' : 'sub'
            ];
            
            // 会社関連のメンバーリストをGAS APIから取得
            try {
                $logger->info('[Index] 会社別来院者を取得開始', [
                    'company_id' => $companyData['company_id'],
                    'user_role' => $companyInfo['role']
                ]);
                
                $companyVisitorsResult = $gasApi->getPatientsByCompany(
                    $companyData['company_id'], 
                    $companyInfo['role']
                );
                
                if ($companyVisitorsResult['status'] === 'success' && isset($companyVisitorsResult['data']['visitors'])) {
                    $companyPatients = $companyVisitorsResult['data']['visitors'];
                    
                    $logger->info('[Index] 会社別来院者取得成功', [
                        'company_id' => $companyData['company_id'],
                        'total_count' => count($companyPatients),
                        'user_role' => $companyInfo['role']
                    ]);
                    
                    if (DEBUG_MODE) {
                        $logger->debug('[Index] 来院者リスト詳細', [
                            'first_5_visitors' => array_slice($companyPatients, 0, 5)
                        ]);
                    }
                } else {
                    $logger->warning('[Index] 会社別来院者取得失敗', [
                        'company_id' => $companyData['company_id'],
                        'result' => $companyVisitorsResult
                    ]);
                    $companyPatients = [];
                }
            } catch (Exception $e) {
                $logger->error('[Index] 会社別来院者取得エラー', [
                    'company_id' => $companyData['company_id'],
                    'error' => $e->getMessage()
                ]);
                $companyPatients = [];
                // エラーメッセージに追加
                if (!$errorMessage) {
                    $errorMessage = '会社メンバーの取得に失敗しました。';
                }
            }
        } else {
            // 会社情報がない場合（個人利用者）
            $companyInfo = null;
        }
    } else {
        // visitor_idがない場合のエラーメッセージ
        $errorMessage = 'ユーザー情報の取得に失敗しました。visitor_idが見つかりません。';
        
        // デバッグ: 失敗詳細
        if (DEBUG_MODE) {
            $logger->debug('[Index] No visitor_id found', [
                'user_data' => $userData,
                'line_user_id' => $lineUserId
            ]);
        }
    } catch (Exception $e) {
    $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
    
    if (DEBUG_MODE) {
        // $debugInfoが未定義の場合に備えて初期化
        if (!isset($debugInfo)) {
            $debugInfo = [];
        }
        $debugInfo['exception'] = [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ];
        $logger->error('[Index] Exception occurred', $debugInfo['exception']);
    }
    
    error_log('Patients loading error: ' . $e->getMessage());
}
?>
<!DOCTYPE html>
<!-- 
    CLUTIREFINEクリニック予約システム - HTML (修正版)
    一括予約画面対応
-->
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CLUTIREFINEクリニック 予約</title>
    <meta name="description" content="CLUTIREFINEクリニックの予約システム">
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="./assets/css/hamburger.css">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        teal: { 50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' }
                    }
                }
            }
        }
    </script>
    <style>
        .profile-image {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }
        .switch {
            position: relative;
            display: inline-block;
        }
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .switch input:checked + .switch-thumb {
            transform: translateX(20px);
            background-color: #0d9488;
        }
        .switch input:checked ~ .switch {
            background-color: #14b8a6;
        }
        .switch-thumb {
            transition: transform 0.2s ease-in-out;
        }
        
        /* 来院者一覧用のトグルボタンスタイル */
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        
        .toggle-checkbox {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: 0.4s;
            border-radius: 24px;
        }
        
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.4s;
            border-radius: 50%;
        }
        
        .toggle-checkbox:checked + .toggle-slider {
            background-color: #14b8a6;
        }
        
        .toggle-checkbox:focus + .toggle-slider {
            box-shadow: 0 0 1px #14b8a6;
        }
        
        .toggle-checkbox:checked + .toggle-slider:before {
            transform: translateX(20px);
        }
        .bulk-patients-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }
        .screen {
            display: none;
        }
        .screen.active {
            display: block;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-semibold">CLUTIREFINEクリニック予約</h1>
            <div class="flex items-center space-x-4">
                <span id="user-welcome" class="text-sm hidden sm:inline">ようこそ、
                    <?php if ($pictureUrl): ?>
                        <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image inline-block mr-1">
                    <?php endif; ?>
                    <span id="user-name"><?php echo htmlspecialchars($displayName); ?></span>様
                </span>
                <?php include_once './assets/inc/navigation.php'; ?>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-slate-50">
        <div class="container mx-auto px-4 sm:px-6">
            <!-- Patient Selection Screen -->
            <div id="patient-selection-screen" class="screen active">
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm max-w-2xl w-full mx-auto">
                    <div class="p-6 text-center">
                        <div class="text-4xl mb-4">👥</div>
                        <h2 class="text-2xl font-bold text-teal-700 mb-2">来院者を選択</h2>
                        <p id="patient-selection-description" class="text-gray-600">今回同時に予約する来院者を選択してください。</p>
                        <?php if ($userRole === 'main'): ?>
                        <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div class="text-xs text-blue-700">
                                <span class="font-medium">💡 本会員権限</span><br>
                                公開・非公開設定はサブ会員に来院者を公開するか非公開にするかを設定できます。
                            </div>
                        </div>
                        <?php endif; ?>
                    </div>
                    <div class="px-6 pb-6 space-y-6">
                        <div class="bg-slate-100 border border-gray-200 rounded-md p-3">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" id="pair-mode-switch" class="sr-only">
                                <div class="switch relative w-11 h-6 bg-gray-200 rounded-full transition-colors">
                                    <div class="switch-thumb absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"></div>
                                </div>
                                <span class="text-base font-medium text-pink-600 flex items-center">
                                    <span class="mr-2">👫</span> 同部屋でのペア予約を希望する
                                </span>
                            </label>
                        </div>

                        <div id="patients-list" class="max-h-80 overflow-y-auto space-y-3 pr-2" data-php-generated="true">
                            <?php 
                            // ローディング表示（JavaScriptがデータを取得するまで）
                            if (empty($companyPatients)): 
                            ?>
                                <div class="text-center py-8 text-gray-500" id="loading-company-visitors">
                                    <div class="text-4xl mb-4">⏳</div>
                                    <p>会社別来院者データを取得しています。</p>
                                    <p class="text-sm mt-2">しばらくお待ちください...</p>
                                </div>
                            <?php else: ?>
                                <?php 
                                // PHPで患者リストを生成
                                foreach ($companyPatients as $patient): 
                                    // ダミーデータをスキップ
                                    if (strpos($patient['visitor_name'] ?? $patient['name'] ?? '', '既存') !== false ||
                                        strpos($patient['visitor_name'] ?? $patient['name'] ?? '', 'ダミー') !== false ||
                                        strpos($patient['visitor_name'] ?? $patient['name'] ?? '', 'テスト') !== false) {
                                        continue;
                                    }
                                    
                                    // サブ会員の場合、非公開の患者をスキップ
                                    if ($userRole === 'sub' && isset($patient['is_public']) && $patient['is_public'] === false) {
                                        continue;
                                    }
                                    
                                    $patientId = $patient['visitor_id'] ?? $patient['id'] ?? '';
                                    $patientName = $patient['visitor_name'] ?? $patient['name'] ?? '不明';
                                    $patientKana = $patient['kana'] ?? '';
                                    $memberType = $patient['member_type'] ?? '';
                                    $isPublic = $patient['is_public'] ?? true;
                                    $lastVisit = $patient['last_visit'] ?? null;
                                    $isNew = $patient['is_new'] ?? false;
                                    
                                    // 現在のユーザーかどうか判定
                                    $isCurrentUser = ($patientId === $currentUserVisitorId);
                                ?>
                                <div class="patient-item flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-all border-gray-200 hover:bg-slate-50" 
                                     data-patient-id="<?php echo htmlspecialchars($patientId); ?>">
                                    <input type="checkbox" class="patient-checkbox" data-patient-id="<?php echo htmlspecialchars($patientId); ?>">
                                    <div class="flex-1 cursor-pointer">
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <span class="font-medium"><?php echo htmlspecialchars($patientName); ?></span>
                                                <?php if ($patientKana): ?>
                                                    <span class="text-xs text-gray-500 ml-1">(<?php echo htmlspecialchars($patientKana); ?>)</span>
                                                <?php endif; ?>
                                                <?php if ($lastVisit): ?>
                                                    <span class="text-xs text-gray-500 ml-2">(最終来院: <?php echo htmlspecialchars($lastVisit); ?>)</span>
                                                <?php endif; ?>
                                                <?php if ($isNew): ?>
                                                    <span class="text-xs text-green-600 ml-2">(新規)</span>
                                                <?php endif; ?>
                                                <?php if ($userRole === 'main' && !$isPublic): ?>
                                                    <span class="text-xs text-red-600 ml-2">(非公開)</span>
                                                <?php endif; ?>
                                                <?php if ($memberType === 'sub'): ?>
                                                    <span class="text-xs text-blue-600 ml-2">(サブ会員)</span>
                                                <?php elseif ($memberType === 'main' || $memberType === '本会員'): ?>
                                                    <span class="text-xs text-green-600 ml-2">(本会員)</span>
                                                <?php endif; ?>
                                                <?php if ($isCurrentUser): ?>
                                                    <span class="text-xs text-teal-600 ml-2">(ご本人)</span>
                                                <?php endif; ?>
                                            </div>
                                            
                                            <?php 
                                            // トグルボタンの表示条件
                                            // 1. 現在のユーザーが本会員
                                            // 2. 対象がサブ会員
                                            // 3. 現在のユーザー自身ではない
                                            $shouldShowToggle = $userRole === 'main' && 
                                                               ($memberType === 'sub' || $memberType === 'サブ会員') && 
                                                               !$isCurrentUser;
                                            
                                            if ($shouldShowToggle): 
                                            ?>
                                            <div class="ml-2 flex items-center">
                                                <span class="text-xs text-gray-500 mr-1">公開:</span>
                                                <div class="relative">
                                                    <label class="toggle-switch" for="toggle-<?php echo htmlspecialchars($patientId); ?>">
                                                        <input type="checkbox" 
                                                               id="toggle-<?php echo htmlspecialchars($patientId); ?>" 
                                                               class="toggle-checkbox" 
                                                               <?php echo $isPublic ? 'checked' : ''; ?>
                                                               data-visitor-id="<?php echo htmlspecialchars($patientId); ?>"
                                                               data-patient-name="<?php echo htmlspecialchars($patientName); ?>">
                                                        <span class="toggle-slider"></span>
                                                    </label>
                                                    <span id="loading-<?php echo htmlspecialchars($patientId); ?>" 
                                                          class="hidden text-xs text-blue-600 ml-2 flex items-center">
                                                        <svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        処理中...
                                                    </span>
                                                </div>
                                            </div>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>

                        <button id="add-patient-btn" class="w-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md flex items-center justify-center">
                            <span class="mr-2">➕</span> 新しい来院者を追加
                        </button>

                        <button id="proceed-patients-btn" class="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 px-4 rounded-md font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            <span id="proceed-text">選択した0名の予約へ進む</span>
                            <span class="ml-2">➡️</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Menu Calendar Screen (Single Patient) -->
            <div id="menu-calendar-screen" class="screen">
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm max-w-4xl w-full mx-auto">
                    <div class="p-6 text-center">
                        <div class="text-4xl mb-4">📅</div>
                        <h2 class="text-2xl font-bold text-teal-700 mb-2">メニュー選択 &amp; 日時指定</h2>
                        <p id="menu-calendar-description" class="text-gray-600"></p>
                    </div>
                    <div class="px-6 pb-6 space-y-6">
                        <?php if ($menuError): ?>
                        <!-- メニュー取得エラー表示 -->
                        <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                            <div class="flex">
                                <div class="flex-shrink-0">
                                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm text-red-700">
                                        メニューデータの取得に失敗しました: <?php echo htmlspecialchars($menuError); ?>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>
                        
                        <section class="space-y-4">
                            <h3 class="text-lg font-semibold text-gray-700">1. 施術メニューを選択</h3>
                            <div id="treatment-categories" class="border border-gray-200 rounded-lg overflow-hidden"></div>
                        </section>

                        <!-- 選択メニュー表示エリア -->
                        <div id="selected-menus-display" class="hidden"></div>

                        <div id="interval-error" class="hidden bg-red-50 border-l-4 border-red-500 p-4 rounded">
                            <h4 class="text-sm font-semibold text-red-800">エラー</h4>
                            <p id="interval-error-text" class="text-xs text-red-600"></p>
                        </div>

                        <section id="date-time-selection" class="space-y-4 hidden">
                            <h3 class="text-lg font-semibold text-gray-700">2. ご希望日時を選択</h3>
                            
                            <!-- カレンダーローディングメッセージ -->
                            <div id="calendar-loading-message" class="hidden"></div>
                            
                            <div id="slot-availability-message" class="hidden bg-teal-50 border-l-4 border-teal-500 p-4 rounded">
                                <h4 id="slot-availability-title" class="text-sm font-semibold text-teal-800">予約可能な時間</h4>
                                <p id="slot-availability-text" class="text-xs text-teal-600"></p>
                            </div>

                            <div class="flex flex-col md:flex-row gap-6">
                                <div class="flex-shrink-0">
                                    <div id="calendar" class="border border-gray-200 rounded-lg bg-white p-4 shadow-sm"></div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-gray-500 mb-4">カレンダーから日付を選択してください。</p>
                                    <div id="time-slots" class="hidden grid grid-cols-3 sm:grid-cols-4 gap-2"></div>
                                </div>
                            </div>
                        </section>

                        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
                            <button id="back-to-patients-btn" class="w-full sm:w-auto border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md flex items-center">
                                <span class="mr-2">⬅️</span> <span id="back-button-text">来院者選択へ戻る</span>
                            </button>
                            <button id="next-menu-calendar-btn" class="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                <span id="next-button-text">予約内容の確認へ</span>
                                <span class="ml-2">➡️</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pair/Bulk Booking Screen -->
            <div id="pair-booking-screen" class="screen">
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm max-w-6xl w-full mx-auto">
                    <div class="p-6 text-center">
                        <div class="text-4xl mb-4">👫</div>
                        <h2 class="text-2xl font-bold text-teal-700 mb-2" id="pair-booking-title">ペア予約: メニュー &amp; 日時指定</h2>
                        <p id="pair-booking-description" class="text-gray-600"></p>
                    </div>
                    <div class="px-6 pb-6 space-y-6">
                        <div class="grid md:grid-cols-2 gap-4">
                            <div class="border border-gray-200 rounded-lg bg-white p-4">
                                <h4 id="patient1-menu-title" class="text-lg font-semibold text-teal-600 mb-3 flex items-center"></h4>
                                <div id="patient1-treatments" class="border border-gray-200 rounded-lg overflow-hidden"></div>
                                <div id="patient1-interval-error" class="hidden mt-2 bg-red-50 border-l-4 border-red-500 p-2 rounded">
                                    <h5 class="text-xs font-semibold text-red-800">施術間隔エラー</h5>
                                    <p id="patient1-interval-text" class="text-xs text-red-600"></p>
                                </div>
                            </div>
                            <div class="border border-gray-200 rounded-lg bg-white p-4">
                                <h4 id="patient2-menu-title" class="text-lg font-semibold text-teal-600 mb-3 flex items-center"></h4>
                                <div id="patient2-treatments" class="border border-gray-200 rounded-lg overflow-hidden"></div>
                                <div id="patient2-interval-error" class="hidden mt-2 bg-red-50 border-l-4 border-red-500 p-2 rounded">
                                    <h5 class="text-xs font-semibold text-red-800">施術間隔エラー</h5>
                                    <p id="patient2-interval-text" class="text-xs text-red-600"></p>
                                </div>
                            </div>
                        </div>

                        <section id="pair-date-time-selection" class="space-y-4 hidden border border-gray-200 rounded-lg bg-white p-4">
                            <h3 class="text-lg font-semibold text-gray-700 flex items-center">
                                <span class="mr-2">📅</span> 共通のご希望日時
                            </h3>
                            
                            <div id="pair-slot-availability-message" class="hidden bg-teal-50 border-l-4 border-teal-500 p-4 rounded">
                                <h4 id="pair-slot-availability-title" class="text-sm font-semibold text-teal-800">ペア予約可能な時間</h4>
                                <p id="pair-slot-availability-text" class="text-xs text-teal-600"></p>
                            </div>

                            <div class="flex flex-col md:flex-row gap-6">
                                <div class="flex-shrink-0">
                                    <div id="pair-calendar" class="border border-gray-200 rounded-lg bg-white p-4 shadow-sm"></div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-gray-500 mb-4">カレンダーから日付を選択してください。</p>
                                    <div id="pair-time-slots" class="hidden grid grid-cols-3 sm:grid-cols-4 gap-2"></div>
                                </div>
                            </div>
                        </section>

                        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
                            <button id="back-to-patients-from-pair-btn" class="w-full sm:w-auto border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md flex items-center">
                                <span class="mr-2">⬅️</span> 来院者選択へ戻る
                            </button>
                            <button id="next-pair-booking-btn" class="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                ペア予約内容の確認へ
                                <span class="ml-2">➡️</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bulk Booking Screen -->
            <div id="bulk-booking-screen" class="screen">
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm max-w-6xl w-full mx-auto">
                    <div class="p-6 text-center">
                        <div class="text-4xl mb-4">👥</div>
                        <h2 class="text-2xl font-bold text-teal-700 mb-2">一括予約: メニュー & 日時指定</h2>
                        <p id="bulk-booking-description" class="text-gray-600"></p>
                    </div>
                    <div class="px-6 pb-6 space-y-6">
                        <div id="bulk-patients-grid" class="bulk-patients-grid gap-4"></div>

                        <section id="bulk-date-time-selection" class="space-y-4 hidden border border-gray-200 rounded-lg bg-white p-4">
                            <h3 class="text-lg font-semibold text-gray-700 flex items-center">
                                <span class="mr-2">📅</span> 共通のご希望日時
                            </h3>
                            
                            <div id="bulk-slot-availability-message" class="hidden bg-teal-50 border-l-4 border-teal-500 p-4 rounded">
                                <h4 id="bulk-slot-availability-title" class="text-sm font-semibold text-teal-800">予約可能な時間</h4>
                                <p id="bulk-slot-availability-text" class="text-xs text-teal-600"></p>
                            </div>

                            <div class="flex flex-col md:flex-row gap-6">
                                <div class="flex-shrink-0">
                                    <div id="bulk-calendar" class="border border-gray-200 rounded-lg bg-white p-4 shadow-sm"></div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-gray-500 mb-4">カレンダーから日付を選択してください。</p>
                                    <div id="bulk-time-slots" class="hidden grid grid-cols-3 sm:grid-cols-4 gap-2"></div>
                                </div>
                            </div>
                        </section>

                        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
                            <button id="back-to-patients-from-bulk-btn" class="w-full sm:w-auto border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md flex items-center">
                                <span class="mr-2">⬅️</span> 来院者選択へ戻る
                            </button>
                            <button id="next-bulk-booking-btn" class="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                一括予約内容の確認へ
                                <span class="ml-2">➡️</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <?php include_once './assets/inc/footer.php'; ?>

    <!-- Modals -->
    <div id="add-patient-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden items-center justify-center">
        <div class="bg-white rounded-lg max-w-md w-90 mx-4 max-h-90vh overflow-y-auto shadow-xl">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-lg font-semibold">新しい来院者情報を入力</h3>
                <button class="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center" id="modal-close-btn">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <!-- 氏名（姓・名） -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        氏名 <span class="text-red-500">*</span>
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <input type="text" id="new-patient-last-name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="姓" maxlength="15" required>
                        </div>
                        <div>
                            <input type="text" id="new-patient-first-name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="名" maxlength="15" required>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">姓と名を別々に入力してください。</p>
                </div>
                
                <!-- カナ（セイ・メイ） -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        カナ <span class="text-red-500">*</span>
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <input type="text" id="new-patient-last-name-kana" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="セイ" maxlength="30" required>
                        </div>
                        <div>
                            <input type="text" id="new-patient-first-name-kana" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="メイ" maxlength="30" required>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">全角カタカナで入力してください。</p>
                </div>
                
                <!-- 性別 -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        性別 <span class="text-red-500">*</span>
                    </label>
                    <div class="flex space-x-4">
                        <label class="flex items-center">
                            <input type="radio" name="gender" value="MALE" class="mr-2 text-teal-600 focus:ring-teal-500" required>
                            <span class="text-sm text-gray-700">男性</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="gender" value="FEMALE" class="mr-2 text-teal-600 focus:ring-teal-500" required>
                            <span class="text-sm text-gray-700">女性</span>
                        </label>
                    </div>
                </div>
                
                <!-- 生年月日 -->
                <div>
                    <label for="new-patient-birthday" class="block text-sm font-medium text-gray-700 mb-1">
                        生年月日 <span class="text-gray-400">(任意)</span>
                    </label>
                    <input type="date" id="new-patient-birthday" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                </div>
                
                <!-- エラーメッセージ表示エリア -->
                <div id="patient-modal-error" class="hidden bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                        </svg>
                        <span id="patient-modal-error-text"></span>
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-gray-200 flex gap-3 justify-end">
                <button id="cancel-add-patient-btn" class="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md">キャンセル</button>
                <button id="confirm-add-patient-btn" class="bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md flex items-center">
                    <span id="confirm-btn-text">追加して選択</span>
                    <div id="confirm-btn-spinner" class="hidden ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </button>
            </div>
        </div>
    </div>

    <!-- 共通モーダル -->
    <div id="common-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div id="modal-content">
                <!-- モーダルコンテンツはJavaScriptで動的に挿入 -->
            </div>
        </div>
    </div>

    <!-- 予約確認モーダル -->
    <div id="reservation-confirm-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-10 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-gray-900">予約内容の確認</h3>
                    <button id="close-confirm-modal" class="text-gray-400 hover:text-gray-600">
                        <span class="sr-only">閉じる</span>
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <!-- 予約サマリー表示エリア -->
                <div id="reservation-summary" class="space-y-4 mb-6">
                    <!-- JavaScriptで動的に生成 -->
                </div>
                
                <!-- 確認メッセージ -->
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-yellow-700">
                                上記の内容で予約を確定してもよろしいですか？<br>
                                確定後のキャンセル・変更については、直接クリニックまでお電話ください。
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- ボタン -->
                <div class="flex flex-col sm:flex-row justify-end gap-3">
                    <button id="cancel-reservation-btn" class="w-full sm:w-auto border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-md">
                        戻る
                    </button>
                    <button id="confirm-reservation-btn" class="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md font-medium flex items-center justify-center">
                        <span id="confirm-btn-text">予約を確定する</span>
                        <div id="confirm-btn-spinner" class="hidden ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- スピナー -->
    <div id="loading-spinner" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    </div>

    <!-- アプリ設定 -->
    <script>
        // PHPから渡されたユーザー情報をJavaScriptで利用可能にする
        window.APP_CONFIG = {
            lineUserId: '<?php echo htmlspecialchars($lineUserId); ?>',
            displayName: '<?php echo htmlspecialchars($displayName); ?>',
            pictureUrl: <?php echo $pictureUrl ? "'" . htmlspecialchars($pictureUrl) . "'" : 'null'; ?>,
            userData: <?php echo $userData ? json_encode($userData) : 'null'; ?>,
            isAuthenticated: true,
            currentUserVisitorId: <?php echo $currentUserVisitorId ? "'" . htmlspecialchars($currentUserVisitorId) . "'" : 'null'; ?>,
            apiEndpoint: '/reserve/api-bridge.php',
            // 権限管理とPHPから取得した来院者データ
            companyInfo: <?php echo $companyInfo ? json_encode($companyInfo) : 'null'; ?>,
            userRole: '<?php echo htmlspecialchars($userRole); ?>',
            companyPatients: <?php echo json_encode($companyPatients ?? [], JSON_HEX_QUOT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS); ?>,
            companyPatientsCount: <?php echo count($companyPatients); ?>,
            isCompanyPatientsEmpty: <?php echo empty($companyPatients) ? 'true' : 'false'; ?>,
            errorMessage: '<?php echo htmlspecialchars($errorMessage); ?>',
            // デバッグ情報
            debugMode: <?php echo DEBUG_MODE ? 'true' : 'false'; ?>,
            debugInfo: <?php echo json_encode($debugInfo ?? []); ?>
        };
        
        // DEBUG_MODEをPHPから取得してwindowオブジェクトに設定
        window.DEBUG_MODE = <?php echo (defined('DEBUG_MODE') && DEBUG_MODE) ? 'true' : 'false'; ?>;
        
        // DEBUG_MODEの状態をコンソールに出力
        if (window.DEBUG_MODE) {
            console.log('[DEBUG] DEBUG_MODE is enabled (from PHP environment)');
            console.log('[DEBUG] PHP DEBUG_MODE value:', <?php echo defined('DEBUG_MODE') ? (DEBUG_MODE ? 'true' : 'false') : 'undefined'; ?>);
        }
    </script>

    <!-- JavaScriptモジュール -->
    <script type="module" src="./js/core/polyfills.js?v=20250128"></script>
    <script type="module" src="./js/core/storage-manager.js?v=20250128"></script>
    <script type="module" src="./js/core/app-state.js?v=20250128"></script>
    <script type="module" src="./js/core/ui-helpers.js?v=20250128"></script>
    <script type="module" src="./js/data/treatment-data.js?v=20250128"></script>
    <script type="module" src="./js/data/mock-api.js?v=20250128"></script>
    <script type="module" src="./js/data/gas-api.js?v=20250128"></script>
    <script type="module" src="./js/components/calendar.js?v=20250128"></script>
    <script type="module" src="./js/components/treatment-accordion.js?v=20250128"></script>
    <script type="module" src="./js/components/modal.js?v=20250128"></script>
    <script type="module" src="./js/components/reservation-confirm.js?v=20250128"></script>
    <script type="module" src="./js/screens/patient-selection.js?v=20250128"></script>
    <script type="module" src="./js/screens/menu-calendar.js?v=20250128"></script>
    <script type="module" src="./js/screens/pair-booking.js?v=20250128"></script>
    <script type="module" src="./js/screens/bulk-booking.js?v=20250128"></script>
    
    <!-- デバッグ情報表示スクリプト -->
    <script>
        // デバッグモードの場合のみデバッグ情報を表示
        if (window.APP_CONFIG && window.APP_CONFIG.debugMode) {
            document.addEventListener('DOMContentLoaded', function() {
                showDebugInfo();
            });
        }
        
        function showDebugInfo() {
            // デバッグ情報パネルを作成
            const debugPanel = document.createElement('div');
            debugPanel.id = 'debug-panel';
            debugPanel.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 400px;
                max-height: 80vh;
                background: #000;
                color: #00ff00;
                font-family: monospace;
                font-size: 12px;
                padding: 10px;
                border: 2px solid #00ff00;
                border-radius: 5px;
                z-index: 9999;
                overflow-y: auto;
                white-space: pre-wrap;
                word-break: break-all;
            `;
            
            // デバッグ情報を整形
            let debugText = 'DEBUG INFO:\n';
            debugText += '='.repeat(40) + '\n';
            debugText += 'ERROR: ' + (window.APP_CONFIG.errorMessage || 'なし') + '\n\n';
            
            if (window.APP_CONFIG.debugInfo) {
                for (const [key, value] of Object.entries(window.APP_CONFIG.debugInfo)) {
                    debugText += key.toUpperCase() + ':\n';
                    debugText += JSON.stringify(value, null, 2) + '\n\n';
                }
            }
            
            // 閉じるボタン
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: #ff0000;
                color: white;
                border: none;
                width: 20px;
                height: 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
            `;
            closeBtn.onclick = () => debugPanel.remove();
            
            debugPanel.textContent = debugText;
            debugPanel.appendChild(closeBtn);
            document.body.appendChild(debugPanel);
            
            // コンソールにも出力
            console.group('🐛 Debug Information');
            console.log('Error Message:', window.APP_CONFIG.errorMessage);
            console.log('Debug Info:', window.APP_CONFIG.debugInfo);
            console.groupEnd();
        }
        
        // グローバル関数として追加（コンソールから呼び出し可能）
        window.showDebug = showDebugInfo;
        window.hideDebug = () => {
            const panel = document.getElementById('debug-panel');
            if (panel) panel.remove();
        };
        
        // API デバッグテスト関数
        window.testGasApi = async () => {
            console.log('🔍 Testing GAS API...');
            try {
                const response = await fetch('/reserve/api-bridge.php?action=debugGasApi');
                const result = await response.json();
                console.log('GAS API Test Result:', result);
                
                // 修正後の動作確認メッセージ
                if (result.gas_api_test && result.gas_api_test.status === 'success') {
                    console.log('✅ GAS API is working correctly after the fix!');
                } else {
                    console.log('❌ GAS API still has issues. Check the response details.');
                }
                
                return result;
            } catch (error) {
                console.error('GAS API Test Failed:', error);
                return { error: error.message };
            }
        };
        
        // 修正確認テスト
        window.testFix = async () => {
            console.group('🔧 Testing Fix for GAS API Response Format Issue');
            try {
                // 1. セッション確認
                console.log('1. Testing session...');
                const sessionResult = await window.testSession();
                console.log('Session test result:', sessionResult.session_data ? '✅ OK' : '❌ Failed');
                
                // 2. GAS API確認
                console.log('2. Testing GAS API...');
                const gasResult = await window.testGasApi();
                const hasVisitor = gasResult.gas_api_test?.visitor_data ? '✅ Has visitor data' : '❌ No visitor data';
                const hasCompany = gasResult.gas_api_test?.company_data ? '✅ Has company data' : '❌ No company data';
                console.log(`   Visitor data: ${hasVisitor}`);
                console.log(`   Company data: ${hasCompany}`);
                
                // 3. 変換処理の確認
                if (gasResult.gas_api_test?.status === 'success') {
                    console.log('3. ✅ GAS API response conversion is working!');
                } else {
                    console.log('3. ❌ GAS API response conversion failed.');
                }
                
                // 4. ページリロードの推奨
                if (gasResult.gas_api_test?.status === 'success') {
                    console.log('🎉 Fix appears to be working! Try refreshing the page to see the result.');
                }
                
            } catch (error) {
                console.error('Fix test failed:', error);
            }
            console.groupEnd();
        };
        
        window.testSession = async () => {
            console.log('🔍 Testing Session...');
            try {
                const response = await fetch('/reserve/api-bridge.php?action=debugSession');
                const result = await response.json();
                console.log('Session Test Result:', result);
                return result;
            } catch (error) {
                console.error('Session Test Failed:', error);
                return { error: error.message };
            }
        };
        
        window.testMedicalForceApi = async () => {
            console.log('🔍 Testing Medical Force API...');
            try {
                const response = await fetch('/reserve/api-bridge.php?action=testMedicalForceConnection');
                const result = await response.json();
                console.log('Medical Force API Test Result:', result);
                return result;
            } catch (error) {
                console.error('Medical Force API Test Failed:', error);
                return { error: error.message };
            }
        };
        
        window.runAllTests = async () => {
            console.group('🔬 Running All Debug Tests');
            const results = {
                session: await window.testSession(),
                gasApi: await window.testGasApi(),
                medicalForceApi: await window.testMedicalForceApi()
            };
            console.log('All Test Results:', results);
            console.groupEnd();
            return results;
        };
        
        // 強化されたデバッグパネル機能
        function createAdvancedDebugPanel() {
            // 既存のパネルを削除
            const existing = document.getElementById('advanced-debug-panel');
            if (existing) existing.remove();
            
            // メインパネル作成
            const panel = document.createElement('div');
            panel.id = 'advanced-debug-panel';
            panel.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 350px;
                background: linear-gradient(145deg, #2d3748, #1a202c);
                color: white;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                z-index: 10000;
                font-family: 'Segoe UI', system-ui, sans-serif;
                border: 1px solid #4a5568;
                overflow: hidden;
            `;
            
            panel.innerHTML = `
                <div id="debug-header" style="
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    padding: 12px;
                    cursor: move;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">🔧</span>
                        <span style="font-weight: 600; font-size: 14px;">高度デバッグパネル</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button id="debug-minimize" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: white;
                            width: 20px;
                            height: 20px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 12px;
                        ">_</button>
                        <button id="debug-close" style="
                            background: rgba(255,0,0,0.8);
                            border: none;
                            color: white;
                            width: 20px;
                            height: 20px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 12px;
                        ">×</button>
                    </div>
                </div>
                
                <div id="debug-content" style="padding: 15px; max-height: 400px; overflow-y: auto;">
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🎛️ 操作</h4>
                        <div style="display: grid; gap: 8px;">
                            <button id="logout-btn" style="
                                background: linear-gradient(135deg, #e53e3e, #c53030);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                transition: all 0.2s;
                            ">🚪 ログアウト</button>
                            <button id="clear-cache-btn" style="
                                background: linear-gradient(135deg, #3182ce, #2c5282);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                transition: all 0.2s;
                            ">🗑️ キャッシュクリア</button>
                            <button id="refresh-hard-btn" style="
                                background: linear-gradient(135deg, #38a169, #2f855a);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                transition: all 0.2s;
                            ">🔄 強制更新</button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🔍 DOM Inspector</h4>
                        <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                            <input id="element-search" placeholder="Enter ID or class name" style="
                                flex: 1;
                                padding: 6px;
                                border: 1px solid #4a5568;
                                border-radius: 4px;
                                background: #2d3748;
                                color: white;
                                font-size: 11px;
                            ">
                            <button id="search-element-btn" style="
                                background: #805ad5;
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">🔍</button>
                        </div>
                        <div id="element-results" style="
                            background: #1a202c;
                            padding: 8px;
                            border-radius: 4px;
                            font-family: monospace;
                            font-size: 10px;
                            max-height: 120px;
                            overflow-y: auto;
                            border: 1px solid #2d3748;
                        ">DOM要素を検索してください</div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">📊 System Status</h4>
                        <div id="system-status" style="
                            background: #1a202c;
                            padding: 8px;
                            border-radius: 4px;
                            font-family: monospace;
                            font-size: 10px;
                            border: 1px solid #2d3748;
                        ">読み込み中...</div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🧪 APIテスト</h4>
                        <div style="display: grid; gap: 5px;">
                            <button id="test-gas-api-btn" style="
                                background: linear-gradient(135deg, #ed8936, #dd6b20);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">GAS APIテスト</button>
                            <button id="test-medical-force-btn" style="
                                background: linear-gradient(135deg, #9f7aea, #805ad5);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">メディカルフォーステスト</button>
                            <button id="test-session-btn" style="
                                background: linear-gradient(135deg, #48bb78, #38a169);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">セッションテスト</button>
                            <button id="analyze-patient-form-btn" style="
                                background: linear-gradient(135deg, #f56565, #e53e3e);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">患者フォーム解析</button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">📡 API監視</h4>
                        <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                            <button id="start-monitoring-btn" style="
                                background: linear-gradient(135deg, #48bb78, #38a169);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                                flex: 1;
                            ">▶️ 監視開始</button>
                            <button id="stop-monitoring-btn" style="
                                background: linear-gradient(135deg, #f56565, #e53e3e);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                                flex: 1;
                                display: none;
                            ">⏹️ 監視停止</button>
                            <button id="clear-api-log-btn" style="
                                background: linear-gradient(135deg, #805ad5, #6b46c1);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">🗑️</button>
                        </div>
                        <div id="api-monitoring-status" style="
                            background: #1a202c;
                            padding: 6px;
                            border-radius: 4px;
                            font-size: 10px;
                            margin-bottom: 8px;
                            color: #a0aec0;
                            border: 1px solid #2d3748;
                        ">監視停止中</div>
                        <div id="api-log-display" style="
                            background: #1a202c;
                            padding: 8px;
                            border-radius: 4px;
                            font-family: monospace;
                            font-size: 10px;
                            max-height: 120px;
                            overflow-y: auto;
                            border: 1px solid #2d3748;
                            color: #e2e8f0;
                        ">APIコールがここに表示されます...</div>
                        <div id="api-statistics" style="
                            background: #2d3748;
                            padding: 6px;
                            border-radius: 4px;
                            font-size: 10px;
                            margin-top: 6px;
                            color: #a0aec0;
                            border: 1px solid #4a5568;
                        ">統計: 成功 0, エラー 0, 平均応答時間 0ms</div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🔧 クイックアクション</h4>
                        <div style="display: grid; gap: 5px;">
                            <button id="find-all-forms-btn" style="
                                background: linear-gradient(135deg, #2b6cb0, #2c5282);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">全フォーム検索</button>
                            <button id="find-all-inputs-btn" style="
                                background: linear-gradient(135deg, #38a169, #2f855a);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">全入力要素検索</button>
                            <button id="find-newpatient-elements-btn" style="
                                background: linear-gradient(135deg, #d69e2e, #b7791f);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">患者フォーム要素検索</button>
                        </div>
                    </div>
                    
                    <div id="test-results" style="
                        background: #1a202c;
                        padding: 8px;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 10px;
                        max-height: 150px;
                        overflow-y: auto;
                        border: 1px solid #2d3748;
                        margin-top: 10px;
                    ">テスト結果がここに表示されます</div>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // パネルをドラッグ可能にする
            makeDraggable(panel);
            
            // イベントリスナーを設定
            setupDebugPanelEvents(panel);
            
            // システム状態を初期化
            updateSystemStatus();
            
            return panel;
        }
        
        // ドラッグ機能
        function makeDraggable(element) {
            const header = element.querySelector('#debug-header');
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            
            header.onmousedown = dragMouseDown;
            
            function dragMouseDown(e) {
                e = e || window.event;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }
            
            function elementDrag(e) {
                e = e || window.event;
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.left = (element.offsetLeft - pos1) + "px";
            }
            
            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }
        
        // デバッグパネルのイベント設定
        function setupDebugPanelEvents(panel) {
            // 閉じるボタン
            panel.querySelector('#debug-close').onclick = () => panel.remove();
            
            // 最小化ボタン
            panel.querySelector('#debug-minimize').onclick = () => {
                const content = panel.querySelector('#debug-content');
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            };
            
            // ログアウトボタン
            panel.querySelector('#logout-btn').onclick = async () => {
                if (confirm('本当にログアウトしますか？')) {
                    try {
                        await fetch('/reserve/logout.php', { method: 'POST' });
                        window.location.href = '/reserve/line-auth/';
                    } catch (error) {
                        alert('ログアウトに失敗しました: ' + error.message);
                    }
                }
            };
            
            // キャッシュクリアボタン
            panel.querySelector('#clear-cache-btn').onclick = () => {
                localStorage.clear();
                sessionStorage.clear();
                
                // Service Worker があれば削除
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(registration => registration.unregister());
                    });
                }
                
                alert('キャッシュをクリアしました');
                updateSystemStatus();
            };
            
            // ハードリフレッシュボタン
            panel.querySelector('#refresh-hard-btn').onclick = () => {
                window.location.reload(true);
            };
            
            // DOM検索
            panel.querySelector('#search-element-btn').onclick = () => searchElement();
            panel.querySelector('#element-search').onkeypress = (e) => {
                if (e.key === 'Enter') searchElement();
            };
            
            // APIテストボタン
            panel.querySelector('#test-gas-api-btn').onclick = () => testGasApiDebug();
            panel.querySelector('#test-medical-force-btn').onclick = () => testMedicalForceDebug();
            panel.querySelector('#test-session-btn').onclick = () => testSessionDebug();
            panel.querySelector('#analyze-patient-form-btn').onclick = () => analyzePatientForm();
            
            // APIモニタリングボタン
            panel.querySelector('#start-monitoring-btn').onclick = () => startAPIMonitoring();
            panel.querySelector('#stop-monitoring-btn').onclick = () => stopAPIMonitoring();
            panel.querySelector('#clear-api-log-btn').onclick = () => clearAPILog();
            
            // クイックアクションボタン
            panel.querySelector('#find-all-forms-btn').onclick = () => findAllForms();
            panel.querySelector('#find-all-inputs-btn').onclick = () => findAllInputs();
            panel.querySelector('#find-newpatient-elements-btn').onclick = () => findNewPatientElements();
        }
        
        // DOM検索機能
        function searchElement() {
            const searchTerm = document.getElementById('element-search').value.trim();
            const resultsDiv = document.getElementById('element-results');
            
            if (!searchTerm) {
                resultsDiv.textContent = '検索語を入力してください';
                return;
            }
            
            let results = [];
            
            // IDで検索
            if (searchTerm.startsWith('#')) {
                const element = document.getElementById(searchTerm.substring(1));
                if (element) {
                    results.push(`✅ ID: ${searchTerm} - Found`);
                    results.push(`   Tag: ${element.tagName.toLowerCase()}`);
                    results.push(`   Class: ${element.className || 'none'}`);
                } else {
                    results.push(`❌ ID: ${searchTerm} - Not found`);
                }
            } 
            // クラスで検索
            else if (searchTerm.startsWith('.')) {
                const elements = document.getElementsByClassName(searchTerm.substring(1));
                if (elements.length > 0) {
                    results.push(`✅ Class: ${searchTerm} - Found ${elements.length} elements`);
                    for (let i = 0; i < Math.min(elements.length, 5); i++) {
                        const el = elements[i];
                        results.push(`   [${i+1}] ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`);
                    }
                    if (elements.length > 5) {
                        results.push(`   ... and ${elements.length - 5} more`);
                    }
                } else {
                    results.push(`❌ Class: ${searchTerm} - Not found`);
                }
            }
            // IDとして検索（#なし）
            else {
                const element = document.getElementById(searchTerm);
                if (element) {
                    results.push(`✅ ID: #${searchTerm} - Found`);
                    results.push(`   Tag: ${element.tagName.toLowerCase()}`);
                    results.push(`   Class: ${element.className || 'none'}`);
                    if (element.type) results.push(`   Type: ${element.type}`);
                    if (element.value) results.push(`   Value: ${element.value}`);
                } else {
                    // クラスとしても検索
                    const elements = document.getElementsByClassName(searchTerm);
                    if (elements.length > 0) {
                        results.push(`✅ Class: .${searchTerm} - Found ${elements.length} elements`);
                    } else {
                        results.push(`❌ "${searchTerm}" - Not found as ID or class`);
                        
                        // 類似のIDを検索
                        const allElements = document.querySelectorAll('[id*="' + searchTerm + '"]');
                        if (allElements.length > 0) {
                            results.push('Similar IDs found:');
                            for (let i = 0; i < Math.min(allElements.length, 3); i++) {
                                results.push(`   #${allElements[i].id}`);
                            }
                        }
                    }
                }
            }
            
            resultsDiv.textContent = results.join('\n');
        }
        
        // システム状態更新
        function updateSystemStatus() {
            const statusDiv = document.getElementById('system-status');
            if (!statusDiv) return;
            
            const status = [
                `時刻: ${new Date().toLocaleString('ja-JP')}`,
                `URL: ${window.location.pathname}`,
                `ユーザーエージェント: ${navigator.userAgent.substring(0, 50)}...`,
                `画面解像度: ${screen.width}×${screen.height}`,
                `表示領域: ${window.innerWidth}×${window.innerHeight}`,
                `ローカルストレージ: ${Object.keys(localStorage).length}項目`,
                `セッションストレージ: ${Object.keys(sessionStorage).length}項目`,
                `デバッグモード: ${window.APP_CONFIG?.debugMode ? 'ON' : 'OFF'}`,
                `セッション状態: ${document.cookie.includes('PHPSESSID') ? 'アクティブ' : '非アクティブ'}`
            ];
            
            statusDiv.textContent = status.join('\n');
        }
        
        // API テスト機能（デバッグパネル用）
        async function testGasApiDebug() {
            const resultsDiv = document.getElementById('test-results');
            resultsDiv.textContent = 'GAS APIをテスト中...';
            
            try {
                const result = await window.testGasApi();
                resultsDiv.textContent = 'GAS APIテスト結果:\n' + JSON.stringify(result, null, 2);
            } catch (error) {
                resultsDiv.textContent = 'GAS APIテストエラー:\n' + error.message;
            }
        }
        
        async function testMedicalForceDebug() {
            const resultsDiv = document.getElementById('test-results');
            resultsDiv.textContent = 'Medical Force APIをテスト中...';
            
            try {
                const result = await window.testMedicalForceApi();
                resultsDiv.textContent = 'Medical Force APIテスト結果:\n' + JSON.stringify(result, null, 2);
            } catch (error) {
                resultsDiv.textContent = 'Medical Force APIテストエラー:\n' + error.message;
            }
        }
        
        async function testSessionDebug() {
            const resultsDiv = document.getElementById('test-results');
            resultsDiv.textContent = 'セッションをテスト中...';
            
            try {
                const result = await window.testSession();
                resultsDiv.textContent = 'セッションテスト結果:\n' + JSON.stringify(result, null, 2);
            } catch (error) {
                resultsDiv.textContent = 'セッションテストエラー:\n' + error.message;
            }
        }
        
        // APIモニタリング機能
        let isMonitoring = false;
        let originalFetch = null;
        let apiCallLog = [];
        let apiCallCount = 0;
        
        function startAPIMonitoring() {
            if (isMonitoring) return;
            
            isMonitoring = true;
            const startBtn = document.getElementById('start-monitoring-btn');
            const stopBtn = document.getElementById('stop-monitoring-btn');
            const statusDiv = document.getElementById('api-monitoring-status');
            
            // ボタンの表示を切り替え
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            
            // ステータスを更新
            statusDiv.textContent = '🟢 監視中... (0 calls)';
            statusDiv.style.color = '#48bb78';
            
            // 元のfetch関数を保存
            if (!originalFetch) {
                originalFetch = window.fetch;
            }
            
            // fetch関数をインターセプト
            window.fetch = function(...args) {
                const startTime = Date.now();
                const url = args[0];
                const options = args[1] || {};
                
                // APIコール情報をログ
                const callId = ++apiCallCount;
                const logEntry = {
                    id: callId,
                    url: url,
                    method: options.method || 'GET',
                    startTime: startTime,
                    status: 'pending'
                };
                
                apiCallLog.unshift(logEntry);
                if (apiCallLog.length > 50) apiCallLog.pop(); // 最大50件まで保持
                
                updateAPILog();
                updateMonitoringStatus();
                
                // 実際のfetch実行
                return originalFetch.apply(this, args)
                    .then(response => {
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        
                        // ログエントリを更新
                        const entry = apiCallLog.find(e => e.id === callId);
                        if (entry) {
                            entry.status = response.ok ? 'success' : 'error';
                            entry.statusCode = response.status;
                            entry.duration = duration;
                            entry.endTime = endTime;
                        }
                        
                        updateAPILog();
                        return response;
                    })
                    .catch(error => {
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        
                        // エラー情報をログに追加
                        const entry = apiCallLog.find(e => e.id === callId);
                        if (entry) {
                            entry.status = 'error';
                            entry.error = error.message;
                            entry.duration = duration;
                            entry.endTime = endTime;
                        }
                        
                        updateAPILog();
                        throw error;
                    });
            };
            
            addAPILogEntry('🟢 APIモニタリングを開始しました', 'system');
        }
        
        function stopAPIMonitoring() {
            if (!isMonitoring) return;
            
            isMonitoring = false;
            const startBtn = document.getElementById('start-monitoring-btn');
            const stopBtn = document.getElementById('stop-monitoring-btn');
            const statusDiv = document.getElementById('api-monitoring-status');
            
            // fetch関数を元に戻す
            if (originalFetch) {
                window.fetch = originalFetch;
            }
            
            // ボタンの表示を切り替え
            stopBtn.style.display = 'none';
            startBtn.style.display = 'block';
            
            // ステータスを更新
            statusDiv.textContent = `🔴 監視停止 (${apiCallCount} calls logged)`;
            statusDiv.style.color = '#f56565';
            
            addAPILogEntry('🔴 APIモニタリングを停止しました', 'system');
        }
        
        function clearAPILog() {
            apiCallLog = [];
            apiCallCount = 0;
            const logDiv = document.getElementById('api-log-display');
            if (logDiv) {
                logDiv.innerHTML = 'APIコールがここに表示されます...';
            }
            updateMonitoringStatus();
        }
        
        function updateAPILog() {
            const logDiv = document.getElementById('api-log-display');
            if (!logDiv || apiCallLog.length === 0) return;
            
            const logLines = apiCallLog.slice(0, 8).map(entry => {
                const time = new Date(entry.startTime).toLocaleTimeString();
                const url = entry.url.toString().replace(window.location.origin, '');
                const method = entry.method;
                
                let statusIcon = '';
                let statusText = '';
                
                switch (entry.status) {
                    case 'pending':
                        statusIcon = '🟡';
                        statusText = 'PENDING';
                        break;
                    case 'success':
                        statusIcon = '✅';
                        statusText = `${entry.statusCode} (${entry.duration}ms)`;
                        break;
                    case 'error':
                        statusIcon = '❌';
                        statusText = entry.error || `${entry.statusCode || 'ERROR'}`;
                        break;
                }
                
                return `${time} ${statusIcon} ${method} ${url}\n    ${statusText}`;
            });
            
            logDiv.innerHTML = logLines.join('\n\n');
            
            // 統計情報を更新
            updateAPIStatistics();
            
            // 自動スクロール（新しいエントリが上にあるので不要だが、エラーが見やすいように最上部へ）
            logDiv.scrollTop = 0;
        }
        
        function updateAPIStatistics() {
            const statsDiv = document.getElementById('api-statistics');
            if (!statsDiv) return;
            
            const completedCalls = apiCallLog.filter(entry => entry.status !== 'pending');
            const successCalls = apiCallLog.filter(entry => entry.status === 'success');
            const errorCalls = apiCallLog.filter(entry => entry.status === 'error');
            
            let averageResponseTime = 0;
            if (completedCalls.length > 0) {
                const totalTime = completedCalls.reduce((sum, entry) => sum + (entry.duration || 0), 0);
                averageResponseTime = Math.round(totalTime / completedCalls.length);
            }
            
            // エラーアラート処理
            const recentErrors = apiCallLog.filter(entry => 
                entry.status === 'error' && 
                (Date.now() - entry.startTime) < 10000 // 過去10秒以内
            );
            
            let alertText = '';
            if (recentErrors.length >= 3) {
                alertText = ' ⚠️ 連続エラー検出!';
                statsDiv.style.background = '#744210'; // 警告色
                statsDiv.style.color = '#fbbf24';
            } else if (averageResponseTime > 5000) {
                alertText = ' ⚠️ 応答時間遅延!';
                statsDiv.style.background = '#744210'; // 警告色
                statsDiv.style.color = '#fbbf24';
            } else {
                statsDiv.style.background = '#2d3748'; // 通常色
                statsDiv.style.color = '#a0aec0';
            }
            
            statsDiv.textContent = `統計: 成功 ${successCalls.length}, エラー ${errorCalls.length}, 平均応答時間 ${averageResponseTime}ms${alertText}`;
        }
        
        function updateMonitoringStatus() {
            const statusDiv = document.getElementById('api-monitoring-status');
            if (!statusDiv) return;
            
            if (isMonitoring) {
                const pendingCalls = apiCallLog.filter(entry => entry.status === 'pending').length;
                const totalCalls = apiCallLog.length;
                statusDiv.textContent = `🟢 監視中... (${totalCalls} calls, ${pendingCalls} pending)`;
            }
        }
        
        function addAPILogEntry(message, type = 'info') {
            const logDiv = document.getElementById('api-log-display');
            if (!logDiv) return;
            
            const time = new Date().toLocaleTimeString();
            const icon = type === 'system' ? '⚙️' : 'ℹ️';
            
            const currentContent = logDiv.innerHTML;
            if (currentContent === 'APIコールがここに表示されます...') {
                logDiv.innerHTML = `${time} ${icon} ${message}`;
            } else {
                logDiv.innerHTML = `${time} ${icon} ${message}\n\n${currentContent}`;
            }
        }

        // 新規患者フォーム分析機能
        function analyzePatientForm() {
            const resultsDiv = document.getElementById('test-results');
            let results = ['=== Patient Form Analysis ===\n'];
            
            // 1. ダイアログラッパーの確認
            const dialogWrapper = document.getElementById('newPatientDialogWrapper');
            results.push(`1. Dialog Wrapper (#newPatientDialogWrapper):`);
            if (dialogWrapper) {
                results.push('   ✅ Found');
                results.push(`   Display: ${dialogWrapper.style.display || 'default'}`);
                results.push(`   Class: ${dialogWrapper.className || 'none'}`);
            } else {
                results.push('   ❌ Not found');
            }
            
            // 2. 期待される入力フィールドの確認
            const expectedFields = [
                'newPatientLastName',
                'newPatientFirstName', 
                'newPatientLastNameKana',
                'newPatientFirstNameKana',
                'newPatientGender',
                'newPatientBirthday',
                // 従来のフィールドも確認
                'newPatientName',
                'newPatientKana'
            ];
            
            results.push('\n2. Expected Input Fields:');
            expectedFields.forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) {
                    results.push(`   ✅ #${fieldId} - ${element.tagName.toLowerCase()}`);
                    if (element.type) results.push(`      Type: ${element.type}`);
                    if (element.placeholder) results.push(`      Placeholder: ${element.placeholder}`);
                } else {
                    results.push(`   ❌ #${fieldId} - Not found`);
                }
            });
            
            // 3. フォーム要素の検索
            const forms = document.querySelectorAll('form');
            results.push(`\n3. Forms found: ${forms.length}`);
            forms.forEach((form, index) => {
                results.push(`   Form ${index + 1}: ${form.id || 'no id'} (${form.action || 'no action'})`);
            });
            
            // 4. ボタンの確認
            const buttons = document.querySelectorAll('button');
            const relevantButtons = Array.from(buttons).filter(btn => 
                btn.textContent.includes('追加') || 
                btn.textContent.includes('新し') ||
                btn.textContent.includes('登録')
            );
            
            results.push(`\n4. Relevant Buttons (${relevantButtons.length}):`);
            relevantButtons.forEach((btn, index) => {
                results.push(`   ${index + 1}. "${btn.textContent.trim()}" (id: ${btn.id || 'none'})`);
            });
            
            // 5. 動的に作成される可能性のチェック
            results.push('\n5. Dynamic Generation Check:');
            if (!dialogWrapper) {
                results.push('   ⚠️  Dialog wrapper not found - might be created dynamically');
                results.push('   💡 Check if dialog is created when "新しい来院者を追加" is clicked');
            }
            
            resultsDiv.textContent = results.join('\n');
        }
        
        // 全フォーム検索
        function findAllForms() {
            const resultsDiv = document.getElementById('test-results');
            const forms = document.querySelectorAll('form');
            let results = [`=== All Forms Found (${forms.length}) ===\n`];
            
            forms.forEach((form, index) => {
                results.push(`Form ${index + 1}:`);
                results.push(`   ID: ${form.id || 'none'}`);
                results.push(`   Action: ${form.action || 'none'}`);
                results.push(`   Method: ${form.method || 'GET'}`);
                results.push(`   Class: ${form.className || 'none'}`);
                
                const inputs = form.querySelectorAll('input, select, textarea');
                results.push(`   Inputs: ${inputs.length}`);
                inputs.forEach((input, i) => {
                    results.push(`     ${i+1}. ${input.tagName.toLowerCase()}#${input.id || 'no-id'} (type: ${input.type || 'text'})`);
                });
                results.push('');
            });
            
            resultsDiv.textContent = results.join('\n');
        }
        
        // 全入力要素検索
        function findAllInputs() {
            const resultsDiv = document.getElementById('test-results');
            const inputs = document.querySelectorAll('input, select, textarea');
            let results = [`=== All Input Elements (${inputs.length}) ===\n`];
            
            inputs.forEach((input, index) => {
                results.push(`${index + 1}. ${input.tagName.toLowerCase()}#${input.id || 'no-id'}`);
                results.push(`   Type: ${input.type || 'text'}`);
                results.push(`   Name: ${input.name || 'none'}`);
                results.push(`   Placeholder: ${input.placeholder || 'none'}`);
                results.push(`   Value: ${input.value || 'empty'}`);
                results.push('');
            });
            
            resultsDiv.textContent = results.join('\n');
        }
        
        // newPatient関連要素検索
        function findNewPatientElements() {
            const resultsDiv = document.getElementById('test-results');
            
            // ID属性でnewPatientを含む要素を検索
            const newPatientElements = document.querySelectorAll('[id*="newPatient"], [class*="newPatient"]');
            
            // テキスト内容で関連要素を検索
            const allElements = document.querySelectorAll('*');
            const textMatches = Array.from(allElements).filter(el => 
                el.textContent && (
                    el.textContent.includes('新しい来院者') || 
                    el.textContent.includes('追加して選択') ||
                    el.textContent.includes('来院者を追加')
                )
            );
            
            let results = ['=== newPatient Related Elements ===\n'];
            
            results.push(`1. Elements with "newPatient" in ID/Class (${newPatientElements.length}):`);
            newPatientElements.forEach((el, index) => {
                results.push(`   ${index + 1}. ${el.tagName.toLowerCase()}`);
                results.push(`      ID: ${el.id || 'none'}`);
                results.push(`      Class: ${el.className || 'none'}`);
                if (el.type) results.push(`      Type: ${el.type}`);
                results.push('');
            });
            
            results.push(`\n2. Elements with Related Text (${textMatches.length}):`);
            textMatches.forEach((el, index) => {
                results.push(`   ${index + 1}. ${el.tagName.toLowerCase()}#${el.id || 'no-id'}`);
                results.push(`      Text: "${el.textContent.trim().substring(0, 50)}..."`);
                results.push(`      Class: ${el.className || 'none'}`);
                results.push('');
            });
            
            // JavaScriptファイルで参照されているIDをリスト
            results.push('\n3. Expected IDs from JavaScript:');
            const expectedIds = [
                'newPatientLastName', 'newPatientFirstName',
                'newPatientLastNameKana', 'newPatientFirstNameKana',
                'newPatientGender', 'newPatientBirthday',
                'newPatientDialogWrapper'
            ];
            
            expectedIds.forEach(id => {
                const found = document.getElementById(id) ? '✅' : '❌';
                results.push(`   ${found} #${id}`);
            });
            
            resultsDiv.textContent = results.join('\n');
        }
        
        // 重複除外テスト用の関数
        window.testDuplicateFilter = function() {
            console.log('=== 重複除外テスト ===');
            console.log('現在のユーザーのvisitor_id:', window.APP_CONFIG.currentUserVisitorId);
            console.log('来院者一覧数:', window.APP_CONFIG.companyPatients.length);
            
            const duplicates = window.APP_CONFIG.companyPatients.filter(patient => {
                return patient.visitor_id === window.APP_CONFIG.currentUserVisitorId;
            });
            
            console.log('重複した来院者:', duplicates.length > 0 ? duplicates : '重複なし');
            
            if (duplicates.length === 0) {
                console.log('✅ 重複除外が正常に機能しています');
            } else {
                console.log('❌ 重複が残っています');
            }
        };
        
        // トグルボタンテスト用の関数
        window.testToggleButtons = function() {
            console.log('=== トグルボタンテスト ===');
            const toggles = document.querySelectorAll('.toggle-checkbox');
            console.log('トグルボタン数:', toggles.length);
            
            if (toggles.length > 0) {
                console.log('✅ トグルボタンが見つかりました');
                console.log('各ボタンの状態:');
                toggles.forEach((toggle, index) => {
                    const visitorId = toggle.getAttribute('data-visitor-id');
                    const isChecked = toggle.checked;
                    console.log(`  ${index + 1}. visitor_id: ${visitorId}, 公開: ${isChecked}`);
                });
            } else {
                console.log('❌ トグルボタンが見つかりません');
            }
        };

        // グローバル関数として公開
        window.createAdvancedDebugPanel = createAdvancedDebugPanel;
        window.searchElement = searchElement;
        window.updateSystemStatus = updateSystemStatus;
        window.analyzePatientForm = analyzePatientForm;
        window.findAllForms = findAllForms;
        window.findAllInputs = findAllInputs;
        window.findNewPatientElements = findNewPatientElements;
        window.startAPIMonitoring = startAPIMonitoring;
        window.stopAPIMonitoring = stopAPIMonitoring;
        window.clearAPILog = clearAPILog;
        window.updateAPIStatistics = updateAPIStatistics;
        
        // デバッグヘルプを表示（更新版）
        if (window.APP_CONFIG && window.APP_CONFIG.debugMode) {
            console.group('🐛 デバッグモードアクティブ');
            console.log('利用可能なデバッグ機能:');
            console.log('- showDebug() / hideDebug() - シンプルデバッグパネル');
            console.log('- createAdvancedDebugPanel() - 高度デバッグパネル');
            console.log('- testGasApi(), testSession(), testMedicalForceApi()');
            console.log('- runAllTests()');
            console.log('- searchElement() - DOM要素検索');
            console.log('- updateSystemStatus() - システム情報更新');
            console.log('- analyzePatientForm() - 患者フォーム構造解析');
            console.log('- findAllForms() - ページ内全フォーム検索');
            console.log('- findAllInputs() - 全入力要素検索');
            console.log('- findNewPatientElements() - 患者関連要素検索');
            console.log('- startAPIMonitoring() - APIモニタリング開始');
            console.log('- stopAPIMonitoring() - APIモニタリング停止');
            console.log('- clearAPILog() - APIログクリア');
            console.groupEnd();
            
            // デバッグモードの場合、2秒後に高度デバッグパネルを表示
            setTimeout(() => {
                console.log('🔧 高度デバッグパネルを作成中...');
                createAdvancedDebugPanel();
            }, 2000);
        }
    </script>
    
    <!-- セッションデータをJavaScriptに渡す -->
    <script>
        window.SESSION_USER_DATA = {
            lineUserId: <?php echo json_encode($lineUserId); ?>,
            displayName: <?php echo json_encode($displayName); ?>,
            pictureUrl: <?php echo json_encode($pictureUrl); ?>,
            userData: <?php echo json_encode($userData); ?>,
            companyInfo: <?php echo json_encode($companyInfo); ?>,
            companyPatients: <?php echo json_encode($companyPatients ?? [], JSON_HEX_QUOT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS); ?>,
            currentUserVisitorId: <?php echo json_encode($currentUserVisitorId); ?>,
            userRole: <?php echo json_encode($userRole); ?>,
            debugMode: <?php echo json_encode(defined('DEBUG_MODE') && DEBUG_MODE); ?>,
            debugInfo: <?php echo json_encode($debugInfo ?? []); ?>
        };
        
        // GasApiClientから取得したメニューデータをJavaScriptに渡す
        window.MENU_DATA = <?php echo json_encode($menuData ?? null, JSON_HEX_QUOT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS); ?>;
        window.MENU_ERROR = <?php echo json_encode($menuError ?? null, JSON_HEX_QUOT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS); ?>;
        
        // デバッグ情報
        if (window.SESSION_USER_DATA.debugMode) {
            console.log('=== SESSION USER DATA SET ===');
            console.log('Line User ID:', window.SESSION_USER_DATA.lineUserId);
            console.log('Display Name:', window.SESSION_USER_DATA.displayName);
            console.log('Has User Data:', !!window.SESSION_USER_DATA.userData);
            console.log('User Data:', window.SESSION_USER_DATA.userData);
            console.log('Company Info:', window.SESSION_USER_DATA.companyInfo);
            console.log('Company Patients:', window.SESSION_USER_DATA.companyPatients);
            console.log('User Role:', window.SESSION_USER_DATA.userRole);
            
            console.log('=== MENU DATA FROM GasApiClient ===');
            console.log('Menu Data:', window.MENU_DATA);
            if (window.MENU_ERROR) {
                console.error('Menu Error:', window.MENU_ERROR);
            } else if (window.MENU_DATA) {
                const withTicketCount = window.MENU_DATA.withTicket?.categories?.reduce((sum, cat) => sum + (cat.menus?.length || 0), 0) || 0;
                const withoutTicketCount = window.MENU_DATA.withoutTicket?.categories?.reduce((sum, cat) => sum + (cat.menus?.length || 0), 0) || 0;
                console.log('WithTicket Menu Count:', withTicketCount);
                console.log('WithoutTicket Menu Count:', withoutTicketCount);
                console.log('Total Menu Count:', withTicketCount + withoutTicketCount);
            }
        }
    </script>
    
    <script type="module" src="./js/main.js?v=20250128"></script>
    
    <!-- トグルボタンのイベントハンドラ -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // トグルボタンのイベントリスナーを設定
            const toggleCheckboxes = document.querySelectorAll('.toggle-checkbox');
            
            toggleCheckboxes.forEach(function(checkbox) {
                checkbox.addEventListener('change', async function(e) {
                    const visitorId = this.getAttribute('data-visitor-id');
                    const patientName = this.getAttribute('data-patient-name');
                    const isPublic = this.checked;
                    const loadingElement = document.getElementById('loading-' + visitorId);
                    
                    console.log('[Toggle] Changed:', visitorId, isPublic);
                    
                    try {
                        // ローディング表示
                        if (loadingElement) {
                            const actionText = isPublic ? '公開にしています' : '非公開にしています';
                            loadingElement.innerHTML = 
                                '<svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
                                    '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
                                    '<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
                                '</svg>' +
                                patientName + 'の公開設定を' + actionText + '。';
                            loadingElement.classList.remove('hidden');
                        }
                        
                        // API呼び出し
                        const response = await fetch('/reserve/api-bridge.php?action=updateVisitorPublicStatus', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({
                                visitor_id: visitorId,
                                is_public: isPublic
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // 成功メッセージ
                            const successMessage = isPublic ? 
                                patientName + 'の公開設定を公開に変更しました' : 
                                patientName + 'の公開設定を非公開に変更しました';
                            showStatusMessage(successMessage, 'success');
                        } else {
                            // エラーの場合、チェックボックスを元に戻す
                            checkbox.checked = !isPublic;
                            const errorMessage = result.error?.message || result.message || '公開設定の変更に失敗しました';
                            showStatusMessage(errorMessage, 'error');
                        }
                    } catch (error) {
                        console.error('[Toggle] Error:', error);
                        checkbox.checked = !isPublic;
                        showStatusMessage('システムエラーが発生しました', 'error');
                    } finally {
                        // ローディング非表示
                        if (loadingElement) {
                            loadingElement.classList.add('hidden');
                        }
                    }
                });
            });
            
            // ステータスメッセージ表示関数
            function showStatusMessage(message, type) {
                // 既存のメッセージがあれば削除
                const existingMessage = document.getElementById('status-message');
                if (existingMessage) {
                    existingMessage.remove();
                }

                const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
                const icon = type === 'success' ? 
                    '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>' :
                    '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>';

                const statusDiv = document.createElement('div');
                statusDiv.id = 'status-message';
                statusDiv.className = 'fixed top-20 right-4 ' + bgColor + ' text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center';
                statusDiv.innerHTML = `
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        ${icon}
                    </svg>
                    <span>${message}</span>
                `;

                document.body.appendChild(statusDiv);

                // 3秒後に自動的に削除
                setTimeout(function() {
                    statusDiv.remove();
                }, 3000);
            }
        });
    </script>
</body>
</html>