// 天満病院チケット管理システム - Google Apps Script

// スプレッドシートのシート名定義
const SHEET_NAMES = {
  PLAN_MASTER: 'プランマスター',
  COMPANY_MASTER: '会社マスタ',
  TICKET_BALANCE: 'チケット残高',
  USAGE_HISTORY: 'チケット使用履歴',
  PLAN_CHANGE_HISTORY: 'プラン変更履歴'
};

// メニュー項目の定義
const MENU_TYPES = ['幹細胞', '施術', '点滴'];

// スプレッドシートを開く
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * チケット管理システムのシートを初期化
 */
function initializeTicketSheets() {
  const ss = getSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    // プランマスターシートの作成
    let planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
    if (!planMaster) {
      planMaster = ss.insertSheet(SHEET_NAMES.PLAN_MASTER);
      planMaster.getRange(1, 1, 1, 4).setValues([['プラン名', '幹細胞', '施術', '点滴']]);
      
      // サンプルプランの追加
      const samplePlans = [
        ['プランA', 5, 10, 5],
        ['プランB', 10, 20, 10],
        ['プランC', 15, 30, 15]
      ];
      planMaster.getRange(2, 1, samplePlans.length, 4).setValues(samplePlans);
      
      // ヘッダーの装飾
      const headerRange = planMaster.getRange(1, 1, 1, 4);
      headerRange.setBackground('#4285F4');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
    }
    
    // 会社マスターシートの作成
    let companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
    if (!companyMaster) {
      companyMaster = ss.insertSheet(SHEET_NAMES.COMPANY_MASTER);
      companyMaster.getRange(1, 1, 1, 4).setValues([['会社ID', '会社名', 'プラン', '開始日']]);
      
      // ヘッダーの装飾
      const headerRange = companyMaster.getRange(1, 1, 1, 4);
      headerRange.setBackground('#4285F4');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
    }
    
    // チケット残高シートの作成
    let ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
    if (!ticketBalance) {
      ticketBalance = ss.insertSheet(SHEET_NAMES.TICKET_BALANCE);
      ticketBalance.getRange(1, 1, 1, 11).setValues([[
        '会社ID', '年月', 
        '幹細胞付与', '幹細胞使用', '幹細胞残',
        '施術付与', '施術使用', '施術残',
        '点滴付与', '点滴使用', '点滴残'
      ]]);
      
      // ヘッダーの装飾
      const headerRange = ticketBalance.getRange(1, 1, 1, 11);
      headerRange.setBackground('#4285F4');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
    }
    
    // 使用履歴シートの作成
    let usageHistory = ss.getSheetByName(SHEET_NAMES.USAGE_HISTORY);
    if (!usageHistory) {
      usageHistory = ss.insertSheet(SHEET_NAMES.USAGE_HISTORY);
      usageHistory.getRange(1, 1, 1, 6).setValues([[
        '使用日時', '会社ID', 'メニュー', '使用数', '使用者', '備考'
      ]]);
      
      // ヘッダーの装飾
      const headerRange = usageHistory.getRange(1, 1, 1, 6);
      headerRange.setBackground('#4285F4');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
    }
    
    // プラン変更履歴シートの作成
    let planChangeHistory = ss.getSheetByName(SHEET_NAMES.PLAN_CHANGE_HISTORY);
    if (!planChangeHistory) {
      planChangeHistory = ss.insertSheet(SHEET_NAMES.PLAN_CHANGE_HISTORY);
      planChangeHistory.getRange(1, 1, 1, 4).setValues([[
        '変更日時', '会社ID', '旧プラン', '新プラン'
      ]]);
      
      // ヘッダーの装飾
      const headerRange = planChangeHistory.getRange(1, 1, 1, 4);
      headerRange.setBackground('#4285F4');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
    }
    
    ui.alert('チケット管理システムのシート初期化が完了しました。');
    return { success: true };
    
  } catch (error) {
    Logger.log('チケット管理シート初期化エラー: ' + error.toString());
    ui.alert('エラー', 'シートの初期化に失敗しました: ' + error.message, ui.ButtonSet.OK);
    return { success: false, error: error.toString() };
  }
}

