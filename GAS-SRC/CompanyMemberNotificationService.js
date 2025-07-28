/**
 * 会社別会員向け通知サービス
 * 本会員・サブ会員の通知ロジックを管理
 */
class CompanyMemberNotificationService {
  constructor() {
    this.notificationService = new NotificationService();
    this.notificationSettings = new NotificationSettingsService();
    this.companyVisitorService = new CompanyVisitorService();
    this.visitorService = new VisitorService();
    this.reservationService = new ReservationService();
    this.spreadsheetManager = new SpreadsheetManager();
  }

  /**
   * 予約確定時の通知を送信
   * @param {Object} reservation - 予約情報
   * @param {string} bookerId - 予約者のvisitorId
   */
  async sendReservationConfirmation(reservation, bookerId) {
    try {
      // 予約者情報を取得
      const booker = await this.visitorService.getVisitorById(bookerId);
      if (!booker) {
        console.error('予約者情報が見つかりません:', bookerId);
        return;
      }

      // 来院者情報を取得
      const visitor = await this.visitorService.getVisitorById(reservation.visitor_id);
      if (!visitor) {
        console.error('来院者情報が見つかりません:', reservation.visitor_id);
        return;
      }

      // 会社情報と会員種別を取得
      const companyVisitorRelations = await this.companyVisitorService.getCompaniesByVisitorId(bookerId);
      if (!companyVisitorRelations || companyVisitorRelations.length === 0) {
        console.log('会社に所属していない来院者のため、標準通知を送信します');
        await this.sendStandardNotification(reservation, booker);
        return;
      }

      // 最初の会社の情報を使用（複数所属の場合は要検討）
      const companyRelation = companyVisitorRelations[0];
      const memberType = companyRelation.memberType || companyRelation['会員種別'];

      // 予約者が本会員の場合
      if (memberType === '本会員') {
        await this.handleMainMemberBooking(reservation, booker, visitor, companyRelation);
      } 
      // 予約者がサブ会員の場合
      else if (memberType === 'サブ会員') {
        await this.handleSubMemberBooking(reservation, booker, visitor, companyRelation);
      }

    } catch (error) {
      console.error('予約確定通知送信エラー:', error);
      this.notificationSettings.recordNotificationHistory({
        type: '予約確定',
        reservationId: reservation.id,
        visitorId: reservation.visitor_id,
        visitorName: reservation.visitor_name,
        recipientId: bookerId,
        success: false,
        error: error.toString()
      });
    }
  }

  /**
   * 本会員が予約した場合の処理
   */
  async handleMainMemberBooking(reservation, booker, visitor, companyRelation) {
    const companyId = companyRelation.companyId || companyRelation['会社ID'];
    
    // 本会員への通知（全項目）
    await this.sendFullNotificationToMember(reservation, booker, '予約確定');

    // 同じ会社のサブ会員を取得
    const companyMembers = await this.companyVisitorService.getVisitorsByCompanyId(companyId);
    const subMembers = companyMembers.filter(member => 
      member.memberType === 'サブ会員' && 
      member.visitorId !== booker.id &&
      member.LINE_ID // LINE IDを持っている人のみ
    );

    // 本会員が自分の予約を取った場合
    if (booker.id === visitor.id) {
      // サブ会員にはチケット残枚数のみ通知
      for (const subMember of subMembers) {
        await this.sendTicketBalanceNotification(reservation, subMember);
      }
    }
    // 本会員が同伴者の予約を取った場合
    else {
      const isPublic = await this.checkReservationVisibility(reservation, visitor);
      
      if (isPublic) {
        // 公開設定の場合：サブ会員に時間・施術注意点以外を通知
        for (const subMember of subMembers) {
          await this.sendPartialNotificationToMember(reservation, subMember, '予約確定', ['時間', '施術注意点']);
        }
      } else {
        // 非公開設定の場合：サブ会員にチケット残枚数のみ通知
        for (const subMember of subMembers) {
          await this.sendTicketBalanceNotification(reservation, subMember);
        }
      }
    }
  }

  /**
   * サブ会員が予約した場合の処理
   */
  async handleSubMemberBooking(reservation, booker, visitor, companyRelation) {
    const companyId = companyRelation.companyId || companyRelation['会社ID'];
    
    // サブ会員（予約者）への通知（全項目）
    await this.sendFullNotificationToMember(reservation, booker, '予約確定');

    // 同じ会社の本会員を取得
    const companyMembers = await this.companyVisitorService.getVisitorsByCompanyId(companyId);
    const mainMembers = companyMembers.filter(member => 
      member.memberType === '本会員' && 
      member.LINE_ID // LINE IDを持っている人のみ
    );

    // 本会員に時間・施術注意点以外を通知
    for (const mainMember of mainMembers) {
      await this.sendPartialNotificationToMember(reservation, mainMember, '予約確定', ['時間', '施術注意点']);
    }
  }

