# 来院者公開設定切り替えAPI仕様書

## 概要
PHPから特定の会社に所属する来院者の公開設定を切り替えるためのAPIです。公開設定により、他のシステムからの参照可否を制御できます。

## エンドポイント
```
POST /api/company/{company_id}/visitors/{visitor_id}/visibility
```

## URLパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| company_id | string | ◯ | 会社ID |
| visitor_id | string | ◯ | 来院者ID |

## リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| path | string | ◯ | "api/company/{company_id}/visitors/{visitor_id}/visibility" |
| api_key | string | ◯ | APIキー |
| is_public | boolean | ◯ | 公開設定 (true: 公開, false: 非公開) |

### パラメータ詳細

#### is_public（公開設定）
- `true`: 公開（他のシステムから参照可能）
- `false`: 非公開（内部システムのみ）
- ※必ずboolean型で指定してください

## レスポンス形式

### 成功時 (200 OK)
```json
{
  "status": "success",
  "message": "公開設定を更新しました",
  "data": {
    "company_id": "comp_001",
    "visitor_id": "12345",
    "is_public": true,
    "updated_at": "2025-01-15T10:30:00Z"
  }
}
```

### エラー時
```json
{
  "status": "error",
  "error": {
    "code": "MISSING_PARAMETER",
    "message": "is_publicは必須です",
    "details": null
  }
}
```

## エラーコード

| コード | 説明 |
|--------|------|
| MISSING_PARAMETER | 必須パラメータが不足している |
| VALIDATION_ERROR | is_publicがboolean型ではない |
| VISITOR_NOT_FOUND | 指定された来院者が見つからない |
| UPDATE_FAILED | 公開設定の更新に失敗した |
| UPDATE_ERROR | 更新処理中にエラーが発生した |
| INTERNAL_ERROR | 内部エラーが発生した |

## PHPサンプルコード

### 基本的な使用例（公開に切り替え）
```php
<?php
$company_id = 'comp_001';
$visitor_id = '12345';
$url = 'https://script.google.com/macros/s/{deployment_id}/exec';

$data = [
    'path' => "api/company/{$company_id}/visitors/{$visitor_id}/visibility",
    'api_key' => 'your_api_key_here',
    'is_public' => true  // 公開に設定
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
    echo "公開設定を更新しました: " . ($result['data']['is_public'] ? '公開' : '非公開');
} else {
    echo "エラー: " . $result['error']['message'];
}
?>
```

### 非公開に切り替える例
```php
<?php
$company_id = 'comp_001';
$visitor_id = '12345';
$url = 'https://script.google.com/macros/s/{deployment_id}/exec';

$data = [
    'path' => "api/company/{$company_id}/visitors/{$visitor_id}/visibility",
    'api_key' => 'your_api_key_here',
    'is_public' => false  // 非公開に設定
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
    echo "更新完了！\n";
    echo "会社ID: " . $data['company_id'] . "\n";
    echo "来院者ID: " . $data['visitor_id'] . "\n";
    echo "公開設定: " . ($data['is_public'] ? '公開' : '非公開') . "\n";
    echo "更新日時: " . $data['updated_at'] . "\n";
} else {
    echo "エラー: " . $result['error']['message'] . "\n";
    if (isset($result['error']['details'])) {
        echo "詳細: " . $result['error']['details'] . "\n";
    }
}
?>
```

### 複数来院者の一括切り替え例
```php
<?php
$company_id = 'comp_001';
$visitor_ids = ['12345', '12346', '12347'];
$url = 'https://script.google.com/macros/s/{deployment_id}/exec';
$api_key = 'your_api_key_here';

$success_count = 0;
$error_count = 0;

foreach ($visitor_ids as $visitor_id) {
    $data = [
        'path' => "api/company/{$company_id}/visitors/{$visitor_id}/visibility",
        'api_key' => $api_key,
        'is_public' => true
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
        echo "✓ 来院者ID {$visitor_id}: 更新成功\n";
        $success_count++;
    } else {
        echo "✗ 来院者ID {$visitor_id}: " . $result['error']['message'] . "\n";
        $error_count++;
    }
    
    // API制限を考慮して少し待機
    usleep(500000); // 0.5秒待機
}

echo "\n処理完了: 成功 {$success_count}件, エラー {$error_count}件\n";
?>
```

## 注意事項

1. **データ型**: `is_public`は必ずboolean型（true/false）で指定してください
2. **URL構成**: company_idとvisitor_idをURL内に含める必要があります
3. **認証**: api_keyによる認証が必要です
4. **更新対象**: 会社別来院者管理シートの該当レコードが更新されます
5. **履歴管理**: 更新日時が自動的に記録されます
6. **エラーハンドリング**: 来院者が存在しない場合は`VISITOR_NOT_FOUND`エラーが返されます
7. **API制限**: 大量の更新を行う場合は、リクエスト間隔を設けることを推奨します

## 関連API

- [来院者新規登録API](./PHP_API_来院者新規登録.md): 新規来院者登録時に公開設定を指定
- [患者別メニュー表示API](./PHP_API_患者別メニュー表示.md): 公開設定によりメニュー表示内容が変わる場合があります

## 備考

このAPIは会社所属の来院者のみが対象です。個人来院者の場合は、別途個人来院者向けのAPIを使用してください。