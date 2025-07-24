<?php
// エラー表示設定（デバッグ用）
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

session_start();
require_once __DIR__ . '/../line-auth/url-helper.php';

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

// GAS APIから情報を取得
require_once __DIR__ . '/../line-auth/config.php';
require_once __DIR__ . '/../line-auth/GasApiClient.php';

$ticketInfo = [];
$companyName = '';
$companyPlan = '';
$planTotalTickets = [];
$errorMessage = '';
$reservationHistory = [];

try {
    // デバッグ: 設定確認
    if (!defined('GAS_DEPLOYMENT_ID') || !defined('GAS_API_KEY')) {
        throw new Exception('GAS API設定が不足しています');
    }
    
    error_log('[Ticket Page] Creating GAS API client...');
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    // ユーザー情報を取得
    error_log('[Ticket Page] Fetching user info for LINE ID: ' . $lineUserId);
    $userInfo = $gasApi->getUserFullInfo($lineUserId);
    
    if (isset($userInfo['status']) && $userInfo['status'] === 'success' && isset($userInfo['data'])) {
        // 会社情報
        $companyName = $userInfo['data']['membership_info']['company_name'] ?? '';
        $companyPlan = $userInfo['data']['membership_info']['plan'] ?? '';
        
        // チケット情報を取得
        $tickets = $userInfo['data']['membership_info']['tickets'] ?? [];
        
        // デバッグ: チケット情報の構造を確認
        if (DEBUG_MODE && !empty($tickets)) {
            error_log('[Ticket Page] Ticket data structure: ' . json_encode($tickets));
        }
        
        // チケット情報を種類別に整理
        foreach ($tickets as $ticket) {
            switch ($ticket['treatment_id']) {
                case 'stem_cell':
                    $ticketInfo['stem_cell'] = [
                        'name' => '幹細胞培養上清液点滴',
                        'remaining' => $ticket['remaining_count'] ?? 0,
                        'used' => $ticket['used_count'] ?? 0,
                        'available' => $ticket['available_count'] ?? 0,
                        'granted' => $ticket['granted_count'] ?? 0,
                        'last_used' => $ticket['last_used_date'] ?? null
                    ];
                    break;
                case 'treatment':
                    $ticketInfo['beauty'] = [
                        'name' => '美容施術',
                        'remaining' => $ticket['remaining_count'] ?? 0,
                        'used' => $ticket['used_count'] ?? 0,
                        'available' => $ticket['available_count'] ?? 0,
                        'granted' => $ticket['granted_count'] ?? 0,
                        'last_used' => $ticket['last_used_date'] ?? null
                    ];
                    break;
                case 'drip':
                    $ticketInfo['injection'] = [
                        'name' => '点滴・注射',
                        'remaining' => $ticket['remaining_count'] ?? 0,
                        'used' => $ticket['used_count'] ?? 0,
                        'available' => $ticket['available_count'] ?? 0,
                        'granted' => $ticket['granted_count'] ?? 0,
                        'last_used' => $ticket['last_used_date'] ?? null
                    ];
                    break;
            }
        }
        
        // 予約履歴を取得
        $reservationHistory = $userInfo['data']['reservation_history'] ?? [];
        
    } else {
        $errorMessage = 'チケット情報の取得に失敗しました。';
    }
    
} catch (Exception $e) {
    error_log('[Ticket Page] Error: ' . $e->getMessage());
    error_log('[Ticket Page] Stack trace: ' . $e->getTraceAsString());
    $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
}

// 最終利用日を計算
$lastUsedDate = null;
foreach ($ticketInfo as $info) {
    if ($info['last_used'] && (!$lastUsedDate || $info['last_used'] > $lastUsedDate)) {
        $lastUsedDate = $info['last_used'];
    }
}

// 予約済み・来院済みの予約を分類
$reservedReservations = [];
$usedReservations = [];
$reservedCounts = [
    'stem_cell' => 0,
    'injection' => 0,
    'beauty' => 0
];
$usedCounts = [
    'stem_cell' => 0,
    'injection' => 0,
    'beauty' => 0
];

