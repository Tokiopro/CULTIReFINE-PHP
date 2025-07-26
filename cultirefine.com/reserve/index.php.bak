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

try {
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    // 1. ユーザー情報を取得して会社情報を確認
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    
    if ($userInfo['status'] === 'success' && isset($userInfo['data']['user'])) {
        $userDetails = $userInfo['data']['user'];
        
        // 会社情報を取得
        if (isset($userDetails['companyId'])) {
            $companyInfo = [
                'id' => $userDetails['companyId'],
                'name' => $userDetails['companyName'] ?? '不明',
                'role' => $userDetails['userRole'] ?? 'sub'
            ];
            
            $userRole = $companyInfo['role'];
            
            // 2. 会社に紐づく来院者一覧を取得
            $patientsResponse = $gasApi->getPatientsByCompany($companyInfo['id'], $userRole);
            
            if ($patientsResponse['status'] === 'success') {
                $companyPatients = $patientsResponse['data']['visitors'] ?? [];
                $totalPatients = $patientsResponse['data']['total_count'] ?? count($companyPatients);
                
                // デバッグログ
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('Company ID: ' . $companyInfo['id']);
                    error_log('User Role: ' . $userRole);
                    error_log('Patients count: ' . count($companyPatients));
                    error_log('Total patients: ' . $totalPatients);
                }
            } else {
                $errorMessage = '来院者一覧の取得に失敗しました: ' . ($patientsResponse['message'] ?? 'Unknown error');
            }
        } else {
            $errorMessage = '会社情報が見つかりません。管理者にお問い合わせください。';
        }
    } else {
        $errorMessage = 'ユーザー情報の取得に失敗しました: ' . ($userInfo['message'] ?? 'Unknown error');
    }
} catch (Exception $e) {
    $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
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
                <?php include_once './assets/inc/navigation.php'; ?>
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
            apiEndpoint: '/reserve/api-bridge.php',
            // 権限管理とPHPから取得した来院者データ
            companyInfo: <?php echo $companyInfo ? json_encode($companyInfo) : 'null'; ?>,
            userRole: '<?php echo htmlspecialchars($userRole); ?>',
            companyPatients: <?php echo json_encode($companyPatients); ?>,
            errorMessage: '<?php echo htmlspecialchars($errorMessage); ?>'
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
    <script type="module" src="./js/main.js"></script>
</body>
</html>