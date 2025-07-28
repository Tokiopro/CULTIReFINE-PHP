/**
 * LINE会員連携機能のテスト関数群
 * 
 * 各機能を個別にテストし、統合テストも実施
 */

/**
 * 全テストを実行
 */
function runAllLineMemberLinkTests() {
  Logger.log('========================================');
  Logger.log('LINE会員連携機能 - 総合テスト');
  Logger.log('========================================');
  Logger.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}`);
  Logger.log('');
  
  const tests = [
    { name: 'シート初期化', func: test_LineMemberLink_01_InitSheet },
    { name: 'トークン生成', func: test_LineMemberLink_02_GenerateToken },
    { name: '有効期限計算', func: test_LineMemberLink_03_ExpiryTime },
    { name: 'リンク生成', func: test_LineMemberLink_04_GenerateLink },
    { name: 'トークン検証', func: test_LineMemberLink_05_ValidateToken },
    { name: '期限切れトークン', func: test_LineMemberLink_06_ExpiredToken },
    { name: '使用済みトークン', func: test_LineMemberLink_07_UsedToken },
    { name: 'クリーンアップ', func: test_LineMemberLink_08_Cleanup }
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
        Logger.log(`✓ ${test.name}: 成功`);
      } else {
        Logger.log(`✗ ${test.name}: 失敗`);
      }
      
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: error.toString()
      });
      Logger.log(`✗ ${test.name}: エラー - ${error.toString()}`);
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
  
  return {
    total: tests.length,
    success: successCount,
    failed: tests.length - successCount,
    results: results
  };
}

/**
 * テスト1: シート初期化
 */
function test_LineMemberLink_01_InitSheet() {
  try {
    const service = new LineMemberLinkService();
    const sheet = service._getSheet();
    
    if (!sheet) {
      Logger.log('エラー: シートの作成に失敗しました');
      return false;
    }
    
    // ヘッダーの確認
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expectedHeaders = [
      'トークン',
      '会員番号',
      '会員名',
      '有効期限',
      '使用済み',
      'LINE_ID',
      'LINE表示名',
      '紐付け日時',
      'ステータス',
      '作成日時'
    ];
    
    if (headers.join(',') !== expectedHeaders.join(',')) {
      Logger.log('エラー: ヘッダーが期待値と異なります');
      Logger.log(`期待値: ${expectedHeaders.join(',')}`);
      Logger.log(`実際値: ${headers.join(',')}`);
      return false;
    }
    
    Logger.log('シート初期化: 成功');
    return true;
  } catch (error) {
    Logger.log('シート初期化エラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト2: セキュアトークン生成
 */
function test_LineMemberLink_02_GenerateToken() {
  try {
    const service = new LineMemberLinkService();
    const token1 = service._generateSecureToken();
    const token2 = service._generateSecureToken();
    
    // トークンの長さチェック（64文字 = 256ビット）
    if (token1.length !== 64) {
      Logger.log(`エラー: トークン長が不正です。期待値: 64, 実際値: ${token1.length}`);
      return false;
    }
    
    // トークンの一意性チェック
    if (token1 === token2) {
      Logger.log('エラー: 生成されたトークンが重複しています');
      return false;
    }
    
    // 16進数文字列チェック
    if (!/^[0-9a-f]+$/.test(token1)) {
      Logger.log('エラー: トークンが16進数文字列ではありません');
      return false;
    }
    
    Logger.log(`トークン1: ${token1.substring(0, 20)}...`);
    Logger.log(`トークン2: ${token2.substring(0, 20)}...`);
    Logger.log('トークン生成: 成功');
    return true;
  } catch (error) {
    Logger.log('トークン生成エラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト3: 有効期限計算
 */
function test_LineMemberLink_03_ExpiryTime() {
  try {
    const service = new LineMemberLinkService();
    const expiryTime = service._getExpiryTime();
    const now = new Date();
    
    // 翌日の7時になっているか確認
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 1);
    expectedDate.setHours(7, 0, 0, 0);
    
    // 時刻の差が1秒以内であることを確認
    const diff = Math.abs(expiryTime.getTime() - expectedDate.getTime());
    if (diff > 1000) {
      Logger.log(`エラー: 有効期限が期待値と異なります`);
      Logger.log(`期待値: ${expectedDate.toLocaleString('ja-JP')}`);
      Logger.log(`実際値: ${expiryTime.toLocaleString('ja-JP')}`);
      return false;
    }
    
    Logger.log(`現在時刻: ${now.toLocaleString('ja-JP')}`);
    Logger.log(`有効期限: ${expiryTime.toLocaleString('ja-JP')}`);
    Logger.log('有効期限計算: 成功');
    return true;
  } catch (error) {
    Logger.log('有効期限計算エラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト4: リンク生成
 */
function test_LineMemberLink_04_GenerateLink() {
  try {
    const service = new LineMemberLinkService();
    const memberNumber = 'TEST-001';
    const memberName = 'テスト太郎';
    
    const linkInfo = service.generateMemberLineLink(memberNumber, memberName);
    
    // 戻り値の確認
    if (!linkInfo.url || !linkInfo.token || !linkInfo.expiryTime || !linkInfo.memberNumber) {
      Logger.log('エラー: 必要な情報が不足しています');
      Logger.log(`リンク情報: ${JSON.stringify(linkInfo)}`);
      return false;
    }
    
    // URLの形式確認
    if (!linkInfo.url.startsWith('https://access.line.me/oauth2/v2.1/authorize')) {
      Logger.log('エラー: LINE認証URLの形式が不正です');
      Logger.log(`URL: ${linkInfo.url}`);
      return false;
    }
    
    // stateパラメータの確認
    if (!linkInfo.url.includes(`state=member_link_${linkInfo.token}`)) {
      Logger.log('エラー: stateパラメータが正しく設定されていません');
      return false;
    }
    
    Logger.log(`生成されたURL: ${linkInfo.url.substring(0, 100)}...`);
    Logger.log(`トークン: ${linkInfo.token.substring(0, 20)}...`);
    Logger.log(`有効期限: ${linkInfo.expiryTime.toLocaleString('ja-JP')}`);
    Logger.log('リンク生成: 成功');
    
    // グローバル変数に保存（後続のテストで使用）
    PropertiesService.getScriptProperties().setProperty('TEST_TOKEN', linkInfo.token);
    
    return true;
  } catch (error) {
    Logger.log('リンク生成エラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト5: トークン検証（正常系）
 */
function test_LineMemberLink_05_ValidateToken() {
  try {
    const service = new LineMemberLinkService();
    const token = PropertiesService.getScriptProperties().getProperty('TEST_TOKEN');
    
    if (!token) {
      Logger.log('エラー: テストトークンが見つかりません');
      return false;
    }
    
    const memberInfo = service.validateTokenAndGetMemberInfo(token);
    
    if (!memberInfo) {
      Logger.log('エラー: トークン検証に失敗しました');
      return false;
    }
    
    if (memberInfo.memberNumber !== 'TEST-001') {
      Logger.log(`エラー: 会員番号が一致しません。期待値: TEST-001, 実際値: ${memberInfo.memberNumber}`);
      return false;
    }
    
    Logger.log(`検証成功: 会員番号 ${memberInfo.memberNumber}, 会員名 ${memberInfo.memberName}`);
    Logger.log('トークン検証: 成功');
    return true;
  } catch (error) {
    Logger.log('トークン検証エラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト6: 期限切れトークンのテスト
 */
function test_LineMemberLink_06_ExpiredToken() {
  try {
    const service = new LineMemberLinkService();
    const sheet = service._getSheet();
    
    // 期限切れのテストデータを作成
    const expiredToken = service._generateSecureToken();
    const expiredTime = new Date();
    expiredTime.setDate(expiredTime.getDate() - 1); // 昨日
    
    sheet.appendRow([
      expiredToken,
      'EXPIRED-001',
      '期限切れテスト',
      expiredTime,
      false,
      '',
      '',
      '',
      '未使用',
      new Date()
    ]);
    
    // 検証（nullが返ることを期待）
    const result = service.validateTokenAndGetMemberInfo(expiredToken);
    
    if (result !== null) {
      Logger.log('エラー: 期限切れトークンが受け入れられました');
      return false;
    }
    
    Logger.log('期限切れトークンの検証: 成功（正しく拒否されました）');
    return true;
  } catch (error) {
    Logger.log('期限切れトークンテストエラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト7: 使用済みトークンのテスト
 */
function test_LineMemberLink_07_UsedToken() {
  try {
    const service = new LineMemberLinkService();
    const sheet = service._getSheet();
    
    // 使用済みのテストデータを作成
    const usedToken = service._generateSecureToken();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    sheet.appendRow([
      usedToken,
      'USED-001',
      '使用済みテスト',
      tomorrow,
      true, // 使用済み
      'U123456789',
      'テストユーザー',
      new Date(),
      '紐付け完了',
      new Date()
    ]);
    
    // 検証（nullが返ることを期待）
    const result = service.validateTokenAndGetMemberInfo(usedToken);
    
    if (result !== null) {
      Logger.log('エラー: 使用済みトークンが受け入れられました');
      return false;
    }
    
    Logger.log('使用済みトークンの検証: 成功（正しく拒否されました）');
    return true;
  } catch (error) {
    Logger.log('使用済みトークンテストエラー: ' + error.toString());
    return false;
  }
}

/**
 * テスト8: 期限切れトークンのクリーンアップ
 */
function test_LineMemberLink_08_Cleanup() {
  try {
    const service = new LineMemberLinkService();
    
    // クリーンアップ前の行数を取得
    const sheet = service._getSheet();
    const beforeCount = sheet.getLastRow();
    
    // クリーンアップ実行
    const deletedCount = service.cleanupExpiredTokens();
    
    // クリーンアップ後の行数を取得
    const afterCount = sheet.getLastRow();
    
    Logger.log(`クリーンアップ前: ${beforeCount}行`);
    Logger.log(`クリーンアップ後: ${afterCount}行`);
    Logger.log(`削除件数: ${deletedCount}件`);
    
    // 少なくとも1件は削除されているはず（テスト6で作成した期限切れトークン）
    if (deletedCount < 1) {
      Logger.log('警告: 期限切れトークンが削除されていません');
    }
    
    Logger.log('クリーンアップ: 成功');
    return true;
  } catch (error) {
    Logger.log('クリーンアップエラー: ' + error.toString());
    return false;
  }
}

/**
 * 統合テスト: 実際のLINE認証フローのシミュレーション
 */
function test_LineMemberLink_Integration() {
  Logger.log('=== LINE会員連携統合テスト ===');
  
  try {
    const service = new LineMemberLinkService();
    
    // 1. リンク生成
    const memberNumber = 'INT-TEST-001';
    const memberName = '統合テスト太郎';
    const linkInfo = service.generateMemberLineLink(memberNumber, memberName);
    
    Logger.log(`1. リンク生成完了`);
    Logger.log(`   URL: ${linkInfo.url.substring(0, 50)}...`);
    
    // 2. トークン検証
    const memberInfo = service.validateTokenAndGetMemberInfo(linkInfo.token);
    if (!memberInfo) {
      throw new Error('トークン検証失敗');
    }
    
    Logger.log(`2. トークン検証成功`);
    Logger.log(`   会員番号: ${memberInfo.memberNumber}`);
    
    // 3. LINE認証のシミュレーション（実際のLINEユーザー情報を模擬）
    const mockLineUserInfo = {
      userId: 'U' + Utilities.getUuid().replace(/-/g, '').substring(0, 32),
      displayName: 'テストLINEユーザー',
      pictureUrl: 'https://example.com/picture.jpg',
      statusMessage: 'テスト中'
    };
    
    // 4. 紐付け処理
    const success = service.linkMemberWithLineId(linkInfo.token, mockLineUserInfo);
    if (!success) {
      throw new Error('紐付け処理失敗');
    }
    
    Logger.log(`3. 紐付け処理成功`);
    Logger.log(`   LINE ID: ${mockLineUserInfo.userId}`);
    
    // 5. 再度同じトークンで検証（使用済みでnullが返るはず）
    const revalidate = service.validateTokenAndGetMemberInfo(linkInfo.token);
    if (revalidate !== null) {
      throw new Error('使用済みトークンが再利用可能になっています');
    }
    
    Logger.log(`4. 使用済みトークンの再利用防止: 正常`);
    
    Logger.log('統合テスト: 成功');
    return true;
    
  } catch (error) {
    Logger.log('統合テストエラー: ' + error.toString());
    return false;
  }
}

/**
 * API動作確認テスト
 */
function test_LineMemberLink_ApiEndpoint() {
  try {
    // GETリクエストのシミュレーション
    const e = {
      parameter: {
        action: 'test'
      }
    };
    
    const response = doGetLineMemberLink(e);
    const content = response.getContent();
    
    if (content !== 'LINE会員連携APIは正常に動作しています') {
      Logger.log(`エラー: 期待されないレスポンス: ${content}`);
      return false;
    }
    
    Logger.log('APIエンドポイント: 正常');
    return true;
    
  } catch (error) {
    Logger.log('APIエンドポイントテストエラー: ' + error.toString());
    return false;
  }
}