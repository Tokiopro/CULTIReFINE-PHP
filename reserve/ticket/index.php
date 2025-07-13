<?php
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
$userData = $_SESSION['user_data'] ?? null;

// GAS APIからユーザー情報を取得
require_once __DIR__ . '/../line-auth/config.php';
require_once __DIR__ . '/../line-auth/GasApiClient.php';

$companyName = '';
$planName = '';
$stemCellBalance = 0;
$treatmentBalance = 0;
$dripBalance = 0;
$stemCellReserved = 0;
$treatmentReserved = 0;
$dripReserved = 0;
$stemCellUsed = 0;
$treatmentUsed = 0;
$dripUsed = 0;
$stemCellGranted = 0;
$treatmentGranted = 0;
$dripGranted = 0;
$lastUsedDate = '';

try {
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('=== GAS API Debug Start ===');
        error_log('Calling GAS API for user: ' . $lineUserId);
    }
    
    $fullUserInfo = $gasApi->getUserFullInfo($lineUserId);
    
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('GAS API Response received: ' . ($fullUserInfo ? 'YES' : 'NO'));
        if ($fullUserInfo) {
            error_log('Response status: ' . ($fullUserInfo['status'] ?? 'NO_STATUS'));
            error_log('Full API Response: ' . json_encode($fullUserInfo, JSON_PRETTY_PRINT));
        }
    }
    
    if ($fullUserInfo['status'] === 'success' && isset($fullUserInfo['data'])) {
        $data = $fullUserInfo['data'];
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('Data extraction started');
        }
        
        // 段階的にデータを確認・抽出
        if (isset($data['membership_info'])) {
            $membershipInfo = $data['membership_info'];
            
            // 会社名
            $companyName = $membershipInfo['company_name'] ?? '';
            
            // プラン名
            $planName = $membershipInfo['plan_name'] ?? '';
            
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('Company Name: ' . $companyName);
                error_log('Plan Name: ' . $planName);
            }
        
            // チケット残高
            if (isset($membershipInfo['ticket_balance'])) {
                $ticketBalance = $membershipInfo['ticket_balance'];
                
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('Ticket Balance Data: ' . json_encode($ticketBalance, JSON_PRETTY_PRINT));
                }
                
                $stemCellBalance = $ticketBalance['stem_cell']['balance'] ?? 0;
                $treatmentBalance = $ticketBalance['treatment']['balance'] ?? 0;
                $dripBalance = $ticketBalance['drip']['balance'] ?? 0;
                
                // 使用済み枚数
                $stemCellUsed = $ticketBalance['stem_cell']['used'] ?? 0;
                $treatmentUsed = $ticketBalance['treatment']['used'] ?? 0;
                $dripUsed = $ticketBalance['drip']['used'] ?? 0;
                
                // 付与枚数
                $stemCellGranted = $ticketBalance['stem_cell']['granted'] ?? 0;
                $treatmentGranted = $ticketBalance['treatment']['granted'] ?? 0;
                $dripGranted = $ticketBalance['drip']['granted'] ?? 0;
                
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('Stem Cell - Balance: ' . $stemCellBalance . ', Used: ' . $stemCellUsed . ', Granted: ' . $stemCellGranted);
                    error_log('Treatment - Balance: ' . $treatmentBalance . ', Used: ' . $treatmentUsed . ', Granted: ' . $treatmentGranted);
                    error_log('Drip - Balance: ' . $dripBalance . ', Used: ' . $dripUsed . ', Granted: ' . $dripGranted);
                }
            } else {
                if (defined('DEBUG_MODE') && DEBUG_MODE) {
                    error_log('ERROR: ticket_balance not found in membership_info');
                }
            }
        } else {
            if (defined('DEBUG_MODE') && DEBUG_MODE) {
                error_log('ERROR: membership_info not found in data');
            }
        }
        
        // 予約済み枚数の計算
        foreach ($data['upcoming_reservations'] ?? [] as $reservation) {
            switch ($reservation['treatment_id']) {
                case 'menu_幹細胞点滴':
                case 'menu_001':
                    $stemCellReserved++;
                    break;
                case 'menu_ビタミン点滴':
                case 'menu_002':
                    $treatmentReserved++;
                    break;
                case 'menu_ボトックス注射':
                case 'menu_003':
                    $dripReserved++;
                    break;
            }
        }
        
        // 最終利用日（変数スコープ修正）
        $lastDates = [];
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('=== Last Used Date Processing ===');
            error_log('ticketBalance variable exists: ' . (isset($ticketBalance) ? 'YES' : 'NO'));
        }
        if (isset($ticketBalance) && !empty($ticketBalance['stem_cell']['last_used_date'])) {
            $lastDates[] = strtotime($ticketBalance['stem_cell']['last_used_date']);
        }
        if (isset($ticketBalance) && !empty($ticketBalance['treatment']['last_used_date'])) {
            $lastDates[] = strtotime($ticketBalance['treatment']['last_used_date']);
        }
        if (isset($ticketBalance) && !empty($ticketBalance['drip']['last_used_date'])) {
            $lastDates[] = strtotime($ticketBalance['drip']['last_used_date']);
        }
        
        if (!empty($lastDates)) {
            $lastUsedDate = date('Y年n月j日', max($lastDates));
        }
    } else {
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log('ERROR: API response status is not success or data is missing');
            error_log('Response status: ' . ($fullUserInfo['status'] ?? 'UNKNOWN'));
            if (isset($fullUserInfo)) {
                error_log('Full error response: ' . json_encode($fullUserInfo, JSON_PRETTY_PRINT));
            }
        }
    }
} catch (Exception $e) {
    // エラー時はデフォルト値を使用
    error_log('GAS API Exception: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log('=== GAS API Debug End (Exception) ===');
    }
}

