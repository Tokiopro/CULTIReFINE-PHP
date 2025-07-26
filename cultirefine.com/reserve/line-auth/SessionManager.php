<?php
/**
 * セッション管理クラス
 * 
 * LINE認証とユーザーセッションの一元管理を行う
 */
class SessionManager {
    private static $instance = null;
    private $logger;
    private $sessionStarted = false;
    
    // セッション設定
    private const SESSION_LIFETIME = 86400; // 24時間（1日）
    private const SESSION_NAME = 'TENMA_HOSPITAL_SESSION';
    
    /**
     * コンストラクタ（シングルトン）
     */
    private function __construct() {
        require_once __DIR__ . '/logger.php';
        $this->logger = new Logger();
    }
    
    /**
     * インスタンスを取得
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * セッションを開始（簡略化版）
     */
    public function startSession() {
        if ($this->sessionStarted || session_status() === PHP_SESSION_ACTIVE) {
            return true;
        }
        
        // デフォルトのPHPセッション設定を使用
        // カスタム設定を最小限に抑える
        
        // セッションを開始
        $result = @session_start();
        
        if ($result) {
            $this->sessionStarted = true;
            $this->logger->info('セッション開始成功（簡略化版）', [
                'session_id' => session_id(),
                'session_name' => session_name(),
                'session_save_path' => session_save_path(),
                'cookie_params' => session_get_cookie_params()
            ]);
            
            // 基本的な初期化のみ
            if (!isset($_SESSION['initialized'])) {
                $_SESSION['initialized'] = true;
                $_SESSION['created_at'] = time();
            }
        } else {
            $this->logger->error('セッション開始失敗');
        }
        
        return $result;
    }
    
