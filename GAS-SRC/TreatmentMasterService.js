/**
 * 施術マスター管理サービス
 * 施術データの管理とメニューとの連携を提供
 */
class TreatmentMasterService {
  constructor() {
    this.spreadsheetManager = new SpreadsheetManager();
    this.sheetName = Config.SHEET_NAMES.treatmentMaster || '施術マスタ';
    this.categorySheetName = Config.SHEET_NAMES.treatmentCategories || 'カテゴリマスタ';
  }

  /**
   * 全施術データを取得
   * @returns {Array} 施術データ配列
   */
  getAllTreatments() {
    return Utils.executeWithErrorHandling(() => {
      const treatments = SpreadsheetManager.getSheetData(this.sheetName);
      return treatments || [];
    });
  }

  /**
   * カテゴリごとに施術データを取得
   * @returns {Object} カテゴリ別施術データ
   */
  getTreatmentsByCategory() {
    return Utils.executeWithErrorHandling(() => {
      const treatments = this.getAllTreatments();
      const groupedTreatments = {};
      
      treatments.forEach(treatment => {
        const category = treatment['カテゴリ'] || '未分類';
        if (!groupedTreatments[category]) {
          groupedTreatments[category] = [];
        }
        groupedTreatments[category].push(treatment);
      });
      
      return groupedTreatments;
    });
  }

  /**
   * メニューバリエーションを作成
   * @param {string} baseName - 基本メニュー名
   * @param {number} baseTime - 基本施術時間（分）
   * @param {number} shortDuration - 短縮時間（デフォルト10分）
   * @returns {Array} 作成されたメニューバリエーション
   */
  createMenuVariations(baseName, baseTime, shortDuration = 10) {
    return Utils.executeWithErrorHandling(() => {
      const variations = [];
      const timestamp = new Date().toISOString();
      
      // 1. 初回メニュー
      variations.push({
        'メニュー名': `${baseName}（初回）`,
        '施術時間': baseTime,
        'バリエーションタイプ': '初回',
        '作成日時': timestamp
      });
      
      // 2. 2回目メニュー
      variations.push({
        'メニュー名': `${baseName}（２回目）`,
        '施術時間': baseTime,
        'バリエーションタイプ': '2回目',
        '作成日時': timestamp
      });
      
      // 3. 1分短縮メニュー
      variations.push({
        'メニュー名': `${baseName}（１分短縮）`,
        '施術時間': 1,
        'バリエーションタイプ': '1分短縮',
        '作成日時': timestamp
      });
      
      // 4. 動的短縮メニュー（デフォルト10分）
      const adjustedTime = Math.max(baseTime - shortDuration, 1); // 最低1分
      variations.push({
        'メニュー名': `${baseName}（${shortDuration}分短縮）`,
        '施術時間': adjustedTime,
        'バリエーションタイプ': `${shortDuration}分短縮`,
        '作成日時': timestamp
      });
      
      return variations;
    });
  }

