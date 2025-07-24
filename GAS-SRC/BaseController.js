/**
 * コントローラー基底クラス
 * 全てのコントローラーが継承する共通処理を提供
 */
class BaseController {
  /**
   * 成功レスポンスを生成
   * @param {Object} data - レスポンスデータ
   * @param {number} statusCode - HTTPステータスコード (デフォルト: 200)
   * @returns {TextOutput} JSON形式のレスポンス
   */
  static success(data, statusCode = 200) {
    const response = {
      status: 'success',
      data: data,
      timestamp: new Date().toISOString()
    };
    
    Logger.log(`Success response: ${JSON.stringify(response)}`);
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  /**
   * エラーレスポンスを生成
   * @param {string} message - エラーメッセージ
   * @param {number} code - HTTPステータスコード (デフォルト: 400)
   * @param {Object} details - エラー詳細情報
   * @returns {TextOutput} JSON形式のエラーレスポンス
   */
  static error(message, code = 400, details = null) {
    const response = {
      status: 'error',
      error: {
        code: this.getErrorCode(code),
        message: message,
        details: details
      },
      timestamp: new Date().toISOString()
    };
    
    Logger.log(`Error response: ${JSON.stringify(response)}`);
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  /**
   * HTTPステータスコードからエラーコードを生成
   * @param {number} statusCode - HTTPステータスコード
   * @returns {string} エラーコード
   */
  static getErrorCode(statusCode) {
    const errorCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE'
    };
    
    return errorCodes[statusCode] || 'UNKNOWN_ERROR';
  }
  
  /**
   * バリデーションエラーレスポンスを生成
   * @param {Object} errors - フィールド別のエラーメッセージ
   * @returns {TextOutput} バリデーションエラーレスポンス
   */
  static validationError(errors) {
    return this.error('Validation failed', 422, {
      validation_errors: errors
    });
  }
  
  /**
   * ページング付き成功レスポンスを生成
   * @param {Array} items - データ配列
   * @param {Object} pagination - ページング情報
   * @returns {TextOutput} ページング付きレスポンス
   */
  static successWithPagination(items, pagination) {
    return this.success({
      items: items,
      pagination: {
        page: pagination.page || 1,
        per_page: pagination.perPage || 20,
        total: pagination.total || items.length,
        total_pages: Math.ceil((pagination.total || items.length) / (pagination.perPage || 20))
      }
    });
  }
  
  /**
   * リクエストパラメータを取得
   * @param {Object} e - イベントオブジェクト
   * @param {string} key - パラメータキー
   * @param {*} defaultValue - デフォルト値
   * @returns {*} パラメータ値
   */
  static getParam(e, key, defaultValue = null) {
    // パスパラメータ
    if (e.pathParams && e.pathParams[key] !== undefined) {
      return e.pathParams[key];
    }
    
    // クエリパラメータ
    if (e.parameter && e.parameter[key] !== undefined) {
      return e.parameter[key];
    }
    
    // ボディパラメータ
    if (e.body && e.body[key] !== undefined) {
      return e.body[key];
    }
    
    return defaultValue;
  }
  
  /**
   * 必須パラメータを取得
   * @param {Object} e - イベントオブジェクト
   * @param {string} key - パラメータキー
   * @returns {*} パラメータ値
   * @throws {Error} パラメータが存在しない場合
   */
  static getRequiredParam(e, key) {
    const value = this.getParam(e, key);
    
    if (value === null || value === undefined || value === '') {
      throw new Error(`Required parameter '${key}' is missing`);
    }
    
    return value;
  }
  
  /**
   * 複数のパラメータを一括取得
   * @param {Object} e - イベントオブジェクト
   * @param {Array} keys - パラメータキーの配列
   * @returns {Object} パラメータのオブジェクト
   */
  static getParams(e, keys) {
    const params = {};
    
    keys.forEach(key => {
      params[key] = this.getParam(e, key);
    });
    
    return params;
  }
  
  /**
   * バリデーション実行
   * @param {Object} data - 検証するデータ
   * @param {Object} rules - バリデーションルール
   * @returns {Object} バリデーション結果
   */
  static validate(data, rules) {
    const errors = {};
    
    Object.keys(rules).forEach(field => {
      const fieldRules = rules[field];
      const value = data[field];
      
      // 必須チェック
      if (fieldRules.required && !value) {
        errors[field] = `${field} is required`;
        return;
      }
      
      // 型チェック
      if (fieldRules.type && value) {
        if (fieldRules.type === 'email' && !this.isValidEmail(value)) {
          errors[field] = `${field} must be a valid email`;
        }
        if (fieldRules.type === 'number' && isNaN(value)) {
          errors[field] = `${field} must be a number`;
        }
      }
      
      // 長さチェック
      if (fieldRules.minLength && value && value.length < fieldRules.minLength) {
        errors[field] = `${field} must be at least ${fieldRules.minLength} characters`;
      }
      if (fieldRules.maxLength && value && value.length > fieldRules.maxLength) {
        errors[field] = `${field} must be at most ${fieldRules.maxLength} characters`;
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors: errors
    };
  }
  
  /**
   * メールアドレスの検証
   * @param {string} email - メールアドレス
   * @returns {boolean} 有効なメールアドレスかどうか
   */
  static isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
  
  /**
   * 日付フォーマットの検証
   * @param {string} date - 日付文字列
   * @param {string} format - 期待するフォーマット (例: 'YYYY-MM-DD')
   * @returns {boolean} 有効な日付かどうか
   */
  static isValidDate(date, format = 'YYYY-MM-DD') {
    if (format === 'YYYY-MM-DD') {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(date)) return false;
      
      const d = new Date(date);
      return d instanceof Date && !isNaN(d);
    }
    
    return false;
  }
}