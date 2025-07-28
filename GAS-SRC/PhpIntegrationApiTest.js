/**
 * PHP統合APIのテスト関数
 * 
 * GASエディタから直接実行して動作確認を行う
 */

/**
 * APIキー認証のテスト
 */
function testPhpApiKeyValidation() {
  Logger.log('=== PHP API キー認証テスト ===');
  
  // テスト用のモックリクエスト
  const validRequest = {
    parameter: {
      authorization: 'Bearer test_api_key_123'
    }
  };
  
  const invalidRequest = {
    parameter: {
      authorization: 'Bearer invalid_key'
    }
  };
  
  const noAuthRequest = {
    parameter: {}
  };
  
  // スクリプトプロパティにテスト用APIキーを設定
  const scriptProperties = PropertiesService.getScriptProperties();
  const originalKeys = scriptProperties.getProperty('PHP_API_KEYS');
  scriptProperties.setProperty('PHP_API_KEYS', 'test_api_key_123,test_api_key_456');
  
  try {
    // 有効なキーのテスト
    const validResult = validatePhpApiKey(validRequest);
    Logger.log('有効なキーのテスト: ' + (validResult ? '成功' : '失敗'));
    
    // 無効なキーのテスト
    const invalidResult = validatePhpApiKey(invalidRequest);
    Logger.log('無効なキーのテスト: ' + (!invalidResult ? '成功' : '失敗'));
    
    // 認証なしのテスト
    const noAuthResult = validatePhpApiKey(noAuthRequest);
    Logger.log('認証なしのテスト: ' + (!noAuthResult ? '成功' : '失敗'));
    
  } finally {
    // 元の設定を復元
    if (originalKeys) {
      scriptProperties.setProperty('PHP_API_KEYS', originalKeys);
    } else {
      scriptProperties.deleteProperty('PHP_API_KEYS');
    }
  }
}

/**
 * LINE IDからのユーザー情報取得テスト
 */
function testGetPhpUserByLineId() {
  Logger.log('=== LINE IDからのユーザー情報取得テスト ===');
  
  // テスト用のLINE ID（実際のデータに存在するものを使用）
  const testLineId = 'U423d10aeba6ed5e5b0cf420435dbab3b';
  
  try {
    const userInfo = getPhpUserByLineId(testLineId);
    
    if (userInfo) {
      Logger.log('ユーザー情報取得成功:');
      Logger.log('  ID: ' + userInfo.id);
      Logger.log('  名前: ' + userInfo.name);
      Logger.log('  LINE ID: ' + userInfo.line_user_id);
      Logger.log('  メール: ' + userInfo.email);
      Logger.log('  電話: ' + userInfo.phone);
      Logger.log('  LINE表示名: ' + userInfo.line_display_name);
      Logger.log('  登録日時: ' + userInfo.created_at);
    } else {
      Logger.log('ユーザーが見つかりません');
    }
    
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
  }
}

/**
 * 統合API全体のテスト
 */
