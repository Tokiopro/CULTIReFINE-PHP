/**
 * LINE ID同期機能のテスト
 */

/**
 * LINE ID同期の単体テスト
 */
function testLineIdSync() {
  console.log('=== LINE ID同期テスト開始 ===');
  console.log('実行時刻: ' + new Date().toISOString());
  
  try {
    // VisitorServiceのインスタンスを作成
    const visitorService = new VisitorService();
    
    // VisitorServiceが正しく初期化されているか確認
    console.log('✅ VisitorServiceのインスタンスが作成されました');
    
    // シートの存在確認
    try {
      const sheet = Utils.getOrCreateSheet(Config.getSheetNames().visitors);
      if (!sheet) {
        console.log('❌ 患者マスターシートが見つかりません');
        return false;
      }
      console.log('✅ 患者マスターシートを取得できました');
      
      // シートの情報を表示
      const lastRow = sheet.getLastRow();
      const lastColumn = sheet.getLastColumn();
      console.log(`シート情報: ${lastRow}行 × ${lastColumn}列`);
      
      if (lastRow > 0) {
        const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
        console.log('ヘッダー: ' + headers.join(', '));
        
        // 必要な列の確認
        const patientCodeIndex = headers.indexOf('患者コード');
        const lineIdIndex = headers.indexOf('LINE_ID');
        
        if (patientCodeIndex === -1) {
          console.log('❌ 患者コード列が見つかりません');
          return false;
        }
        console.log(`✅ 患者コード列: ${patientCodeIndex + 1}列目`);
        
        if (lineIdIndex === -1) {
          console.log('❌ LINE_ID列が見つかりません');
          return false;
        }
        console.log(`✅ LINE_ID列: ${lineIdIndex + 1}列目`);
      }
      
    } catch (sheetError) {
      console.log('❌ シート取得エラー: ' + sheetError.toString());
      return false;
    }
    
    // LINE ID同期を実行（少数のデータでテスト）
    console.log('\nLINE ID同期を実行中...');
    const updatedCount = visitorService.syncLineConnectionInfo();
    
    console.log(`✅ LINE ID同期完了: ${updatedCount}件更新`);
    return true;
    
  } catch (error) {
    console.log('❌ テスト中にエラーが発生しました:');
    console.log('エラー: ' + error.toString());
    console.log('スタックトレース: ' + error.stack);
    return false;
  }
}

/**
 * SpreadsheetManagerの動作確認
 */
function testSpreadsheetManager() {
  console.log('=== SpreadsheetManager動作確認 ===');
  
  try {
    // SpreadsheetManagerを直接作成
    const spreadsheetManager = new SpreadsheetManager();
    console.log('✅ SpreadsheetManagerのインスタンス作成成功');
    
    // SHEETS設定の確認
    const sheets = Config.getSheetNames();
    console.log('利用可能なシート:');
    Object.keys(sheets).forEach(key => {
      console.log(`  - ${key}: ${sheets[key]}`);
    });
    
    // 患者マスターシートの取得
    const visitorSheetName = sheets.visitors || '患者マスター';
    console.log(`\n患者マスターシート名: ${visitorSheetName}`);
    
    const sheet = Utils.getOrCreateSheet(visitorSheetName);
    if (sheet) {
      console.log('✅ シート取得成功');
      console.log(`  シート名: ${sheet.getName()}`);
      console.log(`  行数: ${sheet.getLastRow()}`);
      console.log(`  列数: ${sheet.getLastColumn()}`);
    } else {
      console.log('❌ シート取得失敗');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ エラー: ' + error.toString());
    return false;
  }
}

/**
 * すべてのテストを実行
 */
function runAllLineIdSyncTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       LINE ID同期機能テスト              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  
  let allTestsPassed = true;
  
  // 各テストを実行
  const tests = [
    { name: 'SpreadsheetManager動作確認', fn: testSpreadsheetManager },
    { name: 'LINE ID同期テスト', fn: testLineIdSync }
  ];
  
  tests.forEach((test, index) => {
    console.log(`\n[テスト ${index + 1}/${tests.length}] ${test.name}`);
    console.log('─'.repeat(50));
    
    const passed = test.fn();
    if (!passed) {
      allTestsPassed = false;
    }
    
    console.log('');
  });
  
  // 結果サマリー
  console.log('═'.repeat(50));
  if (allTestsPassed) {
    console.log('✅ すべてのテストが成功しました！');
  } else {
    console.log('❌ 一部のテストが失敗しました');
  }
  
  return allTestsPassed;
}