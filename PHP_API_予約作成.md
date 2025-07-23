# 予約作成API仕様書

## 概要
Medical Force APIとの連携により予約を作成し、同時にGASのスプレッドシートにもリアルタイムで反映するAPIです。

## エンドポイント
```
POST /api/reservations
```

## リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| path | string | ◯ | "api/reservations" |
| api_key | string | ◯ | APIキー |
| visitor_id | string | ◯ | 患者ID |
| menu_id | string | ◯ | メニューID |
| reservation_date | string | ◯ | 予約日（YYYY-MM-DD） |
| start_time | string | ◯ | 開始時間（HH:MM） |
| end_time | string | ◯ | 終了時間（HH:MM） |
| room_id | string | - | 部屋ID（指定しない場合は自動割当） |
| booker_name | string | ◯ | 予約者名 |
| booker_phone | string | - | 予約者電話番号 |
| booker_email | string | - | 予約者メールアドレス |
| is_pair_booking | boolean | - | ペア予約フラグ（デフォルトfalse） |
| pair_visitor_id | string | - | ペア相手の患者ID（ペア予約時必須） |
| notes | string | - | 予約備考 |
| notification_enabled | boolean | - | 通知有効化（デフォルトtrue） |

### パラメータ詳細

#### 時間指定
- `start_time`, `end_time`: 24時間形式（例: "09:00", "15:30"）
- メニューの所要時間と一致する必要があります

#### 予約者情報
- `booker_name`: 患者本人以外が予約する場合も含む
- 患者本人が予約する場合も予約者名は必須

#### ペア予約
- `is_pair_booking`: trueの場合、`pair_visitor_id`が必須
- 隣接する2部屋を同時予約

#### 通知設定
- `notification_enabled`: false指定で確認メール・SMSを送信しない

## レスポンス形式

### 成功時 (201 Created)
```json
{
  "status": "success",
  "data": {
    "reservation_info": {
      "reservation_id": "rsv_001",
      "status": "confirmed",
      "created_at": "2025-01-15T10:30:00Z"
    },
    "patient_info": {
      "visitor_id": "12345",
      "patient_name": "山田太郎",
      "phone": "090-1234-5678",
      "email": "yamada@example.com"
    },
    "booker_info": {
      "booker_name": "山田花子",
      "booker_phone": "080-1234-5678",
      "booker_email": "hanako@example.com",
      "is_same_as_patient": false
    },
    "appointment_details": {
      "date": "2025-01-20",
      "start_time": "09:00",
      "end_time": "10:30",
      "duration_minutes": 90,
      "day_of_week": "月曜日"
    },
    "menu_info": {
      "menu_id": "menu_001",
      "menu_name": "幹細胞治療",
      "category": "幹細胞治療",
      "price": 50000,
      "requires_ticket": true,
      "ticket_consumed": {
        "ticket_type": "stem_cell",
        "quantity": 1,
        "remaining_balance": 4
      }
    },
    "room_info": {
      "room_id": "room_001",
      "room_name": "治療室A",
      "room_type": "treatment"
    },
    "pair_booking": {
      "is_pair_booking": false,
      "pair_reservation_id": null,
      "pair_patient_name": null
    },
    "notifications": {
      "confirmation_sent": true,
      "reminder_scheduled": true,
      "notification_methods": ["email", "sms"]
    },
    "medical_force_sync": {
      "api_sync_status": "success",
      "api_reservation_id": "mf_rsv_789",
      "sync_timestamp": "2025-01-15T10:30:05Z"
    },
    "spreadsheet_sync": {
      "sync_status": "success",
      "sheet_row_number": 156,
      "sync_timestamp": "2025-01-15T10:30:07Z"
    }
  }
}
```

### エラー時
```json
{
  "status": "error",
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "指定時間に予約の競合があります",
    "details": {
      "conflicting_reservation": {
        "reservation_id": "rsv_999",
        "patient_name": "田中一郎",
        "time": "09:00-10:30",
        "room": "治療室A"
      },
      "suggested_alternatives": [
        {
          "date": "2025-01-20",
          "start_time": "11:00",
          "end_time": "12:30",
          "room_id": "room_001"
        },
        {
          "date": "2025-01-21",
          "start_time": "09:00",
          "end_time": "10:30",
          "room_id": "room_002"
        }
      ]
    }
  }
}
```

