/**
 * メニュー管理サービス
 */
class MenuService {
  constructor() {
    this.apiClient = new ApiClient();
    this.sheetName = Config.getSheetNames().menus;
    this.categorySheetName = Config.getSheetNames().menuCategories;
    this.spreadsheetManager = new SpreadsheetManager();
  }
  
  /**
   * メニュー情報を同期（ページネーション対応）
   */
  syncMenus() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニュー情報の同期を開始します');
      Logger.log(`使用するclinic_id: ${Config.getClinicId()}`);
      
      const allMenus = [];
      const perPage = 100;  // 一度に取得する件数
      let page = 1;
      let hasMore = true;
      
      // 全データを取得するまでループ
      while (hasMore) {
        Logger.log(`メニュー情報を取得中... (page: ${page})`);
        
        // APIからメニュー情報を取得
        const response = this.apiClient.getMenus({
          per_page: perPage,
          page: page,
          sort_column: 'name',
          order: 'ASC'
        });
        
        if (!response.success || !response.data) {
          throw new Error('メニュー情報の取得に失敗しました');
        }
        
        // APIレスポンスは { items: [...], count: N } の形式
        const menus = response.data.items || [];
        const totalCount = parseInt(response.data.count) || 0;
        
        Logger.log(`${menus.length}件を取得 (全${totalCount}件中)`);
        
        if (menus.length === 0) {
          hasMore = false;
        } else {
          allMenus.push(...menus);
          page++;
          
          // 取得した件数が全件数に達したか、perPageより少ない場合は終了
          if (allMenus.length >= totalCount || menus.length < perPage) {
            hasMore = false;
          }
        }
        
        // APIのレート制限対策
        if (hasMore) {
          Utilities.sleep(100);
        }
      }
      
      Logger.log(`合計${allMenus.length}件のメニュー情報を取得しました`);
      
      // データをスプレッドシートに保存
      this._saveMenusToSheet(allMenus);
      
