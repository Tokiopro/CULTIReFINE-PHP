# 患者別メニュー表示API仕様書

## 概要
患者の来院履歴とチケット残高に基づいて、利用可能なメニューを初回/リピート、通常/チケット制で分類して表示するAPIです。

## エンドポイント
```
GET /api/patients/{visitorId}/menus
```

## リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| path | string | ◯ | "api/patients/{visitorId}/menus" |
| api_key | string | ◯ | APIキー |
| company_id | string | - | 会社ID（会社患者の場合） |

### パラメータ詳細

#### visitorId（URLパス内）
- 患者の一意識別子
- URLのパスに含める（例: api/patients/12345/menus）

#### company_id
- 会社所属患者の場合に指定
- チケット残高の取得に使用

## レスポンス形式

### 成功時 (200 OK)
```json
{
  "status": "success",
  "data": {
    "patient_info": {
      "visitor_id": "12345",
      "name": "山田太郎",
      "company_id": "comp_001",
      "member_type": "main"
    },
    "visit_history": {
      "has_visits": true,
      "last_visit_date": "2025-01-10",
      "visit_count": 3,
      "check_period": "過去6ヶ月"
    },
    "ticket_balance": {
      "stem_cell": 5,
      "treatment": 10,
      "drip": 3
    },
    "menu_categories": {
      "first_time_menus": {
        "regular": [
          {
            "menu_id": "menu_001",
            "menu_name": "初回カウンセリング",
            "category": "カウンセリング",
            "duration_minutes": 60,
            "price": 0,
            "requires_ticket": false,
            "ticket_type": null,
            "description": "初回の方向けの無料カウンセリング"
          }
        ],
        "ticket_based": [
          {
            "menu_id": "menu_002",
            "menu_name": "初回幹細胞治療",
            "category": "幹細胞治療",
            "duration_minutes": 90,
            "price": 50000,
            "requires_ticket": true,
            "ticket_type": "stem_cell",
            "ticket_consumption": 1,
            "is_available": true,
            "availability_reason": "チケット残高: 5枚",
            "description": "初回限定の幹細胞治療プラン"
          }
        ]
      },
      "repeat_menus": {
        "regular": [
          {
            "menu_id": "menu_101",
            "menu_name": "通常診察",
            "category": "診察",
            "duration_minutes": 30,
            "price": 3000,
            "requires_ticket": false,
            "ticket_type": null,
            "description": "一般的な診察メニュー"
          }
        ],
        "ticket_based": [
          {
            "menu_id": "menu_102",
            "menu_name": "幹細胞メンテナンス",
            "category": "幹細胞治療",
            "duration_minutes": 60,
            "price": 30000,
            "requires_ticket": true,
            "ticket_type": "stem_cell",
            "ticket_consumption": 1,
            "is_available": true,
            "availability_reason": "チケット残高: 5枚",
            "description": "継続的な幹細胞治療"
          }
        ]
      }
    },
    "recommended_category": "first_time_menus"
  }
}
```

### エラー時
```json
{
  "status": "error",
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "指定された患者が見つかりません",
    "details": "visitor_id: 12345"
  }
}
```

## レスポンスデータ詳細

### patient_info
- `visitor_id`: 患者ID
- `name`: 患者名（姓名結合）
- `company_id`: 所属会社ID（該当する場合）
- `member_type`: 会員種別（main/sub）

### visit_history
- `has_visits`: 過去6ヶ月以内の来院有無
- `last_visit_date`: 最終来院日
- `visit_count`: 来院回数
- `check_period`: チェック対象期間

### ticket_balance
- `stem_cell`: 幹細胞チケット残数
- `treatment`: 施術チケット残数
- `drip`: 点滴チケット残数

### menu_categories
メニューは以下の4カテゴリに分類されます：

1. **first_time_menus.regular**: 初回・通常メニュー
2. **first_time_menus.ticket_based**: 初回・チケット制メニュー
3. **repeat_menus.regular**: リピート・通常メニュー
4. **repeat_menus.ticket_based**: リピート・チケット制メニュー

### メニュー情報
- `menu_id`: メニューID
- `menu_name`: メニュー名
- `category`: カテゴリ名
- `duration_minutes`: 所要時間（分）
- `price`: 価格
- `requires_ticket`: チケット必要フラグ
- `ticket_type`: 必要なチケット種別
- `ticket_consumption`: 消費チケット数
- `is_available`: 利用可能フラグ（チケット制の場合）
- `availability_reason`: 利用可否の理由

## PHPサンプルコード

