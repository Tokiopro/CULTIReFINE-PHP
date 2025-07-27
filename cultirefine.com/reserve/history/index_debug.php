<?php
session_start();
require_once __DIR__ . '/../line-auth/url-helper.php';

// デバッグモードの設定
define('DEBUG_MODE', true); // 本番環境では false に設定

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

// GAS APIからユーザー情報と予約履歴を取得
require_once __DIR__ . '/../line-auth/config.php';
require_once __DIR__ . '/../line-auth/GasApiClient.php';

$companyId = '';
$companyName = '';
$memberType = 'sub';
$reservations = [];
$errorMessage = '';

// デバッグ情報を格納する配列
$debugInfo = [
    'session_data' => [],
    'api_calls' => [],
    'user_info' => [],
    'company_info' => [],
    'reservations_data' => [],
    'errors' => [],
    'system_info' => [],
    'search_filters' => []
];

// システム情報の記録
$debugInfo['system_info'] = [
    'php_version' => phpversion(),
    'debug_mode' => DEBUG_MODE,
    'timestamp' => date('Y-m-d H:i:s'),
    'memory_usage' => memory_get_usage(true),
    'peak_memory' => memory_get_peak_usage(true),
    'script_name' => basename(__FILE__),
    'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
];

// セッション情報の記録
$debugInfo['session_data'] = [
    'line_user_id' => $lineUserId,
    'display_name' => $displayName,
    'picture_url' => $pictureUrl,
    'session_id' => session_id(),
    'session_status' => session_status(),
    'all_session_vars' => array_keys($_SESSION),
    'session_cookie_params' => session_get_cookie_params()
];
// index_debug.php の修正版（73行目付近）

