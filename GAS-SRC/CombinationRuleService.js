/**
 * メニュー組み合わせルール処理サービス
 * 横並び・縦並びのルールを管理し、検証・最適化を行う
 */
class CombinationRuleService {
  
  constructor() {
    this.horizontalRulesCache = null;
    this.verticalRulesCache = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5分
    this.cacheTimestamp = null;
  }

  /**
   * 横並びルール（同時間帯での組み合わせ）を取得
   * @returns {Array} 横並びルール配列
   */
  getHorizontalRules() {
    if (this._isCacheValid() && this.horizontalRulesCache) {
      return this.horizontalRulesCache;
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('横並びルール定義');
    
    if (!sheet) {
      Logger.log('横並びルール定義シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rules = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[1]) { // カテゴリ1, カテゴリ2が存在する場合
        rules.push({
          category1: row[0],
          category2: row[1],
          allowed: row[2] === '○',
          exceptionMenu: row[3] || '',
          exceptionCategory: row[4] || '',
          description: row[5] || '',
          updatedAt: row[7] || new Date()
        });
      }
    }

    this.horizontalRulesCache = rules;
    this.cacheTimestamp = Date.now();
    
    Logger.log(`横並びルール${rules.length}件を読み込みました`);
    return rules;
  }

  /**
   * 縦並びルール（連続施術の順序と時間調整）を取得
   * @returns {Array} 縦並びルール配列
   */
  getVerticalRules() {
    if (this._isCacheValid() && this.verticalRulesCache) {
      return this.verticalRulesCache;
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('縦並びルール定義');
    
    if (!sheet) {
      Logger.log('縦並びルール定義シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const rules = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[1]) { // カテゴリ, メニュー名が存在する場合
        rules.push({
          category: row[0],
          menuName: row[1],
          priority: row[2] || 999,
          basePrepTime: row[3] || 10,
          baseCleanupTime: row[4] || 10,
          firstAdjustment: row[5] || 0,
          middleAdjustment: row[6] || 0,
          lastAdjustment: row[7] || 0,
          description: row[8] || '',
          updatedAt: row[10] || new Date()
        });
      }
    }

    // 優先順位でソート
    rules.sort((a, b) => a.priority - b.priority);

    this.verticalRulesCache = rules;
    this.cacheTimestamp = Date.now();
    
    Logger.log(`縦並びルール${rules.length}件を読み込みました`);
    return rules;
  }

  /**
   * 2つのメニューが横並び（同時間帯）で組み合わせ可能かチェック
   * @param {Object} menu1 - メニュー1
   * @param {Object} menu2 - メニュー2
   * @returns {Object} 組み合わせ可否の結果
   */
  canCombineHorizontally(menu1, menu2) {
    const rules = this.getHorizontalRules();
    const cat1 = this._getCategoryFromMenu(menu1);
    const cat2 = this._getCategoryFromMenu(menu2);

    Logger.log(`横並び組み合わせチェック: ${menu1.name} (${cat1}) - ${menu2.name} (${cat2})`);

    // 基本ルールをチェック
    let baseRule = null;
    for (const rule of rules) {
      if ((rule.category1 === cat1 && rule.category2 === cat2) ||
          (rule.category1 === cat2 && rule.category2 === cat1)) {
        baseRule = rule;
        break;
      }
    }

    if (!baseRule) {
      return {
        allowed: false,
        reason: `${cat1}と${cat2}の組み合わせルールが定義されていません`,
        ruleType: 'missing'
      };
    }

    if (!baseRule.allowed) {
      return {
        allowed: false,
        reason: baseRule.description || `${cat1}と${cat2}の組み合わせは禁止されています`,
        ruleType: 'base_rule'
      };
    }

    // 例外チェック
    const exceptionCheck = this._checkExceptions(menu1, menu2, rules);
    if (!exceptionCheck.allowed) {
      return exceptionCheck;
    }

    return {
      allowed: true,
      reason: '組み合わせ可能です',
      ruleType: 'allowed'
    };
  }

  /**
   * メニューリストの縦並び（連続施術）を最適化
   * @param {Array} menuList - メニューリスト
   * @returns {Object} 最適化されたスケジュール
   */
  optimizeVerticalSchedule(menuList) {
    if (!menuList || menuList.length === 0) {
      return { menuList: [], totalDuration: 0, optimizedDuration: 0 };
    }

    const rules = this.getVerticalRules();
    
    Logger.log(`縦並び最適化開始: ${menuList.length}件のメニュー`);

    // 1. メニューを優先順位でソート
    const sortedMenus = this._sortMenusByPriority(menuList, rules);
    
    // 2. 時間調整を計算
    const optimizedSchedule = this._calculateOptimizedDuration(sortedMenus, rules);
    
    // 3. カウンセリング重複を除去
    const finalSchedule = this._removeDuplicateCounseling(optimizedSchedule);

    Logger.log(`最適化完了: ${finalSchedule.totalDuration}分 → ${finalSchedule.optimizedDuration}分`);

    return finalSchedule;
  }

  /**
   * メニューのカテゴリを判定
   * @private
   * @param {Object} menu - メニューオブジェクト
   * @returns {string} カテゴリ名
   */
  _getCategoryFromMenu(menu) {
    const menuName = menu.name || menu.display_name || '';
    const normalizedName = menuName.toLowerCase();

    // メニュー名から推定
    if (normalizedName.includes('幹細胞') || normalizedName.includes('点滴') || 
        normalizedName.includes('注射') || normalizedName.includes('nad')) {
      return 'iv';
    }
    
    if (normalizedName.includes('ハイフ') || normalizedName.includes('ボトックス') || 
        normalizedName.includes('美容') || normalizedName.includes('リフト')) {
      return 'beauty';
    }
    
    if (normalizedName.includes('水素')) {
      return 'hydrogen';
    }

    // メニューオブジェクトにカテゴリ情報がある場合
    if (menu.category) {
      return menu.category;
    }

    // デフォルト
    return 'other';
  }

  /**
   * 例外ルールをチェック
   * @private
   * @param {Object} menu1 - メニュー1
   * @param {Object} menu2 - メニュー2
   * @param {Array} rules - ルール配列
   * @returns {Object} チェック結果
   */
  _checkExceptions(menu1, menu2, rules) {
    const name1 = this._normalizeMenuName(menu1.name || menu1.display_name || '');
    const name2 = this._normalizeMenuName(menu2.name || menu2.display_name || '');
    const cat1 = this._getCategoryFromMenu(menu1);
    const cat2 = this._getCategoryFromMenu(menu2);

    for (const rule of rules) {
      if (rule.exceptionMenu && rule.exceptionCategory) {
        const exceptionName = this._normalizeMenuName(rule.exceptionMenu);
        
        // menu1が例外メニューで、menu2が例外対象カテゴリの場合
        if (name1.includes(exceptionName) && cat2 === rule.exceptionCategory) {
          return {
            allowed: false,
            reason: `${menu1.name}は${rule.exceptionCategory}カテゴリとの組み合わせが禁止されています`,
            ruleType: 'exception'
          };
        }
        
        // menu2が例外メニューで、menu1が例外対象カテゴリの場合
        if (name2.includes(exceptionName) && cat1 === rule.exceptionCategory) {
          return {
            allowed: false,
            reason: `${menu2.name}は${rule.exceptionCategory}カテゴリとの組み合わせが禁止されています`,
            ruleType: 'exception'
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * メニューを優先順位でソート
   * @private
   * @param {Array} menuList - メニューリスト
   * @param {Array} rules - 縦並びルール
   * @returns {Array} ソート済みメニューリスト
   */
  _sortMenusByPriority(menuList, rules) {
    return menuList.sort((a, b) => {
      const priorityA = this._getMenuPriority(a, rules);
      const priorityB = this._getMenuPriority(b, rules);
      return priorityA - priorityB;
    });
  }

  /**
   * メニューの優先順位を取得
   * @private
   * @param {Object} menu - メニューオブジェクト
   * @param {Array} rules - 縦並びルール
   * @returns {number} 優先順位
   */
  _getMenuPriority(menu, rules) {
    const menuName = this._normalizeMenuName(menu.name || menu.display_name || '');
    const category = this._getCategoryFromMenu(menu);

    for (const rule of rules) {
      if (rule.category === category) {
        if (rule.menuName === 'その他点滴・注射' || rule.menuName === '全美容施術') {
          return rule.priority;
        }
        if (menuName.includes(this._normalizeMenuName(rule.menuName))) {
          return rule.priority;
        }
      }
    }

    return 999; // デフォルト優先順位
  }

  /**
   * 最適化された所要時間を計算
   * @private
   * @param {Array} sortedMenus - ソート済みメニューリスト
   * @param {Array} rules - 縦並びルール
   * @returns {Object} 計算結果
   */
  _calculateOptimizedDuration(sortedMenus, rules) {
    let totalDuration = 0;
    let optimizedDuration = 0;
    const schedule = [];

    const ivMenus = sortedMenus.filter(menu => this._getCategoryFromMenu(menu) === 'iv');

    sortedMenus.forEach((menu, index) => {
      const baseDuration = menu.duration || 60; // デフォルト60分
      let adjustedDuration = baseDuration;
      
      totalDuration += baseDuration;

      // 点滴・注射の連続調整
      if (this._getCategoryFromMenu(menu) === 'iv' && ivMenus.length > 1) {
        const ivIndex = ivMenus.findIndex(iv => iv.id === menu.id);
        const adjustment = this._getTimeAdjustment(ivIndex, ivMenus.length, rules);
        adjustedDuration += adjustment;
      }

      optimizedDuration += adjustedDuration;
      
      schedule.push({
        ...menu,
        originalDuration: baseDuration,
        adjustedDuration: adjustedDuration,
        adjustment: adjustedDuration - baseDuration
      });
    });

    return {
      menuList: schedule,
      totalDuration: totalDuration,
      optimizedDuration: Math.max(optimizedDuration, 0) // 負の値にならないように
    };
  }

  /**
   * 時間調整値を取得
   * @private
   * @param {number} index - IV内でのインデックス
   * @param {number} totalIvCount - IV総数
   * @param {Array} rules - 縦並びルール
   * @returns {number} 調整時間（分）
   */
  _getTimeAdjustment(index, totalIvCount, rules) {
    // IVカテゴリのルールを取得
    const ivRule = rules.find(rule => rule.category === 'iv');
    if (!ivRule) return 0;

    if (totalIvCount === 1) {
      return 0; // 1つだけの場合は調整なし
    }

    if (index === 0) {
      return ivRule.firstAdjustment || -10; // 最初
    } else if (index === totalIvCount - 1) {
      return ivRule.lastAdjustment || -10; // 最後
    } else {
      return ivRule.middleAdjustment || -20; // 中間
    }
  }

  /**
   * カウンセリングの重複を除去
   * @private
   * @param {Object} schedule - スケジュールオブジェクト
   * @returns {Object} 重複除去後のスケジュール
   */
  _removeDuplicateCounseling(schedule) {
    if (schedule.menuList.length <= 1) {
      return schedule;
    }

    // カウンセリング時間を30分と仮定
    const counselingDuration = 30;
    const duplicateCount = schedule.menuList.length - 1;
    const counselingReduction = counselingDuration * duplicateCount;

    return {
      ...schedule,
      optimizedDuration: schedule.optimizedDuration - counselingReduction,
      counselingReduction: counselingReduction
    };
  }

  /**
   * メニュー名を正規化（初回/2回目を除去）
   * @private
   * @param {string} menuName - メニュー名
   * @returns {string} 正規化されたメニュー名
   */
  _normalizeMenuName(menuName) {
    return menuName
      .replace(/【初回】/g, '')
      .replace(/【2回目以降】/g, '')
      .replace(/（初回）/g, '')
      .replace(/（2回目以降）/g, '')
      .replace(/\s+/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * キャッシュが有効かチェック
   * @private
   * @returns {boolean} キャッシュの有効性
   */
  _isCacheValid() {
    return this.cacheTimestamp && 
           (Date.now() - this.cacheTimestamp < this.cacheExpiry);
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.horizontalRulesCache = null;
    this.verticalRulesCache = null;
    this.cacheTimestamp = null;
    Logger.log('CombinationRuleService: キャッシュをクリアしました');
  }

  /**
   * 組み合わせ可能なメニューを取得
   * @param {Array} selectedMenuIds - 既に選択されているメニューID配列
   * @param {Array} allMenus - 全メニュー配列
   * @returns {Array} 組み合わせ可能なメニュー配列
   */
  getCompatibleMenus(selectedMenuIds, allMenus) {
    if (!selectedMenuIds || selectedMenuIds.length === 0) {
      return allMenus; // 何も選択されていない場合は全メニューを返す
    }

    const selectedMenus = allMenus.filter(menu => 
      selectedMenuIds.includes(menu.id || menu.menu_id)
    );

    const compatibleMenus = [];

    for (const menu of allMenus) {
      if (selectedMenuIds.includes(menu.id || menu.menu_id)) {
        continue; // 既に選択済みの場合はスキップ
      }

      let compatible = true;
      
      for (const selectedMenu of selectedMenus) {
        const result = this.canCombineHorizontally(selectedMenu, menu);
        if (!result.allowed) {
          compatible = false;
          break;
        }
      }

      if (compatible) {
        compatibleMenus.push(menu);
      }
    }

    Logger.log(`組み合わせ可能メニュー: ${compatibleMenus.length}件`);
    return compatibleMenus;
  }
}