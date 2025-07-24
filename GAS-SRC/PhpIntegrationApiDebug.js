/**
 * PHP統合API デバッグ用関数
 * システムエラーの原因特定のため
 */

/**
 * PHP統合APIの直接テスト
 */
function testPhpApiDirectly() {
  Logger.log('=== PHP統合API 直接テスト開始 ===');
  
  try {
    // 1. 基本的なヘルスチェック（パラメータなし）
    Logger.log('\n--- テスト1: 基本ヘルスチェック ---');
    const mockRequest1 = {
      parameter: {}
    };
    
    const result1 = doGetPhpIntegration(mockRequest1);
    Logger.log('成功: ' + result1.getContent());
    
  } catch (error) {
    Logger.log('エラー1: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
  
  try {
    // 2. API パス指定テスト
    Logger.log('\n--- テスト2: APIパス指定 ---');
    const mockRequest2 = {
      parameter: {
        path: 'api/health'
      }
    };
    
    const result2 = doGetPhpIntegration(mockRequest2);
    Logger.log('成功: ' + result2.getContent());
    
  } catch (error) {
    Logger.log('エラー2: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
  
  try {
    // 3. ユーザー情報取得テスト
    Logger.log('\n--- テスト3: ユーザー情報取得 ---');
    const mockRequest3 = {
      parameter: {
        path: 'api/users/line/U423d10aeba6ed5e5b0cf420435dbab3b/full'
      }
    };
    
    const result3 = doGetPhpIntegration(mockRequest3);
    Logger.log('成功: ' + result3.getContent());
    
  } catch (error) {
    Logger.log('エラー3: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
  
  Logger.log('\n=== テスト完了 ===');
}

/**
 * WebApiのルーティング確認
 */
function testWebApiRouting() {
  Logger.log('=== WebApi ルーティングテスト開始 ===');
  
  try {
    // 1. パラメータなしのリクエスト
    Logger.log('\n--- WebApiテスト1: パラメータなし ---');
    const mockRequest1 = {
      parameter: {}
    };
    
    const result1 = doGet(mockRequest1);
    Logger.log('レスポンスタイプ: ' + typeof result1);
    Logger.log('内容: ' + result1.getContent());
    
  } catch (error) {
    Logger.log('WebApiエラー1: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
  
  try {
    // 2. API パス指定
    Logger.log('\n--- WebApiテスト2: APIパス ---');
    const mockRequest2 = {
      parameter: {
        path: 'api/health'
      }
    };
    
    const result2 = doGet(mockRequest2);
    Logger.log('レスポンスタイプ: ' + typeof result2);
    Logger.log('内容: ' + result2.getContent());
    
  } catch (error) {
    Logger.log('WebApiエラー2: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
  
  Logger.log('\n=== WebApiテスト完了 ===');
}

/**
 * 最小限のJSON出力テスト
 */
function testBasicJsonOutput() {
  Logger.log('=== 基本JSON出力テスト ===');
  
  try {
    const response = ContentService.createTextOutput();
    response.setMimeType(ContentService.MimeType.JSON);
    
    const testData = {
      status: 'success',
      message: 'テスト成功',
      timestamp: new Date().toISOString()
    };
    
    response.setContent(JSON.stringify(testData));
    
    Logger.log('JSON出力テスト成功');
    Logger.log('内容: ' + response.getContent());
    
  } catch (error) {
    Logger.log('JSON出力テストエラー: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
}

/**
 * setHeadersメソッドの互換性テスト
 */
function testSetHeadersCompatibility() {
  Logger.log('=== setHeaders互換性テスト ===');
  
  try {
    const response = ContentService.createTextOutput();
    response.setMimeType(ContentService.MimeType.JSON);
    
    // setHeadersメソッドをテスト
    response.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    
    Logger.log('setHeaders成功: このメソッドは利用可能です');
    
  } catch (error) {
    Logger.log('setHeadersエラー: このメソッドは利用できません');
    Logger.log('エラー詳細: ' + error.toString());
  }
}

/**
 * スプレッドシートアクセステスト
 */
function testSpreadsheetAccess() {
  Logger.log('=== スプレッドシートアクセステスト ===');
  
  try {
    // Config.jsの利用可能性確認
    const spreadsheetId = Config.getSpreadsheetId();
    Logger.log('スプレッドシートID取得成功: ' + spreadsheetId);
    
    // シート名の取得
    const sheetNames = Config.getSheetNames();
    Logger.log('シート名取得成功: ' + JSON.stringify(sheetNames));
    
    // 実際のスプレッドシートアクセス
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetNames.visitors);
    if (sheet) {
      Logger.log('患者マスタシートアクセス成功');
      const lastRow = sheet.getLastRow();
      Logger.log('データ行数: ' + lastRow);
    } else {
      Logger.log('患者マスタシートが見つかりません');
    }
    
  } catch (error) {
    Logger.log('スプレッドシートアクセスエラー: ' + error.toString());
    Logger.log('スタック: ' + (error.stack || 'なし'));
  }
}

/**
 * スクリプトプロパティテスト
 */
function testScriptProperties() {
  Logger.log('=== スクリプトプロパティテスト ===');
  
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const phpApiKeys = scriptProperties.getProperty('PHP_API_KEYS');
    
    Logger.log('PHP_API_KEYS: ' + (phpApiKeys || '未設定'));
    
    if (!phpApiKeys) {
      Logger.log('警告: PHP_API_KEYSが設定されていません');
    }
    
  } catch (error) {
    Logger.log('スクリプトプロパティエラー: ' + error.toString());
  }
}

/**
 * 全デバッグテストを実行
 */
function runAllDebugTests() {
  Logger.log('===== 全デバッグテスト開始 =====\n');
  
  // 1. 基本機能テスト
  testBasicJsonOutput();
  Logger.log('\n');
  
  // 2. setHeaders互換性テスト
  testSetHeadersCompatibility();
  Logger.log('\n');
  
  // 3. スクリプトプロパティテスト
  testScriptProperties();
  Logger.log('\n');
  
  // 4. スプレッドシートアクセステスト
  testSpreadsheetAccess();
  Logger.log('\n');
  
  // 5. PHP統合API直接テスト
  testPhpApiDirectly();
  Logger.log('\n');
  
  // 6. WebApiルーティングテスト
  testWebApiRouting();
  
  Logger.log('\n===== 全デバッグテスト完了 =====');
}

/**
 * セーフモード版のPhpIntegrationApi
 * 最小限の機能で動作確認
 */
function doGetPhpIntegrationSafe(e) {
  try {
    const response = ContentService.createTextOutput();
    response.setMimeType(ContentService.MimeType.JSON);
    
    // setHeadersを使わずにシンプルに
    const testResponse = {
      status: 'success',
      message: 'Safe mode API is working',
      timestamp: new Date().toISOString(),
      received_parameters: e.parameter || {}
    };
    
    response.setContent(JSON.stringify(testResponse));
    return response;
    
  } catch (error) {
    Logger.log('Safe mode error: ' + error.toString());
    
    // 最も基本的なエラーレスポンス
    const response = ContentService.createTextOutput();
    response.setMimeType(ContentService.MimeType.JSON);
    response.setContent('{"status":"error","message":"' + error.toString().replace(/"/g, '\\"') + '"}');
    return response;
  }
}