// 毎月1日に実行される自動リセット関数
function monthlyTicketReset() {
  const ss = getSpreadsheet();
  const planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
  const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
  const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
  
  // 現在の年月を取得
  const now = new Date();
  const yearMonth = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM');
  
  // 会社マスターから全企業を取得
  const companies = companyMaster.getDataRange().getValues();
  const planData = planMaster.getDataRange().getValues();
  
  // プランデータをオブジェクトに変換
  const plans = {};
  for (let i = 1; i < planData.length; i++) {
    plans[planData[i][0]] = {
      幹細胞: planData[i][1],
      施術: planData[i][2],
      点滴: planData[i][3]
    };
  }
  
  // 各企業のチケットをリセット
  const newBalanceData = [];
  for (let i = 1; i < companies.length; i++) {
    const companyId = companies[i][0];
    const currentPlan = companies[i][2];
    const planTickets = plans[currentPlan];
    
    if (planTickets) {
      newBalanceData.push([
        companyId,
        yearMonth,
        planTickets.幹細胞, 0, planTickets.幹細胞,  // 幹細胞: 付与, 使用, 残
        planTickets.施術, 0, planTickets.施術,      // 施術: 付与, 使用, 残
        planTickets.点滴, 0, planTickets.点滴       // 点滴: 付与, 使用, 残
      ]);
    }
  }
  
  // チケット残高シートに追記
  if (newBalanceData.length > 0) {
    const lastRow = ticketBalance.getLastRow();
    ticketBalance.getRange(lastRow + 1, 1, newBalanceData.length, newBalanceData[0].length)
      .setValues(newBalanceData);
  }
  
  // ログ記録
  console.log(`${yearMonth} のチケットリセットを完了しました。`);
}

// チケット使用関数
function useTicket(companyId, menuType, useCount, userName = '', memo = '') {
  const ss = getSpreadsheet();
  const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
  const usageHistory = ss.getSheetByName(SHEET_NAMES.USAGE_HISTORY);
  
  // 現在の年月を取得
  const now = new Date();
  const yearMonth = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM');
  const timestamp = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  
  // 該当企業の現在月の残高を検索
  const balanceData = ticketBalance.getDataRange().getValues();
  let targetRowIndex = -1;
  
  for (let i = balanceData.length - 1; i >= 0; i--) {
    if (balanceData[i][0] === companyId && balanceData[i][1] === yearMonth) {
      targetRowIndex = i;
      break;
    }
  }
  
  if (targetRowIndex === -1) {
    throw new Error(`企業ID ${companyId} の ${yearMonth} のチケット情報が見つかりません。`);
  }
  
  // メニューに応じた列インデックスを取得
  const columnOffset = MENU_TYPES.indexOf(menuType) * 3 + 2;
  if (columnOffset === -1) {
    throw new Error(`不正なメニュータイプ: ${menuType}`);
  }
  
  // 残数チェック
  const currentBalance = balanceData[targetRowIndex][columnOffset + 2];
  if (currentBalance < useCount) {
    throw new Error(`${menuType}のチケット残数が不足しています。残数: ${currentBalance}, 使用数: ${useCount}`);
  }
  
  // 残高を更新
  const newUsed = balanceData[targetRowIndex][columnOffset + 1] + useCount;
  const newBalance = balanceData[targetRowIndex][columnOffset] - newUsed;
  
  ticketBalance.getRange(targetRowIndex + 1, columnOffset + 2).setValue(newUsed);
  ticketBalance.getRange(targetRowIndex + 1, columnOffset + 3).setValue(newBalance);
  
  // 使用履歴に記録
  usageHistory.appendRow([timestamp, companyId, menuType, useCount, userName, memo]);
  
  return {
    success: true,
    remainingBalance: newBalance,
    message: `${menuType}チケットを${useCount}枚使用しました。残数: ${newBalance}`
  };
}

