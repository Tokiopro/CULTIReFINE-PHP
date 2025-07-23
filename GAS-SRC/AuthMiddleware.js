/**
 * 認証ミドルウェア
 * APIキー、Bearer トークンの検証を行う
 */
class AuthMiddleware {
  /**
   * 認証を実行
   * @param {Object} e - Google Apps Script イベントオブジェクト
   * @returns {boolean} 認証成功/失敗
   */
  static authenticate(e) {
    try {
      // 公開エンドポイントのチェック
      if (this.isPublicEndpoint(e)) {
        Logger.log('AuthMiddleware: Public endpoint, skipping authentication');
        return true;
      }
      
      // Authorizationヘッダーの取得
      const authHeader = this.getAuthorizationHeader(e);
      
      if (!authHeader) {
        Logger.log('AuthMiddleware: No authorization header found');
        return false;
      }
      
      // Bearer トークン認証
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return this.validateBearerToken(token);
      }
      
      // APIキー認証（後方互換性）
      if (authHeader.startsWith('ApiKey ')) {
        const apiKey = authHeader.substring(7);
        return this.validateApiKey(apiKey);
      }
      
      Logger.log('AuthMiddleware: Invalid authorization header format');
      return false;
      
    } catch (error) {
      Logger.log(`AuthMiddleware error: ${error.toString()}`);
      return false;
    }
  }
  
  /**
   * Authorizationヘッダーを取得
   * @param {Object} e - イベントオブジェクト
   * @returns {string|null} Authorizationヘッダー値
   */
  static getAuthorizationHeader(e) {
    // クエリパラメータから取得（GASの制限のため）
    if (e.parameter && e.parameter.Authorization) {
      return e.parameter.Authorization;
    }
    
    // POSTボディから取得
    if (e.body && e.body.authorization) {
      return e.body.authorization;
    }
    
    // ヘッダーから取得（可能な場合）
    if (e.headers && e.headers.Authorization) {
      return e.headers.Authorization;
    }
    
    return null;
  }
  
  /**
   * Bearer トークンの検証
   * @param {string} token - Bearer トークン
   * @returns {boolean} 検証結果
   */
  static validateBearerToken(token) {
    if (!token) {
      Logger.log('AuthMiddleware: No token provided');
      return false;
    }
    
    Logger.log(`AuthMiddleware: Validating bearer token: "${token}"`);
    
    const scriptProperties = PropertiesService.getScriptProperties();
    
    // 複数のトークンをサポート
    const validTokens = this.getValidTokens(scriptProperties);
    Logger.log(`AuthMiddleware: Valid tokens list: ${JSON.stringify(validTokens)}`);
    Logger.log(`AuthMiddleware: Number of valid tokens: ${validTokens.length}`);
    
    if (validTokens.includes(token)) {
      Logger.log('AuthMiddleware: Valid bearer token - found in list');
      return true;
    }
    
    // OAuth 2.0 トークンの検証（Medical Force API用）
    if (this.isValidOAuthToken(token)) {
      Logger.log('AuthMiddleware: Valid OAuth token');
      return true;
    }
    
    Logger.log(`AuthMiddleware: Invalid bearer token - "${token}" not found in valid tokens`);
    return false;
  }
  
  /**
   * APIキーの検証（後方互換性）
   * @param {string} apiKey - APIキー
   * @returns {boolean} 検証結果
   */
  static validateApiKey(apiKey) {
    if (!apiKey) {
      return false;
    }
    
    const scriptProperties = PropertiesService.getScriptProperties();
    const validApiKeys = (scriptProperties.getProperty('ALLOWED_API_KEYS') || '').split(',').map(k => k.trim());
    
    if (validApiKeys.includes(apiKey)) {
      Logger.log('AuthMiddleware: Valid API key');
      return true;
    }
    
    // デフォルトAPIキーの確認
    const defaultKey = scriptProperties.getProperty('DEFAULT_API_KEY');
    if (apiKey === defaultKey) {
      Logger.log('AuthMiddleware: Valid default API key');
      return true;
    }
    
    Logger.log('AuthMiddleware: Invalid API key');
    return false;
  }
  
  /**
   * 有効なトークンリストを取得
   * @param {PropertiesService} scriptProperties - スクリプトプロパティ
   * @returns {Array} 有効なトークンの配列
   */
  static getValidTokens(scriptProperties) {
    const tokens = [];
    
    // PHP API用トークン
    const phpTokens = (scriptProperties.getProperty('PHP_API_KEYS') || '').split(',').map(t => t.trim());
    tokens.push(...phpTokens);
    
    // 一般APIトークン
    const apiTokens = (scriptProperties.getProperty('API_TOKENS') || '').split(',').map(t => t.trim());
    tokens.push(...apiTokens);
    
    // LINE Bot用トークンは含めない（セキュリティのため）
    // LINEトークンはLINE Bot専用であり、一般的なAPI認証には使用しない
    
    return tokens.filter(t => t); // 空の値を除外
  }
  
  /**
   * OAuth 2.0 トークンの検証
   * @param {string} token - OAuthトークン
   * @returns {boolean} 検証結果
   */
  static isValidOAuthToken(token) {
    try {
      // Medical Force APIのアクセストークンかチェック
      const currentToken = TokenManager.getAccessToken();
      
      return token === currentToken;
    } catch (error) {
      Logger.log(`OAuth token validation error: ${error.toString()}`);
      return false;
    }
  }
  
  /**
   * 公開エンドポイントかチェック
   * @param {Object} e - イベントオブジェクト
   * @returns {boolean} 公開エンドポイントかどうか
   */
  static isPublicEndpoint(e) {
    const publicEndpoints = [
      '/api/health',
      '/api/v1/health',
      '/api/',
      '/api/v1/',
      ''  // 空のpathも許可（ヘルスチェック表示のため）
    ];
    
    // pathパラメータを取得（デフォルトは空文字）
    const path = (e.parameter && e.parameter.path) || '';
    
    // 完全一致チェック
    if (publicEndpoints.includes(path)) {
      return true;
    }
    
    // LINE Webhook（署名で検証）
    if (e.postData && e.postData.contents) {
      try {
        const data = JSON.parse(e.postData.contents);
        if (data.events) {
          // LINE Webhookは署名検証を別途行う
          return true;
        }
      } catch (error) {
        // JSONパースエラーは無視
      }
    }
    
    return false;
  }
  
  /**
   * 認証情報からユーザー情報を取得
   * @param {Object} e - イベントオブジェクト
   * @returns {Object|null} ユーザー情報
   */
  static getAuthenticatedUser(e) {
    const authHeader = this.getAuthorizationHeader(e);
    
    if (!authHeader) {
      return null;
    }
    
    // トークンからユーザー情報を取得（実装は要件に応じて）
    return {
      type: 'api_client',
      authenticated: true
    };
  }
  
  /**
   * 特定のスコープに対する権限チェック
   * @param {Object} e - イベントオブジェクト
   * @param {string} scope - 必要なスコープ
   * @returns {boolean} 権限があるかどうか
   */
  static hasScope(e, scope) {
    // 現在の実装では全てのトークンに全権限を付与
    // 将来的にはトークンごとにスコープを管理
    return this.authenticate(e);
  }
}

