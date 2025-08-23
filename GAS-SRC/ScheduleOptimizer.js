/**
 * スケジュール最適化サービス
 * メニューの組み合わせ時間を最適化し、効率的なスケジュールを生成する
 */
class ScheduleOptimizer {
  
  constructor() {
    this.combinationRuleService = new CombinationRuleService();
    this.defaultCounselingDuration = 30; // カウンセリング時間（分）
    this.defaultPreparationTime = 10;   // 準備時間（分）
    this.defaultCleanupTime = 10;       // 片付け時間（分）
  }

  /**
   * メニューリストのスケジュールを最適化
   * @param {Array} menuList - メニューリスト
   * @param {Object} options - オプション設定
   * @returns {Object} 最適化されたスケジュール
   */
  optimizeSchedule(menuList, options = {}) {
    try {
      Logger.log(`スケジュール最適化開始: ${menuList.length}件のメニュー`);
      
      if (!menuList || menuList.length === 0) {
        return this._createEmptySchedule();
      }

      // 1. メニューの組み合わせ検証
      const validationResult = this._validateMenuCombination(menuList);
      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors,
          schedule: null
        };
      }

      // 2. 基本スケジュール作成
      const baseSchedule = this._createBaseSchedule(menuList);
      
      // 3. 縦並び最適化（順序と時間調整）
      const optimizedSchedule = this._applyVerticalOptimization(baseSchedule);
      
      // 4. カウンセリング最適化
      const finalSchedule = this._optimizeCounseling(optimizedSchedule);
      
      // 5. 時間帯の推奨を生成
      const timeSlotRecommendations = this._generateTimeSlotRecommendations(finalSchedule);
      
      Logger.log(`スケジュール最適化完了: ${finalSchedule.totalDuration}分 → ${finalSchedule.optimizedDuration}分`);
      
