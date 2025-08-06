/**
 * メニューAPI サービス
 * カテゴリ階層構造を持つメニュー情報を提供
 * 
 * @class MenuApiService
 * @description メニュー管理シートとメニューカテゴリー管理シートから
 *              階層構造化されたメニュー情報を取得・提供するサービス
 */
class MenuApiService {
  constructor() {
    this.menuSheetName = Config.getSheetNames().menus || 'メニュー管理';
    this.categorySheetName = Config.getSheetNames().menuCategories || 'メニューカテゴリー管理';
  }

  /**
   * 階層構造化されたメニュー情報を取得
   * 
   * @method getStructuredMenus
   * @description 有効かつオンライン予約可能なメニューを取得し、
   *              カテゴリ階層構造に基づいて整理し、
   *              チケットタイプの有無でグループ化して返却
   * 
   * @returns {Object} レスポンスオブジェクト
   * @returns {boolean} returns.success - 処理成功フラグ
   * @returns {Object} returns.data - メニューデータ
   * @returns {Array<Object>} returns.data.regular - チケットタイプなしメニュー配列
   * @returns {string} returns.data.regular[].menu_id - メニューID
   * @returns {string} returns.data.regular[].menu_name - メニュー名
   * @returns {string} returns.data.regular[].category_name - カテゴリ名
   * @returns {string} returns.data.regular[].category_large - 大カテゴリ名
   * @returns {string} returns.data.regular[].category_medium - 中カテゴリ名
   * @returns {string} returns.data.regular[].category_small - 小カテゴリ名
   * @returns {number} returns.data.regular[].duration_minutes - 所要時間（分）
   * @returns {number} returns.data.regular[].tax_included_price - 税込料金（円）
   * @returns {string} returns.data.regular[].description - 説明
   * @returns {Array<Object>} returns.data.withTicket - チケットタイプありメニュー配列
   * @returns {string} returns.data.withTicket[].ticket_type - チケットタイプ
   * @returns {Object} returns.data.categories - カテゴリ階層構造
   * @returns {Map} returns.data.categories.map - カテゴリIDマップ
   * @returns {Array} returns.data.categories.roots - ルートカテゴリ配列
   * @returns {string} returns.data.timestamp - ISO 8601形式のタイムスタンプ
   * @returns {string} returns.error - エラーメッセージ（エラー時）
   * 
   * @example
   * // リクエスト
   * const service = new MenuApiService();
   * const response = service.getStructuredMenus();
   * 
   * // 成功レスポンス例
   * {
   *   success: true,
   *   data: {
   *     regular: [
   *       {
   *         menu_id: "MENU001",
   *         menu_name: "水素吸入30分",
   *         category_name: "水素吸入",
   *         category_large: "美容施術",
   *         category_medium: "点滴",
   *         category_small: "水素吸入",
   *         duration_minutes: 30,
   *         tax_included_price: 3300,
   *         description: "高濃度水素吸入"
   *       }
   *     ],
   *     withTicket: [
   *       {
   *         menu_id: "MENU002",
   *         menu_name: "点滴セット",
   *         category_name: "点滴",
   *         category_large: "美容施術",
   *         category_medium: "点滴",
   *         category_small: "",
   *         duration_minutes: 60,
   *         tax_included_price: 5500,
   *         description: "ビタミン点滴",
   *         ticket_type: "点滴チケット"
   *       }
   *     ],
   *     categories: {...},
   *     timestamp: "2025-08-06T10:30:00.000Z"
   *   }
   * }
   */
  getStructuredMenus() {
    try {
      Logger.log('=== 階層構造メニュー取得開始 ===');
      
      // メニューとカテゴリデータを取得
      const menus = this._getActiveMenus();
      const categories = this._getActiveCategories();
      
      // カテゴリ階層構造を構築
      const categoryHierarchy = this._buildCategoryHierarchy(categories);
      
      // メニューをカテゴリにマッピング
      const menusWithCategory = this._mapMenusToCategories(menus, categoryHierarchy);
      
      // チケットタイプ別にグループ化
      const groupedMenus = this._groupMenusByTicketType(menusWithCategory);
      
      Logger.log(`構造化完了: 通常メニュー${groupedMenus.regular.length}件, チケットメニュー${groupedMenus.withTicket.length}件`);
      
      return {
        success: true,
        data: {
          regular: groupedMenus.regular,      // チケットタイプなし
          withTicket: groupedMenus.withTicket, // チケットタイプあり
          categories: categoryHierarchy,       // カテゴリ階層情報
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      Logger.log(`メニュー取得エラー: ${error.toString()}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 有効かつオンライン予約可能なメニューを取得
   * 
   * @private
   * @method _getActiveMenus
   * @description メニュー管理シートから有効かつオンライン予約可能なメニューのみを取得し、
   *              表示順でソートして返却
   * 
   * @returns {Array<Object>} メニューオブジェクトの配列
   * @returns {string} returns[].menuId - メニューID
   * @returns {string} returns[].menuName - メニュー名
   * @returns {string} returns[].categoryName - カテゴリ名
   * @returns {string} returns[].categoryId - カテゴリID
   * @returns {number} returns[].displayOrder - 表示順
   * @returns {number} returns[].duration - 所要時間（分）
   * @returns {number} returns[].price - 料金
   * @returns {number} returns[].taxIncludedPrice - 税込料金
   * @returns {string} returns[].description - 説明
   * @returns {string} returns[].ticketType - チケットタイプ
   */
  _getActiveMenus() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.menuSheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // ヘッダーインデックスを取得
    const indices = {
      menuId: headers.indexOf('menu_id'),
      menuName: headers.indexOf('メニュー名'),
      category: headers.indexOf('カテゴリ'),
      categoryId: headers.indexOf('カテゴリID'),
      displayOrder: headers.indexOf('表示順'),
      duration: headers.indexOf('所要時間（分）'),
      price: headers.indexOf('料金'),
      taxIncludedPrice: headers.indexOf('税込料金'),
      isActive: headers.indexOf('有効フラグ'),
      isOnlineBookable: headers.indexOf('オンライン予約可'),
      description: headers.indexOf('説明'),
      ticketType: headers.indexOf('チケットタイプ')
    };
    
    const menus = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 有効かつオンライン予約可能なもののみ
      if (row[indices.isActive] !== '有効' || row[indices.isOnlineBookable] !== '可') {
        continue;
      }
      
      menus.push({
        menuId: row[indices.menuId] || '',
        menuName: row[indices.menuName] || '',
        categoryName: row[indices.category] || '',
        categoryId: row[indices.categoryId] || '',
        displayOrder: parseInt(row[indices.displayOrder]) || 999,
        duration: parseInt(row[indices.duration]) || 0,
        price: parseInt(row[indices.price]) || 0,
        taxIncludedPrice: parseInt(row[indices.taxIncludedPrice]) || 0,
        description: row[indices.description] || '',
        ticketType: row[indices.ticketType] || ''
      });
    }
    
    // 表示順でソート
    menus.sort((a, b) => a.displayOrder - b.displayOrder);
    
    return menus;
  }

  /**
   * 有効なカテゴリを取得
   * @private
   */
  _getActiveCategories() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.categorySheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // ヘッダーインデックスを取得
    const indices = {
      categoryId: headers.indexOf('カテゴリID'),
      categoryLevel: headers.indexOf('カテゴリレベル'),
      categoryName: headers.indexOf('カテゴリ名'),
      parentCategoryId: headers.indexOf('親カテゴリID'),
      displayOrder: headers.indexOf('表示順'),
      isActive: headers.indexOf('有効フラグ'),
      description: headers.indexOf('説明')
    };
    
    const categories = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 有効なもののみ
      if (row[indices.isActive] !== '有効') {
        continue;
      }
      
      categories.push({
        categoryId: row[indices.categoryId] || '',
        categoryLevel: row[indices.categoryLevel] || '',
        categoryName: row[indices.categoryName] || '',
        parentCategoryId: row[indices.parentCategoryId] || '',
        displayOrder: parseInt(row[indices.displayOrder]) || 999,
        description: row[indices.description] || '',
        children: []
      });
    }
    
    // 表示順でソート
    categories.sort((a, b) => a.displayOrder - b.displayOrder);
    
    return categories;
  }

  /**
   * カテゴリ階層構造を構築
   * @private
   */
  _buildCategoryHierarchy(categories) {
    const categoryMap = new Map();
    const rootCategories = [];
    
    // カテゴリマップを作成
    categories.forEach(cat => {
      categoryMap.set(cat.categoryId, {...cat});
    });
    
    // 親子関係を構築
    categories.forEach(cat => {
      if (!cat.parentCategoryId || cat.parentCategoryId === '') {
        // ルートカテゴリ（大カテゴリ）
        rootCategories.push(categoryMap.get(cat.categoryId));
      } else {
        // 子カテゴリ
        const parent = categoryMap.get(cat.parentCategoryId);
        if (parent) {
          parent.children.push(categoryMap.get(cat.categoryId));
        }
      }
    });
    
    return {
      map: categoryMap,
      roots: rootCategories
    };
  }

  /**
   * メニューをカテゴリにマッピング
   * @private
   */
  _mapMenusToCategories(menus, categoryHierarchy) {
    return menus.map(menu => {
      const category = categoryHierarchy.map.get(menu.categoryId);
      
      if (!category) {
        return {
          ...menu,
          categoryPath: {
            large: menu.categoryName,
            medium: '',
            small: ''
          }
        };
      }
      
      // カテゴリパスを構築
      const categoryPath = this._getCategoryPath(category, categoryHierarchy.map);
      
      return {
        menuId: menu.menuId,
        menuName: menu.menuName,
        categoryName: menu.categoryName,
        categoryPath: categoryPath,
        duration: menu.duration,
        taxIncludedPrice: menu.taxIncludedPrice,
        description: menu.description,
        displayOrder: menu.displayOrder,
        ticketType: menu.ticketType
      };
    });
  }

  /**
   * カテゴリパスを取得（大・中・小）
   * @private
   */
  _getCategoryPath(category, categoryMap) {
    const path = {
      large: '',
      medium: '',
      small: ''
    };
    
    if (!category) {
      return path;
    }
    
    // カテゴリレベルで判定
    if (category.categoryLevel === '大') {
      path.large = category.categoryName;
    } else if (category.categoryLevel === '中') {
      path.medium = category.categoryName;
      // 親カテゴリ（大）を取得
      const parent = categoryMap.get(category.parentCategoryId);
      if (parent) {
        path.large = parent.categoryName;
      }
    } else if (category.categoryLevel === '小') {
      path.small = category.categoryName;
      // 親カテゴリ（中）を取得
      const parent = categoryMap.get(category.parentCategoryId);
      if (parent) {
        path.medium = parent.categoryName;
        // さらに親カテゴリ（大）を取得
        const grandParent = categoryMap.get(parent.parentCategoryId);
        if (grandParent) {
          path.large = grandParent.categoryName;
        }
      }
    }
    
    return path;
  }

  /**
   * チケットタイプ別にメニューをグループ化
   * @private
   */
  _groupMenusByTicketType(menus) {
    const regular = [];    // チケットタイプなし
    const withTicket = []; // チケットタイプあり
    
    menus.forEach(menu => {
      // APIレスポンス用に整形
      const formattedMenu = {
        menu_id: menu.menuId,
        menu_name: menu.menuName,
        category_name: menu.categoryName,
        category_large: menu.categoryPath.large,
        category_medium: menu.categoryPath.medium,
        category_small: menu.categoryPath.small,
        duration_minutes: menu.duration,
        tax_included_price: menu.taxIncludedPrice,
        description: menu.description
      };
      
      if (menu.ticketType && menu.ticketType !== '') {
        formattedMenu.ticket_type = menu.ticketType;
        withTicket.push(formattedMenu);
      } else {
        regular.push(formattedMenu);
      }
    });
    
    return {
      regular: regular,
      withTicket: withTicket
    };
  }

  /**
   * 特定カテゴリのメニューを取得
   * 
   * @method getMenusByCategory
   * @description 指定されたカテゴリレベルとカテゴリ名に一致するメニューのみを取得
   * 
   * @param {string} categoryLevel - カテゴリレベル ("大" | "中" | "小")
   * @param {string} categoryName - カテゴリ名
   * 
   * @returns {Object} レスポンスオブジェクト
   * @returns {boolean} returns.success - 処理成功フラグ
   * @returns {Object} returns.data - フィルタリングされたメニューデータ
   * @returns {Array<Object>} returns.data.regular - フィルタリングされた通常メニュー
   * @returns {Array<Object>} returns.data.withTicket - フィルタリングされたチケット付きメニュー
   * @returns {Object} returns.data.categoryFilter - 使用したフィルタ条件
   * @returns {string} returns.data.categoryFilter.level - 検索に使用したカテゴリレベル
   * @returns {string} returns.data.categoryFilter.name - 検索に使用したカテゴリ名
   * @returns {string} returns.data.timestamp - ISO 8601形式のタイムスタンプ
   * @returns {string} returns.error - エラーメッセージ（エラー時）
   * 
   * @example
   * // リクエスト例1: 大カテゴリでフィルタリング
   * const service = new MenuApiService();
   * const response = service.getMenusByCategory("大", "美容施術");
   * 
   * // リクエスト例2: 中カテゴリでフィルタリング
   * const response = service.getMenusByCategory("中", "点滴");
   * 
   * // リクエスト例3: 小カテゴリでフィルタリング
   * const response = service.getMenusByCategory("小", "水素吸入");
   * 
   * // 成功レスポンス例
   * {
   *   success: true,
   *   data: {
   *     regular: [
   *       {
   *         menu_id: "MENU001",
   *         menu_name: "水素吸入30分",
   *         category_name: "水素吸入",
   *         category_large: "美容施術",
   *         category_medium: "点滴",
   *         category_small: "水素吸入",
   *         duration_minutes: 30,
   *         tax_included_price: 3300,
   *         description: "高濃度水素吸入"
   *       }
   *     ],
   *     withTicket: [],
   *     categoryFilter: {
   *       level: "大",
   *       name: "美容施術"
   *     },
   *     timestamp: "2025-08-06T10:30:00.000Z"
   *   }
   * }
   * 
   * // エラーレスポンス例
   * {
   *   success: false,
   *   error: "カテゴリ別メニュー取得エラー: 指定されたカテゴリが見つかりません"
   * }
   */
  getMenusByCategory(categoryLevel, categoryName) {
    try {
      const allMenus = this.getStructuredMenus();
      
      if (!allMenus.success) {
        return allMenus;
      }
      
      const filteredRegular = this._filterByCategory(
        allMenus.data.regular, 
        categoryLevel, 
        categoryName
      );
      
      const filteredWithTicket = this._filterByCategory(
        allMenus.data.withTicket, 
        categoryLevel, 
        categoryName
      );
      
      return {
        success: true,
        data: {
          regular: filteredRegular,
          withTicket: filteredWithTicket,
          categoryFilter: {
            level: categoryLevel,
            name: categoryName
          },
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      Logger.log(`カテゴリ別メニュー取得エラー: ${error.toString()}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * カテゴリでフィルタリング
   * @private
   */
  _filterByCategory(menus, categoryLevel, categoryName) {
    return menus.filter(menu => {
      switch (categoryLevel) {
        case '大':
          return menu.category_large === categoryName;
        case '中':
          return menu.category_medium === categoryName;
        case '小':
          return menu.category_small === categoryName;
        default:
          return false;
      }
    });
  }
}