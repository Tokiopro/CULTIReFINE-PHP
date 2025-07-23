/**
 * 通知設定管理サービス
 * 
 * 機能:
 * - 通知タイミングの管理
 * - 通知有効/無効の管理
 * - デフォルト設定の提供
 */
class NotificationSettingsService {
  constructor() {
    this.settingsSheetName = '通知設定';
    this.historySheetName = '予約通知履歴';
    this.spreadsheetManager = new SpreadsheetManager();
  }

  /**
   * 通知設定を取得
   * @return {Object} 通知設定
   */
  getSettings() {
    try {
      const sheet = this.spreadsheetManager.getSheet(this.settingsSheetName);
      
      if (!sheet) {
        // シートが存在しない場合はデフォルト設定を返す
        return this.getDefaultSettings();
      }

      const data = sheet.getDataRange().getValues();
      const settings = {};

      // ヘッダー行をスキップして設定を読み込む
      for (let i = 1; i < data.length; i++) {
        const [key, value, enabled] = data[i];
        if (key) {
          settings[key] = {
            value: value,
            enabled: enabled === true || enabled === 'TRUE' || enabled === '有効'
          };
        }
      }

      // デフォルト設定とマージ
      return this.mergeWithDefaults(settings);

    } catch (error) {
      Logger.log('通知設定取得エラー: ' + error.toString());
      return this.getDefaultSettings();
    }
  }

  /**
   * 通知設定を保存
   * @param {Object} settings - 保存する設定
   */
  saveSettings(settings) {
    try {
      const sheet = this.spreadsheetManager.getOrCreateSheet(this.settingsSheetName);
      
      // ヘッダー設定
      const headers = ['設定項目', '設定値', '有効/無効', '説明', '更新日時'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // データ準備
      const data = [];
      const now = new Date();

      // リマインダー時刻設定
      data.push([
        'reminder_day_before_hour',
        settings.reminder_day_before_hour || 11,
        settings.reminder_day_before_enabled !== false ? '有効' : '無効',
        '前日リマインダーの送信時刻（時）',
        now
      ]);

      data.push([
        'reminder_same_day_hour',
        settings.reminder_same_day_hour || 9,
        settings.reminder_same_day_enabled !== false ? '有効' : '無効',
        '当日リマインダーの送信時刻（時）',
        now
      ]);

      // 施術後通知設定
      data.push([
        'post_treatment_delay_hours',
        settings.post_treatment_delay_hours || 1,
        settings.post_treatment_enabled !== false ? '有効' : '無効',
        '施術終了後の通知遅延時間（時間）',
        now
      ]);

      // メール通知設定
      data.push([
        'email_notifications_enabled',
        settings.email_notifications_enabled ? 'TRUE' : 'FALSE',
        settings.email_notifications_enabled ? '有効' : '無効',
        'メール通知の有効/無効',
        now
      ]);

      // 通知先メールアドレス（全般）
      data.push([
        'notification_email',
        settings.notification_email || '',
        settings.notification_email ? '有効' : '無効',
        '通知先メールアドレス（全般）',
        now
      ]);

      // 予約確定通知用メールアドレス
      data.push([
        'booking_confirmation_email',
        settings.booking_confirmation_email || '',
        settings.booking_confirmation_email ? '有効' : '無効',
        '予約確定通知用メールアドレス',
        now
      ]);

      // リマインダー通知用メールアドレス
      data.push([
        'reminder_notification_email',
        settings.reminder_notification_email || '',
        settings.reminder_notification_email ? '有効' : '無効',
        'リマインダー通知用メールアドレス',
        now
      ]);

      // 施術後通知用メールアドレス
      data.push([
        'post_treatment_email',
        settings.post_treatment_email || '',
        settings.post_treatment_email ? '有効' : '無効',
        '施術後通知用メールアドレス',
        now
      ]);

      // LINE通知設定
      data.push([
        'line_notifications_enabled',
        settings.line_notifications_enabled !== false ? 'TRUE' : 'FALSE',
        settings.line_notifications_enabled !== false ? '有効' : '無効',
        'LINE通知の有効/無効',
        now
      ]);

      // 予約確定通知設定
      data.push([
        'booking_confirmation_enabled',
        settings.booking_confirmation_enabled !== false ? 'TRUE' : 'FALSE',
        settings.booking_confirmation_enabled !== false ? '有効' : '無効',
        '予約確定通知の有効/無効',
        now
      ]);

      // データ書き込み
      if (data.length > 0) {
        sheet.getRange(2, 1, data.length, headers.length).setValues(data);
      }

      // フォーマット設定
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);

      Logger.log('通知設定を保存しました');

    } catch (error) {
      Logger.log('通知設定保存エラー: ' + error.toString());
      throw error;
    }
  }