// プラン変更関数
function changePlan(companyId, newPlan) {
  const ss = getSpreadsheet();
  const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
  const planChangeHistory = ss.getSheetByName(SHEET_NAMES.PLAN_CHANGE_HISTORY);
  
  // 企業情報を検索
  const companyData = companyMaster.getDataRange().getValues();
  let targetRowIndex = -1;
  let oldPlan = '';
  
  for (let i = 1; i < companyData.length; i++) {
    if (companyData[i][0] === companyId) {
      targetRowIndex = i;
      oldPlan = companyData[i][2];
      break;
    }
  }
  
  if (targetRowIndex === -1) {
    throw new Error(`企業ID ${companyId} が見つかりません。`);
  }
  
  // プランを更新
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  companyMaster.getRange(targetRowIndex + 1, 3).setValue(newPlan);
  companyMaster.getRange(targetRowIndex + 1, 4).setValue(today);
  
  // 変更履歴に記録
  planChangeHistory.appendRow([today, companyId, oldPlan, newPlan]);
  
  return {
    success: true,
    message: `企業ID ${companyId} のプランを ${oldPlan} から ${newPlan} に変更しました。`
  };
}

// 月次レポート生成関数
function generateMonthlyReport(yearMonth) {
  const ss = getSpreadsheet();
  const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
  const usageHistory = ss.getSheetByName(SHEET_NAMES.USAGE_HISTORY);
  const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
  
  // 指定月のデータを集計
  const balanceData = ticketBalance.getDataRange().getValues();
  const usageData = usageHistory.getDataRange().getValues();
  const companyData = companyMaster.getDataRange().getValues();
  
  const report = {
    yearMonth: yearMonth,
    companies: {},
    summary: {
      totalCompanies: 0,
      byPlan: {},
      byMenu: {}
    }
  };
  
  // 会社マスターから企業名を取得
  const companyNames = {};
  for (let i = 1; i < companyData.length; i++) {
    companyNames[companyData[i][0]] = companyData[i][1];
  }
  
  // 残高データから集計
  for (let i = 1; i < balanceData.length; i++) {
    if (balanceData[i][1] === yearMonth) {
      const companyId = balanceData[i][0];
      report.companies[companyId] = {
        name: companyNames[companyId] || companyId,
        tickets: {
          幹細胞: { 付与: balanceData[i][2], 使用: balanceData[i][3], 残: balanceData[i][4] },
          施術: { 付与: balanceData[i][5], 使用: balanceData[i][6], 残: balanceData[i][7] },
          点滴: { 付与: balanceData[i][8], 使用: balanceData[i][9], 残: balanceData[i][10] }
        },
        usageRate: {}
      };
      
      // 使用率計算
      MENU_TYPES.forEach(menu => {
        const granted = report.companies[companyId].tickets[menu].付与;
        const used = report.companies[companyId].tickets[menu].使用;
        report.companies[companyId].usageRate[menu] = granted > 0 ? (used / granted * 100).toFixed(1) + '%' : '0%';
      });
      
      report.summary.totalCompanies++;
    }
  }
  
  return report;
}

// トリガー設定関数（初回のみ実行）
function setupTriggers() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'monthlyTicketReset') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 毎月1日の午前0時にトリガーを設定
  ScriptApp.newTrigger('monthlyTicketReset')
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .create();
  
  console.log('毎月1日のトリガーを設定しました。');
}

// 会社管理機能

/**
 * ダイアログから会社一覧を取得（ベース実装）
 */
