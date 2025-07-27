/**
 * PHP連携用統合API
 * LINE IDから患者情報、予約情報、施術履歴などを一括取得
 * 
 * このファイルは既存のWebApi.jsとは独立して動作し、
 * PHP側のLINE予約システムとの連携に特化したAPIを提供します。
 */

/**
 * POST リクエストのエントリーポイント
 * @param {Object} e - リクエストイベント
 * @param {Object} requestData - パース済みのリクエストデータ
 * @return {TextOutput} JSONレスポンス
 */
function doPostPhpIntegration(e, requestData) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  
  try {
    Logger.log('PHP Integration API POSTリクエスト開始');
    Logger.log('リクエストデータ: ' + JSON.stringify(requestData));
    
    // APIキー認証
    if (!validatePhpApiKeyPost(requestData)) {
      const errorResponse = {
        status: 'error',
        error: {
          code: 'INVALID_API_KEY',
          message: 'APIキーが無効です',
          details: null
        }
      };
      return response.setContent(JSON.stringify(errorResponse));
    }
    
    // ルーティング処理
    const result = routePhpApiPostRequest(requestData);
    Logger.log('PHP Integration API POSTレスポンス: ' + JSON.stringify(result));
    return response.setContent(JSON.stringify(result));
    
  } catch (error) {
    Logger.log('PHP Integration API POST Error: ' + error.toString());
    const errorResponse = {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: error.toString()
      }
    };
    return response.setContent(JSON.stringify(errorResponse));
  }
}

/**
 * POSTリクエスト用APIキー認証
 * @param {Object} requestData - リクエストデータ
 * @return {boolean} 認証成功/失敗
 */
function validatePhpApiKeyPost(requestData) {
  const authHeader = requestData.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    Logger.log('PHP API Auth Error: Bearerトークンが見つかりません');
    return false;
  }
  
  const token = authHeader.substring(7);
  const scriptProperties = PropertiesService.getScriptProperties();
  const validTokens = (scriptProperties.getProperty('PHP_API_KEYS') || '').split(',').filter(t => t.trim());
  
  const isValid = validTokens.includes(token);
  if (!isValid) {
    Logger.log('PHP API Auth Error: 無効なAPIキー');
  }
  
  return isValid;
}

/**
 * POSTリクエストのルーティング
 * @param {Object} requestData - リクエストデータ
 * @return {Object} レスポンスオブジェクト
 */
function routePhpApiPostRequest(requestData) {
  let path = requestData.path || '';
  
  // pathにクエリストリングが含まれている場合の処理（GETと同様）
  if (path.includes('?')) {
    const [basePath, queryString] = path.split('?');
    path = basePath;
    
    // クエリストリングをパースしてrequestDataに追加
    const params = queryString.split('&');
    params.forEach(param => {
      const [key, value] = param.split('=');
      if (key && value && !requestData[key]) {
        requestData[key] = decodeURIComponent(value);
      }
    });
    
    Logger.log(`PHP API POST Request - Base Path: ${path}`);
    Logger.log(`PHP API POST Request - Parsed Data: ${JSON.stringify(requestData)}`);
  } else {
    Logger.log(`PHP API POST Request: ${path}`);
  }
  
  const pathParts = path.split('/').filter(p => p);
  
  // /api/visitors - 来院者登録
  if (pathParts.length === 2 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'visitors') {
    
    return createCompanyVisitor(requestData);
  }
  
  // /api/company/{company_id}/visitors/{visitor_id}/visibility - 公開設定切り替え
  if (pathParts.length === 6 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'company' && 
      pathParts[3] === 'visitors' && 
      pathParts[5] === 'visibility') {
    
    const companyId = pathParts[2];
    const visitorId = pathParts[4];
    
    return updateVisitorVisibility(companyId, visitorId, requestData);
  }
  
  // /api/notifications/line/send - LINE通知送信
  if (pathParts.length === 4 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'notifications' && 
      pathParts[2] === 'line' && 
      pathParts[3] === 'send') {
    
    return sendLineNotification(requestData);
  }
  
  // /api/notifications/line/schedule - LINE通知スケジュール
  if (pathParts.length === 4 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'notifications' && 
      pathParts[2] === 'line' && 
      pathParts[3] === 'schedule') {
    
    return scheduleLineNotification(requestData);
  }
  
  return {
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: '指定されたエンドポイントが見つかりません',
      details: `Path: ${path}`
    }
  };
}

/**
 * GET リクエストのエントリーポイント
 * @param {Object} e - リクエストパラメータ
 * @return {TextOutput} JSONレスポンス
 */
function doGetPhpIntegration(e) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  
  try {
    Logger.log('PHP Integration API リクエスト開始');
    Logger.log('受信パラメータ: ' + JSON.stringify(e.parameter));
    
    // APIキー認証
    if (!validatePhpApiKey(e)) {
      const errorResponse = {
        status: 'error',
        error: {
          code: 'INVALID_API_KEY',
          message: 'APIキーが無効です',
          details: null
        }
      };
      return response.setContent(JSON.stringify(errorResponse));
    }
    
    // ルーティング処理
    const result = routePhpApiRequest(e);
    Logger.log('PHP Integration API レスポンス: ' + JSON.stringify(result));
    return response.setContent(JSON.stringify(result));
    
  } catch (error) {
    Logger.log('PHP Integration API Error: ' + error.toString());
    const errorResponse = {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: error.toString()
      }
    };
    return response.setContent(JSON.stringify(errorResponse));
  }
}

/**
 * APIキー認証
 * @param {Object} e - リクエストパラメータ
 * @return {boolean} 認証成功/失敗
 */
function validatePhpApiKey(e) {
  // GETリクエストの場合、authorizationパラメータもチェック
  const authHeader = e.parameter.authorization || e.parameter.Authorization;
  
  // ヘルスチェックやテスト用に、APIキーがない場合も一時的に許可
  const path = e.parameter.path || '';
  if (path === 'api/health' || path === '' || path === 'api') {
    Logger.log('PHP API: ヘルスチェックリクエストのため認証をスキップ');
    return true;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    Logger.log('PHP API Auth Error: Bearerトークンが見つかりません');
    Logger.log('受信パラメータ: ' + JSON.stringify(e.parameter));
    return false;
  }
  
  const token = authHeader.substring(7);
  const scriptProperties = PropertiesService.getScriptProperties();
  const validTokens = (scriptProperties.getProperty('PHP_API_KEYS') || '').split(',').filter(t => t.trim());
  
  // 複数のAPIキーに対応
  const isValid = validTokens.includes(token);
  if (!isValid) {
    Logger.log('PHP API Auth Error: 無効なAPIキー');
    Logger.log('受信トークン: ' + token);
    Logger.log('有効なトークン: ' + validTokens.join(', '));
  }
  
  return isValid;
}

/**
 * リクエストのルーティング
 * @param {Object} e - リクエストパラメータ
 * @return {Object} レスポンスオブジェクト
 */
function routePhpApiRequest(e) {
  let path = e.parameter.path || '';
  
  // pathにクエリストリングが含まれている場合の処理
  if (path.includes('?')) {
    const [basePath, queryString] = path.split('?');
    path = basePath;
    
    // クエリストリングをパースしてe.parameterに追加
    const params = queryString.split('&');
    params.forEach(param => {
      const [key, value] = param.split('=');
      if (key && value && !e.parameter[key]) {
        e.parameter[key] = decodeURIComponent(value);
      }
    });
    
    Logger.log(`PHP API Request - Base Path: ${path}`);
    Logger.log(`PHP API Request - Parsed Parameters: ${JSON.stringify(e.parameter)}`);
  } else {
    Logger.log(`PHP API Request: ${path}`);
  }
  
  const pathParts = path.split('/').filter(p => p);
  
  // /api/health - ヘルスチェック
  if (pathParts.length === 2 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'health') {
    
    return {
      status: 'success',
      data: {
        message: 'API is working',
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };
  }
  
  // パスが空またはapiのみの場合もヘルスチェック
  if (pathParts.length === 0 || 
      (pathParts.length === 1 && pathParts[0] === 'api')) {
    
    return {
      status: 'success',
      data: {
        message: 'Medical Force API Bridge is working',
        timestamp: new Date().toISOString(),
        version: '1.0',
        available_endpoints: [
          'GET /api/health',
          'GET /api/users/line/{lineUserId}/full',
          'GET /api/reservations/history?member_type={main|sub}&date={YYYY-MM-DD}&company_id={会社ID}',
          'GET /api/company/{company_id}/visitors',
          'POST /api/visitors',
          'PUT /api/company/{company_id}/visitors/{visitor_id}/visibility',
          'GET /api/patients/{visitorId}/menus',
          'GET /api/patients/{visitorId}/available-slots?menuId={menuId}&date={date}&dateRange={days}&includeRoomInfo={boolean}',
          'GET /api/documents?visitor_id={来院者ID}'
        ]
      }
    };
  }
  
  // /api/users/line/{lineUserId}/full
  if (pathParts.length === 5 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'users' && 
      pathParts[2] === 'line' && 
      pathParts[4] === 'full') {
    
    const lineUserId = pathParts[3];
    return getUserFullInfoByLineIdFormatted(lineUserId);
  }
  
  // /api/reservations/history - 予約履歴取得
  if (pathParts.length === 3 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'reservations' && 
      pathParts[2] === 'history') {
    
    // パラメータ取得
    const memberType = e.parameter.member_type;
    const date = e.parameter.date;
    const companyId = e.parameter.company_id;
    
    // 必須パラメータチェック
    if (!memberType) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'member_typeパラメータが必要です',
          details: null
        }
      };
    }
    
    if (!date) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'dateパラメータが必要です',
          details: null
        }
      };
    }
    
    if (!companyId) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'company_idパラメータが必要です',
          details: null
        }
      };
    }
    
    // メンバータイプの検証
    if (memberType !== 'main' && memberType !== 'sub') {
      return {
        status: 'error',
        error: {
          code: 'INVALID_PARAMETER',
          message: 'member_typeは「本会員」または「サブ会員」である必要があります',
          details: `指定された値: ${memberType}`
        }
      };
    }
    
    return getReservationHistory(memberType, date, companyId);
  }
  
  // /api/company/{company_id}/visitors - 会社別来院者一覧取得
  if (pathParts.length === 4 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'company' && 
      pathParts[3] === 'visitors') {
    
    const companyId = pathParts[2];
    
    // 必須パラメータチェック
    if (!companyId) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'company_idパラメータが必要です',
          details: null
        }
      };
    }
    
    return getCompanyVisitorsList(companyId);
  }
  
  // /api/documents - 書類一覧取得
  if (pathParts.length === 2 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'documents') {
    
    const visitorId = e.parameter.visitor_id;
    
    // 必須パラメータチェック
    if (!visitorId) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'visitor_idパラメータが必要です',
          details: null
        }
      };
    }
    
    return getPatientDocuments(visitorId);
  }
  
  // /api/patients/{visitorId}/menus - 患者別メニュー取得
  if (pathParts.length === 4 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'patients' && 
      pathParts[3] === 'menus') {
    
    const visitorId = pathParts[2];
    Logger.log(`患者メニューAPI呼び出し: visitorId=${visitorId}`);
    
    return handleGetPatientMenus(visitorId);
  }
  
  // /api/patients/{visitorId}/available-slots - 患者別予約可能スロット
  if (pathParts.length === 4 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'patients' && 
      pathParts[3] === 'available-slots') {
    
    const visitorId = pathParts[2];
    const menuId = e.parameter.menu_id || e.parameter.menuId;
    const date = e.parameter.date;
    const dateRange = parseInt(e.parameter.date_range || e.parameter.dateRange || '7');
    const includeRoomInfo = e.parameter.include_room_info === 'true' || e.parameter.includeRoomInfo === 'true';
    const pairBooking = e.parameter.pair_booking === 'true' || e.parameter.pairBooking === 'true';
    const allowMultipleSameDay = e.parameter.allow_multiple_same_day === 'true' || e.parameter.allowMultipleSameDay === 'true';
    
    Logger.log(`患者別空きスロットAPI呼び出し: visitorId=${visitorId}, menuId=${menuId}, date=${date}`);
    
    return getPatientAvailableSlots({
      visitorId: visitorId,
      menuId: menuId,
      date: date,
      dateRange: dateRange,
      includeRoomInfo: includeRoomInfo,
      pairBooking: pairBooking,
      allowMultipleSameDay: allowMultipleSameDay
    });
  }
  
  // /api/notifications/line/templates - LINE通知テンプレート一覧
  if (pathParts.length === 4 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'notifications' && 
      pathParts[2] === 'line' && 
      pathParts[3] === 'templates') {
    
    return getLineNotificationTemplates();
  }
  
  // /api/notifications/line/status/{notificationId} - LINE通知ステータス
  if (pathParts.length === 5 && 
      pathParts[0] === 'api' && 
      pathParts[1] === 'notifications' && 
      pathParts[2] === 'line' && 
      pathParts[3] === 'status') {
    
    const notificationId = pathParts[4];
    return getLineNotificationStatus(notificationId);
  }
  
  return {
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: '指定されたエンドポイントが見つかりません',
      details: `Path: ${path}`
    }
  };
}

/**
 * LINE IDから全情報を一括取得
 * @param {string} lineUserId - LINE ユーザーID
 * @return {Object} 統合レスポンス
 */