  /**
   * 特定の設定値を取得
   * @param {string} key - 設定キー
   * @return {*} 設定値
   */
  getSetting(key) {
    const settings = this.getSettings();
    return settings[key] ? settings[key].value : null;
  }

  /**
   * 特定の設定が有効かチェック
   * @param {string} key - 設定キー
   * @return {boolean} 有効/無効
   */
  isEnabled(key) {
    const settings = this.getSettings();
    return settings[key] ? settings[key].enabled : false;
  }

  /**
   * メール通知が有効かチェック
   * @return {boolean}
   */
  isEmailEnabled() {
    return this.isEnabled('email_notifications_enabled');
  }

  /**
   * LINE通知が有効かチェック
   * @return {boolean}
   */
  isLineEnabled() {
    return this.isEnabled('line_notifications_enabled');
  }

  /**
   * 前日リマインダーの送信時刻を取得
   * @return {number} 時刻（時）
   */
  getReminderDayBeforeHour() {
    return this.getSetting('reminder_day_before_hour') || 11;
  }

  /**
   * 当日リマインダーの送信時刻を取得
   * @return {number} 時刻（時）
   */
  getReminderSameDayHour() {
    return this.getSetting('reminder_same_day_hour') || 9;
  }

  /**
   * 施術後通知の遅延時間を取得
   * @return {number} 遅延時間（時間）
   */
  getPostTreatmentDelayHours() {
    return this.getSetting('post_treatment_delay_hours') || 1;
  }

  /**
   * 通知タイプ別のメールアドレスを取得
   * @param {string} notificationType - 通知タイプ
   * @return {Array} メールアドレスの配列
   */
  getNotificationEmails(notificationType) {
    const settings = this.getSettings();
    const emails = [];

    // 全般のメールアドレス
    if (settings.notification_email && settings.notification_email.value) {
      emails.push(...settings.notification_email.value.split(',').map(e => e.trim()).filter(e => e));
    }

    // 通知タイプ別のメールアドレス
    switch (notificationType) {
      case 'booking_confirmation':
        if (settings.booking_confirmation_email && settings.booking_confirmation_email.value) {
          emails.push(...settings.booking_confirmation_email.value.split(',').map(e => e.trim()).filter(e => e));
        }
        break;
      case 'reminder':
        if (settings.reminder_notification_email && settings.reminder_notification_email.value) {
          emails.push(...settings.reminder_notification_email.value.split(',').map(e => e.trim()).filter(e => e));
        }
        break;
      case 'post_treatment':
        if (settings.post_treatment_email && settings.post_treatment_email.value) {
          emails.push(...settings.post_treatment_email.value.split(',').map(e => e.trim()).filter(e => e));
        }
        break;
    }

    // 重複を削除
    return [...new Set(emails)];
  }

  /**
   * デフォルト設定を取得
   * @private
   */
  getDefaultSettings() {
    return {
      reminder_day_before_hour: { value: 11, enabled: true },
      reminder_same_day_hour: { value: 9, enabled: true },
      post_treatment_delay_hours: { value: 1, enabled: true },
      email_notifications_enabled: { value: false, enabled: false },
      notification_email: { value: '', enabled: false },
      booking_confirmation_email: { value: '', enabled: false },
      reminder_notification_email: { value: '', enabled: false },
      post_treatment_email: { value: '', enabled: false },
      line_notifications_enabled: { value: true, enabled: true },
      booking_confirmation_enabled: { value: true, enabled: true }
    };
  }

  /**
   * デフォルト設定とマージ
   * @private
   */
  mergeWithDefaults(settings) {
    const defaults = this.getDefaultSettings();
    const merged = {};

    // デフォルト設定をベースに、保存された設定で上書き
    Object.keys(defaults).forEach(key => {
      merged[key] = settings[key] || defaults[key];
    });

    return merged;
  }