      return {
        success: true,
        schedule: finalSchedule,
        recommendations: timeSlotRecommendations,
        optimization: {
          timeSaved: finalSchedule.totalDuration - finalSchedule.optimizedDuration,
          efficiencyRate: Math.round((1 - finalSchedule.optimizedDuration / finalSchedule.totalDuration) * 100)
        }
      };
      
    } catch (error) {
      Logger.log(`スケジュール最適化エラー: ${error.toString()}`);
      return {
        success: false,
        error: error.message,
        schedule: null
      };
    }
  }

  /**
   * リアルタイム時間計算（メニュー選択時に使用）
   * @param {Array} selectedMenuIds - 選択されたメニューID配列
   * @param {Array} allMenus - 全メニューデータ
   * @returns {Object} 計算結果
   */
  calculateRealTimeDuration(selectedMenuIds, allMenus) {
    try {
      if (!selectedMenuIds || selectedMenuIds.length === 0) {
        return { totalDuration: 0, optimizedDuration: 0, details: [] };
      }

      const selectedMenus = allMenus.filter(menu => 
        selectedMenuIds.includes(menu.id || menu.menu_id)
      );

      const optimizedResult = this.optimizeSchedule(selectedMenus);
      
      if (optimizedResult.success) {
        return {
          totalDuration: optimizedResult.schedule.totalDuration,
          optimizedDuration: optimizedResult.schedule.optimizedDuration,
          timeSaved: optimizedResult.optimization.timeSaved,
          details: optimizedResult.schedule.items
        };
      } else {
        return {
          totalDuration: 0,
          optimizedDuration: 0,
          errors: optimizedResult.errors || [optimizedResult.error]
        };
      }
      
    } catch (error) {
      Logger.log(`リアルタイム時間計算エラー: ${error.toString()}`);
      return {
        totalDuration: 0,
        optimizedDuration: 0,
        error: error.message
      };
    }
  }

  /**
   * 基本スケジュールを作成
   * @private
   * @param {Array} menuList - メニューリスト
   * @returns {Object} 基本スケジュール
   */
  _createBaseSchedule(menuList) {
    let totalDuration = 0;
    const items = [];

    menuList.forEach((menu, index) => {
      const baseDuration = parseInt(menu.duration) || 60;
      const preparationTime = this.defaultPreparationTime;
      const cleanupTime = this.defaultCleanupTime;
      const counselingTime = this.defaultCounselingDuration;
      
      const itemDuration = baseDuration + preparationTime + cleanupTime + counselingTime;
      totalDuration += itemDuration;

      items.push({
        menuId: menu.id || menu.menu_id,
        name: menu.name || menu.display_name,
        category: this._getCategoryFromMenu(menu),
        baseDuration: baseDuration,
        preparationTime: preparationTime,
        cleanupTime: cleanupTime,
        counselingTime: counselingTime,
        totalDuration: itemDuration,
        order: index + 1,
        adjustments: []
      });
    });

    return {
      items: items,
      totalDuration: totalDuration,
      optimizedDuration: totalDuration
    };
  }

  /**
   * 縦並び最適化を適用
   * @private
   * @param {Object} baseSchedule - 基本スケジュール
   * @returns {Object} 最適化されたスケジュール
   */
  _applyVerticalOptimization(baseSchedule) {
    // CombinationRuleServiceの縦並び最適化を使用
    const optimizedResult = this.combinationRuleService.optimizeVerticalSchedule(
      baseSchedule.items.map(item => ({
        id: item.menuId,
        name: item.name,
        duration: item.baseDuration,
        category: item.category
      }))
    );

    // 結果をマージ
    const optimizedItems = baseSchedule.items.map((item, index) => {
      const optimizedItem = optimizedResult.menuList[index];
      if (optimizedItem) {
        const adjustment = optimizedItem.adjustment || 0;
        return {
          ...item,
          totalDuration: item.totalDuration + adjustment,
          adjustments: adjustment !== 0 ? [`時間調整: ${adjustment > 0 ? '+' : ''}${adjustment}分`] : [],
          optimized: true
        };
      }
      return item;
    });

    return {
      items: optimizedItems,
      totalDuration: baseSchedule.totalDuration,
      optimizedDuration: optimizedResult.optimizedDuration || baseSchedule.totalDuration
    };
  }

  /**
   * カウンセリング最適化
   * @private
   * @param {Object} schedule - スケジュール
   * @returns {Object} カウンセリング最適化されたスケジュール
   */
  _optimizeCounseling(schedule) {
    if (schedule.items.length <= 1) {
      return schedule;
    }

    // 2件目以降のカウンセリング時間を除去
    const optimizedItems = schedule.items.map((item, index) => {
      if (index > 0) {
        const counselingReduction = this.defaultCounselingDuration;
        return {
          ...item,
          counselingTime: 0,
          totalDuration: item.totalDuration - counselingReduction,
          adjustments: [
            ...item.adjustments,
            `カウンセリング重複除去: -${counselingReduction}分`
          ]
        };
      }
      return item;
    });

    const counselingReduction = (schedule.items.length - 1) * this.defaultCounselingDuration;
    
    return {
      items: optimizedItems,
      totalDuration: schedule.totalDuration,
      optimizedDuration: schedule.optimizedDuration - counselingReduction,
      counselingReduction: counselingReduction
    };
  }

  /**
   * 時間帯推奨を生成
   * @private
   * @param {Object} schedule - 最適化されたスケジュール
   * @returns {Array} 推奨時間帯配列
   */
  _generateTimeSlotRecommendations(schedule) {
    const totalMinutes = schedule.optimizedDuration;
    const recommendations = [];

    // 営業時間を設定（9:00-19:00と仮定）
    const openHour = 9;
    const closeHour = 19;
    const totalBusinessMinutes = (closeHour - openHour) * 60;

    if (totalMinutes > totalBusinessMinutes) {
      recommendations.push({
        type: 'warning',
        message: '営業時間内に収まりません。複数日に分けることをお勧めします。'
      });
      return recommendations;
    }

    // 推奨開始時間を計算
    const bufferMinutes = 30; // バッファ時間
    const latestStartHour = closeHour - Math.ceil((totalMinutes + bufferMinutes) / 60);
    
    for (let hour = openHour; hour <= latestStartHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = this._addMinutesToTime(startTime, totalMinutes);
      
      recommendations.push({
        type: 'recommendation',
        startTime: startTime,
        endTime: endTime,
        duration: totalMinutes,
        message: `${startTime}開始がおすすめです（${endTime}終了予定）`
      });
    }

    return recommendations;
  }

  /**
   * メニューの組み合わせを検証
   * @private
   * @param {Array} menuList - メニューリスト
   * @returns {Object} 検証結果
   */
  _validateMenuCombination(menuList) {
    const errors = [];

    // 横並びルールチェック
    for (let i = 0; i < menuList.length; i++) {
      for (let j = i + 1; j < menuList.length; j++) {
        const result = this.combinationRuleService.canCombineHorizontally(menuList[i], menuList[j]);
        if (!result.allowed) {
          errors.push(result.reason);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * メニューからカテゴリを取得
   * @private
   * @param {Object} menu - メニューオブジェクト
   * @returns {string} カテゴリ
   */
  _getCategoryFromMenu(menu) {
    // CombinationRuleServiceの同じメソッドを使用
    return this.combinationRuleService._getCategoryFromMenu(menu);
  }

  /**
   * 空のスケジュールを作成
   * @private
   * @returns {Object} 空のスケジュール
   */
  _createEmptySchedule() {
    return {
      success: true,
      schedule: {
        items: [],
        totalDuration: 0,
        optimizedDuration: 0
      },
      recommendations: [],
      optimization: {
        timeSaved: 0,
        efficiencyRate: 0
      }
    };
  }

  /**
   * 時刻に分を加算
   * @private
   * @param {string} time - 時刻（HH:MM形式）
   * @param {number} minutes - 加算する分
   * @returns {string} 加算後の時刻
   */
  _addMinutesToTime(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  /**
   * スケジュールの詳細レポートを生成
   * @param {Object} schedule - スケジュールオブジェクト
   * @returns {Object} 詳細レポート
   */
  generateDetailedReport(schedule) {
    if (!schedule || !schedule.items) {
      return { error: 'スケジュールデータが無効です' };
    }

    const report = {
      summary: {
        totalMenus: schedule.items.length,
        originalDuration: schedule.totalDuration,
        optimizedDuration: schedule.optimizedDuration,
        timeSaved: schedule.totalDuration - schedule.optimizedDuration,
        efficiencyRate: Math.round((1 - schedule.optimizedDuration / schedule.totalDuration) * 100)
      },
      breakdown: [],
      optimizations: []
    };

    // メニュー別詳細
    schedule.items.forEach((item, index) => {
      report.breakdown.push({
        order: index + 1,
        menuName: item.name,
        category: item.category,
        baseDuration: item.baseDuration,
        totalDuration: item.totalDuration,
        adjustments: item.adjustments || []
      });
    });

    // 最適化詳細
    if (schedule.counselingReduction) {
      report.optimizations.push({
        type: 'counseling',
        description: 'カウンセリング重複除去',
        timeSaved: schedule.counselingReduction
      });
    }

    const ivMenuCount = schedule.items.filter(item => item.category === 'iv').length;
    if (ivMenuCount > 1) {
      report.optimizations.push({
        type: 'iv_sequence',
        description: '点滴・注射連続時間調整',
        menuCount: ivMenuCount
      });
    }

    return report;
  }

  /**
   * スケジュールを時間軸で可視化
   * @param {Object} schedule - スケジュールオブジェクト
   * @param {string} startTime - 開始時刻（HH:MM形式）
   * @returns {Array} 時間軸データ
   */
  visualizeSchedule(schedule, startTime = '09:00') {
    if (!schedule || !schedule.items) {
      return [];
    }

    const timeline = [];
    let currentTime = startTime;

    schedule.items.forEach((item, index) => {
      const endTime = this._addMinutesToTime(currentTime, item.totalDuration);
      
      timeline.push({
        order: index + 1,
        menuName: item.name,
        startTime: currentTime,
        endTime: endTime,
        duration: item.totalDuration,
        category: item.category,
        adjustments: item.adjustments || []
      });

      currentTime = endTime;
    });

    return timeline;
  }
}