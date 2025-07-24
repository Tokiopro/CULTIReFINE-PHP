/**
 * チケット管理サービス
 */
class TicketManagementService {
  constructor() {
    this.sheetNames = Config.getSheetNames();
    this.ticketHistorySheetName = 'チケット使用履歴';
  }
  
  /**
   * 会社別チケット情報を取得
   */
  getCompanyTickets() {
    return Utils.executeWithErrorHandling(() => {
      const companySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyMaster);
      const companyVisitorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyVisitors);
      
      if (!companySheet || companySheet.getLastRow() <= 1) {
        return { success: true, companies: [] };
      }
      
      // 会社データを取得
      const companyData = companySheet.getDataRange().getValues();
      const companyHeaders = companyData[0];
      const companies = [];
      
      // インデックスを取得
      const idIndex = companyHeaders.indexOf('会社ID');
      const nameIndex = companyHeaders.indexOf('会社名');
      const planIndex = companyHeaders.indexOf('プラン');
      const stemCellIndex = companyHeaders.indexOf('幹細胞チケット残数');
      const treatmentIndex = companyHeaders.indexOf('施術チケット残数');
      const infusionIndex = companyHeaders.indexOf('点滴チケット残数');
      
      // 会社ごとのメンバー数をカウント
      const memberCounts = this._getCompanyMemberCounts(companyVisitorSheet);
      
      for (let i = 1; i < companyData.length; i++) {
        const row = companyData[i];
        if (row[idIndex]) {
          companies.push({
            id: row[idIndex],
            name: row[nameIndex] || '',
            plan: row[planIndex] || '',
            stemCellTickets: parseInt(row[stemCellIndex]) || 0,
            treatmentTickets: parseInt(row[treatmentIndex]) || 0,
            infusionTickets: parseInt(row[infusionIndex]) || 0,
            memberCount: memberCounts[row[idIndex]] || 0
          });
        }
      }
      
      return { success: true, companies: companies };
    });
  }
  
  /**
   * 特定の会社のチケット情報を取得
   * @param {string} companyId - 会社ID
   * @return {Object} チケット情報
   */
  getCompanyTicketById(companyId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`getCompanyTicketById: 開始 - companyId: ${companyId}`);
      
      const companySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyMaster);
      
      if (!companySheet || companySheet.getLastRow() <= 1) {
        Logger.log('getCompanyTicketById: 会社マスタシートが空です');
        return { success: false, error: '会社マスタシートが見つかりません' };
      }
      
      // 会社データを取得
      const companyData = companySheet.getDataRange().getValues();
      const companyHeaders = companyData[0];
      
      // インデックスを取得
      const idIndex = companyHeaders.indexOf('会社ID');
      const nameIndex = companyHeaders.indexOf('会社名');
      const planIndex = companyHeaders.indexOf('プラン');
      const stemCellIndex = companyHeaders.indexOf('幹細胞チケット残数');
      const treatmentIndex = companyHeaders.indexOf('施術チケット残数');
      const infusionIndex = companyHeaders.indexOf('点滴チケット残数');
      
      Logger.log(`getCompanyTicketById: ヘッダーインデックス - ID: ${idIndex}, 幹細胞: ${stemCellIndex}, 施術: ${treatmentIndex}, 点滴: ${infusionIndex}`);
      
      // 指定された会社IDの行を検索
      for (let i = 1; i < companyData.length; i++) {
        const row = companyData[i];
        if (row[idIndex] === companyId) {
          const ticketInfo = {
            id: row[idIndex],
            name: row[nameIndex] || '',
            plan: row[planIndex] || '',
            stemCellTickets: parseInt(row[stemCellIndex]) || 0,
            treatmentTickets: parseInt(row[treatmentIndex]) || 0,
            infusionTickets: parseInt(row[infusionIndex]) || 0
          };
          
          Logger.log(`getCompanyTicketById: 会社情報を取得 - ${JSON.stringify(ticketInfo)}`);
          return { success: true, company: ticketInfo };
        }
      }
      
      Logger.log(`getCompanyTicketById: 会社ID ${companyId} が見つかりません`);
      return { success: false, error: `会社ID ${companyId} が見つかりません` };
    });
  }
  
  /**
   * 会社ごとのメンバー数を取得
   * @private
   */
  _getCompanyMemberCounts(sheet) {
    const counts = {};
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return counts;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const companyIdIndex = headers.indexOf('会社ID');
    
    for (let i = 1; i < data.length; i++) {
      const companyId = data[i][companyIdIndex];
      if (companyId) {
        counts[companyId] = (counts[companyId] || 0) + 1;
      }
    }
    
    return counts;
  }
  
  /**
   * チケットを追加
   */
  addCompanyTickets(ticketData) {
    return Utils.executeWithErrorHandling(() => {
      const companySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyMaster);
      if (!companySheet) {
        throw new Error('会社マスタシートが見つかりません');
      }
      
      // 会社を検索
      const companyRow = this._findCompanyRow(companySheet, ticketData.companyId);
      if (!companyRow) {
        throw new Error('指定された会社が見つかりません');
      }
      
      const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0];
      let stemCellToAdd = 0;
      let treatmentToAdd = 0;
      let infusionToAdd = 0;
      
      if (ticketData.type === 'plan') {
        // プランからチケット数を取得
        const plan = this._getPlanDetails(ticketData.planName);
        if (!plan) {
          throw new Error('指定されたプランが見つかりません');
        }
        stemCellToAdd = plan.stemCell || 0;
        treatmentToAdd = plan.treatment || 0;
        infusionToAdd = plan.infusion || 0;
      } else {
        // 手動追加
        stemCellToAdd = ticketData.stemCell || 0;
        treatmentToAdd = ticketData.treatment || 0;
        infusionToAdd = ticketData.infusion || 0;
      }
      
      // 現在の残数を取得
      const stemCellIndex = headers.indexOf('幹細胞チケット残数');
      const treatmentIndex = headers.indexOf('施術チケット残数');
      const infusionIndex = headers.indexOf('点滴チケット残数');
      
      const currentStemCell = parseInt(companySheet.getRange(companyRow, stemCellIndex + 1).getValue()) || 0;
      const currentTreatment = parseInt(companySheet.getRange(companyRow, treatmentIndex + 1).getValue()) || 0;
      const currentInfusion = parseInt(companySheet.getRange(companyRow, infusionIndex + 1).getValue()) || 0;
      
      // 新しい残数を設定
      companySheet.getRange(companyRow, stemCellIndex + 1).setValue(currentStemCell + stemCellToAdd);
      companySheet.getRange(companyRow, treatmentIndex + 1).setValue(currentTreatment + treatmentToAdd);
      companySheet.getRange(companyRow, infusionIndex + 1).setValue(currentInfusion + infusionToAdd);
      
      // 履歴を記録
      this._recordTicketHistory({
        companyId: ticketData.companyId,
        companyName: companySheet.getRange(companyRow, headers.indexOf('会社名') + 1).getValue(),
        type: '追加',
        stemCell: stemCellToAdd,
        treatment: treatmentToAdd,
        infusion: infusionToAdd,
        reason: ticketData.reason || `${ticketData.type === 'plan' ? ticketData.planName + 'プラン' : '手動'}追加`,
        date: new Date()
      });
      
      return { success: true };
    });
  }
  
  /**
   * チケットを使用
   */
  useCompanyTickets(ticketData) {
    return Utils.executeWithErrorHandling(() => {
      const companySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyMaster);
      if (!companySheet) {
        throw new Error('会社マスタシートが見つかりません');
      }
      
      // 会社を検索
      const companyRow = this._findCompanyRow(companySheet, ticketData.companyId);
      if (!companyRow) {
        throw new Error('指定された会社が見つかりません');
      }
      
      const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0];
      
      // 使用するチケット数を決定
      let stemCellToUse = 0;
      let treatmentToUse = 0;
      let infusionToUse = 0;
      let alertMessage = '';
      
      switch(ticketData.ticketType) {
        case '幹細胞':
          stemCellToUse = 1;
          alertMessage = `${ticketData.menuName}の施術で幹細胞チケットを1枚消費しました。`;
          break;
        case '施術':
          treatmentToUse = 1;
          alertMessage = `${ticketData.menuName}の施術で施術チケットを1枚消費しました。`;
          break;
        case '点滴':
          infusionToUse = 1;
          alertMessage = `${ticketData.menuName}の施術で点滴チケットを1枚消費しました。`;
          break;
        default:
          alertMessage = `${ticketData.menuName}の施術ではチケットを消費しません。`;
      }
      
      // 現在の残数を取得
      const stemCellIndex = headers.indexOf('幹細胞チケット残数');
      const treatmentIndex = headers.indexOf('施術チケット残数');
      const infusionIndex = headers.indexOf('点滴チケット残数');
      
      const currentStemCell = parseInt(companySheet.getRange(companyRow, stemCellIndex + 1).getValue()) || 0;
      const currentTreatment = parseInt(companySheet.getRange(companyRow, treatmentIndex + 1).getValue()) || 0;
      const currentInfusion = parseInt(companySheet.getRange(companyRow, infusionIndex + 1).getValue()) || 0;
      
      // 残数チェック
      if (stemCellToUse > currentStemCell) {
        throw new Error('幹細胞チケットが不足しています');
      }
      if (treatmentToUse > currentTreatment) {
        throw new Error('施術チケットが不足しています');
      }
      if (infusionToUse > currentInfusion) {
        throw new Error('点滴チケットが不足しています');
      }
      
      // 新しい残数を設定
      if (stemCellToUse > 0) {
        companySheet.getRange(companyRow, stemCellIndex + 1).setValue(currentStemCell - stemCellToUse);
      }
      if (treatmentToUse > 0) {
        companySheet.getRange(companyRow, treatmentIndex + 1).setValue(currentTreatment - treatmentToUse);
      }
      if (infusionToUse > 0) {
        companySheet.getRange(companyRow, infusionIndex + 1).setValue(currentInfusion - infusionToUse);
      }
      
      // 使用者情報を取得
      const visitorService = new VisitorService();
      const visitor = visitorService.getVisitorById(ticketData.visitorId);
      const userName = visitor ? visitor.name : 'Unknown';
      
      // 履歴を記録
      this._recordTicketHistory({
        companyId: ticketData.companyId,
        companyName: companySheet.getRange(companyRow, headers.indexOf('会社名') + 1).getValue(),
        type: '使用',
        stemCell: stemCellToUse > 0 ? -stemCellToUse : null,
        treatment: treatmentToUse > 0 ? -treatmentToUse : null,
        infusion: infusionToUse > 0 ? -infusionToUse : null,
        visitorId: ticketData.visitorId,
        userName: userName,
        menuName: ticketData.menuName,
        reason: ticketData.reason || `${ticketData.menuName}で使用`,
        date: new Date()
      });
      
      // 残数警告
      let warningMessage = '';
      const newStemCell = currentStemCell - stemCellToUse;
      const newTreatment = currentTreatment - treatmentToUse;
      const newInfusion = currentInfusion - infusionToUse;
      
      if (newStemCell <= 3 || newTreatment <= 3 || newInfusion <= 3) {
        warningMessage = '\n\n【残数警告】\n';
        if (newStemCell <= 3) warningMessage += `幹細胞チケット: ${newStemCell}枚\n`;
        if (newTreatment <= 3) warningMessage += `施術チケット: ${newTreatment}枚\n`;
        if (newInfusion <= 3) warningMessage += `点滴チケット: ${newInfusion}枚\n`;
        warningMessage += '\nチケット残数が少なくなっています。';
      }
      
      return { 
        success: true, 
        message: 'チケットを使用しました',
        alert: alertMessage + warningMessage
      };
    });
  }
  
  /**
   * チケット履歴を取得
   */
  getTicketHistory() {
    return Utils.executeWithErrorHandling(() => {
      const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.ticketHistorySheetName);
      if (!historySheet || historySheet.getLastRow() <= 1) {
        return { success: true, history: [] };
      }
      
      const data = historySheet.getDataRange().getValues();
      const headers = data[0];
      const history = [];
      
      // 最新100件を取得（逆順）
      const startRow = Math.max(1, data.length - 100);
      for (let i = data.length - 1; i >= startRow; i--) {
        const row = data[i];
        history.push({
          date: Utils.formatDate(row[0]),
          companyName: row[1],
          type: row[2],
          stemCell: row[3],
          treatment: row[4],
          infusion: row[5],
          userName: row[6],
          reason: row[7]
        });
      }
      
      return { success: true, history: history };
    });
  }
  
  /**
   * メニューとチケットタイプの情報を取得
   */
  getMenusWithTicketType() {
    return Utils.executeWithErrorHandling(() => {
      const menuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.menus);
      if (!menuSheet || menuSheet.getLastRow() <= 1) {
        return { success: true, menus: [] };
      }
      
      const data = menuSheet.getDataRange().getValues();
      const headers = data[0];
      
      // チケットタイプ列がない場合は追加
      let ticketTypeIndex = headers.indexOf('チケットタイプ');
      if (ticketTypeIndex === -1) {
        ticketTypeIndex = headers.length;
        menuSheet.getRange(1, ticketTypeIndex + 1).setValue('チケットタイプ');
      }
      
      const menus = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[0]) { // menu_id
          menus.push({
            id: row[0],
            name: row[1] || '',
            category: row[2] || '',
            ticketType: row[ticketTypeIndex] || ''
          });
        }
      }
      
      return { success: true, menus: menus };
    });
  }
  
  /**
   * メニューのチケットタイプを更新
   */
  updateMenuTicketTypes(settings) {
    return Utils.executeWithErrorHandling(() => {
      const menuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.menus);
      if (!menuSheet) {
        throw new Error('メニュー管理シートが見つかりません');
      }
      
      const headers = menuSheet.getRange(1, 1, 1, menuSheet.getLastColumn()).getValues()[0];
      
      // チケットタイプ列を確認・追加
      let ticketTypeIndex = headers.indexOf('チケットタイプ');
      if (ticketTypeIndex === -1) {
        ticketTypeIndex = headers.length;
        menuSheet.getRange(1, ticketTypeIndex + 1).setValue('チケットタイプ');
      }
      
      // 各メニューのチケットタイプを更新
      settings.forEach(setting => {
        const menuRow = this._findMenuRow(menuSheet, setting.menuId);
        if (menuRow) {
          menuSheet.getRange(menuRow, ticketTypeIndex + 1).setValue(setting.ticketType || '');
        }
      });
      
      return { success: true };
    });
  }
  
  /**
   * 会社メンバーを取得
   */
  getCompanyMembers(companyId) {
    return Utils.executeWithErrorHandling(() => {
      const companyVisitorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.companyVisitors);
      if (!companyVisitorSheet || companyVisitorSheet.getLastRow() <= 1) {
        return { success: true, members: [] };
      }
      
      const data = companyVisitorSheet.getDataRange().getValues();
      const headers = data[0];
      const members = [];
      
      const companyIdIndex = headers.indexOf('会社ID');
      const visitorIdIndex = headers.indexOf('visitor_id');
      const nameIndex = headers.indexOf('患者名');
      const memberTypeIndex = headers.indexOf('会員種別');
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[companyIdIndex] === companyId) {
          members.push({
            visitorId: row[visitorIdIndex],
            name: row[nameIndex] || '',
            memberType: row[memberTypeIndex] || ''
          });
        }
      }
      
      return { success: true, members: members };
    });
  }
  
  /**
   * チケットを同期
   */
  syncCompanyTickets() {
    return Utils.executeWithErrorHandling(() => {
      // TODO: APIからチケット情報を取得して同期する処理を実装
      // 現時点では手動管理のみ
      
      Logger.log('チケット同期処理（現在は手動管理のみ）');
      
      return { success: true, message: '同期処理を完了しました' };
    });
  }

  /**
   * 会社の最新チケット使用日時を取得
   */
  getLastTicketUsageDates(companyId) {
    return Utils.executeWithErrorHandling(() => {
      const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.ticketHistorySheetName);
      if (!historySheet || historySheet.getLastRow() <= 1) {
        return { 
          success: true, 
          lastUsageDates: {
            stemCell: null,
            treatment: null,
            infusion: null
          }
        };
      }
      
      const data = historySheet.getDataRange().getValues();
      const headers = data[0];
      Logger.log(`getPhpTicketBalance: ヘッダー ${headers} `);
      
      // 各チケットタイプの最新使用日時を検索
      const lastUsageDates = {
        stemCell: null,
        treatment: null,
        infusion: null
      };
      
      // 日時、会社名、タイプ、幹細胞、施術、点滴のインデックス
      const usageDateIndex = 0;
      const companyIdIndex = 1;
      const menuTypeIndex = 2;
      const usageAmountIndex = 3;
      const userNameIndex = 4;
      const noteIndex = 5;
      const createdAtIndex = 6;
      
      // 新しい順（末尾から）検索して最初に見つかった使用履歴を採用
      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        
        // 会社IDが一致する場合のみ処理
        if (row[companyIdIndex] === companyId) {
          const menuType = row[menuTypeIndex];
          const usageDate = row[usageDateIndex];
          
          // メニュータイプに応じて最終利用日を更新
          if (menuType === '幹細胞' && lastUsageDates.stemCell === null) {
            lastUsageDates.stemCell = usageDate;
          }
          if (menuType === '施術' && lastUsageDates.treatment === null) {
            lastUsageDates.treatment = usageDate;
          }
          if (menuType === '点滴' && lastUsageDates.infusion === null) {
            lastUsageDates.infusion = usageDate;
          }
          
          // 全てのメニューの最終利用日が見つかったら終了
          if (lastUsageDates.stemCell && lastUsageDates.treatment && lastUsageDates.infusion) {
            break;
          }
        }
      }
      
      return { 
        success: true, 
        lastUsageDates: lastUsageDates 
      };
    });
  }
  
  /**
   * チケット履歴をエクスポート
   */
  exportTicketHistory() {
    return Utils.executeWithErrorHandling(() => {
      const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.ticketHistorySheetName);
      if (!historySheet || historySheet.getLastRow() <= 1) {
        return { success: false, error: 'エクスポートする履歴がありません' };
      }
      
      const data = historySheet.getDataRange().getValues();
      const csv = data.map(row => row.map(cell => {
        if (cell instanceof Date) {
          return Utils.formatDate(cell);
        }
        return `"${String(cell).replace(/"/g, '""')}"`;
      }).join(',')).join('\n');
      
      return { success: true, csv: csv };
    });
  }
  
  /**
   * 会社行を検索
   * @private
   */
  _findCompanyRow(sheet, companyId) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('会社ID');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === companyId) {
        return i + 1;
      }
    }
    return null;
  }
  
  /**
   * メニュー行を検索
   * @private
   */
  _findMenuRow(sheet, menuId) {
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === menuId) {
        return i + 1;
      }
    }
    return null;
  }
  
  /**
   * プラン詳細を取得
   * @private
   */
  _getPlanDetails(planName) {
    const planSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('プランマスター');
    if (!planSheet) return null;
    
    const data = planSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === planName) {
        return {
          name: data[i][0],
          stemCell: parseInt(data[i][1]) || 0,
          treatment: parseInt(data[i][2]) || 0,
          infusion: parseInt(data[i][3]) || 0
        };
      }
    }
    return null;
  }
  
  /**
   * チケット履歴を記録
   * @private
   */
  _recordTicketHistory(historyData) {
    let historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.ticketHistorySheetName);
    
    // シートが存在しない場合は作成
    if (!historySheet) {
      historySheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(this.ticketHistorySheetName);
      const headers = [
        '日時',
        '会社名',
        'タイプ',
        '幹細胞',
        '施術',
        '点滴',
        '使用者',
        '理由'
      ];
      historySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      historySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      historySheet.getRange(1, 1, 1, headers.length).setBackground('#f8f9fa');
    }
    
    // 履歴を追加
    const newRow = [
      historyData.date,
      historyData.companyName,
      historyData.type,
      historyData.stemCell || '',
      historyData.treatment || '',
      historyData.infusion || '',
      historyData.userName || '',
      historyData.reason || ''
    ];
    
    historySheet.appendRow(newRow);
  }
}