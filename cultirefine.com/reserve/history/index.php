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

// GAS APIから書類一覧を取得
require_once __DIR__ . '/../line-auth/config.php';
require_once __DIR__ . '/../line-auth/GasApiClient.php';

$companyId = '';
$companyName = '';
$memberType = 'サブ会員';
$reservations = [];
$errorMessage = '';

try {
  $gasApi = new GasApiClient( GAS_DEPLOYMENT_ID, GAS_API_KEY );

  // 1. ユーザー情報を取得して会社情報を確認
  $userInfo = $gasApi->getUserFullInfo( $lineUserId );

  if ( $userInfo[ 'status' ] === 'success' && isset( $userInfo[ 'data' ][ 'company' ] ) && isset( $userInfo[ 'data' ][ 'visitor' ] ) ) {
    $companyData = $userInfo[ 'data' ][ 'company' ];
    $visitorData = $userInfo[ 'data' ][ 'visitor' ];

    // 会社情報を取得
    if ( isset( $companyData[ 'company_id' ] ) && !empty( $companyData[ 'company_id' ] ) ) {
      $companyId = $companyData[ 'company_id' ];
      $companyName = $companyData[ 'name' ] ?? '不明';

      // member_typeを判定（visitor.member_typeがtrueなら本会員）
      $isMemberType = $visitorData[ 'member_type' ] ?? false;
      $memberType = $isMemberType ? 'main' : 'sub';

      // 予約履歴がレスポンスに含まれている場合は直接使用
      if ( isset( $userInfo[ 'data' ][ 'ReservationHistory' ] ) ) {
        // ReservationHistoryのフィールド名をマッピング
        $rawReservations = $userInfo[ 'data' ][ 'ReservationHistory' ];
        $reservations = [];

        foreach ( $rawReservations as $reservation ) {
          $reservations[] = [
            'history_id' => $reservation[ 'history_id' ] ?? '',
            'reservename' => $reservation[ 'reservename' ] ?? '',
            'reservedate' => $reservation[ 'reservedate' ] ?? '',
            'reservetime' => $reservation[ 'reservetime' ] ?? '',
            'reservestatus' => $reservation[ 'reservestatus' ] ?? '',
            'reservepatient' => $reservation[ 'reservepatient' ] ?? '',
            'patient_id' => $reservation[ 'patient_id' ] ?? '',
            'reservestatus' => $reservation[ 'reservestatus' ] ?? '',
            'patient_name' => $reservation[ 'patient_name' ] ?? '',
            'company_name' => $reservation[ 'company_name' ] ?? '',
            'notes' => $reservation[ 'notes' ] ?? ''
          ];
        }
        // デバッグログ
        if ( defined( 'DEBUG_MODE' ) && DEBUG_MODE ) {
          error_log( 'Company ID: ' . $companyId );
          error_log( 'Member Type: ' . $memberType );
          error_log( 'Reservations from getUserFullInfo: ' . count( $reservations ) );
          if ( count( $rawReservations ) > 0 ) {
            error_log( 'Sample reservation data: ' . json_encode( $rawReservations[ 0 ] ) );
          }
        }
      } else {
        // 予約履歴を別途取得（必要な場合）
        $currentDate = date( 'Y-m-d' );
        $historyResponse = $gasApi->getReservationHistory( $memberType, $currentDate, $companyId );

        if ( $historyResponse[ 'status' ] === 'success' ) {
          $reservations = $historyResponse[ 'data' ][ 'reservations' ] ?? [];

          // デバッグログ
          if ( defined( 'DEBUG_MODE' ) && DEBUG_MODE ) {
            error_log( 'Company ID: ' . $companyId );
            error_log( 'Member Type: ' . $memberType );
            error_log( 'Reservations count: ' . count( $reservations ) );
          }
        } else {
          $errorMessage = '予約履歴の取得に失敗しました: ' . ( $historyResponse[ 'message' ] ?? 'Unknown error' );
        }
      }
    } else {
      $errorMessage = '会社情報が見つかりません。管理者にお問い合わせください。';
    }
  } else {
    $errorMessage = 'ユーザー情報の取得に失敗しました: ' . ( $userInfo[ 'message' ] ?? 'Unknown error' );
  }
} catch ( Exception $e ) {
  $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
  error_log( 'Reservation history error: ' . $e->getMessage() );
}
// 日付フォーマット関数
function displayReserveTime($reservetime, $timezone = 'Asia/Tokyo', $format = 'H:i') {
    // 空チェック
    if (empty($reservetime)) {
        return '未設定';
    }
    try {
        $date = new DateTime($reservetime);
        $date->setTimezone(new DateTimeZone($timezone));
        return $date->format($format);
    } catch (Exception $e) {
        // エラーログ出力（本番環境では適切なログ処理を）
        error_log("時間変換エラー: " . $reservetime);
        return '時間取得エラー';
    }
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
<title>CLUTIREFINEクリニック 予約履歴一覧</title>
<meta name="description" content="CLUTIREFINEクリニックの予約履歴一覧">
<!-- Tailwind CSS CDN --> 
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="../assets/css/hamburger.css">
</head>
<body>
<!-- Header -->
<header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
<div class="container mx-auto flex justify-between items-center">
<h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">
  予約履歴一覧</h1>
<?php
include_once '../assets/inc/navigation.php'; // header.phpの内容を読み込む
?>
</header>

<!-- Main Content -->
<main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-gray-100">
  <?php /*if (isset($userInfo)): ?>
<div style="background: #f0f0f0; padding: 10px; margin: 10px; overflow: auto;">
  <h3>デバッグ情報</h3>
  <pre><?php echo json_encode($userInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); ?></pre>
</div>
  <?php endif; */?>
  <div class="container mx-auto px-0 sm:px-6">
    <div class="his_cont_wrap">
      <h2>予約履歴一覧<br>
        <small><?php echo htmlspecialchars($companyName); ?> の予約履歴です。 </small></h2>
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
              <option value="予約済み">予約済み</option>
              <option value="キャンセル済み">キャンセル済み</option>
              <option value="来院済み">来院済み</option>
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
         data-reservation-id="<?php echo htmlspecialchars($reservation['history_id']); ?>"
         data-visitor-name="<?php echo htmlspecialchars($reservation['patient_name']); ?>"
         data-status="<?php echo htmlspecialchars($reservation['reservestatus']); ?>"
         data-menu="<?php echo htmlspecialchars($reservation['reservename']); ?>"
         data-date="<?php echo htmlspecialchars($reservation['reservedate']); ?>"
         data-time="<?php echo displayReserveTime($reservation['reservetime']); ?>"
         data-memo="<?php echo htmlspecialchars($reservation['notes'] ?? ''); ?>">
      <div class="his_cont_detail">
        <div class="his_cont_detail_status"><span class="status-<?php echo $reservation['reservestatus'] === '予約済み' ? 'reserved' : ($reservation['reservestatus'] === '来院済み' ? 'completed' : 'canceled'); ?>"><?php echo htmlspecialchars($reservation['reservestatus']); ?></span></div>
        <div class="his_cont_detail_menu"><?php echo htmlspecialchars($reservation['reservename']); ?></div>
        <div class="his_cont_detail_date_wrap">
          <div class="his_cont_detail_date_item">
            <p class="his_ttl calender">予約日時</p>
            <p class="his_date"><?php echo htmlspecialchars($reservation['reservedate']); ?> <?php echo displayReserveTime($reservation['reservetime']); ?></p>
          </div>
          <div class="his_cont_detail_date_item">
            <p class="his_ttl pin">クリニック名</p>
            <p class="his_date">CULTIRE FINEクリニック</p>
          </div>
        </div>
        <div class="his_cont_detail_visiter">
          <p class="his_ttl">来院者</p>
          <p class="his_visiter_name"><?php echo htmlspecialchars($reservation['patient_name']); ?><?php if ($reservation['is_public'] === false && $memberType === '本会員'): ?><span class="text-sm text-gray-500">(非公開)</span><?php endif; ?></p>
        </div>
		  <div class="his_cont_detail_bottom">
        <div class="his_cont_detail_reserver">
          <p class="his_ttl">メモ</p>
          <p class="his_name"><?php echo htmlspecialchars($reservation['notes'] ?: 'なし'); ?></p>
        </div>
        <button class="open_modal">予約詳細を見る</button>
			  </div>
		  <div class="his_cont_detail_resid">予約ID：<span><?php echo htmlspecialchars($reservation['history_id']); ?></span></div>
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
        <p id="menu"></p>
      </div>
      <div class="modal_date">
        <h3>予約日時</h3>
        <p id="reservedate"></p>
      </div>
      <div class="modal_clinic_wrap">
        <h3>クリニック情報</h3>
        <h4>CUTIREFINEクリニック</h4>
        <p class="item_name pin">所在地</p>
        <p>大阪府大阪市北区万歳町３−１６ 天満病院グループ梅田ビル1・2階</p>
        <a href="https://g.co/kgs/4fBEpLw" target="_blank" class="mb-2 maplink">Googleマップで見る</a>
        <p class="item_name tel">電話番号</p>
        <p>06-6366-5880</p>
      </div>
      <div class="modal_patient_wrap">
        <h3>来院者情報</h3>
        <p id="patient_name"></p>
      </div>
       <div id="message" class="message"></div>
        <ul class="change_reserve" style="display: flex;">
            <li>
                <button class="cancel" id="cancelBtn">予約をキャンセル</button>
                <span class="loading" id="loading">処理中...</span>
            </li>
        </ul>
		<div class="rid">予約ID：<span id="reservationId"></span></div>
    </div>
  </div>
</div>
<!-- Footer -->
<?php
include_once '../assets/inc/footer.php'; // footer.phpの内容を読み込む
?>
<script src="./js/filter.js"></script>
<script src="./js/modal.js"></script>
<script src="./js/cancel.js"></script>
</body>
</html>
