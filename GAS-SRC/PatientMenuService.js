/**
 * 患者別メニュー管理サービス
 * 患者の予約履歴に基づいてメニューを初回/2回目以降に分類する
 */
class PatientMenuService {
  constructor() {
    this.spreadsheetManager = new SpreadsheetManager();
    this.menuService = new MenuService();
    this.ticketManagementService = new TicketManagementService();
    this.companyVisitorService = new CompanyVisitorService();
    this.reservationService = new ReservationService();
    this.companyCacheService = globalCompanyCacheService || new CompanyCacheService();
  }

  /**
   * 患者別メニュー情報を取得
   * @param {string} visitorId - 患者ID
   * @param {string} companyId - 会社ID（オプション）
   * @returns {Object} メニュー情報
   */
  getPatientMenus(visitorId, companyId) {
    try {
      // 1. 患者の過去6ヶ月の予約履歴を取得
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const reservationHistory = this.getPatientReservationHistory(visitorId, sixMonthsAgo);
      
      // 2. メニューごとの利用回数を集計
      const menuUsageMap = this.aggregateMenuUsage(reservationHistory);
      
      // 3. 会社情報を取得（会社IDが指定されている場合）
      let companyInfo = null;
      let ticketBalance = {};
      
      if (companyId) {
        companyInfo = this.getCompanyInfo(companyId);
        ticketBalance = this.getCompanyTicketBalance(companyId);
      } else {
        // 患者IDから会社を特定
        const patientCompany = this.companyVisitorService.getCompanyByVisitorId(visitorId);
        if (patientCompany) {
          companyId = patientCompany['会社ID'];
          companyInfo = this.getCompanyInfo(companyId);
          ticketBalance = this.getCompanyTicketBalance(companyId);
        }
      }
      
      // 4. 全メニューを取得
      const allMenus = this.getAllMenus();
      
      // 5. メニューを分類（初回/2回目以降、通常/チケット）
      const categorizedMenus = this.categorizeMenusByHistory(allMenus, menuUsageMap, ticketBalance);
      
      // 患者情報を追加
      const hasVisitHistory = reservationHistory.length > 0;
      const lastVisitDate = hasVisitHistory ? 
        Math.max(...reservationHistory.map(r => new Date(r['予約日時']).getTime())) : 
        null;
      
      return {
        status: 'success',
        data: {
          categories: this.groupMenusByCategory(categorizedMenus),
          patient_info: {
            visitor_id: visitorId,
            has_visit_history: hasVisitHistory,
            last_visit_date: lastVisitDate ? new Date(lastVisitDate).toISOString().split('T')[0] : null,
            visit_count_6months: reservationHistory.length
          },
          company_info: companyInfo ? {
            id: companyInfo.id,
            name: companyInfo.name,
            plan: companyInfo.plan
          } : null,
          ticket_balance: ticketBalance,
          total_menus: categorizedMenus.length
        }
      };

    } catch (error) {
      console.error('getPatientMenus エラー:', error);
      throw error;
    }
  }

  /**
   * 患者の予約履歴を取得
   * @param {string} visitorId - 患者ID
   * @param {Date} fromDate - 開始日
   * @returns {Array} 予約履歴
   */
  getPatientReservationHistory(visitorId, fromDate) {
    try {
      const reservationSheet = this.spreadsheetManager.getSheetData(Config.SHEET_NAMES.RESERVATIONS);
      
      // 患者IDとステータスでフィルタリング
      return reservationSheet.filter(reservation => {
        const reservationDate = new Date(reservation['予約日時']);
        return reservation['患者ID'] === visitorId &&
               reservation['ステータス'] === '完了' &&
               reservationDate >= fromDate;
      });
    } catch (error) {
      console.error('予約履歴取得エラー:', error);
      return [];
    }
  }

  /**
   * メニューごとの利用回数を集計
   * @param {Array} reservations - 予約履歴
   * @returns {Map} メニューID -> 利用回数のマップ
   */
  aggregateMenuUsage(reservations) {
    const menuUsageMap = new Map();
    
    reservations.forEach(reservation => {
      const menuId = reservation['メニューID'];
      const menuName = reservation['メニュー名'];
      
      if (menuId || menuName) {
        const key = menuId || menuName;
        const usage = menuUsageMap.get(key) || { count: 0, lastUsedDate: null };
        usage.count++;
        
        const reservationDate = new Date(reservation['予約日時']);
        if (!usage.lastUsedDate || reservationDate > usage.lastUsedDate) {
          usage.lastUsedDate = reservationDate;
        }
        
        menuUsageMap.set(key, usage);
      }
    });
    
    return menuUsageMap;
  }

  /**
   * 会社情報を取得
   * @param {string} companyId - 会社ID
   * @returns {Object} 会社情報
   */
  getCompanyInfo(companyId) {
    const companies = this.spreadsheetManager.getSheetData(Config.SHEET_NAMES.COMPANIES);
    const company = companies.find(c => c['会社ID'] === companyId);
    
    if (!company) {
      return null;
    }

    return {
      id: company['会社ID'],
      name: company['会社名'],
      plan: company['プラン'] || ''
    };
  }

  /**
   * 会社のチケット残数を取得
   * @param {string} companyId - 会社ID
   * @returns {Object} チケット残数
   */
  getCompanyTicketBalance(companyId) {
    const ticketInfo = this.ticketManagementService.getCompanyTickets(companyId);
    
    return {
      '幹細胞': ticketInfo ? (ticketInfo['幹細胞チケット残数'] || 0) : 0,
      '施術': ticketInfo ? (ticketInfo['施術チケット残数'] || 0) : 0,
      '点滴': ticketInfo ? (ticketInfo['点滴チケット残数'] || 0) : 0
    };
  }

