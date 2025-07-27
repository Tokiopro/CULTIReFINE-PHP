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
  const triggerStartTime = new Date().getTime();
  
  try {
    const reservationService = new ReservationService();
    const result = reservationService.dailyIncrementalSync();
    
    const triggerEndTime = new Date().getTime();
    const totalExecutionTime = (triggerEndTime - triggerStartTime) / 1000;
    
    Logger.log(`日次同期完了: ${JSON.stringify(result)}`);
    Logger.log(`トリガー合計実行時間: ${totalExecutionTime}秒`);
    
    if (!result.success) {
      throw new Error(result.message || '同期に失敗しました');
    }
    
    // 同期メトリクスを記録
    logSyncMetrics('daily', result);
    
    // 実行時間が長い場合は警告
    if (totalExecutionTime > 240) { // 4分以上
      Logger.log(`警告: 実行時間が長すぎます (${totalExecutionTime}秒)`);
    }
    
  } catch (error) {
    Logger.log(`日次同期エラー: ${error.toString()}`);
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
    
    Logger.log(`週次同期完了: ${JSON.stringify(result)}`);
    
    if (!result.success) {
      throw new Error(result.message || '同期に失敗しました');
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
    
    Logger.log(`月次同期完了: ${JSON.stringify(result)}`);
    
    if (!result.success) {
      throw new Error(result.message || '同期に失敗しました');
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
  
  // 最適化された同期を実行
  const result = reservationService.syncReservationsOptimized({
    date_from: Utils.getToday(),
    date_to: Utils.formatDate(new Date(new Date().setDate(new Date().getDate() + 7)))
  });
  
  Logger.log(`手動同期結果: ${JSON.stringify(result)}`);
  
  return result;
}

/**
 * 特定日付範囲の同期（デバッグ用）
 */
function syncDateRange(dateFrom, dateTo) {
  const reservationService = new ReservationService();
  
  return reservationService.syncReservationsOptimized({
    date_from: dateFrom,
    date_to: dateTo
  });
}

/**
 * 今日の予約のみ同期（デバッグ用）
 */
function syncToday() {
  const reservationService = new ReservationService();
  const today = Utils.getToday();
  
  return reservationService.syncReservationsOptimized({
    date_from: today,
    date_to: today
  });
}

/**
 * 同期メトリクスを記録
 */
function logSyncMetrics(syncType, result) {
  const metricsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('同期メトリクス');
  if (!metricsSheet) {
    // メトリクスシートがない場合は作成
    const sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('同期メトリクス');
    sheet.getRange(1, 1, 1, 6).setValues([['同期タイプ', '実行日時', '同期件数', '実行時間(秒)', '日付範囲', 'ステータス']]);
  }
  
  const row = [
    syncType,
    new Date(),
    result.totalSynced || 0,
    result.executionTime || 0,
    result.dateRange || '',
    result.success ? '成功' : 'エラー'
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