foreach ($reservationHistory as $reservation) {
    if ($reservation['status'] === '予約済み' || $reservation['status'] === 'reserved') {
        $reservedReservations[] = $reservation;
        // メニュータイプに基づいてカウント
        // TODO: 実際のメニューとチケットタイプのマッピングが必要
    } elseif ($reservation['status'] === '来院済み' || $reservation['status'] === 'visited') {
        $usedReservations[] = $reservation;
    }
}

// プランの総枚数を計算（付与数が無い場合は残数＋使用数で代替）
$planTotalTickets = [
    'stem_cell' => isset($ticketInfo['stem_cell']) ? 
        ($ticketInfo['stem_cell']['granted'] ?: ($ticketInfo['stem_cell']['remaining'] + $ticketInfo['stem_cell']['used'])) : 0,
    'injection' => isset($ticketInfo['injection']) ? 
        ($ticketInfo['injection']['granted'] ?: ($ticketInfo['injection']['remaining'] + $ticketInfo['injection']['used'])) : 0,
    'beauty' => isset($ticketInfo['beauty']) ? 
        ($ticketInfo['beauty']['granted'] ?: ($ticketInfo['beauty']['remaining'] + $ticketInfo['beauty']['used'])) : 0
];

// 予約をチケットタイプ別にグループ化する関数
function groupReservationsByTicketType($reservations) {
    $grouped = [
        'stem_cell' => [],
        'injection' => [],
        'beauty' => []
    ];
    
    foreach ($reservations as $reservation) {
        // メニュー名とカテゴリからチケットタイプを判定
        $menuName = $reservation['menu_name'] ?? '';
        $category = $reservation['category'] ?? '';
        
        if (strpos($menuName, '幹細胞') !== false || strpos($category, '幹細胞') !== false) {
            $grouped['stem_cell'][] = $reservation;
        } elseif (strpos($menuName, '点滴') !== false || strpos($menuName, '注射') !== false || 
                  strpos($category, '点滴') !== false) {
            $grouped['injection'][] = $reservation;
        } elseif (strpos($menuName, '美容') !== false || strpos($menuName, '施術') !== false || 
                  strpos($category, '美容') !== false) {
            $grouped['beauty'][] = $reservation;
        }
    }
    
    return $grouped;
}

$groupedReserved = groupReservationsByTicketType($reservedReservations);
$groupedUsed = groupReservationsByTicketType($usedReservations);

?>
<!DOCTYPE html>
<!-- 
    CLUTIREFINEクリニック予約システム - チケット管理
    エンコーディング: UTF-8
    保存時は必ずUTF-8エンコーディングで保存してください
-->
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CLUTIREFINEクリニック チケット管理</title>
<meta name="description" content="CLUTIREFINEクリニックのチケット管理画面">
<!-- Tailwind CSS CDN --> 
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="../assets/css/hamburger.css">
<style>
    /* プロフィール画像スタイル */
    .profile-image {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255, 255, 255, 0.3);
    }
    
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .user-name {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
    }
</style>
<script>
        // Tailwind設定のカスタマイズ
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        teal: {
                            50: '#f0fdfa',
                            100: '#ccfbf1',
                            500: '#14b8a6',
                            600: '#0d9488',
                            700: '#0f766e',
                        }
                    }
                }
            }
        }
    </script>
</head>
<body>
<!-- Header -->
<header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
    <div class="container mx-auto flex justify-between items-center">
        <h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">
            チケット管理</h1>
        
        <!-- デスクトップ: ユーザー情報とナビゲーション -->
        <div class="hidden md:flex items-center gap-6">
            <div class="user-info">
                <?php if ($pictureUrl): ?>
                    <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image">
                <?php else: ?>
                    <div class="profile-image bg-gray-300 flex items-center justify-center">
                        <span class="text-gray-600 text-sm font-semibold"><?php echo mb_substr($displayName, 0, 1); ?></span>
                    </div>
                <?php endif; ?>
                <span class="user-name"><?php echo htmlspecialchars($displayName); ?></span>
            </div>
            <?php include_once '../assets/inc/navigation.php'; ?>
        </div>
        
        <!-- モバイル: ユーザー情報とハンバーガーメニュー -->
        <div class="md:hidden flex items-center gap-3">
            <div class="user-info">
                <?php if ($pictureUrl): ?>
                    <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image" style="width: 32px; height: 32px;">
                <?php endif; ?>
            </div>
            <?php include_once '../assets/inc/navigation.php'; ?>
        </div>
    </div>