  /**
   * 全項目を含む通知を送信
   */
  async sendFullNotificationToMember(reservation, recipient, notificationType) {
    const template = await this.createFullNotificationTemplate(reservation, notificationType);
    
    if (recipient.LINE_ID && this.notificationSettings.isLineEnabled()) {
      await this.sendLineMessage(recipient.LINE_ID, template);
    } else if (recipient.email && this.notificationSettings.isEmailEnabled()) {
      await this.sendEmailNotification(recipient.email, template, notificationType);
    }

    // 履歴を記録
    this.notificationSettings.recordNotificationHistory({
      type: notificationType,
      reservationId: reservation.id,
      visitorId: reservation.visitor_id,
      visitorName: reservation.visitor_name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      method: recipient.LINE_ID ? 'LINE' : 'EMAIL',
      success: true
    });
  }

  /**
   * 部分的な通知を送信（指定項目を除外）
   */
  async sendPartialNotificationToMember(reservation, recipient, notificationType, excludeItems = []) {
    const template = await this.createPartialNotificationTemplate(reservation, notificationType, excludeItems);
    
    if (recipient.LINE_ID && this.notificationSettings.isLineEnabled()) {
      await this.sendLineMessage(recipient.LINE_ID, template);
    } else if (recipient.email && this.notificationSettings.isEmailEnabled()) {
      await this.sendEmailNotification(recipient.email, template, notificationType);
    }

    // 履歴を記録
    this.notificationSettings.recordNotificationHistory({
      type: notificationType,
      reservationId: reservation.id,
      visitorId: reservation.visitor_id,
      visitorName: reservation.visitor_name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      method: recipient.LINE_ID ? 'LINE' : 'EMAIL',
      success: true
    });
  }

  /**
   * チケット残枚数のみの通知を送信
   */
  async sendTicketBalanceNotification(reservation, recipient) {
    const template = await this.createTicketBalanceTemplate(reservation);
    
    if (recipient.LINE_ID && this.notificationSettings.isLineEnabled()) {
      await this.sendLineMessage(recipient.LINE_ID, template);
    } else if (recipient.email && this.notificationSettings.isEmailEnabled()) {
      await this.sendEmailNotification(recipient.email, template, 'チケット残枚数更新');
    }

    // 履歴を記録
    this.notificationSettings.recordNotificationHistory({
      type: 'チケット残枚数更新',
      reservationId: reservation.id,
      visitorId: reservation.visitor_id,
      visitorName: reservation.visitor_name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      method: recipient.LINE_ID ? 'LINE' : 'EMAIL',
      success: true
    });
  }

  /**
   * リマインダー通知を送信
   * @param {string} type - 'dayBefore' or 'sameDay'
   */
  async sendReminders(type) {
    const targetDate = new Date();
    
    if (type === 'dayBefore') {
      targetDate.setDate(targetDate.getDate() + 1); // 明日の予約
    }
    // sameDayの場合は今日の日付のまま

    // 対象日の予約を取得
    const startDate = new Date(targetDate.setHours(0, 0, 0, 0));
    const endDate = new Date(targetDate.setHours(23, 59, 59, 999));
    
    const reservations = await this.reservationService.getReservationsByDateRange(startDate, endDate);

    for (const reservation of reservations) {
      // 既に送信済みかチェック
      const notificationType = type === 'dayBefore' ? '前日リマインダー' : '当日リマインダー';
      if (this.notificationSettings.isNotificationSent(reservation.id, notificationType)) {
        continue;
      }

      await this.sendReminderNotification(reservation, type);
    }
  }

  /**
   * 個別のリマインダー通知処理
   */
  async sendReminderNotification(reservation, type) {
    try {
      // 予約者情報を取得
      const bookerId = reservation.booked_by || reservation.visitor_id;
      const booker = await this.visitorService.getVisitorById(bookerId);
      
      if (!booker) {
        console.error('予約者情報が見つかりません:', bookerId);
        return;
      }

      // 来院者情報を取得
      const visitor = await this.visitorService.getVisitorById(reservation.visitor_id);
      if (!visitor) {
        console.error('来院者情報が見つかりません:', reservation.visitor_id);
        return;
      }

      // 会社情報と会員種別を取得
      const companyVisitorRelations = await this.companyVisitorService.getCompaniesByVisitorId(bookerId);
      
      // 会社に所属していない場合は標準リマインダー
      if (!companyVisitorRelations || companyVisitorRelations.length === 0) {
        if (booker.LINE_ID) {
          const template = await this.createReminderTemplate(reservation, type);
          await this.sendLineMessage(booker.LINE_ID, template);
        }
        return;
      }

      const companyRelation = companyVisitorRelations[0];
      const memberType = companyRelation.memberType || companyRelation['会員種別'];

      // リマインダーは予約者にのみ送信
      if (booker.LINE_ID) {
        const template = await this.createReminderTemplate(reservation, type);
        await this.sendLineMessage(booker.LINE_ID, template);
        
        // 履歴を記録
        const notificationType = type === 'dayBefore' ? '前日リマインダー' : '当日リマインダー';
        this.notificationSettings.recordNotificationHistory({
          type: notificationType,
          reservationId: reservation.id,
          visitorId: reservation.visitor_id,
          visitorName: reservation.visitor_name,
          recipientId: booker.id,
          recipientName: booker.name,
          method: 'LINE',
          success: true
        });
      }

    } catch (error) {
      console.error('リマインダー通知送信エラー:', error);
    }
  }