## レスポンスデータ詳細

### reservation_info
- `reservation_id`: 予約ID
- `status`: 予約ステータス（confirmed/pending/cancelled）
- `created_at`: 作成日時（ISO 8601形式）

### ticket_consumed（チケット消費情報）
- `ticket_type`: 消費したチケット種別
- `quantity`: 消費枚数
- `remaining_balance`: 残りチケット数

### medical_force_sync（Medical Force API同期）
- `api_sync_status`: 同期ステータス（success/failed）
- `api_reservation_id`: Medical Force側の予約ID
- `sync_timestamp`: 同期実行時刻

### spreadsheet_sync（スプレッドシート同期）
- `sync_status`: 同期ステータス
- `sheet_row_number`: 追加された行番号
- `sync_timestamp`: 同期実行時刻

## PHPサンプルコード

### 基本的な予約作成
```php
<?php
$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$data = [
    'path' => 'api/reservations',
    'api_key' => 'your_api_key_here',
    'visitor_id' => '12345',
    'menu_id' => 'menu_001',
    'reservation_date' => '2025-01-20',
    'start_time' => '09:00',
    'end_time' => '10:30',
    'booker_name' => '山田太郎',
    'booker_phone' => '090-1234-5678',
    'booker_email' => 'yamada@example.com',
    'notes' => 'PHPからの予約',
    'notification_enabled' => true
];

$options = [
    'http' => [
        'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
        'method'  => 'POST',
        'content' => http_build_query($data)
    ]
];

$context = stream_context_create($options);
$response = file_get_contents($url, false, $context);
$result = json_decode($response, true);

if ($result['status'] === 'success') {
    $reservation = $result['data'];
    echo "予約が完了しました！\n";
    echo "予約ID: " . $reservation['reservation_info']['reservation_id'] . "\n";
    echo "患者名: " . $reservation['patient_info']['patient_name'] . "\n";
    echo "日時: " . $reservation['appointment_details']['date'] . " " . 
         $reservation['appointment_details']['start_time'] . "\n";
    echo "メニュー: " . $reservation['menu_info']['menu_name'] . "\n";
    
    // チケット消費情報
    if ($reservation['menu_info']['requires_ticket']) {
        $ticket = $reservation['menu_info']['ticket_consumed'];
        echo "チケット消費: {$ticket['ticket_type']} {$ticket['quantity']}枚\n";
        echo "残高: {$ticket['remaining_balance']}枚\n";
    }
    
    // 同期状況
    echo "\n同期状況:\n";
    echo "Medical Force: " . $reservation['medical_force_sync']['api_sync_status'] . "\n";
    echo "スプレッドシート: " . $reservation['spreadsheet_sync']['sync_status'] . 
         " (行: " . $reservation['spreadsheet_sync']['sheet_row_number'] . ")\n";
         
} else {
    echo "予約エラー: " . $result['error']['message'] . "\n";
}
?>
```

### ペア予約の作成例
```php
<?php
function createPairReservation($visitor1_id, $visitor2_id, $menu_id, $date, $time) {
    $url = 'https://script.google.com/macros/s/{deployment_id}/exec';
    
    // 終了時間を計算（90分後と仮定）
    $end_time = date('H:i', strtotime($time . ' +90 minutes'));
    
    $data = [
        'path' => 'api/reservations',
        'api_key' => 'your_api_key_here',
        'visitor_id' => $visitor1_id,
        'menu_id' => $menu_id,
        'reservation_date' => $date,
        'start_time' => $time,
        'end_time' => $end_time,
        'booker_name' => 'ペア予約担当者',
        'booker_phone' => '03-1234-5678',
        'is_pair_booking' => true,
        'pair_visitor_id' => $visitor2_id,
        'notes' => 'ペア予約（2名同時施術）',
        'notification_enabled' => true
    ];
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data)
        ]
    ];
    
    $context = stream_context_create($options);
    $response = file_get_contents($url, false, $context);
    return json_decode($response, true);
}

// ペア予約実行
$result = createPairReservation('12345', '67890', 'menu_001', '2025-01-20', '14:00');

if ($result['status'] === 'success') {
    $data = $result['data'];
    echo "ペア予約が完了しました！\n";
    echo "予約ID: " . $data['reservation_info']['reservation_id'] . "\n";
    echo "部屋: " . $data['room_info']['room_name'] . "\n";
    
    if ($data['pair_booking']['is_pair_booking']) {
        echo "ペア予約ID: " . $data['pair_booking']['pair_reservation_id'] . "\n";
    }
} else {
    echo "エラー: " . $result['error']['message'] . "\n";
}
?>
```