try {
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    // 1. ユーザー情報を取得して会社情報を確認
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    
    if ($userInfo['status'] === 'success' && isset($userInfo['data']['membership_info'])) {
        $membershipInfo = $userInfo['data']['membership_info'];
        
        if (isset($membershipInfo['company_id']) && !empty($membershipInfo['company_id'])) {
            $companyId = $membershipInfo['company_id'];
            $companyName = $membershipInfo['company_name'] ?? '不明';
            $memberType = $membershipInfo['member_type'] ?? 'サブ会員';
            
            // *** 修正箇所 ***
            // 2. 予約履歴を取得（現在日付で前後3ヶ月）
            $currentDate = date('Y-m-d'); // null ではなく実際の日付を設定
            
            // member_typeを正しい形式に変換
            $memberTypeForApi = $memberType; // 既に日本語の場合はそのまま
            //if ($memberType === 'sub') {
            //    $memberTypeForApi = 'サブ会員';
            //} elseif ($memberType === 'main') {
            //    $memberTypeForApi = '本会員';
            //}
            
            // デバッグログ追加
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('=== 予約履歴取得パラメータ ===');
                error_log('Original memberType: ' . $memberType);
                error_log('API memberType: ' . $memberTypeForApi);
                error_log('Current Date: ' . $currentDate);
                error_log('Company ID: ' . $companyId);
            }
            
            $startTime = microtime(true);
            
            // ★ 修正: $currentDate を確実に渡す
            $historyResponse = $gasApi->getReservationHistory($memberTypeForApi, $currentDate, $companyId);
            
            $endTime = microtime(true);
            
            // API呼び出し情報の記録
            $debugInfo['api_calls'][] = [
                'action' => 'getReservationHistory',
                'member_type' => $memberTypeForApi,
                'current_date' => $currentDate,
                'company_id' => $companyId,
                'execution_time' => round(($endTime - $startTime) * 1000, 2) . 'ms',
                'response_status' => $historyResponse['status'] ?? 'unknown',
                'response_size' => strlen(json_encode($historyResponse)),
                'timestamp' => date('Y-m-d H:i:s')
            ];
            
            if ($historyResponse['status'] === 'success') {
                $reservations = $historyResponse['data']['reservations'] ?? [];
                
                $debugInfo['reservations_data'] = [
                    'total_count' => count($reservations),
                    'response_data' => $historyResponse['data'],
                    'reservations' => $reservations,
                    'search_parameters' => [
                        'member_type' => $memberTypeForApi,
                        'current_date' => $currentDate,
                        'company_id' => $companyId
                    ]
                ];
                
                // デバッグログ
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('予約履歴取得成功: ' . count($reservations) . '件');
                }
            } else {
                $errorMessage = '予約履歴の取得に失敗しました: ' . ($historyResponse['error']['message'] ?? 'Unknown error');
                $debugInfo['errors'][] = [
                    'type' => 'api_error',
                    'message' => $errorMessage,
                    'response' => $historyResponse,
                    'parameters' => [
                        'member_type' => $memberTypeForApi,
                        'current_date' => $currentDate,
                        'company_id' => $companyId
                    ],
                    'timestamp' => date('Y-m-d H:i:s')
                ];
                
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('予約履歴取得エラー: ' . $errorMessage);
                }
            }
            
        } else {
            $errorMessage = '会社情報が見つかりません。管理者にお問い合わせください。';
            $debugInfo['errors'][] = [
                'type' => 'company_not_found',
                'message' => $errorMessage,
                'membership_info' => $membershipInfo,
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
    } else {
        $errorMessage = 'ユーザー情報の取得に失敗しました: ' . ($userInfo['message'] ?? 'Unknown error');
        $debugInfo['errors'][] = [
            'type' => 'user_info_error',
            'message' => $errorMessage,
            'user_info_response' => $userInfo,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }
    
} catch (Exception $e) {
    $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
    $debugInfo['errors'][] = [
        'type' => 'exception',
        'message' => $errorMessage,
        'exception_details' => [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ];
    error_log('Reservation history error: ' . $e->getMessage());
}


// 検索フィルターの記録
$debugInfo['search_filters'] = [
    'get_params' => $_GET,
    'post_params' => $_POST,
    'available_statuses' => ['予約', 'キャンセル', '完了'],
    'filter_capabilities' => [
        'visitor_name' => 'enabled',
        'status' => 'enabled',
        'date_range' => 'not_implemented'
    ]
];

// 最終的なメモリ使用量を記録
$debugInfo['system_info']['final_memory'] = memory_get_usage(true);
$debugInfo['system_info']['final_peak_memory'] = memory_get_peak_usage(true);
?>
<!DOCTYPE html>
<!-- 
    CLUTIREFINEクリニック予約システム - HTML (修正版)
    エンコーディング: UTF-8
    保存時は必ずUTF-8エンコーディングで保存してください
    + デバッグ情報表示機能
-->
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CLUTIREFINEクリニック 予約履歴一覧</title>
<meta name="description" content="CLUTIREFINEクリニックの予約履歴一覧">
<!-- Tailwind CSS CDN --> 
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="../assets/css/hamburger.css">
<style>
.debug-panel {
    max-height: 500px;
    overflow-y: auto;
}
.debug-json {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
}
.debug-tab {
    border-bottom: 1px solid #e5e7eb;
}
.debug-tab.active {
    background-color: #f3f4f6;
    border-bottom: 2px solid #0d9488;
}
.status-reserved {
    background-color: #3b82f6;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
}
.status-completed {
    background-color: #10b981;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
}
.status-canceled {
    background-color: #ef4444;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
}
</style>
</head>
<body>
<!-- Header -->
<header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
<div class="container mx-auto flex justify-between items-center">
<h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">
  予約履歴一覧</h1>
<div class="flex items-center space-x-4">
    <?php if (DEBUG_MODE): ?>
    <button id="debug-toggle-btn" class="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded text-xs font-medium">
        🐛 DEBUG
    </button>
    <?php endif; ?>
    <span class="text-sm">ようこそ、<?php echo htmlspecialchars($displayName); ?>様</span>
    <?php include_once '../assets/inc/navigation.php'; ?>
</div>
</div>
</header>

<!-- Debug Panel -->
<?php if (DEBUG_MODE): ?>
<div id="debug-panel" class="hidden bg-gray-900 text-green-400 p-4 border-b-4 border-yellow-500">
    <div class="container mx-auto">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-bold text-yellow-400">🐛 デバッグ情報パネル - 予約履歴</h2>
            <div class="flex space-x-2">
                <button id="debug-refresh-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                    🔄 更新
                </button>
                <button id="debug-copy-btn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                    📋 コピー
                </button>
                <button id="debug-close-btn" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">
                    ✕ 閉じる
                </button>
            </div>
        </div>
        
        <!-- Debug Tabs -->
        <div class="flex space-x-1 mb-4 bg-gray-800 rounded-lg p-1">
            <button class="debug-tab active px-3 py-2 rounded text-xs font-medium" data-tab="overview">概要</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="session">セッション</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="api">API呼び出し</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="company">会社情報</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="reservations">予約履歴</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="filters">検索機能</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="errors">エラー</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="system">システム</button>
            <button class="debug-tab px-3 py-2 rounded text-xs font-medium" data-tab="raw">RAWデータ</button>
        </div>
        
        <!-- Debug Content -->
        <div class="debug-panel bg-gray-800 rounded-lg p-4">
            <!-- Overview Tab -->
            <div id="debug-overview" class="debug-content">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div class="bg-blue-900 p-3 rounded">
                        <h4 class="text-blue-300 text-xs font-semibold">ユーザー</h4>
                        <p class="text-white"><?php echo htmlspecialchars($displayName); ?></p>
                        <p class="text-blue-200 text-xs"><?php echo htmlspecialchars($lineUserId); ?></p>
                    </div>
                    <div class="bg-green-900 p-3 rounded">
                        <h4 class="text-green-300 text-xs font-semibold">会社</h4>
                        <p class="text-white"><?php echo $companyName ? htmlspecialchars($companyName) : '未設定'; ?></p>
                        <p class="text-green-200 text-xs">権限: <?php echo htmlspecialchars($memberType); ?></p>
                    </div>
                    <div class="bg-purple-900 p-3 rounded">
                        <h4 class="text-purple-300 text-xs font-semibold">予約履歴</h4>
                        <p class="text-white"><?php echo count($reservations); ?>件</p>
                        <p class="text-purple-200 text-xs">読み込み済み</p>
                    </div>
                    <div class="bg-red-900 p-3 rounded">
                        <h4 class="text-red-300 text-xs font-semibold">エラー</h4>
                        <p class="text-white"><?php echo count($debugInfo['errors']); ?>件</p>
                        <p class="text-red-200 text-xs"><?php echo $errorMessage ? '有り' : '無し'; ?></p>
                    </div>
                </div>
                
                <?php if ($errorMessage): ?>
                <div class="bg-red-900 border border-red-500 p-3 rounded mb-4">
                    <h4 class="text-red-300 font-semibold text-sm">現在のエラー:</h4>
                    <p class="text-red-100 text-sm"><?php echo htmlspecialchars($errorMessage); ?></p>
                </div>
                <?php endif; ?>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-gray-700 p-3 rounded">
                        <h4 class="text-gray-300 font-semibold text-sm mb-2">最近のAPI呼び出し:</h4>
                        <?php if (!empty($debugInfo['api_calls'])): ?>
                            <?php foreach (array_slice($debugInfo['api_calls'], -3) as $call): ?>
                            <div class="text-xs mb-1">
                                <span class="text-yellow-400"><?php echo htmlspecialchars($call['timestamp']); ?></span>
                                <span class="text-cyan-400"><?php echo htmlspecialchars($call['action']); ?></span>
                                <span class="text-green-400"><?php echo $call['execution_time'] ?? 'N/A'; ?></span>
                            </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <p class="text-gray-400 text-xs">API呼び出し履歴なし</p>
                        <?php endif; ?>
                    </div>
                    
                    <div class="bg-gray-700 p-3 rounded">
                        <h4 class="text-gray-300 font-semibold text-sm mb-2">予約ステータス分布:</h4>
                        <?php
                        $statusCounts = [];
                        foreach ($reservations as $reservation) {
                            $status = $reservation['status'];
                            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
                        }
                        ?>
                        <?php if (!empty($statusCounts)): ?>
                            <?php foreach ($statusCounts as $status => $count): ?>
                            <div class="text-xs mb-1">
                                <span class="text-cyan-400"><?php echo htmlspecialchars($status); ?>:</span>
                                <span class="text-white"><?php echo $count; ?>件</span>
                            </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <p class="text-gray-400 text-xs">予約データなし</p>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            
            <!-- Session Tab -->
            <div id="debug-session" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['session_data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- API Tab -->
            <div id="debug-api" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['api_calls'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- Company Tab -->
            <div id="debug-company" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['company_info'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- Reservations Tab -->
            <div id="debug-reservations" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['reservations_data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- Filters Tab -->
            <div id="debug-filters" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['search_filters'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- Errors Tab -->
            <div id="debug-errors" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['errors'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- System Tab -->
            <div id="debug-system" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo['system_info'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
            
            <!-- Raw Data Tab -->
            <div id="debug-raw" class="debug-content hidden">
                <pre class="debug-json text-xs"><?php echo htmlspecialchars(json_encode($debugInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- Main Content -->
<main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-gray-100">
  <div class="container mx-auto px-0 sm:px-6">
    <div class="his_cont_wrap">
      <h2>予約履歴一覧<br>
        <small><?php echo htmlspecialchars($companyName); ?> の予約履歴です。
        <?php if ($memberType === 'sub'): ?>
          （公開設定の予約のみ表示）
        <?php endif; ?>
        </small></h2>
      <div id="search_box" class="bg-white">
        <h3>絞り込み検索</h3>
        <form id="sort_form">
          <div class="sort_form_wrap">
          <div class="sort_item">
            <label for="sort_name">来院者名</label>
            <input id="sort_name" name="sort_name" type="text" class="sort_input">
          </div>
          <div class="sort_item">
            <label for="sort_status">ステータス</label>
            <select id="sort_status" name="sort_status" class="sort_input">
              <option value="">選択してください</option>
              <option value="予約">予約済み</option>
              <option value="キャンセル">キャンセル済み</option>
              <option value="完了">来院済み</option>
            </select>
          </div>
          <div class="sort_item">
            <input class="sort_input" type="reset" value="クリア">
          </div>
        </form>
      </div>
    </div>
	
	<?php if (!empty($errorMessage)): ?>
		<div class="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			<p><?php echo htmlspecialchars($errorMessage); ?></p>
		</div>
	<?php endif; ?>
	
	<?php if (empty($reservations) && empty($errorMessage)): ?>
		<div class="no-reservations bg-gray-100 border border-gray-300 text-gray-600 px-4 py-6 rounded text-center">
			<p>予約履歴がありません。</p>
		</div>
	<?php else: ?>
		<?php foreach ($reservations as $index => $reservation): ?>
    <div id="history_item<?php echo $index + 1; ?>" class="history_item"
         data-reservation-id="<?php echo htmlspecialchars($reservation['reservation_id']); ?>"
         data-visitor-name="<?php echo htmlspecialchars($reservation['visitor_name']); ?>"
         data-status="<?php echo htmlspecialchars($reservation['status']); ?>"
         data-menu="<?php echo htmlspecialchars($reservation['menu_name']); ?>"
         data-date="<?php echo htmlspecialchars($reservation['date']); ?>"
         data-time="<?php echo htmlspecialchars($reservation['time']); ?>"
         data-memo="<?php echo htmlspecialchars($reservation['memo'] ?? ''); ?>">
      <div class="his_cont_detail">
        <div class="his_cont_detail_status">
          <span class="status-<?php echo $reservation['status'] === '予約' ? 'reserved' : ($reservation['status'] === '完了' ? 'completed' : 'canceled'); ?>">
            <?php echo htmlspecialchars($reservation['status']); ?>
          </span>
        </div>
        <div class="his_cont_detail_menu"><?php echo htmlspecialchars($reservation['menu_name']); ?></div>
        <div class="his_cont_detail_date_wrap">
          <div class="his_cont_detail_date_item">
            <p class="his_ttl calender">予約日時</p>
            <p class="his_date"><?php echo htmlspecialchars($reservation['date']); ?> <?php echo htmlspecialchars($reservation['time']); ?></p>
          </div>
          <div class="his_cont_detail_date_item">
            <p class="his_ttl pin">クリニック名</p>
            <p class="his_date">CULTIRE FINEクリニック</p>
          </div>
        </div>
        <div class="his_cont_detail_visiter">
          <p class="his_ttl">来院者</p>
          <p class="his_visiter_name">
            <?php echo htmlspecialchars($reservation['visitor_name']); ?>
            <?php if (isset($reservation['is_public']) && $reservation['is_public'] === false && $memberType === 'main'): ?>
              <span class="text-sm text-gray-500">(非公開)</span>
            <?php endif; ?>
          </p>
        </div>
        <div class="his_cont_detail_reserver">
          <p class="his_ttl">メモ</p>
          <p class="his_name"><?php echo htmlspecialchars($reservation['memo'] ?: 'なし'); ?></p>
        </div>
        <button class="open_modal">予約詳細を見る</button>
      </div>
    </div>
		<?php endforeach; ?>
	<?php endif; ?>
  </div>
  </div>
</main>
<div id="modal_more">
  <div class="modal_wrap">
    <div class="modal_ttl">
      <h2>予約詳細</h2>
      <div class="modal_close">
        <button>&times;</button>
      </div>
    </div>
    <div class="modal_cont">
		<div class="modal_status">
        <p></p>
      </div>
      <div class="modal_menu">
        <h3>施術メニュー</h3>
        <p></p>
      </div>
      <div class="modal_date">
        <h3>予約日時</h3>
        <p></p>
      </div>
      <div class="modal_clinic_wrap">
        <h3>クリニック情報</h3>
        <h4>CUTIREFINEクリニック</h4>
        <p class="item_name pin">所在地</p>
        <p>大阪府大阪市北区万歳町３−１６ 天満病院グループ梅田ビル1・2階</p><a href="https://g.co/kgs/4fBEpLw" target="_blank" class="mb-2 maplink">Googleマップで見る</a>
        <p class="item_name tel">電話番号</p>
        <p>06-6366-5880</p>
      </div>
      <div class="modal_patient_wrap">
        <h3>来院者情報</h3>
        <p></p>
      </div>
      <ul class="change_reserve">
        <li>
          <button class="cancel">予約をキャンセル</button>
        </li>
      </ul>
    </div>
  </div>
</div>
<!-- Footer -->
	<?php include_once '../assets/inc/footer.php'; ?>

<!-- JavaScript Configuration -->
<script>
    // PHPから渡されたデータをJavaScriptで利用可能にする
    window.RESERVATION_CONFIG = {
        lineUserId: '<?php echo htmlspecialchars($lineUserId); ?>',
        displayName: '<?php echo htmlspecialchars($displayName); ?>',
        companyId: '<?php echo htmlspecialchars($companyId); ?>',
        companyName: '<?php echo htmlspecialchars($companyName); ?>',
        memberType: '<?php echo htmlspecialchars($memberType); ?>',
        reservationsCount: <?php echo count($reservations); ?>,
        hasError: <?php echo $errorMessage ? 'true' : 'false'; ?>,
        errorMessage: '<?php echo htmlspecialchars($errorMessage); ?>',
        // デバッグ情報
        debugMode: <?php echo DEBUG_MODE ? 'true' : 'false'; ?>,
        debugInfo: <?php echo json_encode($debugInfo); ?>
    };

    // デバッグパネル制御
    <?php if (DEBUG_MODE): ?>
    document.addEventListener('DOMContentLoaded', function() {
        const debugToggleBtn = document.getElementById('debug-toggle-btn');
        const debugPanel = document.getElementById('debug-panel');
        const debugCloseBtn = document.getElementById('debug-close-btn');
        const debugCopyBtn = document.getElementById('debug-copy-btn');
        const debugRefreshBtn = document.getElementById('debug-refresh-btn');
        const debugTabs = document.querySelectorAll('.debug-tab');
        const debugContents = document.querySelectorAll('.debug-content');

        // デバッグパネルの表示/非表示
        debugToggleBtn.addEventListener('click', function() {
            debugPanel.classList.toggle('hidden');
        });

        debugCloseBtn.addEventListener('click', function() {
            debugPanel.classList.add('hidden');
        });

        // デバッグ情報のコピー
        debugCopyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(JSON.stringify(window.RESERVATION_CONFIG.debugInfo, null, 2))
                .then(() => {
                    debugCopyBtn.textContent = '✅ コピー済み';
                    setTimeout(() => {
                        debugCopyBtn.innerHTML = '📋 コピー';
                    }, 2000);
                })
                .catch(err => {
                    console.error('コピーに失敗しました:', err);
                });
        });

        // リフレッシュ
        debugRefreshBtn.addEventListener('click', function() {
            location.reload();
        });

        // タブ切り替え
        debugTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.dataset.tab;
                
                // アクティブタブの切り替え
                debugTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // コンテンツの切り替え
                debugContents.forEach(content => {
                    content.classList.add('hidden');
                });
                const targetContent = document.getElementById('debug-' + targetTab);
                if (targetContent) {
                    targetContent.classList.remove('hidden');
                }
            });
        });

        // コンソールに詳細ログを出力
        console.log('🐛 予約履歴デバッグ情報:', window.RESERVATION_CONFIG.debugInfo);
    });
    <?php endif; ?>
</script>

<script src="./js/filter.js"></script> 
<script src="./js/modal.js"></script>
</body>
</html>