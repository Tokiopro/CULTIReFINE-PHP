/**
 * 定期実行される通知関数
 * Google Apps Scriptのトリガーから呼び出される
 */

/**
 * 前日リマインダーを送信
 * 毎日設定時刻に実行される
 */
function sendDayBeforeReminders() {
  try {
    Logger.log('前日リマインダー送信処理を開始します');
    
    const notificationSettings = new NotificationSettingsService();
    
    // 前日リマインダーが有効かチェック
    if (!notificationSettings.isEnabled('reminder_day_before_hour')) {
      Logger.log('前日リマインダーは無効になっています');
      return;
    }
    
    // 通知サービスを初期化
    const notificationService = new CompanyMemberNotificationService();
    
    // リマインダーを送信
    notificationService.sendReminders('dayBefore')
      .then(() => {
        Logger.log('前日リマインダー送信処理が完了しました');
      })
      .catch(error => {
        Logger.log(`前日リマインダー送信エラー: ${error.toString()}`);
        // エラー通知（管理者へ）
        Utils.sendErrorNotification('前日リマインダー送信エラー', error);
      });
    
  } catch (error) {
    Logger.log(`前日リマインダー処理エラー: ${error.toString()}`);
    Utils.sendErrorNotification('前日リマインダー処理エラー', error);
  }
}

/**
 * 当日リマインダーを送信
 * 毎日設定時刻に実行される
 */
function sendSameDayReminders() {
  try {
    Logger.log('当日リマインダー送信処理を開始します');
    
    const notificationSettings = new NotificationSettingsService();
    
    // 当日リマインダーが有効かチェック
    if (!notificationSettings.isEnabled('reminder_same_day_hour')) {
      Logger.log('当日リマインダーは無効になっています');
      return;
    }
    
    // 通知サービスを初期化
    const notificationService = new CompanyMemberNotificationService();
    
    // リマインダーを送信
    notificationService.sendReminders('sameDay')
      .then(() => {
        Logger.log('当日リマインダー送信処理が完了しました');
      })
      .catch(error => {
        Logger.log(`当日リマインダー送信エラー: ${error.toString()}`);
        // エラー通知（管理者へ）
        Utils.sendErrorNotification('当日リマインダー送信エラー', error);
      });
    
  } catch (error) {
    Logger.log(`当日リマインダー処理エラー: ${error.toString()}`);
    Utils.sendErrorNotification('当日リマインダー処理エラー', error);
  }
}

/**
 * 施術後通知を送信
 * 1時間ごとに実行される
 */
function sendPostTreatmentNotifications() {
  try {
    Logger.log('施術後通知送信処理を開始します');
    
    const notificationSettings = new NotificationSettingsService();
    
    // 施術後通知が有効かチェック
    if (!notificationSettings.isEnabled('post_treatment_delay_hours')) {
      Logger.log('施術後通知は無効になっています');
      return;
    }
    
    // 通知サービスを初期化
    const notificationService = new CompanyMemberNotificationService();
    
    // 施術後通知を送信
    notificationService.sendPostTreatmentNotifications()
      .then(() => {
        Logger.log('施術後通知送信処理が完了しました');
      })
      .catch(error => {
        Logger.log(`施術後通知送信エラー: ${error.toString()}`);
        // エラー通知（管理者へ）
        Utils.sendErrorNotification('施術後通知送信エラー', error);
      });
    
  } catch (error) {
    Logger.log(`施術後通知処理エラー: ${error.toString()}`);
    Utils.sendErrorNotification('施術後通知処理エラー', error);
  }
}

/**
 * 通知トリガーを設定
 * 設定画面から呼び出される
 */
function setupNotificationTriggers() {
  try {
    Logger.log('通知トリガーの設定を開始します');
    
    // 既存のトリガーを削除
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      const handlerFunction = trigger.getHandlerFunction();
      if (handlerFunction === 'sendDayBeforeReminders' ||
          handlerFunction === 'sendSameDayReminders' ||
          handlerFunction === 'sendPostTreatmentNotifications') {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`既存トリガーを削除: ${handlerFunction}`);
      }
    });
    
    // 通知設定を取得
    const notificationSettings = new NotificationSettingsService();
    const settings = notificationSettings.getSettings();
    
    // 前日リマインダートリガー
    if (settings.reminder_day_before_hour.enabled) {
      const dayBeforeHour = settings.reminder_day_before_hour.value || 11;
      ScriptApp.newTrigger('sendDayBeforeReminders')
        .timeBased()
        .everyDays(1)
        .atHour(dayBeforeHour)
        .create();
      Logger.log(`前日リマインダートリガーを設定: ${dayBeforeHour}時`);
    }
    
    // 当日リマインダートリガー
    if (settings.reminder_same_day_hour.enabled) {
      const sameDayHour = settings.reminder_same_day_hour.value || 9;
      ScriptApp.newTrigger('sendSameDayReminders')
        .timeBased()
        .everyDays(1)
        .atHour(sameDayHour)
        .create();
      Logger.log(`当日リマインダートリガーを設定: ${sameDayHour}時`);
    }
    
    // 施術後通知トリガー（1時間ごと）
    if (settings.post_treatment_delay_hours.enabled) {
      ScriptApp.newTrigger('sendPostTreatmentNotifications')
        .timeBased()
        .everyHours(1)
        .create();
      Logger.log('施術後通知トリガーを設定: 1時間ごと');
    }
    
    Logger.log('通知トリガーの設定が完了しました');
    
    return {
      success: true,
      message: '通知トリガーを設定しました'
    };
    
  } catch (error) {
    Logger.log(`トリガー設定エラー: ${error.toString()}`);
    return {
      success: false,
      message: `トリガー設定に失敗しました: ${error.message}`
    };
  }
}

/**
 * 通知設定をテスト
 * 管理画面から呼び出される
 */
function testNotifications(type) {
  try {
    Logger.log(`通知テストを開始: ${type}`);
    
    switch (type) {
      case 'dayBefore':
        sendDayBeforeReminders();
        break;
      case 'sameDay':
        sendSameDayReminders();
        break;
      case 'postTreatment':
        sendPostTreatmentNotifications();
        break;
      default:
        throw new Error(`不明な通知タイプ: ${type}`);
    }
    
    return {
      success: true,
      message: `${type}の通知テストを実行しました。ログを確認してください。`
    };
    
  } catch (error) {
    Logger.log(`通知テストエラー: ${error.toString()}`);
    return {
      success: false,
      message: `通知テストに失敗しました: ${error.message}`
    };
  }
}