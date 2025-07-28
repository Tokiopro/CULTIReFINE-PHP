/**
 * LINE会員連携リンク管理サービス
 * 
 * LINE上でクリック可能なリンクを生成し、会員番号とLINE IDを紐付ける機能を提供
 * リンクは発行から翌日の7時まで有効
 */
class LineMemberLinkService {
  constructor() {
    this.sheetName = 'LINE会員連携管理';
  }
  
  /**
   * 会員番号に対するLINE連携リンクを生成
   * @param {string} memberNumber - 会員番号
   * @param {string} memberName - 会員名（オプション）
   * @return {Object} リンク情報 {url, token, expiryTime}
   */
  generateMemberLineLink(memberNumber, memberName = '') {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`=== LINE連携リンク生成開始 ===`);
      Logger.log(`会員番号: ${memberNumber}, 会員名: ${memberName}`);
      
      // 1. 一意のトークンを生成
      const token = this._generateSecureToken();
      
      // 2. 有効期限を設定（翌日7時）
      const expiryTime = this._getExpiryTime();
      
      // 3. データを保存
      this._saveLinkData({
        token: token,
        memberNumber: memberNumber,
        memberName: memberName,
        expiryTime: expiryTime,
        used: false,
        status: '未使用',
        createdAt: new Date()
      });
      
      // 4. LINE認証URLを生成
      const lineAuthUrl = this._buildLineAuthUrl(token);
      
      Logger.log(`LINE連携リンク生成完了`);
      Logger.log(`トークン: ${token.substring(0, 20)}...`);
      Logger.log(`有効期限: ${expiryTime.toLocaleString('ja-JP')}`);
      Logger.log(`URL: ${lineAuthUrl}`);
      
