/**
 * LINE通知テンプレート管理サービス
 * 
 * 機能:
 * - FlexMessage通知テンプレートの管理
 * - 動的データの挿入と変数置換
 * - チケット情報の計算と表示
 * - 施術内容・注意点の管理
 * - PHP連携用メッセージ生成
 */
class LineNotificationTemplateService {
  constructor() {
    this.sheetNames = Config.getSheetNames();
    this.templateSheet = null;
    this.visitorService = new VisitorService();
    this.reservationService = new ReservationService();
    this.ticketManagementService = new TicketManagementService();
    this.menuService = new MenuService();
    this.flexMessageTemplates = new FlexMessageTemplates();
  }

  /**
   * 初期化処理
   */
  init() {
    this.templateSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(this.sheetNames.lineNotificationTemplates);
    
    if (!this.templateSheet) {
      // シートが存在しない場合は作成
      SpreadsheetManager.initializeLineNotificationTemplatesSheet();
      this.templateSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(this.sheetNames.lineNotificationTemplates);
    }
  }

  /**
   * テンプレートを取得
   * @param {string} notificationType - 通知タイプ
   * @return {Object} テンプレート情報
   */
  getTemplate(notificationType) {
    return Utils.executeWithErrorHandling(() => {
      if (!this.templateSheet) this.init();
      
      const data = this.templateSheet.getDataRange().getValues();
      const headers = data[0];
      
      // カラムインデックス
      const typeIndex = headers.indexOf('通知タイプ');
      const nameIndex = headers.indexOf('テンプレート名');
      const bodyIndex = headers.indexOf('メッセージ本文');
      const variablesIndex = headers.indexOf('使用変数');
      const enabledIndex = headers.indexOf('有効フラグ');
      
      // 該当するテンプレートを検索
      for (let i = 1; i < data.length; i++) {
        if (data[i][typeIndex] === notificationType && data[i][enabledIndex] === '有効') {
          return {
            type: notificationType,
            name: data[i][nameIndex],
            body: data[i][bodyIndex],
            variables: data[i][variablesIndex] ? data[i][variablesIndex].split(',') : []
          };
        }
      }
      
      // デフォルトテンプレートを返す
      return this.getDefaultTemplate(notificationType);
    }, 'LINE通知テンプレート取得');
  }

  /**
   * 全てのテンプレートを取得
   * @return {Array} テンプレートリスト
   */
  getAllTemplates() {
    return Utils.executeWithErrorHandling(() => {
      if (!this.templateSheet) this.init();
      
      const data = this.templateSheet.getDataRange().getValues();
      if (data.length <= 1) return [];
      
      const headers = data[0];
      const templates = [];
      
      for (let i = 1; i < data.length; i++) {
        templates.push({
          type: data[i][headers.indexOf('通知タイプ')],
          name: data[i][headers.indexOf('テンプレート名')],
          body: data[i][headers.indexOf('メッセージ本文')],
          variables: data[i][headers.indexOf('使用変数')] ? 
            data[i][headers.indexOf('使用変数')].split(',') : [],
          enabled: data[i][headers.indexOf('有効フラグ')] === '有効'
        });
      }
      
      return templates;
    }, '全テンプレート取得');
  }

  /**
   * テンプレートを保存
   * @param {Object} template - テンプレート情報
   * @return {boolean} 成功フラグ
   */
  saveTemplate(template) {
    return Utils.executeWithErrorHandling(() => {
      if (!this.templateSheet) this.init();
      
      const data = this.templateSheet.getDataRange().getValues();
      const headers = data[0];
      
      // インデックスを取得
      const typeIndex = headers.indexOf('通知タイプ');
      const nameIndex = headers.indexOf('テンプレート名');
      const bodyIndex = headers.indexOf('メッセージ本文');
      const variablesIndex = headers.indexOf('使用変数');
      const enabledIndex = headers.indexOf('有効フラグ');
      const updatedAtIndex = headers.indexOf('更新日時');
      
      // 既存のテンプレートを検索
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][typeIndex] === template.type) {
          rowIndex = i + 1;
          break;
        }
      }
      
      // データを準備
      const rowData = new Array(headers.length);
      rowData[typeIndex] = template.type;
      rowData[nameIndex] = template.name || `${template.type}テンプレート`;
      rowData[bodyIndex] = template.body;
      rowData[variablesIndex] = Array.isArray(template.variables) ? 
        template.variables.join(',') : template.variables;
      rowData[enabledIndex] = template.enabled ? '有効' : '無効';
      rowData[updatedAtIndex] = new Date();
      
