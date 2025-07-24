/**
 * 予約同期トリガー管理
 * 実行時間制限を考慮した段階的な同期処理
 */

/**
 * 予約同期トリガーを設定
 */
function setupReservationSyncTriggers() {
  // 既存の予約同期トリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const handlerFunction = trigger.getHandlerFunction();
    if (handlerFunction === 'runDailyReservationSync' || 
        handlerFunction === 'runWeeklyReservationSync' || 
        handlerFunction === 'runMonthlyReservationSync') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 日次同期（毎日午前2時）
  ScriptApp.newTrigger('runDailyReservationSync')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();
  
  // 週次同期（毎週日曜日午前3時）
  ScriptApp.newTrigger('runWeeklyReservationSync')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(3)
    .inTimezone('Asia/Tokyo')
    .create();
  
  // 月次同期（毎月1日午前4時）
  ScriptApp.newTrigger('runMonthlyReservationSync')
    .timeBased()
    .onMonthDay(1)
    .atHour(4)
    .inTimezone('Asia/Tokyo')
    .create();
  
  Logger.log('予約同期トリガーを設定しました');
}

/**
 * 日次予約同期を実行
 */
function runDailyReservationSync() {
  Logger.log('=== 日次予約同期トリガー実行 ===');
  try {
    const reservationService = new ReservationService();
    const result = reservationService.dailyIncrementalSync();
    
    Logger.log(`日次同期結果: ${JSON.stringify(result)}`);
    
    // 完了していない場合は30分後に再実行
    if (!result.completed) {
      const trigger = ScriptApp.newTrigger('runDailyReservationSync')
        .timeBased()
        .after(30 * 60 * 1000) // 30分後
        .create();
      
      Logger.log('同期が未完了のため、30分後に再実行します');
    }
    
    // 同期メトリクスを記録
    logSyncMetrics('daily', result);
    
  } catch (error) {
    Logger.log(`日次同期エラー: ${error.toString()}`);
    // エラー通知を送信する場合はここに追加
    notifySyncError('日次同期', error);
  }
}

/**
 * 週次予約同期を実行
 */
function runWeeklyReservationSync() {
  Logger.log('=== 週次予約同期トリガー実行 ===');
  try {
    const reservationService = new ReservationService();
    const result = reservationService.weeklySync();
    
    Logger.log(`週次同期結果: ${JSON.stringify(result)}`);
    
    // 完了していない場合は1時間後に再実行
    if (!result.completed) {
      const trigger = ScriptApp.newTrigger('runWeeklyReservationSync')
        .timeBased()
        .after(60 * 60 * 1000) // 1時間後
        .create();
      
      Logger.log('同期が未完了のため、1時間後に再実行します');
    }
    
    // 同期メトリクスを記録
    logSyncMetrics('weekly', result);
    
  } catch (error) {
    Logger.log(`週次同期エラー: ${error.toString()}`);
    notifySyncError('週次同期', error);
  }
}

/**
 * 月次予約同期を実行
 */
function runMonthlyReservationSync() {
  Logger.log('=== 月次予約同期トリガー実行 ===');
  try {
    const reservationService = new ReservationService();
    const result = reservationService.monthlyFullSync();
    
    Logger.log(`月次同期結果: ${JSON.stringify(result)}`);
    
    // 完了していない場合は2時間後に再実行
    if (!result.completed) {
      const trigger = ScriptApp.newTrigger('runMonthlyReservationSync')
        .timeBased()
        .after(2 * 60 * 60 * 1000) // 2時間後
        .create();
      
      Logger.log('同期が未完了のため、2時間後に再実行します');
    }
    
    // 同期メトリクスを記録
    logSyncMetrics('monthly', result);
    
  } catch (error) {
    Logger.log(`月次同期エラー: ${error.toString()}`);
    notifySyncError('月次同期', error);
  }
}

/**
 * 手動で予約同期を実行（デバッグ用）
 */
function manualReservationSync() {
  const reservationService = new ReservationService();
  
  // 実行時間を監視しながら同期
  const result = reservationService.syncReservationsWithTimeLimit({
    date_from: Utils.getToday(),
    date_to: Utils.formatDate(new Date(new Date().setDate(new Date().getDate() + 30)))
  }, 240000); // 4分制限
  
  Logger.log(`手動同期結果: ${JSON.stringify(result)}`);
  
  if (!result.completed) {
    Logger.log('同期が未完了です。再度実行してください。');
  }
  
  return result;
}

/**
 * 同期メトリクスを記録
 */
function logSyncMetrics(syncType, result) {
  const metricsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('同期メトリクス');
  if (!metricsSheet) {
    // メトリクスシートがない場合は作成
    const sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('同期メトリクス');
    sheet.getRange(1, 1, 1, 7).setValues([['同期タイプ', '実行日時', '完了状態', '同期件数', 'オフセット', 'エラー', '備考']]);
  }
  
  const row = [
    syncType,
    new Date(),
    result.completed ? '完了' : '未完了',
    result.totalSynced || 0,
    result.lastOffset || 0,
    result.error || '',
    result.completed ? '' : '次回再開'
  ];
  
  metricsSheet.appendRow(row);
}

/**
 * 同期エラーを通知
 */
function notifySyncError(syncType, error) {
  // エラー通知の実装（メール、Slack等）
  // 例：管理者にメール送信
  try {
    const adminEmail = Config.getAdminEmail();
    if (adminEmail) {
      const subject = `[天満病院] 予約同期エラー: ${syncType}`;
      const body = `
予約同期でエラーが発生しました。

同期タイプ: ${syncType}
発生日時: ${new Date().toISOString()}
エラー内容: ${error.toString()}

スプレッドシートを確認してください。
      `;
      
      MailApp.sendEmail(adminEmail, subject, body);
    }
  } catch (e) {
    Logger.log(`エラー通知送信失敗: ${e.toString()}`);
  }
}

/**
 * 同期状態を確認
 */
function checkSyncStatus() {
  const cache = CacheService.getScriptCache();
  const savedStatus = cache.get('reservation_sync_status');
  
  if (savedStatus) {
    const status = JSON.parse(savedStatus);
    Logger.log('現在の同期状態:');
    Logger.log(`- 完了: ${status.completed}`);
    Logger.log(`- 同期済み件数: ${status.totalSynced}`);
    Logger.log(`- 最終オフセット: ${status.lastOffset}`);
    Logger.log(`- 期間: ${status.dateFrom} ～ ${status.dateTo}`);
    
    return status;
  } else {
    Logger.log('保存された同期状態はありません');
    return null;
  }
}

/**
 * 同期キャッシュをクリア
 */
function clearSyncCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('reservation_sync_status');
  cache.remove('reservation_sync_offset');
  cache.remove('reservation_sync_params');
  
  Logger.log('同期キャッシュをクリアしました');
}