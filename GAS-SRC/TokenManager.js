/**
 * Medical Force API アクセストークン管理
 */
class TokenManager {
  /**
   * 有効なアクセストークンを取得
   * キャッシュされたトークンがあり有効期限内であればそれを返す
   * なければ新規取得する
   */
  static getAccessToken() {
    const scriptProperties = PropertiesService.getScriptProperties();
    const cachedToken = scriptProperties.getProperty('MEDICAL_FORCE_ACCESS_TOKEN');
    const tokenExpiry = scriptProperties.getProperty('MEDICAL_FORCE_TOKEN_EXPIRY');
    
    // キャッシュされたトークンが有効かチェック
    if (cachedToken && tokenExpiry) {
      const expiryTime = new Date(tokenExpiry);
      const now = new Date();
      
      // 有効期限の5分前までは有効とする（余裕を持たせる）
      const bufferTime = 5 * 60 * 1000; // 5分
      if (expiryTime.getTime() - bufferTime > now.getTime()) {
        Logger.log('キャッシュされたトークンを使用');
        return cachedToken;
      }
    }
    
    // 新しいトークンを取得
    Logger.log('新しいアクセストークンを取得');
    return this.refreshToken();
  }
  
  /**
   * 新しいアクセストークンを取得
   */
  static refreshToken() {
    const scriptProperties = PropertiesService.getScriptProperties();
    const clientId = scriptProperties.getProperty('MEDICAL_FORCE_CLIENT_ID');
    const clientSecret = scriptProperties.getProperty('MEDICAL_FORCE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('認証情報が設定されていません。スクリプトプロパティにMEDICAL_FORCE_CLIENT_IDとMEDICAL_FORCE_CLIENT_SECRETを設定してください。');
    }
    
    const tokenUrl = Config.getApiConfig().baseUrl + '/token';
    const payload = {
      client_id: clientId,
      client_secret: clientSecret
    };
    
    /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} */
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(tokenUrl, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (responseCode !== 200) {
        Logger.log(`トークン取得エラー: ${responseCode} - ${responseText}`);
        throw new Error(`トークン取得に失敗しました: ${responseCode}`);
      }
      
      const data = JSON.parse(responseText);
      
      if (!data.access_token) {
        throw new Error('アクセストークンが返されませんでした');
      }
      
      // トークンと有効期限をキャッシュ
      const expiresIn = data.expires_in || 3600; // デフォルト1時間
      const expiryTime = new Date();
      expiryTime.setSeconds(expiryTime.getSeconds() + expiresIn);
      
      scriptProperties.setProperty('MEDICAL_FORCE_ACCESS_TOKEN', data.access_token);
      scriptProperties.setProperty('MEDICAL_FORCE_TOKEN_EXPIRY', expiryTime.toISOString());
      
      Logger.log(`新しいトークンを取得しました。有効期限: ${expiryTime.toISOString()}`);
      
      return data.access_token;
      
    } catch (error) {
      Logger.log(`トークン取得エラー: ${error.message}`);
      throw new Error(`アクセストークンの取得に失敗しました: ${error.message}`);
    }
  }
  
  /**
   * キャッシュされたトークンをクリア
   * （デバッグ用）
   */
  static clearTokenCache() {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty('MEDICAL_FORCE_ACCESS_TOKEN');
    scriptProperties.deleteProperty('MEDICAL_FORCE_TOKEN_EXPIRY');
    Logger.log('トークンキャッシュをクリアしました');
  }
  
  /**
   * 認証情報が設定されているかチェック
   */
  static hasCredentials() {
    const scriptProperties = PropertiesService.getScriptProperties();
    const clientId = scriptProperties.getProperty('MEDICAL_FORCE_CLIENT_ID');
    const clientSecret = scriptProperties.getProperty('MEDICAL_FORCE_CLIENT_SECRET');
    
    return !!(clientId && clientSecret);
  }
}