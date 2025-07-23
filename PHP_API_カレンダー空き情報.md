# カレンダー空き情報API仕様書

## 概要
患者の施術間隔制限、ペア部屋予約、同日複数予約などの条件を考慮して、予約可能な時間枠を提供するAPIです。

## エンドポイント
```
GET /api/patients/{visitorId}/available-slots
```

## リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| path | string | ◯ | "api/patients/{visitorId}/available-slots" |
| api_key | string | ◯ | APIキー |
| menu_id | string | ◯ | メニューID |
| date | string | ◯ | 開始日（YYYY-MM-DD） |
| date_range | integer | - | 日付範囲（日数、デフォルト7日） |
| include_room_info | boolean | - | 部屋情報含有（デフォルトfalse） |
| pair_booking | boolean | - | ペア予約（デフォルトfalse） |
| allow_multiple_same_day | boolean | - | 同日複数予約許可（デフォルトfalse） |

### パラメータ詳細

#### date_range
- 検索する日数範囲（1-30）
- デフォルト: 7日
- 開始日から指定日数分の空き状況を取得

#### include_room_info
- true: 各スロットに利用可能な部屋情報を含める
- false: 部屋情報を省略（パフォーマンス向上）

#### pair_booking
- true: ペア予約可能な時間枠のみ表示
- false: 通常の単独予約

#### allow_multiple_same_day
- true: 同日に複数予約可能
- false: 同日は1予約のみ（デフォルト）

## レスポンス形式

### 成功時 (200 OK)
```json
{
  "status": "success",
  "data": {
    "patient_info": {
      "visitor_id": "12345",
      "name": "山田太郎"
    },
    "menu_info": {
      "menu_id": "menu_001",
      "menu_name": "幹細胞治療",
      "duration_minutes": 90,
      "required_room_type": "treatment"
    },
    "search_criteria": {
      "start_date": "2025-01-20",
      "end_date": "2025-01-27",
      "date_range_days": 7,
      "pair_booking": false,
      "allow_multiple_same_day": false
    },
    "treatment_interval_rules": {
      "has_restrictions": true,
      "minimum_days_between_treatments": 14,
      "last_treatment_date": "2025-01-05",
      "next_available_date": "2025-01-19"
    },
    "available_slots": [
      {
        "date": "2025-01-20",
        "day_of_week": "月",
        "slots": [
          {
            "start_time": "09:00",
            "end_time": "10:30",
            "duration_minutes": 90,
            "is_available": true,
            "room_info": {
              "room_id": "room_001",
              "room_name": "治療室A",
              "room_type": "treatment",
              "equipment": ["幹細胞培養器", "モニター"]
            },
            "restrictions": {
              "treatment_interval_ok": true,
              "same_day_limit_ok": true,
              "pair_room_available": true
            }
          },
          {
            "start_time": "14:00",
            "end_time": "15:30",
            "duration_minutes": 90,
            "is_available": false,
            "unavailable_reason": "既に予約済み",
            "room_info": null,
            "restrictions": {
              "treatment_interval_ok": true,
              "same_day_limit_ok": true,
              "pair_room_available": false
            }
          }
        ]
      }
    ],
    "summary": {
      "total_available_slots": 2,
      "available_days": 2,
      "earliest_available": "2025-01-20 09:00",
      "restrictions_applied": [
        "treatment_interval",
        "room_availability"
      ]
    }
  }
}
```

### エラー時
```json
{
  "status": "error",
  "error": {
    "code": "TREATMENT_INTERVAL_VIOLATION",
    "message": "施術間隔制限により予約できません",
    "details": "前回施術から14日経過していません。次回予約可能日: 2025-01-19"
  }
}
```

## レスポンスデータ詳細

### treatment_interval_rules
施術間隔ルールの適用状況：
- `has_restrictions`: 制限有無
- `minimum_days_between_treatments`: 最小間隔日数
- `last_treatment_date`: 前回施術日
- `next_available_date`: 次回予約可能日

### available_slots
各日付の予約可能スロット：
- `date`: 日付
- `day_of_week`: 曜日
- `slots`: 時間枠の配列

### スロット情報
- `start_time`: 開始時刻
- `end_time`: 終了時刻
- `duration_minutes`: 所要時間
- `is_available`: 予約可能フラグ
- `unavailable_reason`: 予約不可理由（不可の場合）
- `room_info`: 部屋情報（include_room_info=trueの場合）
- `restrictions`: 制約チェック結果

### restrictions（制約チェック）
- `treatment_interval_ok`: 施術間隔OK
- `same_day_limit_ok`: 同日制限OK
- `pair_room_available`: ペア部屋利用可

## PHPサンプルコード

