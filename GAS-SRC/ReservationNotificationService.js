/**
 * 予約通知サービス
 * 
 * 機能:
 * - 予約確定時の通知
 * - リマインダー通知（前日・当日）
 * - 施術後通知
 * - 会員種別と公開設定に基づく通知ルール管理
 */
class ReservationNotificationService {
  constructor() {
    this.lineTokenManager = new LineTokenManager();
    this.companyVisitorService = new CompanyVisitorService();
    this.reservationService = new ReservationService();
    this.ticketManagementService = new TicketManagementService();
    this.notificationSettingsService = new NotificationSettingsService();
    this.flexMessageTemplates = new FlexMessageTemplates();
    this.emailTemplates = new EmailTemplates();
  }

  /**
   * 予約確定時の通知を送信
   * @param {Object} reservation - 予約情報
   * @param {string} bookerVisitorId - 予約者のvisitorId
   * @return {Object} 送信結果
   */
  async sendBookingConfirmationNotification(reservation, bookerVisitorId) {
    try {
      Logger.log('=== 予約確定通知開始 ===');
      Logger.log(`予約ID: ${reservation.id}, 予約者ID: ${bookerVisitorId}`);

      // 予約者と来院者の情報を取得
      const bookerInfo = await this.getVisitorWithCompanyInfo(bookerVisitorId);
      const patientInfo = await this.getVisitorWithCompanyInfo(reservation.visitor_id);
      
      if (!bookerInfo || !patientInfo) {
        Logger.log('予約者または来院者の情報が取得できません');
        return { success: false, error: '来院者情報の取得に失敗' };
      }

      // 同じ会社のメンバー情報を取得
      const companyMembers = await this.getCompanyMembers(bookerInfo.companyId);
      
      // 通知対象と内容を決定
      const notifications = this.determineBookingNotifications(
        reservation,
        bookerInfo,
        patientInfo,
        companyMembers
      );

      // 通知を送信
      const results = await this.sendNotifications(notifications);
      
      Logger.log('=== 予約確定通知完了 ===');
      return {
        success: true,
        sentCount: results.filter(r => r.success).length,
        totalCount: results.length
      };

    } catch (error) {
      Logger.log('予約確定通知エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
   * リマインダー通知を送信（前日・当日）
   * @param {string} timing - 'day_before' または 'same_day'
   * @return {Object} 送信結果
   */
  async sendReminderNotifications(timing) {
    try {
      Logger.log(`=== ${timing === 'day_before' ? '前日' : '当日'}リマインダー通知開始 ===`);

      // 対象日の予約を取得
      const targetDate = this.getTargetDateForReminder(timing);
      const reservations = await this.getReservationsForDate(targetDate);

      if (reservations.length === 0) {
        Logger.log('対象の予約がありません');
        return { success: true, sentCount: 0 };
      }

      const results = [];
      for (const reservation of reservations) {
        // 既に通知済みかチェック
        if (await this.isReminderSent(reservation.id, timing)) {
          continue;
        }

        const result = await this.sendSingleReminderNotification(reservation, timing);
        results.push(result);

        // 通知済みとして記録
        if (result.success) {
          await this.markReminderSent(reservation.id, timing);
        }
      }

      Logger.log(`=== ${timing === 'day_before' ? '前日' : '当日'}リマインダー通知完了 ===`);
      return {
        success: true,
        sentCount: results.filter(r => r.success).length,
        totalCount: results.length
      };

    } catch (error) {
      Logger.log('リマインダー通知エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
   * 施術後通知を送信
   * @return {Object} 送信結果
   */
  async sendPostTreatmentNotifications() {
    try {
      Logger.log('=== 施術後通知開始 ===');

      // 1時間前に終了した予約を取得
      const completedReservations = await this.getRecentlyCompletedReservations();

      if (completedReservations.length === 0) {
        Logger.log('対象の予約がありません');
        return { success: true, sentCount: 0 };
      }

      const results = [];
      for (const reservation of completedReservations) {
        // 既に通知済みかチェック
        if (await this.isPostTreatmentSent(reservation.id)) {
          continue;
        }

        const result = await this.sendSinglePostTreatmentNotification(reservation);
        results.push(result);

        // 通知済みとして記録
        if (result.success) {
          await this.markPostTreatmentSent(reservation.id);
        }
      }

      Logger.log('=== 施術後通知完了 ===');
      return {
        success: true,
        sentCount: results.filter(r => r.success).length,
        totalCount: results.length
      };

    } catch (error) {
      Logger.log('施術後通知エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
   * 予約確定時の通知対象と内容を決定
   * @private
   */
  determineBookingNotifications(reservation, bookerInfo, patientInfo, companyMembers) {
    const notifications = [];
    const isBookerMainMember = bookerInfo.memberType === 'main';
    const isPatientSelf = bookerInfo.visitorId === patientInfo.visitorId;

    // メインメンバーとサブメンバーを分離
    const mainMembers = companyMembers.filter(m => m.memberType === 'main');
    const subMembers = companyMembers.filter(m => m.memberType === 'sub');

    if (isBookerMainMember) {
      // 本会員が予約した場合
      if (isPatientSelf) {
        // 本会員が自分の予約
        notifications.push({
          recipient: bookerInfo,
          type: 'full_booking_confirmation',
          content: this.createFullBookingContent(reservation, patientInfo)
        });

        // サブ会員にはチケット残枚数のみ
        subMembers.forEach(member => {
          if (member.lineId) {
            notifications.push({
              recipient: member,
              type: 'ticket_balance_update',
              content: this.createTicketBalanceContent(reservation)
            });
          }
        });
      } else {
        // 本会員が同伴者の予約
        const publicSetting = patientInfo.publicSetting || false;

        notifications.push({
          recipient: bookerInfo,
          type: 'full_booking_confirmation',
          content: this.createFullBookingContent(reservation, patientInfo)
        });

        if (publicSetting) {
          // 公開設定True: サブ会員に時間・施術注意点以外も通知
          subMembers.forEach(member => {
            if (member.lineId) {
              notifications.push({
                recipient: member,
                type: 'partial_booking_confirmation',
                content: this.createPartialBookingContent(reservation, patientInfo, false)
              });
            }
          });
        } else {
          // 公開設定False: サブ会員にチケット残枚数のみ
          subMembers.forEach(member => {
            if (member.lineId) {
              notifications.push({
                recipient: member,
                type: 'ticket_balance_update',
                content: this.createTicketBalanceContent(reservation)
              });
            }
          });
        }
      }
    } else {
      // サブ会員が予約した場合
      notifications.push({
        recipient: bookerInfo,
        type: 'full_booking_confirmation',
        content: this.createFullBookingContent(reservation, patientInfo)
      });

      // 本会員に時間・施術注意点以外を通知
      mainMembers.forEach(member => {
        if (member.lineId) {
          notifications.push({
            recipient: member,
            type: 'partial_booking_confirmation',
            content: this.createPartialBookingContent(reservation, patientInfo, false)
          });
        }
      });
    }

    return notifications;
  }

  /**
   * 通知を送信
   * @private
   */
  async sendNotifications(notifications) {
    const results = [];

    for (const notification of notifications) {
      try {
        const result = await this.sendSingleNotification(notification);
        results.push(result);
      } catch (error) {
        Logger.log(`通知送信エラー (${notification.recipient.visitorName}): ${error.toString()}`);
        results.push({ success: false, error: error.toString() });
      }
    }

    return results;
  }

  /**
   * 単一の通知を送信
   * @private
   */
  async sendSingleNotification(notification) {
    const { recipient, type, content } = notification;

    if (!recipient.lineId) {
      Logger.log(`LINE IDが設定されていません: ${recipient.visitorName}`);
      return { success: false, error: 'LINE ID未設定' };
    }

    // FlexMessageを作成
    const flexMessage = this.flexMessageTemplates.createMessage(type, content);

    // LINE送信
    const result = await this.sendLineMessage(recipient.lineId, flexMessage);

    // メール送信（オプション）
    if (recipient.email && this.notificationSettingsService.isEmailEnabled()) {
      await this.sendEmailNotification(recipient.email, type, content);
    }

    return result;
  }

  /**
   * LINEメッセージを送信
   * @private
   */
  async sendLineMessage(lineUserId, flexMessage) {
    try {
      const accessToken = this.lineTokenManager.getMessagingChannelAccessToken();
      
      if (!accessToken) {
        Logger.log('LINE Messaging APIアクセストークンが設定されていません');
        return { success: false, error: 'アクセストークン未設定' };
      }

      const url = 'https://api.line.me/v2/bot/message/push';
      const payload = {
        to: lineUserId,
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
        Logger.log(`LINE通知送信成功: ${lineUserId}`);
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
   * メール通知を送信
   * @private
   */
  async sendEmailNotification(email, type, content) {
    try {
      const subject = this.getEmailSubject(type);
      const emailBody = this.emailTemplates.createEmailBody(type, content);

      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: emailBody.text,
        htmlBody: emailBody.html
      });

      Logger.log(`メール通知送信成功: ${email}`);
      return { success: true };

    } catch (error) {
      Logger.log('メール送信エラー: ' + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
   * 通知内容作成メソッド群
   * @private
   */
  createFullBookingContent(reservation, patientInfo) {
    return {
      clinicName: 'CULTIReFINE',
      patientName: patientInfo.visitorName,
      date: Utils.formatDate(new Date(reservation.date)),
      time: reservation.start_time,
      menuName: reservation.menu_name,
      duration: reservation.duration,
      notes: reservation.notes || '',
      ticketUsage: reservation.ticket_count || 0,
      ticketBalance: this.getTicketBalance(patientInfo.companyId)
    };
  }

  createPartialBookingContent(reservation, patientInfo, includeTimeAndNotes) {
    const content = {
      clinicName: 'CULTIReFINE',
      patientName: patientInfo.visitorName,
      date: Utils.formatDate(new Date(reservation.date)),
      menuName: reservation.menu_name,
      ticketBalance: this.getTicketBalance(patientInfo.companyId)
    };

    if (includeTimeAndNotes) {
      content.time = reservation.start_time;
      content.notes = reservation.notes || '';
    }

    return content;
  }

  createTicketBalanceContent(reservation) {
    return {
      ticketBalance: this.getTicketBalance(reservation.company_id),
      ticketUsage: reservation.ticket_count || 0
    };
  }

  /**
   * ヘルパーメソッド群
   * @private
   */
  async getVisitorWithCompanyInfo(visitorId) {
    try {
      const visitor = await this.companyVisitorService.getVisitorById(visitorId);
      return visitor;
    } catch (error) {
      Logger.log(`来院者情報取得エラー: ${error.toString()}`);
      return null;
    }
  }

  async getCompanyMembers(companyId) {
    try {
      const members = await this.companyVisitorService.getCompanyVisitors(companyId);
      return members;
    } catch (error) {
      Logger.log(`会社メンバー取得エラー: ${error.toString()}`);
      return [];
    }
  }

  getTicketBalance(companyId) {
    try {
      const balance = this.ticketManagementService.getCompanyTicketBalance(companyId);
      return balance;
    } catch (error) {
      Logger.log(`チケット残高取得エラー: ${error.toString()}`);
      return { stemCell: 0, treatment: 0, infusion: 0 };
    }
  }

  getTargetDateForReminder(timing) {
    const now = new Date();
    if (timing === 'day_before') {
      now.setDate(now.getDate() + 1);
    }
    return Utils.formatDate(now);
  }

  async getReservationsForDate(date) {
    try {
      return await this.reservationService.getReservationsByDate(date);
    } catch (error) {
      Logger.log(`予約取得エラー: ${error.toString()}`);
      return [];
    }
  }

  async getRecentlyCompletedReservations() {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      return await this.reservationService.getCompletedReservationsAfter(oneHourAgo);
    } catch (error) {
      Logger.log(`完了予約取得エラー: ${error.toString()}`);
      return [];
    }
  }

  getEmailSubject(type) {
    const subjects = {
      'full_booking_confirmation': '[CULTIReFINE] ご予約確定のお知らせ',
      'partial_booking_confirmation': '[CULTIReFINE] 予約情報のお知らせ',
      'ticket_balance_update': '[CULTIReFINE] チケット残枚数更新のお知らせ',
      'reminder': '[CULTIReFINE] ご予約のリマインダー',
      'post_treatment': '[CULTIReFINE] 施術完了のお知らせ'
    };
    return subjects[type] || '[CULTIReFINE] お知らせ';
  }


  /**
   * 通知履歴管理メソッド群
   * @private
   */
  async isReminderSent(reservationId, timing) {
    // TODO: SpreadsheetManagerで通知履歴を確認
    return false;
  }

  async markReminderSent(reservationId, timing) {
    // TODO: SpreadsheetManagerで通知履歴を記録
  }

  async isPostTreatmentSent(reservationId) {
    // TODO: SpreadsheetManagerで通知履歴を確認
    return false;
  }

  async markPostTreatmentSent(reservationId) {
    // TODO: SpreadsheetManagerで通知履歴を記録
  }

  /**
   * 単一のリマインダー通知を送信
   * @private
   */
  async sendSingleReminderNotification(reservation, timing) {
    try {
      const patientInfo = await this.getVisitorWithCompanyInfo(reservation.visitor_id);
      const bookerInfo = await this.getVisitorWithCompanyInfo(reservation.booked_by);

      const notifications = [];

      // 来院者本人に通知
      if (patientInfo && patientInfo.lineId) {
        notifications.push({
          recipient: patientInfo,
          type: 'reminder',
          content: {
            clinicName: 'CULTIReFINE',
            patientName: patientInfo.visitorName,
            date: Utils.formatDate(new Date(reservation.date)),
            time: reservation.start_time,
            menuName: reservation.menu_name,
            duration: reservation.duration,
            notes: reservation.notes || '',
            timing: timing === 'day_before' ? '明日' : '本日'
          }
        });
      }

      // 予約者が異なる場合は予約者にも通知
      if (bookerInfo && bookerInfo.visitorId !== patientInfo.visitorId && bookerInfo.lineId) {
        notifications.push({
          recipient: bookerInfo,
          type: 'reminder',
          content: {
            clinicName: 'CULTIReFINE',
            patientName: patientInfo.visitorName,
            date: Utils.formatDate(new Date(reservation.date)),
            time: reservation.start_time,
            menuName: reservation.menu_name,
            duration: reservation.duration,
            notes: reservation.notes || '',
            timing: timing === 'day_before' ? '明日' : '本日'
          }
        });
      }

      const results = await this.sendNotifications(notifications);
      return {
        success: results.every(r => r.success),
        results: results
      };

    } catch (error) {
      Logger.log(`リマインダー通知エラー (予約ID: ${reservation.id}): ${error.toString()}`);
      return { success: false, error: error.toString() };
    }
  }

  /**
   * 単一の施術後通知を送信
   * @private
   */
  async sendSinglePostTreatmentNotification(reservation) {
    try {
      const patientInfo = await this.getVisitorWithCompanyInfo(reservation.visitor_id);
      const bookerInfo = await this.getVisitorWithCompanyInfo(reservation.booked_by);
      const companyMembers = await this.getCompanyMembers(patientInfo.companyId);

      const notifications = [];
      const isBookerMainMember = bookerInfo.memberType === 'main';
      const mainMembers = companyMembers.filter(m => m.memberType === 'main');
      const subMembers = companyMembers.filter(m => m.memberType === 'sub');

      // 通知内容の作成
      const postTreatmentContent = {
        clinicName: 'CULTIReFINE',
        patientName: patientInfo.visitorName,
        date: Utils.formatDate(new Date(reservation.date)),
        menuName: reservation.menu_name,
        ticketBalance: this.getTicketBalance(patientInfo.companyId)
      };

      if (isBookerMainMember) {
        // 本会員が予約した場合
        mainMembers.forEach(member => {
          if (member.lineId) {
            notifications.push({
              recipient: member,
              type: 'post_treatment',
              content: postTreatmentContent
            });
          }
        });

        // サブ会員にはチケット残枚数のみ
        subMembers.forEach(member => {
          if (member.lineId) {
            notifications.push({
              recipient: member,
              type: 'ticket_balance_update',
              content: this.createTicketBalanceContent(reservation)
            });
          }
        });
      } else {
        // サブ会員が予約した場合
        // 予約者（サブ会員）に通知
        if (bookerInfo.lineId) {
          notifications.push({
            recipient: bookerInfo,
            type: 'post_treatment',
            content: postTreatmentContent
          });
        }

        // 本会員にも通知
        mainMembers.forEach(member => {
          if (member.lineId) {
            notifications.push({
              recipient: member,
              type: 'post_treatment',
              content: postTreatmentContent
            });
          }
        });
      }

      const results = await this.sendNotifications(notifications);
      return {
        success: results.every(r => r.success),
        results: results
      };

    } catch (error) {
      Logger.log(`施術後通知エラー (予約ID: ${reservation.id}): ${error.toString()}`);
      return { success: false, error: error.toString() };
    }
  }
}

// トリガー用のグローバル関数
function sendDayBeforeReminders() {
  const service = new ReservationNotificationService();
  return service.sendReminderNotifications('day_before');
}

function sendSameDayReminders() {
  const service = new ReservationNotificationService();
  return service.sendReminderNotifications('same_day');
}

function sendPostTreatmentNotifications() {
  const service = new ReservationNotificationService();
  return service.sendPostTreatmentNotifications();
}