/**
 * LINE通知設定管理サービス
 * 
 * 機能:
 * - LINE通知設定の管理
 * - 通知タイミングと条件の管理  
 * - 通知対象者の設定管理
 * - 通知有効/無効の制御
 */
class LineNotificationConfigService {
  constructor() {
    this.sheetNames = Config.getSheetNames();
    this.configSheet = null;
    this.templateService = null;
  }

  /**
   * 初期化処理
   */
  init() {
    this.configSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(this.sheetNames.lineNotificationConfig);
    
    if (!this.configSheet) {
      // シートが存在しない場合は作成
      SpreadsheetManager.initializeLineNotificationConfigSheet();
      this.configSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(this.sheetNames.lineNotificationConfig);
    }
    
    this.templateService = new LineNotificationTemplateService();
    this.templateService.init();
  }

  /**
   * 通知設定を取得
   * @param {string} notificationType - 通知タイプ
   * @return {Object} 通知設定
   */
  getNotificationConfig(notificationType) {
    return Utils.executeWithErrorHandling(() => {
      if (!this.configSheet) this.init();
      
      const data = this.configSheet.getDataRange().getValues();
      const headers = data[0];
      
      // 通知タイプ列のインデックスを取得
      const typeIndex = headers.indexOf('通知タイプ');
      const enabledIndex = headers.indexOf('有効/無効');
      const timingIndex = headers.indexOf('送信タイミング');
      const targetIndex = headers.indexOf('対象者');
      const includeTicketIndex = headers.indexOf('チケット情報表示');
      const includeNotesIndex = headers.indexOf('注意事項表示');
      
      // 該当する設定を検索
      for (let i = 1; i < data.length; i++) {
        if (data[i][typeIndex] === notificationType) {
          return {
            type: notificationType,
            enabled: data[i][enabledIndex] === '有効',
            timing: data[i][timingIndex],
            target: data[i][targetIndex],
            includeTicket: data[i][includeTicketIndex] === 'はい',
            includeNotes: data[i][includeNotesIndex] === 'はい'
          };
        }
      }
      
      // デフォルト設定を返す
      return this.getDefaultConfig(notificationType);
    }, 'LINE通知設定取得');
  }

  /**
   * 全ての通知設定を取得
   * @return {Array} 通知設定リスト
   */
  getAllNotificationConfigs() {
    return Utils.executeWithErrorHandling(() => {
      if (!this.configSheet) this.init();
      
      const data = this.configSheet.getDataRange().getValues();
      if (data.length <= 1) return [];
      
      const headers = data[0];
      const configs = [];
      
      for (let i = 1; i < data.length; i++) {
        configs.push({
          type: data[i][headers.indexOf('通知タイプ')],
          enabled: data[i][headers.indexOf('有効/無効')] === '有効',
          timing: data[i][headers.indexOf('送信タイミング')],
          target: data[i][headers.indexOf('対象者')],
          includeTicket: data[i][headers.indexOf('チケット情報表示')] === 'はい',
          includeNotes: data[i][headers.indexOf('注意事項表示')] === 'はい'
        });
      }
      
      return configs;
    }, '全通知設定取得');
  }

  /**
   * 通知設定を保存
   * @param {Object} config - 通知設定
   * @return {boolean} 成功フラグ
   */
  saveNotificationConfig(config) {
    return Utils.executeWithErrorHandling(() => {
      if (!this.configSheet) this.init();
      
      const data = this.configSheet.getDataRange().getValues();
      const headers = data[0];
      
      // インデックスを取得
      const typeIndex = headers.indexOf('通知タイプ');
      const enabledIndex = headers.indexOf('有効/無効');
      const timingIndex = headers.indexOf('送信タイミング');
      const targetIndex = headers.indexOf('対象者');
      const includeTicketIndex = headers.indexOf('チケット情報表示');
      const includeNotesIndex = headers.indexOf('注意事項表示');
      const updatedAtIndex = headers.indexOf('更新日時');
      
      // 既存の設定を検索
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][typeIndex] === config.type) {
          rowIndex = i + 1; // スプレッドシートの行番号は1から始まる
          break;
        }
      }
      
      // データを準備
      const rowData = new Array(headers.length);
      rowData[typeIndex] = config.type;
      rowData[enabledIndex] = config.enabled ? '有効' : '無効';
      rowData[timingIndex] = config.timing || '';
      rowData[targetIndex] = config.target || '来院者';
      rowData[includeTicketIndex] = config.includeTicket ? 'はい' : 'いいえ';
      rowData[includeNotesIndex] = config.includeNotes ? 'はい' : 'いいえ';
      rowData[updatedAtIndex] = new Date();
      
      if (rowIndex > 0) {
        // 既存の行を更新
        const range = this.configSheet.getRange(rowIndex, 1, 1, headers.length);
        range.setValues([rowData]);
      } else {
        // 新規行を追加
        this.configSheet.appendRow(rowData);
      }
      
