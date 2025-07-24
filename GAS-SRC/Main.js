/**
 * Medical Force API連携システム - メイン処理
 */

/**
 * スプレッドシートを開いた時の処理
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // カスタムメニューを作成
  ui.createMenu('Medical Force連携')
    .addItem('初期設定', 'showInitDialog')
    .addSeparator()
    .addSubMenu(ui.createMenu('データ同期')
      .addItem('患者マスタを同期', 'syncVisitorsMenu')
      .addItem('予約情報を同期', 'syncReservationsMenu')
      .addItem('メニュー情報を同期', 'syncMenusMenu')
      .addItem('すべてのデータを同期', 'syncAllDataMenu'))
    .addSeparator()
    .addSubMenu(ui.createMenu('MFデータ管理機能')
      .addItem('患者を登録', 'showCreatePatientDialog')
      .addItem('患者を検索', 'searchVisitorDialog')
      .addItem('予約を作成', 'createReservationDialog')
      .addItem('空き時間を確認', 'checkVacanciesDialog'))
    .addSeparator()
    .addSubMenu(ui.createMenu('患者データ管理')
      .addItem('予約から患者情報を取得', 'getPatientDataFromReservationsMenu')
      .addItem('カルテ番号検索テスト', 'testChartNumberSearchMenu')
      .addItem('患者データ完全性チェック', 'checkPatientDataCompletenessMenu')
      .addItem('患者情報一括更新', 'updatePatientsManuallyMenu'))
    .addSeparator()
    .addSubMenu(ui.createMenu('LINE連携管理')
      .addItem('会社別リンク生成', 'runCompanyLineLinkGeneration')
      .addItem('未連携者通知を送信', 'notifyUnlinkedCompanyVisitorsMenu')
      .addItem('未連携者通知テスト', 'testCompanyLineLinkNotificationMenu')
      .addItem('Flex Messageテスト送信', 'testFlexMessageSendMenu')
      .addSeparator()
      .addItem('グループID確認', 'checkLineGroupIdMenu')
      .addItem('グループID手動設定', 'setLineGroupIdManuallyMenu')
      .addItem('LINE連携設定確認', 'checkLineMemberLinkSettingsMenu')
      .addItem('通知設定を確認', 'checkNotificationSettingsMenu')
      .addItem('通知トリガーを設定', 'setupLineLinkNotificationTrigger')
      .addSeparator()
      .addItem('Messaging API設定確認', 'checkLineMessagingApiSettingsMenu')
      .addItem('Messaging API設定ガイド', 'showLineMessagingApiSetupGuideMenu'))
    .addSeparator()
    .addSubMenu(ui.createMenu('GAS管理機能')
      .addItem('メニュー管理', 'showMenuManagementDialog')
      .addItem('施術・メニュー管理', 'showTreatmentManagementDialog')
      .addItem('会社管理', 'showCompanyManagementDialog')
      .addItem('書類管理', 'showDocumentManagementDialog')
      .addItem('チケット管理', 'showTicketManagementDialog')
      .addItem('施術間隔管理', 'showTreatmentIntervalDialog')
      .addItem('通知管理', 'showNotificationManagementDialog')
      .addSeparator()
      .addItem('施術間隔データを移行', 'migrateTreatmentIntervalMenu'))
    .addSeparator()
    .addItem('設定', 'showSettingsDialog')
    .addItem('ヘルプ', 'showHelpDialog')
    .addToUi();
}

/**
 * 初期設定ダイアログを表示
 */
function showInitDialog() {
  const html = HtmlService.createHtmlOutputFromFile('InitDialog')
    .setWidth(600)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, '初期設定');
}

/**
 * シートを初期化
 */
function initializeSheets() {
  try {
    SpreadsheetManager.initializeAllSheets();
    SpreadsheetApp.getUi().alert('シートの初期化が完了しました。\n\n次に、スクリプトプロパティに以下を設定してください：\n- MEDICAL_FORCE_API_KEY: APIキー\n- CLINIC_ID: クリニックID');
    return { success: true };
  } catch (error) {
    Logger.log(error);
    return { success: false, error: error.toString() };
  }
}

/**
 * 患者マスタシートのみを初期化（PHP連携用の新列追加）
 */
function initializeVisitorsSheetOnly() {
  try {
    SpreadsheetManager.initializeVisitorsSheet();
    SpreadsheetApp.getUi().alert('患者マスタシートの初期化が完了しました。\n\nLINE表示名とLINEプロフィール画像URLの列が追加されました。');
    return { success: true };
  } catch (error) {
    Logger.log(error);
    SpreadsheetApp.getUi().alert('エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 患者マスタを同期（メニュー用）
 */
function syncVisitorsMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '患者マスタの同期', 
    '過去30日間に更新された患者情報を取得します。\nLINE IDを含む全ての患者情報が同期されます。\n\n実行しますか？', 
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      const service = new VisitorService();
      const count = service.syncVisitors(30); // 過去30日間の更新患者を取得
      ui.alert(
        '同期完了',
        `${count}件の患者情報を同期しました。\n\n` +
        `詳細はログで確認してください。`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
    }
  }
}

/**
 * 予約情報を同期（メニュー用）
 */
function syncReservationsMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('予約情報の同期', '予約情報を同期しますか？', ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    try {
      const service = new ReservationService();
      const count = service.syncReservations();
      ui.alert(`${count}件の予約情報を同期しました。`);
    } catch (error) {
      ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
    }
  }
}

/**
 * メニュー情報を同期（メニュー用）
 */
function syncMenusMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('メニュー情報の同期', 'メニュー情報を同期しますか？', ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    try {
      const service = new MenuService();
      const count = service.syncMenus();
      ui.alert(`${count}件のメニュー情報を同期しました。`);
    } catch (error) {
      ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
    }
  }
}

/**
 * すべてのデータを同期（UI確認なし）
 */
function syncAllData() {
  Logger.log('全データ同期を開始します...');
  
  try {
    let totalCount = 0;
    const startTime = new Date();
    
    // 同期状況をログシートに記録
    Utils.logToSheet('全データ同期を開始しました', 'INFO');
    
    // 患者情報
    Logger.log('患者情報を同期中...');
    Utils.logToSheet('患者情報の同期を開始...', 'INFO');
    const visitorService = new VisitorService();
    const visitorCount = visitorService.syncVisitors();
    totalCount += visitorCount;
    Logger.log(`患者情報: ${visitorCount}件`);
    Utils.logToSheet(`患者情報: ${visitorCount}件を同期完了`, 'SUCCESS');
    
    // 予約情報
    Logger.log('予約情報を同期中...');
    Utils.logToSheet('予約情報の同期を開始...', 'INFO');
    const reservationService = new ReservationService();
    const reservationCount = reservationService.syncReservations();
    totalCount += reservationCount;
    Logger.log(`予約情報: ${reservationCount}件`);
    Utils.logToSheet(`予約情報: ${reservationCount}件を同期完了`, 'SUCCESS');
    
    // メニュー情報
    Logger.log('メニュー情報を同期中...');
    Utils.logToSheet('メニュー情報の同期を開始...', 'INFO');
    const menuService = new MenuService();
    const menuCount = menuService.syncMenus();
    totalCount += menuCount;
    Logger.log(`メニュー情報: ${menuCount}件`);
    Utils.logToSheet(`メニュー情報: ${menuCount}件を同期完了`, 'SUCCESS');
    
    // 処理時間を計算
    const endTime = new Date();
    const processingTime = Math.round((endTime - startTime) / 1000);
    
    Logger.log(`同期完了 - 合計: ${totalCount}件 (処理時間: ${processingTime}秒)`);
    Utils.logToSheet(`全データ同期完了 - 合計: ${totalCount}件 (処理時間: ${processingTime}秒)`, 'SUCCESS');
    
    return {
      success: true,
      visitorCount: visitorCount,
      reservationCount: reservationCount,
      menuCount: menuCount,
      totalCount: totalCount,
      processingTime: processingTime
    };
  } catch (error) {
    Logger.log(`同期エラー: ${error.toString()}`);
    Utils.logToSheet(`全データ同期エラー: ${error.toString()}`, 'ERROR');
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * すべてのデータを同期（メニュー用）
 */
function syncAllDataMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('全データ同期', 'すべてのデータを同期しますか？\n\n時間がかかる場合があります。', ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    try {
      const result = syncAllData();
      
      if (result.success) {
        ui.alert('同期完了', `全データの同期が完了しました。\n\n患者: ${result.visitorCount}件\n予約: ${result.reservationCount}件\nメニュー: ${result.menuCount}件\n\n合計: ${result.totalCount}件\n処理時間: ${result.processingTime}秒\n\n詳細は「実行ログ」シートをご確認ください。`, ui.ButtonSet.OK);
      } else {
        ui.alert('エラー', result.error, ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
    }
  }
}



/**
 * 定期実行用のトリガー設定
 */
function setupTriggers() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // 毎日午前2時に自動同期
  ScriptApp.newTrigger('dailySync')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  
  // 1時間ごとに更新データを同期
  ScriptApp.newTrigger('hourlyUpdateSync')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('トリガーを設定しました');
}

/**
 * 日次自動同期
 */
function dailySync() {
  try {
    Logger.log('日次自動同期を開始します');
    
    const visitorService = new VisitorService();
    const reservationService = new ReservationService();
    const menuService = new MenuService();
    
    // 全データを同期
    visitorService.syncVisitors();
    reservationService.syncReservations();
    menuService.syncMenus();
    
    Utils.logToSheet('日次自動同期が完了しました', 'SUCCESS');
  } catch (error) {
    Utils.logToSheet('日次自動同期でエラーが発生しました', 'ERROR', error.toString());
  }
}

/**
 * 時間ごとの更新同期
 */
function hourlyUpdateSync() {
  try {
    Logger.log('更新データの同期を開始します');
    
    // 過去1時間の更新データを同期
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const updateDate = Utils.formatDate(oneHourAgo);
    
    const visitorService = new VisitorService();
    const reservationService = new ReservationService();
    
    visitorService.syncUpdatedVisitors(updateDate);
    reservationService.syncUpdatedReservations(updateDate);
    
    Utils.logToSheet('更新データの同期が完了しました', 'SUCCESS');
  } catch (error) {
    Utils.logToSheet('更新データの同期でエラーが発生しました', 'ERROR', error.toString());
  }
}

/**
 * 空き時間確認ダイアログを表示
 */
function checkVacanciesDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CheckVacanciesDialog')
    .setWidth(900)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '空き時間確認');
}

/**
 * ダイアログから空き時間を取得
 */
function getVacanciesFromDialog(params) {
  try {
    const service = new ReservationService();
    
    // パラメータ変換: date_from/date_to → epoch_from_keydate/epoch_to_keydate
    const apiParams = {
      clinic_id: Config.getClinicId(),
      epoch_from_keydate: params.date_from,
      epoch_to_keydate: params.date_to,
      time_spacing: '30' // 30分間隔
    };
    
    // スタッフIDが指定されている場合
    if (params.staff_id) {
      apiParams.staff_id = params.staff_id;
    }
    
    Logger.log(`空き時間取得パラメータ: ${JSON.stringify(apiParams)}`);
    
    // APIを呼び出し
    const response = service.getVacancies(apiParams);
    
    if (!response) {
      throw new Error('空き時間の取得に失敗しました');
    }
    
    return { vacancies: response };
  } catch (error) {
    Logger.log('空き時間取得エラー: ' + error.toString());
    throw new Error('空き時間の取得に失敗しました: ' + error.message);
  }
}

/**
 * ダイアログからスタッフ一覧を取得
 */
function getStaffsFromDialog() {
  try {
    // スタッフAPIが実装されていない場合のダミーデータ
    // TODO: 実際のスタッフAPIが実装されたら置き換える
    return [
      { staff_id: '1', name: 'スタッフA' },
      { staff_id: '2', name: 'スタッフB' },
      { staff_id: '3', name: 'スタッフC' }
    ];
  } catch (error) {
    Logger.log('スタッフ取得エラー: ' + error.toString());
    return [];
  }
}

/**
 * 患者登録ダイアログを表示
 */
function showCreatePatientDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CreatePatientDialog')
    .setWidth(800)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '患者登録');
}

/**
 * ダイアログから患者を登録
 */
function createPatientFromDialog(patientData) {
  try {
    const service = new VisitorService();
    const result = service.createVisitor(patientData);
    
    // 患者マスタシートも更新
    const syncCount = service.syncVisitors({ limit: 10 });
    Logger.log(`患者登録後、${syncCount}件の患者データを同期しました`);
    
    return {
      success: true,
      data: {
        visitor_id: result.visitor_id || result.id,
        name: result.name
      }
    };
  } catch (error) {
    Logger.log('患者登録エラー: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 患者検索ダイアログを表示
 */
function searchVisitorDialog() {
  const html = HtmlService.createHtmlOutputFromFile('SearchVisitorDialog')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, '患者検索');
}

/**
 * メニュー管理ダイアログを表示
 */
function showMenuManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('MenuManagementDialog')
    .setWidth(1000)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'メニュー管理');
}