</header>

<!-- Main Content -->
<main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-gray-500">
  <div class="container mx-auto px-0 sm:px-6">
    <div class="ticket_cont_wrap">
      <h2>チケット確認</h2>
      <?php if ($errorMessage): ?>
        <div class="error-message" style="color: red; padding: 10px; margin: 10px 0;">
          <?php echo htmlspecialchars($errorMessage); ?>
        </div>
      <?php else: ?>
      <div id="c_name"><?php echo htmlspecialchars($companyName); ?><span></span>様</div>
      <div id="c_plan"><?php echo htmlspecialchars($companyPlan); ?></div>
      <a id="open_total">プランに含まれるチケット枚数を確認</a>
      <div class="ticket_cont_available">
        <h3>残り利用可能枚数</h3>
        <ul id="ticket_item1">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo isset($ticketInfo['stem_cell']) ? $ticketInfo['stem_cell']['remaining'] : 0; ?></span>cc</li>
        </ul>
        <ul id="ticket_item2">
          <li>点滴・注射</li>
          <li><span><?php echo isset($ticketInfo['injection']) ? $ticketInfo['injection']['remaining'] : 0; ?></span>枚</li>
        </ul>
        <ul id="ticket_item3">
          <li>美容施術</li>
          <li><span><?php echo isset($ticketInfo['beauty']) ? $ticketInfo['beauty']['remaining'] : 0; ?></span>枚</li>
        </ul>
      </div>
      <div class="ticket_cont_reserve">
        <h3>予約済み枚数</h3>
        <ul id="ticket_item4">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo $reservedCounts['stem_cell']; ?></span>cc</li>
        </ul>
        <ul id="ticket_item5">
          <li>点滴・注射</li>
          <li><span><?php echo $reservedCounts['injection']; ?></span>枚</li>
        </ul>
        <ul id="ticket_item6">
          <li>美容施術</li>
          <li><span><?php echo $reservedCounts['beauty']; ?></span>枚</li>
        </ul>
		  <a id="open_reserved">利用詳細はこちら</a>
      </div>
      <div class="ticket_cont_used">
        <h3>来院済み枚数</h3>
        <p id="lastdate">最終利用日：<span><?php echo $lastUsedDate ? date('Y年n月j日', strtotime($lastUsedDate)) : '未使用'; ?></span></p>
        <ul id="ticket_item7">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo isset($ticketInfo['stem_cell']) ? $ticketInfo['stem_cell']['used'] : 0; ?></span>cc</li>
        </ul>
        <ul id="ticket_item8">
          <li>点滴・注射</li>
          <li><span><?php echo isset($ticketInfo['injection']) ? $ticketInfo['injection']['used'] : 0; ?></span>枚</li>
        </ul>
        <ul id="ticket_item9">
          <li>美容施術</li>
          <li><span><?php echo isset($ticketInfo['beauty']) ? $ticketInfo['beauty']['used'] : 0; ?></span>枚</li>
        </ul>
		  <a id="open_used">利用詳細はこちら</a>
      </div>
      <?php endif; ?>
    </div>
  </div>
</main>
<div id="modal_total">
  <div class="modal_wrap">
    <div class="modal_ttl">
      <h2>プランに含まれるチケット枚数</h2>
    </div>
    <div class="modal_cont">
      <ul>
        <li>幹細胞培養上清液点滴</li>
		  <li id="total_drip"><span><?php echo $planTotalTickets['stem_cell']; ?></span>cc</li>
      </ul>
      <ul>
        <li>点滴・注射</li>
		  <li id="total_injection"><span><?php echo $planTotalTickets['injection']; ?></span>枚</li>
      </ul>
      <ul>
        <li>美容施術</li>
		  <li id="total_beauty"><span><?php echo $planTotalTickets['beauty']; ?></span>枚</li>
      </ul>
	  <div class="modal_close">
		<button>閉じる</button>
	</div>
    </div>
  </div>