  /**
   * 施術後通知を送信
   */
  async sendPostTreatmentNotifications() {
    const currentTime = new Date();
    const delayHours = this.notificationSettings.getPostTreatmentDelayHours();
    const targetTime = new Date(currentTime.getTime() - (delayHours * 60 * 60 * 1000));

    // 終了時刻から指定時間経過した予約を取得
    const reservations = await this.reservationService.getCompletedReservations(targetTime);

    for (const reservation of reservations) {
      // 既に送信済みかチェック
      if (this.notificationSettings.isNotificationSent(reservation.id, '施術後通知')) {
        continue;
      }

      await this.sendPostTreatmentNotification(reservation);
    }
  }

  /**
   * 個別の施術後通知処理
   */
  async sendPostTreatmentNotification(reservation) {
    try {
      // 予約者情報を取得
      const bookerId = reservation.booked_by || reservation.visitor_id;
      const booker = await this.visitorService.getVisitorById(bookerId);
      
      if (!booker) {
        console.error('予約者情報が見つかりません:', bookerId);
        return;
      }

      // 来院者情報を取得
      const visitor = await this.visitorService.getVisitorById(reservation.visitor_id);
      if (!visitor) {
        console.error('来院者情報が見つかりません:', reservation.visitor_id);
        return;
      }

      // 会社情報と会員種別を取得
      const companyVisitorRelations = await this.companyVisitorService.getCompaniesByVisitorId(bookerId);
      
      if (!companyVisitorRelations || companyVisitorRelations.length === 0) {
        // 会社に所属していない場合は標準通知
        if (booker.LINE_ID) {
          const template = await this.createPostTreatmentTemplate(reservation);
          await this.sendLineMessage(booker.LINE_ID, template);
        }
        return;
      }

      const companyRelation = companyVisitorRelations[0];
      const memberType = companyRelation.memberType || companyRelation['会員種別'];
      const companyId = companyRelation.companyId || companyRelation['会社ID'];

      // 予約者が本会員の場合
      if (memberType === '本会員') {
        // 本会員に全項目通知
        await this.sendFullNotificationToMember(reservation, booker, '施術後通知');

        // サブ会員を取得
        const companyMembers = await this.companyVisitorService.getVisitorsByCompanyId(companyId);
        const subMembers = companyMembers.filter(member => 
          member.memberType === 'サブ会員' && 
          member.LINE_ID
        );

        // 本会員が自身の予約の場合：サブ会員にチケット残枚数のみ
        if (booker.id === visitor.id) {
          for (const subMember of subMembers) {
            await this.sendTicketBalanceNotification(reservation, subMember);
          }
        }
        // 本会員がサブ会員の予約を取った場合
        else {
          const targetSubMember = subMembers.find(m => m.visitorId === visitor.id);
          if (targetSubMember) {
            const template = await this.createPostTreatmentPartialTemplate(reservation);
            await this.sendLineMessage(targetSubMember.LINE_ID, template);
          }
        }
      }
      // 予約者がサブ会員の場合
      else if (memberType === 'サブ会員') {
        // サブ会員に通知（チケット消化予定枚数以外）
        const template = await this.createPostTreatmentPartialTemplate(reservation);
        await this.sendLineMessage(booker.LINE_ID, template);

        // 本会員を取得して通知
        const companyMembers = await this.companyVisitorService.getVisitorsByCompanyId(companyId);
        const mainMembers = companyMembers.filter(member => 
          member.memberType === '本会員' && 
          member.LINE_ID
        );

        for (const mainMember of mainMembers) {
          await this.sendFullNotificationToMember(reservation, mainMember, '施術後通知');
        }
      }

    } catch (error) {
      console.error('施術後通知送信エラー:', error);
    }
  }