/**
 * 施術・メニュー管理ダイアログを表示
 */
function showTreatmentManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('TreatmentManagementDialog')
    .setWidth(1200)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, '施術・メニュー管理');
}

/**
 * メニューカテゴリ一覧を取得
 */
function getMenuCategories() {
  const menuService = new MenuService();
  return menuService.getMenuCategories();
}

/**
 * メニューカテゴリを保存
 */
function saveMenuCategory(categoryData) {
  const menuService = new MenuService();
  return menuService.saveMenuCategory(categoryData);
}

/**
 * メニューカテゴリを削除
 */
function deleteMenuCategory(categoryId) {
  const menuService = new MenuService();
  return menuService.deleteMenuCategory(categoryId);
}

/**
 * カテゴリ付きメニュー一覧を取得
 */
function getMenusWithCategories() {
  const menuService = new MenuService();
  return menuService.getMenusWithCategories();
}

/**
 * メニューの表示順を更新
 */
function updateMenuOrder(menuId, newOrder) {
  const menuService = new MenuService();
  return menuService.updateMenuOrder(menuId, newOrder);
}

/**
 * メニューのカテゴリを更新
 */
function updateMenuCategory(menuId, categoryId) {
  const menuService = new MenuService();
  return menuService.updateMenuCategory(menuId, categoryId);
}

/**
 * 会社管理ダイアログを表示
 */
function showCompanyManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CompanyManagementDialog')
    .setWidth(900)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, '会社管理');
}

/**
 * ダイアログから会社一覧を取得（TicketManagement.js版にリダイレクト）
 */
function getCompaniesForDialog() {
  SpreadsheetManager.logExecution('INFO', 'getCompaniesForDialog開始', 'Main.js版');
  try {
    // キャッシュから取得を試みる
    const cached = companyCacheService.getCachedCompanies();
    if (cached) {
      companyCacheService.logCacheHit('companies_list', true);
      SpreadsheetManager.logExecution('SUCCESS', 'キャッシュから会社一覧取得', `${cached.length}社`);
      return { success: true, data: cached };
    }
    
    companyCacheService.logCacheHit('companies_list', false);
    
    // TicketManagement.jsのgetCompaniesForDialogTicket関数を使用
    if (typeof getCompaniesForDialogTicket === 'function') {
      SpreadsheetManager.logExecution('INFO', 'TicketManagement.js版を使用', 'getCompaniesForDialogTicket関数が存在');
      const result = getCompaniesForDialogTicket();
      
      // 結果の検証
      if (result && typeof result === 'object' && result.hasOwnProperty('success')) {
        SpreadsheetManager.logExecution('SUCCESS', 'TicketManagement.js版から正常な結果を取得', `success: ${result.success}, data件数: ${result.data ? result.data.length : 0}`);
        
        // 成功時はキャッシュに保存
        if (result.success && result.data) {
          companyCacheService.setCachedCompanies(result.data);
        }
        
        return result;
      } else {
        SpreadsheetManager.logExecution('WARNING', 'TicketManagement.js版から不正な結果', JSON.stringify(result));
        return getCompaniesForDialogBasic();
      }
    } else {
      SpreadsheetManager.logExecution('WARNING', 'TicketManagement.js版が見つからない', 'フォールバックを使用');
      return getCompaniesForDialogBasic();
    }
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', 'getCompaniesForDialog エラー', error.toString());
    // エラーが発生した場合もフォールバックを試行
    try {
      return getCompaniesForDialogBasic();
    } catch (fallbackError) {
      Logger.log('getCompaniesForDialog フォールバックエラー: ' + fallbackError.toString());
      SpreadsheetManager.logExecution('ERROR', 'すべての会社一覧取得方法が失敗', error.toString());
      return { success: false, error: 'すべての会社一覧取得方法が失敗しました: ' + error.toString() };
    }
  }
}

/**
 * 基本的な会社一覧取得（フォールバック用）
 */
function getCompaniesForDialogBasic() {
  try {
    SpreadsheetManager.logExecution('INFO', 'getCompaniesForDialogBasic開始', '基本会社一覧取得');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(Config.getSheetNames().companyMaster);
    
    if (!sheet) {
      SpreadsheetManager.logExecution('ERROR', '会社マスタシートが見つかりません', Config.getSheetNames().companyMaster);
      return { success: false, error: '会社マスタシートが見つかりません。初期化を実行してください。' };
    }
    
    // シートにデータがあるかチェック
    if (sheet.getLastRow() <= 1) {
      SpreadsheetManager.logExecution('INFO', '会社マスタにデータがありません', '空の配列を返す');
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const companies = [];
    
    SpreadsheetManager.logExecution('INFO', 'データ取得成功', `全${data.length}行、ヘッダーを除く${data.length - 1}行`);
    
    // ヘッダー行をスキップ
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // 会社IDが存在する場合
        companies.push({
          id: data[i][0],
          name: data[i][1] || '',
          plan: data[i][2] || '',
          stemCell: 0,
          treatment: 0,
          infusion: 0
        });
      }
    }
    
    SpreadsheetManager.logExecution('SUCCESS', 'getCompaniesForDialogBasic完了', `${companies.length}社の会社データを取得`);
    
    // 成功時はキャッシュに保存
    if (companies.length > 0) {
      companyCacheService.setCachedCompanies(companies);
    }
    
    return { success: true, data: companies };
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', 'getCompaniesForDialogBasicエラー', error.toString());
    return { success: false, error: 'フォールバック会社一覧取得に失敗しました: ' + error.toString() };
  }
}

/**
 * 利用可能なプラン一覧を取得（TicketManagement.js版にリダイレクト）
 */
function getAvailablePlansForDialog() {
  try {
    // TicketManagement.jsのgetAvailablePlansForDialogTicket関数を使用
    if (typeof getAvailablePlansForDialogTicket === 'function') {
      return getAvailablePlansForDialogTicket();
    } else {
      // フォールバック: プランマスターシートから取得
      return getAvailablePlansForDialogBasic();
    }
  } catch (error) {
    Logger.log('プラン一覧取得エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 基本的なプラン一覧取得（フォールバック用）
 */
function getAvailablePlansForDialogBasic() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const planMaster = ss.getSheetByName('プランマスター');
    
    if (!planMaster) {
      // シンプルなフォールバックプラン
      const plans = [
        { name: 'ベーシック', stemCell: 5, treatment: 10, infusion: 5 },
        { name: 'スタンダード', stemCell: 10, treatment: 20, infusion: 10 },
        { name: 'プレミアム', stemCell: 15, treatment: 30, infusion: 15 }
      ];
      return { success: true, data: plans };
    }
    
    const data = planMaster.getDataRange().getValues();
    const plans = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        plans.push({
          name: data[i][0],
          stemCell: data[i][1] || 0,
          treatment: data[i][2] || 0,
          infusion: data[i][3] || 0
        });
      }
    }
    
    return { success: true, data: plans };
  } catch (error) {
    Logger.log('基本プラン一覧取得エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// 以下の関数は1312-1343行目のプロキシ実装に統一されました
// - addCompanyFromDialog
// - updateCompanyFromDialog
// - deleteCompanyFromDialog

/**
 * メニュー管理ダイアログを表示
 */
function showMenuManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('MenuManagementDialog')
    .setWidth(1200)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'メニュー管理');
}

/**
 * 施術間隔管理ダイアログを表示
 */
function showTreatmentIntervalDialog() {
  const html = HtmlService.createHtmlOutputFromFile('TreatmentIntervalDialog')
    .setWidth(1200)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, '施術間隔管理');
}

/**
 * 通知管理ダイアログを表示
 */
function showNotificationManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('NotificationManagementDialog')
    .setWidth(1000)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, '通知管理');
}

/**
 * 施術間隔データを取得（ダイアログ用）
 */
function getTreatmentIntervalData() {
  const service = new TreatmentIntervalService();
  return service.getTreatmentIntervalData();
}

/**
 * 施術間隔を更新（ダイアログ用）
 */
function updateTreatmentInterval(fromMenu, toMenu, interval) {
  const service = new TreatmentIntervalService();
  return service.updateTreatmentInterval(fromMenu, toMenu, interval);
}

/**
 * 施術間隔をメニューと同期（ダイアログ用）
 */
function syncTreatmentIntervalWithMenus() {
  const service = new TreatmentIntervalService();
  return service.syncTreatmentIntervalWithMenus();
}

/**
 * 施術間隔データを移行（メニュー用）
 */
function migrateTreatmentIntervalMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '施術間隔データの移行',
    '既存のリスト形式の施術間隔データをマトリクス形式に移行します。\n\n' +
    '・現在のデータはバックアップされます\n' +
    '・移行後は新しいマトリクス形式で管理されます\n' +
    '・この操作は取り消せません\n\n' +
    '続行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      const result = SpreadsheetManager.migrateTreatmentIntervalToMatrix();
      ui.alert('移行完了', result, ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('エラー', '移行に失敗しました: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * 施術・メニュー管理ダイアログを表示
 */
function showTreatmentManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('TreatmentManagementDialog')
    .setWidth(1200)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, '施術・メニュー管理');
}

/**
 * チケット管理ダイアログを表示
 */
function showTicketManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('TicketManagementDialog')
    .setWidth(1200)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'チケット管理');
}

/**
 * 施術データを取得（ダイアログ用）
 */
function getTreatments() {
  const service = new TreatmentMasterService();
  return service.getAllTreatments();
}

/**
 * メニューデータを取得（ダイアログ用）
 */
function getMenus() {
  const service = new MenuService();
  return service.getMenusFromSheet();
}

// getCategoriesは3542行目で正しく定義されているため、ここは削除

/**
 * 施術をインポート（ダイアログ用）
 */
function importTreatments(csvContent) {
  const service = new TreatmentMasterService();
  return service.importFromCsv(csvContent);
}

/**
 * メニューをインポート（ダイアログ用）
 */
function importMenus(csvContent) {
  const service = new MenuService();
  return service.importMenusFromCsv(csvContent);
}

/**
 * 施術をエクスポート（ダイアログ用）
 */
function exportTreatments() {
  const service = new TreatmentMasterService();
  return service.exportToCsv();
}

/**
 * 施術からメニューを作成（ダイアログ用）
 */
function createMenuFromTreatment(treatmentId) {
  const service = new TreatmentMasterService();
  return service.createMenuFromTreatment(treatmentId);
}

/**
 * 会社別チケット情報を取得（ダイアログ用）
 */
function getCompanyTickets() {
  const service = new TicketManagementService();
  return service.getCompanyTickets();
}

/**
 * チケットを追加（ダイアログ用）
 */
function addCompanyTickets(ticketData) {
  const service = new TicketManagementService();
  return service.addCompanyTickets(ticketData);
}

/**
 * チケットを使用（ダイアログ用）
 */
function useCompanyTickets(ticketData) {
  const service = new TicketManagementService();
  return service.useCompanyTickets(ticketData);
}

/**
 * チケット履歴を取得（ダイアログ用）
 */
function getTicketHistory() {
  const service = new TicketManagementService();
  return service.getTicketHistory();
}

/**
 * メニューとチケットタイプ情報を取得（ダイアログ用）
 */
function getMenusWithTicketType() {
  const service = new TicketManagementService();
  return service.getMenusWithTicketType();
}

/**
 * メニューのチケットタイプを更新（ダイアログ用）
 */
function updateMenuTicketTypes(settings) {
  const service = new TicketManagementService();
  return service.updateMenuTicketTypes(settings);
}

/**
 * 会社メンバーを取得（ダイアログ用）
 */
function getCompanyMembers(companyId) {
  const service = new TicketManagementService();
  return service.getCompanyMembers(companyId);
}

/**
 * チケットを同期（ダイアログ用）
 */
function syncCompanyTickets() {
  const service = new TicketManagementService();
  return service.syncCompanyTickets();
}

/**
 * チケット履歴をエクスポート（ダイアログ用）
 */
function exportTicketHistory() {
  const service = new TicketManagementService();
  return service.exportTicketHistory();
}

/**
 * カルテ番号検索テスト（メニュー用）
 */