</div>
<div id="modal_reserved">
  <div class="modal_wrap">
    <div class="modal_ttl">
      <h2>予約済み枚数</h2>
    </div>
    <div class="modal_cont">
		<div class="modal_toggle_wrap">
		<?php
		$ticketTypes = [
		    'stem_cell' => '幹細胞培養上清液点滴',
		    'injection' => '点滴・注射',
		    'beauty' => '美容施術'
		];
		
		foreach ($ticketTypes as $type => $typeName): 
		    $reservations = $groupedReserved[$type] ?? [];
		    $count = count($reservations);
		?>
		<dl>
			<dt><?php echo htmlspecialchars($typeName); ?></dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $count; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
				    <?php if ($count > 0): ?>
				        <?php foreach ($reservations as $reservation): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo htmlspecialchars($reservation['patient_name'] ?? '名前不明'); ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo isset($reservation['date']) ? date('Y/m/d', strtotime($reservation['date'])) : ''; ?></p>
						            <p class="clock"><?php echo htmlspecialchars($reservation['time'] ?? ''); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo htmlspecialchars($reservation['menu_name'] ?? ''); ?></div>
							    <div class="reserved_detail1"><?php echo htmlspecialchars($reservation['category'] ?? ''); ?></div>
						    </div>
						    <?php if (!empty($reservation['notes'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo htmlspecialchars($reservation['notes']); ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				        <?php endforeach; ?>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo htmlspecialchars($typeName); ?>はありません。</p>
				    <?php endif; ?>
				</div>
			</dd>
		</dl>
		<?php endforeach; ?>
		</div>
	  <div class="modal_close">
		<button>閉じる</button>
	</div>
    </div>
</div></div>
<div id="modal_used">
  <div class="modal_wrap">
    <div class="modal_ttl">
      <h2>来院済み枚数</h2>
    </div>
    <div class="modal_cont">
		<div class="modal_toggle_wrap">
		<?php
		foreach ($ticketTypes as $type => $typeName): 
		    $reservations = $groupedUsed[$type] ?? [];
		    $count = count($reservations);
		?>
		<dl>
			<dt><?php echo htmlspecialchars($typeName); ?></dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $count; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
				    <?php if ($count > 0): ?>
				        <?php foreach ($reservations as $reservation): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo htmlspecialchars($reservation['patient_name'] ?? '名前不明'); ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo isset($reservation['date']) ? date('Y/m/d', strtotime($reservation['date'])) : ''; ?></p>
						            <p class="clock"><?php echo htmlspecialchars($reservation['time'] ?? ''); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo htmlspecialchars($reservation['menu_name'] ?? ''); ?></div>
							    <div class="reserved_detail1"><?php echo htmlspecialchars($reservation['category'] ?? ''); ?></div>
						    </div>
						    <?php if (!empty($reservation['notes'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo htmlspecialchars($reservation['notes']); ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				        <?php endforeach; ?>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo htmlspecialchars($typeName); ?>はありません。</p>
				    <?php endif; ?>
				</div>
			</dd>
		</dl>
		<?php endforeach; ?>
		</div>
	  <div class="modal_close">
		<button>閉じる</button>
	</div>
    </div>
</div></div>
<!-- Footer -->
<footer class="bg-slate-800 text-slate-400 text-center p-4 text-sm">
  <p>&copy; <span id="current-year"></span> CLUTIREFINEクリニック. All rights reserved.</p>
</footer>
<script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
	<script src="js/modal.js"></script>
<script type="text/javascript">
	$(document).ready(function() {
    // 初期状態でddを非表示
    $('.modal_toggle_wrap dd').hide();
    $('.modal_toggle_wrap dt').on('click', function() {
        const $dt = $(this);
        const $dd = $dt.next('dd');
        
        if ($dd.is(':visible')) {
            $dd.slideUp(300);
            $dt.removeClass('open');
        } else {
            $dd.slideDown(300);
            $dt.addClass('open');
        }
    });
});
</script>
</body>
</html>