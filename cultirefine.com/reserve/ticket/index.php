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
    
    // キャッシュデータがPOSTされているか確認
    $userInfo = null;
    if (isset($_POST['cached_data']) && !empty($_POST['cached_data'])) {
        error_log('[Ticket Page] Using cached data from sessionStorage');
        $cachedData = json_decode($_POST['cached_data'], true);
        if ($cachedData && isset($cachedData['data'])) {
            // キャッシュデータを使用
            $userInfo = [
                'status' => 'success',
                'data' => $cachedData['data']
            ];
        }
    }
    
    // キャッシュがない場合はAPIから取得
    if (!$userInfo) {
        error_log('[Ticket Page] Fetching user info for LINE ID: ' . $lineUserId);
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
    }
    
    if (isset($userInfo['status']) && $userInfo['status'] === 'success' && isset($userInfo['data'])) {
		// 会員情報情報（新形式対応）
        $membershipInfo = $userInfo['data']['companyVisitors'] ?? null;
		if ($membershipInfo) {
            $memberType = $membershipInfo[0]['memberType'] ?? null;
        }
        // 会社情報（新形式対応）
        $companyData = $userInfo['data']['company'] ?? null;
        if ($companyData) {
            $companyName = $companyData['name'] ?? $companyData['company_name'] ?? '';
            $companyPlan = $companyData['plan'] ?? '';
        } else {
            // 旧形式との後方互換性
            $companyName = $userInfo['data']['membership_info']['company_name'] ?? '';
            $companyPlan = $userInfo['data']['membership_info']['plan'] ?? '';
        }
        
        // チケット情報を取得（新形式対応）
        $tickets = $userInfo['data']['ticketInfo'] ?? [];
        
        // チケット使用履歴を取得（新形式対応）
        $ticketHistory = $userInfo['data']['ticketHistory'] ?? [];
        
        // デバッグ: チケット情報の構造を確認
        if (DEBUG_MODE && !empty($tickets)) {
            error_log('[Ticket Page] Ticket data structure: ' . json_encode($tickets));
        }
        
        // チケット情報を種類別に整理
        foreach ($tickets as $ticket) {
            switch ($ticket['treatment_id']) {
                case 'stem_cell':
                    $tickets['stem_cell'] = [
                        'name' => '幹細胞培養上清液点滴',
                        'remaining' => $ticket['remaining_count'] ?? 0,
                        'used' => $ticket['used_count'] ?? 0,
                        'available' => $ticket['available_count'] ?? 0,
                        'granted' => $ticket['granted_count'] ?? 0,
                        'last_used' => $ticket['last_used_date'] ?? null
                    ];
                    break;
                case 'treatment':
                    $tickets['beauty'] = [
                        'name' => '美容施術',
                        'remaining' => $ticket['remaining_count'] ?? 0,
                        'used' => $ticket['used_count'] ?? 0,
                        'available' => $ticket['available_count'] ?? 0,
                        'granted' => $ticket['granted_count'] ?? 0,
                        'last_used' => $ticket['last_used_date'] ?? null
                    ];
                    break;
                case 'drip':
                    $tickets['injection'] = [
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
foreach ($tickets as $info) {
    if ($info['last_used_date'] && (!$lastUsedDate || $info['last_used_date'] > $lastUsedDate)) {
        $lastUsedDate = $info['last_used_date'];
    }
}

// 予約済み・来院済みの予約を分類
$reservedTickets = [];
$visitedTickets = [];
$reservedCounts = [
    'stem_cell' => 0,
    'injection' => 0,
    'beauty' => 0
];
$visitedCounts = [
    'stem_cell' => 0,
    'injection' => 0,
    'beauty' => 0
];

foreach ($ticketHistory as $ticketsHis) {
    // 新形式のフィールド名に対応
    $status = $ticketsHis['status'] ?? '';
    $menuName = $ticketsHis['menu_name'] ?? '';
    
    // 予約データを統一形式に変換
    $normalizedReservation = [
		'reservation_date' => $ticketsHis['reservation_date'],//予約時間
			'company_id' => $ticketsHis['company_id'],//会社ID
			'menu_name' => $ticketsHis['menu_name'],//メニュー名
			'reservation_id' => $ticketsHis['reservation_id'],//予約ID
			'status' => $ticketsHis['status'],//ステータス
			'ticket_category' => $ticketsHis['ticket_category'],//チケットカテゴリ
			'ticket_count' => $ticketsHis['ticket_count'],//チケット消費数
			'visitor_name' => $ticketsHis['visitor_name'],//来院者名
			'note' => $ticketsHis['note']//備考
    ];
    
    if ($status === '予約済み') {
        $reservedTicketInfo[] = $normalizedReservation;
        // メニュータイプに基づいてカウント
        // TODO: 実際のメニューとチケットタイプのマッピングが必要
    } else if ($status === '来院済み') {
        $visitedTicketInfo[] = $normalizedReservation;
    }
}

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
        <h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">チケット管理</h1>
        
        <!-- デスクトップ: ユーザー情報とナビゲーション -->
            <?php include_once '../assets/inc/navigation.php'; ?>
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
      <div id="c_name"><?php echo htmlspecialchars($companyName); ?>様</div>
      <div id="c_plan"><?php echo htmlspecialchars($companyPlan); ?></div>
      <a id="open_total">プランに含まれるチケット枚数を確認</a>
      <div class="ticket_cont_available">
        <h3>残り利用可能枚数</h3>
        <ul id="ticket_item1">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo isset($tickets['stem_cell']) ? $tickets['stem_cell']['remaining'] : 0; ?></span>cc</li>
        </ul>
        <ul id="ticket_item2">
          <li>点滴・注射</li>
          <li><span><?php echo isset($tickets['injection']) ? $tickets['injection']['remaining'] : 0; ?></span>枚</li>
        </ul>
        <ul id="ticket_item3">
          <li>美容施術</li>
          <li><span><?php echo isset($tickets['beauty']) ? $tickets['beauty']['remaining'] : 0; ?></span>枚</li>
        </ul>
      </div>
		<?php if($memberType === 'main'): ?>
		<?php
// カテゴリー別カウント初期化
$stemCellReservedCount = 0;
$injectionReservedCount = 0;
$beautyReservedCount = 0;

// 配列をループしてカウント
foreach ($reservedTicketInfo as $item) {
    if ($item['ticket_category'] === "幹細胞培養上清液点滴") {
        $stemCellReservedCount += $item['ticket_count'];
    } elseif ($item['ticket_category'] === "点滴・注射") {
        $injectionReservedCount += $item['ticket_count'];
    } elseif ($item['ticket_category'] === "美容施術") {
        $beautyReservedCount += $item['ticket_count'];
    }
}
?>
      <div class="ticket_cont_reserve">
        <h3>予約済み枚数</h3>
        <ul id="ticket_item4">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo $stemCellReservedCount; ?></span>cc</li>
        </ul>
        <ul id="ticket_item5">
          <li>点滴・注射</li>
          <li><span><?php echo $injectionReservedCount; ?></span>枚</li>
        </ul>
        <ul id="ticket_item6">
          <li>美容施術</li>
          <li><span><?php echo $beautyReservedCount; ?></span>枚</li>
        </ul>
		  <a id="open_reserved">利用詳細はこちら</a>
      </div>
		<?php
// カテゴリー別カウント初期化
$stemCellVisitedCount = 0;
$injectionVisitedCount = 0;
$beautyVisitedCount = 0;

// 配列をループしてカウント
foreach ($visitedTicketInfo as $item) {
    if ($item['ticket_category'] === "幹細胞培養上清液点滴") {
        $stemCellVisitedCount += $item['ticket_count'];
    } elseif ($item['ticket_category'] === "点滴・注射") {
        $injectionVisitedCount += $item['ticket_count'];
    } elseif ($item['ticket_category'] === "美容施術") {
        $beautyVisitedCount += $item['ticket_count'];
    }
}

    // 全ての予約日を取得
    $dates = array_column($visitedTicketInfo, 'reservation_date');
    
    // 一番古い日付を取得
    $oldestDate = min($dates);
    
    // 日付をフォーマットして表示（例：2025年8月1日）
    $formattedDate = date('Y年n月j日', strtotime($oldestDate));
?>
      <div class="ticket_cont_used">
        <h3>来院済み枚数</h3>
        <p id="lastdate">最終利用日：<span><?php // $visitedTicketInfoが空でない場合の処理
if (!empty($visitedTicketInfo)) {echo $formattedDate;} else { // 配列が空の場合
    echo "未利用";
} ?></span></p>
        <ul id="ticket_item7">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo $stemCellVisitedCount; ?></span>cc</li>
        </ul>
        <ul id="ticket_item8">
          <li>点滴・注射</li>
          <li><span><?php echo $injectionVisitedCount; ?></span>枚</li>
        </ul>
        <ul id="ticket_item9">
          <li>美容施術</li>
          <li><span><?php echo $beautyVisitedCount; ?></span>枚</li>
        </ul>
		  <a id="open_used">利用詳細はこちら</a>
      </div>
		<?php else: endif; ?>
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
		  <li id="total_drip"><span><?php echo ($tickets['stem_cell']['remaining'] ?? 0) + ($tickets['stem_cell']['used'] ?? 0); ?></span>cc</li>
      </ul>
      <ul>
        <li>点滴・注射</li>
		  <li id="total_injection"><span><?php echo ($tickets['injection']['remaining'] ?? 0) + ($tickets['injection']['used'] ?? 0); ?></span>枚</li>
      </ul>
      <ul>
        <li>美容施術</li>
		  <li id="total_beauty"><span><?php echo ($tickets['beauty']['remaining'] ?? 0) + ($tickets['beauty']['used'] ?? 0); ?></span>枚</li>
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
// カテゴリー別に情報を格納する配列
$stemCellReservedItems = [];
$injectionReservedItems = [];
$beautyReservedItems = [];

// 配列をループして各カテゴリーに分類
foreach ($reservedTicketInfo as $item) {
    if ($item['ticket_category'] === "幹細胞培養上清液点滴") {
        $stemCellReservedItems[] = $item;
    } elseif ($item['ticket_category'] === "点滴・注射") {
        $injectionReservedItems[] = $item;
    } elseif ($item['ticket_category'] === "美容施術") {
        $beautyReservedItems[] = $item;
    }
}
?><dl><dt>幹細胞培養上清液点滴</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $stemCellReservedCount; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<?php foreach ($stemCellReservedItems as $item): ?>
				<div class="reserved_wrap">
				    <?php if ($stemCellReservedCount > 0): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo $item['visitor_name']; ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo date('Y年m月d日 H:i', strtotime($item['reservation_date'])); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo $item['menu_name']; ?></div>
						    </div>
						    <?php if (!empty($item['note'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo $item['note']; ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo $item['ticket_category']; ?>はありません。</p>
				    <?php endif; ?>
				</div>
				<?php endforeach; ?>
			</dd>
		</dl>
			<dl><dt>点滴・注射</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $injectionReservedCount; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<?php foreach ($injectionReservedItems as $item): ?>
				<div class="reserved_wrap">
				    <?php if ($injectionReservedCount > 0): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo $item['visitor_name']; ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo date('Y年m月d日 H:i', strtotime($item['reservation_date'])); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo $item['menu_name']; ?></div>
						    </div>
						    <?php if (!empty($item['note'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo $item['note']; ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo $item['ticket_category']; ?>はありません。</p>
				    <?php endif; ?>
				</div>
				<?php endforeach; ?>
			</dd>
		</dl>
			<dl><dt>美容施術</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $beautyReservedCount; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<?php foreach ($beautyReservedItems as $item): ?>
				<div class="reserved_wrap">
				    <?php if ($beautyReservedCount > 0): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo $item['visitor_name']; ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo date('Y年m月d日 H:i', strtotime($item['reservation_date'])); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo $item['menu_name']; ?></div>
						    </div>
						    <?php if (!empty($item['note'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo $item['note']; ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo $item['ticket_category']; ?>はありません。</p>
				    <?php endif; ?>
				</div>
				<?php endforeach; ?>
			</dd>
		</dl>
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
// カテゴリー別に情報を格納する配列
$stemCellVisitedItems = [];
$injectionVisitedItems = [];
$beautyVisitedItems = [];

// 配列をループして各カテゴリーに分類
foreach ($visitedTicketInfo as $item) {
    if ($item['ticket_category'] === "幹細胞培養上清液点滴") {
        $stemCellIVisitedtems[] = $item;
    } elseif ($item['ticket_category'] === "点滴・注射") {
        $injectionVisitedItems[] = $item;
    } elseif ($item['ticket_category'] === "美容施術") {
        $beautyVisitedItems[] = $item;
    }
}
?>
		<dl>
			<dt>幹細胞培養上清液点滴</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $stemCellVisitedCount; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<?php foreach ($stemCellIVisitedtems as $item): ?>
				<div class="reserved_wrap">
				    <?php if ($stemCellVisitedCount > 0): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo $item['visitor_name']; ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo date('Y年m月d日 H:i', strtotime($item['reservation_date'])); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo $item['menu_name']; ?></div>
						    </div>
						    <?php if (!empty($item['note'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo $item['note']; ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo $item['ticket_category']; ?>はありません。</p>
				    <?php endif; ?>
				</div>
				<?php endforeach; ?>
			</dd>
		</dl>
			<dl>
			<dt>点滴・注射</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $injectionVisitedCount; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<?php foreach ($injectionVisitedItems as $item): ?>
				<div class="reserved_wrap">
				    <?php if ($injectionVisitedCount > 0): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo $item['visitor_name']; ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo date('Y年m月d日 H:i', strtotime($item['reservation_date'])); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo $item['menu_name']; ?></div>
						    </div>
						    <?php if (!empty($item['note'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo $item['note']; ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo $item['ticket_category']; ?>はありません。</p>
				    <?php endif; ?>
				</div>
				<?php endforeach; ?>
			</dd>
		</dl>
			<dl>
			<dt>美容施術</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: <?php echo $beautyVisitedCount; ?>枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<?php foreach ($beautyVisitedItems as $item): ?>
				<div class="reserved_wrap">
				    <?php if ($beautyVisitedCount > 0): ?>
					    <div class="reserved_item">
						    <div class="reserved_datename">
						        <div class="reserved_name"><p><?php echo $item['visitor_name']; ?></p></div>
						        <div class="reserved_date">
						            <p class="calender"><?php echo date('Y年m月d日 H:i', strtotime($item['reservation_date'])); ?></p>
						        </div>
						    </div>
						    <div class="reserved_details">
							    <div class="reserved_detail1">施術内容</div>
							    <div class="reserved_ttl"><?php echo $item['menu_name']; ?></div>
						    </div>
						    <?php if (!empty($item['note'])): ?>
						    <div class="reserved_moreinfo">
							    <p>備考</p>
							    <p><?php echo $item['note']; ?></p>
						    </div>
						    <?php endif; ?>
					    </div>
				    <?php else: ?>
				        <p style="padding: 10px; text-align: center; color: #666;">予約された<?php echo $item['ticket_category']; ?>はありません。</p>
				    <?php endif; ?>
				</div>
				<?php endforeach; ?>
			</dd>
		</dl>
		</div>
	  <div class="modal_close">
		<button>閉じる</button>
	</div>
    </div>
</div></div>
<!-- Footer -->
<?php include_once '../assets/inc/footer.php'; ?>
	<script src="js/modal.js"></script>
	<?php /*if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
    <div class="fixed bottom-4 right-4 bg-gray-800 text-white p-2 text-xs rounded max-w-sm max-h-96 overflow-y-auto">
        <p><strong>書類一覧デバッグ情報</strong></p>
        <p>LINE ID: <?php echo substr($lineUserId, 0, 10); ?>...</p>
        <p>Session ID: <?php echo session_id(); ?></p>
        <hr class="my-2 border-gray-600">
        <p>Visitor ID: <?php echo $visitorId ? substr($visitorId, 0, 15) . '...' : 'なし'; ?></p>
        <p>書類件数: <?php echo $reservation; ?>件</p>
		<?php echo "<pre>";
var_dump($reservedTicketInfo);
echo "</pre>";
?>
		<?php echo "<pre>";
var_dump($visitedTicketInfo);
echo "</pre>";
?>
        <p>エラー: <?php echo $errorMessage ?: 'なし'; ?></p>
        <?php if (!empty($folders)): ?>
        <hr class="my-2 border-gray-600">
        <p><strong>フォルダデータ:</strong></p>
        <pre class="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-32"><?php echo htmlspecialchars(json_encode($folders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
        <?php endif; ?>
    </div>
<?php endif; */?>
<script type="text/javascript">
// sessionStorageキャッシュ確認
(function() {
    // POSTデータが既に送信されている場合はスキップ
    <?php if (isset($_POST['cached_data'])): ?>
    return;
    <?php endif; ?>
    
    // LINE USER IDを取得
    const lineUserId = '<?php echo htmlspecialchars($lineUserId); ?>';
    const cacheKey = 'userFullInfo_' + lineUserId;
    
    try {
        // キャッシュを確認
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            const { data, timestamp } = parsedData;
            
            // 30分以内のデータかチェック
            const maxAge = 30 * 60 * 1000; // 30分
            const age = Date.now() - timestamp;
            
            if (age < maxAge && data) {
                console.log('[Ticket Page] Found valid cache, using cached data');
                
                // フォームを作成してPOST
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = window.location.href;
                
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'cached_data';
                input.value = JSON.stringify({ data: data });
                
                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
                return;
            } else {
                console.log('[Ticket Page] Cache expired, will fetch from API');
                sessionStorage.removeItem(cacheKey);
            }
        }
    } catch (error) {
        console.error('[Ticket Page] Error reading cache:', error);
    }
})();

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
    
    // APIから新しいデータを取得した場合はキャッシュに保存
    <?php if (!isset($_POST['cached_data']) && isset($userInfo['data'])): ?>
    try {
        const lineUserId = '<?php echo htmlspecialchars($lineUserId); ?>';
        const cacheKey = 'userFullInfo_' + lineUserId;
        const cacheData = {
            data: <?php echo json_encode($userInfo['data']); ?>,
            timestamp: Date.now()
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('[Ticket Page] Saved API data to cache');
    } catch (error) {
        console.error('[Ticket Page] Error saving to cache:', error);
    }
    <?php endif; ?>
});
</script>
</body>
</html>