function getUserFullInfoByLineId(lineUserId) {
  try {
    Logger.log(`getUserFullInfoByLineId: LINE IDから全情報取得開始: ${lineUserId}`);
    
    // 1. 基本的なユーザー情報を取得
    Logger.log(`getUserFullInfoByLineId: ステップ1 - ユーザー情報取得`);
    const userInfo = getPhpUserByLineId(lineUserId);
    if (!userInfo) {
      Logger.log(`getUserFullInfoByLineId: ユーザー情報が見つかりません - LINE ID: ${lineUserId}`);
      return {
        status: 'error',
        error: {
          code: 'USER_NOT_FOUND',
          message: '指定されたLINE IDのユーザーが見つかりません',
          details: null
        }
      };
    }
    
    const visitorId = userInfo.id;
    Logger.log(`getUserFullInfoByLineId: ユーザー情報取得成功 - visitor_id: ${visitorId}`);
    
    // 2. 各種情報を順次取得（デバッグ用）
    Logger.log(`getUserFullInfoByLineId: ステップ2 - 患者詳細情報取得`);
    const patientInfo = getPhpPatientInfo(visitorId);
    
    Logger.log(`getUserFullInfoByLineId: ステップ3 - 施術履歴取得`);
    const treatmentHistory = getPhpTreatmentHistory(visitorId);
    
    Logger.log(`getUserFullInfoByLineId: ステップ4 - 今後の予約取得`);
    const upcomingReservations = getPhpUpcomingReservations(visitorId);
    
    Logger.log(`getUserFullInfoByLineId: ステップ5 - 予約可能施術取得`);
    const availableTreatments = getPhpAvailableTreatments(visitorId);
    
    Logger.log(`getUserFullInfoByLineId: ステップ6 - 会員情報取得`);
    const membershipInfo = getPhpMembershipInfo(visitorId);
    
    Logger.log(`getUserFullInfoByLineId: ステップ7 - 統計情報取得`);
    const statistics = getPhpStatistics(visitorId);
    
    // 3. レスポンスを構築
    const response = {
      status: 'success',
      data: {
        user: userInfo,
        patient_info: patientInfo,
        treatment_history: treatmentHistory,
        upcoming_reservations: upcomingReservations,
        available_treatments: availableTreatments,
        membership_info: membershipInfo,
        statistics: statistics
      }
    };
    
    Logger.log(`getUserFullInfoByLineId: 正常完了`);
    return response;
    
  } catch (error) {
    Logger.log(`getUserFullInfoByLineId Error: ${error.toString()}`);
    Logger.log(`getUserFullInfoByLineId Error Stack: ${error.stack}`);
    throw error;
  }
}

/**
 * LINE IDからユーザーの全情報を取得（指定形式のJSON）
 * @param {string} lineUserId - LINE ユーザーID
 * @return {Object} 指定形式のユーザー情報
 */
function getUserFullInfoByLineIdFormatted(lineUserId) {
  try {
    Logger.log(`=== getUserFullInfoByLineIdFormatted START ===`);
    Logger.log(`LINE ID: ${lineUserId}`);
    
    // 1. 基本的なユーザー情報を取得
    Logger.log(`ステップ1: ユーザー情報取得開始`);
    let userInfo;
    try {
      userInfo = getPhpUserByLineId(lineUserId);
      if (!userInfo) {
        Logger.log(`ユーザー情報が見つかりません`);
        return {
          error: "指定されたLINE IDのユーザーが見つかりません"
        };
      }
      Logger.log(`ユーザー情報取得成功: ${JSON.stringify(userInfo)}`);
    } catch (userError) {
      Logger.log(`ユーザー情報取得エラー: ${userError.toString()}`);
      return {
        error: "ユーザー情報の取得中にエラーが発生しました: " + userError.message
      };
    }
    
    const visitorId = userInfo.id;
    Logger.log(`visitor_id: ${visitorId}`);
    
    // 2. 会社情報を取得
    Logger.log(`ステップ2: 会社情報取得開始`);
    let companyData = null;
    let companyInfo = {
      company_id: null,
      name: null,
      plan: null
    };
    
    try {
      const companyVisitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
        .getSheetByName(Config.getSheetNames().companyVisitors);
      
      if (companyVisitorSheet) {
        const data = companyVisitorSheet.getDataRange().getValues();
        Logger.log(`会社別来院者シートのデータ行数: ${data.length}`);
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][2] === visitorId) { // visitor_id列
            companyData = {
              companyId: data[i][0],
              companyName: data[i][1],
              memberType: data[i][6] || 'サブ会員',
              isPublic: data[i][7]
            };
            Logger.log(`会社情報発見: ${JSON.stringify(companyData)}`);
            break;
          }
        }
        
        if (companyData) {
          // 会社マスタからプラン情報を取得
          try {
            const companyMasterSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
              .getSheetByName('会社マスタ');
            if (companyMasterSheet) {
              const companyMasterData = companyMasterSheet.getDataRange().getValues();
              for (let i = 1; i < companyMasterData.length; i++) {
                if (companyMasterData[i][0] === companyData.companyId) {
                  companyInfo = {
                    company_id: companyData.companyId,
                    name: companyData.companyName,
                    plan: companyMasterData[i][2] || null
                  };
                  Logger.log(`プラン情報取得成功: ${JSON.stringify(companyInfo)}`);
                  break;
                }
              }
            }
          } catch (planError) {
            Logger.log(`プラン情報取得エラー: ${planError.toString()}`);
            // エラーでも基本情報は設定
            companyInfo = {
              company_id: companyData.companyId,
              name: companyData.companyName,
              plan: null
            };
          }
        } else {
          Logger.log(`visitor_id ${visitorId} に対する会社情報が見つかりません`);
        }
      } else {
        Logger.log(`会社別来院者シートが見つかりません`);
      }
    } catch (companyError) {
      Logger.log(`会社情報取得エラー: ${companyError.toString()}`);
      // エラーでもデフォルト情報で続行
    }
    
    // 3. チケット情報を取得
    Logger.log(`ステップ3: チケット情報取得開始`);
    let ticketInfo = [];
    if (companyData) {
      try {
        Logger.log(`チケット情報取得開始 - companyId: ${companyData.companyId}`);
        const tickets = getPhpTicketBalance(companyData.companyId);
        Logger.log(`getPhpTicketBalance結果: ${JSON.stringify(tickets)}`);
        ticketInfo = formatTicketInfoForJson(tickets);
        Logger.log(`formatTicketInfoForJson結果: ${JSON.stringify(ticketInfo)}`);
      } catch (ticketError) {
        Logger.log(`チケット情報取得エラー: ${ticketError.toString()}`);
        // デフォルトのチケット情報を設定
        ticketInfo = [
          {
            treatment_id: "stem_cell",
            treatment_name: "幹細胞",
            remaining_count: 0,
            used_count: 0,
            available_count: 0,
            last_used_date: null
          },
          {
            treatment_id: "treatment",
            treatment_name: "施術",
            remaining_count: 0,
            used_count: 0,
            available_count: 0,
            last_used_date: null
          },
          {
            treatment_id: "drip",
            treatment_name: "点滴",
            remaining_count: 0,
            used_count: 0,
            available_count: 0,
            last_used_date: null
          }
        ];
      }
    } else {
      Logger.log(`会社情報がないため、チケット情報取得をスキップ`);
      ticketInfo = [];
    }
    
    // 4. 書類情報を取得
    Logger.log(`ステップ4: 書類情報取得開始`);
    let docsinfo = [];
    try {
      const documentService = new DocumentService();
      const documents = documentService.getDocuments({ visitorId: visitorId });
      Logger.log(`書類取得結果: ${JSON.stringify(documents)}`);
      docsinfo = formatDocumentInfoForJson(documents);
      Logger.log(`書類フォーマット結果: ${JSON.stringify(docsinfo)}`);
    } catch (docError) {
      Logger.log(`書類情報取得エラー: ${docError.toString()}`);
      docsinfo = [];
    }
    
    // 5. 予約履歴を取得
    Logger.log(`ステップ5: 予約履歴取得開始`);
    let reservationHistory = [];
    try {
      const reservationService = new ReservationService();
      const reservations = reservationService.getReservationsByPatientId(visitorId);
      Logger.log(`予約履歴取得結果: ${JSON.stringify(reservations)}`);
      reservationHistory = formatReservationHistoryForJson(reservations);
      Logger.log(`予約履歴フォーマット結果: ${JSON.stringify(reservationHistory)}`);
    } catch (reservationError) {
      Logger.log(`予約履歴取得エラー: ${reservationError.toString()}`);
      reservationHistory = [];
    }
    
    // 6. 指定された形式でレスポンスを構築
    Logger.log(`ステップ6: レスポンス構築開始`);
    
    // member_typeを真偽値に変換
    const memberType = companyData?.memberType === '本会員' ? true : false;
    
    const response = {
      visitor: {
        visitor_id: visitorId,
        visitor_name: userInfo.name || userInfo.visitor_name || '',
        member_type: memberType
      },
      company: companyInfo,
      ticketInfo: ticketInfo,
      docsinfo: docsinfo,
      ReservationHistory: reservationHistory
    };
    
    Logger.log(`最終レスポンス: ${JSON.stringify(response)}`);
    Logger.log(`=== getUserFullInfoByLineIdFormatted END (SUCCESS) ===`);
    return response;
    
  } catch (error) {
    Logger.log(`=== getUserFullInfoByLineIdFormatted END (ERROR) ===`);
    Logger.log(`Fatal Error: ${error.toString()}`);
    Logger.log(`Error Stack: ${error.stack}`);
    return {
      error: error.message || "データ取得中にエラーが発生しました"
    };
  }
}

/**
 * getUserFullInfoByLineIdFormattedのテスト版
 * 段階的な実装とデバッグのために使用
 * @param {string} lineUserId - LINE ユーザーID
 * @return {Object} フォーマット済みユーザー情報またはエラー
 */
function getUserFullInfoByLineIdFormattedTest(lineUserId) {
  try {
    Logger.log(`=== getUserFullInfoByLineIdFormattedTest START ===`);
    Logger.log(`LINE ID: ${lineUserId}`);
    
    // ステップ1: 基本的なユーザー情報のみ取得してテスト
    Logger.log(`ステップ1: ユーザー情報取得開始`);
    let userInfo;
    try {
      userInfo = getPhpUserByLineId(lineUserId);
      if (!userInfo) {
        Logger.log(`ユーザー情報が見つかりません`);
        return {
          error: "指定されたLINE IDのユーザーが見つかりません"
        };
      }
      Logger.log(`ユーザー情報取得成功: ${JSON.stringify(userInfo)}`);
    } catch (userError) {
      Logger.log(`ユーザー情報取得エラー: ${userError.toString()}`);
      return {
        error: "ユーザー情報の取得中にエラーが発生しました: " + userError.message
      };
    }
    
    // テスト段階では基本情報のみ返す
    const testResponse = {
      visitor: {
        visitor_id: userInfo.visitor_id || '',
        visitor_name: userInfo.name || userInfo.visitor_name || '',
        member_type: userInfo.member_type || 'sub'
      },
      company: {
        company_id: userInfo.company_id || '',
        company_name: userInfo.company_name || '',
        plan_name: userInfo.plan_name || ''
      },
      ticketInfo: [
        {
          treatment_id: "stem_cell",
          treatment_name: "幹細胞",
          remaining_count: 0,
          used_count: 0,
          available_count: 0,
          last_used_date: null
        },
        {
          treatment_id: "treatment", 
          treatment_name: "施術",
          remaining_count: 0,
          used_count: 0,
          available_count: 0,
          last_used_date: null
        },
        {
          treatment_id: "drip",
          treatment_name: "点滴",
          remaining_count: 0,
          used_count: 0,
          available_count: 0,
          last_used_date: null
        }
      ],
      docsinfo: [],
      ReservationHistory: []
    };
    
    Logger.log(`テスト版レスポンス: ${JSON.stringify(testResponse)}`);
    Logger.log(`=== getUserFullInfoByLineIdFormattedTest END (SUCCESS) ===`);
    return testResponse;
    
  } catch (error) {
    Logger.log(`=== getUserFullInfoByLineIdFormattedTest END (ERROR) ===`);
    Logger.log(`Test Fatal Error: ${error.toString()}`);
    Logger.log(`Test Error Stack: ${error.stack}`);
    return {
      error: error.message || "テスト版でエラーが発生しました"
    };
  }
}

/**
 * チケット情報を指定形式に変換
 * @param {Array} tickets - チケット情報の配列
 * @return {Array} 変換されたチケット情報
 */
