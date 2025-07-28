/**
 * LINE通知API
 * 外部システムから患者へのLINE通知を送信するためのAPIサービス
 */
class LineNotificationApi {
  constructor() {
    this.notificationService = new NotificationService();
    this.reservationNotificationService = new ReservationNotificationService();
    this.lineTokenManager = new LineTokenManager();
    this.visitorService = new VisitorService();
    this.sheetNames = Config.getSheetNames();
    
    // 通知テンプレート定義
    this.templates = {
      appointment_reminder: {
        name: '予約リマインダー',
        variables: ['patientName', 'appointmentDate', 'appointmentTime', 'menuName', 'staffName'],
        buildMessage: (vars) => {
          return `【予約のお知らせ】\n\n${vars.patientName}様\n\n明日のご予約をお知らせいたします。\n\n📅 予約日時\n${vars.appointmentDate} ${vars.appointmentTime}\n\n📋 メニュー\n${vars.menuName}\n\n👤 担当スタッフ\n${vars.staffName || '未定'}\n\nお気をつけてお越しください。`;
        }
      },
      general_notification: {
        name: '一般通知',
        variables: ['patientName', 'message'],
        buildMessage: (vars) => {
          return `${vars.patientName}様\n\n${vars.message}`;
        }
      },
      campaign_notification: {
        name: 'キャンペーン通知',
        variables: ['patientName', 'campaignTitle', 'campaignDetails', 'expiryDate'],
        buildMessage: (vars) => {
          return `【キャンペーンのお知らせ】\n\n${vars.patientName}様\n\n${vars.campaignTitle}\n\n${vars.campaignDetails}\n\n有効期限: ${vars.expiryDate}`;
        }
      },
      ticket_balance: {
        name: 'チケット残数通知',
        variables: ['patientName', 'ticketBalance', 'expiryDate'],
        buildMessage: (vars) => {
          return `【チケット残数のお知らせ】\n\n${vars.patientName}様\n\n現在のチケット残数: ${vars.ticketBalance}枚\n有効期限: ${vars.expiryDate}\n\nご利用をお待ちしております。`;
        }
      }
    };
  }

