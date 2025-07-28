<nav>
    <ul id="header-menu" class="bg-teal-600">
		<li><span id="user-welcome" class="text-sm ">ようこそ、
  <?php if ($pictureUrl): ?>
  <img src="<?php echo htmlspecialchars($pictureUrl); ?>" alt="プロフィール画像" class="profile-image inline-block mr-1" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
  <?php endif; ?>
  <span id="user-name"><?php echo htmlspecialchars($displayName); ?></span>様 </span></li>
      <li><a href="https://cultirefine.com/reserve/" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="form-link">予約フォーム</a></li>
      <li><a href="https://cultirefine.com/reserve/document" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="docs-link">書類一覧</a></li>
      <li><a href="https://cultirefine.com/reserve/ticket" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="ticket-link">チケット確認</a></li>
      <li><a href="https://cultirefine.com/reserve/history" target="_blank" rel="noopener noreferrer" class="text-white hover:underline flex items-center text-sm" id="reserve-history">予約履歴</a></li>
    </ul>
    <div id="hamburger" class="hamburger"> <span></span><span></span><span></span> </div>
  </nav>