### 基本的な使用例
```php
<?php
$visitor_id = '12345';
$api_key = 'your_api_key_here';

$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$params = [
    'path' => "api/patients/{$visitor_id}/menus",
    'api_key' => $api_key
];

$query_string = http_build_query($params);
$full_url = $url . '?' . $query_string;

$response = file_get_contents($full_url);
$result = json_decode($response, true);

if ($result['status'] === 'success') {
    $data = $result['data'];
    echo "患者名: " . $data['patient_info']['name'] . "\n\n";
    
    // 来院履歴の表示
    if ($data['visit_history']['has_visits']) {
        echo "最終来院日: " . $data['visit_history']['last_visit_date'] . "\n";
        echo "来院回数: " . $data['visit_history']['visit_count'] . "回\n\n";
    } else {
        echo "初回来院の方\n\n";
    }
    
    // 推奨カテゴリのメニューを表示
    $recommended = $data['recommended_category'];
    echo "推奨メニュー: " . ($recommended === 'first_time_menus' ? '初回' : 'リピート') . "\n";
    
} else {
    echo "エラー: " . $result['error']['message'];
}
?>
```

### メニュー一覧表示の例
```php
<?php
function displayMenus($menus, $title) {
    echo "<h3>{$title}</h3>";
    echo "<table border='1'>";
    echo "<tr><th>メニュー名</th><th>時間</th><th>価格</th><th>チケット</th></tr>";
    
    foreach ($menus as $menu) {
        echo "<tr>";
        echo "<td>{$menu['menu_name']}</td>";
        echo "<td>{$menu['duration_minutes']}分</td>";
        echo "<td>¥" . number_format($menu['price']) . "</td>";
        
        if ($menu['requires_ticket']) {
            $ticket_text = "{$menu['ticket_type']} ({$menu['ticket_consumption']}枚)";
            if (isset($menu['is_available'])) {
                $ticket_text .= $menu['is_available'] ? " ✓" : " ✗";
            }
            echo "<td>{$ticket_text}</td>";
        } else {
            echo "<td>-</td>";
        }
        echo "</tr>";
    }
    echo "</table>";
}

// API呼び出し
$visitor_id = '12345';
$company_id = 'comp_001';
$api_key = 'your_api_key_here';

$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$params = [
    'path' => "api/patients/{$visitor_id}/menus",
    'api_key' => $api_key,
    'company_id' => $company_id
];

$query_string = http_build_query($params);
$full_url = $url . '?' . $query_string;

$response = file_get_contents($full_url);
$result = json_decode($response, true);

if ($result['status'] === 'success') {
    $data = $result['data'];
    
    // チケット残高表示
    if (!empty($data['ticket_balance'])) {
        echo "<h2>チケット残高</h2>";
        echo "幹細胞: {$data['ticket_balance']['stem_cell']}枚<br>";
        echo "施術: {$data['ticket_balance']['treatment']}枚<br>";
        echo "点滴: {$data['ticket_balance']['drip']}枚<br>";
    }
    
    // 推奨カテゴリに基づいてメニュー表示
    if ($data['recommended_category'] === 'first_time_menus') {
        echo "<h2>初回の方向けメニュー</h2>";
        displayMenus($data['menu_categories']['first_time_menus']['regular'], "通常メニュー");
        displayMenus($data['menu_categories']['first_time_menus']['ticket_based'], "チケット制メニュー");
    } else {
        echo "<h2>リピーターの方向けメニュー</h2>";
        displayMenus($data['menu_categories']['repeat_menus']['regular'], "通常メニュー");
        displayMenus($data['menu_categories']['repeat_menus']['ticket_based'], "チケット制メニュー");
    }
    
    // その他のメニューも表示可能
    echo "<h2>その他のメニュー</h2>";
    if ($data['recommended_category'] === 'first_time_menus') {
        displayMenus($data['menu_categories']['repeat_menus']['regular'], "リピート通常メニュー");
        displayMenus($data['menu_categories']['repeat_menus']['ticket_based'], "リピートチケット制メニュー");
    } else {
        displayMenus($data['menu_categories']['first_time_menus']['regular'], "初回通常メニュー");
        displayMenus($data['menu_categories']['first_time_menus']['ticket_based'], "初回チケット制メニュー");
    }
    
} else {
    echo "エラー: " . $result['error']['message'];
}
?>
```

## 注意事項

1. **来院履歴の判定**: 過去6ヶ月以内の来院履歴で初回/リピートを判定
2. **チケット残高**: 会社所属患者の場合のみチケット情報が含まれる
3. **メニュー分類**: システムが自動的に4カテゴリに分類
4. **推奨カテゴリ**: 来院履歴に基づいて推奨カテゴリを提示
5. **チケット可用性**: チケット制メニューでは残高チェックが自動実行