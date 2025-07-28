/**
 * 予約検証サービス
 * 予約作成前の各種バリデーションを実行
 */
class ReservationValidationService {
  constructor() {
    this.sheetNames = Config.getSheetNames();
  }
  
  /**
   * 初診/再診を判定
   * @param {string} visitorId - 患者ID
   * @param {string} menuId - メニューID（オプション）
   * @return {object} {isFirstVisit: boolean, lastVisitDate: string, visitCount: number}
   */
  checkVisitHistory(visitorId, menuId = null) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`訪問履歴をチェック: visitorId=${visitorId}, menuId=${menuId}`);
      
      const reservationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.reservations);
      if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
        return {
          isFirstVisit: true,
          lastVisitDate: null,
          visitCount: 0
        };
      }
      
      // 過去2年間のデータを取得
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const data = reservationSheet.getDataRange().getValues();
      const headers = data[0];
      const visitorIdIndex = headers.indexOf('visitor_id');
      const reservationDateIndex = headers.indexOf('予約日');
      const statusIndex = headers.indexOf('ステータス');
      const menuIndex = headers.indexOf('メニュー');
      
      let visitCount = 0;
      let lastVisitDate = null;
      let menuSpecificVisitCount = 0;
      
      // データを確認（新しい順に）
      for (let i = data.length - 1; i > 0; i--) {
        const row = data[i];
        const rowVisitorId = row[visitorIdIndex];
        const rowDate = new Date(row[reservationDateIndex]);
        const rowStatus = row[statusIndex];
        const rowMenu = row[menuIndex];
        
        // 該当する患者の予約のみ
        if (rowVisitorId === visitorId && rowDate >= twoYearsAgo) {
          // キャンセルされていない予約のみカウント
          if (rowStatus !== 'cancelled' && rowStatus !== 'キャンセル') {
            visitCount++;
            
            if (!lastVisitDate || rowDate > lastVisitDate) {
              lastVisitDate = rowDate;
            }
            
            // メニュー別のカウント
            if (menuId && rowMenu && rowMenu.includes(menuId)) {
              menuSpecificVisitCount++;
            }
          }
        }
      }
      
      return {
        isFirstVisit: visitCount === 0,
        lastVisitDate: lastVisitDate ? Utils.formatDate(lastVisitDate) : null,
        visitCount: visitCount,
        menuSpecificVisitCount: menuSpecificVisitCount
      };
    }, '訪問履歴チェック');
  }
  
  /**
   * 施術間隔をチェック
   * @param {string} visitorId - 患者ID
   * @param {string} menuId - メニューID
   * @param {string} menuName - メニュー名（オプション）
   * @return {object} {isAvailable: boolean, lastTreatmentDate: string, requiredInterval: number, daysElapsed: number, restrictions: array}
   */
  validateTreatmentInterval(visitorId, menuId, menuName = null) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`施術間隔をチェック: visitorId=${visitorId}, menuId=${menuId}, menuName=${menuName}`);
      
      // メニュー名を取得（必要な場合）
      if (!menuName) {
        const menuService = new MenuService();
        const menus = menuService.getMenusFromSheet();
        const menu = menus.find(m => m.id === menuId);
        menuName = menu ? menu.name : null;
      }
      
      if (!menuName) {
        Logger.log('メニュー名が取得できません');
        return {
          isAvailable: true,
          lastTreatmentDate: null,
          requiredInterval: 0,
          daysElapsed: null,
          restrictions: []
        };
      }
      
      // 施術間隔マトリクスを取得
      const intervalMatrix = SpreadsheetManager.getTreatmentIntervalMatrix();
      if (intervalMatrix.size === 0) {
        Logger.log('施術間隔定義が設定されていません');
        return {
          isAvailable: true,
          lastTreatmentDate: null,
          requiredInterval: 0,
          daysElapsed: null,
          restrictions: []
        };
      }
      
      // 過去の施術履歴を取得
      const treatmentHistory = this._getVisitorTreatmentHistory(visitorId);
      const restrictions = [];
      let mostRestrictiveInterval = 0;
      let mostRestrictiveLastDate = null;
      let mostRestrictiveMenu = null;
      
      // 各過去の施術との間隔をチェック
      treatmentHistory.forEach(pastTreatment => {
        const key = `${pastTreatment.menuName}→${menuName}`;
        const requiredInterval = intervalMatrix.get(key);
        
        if (requiredInterval !== undefined && requiredInterval > 0) {
          const today = new Date();
          const lastDate = new Date(pastTreatment.date);
          const daysElapsed = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          
          const restriction = {
            fromMenu: pastTreatment.menuName,
            toMenu: menuName,
            lastDate: Utils.formatDate(lastDate),
            requiredInterval: requiredInterval,
            daysElapsed: daysElapsed,
            isAvailable: daysElapsed >= requiredInterval,
            remainingDays: Math.max(0, requiredInterval - daysElapsed)
          };
          
          restrictions.push(restriction);
          
          // 最も制限の厳しい条件を記録
          if (!restriction.isAvailable && requiredInterval > mostRestrictiveInterval) {
            mostRestrictiveInterval = requiredInterval;
            mostRestrictiveLastDate = lastDate;
            mostRestrictiveMenu = pastTreatment.menuName;
          }
        }
      });
      
      // 全ての制限を満たしているかチェック
      const isAvailable = restrictions.every(r => r.isAvailable);
      
      return {
        isAvailable: isAvailable,
        lastTreatmentDate: mostRestrictiveLastDate ? Utils.formatDate(mostRestrictiveLastDate) : null,
        requiredInterval: mostRestrictiveInterval,
        daysElapsed: mostRestrictiveLastDate ? Math.floor((new Date() - mostRestrictiveLastDate) / (1000 * 60 * 60 * 24)) : null,
        restrictions: restrictions,
        restrictiveMenu: mostRestrictiveMenu
      };
    }, '施術間隔チェック');
  }
  
  /**
   * 患者の施術履歴を取得
   * @private
   */
  _getVisitorTreatmentHistory(visitorId) {
    const reservationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.reservations);
    if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
      return [];
    }
    
    const data = reservationSheet.getDataRange().getValues();
    const headers = data[0];
    const visitorIdIndex = headers.indexOf('visitor_id');
    const dateIndex = headers.indexOf('予約日');
    const menuIndex = headers.indexOf('メニュー');
    const statusIndex = headers.indexOf('ステータス');
    
    const history = [];
    const menuMap = new Map(); // メニューごとの最新日付を保持
    
    // 新しい順にデータを確認
    for (let i = data.length - 1; i > 0; i--) {
      const row = data[i];
      if (row[visitorIdIndex] === visitorId) {
        const status = row[statusIndex];
        // キャンセルされていない予約のみ
        if (status !== 'cancelled' && status !== 'キャンセル') {
          const menuName = row[menuIndex];
          const date = new Date(row[dateIndex]);
          
          // 各メニューの最新の施術日のみを記録
          if (!menuMap.has(menuName) || date > menuMap.get(menuName)) {
            menuMap.set(menuName, date);
          }
        }
      }
    }
    
    // Mapを配列に変換
    menuMap.forEach((date, menuName) => {
      history.push({
        menuName: menuName,
        date: date
      });
    });
    
    return history;
  }
  
  /**
   * 同日2回予約制約をチェック
   * @param {string} visitorId - 患者ID
   * @param {string} menuId - メニューID
   * @param {Date} reservationDate - 予約希望日
   * @return {object} {isAvailable: boolean, existingReservations: array, message: string}
   */
  validateSameDayConstraint(visitorId, menuId, reservationDate) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`同日2回予約制約をチェック: visitorId=${visitorId}, menuId=${menuId}, date=${reservationDate}`);
      
      const reservationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.reservations);
      if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
        return {
          isAvailable: true,
          existingReservations: [],
          message: '予約可能です'
        };
      }
      
      // 予約希望日の開始と終了を設定
      const targetDate = new Date(reservationDate);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const data = reservationSheet.getDataRange().getValues();
      const headers = data[0];
      const visitorIdIndex = headers.indexOf('患者ID') >= 0 ? headers.indexOf('患者ID') : headers.indexOf('visitor_id');
      const menuIdIndex = headers.indexOf('メニューID') >= 0 ? headers.indexOf('メニューID') : headers.indexOf('menu_id');
      const dateIndex = headers.indexOf('予約日時') >= 0 ? headers.indexOf('予約日時') : headers.indexOf('start_at');
      const statusIndex = headers.indexOf('ステータス') >= 0 ? headers.indexOf('ステータス') : headers.indexOf('status');
      const menuNameIndex = headers.indexOf('メニュー名') >= 0 ? headers.indexOf('メニュー名') : headers.indexOf('menu_name');
      
      const existingReservations = [];
      
      // 同じ日の同じメニューの予約を検索
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowVisitorId = row[visitorIdIndex];
        const rowMenuId = row[menuIdIndex];
        const rowDate = new Date(row[dateIndex]);
        const rowStatus = row[statusIndex];
        const rowMenuName = row[menuNameIndex];
        
        // 同じ患者の予約
        if (rowVisitorId === visitorId) {
          // 同じ日付の予約
          if (rowDate >= startOfDay && rowDate <= endOfDay) {
            // キャンセルされていない予約
            if (rowStatus !== 'キャンセル' && rowStatus !== 'cancelled' && rowStatus !== 'no_show') {
              // 同じメニューの予約
              if (rowMenuId === menuId) {
                existingReservations.push({
                  date: Utils.formatDateTime(rowDate),
                  menuId: rowMenuId,
                  menuName: rowMenuName,
                  status: rowStatus
                });
              }
            }
          }
        }
      }
      
      const isAvailable = existingReservations.length === 0;
      let message = '予約可能です';
      
      if (!isAvailable) {
        message = `同日に同じメニューの予約が既に存在します（${existingReservations[0].date}）。同じメニューは1日1回までとなっております。`;
      }
      
      return {
        isAvailable: isAvailable,
        existingReservations: existingReservations,
        message: message
      };
    }, '同日2回予約制約チェック');
  }
  
  /**
   * 予約作成前の総合バリデーション
   * @param {string} visitorId - 患者ID
   * @param {string} menuId - メニューID
   * @param {Date} reservationDate - 予約希望日時
   * @param {string} menuName - メニュー名（オプション）
   * @return {object} {isValid: boolean, errors: array, warnings: array}
   */
  validateReservation(visitorId, menuId, reservationDate, menuName = null) {
    return Utils.executeWithErrorHandling(() => {
      const errors = [];
      const warnings = [];
      
      // 1. 施術間隔チェック
      const intervalCheck = this.validateTreatmentInterval(visitorId, menuId, menuName);
      if (!intervalCheck.isAvailable) {
        errors.push({
          type: 'TREATMENT_INTERVAL',
          message: intervalCheck.message || '施術間隔の制約により予約できません',
          details: intervalCheck.restrictions
        });
      }
      
      // 2. 同日2回予約制約チェック
      const sameDayCheck = this.validateSameDayConstraint(visitorId, menuId, reservationDate);
      if (!sameDayCheck.isAvailable) {
        errors.push({
          type: 'SAME_DAY_CONSTRAINT',
          message: sameDayCheck.message,
          details: sameDayCheck.existingReservations
        });
      }
      
      // 3. 営業時間チェック（必要に応じて実装）
      // const businessHoursCheck = this.validateBusinessHours(reservationDate);
      
      // 4. 初診/再診チェック（情報提供のため）
      const visitHistory = this.checkVisitHistory(visitorId, menuId);
      if (visitHistory.isFirstVisit) {
        warnings.push({
          type: 'FIRST_VISIT',
          message: '初診の患者様です'
        });
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        visitHistory: visitHistory,
        intervalCheck: intervalCheck,
        sameDayCheck: sameDayCheck
      };
    }, '予約総合バリデーション');
  }
  
  /**
   * 利用可能なメニューを取得
   * @param {string} visitorId - 患者ID
   * @param {boolean} isFirstVisit - 初診フラグ
   * @return {array} 利用可能なメニューリスト
   */
  getAvailableMenus(visitorId, isFirstVisit = null) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`利用可能メニューを取得: visitorId=${visitorId}`);
      
      // 初診/再診判定
      if (isFirstVisit === null) {
        const visitHistory = this.checkVisitHistory(visitorId);
        isFirstVisit = visitHistory.isFirstVisit;
      }
      
      // メニューマッピングを取得
      const mappingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.menuMapping);
      if (!mappingSheet || mappingSheet.getLastRow() <= 1) {
        Logger.log('メニューマッピングが設定されていません');
        
        // デフォルトでメニュー管理から取得
        const menuService = new MenuService();
        return menuService.getMenusFromSheet();
      }
      
      const mappingData = mappingSheet.getDataRange().getValues();
      const visitType = isFirstVisit ? '初診' : '再診';
      const availableMenus = [];
      
      for (let i = 1; i < mappingData.length; i++) {
        const row = mappingData[i];
        const menuVisitType = row[2]; // 初診/再診区分
        const isActive = row[6] === 'TRUE'; // 有効フラグ
        
        if (isActive && (menuVisitType === visitType || menuVisitType === '共通')) {
          // 施術間隔チェック
          const intervalCheck = this.validateTreatmentInterval(visitorId, row[1]);
          
          availableMenus.push({
            menuId: row[1],
            displayName: row[3],
            apiMenuId: row[4],
            displayOrder: parseInt(row[5]) || 999,
            isAvailable: intervalCheck.isAvailable,
            intervalInfo: intervalCheck
          });
        }
      }
      
      // 表示順でソート
      availableMenus.sort((a, b) => a.displayOrder - b.displayOrder);
      
      return availableMenus;
    }, '利用可能メニュー取得');
  }
  
  /**
   * 最後の施術を検索（内部メソッド）
   */
  _findLastTreatment(visitorId, menuIds) {
    const reservationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.reservations);
    if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
      return null;
    }
    
    const data = reservationSheet.getDataRange().getValues();
    const headers = data[0];
    const visitorIdIndex = headers.indexOf('visitor_id');
    const dateIndex = headers.indexOf('予約日');
    const menuIndex = headers.indexOf('メニュー');
    const statusIndex = headers.indexOf('ステータス');
    
    let lastTreatment = null;
    
    for (let i = data.length - 1; i > 0; i--) {
      const row = data[i];
      
      if (row[visitorIdIndex] === visitorId && 
          row[statusIndex] !== 'cancelled' && 
          row[statusIndex] !== 'キャンセル') {
        
        // メニューIDをチェック
        const rowMenu = row[menuIndex];
        for (const menuId of menuIds) {
          if (rowMenu && rowMenu.includes(menuId)) {
            const treatmentDate = new Date(row[dateIndex]);
            
            if (!lastTreatment || treatmentDate > lastTreatment.date) {
              lastTreatment = {
                date: treatmentDate,
                menuId: menuId,
                menuName: rowMenu
              };
            }
          }
        }
      }
    }
    
    return lastTreatment;
  }
  
  /**
   * 会社別来院者を取得
   * @param {string} companyId - 会社ID
   * @param {string} lineId - LINEユーザーID（認証用）
   * @param {boolean} includePrivate - 非公開の来院者も含むか
   * @return {array} 来院者リスト
   */
  getCompanyVisitors(companyId, lineId, includePrivate = false) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`会社別来院者を取得: companyId=${companyId}, lineId=${lineId}`);
      
      const companyVisitorsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyVisitors);
      if (!companyVisitorsSheet || companyVisitorsSheet.getLastRow() <= 1) {
        return [];
      }
      
      const data = companyVisitorsSheet.getDataRange().getValues();
      const visitors = [];
      let isMainMember = false;
      
      // まず、アクセスしているユーザーが本会員かチェック
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[4] === lineId && row[5] === 'TRUE') { // LINE_ID && 本会員フラグ
          isMainMember = true;
          break;
        }
      }
      
      // 来院者リストを作成
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowCompanyId = row[0];
        const visitorId = row[2];
        const name = row[3];
        const isPublic = row[6] === 'TRUE';
        
        if (rowCompanyId === companyId) {
          // 公開設定の確認
          if (isPublic || (includePrivate && isMainMember)) {
            visitors.push({
              visitorId: visitorId,
              name: name,
              lineId: row[4],
              isMainMember: row[5] === 'TRUE',
              isPublic: isPublic
            });
          }
        }
      }
      
      return {
        visitors: visitors,
        isMainMember: isMainMember
      };
    }, '会社別来院者取得');
  }
}