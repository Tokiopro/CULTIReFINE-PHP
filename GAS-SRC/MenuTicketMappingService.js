/**
 * MenuTicketMappingService
 * MenuIDとチケットタイプの関連付けを管理するサービス
 */
class MenuTicketMappingService {
  constructor() {
    this.sheetManager = new SpreadsheetManager();
    this.sheetName = 'メニューチケット関連付け';
  }

  /**
   * メニューチケット関連付けシートを初期化
   */
  initializeMenuTicketMappingSheet() {
    try {
      const sheet = this.sheetManager.getOrCreateSheet(this.sheetName);
      
      // ヘッダー設定
      const headers = [
        'MenuID',
        'BaseMenuID', // 基本メニューID（初回・2回目の親ID）
        'MenuName',
        'MenuType', // 'first_time', 'repeat', 'ticket'
        'チケットタイプ',
        '必要チケット数',
        'カテゴリ',
        '有効フラグ',
        '作成日時',
        '更新日時'
      ];

      // 既存データをチェック
      const existingData = sheet.getDataRange().getValues();
      if (existingData.length <= 1 || !existingData[0].join('').trim()) {
        // データが存在しないか、空の場合は初期化
        sheet.clear();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        
        // ヘッダー行のフォーマット
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#f0f0f0');
        
        // サンプルデータを作成
        this.createInitialMappingData();
      }
      
      return { success: true };
    } catch (error) {
      console.error('メニューチケット関連付けシート初期化エラー:', error);
      throw new Error('メニューチケット関連付けシートの初期化に失敗しました');
    }
  }

  /**
   * 初期マッピングデータを作成
   */
  createInitialMappingData() {
    try {
      const sheet = this.sheetManager.getOrCreateSheet(this.sheetName);
      
      // サンプルの初期データ
      const initialData = [
        // ハイドラフェイシャル
        ['menu_hydra_001_first', 'menu_hydra_001', 'ハイドラフェイシャル（初回）', 'first_time', 'なし', 0, '美容施術', true, new Date(), new Date()],
        ['menu_hydra_001_repeat', 'menu_hydra_001', 'ハイドラフェイシャル（2回目以降）', 'repeat', 'なし', 0, '美容施術', true, new Date(), new Date()],
        
        // ビタミン点滴
        ['menu_vitamin_001_first', 'menu_vitamin_001', 'ビタミン点滴（初回）', 'first_time', 'なし', 0, '点滴', true, new Date(), new Date()],
        ['menu_vitamin_001_repeat', 'menu_vitamin_001', 'ビタミン点滴（2回目以降）', 'repeat', 'なし', 0, '点滴', true, new Date(), new Date()],
        ['menu_vitamin_001_ticket', 'menu_vitamin_001', 'ビタミン点滴（チケット使用）', 'ticket', '点滴', 1, '点滴', true, new Date(), new Date()],
        
        // 美白点滴
        ['menu_whitening_001_first', 'menu_whitening_001', '美白点滴（初回）', 'first_time', 'なし', 0, '点滴', true, new Date(), new Date()],
        ['menu_whitening_001_repeat', 'menu_whitening_001', '美白点滴（2回目以降）', 'repeat', 'なし', 0, '点滴', true, new Date(), new Date()],
        ['menu_whitening_001_ticket', 'menu_whitening_001', '美白点滴（チケット使用）', 'ticket', '点滴', 1, '点滴', true, new Date(), new Date()],
        
        // 幹細胞治療
        ['menu_stem_001_first', 'menu_stem_001', '幹細胞治療（初回）', 'first_time', 'なし', 0, '幹細胞治療', true, new Date(), new Date()],
        ['menu_stem_001_repeat', 'menu_stem_001', '幹細胞治療（2回目以降）', 'repeat', 'なし', 0, '幹細胞治療', true, new Date(), new Date()],
        ['menu_stem_001_ticket', 'menu_stem_001', '幹細胞治療（チケット使用）', 'ticket', '幹細胞', 1, '幹細胞治療', true, new Date(), new Date()]
      ];

      // データを追加
      sheet.getRange(2, 1, initialData.length, initialData[0].length).setValues(initialData);
      
      console.log(`${initialData.length}件の初期メニューチケット関連付けデータを作成しました`);
    } catch (error) {
      console.error('初期マッピングデータ作成エラー:', error);
      throw error;
    }
  }