      if (rowIndex > 0) {
        // 既存の行を更新
        const range = this.templateSheet.getRange(rowIndex, 1, 1, headers.length);
        range.setValues([rowData]);
      } else {
        // 新規行を追加
        this.templateSheet.appendRow(rowData);
      }
      
      Logger.log(`テンプレートを保存: ${template.type}`);
      return true;
    }, 'LINE通知テンプレート保存');
  }

  /**
   * FlexMessageを生成
   * @param {Object} template - テンプレート
   * @param {Object} data - 置換用データ
   * @param {string} notificationType - 通知タイプ
   * @return {Object} FlexMessageオブジェクト
   */
  generateFlexMessage(template, data, notificationType) {
    return Utils.executeWithErrorHandling(() => {
      // FlexMessage用のデータ構造を準備
      const flexContent = {
        clinicName: data.clinicName || 'クリニック',
        patientName: data.patientName || '',
        date: data.reservationDate || '',
        time: data.reservationTime || '',
        menuName: data.treatmentName || '',
        duration: data.treatmentDuration || '',
        notes: data.treatmentNotes || '',
        ticketUsage: this.formatTicketUsage(data),
        ticketBalance: this.formatTicketBalance(data),
        staffName: data.staffName || '',
        reservationId: data.reservationId || '',
        clinicPhone: data.clinicPhone || ''
      };
      
      // 通知タイプに応じたFlexMessageタイプを決定
      const flexMessageType = this.getFlexMessageType(notificationType);
      
      // FlexMessageを生成
      return this.flexMessageTemplates.createMessage(flexMessageType, flexContent);
    }, 'FlexMessage生成');
  }

  /**
   * メッセージを生成（変数置換を実行）- 後方互換性のため維持
   * @param {Object} template - テンプレート
   * @param {Object} data - 置換用データ
   * @return {string} 生成されたメッセージ
   */
  generateMessage(template, data) {
    return Utils.executeWithErrorHandling(() => {
      let message = template.body || '';
      
      // 基本変数の置換
      const replacements = {
        '${来院者名}': data.patientName || '',
        '${予約者名}': data.bookerName || '',
        '${予約日}': data.reservationDate || '',
        '${予約時間}': data.reservationTime || '',
        '${施術内容}': data.treatmentName || '',
        '${施術時間}': data.treatmentDuration || '',
        '${施術注意点}': data.treatmentNotes || '',
        '${チケット消化予定枚数}': data.ticketToUse || '0',
        '${チケット残枚数}': data.ticketRemaining || '0',
        '${クリニック名}': data.clinicName || '',
        '${クリニック電話番号}': data.clinicPhone || '',
        '${予約ID}': data.reservationId || '',
        '${担当スタッフ}': data.staffName || ''
      };
      
      // 置換処理
      Object.keys(replacements).forEach(key => {
        const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        message = message.replace(regex, replacements[key]);
      });
      
      // 条件付き表示の処理
      message = this.processConditionalContent(message, data);
      
      return message;
    }, 'メッセージ生成');
  }

  /**
   * 予約情報からメッセージ用データを準備（スプレッドシートベース）
   * @param {Object} reservation - 予約情報
   * @param {Object} config - 通知設定
   * @return {Object} メッセージ用データ
   */
  async prepareMessageData(reservation, config) {
    return Utils.executeWithErrorHandlingAsync(async () => {
      // スプレッドシートから直接データを取得
      const messageData = await this.getDataFromSpreadsheets(reservation, config);
      
      return messageData;
    }, '予約メッセージデータ準備');
  }

  /**
   * スプレッドシートから各種データを取得
   * @param {Object} reservation - 予約情報
   * @param {Object} config - 通知設定
   * @return {Object} メッセージ用データ
   */
  async getDataFromSpreadsheets(reservation, config) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 来院者情報を取得（患者マスタ）
    const visitorData = this.getVisitorDataFromSheet(spreadsheet, reservation.visitor_id);
    
    // 2. 予約者情報を取得（予約者が異なる場合）
    let bookerData = visitorData;
    if (reservation.booker_visitor_id && reservation.booker_visitor_id !== reservation.visitor_id) {
      bookerData = this.getVisitorDataFromSheet(spreadsheet, reservation.booker_visitor_id);
    }
    
    // 3. メニュー情報を取得
    const menuData = this.getMenuDataFromSheet(spreadsheet, reservation.menu_id || reservation.メニュー);
    
    // 4. チケット情報を取得
    let ticketInfo = { toUse: 0, remaining: 0, details: {} };
    if (config.includeTicket) {
      ticketInfo = this.getTicketDataFromSheet(spreadsheet, reservation.visitor_id);
    }
    
    // 5. 施術注意点を取得
    let treatmentNotes = '';
    if (config.includeNotes) {
      treatmentNotes = this.getTreatmentNotesFromSheet(spreadsheet, reservation.menu_id || reservation.メニュー);
    }
    
    // 6. クリニック情報を取得（設定シートから）
    const clinicInfo = this.getClinicInfoFromSheet(spreadsheet);
    
    // 7. 日付フォーマット
    const reservationDate = new Date(reservation.予約日 || reservation.date);
    const formattedDate = Utils.formatDate(reservationDate);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][reservationDate.getDay()];
    
    return {
      patientName: visitorData.氏名 || visitorData.name || reservation.患者名,
      bookerName: bookerData.氏名 || bookerData.name || reservation.予約者,
      reservationDate: `${formattedDate}（${dayOfWeek}）`,
      reservationTime: reservation.予約時間 || reservation.time,
      treatmentName: menuData.メニュー名 || menuData.name || reservation.メニュー,
      treatmentDuration: menuData.所要時間 ? `${menuData.所要時間}分` : '',
      treatmentNotes: treatmentNotes,
      ticketToUse: ticketInfo.toUse,
      ticketRemaining: ticketInfo.remaining,
      ticketDetails: ticketInfo.details,
      clinicName: clinicInfo.name || 'クリニック',
      clinicPhone: clinicInfo.phone || '',
      reservationId: reservation.reservation_id || reservation.id,
      staffName: reservation.担当スタッフ || reservation.staff_name || '',
      companyName: reservation.会社名 || '',
      memberType: reservation.会員種別 || ''
    };
  }

  /**
   * 患者マスタシートから来院者データを取得
   */
  getVisitorDataFromSheet(spreadsheet, visitorId) {
    const sheet = spreadsheet.getSheetByName(this.sheetNames.visitors);
    if (!sheet) return {};
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('visitor_id')] === visitorId) {
        const visitor = {};
        headers.forEach((header, index) => {
          visitor[header] = data[i][index];
        });
        return visitor;
      }
    }
    return {};
  }

  /**
   * メニュー管理シートからメニューデータを取得
   */
  getMenuDataFromSheet(spreadsheet, menuIdentifier) {
    const sheet = spreadsheet.getSheetByName(this.sheetNames.menus);
    if (!sheet) return {};
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      // menu_idまたはメニュー名で検索
      const menuId = data[i][headers.indexOf('menu_id')];
      const menuName = data[i][headers.indexOf('メニュー名')];
      
      if (menuId === menuIdentifier || menuName === menuIdentifier) {
        const menu = {};
        headers.forEach((header, index) => {
          menu[header] = data[i][index];
        });
        return menu;
      }
    }
    return {};
  }

  /**
   * 会社マスタシートからチケット情報を取得
   */
  getTicketDataFromSheet(spreadsheet, visitorId) {
    // 1. 来院者の会社を特定
    const companyVisitorSheet = spreadsheet.getSheetByName(this.sheetNames.companyVisitors);
    if (!companyVisitorSheet) return { toUse: 0, remaining: 0, details: {} };
    
    const cvData = companyVisitorSheet.getDataRange().getValues();
    const cvHeaders = cvData[0];
    
    let companyId = null;
    for (let i = 1; i < cvData.length; i++) {
      if (cvData[i][cvHeaders.indexOf('visitor_id')] === visitorId) {
        companyId = cvData[i][cvHeaders.indexOf('会社ID')];
        break;
      }
    }
    
    if (!companyId) return { toUse: 0, remaining: 0, details: {} };
    
    // 2. 会社のチケット残数を取得
    const companySheet = spreadsheet.getSheetByName(this.sheetNames.companyMaster);
    if (!companySheet) return { toUse: 0, remaining: 0, details: {} };
    
    const cData = companySheet.getDataRange().getValues();
    const cHeaders = cData[0];
    
    for (let i = 1; i < cData.length; i++) {
      if (cData[i][cHeaders.indexOf('会社ID')] === companyId) {
        return {
          toUse: 1, // デフォルト消化数
          remaining: {
            stem: cData[i][cHeaders.indexOf('幹細胞チケット残数')] || 0,
            treatment: cData[i][cHeaders.indexOf('施術チケット残数')] || 0,
            infusion: cData[i][cHeaders.indexOf('点滴チケット残数')] || 0
          },
          details: {
            companyName: cData[i][cHeaders.indexOf('会社名')],
            plan: cData[i][cHeaders.indexOf('プラン')]
          }
        };
      }
    }
    
    return { toUse: 0, remaining: 0, details: {} };
  }

  /**
   * 施術マスタシートから注意点を取得
   */
  getTreatmentNotesFromSheet(spreadsheet, menuIdentifier) {
    const sheet = spreadsheet.getSheetByName(this.sheetNames.treatmentMaster);
    if (!sheet) return '';
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      const treatmentName = data[i][headers.indexOf('名称 ※必須')];
      if (treatmentName === menuIdentifier) {
        return data[i][headers.indexOf('注意書き')] || '';
      }
    }
    return '';
  }

  /**
   * 設定シートからクリニック情報を取得
   */
  getClinicInfoFromSheet(spreadsheet) {
    const sheet = spreadsheet.getSheetByName(this.sheetNames.config);
    if (!sheet) return { name: 'クリニック', phone: '' };
    
    const data = sheet.getDataRange().getValues();
    let clinicName = 'クリニック';
    let clinicPhone = '';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'CLINIC_NAME') {
        clinicName = data[i][1] || 'クリニック';
      } else if (data[i][0] === 'CLINIC_PHONE') {
        clinicPhone = data[i][1] || '';
      }
    }
    
    return { name: clinicName, phone: clinicPhone };
  }

  /**
   * チケット情報を取得
   * @param {Object} reservation - 予約情報
   * @return {Object} チケット情報
   */
  async getTicketInfo(reservation) {
    try {
      // チケット管理サービスから情報を取得
      const ticketData = await this.ticketManagementService
        .getVisitorTicketBalance(reservation.visitor_id);
      
      // メニューのチケット消費数を取得
      const menu = await this.menuService.getMenuById(reservation.menu_id);
      const ticketToUse = menu && menu.ticket_count ? menu.ticket_count : 0;
      
      return {
        toUse: ticketToUse,
        remaining: ticketData ? ticketData.balance - ticketToUse : 0
      };
    } catch (error) {
      Logger.log(`チケット情報取得エラー: ${error.toString()}`);
      return { toUse: 0, remaining: 0 };
    }
  }

  /**
   * 施術注意点を取得
   * @param {Object} reservation - 予約情報
   * @return {string} 施術注意点
   */
  async getTreatmentNotes(reservation) {
    try {
      // 施術マスタから注意点を取得
      const treatmentSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(this.sheetNames.treatmentMaster);
      
      if (!treatmentSheet) return '';
      
      const data = treatmentSheet.getDataRange().getValues();
      const headers = data[0];
      const nameIndex = headers.indexOf('名称 ※必須');
      const notesIndex = headers.indexOf('注意書き');
      
      // メニュー名で検索
      const menu = await this.menuService.getMenuById(reservation.menu_id);
      if (!menu) return '';
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][nameIndex] === menu.name) {
          return data[i][notesIndex] || '';
        }
      }
      
      return '';
    } catch (error) {
      Logger.log(`施術注意点取得エラー: ${error.toString()}`);
      return '';
    }
  }

  /**
   * クリニック情報を取得
   * @return {Object} クリニック情報
   */
  async getClinicInfo() {
    try {
      // キャッシュから取得を試みる
      const cache = CacheService.getScriptCache();
      const cached = cache.get('clinic_info');
      if (cached) {
        return JSON.parse(cached);
      }
      
      // APIから取得
      const apiClient = new ApiClient();
      const response = await apiClient.get('/clinics');
      
      if (response && response.values && response.values.length > 0) {
        const clinic = response.values[0];
        const clinicInfo = {
          name: clinic.name || 'クリニック',
          phone: clinic.phone || ''
        };
        
        // キャッシュに保存（5分間）
        cache.put('clinic_info', JSON.stringify(clinicInfo), 300);
        return clinicInfo;
      }
      
      return { name: 'クリニック', phone: '' };
    } catch (error) {
      Logger.log(`クリニック情報取得エラー: ${error.toString()}`);
      return { name: 'クリニック', phone: '' };
    }
  }

  /**
   * 条件付き表示を処理
   * @param {string} message - メッセージ
   * @param {Object} data - データ
   * @return {string} 処理後のメッセージ
   */
  processConditionalContent(message, data) {
    // チケット情報の条件付き表示
    if (data.ticketToUse && data.ticketToUse > 0) {
      message = message.replace(/\[チケット情報\]/g, 
        `🎫 チケット消化: ${data.ticketToUse}枚\n🎫 残数: ${data.ticketRemaining}枚`);
    } else {
      message = message.replace(/\[チケット情報\]/g, '');
    }
    
    // 施術注意点の条件付き表示
    if (data.treatmentNotes) {
      message = message.replace(/\[注意事項\]/g, 
        `⚠️ 注意事項:\n${data.treatmentNotes}`);
    } else {
      message = message.replace(/\[注意事項\]/g, '');
    }
    
    // 担当スタッフの条件付き表示
    if (data.staffName) {
      message = message.replace(/\[担当スタッフ\]/g, 
        `👤 担当: ${data.staffName}`);
    } else {
      message = message.replace(/\[担当スタッフ\]/g, '');
    }
    
    // 空行の削除
    message = message.replace(/\n{3,}/g, '\n\n');
    
    return message.trim();
  }

  /**
   * デフォルトテンプレートを取得
   * @param {string} notificationType - 通知タイプ
   * @return {Object} デフォルトテンプレート
   */
  getDefaultTemplate(notificationType) {
    const templates = {
      '予約確定': {
        type: '予約確定',
        name: '予約確定通知',
        body: `【予約確定のお知らせ】

${来院者名}様

ご予約が確定いたしました。

📅 予約日時
${予約日} ${予約時間}

📋 施術内容
${施術内容}（${施術時間}）

[チケット情報]

[注意事項]

[担当スタッフ]

ご来院お待ちしております。
変更・キャンセルの場合はお早めにご連絡ください。

${クリニック名}
📞 ${クリニック電話番号}`,
        variables: ['来院者名', '予約日', '予約時間', '施術内容', '施術時間', 
                   'チケット消化予定枚数', 'チケット残枚数', '施術注意点',
                   'クリニック名', 'クリニック電話番号', '担当スタッフ']
      },
      '予約前日': {
        type: '予約前日',
        name: '前日リマインダー',
        body: `【明日のご予約のお知らせ】

${来院者名}様

明日のご予約をお知らせいたします。

📅 予約日時
${予約日} ${予約時間}

📋 施術内容
${施術内容}（${施術時間}）

[チケット情報]

[注意事項]

お気をつけてお越しください。

${クリニック名}`,
        variables: ['来院者名', '予約日', '予約時間', '施術内容', '施術時間',
                   'チケット消化予定枚数', 'チケット残枚数', '施術注意点',
                   'クリニック名']
      },
      '予約当日': {
        type: '予約当日',
        name: '当日リマインダー',
        body: `【本日のご予約のお知らせ】

${来院者名}様

本日 ${予約時間} のご予約をお待ちしております。

📋 施術内容
${施術内容}（${施術時間}）

[チケット情報]

[注意事項]

お気をつけてお越しください。

${クリニック名}`,
        variables: ['来院者名', '予約時間', '施術内容', '施術時間',
                   'チケット消化予定枚数', 'チケット残枚数', '施術注意点',
                   'クリニック名']
      },
      '施術後': {
        type: '施術後',
        name: '施術後フォローアップ',
        body: `【ご来院ありがとうございました】

${来院者名}様

本日はご来院いただき、ありがとうございました。

📋 本日の施術
${施術内容}

[チケット情報]

お体に変化がございましたら、お気軽にご相談ください。

またのご来院をお待ちしております。

${クリニック名}
📞 ${クリニック電話番号}`,
        variables: ['来院者名', '施術内容', 'チケット消化予定枚数', 
                   'チケット残枚数', 'クリニック名', 'クリニック電話番号']
      }
    };
    
    return templates[notificationType] || {
      type: notificationType,
      name: notificationType,
      body: '',
      variables: []
    };
  }

  /**
   * テンプレートのプレビューを生成
   * @param {string} notificationType - 通知タイプ
   * @return {Object} プレビュー情報
   */
  async generatePreview(notificationType) {
    return Utils.executeWithErrorHandlingAsync(async () => {
      // テンプレートを取得
      const template = this.getTemplate(notificationType);
      
      // サンプルデータを作成
      const sampleData = {
        patientName: '山田太郎',
        bookerName: '山田花子',
        reservationDate: '2024年1月15日（月）',
        reservationTime: '14:00',
        treatmentName: 'ボトックス注射',
        treatmentDuration: '30分',
        treatmentNotes: '施術前後2時間は激しい運動を避けてください。',
        ticketToUse: 2,
        ticketRemaining: 8,
        clinicName: 'サンプルクリニック',
        clinicPhone: '03-1234-5678',
        reservationId: 'RES-20240115-001',
        staffName: '田中医師'
      };
      
      // メッセージを生成
      const message = this.generateMessage(template, sampleData);
      
      return {
        type: notificationType,
        templateName: template.name,
        message: message,
        variables: template.variables,
        sampleData: sampleData
      };
    }, 'テンプレートプレビュー生成');
  }

  /**
   * テンプレートを初期化（デフォルトテンプレートで上書き）
   * @return {boolean} 成功フラグ
   */
  initializeTemplates() {
    return Utils.executeWithErrorHandling(() => {
      const types = ['予約確定', '予約前日', '予約当日', '施術後'];
      
      types.forEach(type => {
        const defaultTemplate = this.getDefaultTemplate(type);
        defaultTemplate.enabled = true;
        this.saveTemplate(defaultTemplate);
      });
      
      Logger.log('テンプレートを初期化しました');
      return true;
    }, 'テンプレート初期化');
  }

  /**
   * 通知タイプからFlexMessageタイプへのマッピング
   */
  getFlexMessageType(notificationType) {
    const typeMapping = {
      '予約確定': 'full_booking_confirmation',
      '予約前日': 'reminder',
      '予約当日': 'reminder',
      '施術後': 'post_treatment'
    };
    
    return typeMapping[notificationType] || 'full_booking_confirmation';
  }

  /**
   * チケット使用情報をフォーマット
   */
  formatTicketUsage(data) {
    if (!data.ticketToUse || data.ticketToUse === 0) {
      return null;
    }
    
    return {
      stem: data.ticketToUse,
      treatment: data.ticketToUse,
      infusion: data.ticketToUse
    };
  }

  /**
   * チケット残数情報をフォーマット
   */
  formatTicketBalance(data) {
    if (!data.ticketRemaining) {
      return null;
    }
    
    if (typeof data.ticketRemaining === 'object') {
      return data.ticketRemaining;
    }
    
    return {
      stem: data.ticketRemaining,
      treatment: data.ticketRemaining,
      infusion: data.ticketRemaining
    };
  }

  /**
   * テンプレート変数の一覧を取得
   * @return {Array} 変数リスト
   */
  getAvailableVariables() {
    return [
      { name: '来院者名', key: '${来院者名}', description: '施術を受ける人の名前' },
      { name: '予約者名', key: '${予約者名}', description: '予約操作をした人の名前' },
      { name: '予約日', key: '${予約日}', description: 'yyyy年MM月dd日（曜日）形式' },
      { name: '予約時間', key: '${予約時間}', description: 'HH:mm形式' },
      { name: '施術内容', key: '${施術内容}', description: 'メニュー名' },
      { name: '施術時間', key: '${施術時間}', description: '施術の所要時間' },
      { name: '施術注意点', key: '${施術注意点}', description: '施術に関する注意事項' },
      { name: 'チケット消化予定枚数', key: '${チケット消化予定枚数}', description: '今回消化するチケット数' },
      { name: 'チケット残枚数', key: '${チケット残枚数}', description: '消化後の残数' },
      { name: 'クリニック名', key: '${クリニック名}', description: 'クリニック名称' },
      { name: 'クリニック電話番号', key: '${クリニック電話番号}', description: '連絡先' },
      { name: '予約ID', key: '${予約ID}', description: '予約の識別番号' },
      { name: '担当スタッフ', key: '${担当スタッフ}', description: '担当スタッフ名' }
    ];
  }
}