  /**
   * 全メニューを取得
   * @returns {Array} メニュー配列
   */
  getAllMenus() {
    // メニューマスターからデータを取得
    const menus = this.spreadsheetManager.getSheetData(Config.SHEET_NAMES.MENUS);
    
    // 有効なメニューのみフィルタリング
    return menus.filter(menu => {
      const isActive = menu['有効フラグ'] === true || menu['有効フラグ'] === 'TRUE' || menu['有効フラグ'] === 1;
      const isOnlineReservable = menu['オンライン予約可'] === true || menu['オンライン予約可'] === 'TRUE' || menu['オンライン予約可'] === 1;
      return isActive && isOnlineReservable;
    }).map(menu => {
      // チケットタイプと必要チケット数を確実に含める
      return {
        ...menu,
        'チケットタイプ': menu['チケットタイプ'] || '',
        '必要チケット数': menu['必要チケット数'] || 1
      };
    });
  }

  /**
   * 予約履歴に基づいてメニューを分類
   * @param {Array} menus - 全メニュー
   * @param {Map} menuUsageMap - メニュー利用履歴
   * @param {Object} ticketBalance - チケット残数
   * @returns {Array} フラットなメニュー配列
   */
  categorizeMenusByHistory(menus, menuUsageMap, ticketBalance) {
    const filteredMenus = [];

    menus.forEach(menu => {
      const menuId = menu['メニューID'];
      const menuName = menu['メニュー名'];
      const category = menu['カテゴリ'] || '未分類';
      const ticketType = menu['チケットタイプ'];
      
      // メニューの使用履歴を確認
      const usage = menuUsageMap.get(menuId) || menuUsageMap.get(menuName) || { count: 0 };
      const isFirstTime = usage.count === 0;
      
      // 正規表現でメニュー名から初回/2回目以降を判定（削除された実装から復活）
      const isFirstTimeMenu = /初回|初診|カウンセリング|初めて/.test(menuName);
      const isRepeatMenu = /2回目|２回目|以降/.test(menuName);
      
      // 表示条件の判定（削除された実装のロジック）
      let shouldDisplay = true;
      
      // 初回メニューは初回のみ表示
      if (isFirstTimeMenu && !isFirstTime) {
        shouldDisplay = false;
      }
      // 通常メニューで「2回目以降」などの表記がある場合は、初回は非表示
      else if (isRepeatMenu && isFirstTime) {
        shouldDisplay = false;
      }
      
      // チケット付与メニューかどうかを判定
      const isTicketMenu = ticketType && ticketType !== 'なし' && ticketType !== '';
      
      // メニューデータを作成
      const menuData = {
        menu_id: menuId,
        name: menuName,
        category: category,
        category_id: menu['カテゴリID'] || '',
        menu_order: menu['表示順'] || 999,
        duration_minutes: menu['所要時間'] || 60,
        description: menu['説明'] || '',
        
        // 判定フラグ
        is_first_time: isFirstTime,
        menu_type: isFirstTime ? '初回メニュー' : '2回目以降メニュー',
        is_ticket_menu: isTicketMenu,
        should_display: shouldDisplay,
        
        // 履歴情報
        usage_count: usage.count,
        last_used_date: usage.lastUsedDate,
        
        // 表示優先度（初回メニューを優先）
        display_priority: isFirstTimeMenu && isFirstTime ? 1 : 2
      };

      // チケット/料金情報を追加
      if (isTicketMenu) {
        menuData.ticket_type = ticketType;
        menuData.required_tickets = menu['必要チケット数'] || 1;
        menuData.ticket_balance = ticketBalance[ticketType] || 0;
        menuData.can_reserve = (ticketBalance[ticketType] || 0) >= menuData.required_tickets;
      } else {
        menuData.price = menu['料金'] || 0;
        menuData.price_with_tax = menu['税込価格'] || menuData.price;
        menuData.can_reserve = true;
      }
      
      // 表示すべきメニューのみを配列に追加
      if (shouldDisplay) {
        filteredMenus.push(menuData);
      }
    });

    // 表示優先度でソート（初回メニューを上位に）
    filteredMenus.sort((a, b) => {
      if (a.display_priority !== b.display_priority) {
        return a.display_priority - b.display_priority;
      }
      // 同じ優先度の場合はカテゴリ順、メニュー名順
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '', 'ja');
      }
      return (a.name || '').localeCompare(b.name || '', 'ja');
    });
    
    // display_priorityフィールドを削除（内部的な並び替え用）
    filteredMenus.forEach(menu => delete menu.display_priority);

    return filteredMenus;
  }

  /**
   * フラットなメニュー配列をカテゴリ別にグループ化
   * @param {Array} menus - フラットなメニュー配列
   * @returns {Array} カテゴリ別にグループ化されたメニュー
   */
  groupMenusByCategory(menus) {
    const categoryMap = new Map();
    
    menus.forEach(menu => {
      const categoryId = menu.category_id || menu.category;
      const categoryName = menu.category || '未分類';
      
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: categoryName,
          category_order: menu.category_order || 999,
          menus: []
        });
      }
      
      categoryMap.get(categoryId).menus.push(menu);
    });
    
    // カテゴリをソートして配列として返す
    return Array.from(categoryMap.values()).sort((a, b) => a.category_order - b.category_order);
  }
}

/**
 * PatientMenuServiceのテスト関数
 */
function testPatientMenuService() {
  console.log('=== PatientMenuService テスト開始 ===');
  
  const service = new PatientMenuService();
  
  try {
    // テストデータで実行
    const result = service.getPatientMenus('1001', '1');
    console.log('取得結果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('テストエラー:', error);
  }
  
  console.log('=== テスト完了 ===');
}