if (defined('DEBUG_MODE') && DEBUG_MODE) {
    error_log('=== Final Variable Values ===');
    error_log('Company Name: ' . ($companyName ?: 'EMPTY'));
    error_log('Plan Name: ' . ($planName ?: 'EMPTY'));
    error_log('Stem Cell Balance: ' . $stemCellBalance);
    error_log('Treatment Balance: ' . $treatmentBalance);
    error_log('Drip Balance: ' . $dripBalance);
    error_log('=== GAS API Debug End ===');
}

// 生のAPIレスポンス表示用の変数保存
$rawApiResponse = null;
if (defined('DEBUG_MODE') && DEBUG_MODE && isset($fullUserInfo)) {
    $rawApiResponse = $fullUserInfo;
}
?>
<!DOCTYPE html>
<!-- 
    CLUTIREFINEクリニック予約システム - HTML (修正版)
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
<link rel="stylesheet" href="../styles.css">
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
    <div class="flex items-center space-x-5">
        <span id="user-welcome" class="text-sm hidden sm:inline">ようこそ、
            <?php if ($pictureUrl): ?>
                <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image inline-block mr-1" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
            <?php endif; ?>
            <span id="user-name"><?php echo htmlspecialchars($displayName); ?></span>様
        </span>
        <a href="../" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="form-link">予約フォーム</a> 
        <a href="../document" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="docs-link">書類一覧</a> 
        <a href="../ticket" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="ticket-link">チケット確認</a>
    </div>
  </div>
</header>