function getCompaniesForDialogBase() {
  SpreadsheetManager.logExecution('INFO', 'getCompaniesForDialogBase開始', 'TicketManagement.js');
  try {
    const ss = getSpreadsheet();
    let companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
    let planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
    
    // 統一されたシート名でも検索
    if (!companyMaster) {
      SpreadsheetManager.logExecution('INFO', 'SHEET_NAMES.COMPANY_MASTERが見つからない', '統一シート名で検索');
      companyMaster = ss.getSheetByName('会社マスタ');
    }
    if (!planMaster) {
      SpreadsheetManager.logExecution('INFO', 'SHEET_NAMES.PLAN_MASTERが見つからない', '統一シート名で検索');
      planMaster = ss.getSheetByName('プランマスター');
    }
    
    // シートが存在しない場合のエラーハンドリング
    if (!companyMaster) {
      SpreadsheetManager.logExecution('ERROR', '会社マスタシートが見つかりません', '検索したシート名: ' + SHEET_NAMES.COMPANY_MASTER + ', 会社マスタ');
      return { success: false, error: '会社マスタシートが見つかりません。初期化を実行してください。' };
    }
    if (!planMaster) {
      SpreadsheetManager.logExecution('ERROR', 'プランマスターシートが見つかりません', '検索したシート名: ' + SHEET_NAMES.PLAN_MASTER + ', プランマスター');
      return { success: false, error: 'プランマスターシートが見つかりません。初期化を実行してください。' };
    }
    
    const companies = companyMaster.getDataRange().getValues();
    const plans = planMaster.getDataRange().getValues();
    
    // データが存在しない場合の処理
    SpreadsheetManager.logExecution('INFO', 'シートデータ取得', `会社マスタ: ${companies.length}行, プランマスター: ${plans.length}行`);
    
    if (companies.length <= 1) {
      SpreadsheetManager.logExecution('INFO', '会社データがありません', '空の配列を返す');
      return { success: true, data: [] };
    }
    if (plans.length <= 1) {
      SpreadsheetManager.logExecution('ERROR', 'プランマスターにデータがありません', 'プラン登録が必要');
      return { success: false, error: 'プランマスターにデータがありません。プランを登録してください。' };
    }
    
    // プランデータをマップに変換
    const planMap = {};
    for (let i = 1; i < plans.length; i++) {
      planMap[plans[i][0]] = {
        stemCell: plans[i][1],
        treatment: plans[i][2],
        infusion: plans[i][3]
      };
    }
    
    // 会社データを整形
    const result = [];
    for (let i = 1; i < companies.length; i++) {
      if (companies[i][0]) { // 会社IDが存在する場合のみ
        const planData = planMap[companies[i][2]] || {};
        result.push({
          id: companies[i][0],
          name: companies[i][1],
          plan: companies[i][2],
          startDate: companies[i][3] ? Utilities.formatDate(new Date(companies[i][3]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
          stemCell: planData.stemCell || 0,
          treatment: planData.treatment || 0,
          infusion: planData.infusion || 0
        });
      }
    }
    
    SpreadsheetManager.logExecution('SUCCESS', 'getCompaniesForDialogBase完了', `${result.length}社のデータを返す`);
    return { success: true, data: result };
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', 'getCompaniesForDialogBaseエラー', error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 利用可能なプラン一覧を取得
 */
function getAvailablePlansForDialog() {
  try {
    const ss = getSpreadsheet();
    let planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
    
    // 統一されたシート名でも検索
    if (!planMaster) {
      planMaster = ss.getSheetByName('プランマスター');
    }
    
    // シートが存在しない場合のエラーハンドリング
    if (!planMaster) {
      return { success: false, error: 'プランマスターシートが見つかりません。初期化を実行してください。' };
    }
    
    const plans = planMaster.getDataRange().getValues();
    
    // データが存在しない場合の処理
    if (plans.length <= 1) {
      return { success: false, error: 'プランマスターにデータがありません。プランを登録してください。' };
    }
    
    const result = [];
    for (let i = 1; i < plans.length; i++) {
      if (plans[i][0]) { // プラン名が存在する場合のみ
        result.push({
          name: plans[i][0],
          stemCell: plans[i][1] || 0,
          treatment: plans[i][2] || 0,
          infusion: plans[i][3] || 0
        });
      }
    }
    
    return { success: true, data: result };
  } catch (error) {
    Logger.log('getAvailablePlansForDialog エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 新規会社を追加
 */
function addCompanyFromDialog(formData) {
  try {
    const ss = getSpreadsheet();
    const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
    const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
    const planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
    
    // 会社IDの重複チェック
    const companies = companyMaster.getDataRange().getValues();
    for (let i = 1; i < companies.length; i++) {
      if (companies[i][0] === formData.companyId) {
        return { success: false, error: '指定された会社IDは既に存在します。' };
      }
    }
    
    // プランの存在確認
    const plans = planMaster.getDataRange().getValues();
    let planData = null;
    for (let i = 1; i < plans.length; i++) {
      if (plans[i][0] === formData.planName) {
        planData = {
          stemCell: plans[i][1],
          treatment: plans[i][2],
          infusion: plans[i][3]
        };
        break;
      }
    }
    
    if (!planData) {
      return { success: false, error: '指定されたプランが見つかりません。' };
    }
    
    // 会社マスターに追加（開始日を含む）
    const startDate = formData.startDate ? new Date(formData.startDate) : new Date();
    companyMaster.appendRow([formData.companyId, formData.companyName, formData.planName, startDate]);
    
    // チケット残高シートに初期データを追加
    const now = new Date();
    const yearMonth = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM');
    ticketBalance.appendRow([
      formData.companyId,
      yearMonth,
      planData.stemCell,
      planData.treatment,
      planData.infusion,
      0, 0, 0, // 使用数は0で初期化
      planData.stemCell, // 残数 = 付与数
      planData.treatment,
      planData.infusion
    ]);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社情報を更新
 */
function updateCompanyFromDialog(formData) {
  try {
    const ss = getSpreadsheet();
    const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
    const planChangeHistory = ss.getSheetByName(SHEET_NAMES.PLAN_CHANGE_HISTORY);
    
    // 会社情報を検索
    const companies = companyMaster.getDataRange().getValues();
    let rowIndex = -1;
    let oldPlan = '';
    
    for (let i = 1; i < companies.length; i++) {
      if (companies[i][0] === formData.companyId) {
        rowIndex = i;
        oldPlan = companies[i][2];
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, error: '指定された会社が見つかりません。' };
    }
    
    // 会社情報を更新（開始日も含む）
    const startDate = formData.startDate ? new Date(formData.startDate) : companies[rowIndex][3];
    companyMaster.getRange(rowIndex + 1, 2, 1, 3).setValues([[formData.companyName, formData.planName, startDate]]);
    
    // プラン変更があった場合は履歴に記録
    if (oldPlan !== formData.planName) {
      const now = new Date();
      planChangeHistory.appendRow([
        formData.companyId,
        oldPlan,
        formData.planName,
        Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
      ]);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社を削除
 */
function deleteCompanyFromDialog(companyId) {
  try {
    const ss = getSpreadsheet();
    const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
    const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
    const usageHistory = ss.getSheetByName(SHEET_NAMES.USAGE_HISTORY);
    
    // 会社情報を検索
    const companies = companyMaster.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < companies.length; i++) {
      if (companies[i][0] === companyId) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, error: '指定された会社が見つかりません。' };
    }
    
    // 会社マスターから削除
    companyMaster.deleteRow(rowIndex + 1);
    
    // チケット残高から関連データを削除
    const balances = ticketBalance.getDataRange().getValues();
    for (let i = balances.length - 1; i >= 1; i--) {
      if (balances[i][0] === companyId) {
        ticketBalance.deleteRow(i + 1);
      }
    }
    
    // 使用履歴から関連データを削除（オプション：履歴は残す場合はコメントアウト）
    const histories = usageHistory.getDataRange().getValues();
    for (let i = histories.length - 1; i >= 1; i--) {
      if (histories[i][0] === companyId) {
        usageHistory.deleteRow(i + 1);
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// === Main.jsから呼び出される関数 ===

/**
 * ダイアログから会社一覧を取得
 */
function getCompaniesForDialogTicket() {
  SpreadsheetManager.logExecution('INFO', 'getCompaniesForDialogTicket開始', 'TicketManagement.js');
  try {
    // getCompaniesForDialogBase()の結果を取得
    const result = getCompaniesForDialogBase();
    
    // エラーの場合はそのまま返す
    if (!result.success) {
      SpreadsheetManager.logExecution('ERROR', 'getCompaniesForDialogBaseが失敗', result.error);
      return result;
    }
    
    // データが存在しない場合
    if (!result.data || !Array.isArray(result.data)) {
      SpreadsheetManager.logExecution('ERROR', '不正なデータ構造', JSON.stringify(result));
      return { success: false, error: '会社データの構造が正しくありません。' };
    }
    
    const companies = result.data;
    SpreadsheetManager.logExecution('INFO', 'チケット残高情報を追加中', `対象会社数: ${companies.length}`);
    
    // 現在のチケット残高情報も取得
    const ss = getSpreadsheet();
    const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
    
    if (ticketBalance && companies.length > 0) {
      try {
        const currentMonth = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
        const balanceData = ticketBalance.getDataRange().getValues();
        
        // 各会社の現在月のチケット情報を追加
        companies.forEach(company => {
          for (let i = 1; i < balanceData.length; i++) {
            if (balanceData[i][0] === company.id && balanceData[i][1] === currentMonth) {
              company.stemCell = balanceData[i][4] || 0;    // 幹細胞残
              company.treatment = balanceData[i][7] || 0;   // 施術残
              company.infusion = balanceData[i][10] || 0;   // 点滴残
              break;
            }
          }
        });
      } catch (balanceError) {
        SpreadsheetManager.logExecution('WARNING', 'チケット残高取得エラー', balanceError.toString());
        // チケット残高の取得に失敗してもメイン機能は動作させる
      }
    }
    
    SpreadsheetManager.logExecution('SUCCESS', 'getCompaniesForDialogTicket完了', `返却会社数: ${companies.length}`);
    return { success: true, data: companies };
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', 'getCompaniesForDialogTicketエラー', error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 利用可能なプラン一覧を取得
 */
function getAvailablePlansForDialogTicket() {
  try {
    const result = getAvailablePlansForDialog();
    
    // エラーの場合はそのまま返す
    if (!result.success) {
      Logger.log('getAvailablePlansForDialogTicket: getAvailablePlansForDialog failed:', result.error);
      return result;
    }
    
    // データが存在しない場合
    if (!result.data || !Array.isArray(result.data)) {
      Logger.log('getAvailablePlansForDialogTicket: Invalid data structure:', result);
      return { success: false, error: 'プランデータの構造が正しくありません。' };
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    Logger.log('getAvailablePlansForDialogTicket エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 新規会社を追加
 */
function addCompanyFromDialogTicket(formData) {
  try {
    const result = addCompanyFromDialog(formData);
    return result;
  } catch (error) {
    Logger.log('addCompanyFromDialogTicket エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社情報を更新
 */
function updateCompanyFromDialogTicket(formData) {
  try {
    const result = updateCompanyFromDialog(formData);
    return result;
  } catch (error) {
    Logger.log('updateCompanyFromDialogTicket エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社を削除
 */
function deleteCompanyFromDialogTicket(companyId) {
  try {
    const result = deleteCompanyFromDialog(companyId);
    return result;
  } catch (error) {
    Logger.log('deleteCompanyFromDialogTicket エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// onOpen関数は削除 - Main.jsのMedical Force連携メニューを使用

// 以下の関数は使用されないためコメントアウト
// レポート表示用ダイアログ
function showTicketReportDialog() {
  const html = HtmlService.createHtmlOutputFromFile('report_dialog')
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, '月次レポート生成');
}

// チケット管理システムのヘルプ表示
function showTicketHelp() {
  const message = `
天満病院チケット管理システム

【主な機能】
1. 毎月1日の自動チケットリセット
2. チケット使用管理
3. プラン変更管理
4. 月次レポート生成

【使い方】
- チケット使用: useTicket(企業ID, メニュー, 使用数, 使用者, 備考)
- プラン変更: changePlan(企業ID, 新プラン)
- レポート生成: generateMonthlyReport(年月)

【初期設定】
メニューから「トリガー設定」を実行してください。
  `;
  
  SpreadsheetApp.getUi().alert(message);
}

// === 会社管理機能 ===

/**
 * 会社管理ダイアログを表示
 */
function showCompanyManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CompanyManagementDialog')
    .setWidth(900)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, '会社管理');
}

// getCompaniesForDialog関数は削除しました
// Main.js → getCompaniesForDialogTicket → getCompaniesForDialogBase の流れで正しく動作します

/**
 * 利用可能なプラン一覧を取得
 */
function getAvailablePlans() {
  const ss = getSpreadsheet();
  const planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
  
  if (!planMaster) {
    throw new Error('プランマスターシートが見つかりません');
  }
  
  const data = planMaster.getDataRange().getValues();
  const plans = [];
  
  // ヘッダー行をスキップ
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // プラン名が存在する場合
      plans.push(data[i][0]);
    }
  }
  
  return plans;
}

/**
 * 利用可能なプラン一覧を取得（配列形式）
 */
function getAvailablePlansArray() {
  const ss = getSpreadsheet();
  const planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
  
  if (!planMaster) {
    throw new Error('プランマスターシートが見つかりません');
  }
  
  const data = planMaster.getDataRange().getValues();
  const plans = [];
  
  // ヘッダー行をスキップ
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // プラン名が存在する場合
      plans.push({
        name: data[i][0],
        stemCell: data[i][1] || 0,
        treatment: data[i][2] || 0,
        infusion: data[i][3] || 0
      });
    }
  }
  
  return plans;
}

/**
 * 会社を追加
 */
function addCompany(companyId, companyName, planName, startDate) {
  const ss = getSpreadsheet();
  const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
  const planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
  const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
  
  if (!companyMaster || !planMaster || !ticketBalance) {
    throw new Error('必要なシートが見つかりません');
  }
  
  // 会社IDの重複チェック
  const existingCompanies = companyMaster.getDataRange().getValues();
  for (let i = 1; i < existingCompanies.length; i++) {
    if (existingCompanies[i][0] === companyId) {
      throw new Error(`会社ID「${companyId}」は既に存在します`);
    }
  }
  
  // プランの存在チェック
  const planData = planMaster.getDataRange().getValues();
  let planExists = false;
  let planTickets = null;
  
  for (let i = 1; i < planData.length; i++) {
    if (planData[i][0] === planName) {
      planExists = true;
      planTickets = {
        幹細胞: planData[i][1],
        施術: planData[i][2],
        点滴: planData[i][3]
      };
      break;
    }
  }
  
  if (!planExists) {
    throw new Error(`プラン「${planName}」が見つかりません`);
  }
  
  // 開始日の処理
  const formattedStartDate = startDate || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  
  // 会社マスターに追加
  companyMaster.appendRow([companyId, companyName, planName, formattedStartDate]);
  
  // 現在月のチケットを付与
  const now = new Date();
  const yearMonth = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM');
  
  ticketBalance.appendRow([
    companyId,
    yearMonth,
    planTickets.幹細胞, 0, planTickets.幹細胞,  // 幹細胞: 付与, 使用, 残
    planTickets.施術, 0, planTickets.施術,      // 施術: 付与, 使用, 残
    planTickets.点滴, 0, planTickets.点滴       // 点滴: 付与, 使用, 残
  ]);
  
  console.log(`会社「${companyName}」(${companyId})を追加しました`);
  
  return {
    success: true,
    message: `会社「${companyName}」を追加しました`
  };
}

/**
 * 会社情報を更新
 */
function updateCompany(companyId, companyName, planName, startDate) {
  const ss = getSpreadsheet();
  const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
  const planMaster = ss.getSheetByName(SHEET_NAMES.PLAN_MASTER);
  
  if (!companyMaster || !planMaster) {
    throw new Error('必要なシートが見つかりません');
  }
  
  // プランの存在チェック
  const planData = planMaster.getDataRange().getValues();
  let planExists = false;
  
  for (let i = 1; i < planData.length; i++) {
    if (planData[i][0] === planName) {
      planExists = true;
      break;
    }
  }
  
  if (!planExists) {
    throw new Error(`プラン「${planName}」が見つかりません`);
  }
  
  // 会社情報を更新
  const companyData = companyMaster.getDataRange().getValues();
  let found = false;
  let oldPlanName = '';
  
  for (let i = 1; i < companyData.length; i++) {
    if (companyData[i][0] === companyId) {
      found = true;
      oldPlanName = companyData[i][2];
      
      // 更新
      companyMaster.getRange(i + 1, 2).setValue(companyName);
      companyMaster.getRange(i + 1, 3).setValue(planName);
      if (startDate) {
        companyMaster.getRange(i + 1, 4).setValue(startDate);
      }
      
      // プランが変更された場合は変更履歴に記録
      if (oldPlanName !== planName) {
        const planChangeHistory = ss.getSheetByName(SHEET_NAMES.PLAN_CHANGE_HISTORY);
        if (planChangeHistory) {
          const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
          planChangeHistory.appendRow([today, companyId, oldPlanName, planName]);
        }
      }
      
      break;
    }
  }
  
  if (!found) {
    throw new Error(`会社ID「${companyId}」が見つかりません`);
  }
  
  console.log(`会社「${companyName}」(${companyId})の情報を更新しました`);
  
  return {
    success: true,
    message: `会社「${companyName}」の情報を更新しました`
  };
}

/**
 * 会社を削除
 */
function deleteCompany(companyId) {
  const ss = getSpreadsheet();
  const companyMaster = ss.getSheetByName(SHEET_NAMES.COMPANY_MASTER);
  const ticketBalance = ss.getSheetByName(SHEET_NAMES.TICKET_BALANCE);
  const usageHistory = ss.getSheetByName(SHEET_NAMES.USAGE_HISTORY);
  const planChangeHistory = ss.getSheetByName(SHEET_NAMES.PLAN_CHANGE_HISTORY);
  
  if (!companyMaster) {
    throw new Error('会社マスターシートが見つかりません');
  }
  
  // 会社情報を検索して削除
  const companyData = companyMaster.getDataRange().getValues();
  let companyName = '';
  let rowToDelete = -1;
  
  for (let i = 1; i < companyData.length; i++) {
    if (companyData[i][0] === companyId) {
      companyName = companyData[i][1];
      rowToDelete = i + 1;
      break;
    }
  }
  
  if (rowToDelete === -1) {
    throw new Error(`会社ID「${companyId}」が見つかりません`);
  }
  
  // 会社マスターから削除
  companyMaster.deleteRow(rowToDelete);
  
  // 関連データの削除（チケット残高）
  if (ticketBalance) {
    const balanceData = ticketBalance.getDataRange().getValues();
    // 後ろから削除（インデックスがずれないように）
    for (let i = balanceData.length - 1; i >= 1; i--) {
      if (balanceData[i][0] === companyId) {
        ticketBalance.deleteRow(i + 1);
      }
    }
  }
  
  // 関連データの削除（使用履歴）
  if (usageHistory) {
    const usageData = usageHistory.getDataRange().getValues();
    for (let i = usageData.length - 1; i >= 1; i--) {
      if (usageData[i][1] === companyId) {
        usageHistory.deleteRow(i + 1);
      }
    }
  }
  
  // 関連データの削除（プラン変更履歴）
  if (planChangeHistory) {
    const changeData = planChangeHistory.getDataRange().getValues();
    for (let i = changeData.length - 1; i >= 1; i--) {
      if (changeData[i][1] === companyId) {
        planChangeHistory.deleteRow(i + 1);
      }
    }
  }
  
  console.log(`会社「${companyName}」(${companyId})と関連データを削除しました`);
  
  return {
    success: true,
    message: `会社「${companyName}」を削除しました`
  };
}

/**
 * 会社のチケット最終利用日を取得
 * @param {string} companyId - 会社ID
 * @param {string} yearMonth - 対象年月（YYYY-MM形式）※オプション
 * @return {Object} 各メニューの最終利用日
 */
function getLastTicketUsageDates(companyId, yearMonth) {
  try {
    const ss = getSpreadsheet();
    const usageHistory = ss.getSheetByName(SHEET_NAMES.USAGE_HISTORY);
    
    if (!usageHistory) {
      Logger.log('使用履歴シートが見つかりません');
      return {
        幹細胞: null,
        施術: null,
        点滴: null
      };
    }
    
    const data = usageHistory.getDataRange().getValues();
    Logger.log('チケット同期処理data ${data}');
    const lastUsageDates = {
      幹細胞: null,
      施術: null,
      点滴: null
    };
    
    // ヘッダー行をスキップして、新しいものから順に検索
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const usageDate = row[0]; // 使用日時
      const rowCompanyId = row[1]; // 会社ID
      const menuType = row[2]; // メニュー
      
      // 会社IDが一致する場合
      if (rowCompanyId === companyId) {
        // yearMonthが指定されている場合は、その月のデータのみ対象
        if (yearMonth) {
          const usageDateStr = Utilities.formatDate(new Date(usageDate), 'Asia/Tokyo', 'yyyy-MM');
          if (usageDateStr !== yearMonth) {
            continue;
          }
        }
        
        // メニュータイプごとに最終利用日を更新（まだ設定されていない場合のみ）
        if (MENU_TYPES.includes(menuType) && !lastUsageDates[menuType]) {
          lastUsageDates[menuType] = usageDate;
        }
        
        // すべてのメニューの最終利用日が見つかったら終了
        if (lastUsageDates.幹細胞 && lastUsageDates.施術 && lastUsageDates.点滴) {
          break;
        }
      }
    }
    
    return lastUsageDates;
    
  } catch (error) {
    Logger.log('getLastTicketUsageDates エラー: ' + error.toString());
    return {
      幹細胞: null,
      施術: null,
      点滴: null
    };
  }
}