function testGetUserFullInfoByLineId() {
  Logger.log('=== 統合API全体テスト ===');
  
  // テスト用のLINE ID
  const testLineId = 'U423d10aeba6ed5e5b0cf420435dbab3b';
  
  try {
    const result = getUserFullInfoByLineId(testLineId);
    
    if (result.status === 'success') {
      Logger.log('API呼び出し成功');
      
      // ユーザー情報
      Logger.log('\n--- ユーザー情報 ---');
      Logger.log('名前: ' + result.data.user.name);
      Logger.log('LINE ID: ' + result.data.user.line_user_id);
      
      // 患者情報
      Logger.log('\n--- 患者情報 ---');
      const patientInfo = result.data.patient_info;
      if (patientInfo) {
        Logger.log('カナ: ' + patientInfo.kana);
        Logger.log('生年月日: ' + patientInfo.birth_date);
        Logger.log('性別: ' + patientInfo.gender);
        Logger.log('初診日: ' + patientInfo.first_visit_date);
        Logger.log('最終来院日: ' + patientInfo.last_visit_date);
      }
      
      // 施術履歴
      Logger.log('\n--- 施術履歴 ---');
      Logger.log('履歴件数: ' + result.data.treatment_history.length);
      result.data.treatment_history.slice(0, 3).forEach((treatment, index) => {
        Logger.log(`${index + 1}. ${treatment.treatment_name} (${treatment.treatment_date})`);
      });
      
      // 今後の予約
      Logger.log('\n--- 今後の予約 ---');
      Logger.log('予約件数: ' + result.data.upcoming_reservations.length);
      result.data.upcoming_reservations.forEach((reservation, index) => {
        Logger.log(`${index + 1}. ${reservation.treatment_name} - ${reservation.reservation_date} ${reservation.reservation_time}`);
      });
      
      // 会員情報
      Logger.log('\n--- 会員情報 ---');
      const membership = result.data.membership_info;
      Logger.log('会員: ' + (membership.is_member ? 'はい' : 'いいえ'));
      if (membership.is_member) {
        Logger.log('会員種別: ' + membership.member_type);
        Logger.log('会社名: ' + membership.company_name);
        Logger.log('役職: ' + membership.position);
        if (membership.ticket_balance) {
          Logger.log('幹細胞チケット残高: ' + membership.ticket_balance.stem_cell);
          Logger.log('施術チケット残高: ' + membership.ticket_balance.treatment);
          Logger.log('点滴チケット残高: ' + membership.ticket_balance.drip);
        }
      }
      
      // 統計情報
      Logger.log('\n--- 統計情報 ---');
      const stats = result.data.statistics;
      Logger.log('総来院回数: ' + stats.total_visits);
      Logger.log('過去30日来院回数: ' + stats.last_30_days_visits);
      Logger.log('よく受ける施術: ' + stats.favorite_treatment);
      
    } else {
      Logger.log('API呼び出し失敗');
      Logger.log('エラーコード: ' + result.error.code);
      Logger.log('エラーメッセージ: ' + result.error.message);
    }
    
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
  }
}

/**
 * APIエンドポイントのルーティングテスト
 */
function testPhpApiRouting() {
  Logger.log('=== APIルーティングテスト ===');
  
  // テストケース
  const testCases = [
    {
      path: 'api/users/line/U423d10aeba6ed5e5b0cf420435dbab3b/full',
      expected: 'success'
    },
    {
      path: 'api/users/line/invalid_user_id/full',
      expected: 'error'
    },
    {
      path: 'api/invalid/path',
      expected: 'error'
    },
    {
      path: '',
      expected: 'error'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    const request = {
      parameter: {
        path: testCase.path
      }
    };
    
    try {
      const result = routePhpApiRequest(request);
      const success = result.status === testCase.expected;
      
      Logger.log(`テストケース${index + 1}: ${testCase.path}`);
      Logger.log(`  期待値: ${testCase.expected}`);
      Logger.log(`  結果: ${result.status}`);
      Logger.log(`  判定: ${success ? '成功' : '失敗'}`);
      
      if (!success) {
        Logger.log(`  詳細: ${JSON.stringify(result)}`);
      }
      
    } catch (error) {
      Logger.log(`テストケース${index + 1}: エラー - ${error.toString()}`);
    }
  });
}

/**
 * PHP統合APIの初期設定
 */
function setupPhpIntegration() {
  Logger.log('=== PHP統合API 初期設定 ===');
  
  try {
    // 1. 患者マスタシートの初期化
    Logger.log('患者マスタシートを初期化中...');
    SpreadsheetManager.initializeVisitorsSheet();
    Logger.log('患者マスタシートの初期化完了（LINE表示名、LINEプロフィール画像URL列を追加）');
    
    // 2. スクリプトプロパティの確認
    const scriptProperties = PropertiesService.getScriptProperties();
    const phpApiKeys = scriptProperties.getProperty('PHP_API_KEYS');
    
    if (!phpApiKeys) {
      Logger.log('警告: PHP_API_KEYS が設定されていません');
      Logger.log('プロジェクトの設定 > スクリプトプロパティ で PHP_API_KEYS を設定してください');
    } else {
      Logger.log('PHP_API_KEYS 設定済み');
    }
    
    Logger.log('\n=== 初期設定完了 ===');
    Logger.log('次のステップ:');
    Logger.log('1. プロジェクトの設定で PHP_API_KEYS を設定（未設定の場合）');
    Logger.log('2. runAllPhpApiTests() でAPIテストを実行');
    
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
  }
}

