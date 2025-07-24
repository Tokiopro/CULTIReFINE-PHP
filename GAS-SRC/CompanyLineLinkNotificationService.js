/**
 * LINE連携リンク未使用者の定期通知サービス
 * 
 * 機能:
 * - リンク発行済みだが未連携の来院者を検出
 * - メールとLINEグループへの通知送信
 * - 定期実行（毎日朝9時）
 */
class CompanyLineLinkNotificationService {
  constructor() {
    this.sheetName = Config.getSheetNames().companyVisitors;
    this.sheet = SpreadsheetApp.openById(Config.getSpreadsheetId()).getSheetByName(this.sheetName);
    this.lineTokenManager = new LineTokenManager();
    
    // 列インデックス定義（CompanyLineLinkServiceと同じ）
    this.columns = {
      companyId: 0,      // A列: 会社ID
      companyName: 1,    // B列: 会社名
      visitorId: 2,      // C列: visitor_id
      visitorName: 3,    // D列: 氏名
      lineId: 4,         // E列: LINE_ID
      memberType: 5,     // F列: 会員種別
      publicSetting: 6,  // G列: 公開設定
      position: 7,       // H列: 役職
      createdAt: 8,      // I列: 登録日時
      updatedAt: 9,      // J列: 更新日時
      expireTime: 10,    // K列: 有効期限
      isUsed: 11,        // L列: 使用済み
      lineDisplayName: 12, // M列: LINE表示名
      linkedAt: 13,      // N列: 紐付け日時
      status: 14,        // O列: ステータス
      linkCreatedAt: 15, // P列: 作成日時
      linkUrl: 16        // Q列: リンクURL
    };
  }
  
  /**
   * 未連携者の通知を実行（メイン処理）
   * @return {Object} 実行結果
   */
  async notifyUnlinkedVisitors() {
    return Utils.executeWithErrorHandlingAsync(async () => {
      Logger.log('=== LINE連携未完了者通知開始 ===');
      
      // 未連携者を検出
      const unlinkedVisitors = this.detectUnlinkedVisitors();
      
      if (unlinkedVisitors.length === 0) {
        Logger.log('未連携者なし - 通知をスキップ');
        return {
          success: true,
          message: '未連携者はいません',
          count: 0
        };
      }
      
      // 会社別にグループ化
      const groupedByCompany = this.groupByCompany(unlinkedVisitors);
      
      // メール通知を送信
      const emailResult = await this.sendEmailNotification(groupedByCompany);
      
      // LINE通知を送信
      const lineResult = await this.sendLineNotification(groupedByCompany);
      
      Logger.log(`=== 通知完了 - 対象者数: ${unlinkedVisitors.length} ===`);
      
      return {
        success: true,
        totalCount: unlinkedVisitors.length,
        companyCount: Object.keys(groupedByCompany).length,
        emailSent: emailResult.success,
        lineSent: lineResult.success
      };
      
    }, 'notifyUnlinkedVisitors');
  }
  
