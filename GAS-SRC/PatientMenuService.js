/**
 * 患者別メニュー管理サービス
 * 患者の予約履歴に基づいてメニューを初回/2回目以降に分類する
 */
class PatientMenuService {
  constructor() {
    this.reservationService = new ReservationService();
    this.companyVisitorService = new CompanyVisitorService();
    this.ticketManagementService = new TicketManagementService();
    this.menuTicketMappingService = new MenuTicketMappingService();
    this.sheetManager = new SpreadsheetManager();
  }

  /**
   * 患者別メニュー情報を取得
   * @param {string} visitorId - 患者ID
   * @param {string} companyId - 会社ID（オプション）
   * @returns {Object} メニュー情報
   */
  getPatientMenus(visitorId, companyId) {
    try {
      console.log('getPatientMenus 開始 - visitorId:', visitorId, 'companyId:', companyId);
      
      // 1. 患者の過去6ヶ月の予約履歴を取得
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const reservationHistory = this.getPatientReservationHistory(visitorId, sixMonthsAgo);
      console.log('予約履歴数:', reservationHistory.length);
      
      // 2. メニューごとの利用回数を集計
      const menuUsageMap = this.aggregateMenuUsage(reservationHistory);
      console.log('利用メニュー数:', menuUsageMap.size);
      
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
      console.log('会社情報:', companyInfo);
      console.log('チケット残数:', ticketBalance);
      
      // 4. 全メニューを取得
      const allMenus = this.getAllMenus();
      console.log('全メニュー数 (フィルタリング後):', allMenus.length);
      
      // 5. メニューを分類（初回/2回目以降、通常/チケット）
      const categorizedMenus = this.categorizeMenusByHistory(allMenus, menuUsageMap, ticketBalance);
      console.log('カテゴライズ後のメニュー数:', categorizedMenus.length);
      
      // 患者情報を追加
      const hasVisitHistory = reservationHistory.length > 0;
      const lastVisitDate = hasVisitHistory ? 
        Math.max(...reservationHistory.map(r => new Date(r['予約日時']).getTime())) : 
        null;
      
      const result = {
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
      
      console.log('カテゴリ数:', result.data.categories.length);
      console.log('レスポンスデータ:', JSON.stringify(result, null, 2));
      
      return result;

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
      const reservationSheet = SpreadsheetManager.getSheetData(Config.SHEET_NAMES.RESERVATIONS);
      
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
        // MenuIDから基本MenuIDを抽出
        let baseMenuId = menuId;
        if (menuId) {
          // 新しい形式のMenuID（menu_xxx_first, menu_xxx_repeat, menu_xxx_ticket）から基本IDを抽出
          if (menuId.includes('_first') || menuId.includes('_repeat') || menuId.includes('_ticket')) {
            const parts = menuId.split('_');
            if (parts.length >= 3) {
              baseMenuId = parts.slice(0, -1).join('_'); // 最後の部分（first/repeat/ticket）を除去
            }
          }
        } else if (menuName) {
          // MenuIDがない場合はメニュー名から基本名を抽出
          baseMenuId = menuName.replace(/（初回）|（2回目以降）|（2回目）|（チケット使用）/g, '').trim();
        }
        
        const usage = menuUsageMap.get(baseMenuId) || { count: 0, lastUsedDate: null };
        usage.count++;
        
        const reservationDate = new Date(reservation['予約日時']);
        if (!usage.lastUsedDate || reservationDate > usage.lastUsedDate) {
          usage.lastUsedDate = reservationDate;
        }
        
        menuUsageMap.set(baseMenuId, usage);
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
    const companies = SpreadsheetManager.getSheetData(Config.SHEET_NAMES.COMPANIES);
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
    console.log(`getCompanyTicketBalance: 会社ID ${companyId} のチケット情報を取得中...`);
    
    // 新しいメソッドを使用して特定の会社のチケット情報を取得
    const result = this.ticketManagementService.getCompanyTicketById(companyId);
    
    if (!result.success || !result.company) {
      console.log(`getCompanyTicketBalance: 会社ID ${companyId} のチケット情報が見つかりません`);
      console.log('エラー詳細:', result.error);
      return {
        '幹細胞': 0,
        '施術': 0,
        '点滴': 0
      };
    }
    
    const ticketInfo = result.company;
    console.log('取得したチケット情報:', ticketInfo);
    
    const balance = {
      '幹細胞': ticketInfo.stemCellTickets || 0,
      '施術': ticketInfo.treatmentTickets || 0,
      '点滴': ticketInfo.infusionTickets || 0
    };
    
    console.log('チケット残高:', balance);
    return balance;
  }

  /**
   * 全メニューを取得
   * @returns {Array} メニュー配列
   */
  getAllMenus() {
    // メニューマスターからデータを取得
    const menus = SpreadsheetManager.getSheetData(Config.SHEET_NAMES.MENUS);
    
    console.log('取得したメニューデータ数:', menus.length);
    if (menus.length > 0) {
      console.log('サンプルメニューデータ:', JSON.stringify(menus[0], null, 2));
    }
    
    // 有効なメニューのみフィルタリング
    const filteredMenus = menus.filter(menu => {
      // フィルタリング条件を緩和 - 文字列'true'や'1'も許可
      const isActive = menu['有効フラグ'] === true || 
                      menu['有効フラグ'] === 'TRUE' || 
                      menu['有効フラグ'] === 'true' || 
                      menu['有効フラグ'] === 1 || 
                      menu['有効フラグ'] === '1';
      
      const isOnlineReservable = menu['オンライン予約可'] === true || 
                                menu['オンライン予約可'] === 'TRUE' || 
                                menu['オンライン予約可'] === 'true' || 
                                menu['オンライン予約可'] === 1 || 
                                menu['オンライン予約可'] === '1';
      
      // デバッグ情報
      if (!isActive || !isOnlineReservable) {
        console.log('フィルタリングで除外:', {
          menuName: menu['メニュー名'],
          isActive: menu['有効フラグ'],
          isOnlineReservable: menu['オンライン予約可']
        });
      }
      
      return isActive && isOnlineReservable;
    });
    
    console.log('フィルタリング後のメニュー数:', filteredMenus.length);
    
    return filteredMenus.map(menu => {
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

    // MenuTicketMappingServiceから基本メニューIDを取得
    const baseMenuIds = this.menuTicketMappingService.getBaseMenuIds();
    
    baseMenuIds.forEach(baseMenuId => {
      // このbaseMenuIdに対する使用履歴をチェック
      const usage = menuUsageMap.get(baseMenuId) || { count: 0 };
      const isFirstTime = usage.count === 0;
      
      // 利用可能なMenuIDを取得
      const availableMenus = this.menuTicketMappingService.getAvailableMenuIds(
        baseMenuId, 
        isFirstTime, 
        ticketBalance
      );
      
      // 各利用可能メニューを結果に追加
      availableMenus.forEach(menu => {
        if (menu.canReserve || menu.menuType === 'ticket') { // チケットメニューは残高不足でも表示
          const menuData = {
            menu_id: menu.menuId,
            base_menu_id: baseMenuId,
            name: menu.menuName,
            category: menu.category,
            menu_order: 999, // デフォルト値
            duration_minutes: 60, // デフォルト値（後で実際のメニューデータから取得）
            description: '',
            
            // 判定フラグ
            is_first_time: isFirstTime,
            menu_type: menu.menuType === 'first_time' ? '初回メニュー' : 
                      menu.menuType === 'repeat' ? '2回目以降メニュー' : 'チケットメニュー',
            is_ticket_menu: menu.menuType === 'ticket',
            should_display: true,
            can_reserve: menu.canReserve,
            
            // 履歴情報
            usage_count: usage.count,
            last_used_date: usage.lastUsedDate,
            
            // 表示理由
            availability_reason: menu.reason
          };

          // チケット/料金情報を追加
          if (menu.menuType === 'ticket') {
            menuData.ticket_type = menu.ticketType;
            menuData.required_tickets = menu.requiredTickets;
            menuData.ticket_balance = menu.ticketBalance;
          } else {
            // 通常メニューの場合、実際のメニューマスターから料金情報を取得
            const actualMenu = menus.find(m => 
              m['メニュー名'] && menu.menuName.includes(m['メニュー名'].replace(/[（）()]/g, '').split('（')[0])
            );
            if (actualMenu) {
              menuData.price = actualMenu['料金'] || 0;
              menuData.price_with_tax = actualMenu['税込価格'] || menuData.price;
              menuData.duration_minutes = actualMenu['所要時間'] || 60;
              menuData.description = actualMenu['説明'] || '';
              menuData.menu_order = actualMenu['表示順'] || 999;
            }
          }
          
          filteredMenus.push(menuData);
        }
      });
    });

    // メニュータイプと表示順でソート
    filteredMenus.sort((a, b) => {
      // 初回メニューを最優先
      if (a.is_first_time && a.menu_type === '初回メニュー' && !b.is_first_time) return -1;
      if (b.is_first_time && b.menu_type === '初回メニュー' && !a.is_first_time) return 1;
      
      // 予約可能なものを優先
      if (a.can_reserve !== b.can_reserve) {
        return b.can_reserve ? 1 : -1;
      }
      
      // 同じ条件の場合はカテゴリ順、メニュー名順
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '', 'ja');
      }
      return (a.name || '').localeCompare(b.name || '', 'ja');
    });

    return filteredMenus;
  }

  /**
   * フラットなメニュー配列をカテゴリ別にグループ化
   * @param {Array} menus - フラットなメニュー配列
   * @returns {Array} カテゴリ別にグループ化されたメニュー
   */
  groupMenusByCategory(menus) {
    const categoryMap = new Map();
    
    // メニューが空の場合は空配列を返す
    if (!menus || menus.length === 0) {
      console.log('groupMenusByCategory: メニューが空です');
      return [];
    }
    
    menus.forEach(menu => {
      const categoryId = menu.category_id || menu.category || 'uncategorized';
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
    const result = Array.from(categoryMap.values()).sort((a, b) => a.category_order - b.category_order);
    console.log('グループ化されたカテゴリ数:', result.length);
    
    return result;
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