### エラーハンドリングと代替案表示
```php
<?php
function createReservationWithFallback($params) {
    $url = 'https://script.google.com/macros/s/{deployment_id}/exec';
    $params['path'] = 'api/reservations';
    $params['api_key'] = 'your_api_key_here';
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($params),
            'timeout' => 30
        ]
    ];
    
    $context = stream_context_create($options);
    
    try {
        $response = @file_get_contents($url, false, $context);
        if ($response === false) {
            throw new Exception('API接続エラー');
        }
        
        $result = json_decode($response, true);
        
        if ($result['status'] === 'success') {
            return ['success' => true, 'data' => $result['data']];
        } else {
            // エラー時の処理
            $error = $result['error'];
            
            // 代替案がある場合
            if (isset($error['details']['suggested_alternatives'])) {
                return [
                    'success' => false,
                    'error' => $error['message'],
                    'alternatives' => $error['details']['suggested_alternatives']
                ];
            }
            
            return ['success' => false, 'error' => $error['message']];
        }
        
    } catch (Exception $e) {
        return ['success' => false, 'error' => 'システムエラー: ' . $e->getMessage()];
    }
}

// 使用例
$params = [
    'visitor_id' => '12345',
    'menu_id' => 'menu_001',
    'reservation_date' => '2025-01-20',
    'start_time' => '09:00',
    'end_time' => '10:30',
    'booker_name' => '山田太郎',
    'booker_phone' => '090-1234-5678'
];

$result = createReservationWithFallback($params);

if ($result['success']) {
    echo "予約成功！\n";
    $data = $result['data'];
    echo "予約ID: " . $data['reservation_info']['reservation_id'] . "\n";
} else {
    echo "予約失敗: " . $result['error'] . "\n";
    
    // 代替案の表示
    if (isset($result['alternatives'])) {
        echo "\n代替可能な時間:\n";
        foreach ($result['alternatives'] as $alt) {
            echo "- {$alt['date']} {$alt['start_time']}-{$alt['end_time']}\n";
        }
    }
}
?>
```

## エラーコード

| コード | 説明 |
|--------|------|
| INVALID_REQUEST | 必須パラメータ不足 |
| PATIENT_NOT_FOUND | 患者が見つからない |
| MENU_NOT_FOUND | メニューが見つからない |
| INVALID_TIME_FORMAT | 時間形式が不正 |
| RESERVATION_CONFLICT | 予約時間の競合 |
| ROOM_NOT_AVAILABLE | 指定部屋が利用不可 |
| TREATMENT_INTERVAL_VIOLATION | 施術間隔制限違反 |
| SAME_DAY_LIMIT_EXCEEDED | 同日予約制限超過 |
| INSUFFICIENT_TICKETS | チケット残高不足 |
| PAIR_BOOKING_ERROR | ペア予約エラー |
| MEDICAL_FORCE_API_ERROR | Medical Force API通信エラー |
| SPREADSHEET_SYNC_ERROR | スプレッドシート同期エラー |

## 注意事項

1. **トランザクション処理**: Medical Force APIとスプレッドシートの両方への同期を保証
2. **ロールバック**: いずれかの同期が失敗した場合、自動的にロールバック
3. **通知**: デフォルトで確認メール・SMSを送信（notification_enabled=falseで無効化）
4. **チケット消費**: チケット制メニューの場合、自動的にチケットを消費
5. **競合チェック**: 同時刻の予約競合を自動的にチェック
6. **代替案提示**: 予約不可の場合、可能な限り代替時間を提示