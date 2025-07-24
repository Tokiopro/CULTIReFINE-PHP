/**
 * カテゴリ管理サービス
 * 施術カテゴリとメニューカテゴリの統合管理
 */
class CategoryService {
  constructor() {
    this.spreadsheetManager = new SpreadsheetManager();
    this.sheetName = Config.SHEET_NAMES.treatmentCategories || 'カテゴリマスタ';
    this.initializeCategorySheetIfNeeded();
  }

  /**
   * カテゴリマスタシートを初期化（必要に応じて）
   */
  initializeCategorySheetIfNeeded() {
    try {
      // シートが存在するかチェック
      const sheet = Utils.getOrCreateSheet(this.sheetName);
      const data = SpreadsheetManager.getSheetData(this.sheetName);
      
      // データが空の場合は初期化
      if (!data || data.length === 0) {
        this.initializeCategorySheet(sheet);
      }
    } catch (error) {
      console.error('カテゴリシート初期化エラー:', error);
      // エラーが発生してもシステムが停止しないように続行
    }
  }

  /**
   * カテゴリマスタシートを初期化
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 初期化するシート
   */
  initializeCategorySheet(sheet) {
    // ヘッダーを設定
    const headers = [
      'カテゴリID',
      'カテゴリ名', 
      'カテゴリタイプ',
      '表示順',
      '有効フラグ',
      '説明',
      '作成日時',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // 初期データを設定
    const initialCategories = [
      {
        'カテゴリID': 'CAT001',
        'カテゴリ名': '美容注射',
        'カテゴリタイプ': 'treatment',
        '表示順': 1,
        '有効フラグ': true,
        '説明': '美容に関する注射治療',
        '作成日時': new Date().toISOString(),
        '更新日時': new Date().toISOString()
      },
      {
        'カテゴリID': 'CAT002',
        'カテゴリ名': '点滴治療',
        'カテゴリタイプ': 'treatment',
        '表示順': 2,
        '有効フラグ': true,
        '説明': '点滴による治療',
        '作成日時': new Date().toISOString(),
        '更新日時': new Date().toISOString()
      },
      {
        'カテゴリID': 'CAT003',
        'カテゴリ名': 'フェイシャル',
        'カテゴリタイプ': 'treatment',
        '表示順': 3,
        '有効フラグ': true,
        '説明': 'フェイシャル治療',
        '作成日時': new Date().toISOString(),
        '更新日時': new Date().toISOString()
      }
    ];
    
    // データを書き込み
    this.spreadsheetManager.writeDataToSheet(this.sheetName, initialCategories, true);
    console.log('カテゴリマスタシートを初期化しました');
  }

  /**
   * 全カテゴリを取得
   * @returns {Array} カテゴリ配列
   */
  getAllCategories() {
    return Utils.executeWithErrorHandling(() => {
      const categories = SpreadsheetManager.getSheetData(this.sheetName);
      return categories || [];
    });
  }

  /**
   * カテゴリタイプ別にカテゴリを取得
   * @param {string} type - カテゴリタイプ ('treatment', 'menu', 'all')
   * @returns {Array} フィルタリングされたカテゴリ配列
   */
  getCategoriesByType(type = 'all') {
    return Utils.executeWithErrorHandling(() => {
      const categories = this.getAllCategories();
      
      if (type === 'all') {
        return categories;
      }
      
      return categories.filter(category => category['カテゴリタイプ'] === type);
    });
  }

  /**
   * カテゴリを追加
   * @param {string} categoryName - カテゴリ名
   * @param {string} categoryType - カテゴリタイプ
   * @param {Object} options - 追加オプション
   * @returns {Object} 追加されたカテゴリ
   */
  addCategory(categoryName, categoryType = 'treatment', options = {}) {
    return Utils.executeWithErrorHandling(() => {
      // 既存のカテゴリをチェック
      const existingCategories = this.getAllCategories();
      const exists = existingCategories.find(
        cat => cat['カテゴリ名'] === categoryName && cat['カテゴリタイプ'] === categoryType
      );
      
      if (exists) {
        return exists;
      }
      
      // 新しいカテゴリIDを生成
      const newId = this.generateCategoryId(existingCategories);
      
      // 表示順を決定
      const maxOrder = Math.max(
        ...existingCategories
          .filter(cat => cat['カテゴリタイプ'] === categoryType)
          .map(cat => cat['表示順'] || 0),
        0
      );
      
      const newCategory = {
        'カテゴリID': newId,
        'カテゴリ名': categoryName,
        'カテゴリタイプ': categoryType,
        '表示順': options.displayOrder || (maxOrder + 1),
        '有効フラグ': options.isActive !== false,
        '説明': options.description || '',
        '作成日時': new Date().toISOString(),
        '更新日時': new Date().toISOString()
      };
      
      // スプレッドシートに追加
      existingCategories.push(newCategory);
      this.spreadsheetManager.writeDataToSheet(this.sheetName, existingCategories, true);
      
      return newCategory;
    });
  }

  /**
   * カテゴリを更新
   * @param {string} categoryId - カテゴリID
   * @param {Object} updates - 更新内容
   * @returns {boolean} 更新成功フラグ
   */
  updateCategory(categoryId, updates) {
    return Utils.executeWithErrorHandling(() => {
      const categories = this.getAllCategories();
      const index = categories.findIndex(cat => cat['カテゴリID'] === categoryId);
      
      if (index === -1) {
        throw new Error('指定されたカテゴリが見つかりません');
      }
      
      // 更新
      Object.keys(updates).forEach(key => {
        if (key !== 'カテゴリID' && key !== '作成日時') {
          categories[index][key] = updates[key];
        }
      });
      
      categories[index]['更新日時'] = new Date().toISOString();
      
      // スプレッドシートに保存
      this.spreadsheetManager.writeDataToSheet(this.sheetName, categories, true);
      
      return true;
    });
  }

  /**
   * カテゴリを検索
   * @param {string} keyword - 検索キーワード
   * @returns {Array} 検索結果
   */
  searchCategories(keyword) {
    return Utils.executeWithErrorHandling(() => {
      const categories = this.getAllCategories();
      const lowerKeyword = keyword.toLowerCase();
      
      return categories.filter(category => {
        return (
          category['カテゴリ名'].toLowerCase().includes(lowerKeyword) ||
          (category['説明'] && category['説明'].toLowerCase().includes(lowerKeyword))
        );
      });
    });
  }

  /**
   * カテゴリを削除（論理削除）
   * @param {string} categoryId - カテゴリID
   * @returns {boolean} 削除成功フラグ
   */
  deleteCategory(categoryId) {
    return this.updateCategory(categoryId, { '有効フラグ': false });
  }

  /**
   * カテゴリIDを生成
   * @param {Array} existingCategories - 既存のカテゴリ配列
   * @returns {string} 新しいカテゴリID
   */
  generateCategoryId(existingCategories) {
    const ids = existingCategories
      .map(cat => cat['カテゴリID'])
      .filter(id => id && id.startsWith('CAT'))
      .map(id => parseInt(id.substring(3)))
      .filter(num => !isNaN(num));
    
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    return `CAT${String(maxId + 1).padStart(3, '0')}`;
  }

  /**
   * カテゴリの表示順を更新
   * @param {Array} categoryIds - 表示順に並べたカテゴリIDの配列
   * @returns {boolean} 更新成功フラグ
   */
  updateDisplayOrder(categoryIds) {
    return Utils.executeWithErrorHandling(() => {
      const categories = this.getAllCategories();
      
      categoryIds.forEach((categoryId, index) => {
        const category = categories.find(cat => cat['カテゴリID'] === categoryId);
        if (category) {
          category['表示順'] = index + 1;
          category['更新日時'] = new Date().toISOString();
        }
      });
      
      // スプレッドシートに保存
      this.spreadsheetManager.writeDataToSheet(this.sheetName, categories, true);
      
      return true;
    });
  }

  /**
   * カテゴリ選択用のHTMLオプションを生成
   * @param {string} type - カテゴリタイプ
   * @param {string} selectedId - 選択されているカテゴリID
   * @returns {string} HTML文字列
   */
  generateCategoryOptions(type = 'all', selectedId = null) {
    return Utils.executeWithErrorHandling(() => {
      const categories = this.getCategoriesByType(type);
      
      // 有効なカテゴリのみフィルタリング
      const activeCategories = categories.filter(cat => cat['有効フラグ']);
      
      // 表示順でソート
      activeCategories.sort((a, b) => (a['表示順'] || 999) - (b['表示順'] || 999));
      
      // HTMLオプションを生成
      let html = '<option value="">カテゴリを選択</option>';
      
      activeCategories.forEach(category => {
        const selected = category['カテゴリID'] === selectedId ? ' selected' : '';
        html += `<option value="${category['カテゴリID']}"${selected}>${category['カテゴリ名']}</option>`;
      });
      
      return html;
    });
  }
}