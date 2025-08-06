/**
 * ユーティリティ関数
 */
class Utils {
  /**
   * 日付を指定フォーマットに変換
   */
  static formatDate(date, format = null) {
    if (!date) return '';
    
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    if (!format) {
      format = Config.getDateFormat();
    }
    
    return Utilities.formatDate(date, Config.getTimeZone(), format);
  }
  
  /**
   * 日時を指定フォーマットに変換
   */
  static formatDateTime(date, format = null) {
    if (!date) return '';
    
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    if (!format) {
      format = Config.getDateTimeFormat();
    }
    
    return Utilities.formatDate(date, Config.getTimeZone(), format);
  }

  /**
   * 日付をISO 8601形式（タイムゾーン付き）に変換
   * @param {Date|string} date - 変換する日付
   * @param {string} time - 時刻（オプショナル、HH:mm形式）
   * @returns {string} ISO 8601形式の日付時刻文字列
   */
  static formatToISO8601(date, time = '00:00') {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      
      // 日付が無効な場合はエラーを投げる
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date');
      }
      
      // 時刻が指定されている場合は設定
      if (time && time !== '00:00') {
        const [hours, minutes] = time.split(':');
        dateObj.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
      } else {
        dateObj.setHours(0, 0, 0, 0);
      }
      
      // 日本時間（JST）のタイムゾーンオフセットを取得
      const offset = dateObj.getTimezoneOffset();
      const jstOffset = -540; // JST = UTC+9 = -540分
      
      // JSTに調整
      const jstDate = new Date(dateObj.getTime() + (offset - jstOffset) * 60000);
      
      // ISO 8601形式で出力（タイムゾーン +09:00 を付加）
      const isoString = jstDate.toISOString().replace('Z', '+09:00');
      
