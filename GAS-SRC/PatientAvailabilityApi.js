/**
 * 患者別予約可能スロットAPI
 * 施術間隔、同日制約、部屋の空き状況を考慮した予約可能時間を返却する
 */

/**
 * 患者の予約可能スロットを取得
 * @param {Object} params - リクエストパラメータ
 * @param {string} params.visitorId - 患者ID
 * @param {string} params.menuId - メニューID
 * @param {string} params.date - 開始日（YYYY-MM-DD）
 * @param {number} params.dateRange - 日付範囲（日数、デフォルト7日）
 * @param {boolean} params.includeRoomInfo - 部屋情報を含めるか（デフォルトfalse）
 * @returns {Object} 予約可能スロット情報のレスポンス
 */
function getPatientAvailableSlots(params) {
  try {
    const { visitorId, menuId, date, dateRange, includeRoomInfo } = params;
    
    // 必須パラメータのチェック
    if (!visitorId) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '患者IDが指定されていません'
        }
      };
    }
    
    if (!menuId) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: 'メニューIDが指定されていません'
        }
      };
    }
    
    if (!date) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '日付が指定されていません'
        }
      };
    }
    
    // 日付の妥当性チェック
    const requestDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestDate < today) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_DATE',
          message: '過去の日付は指定できません'
        }
      };
    }
    
    // AvailabilityCheckServiceを使用してスロット情報を取得
    const availabilityCheckService = new AvailabilityCheckService();
    const availabilityData = availabilityCheckService.getAvailableSlots(
      visitorId,
      menuId,
      date,
      {
        dateRange: dateRange || 7,
        includeRoomInfo: includeRoomInfo || false
      }
    );
    
    // レスポンスの整形
    return {
      status: 'success',
      data: {
        visitor: {
          id: visitorId
        },
        menu: {
          id: availabilityData.menuId,
          name: availabilityData.menuName
        },
        dateRange: availabilityData.dateRange,
        totalAvailable: availabilityData.totalAvailable,
        constraints: availabilityData.constraints,
        slots: formatSlots(availabilityData.slots, includeRoomInfo)
      }
    };
    
  } catch (error) {
    console.error('予約可能スロット取得エラー:', error);
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: '予約可能スロットの取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * 複数患者の同時予約可能スロットを取得（ペア予約用）
 * @param {Object} params - リクエストパラメータ
 * @param {Array} params.visitors - 患者情報の配列 [{visitorId, menuId}]
 * @param {string} params.date - 開始日（YYYY-MM-DD）
 * @param {number} params.dateRange - 日付範囲（日数、デフォルト7日）
 * @returns {Object} 同時予約可能スロット情報のレスポンス
 */
function getPairAvailableSlots(params) {
  try {
    const { visitors, date, dateRange } = params;
    
    // 必須パラメータのチェック
    if (!visitors || !Array.isArray(visitors) || visitors.length < 2) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '2名以上の患者情報が必要です'
        }
      };
    }
    
    if (!date) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '日付が指定されていません'
        }
      };
    }
    
    // 各患者の予約可能スロットを取得
    const availabilityCheckService = new AvailabilityCheckService();
    const allSlots = {};
    
    for (const visitor of visitors) {
      const slots = availabilityCheckService.getAvailableSlots(
        visitor.visitorId,
        visitor.menuId,
        date,
        {
          dateRange: dateRange || 7,
          includeRoomInfo: true
        }
      );
      
      allSlots[visitor.visitorId] = slots;
    }
    
    // 共通の時間帯を見つける
    const commonSlots = findCommonSlots(allSlots);
    
    // ペア部屋の空き状況を確認
    const pairSlots = checkPairRoomAvailability(commonSlots);
    
    return {
      status: 'success',
      data: {
        visitors: visitors,
        dateRange: {
          from: date,
          to: calculateEndDate(date, dateRange || 7)
        },
        totalAvailable: pairSlots.length,
        slots: pairSlots
      }
    };
    
  } catch (error) {
    console.error('ペア予約可能スロット取得エラー:', error);
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'ペア予約可能スロットの取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * スロットデータのフォーマット
 * @param {Array} slots - スロット配列
 * @param {boolean} includeRoomInfo - 部屋情報を含めるか
 * @returns {Array} フォーマット済みスロット配列
 */
function formatSlots(slots, includeRoomInfo) {
  return slots.map(slot => {
    const formatted = {
      date: slot.date,
      time: slot.time,
      datetime: slot.datetime,
      available: slot.available
    };
    
    if (includeRoomInfo && slot.availableRooms) {
      formatted.rooms = slot.availableRooms.map(room => ({
        id: room.id,
        name: room.name,
        type: room.type
      }));
      formatted.roomCount = slot.availableRooms.length;
    }
    
    return formatted;
  });
}

/**
 * 共通の時間帯を見つける
 * @param {Object} allSlots - 各患者のスロット情報
 * @returns {Array} 共通スロット
 */
function findCommonSlots(allSlots) {
  const visitorIds = Object.keys(allSlots);
  if (visitorIds.length === 0) return [];
  
  // 最初の患者のスロットを基準にする
  const baseSlots = allSlots[visitorIds[0]].slots;
  
  return baseSlots.filter(baseSlot => {
    // 全ての患者で同じ時間が空いているかチェック
    return visitorIds.every(visitorId => {
      const visitorSlots = allSlots[visitorId].slots;
      return visitorSlots.some(slot => 
        slot.datetime === baseSlot.datetime && slot.available
      );
    });
  });
}

/**
 * ペア部屋の空き状況を確認
 * @param {Array} commonSlots - 共通スロット
 * @returns {Array} ペア部屋が利用可能なスロット
 */
function checkPairRoomAvailability(commonSlots) {
  const roomAvailabilityService = new RoomAvailabilityService();
  
  return commonSlots.filter(slot => {
    const pairRooms = roomAvailabilityService.checkPairRoomAvailability(
      slot.datetime,
      60 // デフォルト60分
    );
    
    if (pairRooms.available) {
      slot.pairRooms = pairRooms.rooms;
      return true;
    }
    
    return false;
  });
}

/**
 * 終了日を計算
 * @param {string} startDate - 開始日
 * @param {number} dateRange - 日数
 * @returns {string} 終了日
 */
function calculateEndDate(startDate, dateRange) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + dateRange - 1);
  return Utils.formatDate(endDate);
}

/**
 * PatientAvailabilityAPIのテスト関数
 */
function testPatientAvailabilityApi() {
  console.log('=== 患者別予約可能スロットAPIテスト開始 ===');
  
  // テストケース1: 単体予約
  const testRequest1 = {
    visitorId: '1001',
    menuId: 'MENU001',
    date: Utils.formatDate(new Date()),
    dateRange: 7,
    includeRoomInfo: true
  };
  
  console.log('テストケース1 - 単体予約:', testRequest1);
  const result1 = getPatientAvailableSlots(testRequest1);
  console.log('結果:', JSON.stringify(result1, null, 2));
  
  // テストケース2: ペア予約
  const testRequest2 = {
    visitors: [
      { visitorId: '1001', menuId: 'MENU001' },
      { visitorId: '1002', menuId: 'MENU002' }
    ],
    date: Utils.formatDate(new Date()),
    dateRange: 3
  };
  
  console.log('\nテストケース2 - ペア予約:', testRequest2);
  const result2 = getPairAvailableSlots(testRequest2);
  console.log('結果:', JSON.stringify(result2, null, 2));
  
  console.log('\n=== テスト完了 ===');
}