  /**
   * 通知履歴を記録
   * @param {Object} notificationData - 通知データ
   */
  recordNotificationHistory(notificationData) {
    try {
      const sheet = this.spreadsheetManager.getOrCreateSheet(this.historySheetName);
      
      // ヘッダー設定（初回のみ）
      if (sheet.getLastRow() === 0) {
        const headers = [
          '送信日時',
          '通知タイプ',
          '予約ID',
          '来院者ID',
          '来院者名',
          '受信者ID',
          '受信者名',
          '送信方法',
          '送信結果',
          'エラー詳細'
        ];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }

      // データ追加
      const row = [
        new Date(),
        notificationData.type || '',
        notificationData.reservationId || '',
        notificationData.visitorId || '',
        notificationData.visitorName || '',
        notificationData.recipientId || '',
        notificationData.recipientName || '',
        notificationData.method || 'LINE',
        notificationData.success ? '成功' : '失敗',
        notificationData.error || ''
      ];

      sheet.appendRow(row);

    } catch (error) {
      Logger.log('通知履歴記録エラー: ' + error.toString());
    }
  }

  /**
   * 通知履歴を確認
   * @param {string} reservationId - 予約ID
   * @param {string} notificationType - 通知タイプ
   * @return {boolean} 送信済みかどうか
   */
  isNotificationSent(reservationId, notificationType) {
    try {
      const sheet = this.spreadsheetManager.getSheet(this.historySheetName);
      
      if (!sheet || sheet.getLastRow() <= 1) {
        return false;
      }

      const data = sheet.getDataRange().getValues();
      
      // ヘッダー行をスキップして検索
      for (let i = 1; i < data.length; i++) {
        if (data[i][2] === reservationId && // 予約ID
            data[i][1] === notificationType && // 通知タイプ
            data[i][8] === '成功') { // 送信結果
          return true;
        }
      }

      return false;

    } catch (error) {
      Logger.log('通知履歴確認エラー: ' + error.toString());
      return false;
    }
  }

  /**
   * トリガー設定を更新
   */
  updateTriggers() {
    try {
      // 既存のトリガーを削除
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => {
        const handlerFunction = trigger.getHandlerFunction();
        if (handlerFunction === 'sendDayBeforeReminders' ||
            handlerFunction === 'sendSameDayReminders' ||
            handlerFunction === 'sendPostTreatmentNotifications') {
          ScriptApp.deleteTrigger(trigger);
        }
      });

      const settings = this.getSettings();

      // 前日リマインダー
      if (settings.reminder_day_before_hour.enabled) {
        ScriptApp.newTrigger('sendDayBeforeReminders')
          .timeBased()
          .everyDays(1)
          .atHour(settings.reminder_day_before_hour.value)
          .create();
      }

      // 当日リマインダー
      if (settings.reminder_same_day_hour.enabled) {
        ScriptApp.newTrigger('sendSameDayReminders')
          .timeBased()
          .everyDays(1)
          .atHour(settings.reminder_same_day_hour.value)
          .create();
      }

      // 施術後通知（1時間ごとに実行）
      if (settings.post_treatment_delay_hours.enabled) {
        ScriptApp.newTrigger('sendPostTreatmentNotifications')
          .timeBased()
          .everyHours(1)
          .create();
      }

      Logger.log('トリガー設定を更新しました');

    } catch (error) {
      Logger.log('トリガー更新エラー: ' + error.toString());
      throw error;
    }
  }

  /**
   * 通知設定の初期化
   */
  initializeSettings() {
    const defaultSettings = {
      reminder_day_before_hour: 11,
      reminder_day_before_enabled: true,
      reminder_same_day_hour: 9,
      reminder_same_day_enabled: true,
      post_treatment_delay_hours: 1,
      post_treatment_enabled: true,
      email_notifications_enabled: false,
      notification_email: '',
      line_notifications_enabled: true,
      booking_confirmation_enabled: true
    };

    this.saveSettings(defaultSettings);
    this.updateTriggers();
    
    Logger.log('通知設定を初期化しました');
  }
}