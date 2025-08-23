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
  getAllStructuredMenus(visitorId = null) {
    try {
      Logger.log('=== 患者別メニュー取得開始 ===');
      Logger.log(`患者ID: ${visitorId || 'なし（全メニュー表示）'}`);
      
      // 患者の初回判定
      let isFirstTimePatient = false;
      if (visitorId) {
        isFirstTimePatient = this._checkIfFirstTimePatient(visitorId);
      }
      
      // 全てのアクティブなメニューを取得
      const allMenus = this._getActiveMenus();
      const categories = this._getActiveCategories();
      
      if (allMenus.length === 0) {
        Logger.log('メニューデータが見つかりません');
        return {
          success: true,
          data: {
            treatmentCategories: [],
            patient_info: {
              visitor_id: visitorId,
              is_first_time: isFirstTimePatient
            }
          }
        };
      }
      
      // メニューを通常/チケットメニューに分類
      const { regularMenus, ticketMenus } = this._categorizeMenusByType(allMenus, isFirstTimePatient);
      
      // カテゴリ階層構造を構築
      const categoryHierarchy = this._buildCategoryHierarchy(categories);
      
      // 通常メニューの階層構造
      const regularMenusWithCategory = this._mapMenusToCategories(regularMenus, categoryHierarchy);
      const regularTreatmentData = this._buildTreatmentDataStructure({ regular: regularMenusWithCategory }, null);
      
      // チケットメニューの階層構造
      const ticketMenusWithCategory = this._mapMenusToCategories(ticketMenus, categoryHierarchy);
      const ticketTreatmentData = this._buildTreatmentDataStructure({ withTicket: ticketMenusWithCategory }, null);
      
      // 最終的な構造を構築
      const treatmentCategories = [];
      
      // 通常メニューカテゴリ
      if (regularTreatmentData.length > 0) {
        treatmentCategories.push({
          id: "regular_menu",
          name: "通常メニュー",
          items: regularTreatmentData[0].items || []
        });
      }
      
      // チケットメニューカテゴリ
      if (ticketTreatmentData.length > 0) {
        treatmentCategories.push({
          id: "ticket_menu",
          name: "チケットメニュー",
          items: ticketTreatmentData[0].items || []
        });
      }
      
      // 統計情報を生成
      const totalRegularMenus = regularMenus.length;
      const totalTicketMenus = ticketMenus.length;
      const totalCategories = treatmentCategories.length;
      
      Logger.log(`患者別メニュー取得完了: 通常${totalRegularMenus}件, チケット${totalTicketMenus}件`);
      
      return {
        success: true,
        data: {
          treatmentCategories: treatmentCategories,
          patient_info: {
            visitor_id: visitorId,
            is_first_time: isFirstTimePatient
          },
          statistics: {
            total_regular_menus: totalRegularMenus,
            total_ticket_menus: totalTicketMenus,
            total_categories: totalCategories,
            source_total_menus: allMenus.length
          },
          generated_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      Logger.log(`患者別メニュー取得エラー: ${error.toString()}`);
      Logger.log(`エラースタック: ${error.stack}`);
      return {
        success: false,
        error: error.message,
        details: error.toString()
      };
    }
  }


  /**
   * 階層構造メニュー取得（既存メソッド）
   * @deprecated 新しいgetAllStructuredMenus()を使用してください
   * @return {Object} 構造化されたメニューデータ
   */
  getStructuredMenus(lineUserId = null) {
    try {
      Logger.log('=== 階層構造メニュー取得開始 ===');
      Logger.log(`LINE User ID: ${lineUserId || 'なし'}`);
      
      // メニューとカテゴリデータを取得
      const menus = this._getActiveMenus();
      const categories = this._getActiveCategories();
      
      // ユーザーのチケット情報を取得（lineUserIdがある場合）
      let userTickets = null;
      if (lineUserId) {
        userTickets = this._getUserTicketInfo(lineUserId);
        Logger.log(`ユーザーチケット情報: ${JSON.stringify(userTickets)}`);
      }
      
      // カテゴリ階層構造を構築
      const categoryHierarchy = this._buildCategoryHierarchy(categories);
      
      // メニューをカテゴリにマッピング（チケット情報も含める）
      const menusWithCategory = this._mapMenusToCategories(menus, categoryHierarchy, userTickets);
      
      // チケットタイプ別にグループ化
      const groupedMenus = this._groupMenusByTicketType(menusWithCategory);
      
      // treatment-data.js形式の階層構造を構築
      const structuredData = this._buildTreatmentDataStructure(groupedMenus, userTickets);
      
      Logger.log(`構造化完了: カテゴリ${structuredData.categories.length}件`);
      
      return {
        success: true,
        data: {
          categories: structuredData.categories,
          userTickets: userTickets,
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
   * ユーザーのチケット情報を取得
   * @private
   * @param {string} lineUserId - LINEユーザーID
   * @returns {Object} チケット情報
   */
  _getUserTicketInfo(lineUserId) {
    try {
      const patientService = new PatientService();
      const patientData = patientService.getPatientByLineUserId(lineUserId);
      
      if (!patientData || !patientData.visitor_id) {
        Logger.log('患者データが見つかりません');
        return null;
      }
      
      // チケット情報を取得（ticket/index.phpと同じ構造）
      const ticketInfo = patientService.getTicketInfo(patientData.visitor_id);
      
      // 形式を整形
      const formattedTickets = {
        stem_cell: {
          remaining: ticketInfo.stem_cell?.remaining || 0,
          used: ticketInfo.stem_cell?.used || 0,
          total: (ticketInfo.stem_cell?.remaining || 0) + (ticketInfo.stem_cell?.used || 0)
        },
        beauty: {
          remaining: ticketInfo.beauty?.remaining || 0,
          used: ticketInfo.beauty?.used || 0,
          total: (ticketInfo.beauty?.remaining || 0) + (ticketInfo.beauty?.used || 0)
        },
        injection: {
          remaining: ticketInfo.injection?.remaining || 0,
          used: ticketInfo.injection?.used || 0,
          total: (ticketInfo.injection?.remaining || 0) + (ticketInfo.injection?.used || 0)
        }
      };
      
      return formattedTickets;
      
    } catch (error) {
      Logger.log(`チケット情報取得エラー: ${error.toString()}`);
      return null;
    }
  }

  /**
   * treatment-data.js形式の階層構造を構築
   * @private
   * @param {Object} groupedMenus - グループ化されたメニュー
   * @param {Object} userTickets - ユーザーのチケット情報
   * @returns {Object} 構造化データ
   */
  _buildTreatmentDataStructure(groupedMenus, userTickets) {
    const treatmentCategories = [];
    
    // チケット利用可能メニュー
    if (groupedMenus.withTicket && groupedMenus.withTicket.length > 0) {
      const ticketCategory = {
        id: "ticket_menu",
        name: "チケット利用可能メニュー",
        items: []
      };
      
      // カテゴリごとにグループ化
      const categoryMap = new Map();
      
      groupedMenus.withTicket.forEach(menu => {
        const categoryPath = menu.category_path || [];
        
        // 第1階層カテゴリ（点滴・注射、美容施術など）
        const mainCategoryName = categoryPath[0] || '未分類';
        const mainCategoryId = this._generateCategoryId('ticket', mainCategoryName);
        
        if (!categoryMap.has(mainCategoryId)) {
          categoryMap.set(mainCategoryId, {
            id: mainCategoryId,
            name: mainCategoryName,
            isSubCategory: true,
            subItems: new Map()
          });
        }
        
        const mainCategory = categoryMap.get(mainCategoryId);
        
        // 第2階層カテゴリがある場合（幹細胞培養上清液など）
        if (categoryPath[1]) {
          const subCategoryName = categoryPath[1];
          const subCategoryId = this._generateCategoryId(mainCategoryId, subCategoryName);
          
          if (!mainCategory.subItems.has(subCategoryId)) {
            mainCategory.subItems.set(subCategoryId, {
              id: subCategoryId,
              name: subCategoryName,
              isSubSubCategory: true,
              treatments: []
            });
          }
          
          const subCategory = mainCategory.subItems.get(subCategoryId);
          
          // メニューを追加（treatment-data.js形式）
          const treatmentItem = this._createTreatmentItemForTreatmentData(menu, userTickets);
          subCategory.treatments.push(treatmentItem);
        } else {
          // 直接メニューを追加（第1階層直下）
          const treatmentItem = this._createTreatmentItemForTreatmentData(menu, userTickets);
          if (!mainCategory.subItems || mainCategory.subItems.size === 0) {
            // subItemsとして格納
            const directSubCategoryId = this._generateCategoryId(mainCategoryId, 'direct');
            mainCategory.subItems.set(directSubCategoryId, {
              id: directSubCategoryId,
              name: mainCategoryName + "メニュー",
              duration: treatmentItem.duration,
              price: treatmentItem.price,
              ticketInfo: treatmentItem.ticketInfo,
              minIntervalDays: treatmentItem.minIntervalDays
            });
          }
        }
      });
      
      // Mapを配列に変換
      categoryMap.forEach(category => {
        if (category.subItems instanceof Map) {
          category.subItems = Array.from(category.subItems.values());
        }
        ticketCategory.items.push(category);
      });
      
      treatmentCategories.push(ticketCategory);
    }
    
    // 通常メニュー（チケット利用不可）
    if (groupedMenus.regular && groupedMenus.regular.length > 0) {
      const regularCategory = {
        id: "regular_menu",
        name: "通常メニュー（チケット利用不可）",
        items: []
      };
      
      // 同様にカテゴリごとにグループ化
      const categoryMap = new Map();
      
      groupedMenus.regular.forEach(menu => {
        const categoryPath = menu.category_path || [];
        const mainCategoryName = categoryPath[0] || '未分類';
        const mainCategoryId = this._generateCategoryId('regular', mainCategoryName);
        
        if (!categoryMap.has(mainCategoryId)) {
          categoryMap.set(mainCategoryId, {
            id: mainCategoryId,
            name: mainCategoryName,
            isSubCategory: true,
            subItems: new Map()
          });
        }
        
        const mainCategory = categoryMap.get(mainCategoryId);
        
        // 第2階層カテゴリがある場合
        if (categoryPath[1]) {
          const subCategoryName = categoryPath[1];
          const subCategoryId = this._generateCategoryId(mainCategoryId, subCategoryName);
          
          if (!mainCategory.subItems.has(subCategoryId)) {
            mainCategory.subItems.set(subCategoryId, {
              id: subCategoryId,
              name: subCategoryName,
              isSubSubCategory: true,
              treatments: []
            });
          }
          
          const subCategory = mainCategory.subItems.get(subCategoryId);
          
          // メニューを追加
          const treatmentItem = this._createTreatmentItemForTreatmentData(menu, null);
          subCategory.treatments.push(treatmentItem);
        } else {
          // 直接メニューを追加
          const treatmentItem = this._createTreatmentItemForTreatmentData(menu, null);
          const directSubCategoryId = this._generateCategoryId(mainCategoryId, 'direct');
          if (!mainCategory.subItems.has(directSubCategoryId)) {
            mainCategory.subItems.set(directSubCategoryId, {
              id: directSubCategoryId,
              name: mainCategoryName + "メニュー",
              duration: treatmentItem.duration,
              price: treatmentItem.price,
              minIntervalDays: treatmentItem.minIntervalDays
            });
          }
        }
      });
      
      // Mapを配列に変換
      categoryMap.forEach(category => {
        if (category.subItems instanceof Map) {
          category.subItems = Array.from(category.subItems.values());
        }
        regularCategory.items.push(category);
      });
      
      treatmentCategories.push(regularCategory);
    }
    
    return treatmentCategories;
  }


  /**
   * 施術アイテムを作成
   * @private
   * @param {Object} menu - メニューデータ
   * @param {Object} userTickets - ユーザーのチケット情報
   * @returns {Object} 施術アイテム
   */
  _createTreatmentItem(menu, userTickets) {
    const item = {
      id: menu.menu_id,
      menu_id: menu.menu_id,
      name: menu.display_name || menu.name,
      duration: this._formatDuration(menu.duration),
      price: this._formatPrice(menu.price),
      minIntervalDays: menu.min_interval_days || 0
    };
    
    // チケット情報を追加
    if (menu.ticket_type && userTickets) {
      item.ticket_type = menu.ticket_type;
      item.required_tickets = menu.required_tickets || 1;
      
      // チケット残枚数情報
      const ticketData = userTickets[menu.ticket_type];
      if (ticketData) {
        item.ticketInfo = {
          remaining: ticketData.remaining,
          displayText: this._generateTicketDisplayText(menu.ticket_type, ticketData.remaining)
        };
      }
    }
    
    return item;
  }

  /**
   * treatment-data.js形式のメニューアイテムを作成
   * @private
   * @param {Object} menu - メニューデータ
   * @param {Object} userTickets - ユーザーのチケット情報
   * @return {Object} treatment-data.js形式のメニューアイテム
   */
  _createTreatmentItemForTreatmentData(menu, userTickets) {
    const item = {
      id: menu.menu_id,
      name: menu.display_name || menu.name,
      duration: this._formatDurationForTreatmentData(menu.duration),
      price: this._formatPriceForTreatmentData(menu.price),
      minIntervalDays: menu.min_interval_days || 0
    };
    
    // チケット情報を追加
    if (menu.ticket_type && userTickets) {
      item.ticketInfo = this._generateTicketInfoForTreatmentData(menu.ticket_type, userTickets, menu.required_tickets || 1);
    }
    
    return item;
  }

  /**
   * treatment-data.js形式の時間フォーマット
   * @private
   * @param {number} minutes - 分数
   * @return {string} フォーマットされた時間
   */
  _formatDurationForTreatmentData(minutes) {
    if (!minutes) return "約60分";
    return `約${minutes}分`;
  }
  
  /**
   * treatment-data.js形式の価格フォーマット
   * @private
   * @param {number} price - 価格
   * @return {string} フォーマットされた価格
   */
  _formatPriceForTreatmentData(price) {
    if (!price || price === 0) return "チケット利用";
    return `${price.toLocaleString()}円`;
  }
  
  /**
   * treatment-data.js形式のチケット情報を生成
   * @private
   * @param {string} ticketType - チケットタイプ
   * @param {Object} userTickets - ユーザーのチケット情報
   * @param {number} requiredTickets - 必要チケット数
   * @return {string} チケット表示情報
   */
  _generateTicketInfoForTreatmentData(ticketType, userTickets, requiredTickets) {
    const ticketData = userTickets[ticketType];
    if (!ticketData) {
      return `${ticketType}プラン対象（残り不明）`;
    }
    
    const remaining = ticketData.remaining || 0;
    return `${ticketType}プラン対象（残り${remaining}枚）`;
  }


  /**
   * カテゴリIDを生成
   * @private
   */
  _generateCategoryId(prefix, name) {
    // 日本語をローマ字に変換する簡易的な処理
    const nameEn = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `${prefix}_${nameEn}`;
  }

  /**
   * 所要時間をフォーマット
   * @private
   */
  _formatDuration(minutes) {
    if (!minutes) return '約30分';
    
    if (minutes < 60) {
      return `約${minutes}分`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (mins === 0) {
        return `約${hours}時間`;
      } else {
        return `約${hours}時間${mins}分`;
      }
    }
  }

  /**
   * 価格をフォーマット
   * @private
   */
  _formatPrice(price) {
    if (!price) return '0円';
    
    // 数値を3桁区切りでフォーマット
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${formatted}円`;
  }

  /**
   * チケット表示テキストを生成
   * @private
   */
  _generateTicketDisplayText(ticketType, remaining) {
    switch(ticketType) {
      case 'stem_cell':
        return `幹細胞チケット（残り${remaining}cc）`;
      case 'beauty':
        return `美容チケット（残り${remaining}枚）`;
      case 'injection':
        return `注射チケット（残り${remaining}枚）`;
      default:
        return `チケット（残り${remaining}）`;
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
    // Config.getSheetNames().menusを使用してシート名を統一
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().menus);
    if (!sheet) {
      throw new Error('メニュー管理シートが見つかりません');
    }
    
    // シートが空（ヘッダー行のみ）の場合の処理
    if (sheet.getLastRow() <= 1) {
      Logger.log('メニュー管理シートにデータがありません');
      return [];
    }
    
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const data = dataRange.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const menus = [];
    const now = new Date();
    
    data.forEach((row, index) => {
      // アクティブチェック
      const isActiveCol = headers.indexOf('有効フラグ');
      if (isActiveCol >= 0 && row[isActiveCol] === false) {
        return;
      }
      
      // オンライン予約可能チェック
      const isOnlineCol = headers.indexOf('オンライン予約可');
      if (isOnlineCol >= 0 && row[isOnlineCol] === false) {
        return;
      }
      
      // メニューデータを構築（MenuServiceの形式に合わせる）
      const menu = {
        menu_id: row[headers.indexOf('メニューID')] || `MENU_${index + 2}`,
        name: row[headers.indexOf('メニュー名')] || '',
        display_name: row[headers.indexOf('表示名')] || row[headers.indexOf('メニュー名')] || '',
        category_id: row[headers.indexOf('カテゴリID')] || '',
        category_name: row[headers.indexOf('カテゴリ名')] || '',
        ticket_type: row[headers.indexOf('チケットタイプ')] || '',
        required_tickets: parseInt(row[headers.indexOf('必要チケット数')] || 0),
        duration: parseInt(row[headers.indexOf('所要時間')] || 30),
        price: parseInt(row[headers.indexOf('料金')] || 0),
        menu_order: parseInt(row[headers.indexOf('表示順')] || 999),
        is_active: true,
        is_online: true
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
    // Config.getSheetNames().menuCategoriesを使用してシート名を統一
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().menuCategories);
    if (!sheet) {
      Logger.log('メニューカテゴリ管理シートが見つかりません - カテゴリなしで続行');
      return [];
    }
    
    // シートが空（ヘッダー行のみ）の場合の処理
    if (sheet.getLastRow() <= 1) {
      Logger.log('メニューカテゴリ管理シートにデータがありません');
      return [];
    }
    
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const data = dataRange.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const categories = [];
    
    data.forEach((row, index) => {
      // アクティブチェック
      const isActiveCol = headers.indexOf('有効フラグ');
      if (isActiveCol >= 0 && row[isActiveCol] === false) {
        return;
      }
      
      const category = {
        category_id: row[headers.indexOf('カテゴリID')] || `CAT_${index + 2}`,
        name: row[headers.indexOf('カテゴリ名')] || '',
        parent_id: row[headers.indexOf('親カテゴリID')] || null,
        level: parseInt(row[headers.indexOf('レベル')] || 1),
        category_order: parseInt(row[headers.indexOf('表示順')] || 999),
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
   * 患者が初回かどうかを判定
   * @private
   * @param {string} visitorId - 患者ID
   * @returns {boolean} 初回の場合true
   */
  _checkIfFirstTimePatient(visitorId) {
    if (!visitorId) {
      return false; // 患者IDが指定されていない場合は初回ではない扱い
    }
    
    try {
      // 過去6ヶ月の予約履歴を確認
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const reservationHistory = this._getPatientReservationHistory(visitorId, sixMonthsAgo);
      
      // 履歴がない = 初回患者
      const isFirstTime = reservationHistory.length === 0;
      
      Logger.log(`患者 ${visitorId} の初回判定: ${isFirstTime} (過去6ヶ月の予約数: ${reservationHistory.length})`);
      return isFirstTime;
      
    } catch (error) {
      Logger.log(`初回患者判定エラー: ${error.toString()}`);
      return false; // エラーの場合は安全側に倒してリピート扱い
    }
  }

  /**
   * メニュー名から初回/リピートメニューかを判別
   * @private
   * @param {string} menuName - メニュー名
   * @returns {Object} {isFirstTime: boolean, isRepeat: boolean}
   */
  _analyzeMenuType(menuName) {
    if (!menuName) {
      return { isFirstTime: false, isRepeat: false };
    }
    
    const isFirstTime = menuName.includes('（初回）') || 
                       menuName.includes('(初回)') || 
                       menuName.includes('【初回】');
    
    const isRepeat = menuName.includes('（2回目）') || 
                    menuName.includes('（2回目以降）') || 
                    menuName.includes('(2回目)') || 
                    menuName.includes('(2回目以降)') ||
                    menuName.includes('【2回目】') ||
                    menuName.includes('【リピート】');
    
    return { isFirstTime, isRepeat };
  }

  /**
   * 患者のタイプに応じてメニューを表示すべきかを判定
   * @private
   * @param {Object} menu - メニュー情報
   * @param {boolean} isFirstTimePatient - 患者が初回かどうか
   * @returns {boolean} 表示すべき場合true
   */
  _shouldDisplayMenuForPatient(menu, isFirstTimePatient) {
    const menuType = this._analyzeMenuType(menu.name || menu.display_name);
    
    if (isFirstTimePatient) {
      // 初回患者：リピートメニューは表示しない
      return !menuType.isRepeat;
    } else {
      // リピート患者：初回専用メニューは表示しない
      return !menuType.isFirstTime;
    }
  }

  /**
   * メニューを通常/チケットメニューに分類
   * @private
   * @param {Array} menus - メニュー一覧
   * @param {boolean} isFirstTimePatient - 患者が初回かどうか
   * @returns {Object} {regularMenus: Array, ticketMenus: Array}
   */
  _categorizeMenusByType(menus, isFirstTimePatient) {
    const regularMenus = [];
    const ticketMenus = [];
    
    menus.forEach(menu => {
      // 患者のタイプに合わないメニューはスキップ
      if (!this._shouldDisplayMenuForPatient(menu, isFirstTimePatient)) {
        return;
      }
      
      // チケットタイプがあるメニューの処理
      if (menu.ticket_type && menu.ticket_type !== '') {
        // 通常メニューとして追加（実価格）
        regularMenus.push({
          ...menu,
          category: 'regular',
          price_display: this._formatPrice(menu.price),
          price_value: menu.price
        });
        
        // チケットメニューとして追加（0円）
        ticketMenus.push({
          ...menu,
          category: 'ticket',
          price_display: 'チケット利用',
          price_value: 0,
          original_price: menu.price,
          ticket_info: `${menu.ticket_type}プラン対象`
        });
      } else {
        // 通常メニューのみに追加
        regularMenus.push({
          ...menu,
          category: 'regular',
          price_display: this._formatPrice(menu.price),
          price_value: menu.price
        });
      }
    });
    
    Logger.log(`メニュー分類完了 - 通常: ${regularMenus.length}件, チケット: ${ticketMenus.length}件`);
    return { regularMenus, ticketMenus };
  }

  /**
   * 患者の予約履歴を取得
   * @private
   * @param {string} visitorId - 患者ID
   * @param {Date} fromDate - 開始日
   * @returns {Array} 予約履歴の配列
   */
  _getPatientReservationHistory(visitorId, fromDate) {
    try {
      // 予約情報シートからデータを取得
      const reservationSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(Config.getSheetNames().reservations);
      
      if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
        return [];
      }
      
      const headers = reservationSheet.getRange(1, 1, 1, reservationSheet.getLastColumn()).getValues()[0];
      const data = reservationSheet.getRange(2, 1, reservationSheet.getLastRow() - 1, reservationSheet.getLastColumn()).getValues();
      
      const visitorIdCol = headers.indexOf('患者ID') !== -1 ? headers.indexOf('患者ID') : headers.indexOf('来院者ID');
      const dateCol = headers.indexOf('予約日時');
      
      if (visitorIdCol === -1 || dateCol === -1) {
        Logger.log('予約履歴の必要な列が見つかりません');
        return [];
      }
      
      const reservations = data.filter(row => {
        const reservationVisitorId = row[visitorIdCol];
        const reservationDate = new Date(row[dateCol]);
        
        return reservationVisitorId === visitorId && 
               reservationDate >= fromDate &&
               reservationDate <= new Date(); // 未来の予約は除外
      });
      
      return reservations;
      
    } catch (error) {
      Logger.log(`予約履歴取得エラー: ${error.toString()}`);
      return [];
    }
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
  _mapMenusToCategories(menus, categoryHierarchy, userTickets = null) {
    return menus.map(menu => {
      const categoryPath = this._getCategoryPath(menu.category_id, categoryHierarchy);
      const mappedMenu = {
        ...menu,
        category_path: categoryPath
      };
      
      // ユーザーのチケット情報があれば追加
      if (userTickets && menu.ticket_type) {
        const ticketData = userTickets[menu.ticket_type];
        if (ticketData) {
          mappedMenu.user_ticket_remaining = ticketData.remaining;
          mappedMenu.user_ticket_total = ticketData.total;
        }
      }
      
      return mappedMenu;
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

  /**
   * メニュー名を正規化（初回/2回目の表記を除去）
   * @param {string} menuName - 元のメニュー名
   * @returns {string} 正規化されたメニュー名
   */
  normalizeMenuName(menuName) {
    if (!menuName) return '';
    
    return menuName
      .replace(/【初回】/g, '')
      .replace(/【2回目以降】/g, '')
      .replace(/（初回）/g, '')
      .replace(/（2回目以降）/g, '')
      .replace(/\(初回\)/g, '')
      .replace(/\(2回目以降\)/g, '')
      .replace(/初回/g, '')
      .replace(/2回目以降/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 患者の履歴に基づいて適切なメニューIDを判定
   * @param {string} normalizedMenuName - 正規化されたメニュー名
   * @param {string} lineUserId - LINEユーザーID
   * @returns {string} 適切なメニューID（初回 or 2回目以降）
   */
  determineMenuId(normalizedMenuName, lineUserId) {
    try {
      Logger.log(`メニューID判定開始: ${normalizedMenuName}, LINE ID: ${lineUserId}`);
      
      // 患者の予約履歴を取得
      const patientHistory = this._getPatientReservationHistory(lineUserId);
      
      // 過去半年以内に同じメニューの履歴があるかチェック
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const hasRecentHistory = patientHistory.some(record => {
        const recordMenuName = this.normalizeMenuName(record.menu_name || '');
        const recordDate = new Date(record.reservation_date || record.date);
        
        return recordMenuName === normalizedMenuName && recordDate > sixMonthsAgo;
      });
      
      Logger.log(`履歴チェック結果: ${hasRecentHistory ? '2回目以降' : '初回'}`);
      
      // 適切なメニューIDを取得
      return hasRecentHistory ? 
        this._getRepeatMenuId(normalizedMenuName) : 
        this._getFirstTimeMenuId(normalizedMenuName);
        
    } catch (error) {
      Logger.log(`メニューID判定エラー: ${error.toString()}`);
      // エラーの場合は初回を返す
      return this._getFirstTimeMenuId(normalizedMenuName);
    }
  }

  /**
   * 組み合わせ可能なメニューを取得
   * @param {Array} selectedMenuIds - 既に選択されているメニューID配列
   * @param {string} lineUserId - LINEユーザーID（オプション）
   * @returns {Object} API レスポンス
   */
  getCompatibleMenus(selectedMenuIds = [], lineUserId = null) {
    try {
      Logger.log(`組み合わせ可能メニュー取得: 選択済み${selectedMenuIds.length}件`);
      
      // 全アクティブメニューを取得
      const allMenus = this._getActiveMenus();
      
      // CombinationRuleServiceを初期化
      const ruleService = new CombinationRuleService();
      
      // 組み合わせ可能なメニューを取得
      const compatibleMenus = ruleService.getCompatibleMenus(selectedMenuIds, allMenus);
      
      // 正規化されたメニューリストを作成（重複除去）
      const normalizedMenus = this._createNormalizedMenuList(compatibleMenus, lineUserId);
      
      return {
        success: true,
        data: {
          compatibleMenus: normalizedMenus,
          selectedCount: selectedMenuIds.length,
          compatibleCount: normalizedMenus.length
        }
      };
      
    } catch (error) {
      Logger.log(`組み合わせ可能メニュー取得エラー: ${error.toString()}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 正規化されたメニューリストを作成（重複除去＋履歴判定）
   * @param {Array} menus - メニューリスト
   * @param {string} lineUserId - LINEユーザーID
   * @returns {Array} 正規化されたメニューリスト
   */
  _createNormalizedMenuList(menus, lineUserId) {
    const normalizedMap = new Map();
    
    menus.forEach(menu => {
      const normalizedName = this.normalizeMenuName(menu.name || menu.display_name || '');
      
      if (!normalizedMap.has(normalizedName)) {
        // 適切なメニューIDを判定
        const appropriateMenuId = lineUserId ? 
          this.determineMenuId(normalizedName, lineUserId) : 
          (menu.menu_id || menu.id);
        
        normalizedMap.set(normalizedName, {
          id: appropriateMenuId,
          menu_id: appropriateMenuId,
          normalizedName: normalizedName,
          displayName: normalizedName,
          originalMenus: [],
          category_id: menu.category_id,
          duration: menu.duration,
          price: menu.price,
          ticket_type: menu.ticket_type,
          required_tickets: menu.required_tickets
        });
      }
      
      // 元メニュー情報を追加
      normalizedMap.get(normalizedName).originalMenus.push(menu);
    });
    
    return Array.from(normalizedMap.values());
  }

  /**
   * 患者の予約履歴を取得
   * @private
   * @param {string} lineUserId - LINEユーザーID
   * @returns {Array} 予約履歴配列
   */
  _getPatientReservationHistory(lineUserId) {
    try {
      // PatientServiceを使用して患者データを取得
      const patientService = new PatientService();
      const patientData = patientService.getPatientByLineUserId(lineUserId);
      
      if (!patientData || !patientData.visitor_id) {
        Logger.log('患者データが見つかりません');
        return [];
      }
      
      // 予約履歴を取得
      const reservationHistory = patientService.getReservationHistory(patientData.visitor_id);
      return reservationHistory || [];
      
    } catch (error) {
      Logger.log(`予約履歴取得エラー: ${error.toString()}`);
      return [];
    }
  }

  /**
   * 初回メニューIDを取得
   * @private
   * @param {string} normalizedMenuName - 正規化されたメニュー名
   * @returns {string} 初回メニューID
   */
  _getFirstTimeMenuId(normalizedMenuName) {
    const menus = this._getActiveMenus();
    
    // 【初回】や（初回）が含まれるメニューを探す
    const firstTimeMenu = menus.find(menu => {
      const menuName = menu.name || menu.display_name || '';
      const normalized = this.normalizeMenuName(menuName);
      
      return normalized === normalizedMenuName && 
             (menuName.includes('初回') || menuName.includes('【初回】') || menuName.includes('（初回）'));
    });
    
    if (firstTimeMenu) {
      return firstTimeMenu.menu_id || firstTimeMenu.id;
    }
    
    // 初回専用メニューが見つからない場合、通常メニューを返す
    const normalMenu = menus.find(menu => {
      const normalized = this.normalizeMenuName(menu.name || menu.display_name || '');
      return normalized === normalizedMenuName;
    });
    
    return normalMenu ? (normalMenu.menu_id || normalMenu.id) : null;
  }

  /**
   * 2回目以降メニューIDを取得
   * @private
   * @param {string} normalizedMenuName - 正規化されたメニュー名
   * @returns {string} 2回目以降メニューID
   */
  _getRepeatMenuId(normalizedMenuName) {
    const menus = this._getActiveMenus();
    
    // 【2回目以降】や（2回目以降）が含まれるメニューを探す
    const repeatMenu = menus.find(menu => {
      const menuName = menu.name || menu.display_name || '';
      const normalized = this.normalizeMenuName(menuName);
      
      return normalized === normalizedMenuName && 
             (menuName.includes('2回目以降') || menuName.includes('【2回目以降】') || menuName.includes('（2回目以降）'));
    });
    
    if (repeatMenu) {
      return repeatMenu.menu_id || repeatMenu.id;
    }
    
    // 2回目以降専用メニューが見つからない場合、通常メニューを返す
    const normalMenu = menus.find(menu => {
      const normalized = this.normalizeMenuName(menu.name || menu.display_name || '');
      return normalized === normalizedMenuName;
    });
    
    return normalMenu ? (normalMenu.menu_id || normalMenu.id) : null;
  }

  /**
   * メニュー組み合わせの妥当性を検証
   * @param {Array} menuIds - メニューID配列
   * @returns {Object} 検証結果
   */
  validateMenuCombination(menuIds) {
    try {
      if (!menuIds || menuIds.length === 0) {
        return { valid: true, errors: [] };
      }
      
      const menus = this._getActiveMenus();
      const selectedMenus = menus.filter(menu => 
        menuIds.includes(menu.menu_id || menu.id)
      );
      
      if (selectedMenus.length !== menuIds.length) {
        return {
          valid: false,
          errors: ['一部のメニューが見つかりませんでした']
        };
      }
      
      const ruleService = new CombinationRuleService();
      const errors = [];
      
      // 全ての組み合わせをチェック
      for (let i = 0; i < selectedMenus.length; i++) {
        for (let j = i + 1; j < selectedMenus.length; j++) {
          const result = ruleService.canCombineHorizontally(selectedMenus[i], selectedMenus[j]);
          if (!result.allowed) {
            errors.push(`${selectedMenus[i].name} と ${selectedMenus[j].name} の組み合わせは不可: ${result.reason}`);
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
      
    } catch (error) {
      Logger.log(`メニュー組み合わせ検証エラー: ${error.toString()}`);
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }
}

/**
 * treatment-data.js形式メニュー取得のテスト関数
 * 手動でテストする際に使用
 */
function testGetAllStructuredMenus() {
  try {
    Logger.log('=== treatment-data.js形式メニュー取得テスト開始 ===');
    
    const menuService = new MenuApiService();
    const result = menuService.getAllStructuredMenus();
    
    Logger.log('=== テスト結果 ===');
    Logger.log(`成功: ${result.success}`);
    Logger.log(`総メニュー数: ${result.totalMenus}`);
    Logger.log(`カテゴリ数: ${result.data ? result.data.length : 0}`);
    
    if (result.success && result.data) {
      result.data.forEach((category, index) => {
        Logger.log(`カテゴリ${index + 1}: ${category.name} (ID: ${category.id})`);
        Logger.log(`- アイテム数: ${category.items ? category.items.length : 0}`);
        
        if (category.items && category.items.length > 0) {
          category.items.forEach((item, itemIndex) => {
            Logger.log(`  - アイテム${itemIndex + 1}: ${item.name} (ID: ${item.id})`);
            if (item.subItems && item.subItems.length > 0) {
              Logger.log(`    - サブアイテム数: ${item.subItems.length}`);
              item.subItems.forEach((subItem, subIndex) => {
                Logger.log(`      - サブアイテム${subIndex + 1}: ${subItem.name} (ID: ${subItem.id})`);
                if (subItem.treatments && subItem.treatments.length > 0) {
                  Logger.log(`        - トリートメント数: ${subItem.treatments.length}`);
                }
              });
            }
          });
        }
      });
      
      // JSONの一部を出力（長すぎる場合は切り詰め）
      const jsonString = JSON.stringify(result.data, null, 2);
      const previewLength = Math.min(jsonString.length, 2000);
      Logger.log(`=== JSON出力（先頭${previewLength}文字） ===`);
      Logger.log(jsonString.substring(0, previewLength));
      if (jsonString.length > previewLength) {
        Logger.log('...(省略)');
      }
    }
    
    Logger.log('=== テスト完了 ===');
    return result;
    
  } catch (error) {
    Logger.log(`テストエラー: ${error.toString()}`);
    return {
      success: false,
      error: error.message
    };
  }
}
