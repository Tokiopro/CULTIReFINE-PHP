/**
 * メニューAPI サービス
 * カテゴリ階層構造を持つメニュー情報を提供
 * 
 * @class MenuApiService
 * @description メニュー管理シートとメニューカテゴリー管理シートから
 *              階層構造化されたメニュー情報を取得・提供するサービス
 */
/**
 * メニューAPI サービス
 * メニューデータの取得と構造化を担当
 */
class MenuApiService {
  constructor() {
    // 現在は直接スプレッドシートにアクセスしているため、
    // これらのサービスは実際には使用されていない
    // TODO: 将来的にサービスを適切に活用するよう改善
    // this.menuManager = new MenuManagementService();
    // this.categoryManager = new CategoryService();
  }

  /**
   * 全メニューを階層構造で取得（チケット有無を最上位カテゴリーとして分類）
   * 単体予約用の新しいAPIエンドポイント
   * @return {Object} 構造化されたメニューデータ
   */
  getAllStructuredMenus() {
    try {
      Logger.log('=== 全メニュー階層構造取得開始 ===');
      
      // 全てのアクティブなメニューを取得
      const allMenus = this._getActiveMenus();
      const categories = this._getActiveCategories();
      
      // カテゴリ階層構造を構築
      const categoryHierarchy = this._buildCategoryHierarchy(categories);
      
      // メニューをカテゴリにマッピング
      const menusWithCategory = this._mapMenusToCategories(allMenus, categoryHierarchy);
      
      // チケット有無を最上位カテゴリーとして分類
      const structuredMenus = {
        withTicket: {
          name: 'チケット付与メニュー',
          categories: {}
        },
        withoutTicket: {
          name: '通常メニュー',
          categories: {}
        }
      };
      
      // メニューをチケット有無で分類し、さらに大・中・小カテゴリーで整理
      menusWithCategory.forEach(menu => {
        const hasTicket = menu.ticket_type && menu.ticket_type !== '';
        const targetGroup = hasTicket ? structuredMenus.withTicket : structuredMenus.withoutTicket;
        
        // カテゴリパスを取得（大カテゴリー > 中カテゴリー > 小カテゴリー）
        const categoryPath = menu.category_path || [];
        
        if (categoryPath.length > 0) {
          // 大カテゴリー
          const majorCategory = categoryPath[0];
          if (!targetGroup.categories[majorCategory]) {
            targetGroup.categories[majorCategory] = {
              name: majorCategory,
              categories: {}
            };
          }
          
          if (categoryPath.length > 1) {
            // 中カテゴリー
            const middleCategory = categoryPath[1];
            if (!targetGroup.categories[majorCategory].categories[middleCategory]) {
              targetGroup.categories[majorCategory].categories[middleCategory] = {
                name: middleCategory,
                categories: {},
                menus: []
              };
            }
            
            if (categoryPath.length > 2) {
              // 小カテゴリー
              const minorCategory = categoryPath[2];
              if (!targetGroup.categories[majorCategory].categories[middleCategory].categories[minorCategory]) {
                targetGroup.categories[majorCategory].categories[middleCategory].categories[minorCategory] = {
                  name: minorCategory,
                  menus: []
                };
              }
              targetGroup.categories[majorCategory].categories[middleCategory].categories[minorCategory].menus.push(menu);
            } else {
              // 中カテゴリー直下のメニュー
              targetGroup.categories[majorCategory].categories[middleCategory].menus.push(menu);
            }
          } else {
            // 大カテゴリー直下のメニュー
            if (!targetGroup.categories[majorCategory].menus) {
              targetGroup.categories[majorCategory].menus = [];
            }
            targetGroup.categories[majorCategory].menus.push(menu);
          }
        } else {
          // カテゴリーなしのメニュー
          if (!targetGroup.uncategorized) {
            targetGroup.uncategorized = [];
          }
          targetGroup.uncategorized.push(menu);
        }
      });
      
      Logger.log(`全メニュー取得完了: 合計${allMenus.length}件`);
      Logger.log(`- チケット付与メニュー: ${Object.keys(structuredMenus.withTicket.categories).length}カテゴリー`);
      Logger.log(`- 通常メニュー: ${Object.keys(structuredMenus.withoutTicket.categories).length}カテゴリー`);
      
      return {
        success: true,
        data: structuredMenus,
        totalMenus: allMenus.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      Logger.log(`全メニュー取得エラー: ${error.toString()}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 階層構造メニュー取得（既存メソッド）
   * @deprecated 新しいgetAllStructuredMenus()を使用してください
   * @return {Object} 構造化されたメニューデータ
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
   * アクティブなメニューを取得
   * スプレッドシートから有効なメニューデータを読み込む
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
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('施術マスタ');
    if (!sheet) {
      throw new Error('施術マスタシートが見つかりません');
    }
    
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const data = dataRange.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const menus = [];
    const now = new Date();
    
    data.forEach((row, index) => {
      // アクティブチェック
      const isActiveCol = headers.indexOf('is_active');
      if (isActiveCol >= 0 && row[isActiveCol] === false) {
        return;
      }
      
      // 有効期限チェック  
      const startDateCol = headers.indexOf('valid_from');
      const endDateCol = headers.indexOf('valid_until');
      
      if (startDateCol >= 0 && row[startDateCol] && new Date(row[startDateCol]) > now) {
        return;
      }
      
      if (endDateCol >= 0 && row[endDateCol] && new Date(row[endDateCol]) < now) {
        return;
      }
      
      // メニューデータを構築
      const menu = {
        menu_id: row[headers.indexOf('menu_id')] || `MENU_${index + 2}`,
        name: row[headers.indexOf('name')] || '',
        display_name: row[headers.indexOf('display_name')] || row[headers.indexOf('name')] || '',
        category_id: row[headers.indexOf('category_id')] || '',
        ticket_type: row[headers.indexOf('ticket_type')] || '',
        required_tickets: parseInt(row[headers.indexOf('required_tickets')] || 0),
        duration: parseInt(row[headers.indexOf('duration')] || 30),
        price: parseInt(row[headers.indexOf('price')] || 0),
        menu_order: parseInt(row[headers.indexOf('menu_order')] || 999),
        is_active: true
      };
      
      menus.push(menu);
    });
    
    // menu_orderでソート
    menus.sort((a, b) => a.menu_order - b.menu_order);
    
    Logger.log(`アクティブなメニュー: ${menus.length}件`);
    return menus;
  }

  /**
   * アクティブなカテゴリを取得
   * スプレッドシートから有効なカテゴリデータを読み込む
   * @private
   * @return {Array} カテゴリオブジェクトの配列
   */
  _getActiveCategories() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('カテゴリマスタ');
    if (!sheet) {
      Logger.log('カテゴリマスタシートが見つかりません - カテゴリなしで続行');
      return [];
    }
    
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const data = dataRange.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const categories = [];
    
    data.forEach((row, index) => {
      // アクティブチェック
      const isActiveCol = headers.indexOf('is_active');
      if (isActiveCol >= 0 && row[isActiveCol] === false) {
        return;
      }
      
      const category = {
        category_id: row[headers.indexOf('category_id')] || `CAT_${index + 2}`,
        name: row[headers.indexOf('name')] || '',
        parent_id: row[headers.indexOf('parent_id')] || null,
        level: parseInt(row[headers.indexOf('level')] || 1),
        category_order: parseInt(row[headers.indexOf('category_order')] || 999),
        is_active: true
      };
      
      categories.push(category);
    });
    
    // category_orderでソート
    categories.sort((a, b) => a.category_order - b.category_order);
    
    Logger.log(`アクティブなカテゴリ: ${categories.length}件`);
    return categories;
  }

  /**
   * カテゴリ階層構造を構築
   * フラットなカテゴリ配列から親子関係を持つ階層構造を作成
   * @private
   * @param {Array} categories - カテゴリ配列
   * @return {Object} 階層構造化されたカテゴリオブジェクト
   */
  _buildCategoryHierarchy(categories) {
    const hierarchy = {};
    const categoryMap = {};
    
    // カテゴリIDでマップを作成
    categories.forEach(cat => {
      categoryMap[cat.category_id] = {
        ...cat,
        children: {}
      };
    });
    
    // 階層構造を構築
    categories.forEach(cat => {
      if (!cat.parent_id) {
        // ルートカテゴリ
        hierarchy[cat.category_id] = categoryMap[cat.category_id];
      } else if (categoryMap[cat.parent_id]) {
        // 子カテゴリ
        categoryMap[cat.parent_id].children[cat.category_id] = categoryMap[cat.category_id];
      }
    });
    
    return hierarchy;
  }

  /**
   * メニューをカテゴリにマッピング
   * 各メニューにカテゴリパス（階層）情報を付与
   * @private
   * @param {Array} menus - メニュー配列
   * @param {Object} categoryHierarchy - カテゴリ階層構造
   * @return {Array} カテゴリパスが付与されたメニュー配列
   */
  _mapMenusToCategories(menus, categoryHierarchy) {
    return menus.map(menu => {
      const categoryPath = this._getCategoryPath(menu.category_id, categoryHierarchy);
      return {
        ...menu,
        category_path: categoryPath
      };
    });
  }

  /**
   * カテゴリパスを取得
   * 指定されたカテゴリIDから階層パスを生成
   * @private
   * @param {string} categoryId - カテゴリID
   * @param {Object} hierarchy - カテゴリ階層構造
   * @param {Array} path - 現在のパス（再帰用）
   * @return {Array} カテゴリ名の配列（階層順）
   */
  _getCategoryPath(categoryId, hierarchy, path = []) {
    if (!categoryId) return path;
    
    // 階層を探索
    for (const [catId, category] of Object.entries(hierarchy)) {
      if (catId === categoryId) {
        return [...path, category.name];
      }
      
      // 子カテゴリを探索
      if (category.children && Object.keys(category.children).length > 0) {
        const childPath = this._getCategoryPath(
          categoryId,
          category.children,
          [...path, category.name]
        );
        if (childPath.length > path.length) {
          return childPath;
        }
      }
    }
    
    return path;
  }

  /**
   * メニューをチケットタイプ別にグループ化
   * @private
   * @param {Array} menus - メニュー配列
   * @return {Object} regular（通常）とwithTicket（チケット制）に分類されたメニュー
   */
  _groupMenusByTicketType(menus) {
    const groups = {
      regular: [],
      withTicket: []
    };
    
    menus.forEach(menu => {
      if (menu.ticket_type && menu.ticket_type !== '') {
        groups.withTicket.push(menu);
      } else {
        groups.regular.push(menu);
      }
    });
    
    return groups;
  }

  /**
   * 患者の過去予約からメニューIDを決定
   * @param {string} visitorId - 来院者ID
   * @param {Array<string>} menuNames - メニュー名の配列
   * @return {Object} メニューIDと初回/2回目以降の判定結果
   */
  determineMenuIds(visitorId, menuNames) {
    try {
      Logger.log(`=== メニューID決定処理開始 ===`);
      Logger.log(`来院者ID: ${visitorId}`);
      Logger.log(`メニュー名: ${JSON.stringify(menuNames)}`);
      
      // 過去の予約履歴を取得
      const reservationHistory = this._getReservationHistory(visitorId);
      
      // 各メニューについて初回/2回目以降を判定
      const menuResults = menuNames.map(menuName => {
        const isFirstTime = !this._hasMenuHistory(menuName, reservationHistory);
        const menuId = this._findMenuId(menuName, isFirstTime);
        
        return {
          menu_name: menuName,
          menu_id: menuId,
          is_first_time: isFirstTime,
          duration: this._getMenuDuration(menuId)
        };
      });
      
      Logger.log(`メニューID決定結果: ${JSON.stringify(menuResults)}`);
      
      return {
        success: true,
        data: {
          visitor_id: visitorId,
          menus: menuResults,
          total_duration: menuResults.reduce((sum, m) => sum + m.duration, 0)
        }
      };
      
    } catch (error) {
      Logger.log(`メニューID決定エラー: ${error.toString()}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 予約履歴を取得
   * @private
   * @param {string} visitorId - 来院者ID
   * @return {Array} 予約履歴の配列
   */
  _getReservationHistory(visitorId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('予約管理');
    if (!sheet) return [];
    
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const data = dataRange.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const visitorIdCol = headers.indexOf('visitor_id');
    const menuNameCol = headers.indexOf('menu_name');
    const statusCol = headers.indexOf('status');
    
    return data.filter(row => 
      row[visitorIdCol] === visitorId && 
      row[statusCol] !== 'cancelled'
    ).map(row => ({
      menu_name: row[menuNameCol]
    }));
  }

  /**
   * メニュー履歴があるかチェック
   * @private
   * @param {string} menuName - メニュー名
   * @param {Array} history - 予約履歴
   * @return {boolean} 履歴がある場合true
   */
  _hasMenuHistory(menuName, history) {
    return history.some(h => h.menu_name === menuName);
  }

  /**
   * メニューIDを検索
   * 初回/2回目以降の条件を考慮してメニューIDを特定
   * @private
   * @param {string} menuName - メニュー名
   * @param {boolean} isFirstTime - 初回かどうか
   * @return {string|null} メニューID
   */
  _findMenuId(menuName, isFirstTime) {
    const menus = this._getActiveMenus();
    
    // メニュー名で検索（初回/2回目以降の条件も考慮）
    const matchedMenu = menus.find(menu => {
      // メニュー名が一致
      if (menu.name === menuName || menu.display_name === menuName) {
        // 初回/2回目以降の条件をチェック
        if (isFirstTime && menu.name.includes('初回')) {
          return true;
        } else if (!isFirstTime && !menu.name.includes('初回')) {
          return true;
        }
        // 条件指定がない場合は名前の一致のみで返す
        return true;
      }
      return false;
    });
    
    return matchedMenu ? matchedMenu.menu_id : null;
  }

  /**
   * メニューの所要時間を取得
   * @private
   * @param {string} menuId - メニューID
   * @return {number} 所要時間（分）
   */
  _getMenuDuration(menuId) {
    if (!menuId) return 30; // デフォルト30分
    
    const menus = this._getActiveMenus();
    const menu = menus.find(m => m.menu_id === menuId);
    return menu ? menu.duration : 30;
  }

  /**
   * カテゴリ別メニュー取得（既存メソッド）
   * @param {string} categoryId - カテゴリID（nullの場合は全て）
   * @return {Object} カテゴリ別のメニューデータ
   */
  getMenusByCategory(categoryId = null) {
    try {
      Logger.log(`=== カテゴリ別メニュー取得: ${categoryId || '全て'} ===`);
      
      const menus = this._getActiveMenus();
      const categories = this._getActiveCategories();
      
      // カテゴリIDが指定されている場合はフィルタリング
      let filteredMenus = menus;
      if (categoryId) {
        filteredMenus = this._filterByCategory(menus, categoryId, categories);
      }
      
      // カテゴリ情報を付与
      const menusWithCategory = filteredMenus.map(menu => {
        const category = categories.find(c => c.category_id === menu.category_id);
        return {
          ...menu,
          category_name: category ? category.name : '未分類'
        };
      });
      
      Logger.log(`取得メニュー数: ${menusWithCategory.length}件`);
      
      return {
        success: true,
        data: {
          menus: menusWithCategory,
          category_id: categoryId,
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
   * 指定カテゴリとその子カテゴリのメニューを取得
   * @private
   * @param {Array} menus - メニュー配列
   * @param {string} categoryId - カテゴリID
   * @param {Array} categories - カテゴリ配列
   * @return {Array} フィルタリングされたメニュー配列
   */
  _filterByCategory(menus, categoryId, categories) {
    // 指定カテゴリとその子カテゴリのIDを取得
    const targetCategoryIds = [categoryId];
    const childCategories = categories.filter(c => c.parent_id === categoryId);
    childCategories.forEach(child => {
      targetCategoryIds.push(child.category_id);
    });
    
    return menus.filter(menu => targetCategoryIds.includes(menu.category_id));
  }
}