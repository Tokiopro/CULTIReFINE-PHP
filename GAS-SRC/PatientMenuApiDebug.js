/**
 * 患者メニューAPIのデバッグ用関数
 */

/**
 * シンプルな患者メニュー取得テスト
 */
function debugGetPatientMenusSimple() {
  const patientId = '1b5c5936-3e03-4a02-b81a-4032c7330906';
  
  try {
    Logger.log('=== debugGetPatientMenusSimple 開始 ===');
    
    // 1. VisitorServiceの確認
    Logger.log('1. VisitorServiceのテスト');
    try {
      const visitorService = new VisitorService();
      Logger.log('  VisitorServiceインスタンス作成: ✅');
      
      // 患者情報を取得してみる（APIコールのテスト）
      // const visitor = visitorService.getVisitorById(patientId);
      // Logger.log(`  患者情報取得: ${visitor ? '✅' : '❌'}`);
      
      // スプレッドシートから直接取得してみる
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('患者マスタ');
      if (sheet) {
        Logger.log('  患者マスタシート: ✅');
        const data = sheet.getDataRange().getValues();
        Logger.log(`  データ行数: ${data.length}`);
      } else {
        Logger.log('  患者マスタシート: ❌ 見つかりません');
      }
    } catch (e) {
      Logger.log(`  エラー: ${e.toString()}`);
    }
    
    // 2. MenuServiceの確認
    Logger.log('\n2. MenuServiceのテスト');
    try {
      const menuService = new MenuService();
      Logger.log('  MenuServiceインスタンス作成: ✅');
      
      const menus = menuService.getMenusFromSheet();
      Logger.log(`  メニュー数: ${menus.length}`);
      
      if (menus.length > 0) {
        Logger.log('  最初のメニュー:');
        Logger.log(`    ID: ${menus[0].menu_id}`);
        Logger.log(`    名前: ${menus[0].name}`);
        Logger.log(`    カテゴリ: ${menus[0].category}`);
        Logger.log(`    有効: ${menus[0].is_active}`);
        Logger.log(`    オンライン: ${menus[0].is_online}`);
      }
    } catch (e) {
      Logger.log(`  エラー: ${e.toString()}`);
    }
    
    // 3. 予約履歴の確認
    Logger.log('\n3. 予約履歴のテスト');
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('予約管理');
      if (sheet) {
        Logger.log('  予約管理シート: ✅');
        const data = sheet.getDataRange().getValues();
        Logger.log(`  データ行数: ${data.length}`);
        
        // ヘッダー確認
        if (data.length > 0) {
          Logger.log('  ヘッダー:');
          data[0].forEach((header, index) => {
            if (header) Logger.log(`    [${index}] ${header}`);
          });
        }
        
        // 該当患者の予約数をカウント
        let count = 0;
        for (let i = 1; i < data.length; i++) {
          if (data[i][1] === patientId) { // visitor_id列
            count++;
          }
        }
        Logger.log(`  患者ID ${patientId} の予約数: ${count}`);
        
      } else {
        Logger.log('  予約管理シート: ❌ 見つかりません');
      }
    } catch (e) {
      Logger.log(`  エラー: ${e.toString()}`);
    }
    
    // 4. Utilsのテスト
    Logger.log('\n4. Utilsのテスト');
    try {
      const today = Utils.getToday();
      Logger.log(`  今日: ${today}`);
      
      const sixMonthsAgo = Utils.subtractMonths(today, 6);
      Logger.log(`  6ヶ月前: ${sixMonthsAgo}`);
    } catch (e) {
      Logger.log(`  エラー: ${e.toString()}`);
    }
    
    // 5. 実際のhandleGetPatientMenus呼び出し
    Logger.log('\n5. handleGetPatientMenusの実行');
    try {
      const result = handleGetPatientMenus(patientId);
      Logger.log('  実行結果:');
      Logger.log(JSON.stringify(result, null, 2));
    } catch (e) {
      Logger.log(`  エラー: ${e.toString()}`);
      Logger.log(`  スタック: ${e.stack}`);
    }
    
    Logger.log('=== debugGetPatientMenusSimple 終了 ===');
    
  } catch (error) {
    Logger.log(`予期しないエラー: ${error.toString()}`);
    Logger.log(`スタック: ${error.stack}`);
  }
}

/**
 * スプレッドシートの構造を確認
 */
function debugCheckSpreadsheetStructure() {
  Logger.log('=== debugCheckSpreadsheetStructure 開始 ===');
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  
  Logger.log(`スプレッドシートID: ${spreadsheet.getId()}`);
  Logger.log(`シート数: ${sheets.length}`);
  Logger.log('\nシート一覧:');
  
  sheets.forEach((sheet, index) => {
    const name = sheet.getName();
    const rows = sheet.getLastRow();
    const cols = sheet.getLastColumn();
    Logger.log(`[${index + 1}] ${name} - ${rows}行 x ${cols}列`);
    
    // 主要なシートのヘッダーを確認
    if (['患者マスタ', '予約管理', 'メニューマスタ'].includes(name) && rows > 0) {
      const headers = sheet.getRange(1, 1, 1, cols).getValues()[0];
      Logger.log(`  ヘッダー: ${headers.filter(h => h).join(', ')}`);
    }
  });
  
  Logger.log('=== debugCheckSpreadsheetStructure 終了 ===');
}

/**
 * 特定の患者の予約履歴を詳細に確認
 */
function debugPatientReservationHistory() {
  const patientId = '1b5c5936-3e03-4a02-b81a-4032c7330906';
  
  Logger.log('=== debugPatientReservationHistory 開始 ===');
  Logger.log(`患者ID: ${patientId}`);
  
  try {
    const sixMonthsAgo = Utils.subtractMonths(Utils.getToday(), 6);
    Logger.log(`検索期間: ${sixMonthsAgo} 〜 ${Utils.getToday()}`);
    
    const history = getPatientReservationHistory(patientId, sixMonthsAgo);
    
    Logger.log(`予約履歴数: ${history.length}`);
    
    if (history.length > 0) {
      Logger.log('\n予約履歴詳細:');
      history.forEach((reservation, index) => {
        Logger.log(`[${index + 1}] ${reservation.date}`);
        Logger.log(`  メニューID: ${reservation.menu_id}`);
        Logger.log(`  メニュー名: ${reservation.menu_name}`);
        if (reservation.menus && reservation.menus.length > 0) {
          Logger.log(`  メニュー配列: ${JSON.stringify(reservation.menus)}`);
        }
      });
    }
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    Logger.log(`スタック: ${error.stack}`);
  }
  
  Logger.log('=== debugPatientReservationHistory 終了 ===');
}