      return allMenus.length;
    });
  }
  
  /**
   * メニュー情報をスプレッドシートに保存
   */
  _saveMenusToSheet(menus) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
    if (!sheet) {
      throw new Error(`シート「${this.sheetName}」が見つかりません`);
    }
    
    // 既存のデータをクリア（ヘッダー行は残す）
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    if (menus.length === 0) {
      Logger.log('保存するメニューデータがありません');
      return;
    }
    
    // データを整形
    const rows = menus.map(menu => this._formatMenuRow(menu));
    
    // バッチでデータを書き込み
    Utils.writeDataToSheet(sheet, rows, 2);
    
    Logger.log(`${rows.length}件のメニュー情報をスプレッドシートに保存しました`);
  }
  
  /**
   * メニューデータを行形式に変換
   */
  _formatMenuRow(menu) {
    const now = Utils.formatDateTime(new Date());
    
    return [
      menu.id || '',                           // menu_id
      menu.name || '',                         // メニュー名
      '',                                      // カテゴリ（APIに含まれない）
      '',                                      // カテゴリID
      '',                                      // 表示順
      '',                                      // 所要時間（分）（APIに含まれない）
      '',                                      // 料金（APIに含まれない）
      '',                                      // 税込料金（APIに含まれない）
      menu.is_collaborated ? 'TRUE' : 'FALSE', // 有効フラグ（is_collaboratedを使用）
      menu.is_online ? 'TRUE' : 'FALSE',       // オンライン予約可
      menu.description || '',                  // 説明
      now,                                     // 作成日時
      now                                      // 更新日時
    ];
  }
  
  /**
   * メニュー一覧を取得（スプレッドシートから）
   */
  getMenusFromSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    // ヘッダー行を取得して列インデックスを特定
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const ticketTypeIndex = headers.indexOf('チケットタイプ');
    const requiredTicketsIndex = headers.indexOf('必要チケット数');
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    return data.map(row => ({
      id: row[0],
      menu_id: row[0],
      name: row[1],
      category: row[2],
      categoryId: row[3],
      order: row[4],
      duration_minutes: row[5],
      price: row[6],
      price_with_tax: row[7],
      is_active: row[8] === 'TRUE',
      is_online: row[9] === 'TRUE',
      description: row[10],
      ticketType: ticketTypeIndex >= 0 ? row[ticketTypeIndex] : '',
      requiredTickets: requiredTicketsIndex >= 0 ? (row[requiredTicketsIndex] || 1) : 1
    }));
  }
  
  /**
   * メニューカテゴリ一覧を取得
   */
  getMenuCategories() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニューカテゴリ一覧を取得します');
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.categorySheetName);
      if (!sheet) {
        Logger.log('メニューカテゴリシートが見つかりません');
        return [];
      }
      
      const dataRange = sheet.getDataRange();
      const data = dataRange.getValues();
      
      if (data.length <= 1) {
        return [];
      }
      
      // ヘッダー行を除いてデータを取得
      return data.slice(1).map(row => ({
        id: row[0],
        level: row[1],
        name: row[2],
        parentId: row[3],
        order: row[4],
        active: row[5],
        description: row[6],
        createdAt: row[7],
        updatedAt: row[8]
      })).filter(category => category.id); // 空の行を除外
    }, 'メニューカテゴリ取得');
  }
  
  /**
   * メニューカテゴリを保存
   */
  saveMenuCategory(categoryData) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニューカテゴリを保存します');
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.categorySheetName);
      if (!sheet) {
        throw new Error('メニューカテゴリシートが見つかりません');
      }
      
      const dataRange = sheet.getDataRange();
      const data = dataRange.getValues();
      
      // 既存のカテゴリかチェック
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === categoryData.id) {
          rowIndex = i;
          break;
        }
      }
      
      const now = new Date();
      const rowData = [
        categoryData.id,
        categoryData.level,
        categoryData.name,
        categoryData.parentId || '',
        categoryData.order,
        categoryData.active,
        categoryData.description || '',
        rowIndex === -1 ? now : data[rowIndex][7], // 作成日時
        now // 更新日時
      ];
      
      if (rowIndex === -1) {
        // 新規追加
        sheet.appendRow(rowData);
        Logger.log('新規カテゴリを追加しました');
      } else {
        // 更新
        const range = sheet.getRange(rowIndex + 1, 1, 1, rowData.length);
        range.setValues([rowData]);
        Logger.log('既存カテゴリを更新しました');
      }
      
      return true;
    }, 'メニューカテゴリ保存');
  }
  
  /**
   * メニューカテゴリを削除
   */
  deleteMenuCategory(categoryId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`メニューカテゴリを削除します: ${categoryId}`);
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.categorySheetName);
      if (!sheet) {
        throw new Error('メニューカテゴリシートが見つかりません');
      }
      
      const dataRange = sheet.getDataRange();
      const data = dataRange.getValues();
      
      // 削除対象の行を検索
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === categoryId) {
          rowIndex = i;
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error('削除対象のカテゴリが見つかりません');
      }
      
      // 子カテゴリが存在するかチェック
      const hasChildren = data.some((row, index) => index > 0 && row[3] === categoryId);
      if (hasChildren) {
        throw new Error('子カテゴリが存在するため削除できません');
      }
      
      // 行を削除
      sheet.deleteRow(rowIndex + 1);
      Logger.log('カテゴリを削除しました');
      
      return true;
    }, 'メニューカテゴリ削除');
  }
  
  /**
   * CSVからメニューをインポート
   * @param {string} csvContent - CSVコンテンツ
   * @returns {Object} インポート結果
   */
  importMenusFromCsv(csvContent) {
    return Utils.executeWithErrorHandling(() => {
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSVファイルにデータがありません');
      }

      // ヘッダー行を取得
      const headers = this.parseCsvLine(lines[0]);
      
      // 必須フィールドの確認
      const requiredFields = ['メニュー名※必須'];
      const missingFields = requiredFields.filter(field => !headers.includes(field));
      
      if (missingFields.length > 0) {
        throw new Error(`必須フィールドが不足しています: ${missingFields.join(', ')}`);
      }

      // 施術マスタから基本データを取得
      const treatmentService = new TreatmentMasterService();
      const treatments = treatmentService.getAllTreatments();
      
      // データ行を処理
      const menus = [];
      const errors = [];
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCsvLine(lines[i]);
          if (values.length === 0 || !values[1]) continue; // 空行またはNoのみの行をスキップ
          
          const menu = {};
          headers.forEach((header, index) => {
            menu[header] = values[index] || '';
          });
          
          // 必須フィールドの検証
          if (!menu['メニュー名※必須']) {
            throw new Error(`行 ${i + 1}: メニュー名が入力されていません`);
          }
          
          // 施術との紐付け（メニューに含める施術）
          const linkedTreatments = menu['メニューに含める施術'] ? 
            menu['メニューに含める施術'].split(',').map(t => t.trim()) : [];
          
          // デフォルト値の設定
          const menuData = {
            'menu_id': this.generateMenuId(),
            'メニュー名': menu['メニュー名※必須'],
            '説明': menu['説明文'] || '',
            '料金': parseInt(menu['金額']) || 0,
            '税込料金': Math.floor((parseInt(menu['金額']) || 0) * 1.1),
            '所要時間': parseInt(menu['時間目安']) || 60,
            'カテゴリ': '未分類',
            'カテゴリID': '',
            '有効フラグ': true,
            'オンライン予約可': true,
            '表示順': parseInt(menu['メニューの実施優先度']) || 999,
            'チケットタイプ': '',
            '必要チケット数': 0,
            '施術リンク': linkedTreatments,
            'インポート日時': new Date().toISOString()
          };
          
          menus.push(menuData);
        } catch (error) {
          errors.push(`行 ${i + 1}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.warn('インポート時の警告:', errors);
      }

      // スプレッドシートに書き込み
      if (menus.length > 0) {
        const existingMenus = this.getMenusFromSheet() || [];
        const allMenus = [...existingMenus, ...menus];
        this.spreadsheetManager.writeDataToSheet(this.sheetName, allMenus, true);
      }

      return {
        success: true,
        imported: menus.length,
        errors: errors,
        message: `${menus.length}件のメニューをインポートしました`
      };
    });
  }

  /**
   * CSV行をパース
   * @param {string} line - CSV行
   * @returns {Array} パースされた値の配列
   */
  parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * メニューIDを生成
   * @returns {string} 新しいメニューID
   */
  generateMenuId() {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `MENU_${timestamp}_${random}`;
  }

  /**
   * カテゴリ付きメニュー一覧を取得
   */
  getMenusWithCategories() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('カテゴリ付きメニュー一覧を取得します');
      
      // メニューを取得
      const menus = this.getMenusFromSheet();
      
      // カテゴリを取得
      const categories = this.getMenuCategories();
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      
      // メニューにカテゴリ情報を追加
      return menus.map(menu => {
        const category = categoryMap.get(menu.categoryId);
        return {
          ...menu,
          categoryName: category ? category.name : null
        };
      });
    }, 'カテゴリ付きメニュー取得');
  }
  
  /**
   * メニューの表示順を更新
   */
  updateMenuOrder(menuId, newOrder) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`メニューの表示順を更新します: ${menuId} -> ${newOrder}`);
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        throw new Error('メニューシートが見つかりません');
      }
      
      const dataRange = sheet.getDataRange();
      const data = dataRange.getValues();
      
      // 対象メニューの行を検索
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === menuId) {
          rowIndex = i;
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error('対象のメニューが見つかりません');
      }
      
      // 表示順を更新
      sheet.getRange(rowIndex + 1, 5).setValue(newOrder); // 5列目が表示順
      Logger.log('メニューの表示順を更新しました');
      
      return true;
    }, 'メニュー表示順更新');
  }
  
  /**
   * メニューのカテゴリを更新
   */
  updateMenuCategory(menuId, categoryId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`メニューのカテゴリを更新します: ${menuId} -> ${categoryId}`);
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        throw new Error('メニューシートが見つかりません');
      }
      
      const dataRange = sheet.getDataRange();
      const data = dataRange.getValues();
      
      // 対象メニューの行を検索
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === menuId) {
          rowIndex = i;
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error('対象のメニューが見つかりません');
      }
      
      // カテゴリIDを更新
      sheet.getRange(rowIndex + 1, 4).setValue(categoryId); // 4列目がカテゴリID
      
      // カテゴリ名も更新
      const categories = this.getMenuCategories();
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        sheet.getRange(rowIndex + 1, 3).setValue(category.name); // 3列目がカテゴリ名
      }
      
      Logger.log('メニューのカテゴリを更新しました');
      
      return true;
    }, 'メニューカテゴリ更新');
  }
}