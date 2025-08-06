/**
 * LINE ID配列同期機能のテスト
 * line_ids配列フィールドが正しく処理されることを確認
 */

/**
 * LINE ID配列処理のテスト
 */
function testLineIdArraySync() {
  console.log('=== LINE ID配列同期テスト開始 ===');
  console.log('実行時刻: ' + new Date().toISOString());
  
  try {
    // VisitorServiceのインスタンスを作成
    const visitorService = new VisitorService();
    console.log('✅ VisitorServiceのインスタンスが作成されました');
    
    // テスト用のvisitorデータを作成（line_ids配列を含む）
    const testVisitors = [
      {
        visitor_id: 'test001',
        visitor_name: 'テスト太郎',
        line_ids: ['LINE_USER_123456'],  // 配列形式
        email: 'test1@example.com'
      },
      {
        visitor_id: 'test002',
        visitor_name: 'テスト花子',
        line_id: 'LINE_USER_789012',  // 従来の単一フィールド
        email: 'test2@example.com'
      },
      {
        visitor_id: 'test003',
        visitor_name: 'テスト次郎',
        line_ids: ['LINE_USER_345678', 'LINE_USER_901234'],  // 複数のLINE ID
        email: 'test3@example.com'
      },
      {
        visitor_id: 'test004',
        visitor_name: 'テスト三郎',
        line_ids: [],  // 空の配列
        email: 'test4@example.com'
      }
    ];
    
    console.log('\n=== テストデータの処理 ===');
    testVisitors.forEach((visitor, index) => {
      console.log(`\nテストケース ${index + 1}: ${visitor.visitor_name}`);
      
      // line_ids配列の処理をシミュレート
      let lineId = '';
      if (visitor.line_ids && Array.isArray(visitor.line_ids) && visitor.line_ids.length > 0) {
        lineId = visitor.line_ids[0];
        console.log(`  ✅ line_ids配列から取得: ${lineId}`);
        console.log(`     配列全体: ${JSON.stringify(visitor.line_ids)}`);
      } else if (visitor.line_id) {
        lineId = visitor.line_id;
        console.log(`  ✅ line_idフィールドから取得: ${lineId}`);
      } else if (visitor.line_ids && Array.isArray(visitor.line_ids) && visitor.line_ids.length === 0) {
        console.log(`  ⚠️ line_ids配列が空です`);
      } else {
        console.log(`  ❌ LINE IDが見つかりません`);
      }
      
      if (lineId) {
        console.log(`  最終的なLINE ID: ${lineId}`);
      }
    });
    
    // 実際のAPI呼び出しテスト（少数のデータ）
    console.log('\n=== 実際のAPI同期テスト ===');
    console.log('患者情報を同期中（過去1日分）...');
    
    try {
      const syncedCount = visitorService.syncVisitors(1);  // 過去1日分のみ
      console.log(`✅ 同期完了: ${syncedCount}件の患者を処理`);
      
      // シートからLINE IDの存在を確認
      const sheet = Utils.getOrCreateSheet(Config.getSheetNames().visitors);
      if (sheet && sheet.getLastRow() > 1) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const lineIdIndex = headers.indexOf('LINE_ID');
        
        if (lineIdIndex >= 0) {
          const lineIdColumn = sheet.getRange(2, lineIdIndex + 1, Math.min(5, sheet.getLastRow() - 1), 1).getValues();
          let lineIdCount = 0;
          
          console.log('\n最初の5件のLINE ID状態:');
          lineIdColumn.forEach((row, index) => {
            const hasLineId = row[0] && row[0].toString().trim() !== '';
            if (hasLineId) lineIdCount++;
            console.log(`  行${index + 2}: ${hasLineId ? '✅ LINE IDあり: ' + row[0] : '❌ LINE IDなし'}`);
          });
          
          console.log(`\nLINE ID保有率: ${lineIdCount}/${lineIdColumn.length}件`);
        }
      }
      
      return true;
    } catch (syncError) {
      console.log('❌ 同期エラー: ' + syncError.toString());
      return false;
    }
    
  } catch (error) {
    console.log('❌ テスト中にエラーが発生しました:');
    console.log('エラー: ' + error.toString());
    console.log('スタックトレース: ' + error.stack);
    return false;
  }
}

/**
 * _findFieldValueメソッドの動作確認
 */
function testFindFieldValue() {
  console.log('=== _findFieldValue メソッドテスト ===');
  
  try {
    const visitorService = new VisitorService();
    
    // テストデータ
    const testData = [
      {
        name: 'line_ids配列（要素あり）',
        obj: { line_ids: ['LINE_USER_111111'] },
        expected: 'LINE_USER_111111'
      },
      {
        name: 'line_ids配列（複数要素）',
        obj: { line_ids: ['LINE_USER_222222', 'LINE_USER_333333'] },
        expected: 'LINE_USER_222222'
      },
      {
        name: 'line_ids配列（空）',
        obj: { line_ids: [] },
        expected: ''
      },
      {
        name: 'line_id単一フィールド',
        obj: { line_id: 'LINE_USER_444444' },
        expected: 'LINE_USER_444444'
      },
      {
        name: '両方存在（line_ids優先）',
        obj: { line_ids: ['LINE_USER_555555'], line_id: 'LINE_USER_666666' },
        expected: 'LINE_USER_555555'
      }
    ];
    
    console.log('\nテストケース実行:');
    let allPassed = true;
    
    testData.forEach((test, index) => {
      const result = visitorService._findFieldValue(test.obj, 'LINE_ID');
      const passed = result === test.expected;
      
      console.log(`${index + 1}. ${test.name}`);
      console.log(`   入力: ${JSON.stringify(test.obj)}`);
      console.log(`   期待値: ${test.expected}`);
      console.log(`   結果: ${result}`);
      console.log(`   ${passed ? '✅ 成功' : '❌ 失敗'}`);
      
      if (!passed) allPassed = false;
    });
    
    return allPassed;
    
  } catch (error) {
    console.log('❌ エラー: ' + error.toString());
    return false;
  }
}

/**
 * すべてのテストを実行
 */
function runAllLineIdArrayTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    LINE ID配列処理機能テスト             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  
  let allTestsPassed = true;
  
  // 各テストを実行
  const tests = [
    { name: '_findFieldValue動作確認', fn: testFindFieldValue },
    { name: 'LINE ID配列同期テスト', fn: testLineIdArraySync }
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
    console.log('LINE ID配列（line_ids）の処理が正しく動作しています。');
  } else {
    console.log('❌ 一部のテストが失敗しました');
  }
  
  return allTestsPassed;
}