/**
 * 患者メニューAPI簡易版（エラー回避用）
 */

/**
 * 患者メニュー取得の簡易版（スプレッドシートのみ使用）
 */
function handleGetPatientMenusSimple(patientId) {
  try {
    Logger.log(`handleGetPatientMenusSimple: 患者ID ${patientId} のメニュー情報取得開始`);
    
    // 1. メニューマスタから全メニューを取得
    const menuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('メニューマスタ');
    if (!menuSheet) {
      return {
        status: 'error',
        error: {
          code: 'SHEET_NOT_FOUND',
          message: 'メニューマスタシートが見つかりません',
          details: null
        }
      };
    }
    
    const menuData = menuSheet.getDataRange().getValues();
    if (menuData.length <= 1) {
      return {
        status: 'success',
        data: {
          patient_id: patientId,
          patient_name: '',
          menus: [],
          total_count: 0,
          history_start_date: Utils.subtractMonths(Utils.getToday(), 6),
          history_end_date: Utils.getToday()
        }
      };
    }
    
    // ヘッダー行の解析
    const headers = menuData[0];
    const menuIdIndex = headers.indexOf('menu_id');
    const nameIndex = headers.indexOf('メニュー名');
    const categoryIndex = headers.indexOf('カテゴリ');
    const priceIndex = headers.indexOf('税込料金');
    const durationIndex = headers.indexOf('所要時間（分）');
    const isActiveIndex = headers.indexOf('有効フラグ');
    const isOnlineIndex = headers.indexOf('オンライン予約可');
    
    // 有効かつオンライン予約可能なメニューのみ抽出
    const filteredMenus = [];
    
    for (let i = 1; i < menuData.length; i++) {
      const row = menuData[i];
      
      // 有効でオンライン予約可能なメニューのみ
      if (row[isActiveIndex] === 'TRUE' && row[isOnlineIndex] === 'TRUE') {
        filteredMenus.push({
          menu_id: row[menuIdIndex] || `menu_${i}`,
          name: row[nameIndex] || '',
          category: row[categoryIndex] || '',
          category_id: '',
          is_first_time: true, // 簡易版では全て初回扱い
          usage_count: 0,
          last_used_date: null,
          price: row[priceIndex - 1] || 0, // 税抜価格
          price_with_tax: row[priceIndex] || 0,
          duration_minutes: row[durationIndex] || 60,
          description: '',
          ticket_type: '',
          required_tickets: 0
        });
      }
    }
    
    // カテゴリ順、メニュー名順でソート
    filteredMenus.sort((a, b) => {
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // 患者名を取得（オプション）
    let patientName = '';
    try {
      const patientSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('患者マスタ');
      if (patientSheet) {
        const patientData = patientSheet.getDataRange().getValues();
        const idIndex = patientData[0].indexOf('visitor_id');
        const nameIndex = patientData[0].indexOf('氏名');
        
        for (let i = 1; i < patientData.length; i++) {
          if (patientData[i][idIndex] === patientId) {
            patientName = patientData[i][nameIndex] || '';
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('患者名取得エラー: ' + e.toString());
    }
    
    return {
      status: 'success',
      data: {
        patient_id: patientId,
        patient_name: patientName,
        menus: filteredMenus,
        total_count: filteredMenus.length,
        history_start_date: Utils.subtractMonths(Utils.getToday(), 6),
        history_end_date: Utils.getToday()
      }
    };
    
  } catch (error) {
    Logger.log(`handleGetPatientMenusSimple Error: ${error.toString()}`);
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'メニュー情報の取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}