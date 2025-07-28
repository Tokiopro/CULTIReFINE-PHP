/**
 * 部屋空き状況確認サービス
 * 予約タイプ別の空き状況を確認
 */
class RoomAvailabilityService {
  constructor() {
    this.sheetNames = Config.getSheetNames();
    this.apiClient = new ApiClient();
    this.reservationService = new ReservationService();
  }
  
  /**
   * 単体予約の空き時間を確認
   * @param {object} params - {date_from, date_to, menuId, duration}
   * @return {array} 空き時間リスト
   */
  checkSingleRoomAvailability(params) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`単体予約の空き確認: ${JSON.stringify(params)}`);
      
      // APIから空き時間を取得
      const vacancies = this.reservationService.getVacancies({
        epoch_from_keydate: params.date_from,
        epoch_to_keydate: params.date_to,
        time_spacing: '30'
      });
      
      if (!vacancies || !vacancies.length) {
        return [];
      }
      
      // メニューに必要な部屋タイプを確認
      const roomRequirements = this._getMenuRoomRequirements(params.menuId);
      
      // 利用可能な部屋を取得
      const availableRooms = this._getAvailableRooms(roomRequirements);
      
      // 空き時間をフィルタリング
      return vacancies.filter(vacancy => {
        // 各空き時間に対して、利用可能な部屋があるかチェック
        return this._hasAvailableRoom(vacancy, availableRooms, params.duration);
      });
    }, '単体予約空き確認');
  }
  
  /**
   * ペア部屋の空き時間を確認
   * @param {object} params - {date_from, date_to, menuIds, visitors}
   * @return {array} 空き時間リスト
   */
  checkPairRoomAvailability(params) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`ペア部屋の空き確認: ${JSON.stringify(params)}`);
      
      // 部屋管理シートからペア部屋情報を取得
      const pairRooms = this._getPairRooms();
      
      if (!pairRooms || pairRooms.length === 0) {
        Logger.log('ペア部屋が設定されていません');
        return [];
      }
      
      // APIから空き時間を取得
      const vacancies = this.reservationService.getVacancies({
        epoch_from_keydate: params.date_from,
        epoch_to_keydate: params.date_to,
        time_spacing: '30'
      });
      
      if (!vacancies || !vacancies.length) {
        return [];
      }
      
      // 各メニューの部屋要件を確認
      const menuRequirements = params.menuIds.map(menuId => ({
        menuId: menuId,
        requirements: this._getMenuRoomRequirements(menuId)
      }));
      
      // 空き時間をフィルタリング
      const availableSlots = [];
      
      vacancies.forEach(vacancy => {
        // 各ペア部屋グループをチェック
        pairRooms.forEach(pairGroup => {
          const canAccommodate = this._checkPairRoomAccommodation(
            pairGroup,
            menuRequirements,
            vacancy
          );
          
          if (canAccommodate) {
            availableSlots.push({
              ...vacancy,
              pairGroupId: pairGroup.groupId,
              rooms: pairGroup.rooms
            });
          }
        });
      });
      
      return availableSlots;
    }, 'ペア部屋空き確認');
  }
  
  /**
   * 複数人同時予約の空き時間を確認
   * @param {object} params - {date_from, date_to, menuIds, visitorCount}
   * @return {array} 空き時間リスト
   */
  checkMultipleRoomAvailability(params) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`複数人同時予約の空き確認: ${JSON.stringify(params)}`);
      
      // APIから空き時間を取得
      const vacancies = this.reservationService.getVacancies({
        epoch_from_keydate: params.date_from,
        epoch_to_keydate: params.date_to,
        time_spacing: '30'
      });
      
      if (!vacancies || !vacancies.length) {
        return [];
      }
      
      // 各メニューの部屋要件を集計
      const totalRequirements = this._aggregateRoomRequirements(params.menuIds);
      
      // 利用可能な部屋を取得
      const allRooms = this._getAllRooms();
      
      // 空き時間をフィルタリング
      const availableSlots = [];
      
      vacancies.forEach(vacancy => {
        // 必要な部屋の組み合わせを探す
        const roomCombination = this._findRoomCombination(
          allRooms,
          totalRequirements,
          vacancy,
          params.visitorCount
        );
        
        if (roomCombination) {
          availableSlots.push({
            ...vacancy,
            rooms: roomCombination
          });
        }
      });
      
      return availableSlots;
    }, '複数人同時予約空き確認');
  }
  
  /**
   * メニューに必要な部屋タイプを取得（内部メソッド）
   */
  _getMenuRoomRequirements(menuId) {
    // メニュー管理シートから情報を取得
    const menuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.menus);
    if (!menuSheet) {
      return { needsTreatment: true, needsIV: false };
    }
    
    const data = menuSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === menuId) {
        // カテゴリから判断（仮実装）
        const category = data[i][2];
        return {
          needsTreatment: !category || !category.includes('点滴'),
          needsIV: category && category.includes('点滴')
        };
      }
    }
    
    return { needsTreatment: true, needsIV: false };
  }
  
  /**
   * 利用可能な部屋を取得（内部メソッド）
   */
  _getAvailableRooms(requirements) {
    const roomSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.roomManagement);
    if (!roomSheet || roomSheet.getLastRow() <= 1) {
      return [];
    }
    
    const data = roomSheet.getDataRange().getValues();
    const availableRooms = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const canTreatment = row[2] === 'TRUE';
      const canIV = row[3] === 'TRUE';
      const isActive = row[6] === 'TRUE';
      
      if (isActive) {
        if ((requirements.needsTreatment && canTreatment) ||
            (requirements.needsIV && canIV)) {
          availableRooms.push({
            roomId: row[0],
            roomName: row[1],
            canTreatment: canTreatment,
            canIV: canIV,
            pairGroupId: row[4],
            maxCapacity: parseInt(row[5]) || 1
          });
        }
      }
    }
    
    return availableRooms;
  }
  
  /**
   * ペア部屋情報を取得（内部メソッド）
   */
  _getPairRooms() {
    const roomSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.roomManagement);
    if (!roomSheet || roomSheet.getLastRow() <= 1) {
      return [];
    }
    
    const data = roomSheet.getDataRange().getValues();
    const pairGroups = new Map();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const pairGroupId = row[4];
      const isActive = row[6] === 'TRUE';
      
      if (pairGroupId && isActive) {
        if (!pairGroups.has(pairGroupId)) {
          pairGroups.set(pairGroupId, {
            groupId: pairGroupId,
            rooms: []
          });
        }
        
        pairGroups.get(pairGroupId).rooms.push({
          roomId: row[0],
          roomName: row[1],
          canTreatment: row[2] === 'TRUE',
          canIV: row[3] === 'TRUE'
        });
      }
    }
    
    // ペアになっている部屋のみ返す（2部屋以上）
    return Array.from(pairGroups.values()).filter(group => group.rooms.length >= 2);
  }
  
  /**
   * すべての部屋を取得（内部メソッド）
   */
  _getAllRooms() {
    const roomSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetNames.roomManagement);
    if (!roomSheet || roomSheet.getLastRow() <= 1) {
      return [];
    }
    
    const data = roomSheet.getDataRange().getValues();
    const rooms = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isActive = row[6] === 'TRUE';
      
      if (isActive) {
        rooms.push({
          roomId: row[0],
          roomName: row[1],
          canTreatment: row[2] === 'TRUE',
          canIV: row[3] === 'TRUE',
          maxCapacity: parseInt(row[5]) || 1
        });
      }
    }
    
    return rooms;
  }
  
  /**
   * 空き時間に利用可能な部屋があるかチェック（内部メソッド）
   */
  _hasAvailableRoom(vacancy, availableRooms, duration) {
    // 実際の予約状況を確認する処理を実装
    // 現時点では簡易的に実装
    return availableRooms.length > 0;
  }
  
  /**
   * ペア部屋が要件を満たすかチェック（内部メソッド）
   */
  _checkPairRoomAccommodation(pairGroup, menuRequirements, vacancy) {
    // 各メニューに対して適切な部屋があるかチェック
    const usedRooms = new Set();
    
    for (const req of menuRequirements) {
      let roomFound = false;
      
      for (const room of pairGroup.rooms) {
        if (!usedRooms.has(room.roomId)) {
          if ((req.requirements.needsTreatment && room.canTreatment) ||
              (req.requirements.needsIV && room.canIV)) {
            usedRooms.add(room.roomId);
            roomFound = true;
            break;
          }
        }
      }
      
      if (!roomFound) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 部屋要件を集計（内部メソッド）
   */
  _aggregateRoomRequirements(menuIds) {
    let treatmentCount = 0;
    let ivCount = 0;
    
    menuIds.forEach(menuId => {
      const req = this._getMenuRoomRequirements(menuId);
      if (req.needsTreatment) treatmentCount++;
      if (req.needsIV) ivCount++;
    });
    
    return {
      treatmentCount: treatmentCount,
      ivCount: ivCount
    };
  }
  
  /**
   * 必要な部屋の組み合わせを探す（内部メソッド）
   */
  _findRoomCombination(allRooms, requirements, vacancy, visitorCount) {
    // 簡易的な実装：必要な数の部屋があるかチェック
    const treatmentRooms = allRooms.filter(room => room.canTreatment);
    const ivRooms = allRooms.filter(room => room.canIV);
    
    if (treatmentRooms.length >= requirements.treatmentCount &&
        ivRooms.length >= requirements.ivCount) {
      return {
        treatmentRooms: treatmentRooms.slice(0, requirements.treatmentCount),
        ivRooms: ivRooms.slice(0, requirements.ivCount)
      };
    }
    
    return null;
  }
}