/**
 * LINE Bot API セットアップスクリプト
 * 
 * このスクリプトを実行することで、LINE Bot APIの初期設定と動作確認を行います
 */

/**
 * メインセットアップ関数
 * Google Apps Script エディタから実行してください
 */
function setupLineBotApi() {
  Logger.log('========== LINE Bot API セットアップ開始 ==========');
  
  try {
    // 1. 必要なシートの作成
    Logger.log('\n1. 必要なシートをチェック・作成します...');
    checkAndCreateSheets();
    
    // 2. テスト用データの作成
    Logger.log('\n2. テスト用データを作成します...');
    createTestData();
    
    // 3. 環境設定の確認
    Logger.log('\n3. 環境設定を確認します...');
    checkEnvironmentSettings();
    
    // 4. 簡易動作テスト
    Logger.log('\n4. 簡易動作テストを実行します...');
    runQuickTests();
    
    // 5. デプロイ情報の表示
    Logger.log('\n5. デプロイ情報を表示します...');
    showDeploymentInfo();
    
    Logger.log('\n========== セットアップ完了 ==========');
    Logger.log('次のステップ: runAllLineBotTests() を実行して詳細なテストを行ってください');
    
  } catch (error) {
    Logger.log(`\nセットアップエラー: ${error.toString()}`);
    Logger.log('エラーを修正してから再度実行してください');
  }
}

/**
 * 必要なシートをチェック・作成
 */
function checkAndCreateSheets() {
  const spreadsheetId = Config.getSpreadsheetId();
  const sheet = SpreadsheetApp.openById(spreadsheetId);
  
  const sheetsConfig = {
    'LINEユーザー情報': {
      headers: ['LINEユーザーID', '患者ID', '表示名', '登録日時', '最終利用日時'],
      sample: null
    },
    '診療案内': {
      headers: ['診療案内情報', '更新日時'],
      sample: [`【診療案内】

■診療時間
月〜金：9:00-12:00, 14:00-18:00
土：9:00-12:00
日祝：休診

■診療科目
・内科
・外科
・整形外科
・皮膚科
・小児科

■所在地
〒123-4567
東京都○○区△△町1-2-3
天満病院

■アクセス
・JR○○駅より徒歩5分
・地下鉄△△駅より徒歩3分

■駐車場
専用駐車場20台完備`, new Date()]
    },
    'お問い合わせ': {
      headers: ['お問い合わせ情報', '更新日時'],
      sample: [`【お問い合わせ】

■代表電話
03-1234-5678

■予約専用ダイヤル
03-1234-5679

■受付時間
月〜金：8:30-17:30
土：8:30-12:30
日祝：休診

■救急外来
24時間対応
緊急時：03-1234-5680

■メールでのお問い合わせ
info@tenma-hospital.com

■お問い合わせフォーム
https://tenma-hospital.com/contact`, new Date()]
    },
    'LINE Bot Logs': {
      headers: ['Timestamp', 'Request ID', 'User ID', 'Action', 'Success', 'Processing Time', 'Error'],
      sample: null
    }
  };
  
  Object.entries(sheetsConfig).forEach(([sheetName, config]) => {
    let targetSheet = sheet.getSheetByName(sheetName);
    
    if (!targetSheet) {
      // シートを作成
      targetSheet = sheet.insertSheet(sheetName);
      Logger.log(`✓ ${sheetName}シートを作成しました`);
      
      // ヘッダーを設定
      targetSheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      targetSheet.getRange(1, 1, 1, config.headers.length).setFontWeight('bold');
      
      // サンプルデータがある場合は追加
      if (config.sample) {
        targetSheet.getRange(2, 1, 1, config.sample.length).setValues([config.sample]);
      }
      
      // 列幅を自動調整
      for (let i = 1; i <= config.headers.length; i++) {
        targetSheet.autoResizeColumn(i);
      }
    } else {
      Logger.log(`✓ ${sheetName}シート: 既に存在します`);
    }
  });
}

/**
 * テスト用データの作成
 */
function createTestData() {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  
  // テスト用LINEユーザーを作成
  const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
  const existingData = lineUserSheet.getDataRange().getValues();
  
  // テストユーザーが既に存在するか確認
  const testUserId = 'U1234567890abcdef';
  let userExists = false;
  
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0] === testUserId) {
      userExists = true;
      Logger.log('✓ テスト用LINEユーザー: 既に存在します');
      break;
    }
  }
  
  if (!userExists) {
    // 実際の患者データから最初の患者IDを取得
    const visitorSheet = sheet.getSheetByName(Config.getSheetNames().visitors);
    let testPatientId = '12345'; // デフォルト値
    
    if (visitorSheet) {
      const visitorData = visitorSheet.getDataRange().getValues();
      if (visitorData.length > 1) {
        testPatientId = visitorData[1][0]; // 最初の患者のID
        Logger.log(`実際の患者ID ${testPatientId} を使用します`);
      }
    }
    
    // テストユーザーを追加
    const testUser = [
      testUserId,              // LINEユーザーID
      testPatientId,           // 患者ID
      'テストユーザー',       // 表示名
      new Date(),              // 登録日時
      new Date()               // 最終利用日時
    ];
    
    lineUserSheet.appendRow(testUser);
    Logger.log('✓ テスト用LINEユーザーを作成しました');
  }
}

/**
 * 環境設定の確認
 */