/**
 * 全テストを実行
 */
function runAllPhpApiTests() {
  Logger.log('===== PHP統合API 全テスト実行 =====\n');
  
  // APIキー認証テスト
  testPhpApiKeyValidation();
  Logger.log('\n');
  
  // ユーザー情報取得テスト
  testGetPhpUserByLineId();
  Logger.log('\n');
  
  // ルーティングテスト
  testPhpApiRouting();
  Logger.log('\n');
  
  // 統合APIテスト
  testGetUserFullInfoByLineId();
  
  Logger.log('\n===== 全テスト完了 =====');
}

/**
 * 特定のLINE IDでのテスト（デバッグ用）
 */
function testSpecificLineId() {
  // ここに実際のLINE IDを入力してテスト
  const lineId = 'U423d10aeba6ed5e5b0cf420435dbab3b'; // 実際のIDに置き換え
  
  Logger.log('=== 特定LINE IDテスト開始 ===');
  Logger.log(`対象LINE ID: ${lineId}`);
  
  const result = getUserFullInfoByLineId(lineId);
  Logger.log('=== テスト結果 ===');
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * チケット残高問題のデバッグ専用関数
 */
function debugTicketBalanceIssue() {
  const lineId = 'U423d10aeba6ed5e5b0cf420435dbab3b';
  
  Logger.log('=== チケット残高問題デバッグ開始 ===');
  Logger.log(`対象LINE ID: ${lineId}`);
  
  try {
    // ステップ1: ユーザー情報取得
    Logger.log('\n--- ステップ1: ユーザー情報取得 ---');
    const userInfo = getPhpUserByLineId(lineId);
    if (!userInfo) {
      Logger.log('エラー: ユーザーが見つかりません');
      return;
    }
    Logger.log(`ユーザー情報: ${JSON.stringify(userInfo, null, 2)}`);
    
    const visitorId = userInfo.id;
    Logger.log(`visitor_id: ${visitorId}`);
    
    // ステップ2: 会員情報取得
    Logger.log('\n--- ステップ2: 会員情報取得 ---');
    const membershipInfo = getPhpMembershipInfo(visitorId);
    Logger.log(`会員情報: ${JSON.stringify(membershipInfo, null, 2)}`);
    
    if (membershipInfo.is_member) {
      const companyId = membershipInfo.company_id;
      Logger.log(`\n--- ステップ3: チケット残高詳細調査（会社ID: ${companyId}） ---`);
      
      // チケット残高シートの直接確認
      const ticketSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
        .getSheetByName('チケット残高');
      
      if (ticketSheet) {
        const data = ticketSheet.getDataRange().getValues();
        Logger.log(`チケット残高シート行数: ${data.length}`);
        Logger.log(`ヘッダー: ${JSON.stringify(data[0])}`);
        
        // 該当会社IDのデータを全て表示
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === companyId) {
            Logger.log(`会社ID ${companyId} のデータ（行${i}）: ${JSON.stringify(data[i])}`);
          }
        }
        
        // 現在月のデータ確認
        const currentMonth = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM');
        Logger.log(`現在月: ${currentMonth}`);
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === companyId && data[i][1] === currentMonth) {
            Logger.log(`現在月のデータ発見: ${JSON.stringify(data[i])}`);
          }
        }
      } else {
        Logger.log('エラー: チケット残高シートが見つかりません');
      }
      
      // ステップ4: チケット残高関数の直接テスト
      Logger.log('\n--- ステップ4: getPhpTicketBalance関数テスト ---');
      const ticketBalance = getPhpTicketBalance(companyId);
      Logger.log(`チケット残高結果: ${JSON.stringify(ticketBalance, null, 2)}`);
    } else {
      Logger.log('このユーザーは会員ではありません');
    }
    
  } catch (error) {
    Logger.log(`デバッグエラー: ${error.toString()}`);
    Logger.log(`スタック: ${error.stack}`);
  }
  
  Logger.log('=== デバッグ完了 ===');
}