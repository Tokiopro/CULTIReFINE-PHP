<?php
session_start();
require_once __DIR__ . '/line-auth/url-helper.php';

// LINE認証チェック
if (!isset($_SESSION['line_user_id'])) {
    // 未認証の場合はLINE認証へリダイレクト
    header('Location: ' . getRedirectUrl('/reserve/line-auth/'));
    exit;
}

// ユーザー情報を取得
$lineUserId = $_SESSION['line_user_id'];
$displayName = $_SESSION['line_display_name'] ?? 'ゲスト';
$pictureUrl = $_SESSION['line_picture_url'] ?? null;
$userData = $_SESSION['user_data'] ?? null;

// 権限管理とGAS APIから来院者データを取得
require_once __DIR__ . '/line-auth/config.php';
require_once __DIR__ . '/line-auth/GasApiClient.php';

$companyPatients = [];
$companyInfo = null;
$userRole = 'sub'; // デフォルトはサブ会員
$errorMessage = '';
$debugInfo = []; // デバッグ情報を格納
$currentUserVisitorId = null; // ログインユーザーのvisitor_id

try {
    // デバッグ: セッション情報
    if (DEBUG_MODE) {
        $debugInfo['session'] = [
            'line_user_id' => $_SESSION['line_user_id'] ?? 'not_set',
            'line_display_name' => $_SESSION['line_display_name'] ?? 'not_set',
            'session_id' => session_id(),
            'all_session_data' => $_SESSION
        ];
        error_log('[DEBUG] Session info: ' . json_encode($debugInfo['session']));
    }
    
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    // デバッグ: GAS API設定
    if (DEBUG_MODE) {
        $debugInfo['gas_config'] = [
            'deployment_id' => GAS_DEPLOYMENT_ID ? '設定済み' : '未設定',
            'api_key' => GAS_API_KEY ? '設定済み' : '未設定',
            'line_user_id' => $lineUserId
        ];
        error_log('[DEBUG] GAS API config: ' . json_encode($debugInfo['gas_config']));
    }
    
    // 1. ユーザー情報を取得して会社情報を確認
    if (DEBUG_MODE) {
        error_log('[DEBUG] Calling getUserFullInfo for LINE User ID: ' . $lineUserId);
    }
    
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    
    // デバッグ: API レスポンス詳細
    if (DEBUG_MODE) {
        $debugInfo['gas_api_response'] = [
            'status' => $userInfo['status'] ?? 'no_status',
            'has_data' => isset($userInfo['data']),
            'data_keys' => isset($userInfo['data']) ? array_keys($userInfo['data']) : [],
            'error' => $userInfo['error'] ?? null,
            'full_response' => $userInfo
        ];
        error_log('[DEBUG] GAS API Response: ' . json_encode($debugInfo['gas_api_response']));
    }
    
    // GAS APIの実際のレスポンス形式に対応
    if (isset($userInfo['visitor']) && isset($userInfo['company'])) {
        // ログインユーザーのvisitor_idを取得
        $currentUserVisitorId = $userInfo['visitor']['visitor_id'] ?? null;
        
        // 実際のGAS APIレスポンスから membership_info 形式に変換
        $membershipInfo = [
            'company_id' => $userInfo['company']['company_id'] ?? null,
            'company_name' => $userInfo['company']['name'] ?? '不明',
            'member_type' => $userInfo['visitor']['member_type'] === true ? '本会員' : 'サブ会員'
        ];
        
        if (DEBUG_MODE) {
            error_log('[DEBUG] Current user visitor_id: ' . $currentUserVisitorId);
            error_log('[DEBUG] Converted membership info: ' . json_encode($membershipInfo));
        }
        
        // 会社情報を取得
        if (isset($membershipInfo['company_id']) && !empty($membershipInfo['company_id'])) {
            $companyInfo = [
                'id' => $membershipInfo['company_id'],
                'name' => $membershipInfo['company_name'] ?? '不明',
                'member_type' => $membershipInfo['member_type'] ?? 'サブ会員',
                'role' => ($membershipInfo['member_type'] === '本会員') ? 'main' : 'sub'
            ];
            
            $userRole = $companyInfo['role'];
            
            // 2. 会社に紐づく来院者一覧を取得
            $patientsResponse = $gasApi->getPatientsByCompany($companyInfo['id'], $userRole);
            
            if ($patientsResponse['status'] === 'success') {
                $rawPatients = $patientsResponse['data']['visitors'] ?? [];
                
                // ログインユーザーのvisitor_idと重複する来院者を除外
                $companyPatients = [];
                foreach ($rawPatients as $patient) {
                    $patientVisitorId = $patient['visitor_id'] ?? null;
                    // ログインユーザーのvisitor_idと一致しない場合のみ追加
                    if ($patientVisitorId !== $currentUserVisitorId || $currentUserVisitorId === null) {
                        $companyPatients[] = $patient;
                    }
                }
                
                $totalPatients = count($companyPatients);
                
                // デバッグログ
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('Company ID: ' . $companyInfo['id']);
                    error_log('User Role: ' . $userRole);
                    error_log('Raw patients count: ' . count($rawPatients));
                    error_log('Filtered patients count: ' . $totalPatients);
                    error_log('Current user visitor_id: ' . $currentUserVisitorId);
                    error_log('Excluded duplicates: ' . (count($rawPatients) - $totalPatients));
                }
            } else {
                $errorMessage = '来院者一覧の取得に失敗しました: ' . ($patientsResponse['message'] ?? 'Unknown error');
            }
        } else {
            $errorMessage = '会社情報が見つかりません。管理者にお問い合わせください。';
        }
    } else {
        // GAS APIレスポンスの形式をチェックして適切なエラーメッセージを生成
        $hasVisitorInfo = isset($userInfo['visitor']);
        $hasCompanyInfo = isset($userInfo['company']);
        
        if ($hasVisitorInfo && !$hasCompanyInfo) {
            $errorMessage = '来院者情報は取得できましたが、会社情報が見つかりません。';
        } elseif (!$hasVisitorInfo && $hasCompanyInfo) {
            $errorMessage = '会社情報は取得できましたが、来院者情報が見つかりません。';
        } elseif (isset($userInfo['status']) && $userInfo['status'] === 'error') {
            $errorMessage = 'GAS APIエラー: ' . ($userInfo['error']['message'] ?? $userInfo['message'] ?? 'Unknown error');
        } else {
            $errorMessage = 'ユーザー情報の取得に失敗しました: レスポンス形式が不正です';
        }
        
        // デバッグ: 失敗詳細
        if (DEBUG_MODE) {
            $debugInfo['failure_details'] = [
                'has_visitor_info' => $hasVisitorInfo,
                'has_company_info' => $hasCompanyInfo,
                'response_keys' => array_keys($userInfo),
                'visitor_data' => $userInfo['visitor'] ?? null,
                'company_data' => $userInfo['company'] ?? null,
                'full_user_info' => $userInfo
            ];
            error_log('[DEBUG] Failure details: ' . json_encode($debugInfo['failure_details']));
        }
    }
} catch (Exception $e) {
    $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
    
    if (DEBUG_MODE) {
        $debugInfo['exception'] = [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ];
        error_log('[DEBUG] Exception: ' . json_encode($debugInfo['exception']));
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
            <h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">予約</h1>
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

                        <div id="patients-list" class="max-h-80 overflow-y-auto space-y-3 pr-2"></div>

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
                        <section class="space-y-4">
                            <h3 class="text-lg font-semibold text-gray-700">1. 施術メニューを選択</h3>
                            <div id="treatment-categories" class="border border-gray-200 rounded-lg overflow-hidden"></div>
                        </section>

                        <div id="interval-error" class="hidden bg-red-50 border-l-4 border-red-500 p-4 rounded">
                            <h4 class="text-sm font-semibold text-red-800">施術間隔エラー</h4>
                            <p id="interval-error-text" class="text-xs text-red-600"></p>
                        </div>

                        <section id="date-time-selection" class="space-y-4 hidden">
                            <h3 class="text-lg font-semibold text-gray-700">2. ご希望日時を選択</h3>
                            <div class="bg-slate-100 border border-gray-200 rounded-md p-3">
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" id="pair-room-switch" class="sr-only">
                                    <div class="switch relative w-11 h-6 bg-gray-200 rounded-full transition-colors">
                                        <div class="switch-thumb absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"></div>
                                    </div>
                                    <span class="text-base font-medium text-pink-600 flex items-center">
                                        <span class="mr-2">👫</span> ペア施術を希望 (2枠確保)
                                    </span>
                                </label>
                            </div>
                            
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
                <!-- 氏名 -->
                <div>
                    <label for="new-patient-name" class="block text-sm font-medium text-gray-700 mb-1">
                        氏名 <span class="text-red-500">*</span>
                    </label>
                    <input type="text" id="new-patient-name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="例: 鈴木 一郎" maxlength="30" required>
                    <p class="text-xs text-gray-500 mt-1">30字以内で入力してください。</p>
                </div>
                
                <!-- カナ -->
                <div>
                    <label for="new-patient-kana" class="block text-sm font-medium text-gray-700 mb-1">
                        カナ <span class="text-red-500">*</span>
                    </label>
                    <input type="text" id="new-patient-kana" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="例: スズキ イチロウ" maxlength="60" required>
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
                    <p class="text-xs text-gray-500 mt-1">施術の予約間隔計算に使用されます。</p>
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
            companyPatients: <?php echo json_encode($companyPatients); ?>,
            errorMessage: '<?php echo htmlspecialchars($errorMessage); ?>',
            // デバッグ情報
            debugMode: <?php echo DEBUG_MODE ? 'true' : 'false'; ?>,
            debugInfo: <?php echo json_encode($debugInfo); ?>
        };
    </script>

    <!-- JavaScriptモジュール -->
    <script type="module" src="./js/core/polyfills.js"></script>
    <script type="module" src="./js/core/storage-manager.js"></script>
    <script type="module" src="./js/core/app-state.js"></script>
    <script type="module" src="./js/core/ui-helpers.js"></script>
    <script type="module" src="./js/data/treatment-data.js"></script>
    <script type="module" src="./js/data/mock-api.js"></script>
    <script type="module" src="./js/data/gas-api.js"></script>
    <script type="module" src="./js/components/calendar.js"></script>
    <script type="module" src="./js/components/treatment-accordion.js"></script>
    <script type="module" src="./js/components/modal.js"></script>
    <script type="module" src="./js/screens/patient-selection.js"></script>
    <script type="module" src="./js/screens/menu-calendar.js"></script>
    <script type="module" src="./js/screens/pair-booking.js"></script>
    <script type="module" src="./js/screens/bulk-booking.js"></script>
    
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
                        <span style="font-weight: 600; font-size: 14px;">Advanced Debug Panel</span>
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
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🎛️ Controls</h4>
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
                            ">🚪 Logout</button>
                            <button id="clear-cache-btn" style="
                                background: linear-gradient(135deg, #3182ce, #2c5282);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                transition: all 0.2s;
                            ">🗑️ Clear Cache</button>
                            <button id="refresh-hard-btn" style="
                                background: linear-gradient(135deg, #38a169, #2f855a);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                transition: all 0.2s;
                            ">🔄 Hard Refresh</button>
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
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🧪 API Tests</h4>
                        <div style="display: grid; gap: 5px;">
                            <button id="test-gas-api-btn" style="
                                background: linear-gradient(135deg, #ed8936, #dd6b20);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Test GAS API</button>
                            <button id="test-medical-force-btn" style="
                                background: linear-gradient(135deg, #9f7aea, #805ad5);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Test Medical Force</button>
                            <button id="test-session-btn" style="
                                background: linear-gradient(135deg, #48bb78, #38a169);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Test Session</button>
                            <button id="analyze-patient-form-btn" style="
                                background: linear-gradient(135deg, #f56565, #e53e3e);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Analyze Patient Form</button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #63b3ed; font-size: 14px;">🔧 Quick Actions</h4>
                        <div style="display: grid; gap: 5px;">
                            <button id="find-all-forms-btn" style="
                                background: linear-gradient(135deg, #2b6cb0, #2c5282);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Find All Forms</button>
                            <button id="find-all-inputs-btn" style="
                                background: linear-gradient(135deg, #38a169, #2f855a);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Find All Inputs</button>
                            <button id="find-newpatient-elements-btn" style="
                                background: linear-gradient(135deg, #d69e2e, #b7791f);
                                border: none;
                                color: white;
                                padding: 6px 10px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            ">Find newPatient* Elements</button>
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
                `Time: ${new Date().toLocaleString()}`,
                `URL: ${window.location.pathname}`,
                `User Agent: ${navigator.userAgent.substring(0, 50)}...`,
                `Screen: ${screen.width}×${screen.height}`,
                `Viewport: ${window.innerWidth}×${window.innerHeight}`,
                `LocalStorage: ${Object.keys(localStorage).length} items`,
                `SessionStorage: ${Object.keys(sessionStorage).length} items`,
                `Debug Mode: ${window.APP_CONFIG?.debugMode || 'false'}`,
                `Session Active: ${document.cookie.includes('PHPSESSID') ? 'Yes' : 'No'}`
            ];
            
            statusDiv.textContent = status.join('\n');
        }
        
        // API テスト機能（デバッグパネル用）
        async function testGasApiDebug() {
            const resultsDiv = document.getElementById('test-results');
            resultsDiv.textContent = 'Testing GAS API...';
            
            try {
                const result = await window.testGasApi();
                resultsDiv.textContent = 'GAS API Test Result:\n' + JSON.stringify(result, null, 2);
            } catch (error) {
                resultsDiv.textContent = 'GAS API Test Error:\n' + error.message;
            }
        }
        
        async function testMedicalForceDebug() {
            const resultsDiv = document.getElementById('test-results');
            resultsDiv.textContent = 'Testing Medical Force API...';
            
            try {
                const result = await window.testMedicalForceApi();
                resultsDiv.textContent = 'Medical Force API Test Result:\n' + JSON.stringify(result, null, 2);
            } catch (error) {
                resultsDiv.textContent = 'Medical Force API Test Error:\n' + error.message;
            }
        }
        
        async function testSessionDebug() {
            const resultsDiv = document.getElementById('test-results');
            resultsDiv.textContent = 'Testing Session...';
            
            try {
                const result = await window.testSession();
                resultsDiv.textContent = 'Session Test Result:\n' + JSON.stringify(result, null, 2);
            } catch (error) {
                resultsDiv.textContent = 'Session Test Error:\n' + error.message;
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
        
        // グローバル関数として公開
        window.createAdvancedDebugPanel = createAdvancedDebugPanel;
        window.searchElement = searchElement;
        window.updateSystemStatus = updateSystemStatus;
        window.analyzePatientForm = analyzePatientForm;
        window.findAllForms = findAllForms;
        window.findAllInputs = findAllInputs;
        window.findNewPatientElements = findNewPatientElements;
        
        // デバッグヘルプを表示（更新版）
        if (window.APP_CONFIG && window.APP_CONFIG.debugMode) {
            console.group('🐛 Debug Mode Active');
            console.log('Available debug functions:');
            console.log('- showDebug() / hideDebug() - Simple debug panel');
            console.log('- createAdvancedDebugPanel() - Advanced debug panel');
            console.log('- testGasApi(), testSession(), testMedicalForceApi()');
            console.log('- runAllTests()');
            console.log('- searchElement() - DOM element search');
            console.log('- updateSystemStatus() - System info refresh');
            console.log('- analyzePatientForm() - Analyze patient form structure');
            console.log('- findAllForms() - Find all forms in page');
            console.log('- findAllInputs() - Find all input elements');
            console.log('- findNewPatientElements() - Find newPatient related elements');
            console.groupEnd();
            
            // デバッグモードの場合、2秒後に高度デバッグパネルを表示
            setTimeout(() => {
                console.log('🔧 Creating Advanced Debug Panel...');
                createAdvancedDebugPanel();
            }, 2000);
        }
    </script>
    
    <script type="module" src="./js/main.js"></script>
</body>
</html>