    /**
     * セッションを終了
     */
    public function destroySession() {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            
            // セッションクッキーを削除
            if (ini_get("session.use_cookies")) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000,
                    $params["path"], $params["domain"],
                    $params["secure"], $params["httponly"]
                );
            }
            
            session_destroy();
            $this->sessionStarted = false;
            
            $this->logger->info('セッション破棄完了');
        }
    }
    
    /**
     * LINE認証情報を保存
     */
    public function saveLINEAuth($lineUserId, $displayName, $pictureUrl = null) {
        $this->startSession();
        
        $_SESSION['line_user_id'] = $lineUserId;
        $_SESSION['line_display_name'] = $displayName;
        $_SESSION['line_picture_url'] = $pictureUrl;
        $_SESSION['line_auth_time'] = time();
        $_SESSION['last_activity'] = time(); // 最終アクティビティ時刻を記録
        
        // セッションを即座に書き込み
        session_write_close();
        $this->startSession(); // 再開
        
        $this->logger->info('LINE認証情報保存', [
            'line_user_id' => $lineUserId,
            'display_name' => $displayName,
            'has_picture' => !empty($pictureUrl),
            'session_id' => session_id()
        ]);
        
        return true;
    }
    
    /**
     * ユーザーデータを保存
     */
    public function saveUserData($userData) {
        $this->startSession();
        
        $_SESSION['user_data'] = $userData;
        $_SESSION['user_data_updated'] = time();
        
        $this->logger->info('ユーザーデータ保存', [
            'user_id' => $userData['id'] ?? $userData['visitor_id'] ?? 'unknown',
            'visitor_id' => $userData['visitor_id'] ?? null,
            'member_type' => $userData['member_type'] ?? null
        ]);
        
        return true;
    }
    
    /**
     * 会社情報を保存
     */
    public function saveCompanyInfo($companyInfo) {
        $this->startSession();
        
        $_SESSION['company_info'] = $companyInfo;
        $_SESSION['company_info_updated'] = time();
        
        $this->logger->info('会社情報保存', [
            'company_id' => $companyInfo['id'] ?? null,
            'company_name' => $companyInfo['name'] ?? null,
            'user_role' => $companyInfo['role'] ?? null
        ]);
        
        return true;
    }
    
    /**
     * LINE認証済みかチェック
     */
    public function isLINEAuthenticated() {
        $this->startSession();
        
        $isAuth = isset($_SESSION['line_user_id']) && !empty($_SESSION['line_user_id']);
        
        // セッションの有効期限をチェック
        if ($isAuth && isset($_SESSION['line_auth_time'])) {
            $elapsed = time() - $_SESSION['line_auth_time'];
            if ($elapsed > self::SESSION_LIFETIME) {
                $this->logger->info('セッションタイムアウト', [
                    'elapsed_time' => $elapsed,
                    'lifetime' => self::SESSION_LIFETIME
                ]);
                return false;
            }
        }
        
        return $isAuth;
    }
    
    /**
     * LINE User IDを取得
     */
    public function getLINEUserId() {
        $this->startSession();
        return $_SESSION['line_user_id'] ?? null;
    }
    
    /**
     * ユーザーデータを取得
     */
    public function getUserData() {
        $this->startSession();
        return $_SESSION['user_data'] ?? null;
    }
    
    /**
     * 会社情報を取得
     */
    public function getCompanyInfo() {
        $this->startSession();
        return $_SESSION['company_info'] ?? null;
    }
    
    /**
     * セッションデータ全体を取得（デバッグ用）
     */
    public function getSessionData() {
        $this->startSession();
        return $_SESSION;
    }
    
    /**
     * セッションをリフレッシュ
     */
    public function refreshSession() {
        $this->startSession();
        
        // セッションIDを再生成（セキュリティ対策）
        session_regenerate_id(true);
        
        // タイムスタンプを更新
        if (isset($_SESSION['line_auth_time'])) {
            $_SESSION['line_auth_time'] = time();
        }
        
        $this->logger->info('セッションリフレッシュ完了', [
            'new_session_id' => session_id()
        ]);
        
        return true;
    }
    
    /**
     * セッションの有効性をチェック
     */
    public function validateSession() {
        $this->startSession();
        
        // 基本的な認証チェック
        if (!$this->isLINEAuthenticated()) {
            return false;
        }
        
        // 最終アクティビティ時刻のチェック（24時間以内）
        if (isset($_SESSION['last_activity'])) {
            $inactiveTime = time() - $_SESSION['last_activity'];
            if ($inactiveTime > self::SESSION_LIFETIME) {
                $this->logger->info('セッション非アクティブタイムアウト', [
                    'inactive_time' => $inactiveTime,
                    'lifetime' => self::SESSION_LIFETIME
                ]);
                return false;
            }
        }
        
        // セッション作成時刻のチェック（最大48時間）
        if (isset($_SESSION['created_at'])) {
            $age = time() - $_SESSION['created_at'];
            if ($age > self::SESSION_LIFETIME * 2) { // 48時間以上経過
                $this->logger->info('古いセッション検出', ['age' => $age]);
                return false;
            }
        }
        
        // アクティビティ時刻を更新
        $_SESSION['last_activity'] = time();
        
        return true;
    }
    
    /**
     * 未登録フラグをチェック
     */
    public function isUserNotRegistered() {
        $this->startSession();
        return isset($_SESSION['user_not_registered']) && $_SESSION['user_not_registered'] === true;
    }
    
    /**
     * 未登録フラグの設定時刻を取得
     */
    public function getNotRegisteredTime() {
        $this->startSession();
        return $_SESSION['not_registered_time'] ?? 0;
    }
    
    /**
     * 未登録フラグをクリア
     */
    public function clearNotRegisteredFlag() {
        $this->startSession();
        unset($_SESSION['user_not_registered'], $_SESSION['not_registered_time']);
        
        $this->logger->info('未登録フラグをクリア');
    }
    
    /**
     * LINE表示名を取得
     */
    public function getLINEDisplayName() {
        $this->startSession();
        return $_SESSION['line_display_name'] ?? 'ゲスト';
    }
    
    /**
     * LINEプロフィール画像URLを取得
     */
    public function getLINEPictureUrl() {
        $this->startSession();
        return $_SESSION['line_picture_url'] ?? null;
    }
    
    /**
     * セッションエラーを取得
     */
    public function getSessionError() {
        $errors = [];
        
        if (session_status() === PHP_SESSION_DISABLED) {
            $errors[] = 'セッションが無効化されています';
        }
        
        $sessionPath = session_save_path();
        if ($sessionPath && !is_writable($sessionPath)) {
            $errors[] = 'セッション保存パスに書き込み権限がありません: ' . $sessionPath;
        }
        
        return $errors;
    }
}