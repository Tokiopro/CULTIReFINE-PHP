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
<link rel="stylesheet" href="styles.css">
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
    <div class="flex items-center space-x-5"> <a href="../" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="form-link">予約フォーム</a> <a href="../document" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="docs-link">書類一覧</a> <a href="../ticket" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="ticket-link">チケット確認</a> </div>
  </div>
</header>

<!-- Main Content -->
<main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-gray-500">
  <div class="container mx-auto px-0 sm:px-6">
    <div class="ticket_cont_wrap">
      <h2>チケット確認</h2>
      <div id="c_name">株式会社ゆうメディカルサービス<span></span>様</div>
      <div id="c_plan">プラチナプラン</div>
      <a id="open_total">プランに含まれるチケット枚数を確認</a>
      <div class="ticket_cont_available">
        <h3>残り利用可能枚数</h3>
        <ul id="ticket_item1">
          <li>幹細胞培養上清液点滴</li>
          <li><span>3</span>cc</li>
        </ul>
        <ul id="ticket_item2">
          <li>点滴・注射</li>
          <li><span>3</span>枚</li>
        </ul>
        <ul id="ticket_item3">
          <li>美容施術</li>
          <li><span>1</span>枚</li>
        </ul>
      </div>
      <div class="ticket_cont_reserve">
        <h3>予約済み枚数</h3>
        <ul id="ticket_item4">
          <li>幹細胞培養上清液点滴</li>
          <li><span>0</span>cc</li>
        </ul>
        <ul id="ticket_item5">
          <li>点滴・注射</li>
          <li><span>3</span>枚</li>
        </ul>
        <ul id="ticket_item6">
          <li>美容施術</li>
          <li><span>1</span>枚</li>
        </ul>
		  <a id="open_reserved">利用詳細はこちら</a>
      </div>
      <div class="ticket_cont_used">
        <h3>来院済み枚数</h3>
        <p id="lastdate">最終利用日：<span>2025年6月10日</span></p>
        <ul id="ticket_item7">
          <li>幹細胞培養上清液点滴</li>
          <li><span>3</span>cc</li>
        </ul>
        <ul id="ticket_item8">
          <li>点滴・注射</li>
          <li><span>6</span>枚</li>
        </ul>
        <ul id="ticket_item9">
          <li>美容施術</li>
          <li><span>0</span>枚</li>
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
		  <li id="total_drip"><span>6</span>cc</li>
      </ul>
      <ul>
        <li>点滴・注射</li>
		  <li id="total_injection"><span>12</span>枚</li>
      </ul>
      <ul>
        <li>美容施術</li>
		  <li id="total_beauty"><span>2</span>枚</li>
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
		<dl>
			<dt>幹細胞培養上清液点滴</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: 3枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 太郎</p></div>
						<div class="reserved_date"><p class="calender">2025/05/15</p><p class="clock">10:30</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 初回施術</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>初回カウンセリング込み</p>
							</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 花子</p></div>
						<div class="reserved_date"><p class="calender">2025/05/20</p><p class="clock">14:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 継続施術</div>
						</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>佐藤　一郎</p></div>
						<div class="reserved_date"><p class="calender">2025/06/01</p><p class="clock">11:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫再生プレミア 1cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 法人プラン</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>役員向け特別プラン</p>
							</div>
					</div>
				</div>
			</dd>
		</dl>
		<dl>
			<dt>点滴・注射</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: 3枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 太郎</p></div>
						<div class="reserved_date"><p class="calender">2025/05/15</p><p class="clock">10:30</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 初回施術</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>初回カウンセリング込み</p>
							</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 花子</p></div>
						<div class="reserved_date"><p class="calender">2025/05/20</p><p class="clock">14:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 継続施術</div>
						</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>佐藤　一郎</p></div>
						<div class="reserved_date"><p class="calender">2025/06/01</p><p class="clock">11:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫再生プレミア 1cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 法人プラン</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>役員向け特別プラン</p>
							</div>
					</div>
				</div>
			</dd>
		</dl>
		<dl>
			<dt>美容施術</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: 3枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 太郎</p></div>
						<div class="reserved_date"><p class="calender">2025/05/15</p><p class="clock">10:30</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 初回施術</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>初回カウンセリング込み</p>
							</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 花子</p></div>
						<div class="reserved_date"><p class="calender">2025/05/20</p><p class="clock">14:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 継続施術</div>
						</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>佐藤　一郎</p></div>
						<div class="reserved_date"><p class="calender">2025/06/01</p><p class="clock">11:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫再生プレミア 1cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 法人プラン</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>役員向け特別プラン</p>
							</div>
					</div>
				</div>
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
		<dl>
			<dt>幹細胞培養上清液点滴</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: 3枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 太郎</p></div>
						<div class="reserved_date"><p class="calender">2025/05/15</p><p class="clock">10:30</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 初回施術</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>初回カウンセリング込み</p>
							</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 花子</p></div>
						<div class="reserved_date"><p class="calender">2025/05/20</p><p class="clock">14:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 継続施術</div>
						</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>佐藤　一郎</p></div>
						<div class="reserved_date"><p class="calender">2025/06/01</p><p class="clock">11:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫再生プレミア 1cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 法人プラン</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>役員向け特別プラン</p>
							</div>
					</div>
				</div>
			</dd>
		</dl>
		<dl>
			<dt>点滴・注射</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: 3枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 太郎</p></div>
						<div class="reserved_date"><p class="calender">2025/05/15</p><p class="clock">10:30</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 初回施術</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>初回カウンセリング込み</p>
							</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 花子</p></div>
						<div class="reserved_date"><p class="calender">2025/05/20</p><p class="clock">14:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 継続施術</div>
						</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>佐藤　一郎</p></div>
						<div class="reserved_date"><p class="calender">2025/06/01</p><p class="clock">11:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫再生プレミア 1cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 法人プラン</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>役員向け特別プラン</p>
							</div>
					</div>
				</div>
			</dd>
		</dl>
		<dl>
			<dt>美容施術</dt>
			<dd><div class="total_reserved"><span>総使用枚数</span>: 3枚<br>
				<small>※予約済みのチケットの詳細です。</small></div>
				<div class="reserved_wrap">
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 太郎</p></div>
						<div class="reserved_date"><p class="calender">2025/05/15</p><p class="clock">10:30</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 初回施術</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>初回カウンセリング込み</p>
							</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>田中 花子</p></div>
						<div class="reserved_date"><p class="calender">2025/05/20</p><p class="clock">14:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫活力インフィニティ 3cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 継続施術</div>
						</div>
					</div>
					<div class="reserved_item">
						<div class="reserved_datename">
						<div class="reserved_name"><p>佐藤　一郎</p></div>
						<div class="reserved_date"><p class="calender">2025/06/01</p><p class="clock">11:00</p></div>
						</div>
						<div class="reserved_details">
							<div class="reserved_detail1">施術内容</div>
							<div class="reserved_ttl">免疫再生プレミア 1cc</div>
							<div class="reserved_detail1">幹細胞培養上清点滴 - 法人プラン</div>
						</div>
						<div class="reserved_moreinfo">
							<p>備考</p>
							<p>役員向け特別プラン</p>
							</div>
					</div>
				</div>
			</dd>
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