  /**
   * 予約の公開設定をチェック
   */
  async checkReservationVisibility(reservation, visitor) {
    // 会社別来院者管理シートから公開設定を確認
    const sheet = this.spreadsheetManager.getSheet(Config.getSheetNames().companyVisitors);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === visitor.id) { // visitor_id列
        return data[i][7] === true; // 公開設定列
      }
    }
    
    return false; // デフォルトは非公開
  }

  /**
   * LINEメッセージを送信
   */
  async sendLineMessage(lineUserId, message) {
    try {
      // NotificationServiceのLINE送信機能を使用
      await this.notificationService.sendLineNotification(lineUserId, message);
    } catch (error) {
      console.error('LINE送信エラー:', error);
      throw error;
    }
  }

  /**
   * メール通知を送信
   */
  async sendEmailNotification(email, content, notificationType) {
    const subject = this.getEmailSubject(notificationType);
    
    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: content.text || content,
        htmlBody: content.html || undefined
      });
    } catch (error) {
      console.error('メール送信エラー:', error);
      throw error;
    }
  }

  /**
   * メール件名を取得
   */
  getEmailSubject(notificationType) {
    const subjects = {
      '予約確定': '【予約確定】ご予約が確定しました',
      '前日リマインダー': '【明日のご予約】リマインダー',
      '当日リマインダー': '【本日のご予約】リマインダー',
      '施術後通知': '【来院ありがとうございました】',
      'チケット残枚数更新': '【チケット残枚数】更新のお知らせ'
    };
    
    return subjects[notificationType] || 'お知らせ';
  }

  /**
   * 標準通知を送信（会社に所属していない場合）
   */
  async sendStandardNotification(reservation, recipient) {
    if (recipient.LINE_ID && this.notificationSettings.isLineEnabled()) {
      const template = await this.createFullNotificationTemplate(reservation, '予約確定');
      await this.sendLineMessage(recipient.LINE_ID, template);
    } else if (recipient.email && this.notificationSettings.isEmailEnabled()) {
      const template = await this.createFullNotificationTemplate(reservation, '予約確定');
      await this.sendEmailNotification(recipient.email, template, '予約確定');
    }
  }

  // テンプレート作成メソッド
  async createFullNotificationTemplate(reservation, notificationType) {
    // 会社名を取得
    const companyName = await this.getCompanyName(reservation.visitor_id);
    
    if (notificationType === '予約確定') {
      return CompanyMemberNotificationTemplates.createFullReservationConfirmation(reservation, companyName);
    } else if (notificationType === '施術後通知') {
      return CompanyMemberNotificationTemplates.createPostTreatmentFullNotification(reservation, companyName);
    }
    
    // デフォルト
    return CompanyMemberNotificationTemplates.createFullReservationConfirmation(reservation, companyName);
  }

  async createPartialNotificationTemplate(reservation, notificationType, excludeItems) {
    const companyName = await this.getCompanyName(reservation.visitor_id);
    return CompanyMemberNotificationTemplates.createPartialReservationConfirmation(reservation, companyName, excludeItems);
  }

  async createTicketBalanceTemplate(reservation) {
    const companyName = await this.getCompanyName(reservation.visitor_id);
    const remainingTickets = await this.getCompanyRemainingTickets(reservation.visitor_id);
    return CompanyMemberNotificationTemplates.createTicketBalanceNotification(companyName, remainingTickets);
  }

  async createReminderTemplate(reservation, type) {
    return CompanyMemberNotificationTemplates.createReminderNotification(reservation, type);
  }

  async createPostTreatmentTemplate(reservation) {
    const companyName = await this.getCompanyName(reservation.visitor_id);
    return CompanyMemberNotificationTemplates.createPostTreatmentFullNotification(reservation, companyName);
  }

  async createPostTreatmentPartialTemplate(reservation) {
    const companyName = await this.getCompanyName(reservation.visitor_id);
    return CompanyMemberNotificationTemplates.createPostTreatmentPartialNotification(reservation, companyName);
  }

  /**
   * 会社名を取得
   * @private
   */
  async getCompanyName(visitorId) {
    try {
      const relations = await this.companyVisitorService.getCompaniesByVisitorId(visitorId);
      if (relations && relations.length > 0) {
        return relations[0].companyName || relations[0]['会社名'] || '未設定';
      }
    } catch (error) {
      console.error('会社名取得エラー:', error);
    }
    return '未設定';
  }

  /**
   * 会社のチケット残枚数を取得
   * @private
   */
  async getCompanyRemainingTickets(visitorId) {
    try {
      const relations = await this.companyVisitorService.getCompaniesByVisitorId(visitorId);
      if (relations && relations.length > 0) {
        const companyId = relations[0].companyId || relations[0]['会社ID'];
        // TODO: チケット残枚数の取得ロジックを実装
        return 0; // 暫定実装
      }
    } catch (error) {
      console.error('チケット残枚数取得エラー:', error);
    }
    return 0;
  }
}