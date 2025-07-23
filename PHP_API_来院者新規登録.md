# 来院者新規登録API仕様書

## 概要
PHPから新規患者（来院者）を登録するためのAPIです。公開ステータスの設定、会社所属の指定などが可能です。

## エンドポイント
```
POST /api/visitors
```

## リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| path | string | ◯ | "api/visitors" |
| api_key | string | ◯ | APIキー |
| last_name | string | ◯ | 姓 |
| first_name | string | ◯ | 名 |
| last_name_kana | string | ◯ | 姓カナ |
| first_name_kana | string | ◯ | 名カナ |
| email | string | - | メールアドレス |
| phone | string | - | 電話番号 |
| gender | string | - | 性別 (male/female/other) |
| birth_date | string | - | 生年月日 (YYYY-MM-DD) |
| company_id | string | - | 会社ID |
| member_type | string | - | 会員種別 (main/sub) ※company_id指定時必須 |
| publicity_status | string | ◯ | 公開ステータス (public/private) |
| notes | string | - | 備考 |

### パラメータ詳細

#### publicity_status（公開ステータス）
- `public`: 公開（他のシステムから参照可能）
- `private`: 非公開（内部システムのみ）

#### member_type（会員種別）
- `main`: 本会員
- `sub`: サブ会員
- ※company_idを指定した場合は必須

## レスポンス形式

### 成功時 (200 OK)
```json
{
  "status": "success",
  "data": {
    "visitor_id": "12345",
    "patient_name": "山田太郎",
    "email": "yamada@example.com",
    "phone": "090-1234-5678",
    "company_info": {
      "company_id": "comp_001",
      "company_name": "サンプル会社",
      "member_type": "main"
    },
    "publicity_status": "public",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### エラー時
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "必須パラメータが不足しています",
    "details": "last_name, first_name, publicity_statusは必須です"
  }
}
```

## エラーコード

| コード | 説明 |
|--------|------|
| INVALID_REQUEST | 必須パラメータ不足または形式エラー |
| DUPLICATE_EMAIL | メールアドレスが既に登録済み |
| INVALID_COMPANY | 指定された会社IDが存在しない |
| INVALID_MEMBER_TYPE | 会社ID指定時にmember_typeが未指定 |

## PHPサンプルコード

### 基本的な使用例
```php
<?php
$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$data = [
    'path' => 'api/visitors',
    'api_key' => 'your_api_key_here',
    'last_name' => '山田',
    'first_name' => '太郎',
    'last_name_kana' => 'ヤマダ',
    'first_name_kana' => 'タロウ',
    'email' => 'yamada@example.com',
    'phone' => '090-1234-5678',
    'publicity_status' => 'public'
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
    echo "患者登録成功: " . $result['data']['visitor_id'];
} else {
    echo "エラー: " . $result['error']['message'];
}
?>
```

### 会社所属患者の登録例
```php
<?php
$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$data = [
    'path' => 'api/visitors',
    'api_key' => 'your_api_key_here',
    'last_name' => '鈴木',
    'first_name' => '花子',
    'last_name_kana' => 'スズキ',
    'first_name_kana' => 'ハナコ',
    'email' => 'suzuki@company.com',
    'phone' => '080-5555-6666',
    'gender' => 'female',
    'birth_date' => '1990-05-15',
    'company_id' => 'comp_001',
    'member_type' => 'main',
    'publicity_status' => 'private',
    'notes' => '会社経由での登録'
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
    $data = $result['data'];
    echo "登録成功！\n";
    echo "患者ID: " . $data['visitor_id'] . "\n";
    echo "患者名: " . $data['patient_name'] . "\n";
    echo "会社名: " . $data['company_info']['company_name'] . "\n";
    echo "会員種別: " . ($data['company_info']['member_type'] === 'main' ? '本会員' : 'サブ会員') . "\n";
} else {
    echo "エラー: " . $result['error']['message'] . "\n";
    if (isset($result['error']['details'])) {
        echo "詳細: " . $result['error']['details'] . "\n";
    }
}
?>
```

## 注意事項

1. **名前のカナ変換**: 姓名のカナは全角カタカナで入力してください
2. **電話番号形式**: ハイフン付き・なし両方対応（例: 090-1234-5678 または 09012345678）
3. **メールアドレス**: 重複チェックが行われます
4. **会社所属**: company_idを指定する場合は、member_typeも必須です
5. **トランザクション**: 登録処理はMedical Force APIとスプレッドシートの両方に反映されます