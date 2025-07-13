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
<title>CLUTIREFINEクリニック 書類一覧</title>
<meta name="description" content="CLUTIREFINEクリニックの書類一覧">
<!-- Tailwind CSS CDN --> 
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<!-- Header -->
<header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
  <div class="container mx-auto flex justify-between items-center">
    <h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">
      書類一覧</h1>
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
    <div class="doc_cont_wrap">
      <h2>書類一覧</h2>
      <div id="doc_cont_item1" class="doc_cont_item">
        <div class="doc_cont_detail">
          <div class="doc_cont_detail_name">
            <p class="doc_ttl">書類名</p>
            <p id="doc_name1" class="doc_name">プラセンタ説明・同意書.pdf</p>
          </div>
          <div class="doc_cont_detail_date">
            <p class="doc_ttl">作成日</p>
            <p id="doc_date1" class="doc_date">2025年6月10日</p>
          </div>
        </div>
        <div class="doc_link_wrap"> <a id="doc1" class="doc_link" href="#"><span>プレビューを見る</span></a> </div>
      </div>
      <div id="doc_cont_item2" class="doc_cont_item">
        <div class="doc_cont_detail">
          <div class="doc_cont_detail_name">
            <p class="doc_ttl">書類名</p>
            <p id="doc_name2" class="doc_name">プラセンタ説明・同意書.pdf</p>
          </div>
          <div class="doc_cont_detail_date">
            <p class="doc_ttl">作成日</p>
            <p id="doc_date2" class="doc_date">2025年6月10日</p>
          </div>
        </div>
        <div class="doc_link_wrap"> <a id="doc2" class="doc_link" href="#"><span>プレビューを見る</span></a> </div>
      </div>
      <div id="doc_cont_item3" class="doc_cont_item">
        <div class="doc_cont_detail">
          <div class="doc_cont_detail_name">
            <p class="doc_ttl">書類名</p>
            <p id="doc_name3" class="doc_name">プラセンタ説明・同意書.pdf</p>
          </div>
          <div class="doc_cont_detail_date">
            <p class="doc_ttl">作成日</p>
            <p id="doc_date3" class="doc_date">2025年6月10日</p>
          </div>
        </div>
        <div class="doc_link_wrap"> <a id="doc3" class="doc_link" href="#"><span>プレビューを見る</span></a> </div>
      </div>
      <div id="doc_cont_item4" class="doc_cont_item">
        <div class="doc_cont_detail">
          <div class="doc_cont_detail_name">
            <p class="doc_ttl">書類名</p>
            <p id="doc_name4" class="doc_name">プラセンタ説明・同意書.pdf</p>
          </div>
          <div class="doc_cont_detail_date">
            <p class="doc_ttl">作成日</p>
            <p id="doc_date4" class="doc_date">2025年6月10日</p>
          </div>
        </div>
        <div class="doc_link_wrap"> <a id="doc4" class="doc_link" href="#"><span>プレビューを見る</span></a> </div>
      </div>
    </div>
  </div>
</main>

<!-- Footer -->
<footer class="bg-slate-800 text-slate-400 text-center p-4 text-sm">
  <p>&copy; <span id="current-year"></span> CLUTIREFINEクリニック. All rights reserved.</p>
</footer>

<!-- デバッグ情報（開発環境のみ） -->
<?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
    <div class="fixed bottom-4 right-4 bg-gray-800 text-white p-2 text-xs rounded">
        <p>LINE ID: <?php echo substr($lineUserId, 0, 10); ?>...</p>
        <p>Session ID: <?php echo session_id(); ?></p>
    </div>
<?php endif; ?>
</body>
</html>