  /**
   * メニューチケット関連付けデータを取得
   */
  getAllMappings() {
    try {
      const sheet = this.sheetManager.getOrCreateSheet(this.sheetName);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        return [];
      }
      
      const headers = data[0];
      const mappings = [];
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // MenuIDが空の行はスキップ
        
        mappings.push({
          menuId: row[0],
          baseMenuId: row[1],
          menuName: row[2],
          menuType: row[3],
          ticketType: row[4],
          requiredTickets: row[5] || 0,
          category: row[6],
          active: row[7] !== false,
          createdAt: row[8],
          updatedAt: row[9]
        });
      }
      
      return mappings;
    } catch (error) {
      console.error('メニューチケット関連付けデータ取得エラー:', error);
      return [];
    }
  }

  /**
   * 基本メニューIDから関連するMenuIDを取得
   * @param {string} baseMenuId - 基本メニューID
   * @returns {Object} 初回・2回目・チケット用のMenuID
   */
  getMenuIdsByBaseId(baseMenuId) {
    try {
      const mappings = this.getAllMappings();
      const relatedMenus = mappings.filter(mapping => mapping.baseMenuId === baseMenuId && mapping.active);
      
      const result = {
        baseMenuId: baseMenuId,
        firstTime: null,
        repeat: null,
        tickets: []
      };
      
      relatedMenus.forEach(menu => {
        switch (menu.menuType) {
          case 'first_time':
            result.firstTime = {
              menuId: menu.menuId,
              menuName: menu.menuName,
              category: menu.category
            };
            break;
          case 'repeat':
            result.repeat = {
              menuId: menu.menuId,
              menuName: menu.menuName,
              category: menu.category
            };
            break;
          case 'ticket':
            result.tickets.push({
              menuId: menu.menuId,
              menuName: menu.menuName,
              ticketType: menu.ticketType,
              requiredTickets: menu.requiredTickets,
              category: menu.category
            });
            break;
        }
      });
      
      return result;
    } catch (error) {
      console.error('関連MenuID取得エラー:', error);
      return null;
    }
  }

  /**
   * 患者の履歴とチケット残高に基づいて適切なMenuIDを選択
   * @param {string} baseMenuId - 基本メニューID
   * @param {boolean} isFirstTime - 初回かどうか
   * @param {Object} ticketBalance - チケット残高
   * @returns {Array} 利用可能なMenuIDの配列
   */
  getAvailableMenuIds(baseMenuId, isFirstTime, ticketBalance = {}) {
    try {
      const menuGroup = this.getMenuIdsByBaseId(baseMenuId);
      if (!menuGroup) {
        return [];
      }
      
      const availableMenus = [];
      
      // 初回の場合
      if (isFirstTime && menuGroup.firstTime) {
        availableMenus.push({
          ...menuGroup.firstTime,
          menuType: 'first_time',
          canReserve: true,
          reason: '初回メニュー'
        });
      }
      
      // 2回目以降の場合
      if (!isFirstTime && menuGroup.repeat) {
        availableMenus.push({
          ...menuGroup.repeat,
          menuType: 'repeat',
          canReserve: true,
          reason: '通常メニュー'
        });
      }
      
      // チケット使用メニュー
      menuGroup.tickets.forEach(ticketMenu => {
        const ticketBalance_count = ticketBalance[ticketMenu.ticketType] || 0;
        const canReserve = ticketBalance_count >= ticketMenu.requiredTickets;
        
        availableMenus.push({
          ...ticketMenu,
          menuType: 'ticket',
          canReserve: canReserve,
          ticketBalance: ticketBalance_count,
          reason: canReserve ? 
            `チケット使用可能（残${ticketBalance_count}枚）` : 
            `チケット不足（必要${ticketMenu.requiredTickets}枚/残${ticketBalance_count}枚）`
        });
      });
      
      return availableMenus;
    } catch (error) {
      console.error('利用可能MenuID取得エラー:', error);
      return [];
    }
  }

  /**
   * 新しいメニューチケット関連付けを追加
   */
  addMenuTicketMapping(mappingData) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet(this.sheetName);
      
      const newRow = [
        mappingData.menuId,
        mappingData.baseMenuId,
        mappingData.menuName,
        mappingData.menuType,
        mappingData.ticketType || 'なし',
        mappingData.requiredTickets || 0,
        mappingData.category || '',
        mappingData.active !== false,
        new Date(),
        new Date()
      ];
      
      sheet.appendRow(newRow);
      
      return { success: true, menuId: mappingData.menuId };
    } catch (error) {
      console.error('メニューチケット関連付け追加エラー:', error);
      throw new Error('メニューチケット関連付けの追加に失敗しました');
    }
  }

  /**
   * メニューチケット関連付けを更新
   */
  updateMenuTicketMapping(menuId, updateData) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet(this.sheetName);
      const data = sheet.getDataRange().getValues();
      
      // 該当行を探す
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === menuId) {
          rowIndex = i + 1; // シートの行番号は1から始まる
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error('該当するMenuIDが見つかりません');
      }
      
      // データを更新
      if (updateData.menuName !== undefined) sheet.getRange(rowIndex, 3).setValue(updateData.menuName);
      if (updateData.menuType !== undefined) sheet.getRange(rowIndex, 4).setValue(updateData.menuType);
      if (updateData.ticketType !== undefined) sheet.getRange(rowIndex, 5).setValue(updateData.ticketType);
      if (updateData.requiredTickets !== undefined) sheet.getRange(rowIndex, 6).setValue(updateData.requiredTickets);
      if (updateData.category !== undefined) sheet.getRange(rowIndex, 7).setValue(updateData.category);
      if (updateData.active !== undefined) sheet.getRange(rowIndex, 8).setValue(updateData.active);
      sheet.getRange(rowIndex, 10).setValue(new Date()); // 更新日時
      
      return { success: true };
    } catch (error) {
      console.error('メニューチケット関連付け更新エラー:', error);
      throw new Error('メニューチケット関連付けの更新に失敗しました: ' + error.message);
    }
  }

  /**
   * 基本メニューIDの一覧を取得
   */
  getBaseMenuIds() {
    try {
      const mappings = this.getAllMappings();
      const baseMenuIds = new Set();
      
      mappings.forEach(mapping => {
        if (mapping.active && mapping.baseMenuId) {
          baseMenuIds.add(mapping.baseMenuId);
        }
      });
      
      return Array.from(baseMenuIds).sort();
    } catch (error) {
      console.error('基本MenuID一覧取得エラー:', error);
      return [];
    }
  }
}

// グローバル関数として公開
function initializeMenuTicketMappingSheet() {
  const service = new MenuTicketMappingService();
  return service.initializeMenuTicketMappingSheet();
}

function getAllMenuTicketMappings() {
  const service = new MenuTicketMappingService();
  return service.getAllMappings();
}

function getMenuIdsByBaseId(baseMenuId) {
  const service = new MenuTicketMappingService();
  return service.getMenuIdsByBaseId(baseMenuId);
}

function getAvailableMenuIds(baseMenuId, isFirstTime, ticketBalance) {
  const service = new MenuTicketMappingService();
  return service.getAvailableMenuIds(baseMenuId, isFirstTime, ticketBalance);
}

function addMenuTicketMapping(mappingData) {
  const service = new MenuTicketMappingService();
  return service.addMenuTicketMapping(mappingData);
}

function updateMenuTicketMapping(menuId, updateData) {
  const service = new MenuTicketMappingService();
  return service.updateMenuTicketMapping(menuId, updateData);
}

function getBaseMenuIds() {
  const service = new MenuTicketMappingService();
  return service.getBaseMenuIds();
}