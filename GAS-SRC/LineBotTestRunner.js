/**
 * LINE Bot テスト実行ランナー
 * このファイルから全てのテスト準備と実行を行います
 */

/**
 * LINE Bot テストを完全に実行
 * これ1つ実行するだけですべてのテストが可能
 */
function runLineBotFullTest() {
  Logger.log('========== LINE Bot 完全テスト開始 ==========');
  Logger.log(`実行時刻: ${new Date().toISOString()}`);
  
  try {
    // 1. 必要なシートの作成
    Logger.log('\n【ステップ1】必要なシートをチェック・作成');
    checkAndCreateSheets();
    
    // 2. テストデータの生成
    Logger.log('\n【ステップ2】テストデータを生成');
    const dataResult = generateAllTestData();
    if (!dataResult.success) {
      throw new Error('テストデータ生成に失敗しました');
    }
    
    // 3. 環境設定の確認
    Logger.log('\n【ステップ3】環境設定を確認');
    checkEnvironmentSettings();
    
    // 4. 動作状況の表示
    Logger.log('\n【ステップ4】現在の状況を確認');
    showLineBotStatus();
    
    // 5. LINE Bot APIテストの実行
    Logger.log('\n【ステップ5】LINE Bot APIテストを実行');
    runAllLineBotTests();
    
    Logger.log('\n========== LINE Bot 完全テスト終了 ==========');
    
  } catch (error) {
    Logger.log(`\nテストエラー: ${error.toString()}`);
  }
}

/**
 * クイックテスト（データ生成なし）
 * すでにデータがある場合の簡易テスト
 */
function runLineBotQuickTest() {
  Logger.log('========== LINE Bot クイックテスト ==========');
  
  // 予約枠取得のテスト
  Logger.log('\n【予約枠取得テスト】');
  const slotTest = testSingleAction('getAvailableSlots', {
    dateRange: {
      from: Utils.getToday(),
      to: Utils.addDays(Utils.getToday(), 3)
    },
    departments: ['内科'],
    timePreference: 'morning',
    maxResults: 5
  });
  
  if (slotTest && slotTest.status.success) {
    Logger.log(`✓ 成功: ${slotTest.data.availableSlots.length}件の予約枠を取得`);
  } else {
    Logger.log('✗ 失敗');
  }
  
  // ユーザー予約確認のテスト
  Logger.log('\n【ユーザー予約確認テスト】');
  const reservationTest = testSingleAction('getUserReservations', {
    statusFilter: ['confirmed', 'pending'],
    includeHistory: false,
    sortBy: 'date_asc'
  });
  
  if (reservationTest && reservationTest.status.success) {
    Logger.log(`✓ 成功: ${reservationTest.data.reservations.length}件の予約を取得`);
  } else {
    Logger.log('✗ 失敗');
  }
  
  // 診療案内取得のテスト
  Logger.log('\n【診療案内取得テスト】');
  const clinicTest = testSingleAction('getClinicInfo', {
    infoType: 'all',
    includeImages: false
  });
  
  if (clinicTest && clinicTest.status.success) {
    Logger.log('✓ 成功: 診療案内を取得');
  } else {
    Logger.log('✗ 失敗');
  }
  
  Logger.log('\n========== クイックテスト終了 ==========');
}

/**
 * 特定の日付範囲で予約枠を検索
 */
function searchAvailableSlots(fromDate, toDate, department = null) {
  Logger.log(`\n予約枠検索: ${fromDate} から ${toDate}`);
  if (department) {
    Logger.log(`診療科: ${department}`);
  }
  
  const request = createTestRequest('getAvailableSlots', {
    dateRange: {
      from: fromDate,
      to: toDate
    },
    departments: department ? [department] : [],
    timePreference: 'any',
    maxResults: 20
  });
  
  const e = {
    postData: {
      contents: JSON.stringify(request)
    }
  };
  
  const response = doPostLineBot(e);
  const responseData = JSON.parse(response.getContent());
  
  if (responseData.status.success) {
    const slots = responseData.data.availableSlots;
    Logger.log(`\n${slots.length}件の予約枠が見つかりました：`);
    
    slots.forEach(slot => {
      Logger.log(`${slot.dateFormatted} ${slot.timeSlot} - ${slot.department.name} (${slot.department.doctor})`);
    });
  } else {
    Logger.log('予約枠の取得に失敗しました');
  }
  
  return responseData;
}

/**
 * 特定のユーザーの予約を確認
 */
