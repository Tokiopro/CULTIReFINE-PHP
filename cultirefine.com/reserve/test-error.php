<?php
/**
 * GasApiClientのエラーを特定するためのテストファイル
 */

// エラー表示を有効化
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>GasApiClient エラーテスト</h1>";

// 1. config.phpの読み込みテスト
echo "<h2>1. config.php読み込みテスト</h2>";
try {
    require_once __DIR__ . '/line-auth/config.php';
    echo "<p style='color: green;'>✓ config.php読み込み成功</p>";
    
    // 環境変数の確認
    echo "<h3>環境変数チェック:</h3>";
    echo "<ul>";
    echo "<li>GAS_DEPLOYMENT_ID: " . (defined('GAS_DEPLOYMENT_ID') ? (empty(GAS_DEPLOYMENT_ID) ? '<span style="color: red;">空</span>' : '<span style="color: green;">設定済み</span>') : '<span style="color: red;">未定義</span>') . "</li>";
    echo "<li>GAS_API_KEY: " . (defined('GAS_API_KEY') ? (empty(GAS_API_KEY) ? '<span style="color: red;">空</span>' : '<span style="color: green;">設定済み</span>') : '<span style="color: red;">未定義</span>') . "</li>";
    echo "<li>DEBUG_MODE: " . (defined('DEBUG_MODE') ? (DEBUG_MODE ? 'true' : 'false') : '未定義') . "</li>";
    echo "</ul>";
    
    if (defined('GAS_DEPLOYMENT_ID') && !empty(GAS_DEPLOYMENT_ID)) {
        echo "<p>GAS_DEPLOYMENT_ID長さ: " . strlen(GAS_DEPLOYMENT_ID) . "文字</p>";
    }
    if (defined('GAS_API_KEY') && !empty(GAS_API_KEY)) {
        echo "<p>GAS_API_KEY長さ: " . strlen(GAS_API_KEY) . "文字</p>";
    }
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ config.php読み込みエラー: " . $e->getMessage() . "</p>";
}

// 2. GasApiClient.phpの存在確認
echo "<h2>2. GasApiClient.php確認</h2>";
$gasApiPath = __DIR__ . '/line-auth/GasApiClient.php';
if (file_exists($gasApiPath)) {
    echo "<p style='color: green;'>✓ GasApiClient.phpが存在</p>";
    
    // ファイルの読み込みテスト
    try {
        require_once $gasApiPath;
        echo "<p style='color: green;'>✓ GasApiClient.php読み込み成功</p>";
        
        // クラスの存在確認
        if (class_exists('GasApiClient')) {
            echo "<p style='color: green;'>✓ GasApiClientクラスが定義済み</p>";
            
            // メソッドの存在確認
            $methods = get_class_methods('GasApiClient');
            echo "<h3>利用可能なメソッド:</h3>";
            echo "<ul>";
            foreach ($methods as $method) {
                echo "<li>$method</li>";
            }
            echo "</ul>";
        } else {
            echo "<p style='color: red;'>✗ GasApiClientクラスが見つかりません</p>";
        }
    } catch (Exception $e) {
        echo "<p style='color: red;'>✗ GasApiClient.php読み込みエラー: " . $e->getMessage() . "</p>";
        echo "<pre>" . $e->getTraceAsString() . "</pre>";
    }
} else {
    echo "<p style='color: red;'>✗ GasApiClient.phpが見つかりません</p>";
}

// 3. キャッシュディレクトリの確認
echo "<h2>3. キャッシュディレクトリ確認</h2>";
$cacheDir = __DIR__ . '/line-auth/cache';
if (is_dir($cacheDir)) {
    echo "<p style='color: green;'>✓ キャッシュディレクトリが存在</p>";
    echo "<p>書き込み権限: " . (is_writable($cacheDir) ? '<span style="color: green;">あり</span>' : '<span style="color: red;">なし</span>') . "</p>";
} else {
    echo "<p style='color: orange;'>キャッシュディレクトリが存在しません: $cacheDir</p>";
    
    // ディレクトリ作成を試みる
    if (@mkdir($cacheDir, 0755, true)) {
        echo "<p style='color: green;'>✓ キャッシュディレクトリを作成しました</p>";
    } else {
        echo "<p style='color: red;'>✗ キャッシュディレクトリの作成に失敗</p>";
    }
}

// 4. GasApiClientのインスタンス化テスト
echo "<h2>4. GasApiClientインスタンス化テスト</h2>";
if (class_exists('GasApiClient') && defined('GAS_DEPLOYMENT_ID') && defined('GAS_API_KEY')) {
    try {
        $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
        echo "<p style='color: green;'>✓ GasApiClientのインスタンス化成功</p>";
        
        // clearCacheメソッドの存在確認
        if (method_exists($gasApi, 'clearCache')) {
            echo "<p style='color: green;'>✓ clearCacheメソッドが存在</p>";
        } else {
            echo "<p style='color: red;'>✗ clearCacheメソッドが見つかりません</p>";
        }
        
        // normalizeGasApiResponseメソッドの存在確認
        if (method_exists($gasApi, 'normalizeGasApiResponse')) {
            echo "<p style='color: green;'>✓ normalizeGasApiResponseメソッドが存在</p>";
        } else {
            echo "<p style='color: red;'>✗ normalizeGasApiResponseメソッドが見つかりません</p>";
        }
    } catch (Exception $e) {
        echo "<p style='color: red;'>✗ GasApiClientのインスタンス化エラー: " . $e->getMessage() . "</p>";
        echo "<pre>" . $e->getTraceAsString() . "</pre>";
    }
} else {
    echo "<p style='color: red;'>✗ 前提条件が満たされていないため、インスタンス化テストをスキップ</p>";
}

// 5. セッション情報
echo "<h2>5. セッション情報</h2>";
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
echo "<p>セッションID: " . session_id() . "</p>";
echo "<p>セッションデータ数: " . count($_SESSION) . "</p>";
if (!empty($_SESSION)) {
    echo "<h3>セッションデータ:</h3>";
    echo "<pre>" . print_r($_SESSION, true) . "</pre>";
}

// 6. エラーログの最新部分
echo "<h2>6. 最新のエラーログ</h2>";
$errorLogPath = __DIR__ . '/error.log';
if (file_exists($errorLogPath)) {
    $lines = array_slice(file($errorLogPath), -20); // 最後の20行
    echo "<pre>";
    foreach ($lines as $line) {
        // タイムスタンプが今日のものをハイライト
        if (strpos($line, date('d-M-Y')) !== false) {
            echo "<span style='background-color: yellow;'>" . htmlspecialchars($line) . "</span>";
        } else {
            echo htmlspecialchars($line);
        }
    }
    echo "</pre>";
} else {
    echo "<p>error.logファイルが見つかりません</p>";
}

echo "<hr>";
echo "<p><a href='/reserve/'>通常のindex.phpに戻る</a></p>";
?>