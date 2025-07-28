/**
 * 会社別来院者シートのLINE連携デバッグ用関数
 */

/**
 * updateLinkedInfo関数のテスト
 * 指定したvisitor_idでLINE情報を更新できるかテスト
 */
function testUpdateLinkedInfo() {
  Logger.log('=== updateLinkedInfo テスト開始 ===');
  
  // テスト用のパラメータ（実際の値に置き換えてください）
  const testVisitorId = 'TEST001'; // 実際のvisitor_idに置き換え
  const testLineId = 'U1234567890abcdef'; // テスト用LINE ID
  const testDisplayName = 'テストユーザー';
  
  try {
    const service = new CompanyLineLinkService();
    service.updateLinkedInfo(testVisitorId, testLineId, testDisplayName);
    Logger.log('テスト完了');
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
  }
}

/**
 * 会社別来院者シートのデータ構造を確認
 */
function checkCompanyVisitorsSheet() {
  Logger.log('=== 会社別来院者シート構造確認 ===');
  
  try {
    const sheetName = Config.getSheetNames().companyVisitors;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`エラー: ${sheetName}シートが見つかりません`);
      return;
    }
    
    // ヘッダー行を確認
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('ヘッダー行:');
    headers.forEach((header, index) => {
      Logger.log(`列${index + 1} (${String.fromCharCode(65 + index)}列): ${header}`);
    });
    
    // データ行数を確認
    const lastRow = sheet.getLastRow();
    Logger.log(`データ行数: ${lastRow - 1}行（ヘッダー除く）`);
    
    // visitor_id列の位置を確認
    const visitorIdIndex = headers.indexOf('visitor_id');
    const lineIdIndex = headers.indexOf('LINE_ID');
    const lineDisplayNameIndex = headers.indexOf('LINE表示名');
    
    Logger.log(`visitor_id列: ${visitorIdIndex + 1} (${visitorIdIndex >= 0 ? String.fromCharCode(65 + visitorIdIndex) + '列' : '見つかりません'})`);
    Logger.log(`LINE_ID列: ${lineIdIndex + 1} (${lineIdIndex >= 0 ? String.fromCharCode(65 + lineIdIndex) + '列' : '見つかりません'})`);
    Logger.log(`LINE表示名列: ${lineDisplayNameIndex + 1} (${lineDisplayNameIndex >= 0 ? String.fromCharCode(65 + lineDisplayNameIndex) + '列' : '見つかりません'})`);
    
    // サンプルデータを表示（最初の5行）
    if (lastRow > 1) {
      Logger.log('\n=== サンプルデータ（最初の5行） ===');
      const sampleRows = Math.min(5, lastRow - 1);
      const data = sheet.getRange(2, 1, sampleRows, sheet.getLastColumn()).getValues();
      
      data.forEach((row, index) => {
        Logger.log(`行${index + 2}:`);
        if (visitorIdIndex >= 0) {
          Logger.log(`  visitor_id: "${row[visitorIdIndex]}" (型: ${typeof row[visitorIdIndex]})`);
        }
        if (lineIdIndex >= 0) {
          Logger.log(`  LINE_ID: "${row[lineIdIndex]}" (型: ${typeof row[lineIdIndex]})`);
        }
        if (lineDisplayNameIndex >= 0) {
          Logger.log(`  LINE表示名: "${row[lineDisplayNameIndex]}" (型: ${typeof row[lineDisplayNameIndex]})`);
        }
      });
    }
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
  }
}

/**
 * LINE会員連携管理シートの内容を確認
 */
function checkLineMemberLinkSheet() {
  Logger.log('=== LINE会員連携管理シート確認 ===');
  
  try {
    const sheetName = 'LINE会員連携管理';
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`エラー: ${sheetName}シートが見つかりません`);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    Logger.log('ヘッダー行:');
    headers.forEach((header, index) => {
      Logger.log(`列${index + 1}: ${header}`);
    });
    
    // 最新の5件のデータを表示
    Logger.log('\n=== 最新の5件のデータ ===');
    const startRow = Math.max(1, data.length - 5);
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      const memberNumberIndex = headers.indexOf('会員番号');
      const statusIndex = headers.indexOf('ステータス');
      const lineIdIndex = headers.indexOf('LINE_ID');
      
      Logger.log(`行${i + 1}:`);
      Logger.log(`  会員番号: "${row[memberNumberIndex]}" (型: ${typeof row[memberNumberIndex]})`);
      Logger.log(`  ステータス: ${row[statusIndex]}`);
      Logger.log(`  LINE_ID: ${row[lineIdIndex]}`);
    }
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
  }
}

/**
 * 特定のvisitor_idを検索
 * GASエディタから実行: searchSpecificVisitorId()
 */
function searchSpecificVisitorId() {
  // 検索対象のvisitor_id
  const targetVisitorId = '45e9a511-ba78-4b21-9535-9154d5740846';
  searchVisitorId(targetVisitorId);
}

/**
 * 特定のvisitor_idを検索
 */
function searchVisitorId(visitorId) {
  Logger.log(`=== visitor_id "${visitorId}" の検索 ===`);
  
  try {
    const service = new CompanyLineLinkService();
    const sheet = service.sheet;
    
    if (!sheet) {
      Logger.log('エラー: シートが取得できません');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const visitorIdColumn = 2; // C列（0ベース）
    
    let found = false;
    for (let i = 1; i < data.length; i++) {
      const sheetVisitorId = data[i][visitorIdColumn];
      
      // 様々な比較方法でチェック
      if (sheetVisitorId === visitorId ||
          String(sheetVisitorId) === String(visitorId) ||
          String(sheetVisitorId).trim() === String(visitorId).trim()) {
        Logger.log(`見つかりました！ 行${i + 1}`);
        Logger.log(`  シートの値: "${sheetVisitorId}" (型: ${typeof sheetVisitorId})`);
        Logger.log(`  検索値: "${visitorId}" (型: ${typeof visitorId})`);
        Logger.log(`  LINE_ID: "${data[i][4]}"`);
        Logger.log(`  LINE表示名: "${data[i][12]}"`);
        found = true;
      }
    }
    
    if (!found) {
      Logger.log('visitor_idが見つかりませんでした');
      
      // 部分一致で再検索
      Logger.log('\n部分一致での検索:');
      for (let i = 1; i < data.length; i++) {
        const sheetVisitorId = String(data[i][visitorIdColumn]);
        if (sheetVisitorId.includes(visitorId) || visitorId.includes(sheetVisitorId)) {
          Logger.log(`部分一致: 行${i + 1} - "${sheetVisitorId}"`);
        }
      }
    }
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
  }
}