/**
 * 通知サービス
 * LINE通知とリマインダーの管理
 */
class NotificationService {
  constructor() {
    this.sheetNames = Config.getSheetNames();
    this.lineTokenManager = new LineTokenManager();
  }
  
  /**
   * 予約確定通知を送信
   * @param {object} reservation - 予約情報
   * @param {array} recipients - 通知先リスト [{lineId, name, isMainMember}]
   * @return {object} 送信結果
   */
  sendReservationConfirmation(reservation, recipients) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`予約確定通知を送信: ${JSON.stringify(reservation)}`);
      
      const results = {
        success: [],
        failed: []
      };
      
      // メッセージを作成
      const message = this._createReservationMessage(reservation);
      
      // 各受信者に送信
      recipients.forEach(recipient => {
        try {
          const result = this._sendLineMessage(recipient.lineId, message);
          if (result.success) {
            results.success.push(recipient);
          } else {
            results.failed.push({
              recipient: recipient,
              error: result.error
            });
          }
        } catch (error) {
          results.failed.push({
            recipient: recipient,
            error: error.toString()
          });
        }
      });
      
      // 運営側のグループにも通知
      this._notifyOperationGroup(reservation, 'new');
      
      // リマインダーをスケジュール
      this.scheduleReminders(reservation);
      
      return results;
    }, '予約確定通知送信');
  }
  
  /**
   * リマインダーを送信
   * @param {string} reservationId - 予約ID
   * @param {string} reminderType - リマインダータイプ（dayBefore, dayOf, afterTreatment）
   * @return {boolean} 送信成功フラグ
   */
  sendReminder(reservationId, reminderType) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`リマインダーを送信: reservationId=${reservationId}, type=${reminderType}`);
      
      // 予約情報を取得
      const reservation = this._getReservationById(reservationId);
      if (!reservation) {
        Logger.log('予約が見つかりません');
        return false;
      }
      
      // 来院者情報を取得
      const visitor = this._getVisitorById(reservation.visitorId);
      if (!visitor || !visitor.lineId) {
        Logger.log('来院者のLINE IDが見つかりません');
        return false;
      }
      
      // リマインダーメッセージを作成
      let message = '';
      switch (reminderType) {
        case 'dayBefore':
          message = this._createDayBeforeReminder(reservation, visitor);
          break;
        case 'dayOf':
          message = this._createDayOfReminder(reservation, visitor);
          break;
        case 'afterTreatment':
          message = this._createAfterTreatmentReminder(reservation, visitor);
          break;
        default:
          Logger.log(`不明なリマインダータイプ: ${reminderType}`);
          return false;
      }
      
      // メッセージを送信
      const result = this._sendLineMessage(visitor.lineId, message);
      
      // 送信履歴を記録
      this._logNotification(reservationId, reminderType, result.success);
      
      return result.success;
    }, 'リマインダー送信');
  }
  
  /**
   * リマインダーをスケジュール
   * @param {object} reservation - 予約情報
   */
  scheduleReminders(reservation) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`リマインダーをスケジュール: ${JSON.stringify(reservation)}`);
      
      const reservationDate = new Date(reservation.date + ' ' + reservation.time);
      const reservationId = reservation.id || reservation.reservation_id;
      
      // 前日11時のリマインダー
      const dayBefore = new Date(reservationDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(11, 0, 0, 0);
      
      if (dayBefore > new Date()) {
        this._createTimeTrigger(dayBefore, 'sendDayBeforeReminder', reservationId);
      }
      
      // 当日9時のリマインダー
      const dayOf = new Date(reservationDate);
      dayOf.setHours(9, 0, 0, 0);
      
      if (dayOf > new Date() && dayOf < reservationDate) {
        this._createTimeTrigger(dayOf, 'sendDayOfReminder', reservationId);
      }
      
      // 施術後1時間のリマインダー
      const afterTreatment = new Date(reservationDate);
      afterTreatment.setHours(afterTreatment.getHours() + 2); // 施術時間を考慮して2時間後
      
      if (afterTreatment > new Date()) {
        this._createTimeTrigger(afterTreatment, 'sendAfterTreatmentReminder', reservationId);
      }
      
      Logger.log('リマインダーのスケジュール完了');
    }, 'リマインダースケジュール');
  }
  
  /**
   * 予約確定メッセージを作成（内部メソッド）
   */
  _createReservationMessage(reservation) {
    const date = Utils.formatDate(new Date(reservation.date));
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(reservation.date).getDay()];
    
    let message = `【予約確定のお知らせ】\n\n`;
    message += `${reservation.visitorName}様\n\n`;
    message += `ご予約が確定いたしました。\n\n`;
    message += `📅 予約日時\n`;
    message += `${date}（${dayOfWeek}）${reservation.time}\n\n`;
    message += `📋 メニュー\n`;
    message += `${reservation.menuName}\n\n`;
    
    if (reservation.staffName) {
      message += `👤 担当スタッフ\n`;
      message += `${reservation.staffName}\n\n`;
    }
    
    message += `ご来院お待ちしております。\n`;
    message += `変更・キャンセルの場合はお早めにご連絡ください。`;
    
    return message;
  }
  
  /**
   * 前日リマインダーメッセージを作成（内部メソッド）
   */
  _createDayBeforeReminder(reservation, visitor) {
    const date = Utils.formatDate(new Date(reservation.date));
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(reservation.date).getDay()];
    
    let message = `【明日のご予約のお知らせ】\n\n`;
    message += `${visitor.name}様\n\n`;
    message += `明日のご予約をお知らせいたします。\n\n`;
    message += `📅 予約日時\n`;
    message += `${date}（${dayOfWeek}）${reservation.time}\n\n`;
    message += `📋 メニュー\n`;
    message += `${reservation.menuName}\n\n`;
    
    // チケット残数を取得して表示
    const ticketInfo = this._getTicketBalance(visitor.visitorId);
    if (ticketInfo && ticketInfo.balance > 0) {
      message += `🎫 チケット残数: ${ticketInfo.balance}枚\n\n`;
    }
    
    message += `お気をつけてお越しください。`;
    
    return message;
  }
  
  /**
   * 当日リマインダーメッセージを作成（内部メソッド）
   */
  _createDayOfReminder(reservation, visitor) {
    let message = `【本日のご予約のお知らせ】\n\n`;
    message += `${visitor.name}様\n\n`;
    message += `本日 ${reservation.time} のご予約をお待ちしております。\n\n`;
    message += `📋 メニュー: ${reservation.menuName}\n\n`;
    message += `お気をつけてお越しください。`;
    
    return message;
  }
  
  /**
   * 施術後リマインダーメッセージを作成（内部メソッド）
   */
  _createAfterTreatmentReminder(reservation, visitor) {
    let message = `【ご来院ありがとうございました】\n\n`;
    message += `${visitor.name}様\n\n`;
    message += `本日はご来院いただき、ありがとうございました。\n\n`;
    
    // チケット残数を取得して表示
    const ticketInfo = this._getTicketBalance(visitor.visitorId);
    if (ticketInfo) {
      message += `🎫 チケット残数: ${ticketInfo.balance}枚\n`;
      if (ticketInfo.expiryDate) {
        message += `有効期限: ${Utils.formatDate(new Date(ticketInfo.expiryDate))}\n`;
      }
      message += `\n`;
    }
    
    message += `お体に変化がございましたら、お気軽にご相談ください。\n`;
    message += `またのご来院をお待ちしております。`;
    
    return message;
  }
  
  /**
   * LINEメッセージを送信（内部メソッド）
   */
  _sendLineMessage(lineId, message) {
    try {
      const accessToken = this.lineTokenManager.getChannelAccessToken();
      
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
        Logger.log(`LINE送信エラー: ${statusCode} - ${errorText}`);
        return { success: false, error: errorText };
      }
    } catch (error) {
      Logger.log(`LINE送信エラー: ${error.toString()}`);
      return { success: false, error: error.toString() };
    }
  }
  
  /**
   * 運営グループに通知（内部メソッド）
   */
  _notifyOperationGroup(reservation, type) {
    try {
      const groupId = PropertiesService.getScriptProperties().getProperty('LINE_OPERATION_GROUP_ID');
      if (!groupId) {
        Logger.log('運営グループIDが設定されていません');
        return;
      }
      
      let message = '';
      if (type === 'new') {
        message = `【新規予約】\n`;
        message += `患者: ${reservation.visitorName}\n`;
        message += `日時: ${reservation.date} ${reservation.time}\n`;
        message += `メニュー: ${reservation.menuName}`;
      }
      
      this._sendLineMessage(groupId, message);
    } catch (error) {
      Logger.log(`運営グループ通知エラー: ${error.toString()}`);
    }
  }
  
  /**
   * タイムトリガーを作成（内部メソッド）
   */
  _createTimeTrigger(triggerTime, functionName, reservationId) {
    ScriptApp.newTrigger(functionName)
      .timeBased()
      .at(triggerTime)
      .create();
    
    // トリガー情報を保存（予約IDと関連付け）
    const cache = CacheService.getScriptCache();
    const key = `trigger_${functionName}_${triggerTime.getTime()}`;
    cache.put(key, reservationId, 60 * 60 * 24 * 7); // 7日間保存
  }
  
  /**
   * 予約情報を取得（内部メソッド）
   */
  _getReservationById(reservationId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.reservations);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('reservation_id');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === reservationId) {
        return {
          id: reservationId,
          visitorId: data[i][headers.indexOf('visitor_id')],
          visitorName: data[i][headers.indexOf('患者名')],
          date: data[i][headers.indexOf('予約日')],
          time: data[i][headers.indexOf('予約時間')],
          menuName: data[i][headers.indexOf('メニュー')],
          staffName: data[i][headers.indexOf('担当スタッフ')]
        };
      }
    }
    
    return null;
  }
  
  /**
   * 来院者情報を取得（内部メソッド）
   */
  _getVisitorById(visitorId) {
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
   * チケット残数を取得（内部メソッド）
   */
  _getTicketBalance(visitorId) {
    // チケット管理システムと連携する場合はここで実装
    // 現時点ではダミーデータを返す
    return {
      balance: 5,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日後
    };
  }
  
  /**
   * 通知履歴を記録（内部メソッド）
   */
  _logNotification(reservationId, type, success) {
    Utils.logToSheet(
      `通知送信: 予約ID=${reservationId}, タイプ=${type}`,
      success ? 'SUCCESS' : 'ERROR'
    );
  }
}

// トリガー用のグローバル関数
function sendDayBeforeReminder(e) {
  const cache = CacheService.getScriptCache();
  const key = `trigger_sendDayBeforeReminder_${e.triggerUid}`;
  const reservationId = cache.get(key);
  
  if (reservationId) {
    const service = new NotificationService();
    service.sendReminder(reservationId, 'dayBefore');
  }
}

function sendDayOfReminder(e) {
  const cache = CacheService.getScriptCache();
  const key = `trigger_sendDayOfReminder_${e.triggerUid}`;
  const reservationId = cache.get(key);
  
  if (reservationId) {
    const service = new NotificationService();
    service.sendReminder(reservationId, 'dayOf');
  }
}

function sendAfterTreatmentReminder(e) {
  const cache = CacheService.getScriptCache();
  const key = `trigger_sendAfterTreatmentReminder_${e.triggerUid}`;
  const reservationId = cache.get(key);
  
  if (reservationId) {
    const service = new NotificationService();
    service.sendReminder(reservationId, 'afterTreatment');
  }
}