  /**
   * リンク発行済みだが未連携の来院者を検出
   * @return {Array} 未連携者リスト
   */
  detectUnlinkedVisitors() {
    try {
      if (!this.sheet) {
        Logger.log('会社別来院者管理シートが見つかりません');
        return [];
      }
      
      const data = this.sheet.getDataRange().getValues();
      const now = new Date();
      const unlinkedVisitors = [];
      
      // ヘッダー行を除いてデータを処理
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const lineId = row[this.columns.lineId];
        const status = row[this.columns.status];
        const linkUrl = row[this.columns.linkUrl];
        const expireTime = row[this.columns.expireTime];
        const position = row[this.columns.position];
        
        // リンク発行済みだがLINE IDが空で、有効期限内の場合
        if ((!lineId || lineId.trim() === '') && 
            status === 'リンク発行済み' && 
            linkUrl && 
            expireTime && 
            new Date(expireTime) > now &&
            (position === '社長' || position === '秘書')) {
          
          unlinkedVisitors.push({
            companyId: row[this.columns.companyId],
            companyName: row[this.columns.companyName],
            visitorId: row[this.columns.visitorId],
            visitorName: row[this.columns.visitorName],
            position: position,
            linkUrl: linkUrl,
            expireTime: expireTime,
            linkCreatedAt: row[this.columns.linkCreatedAt]
          });
        }
      }
      
      Logger.log(`未連携者検出: ${unlinkedVisitors.length}名`);
      return unlinkedVisitors;
      
    } catch (error) {
      Logger.log('未連携者検出エラー: ' + error.toString());
      return [];
    }
  }
  
  /**
   * 会社別にグループ化
   * @param {Array} visitors - 来院者リスト
   * @return {Object} 会社別グループ
   */
  groupByCompany(visitors) {
    const grouped = {};
    
    visitors.forEach(visitor => {
      if (!grouped[visitor.companyId]) {
        grouped[visitor.companyId] = {
          companyName: visitor.companyName,
          visitors: []
        };
      }
      grouped[visitor.companyId].visitors.push(visitor);
    });
    
    return grouped;
  }
  
  /**
   * メール通知を送信
   * @param {Object} groupedVisitors - 会社別グループ化されたデータ
   * @return {Object} 送信結果
   */
  async sendEmailNotification(groupedVisitors) {
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const emailTo = scriptProperties.getProperty('NOTIFICATION_EMAIL_TO');
      
      if (!emailTo) {
        Logger.log('通知先メールアドレスが設定されていません');
        return { success: false, error: 'メールアドレス未設定' };
      }
      
      const subject = '[CULTIReFINE] LINE連携未完了者のお知らせ';
      const body = this.createEmailBody(groupedVisitors);
      
      // メール送信
      MailApp.sendEmail({
        to: emailTo,
        subject: subject,
        body: body
      });
      
      Logger.log('メール通知送信完了');
      return { success: true };
      
    } catch (error) {
      Logger.log('メール送信エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }
  
  /**
   * LINE通知を送信
   * @param {Object} groupedVisitors - 会社別グループ化されたデータ
   * @return {Object} 送信結果
   */
  async sendLineNotification(groupedVisitors) {
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const groupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID');
      const accessToken = scriptProperties.getProperty('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');
      
      if (!groupId || !accessToken) {
        Logger.log('LINE通知設定が不完全です');
        Logger.log(`グループID: ${groupId ? '設定済み' : '未設定'}`);
        Logger.log(`アクセストークン: ${accessToken ? '設定済み' : '未設定'}`);
        return { success: false, error: 'LINE設定不完全 - グループIDまたはアクセストークンが未設定' };
      }
      
      // グループIDの検証（Cで始まることを確認）
      if (!groupId.startsWith('C')) {
        Logger.log('警告: グループIDが「C」で始まっていません: ' + groupId);
        Logger.log('個人への誤送信を防ぐため、送信を中止します');
        return { success: false, error: 'グループIDの形式が正しくありません' };
      }
      
      // Flex Messageを作成
      const flexMessage = this.createFlexMessage(groupedVisitors);
      
      // LINE送信
      const url = 'https://api.line.me/v2/bot/message/push';
      const payload = {
        to: groupId,
        messages: [flexMessage]
      };
      
      const options = {
        method: 'post',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      
      if (statusCode === 200) {
        Logger.log('LINE通知送信完了（Flex Message）');
        return { success: true };
      } else {
        const errorText = response.getContentText();
        Logger.log(`LINE送信エラー: ${statusCode} - ${errorText}`);
        return { success: false, error: errorText };
      }
      
    } catch (error) {
      Logger.log('LINE送信エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }
  
  /**
   * メール本文を作成
   * @param {Object} groupedVisitors - 会社別グループ化されたデータ
   * @return {string} メール本文
   */
  createEmailBody(groupedVisitors) {
    const now = new Date();
    let body = `本日のLINE連携未完了者をお知らせします。\n\n`;
    
    let totalCount = 0;
    
    Object.keys(groupedVisitors).forEach(companyId => {
      const company = groupedVisitors[companyId];
      body += `■ ${company.companyName}\n`;
      
      company.visitors.forEach(visitor => {
        const expireDate = new Date(visitor.expireTime);
        const remainingHours = Math.floor((expireDate - now) / (1000 * 60 * 60));
        
        body += `  - ${visitor.visitorName}様（${visitor.position}）\n`;
        body += `    リンク: ${visitor.linkUrl}\n`;
        body += `    有効期限: ${Utils.formatDateTime(expireDate)}`;
        body += ` (残り${remainingHours}時間)\n\n`;
        
        totalCount++;
      });
    });
    
    body += `\n合計: ${totalCount}名\n`;
    body += `\n※お客様にリンクの使用をご案内ください。`;
    
    return body;
  }
  
  /**
   * Flex Messageを作成
   * @param {Object} groupedVisitors - 会社別グループ化されたデータ
   * @return {Object} Flex Messageオブジェクト
   */
  createFlexMessage(groupedVisitors) {
    const now = new Date();
    let totalCount = 0;
    
    // 会社ごとのボックスを作成
    const companyBoxes = [];
    
    Object.keys(groupedVisitors).forEach(companyId => {
      const company = groupedVisitors[companyId];
      const visitorContents = [];
      
      // 会社名
      visitorContents.push({
        type: 'text',
        text: company.companyName,
        weight: 'bold',
        size: 'lg',
        color: '#1DB446',
        margin: 'md'
      });
      
      // 各来院者の情報
      company.visitors.forEach(visitor => {
        const expireDate = new Date(visitor.expireTime);
        const remainingHours = Math.floor((expireDate - now) / (1000 * 60 * 60));
        
        // 期限による色分け
        let expiryColor = '#06C755'; // 緑（余裕あり）
        let expiryText = '';
        
        if (remainingHours < 12) {
          expiryColor = '#FF0000'; // 赤（緊急）
          expiryText = `${remainingHours}時間`;
        } else if (remainingHours < 24) {
          expiryColor = '#FF9500'; // オレンジ（注意）
          expiryText = `${remainingHours}時間`;
        } else {
          const remainingDays = Math.floor(remainingHours / 24);
          expiryText = `${remainingDays}日`;
        }
        
        const icon = visitor.position === '社長' ? '👔' : '👩‍💼';
        
        visitorContents.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            {
              type: 'text',
              text: `${icon} ${visitor.visitorName}様（${visitor.position}）`,
              flex: 3,
              size: 'sm',
              wrap: true
            },
            {
              type: 'text',
              text: `期限: ${expiryText}`,
              flex: 1,
              size: 'sm',
              color: expiryColor,
              align: 'end'
            }
          ]
        });
        
        totalCount++;
      });
      
      // 会社ボックスに追加
      companyBoxes.push({
        type: 'box',
        layout: 'vertical',
        margin: 'lg',
        contents: visitorContents
      });
      
      // 区切り線
      companyBoxes.push({
        type: 'separator',
        margin: 'lg'
      });
    });
    
    // 最後の区切り線を削除
    if (companyBoxes.length > 0 && companyBoxes[companyBoxes.length - 1].type === 'separator') {
      companyBoxes.pop();
    }
    
    // Flex Messageの構造
    return {
      type: 'flex',
      altText: `LINE連携未完了者: ${totalCount}名`,
      contents: {
        type: 'bubble',
        size: 'giga',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📢 LINE連携未完了のお知らせ',
              weight: 'bold',
              size: 'xl',
              color: '#FF6B6B'
            },
            {
              type: 'text',
              text: `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}時時点`,
              size: 'xs',
              color: '#999999',
              margin: 'sm'
            }
          ],
          backgroundColor: '#FFF5F5'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: companyBoxes,
          spacing: 'md'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '📊 合計',
                  size: 'md',
                  weight: 'bold'
                },
                {
                  type: 'text',
                  text: `${totalCount}名`,
                  size: 'md',
                  weight: 'bold',
                  align: 'end',
                  color: '#FF6B6B'
                }
              ]
            },
            {
              type: 'text',
              text: '※お客様にリンクの使用をご案内ください',
              size: 'xs',
              color: '#999999',
              margin: 'md',
              wrap: true
            }
          ],
          backgroundColor: '#F5F5F5'
        }
      }
    };
  }
  
  /**
   * LINEメッセージを作成（旧バージョン - 互換性のため残す）
   * @param {Object} groupedVisitors - 会社別グループ化されたデータ
   * @return {string} LINEメッセージ
   */
  createLineMessage(groupedVisitors) {
    const now = new Date();
    let message = `📢 LINE連携未完了のお知らせ\n\n`;
    message += `本日${now.getHours()}時時点の未連携者：\n\n`;
    
    let totalCount = 0;
    
    Object.keys(groupedVisitors).forEach(companyId => {
      const company = groupedVisitors[companyId];
      message += `【${company.companyName}】\n`;
      
      company.visitors.forEach(visitor => {
        const expireDate = new Date(visitor.expireTime);
        const remainingHours = Math.floor((expireDate - now) / (1000 * 60 * 60));
        
        const icon = visitor.position === '社長' ? '👔' : '👩‍💼';
        message += `${icon} ${visitor.visitorName}様（${visitor.position}）\n`;
        
        if (remainingHours < 24) {
          message += `🔗 リンク有効期限: ${remainingHours}時間後\n`;
        } else {
          const remainingDays = Math.floor(remainingHours / 24);
          message += `🔗 リンク有効期限: ${remainingDays}日後\n`;
        }
        
        totalCount++;
      });
      
      message += '\n';
    });
    
    message += `📊 合計: ${totalCount}名\n\n`;
    message += `※お客様にリンクの使用をご案内ください`;
    
    return message;
  }
  
  /**
   * テスト用：ダミーデータで通知をテスト
   */
  testNotification() {
    const testData = {
      'TEST001': {
        companyName: 'テスト株式会社',
        visitors: [
          {
            visitorName: 'テスト太郎',
            position: '社長',
            linkUrl: 'https://example.com/test1',
            expireTime: new Date(Date.now() + 10 * 60 * 60 * 1000) // 10時間後（緊急）
          },
          {
            visitorName: 'テスト花子',
            position: '秘書',
            linkUrl: 'https://example.com/test2',
            expireTime: new Date(Date.now() + 20 * 60 * 60 * 1000) // 20時間後（注意）
          }
        ]
      },
      'TEST002': {
        companyName: 'サンプル商事',
        visitors: [
          {
            visitorName: 'サンプル一郎',
            position: '社長',
            linkUrl: 'https://example.com/test3',
            expireTime: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48時間後（余裕）
          }
        ]
      }
    };
    
    const emailBody = this.createEmailBody(testData);
    const lineMessage = this.createLineMessage(testData);
    const flexMessage = this.createFlexMessage(testData);
    
    Logger.log('=== テストメール本文 ===\n' + emailBody);
    Logger.log('=== テストLINEメッセージ（テキスト） ===\n' + lineMessage);
    Logger.log('=== テストFlex Message ===\n' + JSON.stringify(flexMessage, null, 2));
    
    return {
      emailBody: emailBody,
      lineMessage: lineMessage,
      flexMessage: flexMessage
    };
  }
  
  /**
   * Flex Messageのテスト送信
   */
  async testFlexMessageSend() {
    try {
      const testData = {
        'TEST001': {
          companyName: 'テスト会社',
          visitors: [
            {
              visitorName: 'テスト太郎',
              position: '社長',
              linkUrl: 'https://example.com/test',
              expireTime: new Date(Date.now() + 10 * 60 * 60 * 1000)
            }
          ]
        }
      };
      
      return await this.sendLineNotification(testData);
    } catch (error) {
      Logger.log('Flex Messageテスト送信エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }
}

// トリガー用のグローバル関数
function notifyUnlinkedCompanyVisitors() {
  const service = new CompanyLineLinkNotificationService();
  return service.notifyUnlinkedVisitors();
}

// テスト実行用
function testCompanyLineLinkNotification() {
  const service = new CompanyLineLinkNotificationService();
  return service.testNotification();
}