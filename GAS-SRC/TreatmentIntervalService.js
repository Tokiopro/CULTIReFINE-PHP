/**
 * 施術間隔管理サービス
 */
class TreatmentIntervalService {
  constructor() {
    this.sheetName = Config.getSheetNames().treatmentInterval;
  }
  
  /**
   * 施術間隔データを取得（UI用）
   */
  getTreatmentIntervalData() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet || sheet.getLastRow() <= 1) {
        // メニューリストを取得して空のマトリクスを返す
        const menuService = new MenuService();
        const menus = menuService.getMenusFromSheet();
        const menuNames = menus.map(menu => menu.name);
        
        return {
          menuNames: menuNames,
          intervals: {},
          formattedIntervals: {},
          matrixStatus: {
            isValid: false,
            message: 'データがありません'
          }
        };
      }
      
      // マトリクスデータを取得
      const intervalMatrix = SpreadsheetManager.getTreatmentIntervalMatrix();
      
      // メニュー名リストを取得
      const headerRow = sheet.getRange(1, 2, 1, sheet.getLastColumn() - 1).getValues()[0];
      const menuNames = headerRow.filter(name => name);
      
      // Mapをオブジェクトに変換し、フォーマット済み表示も生成
      const intervals = {};
      const formattedIntervals = {};
      
      intervalMatrix.forEach((value, key) => {
        intervals[key] = value;
        formattedIntervals[key] = this.formatIntervalDisplay(value);
      });
      
      // マトリクスの整合性をチェック
      const validation = SpreadsheetManager.validateTreatmentIntervalMatrix();
      const matrixStatus = {
        isValid: validation.isValid,
        message: validation.isValid ? '正常' : 'エラーあり',
        errors: validation.errors,
        warnings: validation.warnings,
        summary: validation.summary
      };
      
      return {
        menuNames: menuNames,
        intervals: intervals,
        formattedIntervals: formattedIntervals,
        matrixStatus: matrixStatus
      };
    });
  }
  
  /**
   * 施術間隔を更新
   */
  updateTreatmentInterval(fromMenu, toMenu, interval) {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        throw new Error('施術間隔定義シートが見つかりません');
      }
      
      // ヘッダー行からメニュー名のインデックスを取得
      const headerRow = sheet.getRange(1, 2, 1, sheet.getLastColumn() - 1).getValues()[0];
      const sideColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(row => row[0]);
      
      const colIndex = headerRow.indexOf(toMenu);
      const rowIndex = sideColumn.indexOf(fromMenu);
      
      if (colIndex === -1 || rowIndex === -1) {
        throw new Error('指定されたメニューが見つかりません');
      }
      
      // 週単位表記を日数に変換
      const normalizedInterval = this.normalizeIntervalValue(interval);
      
      // 値を更新（nullまたは空文字の場合は空欄に）
      const cellValue = (normalizedInterval === null || normalizedInterval === '') ? '' : normalizedInterval;
      sheet.getRange(rowIndex + 2, colIndex + 2).setValue(cellValue);
      
      Logger.log(`施術間隔を更新: ${fromMenu} → ${toMenu} = ${cellValue}`);
      
      return true;
    });
  }
  
  /**
   * メニューと同期
   */
  syncTreatmentIntervalWithMenus() {
    return Utils.executeWithErrorHandling(() => {
      SpreadsheetManager.updateTreatmentIntervalMatrix();
      return true;
    });
  }
  
  /**
   * 施術間隔チェック（予約時の検証用）
   */
  checkInterval(visitorId, menuName) {
    const validationService = new ReservationValidationService();
    return validationService.validateTreatmentInterval(visitorId, null, menuName);
  }
  
  /**
   * 一括インポート
   */
  importTreatmentIntervals(data) {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        throw new Error('施術間隔定義シートが見つかりません');
      }
      
      // データ形式の検証
      if (!Array.isArray(data)) {
        throw new Error('データ形式が不正です');
      }
      
      // 現在のマトリクスを取得
      const headerRow = sheet.getRange(1, 2, 1, sheet.getLastColumn() - 1).getValues()[0];
      const sideColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(row => row[0]);
      
      let updateCount = 0;
      
      // データを適用
      data.forEach(item => {
        if (!item.fromMenu || !item.toMenu) return;
        
        const colIndex = headerRow.indexOf(item.toMenu);
        const rowIndex = sideColumn.indexOf(item.fromMenu);
        
        if (colIndex !== -1 && rowIndex !== -1) {
          const value = item.interval === null ? '' : item.interval;
          sheet.getRange(rowIndex + 2, colIndex + 2).setValue(value);
          updateCount++;
        }
      });
      
      Logger.log(`${updateCount}件の施術間隔データをインポートしました`);
      
      return {
        success: true,
        updateCount: updateCount
      };
    });
  }
  
  /**
   * バックアップを作成
   */
  createBackup() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        throw new Error('施術間隔定義シートが見つかりません');
      }
      
      const backupSheetName = `${this.sheetName}_バックアップ_${Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss')}`;
      const backupSheet = sheet.copyTo(SpreadsheetApp.getActiveSpreadsheet());
      backupSheet.setName(backupSheetName);
      
      Logger.log(`バックアップシートを作成: ${backupSheetName}`);
      
      return backupSheetName;
    });
  }
  
  /**
   * 週単位表記を日数に変換（例: "4w" → 28）
   * @param {string|number} value - 入力値
   * @return {number|null} 変換後の日数
   */
  normalizeIntervalValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    // 既に数値の場合はそのまま返す
    if (typeof value === 'number') {
      return value;
    }
    
    // 文字列の場合
    const strValue = String(value).trim().toLowerCase();
    
    // 週単位の表記をチェック（例: "4w", "2週", "3week"）
    const weekPatterns = [
      /^(\d+)w$/,           // 4w
      /^(\d+)週$/,          // 4週
      /^(\d+)week[s]?$/,    // 4week, 4weeks
      /^(\d+)\s*w$/,        // 4 w
      /^(\d+)\s*週$/,       // 4 週
    ];
    
    for (const pattern of weekPatterns) {
      const match = strValue.match(pattern);
      if (match) {
        const weeks = parseInt(match[1]);
        return weeks * 7; // 週を日数に変換
      }
    }
    
    // 月単位の表記をチェック（例: "1m", "2month"）
    const monthPatterns = [
      /^(\d+)m$/,            // 1m
      /^(\d+)月$/,           // 1月
      /^(\d+)month[s]?$/,    // 1month, 2months
      /^(\d+)\s*m$/,         // 1 m
      /^(\d+)\s*月$/,        // 1 月
    ];
    
    for (const pattern of monthPatterns) {
      const match = strValue.match(pattern);
      if (match) {
        const months = parseInt(match[1]);
        return months * 30; // 月を日数に変換（概算）
      }
    }
    
    // それ以外は数値として解析を試みる
    const numValue = parseInt(strValue);
    if (!isNaN(numValue)) {
      return numValue;
    }
    
    // 変換できない場合はnullを返す
    return null;
  }
  
  /**
   * 日数を適切な表示形式に変換（例: 28 → "4週間"）
   * @param {number} days - 日数
   * @return {string} フォーマット済みの期間表示
   */
  formatIntervalDisplay(days) {
    if (!days || days === 0) {
      return '制限なし';
    }
    
    // 週単位で割り切れる場合
    if (days % 7 === 0) {
      const weeks = days / 7;
      if (weeks === 1) {
        return '1週間';
      } else {
        return `${weeks}週間`;
      }
    }
    
    // 月単位（30日）で割り切れる場合
    if (days % 30 === 0) {
      const months = days / 30;
      if (months === 1) {
        return '1ヶ月';
      } else {
        return `${months}ヶ月`;
      }
    }
    
    // それ以外は日数で表示
    return `${days}日`;
  }
  
  /**
   * マトリクス全体の値を正規化
   * @return {object} 正規化結果
   */
  normalizeAllIntervals() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        throw new Error('施術間隔定義シートが見つかりません');
      }
      
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      if (lastRow <= 1 || lastCol <= 1) {
        return { updated: 0, errors: [] };
      }
      
      let updatedCount = 0;
      const errors = [];
      
      // データ範囲を取得
      const dataRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1);
      const values = dataRange.getValues();
      
      // 各セルを正規化
      const normalizedValues = values.map((row, rowIndex) => {
        return row.map((cell, colIndex) => {
          if (cell === '' || cell === null) {
            return cell; // 空欄はそのまま
          }
          
          const normalized = this.normalizeIntervalValue(cell);
          if (normalized !== null && normalized !== cell) {
            updatedCount++;
            Logger.log(`正規化: [${rowIndex + 2}, ${colIndex + 2}] ${cell} → ${normalized}`);
            return normalized;
          } else if (normalized === null && cell !== '') {
            errors.push({
              row: rowIndex + 2,
              col: colIndex + 2,
              value: cell,
              message: '値を変換できません'
            });
          }
          
          return cell;
        });
      });
      
      // 更新されたデータをシートに書き戻す
      if (updatedCount > 0) {
        dataRange.setValues(normalizedValues);
      }
      
      Logger.log(`施術間隔の正規化完了: ${updatedCount}件更新`);
      if (errors.length > 0) {
        Logger.log(`エラー: ${errors.length}件`);
        errors.forEach(error => {
          Logger.log(`  - セル[${error.row}, ${error.col}]: ${error.value} - ${error.message}`);
        });
      }
      
      return {
        updated: updatedCount,
        errors: errors
      };
    });
  }
  
  /**
   * 施術間隔ルールを取得（キー: "メニューA→メニューB", 値: 日数）
   * @return {object} 施術間隔ルール
   */
  getIntervalRules() {
    const intervalMatrix = SpreadsheetManager.getTreatmentIntervalMatrix();
    const rules = {};
    
    intervalMatrix.forEach((value, key) => {
      rules[key] = value;
    });
    
    return rules;
  }
  
  /**
   * 施術間隔データの自動整形
   * @return {object} 整形結果
   */
  autoFormatTreatmentIntervals() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('施術間隔データの自動整形を開始');
      
      // 1. バックアップを作成
      const backupSheetName = this.createBackup();
      
      // 2. 値の正規化
      const normalizeResult = this.normalizeAllIntervals();
      
      // 3. マトリクス構造の修復
      const repairResult = SpreadsheetManager.repairMatrixStructure();
      
      // 4. 最終的な整合性チェック
      const validation = SpreadsheetManager.validateTreatmentIntervalMatrix();
      
      const result = {
        success: validation.isValid,
        backup: backupSheetName,
        normalization: normalizeResult,
        repair: repairResult,
        validation: validation,
        timestamp: new Date().toISOString()
      };
      
      Logger.log('施術間隔データの自動整形完了:', JSON.stringify(result, null, 2));
      
      return result;
    });
  }
  
  /**
   * インポート時の正規化機能付き一括インポート
   * @param {Array} data - インポートデータ
   * @return {object} インポート結果
   */
  importWithNormalization(data) {
    return Utils.executeWithErrorHandling(() => {
      if (!Array.isArray(data)) {
        throw new Error('データ形式が不正です');
      }
      
      // データを正規化
      const normalizedData = data.map(item => {
        if (!item.fromMenu || !item.toMenu) {
          return item;
        }
        
        const normalizedInterval = this.normalizeIntervalValue(item.interval);
        
        return {
          ...item,
          interval: normalizedInterval,
          originalInterval: item.interval
        };
      });
      
      // 正規化されたデータでインポート
      const importResult = this.importTreatmentIntervals(normalizedData);
      
      // 正規化統計を追加
      const normalizedCount = normalizedData.filter(item => 
        item.interval !== item.originalInterval
      ).length;
      
      return {
        ...importResult,
        normalizedCount: normalizedCount,
        totalProcessed: normalizedData.length
      };
    });
  }
  
  /**
   * 定期的な整合性チェック
   * @return {object} チェック結果
   */
  performMaintenanceCheck() {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('施術間隔定義の定期チェックを開始');
      
      const result = {
        timestamp: new Date().toISOString(),
        checks: {}
      };
      
      // 1. 整合性チェック
      result.checks.validation = SpreadsheetManager.validateTreatmentIntervalMatrix();
      
      // 2. メニュー同期チェック
      result.checks.menuSync = this.checkMenuSync();
      
      // 3. データ品質チェック
      result.checks.dataQuality = this.checkDataQuality();
      
      // 4. 問題があれば警告をログに記録
      if (!result.checks.validation.isValid) {
        Logger.log('⚠️ 施術間隔定義に問題があります');
        result.checks.validation.errors.forEach(error => {
          Logger.log(`  - ${error}`);
        });
      }
      
      if (result.checks.validation.warnings.length > 0) {
        Logger.log('⚠️ 施術間隔定義に警告があります');
        result.checks.validation.warnings.forEach(warning => {
          Logger.log(`  - ${warning}`);
        });
      }
      
      return result;
    });
  }
  
  /**
   * メニュー同期チェック
   * @return {object} チェック結果
   */
  checkMenuSync() {
    const menuService = new MenuService();
    const currentMenus = menuService.getMenusFromSheet().map(m => m.name);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        needsSync: true,
        reason: 'マトリクスが初期化されていません'
      };
    }
    
    const headerRow = sheet.getRange(1, 2, 1, sheet.getLastColumn() - 1).getValues()[0];
    const matrixMenus = headerRow.filter(name => name);
    
    const missingMenus = currentMenus.filter(menu => !matrixMenus.includes(menu));
    const extraMenus = matrixMenus.filter(menu => !currentMenus.includes(menu));
    
    return {
      needsSync: missingMenus.length > 0 || extraMenus.length > 0,
      missingMenus: missingMenus,
      extraMenus: extraMenus,
      currentMenuCount: currentMenus.length,
      matrixMenuCount: matrixMenus.length
    };
  }
  
  /**
   * データ品質チェック
   * @return {object} チェック結果
   */
  checkDataQuality() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        totalCells: 0,
        filledCells: 0,
        emptyRate: 0,
        averageInterval: 0,
        maxInterval: 0,
        unusualValues: []
      };
    }
    
    const dataRange = sheet.getRange(2, 2, sheet.getLastRow() - 1, sheet.getLastColumn() - 1);
    const values = dataRange.getValues();
    
    let totalCells = 0;
    let filledCells = 0;
    let totalInterval = 0;
    let maxInterval = 0;
    const unusualValues = [];
    
    values.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        totalCells++;
        
        if (cell !== '' && cell !== null) {
          filledCells++;
          const numValue = Number(cell);
          
          if (!isNaN(numValue)) {
            totalInterval += numValue;
            maxInterval = Math.max(maxInterval, numValue);
            
            // 異常値チェック（365日以上）
            if (numValue > 365) {
              unusualValues.push({
                row: rowIndex + 2,
                col: colIndex + 2,
                value: numValue,
                reason: '365日を超える間隔'
              });
            }
          }
        }
      });
    });
    
    return {
      totalCells: totalCells,
      filledCells: filledCells,
      emptyRate: Math.round((1 - filledCells / totalCells) * 100),
      averageInterval: filledCells > 0 ? Math.round(totalInterval / filledCells) : 0,
      maxInterval: maxInterval,
      unusualValues: unusualValues
    };
  }
}