      return isoString;
    } catch (error) {
      Logger.log(`ISO 8601変換エラー: ${error.toString()}, 入力値: ${date}, ${time}`);
      return '';
    }
  }

  /**
   * 過去N か月の開始日をISO 8601形式で取得
   * @param {number} months - 過去の月数
   * @returns {string} ISO 8601形式の日付文字列
   */
  static getPastMonthsStartISO(months = 6) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    date.setDate(1);
    return this.formatToISO8601(date);
  }

  /**
   * 未来N か月の終了日をISO 8601形式で取得
   * @param {number} months - 未来の月数
   * @returns {string} ISO 8601形式の日付文字列
   */
  static getFutureMonthsEndISO(months = 3) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    date.setDate(0); // 前月の最終日
    date.setHours(23, 59, 59, 999);
    return this.formatToISO8601(date);
  }
  
  /**
   * 今日の日付を取得
   */
  static getToday() {
    return this.formatDate(new Date());
  }
  
  /**
   * 現在の日時を取得
   */
  static getNow() {
    return this.formatDateTime(new Date());
  }
  
  /**
   * 日付に日数を加算
   */
  static addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }
  
  /**
   * 日付から日数を減算
   */
  static subtractDays(dateString, days) {
    return this.addDays(dateString, -days);
  }
  
  /**
   * 日付に月数を加算
   */
  static addMonths(dateString, months) {
    const date = new Date(dateString);
    date.setMonth(date.getMonth() + months);
    return this.formatDate(date);
  }
  
  /**
   * 日付から月数を減算
   */
  static subtractMonths(dateString, months) {
    return this.addMonths(dateString, -months);
  }
  
  /**
   * 指定したシートを取得（なければ作成）
   */
  static getOrCreateSheet(sheetName) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      Logger.log(`新しいシートを作成しました: ${sheetName}`);
    }
    
    return sheet;
  }
  
  /**
   * シートをクリア
   */
  static clearSheet(sheet, keepHeaders = true) {
    if (keepHeaders && sheet.getLastRow() > 1) {
      // ヘッダー行を残してクリア
      const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      range.clear();
    } else if (!keepHeaders) {
      // 全てクリア
      sheet.clear();
    }
  }
  
  /**
   * ヘッダー行を設定
   */
  static setHeaders(sheet, headers) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
    headerRange.setBorder(true, true, true, true, true, true);
    
    // 列幅の自動調整
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  /**
   * データを一括でシートに書き込み
   */
  static writeDataToSheet(sheet, data, startRow = 2) {
    if (!data || data.length === 0) {
      Logger.log('書き込むデータがありません');
      return;
    }
    
    const numRows = data.length;
    const numCols = data[0].length;
    const range = sheet.getRange(startRow, 1, numRows, numCols);
    range.setValues(data);
  }
  
  /**
   * ログをシートに記録
   */
  static logToSheet(message, status = 'INFO', details = '') {
    try {
      const logSheet = this.getOrCreateSheet(Config.getSheetNames().logs);
      
      // ヘッダーがなければ設定
      if (logSheet.getLastRow() === 0) {
        this.setHeaders(logSheet, ['実行日時', 'ステータス', 'メッセージ', '詳細']);
      }
      
      // ログを追加
      const logData = [
        this.getNow(),
        status,
        message,
        details
      ];
      
      logSheet.appendRow(logData);
      
      // 古いログを削除（1000行を超えたら古いものから削除）
      if (logSheet.getLastRow() > 1000) {
        logSheet.deleteRows(2, 100);
      }
      
    } catch (error) {
      Logger.log(`ログ記録エラー: ${error.toString()}`);
    }
  }
  
  /**
   * 今月の開始日を取得（YYYY-MM-DD形式）
   */
  static getMonthStart(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setDate(1);
    return this.formatDate(targetDate);
  }
  
  /**
   * 今月の終了日を取得（YYYY-MM-DD形式）
   */
  static getMonthEnd(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setMonth(targetDate.getMonth() + 1);
    targetDate.setDate(0);
    return this.formatDate(targetDate);
  }
  
  /**
   * 先月の開始日を取得（YYYY-MM-DD形式）
   */
  static getLastMonthStart() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    date.setDate(1);
    return this.formatDate(date);
  }
  
  /**
   * 先月の終了日を取得（YYYY-MM-DD形式）
   */
  static getLastMonthEnd() {
    const date = new Date();
    date.setDate(0); // 今月の0日 = 先月の最終日
    return this.formatDate(date);
  }
  
  /**
   * エラーハンドリング付きで関数を実行
   */
  static executeWithErrorHandling(func, funcName = 'Unknown') {
    try {
      Utils.logToSheet(`${funcName} を開始しました`, 'INFO');
      const result = func();
      Utils.logToSheet(`${funcName} が正常に完了しました`, 'SUCCESS');
      return result;
    } catch (error) {
      const errorMessage = error.toString();
      Utils.logToSheet(`${funcName} でエラーが発生しました`, 'ERROR', errorMessage);
      throw error;
    }
  }
  
  /**
   * エラーハンドリング付きで非同期関数を実行
   */
  static async executeWithErrorHandlingAsync(func, funcName = 'Unknown') {
    try {
      Utils.logToSheet(`${funcName} を開始しました`, 'INFO');
      const result = await func();
      Utils.logToSheet(`${funcName} が正常に完了しました`, 'SUCCESS');
      return result;
    } catch (error) {
      const errorMessage = error.toString();
      Utils.logToSheet(`${funcName} でエラーが発生しました`, 'ERROR', errorMessage);
      throw error;
    }
  }
  
  /**
   * 配列をオブジェクトの配列に変換
   */
  static arrayToObjects(headers, dataArray) {
    return dataArray.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }
  
  /**
   * オブジェクトの配列を2次元配列に変換
   */
  static objectsToArray(objects, headers) {
    return objects.map(obj => {
      return headers.map(header => obj[header] || '');
    });
  }
  
  /**
   * 安全にJSONをパース
   */
  static safeJsonParse(text, defaultValue = null) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return defaultValue;
    }
  }
  
  /**
   * 空白や改行を除去
   */
  static trimAll(text) {
    if (!text) return '';
    return text.toString().replace(/[\r\n\s]+/g, ' ').trim();
  }
}