function testChartNumberSearchMenu() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    Logger.log('カルテ番号検索テストを実行中...');
    
    // テスト関数を実行
    const result = test_09_ChartNumberPatientSearch();
    
    if (result) {
      ui.alert('テスト完了', 'カルテ番号検索テストが完了しました。\n結果はGASのログで確認してください。', ui.ButtonSet.OK);
    } else {
      ui.alert('テスト失敗', 'カルテ番号検索テストに失敗しました。\nログを確認してください。', ui.ButtonSet.OK);
    }
    
  } catch (error) {
    Logger.log('カルテ番号検索テストエラー: ' + error.toString());
    ui.alert('エラー', 'テストの実行に失敗しました: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 患者データ完全性チェック（メニュー用）
 */
function checkPatientDataCompletenessMenu() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    Logger.log('患者データ完全性チェックを開始...');
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().visitors);
    if (!sheet) {
      ui.alert('エラー', '患者マスタシートが見つかりません', ui.ButtonSet.OK);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // ヘッダーのインデックスを取得
    const idIndex = headers.indexOf('visitor_id');
    const nameIndex = headers.indexOf('氏名');
    const karteIndex = headers.indexOf('カルテ番号');
    const lineIdIndex = headers.indexOf('LINE_ID');
    const phoneIndex = headers.indexOf('電話番号');
    const emailIndex = headers.indexOf('メールアドレス');
    
    let totalCount = 0;
    let missingLineId = 0;
    let missingKarte = 0;
    let missingPhone = 0;
    let missingEmail = 0;
    let missingContact = 0; // 電話もメールもない
    
    // データをチェック
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex]) {
        totalCount++;
        
        if (!data[i][lineIdIndex]) missingLineId++;
        if (!data[i][karteIndex]) missingKarte++;
        if (!data[i][phoneIndex]) missingPhone++;
        if (!data[i][emailIndex]) missingEmail++;
        if (!data[i][phoneIndex] && !data[i][emailIndex]) missingContact++;
        
        // 詳細ログ
        if (!data[i][lineIdIndex] || !data[i][karteIndex]) {
          Logger.log(`患者 ${data[i][nameIndex]} (ID: ${data[i][idIndex]}) - LINE_ID: ${data[i][lineIdIndex] || '未設定'}, カルテ番号: ${data[i][karteIndex] || '未設定'}`);
        }
      }
    }
    
    const report = `患者データ完全性チェック結果：\n\n` +
      `総患者数: ${totalCount}件\n` +
      `LINE_ID未設定: ${missingLineId}件 (${(missingLineId/totalCount*100).toFixed(1)}%)\n` +
      `カルテ番号未設定: ${missingKarte}件 (${(missingKarte/totalCount*100).toFixed(1)}%)\n` +
      `電話番号未設定: ${missingPhone}件 (${(missingPhone/totalCount*100).toFixed(1)}%)\n` +
      `メールアドレス未設定: ${missingEmail}件 (${(missingEmail/totalCount*100).toFixed(1)}%)\n` +
      `連絡先なし（電話・メール両方なし）: ${missingContact}件 (${(missingContact/totalCount*100).toFixed(1)}%)\n\n` +
      `詳細はログを確認してください。`;
    
    Logger.log(report);
    ui.alert('チェック完了', report, ui.ButtonSet.OK);
    
  } catch (error) {
    Logger.log('患者データ完全性チェックエラー: ' + error.toString());
    ui.alert('エラー', 'チェックの実行に失敗しました: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 患者情報一括更新（メニュー用）
 */
function updatePatientsManuallyMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '患者情報一括更新',
    'すべての患者情報を最新のAPIデータで更新します。\n' +
    '処理には時間がかかる可能性があります。\n\n' +
    '実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      Logger.log('患者情報一括更新を開始...');
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().visitors);
      if (!sheet) {
        ui.alert('エラー', '患者マスタシートが見つかりません', ui.ButtonSet.OK);
        return;
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIndex = headers.indexOf('visitor_id');
      
      if (idIndex === -1) {
        ui.alert('エラー', 'visitor_idカラムが見つかりません', ui.ButtonSet.OK);
        return;
      }
      
      const service = new VisitorService();
      let updatedCount = 0;
      let errorCount = 0;
      const batchSize = 50; // バッチサイズ
      
      // バッチ処理
      for (let i = 1; i < data.length; i += batchSize) {
        const batch = [];
        
        // バッチにvisitor_idを収集
        for (let j = i; j < Math.min(i + batchSize, data.length); j++) {
          if (data[j][idIndex]) {
            batch.push(data[j][idIndex]);
          }
        }
        
        if (batch.length > 0) {
          Logger.log(`バッチ ${Math.floor(i/batchSize) + 1}: ${batch.length}件の患者情報を更新中...`);
          
          // 各患者の詳細情報を取得して更新
          batch.forEach(visitorId => {
            try {
              const visitor = service.getVisitorDetailById(visitorId);
              if (visitor) {
                // 詳細情報の取得に成功
                updatedCount++;
                
                // LINE_IDとカルテ番号の状況をログ
                const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
                const karteNumber = service._extractKarteNumber(visitor);
                Logger.log(`更新: ${visitor.name || visitor.visitor_name} - LINE_ID: ${lineId || '未設定'}, カルテ番号: ${karteNumber || '未設定'}`);
              }
            } catch (error) {
              errorCount++;
              Logger.log(`患者ID ${visitorId} の更新失敗: ${error.toString()}`);
            }
          });
          
          // API制限対策のため待機
          Utilities.sleep(1000);
        }
      }
      
      // 更新されたデータをシートに反映
      service.syncVisitors(7); // 過去7日間の更新データを同期
      
      const resultMessage = `患者情報一括更新が完了しました。\n\n` +
        `更新成功: ${updatedCount}件\n` +
        `更新失敗: ${errorCount}件\n\n` +
        `詳細はログを確認してください。`;
      
      Logger.log(resultMessage);
      ui.alert('更新完了', resultMessage, ui.ButtonSet.OK);
      
    } catch (error) {
      Logger.log('患者情報一括更新エラー: ' + error.toString());
      ui.alert('エラー', '更新の実行に失敗しました: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * LINE連携リンク生成（メニュー用）
 */
function generateLineMemberLinkMenu() {
  const ui = SpreadsheetApp.getUi();
  
  // 会員番号の入力を求める
  const response = ui.prompt(
    'LINE連携リンク生成',
    '会員番号（カルテ番号）を入力してください:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const memberNumber = response.getResponseText().trim();
    
    if (!memberNumber) {
      ui.alert('エラー', '会員番号を入力してください。', ui.ButtonSet.OK);
      return;
    }
    
    // 会員名の入力（オプション）
    const nameResponse = ui.prompt(
      'LINE連携リンク生成',
      '会員名を入力してください（省略可）:',
      ui.ButtonSet.OK_CANCEL
    );
    
    const memberName = nameResponse.getSelectedButton() === ui.Button.OK 
      ? nameResponse.getResponseText().trim() 
      : '';
    
    try {
      const service = new LineMemberLinkService();
      const linkInfo = service.generateMemberLineLink(memberNumber, memberName);
      
      // 結果を表示
      const message = `LINE連携リンクを生成しました。\n\n` +
        `会員番号: ${memberNumber}\n` +
        `会員名: ${memberName || '未設定'}\n` +
        `有効期限: ${linkInfo.expiryTime.toLocaleString('ja-JP')}\n\n` +
        `以下のリンクをLINEで送信してください:\n\n` +
        `${linkInfo.url}`;
      
      // リンクをクリップボードにコピーするためのHTMLダイアログ
      const htmlContent = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>LINE連携リンクが生成されました</h3>
          <p><strong>会員番号:</strong> ${memberNumber}</p>
          <p><strong>会員名:</strong> ${memberName || '未設定'}</p>
          <p><strong>有効期限:</strong> ${linkInfo.expiryTime.toLocaleString('ja-JP')}</p>
          <p style="margin-top: 20px;"><strong>連携リンク:</strong></p>
          <textarea id="linkUrl" style="width: 100%; height: 100px; font-size: 12px;" readonly>${linkInfo.url}</textarea>
          <button onclick="copyLink()" style="margin-top: 10px; padding: 10px 20px; background: #06C755; color: white; border: none; border-radius: 5px; cursor: pointer;">リンクをコピー</button>
          <p id="copyMessage" style="color: green; display: none; margin-top: 10px;">リンクをコピーしました！</p>
          <script>
            function copyLink() {
              const textarea = document.getElementById('linkUrl');
              textarea.select();
              document.execCommand('copy');
              document.getElementById('copyMessage').style.display = 'block';
              setTimeout(() => {
                document.getElementById('copyMessage').style.display = 'none';
              }, 3000);
            }
          </script>
        </div>
      `;
      
      const html = HtmlService.createHtmlOutput(htmlContent)
        .setWidth(600)
        .setHeight(400);
      
      ui.showModalDialog(html, 'LINE連携リンク');
      
    } catch (error) {
      Logger.log('LINE連携リンク生成エラー: ' + error.toString());
      ui.alert('エラー', 'リンクの生成に失敗しました: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * LINE連携状況確認（メニュー用）
 */
function checkLineMemberLinkStatusMenu() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LINE会員連携管理');
    if (!sheet) {
      ui.alert('情報', 'LINE連携データがありません。', ui.ButtonSet.OK);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      ui.alert('情報', 'LINE連携データがありません。', ui.ButtonSet.OK);
      return;
    }
    
    // ステータス別に集計
    let total = 0;
    let unused = 0;
    let completed = 0;
    let expired = 0;
    
    const statusIndex = data[0].indexOf('ステータス');
    const expiryIndex = data[0].indexOf('有効期限');
    const now = new Date();
    
    for (let i = 1; i < data.length; i++) {
      total++;
      const status = data[i][statusIndex];
      const expiryTime = new Date(data[i][expiryIndex]);
      
      if (status === '紐付け完了') {
        completed++;
      } else if (now > expiryTime) {
        expired++;
      } else {
        unused++;
      }
    }
    
    const message = `LINE連携状況\n\n` +
      `総発行数: ${total}件\n` +
      `未使用: ${unused}件\n` +
      `紐付け完了: ${completed}件\n` +
      `期限切れ: ${expired}件`;
    
    ui.alert('連携状況', message, ui.ButtonSet.OK);
    
  } catch (error) {
    Logger.log('連携状況確認エラー: ' + error.toString());
    ui.alert('エラー', '状況確認に失敗しました: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 期限切れトークン削除（メニュー用）
 */
function cleanupExpiredTokensMenu() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '期限切れトークンの削除',
    '期限切れのトークンをすべて削除します。\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      const service = new LineMemberLinkService();
      const deletedCount = service.cleanupExpiredTokens();
      
      ui.alert(
        '削除完了',
        `${deletedCount}件の期限切れトークンを削除しました。`,
        ui.ButtonSet.OK
      );
      
    } catch (error) {
      Logger.log('期限切れトークン削除エラー: ' + error.toString());
      ui.alert('エラー', '削除に失敗しました: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * LINE連携機能テスト（メニュー用）
 */
function runLineMemberLinkTestMenu() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'LINE連携機能テスト',
    'LINE連携機能の総合テストを実行します。\nテストデータが作成されます。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      const result = runAllLineMemberLinkTests();
      
      const message = `テスト完了\n\n` +
        `実行テスト数: ${result.total}\n` +
        `成功: ${result.success}\n` +
        `失敗: ${result.failed}\n\n` +
        `詳細はログを確認してください。`;
      
      ui.alert('テスト結果', message, ui.ButtonSet.OK);
      
    } catch (error) {
      Logger.log('テスト実行エラー: ' + error.toString());
      ui.alert('エラー', 'テスト実行に失敗しました: ' + error.message, ui.ButtonSet.OK);
    }
  }
}


/**
 * 現在のデプロイURLを確認
 */
function checkCurrentDeploymentUrl() {
  Logger.log('========== デプロイURL確認 ==========');
  
  const currentUrl = ScriptApp.getService().getUrl();
  Logger.log(`現在のデプロイURL: ${currentUrl}`);
  
  // Script IDを取得
  const scriptId = ScriptApp.getScriptId();
  Logger.log(`Script ID: ${scriptId}`);
  
  // 最新デプロイかどうかのヒント
  if (currentUrl.includes('/exec')) {
    Logger.log('URLタイプ: 本番デプロイ');
  } else if (currentUrl.includes('/dev')) {
    Logger.log('URLタイプ: 開発用URL');
  }
  
  Logger.log('\n新しいデプロイが必要な場合:');
  Logger.log('1. GASエディタで「デプロイ」→「新しいデプロイ」');
  Logger.log('2. 「新しいデプロイ」を選択（既存の編集ではない）');
  Logger.log('3. デプロイ後、このURLをLINEに設定');
  
  return currentUrl;
}

/**
 * 正しいデプロイURLを取得（Apps Script API使用）
 */
function getActualDeploymentUrl() {
  try {
    const scriptId = ScriptApp.getScriptId();
    const token = ScriptApp.getOAuthToken();
    
    const url = `https://script.googleapis.com/v1/projects/${scriptId}/deployments`;
    const response = UrlFetchApp.fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}` 
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log('Apps Script API エラー: ' + response.getContentText());
      return null;
    }
    
    const data = JSON.parse(response.getContentText());
    const deployments = data.deployments || [];
    
    // Web Appデプロイメントを探す
    const webAppDeployment = deployments.find(d => 
      d.deploymentConfig && 
      d.deploymentConfig.manifestFileName === 'appsscript' &&
      d.deploymentId
    );
    
    if (webAppDeployment) {
      const execUrl = `https://script.google.com/macros/s/${webAppDeployment.deploymentId}/exec`;
      Logger.log('実際のデプロイURL: ' + execUrl);
      return execUrl;
    }
    
    Logger.log('Web Appデプロイメントが見つかりません');
    return null;
    
  } catch (error) {
    Logger.log('getActualDeploymentUrl エラー: ' + error.toString());
    return null;
  }
}

/**
 * デプロイURLをScript Propertyに保存・取得
 */
function manageDeploymentUrl(action, url) {
  const PROPERTY_NAME = 'DEPLOYMENT_URL';
  const scriptProperties = PropertiesService.getScriptProperties();
  
  if (action === 'set' && url) {
    scriptProperties.setProperty(PROPERTY_NAME, url);
    Logger.log('デプロイURLを保存しました: ' + url);
    return url;
  } else if (action === 'get') {
    const savedUrl = scriptProperties.getProperty(PROPERTY_NAME);
    if (savedUrl) {
      Logger.log('保存されたデプロイURL: ' + savedUrl);
    } else {
      Logger.log('デプロイURLが保存されていません');
    }
    return savedUrl;
  }
  
  return null;
}

/**
 * デプロイURLを手動で設定（一度だけ実行）
 */
function setDeploymentUrl() {
  const url = 'https://script.google.com/macros/s/AKfycbxGBXz_Ens1t6kXyvjz4mdGJSVR8lGNcc09li4EuQBPtGbJqK_C3hD_OMN8Nr4wAddUAg/exec';
  manageDeploymentUrl('set', url);
}

// メニュー管理用の関数（ダイアログ用）
function getMenuCategories() {
  const service = new MenuService();
  return service.getMenuCategories();
}

function getMenusWithCategories() {
  const service = new MenuService();
  return service.getMenusWithCategories();
}

function saveMenuCategory(categoryData) {
  const service = new MenuService();
  return service.saveMenuCategory(categoryData);
}

/**
 * メニューの詳細を更新（チケットタイプ、カテゴリ、表示順）
 */
function updateMenuDetails(menuData) {
  const service = new MenuManagementService();
  return service.updateMenuDetails(menuData);
}

function saveMenu(menuData) {
  const service = new MenuManagementService();
  return service.saveMenu(menuData);
}

function deleteMenu(menuId) {
  const service = new MenuManagementService();
  return service.deleteMenu(menuId);
}

function importMenusFromCSV(csvContent) {
  const service = new MenuManagementService();
  return service.importMenusFromCSV(csvContent);
}

function exportMenusToCSV() {
  const service = new MenuManagementService();
  return service.exportMenusToCSV();
}

/**
 * LINE連携設定確認（メニュー用）
 */
function checkLineMemberLinkSettingsMenu() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    Logger.log('LINE連携設定確認開始');
    
    // 1. スクリプトプロパティの確認
    const scriptProperties = PropertiesService.getScriptProperties();
    const channelId = scriptProperties.getProperty('LINE_CHANNEL_ID');
    const channelSecret = scriptProperties.getProperty('LINE_CHANNEL_SECRET');
    
    // 2. WebアプリのURLを取得（DEPLOYMENT_URLを優先）
    const deploymentUrl = scriptProperties.getProperty('DEPLOYMENT_URL');
    const currentUrl = ScriptApp.getService().getUrl();
    const webAppUrl = deploymentUrl || currentUrl;
    
    Logger.log(`DEPLOYMENT_URL: ${deploymentUrl}`);
    Logger.log(`現在のURL: ${currentUrl}`);
    Logger.log(`使用するURL: ${webAppUrl}`);
    
    // 3. 必要なコールバックURLのリストを生成
    const callbackUrls = [
      webAppUrl,
      webAppUrl + '?action=lineMemberCallback'
    ];
    
    // 4. HTMLで設定情報を表示
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LINE連携設定確認</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      line-height: 1.6;
    }
    .section {
      margin-bottom: 30px;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    .section h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #06C755;
      padding-bottom: 10px;
    }
    .url-box {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      margin: 10px 0;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      cursor: pointer;
    }
    .url-box:hover {
      background: #f0f0f0;
    }
    .status {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
    }
    .status.ok {
      background: #d4edda;
      color: #155724;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
    }
    .status.warning {
      background: #fff3cd;
      color: #856404;
    }
    .copy-button {
      background: #06C755;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin: 5px 0;
    }
    .copy-button:hover {
      background: #05A548;
    }
    .instructions {
      background: #e3f2fd;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h2>LINE連携設定確認</h2>
  
  <div class="section">
    <h3>1. スクリプトプロパティ設定状態</h3>
    <p><strong>LINE_CHANNEL_ID:</strong> 
      <span class="status ${channelId ? 'ok' : 'error'}">
        ${channelId ? '設定済み' : '未設定'}
      </span>
      ${channelId ? ` (${channelId})` : ''}
    </p>
    <p><strong>LINE_CHANNEL_SECRET:</strong> 
      <span class="status ${channelSecret ? 'ok' : 'error'}">
        ${channelSecret ? '設定済み' : '未設定'}
      </span>
    </p>
  </div>
  
  <div class="section">
    <h3>2. デプロイURL設定</h3>
    <p><strong>DEPLOYMENT_URL (スクリプトプロパティ):</strong> 
      <span class="status ${deploymentUrl ? 'ok' : 'warning'}">
        ${deploymentUrl ? '設定済み' : '未設定 (自動取得を使用)'}
      </span>
    </p>
    ${deploymentUrl ? `<div class="url-box" onclick="copyToClipboard(this.textContent)">${deploymentUrl}</div>` : ''}
    <p><strong>現在の自動取得URL:</strong></p>
    <div class="url-box" onclick="copyToClipboard(this.textContent)">${currentUrl || 'URLを取得できませんでした'}</div>
    ${currentUrl && currentUrl.includes('/dev') ? 
      '<div class="warning">⚠️ 開発環境のURL(/dev)が取得されています。本番環境のURL(/exec)をDEPLOYMENT_URLに設定することを推奨します。</div>' : ''}
  </div>
  
  <div class="section">
    <h3>3. 使用するWebアプリURL</h3>
    <p>LINE連携で実際に使用されるURLは以下の通りです：</p>
    <div class="url-box" onclick="copyToClipboard(this.textContent)">${webAppUrl || 'URLを取得できませんでした'}</div>
    <button class="copy-button" onclick="copyToClipboard('${webAppUrl}')">URLをコピー</button>
  </div>
  
  <div class="section">
    <h3>4. LINE Developersに登録すべきコールバックURL</h3>
    <p>以下のURLをすべてLINE DevelopersのコールバックURLに登録してください：</p>
    ${callbackUrls.map((url, index) => `
      <div>
        <strong>URL ${index + 1}:</strong>
        <div class="url-box" onclick="copyToClipboard(this.textContent)">${url}</div>
        <button class="copy-button" onclick="copyToClipboard('${url}')">このURLをコピー</button>
      </div>
    `).join('')}
  </div>
  
  <div class="instructions">
    <h4>LINE Developersでの設定手順</h4>
    <ol>
      <li><a href="https://developers.line.biz/console/" target="_blank">LINE Developers Console</a>にログイン</li>
      <li>該当するチャンネルを選択</li>
      <li>「LINE Login設定」タブを開く</li>
      <li>「コールバックURL」セクションで上記のURLをすべて追加</li>
      <li>変更を保存</li>
    </ol>
  </div>
  
  ${!channelId || !channelSecret ? `
    <div class="warning">
      <strong>⚠️ 注意:</strong> LINE_CHANNEL_IDまたはLINE_CHANNEL_SECRETが設定されていません。
      <br>GASエディタで「プロジェクトの設定」→「スクリプトプロパティ」から設定してください。
    </div>
  ` : ''}
  
  <div class="section">
    <h3>4. テスト用URL</h3>
    <p>設定が正しいか確認するためのテストURL：</p>
    <div class="url-box" onclick="copyToClipboard(this.textContent)">${webAppUrl}?action=testLineMember</div>
    <button class="copy-button" onclick="window.open('${webAppUrl}?action=testLineMember', '_blank')">テストURLを開く</button>
  </div>
  
  <script>
    function copyToClipboard(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      // コピー完了メッセージ
      const message = document.createElement('div');
      message.textContent = 'コピーしました！';
      message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 1000;';
      document.body.appendChild(message);
      setTimeout(() => message.remove(), 2000);
    }
  </script>
</body>
</html>
    `;
    
    const html = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(800)
      .setHeight(800);
    
    ui.showModalDialog(html, 'LINE連携設定確認');
    
  } catch (error) {
    Logger.log('LINE連携設定確認エラー: ' + error.toString());
    ui.alert('エラー', '設定確認に失敗しました: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 会社別LINE連携リンク管理ダイアログを表示
 */
function showCompanyLineLinkDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CompanyLineLinkDialog')
    .setWidth(850)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '会社別LINE連携リンク管理');
}

/**
 * 会社一覧を取得（ダイアログ用）
 */
function getCompanyList() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(Config.getSheetNames().companyMaster);
    
    if (!sheet) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const companies = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) { // 会社IDと会社名が存在する
        companies.push({
          id: data[i][0],
          name: data[i][1]
        });
      }
    }
    
    return companies;
  } catch (error) {
    Logger.log(`会社一覧取得エラー: ${error.toString()}`);
    throw error;
  }
}

/**
 * 会社の有効なLINE連携リンクを取得（ダイアログ用）
 */
function getActiveLinksForCompany(companyId) {
  try {
    const service = new CompanyLineLinkService();
    return service.getActiveLinksForCompany(companyId);
  } catch (error) {
    Logger.log(`アクティブリンク取得エラー: ${error.toString()}`);
    throw error;
  }
}

/**
 * 会社の来院者にLINE連携リンクを生成（ダイアログ用）
 */
async function generateLinksForCompany(companyId) {
  try {
    const service = new CompanyLineLinkService();
    
    // 会社IDでフィルタリングして生成
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(Config.getSheetNames().companyVisitors);
    
    if (!sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    const data = sheet.getDataRange().getValues();
    const results = {
      processed: 0,
      generated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    // バッチ更新用の配列
    const updateBatch = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 指定された会社IDのみ処理
      if (row[0] !== companyId) continue;
      
      results.processed++;
      
      try {
        // LINE_IDが空白かチェック
        if (row[4] && row[4].trim() !== '') {
          results.skipped++;
          continue;
        }
        
        const visitorId = row[2]; // visitor_id
        const visitorName = row[3]; // 氏名
        
        if (!visitorId) {
          results.errors++;
          continue;
        }
        
        // 既存リンクの有効期限チェック
        const existingExpire = row[10]; // K列: 有効期限
        if (existingExpire && new Date(existingExpire) > new Date()) {
          results.skipped++;
          results.details.push(`${visitorName}: 有効なリンク存在`);
          continue;
        }
        
        // 新規リンク生成（書き込みはしない）
        const linkResult = await service.generateLinkForVisitor(visitorId, i + 1);
        if (linkResult.success) {
          results.generated++;
          results.details.push(`${visitorName}: リンク生成成功`);
          
          // バッチ更新用データを追加
          updateBatch.push({
            rowIndex: i + 1,
            data: {
              expireTime: linkResult.expireTime,
              isUsed: false,
              status: 'リンク発行済み',
              linkCreatedAt: new Date(),
              linkUrl: linkResult.linkUrl
            }
          });
        } else {
          results.errors++;
          results.details.push(`${visitorName}: ${linkResult.error}`);
        }
        
      } catch (error) {
        results.errors++;
        Logger.log(`行${i + 1}処理エラー: ${error.toString()}`);
      }
    }
    
    // バッチで一括更新
    if (updateBatch.length > 0) {
      service.batchUpdateLinkData(updateBatch);
      Logger.log(`バッチ更新: ${updateBatch.length}件のリンクデータを一括更新`);
    }
    
    return results;
    
  } catch (error) {
    Logger.log(`会社別リンク生成エラー: ${error.toString()}`);
    throw error;
  }
}

/**
 * 会社別LINE連携リンク管理の7時実行（メニュー用）
 */
async function runCompanyLineLinkGeneration() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '会社別LINE連携リンク生成',
    'LINE_IDが空白の来院者に対してリンクを生成します。\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      const service = new CompanyLineLinkService();
      const result = await service.generateLinksForCompanyVisitors();
      
      ui.alert(
        '生成完了',
        `処理: ${result.processed}件\n生成: ${result.generated}件\nスキップ: ${result.skipped}件\nエラー: ${result.errors}件`,
        ui.ButtonSet.OK
      );
      
    } catch (error) {
      ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
    }
  }
}

/**
 * 毎朝7時の自動実行用（トリガー設定用）
 */
async function dailyCompanyLineLinkGeneration() {
  try {
    const service = new CompanyLineLinkService();
    const result = await service.generateLinksForCompanyVisitors();
    
    Logger.log(`日次リンク生成完了: 処理${result.processed}, 生成${result.generated}, スキップ${result.skipped}, エラー${result.errors}`);
    
    return result;
  } catch (error) {
    Logger.log(`日次リンク生成エラー: ${error.toString()}`);
    throw error;
  }
}

/**
 * 新規会社を追加
 */
function addCompanyFromDialog(formData) {
  SpreadsheetManager.logExecution('INFO', 'addCompanyFromDialog開始', 'Main.js版');
  
  try {
    SpreadsheetManager.logExecution('INFO', 'TicketManagement.js版を呼び出し', JSON.stringify(formData));
    const result = addCompanyFromDialogTicket(formData);
    
    if (result && result.success) {
      SpreadsheetManager.logExecution('SUCCESS', '会社追加成功', '会社名: ' + formData.companyName);
      // キャッシュを無効化
      companyCacheService.invalidateCompaniesCache();
    } else {
      SpreadsheetManager.logExecution('ERROR', '会社追加失敗', result ? result.error : '不明なエラー');
    }
    
    return result;
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', '会社追加エラー', error.toString());
    Logger.log('チケット管理システムが統合されていません: ' + error.toString());
    return { success: false, error: 'チケット管理システムが統合されていません。' };
  }
}

/**
 * 会社情報を更新
 */
function updateCompanyFromDialog(formData) {
  SpreadsheetManager.logExecution('INFO', 'updateCompanyFromDialog開始', 'Main.js版');
  
  try {
    SpreadsheetManager.logExecution('INFO', 'TicketManagement.js版を呼び出し', JSON.stringify(formData));
    const result = updateCompanyFromDialogTicket(formData);
    
    if (result && result.success) {
      SpreadsheetManager.logExecution('SUCCESS', '会社更新成功', '会社ID: ' + formData.companyId);
      // キャッシュを無効化
      companyCacheService.invalidateCompanyCache(formData.companyId);
    } else {
      SpreadsheetManager.logExecution('ERROR', '会社更新失敗', result ? result.error : '不明なエラー');
    }
    
    return result;
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', '会社更新エラー', error.toString());
    Logger.log('チケット管理システムが統合されていません: ' + error.toString());
    return { success: false, error: 'チケット管理システムが統合されていません。' };
  }
}

/**
 * 会社を削除
 */
function deleteCompanyFromDialog(companyId) {
  SpreadsheetManager.logExecution('INFO', 'deleteCompanyFromDialog開始', 'Main.js版 - 会社ID: ' + companyId);
  
  try {
    SpreadsheetManager.logExecution('INFO', 'TicketManagement.js版を呼び出し', '会社ID: ' + companyId);
    const result = deleteCompanyFromDialogTicket(companyId);
    
    if (result && result.success) {
      SpreadsheetManager.logExecution('SUCCESS', '会社削除成功', '会社ID: ' + companyId);
      // キャッシュを無効化
      companyCacheService.invalidateCompanyCache(companyId);
    } else {
      SpreadsheetManager.logExecution('ERROR', '会社削除失敗', result ? result.error : '不明なエラー');
    }
    
    return result;
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', '会社削除エラー', error.toString());
    Logger.log('チケット管理システムが統合されていません: ' + error.toString());
    return { success: false, error: 'チケット管理システムが統合されていません。' };
  }
}

/**
 * 会社に紐づく来院者一覧を取得
 */
function getCompanyVisitorsFromDialog(companyId) {
  console.log(`getCompanyVisitorsFromDialog開始 - 会社ID: ${companyId}`);
  try {
    const service = new CompanyVisitorService();
    const result = service.getCompanyVisitors(companyId);
    console.log(`getCompanyVisitorsFromDialog結果:`, result);
    console.log(`結果の型: ${typeof result}, 配列: ${Array.isArray(result)}`);
    
    // nullや未定義の場合は空配列を返す
    if (!result) {
      console.warn('CompanyVisitorServiceがnull/undefinedを返しました');
      return [];
    }
    
    // google.script.runで送信可能な形式に変換（シリアライズ）
    const serializedResult = JSON.parse(JSON.stringify(result));
    console.log('シリアライズ後のデータ:', serializedResult);
    
    return serializedResult;
  } catch (error) {
    console.error('会社別来院者取得エラー:', error);
    Logger.log('会社別来院者取得エラー: ' + error.toString());
    // エラーの場合は空配列を返す
    return [];
  }
}

/**
 * 会社の現在の設定（社長・秘書）を保存
 */
function saveCompanyCurrentSettings(companyId, settings, generateLineLinks = false) {
  console.log(`saveCompanyCurrentSettings開始 - 会社ID: ${companyId}`);
  console.log('保存する設定:', settings);
  console.log('LINE連携リンク生成:', generateLineLinks);
  
  try {
    const service = new CompanyVisitorService();
    
    // 1. 現在の会社の全来院者データを削除
    const existingVisitors = service.getCompanyVisitors(companyId);
    const removeChanges = existingVisitors.map(visitor => ({
      action: 'remove',
      data: { visitorId: visitor.visitorId }
    }));
    
    // 2. 新しい設定を追加する変更データを作成
    const addChanges = settings.map(setting => ({
      action: 'add',
      data: {
        visitorId: setting.visitorId,
        visitorName: setting.visitorName,
        memberType: setting.memberType,
        position: setting.position
      }
    }));
    
    // 3. 削除と追加を一括で実行
    const allChanges = [...removeChanges, ...addChanges];
    
    if (allChanges.length > 0) {
      const result = service.batchUpdateCompanyVisitors(companyId, allChanges);
      console.log('バッチ更新結果:', result);
      
      if (result.success) {
        // キャッシュを無効化
        if (typeof companyCacheService !== 'undefined') {
          companyCacheService.invalidateCompanyCache(companyId);
        }
        
        // LINE連携リンク生成が要求された場合
        if (generateLineLinks) {
          const linkService = new CompanyLineLinkService();
          const generatedLinks = [];
          
          // 新しく追加された役職者のLINE連携リンクを生成
          for (const setting of settings) {
            if (setting.position === '社長' || setting.position === '秘書') {
              try {
                // 既存のLINE IDがあるかチェック
                const companyVisitors = service.getCompanyVisitors(companyId);
                const visitor = companyVisitors.find(v => v.visitorId === setting.visitorId);
                
                if (!visitor || !visitor.lineId) {
                  // LINE連携リンクを生成
                  const linkResult = linkService.generateLinkForVisitor(setting.visitorId);
                  if (linkResult.success) {
                    generatedLinks.push({
                      visitorId: setting.visitorId,
                      visitorName: setting.visitorName,
                      position: setting.position,
                      linkUrl: linkResult.linkUrl,
                      expireTime: linkResult.expireTime
                    });
                  }
                }
              } catch (linkError) {
                console.error(`LINE連携リンク生成エラー (${setting.visitorName}):`, linkError);
              }
            }
          }
          
          // 生成されたリンク情報を結果に含める
          result.generatedLinks = generatedLinks;
        }
      }
      
      return result;
    } else {
      return { success: true, message: '変更がありませんでした' };
    }
    
  } catch (error) {
    console.error('会社設定保存エラー:', error);
    Logger.log('会社設定保存エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社一覧のキャッシュを無効化（更新ボタン用）
 */
function invalidateCompaniesCache() {
  console.log('invalidateCompaniesCacheを実行');
  try {
    companyCacheService.invalidateCompaniesCache();
    console.log('会社一覧のキャッシュを無効化しました');
    return { success: true };
  } catch (error) {
    console.error('キャッシュ無効化エラー:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社一覧を直接取得（キャッシュを使わない）
 */
function getCompaniesForDialogDirect() {
  console.log('getCompaniesForDialogDirect開始 - キャッシュを使わず直接取得');
  SpreadsheetManager.logExecution('INFO', 'getCompaniesForDialogDirect開始', 'キャッシュをバイパスして直接取得');
  
  // キャッシュを使わず、直接getCompaniesForDialogBasicを呼び出す
  return getCompaniesForDialogBasic();
}

/**
 * 全ての来院者を取得（会社への追加用）
 */
function getAllVisitorsForCompanyFromDialog() {
  try {
    // まずキャッシュから軽量データを取得
    const cached = companyCacheService.getCachedPatientNames();
    if (cached) {
      companyCacheService.logCacheHit('patient_names_light', true);
      SpreadsheetManager.logExecution('SUCCESS', 'キャッシュから患者名取得', `${cached.length}件`);
      return cached;
    }
    
    companyCacheService.logCacheHit('patient_names_light', false);
    
    const service = new CompanyVisitorService();
    const visitors = service.getAllVisitorsForCompany();
    
    // キャッシュに保存
    if (visitors && visitors.length > 0) {
      companyCacheService.setCachedPatientNames(visitors);
    }
    
    return visitors;
  } catch (error) {
    Logger.log('来院者一覧取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 会社に来院者を追加
 */
function addVisitorToCompanyFromDialog(companyId, companyName, visitorData) {
  try {
    const service = new CompanyVisitorService();
    return service.addVisitorToCompany(companyId, companyName, visitorData);
  } catch (error) {
    Logger.log('来院者追加エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社の来院者情報を更新
 */
function updateCompanyVisitorFromDialog(companyId, visitorId, updateData) {
  try {
    const service = new CompanyVisitorService();
    return service.updateCompanyVisitor(companyId, visitorId, updateData);
  } catch (error) {
    Logger.log('来院者更新エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社から来院者を削除
 */
function removeVisitorFromCompanyFromDialog(companyId, visitorId) {
  try {
    const service = new CompanyVisitorService();
    return service.removeVisitorFromCompany(companyId, visitorId);
  } catch (error) {
    Logger.log('来院者削除エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社の代表者を設定
 */
function setCompanyRepresentativeFromDialog(companyId, visitorId) {
  try {
    const service = new CompanyVisitorService();
    return service.setCompanyRepresentative(companyId, visitorId);
  } catch (error) {
    Logger.log('代表者設定エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社の秘書を設定
 */
function setCompanySecretaryFromDialog(companyId, visitorId) {
  try {
    const service = new CompanyVisitorService();
    return service.setCompanySecretary(companyId, visitorId);
  } catch (error) {
    Logger.log('秘書設定エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 役職制限をチェック
 */
function checkPositionLimitsFromDialog(companyId, position, excludeVisitorId = null) {
  try {
    const service = new CompanyVisitorService();
    return service.checkPositionLimits(companyId, position, excludeVisitorId);
  } catch (error) {
    Logger.log('役職制限チェックエラー: ' + error.toString());
    return { canAssign: false, existing: [], message: error.toString() };
  }
}

/**
 * 新規来院者を作成（会社管理から）
 */
function createVisitorFromCompanyDialog(visitorData) {
  try {
    const service = new CompanyVisitorService();
    return service.createNewVisitor(visitorData);
  } catch (error) {
    Logger.log('来院者作成エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社来院者の一括更新（ダイアログから）
 */
function batchUpdateCompanyVisitorsFromDialog(companyId, changes) {
  try {
    SpreadsheetManager.logExecution('INFO', 'batchUpdateCompanyVisitorsFromDialog開始', `会社ID: ${companyId}, 変更数: ${changes.length}`);
    
    const service = new CompanyVisitorService();
    const result = service.batchUpdateCompanyVisitors(companyId, changes);
    
    SpreadsheetManager.logExecution('SUCCESS', '一括更新完了', `${changes.length}件の変更を処理`);
    return result;
  } catch (error) {
    SpreadsheetManager.logExecution('ERROR', 'batchUpdateCompanyVisitorsFromDialog エラー', error.toString());
    Logger.log('一括更新エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * ダイアログから患者検索を実行
 */
function searchVisitorsFromDialog(searchParams) {
  try {
    const service = new VisitorService();
    
    // 患者マスタシートから検索を実行
    const response = service.searchVisitorsFromSheet(searchParams);
    
    if (!response || !response.items) {
      return [];
    }
    
    // 結果を整形（既に整形済みなので、そのまま返す）
    return response.items;
    
  } catch (error) {
    Logger.log('患者検索エラー: ' + error.toString());
    throw new Error('患者検索に失敗しました: ' + error.message);
  }
}

/**
 * 予約作成ダイアログを表示
 */
function createReservationDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CreateReservationDialog')
    .setWidth(700)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, '予約作成');
}

/**
 * ダイアログからメニュー一覧を取得
 */
function getMenusFromDialog() {
  try {
    const apiClient = new ApiClient();
    const response = apiClient.getMenus();
    
    if (response.success && response.data) {
      return response.data.items || [];
    }
    return [];
  } catch (error) {
    Logger.log('メニュー取得エラー: ' + error.toString());
    return [];
  }
}

/**
 * ダイアログから患者情報をIDで取得
 */
function getVisitorByIdFromDialog(visitorId) {
  try {
    const service = new VisitorService();
    return service.getVisitorById(visitorId);
  } catch (error) {
    Logger.log('患者取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログから予約を作成
 */
function createReservationFromDialog(reservationData) {
  try {
    const service = new ReservationService();
    const result = service.createReservation(reservationData);
    
    // 予約シートを更新
    service.syncReservations();
    
    return result;
  } catch (error) {
    Logger.log('予約作成エラー: ' + error.toString());
    throw error;
  }
}

/**
 * テスト関数（開発用）
 */
function testConnection() {
  try {
    const apiClient = new ApiClient();
    const response = apiClient.get(apiClient.config.endpoints.clinics, {
      clinic_id: Config.getClinicId()
    });
    
    if (response.success) {
      Logger.log('接続テスト成功');
      Logger.log(response.data);
      return true;
    } else {
      Logger.log('接続テスト失敗');
      return false;
    }
  } catch (error) {
    Logger.log('接続エラー: ' + error.toString());
    return false;
  }
}

/**
 * 設定ダイアログを表示
 */
function showSettingsDialog() {
  const html = HtmlService.createHtmlOutputFromFile('SettingsDialog')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, '設定');
}

/**
 * 設定情報を取得（ダイアログ用）
 */
function getSettingsForDialog() {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const properties = scriptProperties.getProperties();
    
    return {
      hasClientId: !!properties.MEDICAL_FORCE_CLIENT_ID,
      hasClientSecret: !!properties.MEDICAL_FORCE_CLIENT_SECRET,
      clinicId: properties.CLINIC_ID || '',
      // トークンの状態
      hasAccessToken: !!properties.MEDICAL_FORCE_ACCESS_TOKEN,
      tokenExpiry: properties.MEDICAL_FORCE_TOKEN_EXPIRY || '',
      // その他の設定
      syncInterval: properties.SYNC_INTERVAL || 'hourly',
      maxRecords: properties.MAX_RECORDS || '100'
    };
  } catch (error) {
    Logger.log('設定取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * 設定を保存（ダイアログから）
 */
function saveSettingsFromDialog(settings) {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    
    // CLINIC_IDの更新
    if (settings.clinicId) {
      scriptProperties.setProperty('CLINIC_ID', settings.clinicId);
    }
    
    // 同期間隔の設定
    if (settings.syncInterval) {
      scriptProperties.setProperty('SYNC_INTERVAL', settings.syncInterval);
    }
    
    // 最大取得件数の設定
    if (settings.maxRecords) {
      scriptProperties.setProperty('MAX_RECORDS', settings.maxRecords);
    }
    
    // 認証情報の更新（既存の値がない場合のみ）
    if (settings.clientId && !scriptProperties.getProperty('MEDICAL_FORCE_CLIENT_ID')) {
      scriptProperties.setProperty('MEDICAL_FORCE_CLIENT_ID', settings.clientId);
    }
    
    if (settings.clientSecret && !scriptProperties.getProperty('MEDICAL_FORCE_CLIENT_SECRET')) {
      scriptProperties.setProperty('MEDICAL_FORCE_CLIENT_SECRET', settings.clientSecret);
    }
    
    return { success: true, message: '設定を保存しました。' };
  } catch (error) {
    Logger.log('設定保存エラー: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * トークンキャッシュをクリア（設定画面から）
 */
function clearTokenCacheFromDialog() {
  try {
    TokenManager.clearTokenCache();
    return { success: true, message: 'トークンキャッシュをクリアしました。' };
  } catch (error) {
    Logger.log('トークンクリアエラー: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * ヘルプダイアログを表示
 */
function showHelpDialog() {
  const html = HtmlService.createHtmlOutputFromFile('HelpDialog')
    .setWidth(600)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'ヘルプ');
}

/**
 * 書類管理ダイアログを表示
 */
function showDocumentManagementDialog() {
  const html = HtmlService.createHtmlOutputFromFile('DocumentManagementDialog')
    .setWidth(1000)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '書類管理');
}

/**
 * ダイアログから患者一覧を取得（書類管理用）
 */
function getVisitorsForDocumentDialog() {
  try {
    const documentService = new DocumentService();
    return documentService.getVisitorsForDropdown();
  } catch (error) {
    Logger.log('患者一覧取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログから書類一覧を取得
 */
function getDocumentsFromDialog(filters) {
  try {
    const documentService = new DocumentService();
    return documentService.getDocuments(filters);
  } catch (error) {
    Logger.log('書類一覧取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログから書類を追加
 */
function addDocumentFromDialog(documentData) {
  try {
    const documentService = new DocumentService();
    return documentService.addDocument(documentData);
  } catch (error) {
    Logger.log('書類追加エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログから書類を更新
 */
function updateDocumentFromDialog(documentId, updateData) {
  try {
    const documentService = new DocumentService();
    return documentService.updateDocument(documentId, updateData);
  } catch (error) {
    Logger.log('書類更新エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログから書類を削除
 */
function deleteDocumentFromDialog(documentId) {
  try {
    const documentService = new DocumentService();
    return documentService.deleteDocument(documentId);
  } catch (error) {
    Logger.log('書類削除エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログからフォルダ一覧を取得
 */
function getFoldersFromDialog(filters) {
  try {
    const documentService = new DocumentService();
    return documentService.getFolders(filters);
  } catch (error) {
    Logger.log('フォルダ一覧取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログからフォルダを追加
 */
function addFolderFromDialog(folderData) {
  try {
    const documentService = new DocumentService();
    return documentService.addFolder(folderData);
  } catch (error) {
    Logger.log('フォルダ追加エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログからフォルダを更新
 */
function updateFolderFromDialog(folderId, updateData) {
  try {
    const documentService = new DocumentService();
    return documentService.updateFolder(folderId, updateData);
  } catch (error) {
    Logger.log('フォルダ更新エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログからフォルダを削除
 */
function deleteFolderFromDialog(folderId) {
  try {
    const documentService = new DocumentService();
    return documentService.deleteFolder(folderId);
  } catch (error) {
    Logger.log('フォルダ削除エラー: ' + error.toString());
    throw error;
  }
}

/**
 * ダイアログ用フォルダドロップダウンデータを取得
 */
function getFoldersForDocumentDropdown() {
  try {
    const documentService = new DocumentService();
    return documentService.getFoldersForDropdown();
  } catch (error) {
    Logger.log('フォルダドロップダウンデータ取得エラー: ' + error.toString());
    return [];
  }
}

/**
 * チケット使用ダイアログを表示
 */
function showTicketUsageDialog() {
  const html = HtmlService.createHtmlOutputFromFile('TicketUsageDialog')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'チケット使用');
}

/**
 * プラン変更ダイアログを表示
 */
function showPlanChangeDialog() {
  const html = HtmlService.createHtmlOutputFromFile('PlanChangeDialog')
    .setWidth(700)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'プラン変更');
}

/**
 * チケットレポートダイアログを表示
 */
function showTicketReportDialog() {
  // チケット管理システムのレポートダイアログを使用
  const html = HtmlService.createHtmlOutputFromFile('report_dialog')
    .setWidth(900)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '月次レポート');
}

/**
 * チケット管理システムの関数をブリッジ
 */
function useTicketFromDialog(companyId, menuType, useCount, userName, memo) {
  try {
    return useTicket(companyId, menuType, useCount, userName, memo);
  } catch (error) {
    Logger.log('チケット使用エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * プラン変更をダイアログから実行
 */
function changePlanFromDialog(companyId, newPlan) {
  try {
    return changePlan(companyId, newPlan);
  } catch (error) {
    Logger.log('プラン変更エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 月次レポートを生成
 */
function generateMonthlyReportFromDialog(yearMonth) {
  try {
    return generateMonthlyReport(yearMonth);
  } catch (error) {
    Logger.log('レポート生成エラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 会社のチケット残高を取得
 */
function getTicketBalanceForCompany(companyId, yearMonth) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketBalance = ss.getSheetByName('チケット残高');
    if (!ticketBalance) {
      throw new Error('チケット残高シートが見つかりません');
    }
    
    const data = ticketBalance.getDataRange().getValues();
    
    // 該当企業の指定月のデータを検索
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === companyId && data[i][1] === yearMonth) {
        // 最終利用日情報を取得
        const lastUsageDates = getLastTicketUsageDates(companyId, yearMonth);
        
        return {
          幹細胞: {
            付与: data[i][2],
            使用: data[i][3],
            残: data[i][4],
            最終利用日: lastUsageDates.幹細胞
          },
          施術: {
            付与: data[i][5],
            使用: data[i][6],
            残: data[i][7],
            最終利用日: lastUsageDates.施術
          },
          点滴: {
            付与: data[i][8],
            使用: data[i][9],
            残: data[i][10],
            最終利用日: lastUsageDates.点滴
          }
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('チケット残高取得エラー: ' + error.toString());
    throw error;
  }
}

/**
 * visitor_idからカルテ番号を取得するテスト関数
 */
function getChartNumberTest() {
  const visitorService = new VisitorService();
  const visitorId = 'a893178f-2d09-4b3c-8e5c-65de7acf2f40';
  
  Logger.log(`visitor_id ${visitorId} の患者情報を取得中...`);
  
  try {
    const patient = visitorService.getVisitorById(visitorId);
    
    if (patient) {
      // より詳細なカルテ番号の抽出を試行
      let chartNumber = '';
      
      // 1. 直接フィールドをチェック
      if (patient.chart_number) {
        chartNumber = patient.chart_number;
        Logger.log(`chart_numberフィールドから取得: ${chartNumber}`);
      } else if (patient.karte_number) {
        chartNumber = patient.karte_number;
        Logger.log(`karte_numberフィールドから取得: ${chartNumber}`);
      } else if (patient.karte_numbers) {
        Logger.log(`karte_numbersフィールドの内容: ${JSON.stringify(patient.karte_numbers)}`);
        
        // 2. karte_numbers配列の処理
        if (Array.isArray(patient.karte_numbers)) {
          for (const karteObj of patient.karte_numbers) {
            if (typeof karteObj === 'object' && karteObj !== null) {
              Logger.log(`karte_numbersオブジェクト: ${JSON.stringify(karteObj)}`);
              
              // CLUTIReFINEクリニックのカルテ番号を探す
              if (karteObj['CLUTIReFINEクリニック']) {
                chartNumber = karteObj['CLUTIReFINEクリニック'];
                Logger.log(`CLUTIReFINEクリニックのカルテ番号: ${chartNumber}`);
                break;
              } else {
                // 他のキーも確認
                const keys = Object.keys(karteObj);
                if (keys.length > 0) {
                  chartNumber = karteObj[keys[0]];
                  Logger.log(`その他のカルテ番号 (${keys[0]}): ${chartNumber}`);
                  break;
                }
              }
            }
          }
        }
      }
      
      // 3. columns配列からカルテ番号を検索
      if (!chartNumber && patient.columns && Array.isArray(patient.columns)) {
        Logger.log(`columns配列を検索中... (${patient.columns.length}個のカラム)`);
        
        for (const column of patient.columns) {
          Logger.log(`カラム: ${column.column_name}, クリニック: ${column.clinic_name}, 値: ${JSON.stringify(column.values)}`);
          
          // カルテ番号らしいカラムを検索
          const columnName = column.column_name || '';
          if (columnName === 'カルテ番号' || 
              columnName === 'chart_number' ||
              columnName === 'karte_number' ||
              columnName.includes('カルテ') ||
              columnName.includes('chart') ||
              columnName.includes('番号')) {
            
            if (column.values && Array.isArray(column.values) && column.values.length > 0) {
              chartNumber = column.values[0];
              Logger.log(`columns配列から取得: ${chartNumber} (カラム名: ${columnName})`);
              break;
            }
          }
        }
      }
      
      // 4. VisitorServiceの_extractKarteNumberメソッドも試す
      if (!chartNumber) {
        try {
          chartNumber = visitorService._extractKarteNumber(patient);
          Logger.log(`_extractKarteNumberメソッドから取得: ${chartNumber}`);
        } catch (e) {
          Logger.log(`_extractKarteNumberエラー: ${e.toString()}`);
        }
      }
      
      Logger.log(`=== 患者情報 ===`);
      Logger.log(`患者名: ${patient.name || patient.visitor_name || '不明'}`);
      Logger.log(`最終カルテ番号: ${chartNumber || '未設定'}`);
      Logger.log(`電話番号: ${patient.phone || '未設定'}`);
      Logger.log(`メール: ${patient.email || '未設定'}`);
      Logger.log(`=== 生データ ===`);
      Logger.log(JSON.stringify(patient, null, 2));
      
      return {
        visitorId: visitorId,
        name: patient.name || patient.visitor_name || '',
        chartNumber: chartNumber,
        found: true
      };
    } else {
      Logger.log('患者が見つかりませんでした');
      return {
        visitorId: visitorId,
        found: false
      };
    }
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return {
      visitorId: visitorId,
      error: error.toString(),
      found: false
    };
  }
}

/**
 * 予約IDからカルテ番号を取得するテスト関数
 */
function testGetChartNumberFromReservation() {
  // テスト用の予約ID（実際の予約IDに置き換えてください）
  const reservationId = 'test-reservation-id';
  
  Logger.log(`予約ID ${reservationId} からカルテ番号を取得するテストを開始`);
  
  try {
    const reservationService = new ReservationService();
    const chartNumber = reservationService.getChartNumberFromReservation(reservationId);
    
    Logger.log(`=== テスト結果 ===`);
    Logger.log(`予約ID: ${reservationId}`);
    Logger.log(`カルテ番号: ${chartNumber || '取得できませんでした'}`);
    
    return {
      reservationId: reservationId,
      chartNumber: chartNumber,
      success: true
    };
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return {
      reservationId: reservationId,
      error: error.toString(),
      success: false
    };
  }
}

/**
 * OAuth認証テスト（開発用）
 */
function testOAuthAuthentication() {
  try {
    // 認証情報の確認
    if (!TokenManager.hasCredentials()) {
      Logger.log('認証情報が設定されていません');
      Logger.log('スクリプトプロパティに以下を設定してください：');
      Logger.log('- MEDICAL_FORCE_CLIENT_ID');
      Logger.log('- MEDICAL_FORCE_CLIENT_SECRET');
      return false;
    }
    
    // アクセストークンの取得テスト
    const token = TokenManager.getAccessToken();
    Logger.log('アクセストークン取得成功');
    Logger.log(`トークン（最初の20文字）: ${token.substring(0, 20)}...`);
    
    // API呼び出しテスト
    const apiClient = new ApiClient();
    const response = apiClient.get(apiClient.config.endpoints.visitors, {
      clinic_id: Config.getClinicId(),
      limit: 1
    });
    
    if (response.success) {
      Logger.log('API呼び出し成功');
      return true;
    } else {
      Logger.log('API呼び出し失敗');
      return false;
    }
  } catch (error) {
    Logger.log('OAuth認証テストエラー: ' + error.toString());
    return false;
  }
}

/**
 * 予約データから患者情報を取得（メニュー用）
 */
function getPatientDataFromReservationsMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '予約データから患者情報を取得',
    '予約データから患者情報（カルテ番号を含む）を取得します。\n処理には時間がかかる場合があります。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      const result = getPatientDataFromReservations();
      ui.alert(
        '処理完了',
        `処理が完了しました。\n\n` +
        `処理した予約数: ${result.reservationCount}件\n` +
        `見つかった患者数: ${result.patientCount}件\n` +
        `カルテ番号取得数: ${result.chartNumberCount}件\n\n` +
        `詳細は「予約患者詳細」シートをご確認ください。`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
    }
  }
}

/**
 * 予約データから患者情報を取得する本体
 */
function getPatientDataFromReservations() {
  Logger.log('予約データから患者情報の取得を開始');
  
  // 1. 予約シートから予約データを取得
  const reservationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().reservations);
  if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
    throw new Error('予約データが見つかりません。先に予約情報を同期してください。');
  }
  
  const reservationData = reservationSheet.getDataRange().getValues();
  const headers = reservationData[0];
  
  // ヘッダーの内容をログに出力してデバッグ
  Logger.log(`予約シートのヘッダー: ${JSON.stringify(headers)}`);
  
  // visitor_id または 患者ID を探す
  let visitorIdIndex = headers.indexOf('visitor_id');
  if (visitorIdIndex === -1) {
    visitorIdIndex = headers.indexOf('患者ID');
  }
  
  const visitorNameIndex = headers.indexOf('患者名');
  const reservationDateIndex = headers.indexOf('予約日');
  
  if (visitorIdIndex === -1) {
    // より詳細なエラーメッセージ
    throw new Error(`予約データに患者IDが見つかりません。\n現在のヘッダー: ${headers.join(', ')}\n\n予約情報を同期してからもう一度お試しください。`);
  }
  
  // 2. ユニークな患者IDを抽出
  const visitorMap = new Map(); // visitor_id -> {name, firstDate, lastDate, count}
  
  for (let i = 1; i < reservationData.length; i++) {
    const visitorId = reservationData[i][visitorIdIndex];
    if (!visitorId || visitorId === '') {
      Logger.log(`行 ${i + 1}: 患者IDが空のためスキップ`);
      continue;
    }
    
    const visitorName = visitorNameIndex !== -1 ? reservationData[i][visitorNameIndex] : '';
    const reservationDate = reservationDateIndex !== -1 ? reservationData[i][reservationDateIndex] : '';
    
    if (visitorMap.has(visitorId)) {
      const visitor = visitorMap.get(visitorId);
      visitor.count++;
      if (reservationDate && reservationDate < visitor.firstDate) {
        visitor.firstDate = reservationDate;
      }
      if (reservationDate && reservationDate > visitor.lastDate) {
        visitor.lastDate = reservationDate;
      }
    } else {
      visitorMap.set(visitorId, {
        name: visitorName,
        firstDate: reservationDate,
        lastDate: reservationDate,
        count: 1
      });
    }
  }
  
  // 患者IDが1件も見つからない場合のチェック
  if (visitorMap.size === 0) {
    throw new Error('予約データに有効な患者IDが見つかりません。予約情報を確認してください。');
  }
  
  Logger.log(`ユニークな患者数: ${visitorMap.size}`);
  
  // 3. 各患者の詳細情報を取得
  const patientDetails = [];
  const visitorService = new VisitorService();
  let processedCount = 0;
  let chartNumberCount = 0;
  
  visitorMap.forEach((visitorInfo, visitorId) => {
    try {
      // 患者詳細を取得
      const patient = visitorService.getVisitorById(visitorId);
      
      if (patient) {
        const chartNumber = patient.chart_number || patient.karte_number || patient.karte_numbers || '';
        if (chartNumber) {
          chartNumberCount++;
        }
        
        patientDetails.push({
          visitor_id: visitorId,
          name: patient.name || visitorInfo.name,
          chart_number: chartNumber,
          reservation_count: visitorInfo.count,
          first_reservation: visitorInfo.firstDate,
          last_reservation: visitorInfo.lastDate,
          phone: patient.phone || '',
          email: patient.email || ''
        });
        
        processedCount++;
        Logger.log(`処理済み: ${processedCount}/${visitorMap.size} - ${patient.name} (カルテ番号: ${chartNumber})`);
      }
      
      // API制限を考慮
      if (processedCount % 10 === 0) {
        Utilities.sleep(500);
      }
    } catch (error) {
      Logger.log(`患者ID ${visitorId} の取得エラー: ${error.toString()}`);
    }
  });
  
  // 4. 結果をシートに出力
  const resultSheet = Utils.getOrCreateSheet('予約患者詳細');
  Utils.clearSheet(resultSheet, true);
  
  // ヘッダー設定
  const resultHeaders = [
    'visitor_id',
    '氏名',
    'カルテ番号',
    '予約件数',
    '初回予約日',
    '最終予約日',
    '電話番号',
    'メールアドレス'
  ];
  Utils.setHeaders(resultSheet, resultHeaders);
  
  // データ書き込み
  if (patientDetails.length > 0) {
    const dataRows = patientDetails.map(patient => [
      patient.visitor_id,
      patient.name,
      patient.chart_number,
      patient.reservation_count,
      patient.first_reservation,
      patient.last_reservation,
      patient.phone,
      patient.email
    ]);
    
    Utils.writeDataToSheet(resultSheet, dataRows, 2);
    
    // カルテ番号でソート
    const range = resultSheet.getRange(2, 1, dataRows.length, resultHeaders.length);
    range.sort({column: 3, ascending: true}); // カルテ番号列でソート
  }
  
  Logger.log(`処理完了: ${patientDetails.length}件の患者情報を取得、カルテ番号: ${chartNumberCount}件`);
  
  return {
    reservationCount: reservationData.length - 1,
    patientCount: patientDetails.length,
    chartNumberCount: chartNumberCount
  };
}

/**
 * LINE連携未完了者通知を手動実行（メニュー用）
 */
function notifyUnlinkedCompanyVisitorsMenu() {
  return Utils.executeWithErrorHandling(() => {
    const service = new CompanyLineLinkNotificationService();
    const result = service.notifyUnlinkedVisitors();
    
    if (result.success) {
      SpreadsheetApp.getUi().alert(
        '通知送信完了',
        `未連携者通知を送信しました。\n` +
        `対象者数: ${result.totalCount}名\n` +
        `対象会社数: ${result.companyCount}社\n` +
        `メール送信: ${result.emailSent ? '成功' : '失敗'}\n` +
        `LINE送信: ${result.lineSent ? '成功' : '失敗'}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert(
        'エラー',
        '通知の送信に失敗しました。ログを確認してください。',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }, 'notifyUnlinkedCompanyVisitorsMenu');
}

