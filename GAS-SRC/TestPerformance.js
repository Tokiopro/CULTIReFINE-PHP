/**
 * パフォーマンス改善のテストスクリプト
 */

/**
 * キャッシュ機能のテスト
 */
function testCompanyCache() {
  console.log('=== キャッシュ機能テスト開始 ===');
  
  // 1. 初回読み込み（キャッシュミス）
  console.time('初回読み込み');
  const result1 = getCompaniesForDialog();
  console.timeEnd('初回読み込み');
  console.log(`初回読み込み結果: ${result1.success ? '成功' : '失敗'}, 件数: ${result1.data ? result1.data.length : 0}`);
  
  // 2. 2回目読み込み（キャッシュヒット）
  console.time('2回目読み込み（キャッシュ）');
  const result2 = getCompaniesForDialog();
  console.timeEnd('2回目読み込み（キャッシュ）');
  console.log(`2回目読み込み結果: ${result2.success ? '成功' : '失敗'}, 件数: ${result2.data ? result2.data.length : 0}`);
  
  // 3. キャッシュ無効化
  companyCacheService.invalidateCompaniesCache();
  console.log('キャッシュを無効化しました');
  
  // 4. 3回目読み込み（キャッシュミス）
  console.time('3回目読み込み（無効化後）');
  const result3 = getCompaniesForDialog();
  console.timeEnd('3回目読み込み（無効化後）');
  console.log(`3回目読み込み結果: ${result3.success ? '成功' : '失敗'}, 件数: ${result3.data ? result3.data.length : 0}`);
  
  console.log('=== キャッシュ機能テスト完了 ===');
}

/**
 * 患者名軽量キャッシュのテスト
 */
function testPatientNamesCache() {
  console.log('=== 患者名キャッシュテスト開始 ===');
  
  // 1. 初回読み込み
  console.time('患者名初回読み込み');
  const patients1 = getAllVisitorsForCompanyFromDialog();
  console.timeEnd('患者名初回読み込み');
  console.log(`初回読み込み件数: ${patients1 ? patients1.length : 0}`);
  
  // 2. キャッシュからの読み込み
  console.time('患者名キャッシュ読み込み');
  const patients2 = getAllVisitorsForCompanyFromDialog();
  console.timeEnd('患者名キャッシュ読み込み');
  console.log(`キャッシュ読み込み件数: ${patients2 ? patients2.length : 0}`);
  
  console.log('=== 患者名キャッシュテスト完了 ===');
}

/**
 * バッチ更新のテスト
 */
function testBatchUpdate() {
  console.log('=== バッチ更新テスト開始 ===');
  
  const service = new CompanyVisitorService();
  const testCompanyId = 'TEST_COMPANY_001';
  
  // テスト用の変更データ
  const changes = [
    {
      action: 'add',
      data: {
        visitorId: 'TEST_VISITOR_001',
        visitorName: 'テスト患者1',
        memberType: '本会員',
        position: '社長'
      }
    },
    {
      action: 'add',
      data: {
        visitorId: 'TEST_VISITOR_002',
        visitorName: 'テスト患者2',
        memberType: 'サブ会員',
        position: '秘書'
      }
    }
  ];
  
  try {
    // バッチ更新実行
    console.time('バッチ更新');
    const result = service.batchUpdateCompanyVisitors(testCompanyId, changes);
    console.timeEnd('バッチ更新');
    
    console.log('バッチ更新結果:', result);
    
    // クリーンアップ（テストデータを削除）
    const cleanupChanges = [
      { action: 'remove', data: { visitorId: 'TEST_VISITOR_001' } },
      { action: 'remove', data: { visitorId: 'TEST_VISITOR_002' } }
    ];
    
    console.time('クリーンアップ');
    service.batchUpdateCompanyVisitors(testCompanyId, cleanupChanges);
    console.timeEnd('クリーンアップ');
    
  } catch (error) {
    console.error('バッチ更新エラー:', error);
  }
  
  console.log('=== バッチ更新テスト完了 ===');
}

/**
 * 全テストを実行
 */
function runAllPerformanceTests() {
  console.log('==== パフォーマンステスト開始 ====');
  
  testCompanyCache();
  console.log('');
  
  testPatientNamesCache();
  console.log('');
  
  testBatchUpdate();
  
  console.log('==== パフォーマンステスト完了 ====');
}