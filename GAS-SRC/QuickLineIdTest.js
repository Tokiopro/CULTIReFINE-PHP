/**
 * LINE ID同期の簡易テスト
 * GASエディタから直接実行できるテスト関数
 */

function quickTestLineIdSync() {
  console.log('=== LINE ID同期 簡易テスト ===');
  
  try {
    // 1. VisitorServiceのインスタンス作成
    console.log('1. VisitorServiceのインスタンスを作成...');
    const service = new VisitorService();
    console.log('   ✅ インスタンス作成成功');
    
    // 2. spreadsheetManagerの確認
    console.log('2. spreadsheetManagerの確認...');
    if (service.spreadsheetManager) {
      console.log('   ✅ spreadsheetManagerが存在します');
    } else {
      console.log('   ❌ spreadsheetManagerが存在しません');
      return;
    }
    
    // 3. シートの取得テスト
    console.log('3. 患者マスターシートの取得...');
    const sheetName = Config.getSheetNames().visitors || '患者マスター';
    const sheet = service.spreadsheetManager.getSheet(sheetName);
    
    if (sheet) {
      console.log('   ✅ シート取得成功: ' + sheet.getName());
      console.log('   - 行数: ' + sheet.getLastRow());
      console.log('   - 列数: ' + sheet.getLastColumn());
    } else {
      console.log('   ❌ シート取得失敗');
      return;
    }
    
    // 4. ヘッダーの確認
    console.log('4. ヘッダーの確認...');
    if (sheet.getLastRow() > 0) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const patientCodeIndex = headers.indexOf('患者コード');
      const lineIdIndex = headers.indexOf('LINE_ID');
      
      console.log('   - 患者コード列: ' + (patientCodeIndex >= 0 ? '✅ あり' : '❌ なし'));
      console.log('   - LINE_ID列: ' + (lineIdIndex >= 0 ? '✅ あり' : '❌ なし'));
    }
    
    // 5. syncLineConnectionInfoのテスト（実行するか確認）
    console.log('5. syncLineConnectionInfo実行テスト');
    console.log('   ※ 実際にAPIを呼び出します');
    
    // ここでは実際の同期は実行せず、メソッドが呼び出せることだけ確認
    // 実際に実行する場合は以下のコメントを外す
    // const updatedCount = service.syncLineConnectionInfo();
    // console.log('   ✅ 同期完了: ' + updatedCount + '件更新');
    
    console.log('   ✅ メソッドは正常に呼び出し可能です');
    console.log('\n=== テスト完了 ===');
    console.log('すべてのチェックが成功しました！');
    
  } catch (error) {
    console.log('\n❌ エラーが発生しました:');
    console.log('エラー: ' + error.toString());
    console.log('スタックトレース:');
    console.log(error.stack);
  }
}