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

// GAS APIから書類一覧を取得
require_once __DIR__ . '/../line-auth/config.php';
require_once __DIR__ . '/../line-auth/GasApiClient.php';

$folders = [];
$rootDocuments = [];
$totalDocuments = 0;
$errorMessage = '';
$visitorId = null;

try {
    // デバッグ情報の開始
    error_log('=== Document API Debug Start ===');
    error_log('LINE User ID: ' . $lineUserId);
    error_log('GAS_DEPLOYMENT_ID: ' . GAS_DEPLOYMENT_ID);
    error_log('GAS_API_KEY exists: ' . (!empty(GAS_API_KEY) ? 'YES' : 'NO'));
    
    $gasApi = new GasApiClient(GAS_DEPLOYMENT_ID, GAS_API_KEY);
    
    if (!$gasApi) {
        $errorMessage = 'GAS APIクライアントの初期化に失敗しました。';
        error_log('ERROR: GAS API Client initialization failed');
    } else {
        error_log('GAS API Client created successfully');
        
        // 1. LINE User IDでユーザー情報取得
        error_log('Calling getUserFullInfo for LINE User ID: ' . $lineUserId);
        $userInfo = $gasApi->getUserFullInfo($lineUserId);
        
        // APIレスポンスの詳細ログ
        error_log('API Response Status: ' . ($userInfo['status'] ?? 'NO_STATUS'));
        error_log('Full API Response: ' . json_encode($userInfo, JSON_PRETTY_PRINT));
        
        if (empty($userInfo)) {
            $errorMessage = 'APIレスポンスが空です。';
            error_log('ERROR: Empty API response');
        } elseif (!isset($userInfo['status'])) {
            $errorMessage = 'APIレスポンスが不正です。';
            error_log('ERROR: No status in API response');
        } elseif ($userInfo['status'] !== 'success') {
            $errorMessage = 'API呼び出しエラー: ' . ($userInfo['message'] ?? 'Unknown error');
            error_log('ERROR: API call failed with status: ' . $userInfo['status']);
        } elseif (!isset($userInfo['data'])) {
            $errorMessage = 'APIレスポンスにdataフィールドがありません。';
            error_log('ERROR: No data field in API response');
        } else {
            // データ構造の詳細確認
            error_log('Data Keys: ' . json_encode(array_keys($userInfo['data'])));
            error_log('Has visitor.visitor_id: ' . (isset($userInfo['data']['visitor']['visitor_id']) ? 'YES' : 'NO'));
            
            if (isset($userInfo['data']['visitor']['visitor_id'])) {
                $visitorId = $userInfo['data']['visitor']['visitor_id'];
                error_log('Visitor ID found: ' . $visitorId);
                
                // docsinfo がレスポンスに含まれている場合は直接使用
                if (isset($userInfo['data']['docsinfo'])) {
                    $docsInfo = $userInfo['data']['docsinfo'];
$totalDocuments = 0;
foreach ($docsInfo['foldername'] as $folder) {
    $totalDocuments += count($folder['documents']);
}
					/*$processDocsInfo = function($gasData) {
        $documentTypes = ['同意書', '診療記録', '契約書', 'その他書類'];
        $docsinfo = [];
        
        foreach ($documentTypes as $docType) {
            $docsinfo[$docType] = array_map(function($doc) {
                return [
                    'docs_id' => $doc['docs_id'] ?? '',
                    'docs_name' => $doc['docs_name'] ?? '',
                    'docs_url' => $doc['docs_url'] ?? '',
                    'created_at' => $doc['created_at'] ?? '',
                    'treatment_name' => $doc['treatment_name'] ?? '',
                    'notes' => $doc['notes'] ?? ''
                ];
            }, $gasData['docsinfo'][$docType] ?? []);
        }
        
        return $docsinfo;
    };*/
                    error_log('Documents from getUserFullInfo: ' . $totalDocuments);
                    error_log('Root documents count: ' . count($rootDocuments));
                } else {
                    // 書類情報を別途取得（必要な場合）
                    error_log('Calling getDocuments for visitor ID: ' . $visitorId);
                    $documentsResponse = $gasApi->getDocuments($visitorId);
                    error_log('Documents API Response: ' . json_encode($documentsResponse, JSON_PRETTY_PRINT));
                }
            } else {
                $errorMessage = '来院者IDが見つかりません。visitorフィールドが存在しないか、visitor_idが含まれていません。';
                error_log('ERROR: visitor.visitor_id not found in data');
                if (isset($userInfo['data']['visitor'])) {
                    error_log('Visitor field exists but no visitor_id: ' . json_encode($userInfo['data']['visitor']));
                } else {
                    error_log('Visitor field does not exist');
                }
            }
        }
    }
    
    error_log('=== Document API Debug End ===');
    
} catch (Exception $e) {
    $errorMessage = 'システムエラーが発生しました: ' . $e->getMessage();
    error_log('Documents API Exception: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
}

// 日付フォーマット関数
function formatJapaneseDate($isoDate) {
    if (empty($isoDate)) return '不明';
    
    try {
        $date = new DateTime($isoDate);
        return $date->format('Y年n月j日');
    } catch (Exception $e) {
        return '不明';
    }
}
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
<link rel="stylesheet" href="../assets/css/hamburger.css">
</head>
<body>
<!-- Header -->
<header class="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-50">
  <div class="container mx-auto flex justify-between items-center">
    <h1 class="text-xl font-semibold">CLUTIREFINEクリニック<br class="sp">
      書類一覧</h1>
    <?php
  include_once '../assets/inc/navigation.php'; // navigation.phpの内容を読み込む
?>
  </div>
</header>

<!-- Main Content -->
<main class="flex-1 py-6 min-h-screen flex items-start justify-center bg-gray-500">
  <div class="container mx-auto px-0 sm:px-6">
    <div class="doc_cont_wrap">
      <h2>書類一覧</h2>
      
      <?php if (!empty($errorMessage)): ?>
        <div class="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><?php echo htmlspecialchars($errorMessage); ?></p>
        </div>
      <?php endif; ?>
      
      <?php if (empty($docsInfo) && empty($errorMessage)): ?>
        <div class="no-documents bg-gray-100 border border-gray-300 text-gray-600 px-4 py-6 rounded text-center">
          <p>現在、書類がありません。</p>
        </div>
      <?php else: ?>
        <?php if (!empty($docsInfo) || !empty($rootDocuments)): ?>
          <div class="documents-count mb-4">
            <p class="text-sm text-gray-600">書類件数: <?php echo $totalDocuments; ?>件</p>
          </div>
          <!-- ルートに直接置かれた書類 -->
		<?php foreach ($docsInfo['foldername'] as $folder): ?>
<dl class="doc_items_wrap">
    <dt class="doc_cont_folder"><?php echo htmlspecialchars($folder['name']); ?></dt>
    <?php foreach ($folder['documents'] as $document): ?>
    <dd class="doc_cont_item">
        <div class="doc_cont_detail">
            <div class="doc_cont_detail_name">
                <p class="doc_ttl">書類名</p>
                <p class="doc_name"><?php echo htmlspecialchars($document['docs_name']); ?></p>
            </div>
            <div class="doc_cont_detail_date">
                <p class="doc_ttl">作成日</p>
                <p class="doc_date"><?php echo htmlspecialchars($document['created_at']); ?></p>
            </div>
        </div>
        <div class="doc_link_wrap">
            <a class="doc_link" href="<?php echo htmlspecialchars($document['docs_url']); ?>" target="_blank" rel="noopener noreferrer">
                <span>プレビューを見る</span>
            </a>
        </div>
    </dd>
    <?php endforeach; ?>
</dl>
<?php endforeach; ?>
            </div>
        <?php endif; ?>
      <?php endif; ?>
    </div>
  </div>
</main>
<!-- Footer -->
	<?php
  include_once '../assets/inc/footer.php'; // footer.phpの内容を読み込む
?>
<!-- デバッグ情報（開発環境のみ） -->
<?php if (defined('DEBUG_MODE') && DEBUG_MODE): ?>
    <div class="fixed bottom-4 right-4 bg-gray-800 text-white p-2 text-xs rounded max-w-sm max-h-96 overflow-y-auto">
        <p><strong>書類一覧デバッグ情報</strong></p>
        <p>LINE ID: <?php echo substr($lineUserId, 0, 10); ?>...</p>
        <p>Session ID: <?php echo session_id(); ?></p>
        <hr class="my-2 border-gray-600">
        <p>Visitor ID: <?php echo $visitorId ? substr($visitorId, 0, 15) . '...' : 'なし'; ?></p>
        <p>書類件数: <?php echo $totalDocuments; ?>件</p>
		<?php echo "<pre>";
var_dump($userInfo);
echo "</pre>";
?>
        <p>エラー: <?php echo $errorMessage ?: 'なし'; ?></p>
        <?php if (!empty($folders)): ?>
        <hr class="my-2 border-gray-600">
        <p><strong>フォルダデータ:</strong></p>
        <pre class="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-32"><?php echo htmlspecialchars(json_encode($folders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
        <?php endif; ?>
    </div>
<?php endif; ?>
<script type="text/javascript" src="document_toggle.js"></script>
</body>
</html>