  /**
   * Medical Force用のCSVを生成
   * @param {Array} menuData - メニューデータ配列
   * @returns {string} CSVコンテンツ
   */
  generateMedicalForceCsv(menuData) {
    return Utils.executeWithErrorHandling(() => {
      // Medical Forceのメニューインポート用CSVヘッダー
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
        'デポジットを受け取る'
      ];
      
      // CSV文字列を構築
      let csv = headers.join(',') + '\n';
      
      menuData.forEach((menu, index) => {
        const row = [
          index + 1,                          // No
          this.escapeCsvValue(menu['メニュー名'] || ''),  // メニュー名※必須
          this.escapeCsvValue(menu['説明文'] || ''),      // 説明文
          menu['金額'] || '',                // 金額
          menu['メニューの実施優先度'] || '',  // メニューの実施優先度
          '',                                 // 受付開始日時
          '',                                 // 受付終了日時
          '',                                 // 受付開始時間
          '',                                 // 受付終了時間
          menu['施術時間'] || '',            // 時間目安
          '',                                 // 対応可能な開始時間
          this.escapeCsvValue(menu['施術名'] || ''),      // メニューに含める施術
          ''                                  // デポジットを受け取る
        ];
        
        csv += row.join(',') + '\n';
      });
      
      return csv;
    });
  }

  /**
   * 施術マスタからメニューバリエーションを一括生成
   * @param {Object} options - 生成オプション
   * @returns {Object} 生成結果
   */
  generateMenusFromTreatments(options = {}) {
    return Utils.executeWithErrorHandling(() => {
      const treatments = this.getAllTreatments();
      const allMenus = [];
      
      treatments.forEach(treatment => {
        const baseName = treatment['名称 ※必須'];
        const baseTime = parseInt(treatment['施術時間(分) ※必須']) || 60;
        const shortDuration = options.shortDuration || 10;
        
        // 各施術に対して4つのバリエーションを生成
        const variations = this.createMenuVariations(baseName, baseTime, shortDuration);
        
        // 追加情報を各バリエーションに設定
        variations.forEach(variation => {
          variation['カテゴリ'] = treatment['カテゴリ'] || '未分類';
          variation['金額'] = treatment['料金(税込) ※必須'] || 0;
          variation['説明文'] = treatment['詳細'] || '';
          variation['施術名'] = baseName;
          variation['メニューの実施優先度'] = treatment['名称優先順位'] || '';
          variation['施術ID'] = treatment['operation ID'] || '';
        });
        
        allMenus.push(...variations);
      });
      
      // スプレッドシートに保存（オプション）
      if (options.saveToSheet) {
        const menuSheetName = Config.getSheetNames().generatedMenus || '生成メニュー';
        this.spreadsheetManager.writeDataToSheet(menuSheetName, allMenus, true);
      }
      
      return {
        success: true,
        count: allMenus.length,
        menus: allMenus,
        message: `${treatments.length}件の施術から${allMenus.length}件のメニューを生成しました`
      };
    });
  }

  /**
   * 施術データをCSVにエクスポート
   * @returns {string} CSVコンテンツ
   */
  exportToCsv() {
    return Utils.executeWithErrorHandling(() => {
      const treatments = this.getAllTreatments();
      if (treatments.length === 0) {
        throw new Error('エクスポートする施術データがありません');
      }

      // ヘッダーを取得
      const headers = Object.keys(treatments[0]);
      
      // CSV文字列を構築
      let csv = headers.map(h => this.escapeCsvValue(h)).join(',') + '\n';
      
      treatments.forEach(treatment => {
        const row = headers.map(header => {
          const value = treatment[header] || '';
          return this.escapeCsvValue(value.toString());
        });
        csv += row.join(',') + '\n';
      });

      return csv;
    });
  }

  /**
   * 施術からメニューを作成
   * @param {string} treatmentId - 施術ID
   * @param {Object} menuData - 追加のメニューデータ
   * @returns {Object} 作成されたメニュー
   */
  createMenuFromTreatment(treatmentId, menuData = {}) {
    return Utils.executeWithErrorHandling(() => {
      const treatments = this.getAllTreatments();
      const treatment = treatments.find(t => t['operation ID'] === treatmentId);
      
      if (!treatment) {
        throw new Error('指定された施術が見つかりません');
      }

      // メニューデータを構築
      const menu = {
        'メニュー名': treatment['名称 ※必須'],
        '説明文': treatment['詳細'] || '',
        '金額': treatment['料金(税込) ※必須'],
        '時間目安': treatment['施術時間(分) ※必須'],
        'カテゴリ': treatment['カテゴリ'] || '未分類',
        '施術ID': treatment['operation ID'],
        '有効フラグ': true,
        'オンライン予約可': true,
        '作成日時': new Date().toISOString(),
        ...menuData
      };

      // メニューをスプレッドシートに追加
      const menuService = new MenuService();
      const menus = menuService.getAllMenus() || [];
      menus.push(menu);
      
      this.spreadsheetManager.writeDataToSheet(Config.SHEET_NAMES.MENUS, menus, true);
      
      return menu;
    });
  }

  /**
   * 施術の短縮バージョンを作成
   * @param {string} treatmentId - 元の施術ID
   * @param {number} timeReduction - 短縮する時間（分）
   * @returns {Object} 作成された施術
   */
  createShortenedTreatment(treatmentId, timeReduction = 10) {
    return Utils.executeWithErrorHandling(() => {
      const treatments = this.getAllTreatments();
      const originalTreatment = treatments.find(t => t['operation ID'] === treatmentId);
      
      if (!originalTreatment) {
        throw new Error('指定された施術が見つかりません');
      }

      // 短縮バージョンの施術を作成
      const shortenedTreatment = {
        ...originalTreatment,
        '名称 ※必須': `${originalTreatment['名称 ※必須']} (${timeReduction}分短縮)`,
        '施術時間(分) ※必須': Math.max(originalTreatment['施術時間(分) ※必須'] - timeReduction, 1),
        'operation ID': `${originalTreatment['operation ID']}_short_${timeReduction}`,
        '元施術ID': originalTreatment['operation ID'],
        '作成日時': new Date().toISOString()
      };

      // 施術をスプレッドシートに追加
      treatments.push(shortenedTreatment);
      this.spreadsheetManager.writeDataToSheet(this.sheetName, treatments, true);
      
      return shortenedTreatment;
    });
  }

  /**
   * カテゴリを更新
   * @param {Array} treatments - 施術データ配列
   */
  updateCategories(treatments) {
    const categoryService = new CategoryService();
    const categories = new Set();
    
    treatments.forEach(treatment => {
      if (treatment['カテゴリ']) {
        categories.add(treatment['カテゴリ']);
      }
    });
    
    categories.forEach(category => {
      categoryService.addCategory(category, 'treatment');
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
   * CSV値をエスケープ
   * @param {string} value - エスケープする値
   * @returns {string} エスケープされた値
   */
  escapeCsvValue(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * 施術を検索
   * @param {string} keyword - 検索キーワード
   * @returns {Array} 検索結果
   */
  searchTreatments(keyword) {
    return Utils.executeWithErrorHandling(() => {
      const treatments = this.getAllTreatments();
      const lowerKeyword = keyword.toLowerCase();
      
      return treatments.filter(treatment => {
        return (
          treatment['名称 ※必須'].toLowerCase().includes(lowerKeyword) ||
          (treatment['カテゴリ'] && treatment['カテゴリ'].toLowerCase().includes(lowerKeyword)) ||
          (treatment['詳細'] && treatment['詳細'].toLowerCase().includes(lowerKeyword))
        );
      });
    });
  }
  
  /**
   * 施術用のCSVを生成
   * @param {Array} treatmentData - 施術データ配列
   * @returns {string} CSVコンテンツ
   */
  generateTreatmentsCsv(treatmentData) {
    return Utils.executeWithErrorHandling(() => {
      // Medical Forceの施術インポート用CSVヘッダー
      const headers = [
        'No',
        '名称 ※必須',
        'コード',
        '詳細',
        '所要時間 (分)',
        'ログイン情報数',
        'ログイン情報のメールアドレス',
        'カテゴリ',
        '受付での表示',
        '予約画面での表示'
      ];
      
      // CSV文字列を構築
      let csv = headers.join(',') + '\n';
      
      treatmentData.forEach((treatment, index) => {
        const row = [
          index + 1,                              // No
          this.escapeCsvValue(treatment['施術名'] || ''),    // 名称 ※必須
          '',                                     // コード
          this.escapeCsvValue(treatment['説明文'] || ''),    // 詳細
          treatment['施術時間'] || '60',          // 所要時間 (分)
          '',                                     // ログイン情報数
          '',                                     // ログイン情報のメールアドレス
          this.escapeCsvValue(treatment['カテゴリ'] || ''), // カテゴリ
          '表示',                                 // 受付での表示
          '表示'                                  // 予約画面での表示
        ];
        
        csv += row.join(',') + '\n';
      });
      
      return csv;
    });
  }
}