function formatTicketInfoForJson(tickets) {
  try {
    Logger.log(`formatTicketInfoForJson 開始 - tickets: ${JSON.stringify(tickets)}`);
    
    // 入力値の詳細検証
    if (tickets === null || tickets === undefined) {
      Logger.log('formatTicketInfoForJson: ticketsがnullまたはundefined、デフォルト値を使用');
    } else if (typeof tickets !== 'object') {
      Logger.log(`formatTicketInfoForJson: tickets型が無効 - ${typeof tickets}, デフォルト値を使用`);
      tickets = null;
    } else {
      Logger.log('formatTicketInfoForJson: 有効なtickets オブジェクトを受信');
    }
    
    // ticketsがnullまたはundefinedの場合のデフォルト値
    const defaultTickets = {
      stem_cell: { balance: 0, used: 0, last_used_date: null },
      treatment: { balance: 0, used: 0, last_used_date: null },
      drip: { balance: 0, used: 0, last_used_date: null }
    };
    
    const safeTickets = tickets || defaultTickets;
    Logger.log(`formatTicketInfoForJson: 処理するチケット情報 - ${JSON.stringify(safeTickets)}`);
    
    // 各チケットタイプの処理で個別エラーハンドリング
    const ticketTypes = ['stem_cell', 'treatment', 'drip'];
    const treatmentNames = {
      stem_cell: '幹細胞',
      treatment: '施術', 
      drip: '点滴'
    };
    
    const result = [];
    
    for (const ticketType of ticketTypes) {
      try {
        const ticketData = safeTickets[ticketType] || {};
        Logger.log(`formatTicketInfoForJson: ${ticketType}の処理 - ${JSON.stringify(ticketData)}`);
        
        // 数値の安全な変換
        const balance = parseInt(ticketData.balance) || 0;
        const used = parseInt(ticketData.used) || 0;
        
        // 日付の安全な処理
        let lastUsedDate = null;
        if (ticketData.last_used_date) {
          try {
            // 日付が既に文字列形式の場合はそのまま使用、Dateオブジェクトの場合は変換
            lastUsedDate = typeof ticketData.last_used_date === 'string' 
              ? ticketData.last_used_date 
              : formatDate(ticketData.last_used_date);
          } catch (dateError) {
            Logger.log(`formatTicketInfoForJson: ${ticketType}の日付変換エラー - ${dateError.toString()}`);
            lastUsedDate = null;
          }
        }
        
        const ticketInfo = {
          treatment_id: ticketType,
          treatment_name: treatmentNames[ticketType],
          remaining_count: balance,
          used_count: used,
          available_count: balance,
          last_used_date: lastUsedDate
        };
        
        result.push(ticketInfo);
        Logger.log(`formatTicketInfoForJson: ${ticketType}の処理完了 - ${JSON.stringify(ticketInfo)}`);
        
      } catch (ticketError) {
        Logger.log(`formatTicketInfoForJson: ${ticketType}の処理中エラー - ${ticketError.toString()}`);
        
        // エラー時もデフォルト値で追加
        result.push({
          treatment_id: ticketType,
          treatment_name: treatmentNames[ticketType],
          remaining_count: 0,
          used_count: 0,
          available_count: 0,
          last_used_date: null
        });
      }
    }
    
    Logger.log(`formatTicketInfoForJson 完了 - 結果: ${JSON.stringify(result)}`);
    return result;
    
  } catch (error) {
    Logger.log(`formatTicketInfoForJson 致命的エラー: ${error.toString()}`);
    Logger.log(`formatTicketInfoForJson エラースタック: ${error.stack}`);
    
    // 致命的エラー時も最低限のデフォルト値を返す
    return [
      {
        treatment_id: "stem_cell",
        treatment_name: "幹細胞",
        remaining_count: 0,
        used_count: 0,
        available_count: 0,
        last_used_date: null
      },
      {
        treatment_id: "treatment", 
        treatment_name: "施術",
        remaining_count: 0,
        used_count: 0,
        available_count: 0,
        last_used_date: null
      },
      {
        treatment_id: "drip",
        treatment_name: "点滴",
        remaining_count: 0,
        used_count: 0,
        available_count: 0,
        last_used_date: null
      }
    ];
  }
}

/**
 * 書類情報を指定形式に変換
 * @param {Array} documents - 書類情報の配列
 * @return {Array} 変換された書類情報
 */
