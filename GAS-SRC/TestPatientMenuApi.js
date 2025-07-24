/**
 * 患者メニューAPIのテスト関数
 */

/**
 * handleGetPatientMenus関数を直接テストする
 */
function testHandleGetPatientMenus() {
  Logger.log('=== testHandleGetPatientMenus 開始 ===');
  
  const testPatientId = '1b5c5936-3e03-4a02-b81a-4032c7330906';
  
  try {
    Logger.log(`テスト患者ID: ${testPatientId}`);
    
    // handleGetPatientMenus関数を直接呼び出し
    const result = handleGetPatientMenus(testPatientId);
    
    Logger.log('実行結果:');
    Logger.log(JSON.stringify(result, null, 2));
    
    if (result.status === 'error') {
      Logger.log('❌ エラーが発生しました');
      Logger.log(`エラーコード: ${result.error.code}`);
      Logger.log(`エラーメッセージ: ${result.error.message}`);
      Logger.log(`詳細: ${result.error.details}`);
    } else {
      Logger.log('✅ 成功しました');
      Logger.log(`患者名: ${result.data.patient_name}`);
      Logger.log(`メニュー数: ${result.data.total_count}`);
      
      if (result.data.menus && result.data.menus.length > 0) {
        Logger.log('メニュー一覧:');
        result.data.menus.forEach((menu, index) => {
          Logger.log(`[${index + 1}] ${menu.name}`);
          Logger.log(`  カテゴリ: ${menu.category}`);
          Logger.log(`  初回: ${menu.is_first_time ? 'はい' : 'いいえ'}`);
          Logger.log(`  使用回数: ${menu.usage_count}`);
        });
      }
    }
    
  } catch (error) {
    Logger.log('❌ 予期しないエラーが発生しました');
    Logger.log(`エラー: ${error.toString()}`);
    Logger.log(`スタックトレース: ${error.stack}`);
  }
  
  Logger.log('=== testHandleGetPatientMenus 終了 ===');
}

/**
 * 各サービスクラスの存在確認
 */
function testServiceClasses() {
  Logger.log('=== testServiceClasses 開始 ===');
  
  // クラスの存在チェック
  const classes = [
    'VisitorService',
    'MenuService',
    'Utils',
    'ApiClient',
    'Config',
    'SpreadsheetManager',
    'DocumentManagerService'
  ];
  
  classes.forEach(className => {
    try {
      const exists = typeof eval(className) !== 'undefined';
      Logger.log(`${className}: ${exists ? '✅ 存在' : '❌ 存在しない'}`);
      
      if (exists) {
        // インスタンス作成を試みる
        try {
          const instance = new (eval(className))();
          Logger.log(`  → インスタンス作成: ✅ 成功`);
        } catch (e) {
          Logger.log(`  → インスタンス作成: ❌ 失敗 - ${e.toString()}`);
        }
      }
    } catch (e) {
      Logger.log(`${className}: ❌ エラー - ${e.toString()}`);
    }
  });
  
  // 関数の存在チェック
  const functions = [
    'handleGetPatientMenus',
    'getPatientReservationHistory',
    'aggregateMenuUsage',
    'filterMenusByUsageHistory'
  ];
  
  Logger.log('\n関数の存在チェック:');
  functions.forEach(funcName => {
    try {
      const exists = typeof eval(funcName) === 'function';
      Logger.log(`${funcName}: ${exists ? '✅ 存在' : '❌ 存在しない'}`);
    } catch (e) {
      Logger.log(`${funcName}: ❌ エラー - ${e.toString()}`);
    }
  });
  
  Logger.log('=== testServiceClasses 終了 ===');
}

/**
 * Utilsクラスのメソッドテスト
 */
function testUtilsMethods() {
  Logger.log('=== testUtilsMethods 開始 ===');
  
  try {
    // getTodayのテスト
    const today = Utils.getToday();
    Logger.log(`Utils.getToday(): ${today}`);
    
    // subtractMonthsのテスト
    const sixMonthsAgo = Utils.subtractMonths(today, 6);
    Logger.log(`Utils.subtractMonths(${today}, 6): ${sixMonthsAgo}`);
    
    // formatDateのテスト
    const now = new Date();
    const formatted = Utils.formatDate(now);
    Logger.log(`Utils.formatDate(new Date()): ${formatted}`);
    
  } catch (error) {
    Logger.log(`❌ エラー: ${error.toString()}`);
    Logger.log(`スタックトレース: ${error.stack}`);
  }
  
  Logger.log('=== testUtilsMethods 終了 ===');
}

/**
 * 予約履歴取得のテスト
 */
function testGetPatientReservationHistory() {
  Logger.log('=== testGetPatientReservationHistory 開始 ===');
  
  const testPatientId = '1b5c5936-3e03-4a02-b81a-4032c7330906';
  const sixMonthsAgo = Utils.subtractMonths(Utils.getToday(), 6);
  
  try {
    Logger.log(`患者ID: ${testPatientId}`);
    Logger.log(`開始日: ${sixMonthsAgo}`);
    
    const history = getPatientReservationHistory(testPatientId, sixMonthsAgo);
    
    Logger.log(`取得件数: ${history.length}`);
    
    if (history.length > 0) {
      Logger.log('最初の3件:');
      history.slice(0, 3).forEach((item, index) => {
        Logger.log(`[${index + 1}] ${item.date} - ${item.menu_name}`);
      });
    }
    
  } catch (error) {
    Logger.log(`❌ エラー: ${error.toString()}`);
    Logger.log(`スタックトレース: ${error.stack}`);
  }
  
  Logger.log('=== testGetPatientReservationHistory 終了 ===');
}