/**
 * LINE連携未完了者通知のテスト実行（メニュー用）
 */
function testCompanyLineLinkNotificationMenu() {
  return Utils.executeWithErrorHandling(() => {
    const service = new CompanyLineLinkNotificationService();
    const result = service.testNotification();
    
    // テスト結果をログに出力
    Logger.log('=== テスト通知内容 ===');
    Logger.log('メール本文:\n' + result.emailBody);
    Logger.log('LINEメッセージ:\n' + result.lineMessage);
    
    SpreadsheetApp.getUi().alert(
      'テスト完了',
      'テスト通知内容をログに出力しました。\n' +
      'スクリプトエディタのログを確認してください。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }, 'testCompanyLineLinkNotificationMenu');
}

/**
 * 通知設定を確認（メニュー用）
 */
function checkNotificationSettingsMenu() {
  return Utils.executeWithErrorHandling(() => {
    const scriptProperties = PropertiesService.getScriptProperties();
    
    const settings = {
      emailTo: scriptProperties.getProperty('NOTIFICATION_EMAIL_TO') || '未設定',
      lineGroupId: scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID') || '未設定',
      lineAccessToken: scriptProperties.getProperty('LINE_CHANNEL_ACCESS_TOKEN') ? '設定済み' : '未設定'
    };
    
    const message = 
      `現在の通知設定:\n\n` +
      `【メール設定】\n` +
      `通知先アドレス: ${settings.emailTo}\n\n` +
      `【LINE設定】\n` +
      `グループID: ${settings.lineGroupId}\n` +
      `アクセストークン: ${settings.lineAccessToken}\n\n` +
      `※設定を変更する場合は、スクリプトプロパティを編集してください。`;
    
    SpreadsheetApp.getUi().alert('通知設定確認', message, SpreadsheetApp.getUi().ButtonSet.OK);
  }, 'checkNotificationSettingsMenu');
}

/**
 * LINE連携未完了者通知のトリガーを設定
 */
function setupLineLinkNotificationTrigger() {
  return Utils.executeWithErrorHandling(() => {
    // 既存のトリガーを削除
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'notifyUnlinkedCompanyVisitors') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // 毎日朝9時に実行するトリガーを設定
    ScriptApp.newTrigger('notifyUnlinkedCompanyVisitors')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    
    Logger.log('LINE連携未完了者通知トリガーを設定しました（毎日朝9時）');
    
    SpreadsheetApp.getUi().alert(
      'トリガー設定完了',
      'LINE連携未完了者通知を毎日朝9時に実行するように設定しました。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }, 'setupLineLinkNotificationTrigger');
}

/**
 * LINE グループIDを確認（メニュー用）
 */
function checkLineGroupIdMenu() {
  return Utils.executeWithErrorHandling(() => {
    const scriptProperties = PropertiesService.getScriptProperties();
    const groupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID');
    const webhookUrl = ScriptApp.getService().getUrl();
    
    let message = '';
    
    if (groupId) {
      message = `現在設定されているグループID:\n${groupId}\n\n`;
      message += `このグループIDで通知が送信されます。`;
    } else {
      message = `グループIDが設定されていません。\n\n`;
      message += `【設定方法】\n`;
      message += `1. LINE DevelopersでWebhook URLを設定:\n`;
      message += `   ${webhookUrl}\n\n`;
      message += `2. Botをグループに招待する\n`;
      message += `3. グループ内でBotにメッセージを送信\n`;
      message += `4. ログを確認してグループIDを取得\n\n`;
      message += `※Webhookを有効にすることを忘れずに！`;
    }
    
    SpreadsheetApp.getUi().alert('LINE グループID確認', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    // デバッグ用にログにも出力
    Logger.log('=== グループID確認 ===');
    Logger.log('グループID: ' + (groupId || '未設定'));
    Logger.log('Webhook URL: ' + webhookUrl);
    
  }, 'checkLineGroupIdMenu');
}

/**
 * Flex Messageテスト送信（メニュー用）
 */
function testFlexMessageSendMenu() {
  return Utils.executeWithErrorHandlingAsync(async () => {
    const ui = SpreadsheetApp.getUi();
    
    // 確認ダイアログ
    const response = ui.alert(
      'Flex Messageテスト送信',
      'テスト用のFlex Messageを設定されたグループに送信します。\n続行しますか？',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    const service = new CompanyLineLinkNotificationService();
    const result = await service.testFlexMessageSend();
    
    if (result.success) {
      ui.alert(
        '送信成功',
        'Flex Messageのテスト送信が完了しました。\nLINEグループを確認してください。',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '送信失敗',
        `エラーが発生しました:\n${result.error}\n\nログを確認してください。`,
        ui.ButtonSet.OK
      );
    }
  }, 'testFlexMessageSendMenu');
}

/**
 * LINE グループIDを手動で設定（メニュー用）
 */
function setLineGroupIdManuallyMenu() {
  return Utils.executeWithErrorHandling(() => {
    const ui = SpreadsheetApp.getUi();
    
    // 現在の設定を取得
    const scriptProperties = PropertiesService.getScriptProperties();
    const currentGroupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID') || '';
    
    // 入力ダイアログ
    const response = ui.prompt(
      'グループID手動設定',
      `LINEグループIDを入力してください。\n\n` +
      `現在の設定: ${currentGroupId || '未設定'}\n\n` +
      `グループIDは「C」で始まる文字列です。\n` +
      `例: C1234567890abcdef`,
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() === ui.Button.OK) {
      const newGroupId = response.getResponseText().trim();
      
      if (!newGroupId) {
        ui.alert('エラー', 'グループIDが入力されていません。', ui.ButtonSet.OK);
        return;
      }
      
      // グループIDの形式チェック（Cで始まるかどうか）
      if (!newGroupId.startsWith('C')) {
        const confirmResponse = ui.alert(
          '確認',
          `入力されたグループIDは「C」で始まっていません。\n` +
          `通常、LINEグループIDは「C」で始まります。\n\n` +
          `このまま設定しますか？`,
          ui.ButtonSet.YES_NO
        );
        
        if (confirmResponse !== ui.Button.YES) {
          return;
        }
      }
      
      // グループIDを保存
      scriptProperties.setProperty('LINE_NOTIFICATION_GROUP_ID', newGroupId);
      
      ui.alert(
        '設定完了',
        `グループIDを設定しました:\n${newGroupId}\n\n` +
        `このグループに通知が送信されます。`,
        ui.ButtonSet.OK
      );
      
      Logger.log(`グループIDを手動設定: ${newGroupId}`);
    }
  }, 'setLineGroupIdManuallyMenu');
}

/**
 * LINE Messaging API設定状況を確認（メニュー用）
 */
function checkLineMessagingApiSettingsMenu() {
  return Utils.executeWithErrorHandling(() => {
    const ui = SpreadsheetApp.getUi();
    const lineTokenManager = new LineTokenManager();
    
    // 設定状況をチェック
    const settings = lineTokenManager.checkMessagingApiSettings();
    
    // メッセージを作成
    let message = '【LINE Messaging API設定状況】\n\n';
    message += `チャネルID: ${settings.channelId ? '✓ 設定済み' : '✗ 未設定'}\n`;
    message += `チャネルシークレット: ${settings.channelSecret ? '✓ 設定済み' : '✗ 未設定'}\n`;
    message += `アクセストークン: ${settings.accessToken ? '✓ 設定済み' : '✗ 未設定'}\n\n`;
    
    // 通知グループIDもチェック
    const scriptProperties = PropertiesService.getScriptProperties();
    const groupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID');
    message += `通知グループID: ${groupId ? '✓ 設定済み' : '✗ 未設定'}\n\n`;
    
    if (settings.isComplete && groupId) {
      message += '🎉 すべての設定が完了しています！';
    } else {
      message += '⚠️ 未設定の項目があります。\n\n';
      message += '【設定手順】\n';
      message += '1. LINE Developers Consoleでチャネルを確認\n';
      message += '2. スクリプトプロパティに以下を設定:\n';
      if (!settings.channelId) message += '   - LINE_MESSAGING_CHANNEL_ID\n';
      if (!settings.channelSecret) message += '   - LINE_MESSAGING_CHANNEL_SECRET\n';
      if (!settings.accessToken) message += '   - LINE_MESSAGING_CHANNEL_ACCESS_TOKEN\n';
      if (!groupId) message += '   - LINE_NOTIFICATION_GROUP_ID\n';
    }
    
    ui.alert(
      'LINE Messaging API設定確認',
      message,
      ui.ButtonSet.OK
    );
    
    Logger.log('LINE Messaging API設定確認完了');
    Logger.log(JSON.stringify(settings, null, 2));
    
  }, 'checkLineMessagingApiSettingsMenu');
}

/**
 * LINE Messaging API設定ガイドを表示（メニュー用）
 */
function showLineMessagingApiSetupGuideMenu() {
  return Utils.executeWithErrorHandling(() => {
    const ui = SpreadsheetApp.getUi();
    
    const guide = `【LINE Messaging API設定ガイド】

1. LINE Developers Consoleにアクセス
   https://developers.line.biz/

2. チャネルを選択し、以下の情報を取得:
   - チャネルID (Channel ID)
   - チャネルシークレット (Channel secret)
   - チャネルアクセストークン (Channel access token)

3. Google Apps Scriptのスクリプトプロパティに設定:
   - LINE_MESSAGING_CHANNEL_ID
   - LINE_MESSAGING_CHANNEL_SECRET
   - LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
   - LINE_NOTIFICATION_GROUP_ID

4. ボットをグループに追加し、友達に追加

5. 設定確認メニューで動作確認

【注意事項】
- LINEログイン用とMessaging API用は異なるチャネルです
- アクセストークンは有効期限があります（30日間）
- グループIDは「C」で始まります`;

    ui.alert(
      'LINE Messaging API設定ガイド',
      guide,
      ui.ButtonSet.OK
    );
    
  }, 'showLineMessagingApiSetupGuideMenu');
}

/**
 * 通知管理ダイアログ用の関数群
 */

/**
 * 通知設定を取得
 */
function getNotificationSettings() {
  const notificationSettingsService = new NotificationSettingsService();
  return notificationSettingsService.getSettings();
}

/**
 * 通知設定を保存
 */
function saveNotificationSettings(settings) {
  const notificationSettingsService = new NotificationSettingsService();
  notificationSettingsService.saveSettings(settings);
  notificationSettingsService.updateTriggers();
  return { success: true };
}

/**
 * 予約確定通知のテスト送信
 */
function testBookingConfirmationNotification() {
  try {
    // テストデータの作成
    const testReservation = {
      id: 'TEST-' + new Date().getTime(),
      visitor_id: '12345',
      date: new Date(),
      start_time: '14:00',
      menu_name: 'テスト施術メニュー',
      duration: 60,
      notes: 'テスト送信です。実際の予約ではありません。',
      ticket_count: 1,
      company_id: 'TEST001'
    };

    const flexMessageTemplates = new FlexMessageTemplates();
    const content = {
      clinicName: 'CULTIReFINE',
      patientName: 'テスト太郎',
      date: Utils.formatDate(new Date()),
      time: '14:00',
      menuName: 'テスト施術メニュー',
      duration: 60,
      notes: 'テスト送信です。実際の予約ではありません。',
      ticketUsage: 1,
      ticketBalance: { stemCell: 5, treatment: 10, infusion: 3 }
    };

    const flexMessage = flexMessageTemplates.createMessage('full_booking_confirmation', content);
    
    return {
      success: true,
      preview: flexMessage,
      message: 'テスト用FlexMessageを作成しました'
    };
  } catch (error) {
    Logger.log('予約確定通知テストエラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * リマインダー通知のテスト送信
 */
function testReminderNotification(timing) {
  try {
    const flexMessageTemplates = new FlexMessageTemplates();
    const content = {
      clinicName: 'CULTIReFINE',
      patientName: 'テスト太郎',
      date: Utils.formatDate(new Date()),
      time: '14:00',
      menuName: 'テスト施術メニュー',
      duration: 60,
      notes: 'テスト送信です。実際の予約ではありません。',
      timing: timing === 'day_before' ? '明日' : '本日'
    };

    const flexMessage = flexMessageTemplates.createMessage('reminder', content);
    
    return {
      success: true,
      preview: flexMessage,
      message: `${timing === 'day_before' ? '前日' : '当日'}リマインダーのテスト用FlexMessageを作成しました`
    };
  } catch (error) {
    Logger.log('リマインダー通知テストエラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 施術後通知のテスト送信
 */
function testPostTreatmentNotification() {
  try {
    const flexMessageTemplates = new FlexMessageTemplates();
    const content = {
      clinicName: 'CULTIReFINE',
      patientName: 'テスト太郎',
      date: Utils.formatDate(new Date()),
      menuName: 'テスト施術メニュー',
      ticketBalance: { stemCell: 5, treatment: 10, infusion: 3 }
    };

    const flexMessage = flexMessageTemplates.createMessage('post_treatment', content);
    
    return {
      success: true,
      preview: flexMessage,
      message: '施術後通知のテスト用FlexMessageを作成しました'
    };
  } catch (error) {
    Logger.log('施術後通知テストエラー: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * テスト通知送信用の関数群
 */

/**
 * テスト送信可能なユーザー一覧を取得
 */
function getTestRecipients() {
  const testNotificationService = new TestNotificationService();
  return testNotificationService.getTestRecipients();
}

/**
 * 実際のテスト通知を送信
 */
function sendTestNotification(notificationType, recipientIds, options) {
  const testNotificationService = new TestNotificationService();
  return testNotificationService.sendTestNotification(notificationType, recipientIds, options);
}

/**
 * 施術・メニュー管理ダイアログ用の関数群
 */

/**
 * カテゴリ一覧を取得
 */
function getCategories() {
  return Utils.executeWithErrorHandling(() => {
    const categoryService = new CategoryService();
    const categories = categoryService.getAllCategories();
    
    // HTMLが期待する形式でレスポンスを返す
    return {
      treatmentCategories: categories || []
    };
  });
}

/**
 * カテゴリを追加
 */
function addCategory(categoryName, categoryType = 'treatment', options = {}) {
  const categoryService = new CategoryService();
  return categoryService.addCategory(categoryName, categoryType, options);
}

/**
 * カテゴリを更新
 */
function updateCategory(categoryData) {
  const categoryService = new CategoryService();
  return categoryService.updateCategory(categoryData);
}

/**
 * カテゴリを削除
 */
function deleteCategory(categoryId) {
  const categoryService = new CategoryService();
  return categoryService.deleteCategory(categoryId);
}

/**
 * 生成済みメニューを取得
 */
function getGeneratedMenus() {
  const sheetName = Config.getSheetNames().generatedMenus || '生成メニュー';
  const spreadsheetManager = new SpreadsheetManager();
  return spreadsheetManager.getSheetData(sheetName);
}

/**
 * 生成済みメニューを保存
 */
function saveGeneratedMenus(menus) {
  const sheetName = Config.getSheetNames().generatedMenus || '生成メニュー';
  const spreadsheetManager = new SpreadsheetManager();
  spreadsheetManager.writeDataToSheet(sheetName, menus, true);
  
  return {
    success: true,
    count: menus.length,
    message: `${menus.length}件のメニューを保存しました`
  };
}

/**
 * 生成済みメニューをクリア
 */
function clearGeneratedMenus() {
  const sheetName = Config.getSheetNames().generatedMenus || '生成メニュー';
  const spreadsheetManager = new SpreadsheetManager();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (sheet) {
    // ヘッダー行以外をクリア
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
  }
  
  return { success: true };
}

/**
 * Medical Force用CSVを生成
 */
function generateMedicalForceCsv(menus) {
  const treatmentMasterService = new TreatmentMasterService();
  return treatmentMasterService.generateMedicalForceCsv(menus);
}

/**
 * 施術CSV生成
 */
function generateTreatmentsCsv(treatments) {
  const treatmentMasterService = new TreatmentMasterService();
  return treatmentMasterService.generateTreatmentsCsv(treatments);
}