/**
 * 認証ミドルウェアのテスト関数
 */
function testAuthMiddleware() {
  console.log('=== AuthMiddleware テスト開始 ===');
  
  // テストケース1: Bearer トークン認証（保護されたエンドポイント）
  const e1 = {
    parameter: {
      Authorization: 'Bearer php_api_key_123',
      path: '/api/v1/patients/123'  // 保護されたエンドポイント
    }
  };
  console.log('Bearer token test (protected endpoint):', AuthMiddleware.authenticate(e1));
  
  // テストケース2: APIキー認証（保護されたエンドポイント）
  const e2 = {
    parameter: {
      Authorization: 'ApiKey test-api-key',
      path: '/api/v1/reservations'  // 保護されたエンドポイント
    }
  };
  console.log('API key test (protected endpoint):', AuthMiddleware.authenticate(e2));
  
  // テストケース3: 認証なし（保護されたエンドポイント）
  const e3 = {
    parameter: {
      path: '/api/v1/patients'  // 保護されたエンドポイント
    }
  };
  console.log('No auth test (protected endpoint):', AuthMiddleware.authenticate(e3));
  
  // テストケース4: 公開エンドポイント
  const e4 = {
    parameter: {
      path: '/api/health'
    }
  };
  console.log('Public endpoint test:', AuthMiddleware.authenticate(e4));
  
  // テストケース5: 無効なトークン（保護されたエンドポイント）
  const e5 = {
    parameter: {
      Authorization: 'Bearer invalid-token',
      path: '/api/v1/patients/123'  // 保護されたエンドポイント
    }
  };
  console.log('Invalid token test:', AuthMiddleware.authenticate(e5));
  
  // テストケース6: LINEトークンでの認証試行（セキュリティチェック）
  const scriptProperties = PropertiesService.getScriptProperties();
  const lineToken = scriptProperties.getProperty('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');
  if (lineToken) {
    const e6 = {
      parameter: {
        Authorization: `Bearer ${lineToken}`,
        path: '/api/v1/patients/123'  // 保護されたエンドポイント
      }
    };
    console.log('LINE token test (should fail):', AuthMiddleware.authenticate(e6));
  }
  
  console.log('=== テスト完了 ===');
}