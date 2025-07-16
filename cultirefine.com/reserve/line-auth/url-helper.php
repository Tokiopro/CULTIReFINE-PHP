<?php
/**
 * URL Helper Functions
 * ドメインを動的に検出してURLを生成するヘルパー関数
 */

/**
 * 現在のベースURLを取得
 * @return string ベースURL (例: https://example.com)
 */
function getBaseUrl() {
    // プロトコルの判定
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    
    // ホスト名の取得
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    return $protocol . '://' . $host;
}

/**
 * 完全なURLを生成
 * @param string $path 相対パス (例: /reserve/line-auth/callback.php)
 * @return string 完全なURL
 */
function getFullUrl($path) {
    return getBaseUrl() . $path;
}

/**
 * 現在のディレクトリからの相対URLを生成
 * @param string $targetPath 目標パス
 * @return string 相対URL
 */
function getRelativeUrl($targetPath) {
    // 現在のURLパスを取得
    $currentPath = dirname($_SERVER['SCRIPT_NAME']);
    
    // 両方のパスを正規化
    $currentParts = array_filter(explode('/', $currentPath));
    $targetParts = array_filter(explode('/', $targetPath));
    
    // 共通の親ディレクトリを見つける
    $commonLength = 0;
    $minLength = min(count($currentParts), count($targetParts));
    
    for ($i = 0; $i < $minLength; $i++) {
        if ($currentParts[$i] === $targetParts[$i]) {
            $commonLength++;
        } else {
            break;
        }
    }
    
    // 相対パスを構築
    $upLevels = count($currentParts) - $commonLength;
    $relativePath = str_repeat('../', $upLevels);
    
    // 残りのターゲットパスを追加
    $remainingParts = array_slice($targetParts, $commonLength);
    if (!empty($remainingParts)) {
        $relativePath .= implode('/', $remainingParts);
    }
    
    return $relativePath ?: './';
}

/**
 * リダイレクト用のURLを生成
 * @param string $path パス (例: /reserve/ticket/)
 * @return string リダイレクト用URL
 */
function getRedirectUrl($path) {
    // 開発環境と本番環境を判定
    if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'production') {
        // 本番環境では絶対パスを使用
        return $path;
    } else {
        // 開発環境では完全なURLを使用
        return getFullUrl($path);
    }
}

/**
 * LINE認証コールバックURLを動的に生成
 * @return string コールバックURL
 */
function getLineCallbackUrl() {
    return getFullUrl('/reserve/line-auth/callback.php');
}