### 基本的な使用例
```php
<?php
$visitor_id = '12345';
$menu_id = 'menu_001';
$date = '2025-01-20';
$api_key = 'your_api_key_here';

$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$params = [
    'path' => "api/patients/{$visitor_id}/available-slots",
    'api_key' => $api_key,
    'menu_id' => $menu_id,
    'date' => $date,
    'date_range' => 7,
    'include_room_info' => true
];

$query_string = http_build_query($params);
$full_url = $url . '?' . $query_string;

$response = file_get_contents($full_url);
$result = json_decode($response, true);

if ($result['status'] === 'success') {
    $data = $result['data'];
    
    // 施術間隔チェック
    if ($data['treatment_interval_rules']['has_restrictions']) {
        echo "施術間隔: {$data['treatment_interval_rules']['minimum_days_between_treatments']}日\n";
        echo "前回施術: {$data['treatment_interval_rules']['last_treatment_date']}\n";
        echo "次回可能: {$data['treatment_interval_rules']['next_available_date']}\n\n";
    }
    
    // 空き状況表示
    echo "空き状況（{$data['menu_info']['menu_name']}）\n";
    foreach ($data['available_slots'] as $day) {
        echo "\n{$day['date']} ({$day['day_of_week']})\n";
        foreach ($day['slots'] as $slot) {
            if ($slot['is_available']) {
                $room = $slot['room_info']['room_name'] ?? '未定';
                echo "  ✓ {$slot['start_time']}-{$slot['end_time']} [{$room}]\n";
            }
        }
    }
    
    echo "\n合計: {$data['summary']['total_available_slots']}枠\n";
    
} else {
    echo "エラー: " . $result['error']['message'] . "\n";
    if (isset($result['error']['details'])) {
        echo "詳細: " . $result['error']['details'] . "\n";
    }
}
?>
```

### カレンダー形式での表示例
```php
<?php
function displayCalendar($availableSlots) {
    echo "<style>
        .calendar { border-collapse: collapse; width: 100%; }
        .calendar th, .calendar td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        .calendar th { background-color: #f2f2f2; }
        .available { background-color: #90EE90; cursor: pointer; }
        .unavailable { background-color: #FFB6C1; }
    </style>";
    
    echo "<table class='calendar'>";
    echo "<tr><th>日付</th><th>曜日</th><th>空き状況</th></tr>";
    
    foreach ($availableSlots as $day) {
        $availableCount = 0;
        $timeSlots = [];
        
        foreach ($day['slots'] as $slot) {
            if ($slot['is_available']) {
                $availableCount++;
                $timeSlots[] = $slot['start_time'];
            }
        }
        
        echo "<tr>";
        echo "<td>{$day['date']}</td>";
        echo "<td>{$day['day_of_week']}</td>";
        
        if ($availableCount > 0) {
            echo "<td class='available'>";
            echo "空き {$availableCount}枠<br>";
            echo "<small>" . implode(', ', array_slice($timeSlots, 0, 3));
            if (count($timeSlots) > 3) echo " ...";
            echo "</small>";
        } else {
            echo "<td class='unavailable'>満席</td>";
        }
        echo "</tr>";
    }
    echo "</table>";
}

// ペア予約対応の検索例
$visitor_id = '12345';
$menu_id = 'menu_001';
$date = date('Y-m-d'); // 今日から検索
$api_key = 'your_api_key_here';

$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$params = [
    'path' => "api/patients/{$visitor_id}/available-slots",
    'api_key' => $api_key,
    'menu_id' => $menu_id,
    'date' => $date,
    'date_range' => 14, // 2週間分
    'include_room_info' => true,
    'pair_booking' => true, // ペア予約
    'allow_multiple_same_day' => false
];

$query_string = http_build_query($params);
$full_url = $url . '?' . $query_string;

$response = file_get_contents($full_url);
$result = json_decode($response, true);

if ($result['status'] === 'success') {
    $data = $result['data'];
    
    echo "<h2>{$data['menu_info']['menu_name']} - ペア予約可能枠</h2>";
    echo "<p>検索期間: {$data['search_criteria']['start_date']} ～ {$data['search_criteria']['end_date']}</p>";
    
    displayCalendar($data['available_slots']);
    
    // ペア予約可能な具体的な時間を表示
    echo "<h3>予約可能時間詳細</h3>";
    foreach ($data['available_slots'] as $day) {
        $pairSlots = array_filter($day['slots'], function($slot) {
            return $slot['is_available'] && 
                   $slot['restrictions']['pair_room_available'];
        });
        
        if (!empty($pairSlots)) {
            echo "<h4>{$day['date']} ({$day['day_of_week']})</h4>";
            echo "<ul>";
            foreach ($pairSlots as $slot) {
                echo "<li>{$slot['start_time']}-{$slot['end_time']} ";
                echo "({$slot['room_info']['room_name']})</li>";
            }
            echo "</ul>";
        }
    }
    
} else {
    echo "<div style='color: red;'>";
    echo "エラー: " . $result['error']['message'] . "<br>";
    if ($result['error']['code'] === 'TREATMENT_INTERVAL_VIOLATION') {
        echo "詳細: " . $result['error']['details'];
    }
    echo "</div>";
}
?>
```

## エラーコード

| コード | 説明 |
|--------|------|
| INVALID_REQUEST | 必須パラメータ不足 |
| PATIENT_NOT_FOUND | 患者が見つからない |
| MENU_NOT_FOUND | メニューが見つからない |
| INVALID_DATE_RANGE | 日付範囲が無効（1-30日） |
| TREATMENT_INTERVAL_VIOLATION | 施術間隔制限違反 |
| NO_AVAILABLE_SLOTS | 指定期間に空き枠なし |

## 注意事項

1. **施術間隔**: メニューごとに設定された最小間隔日数を自動チェック
2. **ペア予約**: 隣接する部屋が同時に空いている時間のみ表示
3. **同日制限**: デフォルトでは同日複数予約不可
4. **パフォーマンス**: date_rangeが大きいと処理時間増加
5. **部屋情報**: include_room_info=falseでレスポンスサイズ削減可能