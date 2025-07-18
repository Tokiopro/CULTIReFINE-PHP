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
$companyId = '';
$reservationDetails = [];
$errorMessage = '';
$params = [];
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
  <div class="container mx-auto px-0 sm:px-6">
    <div class="his_cont_wrap">
      <h2>予約履歴一覧<br>
        <small>法人アカウント全体の予約履歴です。</small></h2>
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
              <option value="reserved">予約済み</option>
              <option value="canceled">キャンセル済み</option>
              <option value="visited">来院済み</option>
            </select>
          </div>
          <div class="sort_item">
            <input class="sort_input" type="reset" value="クリア">
          </div>
        </form>
      </div>
    </div>
	<?php if (empty($params) && empty($errorMessage)): ?>
		<p>予約がありません</p>
		<?php else: ?>
	<?php foreach ($params as $index => $$param): ?>
    <div id="history_item<?php echo $index + 1; ?>" class="history_item">
      <div class="his_cont_detail">
        <div class="his_cont_detail_status"><span>キャンセル済み</span></div>
        <div class="his_cont_detail_menu">初回カウンセリング</div>
        <div class="his_cont_detail_date_wrap">
          <div class="his_cont_detail_date_item">
            <p class="his_ttl calender">予約日時</p>
            <p id="his_date1" class="his_date">2025/06/18 16:00</p>
          </div>
          <div class="his_cont_detail_date_item">
            <p class="his_ttl pin">クリニック名</p>
            <p id="his_place1" class="his_date">CUTIREFINEクリニック</p>
          </div>
        </div>
        <div class="his_cont_detail_visiter">
          <p class="his_ttl">来院者</p>
          <p id="his_name1" class="his_visiter_name">高橋 健太<span class="relationship">(家族)</span></p>
        </div>
        <div class="his_cont_detail_reserver">
          <p class="his_ttl">予約者</p>
          <p id="his_name1" class="his_name">田中 太郎</p>
        </div>
        <button class="open_modal">予約詳細を見る</button></div>
    </div>
		<?php endforeach; ?>
		<?php endif; ?>
    <!--<div id="history_item2" class="history_item">
      <div class="his_cont_detail">
        <div class="his_cont_detail_status"><span>予約済み</span></div>
        <div class="his_cont_detail_menu">免疫再生プレミア1cc(初回)</div>
        <div class="his_cont_detail_date_wrap">
          <div class="his_cont_detail_date_item">
            <p class="his_ttl calender">予約日時</p>
            <p id="his_date2" class="his_date">2025/06/18 16:00</p>
          </div>
          <div class="his_cont_detail_date_item">
            <p class="his_ttl pin">クリニック名</p>
            <p id="his_place2" class="his_date">CUTIREFINEクリニック</p>
          </div>
        </div>
        <div class="his_cont_detail_visiter">
          <p class="his_ttl">来院者</p>
          <p id="his_name2" class="his_visiter_name">田中 太郎<span class="relationship">(家族)</span></p>
        </div>
        <div class="his_cont_detail_reserver">
          <p class="his_ttl">予約者</p>
          <p id="his_name2" class="his_name">田中 太郎</p>
        </div>
		  <button class="open_modal">予約詳細を見る</button>
      </div>
    </div>
    <div id="history_item3" class="history_item">
      <div class="his_cont_detail">
        <div class="his_cont_detail_status"><span>来院済み</span></div>
        <div class="his_cont_detail_menu">美容施術A(サンプル)</div>
        <div class="his_cont_detail_date_wrap">
          <div class="his_cont_detail_date_item">
            <p class="his_ttl calender">予約日時</p>
            <p id="his_date3" class="his_date">2025/06/18 16:00</p>
          </div>
          <div class="his_cont_detail_date_item">
            <p class="his_ttl pin">クリニック名</p>
            <p id="his_place3" class="his_date">CUTIREFINEクリニック</p>
          </div>
        </div>
        <div class="his_cont_detail_visiter">
          <p class="his_ttl">来院者</p>
          <p id="his_name3" class="his_visiter_name">佐藤 愛美<span class="relationship">(家族)</span></p>
        </div>
        <div class="his_cont_detail_reserver">
          <p class="his_ttl">予約者</p>
          <p id="his_name3" class="his_name">佐藤 愛美</p>
        </div>
		  <button class="open_modal">予約詳細を見る</button>
      </div>
    </div>-->
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
	<?php
  include_once '../assets/inc/footer.php'; // footer.phpの内容を読み込む
?>
<script src="./js/filter.js"></script> 
<script src="./js/modal.js"></script>
</body>
</html>
