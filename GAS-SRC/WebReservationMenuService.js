/**
 * Web予約メニュー管理サービス
 * カテゴリ階層とメニュー振り分けを管理
 */
class WebReservationMenuService {
  constructor() {
    this.sheetManager = new SpreadsheetManager();
  }

  /**
   * Webカテゴリ一覧を取得
   */
  getWebCategories() {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Web予約カテゴリ');
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        // ヘッダー行のみまたは空の場合、初期データを作成
        this.initializeWebCategories();
        return this.getWebCategories();
      }
      
      const headers = data[0];
      const categories = [];
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // IDが空の行はスキップ
        
        categories.push({
          id: row[0],
          name: row[1],
          parentId: row[2] || null,
          order: row[3] || 0,
          description: row[4] || '',
          menuCount: row[5] || 0,
          active: row[6] !== false,
          createdAt: row[7],
          updatedAt: row[8]
        });
      }
      
      return categories.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Webカテゴリ取得エラー:', error);
      throw new Error('Webカテゴリの取得に失敗しました');
    }
  }

  /**
   * Webカテゴリを初期化
   */
  initializeWebCategories() {
    const sheet = this.sheetManager.getOrCreateSheet('Web予約カテゴリ');
    
    // ヘッダー設定
    const headers = [
      'カテゴリID', 'カテゴリ名', '親カテゴリID', '表示順', 
      '説明', 'メニュー数', '有効フラグ', '作成日時', '更新日時'
    ];
    
    // 初期カテゴリデータ
    const initialCategories = [
      ['cat_001', '初回メニュー', null, 1, '初めてのお客様向けメニュー', 0, true, new Date(), new Date()],
      ['cat_002', '通常メニュー', 'cat_001', 1, '通常の施術メニュー', 0, true, new Date(), new Date()],
      ['cat_003', 'チケット付与メニュー', 'cat_001', 2, 'チケットが付与されるメニュー', 0, true, new Date(), new Date()],
      ['cat_004', '2回目以降メニュー', null, 2, 'リピーター向けメニュー', 0, true, new Date(), new Date()],
      ['cat_005', '通常メニュー', 'cat_004', 1, '通常の施術メニュー', 0, true, new Date(), new Date()],
      ['cat_006', 'チケットメニュー', 'cat_004', 2, 'チケット使用メニュー', 0, true, new Date(), new Date()],
      ['cat_007', '特別メニュー', null, 3, '期間限定・特別メニュー', 0, true, new Date(), new Date()]
    ];
    
    // データを書き込み
    const allData = [headers, ...initialCategories];
    sheet.clear();
    sheet.getRange(1, 1, allData.length, headers.length).setValues(allData);
    
    // ヘッダー行のフォーマット
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
  }

  /**
   * Webカテゴリを追加
   */
  addWebCategory(categoryData) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Web予約カテゴリ');
      const categories = this.getWebCategories();
      
      // 新しいIDを生成
      const maxId = categories.reduce((max, cat) => {
        const num = parseInt(cat.id.replace('cat_', ''));
        return num > max ? num : max;
      }, 0);
      const newId = `cat_${String(maxId + 1).padStart(3, '0')}`;
      
      // 新しいカテゴリデータ
      const newCategory = [
        newId,
        categoryData.name,
        categoryData.parentId || '',
        categoryData.order || categories.length + 1,
        categoryData.description || '',
        0, // メニュー数
        true, // 有効フラグ
        new Date(),
        new Date()
      ];
      
      // シートに追加
      sheet.appendRow(newCategory);
      
      return { success: true, id: newId };
    } catch (error) {
      console.error('Webカテゴリ追加エラー:', error);
      throw new Error('Webカテゴリの追加に失敗しました');
    }
  }

  /**
   * Webカテゴリを更新
   */
  updateWebCategory(categoryData) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Web予約カテゴリ');
      const data = sheet.getDataRange().getValues();
      
      // 該当行を探す
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === categoryData.id) {
          rowIndex = i + 1; // シートの行番号は1から始まる
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error('カテゴリが見つかりません');
      }
      
      // データを更新
      sheet.getRange(rowIndex, 2).setValue(categoryData.name);
      sheet.getRange(rowIndex, 3).setValue(categoryData.parentId || '');
      sheet.getRange(rowIndex, 4).setValue(categoryData.order);
      sheet.getRange(rowIndex, 5).setValue(categoryData.description || '');
      sheet.getRange(rowIndex, 7).setValue(categoryData.active);
      sheet.getRange(rowIndex, 9).setValue(new Date());
      
      return { success: true };
    } catch (error) {
      console.error('Webカテゴリ更新エラー:', error);
      throw new Error('Webカテゴリの更新に失敗しました');
    }
  }

  /**
   * Webカテゴリを削除
   */
  deleteWebCategory(categoryId) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Web予約カテゴリ');
      const data = sheet.getDataRange().getValues();
      
      // 該当行を探す
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === categoryId) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error('カテゴリが見つかりません');
      }
      
      // 子カテゴリがないか確認
      const hasChildren = data.some((row, i) => i > 0 && row[2] === categoryId);
      if (hasChildren) {
        throw new Error('子カテゴリが存在するため削除できません');
      }
      
      // 行を削除
      sheet.deleteRow(rowIndex);
      
      return { success: true };
    } catch (error) {
      console.error('Webカテゴリ削除エラー:', error);
      throw new Error('Webカテゴリの削除に失敗しました: ' + error.message);
    }
  }

  /**
   * Webメニュー一覧を取得
   */
  getWebMenus() {
    try {
      // MenuTicketMappingServiceから全メニューを取得
      const menuTicketService = new MenuTicketMappingService();
      const mappings = menuTicketService.getAllMappings();
      
      if (mappings.length > 0) {
        // MenuTicketMappingから取得
        return mappings.map(mapping => ({
          id: mapping.menuId,
          name: mapping.menuName,
          baseMenuId: mapping.baseMenuId,
          duration: 60, // デフォルト値
          price: 0, // デフォルト値
          category: mapping.category,
          menuType: mapping.menuType,
          ticketType: mapping.ticketType,
          requiredTickets: mapping.requiredTickets,
          description: '',
          active: mapping.active
        }));
      } else {
        // フォールバック: 従来の方法
        const menuService = new MenuService();
        const menus = menuService.getAllMenus();
        
        return menus.map(menu => ({
          id: menu['メニューID'] || menu['ID'],
          name: menu['メニュー名'],
          duration: menu['施術時間'] || 60,
          price: menu['金額'] || 0,
          category: menu['カテゴリ'],
          description: menu['説明文'] || '',
          active: menu['有効フラグ'] !== false
        }));
      }
    } catch (error) {
      console.error('Webメニュー取得エラー:', error);
      // エラーの場合はダミーデータを返す
      return [
        { 
          id: 'menu_hydra_001_first', 
          name: 'ハイドラフェイシャル（初回）', 
          baseMenuId: 'menu_hydra_001',
          duration: 60, 
          price: 15000, 
          category: '美容施術',
          menuType: 'first_time'
        },
        { 
          id: 'menu_hydra_001_repeat', 
          name: 'ハイドラフェイシャル（2回目以降）', 
          baseMenuId: 'menu_hydra_001',
          duration: 60, 
          price: 18000, 
          category: '美容施術',
          menuType: 'repeat'
        },
        { 
          id: 'menu_vitamin_001_first', 
          name: 'ビタミン点滴（初回）', 
          baseMenuId: 'menu_vitamin_001',
          duration: 30, 
          price: 8000, 
          category: '点滴',
          menuType: 'first_time'
        },
        { 
          id: 'menu_vitamin_001_repeat', 
          name: 'ビタミン点滴（2回目以降）', 
          baseMenuId: 'menu_vitamin_001',
          duration: 30, 
          price: 10000, 
          category: '点滴',
          menuType: 'repeat'
        },
        { 
          id: 'menu_vitamin_001_ticket', 
          name: 'ビタミン点滴（チケット使用）', 
          baseMenuId: 'menu_vitamin_001',
          duration: 30, 
          price: 0, 
          category: '点滴',
          menuType: 'ticket',
          ticketType: '点滴',
          requiredTickets: 1
        }
      ];
    }
  }

  /**
   * メニューとカテゴリの関連付けを保存
   */
  saveWebMenuAssignments(assignments) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Webメニュー割り当て');
      
      // ヘッダー設定
      const headers = ['カテゴリID', 'メニューID', '表示順', '作成日時'];
      
      // 既存データをクリア
      sheet.clear();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // ヘッダー行のフォーマット
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
      
      // データを整形
      const rows = [];
      Object.keys(assignments).forEach(categoryId => {
        const menuIds = assignments[categoryId];
        menuIds.forEach((menuId, index) => {
          rows.push([
            categoryId,
            menuId,
            index + 1,
            new Date()
          ]);
        });
      });
      
      // データを書き込み
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      
      // カテゴリのメニュー数を更新
      this.updateCategoryMenuCounts(assignments);
      
      return { success: true };
    } catch (error) {
      console.error('メニュー割り当て保存エラー:', error);
      throw new Error('メニュー割り当ての保存に失敗しました');
    }
  }

  /**
   * カテゴリのメニュー数を更新
   */
  updateCategoryMenuCounts(assignments) {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Web予約カテゴリ');
      const data = sheet.getDataRange().getValues();
      
      // 各カテゴリのメニュー数を更新
      for (let i = 1; i < data.length; i++) {
        const categoryId = data[i][0];
        const menuCount = assignments[categoryId] ? assignments[categoryId].length : 0;
        sheet.getRange(i + 1, 6).setValue(menuCount);
      }
    } catch (error) {
      console.error('カテゴリメニュー数更新エラー:', error);
    }
  }

  /**
   * メニューとカテゴリの関連付けを取得
   */
  getWebMenuAssignments() {
    try {
      const sheet = this.sheetManager.getOrCreateSheet('Webメニュー割り当て');
      const data = sheet.getDataRange().getValues();
      
      const assignments = {};
      
      // ヘッダー行をスキップ
      for (let i = 1; i < data.length; i++) {
        const categoryId = data[i][0];
        const menuId = data[i][1];
        
        if (!categoryId || !menuId) continue;
        
        if (!assignments[categoryId]) {
          assignments[categoryId] = [];
        }
        assignments[categoryId].push(menuId);
      }
      
      return assignments;
    } catch (error) {
      console.error('メニュー割り当て取得エラー:', error);
      return {};
    }
  }
}

// グローバル関数として公開
function getWebCategories() {
  const service = new WebReservationMenuService();
  return service.getWebCategories();
}

function addWebCategory(categoryData) {
  const service = new WebReservationMenuService();
  return service.addWebCategory(categoryData);
}

function updateWebCategory(categoryData) {
  const service = new WebReservationMenuService();
  return service.updateWebCategory(categoryData);
}

function deleteWebCategory(categoryId) {
  const service = new WebReservationMenuService();
  return service.deleteWebCategory(categoryId);
}

function getWebMenus() {
  const service = new WebReservationMenuService();
  return service.getWebMenus();
}

function saveWebMenuAssignments(assignments) {
  const service = new WebReservationMenuService();
  return service.saveWebMenuAssignments(assignments);
}

function getWebMenuAssignments() {
  const service = new WebReservationMenuService();
  return service.getWebMenuAssignments();
}