/**
 * LINE Bot セットアップヘルパー関数
 * 実際の患者データを使ってテストユーザーを設定
 */

/**
 * 実際の患者IDを使ってLINEテストユーザーを更新
 */
function updateTestUserWithRealPatientId() {
  Logger.log('実際の患者IDでテストユーザーを更新します...');
  
  try {
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
    
    // 患者情報シートから実際の患者を取得
    const visitorSheet = sheet.getSheetByName(Config.getSheetNames().visitors);
    if (!visitorSheet || visitorSheet.getLastRow() <= 1) {
      Logger.log('患者情報が見つかりません。先に患者情報を同期してください。');
      return false;
    }
    
    // 最初の患者のIDを取得
    const patientData = visitorSheet.getRange(2, 1, 1, 5).getValues()[0];
    const realPatientId = patientData[0];
    const patientName = patientData[1];
    
    Logger.log(`使用する患者: ID=${realPatientId}, 名前=${patientName}`);
    
    // LINEユーザー情報シートを更新
    const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
    const data = lineUserSheet.getDataRange().getValues();
    
    // テストユーザーを探して更新
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'U1234567890abcdef') {
        lineUserSheet.getRange(i + 1, 2).setValue(realPatientId); // 患者IDを更新
        lineUserSheet.getRange(i + 1, 3).setValue(`テストユーザー (${patientName})`); // 表示名を更新
        lineUserSheet.getRange(i + 1, 5).setValue(new Date()); // 最終利用日時を更新
        
        Logger.log(`✓ テストユーザーを更新しました: 患者ID=${realPatientId}`);
        return true;
      }
    }
    
    // テストユーザーが見つからない場合は新規作成
    const newTestUser = [
      'U1234567890abcdef',              // LINEユーザーID
      realPatientId,                    // 実際の患者ID
      `テストユーザー (${patientName})`, // 表示名
      new Date(),                       // 登録日時
      new Date()                        // 最終利用日時
    ];
    
    lineUserSheet.appendRow(newTestUser);
    Logger.log(`✓ テストユーザーを新規作成しました: 患者ID=${realPatientId}`);
    return true;
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 予約枠の存在を確認
 */
function checkAvailableSlots() {
  Logger.log('\n予約枠の存在を確認します...');
  
  try {
    const reservationService = new ReservationService();
    
    // 今日から7日間の予約枠を確認
    const slots = reservationService.getVacancies({
      date_from: Utils.getToday(),
      date_to: Utils.addDays(Utils.getToday(), 7)
    });
    
    if (slots && slots.items && slots.items.length > 0) {
      Logger.log(`✓ ${slots.items.length}件の予約枠が見つかりました`);
      
      // 診療科別に集計
      const departmentCount = {};
      slots.items.forEach(slot => {
        const dept = slot.department_name || '不明';
        departmentCount[dept] = (departmentCount[dept] || 0) + 1;
      });
      
      Object.entries(departmentCount).forEach(([dept, count]) => {
        Logger.log(`  - ${dept}: ${count}件`);
      });
      
      return true;
    } else {
      Logger.log('⚠ 利用可能な予約枠が見つかりません');
      Logger.log('予約枠を作成するか、日付範囲を広げて確認してください');
      return false;
    }
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * LINE Bot APIの動作状況サマリー
 */
function showLineBotStatus() {
  Logger.log('\n========== LINE Bot API 状況確認 ==========');
  
  // スプレッドシートの状態確認
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const sheets = ['LINEユーザー情報', '診療案内', 'お問い合わせ', 'LINE Bot Logs'];
  
  Logger.log('\n【スプレッドシート】');
  sheets.forEach(sheetName => {
    const targetSheet = sheet.getSheetByName(sheetName);
    if (targetSheet) {
      const rowCount = targetSheet.getLastRow();
      Logger.log(`✓ ${sheetName}: ${rowCount}行`);
    } else {
      Logger.log(`✗ ${sheetName}: 未作成`);
    }
  });
  
  // 患者データの確認
  Logger.log('\n【患者データ】');
  const visitorSheet = sheet.getSheetByName(Config.getSheetNames().visitors);
  if (visitorSheet) {
    const patientCount = Math.max(0, visitorSheet.getLastRow() - 1);
    Logger.log(`患者数: ${patientCount}名`);
  } else {
    Logger.log('患者情報シートが見つかりません');
  }
  
  // 予約データの確認
  Logger.log('\n【予約データ】');
  const reservationSheet = sheet.getSheetByName('予約情報');
  if (reservationSheet) {
    const reservationCount = Math.max(0, reservationSheet.getLastRow() - 1);
    Logger.log(`予約数: ${reservationCount}件`);
  } else {
    Logger.log('予約情報シートが見つかりません');
  }
  
  // APIログの確認
  Logger.log('\n【最新のAPIアクセス】');
  const logSheet = sheet.getSheetByName('LINE Bot Logs');
  if (logSheet && logSheet.getLastRow() > 1) {
    const lastLog = logSheet.getRange(logSheet.getLastRow(), 1, 1, 7).getValues()[0];
    Logger.log(`最終アクセス: ${lastLog[0]}`);
    Logger.log(`アクション: ${lastLog[3]}`);
    Logger.log(`成功/失敗: ${lastLog[4] ? '成功' : '失敗'}`);
  } else {
    Logger.log('まだアクセスログがありません');
  }
}

/**
 * テスト前の準備を一括実行
 */
function prepareForTesting() {
  Logger.log('========== テスト準備開始 ==========');
  
  // 1. 患者データの確認と更新
  Logger.log('\n1. 患者データの準備...');
  const updated = updateTestUserWithRealPatientId();
  
  if (!updated) {
    Logger.log('⚠ 患者データが見つかりません');
    Logger.log('先に syncAllData() を実行して患者情報を同期してください');
    return false;
  }
  
  // 2. 予約枠の確認
  Logger.log('\n2. 予約枠の確認...');
  checkAvailableSlots();
  
  // 3. 現在の状況表示
  showLineBotStatus();
  
  Logger.log('\n========== テスト準備完了 ==========');
  Logger.log('runAllLineBotTests() を実行してテストを開始してください');
  
  return true;
}