function formatDocumentInfoForJson(documents) {
  try {
    // フォルダ名でグループ化したオブジェクトを作成
    const documentsByFolder = {};
    
    documents.forEach(doc => {
      // URLの生成（優先順位: 1.既存URL 2.Google Drive URL 3.APIエンドポイント）
      let docsUrl = doc.url;
      if (!docsUrl && doc.documentId) {
        // Google DriveのファイルIDとして扱う場合
        if (doc.documentId.match(/^[a-zA-Z0-9_-]{20,}/)) {
          docsUrl = `https://drive.google.com/file/d/${doc.documentId}/view`;
        } else {
          // APIエンドポイントとして扱う場合
          docsUrl = `${getWebAppUrl()}/exec?action=getDocument&id=${doc.documentId}`;
        }
      }
      
      // ドキュメント情報の作成
      const documentInfo = {
        docs_id: doc.documentId || doc.id || `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        docs_name: doc.title || doc.documentName || doc.name || "書類",
        docs_url: docsUrl || '#',
        created_at: doc.createdAt ? formatDateString(doc.createdAt) : null,
        treatment_name: doc.treatmentName || null,
        notes: doc.notes || null
      };

      // フォルダ名の決定（空の場合は「その他書類」）
      const folderName = doc.folderName || 'その他書類';

      // フォルダごとの配列に追加
      if (!documentsByFolder[folderName]) {
        documentsByFolder[folderName] = {
          name: folderName,
          documents: []
        };
      }
      documentsByFolder[folderName].documents.push(documentInfo);
    });

    // オブジェクトを配列に変換
    const result = Object.values(documentsByFolder);
    
    Logger.log(`formatDocumentInfoForJson result: ${JSON.stringify(result)}`);
    return { foldername: result };

  } catch (error) {
    Logger.log(`formatDocumentInfoForJson Error: ${error.toString()}`);
    return { foldername: [] };
  }
}

/**
 * WebアプリのURLを取得
 * @return {string} WebアプリのベースURL
 */
function getWebAppUrl() {
  try {
    // デプロイされたWebアプリのURLを取得
    return ScriptApp.getService().getUrl();
  } catch (error) {
    // 開発環境の場合はデフォルトURLを返す
    return 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
  }
}

/**
 * 予約履歴を指定形式に変換
 * @param {Array} reservations - 予約情報の配列
 * @return {Array} 変換された予約履歴
 */
function formatReservationHistoryForJson(reservations) {
  try {
    return reservations.map(reservation => ({
      history_id: reservation.history_id || reservation.id,
      reservename: reservation.reservename || reservation.treatment_name || "施術",
      reservedate: formatDateString(reservation.reservedate || reservation.reservation_date),
      reservetime: reservation.reservetime || reservation.reservation_time,
      reservestatus: reservation.reservestatus || reservation.reservation_status,
      reservepatient: reservation.reservepatient || reservation.patient_name,
      patient_id: reservation.patient_id || '',
      patient_name: reservation.patient_name || '',
      patient_type: reservation.patient_type || '',
      visitor_id: reservation.visitor_id || '',
      end_time: reservation.end_time || '',
      staff: reservation.staff || '',
      notes: reservation.notes || '',
      created_at: reservation.created_at || '',
      updated_at: reservation.updated_at || '',
      company_id: reservation.company_id || '',
      company_name: reservation.company_name || '',
      room_id: reservation.room_id || '',
      room_name: reservation.room_name || ''
    }));
  } catch (error) {
    Logger.log(`formatReservationHistoryForJson Error: ${error.toString()}`);
    return [];
  }
}

/**
 * 日付を YYYY-MM-DD 形式に変換
 * @param {Date|string} date - 日付
 * @return {string} フォーマットされた日付文字列
 */
function formatDateString(date) {
  try {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return "";
  }
}

/**
 * 予約ステータスを日本語に変換
 * @param {string} status - ステータス
 * @return {string} 日本語のステータス
 */
function convertReservationStatus(status) {
  const statusMap = {
    'completed': '来院済み',
    'confirmed': '予約済み',
    'pending': '予約中',
    'cancelled': 'キャンセル',
    'no_show': '無断キャンセル'
  };
  return statusMap[status?.toLowerCase()] || status || '不明';
}

/**
 * LINE IDからユーザー基本情報を取得
 * @param {string} lineUserId - LINE ユーザーID
 * @return {Object|null} ユーザー情報
 */
function getPhpUserByLineId(lineUserId) {
  try {
    Logger.log(`LINE IDでユーザー検索開始: ${lineUserId}`);
    
    // 1. まず会社別来院者管理シートで検索
    const companyVisitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().companyVisitors);
    
    if (companyVisitorSheet) {
      const companyData = companyVisitorSheet.getDataRange().getValues();
      const headers = companyData[0];
      
      // ヘッダー情報をログ出力（デバッグ用）
      Logger.log(`会社別来院者管理シートのヘッダー: ${JSON.stringify(headers)}`);
      
      // カラムインデックスを動的に取得
      const companyVisitorIdIndex = headers.indexOf('visitor_id');
      const companyLineIdIndex = headers.indexOf('LINE_ID');
      const companyLineDisplayNameIndex = headers.indexOf('LINE表示名');
      
      Logger.log(`カラムインデックス - visitor_id: ${companyVisitorIdIndex}, LINE_ID: ${companyLineIdIndex}, LINE表示名: ${companyLineDisplayNameIndex}`);
      
      // インデックスが見つからない場合は固定値を使用（後方互換性）
      const visitorIdCol = companyVisitorIdIndex >= 0 ? companyVisitorIdIndex : 2; // C列
      const lineIdCol = companyLineIdIndex >= 0 ? companyLineIdIndex : 4; // E列 
      const lineDisplayNameCol = companyLineDisplayNameIndex >= 0 ? companyLineDisplayNameIndex : 12; // M列
      
      Logger.log(`使用するカラムインデックス - visitor_id: ${visitorIdCol}, LINE_ID: ${lineIdCol}, LINE表示名: ${lineDisplayNameCol}`);
      
      // LINE IDで検索
      for (let i = 1; i < companyData.length; i++) {
        const rowLineId = companyData[i][lineIdCol];
        
        // デバッグ: 各行のLINE_IDと比較対象を出力
        if (i <= 5 || (rowLineId && rowLineId.toString().trim())) { // 最初の5行または値がある行
          Logger.log(`Row ${i}: LINE_ID='${rowLineId}' vs 検索ID='${lineUserId}' (一致: ${rowLineId === lineUserId})`);
        }
        
        if (rowLineId === lineUserId) {
          Logger.log(`会社別来院者管理シートで見つかりました: visitor_id=${companyData[i][visitorIdCol]}`);
          const visitorId = companyData[i][visitorIdCol];
          const lineDisplayName = companyData[i][lineDisplayNameCol];
          
          // visitor_idで患者マスタから詳細情報を取得
          const patientInfo = getPatientInfoByVisitorId(visitorId);
          if (patientInfo) {
            // LINE表示名は会社別来院者管理シートの値を優先
            if (lineDisplayName) {
              patientInfo.line_display_name = lineDisplayName;
            }
            return patientInfo;
          }
        }
      }
    }
    
    Logger.log('会社別来院者管理シートで見つからなかったため、患者マスタシートを検索');
    
    // 2. 会社別で見つからない場合は患者マスタシートで検索
    const patientSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().visitors);
    
    if (!patientSheet) {
      throw new Error('患者マスタシートが見つかりません');
    }
    
    const data = patientSheet.getDataRange().getValues();
    const headers = data[0];
    
    // ヘッダー情報をログ出力（デバッグ用）
    Logger.log(`患者マスタシートのヘッダー: ${JSON.stringify(headers)}`);
    
    // カラムインデックスを取得
    const idIndex = headers.indexOf('visitor_id');
    const nameIndex = headers.indexOf('氏名');
    const emailIndex = headers.indexOf('メールアドレス');
    const phoneIndex = headers.indexOf('電話番号');
    const lineIdIndex = headers.indexOf('LINE_ID');
    const lineDisplayNameIndex = headers.indexOf('LINE表示名');
    const linePictureUrlIndex = headers.indexOf('LINEプロフィール画像URL');
    const createdAtIndex = headers.indexOf('登録日時');
    const updatedAtIndex = headers.indexOf('更新日時');
    
    Logger.log(`患者マスタシート LINE_IDカラムインデックス: ${lineIdIndex}`);
    
    // LINE IDで検索
    for (let i = 1; i < data.length; i++) {
      const rowLineId = data[i][lineIdIndex];
      
      // デバッグ: 最初の5行またはLINE_IDがある行をログ出力
      if (i <= 5 || (rowLineId && rowLineId.toString().trim())) {
        Logger.log(`患者マスタ Row ${i}: LINE_ID='${rowLineId}' vs 検索ID='${lineUserId}' (一致: ${rowLineId === lineUserId})`);
      }
      
      if (rowLineId === lineUserId) {
        Logger.log(`患者マスタシートで見つかりました: visitor_id=${data[i][idIndex]}`);
        return {
          id: data[i][idIndex] || null,
          line_user_id: data[i][lineIdIndex] || null,
          name: data[i][nameIndex] || null,
          email: data[i][emailIndex] || null,
          phone: data[i][phoneIndex] || null,
          line_display_name: data[i][lineDisplayNameIndex] || null,
          line_picture_url: data[i][linePictureUrlIndex] || null,
          created_at: formatDateTimeISO(data[i][createdAtIndex]),
          updated_at: formatDateTimeISO(data[i][updatedAtIndex])
        };
      }
    }
    
    Logger.log('どちらのシートでも見つかりませんでした');
    return null;
    
  } catch (error) {
    Logger.log(`getPhpUserByLineId Error: ${error.toString()}`);
    throw error;
  }
}

/**
 * visitor_idから患者情報を取得（ヘルパー関数）
 * @param {string} visitorId - 患者ID
 * @return {Object|null} 患者情報
 */
function getPatientInfoByVisitorId(visitorId) {
  try {
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().visitors);
    
    if (!sheet) {
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // カラムインデックスを取得
    const idIndex = headers.indexOf('visitor_id');
    const nameIndex = headers.indexOf('氏名');
    const emailIndex = headers.indexOf('メールアドレス');
    const phoneIndex = headers.indexOf('電話番号');
    const lineIdIndex = headers.indexOf('LINE_ID');
    const lineDisplayNameIndex = headers.indexOf('LINE表示名');
    const linePictureUrlIndex = headers.indexOf('LINEプロフィール画像URL');
    const createdAtIndex = headers.indexOf('登録日時');
    const updatedAtIndex = headers.indexOf('更新日時');
    
    // visitor_idで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === visitorId) {
        return {
          id: data[i][idIndex] || null,
          line_user_id: data[i][lineIdIndex] || null,
          name: data[i][nameIndex] || null,
          email: data[i][emailIndex] || null,
          phone: data[i][phoneIndex] || null,
          line_display_name: data[i][lineDisplayNameIndex] || null,
          line_picture_url: data[i][linePictureUrlIndex] || null,
          created_at: formatDateTimeISO(data[i][createdAtIndex]),
          updated_at: formatDateTimeISO(data[i][updatedAtIndex])
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`getPatientInfoByVisitorId Error: ${error.toString()}`);
    return null;
  }
}

/**
 * 患者詳細情報を取得
 * @param {string} visitorId - 患者ID
 * @return {Object} 患者詳細情報
 */
function getPhpPatientInfo(visitorId) {
  try {
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().visitors);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // カラムインデックスを取得
    const idIndex = headers.indexOf('visitor_id');
    const kanaIndex = headers.indexOf('カナ');
    const birthDateIndex = headers.indexOf('生年月日');
    const ageIndex = headers.indexOf('年齢');
    const genderIndex = headers.indexOf('性別');
    const postalCodeIndex = headers.indexOf('郵便番号');
    const addressIndex = headers.indexOf('住所');
    const firstVisitDateIndex = headers.indexOf('初診日');
    const lastVisitDateIndex = headers.indexOf('最終来院日');
    const chartNumberIndex = headers.indexOf('カルテ番号');
    const notesIndex = headers.indexOf('メモ');
    const allergiesIndex = headers.indexOf('アレルギー');
    
    // visitor_idで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === visitorId) {
        const firstVisitDate = data[i][firstVisitDateIndex];
        return {
          id: visitorId,
          kana: data[i][kanaIndex] || null,
          birth_date: formatDate(data[i][birthDateIndex]),
          age: data[i][ageIndex] || null,
          gender: data[i][genderIndex] || null,
          postal_code: data[i][postalCodeIndex] || null,
          address: data[i][addressIndex] || null,
          first_visit_date: formatDate(firstVisitDate),
          last_visit_date: formatDate(data[i][lastVisitDateIndex]),
          chart_number: data[i][chartNumberIndex] || null,
          is_new: !firstVisitDate,
          notes: data[i][notesIndex] || null,
          allergies: data[i][allergiesIndex] || null
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`getPhpPatientInfo Error: ${error.toString()}`);
    return null;
  }
}

/**
 * 施術履歴を取得
 * @param {string} visitorId - 患者ID
 * @return {Array} 施術履歴配列
 */
function getPhpTreatmentHistory(visitorId) {
  try {
    const reservationSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().reservations);
    
    const intervalSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().treatmentInterval);
    
    const reservationData = reservationSheet.getDataRange().getValues();
    const intervalData = intervalSheet.getDataRange().getValues();
    
    // 施術間隔マップを作成
    const intervalMap = {};
    for (let i = 1; i < intervalData.length; i++) {
      const menuId = intervalData[i][1]; // メニューID
      const intervalDays = intervalData[i][4]; // 必要間隔（日数）
      if (menuId) {
        intervalMap[menuId] = intervalDays;
      }
    }
    
    const history = [];
    const now = new Date();
    
    // 完了済みの予約を抽出
    for (let i = 1; i < reservationData.length; i++) {
      const row = reservationData[i];
      if (row[1] === visitorId && row[8] === '完了') { // visitor_id && ステータス
        const treatmentDate = new Date(row[3]); // 予約日
        const menuId = row[6]; // メニューID（仮）
        const intervalDays = intervalMap[menuId] || 7; // デフォルト7日
        
        const nextAvailableDate = new Date(treatmentDate);
        nextAvailableDate.setDate(nextAvailableDate.getDate() + intervalDays);
        
        history.push({
          id: row[0], // reservation_id
          treatment_id: menuId || `menu_${i}`,
          treatment_name: row[6], // メニュー
          treatment_date: formatDate(treatmentDate),
          min_interval_days: intervalDays,
          next_available_date: formatDate(nextAvailableDate)
        });
      }
    }
    
    // 日付の降順でソート
    history.sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date));
    
    return history;
    
  } catch (error) {
    Logger.log(`getPhpTreatmentHistory Error: ${error.toString()}`);
    return [];
  }
}

/**
 * 今後の予約を取得
 * @param {string} visitorId - 患者ID
 * @return {Array} 予約配列
 */
function getPhpUpcomingReservations(visitorId) {
  try {
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().reservations);
    
    const menuSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().menus);
    
    const reservationData = sheet.getDataRange().getValues();
    const menuData = menuSheet.getDataRange().getValues();
    
    // メニュー情報マップを作成
    const menuMap = {};
    for (let i = 1; i < menuData.length; i++) {
      const menuName = menuData[i][1]; // メニュー名
      const duration = menuData[i][5]; // 所要時間（分）
      const price = menuData[i][7]; // 税込料金
      if (menuName) {
        menuMap[menuName] = {
          duration: duration || 60,
          price: price || 0
        };
      }
    }
    
    const reservations = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 今後の予約を抽出
    for (let i = 1; i < reservationData.length; i++) {
      const row = reservationData[i];
      const reservationDate = new Date(row[3]); // 予約日
      
      if (row[1] === visitorId && // visitor_id
          reservationDate >= today && 
          row[8] !== 'キャンセル' && // ステータス
          row[8] !== '完了') {
        
        const menuName = row[6]; // メニュー
        const menuInfo = menuMap[menuName] || { duration: 60, price: 0 };
        
        reservations.push({
          id: row[0], // reservation_id
          treatment_id: `menu_${menuName}`, // 仮のID
          treatment_name: menuName,
          reservation_date: formatDate(reservationDate),
          reservation_time: row[4] || '10:00', // 予約時間
          duration: String(menuInfo.duration),
          price: String(menuInfo.price),
          room: '施術室1', // 仮の値
          status: row[8] || 'confirmed'
        });
      }
    }
    
    // 日付の昇順でソート
    reservations.sort((a, b) => new Date(a.reservation_date) - new Date(b.reservation_date));
    
    return reservations;
    
  } catch (error) {
    Logger.log(`getPhpUpcomingReservations Error: ${error.toString()}`);
    return [];
  }
}

/**
 * 予約可能な施術を取得
 * @param {string} visitorId - 患者ID
 * @return {Array} 施術配列
 */
function getPhpAvailableTreatments(visitorId) {
  try {
    const menuSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().menus);
    
    const treatmentHistory = getPhpTreatmentHistory(visitorId);
    const menuData = menuSheet.getDataRange().getValues();
    
    const availableTreatments = [];
    
    // 各メニューの予約可能状況をチェック
    for (let i = 1; i < menuData.length; i++) {
      const row = menuData[i];
      if (row[8] && row[9]) { // 有効フラグ && オンライン予約可
        const menuId = row[0]; // menu_id
        const menuName = row[1]; // メニュー名
        const duration = row[5] || 60; // 所要時間（分）
        const price = row[7] || 0; // 税込料金
        
        // このメニューの最後の施術を確認
        const lastTreatment = treatmentHistory.find(h => h.treatment_name === menuName);
        let canBook = true;
        let reason = null;
        let nextAvailableDate = formatDate(new Date());
        
        if (lastTreatment) {
          const lastDate = new Date(lastTreatment.treatment_date);
          const intervalDays = lastTreatment.min_interval_days;
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + intervalDays);
          
          if (nextDate > new Date()) {
            canBook = false;
            reason = `前回の施術から${intervalDays}日経過していません`;
            nextAvailableDate = formatDate(nextDate);
          }
        }
        
        availableTreatments.push({
          treatment_id: menuId,
          treatment_name: menuName,
          can_book: canBook,
          next_available_date: nextAvailableDate,
          price: String(price),
          duration: String(duration),
          reason: reason
        });
      }
    }
    
    return availableTreatments;
    
  } catch (error) {
    Logger.log(`getPhpAvailableTreatments Error: ${error.toString()}`);
    return [];
  }
}

/**
 * 会員情報を取得
 * @param {string} visitorId - 患者ID
 * @return {Object} 会員情報
 */
function getPhpMembershipInfo(visitorId) {
  try {
    const companyVisitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().companyVisitors);
    
    if (!companyVisitorSheet) {
      return {
        is_member: false,
        member_type: null,
        company_id: null,
        company_name: null,
        plan_name: null,
        position: null,
        ticket_balance: null
      };
    }
    
    const data = companyVisitorSheet.getDataRange().getValues();
    
    // visitor_idで検索
    Logger.log(`getPhpMembershipInfo: visitor_id ${visitorId} で検索開始`);
    Logger.log(`getPhpMembershipInfo: 会社別来院者管理シートのデータ行数 - ${data.length}`);
    
    for (let i = 1; i < data.length; i++) {
      Logger.log(`getPhpMembershipInfo: 行${i}検査 - visitor_id: ${data[i][2]}`);
      
      if (data[i][2] === visitorId) { // visitor_id列
        const companyId = data[i][0]; // 会社ID
        const companyName = data[i][1]; // 会社名
        
        Logger.log(`getPhpMembershipInfo: 一致するデータを発見 - 会社ID: ${companyId}, 会社名: ${companyName}`);
        Logger.log(`getPhpMembershipInfo: 行データ全体 - ${JSON.stringify(data[i])}`);
        
        // 会社マスターシートからプラン名を取得
        let planName = null;
        try {
          const companyMasterSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
            .getSheetByName('会社マスタ');
          
          if (companyMasterSheet) {
            const companyMasterData = companyMasterSheet.getDataRange().getValues();
            Logger.log(`getPhpMembershipInfo: 会社マスターシートのデータ行数 - ${companyMasterData.length}`);
            
            // 会社IDでプラン名を検索
            for (let j = 1; j < companyMasterData.length; j++) {
              if (companyMasterData[j][0] === companyId) {
                planName = companyMasterData[j][2]; // プラン列
                Logger.log(`getPhpMembershipInfo: プラン名を発見 - ${planName}`);
                break;
              }
            }
            
            if (!planName) {
              Logger.log(`getPhpMembershipInfo: 会社ID ${companyId} のプラン名が見つかりません`);
            }
          } else {
            Logger.log('getPhpMembershipInfo: 会社マスタシートが見つかりません');
          }
        } catch (planError) {
          Logger.log(`プラン名取得エラー: ${planError.toString()}`);
        }
        
        // チケット残高を取得
        Logger.log(`getPhpMembershipInfo: チケット残高取得開始 - companyId: ${companyId}`);
        const ticketBalance = getPhpTicketBalance(companyId);
        
        const result = {
          is_member: true,
          member_type: data[i][5] || 'main', // 会員種別
          company_id: companyId,
          company_name: companyName,
          plan_name: planName,
          position: data[i][7] || null, // 役職
          ticket_balance: ticketBalance
        };
        
        Logger.log(`getPhpMembershipInfo: 最終結果 - ${JSON.stringify(result)}`);
        return result;
      }
    }
    
    Logger.log(`getPhpMembershipInfo: visitor_id ${visitorId} に一致するデータが見つかりませんでした`);
    
    return {
      is_member: false,
      member_type: null,
      company_id: null,
      company_name: null,
      plan_name: null,
      position: null,
      ticket_balance: null
    };
    
  } catch (error) {
    Logger.log(`getPhpMembershipInfo Error: ${error.toString()}`);
    return {
      is_member: false,
      member_type: null,
      company_id: null,
      company_name: null,
      plan_name: null,
      position: null,
      ticket_balance: null
    };
  }
}

/**
 * 最終チケット利用日を取得
 * @param {string} companyId - 会社ID
 * @param {string} targetMonth - 対象月（YYYY-MM形式）
 * @return {Object} 最終利用日
 */
function getLastTicketUsageDates(companyId, targetMonth) {
  try {
    // ここでは簡易実装として、nullを返す
    // 実際の実装では、チケット利用履歴シートから最終利用日を取得する
    return {
      幹細胞: null,
      施術: null,
      点滴: null
    };
  } catch (error) {
    Logger.log(`getLastTicketUsageDates Error: ${error.toString()}`);
    return {
      幹細胞: null,
      施術: null,
      点滴: null
    };
  }
}

/**
 * チケット残高を取得
 * @param {string} companyId - 会社ID
 * @return {Object} チケット残高
 */
function getPhpTicketBalance(companyId) {
  try {
    Logger.log(`getPhpTicketBalance 開始 - companyId: ${companyId}`);
    
    // 入力値の検証
    if (!companyId || companyId === null || companyId === undefined) {
      Logger.log('getPhpTicketBalance: companyIdが無効です');
      return {
        stem_cell: { balance: 0, granted: 0, used: 0, last_used_date: null },
        treatment: { balance: 0, granted: 0, used: 0, last_used_date: null },
        drip: { balance: 0, granted: 0, used: 0, last_used_date: null }
      };
    }
    
    // チケット管理システムから残高を取得
    const currentMonth = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM');
    Logger.log(`getPhpTicketBalance: 検索対象月 - ${currentMonth}`);
    
    const ticketSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName('チケット残高');
    
    if (!ticketSheet) {
      Logger.log('getPhpTicketBalance: チケット残高シートが見つかりません');
      return {
        stem_cell: { balance: 0, granted: 0, used: 0, last_used_date: null },
        treatment: { balance: 0, granted: 0, used: 0, last_used_date: null },
        drip: { balance: 0, granted: 0, used: 0, last_used_date: null }
      };
    }
    
    const data = ticketSheet.getDataRange().getValues();
    Logger.log(`getPhpTicketBalance: チケット残高シートのデータ行数 - ${data.length}`);
    
    // ヘッダー行の確認
    if (data.length > 0) {
      Logger.log(`getPhpTicketBalance: ヘッダー行 - ${JSON.stringify(data[0])}`);
    }
    
    // 該当する会社IDのデータを探す
    let foundData = null;
    for (let i = data.length - 1; i >= 1; i--) {
      
      if (data[i][0] === companyId && Utilities.formatDate(data[i][1], 'JST', 'yyyy-MM') === currentMonth) {
        foundData = data[i];
        Logger.log(`getPhpTicketBalance: 一致するデータを発見 - 行${i}`);
        Logger.log(`getPhpTicketBalance: データ内容 - ${JSON.stringify(foundData)}`);
        break;
      }
    }
    
    if (!foundData) {
      Logger.log(`getPhpTicketBalance: 会社ID ${companyId} の ${currentMonth} のデータが見つかりません`);
      
      // 会社IDが存在するかどうかの確認
      let companyExists = false;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === companyId) {
          companyExists = true;
          Logger.log(`getPhpTicketBalance: 会社ID ${companyId} は別の月（${data[i][1]}）に存在します`);
          break;
        }
      }
      
      if (!companyExists) {
        Logger.log(`getPhpTicketBalance: 会社ID ${companyId} は一切データに存在しません`);
      }
      
      return {
        stem_cell: { balance: 0, granted: 0, used: 0, last_used_date: null },
        treatment: { balance: 0, granted: 0, used: 0, last_used_date: null },
        drip: { balance: 0, granted: 0, used: 0, last_used_date: null }
      };
    }
    
    // 最終利用日情報を取得
    const ticketService = new TicketManagementService();
    const lastUsageDatesResult = ticketService.getLastTicketUsageDates(companyId);
    const lastUsageDates = lastUsageDatesResult.success ? lastUsageDatesResult.lastUsageDates : {
      stemCell: null,
      treatment: null, 
      infusion: null
    };
    Logger.log(`getPhpTicketBalance: 最終利用日 - ${JSON.stringify(lastUsageDates)}`);
    
    const result = {
      stem_cell: {
        balance: foundData[4] || 0,     // 幹細胞残高
        granted: foundData[2] || 0,     // 幹細胞付与
        used: foundData[3] || 0,        // 幹細胞使用
        last_used_date: lastUsageDates.stemCell ? formatDateTimeISO(lastUsageDates.stemCell) : null
      },
      treatment: {
        balance: foundData[7] || 0,     // 施術残高
        granted: foundData[5] || 0,     // 施術付与
        used: foundData[6] || 0,        // 施術使用
        last_used_date: lastUsageDates.treatment ? formatDateTimeISO(lastUsageDates.treatment) : null
      },
      drip: {
        balance: foundData[10] || 0,    // 点滴残高
        granted: foundData[8] || 0,     // 点滴付与
        used: foundData[9] || 0,        // 点滴使用
        last_used_date: lastUsageDates.infusion ? formatDateTimeISO(lastUsageDates.infusion) : null
      }
    };
    
    Logger.log(`getPhpTicketBalance: 結果 - ${JSON.stringify(result)}`);
    return result;
    
  } catch (error) {
    Logger.log(`getPhpTicketBalance Error: ${error.toString()}`);
    Logger.log(`getPhpTicketBalance Error Stack: ${error.stack}`);
    return {
      stem_cell: { balance: 0, granted: 0, used: 0, last_used_date: null },
      treatment: { balance: 0, granted: 0, used: 0, last_used_date: null },
      drip: { balance: 0, granted: 0, used: 0, last_used_date: null }
    };
  }
}

/**
 * 統計情報を取得
 * @param {string} visitorId - 患者ID
 * @return {Object} 統計情報
 */
function getPhpStatistics(visitorId) {
  try {
    const reservationSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().reservations);
    
    const data = reservationSheet.getDataRange().getValues();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let totalVisits = 0;
    let last30DaysVisits = 0;
    const treatmentCounts = {};
    
    // 統計を集計
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === visitorId && data[i][8] === '完了') {
        totalVisits++;
        
        const reservationDate = new Date(data[i][3]);
        if (reservationDate >= thirtyDaysAgo) {
          last30DaysVisits++;
        }
        
        const menuName = data[i][6];
        if (menuName) {
          if (menuName.includes('幹細胞')) {
            treatmentCounts.stem_cell = (treatmentCounts.stem_cell || 0) + 1;
          } else if (menuName.includes('ビタミン')) {
            treatmentCounts.vitamin_c = (treatmentCounts.vitamin_c || 0) + 1;
          } else {
            treatmentCounts.other = (treatmentCounts.other || 0) + 1;
          }
        }
      }
    }
    
    // 最も多い施術を特定
    let favoriteTreatment = null;
    let maxCount = 0;
    const treatmentFrequency = {};
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === visitorId && data[i][8] === '完了') {
        const menuName = data[i][6];
        if (menuName) {
          treatmentFrequency[menuName] = (treatmentFrequency[menuName] || 0) + 1;
          if (treatmentFrequency[menuName] > maxCount) {
            maxCount = treatmentFrequency[menuName];
            favoriteTreatment = menuName;
          }
        }
      }
    }
    
    return {
      total_visits: totalVisits,
      total_treatments: {
        stem_cell: treatmentCounts.stem_cell || 0,
        vitamin_c: treatmentCounts.vitamin_c || 0,
        other: treatmentCounts.other || 0
      },
      last_30_days_visits: last30DaysVisits,
      favorite_treatment: favoriteTreatment
    };
    
  } catch (error) {
    Logger.log(`getPhpStatistics Error: ${error.toString()}`);
    return {
      total_visits: 0,
      total_treatments: {
        stem_cell: 0,
        vitamin_c: 0,
        other: 0
      },
      last_30_days_visits: 0,
      favorite_treatment: null
    };
  }
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 * @param {Date|string} date - 日付
 * @return {string|null} フォーマット済み日付
 */
function formatDate(date) {
  if (!date) return null;
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    
    return Utilities.formatDate(d, 'JST', 'yyyy-MM-dd');
  } catch (error) {
    return null;
  }
}

/**
 * 日時をISO 8601形式にフォーマット
 * @param {Date|string} datetime - 日時
 * @return {string|null} フォーマット済み日時
 */
function formatDateTimeISO(datetime) {
  if (!datetime) return null;
  
  try {
    const d = new Date(datetime);
    if (isNaN(d.getTime())) return null;
    
    return Utilities.formatDate(d, 'JST', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  } catch (error) {
    return null;
  }
}

/**
 * 患者IDからメニュー情報を取得（施術履歴に基づく初回判定付き）
 * @param {string} patientId - 患者ID
 * @return {Object} メニュー情報と履歴
 */
function handleGetPatientMenus(patientId) {
  try {
    Logger.log(`handleGetPatientMenus: 患者ID ${patientId} のメニュー情報取得開始`);
    
    // デバッグ: クラスの存在確認
    Logger.log(`VisitorService exists: ${typeof VisitorService !== 'undefined'}`);
    Logger.log(`MenuService exists: ${typeof MenuService !== 'undefined'}`);
    Logger.log(`Utils exists: ${typeof Utils !== 'undefined'}`);
    
    // 1. 患者情報の存在確認
    let visitorService;
    try {
      visitorService = new VisitorService();
      Logger.log('VisitorServiceのインスタンス作成成功');
    } catch (e) {
      Logger.log(`VisitorServiceのインスタンス作成エラー: ${e.toString()}`);
      throw e;
    }
    
    let visitor;
    try {
      visitor = visitorService.getVisitorById(patientId);
      Logger.log(`患者情報取得結果: ${visitor ? '成功' : '見つからない'}`);
    } catch (e) {
      Logger.log(`getVisitorByIdエラー: ${e.toString()}`);
      throw e;
    }
    
    if (!visitor) {
      return {
        status: 'error',
        error: {
          code: 'PATIENT_NOT_FOUND',
          message: '指定された患者が見つかりません',
          details: `Patient ID: ${patientId}`
        }
      };
    }
    
    // 2. 過去6ヶ月の予約履歴を取得
    let sixMonthsAgo;
    try {
      sixMonthsAgo = Utils.subtractMonths(Utils.getToday(), 6);
      Logger.log(`6ヶ月前の日付: ${sixMonthsAgo}`);
    } catch (e) {
      Logger.log(`日付計算エラー: ${e.toString()}`);
      throw e;
    }
    
    let reservationHistory;
    try {
      reservationHistory = getPatientReservationHistory(patientId, sixMonthsAgo);
      Logger.log(`handleGetPatientMenus: ${reservationHistory.length}件の予約履歴を取得`);
    } catch (e) {
      Logger.log(`予約履歴取得エラー: ${e.toString()}`);
      throw e;
    }
    
    // 3. メニューごとの使用回数を集計
    let menuUsage;
    try {
      menuUsage = aggregateMenuUsage(reservationHistory);
      Logger.log(`handleGetPatientMenus: メニュー使用回数: ${JSON.stringify(menuUsage)}`);
    } catch (e) {
      Logger.log(`メニュー使用回数集計エラー: ${e.toString()}`);
      throw e;
    }
    
    // 4. 全メニューリストを取得
    let menuService;
    try {
      menuService = new MenuService();
      Logger.log('MenuServiceのインスタンス作成成功');
    } catch (e) {
      Logger.log(`MenuServiceのインスタンス作成エラー: ${e.toString()}`);
      throw e;
    }
    
    let allMenus;
    try {
      allMenus = menuService.getMenusFromSheet();
      Logger.log(`handleGetPatientMenus: ${allMenus.length}件のメニューを取得`);
    } catch (e) {
      Logger.log(`メニュー取得エラー: ${e.toString()}`);
      throw e;
    }
    
    // 5. 患者の履歴に基づいてメニューをフィルタリング・分類
    let filteredMenus;
    try {
      filteredMenus = filterMenusByUsageHistory(allMenus, menuUsage);
      Logger.log(`フィルタリング後のメニュー数: ${filteredMenus.length}`);
    } catch (e) {
      Logger.log(`メニューフィルタリングエラー: ${e.toString()}`);
      throw e;
    }
    
    return {
      status: 'success',
      data: {
        patient_id: patientId,
        patient_name: visitor.name || '',
        menus: filteredMenus,
        total_count: filteredMenus.length,
        history_start_date: sixMonthsAgo,
        history_end_date: Utils.getToday()
      }
    };
    
  } catch (error) {
    Logger.log(`handleGetPatientMenus Error: ${error.toString()}`);
    Logger.log(`handleGetPatientMenus Error Stack: ${error.stack}`);
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'メニュー情報の取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * 患者の予約履歴を取得
 * @param {string} visitorId - 患者ID
 * @param {string} fromDate - 開始日（YYYY-MM-DD形式）
 * @return {Array} 予約履歴配列
 */
function getPatientReservationHistory(visitorId, fromDate) {
  try {
    Logger.log(`getPatientReservationHistory: visitorId=${visitorId}, fromDate=${fromDate}`);
    
    const reservationSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().reservations);
    
    if (!reservationSheet) {
      Logger.log('予約管理シートが見つかりません');
      return [];
    }
    
    const data = reservationSheet.getDataRange().getValues();
    const headers = data[0];
    
    // カラムインデックスを取得
    let visitorIdIndex = -1;
    let statusIndex = -1;
    let dateIndex = -1;
    let menuIdIndex = -1;
    let menuNameIndex = -1;
    
    // ヘッダーからインデックスを検索
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header === 'visitor_id') visitorIdIndex = i;
      else if (header === 'ステータス') statusIndex = i;
      else if (header === '予約日') dateIndex = i;
      else if (header === 'menu_id') menuIdIndex = i;
      else if (header === 'メニュー') menuNameIndex = i;
    }
    
    Logger.log(`カラムインデックス: visitor_id=${visitorIdIndex}, status=${statusIndex}, date=${dateIndex}, menu=${menuNameIndex}`);
    
    if (visitorIdIndex === -1 || statusIndex === -1 || dateIndex === -1 || menuNameIndex === -1) {
      Logger.log('必要なカラムが見つかりません');
      return [];
    }
    
    const history = [];
    const fromDateObj = new Date(fromDate);
    
    // 予約データをフィルタリング
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const reservationDate = new Date(row[dateIndex]);
      
      // visitor_idが一致し、ステータスが完了で、指定日以降の予約を抽出
      if (row[visitorIdIndex] === visitorId && 
          row[statusIndex] === '完了' &&
          reservationDate >= fromDateObj) {
        
        history.push({
          date: row[dateIndex],
          menu_id: row[menuIdIndex] || `menu_${row[menuNameIndex]}`,
          menu_name: row[menuNameIndex],
          start_at: reservationDate,
          menus: [{
            id: row[menuIdIndex] || `menu_${row[menuNameIndex]}`,
            menu_id: row[menuIdIndex] || `menu_${row[menuNameIndex]}`,
            name: row[menuNameIndex]
          }]
        });
      }
    }
    
    Logger.log(`取得した予約履歴: ${history.length}件`);
    return history;
    
  } catch (error) {
    Logger.log(`getPatientReservationHistory Error: ${error.toString()}`);
    Logger.log(`getPatientReservationHistory Error Stack: ${error.stack}`);
    return [];
  }
}

/**
 * visitor_idから会社情報を取得
 * @param {string} visitorId - 患者ID
 * @return {Object|null} 会社情報
 */
function getCompanyInfoByVisitorId(visitorId) {
  try {
    const companyVisitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().companyVisitors);
    
    if (!companyVisitorSheet) {
      return null;
    }
    
    const data = companyVisitorSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === visitorId) { // visitor_id
        return {
          companyId: data[i][0], // 会社ID
          companyName: data[i][1] // 会社名
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`getCompanyInfoByVisitorId Error: ${error.toString()}`);
    return null;
  }
}

/**
 * visitor_idからカナ名を取得
 * @param {string} visitorId - 患者ID
 * @return {string|null} カナ名
 */
function getVisitorKanaById(visitorId) {
  try {
    const visitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().visitors);
    
    if (!visitorSheet) {
      return null;
    }
    
    const data = visitorSheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('visitor_id');
    const kanaIndex = headers.indexOf('カナ');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === visitorId) {
        return data[i][kanaIndex] || null;
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`getVisitorKanaById Error: ${error.toString()}`);
    return null;
  }
}

/**
 * メニュー名からカテゴリを判定
 * @param {string} menuName - メニュー名
 * @return {string} カテゴリ名
 */
function getMenuCategory(menuName) {
  if (!menuName) return '不明';
  
  if (menuName.includes('幹細胞')) {
    return '幹細胞';
  } else if (menuName.includes('点滴')) {
    return '点滴';
  } else if (menuName.includes('施術')) {
    return '施術';
  } else if (menuName.includes('ビタミン')) {
    return 'ビタミン';
  } else {
    return 'その他';
  }
}

/**
 * 予約履歴を取得
 * @param {string} memberType - 会員種別（main/sub）
 * @param {string} date - 基準日（YYYY-MM-DD形式）
 * @param {string} companyId - 会社ID
 * @return {Object} 予約履歴レスポンス
 */
function getReservationHistory(memberType, date, companyId) {
  try {
    Logger.log(`getReservationHistory開始: memberType=${memberType}, date=${date}, companyId=${companyId}`);
    
    // 基準日から過去3ヶ月の期間を計算
    const endDate = new Date(date);
    const startDate = new Date(date);
    startDate.setMonth(startDate.getMonth() - 3);
    
    Logger.log(`期間: ${formatDate(startDate)} ～ ${formatDate(endDate)}`);
    
    // 1. 会社別来院者管理シートから該当会社の来院者を取得
    const companyVisitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().companyVisitors);
    
    if (!companyVisitorSheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    const companyVisitorData = companyVisitorSheet.getDataRange().getValues();
    const companyVisitors = [];
    let companyName = '';
    
    // 会社IDに該当する来院者を抽出
    for (let i = 1; i < companyVisitorData.length; i++) {
      if (companyVisitorData[i][0] === companyId) { // 会社ID
        if (!companyName) {
          companyName = companyVisitorData[i][1]; // 会社名
        }
        
        const visitorMemberType = companyVisitorData[i][5]; // 会員種別
        const isPublic = companyVisitorData[i][6]; // 公開フラグ
        
        // 会員種別によるフィルタリング
        if (memberType === 'main' || (memberType === 'sub' && isPublic === true)) {
          companyVisitors.push({
            visitorId: companyVisitorData[i][2], // visitor_id
            visitorName: companyVisitorData[i][3], // 氏名
            isPublic: isPublic
          });
        }
      }
    }
    
    Logger.log(`対象来院者数: ${companyVisitors.length}`);
    
    // 来院者IDのリストを作成
    const visitorIds = companyVisitors.map(v => v.visitorId);
    
    // 2. 患者マスタからカナ名を取得
    const visitorSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().visitors);
    
    const visitorData = visitorSheet.getDataRange().getValues();
    const visitorHeaders = visitorData[0];
    const visitorIdIndex = visitorHeaders.indexOf('visitor_id');
    const kanaIndex = visitorHeaders.indexOf('カナ');
    
    // visitor情報をマップに格納
    const visitorMap = {};
    for (let i = 1; i < visitorData.length; i++) {
      const vId = visitorData[i][visitorIdIndex];
      if (visitorIds.includes(vId)) {
        visitorMap[vId] = {
          kana: visitorData[i][kanaIndex] || ''
        };
      }
    }
    
    // 3. 予約管理シートから予約データを取得
    const reservationSheet = SpreadsheetApp.openById(Config.getSpreadsheetId())
      .getSheetByName(Config.getSheetNames().reservations);
    
    if (!reservationSheet) {
      throw new Error('予約管理シートが見つかりません');
    }
    
    const reservationData = reservationSheet.getDataRange().getValues();
    const reservations = [];
    
    // 予約データをフィルタリング
    for (let i = 1; i < reservationData.length; i++) {
      const row = reservationData[i];
      const visitorId = row[1]; // visitor_id
      const reservationDate = new Date(row[3]); // 予約日
      
      // 対象の来院者かつ期間内の予約をチェック
      if (visitorIds.includes(visitorId) && 
          reservationDate >= startDate && 
          reservationDate <= endDate) {
        
        // 来院者情報を取得
        const visitor = companyVisitors.find(v => v.visitorId === visitorId);
        const visitorInfo = visitorMap[visitorId] || {};
        
        reservations.push({
          reservation_id: row[0], // reservation_id
          visitor_id: visitorId,
          visitor_name: visitor.visitorName,
          visitor_kana: visitorInfo.kana || '',
          visitor_type: memberType,
          is_public: visitor.isPublic,
          reservation_date: formatDate(reservationDate),
          reservation_time: row[4] || '', // 予約時間
          menu: row[6] || '', // メニュー
          menu_category: getMenuCategory(row[6]),
          status: row[8] || '', // ステータス
          memo: row[9] || '', // メモ
          ticket_used: row[10] === 'チケット使用',
          ticket_type: row[10] === 'チケット使用' ? (row[11] || '') : null
        });
      }
    }
    
    // 日付の降順でソート
    reservations.sort((a, b) => {
      const dateA = new Date(b.reservation_date + ' ' + b.reservation_time);
      const dateB = new Date(a.reservation_date + ' ' + a.reservation_time);
      return dateA - dateB;
    });
    
    Logger.log(`予約件数: ${reservations.length}`);
    
    // レスポンスを構築
    const response = {
      status: 'success',
      data: {
        member_type: memberType,
        date: date,
        company_id: companyId,
        company_name: companyName,
        period: {
          from: formatDate(startDate),
          to: formatDate(endDate)
        },
        total_count: reservations.length,
        reservations: reservations
      },
      timestamp: new Date().toISOString()
    };
    
    return response;
    
  } catch (error) {
    Logger.log(`getReservationHistory Error: ${error.toString()}`);
    Logger.log(`getReservationHistory Error Stack: ${error.stack}`);
    
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: '予約履歴の取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * 来院者新規登録API
 * @param {Object} requestData - リクエストデータ
 * @return {Object} レスポンスオブジェクト
 */
function createCompanyVisitor(requestData) {
  try {
    Logger.log('createCompanyVisitor開始');
    Logger.log('リクエストデータ: ' + JSON.stringify(requestData));
    
    // 必須パラメータの検証
    const requiredFields = ['last_name', 'first_name', 'last_name_kana', 'first_name_kana', 'publicity_status'];
    const missingFields = requiredFields.filter(field => !requestData[field]);
    
    if (missingFields.length > 0) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '必須パラメータが不足しています',
          details: `${missingFields.join(', ')}は必須です`
        }
      };
    }
    
    // 公開ステータスの検証
    const validPublicityStatus = ['public', 'private'];
    if (!validPublicityStatus.includes(requestData.publicity_status)) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '公開ステータスの値が不正です',
          details: 'publicity_statusは public または private を指定してください'
        }
      };
    }
    
    // 性別の変換（仕様書形式 → Medical Force API形式）
    let gender = 'OTHER';
    if (requestData.gender) {
      const genderMap = {
        'male': 'MALE',
        'female': 'FEMALE',
        'other': 'OTHER'
      };
      gender = genderMap[requestData.gender.toLowerCase()] || 'OTHER';
    }
    
    // 会社IDが指定されている場合、会員種別は必須
    if (requestData.company_id && !requestData.member_type) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_MEMBER_TYPE',
          message: '会社ID指定時にmember_typeが未指定',
          details: 'company_idを指定する場合は、member_typeも必須です'
        }
      };
    }
    
    // 会員種別の検証
    if (requestData.member_type) {
      const validMemberTypes = ['main', 'sub'];
      if (!validMemberTypes.includes(requestData.member_type)) {
        return {
          status: 'error',
          error: {
            code: 'INVALID_REQUEST',
            message: '会員種別の値が不正です',
            details: 'member_typeは main または sub を指定してください'
          }
        };
      }
    }
    
    // メールアドレスの重複チェック
    if (requestData.email) {
      const visitorService = new VisitorService();
      const existingVisitors = visitorService.searchVisitors({ email: requestData.email });
      if (existingVisitors.length > 0) {
        return {
          status: 'error',
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'メールアドレスが既に登録済み',
            details: `メールアドレス ${requestData.email} は既に使用されています`
          }
        };
      }
    }
    
    // Medical Force API用のデータを準備
    const apiRequestData = {
      name: requestData.last_name + ' ' + requestData.first_name,
      kana: requestData.last_name_kana + ' ' + requestData.first_name_kana,
      first_name: requestData.first_name,
      last_name: requestData.last_name,
      first_name_kana: requestData.first_name_kana,
      last_name_kana: requestData.last_name_kana,
      gender: gender,
      birthday: requestData.birth_date || null,
      email: requestData.email || '',
      phone: requestData.phone || '',
      zipcode: '',
      address: ''
    };
    
    Logger.log('Medical Force APIリクエストデータ: ' + JSON.stringify(apiRequestData));
    
    // VisitorServiceを使用して来院者を登録
    Logger.log('VisitorService.createVisitor 呼び出し開始');
    const visitorService = new VisitorService();
    const createdVisitor = visitorService.createVisitor(apiRequestData);
    Logger.log('VisitorService.createVisitor 呼び出し完了');
    Logger.log('作成された来院者: ' + JSON.stringify(createdVisitor));
    
    if (!createdVisitor || !createdVisitor.visitor_id) {
      return {
        status: 'error',
        error: {
          code: 'API_ERROR',
          message: '来院者の登録に失敗しました',
          details: 'Medical Force APIからの応答が不正です'
        }
      };
    }
    
    const visitorId = createdVisitor.visitor_id;
    Logger.log('来院者登録成功: visitor_id=' + visitorId);
    
    // 会社情報を取得
    let companyInfo = null;
    let companyName = null;
    
    if (requestData.company_id) {
      // 会社IDが指定されている場合、会社情報を取得
      const companyCacheService = globalCompanyCacheService || new CompanyCacheService();
      const companies = companyCacheService.getCompanies();
      const company = companies.find(c => c['会社ID'] === requestData.company_id);
      
      if (!company) {
        return {
          status: 'error',
          error: {
            code: 'INVALID_COMPANY',
            message: '指定された会社IDが存在しない',
            details: `会社ID ${requestData.company_id} は存在しません`
          }
        };
      }
      
      companyName = company['会社名'];
      companyInfo = {
        company_id: requestData.company_id,
        company_name: companyName,
        member_type: requestData.member_type === 'main' ? 'main' : 'sub'
      };
      
      // 会社別来院者管理シートに追加
      const companyVisitorService = new CompanyVisitorService();
      const companyVisitorData = {
        visitorId: visitorId,
        gender: gender,
        lineId: '連携無し',
        memberType: requestData.member_type === 'main' ? '本会員' : 'サブ会員',
        isPublic: requestData.publicity_status === 'public',
        position: requestData.notes || ''
      };
      
      const addResult = companyVisitorService.addVisitorToCompany(
        requestData.company_id,
        companyName,
        companyVisitorData
      );
      
      if (!addResult.success) {
        Logger.log('会社別来院者管理への追加失敗: ' + addResult.error);
        // Medical Force APIには登録済みなので、警告として処理
      }
    } else {
      // 会社IDが指定されていない場合でも、デフォルト会社に同伴者として登録
      const defaultCompanyId = '1'; // デフォルト会社ID
      const defaultCompanyName = '一般'; // デフォルト会社名
      
      const companyVisitorService = new CompanyVisitorService();
      const companyVisitorData = {
        visitorId: visitorId,
        gender: gender,
        lineId: '連携無し',
        memberType: '同伴者',
        isPublic: requestData.publicity_status === 'public',
        position: requestData.notes || ''
      };
      
      const addResult = companyVisitorService.addVisitorToCompany(
        defaultCompanyId,
        defaultCompanyName,
        companyVisitorData
      );
      
      if (!addResult.success) {
        Logger.log('会社別来院者管理への追加失敗: ' + addResult.error);
      }
    }
    
    // 成功レスポンス（仕様書形式）
    const response = {
      status: 'success',
      data: {
        visitor_id: visitorId,
        patient_name: requestData.last_name + ' ' + requestData.first_name,
        email: requestData.email || '',
        phone: requestData.phone || '',
        publicity_status: requestData.publicity_status,
        created_at: createdVisitor.created_at || new Date().toISOString()
      }
    };
    
    // 会社情報がある場合は追加
    if (companyInfo) {
      response.data.company_info = companyInfo;
    }
    
    Logger.log('createCompanyVisitor完了: ' + JSON.stringify(response));
    return response;
    
  } catch (error) {
    // エラーの詳細をログに記録
    Logger.log('=== createCompanyVisitor エラー詳細 ===');
    Logger.log('エラーメッセージ: ' + error.toString());
    Logger.log('エラースタック: ' + error.stack);
    Logger.log('リクエストデータ: ' + JSON.stringify(requestData));
    
    // VisitorService.createVisitor の呼び出し箇所を特定
    if (error.toString().includes('VisitorService')) {
      Logger.log('VisitorService関連のエラーです');
    }
    
    // 実行ログシートに詳細を記録
    try {
      Utils.logToSheet('createCompanyVisitor エラー', 'ERROR', 
        JSON.stringify({
          message: error.toString(),
          stack: error.stack,
          requestData: requestData,
          timestamp: new Date().toISOString()
        })
      );
    } catch (logError) {
      Logger.log('ログ記録中のエラー: ' + logError.toString());
    }
    
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: '来院者登録中にエラーが発生しました',
        details: error.toString() + ' | Stack: ' + error.stack
      }
    };
  }
}

/**
 * 患者別予約可能スロットを取得
 * @param {Object} params - パラメータ
 * @return {Object} 予約可能スロットレスポンス
 */
function getPatientAvailableSlots(params) {
  try {
    Logger.log('getPatientAvailableSlots開始: ' + JSON.stringify(params));
    
    const { visitorId, menuId, date, dateRange, includeRoomInfo, pairBooking, allowMultipleSameDay } = params;
    
    // 必須パラメータチェック
    if (!visitorId) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '患者IDが指定されていません',
          details: null
        }
      };
    }
    
    if (!menuId) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: 'メニューIDが指定されていません',
          details: null
        }
      };
    }
    
    if (!date) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '日付が指定されていません',
          details: null
        }
      };
    }
    
    // 日付検証
    const requestDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(requestDate.getTime())) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '日付形式が不正です',
          details: 'YYYY-MM-DD形式で指定してください'
        }
      };
    }
    
    if (requestDate < today) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_DATE',
          message: '過去の日付は指定できません',
          details: null
        }
      };
    }
    
    // 日付範囲の検証
    if (dateRange < 1 || dateRange > 30) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_DATE_RANGE',
          message: '日付範囲が無効（1-30日）',
          details: `指定された日付範囲: ${dateRange}日`
        }
      };
    }
    
    // 患者情報の取得
    const visitorService = new VisitorService();
    const visitor = visitorService.getVisitorById(visitorId);
    
    if (!visitor) {
      return {
        status: 'error',
        error: {
          code: 'PATIENT_NOT_FOUND',
          message: '患者が見つからない',
          details: `患者ID: ${visitorId}`
        }
      };
    }
    
    // メニュー情報の取得
    const menuService = new MenuService();
    const menu = menuService.getMenuById(menuId);
    
    if (!menu) {
      return {
        status: 'error',
        error: {
          code: 'MENU_NOT_FOUND',
          message: 'メニューが見つからない',
          details: `メニューID: ${menuId}`
        }
      };
    }
    
    // AvailabilityCheckServiceを使用して空き情報を取得
    const availabilityCheckService = new AvailabilityCheckService();
    const availabilityData = availabilityCheckService.getAvailableSlots(
      visitorId,
      menuId,
      date,
      {
        dateRange: dateRange,
        includeRoomInfo: includeRoomInfo,
        pairBooking: pairBooking,
        allowMultipleSameDay: allowMultipleSameDay,
        timeSpacing: 5 // 5分間隔
      }
    );
    
    // 施術間隔ルールの取得
    const treatmentIntervalService = new TreatmentIntervalService();
    const intervalRules = treatmentIntervalService.getApplicableRules(menuId, menu['メニュー名']);
    
    // レスポンスの整形
    const response = {
      status: 'success',
      data: {
        patient_info: {
          visitor_id: visitorId,
          name: visitor.name || visitor['患者名']
        },
        menu_info: {
          menu_id: menuId,
          menu_name: menu['メニュー名'],
          duration_minutes: menu['所要時間'] || 60,
          required_room_type: menu['部屋タイプ'] || 'treatment'
        },
        search_criteria: {
          start_date: date,
          end_date: calculateEndDate(date, dateRange),
          date_range_days: dateRange,
          pair_booking: pairBooking,
          allow_multiple_same_day: allowMultipleSameDay
        },
        treatment_interval_rules: intervalRules ? {
          has_restrictions: true,
          minimum_days_between_treatments: intervalRules.intervalDays,
          last_treatment_date: availabilityData.constraints?.lastTreatmentDate || null,
          next_available_date: availabilityData.constraints?.nextAvailableDate || null
        } : {
          has_restrictions: false,
          minimum_days_between_treatments: 0,
          last_treatment_date: null,
          next_available_date: null
        },
        available_slots: formatAvailableSlots(availabilityData.slots, includeRoomInfo),
        summary: {
          total_available_slots: availabilityData.totalAvailable || 0,
          available_days: countAvailableDays(availabilityData.slots),
          earliest_available: findEarliestSlot(availabilityData.slots),
          restrictions_applied: getAppliedRestrictions(availabilityData.constraints)
        }
      }
    };
    
    Logger.log('getPatientAvailableSlots完了');
    return response;
    
  } catch (error) {
    Logger.log('getPatientAvailableSlots エラー: ' + error.toString());
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
 * 終了日を計算
 * @param {string} startDate - 開始日
 * @param {number} dateRange - 日数
 * @return {string} 終了日
 */
function calculateEndDate(startDate, dateRange) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + dateRange - 1);
  return Utilities.formatDate(endDate, 'JST', 'yyyy-MM-dd');
}

/**
 * 空きスロットをフォーマット
 * @param {Array} slots - スロット配列
 * @param {boolean} includeRoomInfo - 部屋情報を含めるか
 * @return {Array} フォーマット済みスロット
 */
function formatAvailableSlots(slots, includeRoomInfo) {
  if (!slots || !Array.isArray(slots)) return [];
  
  // 日付ごとにグループ化
  const slotsByDate = {};
  
  slots.forEach(slot => {
    const date = slot.date;
    if (!slotsByDate[date]) {
      const dateObj = new Date(date);
      slotsByDate[date] = {
        date: date,
        day_of_week: ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()],
        slots: []
      };
    }
    
    const formattedSlot = {
      start_time: slot.time,
      end_time: calculateEndTime(slot.time, slot.duration || 60),
      duration_minutes: slot.duration || 60,
      is_available: slot.available,
      unavailable_reason: slot.available ? null : (slot.reason || '予約済み'),
      restrictions: {
        treatment_interval_ok: slot.intervalOk !== false,
        same_day_limit_ok: slot.sameDayOk !== false,
        pair_room_available: slot.pairAvailable || false
      }
    };
    
    if (includeRoomInfo && slot.availableRooms) {
      formattedSlot.room_info = {
        room_id: slot.availableRooms[0]?.id || null,
        room_name: slot.availableRooms[0]?.name || null,
        room_type: slot.availableRooms[0]?.type || null,
        equipment: slot.availableRooms[0]?.equipment || []
      };
    } else {
      formattedSlot.room_info = null;
    }
    
    slotsByDate[date].slots.push(formattedSlot);
  });
  
  // 配列に変換して日付順にソート
  return Object.values(slotsByDate).sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
}

/**
 * 終了時刻を計算
 * @param {string} startTime - 開始時刻
 * @param {number} durationMinutes - 所要時間（分）
 * @return {string} 終了時刻
 */
function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

/**
 * 利用可能な日数をカウント
 * @param {Array} slots - スロット配列
 * @return {number} 利用可能な日数
 */
function countAvailableDays(slots) {
  if (!slots || !Array.isArray(slots)) return 0;
  
  const availableDates = new Set();
  slots.forEach(slot => {
    if (slot.available) {
      availableDates.add(slot.date);
    }
  });
  
  return availableDates.size;
}

/**
 * 最も早い利用可能スロットを見つける
 * @param {Array} slots - スロット配列
 * @return {string|null} 最も早いスロット
 */
function findEarliestSlot(slots) {
  if (!slots || !Array.isArray(slots)) return null;
  
  const availableSlots = slots.filter(slot => slot.available);
  if (availableSlots.length === 0) return null;
  
  availableSlots.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`);
    const dateB = new Date(`${b.date} ${b.time}`);
    return dateA - dateB;
  });
  
  const earliest = availableSlots[0];
  return `${earliest.date} ${earliest.time}`;
}

/**
 * 適用された制約を取得
 * @param {Object} constraints - 制約情報
 * @return {Array} 制約リスト
 */
function getAppliedRestrictions(constraints) {
  const restrictions = [];
  
  if (constraints?.treatmentInterval) {
    restrictions.push('treatment_interval');
  }
  
  if (constraints?.sameDayRestriction) {
    restrictions.push('same_day_limit');
  }
  
  if (constraints?.roomAvailability) {
    restrictions.push('room_availability');
  }
  
  return restrictions;
}

/**
 * 会社別来院者一覧を取得
 * @param {string} companyId - 会社ID
 * @return {Object} 来院者一覧レスポンス
 */
function getCompanyVisitorsList(companyId) {
  try {
    Logger.log(`getCompanyVisitorsList開始: companyId=${companyId}`);
    
    // CompanyVisitorServiceを使用して来院者一覧を取得
    const companyVisitorService = new CompanyVisitorService();
    const visitors = companyVisitorService.getCompanyVisitors(companyId);
    
    Logger.log(`取得した来院者数: ${visitors.length}`);
    
    // 会社名を取得（最初の来院者から取得、なければ空文字）
    const companyName = visitors.length > 0 ? visitors[0].companyName : '';
    
    // PHPで必要な情報のみを抽出
    const visitorsList = visitors.map(visitor => ({
      visitor_id: visitor.visitorId,
      name: visitor.visitorName,
      kana: visitor.visitorKana || '', // カナ情報を患者マスタから取得する必要がある
      gender: visitor.gender || '',
      is_public: visitor.isPublic
    }));
    
    // カナ情報を患者マスタから取得
    const visitorsWithKana = visitorsList.map(visitor => {
      const kana = getVisitorKanaFromMaster(visitor.visitor_id);
      return {
        ...visitor,
        kana: kana || ''
      };
    });
    
    // 成功レスポンス
    const response = {
      status: 'success',
      data: {
        company_id: companyId,
        company_name: companyName,
        total_count: visitorsWithKana.length,
        visitors: visitorsWithKana
      },
      timestamp: new Date().toISOString()
    };
    
    Logger.log('getCompanyVisitorsList完了: ' + JSON.stringify(response));
    return response;
    
  } catch (error) {
    Logger.log('getCompanyVisitorsList Error: ' + error.toString());
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: '来院者一覧取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * 患者マスタから来院者のカナ情報を取得
 * @param {string} visitorId - 来院者ID
 * @return {string} カナ名
 */
function getVisitorKanaFromMaster(visitorId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
    const sheet = spreadsheet.getSheetByName(Config.getSheetNames().visitors);
    
    if (!sheet) {
      Logger.log('患者マスタシートが見つかりません');
      return '';
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // カラムインデックスを取得
    const idIndex = headers.indexOf('visitor_id');
    const kanaIndex = headers.indexOf('カナ');
    
    if (idIndex === -1 || kanaIndex === -1) {
      Logger.log('必要なカラムが見つかりません');
      return '';
    }
    
    // visitor_idで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === visitorId) {
        return data[i][kanaIndex] || '';
      }
    }
    
    Logger.log(`visitor_id ${visitorId} のカナ情報が見つかりません`);
    return '';
    
  } catch (error) {
    Logger.log('getVisitorKanaFromMaster Error: ' + error.toString());
    return '';
  }
}

/**
 * 来院者の公開設定を更新
 * @param {string} companyId - 会社ID
 * @param {string} visitorId - 来院者ID
 * @param {Object} requestData - リクエストデータ
 * @return {Object} 更新結果レスポンス
 */
function updateVisitorVisibility(companyId, visitorId, requestData) {
  try {
    Logger.log(`updateVisitorVisibility開始: companyId=${companyId}, visitorId=${visitorId}`);
    
    // 必須パラメータの検証
    if (!companyId) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'company_idは必須です',
          details: null
        }
      };
    }
    
    if (!visitorId) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'visitor_idは必須です',
          details: null
        }
      };
    }
    
    if (requestData.is_public === undefined) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'is_publicは必須です',
          details: null
        }
      };
    }
    
    // is_publicのバリデーション
    if (typeof requestData.is_public !== 'boolean') {
      return {
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'is_publicはboolean型である必要があります',
          details: `指定された値: ${requestData.is_public} (${typeof requestData.is_public})`
        }
      };
    }
    
    Logger.log(`更新内容: is_public=${requestData.is_public}`);
    
    // CompanyVisitorServiceを使用して公開設定を更新
    const companyVisitorService = new CompanyVisitorService();
    
    try {
      const updateResult = companyVisitorService.updateCompanyVisitor(
        companyId,
        visitorId,
        { isPublic: requestData.is_public }
      );
      
      if (updateResult.success) {
        Logger.log('公開設定更新成功');
        
        // 成功レスポンス
        const response = {
          status: 'success',
          message: '公開設定を更新しました',
          data: {
            company_id: companyId,
            visitor_id: visitorId,
            is_public: requestData.is_public,
            updated_at: new Date().toISOString()
          }
        };
        
        Logger.log('updateVisitorVisibility完了: ' + JSON.stringify(response));
        return response;
        
      } else {
        Logger.log('公開設定更新失敗: ' + updateResult.error);
        return {
          status: 'error',
          error: {
            code: 'UPDATE_FAILED',
            message: '公開設定の更新に失敗しました',
            details: updateResult.error
          }
        };
      }
      
    } catch (updateError) {
      Logger.log('CompanyVisitorService更新エラー: ' + updateError.toString());
      
      // 来院者が見つからない場合
      if (updateError.message.includes('指定された来院者が見つかりません')) {
        return {
          status: 'error',
          error: {
            code: 'VISITOR_NOT_FOUND',
            message: '指定された来院者が見つかりません',
            details: `company_id: ${companyId}, visitor_id: ${visitorId}`
          }
        };
      }
      
      // その他のエラー
      return {
        status: 'error',
        error: {
          code: 'UPDATE_ERROR',
          message: '公開設定の更新中にエラーが発生しました',
          details: updateError.toString()
        }
      };
    }
    
  } catch (error) {
    Logger.log('updateVisitorVisibility Error: ' + error.toString());
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: '公開設定更新中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * 予約履歴からメニューごとの使用回数を集計
 * @param {Array} reservations - 予約履歴
 * @return {Object} メニューID別の使用回数と最終使用日
 */
function aggregateMenuUsage(reservations) {
  const usage = {};
  
  reservations.forEach(reservation => {
    // メニュー情報の取得（複数の可能性のあるフィールドから）
    let menuId = null;
    let menuName = null;
    
    // 直接フィールドから
    if (reservation.menu_id) {
      menuId = reservation.menu_id;
      menuName = reservation.menu_name || '';
    }
    // menusの配列から
    else if (reservation.menus && reservation.menus.length > 0) {
      menuId = reservation.menus[0].id || reservation.menus[0].menu_id;
      menuName = reservation.menus[0].name || '';
    }
    
    if (menuId) {
      if (!usage[menuId]) {
        usage[menuId] = {
          menu_id: menuId,
          menu_name: menuName,
          count: 0,
          last_used_date: null
        };
      }
      
      usage[menuId].count++;
      
      // 最終使用日の更新
      const reservationDate = reservation.date || reservation.start_at;
      if (reservationDate) {
        const date = new Date(reservationDate);
        if (!usage[menuId].last_used_date || date > new Date(usage[menuId].last_used_date)) {
          usage[menuId].last_used_date = formatDate(date);
        }
      }
    }
  });
  
  return usage;
}

/**
 * 使用履歴に基づいてメニューをフィルタリング・分類
 * @param {Array} allMenus - 全メニューリスト
 * @param {Object} menuUsage - メニュー使用履歴
 * @return {Array} フィルタリング済みメニューリスト
 */
function filterMenusByUsageHistory(allMenus, menuUsage) {
  const filteredMenus = [];
  
  // デバッグログ: 入力データの確認（サマリー情報のみ）
  Logger.log('=== filterMenusByUsageHistory START ===');
  Logger.log(`全メニュー数: ${allMenus.length}`);
  Logger.log(`メニュー使用履歴のキー数: ${Object.keys(menuUsage).length}`);
  
  // 最初の数個のメニューだけ詳細を出力
  const debugMenuCount = Math.min(3, allMenus.length);
  for (let i = 0; i < debugMenuCount; i++) {
    const menu = allMenus[i];
    Logger.log(`メニュー[${i}] サンプル: ${menu.name} (ID: ${menu.menu_id})`);
  }
  
  let skipCount = 0;
  let displayCount = 0;
  
  allMenus.forEach((menu, index) => {
    // 有効かつオンライン予約可能なメニューのみ
    // 注意: スプレッドシートのカラム名が日本語の場合も考慮
    const isActive = menu.is_active !== undefined ? menu.is_active : 
                    (menu['有効フラグ'] === true || menu['有効フラグ'] === 'TRUE' || 
                     menu['有効フラグ'] === 'true' || menu['有効フラグ'] === 1 || 
                     menu['有効フラグ'] === '1' || menu['有効フラグ'] === '' || 
                     menu['有効フラグ'] === null || menu['有効フラグ'] === undefined);
    
    const isOnline = menu.is_online !== undefined ? menu.is_online :
                    (menu['オンライン予約フラグ'] === true || menu['オンライン予約フラグ'] === 'TRUE' || 
                     menu['オンライン予約フラグ'] === 'true' || menu['オンライン予約フラグ'] === 1 || 
                     menu['オンライン予約フラグ'] === '1' || menu['オンライン予約フラグ'] === '' || 
                     menu['オンライン予約フラグ'] === null || menu['オンライン予約フラグ'] === undefined);
    
    if (!isActive || !isOnline) {
      skipCount++;
      return;
    }
    
    const usage = menuUsage[menu.menu_id] || { count: 0, last_used_date: null };
    const isFirstTime = usage.count === 0;
    
    // 初回用メニューの判定（メニュー名に「初回」「初診」「カウンセリング」が含まれる）
    const isFirstTimeMenu = /初回|初診|カウンセリング|初めて/.test(menu.name);
    
    // 表示条件の判定
    let shouldDisplay = true;
    
    // 開発環境では全メニューを表示（デバッグ用）
    const isDevelopment = true; // TODO: 環境変数から取得するように変更
    
    if (!isDevelopment) {
      // 初回メニューは初回のみ表示
      if (isFirstTimeMenu && !isFirstTime) {
        shouldDisplay = false;
      }
      // 通常メニューで「2回目以降」などの表記がある場合は、初回は非表示
      else if (/2回目|２回目|以降/.test(menu.name) && isFirstTime) {
        shouldDisplay = false;
      }
    }
    
    if (shouldDisplay) {
      displayCount++;
      filteredMenus.push({
        menu_id: menu.menu_id,
        name: menu.name,
        category: menu.category || '',
        category_id: menu.categoryId || '',
        is_first_time: isFirstTime,
        usage_count: usage.count,
        last_used_date: usage.last_used_date,
        price: menu.price || 0,
        price_with_tax: menu.price_with_tax || 0,
        duration_minutes: menu.duration_minutes || 60,
        description: menu.description || '',
        ticket_type: menu.ticketType || '',
        required_tickets: menu.requiredTickets || 0,
        display_priority: isFirstTimeMenu && isFirstTime ? 1 : 2 // 初回メニューを優先表示
      });
    }
  });
  
  Logger.log(`フィルタリング結果: 表示${displayCount}件、スキップ${skipCount}件 (合計${allMenus.length}件)`);
  Logger.log('=== filterMenusByUsageHistory END ===');
  
  // 表示優先度でソート（初回メニューを上位に）
  filteredMenus.sort((a, b) => {
    if (a.display_priority !== b.display_priority) {
      return a.display_priority - b.display_priority;
    }
    // 同じ優先度の場合はカテゴリ順、メニュー名順
    if (a.category !== b.category) {
      return (a.category || '').localeCompare(b.category || '');
    }
    return (a.name || '').localeCompare(b.name || '');
  });
  
  // display_priorityフィールドを削除（内部的な並び替え用）
  filteredMenus.forEach(menu => delete menu.display_priority);
  
  return filteredMenus;
}

function test_document() {
  getPatientDocuments('45e9a511-ba78-4b21-9535-9154d5740846');
}

/**
 * 患者の書類一覧を取得
 * @param {string} visitorId - 患者ID
 * @return {Object} 書類一覧レスポンス
 */
function getPatientDocuments(visitorId) {
  try {
    Logger.log(`getPatientDocuments開始: visitorId=${visitorId}`);
    
    // DocumentManagerServiceを使用
    const documentManager = new DocumentManagerService();
    
    // 1. 患者の書類一覧を取得
    const documents = documentManager.getDocumentsByPatient(visitorId);
    Logger.log(`取得した書類数: ${documents.length}`);
    
    // 2. フォルダ一覧を取得
    const folders = documentManager.getFoldersByPatient(visitorId);
    Logger.log(`取得したフォルダ数: ${folders.length}`);
    
    // 3. フォルダIDからフォルダ名へのマッピングを作成
    const folderIdToName = {};
    folders.forEach(folder => {
      folderIdToName[folder.folderId] = folder.folderName;
    });
    
    // 4. 書類をフォルダ名別に整理
    const documentsByFolderName = {};
    const rootDocuments = [];
    
    documents.forEach(doc => {
      // 書類データを整形
      const formattedDoc = {
        document_id: doc.documentId,
        title: doc.documentName,
        url: generateDocumentUrl(doc.documentId),
        upload_date: formatDate(doc.uploadDate),
        treatment_name: doc.treatmentName || '一般書類',
        expiry_date: doc.expiryDate ? formatDate(doc.expiryDate) : null,
        status: doc.status || '有効'
      };
      
      if (doc.folderId && folderIdToName[doc.folderId]) {
        const folderName = folderIdToName[doc.folderId];
        if (!documentsByFolderName[folderName]) {
          documentsByFolderName[folderName] = [];
        }
        documentsByFolderName[folderName].push(formattedDoc);
      } else {
        rootDocuments.push(formattedDoc);
      }
    });
    
    // フォルダに属さない書類がある場合は「その他書類」として追加
    if (rootDocuments.length > 0) {
      documentsByFolderName['その他書類'] = rootDocuments;
    }
    
    // 5. 患者名を取得（オプション）
    let patientName = '';
    try {
      const visitorService = new VisitorService();
      const visitor = visitorService.getVisitorById(visitorId);
      if (visitor) {
        patientName = visitor.name || '';
      }
    } catch (e) {
      Logger.log('患者名の取得に失敗: ' + e.toString());
    }
    
    // 成功レスポンス
    const response = {
      status: 'success',
      data: {
        patient_id: visitorId,
        patient_name: patientName,
        ...documentsByFolderName,
        total_count: documents.length
      },
      timestamp: new Date().toISOString()
    };
    
    Logger.log(response);
    return response;
    
  } catch (error) {
    Logger.log(`getPatientDocuments Error: ${error.toString()}`);
    Logger.log(`getPatientDocuments Error Stack: ${error.stack}`);
    
    // エラーレスポンス
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: '書類一覧の取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}


/**
 * 書類URLを生成
 * @param {string} documentId - 書類ID
 * @return {string} 書類URL
 */
function generateDocumentUrl(documentId) {
  // Google DriveのファイルIDとして使用
  return `https://drive.google.com/file/d/${documentId}/view`;
}

/**
 * getUserFullInfoByLineIdFormattedのテスト関数
 */
function testGetUserFullInfoByLineIdFormatted() {
  try {
    Logger.log('=== getUserFullInfoByLineIdFormatted テスト開始 ===');
    
    // テスト用のLINE ID（実際のデータに存在するIDを使用）
    const testLineId = 'U1234567890abcdef'; // 実際のLINE IDに置き換えてください
    
    // 関数を実行
    const result = getUserFullInfoByLineIdFormatted(testLineId);
    
    // 結果を表示
    Logger.log('=== テスト結果 ===');
    Logger.log(JSON.stringify(result, null, 2));
    
    // 結果の検証
    if (result.error) {
      Logger.log(`エラー: ${result.error}`);
    } else {
      Logger.log('✅ visitor情報: ' + (result.visitor ? 'OK' : 'NG'));
      Logger.log('✅ company情報: ' + (result.company ? 'OK' : 'NG'));
      Logger.log('✅ ticketInfo: ' + (Array.isArray(result.ticketInfo) ? `OK (${result.ticketInfo.length}件)` : 'NG'));
      Logger.log('✅ docsinfo: ' + (Array.isArray(result.docsinfo) ? `OK (${result.docsinfo.length}件)` : 'NG'));
      Logger.log('✅ ReservationHistory: ' + (Array.isArray(result.ReservationHistory) ? `OK (${result.ReservationHistory.length}件)` : 'NG'));
    }
    
    Logger.log('=== テスト完了 ===');
    return result;
    
  } catch (error) {
    Logger.log(`testGetUserFullInfoByLineIdFormatted Error: ${error.toString()}`);
    return { error: error.message };
  }
}

/**
 * LINE通知を送信（PHP Integration API用）
 * @param {Object} requestData - リクエストデータ
 * @return {Object} レスポンス
 */
function sendLineNotification(requestData) {
  try {
    Logger.log('sendLineNotification: ' + JSON.stringify(requestData));
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // 通知を送信
    const result = lineNotificationApi.sendNotification(requestData);
    
    return {
      status: 'success',
      data: result
    };
  } catch (error) {
    Logger.log('sendLineNotification error: ' + error.toString());
    return {
      status: 'error',
      error: {
        code: 'NOTIFICATION_FAILED',
        message: 'LINE通知の送信に失敗しました',
        details: error.toString()
      }
    };
  }
}

/**
 * LINE通知をスケジュール（PHP Integration API用）
 * @param {Object} requestData - リクエストデータ
 * @return {Object} レスポンス
 */
function scheduleLineNotification(requestData) {
  try {
    Logger.log('scheduleLineNotification: ' + JSON.stringify(requestData));
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // 通知をスケジュール
    const result = lineNotificationApi.scheduleNotification(requestData);
    
    return {
      status: 'success',
      data: result
    };
  } catch (error) {
    Logger.log('scheduleLineNotification error: ' + error.toString());
    return {
      status: 'error',
      error: {
        code: 'SCHEDULE_FAILED',
        message: 'LINE通知のスケジュールに失敗しました',
        details: error.toString()
      }
    };
  }
}

/**
 * LINE通知テンプレート一覧を取得（PHP Integration API用）
 * @return {Object} レスポンス
 */
function getLineNotificationTemplates() {
  try {
    Logger.log('getLineNotificationTemplates');
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // テンプレート一覧を取得
    const result = lineNotificationApi.getTemplates();
    
    return {
      status: 'success',
      data: result
    };
  } catch (error) {
    Logger.log('getLineNotificationTemplates error: ' + error.toString());
    return {
      status: 'error',
      error: {
        code: 'TEMPLATE_FETCH_FAILED',
        message: 'テンプレート一覧の取得に失敗しました',
        details: error.toString()
      }
    };
  }
}

/**
 * LINE通知ステータスを取得（PHP Integration API用）
 * @param {string} notificationId - 通知ID
 * @return {Object} レスポンス
 */
function getLineNotificationStatus(notificationId) {
  try {
    Logger.log('getLineNotificationStatus: ' + notificationId);
    
    if (!notificationId) {
      return {
        status: 'error',
        error: {
          code: 'MISSING_PARAMETER',
          message: 'notificationIdパラメータが必要です',
          details: null
        }
      };
    }
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // ステータスを取得
    const result = lineNotificationApi.getNotificationStatus(notificationId);
    
    return {
      status: 'success',
      data: result
    };
  } catch (error) {
    Logger.log('getLineNotificationStatus error: ' + error.toString());
    return {
      status: 'error',
      error: {
        code: 'STATUS_FETCH_FAILED',
        message: '通知ステータスの取得に失敗しました',
        details: error.toString()
      }
    };
  }
}