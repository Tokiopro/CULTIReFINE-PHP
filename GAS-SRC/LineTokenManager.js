/**
 * LINE認証トークン管理
 */
class LineTokenManager {
  /**
   * LINE APIのベースURL
   */
  static getApiUrls() {
    return {
      token: 'https://api.line.me/oauth2/v2.1/token',
      profile: 'https://api.line.me/v2/profile'
    };
  }
  
  /**
   * 認証コードをアクセストークンに交換し、ユーザー情報を取得
   * @param {string} code - LINE認証コード
   * @returns {Object} ユーザー情報
   */
  static exchangeCodeForUserInfo(code) {
    try {
      // アクセストークンを取得
      const accessToken = this.getAccessToken(code);
      
      // ユーザープロファイルを取得
      const userProfile = this.getUserProfile(accessToken);
      
      return userProfile;
    } catch (error) {
      Logger.log('Error in exchangeCodeForUserInfo: ' + error.toString());
      throw error;
    }
  }
  
  /**
   * 認証コードからアクセストークンを取得
   * @param {string} code - LINE認証コード
   * @returns {string} アクセストークン
   */
  static getAccessToken(code) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const channelId = scriptProperties.getProperty('LINE_CHANNEL_ID');
    const channelSecret = scriptProperties.getProperty('LINE_CHANNEL_SECRET');
    
    if (!channelId || !channelSecret) {
      throw new Error('LINE認証情報が設定されていません。スクリプトプロパティにLINE_CHANNEL_IDとLINE_CHANNEL_SECRETを設定してください。');
    }
    
    // Web App URLを取得（リダイレクトURI）
    // Script Propertyから取得、なければ動的取得
    const redirectUri = scriptProperties.getProperty('DEPLOYMENT_URL') || ScriptApp.getService().getUrl();
    Logger.log(`トークン交換時のredirect_uri: ${redirectUri}`);
    
    const payload = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret
    };
    
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: Object.keys(payload)
        .map(key => `${key}=${encodeURIComponent(payload[key])}`)
        .join('&'),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(this.getApiUrls().token, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      Logger.log('LINE Token API Error: ' + response.getContentText());
      throw new Error('アクセストークンの取得に失敗しました: ' + (responseData.error_description || responseData.error || 'Unknown error'));
    }
    
    return responseData.access_token;
  }
  
  /**
   * アクセストークンからユーザープロファイルを取得
   * @param {string} accessToken - LINEアクセストークン
   * @returns {Object} ユーザープロファイル
   */
  static getUserProfile(accessToken) {
    const options = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(this.getApiUrls().profile, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      Logger.log('LINE Profile API Error: ' + response.getContentText());
      throw new Error('ユーザープロファイルの取得に失敗しました');
    }
    
    return {
      userId: responseData.userId,
      displayName: responseData.displayName,
      pictureUrl: responseData.pictureUrl,
      statusMessage: responseData.statusMessage
    };
  }
  
  /**
   * ユーザー情報を一時的に保存（オプション）
   * @param {string} authToken - 一時認証トークン
   * @param {Object} userInfo - ユーザー情報
   */
  static saveTemporaryUserInfo(authToken, userInfo) {
    const cache = CacheService.getScriptCache();
    // 10分間キャッシュ
    cache.put(`line_user_${authToken}`, JSON.stringify(userInfo), 600);
  }
  
  /**
   * 一時保存されたユーザー情報を取得（オプション）
   * @param {string} authToken - 一時認証トークン
   * @returns {Object|null} ユーザー情報
   */
  static getTemporaryUserInfo(authToken) {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(`line_user_${authToken}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  /**
   * LINE Messaging API用のチャネルアクセストークンを取得
   * @returns {string|null} チャネルアクセストークン
   */
  getChannelAccessToken() {
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const accessToken = scriptProperties.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
      
      if (!accessToken) {
        Logger.log('LINE_CHANNEL_ACCESS_TOKENが設定されていません');
        return null;
      }
      
      return accessToken;
    } catch (error) {
      Logger.log('チャネルアクセストークン取得エラー: ' + error.toString());
      return null;
    }
  }

  /**
   * LINE Messaging API用のチャネルアクセストークンを取得（新しい専用プロパティ）
   * @returns {string|null} チャネルアクセストークン
   */
  getMessagingChannelAccessToken() {
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const accessToken = scriptProperties.getProperty('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');
      
      if (!accessToken) {
        Logger.log('LINE_MESSAGING_CHANNEL_ACCESS_TOKENが設定されていません');
        return null;
      }
      
      return accessToken;
    } catch (error) {
      Logger.log('Messaging API チャネルアクセストークン取得エラー: ' + error.toString());
      return null;
    }
  }

  /**
   * LINE Messaging API用のチャネルシークレットを取得
   * @returns {string|null} チャネルシークレット
   */
  getMessagingChannelSecret() {
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const channelSecret = scriptProperties.getProperty('LINE_MESSAGING_CHANNEL_SECRET');
      
      if (!channelSecret) {
        Logger.log('LINE_MESSAGING_CHANNEL_SECRETが設定されていません');
        return null;
      }
      
      return channelSecret;
    } catch (error) {
      Logger.log('Messaging API チャネルシークレット取得エラー: ' + error.toString());
      return null;
    }
  }

  /**
   * LINE Messaging API用のチャネルIDを取得
   * @returns {string|null} チャネルID
   */
  getMessagingChannelId() {
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const channelId = scriptProperties.getProperty('LINE_MESSAGING_CHANNEL_ID');
      
      if (!channelId) {
        Logger.log('LINE_MESSAGING_CHANNEL_IDが設定されていません');
        return null;
      }
      
      return channelId;
    } catch (error) {
      Logger.log('Messaging API チャネルID取得エラー: ' + error.toString());
      return null;
    }
  }

  /**
   * LINE Messaging API設定の完全性をチェック
   * @returns {Object} チェック結果
   */
  checkMessagingApiSettings() {
    const channelId = this.getMessagingChannelId();
    const channelSecret = this.getMessagingChannelSecret();
    const accessToken = this.getMessagingChannelAccessToken();
    
    return {
      channelId: !!channelId,
      channelSecret: !!channelSecret,
      accessToken: !!accessToken,
      isComplete: !!(channelId && channelSecret && accessToken)
    };
  }
}