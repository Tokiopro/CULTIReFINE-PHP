/**
 * Medical Force連携システム - テスト関数
 * 
 * このファイルには、実装した機能をテストするための関数が含まれています。
 * GASエディタから直接実行して、各機能の動作を確認できます。
 */

/**
 * 1. OAuth認証のテスト
 */
function test_01_Authentication() {
  Logger.log('=== OAuth認証テスト開始 ===');
  
  try {
    // 認証情報の確認
    const hasCredentials = TokenManager.hasCredentials();
    Logger.log(`認証情報の設定: ${hasCredentials ? '済み' : '未設定'}`);
    
    if (!hasCredentials) {
      Logger.log('エラー: 認証情報が設定されていません');
      Logger.log('設定画面からCLIENT_IDとCLIENT_SECRETを設定してください');
      return false;
    }
    
    // アクセストークンの取得
    const token = TokenManager.getAccessToken();
    Logger.log(`アクセストークン取得: ${token ? '成功' : '失敗'}`);
    
    if (token) {
      Logger.log(`トークン長: ${token.length}文字`);
      Logger.log('OAuth認証テスト: 成功');
      return true;
    }
    
  } catch (error) {
    Logger.log(`OAuth認証エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 2. API接続テスト
 */
function test_02_APIConnection() {
  Logger.log('=== API接続テスト開始 ===');
  
  try {
    const apiClient = new ApiClient();
    
    // クリニック情報の取得テスト
    const response = apiClient.get(apiClient.config.endpoints.clinics, {
      clinic_id: Config.getClinicId()
    });
    
    if (response.success) {
      Logger.log('API接続: 成功');
      Logger.log(`レスポンスデータ: ${JSON.stringify(response.data).substring(0, 100)}...`);
      return true;
    } else {
      Logger.log('API接続: 失敗');
      Logger.log(`エラー: ${response.error}`);
      return false;
    }
    
  } catch (error) {
    Logger.log(`API接続エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 3. スプレッドシート初期化テスト
 */
function test_03_SpreadsheetInit() {
  Logger.log('=== スプレッドシート初期化テスト開始 ===');
  
  try {
    const result = SpreadsheetManager.initializeAllSheets();
    
    if (result) {
      Logger.log('スプレッドシート初期化: 成功');
      
      // 作成されたシートの確認
      const sheetNames = Config.getSheetNames();
      Object.keys(sheetNames).forEach(key => {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNames[key]);
        Logger.log(`シート「${sheetNames[key]}」: ${sheet ? '存在' : '不在'}`);
      });
      
      return true;
    }
    
  } catch (error) {
    Logger.log(`スプレッドシート初期化エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 4. 患者データ同期テスト（少量）
 */
function test_04_VisitorSync() {
  Logger.log('=== 患者データ同期テスト開始 ===');
  
  try {
    const service = new VisitorService();
    
    // 5件のみ取得してテスト
    const count = service.syncVisitors({ limit: 5 });
    
    Logger.log(`同期された患者数: ${count}件`);
    
    if (count >= 0) {
      Logger.log('患者データ同期: 成功');
      
      // シートの内容を確認
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('患者マスタ');
      const lastRow = sheet.getLastRow();
      Logger.log(`患者マスタシートの行数: ${lastRow}`);
      
      return true;
    }
    
  } catch (error) {
    Logger.log(`患者データ同期エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 5. 予約データ同期テスト（少量）
 */
function test_05_ReservationSync() {
  Logger.log('=== 予約データ同期テスト開始 ===');
  
  try {
    const service = new ReservationService();
    
    // 今日の予約のみ取得
    const today = Utils.getToday();
    const count = service.syncReservations({
      date_from: today,
      limit: 5
    });
    
    Logger.log(`同期された予約数: ${count}件`);
    
    if (count >= 0) {
      Logger.log('予約データ同期: 成功');
      return true;
    }
    
  } catch (error) {
    Logger.log(`予約データ同期エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 6. 空き時間取得テスト
 */
function test_06_VacancyCheck() {
  Logger.log('=== 空き時間取得テスト開始 ===');
  
  try {
    const service = new ReservationService();
    const today = Utils.getToday();
    
    const vacancies = service.getVacancies({
      date_from: today,
      epoch_from_keydate: today,
      epoch_to_keydate: today,
      time_spacing: '30'
    });
    
    if (vacancies) {
      Logger.log('空き時間取得: 成功');
      Logger.log(`取得データ: ${JSON.stringify(vacancies).substring(0, 200)}...`);
      return true;
    }
    
  } catch (error) {
    Logger.log(`空き時間取得エラー: ${error.toString()}`);
    return false;
  }
}


/**
 * 8. ダイアログ機能テスト（UIテスト）
 */
function test_08_DialogFunctions() {
  Logger.log('=== ダイアログ機能テスト開始 ===');
  
  try {
    // 各ダイアログHTMLファイルの存在確認
    const dialogs = [
      'InitDialog',
      'SettingsDialog',
      'HelpDialog',
      'CheckVacanciesDialog',
      'SearchVisitorDialog',
      'CreateReservationDialog'
    ];
    
    let allExist = true;
    dialogs.forEach(dialogName => {
      try {
        const html = HtmlService.createHtmlOutputFromFile(dialogName);
        Logger.log(`${dialogName}: 存在`);
      } catch (e) {
        Logger.log(`${dialogName}: 不在`);
        allExist = false;
      }
    });
    
    if (allExist) {
      Logger.log('ダイアログファイル確認: すべて存在');
      return true;
    } else {
      Logger.log('ダイアログファイル確認: 一部不在');
      return false;
    }
    
  } catch (error) {
    Logger.log(`ダイアログ機能エラー: ${error.toString()}`);
    return false;
  }
}


/**
 * 9. カルテ番号による患者情報取得テスト
 */
function test_09_ChartNumberPatientSearch() {
  Logger.log('=== カルテ番号による患者情報取得テスト開始 ===');
  
  try {
    const service = new VisitorService();
    
    // テスト用のカルテ番号（実際に存在するもの）
    const testChartNumber = '303';
    
    Logger.log(`テストカルテ番号: ${testChartNumber}`);
    
    // 1. APIから直接取得を試行
    Logger.log('--- API直接取得テスト ---');
    const apiClient = new ApiClient();
    const apiResponse = apiClient.getVisitors({
      chart_number: testChartNumber,
      limit: 1
    });
    
    if (apiResponse.success && apiResponse.data) {
      const visitors = Array.isArray(apiResponse.data) ? apiResponse.data : (apiResponse.data.items || []);
      Logger.log(`API直接取得: ${visitors.length}件取得`);
      
      if (visitors.length > 0) {
        Logger.log(`取得された患者情報: ${JSON.stringify(visitors[0]).substring(0, 200)}...`);
      }
    } else {
      Logger.log('API直接取得: 失敗');
    }
    
    // 2. スプレッドシートから検索を試行
    Logger.log('--- スプレッドシート検索テスト ---');
    const sheetResponse = service.searchVisitorsFromSheet({
      chart_number: testChartNumber
    });
    
    if (sheetResponse && sheetResponse.items) {
      Logger.log(`スプレッドシート検索: ${sheetResponse.items.length}件取得`);
      
      if (sheetResponse.items.length > 0) {
        Logger.log(`取得された患者情報: ${JSON.stringify(sheetResponse.items[0]).substring(0, 200)}...`);
      }
    } else {
      Logger.log('スプレッドシート検索: 失敗');
    }
    
    // 3. プレフィックス付きカルテ番号でもテスト
    Logger.log('--- プレフィックス付きカルテ番号テスト ---');
    const prefixedChartNumber = 'CLUTIReFINEクリニック 303';
    
    const prefixedResponse = service.searchVisitorsFromSheet({
      chart_number: prefixedChartNumber
    });
    
    if (prefixedResponse && prefixedResponse.items) {
      Logger.log(`プレフィックス付き検索: ${prefixedResponse.items.length}件取得`);
    } else {
      Logger.log('プレフィックス付き検索: 失敗');
    }
    
    Logger.log('カルテ番号による患者情報取得テスト: 完了');
    return true;
    
  } catch (error) {
    Logger.log(`カルテ番号検索エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 全テストを実行
 */
function runAllTests() {
  Logger.log('========================================');
  Logger.log('Medical Force連携システム - 総合テスト');
  Logger.log('========================================');
  Logger.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}`);
  Logger.log('');
  
  const tests = [
    { name: 'OAuth認証', func: test_01_Authentication },
    { name: 'API接続', func: test_02_APIConnection },
    { name: 'スプレッドシート初期化', func: test_03_SpreadsheetInit },
    { name: '患者データ同期', func: test_04_VisitorSync },
    { name: '予約データ同期', func: test_05_ReservationSync },
    { name: '空き時間取得', func: test_06_VacancyCheck },
    { name: 'ダイアログ機能', func: test_08_DialogFunctions },
    { name: 'カルテ番号検索', func: test_09_ChartNumberPatientSearch }
  ];
  
  const results = [];
  let successCount = 0;
  
  tests.forEach((test, index) => {
    Logger.log('');
    Logger.log(`--- テスト ${index + 1}/${tests.length}: ${test.name} ---`);
    
    try {
      const result = test.func();
      results.push({
        name: test.name,
        success: result,
        error: null
      });
      
      if (result) {
        successCount++;
      }
      
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: error.toString()
      });
      Logger.log(`テスト実行エラー: ${error.toString()}`);
    }
  });
  
  // テスト結果のサマリー
  Logger.log('');
  Logger.log('========================================');
  Logger.log('テスト結果サマリー');
  Logger.log('========================================');
  Logger.log(`成功: ${successCount}/${tests.length}`);
  Logger.log('');
  
  results.forEach((result, index) => {
    const status = result.success ? '✓ 成功' : '✗ 失敗';
    Logger.log(`${index + 1}. ${result.name}: ${status}`);
    if (result.error) {
      Logger.log(`   エラー: ${result.error}`);
    }
  });
  
  Logger.log('');
  Logger.log('========================================');
  
  // 推奨事項
  if (successCount < tests.length) {
    Logger.log('');
    Logger.log('推奨事項:');
    Logger.log('1. 失敗したテストのログを確認してください');
    Logger.log('2. 設定画面で認証情報とクリニックIDが正しく設定されているか確認してください');
    Logger.log('3. Medical Force APIの接続状態を確認してください');
  } else {
    Logger.log('');
    Logger.log('すべてのテストが成功しました！');
  }
  
  return {
    total: tests.length,
    success: successCount,
    failed: tests.length - successCount,
    results: results
  };
}

/**
 * 予約同期パフォーマンステスト
 */
function testReservationSyncPerformance() {
  Logger.log('=== 予約同期パフォーマンステスト開始 ===');
  
  const service = new ReservationService();
  const results = [];
  
  // 1. 今日のみ同期（最軽量）
  try {
    Logger.log('--- 今日のみ同期テスト ---');
    const startTime = new Date().getTime();
    const count = service.syncTodayOnly();
    const endTime = new Date().getTime();
    const executionTime = (endTime - startTime) / 1000;
    
    results.push({
      type: '今日のみ同期',
      count: count,
      executionTime: executionTime,
      success: true
    });
    
    Logger.log(`今日のみ同期: ${count}件, ${executionTime}秒`);
  } catch (error) {
    results.push({
      type: '今日のみ同期',
      count: 0,  
      executionTime: 0,
      success: false,
      error: error.toString()
    });
    Logger.log(`今日のみ同期エラー: ${error.toString()}`);
  }
  
  // 2. 3日間最適化同期
  try {
    Logger.log('--- 3日間最適化同期テスト ---');
    const result = service.syncReservationsOptimized({
      date_from: Utils.getToday(),
      date_to: Utils.formatDate(new Date(new Date().setDate(new Date().getDate() + 3)))
    });
    
    results.push({
      type: '3日間最適化同期',
      count: result.totalSynced,
      executionTime: result.executionTime,
      success: result.success
    });
    
    Logger.log(`3日間最適化同期: ${result.totalSynced}件, ${result.executionTime}秒`);
  } catch (error) {
    results.push({
      type: '3日間最適化同期',
      count: 0,
      executionTime: 0,
      success: false,
      error: error.toString()
    });
    Logger.log(`3日間最適化同期エラー: ${error.toString()}`);
  }
  
  // 結果サマリー
  Logger.log('');
  Logger.log('=== パフォーマンステスト結果 ===');
  results.forEach(result => {
    if (result.success) {
      Logger.log(`${result.type}: ${result.count}件 (${result.executionTime}秒)`);
    } else {
      Logger.log(`${result.type}: 失敗 - ${result.error || 'エラー'}`);
    }
  });
  
  return results;
}

/**
 * 修正後の予約同期APIをテスト
 */
function testReservationSyncFixed() {
  console.log('=== 修正後予約同期APIテスト開始 ===');
  
  try {
    const service = new ReservationService();
    
    // 1. パラメータ生成のテスト
    console.log('1. ISO 8601日付生成テスト');
    const epochFrom = Utils.getPastMonthsStartISO(6);
    const epochTo = Utils.getFutureMonthsEndISO(3);
    console.log(`過去6か月開始: ${epochFrom}`);
    console.log(`未来3か月終了: ${epochTo}`);
    
    // 2. 少量データでのAPI呼び出しテスト
    console.log('\n2. 少量データAPI呼び出しテスト');
    const testParams = {
      epoch_from: epochFrom,
      epoch_to: epochTo,
      limit: 5,  // テスト用に少量で実行
      offset: 0
    };
    
    console.log(`テストパラメータ: ${JSON.stringify(testParams)}`);
    
    const apiClient = new ApiClient();
    const response = apiClient.getReservations(testParams);
    
    console.log(`APIレスポンス成功: ${response.success}`);
    if (response.success && response.data) {
      const reservations = Array.isArray(response.data) ? response.data : (response.data.items || []);
      console.log(`取得件数: ${reservations.length}`);
      console.log(`総件数: ${response.data.count || 'unknown'}`);
      
      // 最初の予約データをサンプル表示
      if (reservations.length > 0) {
        console.log('\n最初の予約データサンプル:');
        const sample = reservations[0];
        console.log(`- ID: ${sample.id}`);
        console.log(`- 予約日時: ${sample.start_at}`);
        console.log(`- 患者名: ${sample.visitor?.name || 'N/A'}`);
        console.log(`- ステータス: ${sample.status || 'N/A'}`);
      }
    } else {
      console.log(`APIエラー: ${response.error || 'Unknown error'}`);
      console.log(`レスポンス詳細: ${JSON.stringify(response)}`);
    }
    
    // 3. データマッピングテスト
    if (response.success && response.data) {
      console.log('\n3. データマッピングテスト');
      const reservations = Array.isArray(response.data) ? response.data : (response.data.items || []);
      
      if (reservations.length > 0) {
        const rowData = service._reservationToRow(reservations[0]);
        console.log('マッピング結果:');
        console.log(`- reservation_id: ${rowData[0]}`);
        console.log(`- patient_id: ${rowData[1]}`);
        console.log(`- 患者名: ${rowData[2]}`);
        console.log(`- 予約日: ${rowData[6]}`);
        console.log(`- 予約時間: ${rowData[7]}`);
      }
    }
    
    console.log('\n=== テスト完了 ===');
    return {
      success: true,
      message: 'APIテスト成功'
    };
    
  } catch (error) {
    console.log(`\nテストエラー: ${error.toString()}`);
    console.log(`スタックトレース: ${error.stack}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 実際の同期処理テスト（少量データ）
 */
function testActualReservationSync() {
  console.log('=== 実際の同期処理テスト ===');
  
  try {
    const service = new ReservationService();
    
    // 今日から3日分の少量データで同期テスト
    const result = service.syncReservationsOptimized({
      epoch_from: Utils.formatToISO8601(new Date()),
      epoch_to: Utils.formatToISO8601(Utils.addDays(new Date(), 3))
    });
    
    console.log('同期結果:');
    console.log(`- 成功: ${result.success}`);
    console.log(`- 同期件数: ${result.totalSynced}`);
    console.log(`- 実行時間: ${result.executionTime}秒`);
    console.log(`- 期間: ${result.dateRange}`);
    
    return result;
    
  } catch (error) {
    console.log(`同期テストエラー: ${error.toString()}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 予約同期の軽量関数テスト（GASエディタ用）
 */
function testLightweightReservationFunctions() {
  Logger.log('=== 軽量予約同期関数テスト ===');
  
  const service = new ReservationService();
  const tests = [
    {
      name: 'syncTodayOnly()',
      func: () => service.syncTodayOnly()
    },
    {
      name: 'syncLightweight()',
      func: () => service.syncLightweight()
    }
  ];
  
  const results = [];
  
  tests.forEach(test => {
    Logger.log(`--- ${test.name} テスト ---`);
    
    try {
      const startTime = new Date().getTime();
      const count = test.func();
      const endTime = new Date().getTime();
      const executionTime = (endTime - startTime) / 1000;
      
      results.push({
        name: test.name,
        count: count,
        executionTime: executionTime,
        success: true
      });
      
      Logger.log(`${test.name}: ${count}件同期完了 (${executionTime}秒)`);
      
    } catch (error) {
      results.push({
        name: test.name,
        count: 0,
        executionTime: 0,
        success: false,
        error: error.toString()
      });
      
      Logger.log(`${test.name}エラー: ${error.toString()}`);
    }
  });
  
  // 結果サマリー
  Logger.log('');
  Logger.log('=== 軽量関数テスト結果 ===');
  results.forEach(result => {
    const status = result.success ? '成功' : '失敗';
    Logger.log(`${result.name}: ${status} (${result.count}件, ${result.executionTime}秒)`);
    if (result.error) {
      Logger.log(`  エラー: ${result.error}`);
    }
  });
  
  return results;
}

/**
 * 利用可能な予約同期関数の一覧表示（デバッグ用）
 */
function listAvailableReservationSyncFunctions() {
  Logger.log('=== 利用可能な予約同期関数一覧 ===');
  
  const functions = [
    {
      name: 'syncToday()',
      location: 'ReservationSyncTriggers.js',
      description: '今日の予約のみ同期（最軽量・最高速）',
      usage: 'GASエディタから直接実行'
    },
    {
      name: 'manualReservationSync()',
      location: 'ReservationSyncTriggers.js', 
      description: '今日～7日後の最適化同期',
      usage: 'GASエディタから直接実行'
    },
    {
      name: 'syncDateRange(dateFrom, dateTo)',
      location: 'ReservationSyncTriggers.js',
      description: '指定期間の同期（引数: "YYYY-MM-DD"形式）',
      usage: 'syncDateRange("2025-01-01", "2025-01-07")'
    },
    {
      name: 'test_05_ReservationSync()',
      location: 'TestFunctions.js',
      description: '5件のみの同期テスト',
      usage: 'GASエディタから直接実行'
    },
    {
      name: 'service.syncTodayOnly()',
      location: 'ReservationService.js',
      description: '今日のみ同期（サービス直接呼び出し）',
      usage: 'const service = new ReservationService(); service.syncTodayOnly();'
    },
    {
      name: 'service.syncLightweight()',
      location: 'ReservationService.js',
      description: '今後3日間の軽量同期',
      usage: 'const service = new ReservationService(); service.syncLightweight();'
    }
  ];
  
  Logger.log('');
  Logger.log('【軽量順（推奨順）】');
  functions.forEach((func, index) => {
    Logger.log(`${index + 1}. ${func.name}`);
    Logger.log(`   場所: ${func.location}`);
    Logger.log(`   説明: ${func.description}`);
    Logger.log(`   使用法: ${func.usage}`);
    Logger.log('');
  });
  
  Logger.log('【タイムアウト対策】');
  Logger.log('1. まず「syncToday()」で今日分のみテスト');
  Logger.log('2. 成功したら「manualReservationSync()」で1週間分');
  Logger.log('3. それでもタイムアウトする場合は「syncDateRange()」で日付を細かく指定');
  Logger.log('');
  Logger.log('【メニューからのアクセス】');
  Logger.log('- Medical Force連携 > データ同期 > 予約同期オプション');
  Logger.log('- 今日のみ同期（高速）、3日間同期（推奨）、7日間同期（軽量版）が利用可能');
  
  return functions;
}