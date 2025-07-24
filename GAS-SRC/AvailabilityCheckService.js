/**
 * 予約可能スロット総合チェックサービス
 * 施術間隔、同日2回制約、部屋の空き状況を総合的にチェックする
 */
class AvailabilityCheckService {
  constructor() {
    this.apiClient = new ApiClient();
    this.reservationService = new ReservationService();
    this.reservationValidationService = new ReservationValidationService();
    this.roomAvailabilityService = new RoomAvailabilityService();
    this.treatmentIntervalService = new TreatmentIntervalService();
    this.spreadsheetManager = new SpreadsheetManager();
  }

  /**
   * 患者の予約可能スロットを取得
   * @param {string} visitorId - 患者ID
   * @param {string} menuId - メニューID
   * @param {string} date - 開始日（YYYY-MM-DD）
   * @param {Object} options - オプション設定
   * @returns {Object} 予約可能スロット情報
   */
  getAvailableSlots(visitorId, menuId, date, options = {}) {
    try {
      Logger.log(`予約可能スロット取得開始: visitor=${visitorId}, menu=${menuId}, date=${date}`);
      
      // オプションのデフォルト値設定
      const dateRange = options.dateRange || 7;
      const includeRoomInfo = options.includeRoomInfo || false;
      
      // 1. メニュー情報を取得
      const menuInfo = this.getMenuInfo(menuId);
      if (!menuInfo) {
        throw new Error(`メニューID ${menuId} が見つかりません`);
      }
      
      // 2. 日付範囲を計算
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + dateRange - 1);
      
      // 3. Medical Force APIから基本的な空き時間を取得
      const timeSpacing = options.timeSpacing || 5; // デフォルト5分間隔
      const apiVacancies = this.getApiVacancies(menuId, startDate, endDate, timeSpacing);
      
      // 4. 患者の予約履歴を取得（過去6ヶ月と未来の予約）
      const patientHistory = this.getPatientReservationHistory(visitorId);
      
      // 5. 施術間隔チェック
      const intervalFiltered = this.filterByTreatmentInterval(
        apiVacancies,
        patientHistory,
        menuId,
        menuInfo['メニュー名']
      );
      
      // 6. 同日2回予約チェック
      const sameDayFiltered = this.filterBySameDayConstraint(
        intervalFiltered,
        patientHistory,
        menuId
      );
      
      // 7. 部屋の空き状況でフィルタリング（必要な場合）
      let finalSlots = sameDayFiltered;
      if (includeRoomInfo) {
        finalSlots = this.filterByRoomAvailability(
          sameDayFiltered,
          menuInfo,
          startDate,
          endDate
        );
      }
      
      return {
        visitorId: visitorId,
        menuId: menuId,
        menuName: menuInfo['メニュー名'],
        dateRange: {
          from: Utils.formatDate(startDate),
          to: Utils.formatDate(endDate)
        },
        slots: finalSlots,
        totalAvailable: finalSlots.length,
        constraints: {
          treatmentInterval: this.getAppliedIntervalConstraints(patientHistory, menuId),
          sameDayRestriction: true
        }
      };
      
    } catch (error) {
      Logger.log(`予約可能スロット取得エラー: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * メニュー情報を取得
   * @param {string} menuId - メニューID
   * @returns {Object} メニュー情報
   */
  getMenuInfo(menuId) {
    const menus = SpreadsheetManager.getSheetData(Config.getSheetNames().menus);
    return menus.find(menu => menu['メニューID'] === menuId);
  }

  /**
   * Medical Force APIから空き時間を取得
   * @param {string} menuId - メニューID
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @param {number} timeSpacing - 時間間隔（分）
   * @returns {Array} 空き時間スロット
   */
  getApiVacancies(menuId, startDate, endDate, timeSpacing = 5) {
    Logger.log(`API空き時間取得: ${Utils.formatDate(startDate)} - ${Utils.formatDate(endDate)} (${timeSpacing}分間隔)`);
    
    // POST方式で空き時間を取得
    const response = this.apiClient.postVacancies({
      epoch_from_keydate: Utils.formatDate(startDate),
      epoch_to_keydate: Utils.formatDate(endDate),
      time_spacing: String(timeSpacing), // 文字列として送信
      menus: [{
        menu_id: menuId
      }]
    });
    
    if (!response.success || !response.data) {
      throw new Error('空き時間の取得に失敗しました');
    }
    
    // レスポンスをスロット配列に変換
    const slots = [];
    Object.entries(response.data).forEach(([date, times]) => {
      Object.entries(times).forEach(([time, status]) => {
        if (status === 'ok') {
          slots.push({
            date: date,
            time: time,
            datetime: `${date}T${time}:00`,
            available: true,
            duration: timeSpacing // 所要時間として使用
          });
        }
      });
    });
    
    return slots;
  }

  /**
   * 患者の予約履歴を取得
   * @param {string} visitorId - 患者ID
   * @returns {Array} 予約履歴
   */
  getPatientReservationHistory(visitorId) {
    const reservations = SpreadsheetManager.getSheetData(Config.getSheetNames().reservations);
    
    // 過去6ヶ月の日付を計算
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // 患者の予約をフィルタリング（過去6ヶ月と未来の予約）
    return reservations.filter(reservation => {
      if (reservation['患者ID'] !== visitorId) return false;
      
      const reservationDate = new Date(reservation['予約日時']);
      
      // 未来の予約または過去6ヶ月以内の完了済み予約
      return reservationDate > new Date() || 
             (reservationDate >= sixMonthsAgo && reservation['ステータス'] === '完了');
    });
  }

  /**
   * 施術間隔制約でフィルタリング
   * @param {Array} slots - 空きスロット
   * @param {Array} patientHistory - 患者の予約履歴
   * @param {string} menuId - メニューID
   * @param {string} menuName - メニュー名
   * @returns {Array} フィルタリング後のスロット
   */
  filterByTreatmentInterval(slots, patientHistory, menuId, menuName) {
    Logger.log('施術間隔チェック開始');
    
    // 施術間隔定義を取得
    const intervalRules = this.treatmentIntervalService.getIntervalRules();
    
    return slots.filter(slot => {
      const slotDate = new Date(slot.datetime);
      
      // 各履歴に対して間隔をチェック
      for (const history of patientHistory) {
        const historyDate = new Date(history['予約日時']);
        const historyMenuId = history['メニューID'];
        const historyMenuName = history['メニュー名'];
        
        // 同じメニューまたは関連するメニューの間隔をチェック
        const requiredInterval = this.getRequiredInterval(
          historyMenuId || historyMenuName,
          menuId || menuName,
          intervalRules
        );
        
        if (requiredInterval > 0) {
          const daysDiff = Math.floor((slotDate - historyDate) / (1000 * 60 * 60 * 24));
          
          if (Math.abs(daysDiff) < requiredInterval) {
            Logger.log(`施術間隔制約により除外: ${slot.datetime} (必要間隔: ${requiredInterval}日)`);
            return false;
          }
        }
      }
      
      return true;
    });
  }

  /**
   * 必要な施術間隔を取得
   * @param {string} fromMenu - 元のメニュー
   * @param {string} toMenu - 次のメニュー
   * @param {Object} intervalRules - 間隔ルール
   * @returns {number} 必要な間隔日数
   */
  getRequiredInterval(fromMenu, toMenu, intervalRules) {
    // 間隔ルールから該当する制約を検索
    const key1 = `${fromMenu}→${toMenu}`;
    const key2 = `${toMenu}→${fromMenu}`; // 双方向チェック
    
    return intervalRules[key1] || intervalRules[key2] || 0;
  }

  /**
   * 同日2回予約制約でフィルタリング
   * @param {Array} slots - 空きスロット
   * @param {Array} patientHistory - 患者の予約履歴
   * @param {string} menuId - メニューID
   * @returns {Array} フィルタリング後のスロット
   */
  filterBySameDayConstraint(slots, patientHistory, menuId) {
    Logger.log('同日2回予約制約チェック開始');
    
    return slots.filter(slot => {
      const slotDate = new Date(slot.date);
      
      // 同じ日の同じメニューの予約をチェック
      const sameDayReservations = patientHistory.filter(res => {
        const resDate = new Date(res['予約日時']);
        return resDate.toDateString() === slotDate.toDateString() &&
               res['メニューID'] === menuId &&
               res['ステータス'] !== 'キャンセル';
      });
      
      if (sameDayReservations.length > 0) {
        Logger.log(`同日2回予約制約により除外: ${slot.datetime}`);
        return false;
      }
      
      return true;
    });
  }

  /**
   * 部屋の空き状況でフィルタリング
   * @param {Array} slots - 空きスロット
   * @param {Object} menuInfo - メニュー情報
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @returns {Array} フィルタリング後のスロット
   */
  filterByRoomAvailability(slots, menuInfo, startDate, endDate) {
    Logger.log('部屋空き状況チェック開始');
    
    // メニューに必要な部屋タイプを判定
    const requiredRoomType = this.determineRequiredRoomType(menuInfo);
    
    return slots.map(slot => {
      // 各スロットで利用可能な部屋を確認
      const availableRooms = this.roomAvailabilityService.getAvailableRooms(
        slot.datetime,
        menuInfo['所要時間'] || 60,
        requiredRoomType
      );
      
      return {
        ...slot,
        availableRooms: availableRooms,
        hasAvailableRoom: availableRooms.length > 0
      };
    }).filter(slot => slot.hasAvailableRoom);
  }

  /**
   * メニューに必要な部屋タイプを判定
   * @param {Object} menuInfo - メニュー情報
   * @returns {Object} 必要な部屋タイプ
   */
  determineRequiredRoomType(menuInfo) {
    const category = menuInfo['カテゴリ'] || '';
    const menuName = menuInfo['メニュー名'] || '';
    
    // カテゴリやメニュー名から部屋タイプを判定
    if (category.includes('点滴') || menuName.includes('点滴')) {
      return { canIV: true };
    }
    
    if (category.includes('施術') || menuName.includes('施術')) {
      return { canTreatment: true };
    }
    
    // デフォルトは全ての部屋
    return {};
  }

  /**
   * 適用された間隔制約を取得
   * @param {Array} patientHistory - 患者の予約履歴
   * @param {string} menuId - メニューID
   * @returns {Array} 適用された制約のリスト
   */
  getAppliedIntervalConstraints(patientHistory, menuId) {
    const constraints = [];
    const intervalRules = this.treatmentIntervalService.getIntervalRules();
    
    patientHistory.forEach(history => {
      const interval = this.getRequiredInterval(
        history['メニューID'] || history['メニュー名'],
        menuId,
        intervalRules
      );
      
      if (interval > 0) {
        constraints.push({
          fromMenu: history['メニュー名'],
          toMenu: menuId,
          requiredDays: interval,
          lastDate: history['予約日時']
        });
      }
    });
    
    return constraints;
  }
  
  /**
   * 複数人予約の空き状況を取得
   * @param {Array} visitors - 来院者情報の配列 [{visitorId, menuId}]
   * @param {string} date - 開始日（YYYY-MM-DD）
   * @param {Object} options - オプション設定
   * @returns {Object} 複数人で予約可能なスロット情報
   */
  getMultipleVisitorsAvailableSlots(visitors, date, options = {}) {
    try {
      Logger.log(`複数人予約の空き状況取得開始: ${visitors.length}名`);
      
      // オプションのデフォルト値設定
      const dateRange = options.dateRange || 7;
      const timeSpacing = options.timeSpacing || 5;
      
      // 各患者の個別空き状況を取得
      const individualSlots = {};
      visitors.forEach(visitor => {
        const slots = this.getAvailableSlots(
          visitor.visitorId,
          visitor.menuId,
          date,
          { ...options, timeSpacing }
        );
        individualSlots[visitor.visitorId] = slots;
      });
      
      // 共通の時間帯を見つける
      const commonSlots = this.findCommonSlots(individualSlots);
      
      // ペア予約の場合は部屋の隣接チェック
      if (options.pairBooking && visitors.length === 2) {
        return this.filterPairBookingSlots(commonSlots, visitors);
      }
      
      // 複数人予約の場合は部屋とスタッフの空き状況を確認
      return this.filterMultipleBookingSlots(commonSlots, visitors);
      
    } catch (error) {
      Logger.log(`複数人予約空き状況取得エラー: ${error.toString()}`);
      throw error;
    }
  }
  
  /**
   * 共通の予約可能時間を見つける
   * @param {Object} individualSlots - 各患者の空きスロット
   * @returns {Array} 共通スロット
   */
  findCommonSlots(individualSlots) {
    const visitorIds = Object.keys(individualSlots);
    if (visitorIds.length === 0) return [];
    
    // 最初の患者のスロットを基準にする
    const baseSlots = individualSlots[visitorIds[0]].slots || [];
    
    return baseSlots.filter(baseSlot => {
      // 全ての患者で同じ時間が空いているかチェック
      return visitorIds.every(visitorId => {
        const visitorSlots = individualSlots[visitorId].slots || [];
        return visitorSlots.some(slot => 
          slot.datetime === baseSlot.datetime && slot.available
        );
      });
    });
  }
  
  /**
   * ペア予約可能なスロットをフィルタリング
   * @param {Array} commonSlots - 共通スロット
   * @param {Array} visitors - 来院者情報
   * @returns {Array} ペア予約可能なスロット
   */
  filterPairBookingSlots(commonSlots, visitors) {
    Logger.log('ペア予約の部屋チェック開始');
    
    return commonSlots.filter(slot => {
      // 隣接する部屋が空いているかチェック
      const pairRooms = this.roomAvailabilityService.checkPairRoomAvailability(
        slot.datetime,
        slot.duration || 60
      );
      
      if (pairRooms.available) {
        slot.pairRooms = pairRooms.rooms;
        slot.pairAvailable = true;
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * 複数人予約可能なスロットをフィルタリング
   * @param {Array} commonSlots - 共通スロット
   * @param {Array} visitors - 来院者情報
   * @returns {Array} 複数人予約可能なスロット
   */
  filterMultipleBookingSlots(commonSlots, visitors) {
    Logger.log('複数人予約の部屋・スタッフチェック開始');
    
    return commonSlots.map(slot => {
      // 必要な部屋数を計算
      const requiredRoomCount = visitors.length;
      
      // 利用可能な部屋を取得
      const availableRooms = this.roomAvailabilityService.getAvailableRooms(
        slot.datetime,
        slot.duration || 60
      );
      
      // スタッフの空き状況を確認
      const availableStaff = this.getAvailableStaff(slot.datetime, slot.duration || 60);
      
      // 予約可能かチェック
      const canBook = availableRooms.length >= requiredRoomCount && 
                     availableStaff.length >= requiredRoomCount;
      
      return {
        ...slot,
        availableRooms: availableRooms.slice(0, requiredRoomCount),
        availableStaff: availableStaff.slice(0, requiredRoomCount),
        canBookMultiple: canBook,
        requiredResources: {
          rooms: requiredRoomCount,
          staff: requiredRoomCount
        }
      };
    }).filter(slot => slot.canBookMultiple);
  }
  
  /**
   * 利用可能なスタッフを取得
   * @param {string} datetime - 日時
   * @param {number} duration - 所要時間（分）
   * @returns {Array} 利用可能なスタッフリスト
   */
  getAvailableStaff(datetime, duration) {
    // スタッフ管理シートから情報を取得
    const staffData = SpreadsheetManager.getSheetData(Config.getSheetNames().staff);
    const reservations = SpreadsheetManager.getSheetData(Config.getSheetNames().reservations);
    
    const startTime = new Date(datetime);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    // 各スタッフの空き状況をチェック
    return staffData.filter(staff => {
      if (!staff['有効フラグ']) return false;
      
      // 該当時間帯の予約を確認
      const staffReservations = reservations.filter(res => {
        if (res['スタッフID'] !== staff['スタッフID']) return false;
        
        const resStart = new Date(res['予約日時']);
        const resEnd = new Date(resStart.getTime() + (res['所要時間'] || 60) * 60000);
        
        // 時間が重なるかチェック
        return !(resEnd <= startTime || resStart >= endTime);
      });
      
      return staffReservations.length === 0;
    });
  }
}

/**
 * AvailabilityCheckServiceのテスト関数
 */
function testAvailabilityCheckService() {
  Logger.log('=== AvailabilityCheckService テスト開始 ===');
  
  const service = new AvailabilityCheckService();
  
  try {
    // テストデータ
    const visitorId = '1001';
    const menuId = 'MENU001';
    const date = Utils.formatDate(new Date());
    
    const result = service.getAvailableSlots(visitorId, menuId, date, {
      dateRange: 7,
      includeRoomInfo: true
    });
    
    Logger.log('取得結果:');
    Logger.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    Logger.log('テストエラー: ' + error.toString());
  }
  
  Logger.log('=== テスト完了 ===');
}