<!-- Main Content -->
<main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-gray-500">
  <div class="container mx-auto px-0 sm:px-6">
    <div class="ticket_cont_wrap">
      <h2>チケット確認</h2>
      <div id="c_name"><?php echo htmlspecialchars($companyName ?: $displayName); ?><span></span>様</div>
      <div id="c_plan"><?php echo htmlspecialchars($planName ?: 'プラン未設定'); ?></div>
      <a id="open_total">プランに含まれるチケット枚数を確認</a>
      <div class="ticket_cont_available">
        <h3>残り利用可能枚数</h3>
        <ul id="ticket_item1">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo $stemCellBalance; ?></span>cc</li>
        </ul>
        <ul id="ticket_item2">
          <li>点滴・注射</li>
          <li><span><?php echo $treatmentBalance; ?></span>枚</li>
        </ul>
        <ul id="ticket_item3">
          <li>美容施術</li>
          <li><span><?php echo $dripBalance; ?></span>枚</li>
        </ul>
      </div>
      <div class="ticket_cont_reserve">
        <h3>予約済み枚数</h3>
        <ul id="ticket_item4">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo $stemCellReserved; ?></span>cc</li>
        </ul>
        <ul id="ticket_item5">
          <li>点滴・注射</li>
          <li><span><?php echo $treatmentReserved; ?></span>枚</li>
        </ul>
        <ul id="ticket_item6">
          <li>美容施術</li>
          <li><span><?php echo $dripReserved; ?></span>枚</li>
        </ul>
	  <a id="open_reserved">利用詳細はこちら</a>
      </div>
      <div class="ticket_cont_used">
        <h3>来院済み枚数</h3>
        <p id="lastdate">最終利用日：<span><?php echo $lastUsedDate ?: '未利用'; ?></span></p>
        <ul id="ticket_item7">
          <li>幹細胞培養上清液点滴</li>
          <li><span><?php echo $stemCellUsed; ?></span>cc</li>
        </ul>
        <ul id="ticket_item8">
          <li>点滴・注射</li>
          <li><span><?php echo $treatmentUsed; ?></span>枚</li>
        </ul>
        <ul id="ticket_item9">
          <li>美容施術</li>
          <li><span><?php echo $dripUsed; ?></span>枚</li>
        </ul>
	  <a id="open_used">利用詳細はこちら</a>
      </div>
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
	  <li id="total_drip"><span><?php echo $stemCellGranted; ?></span>cc</li>
      </ul>
      <ul>
        <li>点滴・注射</li>
	  <li id="total_injection"><span><?php echo $treatmentGranted; ?></span>枚</li>
      </ul>
      <ul>
        <li>美容施術</li>
	  <li id="total_beauty"><span><?php echo $dripGranted; ?></span>枚</li>
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
		<!-- ここはダミーのままですが、必要に応じてPHPで動的生成も可能です -->
		<dl>
			<dt>幹細胞培養上清液点滴</dt>
			<dd>（省略）</dd>
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
		<!-- ここもダミーのままですが、必要に応じてPHPで動的生成も可能です -->
		<dl>
			<dt>幹細胞培養上清液点滴</dt>
			<dd>（省略）</dd>
		</dl>
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
<script src="../js/modal.js"></script>
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
<!-- デバッグ情報（開発環境のみ） -->
<?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
    <div class="fixed bottom-4 right-4 bg-gray-800 text-white p-2 text-xs rounded max-w-sm max-h-96 overflow-y-auto">
        <p><strong>デバッグ情報</strong></p>
        <p>LINE ID: <?php echo substr($lineUserId, 0, 10); ?>...</p>
        <p>Session ID: <?php echo session_id(); ?></p>
        <hr class="my-2 border-gray-600">
        <p><strong>抽出された値:</strong></p>
        <p>Company: <?php echo htmlspecialchars($companyName ?: 'EMPTY'); ?></p>
        <p>Plan: <?php echo htmlspecialchars($planName ?: 'EMPTY'); ?></p>
        <p>Stem: <?php echo $stemCellBalance; ?> | <?php echo $stemCellUsed; ?> | <?php echo $stemCellGranted; ?></p>
        <p>Treatment: <?php echo $treatmentBalance; ?> | <?php echo $treatmentUsed; ?> | <?php echo $treatmentGranted; ?></p>
        <p>Drip: <?php echo $dripBalance; ?> | <?php echo $dripUsed; ?> | <?php echo $dripGranted; ?></p>
        
        <?php if ($rawApiResponse): ?>
        <hr class="my-2 border-gray-600">
        <p><strong>生のAPIレスポンス:</strong></p>
        <pre class="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-40"><?php echo htmlspecialchars(json_encode($rawApiResponse, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
        <?php else: ?>
        <hr class="my-2 border-gray-600">
        <p class="text-red-400"><strong>APIレスポンス:</strong> なし</p>
        <?php endif; ?>
    </div>
<?php endif; ?>
</body>
</html>