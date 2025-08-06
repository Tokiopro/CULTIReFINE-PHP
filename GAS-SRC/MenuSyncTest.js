/**
 * メニュー同期機能のテスト
 * Medical Force APIのメニューエンドポイントをテスト
 */

/**
 * メニューAPI取得のテスト（少数件）
 */
function testGetMenusFromAPI() {
  console.log('=== メニューAPI取得テスト開始 ===');
  
  try {
    const apiClient = new ApiClient();
    
    // 少数件のメニューを取得してテスト
    console.log('メニューを取得中（10件）...');
    const response = apiClient.getMenus({
      per_page: 10,
      page: 1,
      sort_column: 'name',
      order: 'ASC'
    });
    
    console.log('レスポンス:', JSON.stringify(response, null, 2));
    
    if (response.success) {
      const menus = response.data.items || [];
      const totalCount = response.data.count || 0;
      
      console.log(`✅ メニュー取得成功！`);
      console.log(`取得件数: ${menus.length}件 / 全${totalCount}件`);
      
      // 最初の3件のメニューを表示
      if (menus.length > 0) {
        console.log('\n取得したメニューのサンプル:');
        menus.slice(0, 3).forEach((menu, index) => {
          console.log(`${index + 1}. ${menu.name || menu.title || '名称不明'}`);
          if (menu.id) {
            console.log(`   ID: ${menu.id}`);
          }
          if (menu.description) {
            console.log(`   説明: ${menu.description.substring(0, 50)}...`);
          }
          if (menu.is_collaborated !== undefined) {
            console.log(`   連携済み: ${menu.is_collaborated}`);
          }
        });
      }
      
      return true;
    } else {
      console.log('❌ メニュー取得失敗');
      console.log('エラー:', response.error);
      return false;
    }
    
  } catch (error) {
    console.log('❌ エラーが発生しました:', error.toString());
    console.log('スタックトレース:', error.stack);
    return false;
  }
}

/**
 * メニュー同期のテスト（全件取得）
 */
function testSyncMenus() {
  console.log('=== メニュー同期テスト開始 ===');
  
  try {
    const service = new MenuService();
    
    console.log('メニュー同期を実行中...');
    const syncedCount = service.syncMenus();
    
    console.log(`✅ メニュー同期成功！`);
    console.log(`同期件数: ${syncedCount}件`);
    
    // スプレッドシートからデータを確認
    const sheet = Utils.getOrCreateSheet('メニュー管理');
    const lastRow = sheet.getLastRow();
    
    console.log(`スプレッドシート行数: ${lastRow}行`);
    
    if (lastRow > 1) {
      // ヘッダーと最初の数件のデータを確認
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      console.log('\nヘッダー:', headers.join(', '));
      
      const sampleData = sheet.getRange(2, 1, Math.min(3, lastRow - 1), sheet.getLastColumn()).getValues();
      console.log('\nサンプルデータ:');
      sampleData.forEach((row, index) => {
        const menuId = row[headers.indexOf('menu_id')];
        const menuName = row[headers.indexOf('メニュー名')];
        const category = row[headers.indexOf('カテゴリ')];
        console.log(`${index + 1}. ${menuName} (ID: ${menuId}, カテゴリ: ${category})`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ エラーが発生しました:', error.toString());
    console.log('スタックトレース:', error.stack);
    return false;
  }
}

/**
 * clinic_idのヘッダー送信をテスト
 */
function testClinicIdHeader() {
  console.log('=== clinic_idヘッダーテスト開始 ===');
  
  try {
    // clinic_idを取得
    const clinicId = Config.getClinicId();
    console.log(`使用するclinic_id: ${clinicId}`);
    
    // ApiClientの内部メソッドをテスト
    const apiClient = new ApiClient();
    
    // ヘッダーを確認
    const headersWithClinicId = apiClient._getHeadersWithClinicId(clinicId);
    console.log('\n生成されたヘッダー:');
    Object.keys(headersWithClinicId).forEach(key => {
      if (key === 'Authorization') {
        console.log(`  ${key}: Bearer [ACCESS_TOKEN]`);
      } else {
        console.log(`  ${key}: ${headersWithClinicId[key]}`);
      }
    });
    
    // 実際にAPIを呼び出してテスト
    console.log('\n実際のAPI呼び出しをテスト...');
    const response = apiClient.getMenus({
      per_page: 1,
      page: 1
    });
    
    if (response.success) {
      console.log('✅ API呼び出し成功！clinic_idが正しくヘッダーに設定されています。');
      return true;
    } else {
      console.log('❌ API呼び出し失敗:', response.error);
      return false;
    }
    
  } catch (error) {
    console.log('❌ エラーが発生しました:', error.toString());
    console.log('スタックトレース:', error.stack);
    return false;
  }
}

/**
 * すべてのメニューテストを実行
 */
function runAllMenuTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    Medical Force メニューAPI テスト      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`テスト開始時刻: ${new Date().toLocaleString('ja-JP')}`);
  
  let allTestsPassed = true;
  
  // 各テストを実行
  const tests = [
    { name: 'clinic_idヘッダー', fn: testClinicIdHeader },
    { name: 'メニューAPI取得', fn: testGetMenusFromAPI },
    { name: 'メニュー同期', fn: testSyncMenus }
  ];
  
  tests.forEach(test => {
    console.log(`\n${'='.repeat(50)}`);
    const passed = test.fn();
    if (!passed) {
      allTestsPassed = false;
    }
  });
  
  // テスト結果のサマリー
  console.log(`\n${'='.repeat(50)}`);
  console.log('=== テスト結果サマリー ===');
  if (allTestsPassed) {
    console.log('✅ すべてのテストが成功しました！');
  } else {
    console.log('❌ 一部のテストが失敗しました。');
  }
  
  console.log(`\nテスト終了時刻: ${new Date().toLocaleString('ja-JP')}`);
}