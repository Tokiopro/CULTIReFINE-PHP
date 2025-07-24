/**
 * 予約管理サービス
 */
class ReservationService {
  constructor() {
    this.spreadsheetManager = new SpreadsheetManager();
    this.apiClient = new ApiClient();
    this.sheetName = Config.getSheetNames().reservations;
    this.phpSyncEndpoint = Config.getPHPSyncEndpoint ? Config.getPHPSyncEndpoint() : null;
  }
  
  /**
   * 時間制限付き予約同期（PHP経由版）
   * PHPを使用してMedical Force APIから予約データを取得
   */
  syncReservationsViaPhp(params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('=== PHP経由での予約情報同期を開始 ===');
      
      if (!this.phpSyncEndpoint) {
        throw new Error('PHP同期エンドポイントが設定されていません');
      }
      
      const startTime = new Date();
      
      // デフォルトパラメータの設定
      const syncParams = {
        date_from: params.date_from || Utils.getToday(),
        date_to: params.date_to || Utils.formatDate(new Date(new Date().setDate(new Date().getDate() + 14))),
        offset: params.offset || 0,
        limit: params.limit || 500
      };
      
      Logger.log(`同期パラメータ: ${JSON.stringify(syncParams)}`);
      
      // PHPエンドポイントを呼び出し
      const response = UrlFetchApp.fetch(this.phpSyncEndpoint, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Config.getApiKey()}`
        },
        payload: JSON.stringify({
          action: 'syncMedicalForceReservations',
          ...syncParams
        }),
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (responseCode !== 200) {
        Logger.log(`PHPエンドポイントエラー: ${responseCode} - ${responseText}`);
        throw new Error(`PHP同期エラー: ${responseCode}`);
      }
      
      const result = JSON.parse(responseText);
      
      if (!result.success) {
        throw new Error(`同期失敗: ${result.error?.message || 'Unknown error'}`);
      }
      
      const syncData = result.data;
      Logger.log(`同期結果: ${syncData.summary.processed_count}件の予約を取得`);
      
      // スプレッドシートに書き込み
      if (syncData.reservations && syncData.reservations.length > 0) {
        this._writeReservationsToSheetBatch(syncData.reservations);
      }
      
      const endTime = new Date();
      const executionTime = (endTime - startTime) / 1000;
      
      return {
        completed: true,
        totalSynced: syncData.summary.processed_count,
        errorCount: syncData.summary.error_count,
        executionTime: executionTime,
        dateRange: syncData.summary.date_range,
        errors: syncData.errors
      };
      
    }, 'PHP経由予約同期');
  }
  
  /**
   * 時間制限付き予約同期（従来のGAS版 - フォールバック用）
   * 実行時間を監視しながら段階的に同期
   */
  syncReservationsWithTimeLimit(maxExecutionTime = 270000) { // 4.5分
    const startTime = new Date().getTime();
    const cache = CacheService.getScriptCache();
    
    try {
      // 前回の同期状態を確認
      const syncStatus = {
        completed: false,
        lastOffset: 0,
        dateFrom: Utils.getToday(),
        dateTo: Utils.formatDate(new Date(new Date().setDate(new Date().getDate() + 14))),
        totalSynced: 0
      };
      
      // キャッシュから前回の状態を取得
      const cachedStatus = cache.get('reservation_sync_status');
      if (cachedStatus) {
        const parsed = JSON.parse(cachedStatus);
        // 前回の同期が未完了の場合は続きから
        if (!parsed.completed) {
          syncStatus.lastOffset = parsed.lastOffset;
          syncStatus.dateFrom = parsed.dateFrom;
          syncStatus.dateTo = parsed.dateTo;
          Logger.log(`前回の同期を再開: offset=${syncStatus.lastOffset}`);
        }
      }
      
      const result = this._syncReservationsInternal(syncStatus, startTime, maxExecutionTime);
      
      // 同期状態をキャッシュに保存
      cache.put('reservation_sync_status', JSON.stringify(result), 3600); // 1時間保持
      
      return result;
    } catch (error) {
      Logger.log(`同期エラー: ${error.toString()}`);
      throw error;
    }
  }
  
  /**
   * 予約情報を同期（ページネーション対応 - 従来版）
   */
  syncReservations(params = {}) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('予約情報の同期を開始します');
      
      // デフォルトパラメータ
      if (!params.date_from) {
        params.date_from = Utils.getToday();
      }
      
      // デフォルトは14日後まで（日次同期用）
      if (!params.date_to) {
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
        params.date_to = Utils.formatDate(twoWeeksLater);
      }
      
      const allReservations = [];
      const limit = 500; // ページサイズを拡大
      let offset = 0;
      let hasMore = true;
      const startTime = new Date().getTime();
      
      // 全データを取得するまでループ
      while (hasMore) {
        Logger.log(`予約情報を取得中... (offset: ${offset})`);
        Logger.log(`取得期間: ${params.date_from} ～ ${params.date_to}`);
        
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
        
        // 実行時間チェック
        const currentTime = new Date().getTime();
        const elapsedTime = currentTime - startTime;
        
        if (elapsedTime > 270000) { // 4.5分経過したら中断
          Logger.log('実行時間制限に近づいたため、同期を中断します');
          hasMore = false;
          // 次回再開用の情報を保存
          const cache = CacheService.getScriptCache();
          cache.put('reservation_sync_offset', String(offset), 3600);
          cache.put('reservation_sync_params', JSON.stringify(params), 3600);
        }
        
        // API制限を考慮して少し待機（短縮）
        if (hasMore) {
          Utilities.sleep(100);  // 0.1秒待機
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
   * 内部同期処理（実行時間監視付き）
   */
  _syncReservationsInternal(syncStatus, startTime, maxExecutionTime) {
    const allReservations = [];
    const limit = 500;
    let offset = syncStatus.lastOffset || 0;
    let hasMore = true;
    
    const params = {
      date_from: syncStatus.dateFrom || Utils.getToday(),
      date_to: syncStatus.dateTo || Utils.formatDate(new Date(new Date().setDate(new Date().getDate() + 14)))
    };
    
    while (hasMore) {
      const currentTime = new Date().getTime();
      const elapsedTime = currentTime - startTime;
      
      // 実行時間チェック
      if (elapsedTime > maxExecutionTime - 60000) { // 1分の余裕を持って終了
        Logger.log(`実行時間制限に近づいたため、同期を中断します（経過時間: ${elapsedTime}ms）`);
        syncStatus.completed = false;
        syncStatus.lastOffset = offset;
        syncStatus.totalSynced = allReservations.length;
        return syncStatus;
      }
      
      Logger.log(`予約情報を取得中... (offset: ${offset})`);
      
      const requestParams = {
        ...params,
        limit: limit,
        offset: offset
      };
      
      try {
        const response = this.apiClient.getReservations(requestParams);
        
        if (!response.success || !response.data) {
          throw new Error('予約情報の取得に失敗しました');
        }
        
        const reservations = Array.isArray(response.data) ? response.data : (response.data.items || []);
        const totalCount = response.data.count || 0;
        
        Logger.log(`${reservations.length}件を取得 (全${totalCount}件中)`);
        
        if (reservations.length === 0) {
          hasMore = false;
        } else {
          allReservations.push(...reservations);
          offset += limit;
          
          if (allReservations.length >= totalCount || reservations.length < limit) {
            hasMore = false;
          }
        }
        
        // API制限を考慮して少し待機
        if (hasMore) {
          Utilities.sleep(100);
        }
        
      } catch (error) {
        Logger.log(`APIエラー: ${error.toString()}`);
        syncStatus.completed = false;
        syncStatus.lastOffset = offset;
        syncStatus.totalSynced = allReservations.length;
        syncStatus.error = error.toString();
        return syncStatus;
      }
    }
    
    // スプレッドシートに書き込み
    if (allReservations.length > 0) {
      this._writeReservationsToSheetBatch(allReservations);
    }
    
    syncStatus.completed = true;
    syncStatus.lastOffset = 0;
    syncStatus.totalSynced = allReservations.length;
    
    Logger.log(`同期完了: ${allReservations.length}件`);
    
    return syncStatus;
  }
  
  /**
   * 日次増分同期（過去7日～今後7日分）
   * PHP経由版を優先的に使用
   */
  dailyIncrementalSync() {
    Logger.log('=== 日次増分同期開始 ===');
    
    // PHP経由での同期を試みる
    if (this.phpSyncEndpoint) {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        
        const result = this.syncReservationsViaPhp({
          date_from: Utils.formatDate(sevenDaysAgo),
          date_to: Utils.formatDate(sevenDaysLater)
        });
        
        Logger.log('PHP経由での日次同期完了');
        return result;
        
      } catch (error) {
        Logger.log(`PHP経由の同期に失敗、従来の方法にフォールバック: ${error.toString()}`);
      }
    }
    
    // 従来のGAS版同期
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    return this.syncReservationsWithTimeLimit();
  }
  
  /**
   * 週次同期（過去30日～今後1ヶ月分）
   * PHP経由版を優先的に使用
   */
  weeklySync() {
    Logger.log('=== 週次同期開始 ===');
    
    // PHP経由での同期を試みる
    if (this.phpSyncEndpoint) {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        
        const result = this.syncReservationsViaPhp({
          date_from: Utils.formatDate(thirtyDaysAgo),
          date_to: Utils.formatDate(oneMonthLater)
        });
        
        Logger.log('PHP経由での週次同期完了');
        return result;
        
      } catch (error) {
        Logger.log(`PHP経由の同期に失敗、従来の方法にフォールバック: ${error.toString()}`);
      }
    }
    
    // 従来のGAS版同期
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    
    const cache = CacheService.getScriptCache();
    cache.put('reservation_sync_status', JSON.stringify({
      completed: false,
      lastOffset: 0,
      dateFrom: Utils.formatDate(thirtyDaysAgo),
      dateTo: Utils.formatDate(oneMonthLater),
      totalSynced: 0
    }), 3600);
    
    return this.syncReservationsWithTimeLimit();
  }
  
  /**
   * 月次完全同期（今日～3ヶ月後）
   * PHP経由版を優先的に使用
   */
  monthlyFullSync() {
    Logger.log('=== 月次完全同期開始 ===');
    
    // PHP経由での同期を試みる
    if (this.phpSyncEndpoint) {
      try {
        const today = new Date();
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        
        const result = this.syncReservationsViaPhp({
          date_from: Utils.formatDate(today),
          date_to: Utils.formatDate(threeMonthsLater)
        });
        
        Logger.log('PHP経由での月次同期完了');
        return result;
        
      } catch (error) {
        Logger.log(`PHP経由の同期に失敗、従来の方法にフォールバック: ${error.toString()}`);
      }
    }
    
    // 従来のGAS版同期
    const today = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    const cache = CacheService.getScriptCache();
    cache.put('reservation_sync_status', JSON.stringify({
      completed: false,
      lastOffset: 0,
      dateFrom: Utils.formatDate(today),
      dateTo: Utils.formatDate(threeMonthsLater),
      totalSynced: 0
    }), 3600);
    
    return this.syncReservationsWithTimeLimit(300000); // 5分
  }
  
  /**
   * 更新された予約情報のみ同期
   */
  syncUpdatedReservations(lastSyncTime) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`更新予約同期: ${lastSyncTime}以降の変更を取得`);
      
      const response = this.apiClient.get(
        this.apiClient.config.endpoints.reservations,
        {
          updated_after: lastSyncTime,
          limit: 1000
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
   * 予約をキャンセル
   */
  cancelReservation(reservationId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`予約をキャンセルします: ID=${reservationId}`);
      
      // キャンセル前に予約情報を取得
      const reservation = this.getReservationById(reservationId);
      
      // APIでキャンセル
      const response = this.apiClient.delete(
        this.apiClient.config.endpoints.reservationById,
        {
          id: reservationId
        }
      );
      
      if (!response.success) {
        throw new Error('予約のキャンセルに失敗しました');
      }
      
      // スプレッドシートのステータスを更新
      this._updateReservationStatus(reservationId, 'キャンセル');
      
      // チケットを返却
      if (reservation && reservation.used_ticket_id) {
        this._restoreTicketByReservation(reservation);
      }
      
      return response.data;
    }, '予約キャンセル');
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
      Logger.log(`患者ID ${patientId} の予約情報を取得します`);
      
      const sheet = SpreadsheetManager.getSheetData(this.sheetName);
      
      // visitor_idまたはpatient_idで検索
      const patientReservations = sheet.filter(row => 
        row['visitor_id'] === patientId || row['patient_id'] === patientId
      );
      
      // 期間でフィルタリング
      let filteredReservations = patientReservations;
      
      if (params.date_from) {
        const fromDate = new Date(params.date_from);
        filteredReservations = filteredReservations.filter(row => {
          const reservationDate = new Date(row['予約日']);
          return reservationDate >= fromDate;
        });
      }
      
      if (params.date_to) {
        const toDate = new Date(params.date_to);
        filteredReservations = filteredReservations.filter(row => {
          const reservationDate = new Date(row['予約日']);
          return reservationDate <= toDate;
        });
      }
      
      // ステータスでフィルタリング
      if (params.status) {
        filteredReservations = filteredReservations.filter(row => 
          row['ステータス'] === params.status
        );
      }
      
      // 予約日時でソート（新しい順）
      filteredReservations.sort((a, b) => {
        const dateA = new Date(a['予約日'] + ' ' + a['予約時間']);
        const dateB = new Date(b['予約日'] + ' ' + b['予約時間']);
        return dateB - dateA;
      });
      
      return filteredReservations;
    }, '患者別予約情報取得');
  }
  
  /**
   * 予約情報をスプレッドシートに書き込み
   */
  _writeReservationsToSheet(reservations) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    
    // ヘッダーが存在しない場合は作成
    if (sheet.getLastRow() === 0) {
      this._createReservationHeaders(sheet);
    }
    
    // 既存データをクリア（ヘッダー以外）
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
    }
    
    // 予約データを行形式に変換
    const rows = reservations.map(reservation => this._reservationToRow(reservation));
    
    // 一括書き込み
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    Logger.log(`${rows.length}件の予約情報を書き込みました`);
  }
  
  /**
   * 予約情報をバッチでスプレッドシートに書き込み（高速版）
   */
  _writeReservationsToSheetBatch(reservations) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    const batchSize = 500; // バッチサイズ
    
    // ヘッダーが存在しない場合は作成
    if (sheet.getLastRow() === 0) {
      this._createReservationHeaders(sheet);
    }
    
    // 既存データをクリア（ヘッダー以外）
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
    }
    
    // バッチ処理で書き込み
    for (let i = 0; i < reservations.length; i += batchSize) {
      const batch = reservations.slice(i, i + batchSize);
      const rows = batch.map(reservation => this._reservationToRow(reservation));
      
      if (rows.length > 0) {
        const startRow = 2 + i;
        sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      }
      
      Logger.log(`バッチ書き込み: ${i + rows.length}/${reservations.length}件完了`);
      
      // GASの処理制限を考慮して少し待機
      if (i + batchSize < reservations.length) {
        Utilities.sleep(100);
      }
    }
    
    Logger.log(`合計${reservations.length}件の予約情報を書き込みました`);
  }
  
  /**
   * 予約情報をマージ（更新）
   */
  _mergeReservationsToSheet(reservations) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData[0];
    const reservationIdIndex = headers.indexOf('reservation_id');
    
    // 既存データをMapに変換（高速検索用）
    const existingMap = new Map();
    for (let i = 1; i < existingData.length; i++) {
      const reservationId = existingData[i][reservationIdIndex];
      if (reservationId) {
        existingMap.set(reservationId, i);
      }
    }
    
    // 更新・追加処理
    reservations.forEach(reservation => {
      const reservationId = reservation.id || reservation.reservation_id;
      const rowData = this._reservationToRow(reservation);
      
      if (existingMap.has(reservationId)) {
        // 既存レコードを更新
        const rowIndex = existingMap.get(reservationId);
        sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
      } else {
        // 新規レコードを追加
        sheet.appendRow(rowData);
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
    
    // patient_id、患者名、患者属性を取得
    // patient_id = 予約した人のvisitor_idなので、visitorIdをそのまま使用
    const patientId = visitorId;  // patient_id = 予約者のvisitor_id
    const patientName = visitorName;  // 患者名 = 予約者名
    
    // 患者属性を判定（初回/リピーターなど）
    let patientAttribute = '一般';  // デフォルト
    
    // 予約履歴から患者属性を判定（オプション）
    try {
      const historyCount = this.getReservationsByPatientId(patientId).length;
      if (historyCount === 0) {
        patientAttribute = '初回';
      } else if (historyCount >= 5) {
        patientAttribute = 'リピーター';
      }
    } catch (e) {
      Logger.log('患者属性判定エラー: ' + e.toString());
    }
    
    // 新しい列構成に対応（ヘッダーに合わせる）
    return [
      reservationId,                             // A列: reservation_id
      patientId,                                 // B列: patient_id (予約者のvisitor_id)
      patientName,                               // C列: 患者名 (予約者名)
      patientAttribute,                          // D列: 患者属性
      visitorId,                                 // E列: visitor_id
      visitorName,                               // F列: 予約者
      Utils.formatDate(startAt),                 // G列: 予約日
      Utils.formatDate(startAt, 'HH:mm'),       // H列: 予約時間
      endAt ? Utils.formatDate(endAt, 'HH:mm') : '', // I列: 終了時間
      menuName,                                  // J列: メニュー
      staffName,                                 // K列: 担当スタッフ
      this._getStatusLabel(reservation.status),  // L列: ステータス
      memo,                                      // M列: メモ
      Utils.formatDateTime(reservation.created_at), // N列: 作成日時
      Utils.formatDateTime(reservation.updated_at), // O列: 更新日時
      companyId,                                 // P列: 会社ID
      companyName,                               // Q列: 会社名
      memberType,                                // R列: 会員種別
      isPublic,                                  // S列: 公開設定
      roomId,                                    // T列: 部屋ID
      roomName                                   // U列: 部屋名
    ];
  }
  
  /**
   * ステータスラベルを取得
   */
  _getStatusLabel(status) {
    const statusMap = {
      'reserved': '予約済み',
      'confirmed': '確認済み',
      'arrived': '来院済み',
      'in_treatment': '施術中',
      'completed': '完了',
      'cancelled': 'キャンセル',
      'no_show': '無断キャンセル'
    };
    
    return statusMap[status] || status || '予約済み';
  }
  
  /**
   * 予約ステータスを更新
   */
  _updateReservationStatus(reservationId, newStatus) {
    const sheet = this.spreadsheetManager.getSheet(this.sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idIndex = headers.indexOf('reservation_id');
    const statusIndex = headers.indexOf('ステータス');
    const updatedAtIndex = headers.indexOf('更新日時');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === reservationId) {
        sheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
        sheet.getRange(i + 1, updatedAtIndex + 1).setValue(Utils.formatDateTime(new Date()));
        break;
      }
    }
  }
  
  /**
   * 予約ヘッダーを作成
   */
  _createReservationHeaders(sheet) {
    const headers = [
      'reservation_id',
      'patient_id',
      '患者名',
      '患者属性',
      'visitor_id',
      '予約者',
      '予約日',
      '予約時間',
      '終了時間',
      'メニュー',
      '担当スタッフ',
      'ステータス',
      'メモ',
      '作成日時',
      '更新日時',
      '会社ID',
      '会社名',
      '会員種別',
      '公開設定',
      '部屋ID',
      '部屋名'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // ヘッダーのスタイリング
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#f0f0f0');
    headerRange.setFontWeight('bold');
    
    // 列幅の自動調整
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  /**
   * 来院者の会社情報を取得
   */
  _getVisitorCompany(companyVisitorSheet, visitorId) {
    const data = companyVisitorSheet.getDataRange().getValues();
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
          companyName: data[i][companyNameIndex],
          memberType: data[i][memberTypeIndex],
          isPublic: data[i][isPublicIndex] === '公開'
        };
      }
    }
    
    return null;
  }
  
  /**
   * チケット自動消費処理
   */
  _consumeTicketForReservation(reservationData) {
    // TODO: チケット管理サービスと連携
    return {
      consumed: false,
      ticketId: null,
      alert: null
    };
  }
  
  /**
   * チケット返却処理
   */
  _restoreTicket(ticketResult) {
    // TODO: チケット管理サービスと連携
  }
  
  /**
   * 予約情報からチケット返却
   */
  _restoreTicketByReservation(reservation) {
    // TODO: チケット管理サービスと連携
  }
  
  /**
   * 会社別会員向け通知
   */
  _sendCompanyMemberNotification(reservation, bookedBy) {
    // TODO: 通知サービスと連携
  }
}