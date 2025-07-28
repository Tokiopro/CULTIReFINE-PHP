/**
 * メニュー管理サービス（UI連携用）
 */
class MenuManagementService {
  constructor() {
    this.menuService = new MenuService();
  }

  /**
   * CSVからメニューをインポート
   */
  importMenusFromCSV(csvContent) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('CSVからメニューをインポート開始');
      
      // CSVを解析
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSVファイルにデータがありません');
      }
      
      // ヘッダー行を解析
      const headers = this._parseCSVLine(lines[0]);
      const requiredHeaders = ['メニュー名※必須'];
      
      // 必須ヘッダーの確認
      const headerIndices = {};
      requiredHeaders.forEach(header => {
        const index = headers.indexOf(header);
        if (index === -1) {
          throw new Error(`必須項目 "${header}" が見つかりません`);
        }
        headerIndices[header] = index;
      });
      
      // オプションヘッダーのインデックスを取得
      const optionalHeaders = [
        'No', '説明文', '金額', 'メニューの実施優先度',
        '受付開始日時', '受付終了日時', '受付開始時間', '受付終了時間',
        '時間目安', '対応可能な開始時間', 'メニューに含める施術', 'デポジットを受け取る',
        'カテゴリ', '有効', 'オンライン予約可'
      ];
      
      optionalHeaders.forEach(header => {
        const index = headers.indexOf(header);
        if (index !== -1) {
          headerIndices[header] = index;
        }
      });
      
      // データ行を処理
      const menus = [];
      const errors = [];
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this._parseCSVLine(lines[i]);
          
          // メニュー名が空の行はスキップ
          const menuName = values[headerIndices['メニュー名※必須']];
          if (!menuName || menuName.trim() === '') {
            continue;
          }
          
          const menu = {
            name: menuName.trim(),
            description: this._getOptionalValue(values, headerIndices, '説明文'),
            price: this._parseNumber(this._getOptionalValue(values, headerIndices, '金額')),
            duration_minutes: this._parseNumber(this._getOptionalValue(values, headerIndices, '時間目安')),
            is_active: this._parseBoolean(this._getOptionalValue(values, headerIndices, '有効'), true),
            is_online: this._parseBoolean(this._getOptionalValue(values, headerIndices, 'オンライン予約可'), false),
            category_name: this._getOptionalValue(values, headerIndices, 'カテゴリ'),
            order: this._parseNumber(this._getOptionalValue(values, headerIndices, 'メニューの実施優先度'))
          };
          
          menus.push(menu);
        } catch (error) {
          errors.push(`行 ${i + 1}: ${error.message}`);
        }
      }
      
      if (errors.length > 0) {
        Logger.log('CSVインポートエラー: ' + errors.join('\n'));
      }
      
      if (menus.length === 0) {
        throw new Error('インポート可能なメニューがありません');
      }
      
      // メニューを保存
      const savedCount = this._saveImportedMenus(menus);
      
      Logger.log(`${savedCount}件のメニューをインポートしました`);
      
      return {
        imported: savedCount,
        errors: errors
      };
    });
  }

  /**
   * メニューの詳細を更新（チケットタイプ、カテゴリ、表示順）
   */
  updateMenuDetails(menuData) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニュー詳細更新開始: ' + JSON.stringify(menuData));
      
      const menuSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(Config.getSheetNames().menus);
      
      if (!menuSheet) {
        throw new Error('メニュー管理シートが見つかりません');
      }
      
      const headers = menuSheet.getRange(1, 1, 1, menuSheet.getLastColumn()).getValues()[0];
      const data = menuSheet.getDataRange().getValues();
      
      // 必要な列のインデックスを取得
      const menuIdIndex = headers.indexOf('メニューID');
      const categoryIdIndex = headers.indexOf('カテゴリID');
      const orderIndex = headers.indexOf('表示順');
      
      // チケットタイプ列がない場合は追加
      let ticketTypeIndex = headers.indexOf('チケットタイプ');
      if (ticketTypeIndex === -1) {
        ticketTypeIndex = headers.length;
        menuSheet.getRange(1, ticketTypeIndex + 1).setValue('チケットタイプ');
      }
      
      // 必要チケット数列がない場合は追加
      let requiredTicketsIndex = headers.indexOf('必要チケット数');
      if (requiredTicketsIndex === -1) {
        requiredTicketsIndex = headers.length + (ticketTypeIndex === headers.length ? 1 : 0);
        menuSheet.getRange(1, requiredTicketsIndex + 1).setValue('必要チケット数');
      }
      
      // 対象メニューの行を検索
      let targetRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][menuIdIndex] === menuData.menuId) {
          targetRow = i + 1; // シートの行番号は1から始まる
          break;
        }
      }
      
      if (targetRow === -1) {
        throw new Error('対象のメニューが見つかりません');
      }
      
      // 更新データを設定
      const updates = [];
      
      // カテゴリID更新
      if (categoryIdIndex >= 0) {
        updates.push({
          row: targetRow,
          column: categoryIdIndex + 1,
          value: menuData.categoryId || ''
        });
      }
      
      // チケットタイプ更新
      updates.push({
        row: targetRow,
        column: ticketTypeIndex + 1,
        value: menuData.ticketType || ''
      });
      
      // 必要チケット数更新
      updates.push({
        row: targetRow,
        column: requiredTicketsIndex + 1,
        value: menuData.ticketType ? menuData.requiredTickets : ''
      });
      
      // 表示順更新
      if (orderIndex >= 0) {
        updates.push({
          row: targetRow,
          column: orderIndex + 1,
          value: menuData.order
        });
      }
      
      // バッチで更新
      updates.forEach(update => {
        menuSheet.getRange(update.row, update.column).setValue(update.value);
      });
      
      // カテゴリ名も更新（カテゴリIDから名前を取得）
      if (menuData.categoryId) {
        const categoryNameIndex = headers.indexOf('カテゴリ');
        if (categoryNameIndex >= 0) {
          const categoryService = new MenuService();
          const categories = categoryService.getMenuCategories();
          const category = categories.find(c => c.id === menuData.categoryId);
          if (category) {
            menuSheet.getRange(targetRow, categoryNameIndex + 1).setValue(category.name);
          }
        }
      }
      
      Logger.log('メニュー詳細更新完了');
      return { success: true };
    });
  }
  
  /**
   * メニューをCSVにエクスポート
   */
  exportMenusToCSV() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニューをCSVにエクスポート開始');
      
      // メニューとカテゴリを取得
      const menus = this.menuService.getMenusWithCategories();
      
      // ヘッダー行
      const headers = [
        'No',
        'メニュー名※必須',
        '説明文',
        '金額',
        'メニューの実施優先度',
        '受付開始日時',
        '受付終了日時',
        '受付開始時間',
        '受付終了時間',
        '時間目安',
        '対応可能な開始時間',
        'メニューに含める施術',
        'デポジットを受け取る',
        'カテゴリ',
        '有効',
        'オンライン予約可'
      ];
      
      // データ行を作成
      const rows = [headers];
      
      menus.forEach((menu, index) => {
        const row = [
          index + 1,
          menu.name || '',
          menu.description || '',
          menu.price || '',
          menu.order || '',
          '', // 受付開始日時
          '', // 受付終了日時
          '', // 受付開始時間
          '', // 受付終了時間
          menu.duration_minutes || '',
          '', // 対応可能な開始時間
          '', // メニューに含める施術
          '', // デポジットを受け取る
          menu.categoryName || '',
          menu.is_active ? 'TRUE' : 'FALSE',
          menu.is_online ? 'TRUE' : 'FALSE'
        ];
        rows.push(row);
      });
      
      // CSV形式に変換
      const csv = rows.map(row => 
        row.map(cell => {
          // セル内に改行、ダブルクォート、カンマが含まれる場合は引用符で囲む
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      return csv;
    });
  }

  /**
   * メニュー保存（UI用）
   */
  saveMenu(menuData) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニューを保存: ' + JSON.stringify(menuData));
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().menus);
      if (!sheet) {
        throw new Error('メニュー管理シートが見つかりません');
      }
      
      const now = Utils.formatDateTime(new Date());
      
      if (menuData.id) {
        // 既存メニューの更新
        const dataRange = sheet.getDataRange();
        const data = dataRange.getValues();
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === menuData.id) {
            // 更新
            sheet.getRange(i + 1, 2).setValue(menuData.name);
            sheet.getRange(i + 1, 4).setValue(menuData.categoryId || '');
            sheet.getRange(i + 1, 5).setValue(menuData.order || 0);
            sheet.getRange(i + 1, 6).setValue(menuData.duration_minutes || '');
            sheet.getRange(i + 1, 7).setValue(menuData.price || '');
            sheet.getRange(i + 1, 9).setValue(menuData.is_active ? 'TRUE' : 'FALSE');
            sheet.getRange(i + 1, 10).setValue(menuData.is_online ? 'TRUE' : 'FALSE');
            sheet.getRange(i + 1, 11).setValue(menuData.description || '');
            sheet.getRange(i + 1, 13).setValue(now);
            
            // カテゴリ名を更新
            if (menuData.categoryId) {
              const categories = this.menuService.getMenuCategories();
              const category = categories.find(c => c.id === menuData.categoryId);
              if (category) {
                sheet.getRange(i + 1, 3).setValue(category.name);
              }
            } else {
              sheet.getRange(i + 1, 3).setValue('');
            }
            
            break;
          }
        }
      } else {
        // 新規メニューの追加
        const newId = 'menu_' + Date.now();
        const categoryName = '';
        
        if (menuData.categoryId) {
          const categories = this.menuService.getMenuCategories();
          const category = categories.find(c => c.id === menuData.categoryId);
          if (category) {
            categoryName = category.name;
          }
        }
        
        const newRow = [
          newId,
          menuData.name,
          categoryName,
          menuData.categoryId || '',
          menuData.order || 0,
          menuData.duration_minutes || '',
          menuData.price || '',
          '', // 税込料金
          menuData.is_active ? 'TRUE' : 'FALSE',
          menuData.is_online ? 'TRUE' : 'FALSE',
          menuData.description || '',
          now,
          now
        ];
        
        sheet.appendRow(newRow);
      }
      
      return true;
    });
  }

  /**
   * メニュー削除
   */
  deleteMenu(menuId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('メニューを削除: ' + menuId);
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().menus);
      if (!sheet) {
        throw new Error('メニュー管理シートが見つかりません');
      }
      
      const dataRange = sheet.getDataRange();
      const data = dataRange.getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === menuId) {
          sheet.deleteRow(i + 1);
          Logger.log('メニューを削除しました');
          return true;
        }
      }
      
      throw new Error('削除対象のメニューが見つかりません');
    });
  }

  /**
   * CSV行を解析
   */
  _parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // エスケープされたダブルクォート
          current += '"';
          i++; // 次の文字をスキップ
        } else {
          // クォートの開始/終了
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // フィールドの区切り
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // 最後のフィールドを追加
    values.push(current);
    
    return values;
  }

  /**
   * オプション値を取得
   */
  _getOptionalValue(values, indices, header) {
    if (indices[header] !== undefined && values[indices[header]] !== undefined) {
      return values[indices[header]].trim();
    }
    return '';
  }

  /**
   * 数値を解析
   */
  _parseNumber(value) {
    if (!value) return null;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
  }

  /**
   * ブール値を解析
   */
  _parseBoolean(value, defaultValue = false) {
    if (!value) return defaultValue;
    const v = value.toLowerCase();
    return v === 'true' || v === '1' || v === 'はい' || v === '有効';
  }

  /**
   * インポートしたメニューを保存
   */
  _saveImportedMenus(menus) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().menus);
    if (!sheet) {
      throw new Error('メニュー管理シートが見つかりません');
    }
    
    const now = Utils.formatDateTime(new Date());
    const rows = [];
    
    // カテゴリマップを作成
    const categories = this.menuService.getMenuCategories();
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name, cat.id);
    });
    
    menus.forEach(menu => {
      const categoryId = menu.category_name ? categoryMap.get(menu.category_name) : '';
      
      const row = [
        'menu_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        menu.name,
        menu.category_name || '',
        categoryId || '',
        menu.order || 0,
        menu.duration_minutes || '',
        menu.price || '',
        '', // 税込料金
        menu.is_active ? 'TRUE' : 'FALSE',
        menu.is_online ? 'TRUE' : 'FALSE',
        menu.description || '',
        now,
        now
      ];
      rows.push(row);
    });
    
    // バッチで追加
    if (rows.length > 0) {
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length);
      range.setValues(rows);
    }
    
    return rows.length;
  }
}