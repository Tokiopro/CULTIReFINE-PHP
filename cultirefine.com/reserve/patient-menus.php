<?php
/**
 * 患者別メニュー表示
 * 来院者選択後、その患者専用のメニューを表示するためのスタンドアロンページ
 */

session_start();

// 認証チェック
if (!isset($_SESSION['line_user_id'])) {
    header('Location: /reserve/');
    exit;
}

require_once 'line-auth/config.php';
require_once 'line-auth/GasApiClient.php';

// パラメータ取得
$visitorId = $_GET['visitor_id'] ?? '';
$companyId = $_GET['company_id'] ?? '';
$bookingType = $_GET['booking_type'] ?? 'single'; // single, pair, bulk

if (empty($visitorId)) {
    die('来院者IDが指定されていません');
}

// メニューデータを取得
$gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
$result = $gasApi->getPatientMenus($visitorId, $companyId);

$menuData = [];
$visitorInfo = [];
$companyInfo = [];
$ticketBalance = [];

if ($result['status'] === 'success') {
    $data = $result['data'];
    $visitorInfo = $data['visitor'] ?? [];
    $companyInfo = $data['company'] ?? [];
    $ticketBalance = $data['ticketBalance'] ?? [];
    $menuData = $data['menus'] ?? [];
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>メニュー選択 - 天満病院予約システム</title>
    <link rel="stylesheet" href="assets/css/styles.css">
    <style>
        .menu-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .visitor-info {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .visitor-info h2 {
            margin-top: 0;
            color: #333;
        }
        
        .ticket-balance {
            display: flex;
            gap: 15px;
            margin-top: 10px;
        }
        
        .ticket-item {
            background-color: #e7f3ff;
            padding: 8px 15px;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .menu-category {
            margin-bottom: 30px;
        }
        
        .menu-category h3 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        
        .menu-subcategory {
            margin-bottom: 20px;
            margin-left: 15px;
        }
        
        .menu-subcategory h4 {
            color: #34495e;
            margin-bottom: 10px;
        }
        
        .menu-items {
            margin-left: 20px;
        }
        
        .menu-item {
            background-color: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .menu-item:hover {
            border-color: #3498db;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .menu-item.disabled {
            background-color: #f5f5f5;
            cursor: not-allowed;
            opacity: 0.6;
        }
        
        .menu-item.disabled:hover {
            border-color: #ddd;
            box-shadow: none;
        }
        
        .menu-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        
        .menu-item-name {
            font-weight: bold;
            color: #2c3e50;
        }
        
        .menu-item-price {
            color: #e74c3c;
            font-weight: bold;
        }
        
        .menu-item-details {
            display: flex;
            gap: 15px;
            font-size: 14px;
            color: #7f8c8d;
        }
        
        .menu-item-duration {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .menu-item-usage {
            color: #16a085;
        }
        
        .menu-item-unavailable {
            color: #e74c3c;
            font-size: 14px;
            margin-top: 8px;
        }
        
        .ticket-required {
            background-color: #fff3cd;
            color: #856404;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 13px;
        }
        
        .action-buttons {
            margin-top: 30px;
            text-align: center;
        }
        
        .btn {
            padding: 10px 30px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        
        .btn-primary {
            background-color: #3498db;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #2980b9;
        }
        
        .btn-secondary {
            background-color: #95a5a6;
            color: white;
            margin-left: 10px;
        }
        
        .btn-secondary:hover {
            background-color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="menu-container">
        <!-- 来院者情報 -->
        <div class="visitor-info">
            <h2>来院者: <?php echo htmlspecialchars($visitorInfo['name'] ?? '名前なし'); ?></h2>
            <?php if (!empty($companyInfo)): ?>
                <p>会社: <?php echo htmlspecialchars($companyInfo['name']); ?> (<?php echo htmlspecialchars($companyInfo['plan']); ?>)</p>
                <?php if (!empty($ticketBalance)): ?>
                    <div class="ticket-balance">
                        <strong>チケット残数:</strong>
                        <?php foreach ($ticketBalance as $type => $count): ?>
                            <div class="ticket-item">
                                <?php echo htmlspecialchars($type); ?>: <?php echo $count; ?>枚
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        
        <!-- メニュー表示 -->
        <div class="menu-list">
            <?php if (empty($menuData)): ?>
                <p>利用可能なメニューがありません。</p>
            <?php else: ?>
                <?php foreach ($menuData as $majorCategory => $middleCategories): ?>
                    <div class="menu-category">
                        <h3><?php echo htmlspecialchars($majorCategory); ?></h3>
                        
                        <?php foreach ($middleCategories as $middleCategory => $smallCategories): ?>
                            <div class="menu-subcategory">
                                <h4><?php echo htmlspecialchars($middleCategory); ?></h4>
                                
                                <?php foreach ($smallCategories as $smallCategory => $menus): ?>
                                    <div class="menu-group">
                                        <h5><?php echo htmlspecialchars($smallCategory); ?></h5>
                                        <div class="menu-items">
                                            <?php foreach ($menus as $menu): ?>
                                                <div class="menu-item <?php echo !$menu['canReserve'] ? 'disabled' : ''; ?>" 
                                                     data-menu-id="<?php echo htmlspecialchars($menu['id']); ?>"
                                                     data-can-reserve="<?php echo $menu['canReserve'] ? 'true' : 'false'; ?>">
                                                    <div class="menu-item-header">
                                                        <span class="menu-item-name"><?php echo htmlspecialchars($menu['name']); ?></span>
                                                        <?php if (isset($menu['ticketType'])): ?>
                                                            <span class="ticket-required">
                                                                <?php echo htmlspecialchars($menu['ticketType']); ?>チケット: <?php echo $menu['requiredTickets']; ?>枚
                                                            </span>
                                                        <?php else: ?>
                                                            <span class="menu-item-price">¥<?php echo number_format($menu['price']); ?></span>
                                                        <?php endif; ?>
                                                    </div>
                                                    <div class="menu-item-details">
                                                        <span class="menu-item-duration">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <polyline points="12 6 12 12 16 14"></polyline>
                                                            </svg>
                                                            <?php echo $menu['duration']; ?>分
                                                        </span>
                                                        <?php if ($menu['usageCount'] > 0): ?>
                                                            <span class="menu-item-usage">
                                                                利用回数: <?php echo $menu['usageCount']; ?>回
                                                            </span>
                                                        <?php endif; ?>
                                                    </div>
                                                    <?php if (!$menu['canReserve'] && !empty($menu['reason'])): ?>
                                                        <div class="menu-item-unavailable">
                                                            ※ <?php echo htmlspecialchars($menu['reason']); ?>
                                                            <?php if (!empty($menu['nextAvailableDate'])): ?>
                                                                (次回予約可能日: <?php 
                                                                    $date = new DateTime($menu['nextAvailableDate']);
                                                                    echo $date->format('Y年m月d日');
                                                                ?>)
                                                            <?php endif; ?>
                                                        </div>
                                                    <?php endif; ?>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        
        <!-- アクションボタン -->
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="proceedToCalendar()">カレンダーへ進む</button>
            <button class="btn btn-secondary" onclick="history.back()">戻る</button>
        </div>
    </div>
    
    <script>
        // 選択されたメニュー情報を保存
        let selectedMenus = [];
        
        // メニューアイテムのクリックイベント
        document.querySelectorAll('.menu-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', function() {
                const menuId = this.getAttribute('data-menu-id');
                const isSelected = this.classList.contains('selected');
                
                if (isSelected) {
                    this.classList.remove('selected');
                    selectedMenus = selectedMenus.filter(id => id !== menuId);
                } else {
                    // 予約タイプによって選択可能数を制限
                    const bookingType = '<?php echo $bookingType; ?>';
                    if (bookingType === 'single' && selectedMenus.length >= 1) {
                        alert('単体予約では1つのメニューのみ選択できます。');
                        return;
                    }
                    
                    this.classList.add('selected');
                    selectedMenus.push(menuId);
                }
            });
        });
        
        // カレンダーへ進む
        function proceedToCalendar() {
            if (selectedMenus.length === 0) {
                alert('メニューを選択してください。');
                return;
            }
            
            // 選択したメニュー情報をセッションストレージに保存
            sessionStorage.setItem('selectedMenus', JSON.stringify(selectedMenus));
            sessionStorage.setItem('visitorId', '<?php echo $visitorId; ?>');
            sessionStorage.setItem('bookingType', '<?php echo $bookingType; ?>');
            
            // カレンダー画面へ遷移
            window.location.href = '/reserve/calendar.php';
        }
    </script>
    
    <style>
        .menu-item.selected {
            background-color: #e7f3ff;
            border-color: #3498db;
        }
    </style>
</body>
</html>