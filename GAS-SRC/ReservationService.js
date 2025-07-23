/**
 * 予約（Reservation）管理サービス
 */
class ReservationService {
  constructor() {
    this.apiClient = new ApiClient();
    this.sheetName = Config.getSheetNames().reservations;
  }
  
  /**
   * 予約情報を同期（ページネーション対応）
   */
  syncReservations(params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('予約情報の同期を開始します');
      
      // デフォルトパラメータ
      if (!params.date_from) {
        params.date_from = Utils.getToday();
      }
      
      // 3か月後の日付を設定
      if (!params.date_to) {
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        params.date_to = Utils.formatDate(threeMonthsLater);
      }
      
      const allReservations = [];
      const limit = 100;
      let offset = 0;
      let hasMore = true;
      
      // 全データを取得するまでループ
      while (hasMore) {
        Logger.log(`予約情報を取得中... (offset: ${offset})`);
        Logger.log(`取得期間: ${params.date_from} ～ ${params.date_to}`);
        
        // APIから予約情報を取得
        const requestParams = {
          ...params,
          limit: limit,
          offset: offset
        };
        
        const response = this.apiClient.getReservations(requestParams);
        
        if (!response.success || !response.data) {
          throw new Error('予約情報の取得に失敗しました');
        }
        
        // APIレスポンスの形式を確認（配列または { items: [...], count: N } の形式）
        const reservations = Array.isArray(response.data) ? response.data : (response.data.items || []);
        const totalCount = response.data.count || 0;
        
        Logger.log(`${reservations.length}件を取得 (全${totalCount}件中)`);
        
        if (reservations.length === 0) {
          hasMore = false;
        } else {
          allReservations.push(...reservations);
          offset += limit;
          
          // 取得した件数が全件数に達したか、limitより少ない場合は終了
          if (allReservations.length >= totalCount || reservations.length < limit) {
            hasMore = false;
          }
        }
        
        // API制限を考慮して少し待機
        if (hasMore) {
          Utilities.sleep(500);  // 0.5秒待機
        }
      }
      
      Logger.log(`合計${allReservations.length}件の予約情報を取得しました`);
      
      // スプレッドシートに書き込み
      if (allReservations.length > 0) {
        this._writeReservationsToSheet(allReservations);
      }
      
      return allReservations.length;
    }, '予約情報同期');
  }
  
  /**
   * 更新された予約情報を同期
   */
  syncUpdatedReservations(date = null) {
    return Utils.executeWithErrorHandling(() => {
      if (!date) {
        // デフォルトは今日の日付
        date = Utils.getToday();
      }
      
      Logger.log(`${date}以降に更新された予約情報を同期します`);
      
      // APIから更新された予約情報を取得
      const response = this.apiClient.get(
        this.apiClient.config.endpoints.updatedReservations,
        {
          clinic_id: Config.getClinicId(),
          date: date
        }
      );
      
      if (!response.success || !response.data) {
        throw new Error('更新された予約情報の取得に失敗しました');
      }
      
      // APIレスポンスの形式を確認（配列または { items: [...] } の形式）
      const reservations = Array.isArray(response.data) ? response.data : (response.data.items || []);
      Logger.log(`${reservations.length}件の更新された予約情報を取得しました`);
      
      if (reservations.length > 0) {
        // 既存データとマージして更新
        this._mergeReservationsToSheet(reservations);
      }
      
      return reservations.length;
    }, '更新予約情報同期');
  }
  
  /**
   * 予約IDで予約情報を取得
   */
  getReservationById(reservationId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`予約情報を取得: ID=${reservationId}`);
      
      const response = this.apiClient.get(
        this.apiClient.config.endpoints.reservationById,
        {
          id: reservationId
        }
      );
      
      if (!response.success || !response.data) {
        throw new Error('予約情報の取得に失敗しました');
      }
      
      return response.data;
    }, '予約情報取得');
  }
  
  /**
   * 予約IDからカルテ番号を取得
   * @param {string} reservationId - 予約ID
   * @return {string} カルテ番号（見つからない場合は空文字）
   */
  getChartNumberFromReservation(reservationId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`予約ID ${reservationId} からカルテ番号を取得中...`);
      
      // 予約詳細を取得
      const reservation = this.getReservationById(reservationId);
      
      if (!reservation) {
        Logger.log('予約が見つかりませんでした');
        return '';
      }
      
      Logger.log(`予約データ: ${JSON.stringify(reservation)}`);
      
      // 予約データから患者情報を抽出
      let chartNumber = '';
      
      // 1. visitor オブジェクトから直接取得
      if (reservation.visitor) {
        Logger.log(`患者情報: ${JSON.stringify(reservation.visitor)}`);
        
        // 直接フィールドをチェック
        if (reservation.visitor.karte_number) {
          chartNumber = reservation.visitor.karte_number;
          Logger.log(`karte_numberフィールドから取得: ${chartNumber}`);
        } else if (reservation.visitor.chart_number) {
          chartNumber = reservation.visitor.chart_number;
          Logger.log(`chart_numberフィールドから取得: ${chartNumber}`);
        } else if (reservation.visitor.code) {
          // codeフィールドがカルテ番号の可能性
          chartNumber = reservation.visitor.code;
          Logger.log(`codeフィールドから取得: ${chartNumber}`);
        }
        
        // VisitorServiceの抽出メソッドを使用
        if (!chartNumber) {
          try {
            const visitorService = new VisitorService();
            chartNumber = visitorService._extractKarteNumber(reservation.visitor);
            Logger.log(`_extractKarteNumberメソッドから取得: ${chartNumber}`);
          } catch (e) {
            Logger.log(`_extractKarteNumberエラー: ${e.toString()}`);
          }
        }
      }
      
      // 2. 予約データ直下のフィールドもチェック
      if (!chartNumber) {
        if (reservation.karte_number) {
          chartNumber = reservation.karte_number;
          Logger.log(`予約のkarte_numberから取得: ${chartNumber}`);
        } else if (reservation.chart_number) {
          chartNumber = reservation.chart_number;
          Logger.log(`予約のchart_numberから取得: ${chartNumber}`);
        }
      }
      
      Logger.log(`最終カルテ番号: ${chartNumber || '未設定'}`);
      return chartNumber || '';
      
    }, '予約からカルテ番号取得');
  }
  
  /**
   * 予約を作成
   */
  createReservation(reservationData) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('新規予約を作成します');
      
      // 必須項目のチェック
      if (!reservationData.visitor_id || !reservationData.start_at) {
        throw new Error('患者IDと予約開始時刻は必須項目です');
      }
      
      // チケット自動消費処理
      const ticketResult = this._consumeTicketForReservation(reservationData);
      
      // APIに送信
      const response = this.apiClient.createReservation(reservationData);
      
      if (!response.success || !response.data) {
        // 予約作成失敗時はチケットを戻す
        if (ticketResult.consumed) {
          this._restoreTicket(ticketResult);
        }
        throw new Error('予約の作成に失敗しました');
      }
      
      const reservation = response.data;
      Logger.log(`予約を作成しました: ID=${reservation.reservation_id}`);
      
      // スプレッドシートに追加
      this._appendReservationToSheet(reservation);
      
      // チケット消費アラートを表示
      if (ticketResult.consumed && ticketResult.alert) {
        SpreadsheetApp.getUi().alert('チケット消費', ticketResult.alert, SpreadsheetApp.getUi().ButtonSet.OK);
      }
      
      // 会社別会員向け通知を送信
      this._sendCompanyMemberNotification(reservation, reservationData.booked_by || reservationData.visitor_id);
      
      return reservation;
    }, '予約作成');
  }
  
  /**
   * 予約に基づいてチケットを消費
   * @private
   */
  _consumeTicketForReservation(reservationData) {
    try {
      // 患者情報を取得
      const visitorService = new VisitorService();
      const visitor = visitorService.getVisitorById(reservationData.visitor_id);
      
      if (!visitor) {
        return { consumed: false, reason: '患者情報が見つかりません' };
      }
      
      // 会社所属を確認
      const companyVisitorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().companyVisitors);
      if (!companyVisitorSheet) {
        return { consumed: false, reason: '会社管理シートが見つかりません' };
      }
      
      const companyData = this._getVisitorCompany(companyVisitorSheet, reservationData.visitor_id);
      if (!companyData) {
        return { consumed: false, reason: '会社所属なし' };
      }
      
      // メニュー情報を取得
      const menuData = this._getMenuInfo(reservationData.menu_id);
      if (!menuData || !menuData.ticketType) {
        return { consumed: false, reason: 'チケット不要のメニュー' };
      }
      
      // チケット消費
      const ticketService = new TicketManagementService();
      const ticketData = {
        companyId: companyData.companyId,
        visitorId: reservationData.visitor_id,
        menuId: reservationData.menu_id,
        menuName: menuData.name,
        ticketType: menuData.ticketType,
        reason: `予約ID: ${reservationData.reservation_id || 'NEW'} - 自動消費`
      };
      
      const result = ticketService.useCompanyTickets(ticketData);
      
      return {
        consumed: result.success,
        companyId: companyData.companyId,
        ticketType: menuData.ticketType,
        alert: result.alert,
        ticketData: ticketData
      };
      
    } catch (error) {
      Logger.log('チケット自動消費エラー: ' + error.toString());
      return { consumed: false, reason: error.toString() };
    }
  }
  
  /**
   * チケットを復元（予約作成失敗時）
   * @private
   */
  _restoreTicket(ticketResult) {
    try {
      const ticketService = new TicketManagementService();
      const restoreData = {
        companyId: ticketResult.companyId,
        type: 'manual',
        reason: '予約作成失敗によるチケット復元'
      };
      
      // チケットタイプに応じて復元数を設定
      switch(ticketResult.ticketType) {
        case '幹細胞':
          restoreData.stemCell = 1;
          restoreData.treatment = 0;
          restoreData.infusion = 0;
          break;
        case '施術':
          restoreData.stemCell = 0;
          restoreData.treatment = 1;
          restoreData.infusion = 0;
          break;
        case '点滴':
          restoreData.stemCell = 0;
          restoreData.treatment = 0;
          restoreData.infusion = 1;
          break;
      }
      
      ticketService.addCompanyTickets(restoreData);
      Logger.log('チケットを復元しました');
      
    } catch (error) {
      Logger.log('チケット復元エラー: ' + error.toString());
    }
  }
  
  /**
   * 患者の会社情報を取得
   * @private
   */
  _getVisitorCompany(sheet, visitorId) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const visitorIdIndex = headers.indexOf('visitor_id');
    const companyIdIndex = headers.indexOf('会社ID');
    const companyNameIndex = headers.indexOf('会社名');
    const memberTypeIndex = headers.indexOf('会員種別');
    const isPublicIndex = headers.indexOf('公開設定');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][visitorIdIndex] === visitorId) {
        return {
          companyId: data[i][companyIdIndex],
          companyName: data[i][companyNameIndex] || '',
          memberType: data[i][memberTypeIndex] || '',
          isPublic: data[i][isPublicIndex] === true || data[i][isPublicIndex] === 'TRUE' || data[i][isPublicIndex] === '公開'
        };
      }
    }
    return null;
  }
  
  /**
   * メニュー情報を取得
   * @private
   */
  _getMenuInfo(menuId) {
    const menuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().menus);
    if (!menuSheet) return null;
    
    const data = menuSheet.getDataRange().getValues();
    const headers = data[0];
    const menuIdIndex = headers.indexOf('menu_id');
    const nameIndex = headers.indexOf('メニュー名');
    const ticketTypeIndex = headers.indexOf('チケットタイプ');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][menuIdIndex] === menuId) {
        return {
          id: menuId,
          name: data[i][nameIndex] || '',
          ticketType: data[i][ticketTypeIndex] || ''
        };
      }
    }
    return null;
  }
  
  /**
   * 空き時間を取得
   */
  getVacancies(params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('空き時間を取得します');
      
      // 必須パラメータのチェック
      if (!params.epoch_from_keydate) {
        // date_fromが指定されている場合は、それをepoch_from_keydateとして使用
        if (params.date_from) {
          params.epoch_from_keydate = params.date_from;
        } else {
          params.epoch_from_keydate = Utils.getToday();
        }
      }
      
      if (!params.epoch_to_keydate) {
        // デフォルトはepoch_from_keydateと同じ日付
        params.epoch_to_keydate = params.epoch_from_keydate;
      }
      
      // clinic_idを設定
      if (!params.clinic_id) {
        params.clinic_id = Config.getClinicId();
      }
      
      // 不要なパラメータを削除
      delete params.date_from;
      
      Logger.log(`空き時間取得パラメータ: ${JSON.stringify(params)}`);
      
      const response = this.apiClient.get(
        this.apiClient.config.endpoints.vacancies,
        params
      );
      
      if (!response.success || !response.data) {
        throw new Error('空き時間の取得に失敗しました');
      }
      
      return response.data;
    }, '空き時間取得');
  }
  
  /**
   * 日単位の空き時間を取得
   */
  getDailyVacancies(params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('日単位の空き時間を取得します');
      
      // 必須パラメータのチェック
      if (!params.epoch_from_keydate) {
        // date_fromが指定されている場合は、それをepoch_from_keydateとして使用
        if (params.date_from) {
          params.epoch_from_keydate = params.date_from;
        } else {
          params.epoch_from_keydate = Utils.getToday();
        }
      }
      
      if (!params.epoch_to_keydate) {
        // デフォルトはepoch_from_keydateと同じ日付
        params.epoch_to_keydate = params.epoch_from_keydate;
      }
      
      // clinic_idを設定
      if (!params.clinic_id) {
        params.clinic_id = Config.getClinicId();
      }
      
      // 不要なパラメータを削除
      delete params.date_from;
      
      Logger.log(`日単位空き時間取得パラメータ: ${JSON.stringify(params)}`);
      
      const response = this.apiClient.get(
        this.apiClient.config.endpoints.dailyVacancies,
        params
      );
      
      if (!response.success || !response.data) {
        throw new Error('日単位空き時間の取得に失敗しました');
      }
      
      return response.data;
    }, '日単位空き時間取得');
  }
  
  /**
   * LINE Bot用：利用可能な予約枠を取得
   * 診療科目や時間帯でフィルタリング可能
   */
  getAvailableSlots(params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('LINE Bot用：利用可能な予約枠を取得します');
      
      // 空き時間を取得
      const vacancies = this.getVacancies({
        epoch_from_keydate: params.date_from,
        epoch_to_keydate: params.date_to || params.date_from,
        clinic_id: Config.getClinicId()
      });
      
      // 利用可能な予約枠をフィルタリング・整形
      const availableSlots = [];
      
      if (vacancies && vacancies.items) {
        vacancies.items.forEach(vacancy => {
          // 診療科目フィルタリング
          if (params.departments && params.departments.length > 0) {
            if (!params.departments.includes(vacancy.department_name)) {
              return;
            }
          }
          
          // 時間帯フィルタリング
          if (params.timePreference && params.timePreference !== 'any') {
            const hour = parseInt(vacancy.start_time.split(':')[0]);
            if (params.timePreference === 'morning' && hour >= 12) return;
            if (params.timePreference === 'afternoon' && (hour < 12 || hour >= 17)) return;
            if (params.timePreference === 'evening' && hour < 17) return;
          }
          
          availableSlots.push({
            id: vacancy.id,
            date: vacancy.date,
            time_slot: `${vacancy.start_time}-${vacancy.end_time}`,
            department_id: vacancy.department_id,
            department_name: vacancy.department_name,
            doctor_name: vacancy.doctor_name,
            available_count: vacancy.available_count
          });
        });
      }
      
      // 制限数の適用
      if (params.limit) {
        return availableSlots.slice(0, params.limit);
      }
      
      return availableSlots;
    }, 'LINE Bot予約枠取得');
  }
  
  /**
   * LINE Bot用：患者IDで予約情報を取得
   */
  getReservationsByPatientId(patientId, params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`LINE Bot用：患者ID ${patientId} の予約情報を取得します`);
      
      // 予約情報シートから直接データを取得
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().reservations);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        return []; // ヘッダーのみの場合
      }
      
      const headers = data[0];
      const reservations = [];
      
      // ヘッダーのインデックスを取得
      const statusIndex = headers.indexOf('ステータス');
      const reservationIdIndex = headers.indexOf('reservation_id');
      const patientIdIndex = headers.indexOf('patient_id');
      const patientNameIndex = headers.indexOf('患者名');
      const patientTypeIndex = headers.indexOf('患者属性');
      const visitorIdIndex = headers.indexOf('visitor_id');
      const visitorNameIndex = headers.indexOf('予約者');
      const dateIndex = headers.indexOf('予約日');
      const timeIndex = headers.indexOf('予約時間');
      const endTimeIndex = headers.indexOf('終了時間');
      const menuIndex = headers.indexOf('メニュー');
      const staffIndex = headers.indexOf('担当スタッフ');
      const notesIndex = headers.indexOf('メモ');
      const createdAtIndex = headers.indexOf('作成日時');
      const updatedAtIndex = headers.indexOf('更新日時');
      const companyIdIndex = headers.indexOf('会社ID');
      const companyNameIndex = headers.indexOf('会社名');
      const roomIdIndex = headers.indexOf('部屋ID');
      const roomNameIndex = headers.indexOf('部屋名');
      // visitor_idでフィルタリングしてデータを収集
      for (let i = 1; i < data.length; i++) {
        if (data[i][visitorIdIndex] === patientId) {
          const status = data[i][statusIndex];
          const reservationDate = data[i][dateIndex];
          
          // ステータスフィルタリング（日本語のまま処理）
          //if (params.statusFilter && params.statusFilter.length > 0) {
          //  if (!params.statusFilter.includes(status)) {
          //    continue;
          //  }
          //}
          // 指定された形式でデータを追加
          const reservationObj = {
            'history_id': data[i][reservationIdIndex] || '',
            'reservename': data[i][menuIndex] || '',
            'reservedate': Utils.formatDate(new Date(reservationDate)),
            'reservetime': data[i][timeIndex] || '',
            'reservestatus': status || '',
            'reservepatient': data[i][visitorNameIndex] || '',
            'patient_id': data[i][patientIdIndex] || '',
            'patient_name': data[i][patientNameIndex] || '',
            'patient_type': data[i][patientTypeIndex] || '',
            'visitor_id': data[i][visitorIdIndex] || '',
            'end_time': data[i][endTimeIndex] || '',
            'staff': data[i][staffIndex] || '',
            'notes': data[i][notesIndex] || '',
            'created_at': data[i][createdAtIndex] || '',
            'updated_at': data[i][updatedAtIndex] || '',
            'company_id': data[i][companyIdIndex] || '',
            'company_name': data[i][companyNameIndex] || '',
            'room_id': data[i][roomIdIndex] || '',
            'room_name': data[i][roomNameIndex] || ''
          };
          reservations.push(reservationObj);
          Logger.log(`getReservationsByPatientId: 予約情報取得成功: ${reservationObj.history_id}, ${reservationObj.reservename}, ${reservationObj.reservedate}, ${reservationObj.reservetime}, ${reservationObj.reservestatus}, ${reservationObj.reservepatient}, ${reservationObj.patient_id}, ${reservationObj.patient_name}, ${reservationObj.patient_type}, ${reservationObj.visitor_id}, ${reservationObj.end_time}, ${reservationObj.staff}, ${reservationObj.notes}, ${reservationObj.created_at}, ${reservationObj.updated_at}, ${reservationObj.company_id}, ${reservationObj.company_name}, ${reservationObj.room_id}, ${reservationObj.room_name}`);
        }
      }
      
      // ソート
      if (params.sortBy === 'date_desc') {
        reservations.sort((a, b) => {
          const dateA = new Date(a.reservedate + ' ' + a.reservetime);
          const dateB = new Date(b.reservedate + ' ' + b.reservetime);
          return dateB - dateA;
        });
      } else {
        // デフォルトは日付昇順
        reservations.sort((a, b) => {
          const dateA = new Date(a.reservedate + ' ' + a.reservetime);
          const dateB = new Date(b.reservedate + ' ' + b.reservetime);
          return dateA - dateB;
        });
      }
      
      return reservations;
    }, 'LINE Bot患者予約取得');
  }
  
  /**
   * 予約枠を作成
   */
  createVacancy(vacancyData) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('予約枠を作成します');
      
      const response = this.apiClient.post(
        this.apiClient.config.endpoints.createVacancy,
        vacancyData
      );
      
      if (!response.success || !response.data) {
        throw new Error('予約枠の作成に失敗しました');
      }
      
      return response.data;
    }, '予約枠作成');
  }
  
  /**
   * 予約情報をスプレッドシートに書き込み
   */
  _writeReservationsToSheet(reservations) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    
    // データをクリア（ヘッダーは残す）
    Utils.clearSheet(sheet, true);
    
    if (reservations.length === 0) {
      Logger.log('書き込む予約データがありません');
      return;
    }
    
    // データを配列に変換
    const data = reservations.map(reservation => this._reservationToRow(reservation));
    
    // シートに書き込み
    Utils.writeDataToSheet(sheet, data);
    
    Logger.log(`${reservations.length}件の予約情報をシートに書き込みました`);
  }
  
  /**
   * 予約情報をマージして更新
   */
  _mergeReservationsToSheet(reservations) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    const existingData = sheet.getDataRange().getValues();
    
    if (existingData.length <= 1) {
      // 既存データがない場合は新規書き込み
      this._writeReservationsToSheet(reservations);
      return;
    }
    
    // reservation_idをキーとして既存データをマップ化
    const existingMap = new Map();
    for (let i = 1; i < existingData.length; i++) {
      const reservationId = existingData[i][0];
      if (reservationId) {
        existingMap.set(reservationId, i);
      }
    }
    
    // 更新データを処理
    reservations.forEach(reservation => {
      const rowIndex = existingMap.get(reservation.reservation_id);
      if (rowIndex) {
        // 既存レコードを更新
        const rowData = this._reservationToRow(reservation);
        const range = sheet.getRange(rowIndex + 1, 1, 1, rowData.length);
        range.setValues([rowData]);
      } else {
        // 新規レコードを追加
        this._appendReservationToSheet(reservation);
      }
    });
    
    Logger.log(`${reservations.length}件の予約情報をマージしました`);
  }
  
  /**
   * 予約情報を1件追加
   */
  _appendReservationToSheet(reservation) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    const rowData = this._reservationToRow(reservation);
    sheet.appendRow(rowData);
  }
  
  /**
   * 予約オブジェクトを行データに変換
   */
  _reservationToRow(reservation) {
    // デバッグ: 予約データの構造を確認
    Logger.log(`予約データ構造: ${JSON.stringify(reservation)}`);
    
    // 日付と時刻を分離
    const startAt = new Date(reservation.start_at);
    const endAt = reservation.end_at ? new Date(reservation.end_at) : null;
    
    // APIレスポンスの構造に基づいてデータを抽出
    // visitor情報は入れ子になっている
    const visitorId = reservation.visitor?.id || reservation.visitor_id || '';
    const visitorName = reservation.visitor?.name || reservation.visitor_name || '';
    
    Logger.log(`抽出された患者情報 - ID: ${visitorId}, 名前: ${visitorName}`);
    
    // 予約IDも同様に処理
    const reservationId = reservation.id || reservation.reservation_id || '';
    
    // メニュー名とスタッフ名も入れ子の可能性を考慮
    let menuName = reservation.menu_name || '';
    if (!menuName && reservation.menus && reservation.menus.length > 0) {
      menuName = reservation.menus[0].name || '';
    }
    
    let staffName = reservation.staff_name || '';
    if (!staffName && reservation.operations && reservation.operations.length > 0) {
      // nominated_staffから取得
      if (reservation.operations[0].nominated_staff) {
        staffName = reservation.operations[0].nominated_staff.name || '';
      }
    }
    
    // メモはnoteフィールドの可能性もある
    const memo = reservation.memo || reservation.note || '';
    
    // 会社情報を取得
    let companyId = '';
    let companyName = '';
    let memberType = '';
    let isPublic = '';
    
    if (visitorId) {
      try {
        const companyVisitorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().companyVisitors);
        if (companyVisitorSheet) {
          const companyData = this._getVisitorCompany(companyVisitorSheet, visitorId);
          if (companyData) {
            companyId = companyData.companyId || '';
            companyName = companyData.companyName || '';
            memberType = companyData.memberType || '';
            isPublic = companyData.isPublic ? '公開' : '非公開';
            Logger.log(`会社情報取得 - ID: ${companyId}, 名前: ${companyName}, 会員種別: ${memberType}, 公開設定: ${isPublic}`);
          }
        }
      } catch (error) {
        Logger.log(`会社情報取得エラー: ${error.toString()}`);
      }
    }
    
    // スタッフIDと部屋情報を抽出
    let staffId = '';
    let roomId = '';
    let roomName = '';
    
    // operations配列から詳細情報を取得
    if (reservation.operations && reservation.operations.length > 0) {
      const operation = reservation.operations[0];
      
      // スタッフID
      if (operation.nominated_staff && operation.nominated_staff.id) {
        staffId = operation.nominated_staff.id;
      }
      
      // 部屋情報
      if (operation.room) {
        roomId = operation.room.id || '';
        roomName = operation.room.name || '';
      } else if (operation.room_id) {
        roomId = operation.room_id;
        roomName = operation.room_name || '';
      }
    }
    
    // 新しい列構成に対応
    return [
      this._getStatusLabel(reservation.status),  // A列: ステータス
      reservationId,                             // B列: reservation_id
      visitorId,                                 // C列: visitor_id
      visitorName,                               // D列: 予約者
      Utils.formatDate(startAt),                 // E列: 予約日
      Utils.formatDate(startAt, 'HH:mm'),       // F列: 予約時間
      endAt ? Utils.formatDate(endAt, 'HH:mm') : '', // G列: 終了時間
      menuName,                                  // H列: メニュー
      staffName,                                 // I列: 担当スタッフ
      memo,                                      // J列: メモ
      Utils.formatDateTime(reservation.created_at), // K列: 作成日時
      Utils.formatDateTime(reservation.updated_at), // L列: 更新日時
      companyId,                                 // M列: 会社ID
      companyName,                               // N列: 会社名
      memberType,                                // O列: 会員種別
      isPublic,                                  // P列: 公開設定
      reservation.booked_by || visitorId,        // Q列: 予約者
      staffId,                                   // R列: スタッフID
      roomId,                                    // S列: 部屋ID
      roomName                                   // T列: 部屋名
    ];
  }
  
  /**
   * ステータスラベルを取得
   */
  _getStatusLabel(status) {
    const statusMap = {
      'reserved': '予約済',
      'confirmed': '確定',
      'arrived': '来院',
      'in_progress': '施術中',
      'completed': '完了',
      'cancelled': 'キャンセル',
      'no_show': '無断キャンセル'
    };
    
    return statusMap[status] || status || '';
  }
  
  /**
   * 予約仮押さえを削除
   */
  deleteProcessingReservation(reservationId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`予約仮押さえを削除: ID=${reservationId}`);
      
      const response = this.apiClient.delete(
        this.apiClient.config.endpoints.deleteProcessingReservation.replace('{id}', reservationId)
      );
      
      if (!response.success) {
        throw new Error('予約仮押さえの削除に失敗しました');
      }
      
      Logger.log('予約仮押さえを削除しました');
      return true;
    }, '予約仮押さえ削除');
  }
  
  /**
   * 会社別会員向け通知を送信
   * @private
   */
  _sendCompanyMemberNotification(reservation, bookerId) {
    try {
      // 非同期で通知を送信（エラーがあっても予約作成処理は継続）
      const notificationService = new CompanyMemberNotificationService();
      notificationService.sendReservationConfirmation(reservation, bookerId)
        .catch(error => {
          Logger.log(`通知送信エラー（予約作成は成功）: ${error.toString()}`);
        });
    } catch (error) {
      Logger.log(`通知サービス初期化エラー: ${error.toString()}`);
    }
  }
  
  /**
   * 日付範囲で予約を取得
   * @param {Date} startDate 開始日
   * @param {Date} endDate 終了日
   * @return {Array} 予約リスト
   */
  async getReservationsByDateRange(startDate, endDate) {
    try {
      const sheet = Utils.getOrCreateSheet(this.sheetName);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        return [];
      }
      
      const headers = data[0];
      const dateIndex = headers.indexOf('予約日');
      
      const reservations = [];
      for (let i = 1; i < data.length; i++) {
        const reservationDate = new Date(data[i][dateIndex]);
        if (reservationDate >= startDate && reservationDate <= endDate) {
          // 予約オブジェクトを再構築
          const reservation = {
            id: data[i][headers.indexOf('reservation_id')],
            visitor_id: data[i][headers.indexOf('visitor_id')],
            visitor_name: data[i][headers.indexOf('予約者')],
            date: data[i][dateIndex],
            start_time: data[i][headers.indexOf('予約時間')],
            end_time: data[i][headers.indexOf('終了時間')],
            menu_name: data[i][headers.indexOf('メニュー')],
            status: data[i][headers.indexOf('ステータス')],
            booked_by: data[i][headers.indexOf('予約者')] || data[i][headers.indexOf('visitor_id')]
          };
          reservations.push(reservation);
        }
      }
      
      return reservations;
    } catch (error) {
      Logger.log(`予約取得エラー: ${error.toString()}`);
      return [];
    }
  }
  
  /**
   * 完了した予約を取得
   * @param {Date} targetTime 対象時刻
   * @return {Array} 完了予約リスト
   */
  async getCompletedReservations(targetTime) {
    try {
      const sheet = Utils.getOrCreateSheet(this.sheetName);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        return [];
      }
      
      const headers = data[0];
      const statusIndex = headers.indexOf('ステータス');
      const endTimeIndex = headers.indexOf('終了時間');
      const dateIndex = headers.indexOf('予約日');
      
      const reservations = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][statusIndex] === '完了' || data[i][statusIndex] === 'completed') {
          const endTimeStr = data[i][endTimeIndex];
          const dateStr = data[i][dateIndex];
          
          if (endTimeStr && dateStr) {
            const endDateTime = new Date(`${dateStr} ${endTimeStr}`);
            if (endDateTime <= targetTime) {
              // 予約オブジェクトを再構築
              const reservation = {
                id: data[i][headers.indexOf('reservation_id')],
                visitor_id: data[i][headers.indexOf('visitor_id')],
                visitor_name: data[i][headers.indexOf('予約者')],
                date: dateStr,
                end_time: endTimeStr,
                menu_name: data[i][headers.indexOf('メニュー')],
                status: data[i][statusIndex],
                booked_by: data[i][headers.indexOf('予約者')] || data[i][headers.indexOf('visitor_id')]
              };
              reservations.push(reservation);
            }
          }
        }
      }
      
      return reservations;
    } catch (error) {
      Logger.log(`完了予約取得エラー: ${error.toString()}`);
      return [];
    }
  }
}