      Logger.log(`通知設定を保存: ${config.type}`);
      return true;
    }, 'LINE通知設定保存');
  }

  /**
   * 通知設定を一括保存
   * @param {Array} configs - 通知設定リスト
   * @return {boolean} 成功フラグ
   */
  saveAllNotificationConfigs(configs) {
    return Utils.executeWithErrorHandling(() => {
      configs.forEach(config => {
        this.saveNotificationConfig(config);
      });
      return true;
    }, 'LINE通知設定一括保存');
  }

  /**
   * デフォルト設定を取得
   * @param {string} notificationType - 通知タイプ
   * @return {Object} デフォルト設定
   */
  getDefaultConfig(notificationType) {
    const defaults = {
      '予約確定': {
        type: '予約確定',
        enabled: true,
        timing: '即時',
        target: '来院者',
        includeTicket: true,
        includeNotes: true
      },
      '予約前日': {
        type: '予約前日',
        enabled: true,
        timing: '11:00',
        target: '来院者',
        includeTicket: true,
        includeNotes: true
      },
      '予約当日': {
        type: '予約当日',
        enabled: true,
        timing: '09:00',
        target: '来院者',
        includeTicket: true,
        includeNotes: true
      },
      '施術後': {
        type: '施術後',
        enabled: true,
        timing: '1時間後',
        target: '来院者',
        includeTicket: true,
        includeNotes: false
      }
    };
    
    return defaults[notificationType] || {
      type: notificationType,
      enabled: false,
      timing: '',
      target: '来院者',
      includeTicket: false,
      includeNotes: false
    };
  }

  /**
   * 通知対象者を判定
   * @param {Object} config - 通知設定
   * @param {Object} reservation - 予約情報
   * @return {Array} 通知対象者のvisitorIdリスト
   */
  getNotificationTargets(config, reservation) {
    return Utils.executeWithErrorHandling(() => {
      const targets = [];
      
      // 来院者（施術を受ける人）
      if (config.target === '来院者' || config.target === '両方') {
        targets.push(reservation.visitor_id);
      }
      
      // 予約者（予約操作をした人）
      if (config.target === '予約者' || config.target === '両方') {
        if (reservation.booker_visitor_id && 
            reservation.booker_visitor_id !== reservation.visitor_id) {
          targets.push(reservation.booker_visitor_id);
        }
      }
      
      return targets;
    }, '通知対象者判定');
  }

  /**
   * 通知タイミングを判定
   * @param {Object} config - 通知設定
   * @param {Date} reservationDate - 予約日時
   * @return {Date} 通知送信日時
   */
  calculateNotificationTime(config, reservationDate) {
    return Utils.executeWithErrorHandling(() => {
      const notificationDate = new Date(reservationDate);
      
      switch (config.type) {
        case '予約確定':
          // 即時送信
          return new Date();
          
        case '予約前日':
          // 前日の指定時刻
          notificationDate.setDate(notificationDate.getDate() - 1);
          const [prevHour, prevMin] = (config.timing || '11:00').split(':');
          notificationDate.setHours(parseInt(prevHour), parseInt(prevMin), 0, 0);
          return notificationDate;
          
        case '予約当日':
          // 当日の指定時刻
          const [dayHour, dayMin] = (config.timing || '09:00').split(':');
          notificationDate.setHours(parseInt(dayHour), parseInt(dayMin), 0, 0);
          return notificationDate;
          
        case '施術後':
          // 施術終了後の指定時間後
          const hoursAfter = parseInt(config.timing) || 1;
          notificationDate.setHours(notificationDate.getHours() + hoursAfter);
          return notificationDate;
          
        default:
          return new Date();
      }
    }, '通知タイミング計算');
  }

  /**
   * 通知設定のバリデーション
   * @param {Object} config - 通知設定
   * @return {Object} バリデーション結果
   */
  validateConfig(config) {
    const errors = [];
    
    // 必須項目チェック
    if (!config.type) {
      errors.push('通知タイプが指定されていません');
    }
    
    // タイミングの形式チェック
    if (config.type === '予約前日' || config.type === '予約当日') {
      if (config.timing && !config.timing.match(/^\d{1,2}:\d{2}$/)) {
        errors.push('送信タイミングの形式が正しくありません（HH:MM形式で入力してください）');
      }
    }
    
    if (config.type === '施術後') {
      if (config.timing && !config.timing.match(/^\d+時間後$/)) {
        errors.push('送信タイミングの形式が正しくありません（X時間後形式で入力してください）');
      }
    }
    
    // 対象者チェック
    const validTargets = ['来院者', '予約者', '両方'];
    if (config.target && !validTargets.includes(config.target)) {
      errors.push('対象者の指定が正しくありません');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 通知履歴を記録
   * @param {Object} notification - 通知情報
   */
  logNotification(notification) {
    Utils.logToSheet(
      `LINE通知送信: ${notification.type} - ${notification.visitorId}`,
      notification.success ? 'SUCCESS' : 'ERROR',
      {
        notificationType: notification.type,
        visitorId: notification.visitorId,
        reservationId: notification.reservationId,
        sentAt: new Date(),
        error: notification.error
      }
    );
  }
}