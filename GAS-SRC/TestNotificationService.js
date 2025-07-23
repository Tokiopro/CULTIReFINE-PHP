/**
 * テスト通知送信サービス
 * 
 * 機能:
 * - 会社別来院者シートからLINE ID保持者を取得
 * - 選択したユーザーに実際の通知を送信
 * - 送信結果のログと表示
 */
class TestNotificationService {
  constructor() {
    this.companyVisitorService = new CompanyVisitorService();
    this.lineTokenManager = new LineTokenManager();
    this.flexMessageTemplates = new FlexMessageTemplates();
    this.emailTemplates = new EmailTemplates();
    this.notificationSettingsService = new NotificationSettingsService();
  }

  /**
   * テスト送信可能なユーザー一覧を取得
   * @return {Object} ユーザー一覧
   */
  getTestRecipients() {
    try {
      const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
        .getSheetByName(Config.getSheetNames().companyVisitors);
      
      if (!sheet) {
        return { success: false, error: '会社別来院者シートが見つかりません' };
      }

      const data = sheet.getDataRange().getValues();
      const recipients = [];

      // ヘッダー行をスキップしてデータを処理
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const companyId = row[0];
        const companyName = row[1];
        const visitorId = row[2];
        const visitorName = row[3];
        const lineId = row[4];
        const memberType = row[5];
        const email = row[row.length - 1]; // 最後の列にメールアドレスがあると仮定

        // LINE IDまたはメールアドレスを持つユーザーのみ追加
        if (lineId || email) {
          recipients.push({
            companyId: companyId,
            companyName: companyName,
            visitorId: visitorId,
            visitorName: visitorName,
            lineId: lineId,
            memberType: memberType,
            email: email,
            displayName: `${visitorName} (${companyName}) - ${memberType}`,
            hasLine: !!lineId,
            hasEmail: !!email
          });
        }
      }

      return {
        success: true,
        recipients: recipients,
        count: recipients.length
      };

    } catch (error) {
      Logger.log('テスト送信対象者取得エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
   * 実際のテスト通知を送信
   * @param {string} notificationType - 通知タイプ
   * @param {Array} recipientIds - 送信対象者のvisitorId配列
   * @param {Object} options - 送信オプション
   * @return {Object} 送信結果
   */
  async sendTestNotification(notificationType, recipientIds, options = {}) {
    try {
      Logger.log(`=== テスト通知送信開始: ${notificationType} ===`);
      
      // 送信対象者の情報を取得
      const recipientsData = await this.getRecipientsData(recipientIds);
      
      if (recipientsData.length === 0) {
        return { success: false, error: '送信対象者が見つかりません' };
      }

      // テスト用のコンテンツを作成
      const testContent = this.createTestContent(notificationType);
      
      // 送信結果を格納
      const results = {
        success: true,
        totalCount: recipientsData.length,
        lineResults: [],
        emailResults: [],
        summary: {
          lineSuccess: 0,
          lineFailed: 0,
          emailSuccess: 0,
          emailFailed: 0
        }
      };

      // 各受信者に送信
      for (const recipient of recipientsData) {
        // LINE送信
        if (recipient.lineId && options.sendLine !== false) {
          const lineResult = await this.sendLineTestNotification(
            recipient,
            notificationType,
            testContent
          );
          results.lineResults.push(lineResult);
          
          if (lineResult.success) {
            results.summary.lineSuccess++;
          } else {
            results.summary.lineFailed++;
          }
        }

        // メール送信
        if (recipient.email && options.sendEmail !== false) {
          const emailResult = await this.sendEmailTestNotification(
            recipient,
            notificationType,
            testContent
          );
          results.emailResults.push(emailResult);
          
          if (emailResult.success) {
            results.summary.emailSuccess++;
          } else {
            results.summary.emailFailed++;
          }
        }
      }

      // 送信履歴を記録
      this.recordTestHistory(notificationType, results);

      Logger.log(`=== テスト通知送信完了 ===`);
      Logger.log(`LINE: 成功 ${results.summary.lineSuccess}件, 失敗 ${results.summary.lineFailed}件`);
      Logger.log(`メール: 成功 ${results.summary.emailSuccess}件, 失敗 ${results.summary.emailFailed}件`);

      return results;

    } catch (error) {
      Logger.log('テスト通知送信エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
   * LINE通知のテスト送信
   * @private
   */
  async sendLineTestNotification(recipient, notificationType, content) {
    try {
      const accessToken = this.lineTokenManager.getMessagingChannelAccessToken();
      
      if (!accessToken) {
        return {
          recipientName: recipient.visitorName,
          success: false,
          error: 'LINE Messaging APIアクセストークンが設定されていません'
        };
      }

      // FlexMessageを作成
      const flexMessage = this.flexMessageTemplates.createMessage(notificationType, content);
      
      // テスト用のヘッダーを追加
      if (flexMessage.contents && flexMessage.contents.header) {
        flexMessage.contents.header.contents.unshift({
          type: 'text',
          text: '【テスト送信】',
          size: 'xs',
          color: '#FF0000',
          weight: 'bold'
        });
      }

      // LINE送信
      const url = 'https://api.line.me/v2/bot/message/push';
      const payload = {
        to: recipient.lineId,
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
        Logger.log(`LINE送信成功: ${recipient.visitorName} (${recipient.lineId})`);
        return {
          recipientName: recipient.visitorName,
          recipientId: recipient.lineId,
          success: true
        };
      } else {
        const errorText = response.getContentText();
        Logger.log(`LINE送信失敗: ${statusCode} - ${errorText}`);
        return {
          recipientName: recipient.visitorName,
          recipientId: recipient.lineId,
          success: false,
          error: `${statusCode}: ${errorText}`
        };
      }

    } catch (error) {
      Logger.log(`LINE送信エラー (${recipient.visitorName}): ${error.toString()}`);
      return {
        recipientName: recipient.visitorName,
        success: false,
        error: error.toString()
      };
    }
  }

  /**
   * メール通知のテスト送信
   * @private
   */
  async sendEmailTestNotification(recipient, notificationType, content) {
    try {
      // メール本文を作成
      const emailBody = this.emailTemplates.createEmailBody(notificationType, content);
      
      // 件名を作成
      const subject = `【テスト送信】${this.getEmailSubject(notificationType)}`;

      // メール送信
      MailApp.sendEmail({
        to: recipient.email,
        subject: subject,
        body: emailBody.text,
        htmlBody: emailBody.html
      });

      Logger.log(`メール送信成功: ${recipient.visitorName} (${recipient.email})`);
      return {
        recipientName: recipient.visitorName,
        recipientEmail: recipient.email,
        success: true
      };

    } catch (error) {
      Logger.log(`メール送信エラー (${recipient.visitorName}): ${error.toString()}`);
      return {
        recipientName: recipient.visitorName,
        recipientEmail: recipient.email,
        success: false,
        error: error.toString()
      };
    }
  }

  /**
   * テスト用コンテンツを作成
   * @private
   */
  createTestContent(notificationType) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseContent = {
      clinicName: 'CULTIReFINE',
      patientName: 'テスト太郎',
      date: Utils.formatDate(now),
      menuName: 'テスト施術メニュー',
      ticketBalance: { stemCell: 5, treatment: 10, infusion: 3 }
    };

    switch (notificationType) {
      case 'full_booking_confirmation':
        return {
          ...baseContent,
          time: '14:00',
          duration: 60,
          notes: 'これはテスト送信です。実際の予約ではありません。',
          ticketUsage: 1
        };

      case 'partial_booking_confirmation':
        return {
          ...baseContent,
          time: '14:00'
        };

      case 'ticket_balance_update':
        return {
          ticketBalance: baseContent.ticketBalance,
          ticketUsage: 1
        };

      case 'reminder':
        return {
          ...baseContent,
          date: Utils.formatDate(tomorrow),
          time: '14:00',
          duration: 60,
          notes: 'これはテスト送信です。',
          timing: '明日'
        };

      case 'post_treatment':
        return baseContent;

      default:
        return baseContent;
    }
  }

  /**
   * 受信者データを取得
   * @private
   */
  async getRecipientsData(recipientIds) {
    const recipients = [];
    const allRecipients = this.getTestRecipients();

    if (!allRecipients.success) {
      return recipients;
    }

    for (const id of recipientIds) {
      const recipient = allRecipients.recipients.find(r => r.visitorId === id);
      if (recipient) {
        recipients.push(recipient);
      }
    }

    return recipients;
  }

  /**
   * メール件名を取得
   * @private
   */
  getEmailSubject(notificationType) {
    const subjects = {
      'full_booking_confirmation': 'ご予約確定のお知らせ',
      'partial_booking_confirmation': '予約情報のお知らせ',
      'ticket_balance_update': 'チケット残枚数更新のお知らせ',
      'reminder': 'ご予約のリマインダー',
      'post_treatment': '施術完了のお知らせ'
    };
    return `[CULTIReFINE] ${subjects[notificationType] || 'お知らせ'}`;
  }

  /**
   * テスト送信履歴を記録
   * @private
   */
  recordTestHistory(notificationType, results) {
    try {
      const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
        .getSheetByName('予約通知履歴');
      
      if (!sheet) {
        SpreadsheetManager.initializeNotificationHistorySheet();
      }

      const now = new Date();
      
      // LINE送信結果を記録
      results.lineResults.forEach(result => {
        sheet.appendRow([
          now,
          `TEST_${notificationType}`,
          'TEST',
          result.recipientId || '',
          result.recipientName,
          result.recipientId || '',
          result.recipientName,
          'LINE',
          result.success ? '成功' : '失敗',
          result.error || ''
        ]);
      });

      // メール送信結果を記録
      results.emailResults.forEach(result => {
        sheet.appendRow([
          now,
          `TEST_${notificationType}`,
          'TEST',
          result.recipientEmail || '',
          result.recipientName,
          result.recipientEmail || '',
          result.recipientName,
          'メール',
          result.success ? '成功' : '失敗',
          result.error || ''
        ]);
      });

    } catch (error) {
      Logger.log('テスト履歴記録エラー: ' + error.toString());
    }
  }

  /**
   * 最新のテスト送信結果を取得
   * @param {number} count - 取得件数
   * @return {Array} テスト送信履歴
   */
  getTestHistory(count = 10) {
    try {
      const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
        .getSheetByName('予約通知履歴');
      
      if (!sheet || sheet.getLastRow() <= 1) {
        return [];
      }

      const data = sheet.getDataRange().getValues();
      const testHistory = [];

      // 最新のものから取得（逆順）
      for (let i = data.length - 1; i >= 1 && testHistory.length < count; i--) {
        if (data[i][1] && data[i][1].startsWith('TEST_')) {
          testHistory.push({
            date: data[i][0],
            type: data[i][1].replace('TEST_', ''),
            recipientName: data[i][4],
            method: data[i][7],
            result: data[i][8],
            error: data[i][9]
          });
        }
      }

      return testHistory;

    } catch (error) {
      Logger.log('テスト履歴取得エラー: ' + error.toString());
      return [];
    }
  }
}