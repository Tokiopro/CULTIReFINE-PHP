<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// POSTリクエストのみ許可
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// JSONデータを取得
$input = file_get_contents('php://input');
$requestData = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// 必要なパラメータをチェック
$requiredFields = ['reservation_id', 'patient_name', 'menu', 'reserve_date'];
foreach ($requiredFields as $field) {
    if (!isset($requestData[$field]) || empty($requestData[$field])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Missing required field: $field"]);
        exit;
    }
}

/**
 * GASへ予約キャンセルリクエストを送信する関数
 */
function sendCancelReservationToGAS($gasUrl, $apiKey, $cancelData) {
    // リクエストデータを構築
    $requestData = [
        'action' => 'cancelReservation',
        'apiKey' => $apiKey,
        'CancelRequest' => $cancelData,
        'timestamp' => date('c')
    ];

    // JSONエンコード
    $jsonData = json_encode($requestData, JSON_UNESCAPED_UNICODE);
    
    // デバッグ: 送信データをログ出力
    error_log('Sending to GAS URL: ' . $gasUrl, 3, __DIR__ . '/debug.log');
    error_log('Request Data: ' . $jsonData, 3, __DIR__ . '/debug.log');

    $ch = curl_init();

    curl_setopt_array($ch, [
        CURLOPT_URL => $gasUrl,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $jsonData,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json; charset=utf-8',
            'Content-Length: ' . strlen($jsonData),
            'Accept: application/json'  // 追加
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => false, // ★ 追わない,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_USERAGENT => 'PHP-Cancel-Request/1.0',
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_ENCODING => '',
        CURLOPT_FRESH_CONNECT => true,
        // デバッグ情報を取得
        CURLOPT_VERBOSE => true,
        CURLOPT_STDERR => fopen(__DIR__ . '/curl_debug.log', 'a')
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_errno($ch);
    $curlErrorMsg = curl_error($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL); // 実際にアクセスしたURL

    curl_close($ch);

    // デバッグ情報をより詳細に
    $debugInfo = [
        'effective_url' => $effectiveUrl,  // リダイレクト後のURL
        'http_code' => $httpCode,
        'curl_error' => $curlError,
        'curl_error_msg' => $curlErrorMsg,
        'content_type' => $contentType,
        'response_length' => strlen($response ?? ''),
        'response_preview' => substr($response ?? '', 0, 500) // プレビューを長めに
    ];

    // 詳細デバッグログ
    error_log('Response Debug Info: ' . print_r($debugInfo, true), 3, __DIR__ . '/debug.log');

    return [
        'success' => $httpCode >= 200 && $httpCode < 300 && !empty($response) && strpos($response, '<!DOCTYPE html>') === false,
        'http_code' => $httpCode,
        'raw_response' => $response,
        'decoded_response' => null,
        'json_error' => null,
        'debug_info' => $debugInfo
    ];
}

try {
    // GAS設定 - URLを再確認
    $gasUrl = 'https://script.google.com/macros/s/AKfycbwUKq__ahoF5mGoin0DOjhFErDyCY1TJJ5xHWlU_1JltVaKW-4QN9li62ZFofVviHQlXA/exec';
    $apiKey = '0123456789';

    // まずGASのURLが有効かテスト
    error_log('Testing GAS URL accessibility...', 3, __DIR__ . '/debug.log');
    
    // 簡単なGETリクエストでURLをテスト
    $testCh = curl_init();
    curl_setopt_array($testCh, [
        CURLOPT_URL => $gasUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'PHP-Test/1.0'
    ]);
    
    $testResponse = curl_exec($testCh);
    $testHttpCode = curl_getinfo($testCh, CURLINFO_HTTP_CODE);
    curl_close($testCh);
    
    error_log("URL Test - HTTP Code: $testHttpCode, Response: " . substr($testResponse, 0, 200), 3, __DIR__ . '/debug.log');

    // キャンセルデータを準備
    $cancelData = [
        'request_date' => date('Y-m-d'),
        'request_reservationId' => $requestData['reservation_id'],
        'request_name' => $requestData['patient_name'],
        'request_menu' => $requestData['menu'],
        'request_reservedate' => $requestData['reserve_date']
    ];

    // GASにリクエスト送信
    $result = sendCancelReservationToGAS($gasUrl, $apiKey, $cancelData);

    // レスポンス処理
    if ($result['success']) {
        echo json_encode([
            'success' => true,
            'message' => '予約のキャンセルが完了しました',
            'debug_info' => $result['debug_info']
        ]);
    } else {
        // エラーの詳細を表示
        $errorDetails = [
            'success' => false,
            'error' => 'GASとの通信でエラーが発生しました',
            'http_code' => $result['http_code'],
            'debug_info' => $result['debug_info']
        ];
        
        // 特定のエラーケースの判定
        if ($result['http_code'] == 400) {
            $errorDetails['error'] = 'リクエストが不正です（400 Bad Request）';
            $errorDetails['suggestion'] = 'GASのURLまたはリクエストデータを確認してください';
        } elseif ($result['http_code'] == 404) {
            $errorDetails['error'] = 'GASが見つかりません（404 Not Found）';
            $errorDetails['suggestion'] = 'GASのURLを確認してください';
        } elseif ($result['http_code'] == 403) {
            $errorDetails['error'] = 'アクセスが拒否されました（403 Forbidden）';
            $errorDetails['suggestion'] = 'GASの公開設定を確認してください';
        }
        
        echo json_encode($errorDetails);
    }

} catch (Exception $e) {
    error_log('Cancel reservation error: ' . $e->getMessage(), 3, __DIR__ . '/debug.log');
    echo json_encode([
        'success' => false,
        'error' => 'サーバーエラーが発生しました',
        'exception' => $e->getMessage()
    ]);
}
?>