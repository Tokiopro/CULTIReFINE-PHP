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

$documents = [];
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
            error_log('Has user.id: ' . (isset($userInfo['data']['user']['id']) ? 'YES' : 'NO'));
            
            if (isset($userInfo['data']['user']['id'])) {
                $visitorId = $userInfo['data']['user']['id'];
                error_log('Visitor ID found: ' . $visitorId);
                
                // 2. visitor_idで書類一覧取得
                error_log('Calling getDocuments for visitor ID: ' . $visitorId);
                $documentsResponse = $gasApi->getDocuments($visitorId);
                
                error_log('Documents API Response: ' . json_encode($documentsResponse, JSON_PRETTY_PRINT));
                
                if ($documentsResponse['status'] === 'success') {
                    $documents = $documentsResponse['data']['documents'] ?? [];
                    $rootDocuments = $documentsResponse['data']['rootDocuments'] ?? [];
                    $totalDocuments = $documentsResponse['data']['totalDocuments'] ?? count($documents);
                    
                    error_log('Documents count: ' . count($documents));
                    error_log('Root documents count: ' . count($rootDocuments));
                    error_log('Total documents: ' . $totalDocuments);
                } else {
                    $errorMessage = '書類の取得に失敗しました。(' . ($documentsResponse['message'] ?? 'Unknown error') . ')';
                    error_log('ERROR: Documents API failed with status: ' . $documentsResponse['status']);
                }
            } else {
                $errorMessage = 'ユーザーIDが見つかりません。userフィールドが存在しないか、IDが含まれていません。';
                error_log('ERROR: user.id not found in data');
                if (isset($userInfo['data']['user'])) {
                    error_log('User field exists but no ID: ' . json_encode($userInfo['data']['user']));
                } else {
                    error_log('User field does not exist');
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
      
      <?php if (empty($documents) && empty($rootDocuments) && empty($errorMessage)): ?>
        <div class="no-documents bg-gray-100 border border-gray-300 text-gray-600 px-4 py-6 rounded text-center">
          <p>現在、書類がありません。</p>
        </div>
      <?php else: ?>
        <?php if (!empty($documents) || !empty($rootDocuments)): ?>
          <div class="documents-count mb-4">
            <p class="text-sm text-gray-600">書類件数: <?php echo $totalDocuments; ?>件</p>
          </div>
          
          <!-- フォルダ階層表示 -->
          <?php if (!empty($documents)): ?>
            <?php 
            // フォルダ階層を再帰的に表示する関数
            function displayFolderTree($folders, $level = 0) {
              foreach ($folders as $folder) {
                $folderId = 'folder_' . md5($folder['name'] . $level);
                $hasChildren = !empty($folder['children']);
                $hasDocuments = !empty($folder['documents']);
                ?>
                <div class="folder-item mb-3" style="margin-left: <?php echo $level * 20; ?>px;">
                  <div class="folder-header bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition-colors" 
                       onclick="toggleFolder('<?php echo $folderId; ?>')">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <svg class="w-5 h-5 text-blue-600 mr-2 folder-icon" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                        </svg>
                        <span class="font-medium text-blue-900"><?php echo htmlspecialchars($folder['name']); ?></span>
                        <span class="text-xs text-gray-500 ml-2">
                          (<?php echo ($hasDocuments ? count($folder['documents']) : 0); ?>件)
                        </span>
                      </div>
                      <svg class="w-5 h-5 text-blue-600 transform transition-transform duration-200 toggle-arrow" 
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div id="<?php echo $folderId; ?>" class="folder-content hidden mt-2">
                    <?php if ($hasDocuments): ?>
                      <div class="documents-list pl-6">
                        <?php foreach ($folder['documents'] as $index => $document): ?>
                          <div class="doc_cont_item mb-3">
                            <div class="doc_cont_detail">
                              <div class="doc_cont_detail_name">
                                <p class="doc_ttl">書類名</p>
                                <p class="doc_name"><?php echo htmlspecialchars($document['title'] ?? 'タイトル不明'); ?></p>
                                <?php if (!empty($document['treatmentName'])): ?>
                                  <p class="text-xs text-gray-500 mt-1">施術: <?php echo htmlspecialchars($document['treatmentName']); ?></p>
                                <?php endif; ?>
                              </div>
                              <div class="doc_cont_detail_date">
                                <p class="doc_ttl">作成日</p>
                                <p class="doc_date"><?php echo formatJapaneseDate($document['createdAt'] ?? ''); ?></p>
                              </div>
                            </div>
                            <div class="doc_link_wrap">
                              <?php if (!empty($document['url'])): ?>
                                <a class="doc_link" href="<?php echo htmlspecialchars($document['url']); ?>" target="_blank" rel="noopener noreferrer">
                                  <span>プレビューを見る</span>
                                </a>
                              <?php else: ?>
                                <span class="doc_link disabled" style="opacity: 0.5; cursor: not-allowed;">
                                  <span>プレビュー不可</span>
                                </span>
                              <?php endif; ?>
                            </div>
                          </div>
                        <?php endforeach; ?>
                      </div>
                    <?php endif; ?>
                    
                    <?php if ($hasChildren): ?>
                      <?php displayFolderTree($folder['children'], $level + 1); ?>
                    <?php endif; ?>
                  </div>
                </div>
                <?php
              }
            }
            
            // フォルダ階層を表示
            displayFolderTree($documents);
            ?>
          <?php endif; ?>
          
          <!-- ルートに直接置かれた書類 -->
          <?php if (!empty($rootDocuments)): ?>
            <div class="root-documents mt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">その他の書類</h3>
              <?php foreach ($rootDocuments as $index => $document): ?>
                <div class="doc_cont_item mb-3">
                  <div class="doc_cont_detail">
                    <div class="doc_cont_detail_name">
                      <p class="doc_ttl">書類名</p>
                      <p class="doc_name"><?php echo htmlspecialchars($document['title'] ?? 'タイトル不明'); ?></p>
                      <?php if (!empty($document['treatmentName'])): ?>
                        <p class="text-xs text-gray-500 mt-1">施術: <?php echo htmlspecialchars($document['treatmentName']); ?></p>
                      <?php endif; ?>
                    </div>
                    <div class="doc_cont_detail_date">
                      <p class="doc_ttl">作成日</p>
                      <p class="doc_date"><?php echo formatJapaneseDate($document['createdAt'] ?? ''); ?></p>
                    </div>
                  </div>
                  <div class="doc_link_wrap">
                    <?php if (!empty($document['url'])): ?>
                      <a class="doc_link" href="<?php echo htmlspecialchars($document['url']); ?>" target="_blank" rel="noopener noreferrer">
                        <span>プレビューを見る</span>
                      </a>
                    <?php else: ?>
                      <span class="doc_link disabled" style="opacity: 0.5; cursor: not-allowed;">
                        <span>プレビュー不可</span>
                      </span>
                    <?php endif; ?>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
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
        <p>書類件数: <?php echo count($documents); ?>件</p>
        <p>エラー: <?php echo $errorMessage ?: 'なし'; ?></p>
        <?php if (!empty($documents)): ?>
        <hr class="my-2 border-gray-600">
        <p><strong>書類データ:</strong></p>
        <pre class="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-32"><?php echo htmlspecialchars(json_encode($documents, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
        <?php endif; ?>
    </div>
<?php endif; ?>

<script>
// フォルダアコーディオン機能
function toggleFolder(folderId) {
    const folderContent = document.getElementById(folderId);
    const folderHeader = folderContent.previousElementSibling;
    const toggleArrow = folderHeader.querySelector('.toggle-arrow');
    
    if (folderContent.classList.contains('hidden')) {
        // フォルダを開く
        folderContent.classList.remove('hidden');
        folderContent.style.maxHeight = folderContent.scrollHeight + 'px';
        toggleArrow.style.transform = 'rotate(180deg)';
        
        // アニメーション効果
        folderContent.style.opacity = '0';
        folderContent.style.transform = 'translateY(-10px)';
        
        requestAnimationFrame(() => {
            folderContent.style.transition = 'all 0.3s ease-in-out';
            folderContent.style.opacity = '1';
            folderContent.style.transform = 'translateY(0)';
        });
    } else {
        // フォルダを閉じる
        folderContent.style.transition = 'all 0.3s ease-in-out';
        folderContent.style.opacity = '0';
        folderContent.style.transform = 'translateY(-10px)';
        folderContent.style.maxHeight = '0';
        
        setTimeout(() => {
            folderContent.classList.add('hidden');
            folderContent.style.removeProperty('max-height');
            folderContent.style.removeProperty('opacity');
            folderContent.style.removeProperty('transform');
            folderContent.style.removeProperty('transition');
        }, 300);
        
        toggleArrow.style.transform = 'rotate(0deg)';
    }
}

// 初期化時に全てのフォルダを閉じる
document.addEventListener('DOMContentLoaded', function() {
    const folderContents = document.querySelectorAll('.folder-content');
    folderContents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // フォルダのホバー効果
    const folderHeaders = document.querySelectorAll('.folder-header');
    folderHeaders.forEach(header => {
        header.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        
        header.addEventListener('mouseleave', function() {
            this.style.boxShadow = 'none';
        });
    });
});
</script>
</body>
</html>