  /**
   * 即時LINE通知を送信
   * @param {Object} params - 通知パラメータ
   * @return {Object} 送信結果
   */
  sendNotification(params) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`LINE通知送信開始: ${JSON.stringify(params)}`);
      
      // レート制限チェック
      const rateLimitCheck = this._checkRateLimit(params);
      if (!rateLimitCheck.allowed) {
        throw new Error(rateLimitCheck.message);
      }
      
      // パラメータ検証
      const validation = this._validateSendParams(params);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      // 受信者情報を取得
      const recipients = this._getRecipients(params);
      if (recipients.length === 0) {
        throw new Error('送信対象が見つかりません');
      }
      
      // メッセージを構築
      const message = this._buildMessage(params);
      
      // 送信結果を格納
      const results = {
        success: [],
        failed: [],
        totalCount: recipients.length
      };
      
      // 各受信者に送信
      recipients.forEach(recipient => {
        try {
          const result = this._sendToRecipient(recipient, message, params.useFlexMessage);
          if (result.success) {
            results.success.push({
              visitorId: recipient.visitorId,
              lineId: recipient.lineId,
              name: recipient.name
            });
          } else {
            results.failed.push({
              visitorId: recipient.visitorId,
              name: recipient.name,
              error: result.error
            });
          }
        } catch (error) {
          results.failed.push({
            visitorId: recipient.visitorId,
            name: recipient.name,
            error: error.toString()
          });
        }
      });
      
      // 送信履歴を記録
      this._logNotificationHistory({
        type: params.notificationType || 'general',
        template: params.template,
        recipients: results,
        message: message,
        timestamp: new Date()
      });
      
      return {
        success: true,
        results: results,
        message: `送信完了: 成功 ${results.success.length}件, 失敗 ${results.failed.length}件`
      };
    }, 'LINE通知送信');
  }

  /**
   * 予約済み通知をスケジュール
   * @param {Object} params - スケジュールパラメータ
   * @return {Object} スケジュール結果
   */
  scheduleNotification(params) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`LINE通知スケジュール設定: ${JSON.stringify(params)}`);
      
      // パラメータ検証
      const validation = this._validateScheduleParams(params);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      // スケジュールIDを生成
      const scheduleId = Utilities.getUuid();
      
      // トリガーを作成
      const trigger = ScriptApp.newTrigger('executeScheduledLineNotification')
        .timeBased()
        .at(new Date(params.scheduledTime))
        .create();
      
      // スケジュール情報を保存
      const cache = CacheService.getScriptCache();
      const scheduleData = {
        scheduleId: scheduleId,
        triggerId: trigger.getUniqueId(),
        params: params,
        createdAt: new Date()
      };
      
      // 7日間保存（最大スケジュール期間）
      cache.put(`line_schedule_${scheduleId}`, JSON.stringify(scheduleData), 60 * 60 * 24 * 7);
      
      // スケジュール履歴をシートに記録
      this._logScheduleHistory(scheduleData);
      
      return {
        success: true,
        scheduleId: scheduleId,
        scheduledTime: params.scheduledTime,
        message: '通知をスケジュールしました'
      };
    }, 'LINE通知スケジュール');
  }

  /**
   * 利用可能なテンプレート一覧を取得
   * @return {Object} テンプレート情報
   */
  getTemplates() {
    const templateList = Object.keys(this.templates).map(key => ({
      id: key,
      name: this.templates[key].name,
      variables: this.templates[key].variables,
      example: this._getTemplateExample(key)
    }));
    
    return {
      success: true,
      templates: templateList
    };
  }

  /**
   * 通知ステータスを取得
   * @param {string} notificationId - 通知ID
   * @return {Object} ステータス情報
   */
  getNotificationStatus(notificationId) {
    return Utils.executeWithErrorHandling(() => {
      // 通知履歴シートから情報を取得
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LINE通知履歴');
      if (!sheet) {
        throw new Error('通知履歴が見つかりません');
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIndex = headers.indexOf('通知ID');
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === notificationId) {
          return {
            success: true,
            status: {
              notificationId: notificationId,
              type: data[i][headers.indexOf('タイプ')],
              sentAt: data[i][headers.indexOf('送信日時')],
              successCount: data[i][headers.indexOf('成功数')],
              failedCount: data[i][headers.indexOf('失敗数')],
              template: data[i][headers.indexOf('テンプレート')],
              message: data[i][headers.indexOf('メッセージ')]
            }
          };
        }
      }
      
      throw new Error('指定された通知IDが見つかりません');
    }, '通知ステータス取得');
  }

  /**
   * 送信パラメータを検証（内部メソッド）
   */
  _validateSendParams(params) {
    if (!params.recipientType || !['visitor_id', 'company_id', 'all'].includes(params.recipientType)) {
      return { isValid: false, message: 'recipientTypeは visitor_id, company_id, all のいずれかを指定してください' };
    }
    
    if (params.recipientType === 'visitor_id' && !params.visitorIds) {
      return { isValid: false, message: 'visitor_id指定時はvisitorIdsが必要です' };
    }
    
    if (params.recipientType === 'company_id' && !params.companyId) {
      return { isValid: false, message: 'company_id指定時はcompanyIdが必要です' };
    }
    
    if (!params.template && !params.message) {
      return { isValid: false, message: 'templateまたはmessageが必要です' };
    }
    
    if (params.template && !this.templates[params.template]) {
      return { isValid: false, message: '無効なテンプレートIDです' };
    }
    
    return { isValid: true };
  }

  /**
   * スケジュールパラメータを検証（内部メソッド）
   */
  _validateScheduleParams(params) {
    // 送信パラメータの検証
    const sendValidation = this._validateSendParams(params);
    if (!sendValidation.isValid) {
      return sendValidation;
    }
    
    // スケジュール時刻の検証
    if (!params.scheduledTime) {
      return { isValid: false, message: 'scheduledTimeが必要です' };
    }
    
    const scheduledDate = new Date(params.scheduledTime);
    if (isNaN(scheduledDate.getTime())) {
      return { isValid: false, message: 'scheduledTimeの形式が無効です' };
    }
    
    // 過去の時刻は不可
    if (scheduledDate < new Date()) {
      return { isValid: false, message: 'scheduledTimeは未来の時刻を指定してください' };
    }
    
    // 7日以上先は不可
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);
    if (scheduledDate > maxDate) {
      return { isValid: false, message: 'scheduledTimeは7日以内を指定してください' };
    }
    
    return { isValid: true };
  }

  /**
   * 受信者リストを取得（内部メソッド）
   */
  _getRecipients(params) {
    const recipients = [];
    
    switch (params.recipientType) {
      case 'visitor_id':
        // visitor_idリストから取得
        const visitorIds = Array.isArray(params.visitorIds) ? params.visitorIds : [params.visitorIds];
        visitorIds.forEach(visitorId => {
          const visitor = this._getVisitorInfo(visitorId);
          if (visitor && visitor.lineId) {
            recipients.push(visitor);
          }
        });
        break;
        
      case 'company_id':
        // 会社IDから所属する来院者を取得
        const companyVisitors = this._getCompanyVisitors(params.companyId);
        companyVisitors.forEach(visitor => {
          if (visitor.lineId) {
            recipients.push(visitor);
          }
        });
        break;
        
      case 'all':
        // 全LINE連携済み患者を取得（慎重に使用）
        if (params.confirmAll !== true) {
          throw new Error('全員送信にはconfirmAll: trueが必要です');
        }
        const allVisitors = this._getAllLineVisitors();
        recipients.push(...allVisitors);
        break;
    }
    
    return recipients;
  }

  /**
   * メッセージを構築（内部メソッド）
   */
  _buildMessage(params) {
    if (params.message) {
      return params.message;
    }
    
    if (params.template && params.templateVariables) {
      const template = this.templates[params.template];
      return template.buildMessage(params.templateVariables);
    }
    
    throw new Error('メッセージの構築に失敗しました');
  }

  /**
   * 個別受信者への送信（内部メソッド）
   */
  _sendToRecipient(recipient, message, useFlexMessage = false) {
    try {
      if (useFlexMessage && typeof message === 'object') {
        // Flex Message形式で送信
        return this._sendFlexMessage(recipient.lineId, message);
      } else {
        // テキストメッセージで送信
        return this._sendTextMessage(recipient.lineId, message);
      }
    } catch (error) {
      Logger.log(`送信エラー (${recipient.name}): ${error.toString()}`);
      return { success: false, error: error.toString() };
    }
  }

  /**
   * テキストメッセージ送信（内部メソッド）
   */
  _sendTextMessage(lineId, message) {
    const accessToken = this.lineTokenManager.getMessagingChannelAccessToken();
    if (!accessToken) {
      throw new Error('LINE Messaging APIのアクセストークンが設定されていません');
    }
    
    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
      to: lineId,
      messages: [{
        type: 'text',
        text: message
      }]
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
      return { success: true };
    } else {
      const errorText = response.getContentText();
      Logger.log(`LINE API エラー: ${statusCode} - ${errorText}`);
      return { success: false, error: errorText };
    }
  }

  /**
   * Flex Message送信（内部メソッド）
   */
  _sendFlexMessage(lineId, flexMessage) {
    const accessToken = this.lineTokenManager.getMessagingChannelAccessToken();
    if (!accessToken) {
      throw new Error('LINE Messaging APIのアクセストークンが設定されていません');
    }
    
    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
      to: lineId,
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
      return { success: true };
    } else {
      const errorText = response.getContentText();
      Logger.log(`LINE API エラー: ${statusCode} - ${errorText}`);
      return { success: false, error: errorText };
    }
  }

  /**
   * 来院者情報を取得（内部メソッド）
   */
  _getVisitorInfo(visitorId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.visitors);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('visitor_id');
    const lineIdIndex = headers.indexOf('LINE_ID');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === visitorId) {
        return {
          visitorId: visitorId,
          name: data[i][headers.indexOf('氏名')],
          lineId: data[i][lineIdIndex]
        };
      }
    }
    
    return null;
  }

  /**
   * 会社所属の来院者を取得（内部メソッド）
   */
  _getCompanyVisitors(companyId) {
    const visitors = [];
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('会社別来院者管理');
    if (!sheet) return visitors;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const companyIdIndex = headers.indexOf('company_id');
    const visitorIdIndex = headers.indexOf('visitor_id');
    const lineIdIndex = headers.indexOf('LINE_ID');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][companyIdIndex] === companyId && data[i][lineIdIndex]) {
        visitors.push({
          visitorId: data[i][visitorIdIndex],
          name: data[i][headers.indexOf('visitor_name')],
          lineId: data[i][lineIdIndex]
        });
      }
    }
    
    return visitors;
  }

  /**
   * 全LINE連携済み来院者を取得（内部メソッド）
   */
  _getAllLineVisitors() {
    const visitors = [];
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.visitors);
    if (!sheet) return visitors;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('visitor_id');
    const lineIdIndex = headers.indexOf('LINE_ID');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][lineIdIndex]) {
        visitors.push({
          visitorId: data[i][idIndex],
          name: data[i][headers.indexOf('氏名')],
          lineId: data[i][lineIdIndex]
        });
      }
    }
    
    return visitors;
  }

  /**
   * テンプレート例を取得（内部メソッド）
   */
  _getTemplateExample(templateId) {
    const examples = {
      appointment_reminder: {
        patientName: '山田太郎',
        appointmentDate: '2025年7月22日(火)',
        appointmentTime: '14:00',
        menuName: 'カウンセリング',
        staffName: '佐藤'
      },
      general_notification: {
        patientName: '山田太郎',
        message: 'お知らせがあります。詳細はWebサイトをご確認ください。'
      },
      campaign_notification: {
        patientName: '山田太郎',
        campaignTitle: '夏季限定キャンペーン',
        campaignDetails: '対象メニューが20%OFF',
        expiryDate: '2025年8月31日'
      },
      ticket_balance: {
        patientName: '山田太郎',
        ticketBalance: '5',
        expiryDate: '2025年12月31日'
      }
    };
    
    const template = this.templates[templateId];
    if (template && examples[templateId]) {
      return template.buildMessage(examples[templateId]);
    }
    
    return null;
  }

  /**
   * 通知履歴を記録（内部メソッド）
   */
  _logNotificationHistory(data) {
    const sheet = Utils.getOrCreateSheet('LINE通知履歴');
    
    // ヘッダーがない場合は作成
    if (sheet.getLastRow() === 0) {
      const headers = [
        '通知ID', 'タイプ', 'テンプレート', '送信日時', 
        '成功数', '失敗数', '受信者詳細', 'メッセージ'
      ];
      Utils.setHeaders(sheet, headers);
    }
    
    const notificationId = Utilities.getUuid();
    const row = [
      notificationId,
      data.type,
      data.template || '',
      data.timestamp,
      data.recipients.success.length,
      data.recipients.failed.length,
      JSON.stringify(data.recipients),
      data.message.substring(0, 200) // 最初の200文字
    ];
    
    sheet.appendRow(row);
  }

  /**
   * スケジュール履歴を記録（内部メソッド）
   */
  _logScheduleHistory(data) {
    const sheet = Utils.getOrCreateSheet('LINE通知スケジュール');
    
    // ヘッダーがない場合は作成
    if (sheet.getLastRow() === 0) {
      const headers = [
        'スケジュールID', 'トリガーID', '作成日時', '実行予定時刻',
        'パラメータ', 'ステータス'
      ];
      Utils.setHeaders(sheet, headers);
    }
    
    const row = [
      data.scheduleId,
      data.triggerId,
      data.createdAt,
      data.params.scheduledTime,
      JSON.stringify(data.params),
      '待機中'
    ];
    
    sheet.appendRow(row);
  }

  /**
   * レート制限チェック（内部メソッド）
   */
  _checkRateLimit(params) {
    const cache = CacheService.getScriptCache();
    const now = new Date().getTime();
    
    // レート制限設定
    const RATE_LIMIT_WINDOW = 60 * 1000; // 1分間
    const MAX_REQUESTS_PER_WINDOW = 50; // 1分間の最大リクエスト数
    const MAX_RECIPIENTS_PER_REQUEST = 100; // 1リクエストの最大受信者数
    
    // API全体のレート制限
    const globalKey = 'line_rate_limit_global';
    const globalCount = JSON.parse(cache.get(globalKey) || '{"count": 0, "window": 0}');
    
    if (globalCount.window + RATE_LIMIT_WINDOW > now) {
      // 同じウィンドウ内
      if (globalCount.count >= MAX_REQUESTS_PER_WINDOW) {
        return {
          allowed: false,
          message: `レート制限に達しました。1分間に${MAX_REQUESTS_PER_WINDOW}件までです。`
        };
      }
      globalCount.count++;
    } else {
      // 新しいウィンドウ
      globalCount.count = 1;
      globalCount.window = now;
    }
    
    cache.put(globalKey, JSON.stringify(globalCount), 300); // 5分間キャッシュ
    
    // 受信者数チェック
    const recipients = this._getRecipients(params);
    if (recipients.length > MAX_RECIPIENTS_PER_REQUEST) {
      return {
        allowed: false,
        message: `1回のリクエストで送信できる受信者数は${MAX_RECIPIENTS_PER_REQUEST}人までです。`
      };
    }
    
    // IPベースのレート制限（将来の拡張用）
    // const clientIp = params.clientIp || 'unknown';
    // const ipKey = `line_rate_limit_ip_${clientIp}`;
    // ...
    
    return { allowed: true };
  }
}

/**
 * スケジュールされたLINE通知を実行（トリガー用グローバル関数）
 */
function executeScheduledLineNotification(e) {
  const cache = CacheService.getScriptCache();
  const triggerId = e.triggerUid;
  
  // トリガーIDに対応するスケジュールを検索
  const keys = cache.getAll(['line_schedule_']);
  for (const key in keys) {
    const scheduleData = JSON.parse(keys[key]);
    if (scheduleData.triggerId === triggerId) {
      // 通知を実行
      const api = new LineNotificationApi();
      api.sendNotification(scheduleData.params);
      
      // スケジュールステータスを更新
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LINE通知スケジュール');
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === scheduleData.scheduleId) {
            sheet.getRange(i + 1, 6).setValue('実行済み');
            break;
          }
        }
      }
      
      // キャッシュから削除
      cache.remove(key);
      break;
    }
  }
}