function checkUserReservations(lineUserId = 'U1234567890abcdef') {
  Logger.log(`\nユーザー ${lineUserId} の予約を確認`);
  
  const request = createTestRequest('getUserReservations', {
    statusFilter: [],
    includeHistory: true,
    sortBy: 'date_asc'
  });
  
  // ユーザーIDを上書き
  request.source.userId = lineUserId;
  
  const e = {
    postData: {
      contents: JSON.stringify(request)
    }
  };
  
  const response = doPostLineBot(e);
  const responseData = JSON.parse(response.getContent());
  
  if (responseData.status.success) {
    const reservations = responseData.data.reservations;
    Logger.log(`\n${reservations.length}件の予約が見つかりました：`);
    
    reservations.forEach(reservation => {
      Logger.log(`${reservation.dateFormatted} ${reservation.timeSlot} - ${reservation.department.name} (${reservation.status})`);
    });
  } else {
    Logger.log(`予約の取得に失敗しました: ${responseData.status.message}`);
  }
  
  return responseData;
}

/**
 * テストデータの統計を表示
 */
function showTestDataStats() {
  Logger.log('\n========== テストデータ統計 ==========');
  
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  
  // 患者データ
  const visitorSheet = sheet.getSheetByName(Config.getSheetNames().visitors);
  if (visitorSheet) {
    const patientCount = Math.max(0, visitorSheet.getLastRow() - 1);
    Logger.log(`患者数: ${patientCount}名`);
    
    if (patientCount > 0) {
      const patients = visitorSheet.getRange(2, 1, Math.min(5, patientCount), 2).getValues();
      Logger.log('登録患者（最大5名）:');
      patients.forEach(patient => {
        if (patient[0]) Logger.log(`  - ${patient[0]}: ${patient[1]}`);
      });
    }
  }
  
  // 予約データ
  const reservationSheet = sheet.getSheetByName('予約情報');
  if (reservationSheet) {
    const reservationCount = Math.max(0, reservationSheet.getLastRow() - 1);
    Logger.log(`\n予約数: ${reservationCount}件`);
  }
  
  // 予約枠データ
  const vacancySheet = sheet.getSheetByName('予約枠');
  if (vacancySheet) {
    const vacancyCount = Math.max(0, vacancySheet.getLastRow() - 1);
    Logger.log(`予約枠数: ${vacancyCount}件`);
  }
  
  // LINEユーザーデータ
  const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
  if (lineUserSheet) {
    const lineUserCount = Math.max(0, lineUserSheet.getLastRow() - 1);
    Logger.log(`\nLINEユーザー数: ${lineUserCount}名`);
    
    if (lineUserCount > 0) {
      const users = lineUserSheet.getRange(2, 1, Math.min(5, lineUserCount), 3).getValues();
      Logger.log('登録LINEユーザー:');
      users.forEach(user => {
        if (user[0]) Logger.log(`  - ${user[0]} → ${user[1]} (${user[2]})`);
      });
    }
  }
  
  Logger.log('\n========================================');
}

/**
 * デバッグ用：特定のアクションを詳細にテスト
 */
function debugLineBotAction(actionType, parameters, userId = 'U1234567890abcdef') {
  Logger.log(`\n========== デバッグ: ${actionType} ==========`);
  
  const request = createTestRequest(actionType, parameters);
  request.source.userId = userId;
  
  Logger.log('リクエスト:');
  Logger.log(JSON.stringify(request, null, 2));
  
  const e = {
    postData: {
      contents: JSON.stringify(request)
    }
  };
  
  const startTime = new Date().getTime();
  const response = doPostLineBot(e);
  const endTime = new Date().getTime();
  
  const responseData = JSON.parse(response.getContent());
  
  Logger.log('\nレスポンス:');
  Logger.log(JSON.stringify(responseData, null, 2));
  
  Logger.log(`\n処理時間: ${(endTime - startTime) / 1000}秒`);
  Logger.log(`ステータス: ${responseData.status.success ? '成功' : '失敗'}`);
  
  return responseData;
}

/**
 * テスト環境をリセット
 */
function resetTestEnvironment() {
  Logger.log('テスト環境をリセットします...');
  
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const sheets = [Config.getSheetNames().visitors, '予約情報', '予約枠', 'LINEユーザー情報', 'LINE Bot Logs'];
  
  sheets.forEach(sheetName => {
    const targetSheet = sheet.getSheetByName(sheetName);
    if (targetSheet && targetSheet.getLastRow() > 1) {
      targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getLastColumn()).clear();
      Logger.log(`✓ ${sheetName}をクリアしました`);
    }
  });
  
  Logger.log('リセット完了');
}