      return {
        url: lineAuthUrl,
        token: token,
        expiryTime: expiryTime,
        memberNumber: memberNumber
      };
    }, 'LINE連携リンク生成');
  }
  
  /**
   * トークンの検証と会員情報の取得
   * @param {string} token - 検証するトークン
   * @return {Object|null} 会員情報またはnull
   */
  validateTokenAndGetMemberInfo(token) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`トークン検証開始: ${token}`);
      
      const sheet = this._getSheet();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      // ヘッダーのインデックスを取得
      const tokenIndex = headers.indexOf('トークン');
      const memberNumberIndex = headers.indexOf('会員番号');
      const memberNameIndex = headers.indexOf('会員名');
      const expiryTimeIndex = headers.indexOf('有効期限');
      const usedIndex = headers.indexOf('使用済み');
      const statusIndex = headers.indexOf('ステータス');
      
      // トークンを検索
      for (let i = 1; i < data.length; i++) {
        if (data[i][tokenIndex] === token) {
          const expiryTime = new Date(data[i][expiryTimeIndex]);
          const isUsed = data[i][usedIndex];
          
          // 有効期限チェック
          if (new Date() > expiryTime) {
            Logger.log(`トークン期限切れ: ${token}`);
            // ステータスを更新
            sheet.getRange(i + 1, statusIndex + 1).setValue('期限切れ');
            return null;
          }
          
          // 使用済みチェック
          if (isUsed) {
            Logger.log(`トークン使用済み: ${token}`);
            return null;
          }
          
          Logger.log(`トークン検証成功: 会員番号 ${data[i][memberNumberIndex]}`);
          
          return {
            rowIndex: i + 1,
            memberNumber: data[i][memberNumberIndex],
            memberName: data[i][memberNameIndex],
            token: token
          };
        }
      }
      
      Logger.log(`トークンが見つかりません: ${token}`);
      return null;
    }, 'トークン検証');
  }
  
  /**
   * LINE認証成功後の紐付け処理
   * @param {string} token - トークン
   * @param {Object} lineUserInfo - LINEユーザー情報
   * @return {boolean} 成功/失敗
   */
  linkMemberWithLineId(token, lineUserInfo) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`LINE ID紐付け開始 - トークン: ${token}, LINE ID: ${lineUserInfo.userId}`);
      
      // トークン検証と会員情報取得
      const memberInfo = this.validateTokenAndGetMemberInfo(token);
      if (!memberInfo) {
        throw new Error('無効なトークンです');
      }
      
      const sheet = this._getSheet();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      // 更新するカラムのインデックスを取得
      const usedIndex = headers.indexOf('使用済み') + 1;
      const lineIdIndex = headers.indexOf('LINE_ID') + 1;
      const lineNameIndex = headers.indexOf('LINE表示名') + 1;
      const linkedAtIndex = headers.indexOf('紐付け日時') + 1;
      const statusIndex = headers.indexOf('ステータス') + 1;
      
      // 連携管理シートを更新
      const rowIndex = memberInfo.rowIndex;
      sheet.getRange(rowIndex, usedIndex).setValue(true);
      sheet.getRange(rowIndex, lineIdIndex).setValue(lineUserInfo.userId);
      sheet.getRange(rowIndex, lineNameIndex).setValue(lineUserInfo.displayName);
      sheet.getRange(rowIndex, linkedAtIndex).setValue(new Date());
      sheet.getRange(rowIndex, statusIndex).setValue('紐付け完了');
      
      // 患者マスタを更新
      this._updateVisitorMaster(memberInfo.memberNumber, lineUserInfo);
      
      Logger.log(`LINE ID紐付け完了 - 会員番号: ${memberInfo.memberNumber}, LINE ID: ${lineUserInfo.userId}`);
      
      return true;
    }, 'LINE ID紐付け');
  }
  
  /**
   * 期限切れトークンの削除
   * @return {number} 削除件数
   */
  cleanupExpiredTokens() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('期限切れトークンのクリーンアップ開始');
      
      const sheet = this._getSheet();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const expiryTimeIndex = headers.indexOf('有効期限');
      const statusIndex = headers.indexOf('ステータス');
      
      let deletedCount = 0;
      const now = new Date();
      
      // 後ろから処理（削除時のインデックスずれを防ぐ）
      for (let i = data.length - 1; i >= 1; i--) {
        const expiryTime = new Date(data[i][expiryTimeIndex]);
        if (now > expiryTime) {
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
      
      Logger.log(`期限切れトークン削除完了: ${deletedCount}件`);
      return deletedCount;
    }, '期限切れトークン削除');
  }
  
  /**
   * セキュアなトークンを生成（128ビット相当）
   * @return {string} トークン
   */
  _generateSecureToken() {
    // UUID v4を2つ組み合わせて強度を高める
    const uuid1 = Utilities.getUuid().replace(/-/g, '');
    const uuid2 = Utilities.getUuid().replace(/-/g, '');
    return uuid1 + uuid2;
  }
  
  /**
   * 有効期限を計算（翌日の7時）
   * @return {Date} 有効期限
   */
  _getExpiryTime() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);
    return tomorrow;
  }
  
  /**
   * リンクデータを保存
   * @param {Object} linkData - 保存するデータ
   */
  _saveLinkData(linkData) {
    const sheet = this._getSheet();
    
    const row = [
      linkData.token,
      linkData.memberNumber,
      linkData.memberName,
      linkData.expiryTime,
      linkData.used,
      '', // LINE_ID
      '', // LINE表示名
      '', // 紐付け日時
      linkData.status,
      linkData.createdAt
    ];
    
    sheet.appendRow(row);
  }
  
  /**
   * LINE認証URLを構築
   * @param {string} token - トークン
   * @return {string} LINE認証URL
   */
  _buildLineAuthUrl(token) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const channelId = scriptProperties.getProperty('LINE_CHANNEL_ID');
    
    if (!channelId) {
      throw new Error('LINE_CHANNEL_IDが設定されていません');
    }
    
    // WebアプリのURLを取得
    // Script Propertyから取得、なければ動的取得
    const baseUrl = scriptProperties.getProperty('DEPLOYMENT_URL') || ScriptApp.getService().getUrl();
    Logger.log(`WebアプリベースURL: ${baseUrl}`);
    
    // 専用のコールバックURLを使用（ベースURLのみ）
    const callbackUrl = baseUrl;
    Logger.log(`コールバックURL: ${callbackUrl}`);
    
    const params = {
      response_type: 'code',
      client_id: channelId,
      redirect_uri: callbackUrl,
      state: `member_link_${token}`,
      scope: 'profile openid'
    };
    
    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    return `https://access.line.me/oauth2/v2.1/authorize?${queryString}`;
  }
  
  /**
   * 患者マスタを更新
   * @param {string} memberNumber - 会員番号（カルテ番号）
   * @param {Object} lineUserInfo - LINEユーザー情報
   */
  _updateVisitorMaster(memberNumber, lineUserInfo) {
    try {
      const visitorSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(Config.getSheetNames().visitors);
      
      if (!visitorSheet) {
        Logger.log('患者マスタシートが見つかりません');
        return;
      }
      
      const data = visitorSheet.getDataRange().getValues();
      const headers = data[0];
      
      // カルテ番号とLINE_IDのインデックスを取得
      const karteIndex = headers.indexOf('カルテ番号');
      const lineIdIndex = headers.indexOf('LINE_ID');
      
      if (karteIndex === -1 || lineIdIndex === -1) {
        Logger.log('必要なカラムが見つかりません');
        return;
      }
      
      // カルテ番号で患者を検索
      for (let i = 1; i < data.length; i++) {
        if (data[i][karteIndex] === memberNumber) {
          // LINE_IDを更新
          visitorSheet.getRange(i + 1, lineIdIndex + 1).setValue(lineUserInfo.userId);
          Logger.log(`患者マスタ更新完了 - カルテ番号: ${memberNumber}, LINE_ID: ${lineUserInfo.userId}`);
          break;
        }
      }
    } catch (error) {
      Logger.log(`患者マスタ更新エラー: ${error.toString()}`);
      // エラーが発生しても連携処理は続行
    }
  }
  
  /**
   * visitor_id用のトークン生成（会社別来院者管理用）
   * @param {string} visitorId - visitor_id
   * @return {string} トークン
   */
  generateMemberLinkToken(visitorId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`=== visitor_id用LINE連携トークン生成開始 ===`);
      Logger.log(`visitor_id: ${visitorId}`);
      
      // 1. 一意のトークンを生成
      const token = this._generateSecureToken();
      
      // 2. 有効期限を設定（翌日7時）
      const expiryTime = this._getExpiryTime();
      
      // 3. データを保存
      this._saveLinkData({
        token: token,
        memberNumber: visitorId, // visitor_idを会員番号として使用
        memberName: '', // 会員名は空
        expiryTime: expiryTime,
        used: false,
        status: '未使用',
        createdAt: new Date()
      });
      
      Logger.log(`visitor_id用トークン生成完了: ${token.substring(0, 20)}...`);
      return token;
    }, 'visitor_id用トークン生成');
  }
  
  /**
   * visitor_id用のLINE連携URL生成（会社別来院者管理用）
   * @param {string} token - トークン
   * @return {string} LINE認証URL
   */
  generateMemberLinkUrl(token) {
    return this._buildLineAuthUrl(token);
  }
  
  /**
   * visitor_idでリンクデータを取得（会社別来院者管理用）
   * @param {string} visitorId - visitor_id
   * @return {Object|null} リンクデータ
   */
  getMemberLinkByVisitorId(visitorId) {
    return Utils.executeWithErrorHandling(() => {
      const sheet = this._getSheet();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const tokenIndex = headers.indexOf('トークン');
      const memberNumberIndex = headers.indexOf('会員番号');
      const expiryTimeIndex = headers.indexOf('有効期限');
      const usedIndex = headers.indexOf('使用済み');
      const statusIndex = headers.indexOf('ステータス');
      
      // visitor_idを検索（会員番号として保存されている）
      for (let i = 1; i < data.length; i++) {
        if (data[i][memberNumberIndex] === visitorId) {
          const expiryTime = new Date(data[i][expiryTimeIndex]);
          const isUsed = data[i][usedIndex];
          const status = data[i][statusIndex];
          
          // 有効期限内かつ未使用のもののみ返す
          if (new Date() <= expiryTime && !isUsed && status === '未使用') {
            const token = data[i][tokenIndex];
            return {
              token: token,
              url: this._buildLineAuthUrl(token),
              expiryTime: expiryTime,
              status: status
            };
          }
        }
      }
      
      return null;
    }, 'visitor_id用リンクデータ取得');
  }

  /**
   * 管理シートを取得（なければ作成）
   * @return {Sheet} シート
   */
  _getSheet() {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
    
    if (!sheet) {
      // シートが存在しない場合は作成
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(this.sheetName);
      
      // ヘッダーを設定
      const headers = [
        'トークン',
        '会員番号',
        '会員名',
        '有効期限',
        '使用済み',
        'LINE_ID',
        'LINE表示名',
        '紐付け日時',
        'ステータス',
        '作成日時'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // ヘッダーの書式設定
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#4285F4')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
      
      // 列幅の調整
      sheet.setColumnWidth(1, 300); // トークン
      sheet.setColumnWidth(4, 150); // 有効期限
      sheet.setColumnWidth(8, 150); // 紐付け日時
      
      Logger.log(`${this.sheetName}シートを作成しました`);
    }
    
    return sheet;
  }
}