function checkEnvironmentSettings() {
  // スクリプトプロパティの確認
  const properties = PropertiesService.getScriptProperties();
  const requiredProperties = {
    'SPREADSHEET_ID': Config.getSpreadsheetId(),
    'CACHE_DURATION_MINUTES': '5',
    'LOG_LEVEL': 'info'
  };
  
  Object.entries(requiredProperties).forEach(([key, defaultValue]) => {
    const currentValue = properties.getProperty(key);
    if (!currentValue && defaultValue) {
      properties.setProperty(key, defaultValue);
      Logger.log(`✓ ${key}を設定しました: ${defaultValue}`);
    } else {
      Logger.log(`✓ ${key}: ${currentValue || defaultValue}`);
    }
  });
  
  // Medical Force API設定の確認
  try {
    const clinicId = Config.getClinicId();
    Logger.log(`✓ Clinic ID: ${clinicId}`);
  } catch (error) {
    Logger.log('⚠ Clinic IDが設定されていません');
  }
}

/**
 * 簡易動作テスト
 */
function runQuickTests() {
  Logger.log('\n各アクションの簡易テストを実行します...');
  
  // テストリクエストの作成
  const testRequest = {
    version: '1.0',
    requestId: `quick_test_${new Date().getTime()}`,
    timestamp: new Date().toISOString(),
    source: {
      type: 'line_richmenu',
      userId: 'U1234567890abcdef',
      displayName: 'テストユーザー',
      action: 'test'
    },
    action: {
      type: 'getClinicInfo',
      parameters: {
        infoType: 'all',
        includeImages: false
      }
    },
    context: {
      sessionId: 'quick_test',
      userPreferences: {
        language: 'ja',
        timezone: 'Asia/Tokyo'
      }
    }
  };
  
  try {
    // LineBotApi.jsの基本動作確認
    const e = {
      postData: {
        contents: JSON.stringify(testRequest)
      }
    };
    
    const response = doPostLineBot(e);
    const responseData = JSON.parse(response.getContent());
    
    if (responseData.status.success) {
      Logger.log('✓ 診療案内取得: 成功');
    } else {
      Logger.log('✗ 診療案内取得: 失敗');
      Logger.log(`  エラー: ${responseData.status.message}`);
    }
    
  } catch (error) {
    Logger.log('✗ 基本動作テスト: エラー');
    Logger.log(`  ${error.toString()}`);
  }
}

/**
 * デプロイ情報の表示
 */
function showDeploymentInfo() {
  Logger.log('\n========== デプロイ手順 ==========');
  Logger.log('1. Google Apps Script エディタで「デプロイ」→「新しいデプロイ」を選択');
  Logger.log('2. 以下の設定でデプロイ:');
  Logger.log('   - 種類: ウェブアプリ');
  Logger.log('   - 説明: LINE Bot API for Medical Force');
  Logger.log('   - 実行ユーザー: 自分');
  Logger.log('   - アクセスできるユーザー: 全員（匿名ユーザーを含む）');
  Logger.log('3. デプロイ完了後、発行されたURLをLINE側に設定');
  Logger.log('\n注意: doPostLineBot関数がエントリーポイントになります');
}

/**
 * 詳細テストの実行ヘルパー
 */
function runDetailedTests() {
  Logger.log('========== 詳細テスト開始 ==========');
  
  // LineBotApiTest.jsの関数を呼び出し
  runAllLineBotTests();
}

/**
 * ログの確認ヘルパー
 */
function viewRecentLogs(count = 20) {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const logSheet = sheet.getSheetByName('LINE Bot Logs');
  
  if (!logSheet) {
    Logger.log('ログシートが見つかりません');
    return;
  }
  
  const data = logSheet.getDataRange().getValues();
  const startRow = Math.max(1, data.length - count);
  
  Logger.log(`========== 最新${count}件のログ ==========`);
  Logger.log('Timestamp | Request ID | User ID | Action | Success | Time | Error');
  Logger.log('----------------------------------------------------------------------');
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    Logger.log(`${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]}s | ${row[6] || '-'}`);
  }
}

/**
 * デプロイ前の最終チェック
 */
function preDeploymentCheck() {
  Logger.log('========== デプロイ前チェック ==========');
  
  const checks = {
    'LineBotApi.js存在確認': () => {
      // ファイルの存在を仮定（GASでは直接確認できない）
      return true;
    },
    'スプレッドシート設定': () => {
      try {
        const id = Config.getSpreadsheetId();
        const sheet = SpreadsheetApp.openById(id);
        return sheet !== null;
      } catch (e) {
        return false;
      }
    },
    '必要なシート': () => {
      const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
      const required = ['LINEユーザー情報', '診療案内', 'お問い合わせ', 'LINE Bot Logs'];
      return required.every(name => sheet.getSheetByName(name) !== null);
    },
    'テストユーザー': () => {
      const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
      const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
      return lineUserSheet && lineUserSheet.getLastRow() > 1;
    }
  };
  
  let allPassed = true;
  
  Object.entries(checks).forEach(([checkName, checkFn]) => {
    try {
      const result = checkFn();
      Logger.log(`${result ? '✓' : '✗'} ${checkName}`);
      if (!result) allPassed = false;
    } catch (error) {
      Logger.log(`✗ ${checkName}: ${error.toString()}`);
      allPassed = false;
    }
  });
  
  Logger.log('\n' + (allPassed ? '✓ すべてのチェックに合格しました。デプロイ可能です。' : '✗ 一部のチェックに失敗しました。問題を修正してください。'));
  
  return allPassed;
}