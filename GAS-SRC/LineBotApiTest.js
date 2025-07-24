/**
 * LINE Bot API テストスクリプト
 * 
 * 各アクションのテストを実行して動作確認を行う
 */

/**
 * テストリクエストを生成
 */
function createTestRequest(action, parameters) {
  return {
    version: '1.0',
    requestId: `test_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    source: {
      type: 'line_richmenu',
      userId: 'U1234567890abcdef',
      displayName: 'テストユーザー',
      action: action
    },
    action: {
      type: action,
      parameters: parameters
    },
    context: {
      sessionId: 'test_session',
      previousAction: null,
      userPreferences: {
        language: 'ja',
        timezone: 'Asia/Tokyo'
      }
    }
  };
}

/**
 * テスト実行ユーティリティ
 */
function executeTest(testName, request) {
  Logger.log(`\n========== ${testName} ==========`);
  
  try {
    // リクエストをシミュレート
    const e = {
      postData: {
        contents: JSON.stringify(request)
      }
    };
    
    // APIを呼び出し
    const startTime = new Date().getTime();
    const response = doPostLineBot(e);
    const endTime = new Date().getTime();
    
    // レスポンスを解析
    const responseData = JSON.parse(response.getContent());
    
    Logger.log(`リクエスト: ${JSON.stringify(request, null, 2)}`);
    Logger.log(`レスポンス: ${JSON.stringify(responseData, null, 2)}`);
    Logger.log(`処理時間: ${(endTime - startTime) / 1000}秒`);
    Logger.log(`ステータス: ${responseData.status.success ? '成功' : '失敗'}`);
    
    if (!responseData.status.success) {
      Logger.log(`エラー: ${responseData.status.code} - ${responseData.status.message}`);
    }
    
    return responseData;
    
  } catch (error) {
    Logger.log(`テストエラー: ${error.toString()}`);
    return null;
  }
}

/**
 * 全テストを実行
 */
function runAllLineBotTests() {
  Logger.log('LINE Bot API テストを開始します');
  Logger.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  // 1. 予約枠取得テスト
  testGetAvailableSlots();
  
  // 2. ユーザー予約確認テスト
  testGetUserReservations();
  
  // 3. 診療案内取得テスト
  testGetClinicInfo();
  
  // 4. お問い合わせ情報取得テスト
  testGetContactInfo();
  
  // 5. エラーケーステスト
  testErrorCases();
  
  Logger.log('\n全テスト完了');
}

/**
 * 予約枠取得テスト
 */
function testGetAvailableSlots() {
  // 基本的なリクエスト
  const request1 = createTestRequest('getAvailableSlots', {
    dateRange: {
      from: Utils.getToday(),
      to: Utils.addDays(Utils.getToday(), 7)
    },
    departments: ['内科'],
    timePreference: 'morning',
    maxResults: 5
  });
  
  executeTest('予約枠取得テスト（基本）', request1);
  
  // 全診療科、全時間帯
  const request2 = createTestRequest('getAvailableSlots', {
    dateRange: {
      from: Utils.getToday(),
      to: Utils.addDays(Utils.getToday(), 1)
    },
    departments: [],
    timePreference: 'any',
    maxResults: 10
  });
  
  executeTest('予約枠取得テスト（全診療科）', request2);
}

/**
 * ユーザー予約確認テスト
 */
function testGetUserReservations() {
  // 基本的なリクエスト
  const request1 = createTestRequest('getUserReservations', {
    statusFilter: ['confirmed'],
    includeHistory: false,
    sortBy: 'date_asc'
  });
  
  executeTest('ユーザー予約確認テスト（基本）', request1);
  
  // 履歴を含む全予約
  const request2 = createTestRequest('getUserReservations', {
    statusFilter: [],
    includeHistory: true,
    sortBy: 'date_desc'
  });
  
  executeTest('ユーザー予約確認テスト（履歴含む）', request2);
}

/**
 * 診療案内取得テスト
 */
function testGetClinicInfo() {
  const request = createTestRequest('getClinicInfo', {
    infoType: 'all',
    includeImages: false
  });
  
  executeTest('診療案内取得テスト', request);
}

/**
 * お問い合わせ情報取得テスト
 */
function testGetContactInfo() {
  const request = createTestRequest('getContactInfo', {
    contactType: 'all',
    includeHours: true
  });
  
  executeTest('お問い合わせ情報取得テスト', request);
}

/**
 * エラーケーステスト
 */
function testErrorCases() {
  // 無効なアクション
  const request1 = createTestRequest('invalidAction', {});
  executeTest('エラーテスト（無効なアクション）', request1);
  
  // 必須パラメータ不足
  const request2 = {
    version: '1.0',
    // requestIdが不足
    timestamp: new Date().toISOString(),
    source: {
      type: 'line_richmenu',
      userId: 'U1234567890abcdef'
    },
    action: {
      type: 'getAvailableSlots'
    }
  };
  executeTest('エラーテスト（必須パラメータ不足）', request2);
  
  // 古いタイムスタンプ
  const request3 = createTestRequest('getClinicInfo', {});
  request3.timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10分前
  executeTest('エラーテスト（古いタイムスタンプ）', request3);
}

/**
 * 個別アクションテスト用関数
 */
function testSingleAction(actionType, parameters) {
  const request = createTestRequest(actionType, parameters);
  return executeTest(`個別テスト: ${actionType}`, request);
}

/**
 * スプレッドシート準備状況の確認
 */
function checkLineBotSetup() {
  Logger.log('LINE Bot セットアップチェック');
  
  try {
    const spreadsheetId = Config.getSpreadsheetId();
    const sheet = SpreadsheetApp.openById(spreadsheetId);
    
    // 必要なシートの確認
    const requiredSheets = ['LINEユーザー情報', '診療案内', 'お問い合わせ', 'LINE Bot Logs'];
    const missingSheets = [];
    
    requiredSheets.forEach(sheetName => {
      const targetSheet = sheet.getSheetByName(sheetName);
      if (!targetSheet) {
        missingSheets.push(sheetName);
      } else {
        Logger.log(`✓ ${sheetName}シート: 存在`);
      }
    });
    
    if (missingSheets.length > 0) {
      Logger.log(`\n不足しているシート: ${missingSheets.join(', ')}`);
      
      // 不足シートを作成するか確認
      missingSheets.forEach(sheetName => {
        const newSheet = sheet.insertSheet(sheetName);
        
        // ヘッダーを設定
        switch (sheetName) {
          case 'LINEユーザー情報':
            newSheet.getRange(1, 1, 1, 5).setValues([['LINEユーザーID', '患者ID', '表示名', '登録日時', '最終利用日時']]);
            break;
          case '診療案内':
            newSheet.getRange(1, 1, 1, 2).setValues([['診療案内情報', '更新日時']]);
            newSheet.getRange(2, 1).setValue(`【診療案内】

■診療時間
月〜金：9:00-12:00, 14:00-18:00
土：9:00-12:00
日祝：休診

■診療科目
・内科・外科・整形外科

■所在地
〒123-4567
東京都○○区△△町1-2-3`);
            newSheet.getRange(2, 2).setValue(new Date());
            break;
          case 'お問い合わせ':
            newSheet.getRange(1, 1, 1, 2).setValues([['お問い合わせ情報', '更新日時']]);
            newSheet.getRange(2, 1).setValue(`【お問い合わせ】

■電話
03-1234-5678

■受付時間
月〜金：9:00-17:00
土：9:00-12:00

■メール
info@tenma-hospital.com`);
            newSheet.getRange(2, 2).setValue(new Date());
            break;
          case 'LINE Bot Logs':
            newSheet.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Request ID', 'User ID', 'Action', 'Success', 'Processing Time', 'Error']]);
            break;
        }
        
        Logger.log(`✓ ${sheetName}シートを作成しました`);
      });
    }
    
    Logger.log('\nセットアップチェック完了');
    
  } catch (error) {
    Logger.log(`セットアップチェックエラー: ${error.toString()}`);
  }
}

/**
 * テスト用LINEユーザーを作成
 */
function createTestLineUser() {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
  
  if (!lineUserSheet) {
    Logger.log('LINEユーザー情報シートが見つかりません');
    return;
  }
  
  // テストユーザーデータ
  const testUser = [
    'U1234567890abcdef',  // LINEユーザーID
    '12345',              // 患者ID（実際の患者IDに変更してください）
    'テストユーザー',     // 表示名
    new Date(),           // 登録日時
    new Date()            // 最終利用日時
  ];
  
  lineUserSheet.appendRow(testUser);
  Logger.log('テスト用LINEユーザーを作成しました');
}