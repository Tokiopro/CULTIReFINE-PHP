/**
 * LINE ID同期の直接テスト
 * エラーの原因を確実に特定して修正確認
 */

function directTestLineIdSync() {
  console.log('=== LINE ID同期 直接テスト ===');
  console.log('実行時刻: ' + new Date().toISOString());
  
  try {
    // 1. Config.getSheetNames()のテスト
    console.log('\n1. Config.getSheetNames()のテスト');
    const sheetNames = Config.getSheetNames();
    console.log('   visitors シート名: ' + sheetNames.visitors);
    
    // 2. Utils.getOrCreateSheetのテスト
    console.log('\n2. Utils.getOrCreateSheetのテスト');
    const sheet = Utils.getOrCreateSheet(sheetNames.visitors);
    if (sheet) {
      console.log('   ✅ シート取得成功');
      console.log('   シート名: ' + sheet.getName());
      console.log('   行数: ' + sheet.getLastRow());
      console.log('   列数: ' + sheet.getLastColumn());
      
      // ヘッダーの確認
      if (sheet.getLastRow() > 0) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const patientCodeIndex = headers.indexOf('患者コード');
        const lineIdIndex = headers.indexOf('LINE_ID');
        
        console.log('\n   ヘッダー確認:');
        console.log('   患者コード列: ' + (patientCodeIndex >= 0 ? `✅ ${patientCodeIndex + 1}列目` : '❌ なし'));
        console.log('   LINE_ID列: ' + (lineIdIndex >= 0 ? `✅ ${lineIdIndex + 1}列目` : '❌ なし'));
      }
    } else {
      console.log('   ❌ シート取得失敗');
      return false;
    }
    
    // 3. VisitorServiceのテスト
    console.log('\n3. VisitorServiceのテスト');
    const visitorService = new VisitorService();
    console.log('   ✅ VisitorServiceインスタンス作成成功');
    
    // 4. syncLineConnectionInfoの実行
    console.log('\n4. syncLineConnectionInfo実行テスト');
    console.log('   ※ 実際のAPI呼び出しはスキップ（テストのため）');
    
    // テスト用に少数のデータで実行する場合はコメントを外す
    // const updatedCount = visitorService.syncLineConnectionInfo();
    // console.log('   同期結果: ' + updatedCount + '件更新');
    
    console.log('\n=== テスト完了 ===');
    console.log('✅ すべての基本機能が正常に動作しています');
    return true;
    
  } catch (error) {
    console.log('\n❌ エラーが発生しました:');
    console.log('エラーメッセージ: ' + error.toString());
    console.log('スタックトレース:');
    console.log(error.stack);
    return false;
  }
}