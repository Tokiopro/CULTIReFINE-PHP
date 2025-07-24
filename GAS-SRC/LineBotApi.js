/**
 * LINE Bot統合システム - Medical Force API連携
 * 
 * LINEリッチメニューからの要求を受信し、Medical Force APIと連携してレスポンスを返す
 * 既存のWebApi.jsとは独立して動作し、既存システムに影響を与えない
 */

/**
 * LINE Bot専用のPOSTリクエストエントリーポイント
 * 注意: このシステムは独立したWeb Appとしてデプロイする
 */
function doPostLineBot(e) {
  const startTime = new Date().getTime();
  
  try {
    // リクエストの解析
    const request = parseLineBotRequest(e);
    
    // リクエストの検証
    const validationResult = validateLineBotRequest(request);
    if (!validationResult.isValid) {
      return createLineBotErrorResponse(
        'INVALID_REQUEST',
        validationResult.message,
        request.requestId
      );
    }
    
    // 重複リクエストチェック
    if (isDuplicateRequest(request.requestId)) {
      return createLineBotErrorResponse(
        'DUPLICATE_REQUEST',
        'このリクエストは既に処理されています',
        request.requestId
      );
    }
    
    // アクション処理
    let response;
    switch (request.action.type) {
      case 'getAvailableSlots':
        response = handleGetAvailableSlots(request);
        break;
      case 'getUserReservations':
        response = handleGetUserReservations(request);
        break;
      case 'getClinicInfo':
        response = handleGetClinicInfo(request);
        break;
      case 'getContactInfo':
        response = handleGetContactInfo(request);
        break;
      default:
        return createLineBotErrorResponse(
          'INVALID_REQUEST',
          `不明なアクション: ${request.action.type}`,
          request.requestId
        );
    }
    
    // 処理時間を記録
    const processingTime = (new Date().getTime() - startTime) / 1000;
    
    // ログ記録
    logLineBotRequest(request, response, processingTime);
    
    // レスポンスを返す
    return formatLineBotResponse(response, request, processingTime);
    
  } catch (error) {
    Logger.log(`LINE Bot API エラー: ${error.toString()}`);
    return createLineBotErrorResponse(
      'INTERNAL_ERROR',
      '内部エラーが発生しました',
      e.postData ? JSON.parse(e.postData.contents).requestId : null
    );
  }
}

/**
 * リクエストを解析
 */
function parseLineBotRequest(e) {
  if (!e.postData || !e.postData.contents) {
    throw new Error('リクエストボディが空です');
  }
  
  return JSON.parse(e.postData.contents);
}

/**
 * リクエストの妥当性を検証
 */
function validateLineBotRequest(request) {
  // 必須フィールドチェック
  if (!request.version || !request.requestId || !request.timestamp) {
    return { isValid: false, message: '必須フィールドが不足しています' };
  }
  
  if (!request.source || !request.source.userId) {
    return { isValid: false, message: 'ユーザー情報が不足しています' };
  }
  
  if (!request.action || !request.action.type) {
    return { isValid: false, message: 'アクション情報が不足しています' };
  }
  
  // タイムスタンプチェック（5分以内）
  const requestTime = new Date(request.timestamp).getTime();
  const currentTime = new Date().getTime();
  if (currentTime - requestTime > 5 * 60 * 1000) {
    return { isValid: false, message: 'リクエストが古すぎます' };
  }
  
  return { isValid: true };
}

/**
 * 重複リクエストチェック
 */
function isDuplicateRequest(requestId) {
  const cache = CacheService.getScriptCache();
  const key = `request_${requestId}`;
  
  if (cache.get(key)) {
    return true;
  }
  
  // 5分間キャッシュに保存
  cache.put(key, 'processed', 300);
  return false;
}

/**
 * 予約枠取得処理
 */
function handleGetAvailableSlots(request) {
  try {
    const params = request.action.parameters;
    let slots = [];
    
    // まずスプレッドシートから予約枠データを取得
    const useSpreadsheet = true; // テストモードフラグ
    
    if (useSpreadsheet) {
      // スプレッドシートから取得
      slots = getAvailableSlotsFromSpreadsheet(params);
    } else {
      // Medical Force APIから取得
      const reservationService = new ReservationService();
      slots = reservationService.getAvailableSlots({
        date_from: params.dateRange.from,
        date_to: params.dateRange.to,
        departments: params.departments,
        limit: params.maxResults || 10
      });
    }
    
    // レスポンス用にデータを整形
    const formattedSlots = slots.map(slot => ({
      id: slot.id,
      date: slot.date,
      dateFormatted: formatDateJapanese(slot.date),
      timeSlot: slot.time_slot || slot.timeSlot,
      department: {
        id: slot.department_id,
        name: slot.department_name,
        doctor: slot.doctor_name
      },
      availability: 'available',
      reservationUrl: `https://example.com/reserve/${slot.id}`
    }));
    
    return {
      success: true,
      data: {
        availableSlots: formattedSlots,
        totalCount: formattedSlots.length,
        hasMore: formattedSlots.length >= (params.maxResults || 10)
      }
    };
    
  } catch (error) {
    Logger.log(`予約枠取得エラー: ${error.toString()}`);
    return {
      success: false,
      error: 'MEDICAL_FORCE_ERROR',
      message: 'Medical Forceシステムでエラーが発生しました'
    };
  }
}

/**
 * スプレッドシートから予約枠データを取得
 */
function getAvailableSlotsFromSpreadsheet(params) {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const vacancySheet = sheet.getSheetByName('予約枠');
  
  if (!vacancySheet || vacancySheet.getLastRow() <= 1) {
    Logger.log('予約枠シートが見つからないか、データがありません');
    return [];
  }
  
  const data = vacancySheet.getDataRange().getValues();
  const headers = data[0];
  const slots = [];
  
  // ヘッダーのインデックスを取得
  const idIndex = headers.indexOf('予約枠ID');
  const dateIndex = headers.indexOf('日付');
  const startTimeIndex = headers.indexOf('開始時刻');
  const endTimeIndex = headers.indexOf('終了時刻');
  const deptIdIndex = headers.indexOf('診療科ID');
  const deptNameIndex = headers.indexOf('診療科名');
  const doctorIndex = headers.indexOf('医師名');
  const availableIndex = headers.indexOf('利用可能数');
  
  // データ行を処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const slotDate = row[dateIndex];
    
    // 日付を文字列形式に変換（Dateオブジェクトの場合）
    const slotDateStr = slotDate instanceof Date ? 
      Utilities.formatDate(slotDate, 'Asia/Tokyo', 'yyyy-MM-dd') : 
      slotDate;
    
    // 日付範囲チェック
    if (slotDateStr >= params.dateRange.from && slotDateStr <= params.dateRange.to) {
      // 診療科フィルタリング
      if (params.departments && params.departments.length > 0) {
        if (!params.departments.includes(row[deptNameIndex])) {
          continue;
        }
      }
      
      // 時間帯フィルタリング
      if (params.timePreference && params.timePreference !== 'any') {
        const hour = parseInt(row[startTimeIndex].split(':')[0]);
        if (params.timePreference === 'morning' && hour >= 12) continue;
        if (params.timePreference === 'afternoon' && (hour < 12 || hour >= 17)) continue;
        if (params.timePreference === 'evening' && hour < 17) continue;
      }
      
      // 利用可能数チェック
      if (row[availableIndex] > 0) {
        // 時刻を文字列形式に変換
        const startTimeStr = row[startTimeIndex] instanceof Date ?
          Utilities.formatDate(row[startTimeIndex], 'Asia/Tokyo', 'HH:mm') :
          row[startTimeIndex];
        const endTimeStr = row[endTimeIndex] instanceof Date ?
          Utilities.formatDate(row[endTimeIndex], 'Asia/Tokyo', 'HH:mm') :
          row[endTimeIndex];
          
        slots.push({
          id: row[idIndex],
          date: slotDateStr,
          time_slot: `${startTimeStr}-${endTimeStr}`,
          department_id: row[deptIdIndex],
          department_name: row[deptNameIndex],
          doctor_name: row[doctorIndex],
          available_count: row[availableIndex]
        });
      }
    }
  }
  
  // 制限数の適用
  if (params.maxResults) {
    return slots.slice(0, params.maxResults);
  }
  
  return slots;
}

/**
 * ユーザー予約確認処理
 */
function handleGetUserReservations(request) {
  try {
    const userId = request.source.userId;
    const params = request.action.parameters;
    const useSpreadsheet = true; // テストモードフラグ
    
    // LINEユーザーIDから患者IDを取得
    const patientId = getPatientIdByLineUserId(userId);
    
    if (!patientId) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'ユーザーが見つかりません'
      };
    }
    
    let reservations = [];
    
    if (useSpreadsheet) {
      // スプレッドシートから取得
      reservations = getReservationsFromSpreadsheet(patientId, params);
    } else {
      // Medical Force APIから取得
      const reservationService = new ReservationService();
      reservations = reservationService.getReservationsByPatientId(patientId, {
        statusFilter: params.statusFilter,
        includeHistory: params.includeHistory,
        sortBy: params.sortBy
      });
    }
    
    // レスポンス用にデータを整形
    const formattedReservations = reservations.map(reservation => ({
      id: reservation.id,
      date: reservation.date,
      dateFormatted: formatDateJapanese(reservation.date),
      timeSlot: reservation.time_slot || `${reservation.start_time}-${reservation.end_time}`,
      department: {
        id: reservation.department_id || 'DEPT001',
        name: reservation.department || reservation.department_name,
        doctor: reservation.doctor || reservation.doctor_name
      },
      status: reservation.status,
      createdAt: reservation.created_at || reservation.created_date
    }));
    
    return {
      success: true,
      data: {
        reservations: formattedReservations,
        totalCount: formattedReservations.length
      }
    };
    
  } catch (error) {
    Logger.log(`予約確認エラー: ${error.toString()}`);
    return {
      success: false,
      error: 'MEDICAL_FORCE_ERROR',
      message: 'Medical Forceシステムでエラーが発生しました'
    };
  }
}

/**
 * LINEユーザーIDから患者IDを取得（簡略版）
 */
function getPatientIdByLineUserId(lineUserId) {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
  
  if (!lineUserSheet) {
    return null;
  }
  
  const data = lineUserSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineUserId) {
      return data[i][1]; // 患者ID
    }
  }
  
  return null;
}

/**
 * スプレッドシートから予約情報を取得
 */
function getReservationsFromSpreadsheet(patientId, params) {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const reservationSheet = sheet.getSheetByName('予約情報');
  
  if (!reservationSheet || reservationSheet.getLastRow() <= 1) {
    Logger.log('予約情報シートが見つからないか、データがありません');
    return [];
  }
  
  const data = reservationSheet.getDataRange().getValues();
  const headers = data[0];
  const reservations = [];
  
  // ヘッダーのインデックスを取得
  const idIndex = headers.indexOf('予約ID');
  const patientIdIndex = headers.indexOf('患者ID');
  const dateIndex = headers.indexOf('予約日');
  const startTimeIndex = headers.indexOf('開始時刻');
  const endTimeIndex = headers.indexOf('終了時刻');
  const deptIndex = headers.indexOf('診療科');
  const doctorIndex = headers.indexOf('医師名');
  const statusIndex = headers.indexOf('ステータス');
  const createdIndex = headers.indexOf('作成日時');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // データ行を処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // 患者IDチェック
    if (row[patientIdIndex] !== patientId) {
      continue;
    }
    
    // ステータスフィルタリング
    if (params.statusFilter && params.statusFilter.length > 0) {
      if (!params.statusFilter.includes(row[statusIndex])) {
        continue;
      }
    }
    
    // 履歴を含めない場合は今日以降の予約のみ
    if (!params.includeHistory) {
      const reservationDate = new Date(row[dateIndex]);
      if (reservationDate < today) {
        continue;
      }
    }
    
    // 日付と時刻を文字列形式に変換
    const dateStr = row[dateIndex] instanceof Date ?
      Utilities.formatDate(row[dateIndex], 'Asia/Tokyo', 'yyyy-MM-dd') :
      row[dateIndex];
    const startTimeStr = row[startTimeIndex] instanceof Date ?
      Utilities.formatDate(row[startTimeIndex], 'Asia/Tokyo', 'HH:mm') :
      row[startTimeIndex];
    const endTimeStr = row[endTimeIndex] instanceof Date ?
      Utilities.formatDate(row[endTimeIndex], 'Asia/Tokyo', 'HH:mm') :
      row[endTimeIndex];
      
    reservations.push({
      id: row[idIndex],
      date: dateStr,
      start_time: startTimeStr,
      end_time: endTimeStr,
      department: row[deptIndex],
      doctor: row[doctorIndex],
      status: row[statusIndex],
      created_date: row[createdIndex]
    });
  }
  
  // ソート
  if (params.sortBy === 'date_desc') {
    reservations.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else {
    // デフォルトは日付昇順
    reservations.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  
  return reservations;
}

/**
 * 診療案内取得処理
 */
function handleGetClinicInfo(request) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'clinic_info';
    
    // キャッシュチェック
    const cachedInfo = cache.get(cacheKey);
    if (cachedInfo) {
      return JSON.parse(cachedInfo);
    }
    
    // スプレッドシートから診療案内情報を取得
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
    const clinicInfoSheet = sheet.getSheetByName('診療案内');
    
    let clinicInfo = '';
    if (clinicInfoSheet) {
      const data = clinicInfoSheet.getDataRange().getValues();
      clinicInfo = data[1][0]; // A2セルから取得
    } else {
      // デフォルトの診療案内
      clinicInfo = `【診療案内】

■診療時間
月〜金：9:00-12:00, 14:00-18:00
土：9:00-12:00
日祝：休診

■診療科目
・内科・外科・整形外科

■所在地
〒123-4567
東京都○○区△△町1-2-3`;
    }
    
    const response = {
      success: true,
      data: {
        clinicInfo: clinicInfo
      }
    };
    
    // 5分間キャッシュ
    cache.put(cacheKey, JSON.stringify(response), 300);
    
    return response;
    
  } catch (error) {
    Logger.log(`診療案内取得エラー: ${error.toString()}`);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: '診療案内の取得に失敗しました'
    };
  }
}

/**
 * お問い合わせ情報取得処理
 */
function handleGetContactInfo(request) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'contact_info';
    
    // キャッシュチェック
    const cachedInfo = cache.get(cacheKey);
    if (cachedInfo) {
      return JSON.parse(cachedInfo);
    }
    
    // スプレッドシートからお問い合わせ情報を取得
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
    const contactInfoSheet = sheet.getSheetByName('お問い合わせ');
    
    let contactInfo = '';
    if (contactInfoSheet) {
      const data = contactInfoSheet.getDataRange().getValues();
      contactInfo = data[1][0]; // A2セルから取得
    } else {
      // デフォルトのお問い合わせ情報
      contactInfo = `【お問い合わせ】

■電話
03-1234-5678

■受付時間
月〜金：9:00-17:00
土：9:00-12:00

■メール
info@tenma-hospital.com`;
    }
    
    const response = {
      success: true,
      data: {
        contactInfo: contactInfo
      }
    };
    
    // 5分間キャッシュ
    cache.put(cacheKey, JSON.stringify(response), 300);
    
    return response;
    
  } catch (error) {
    Logger.log(`お問い合わせ情報取得エラー: ${error.toString()}`);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'お問い合わせ情報の取得に失敗しました'
    };
  }
}

/**
 * レスポンスを仕様書に準拠した形式に整形
 */
function formatLineBotResponse(response, request, processingTime) {
  const timestamp = new Date().toISOString();
  
  if (response.success) {
    const formattedResponse = {
      version: '1.0',
      requestId: request.requestId,
      timestamp: timestamp,
      status: {
        success: true,
        code: 'SUCCESS',
        message: '処理が正常に完了しました'
      },
      data: response.data,
      presentation: {
        messageType: 'structured',
        displayText: generateDisplayText(request.action.type, response.data),
        quickReplies: generateQuickReplies(request.action.type, response.data)
      },
      metadata: {
        processingTime: processingTime,
        dataSource: 'medical_force_api',
        cacheUsed: false
      }
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(formattedResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } else {
    return createLineBotErrorResponse(
      response.error,
      response.message,
      request.requestId
    );
  }
}

/**
 * エラーレスポンスを生成
 */
function createLineBotErrorResponse(errorCode, message, requestId) {
  const errorMessages = {
    'INVALID_REQUEST': 'リクエストが無効です',
    'MISSING_PARAMETERS': '必須パラメータが不足しています',
    'MEDICAL_FORCE_TIMEOUT': 'Medical Forceシステムとの通信がタイムアウトしました',
    'MEDICAL_FORCE_ERROR': 'Medical Forceシステムでエラーが発生しました',
    'USER_NOT_FOUND': 'ユーザーが見つかりません',
    'NO_SLOTS_AVAILABLE': '利用可能な予約枠がありません',
    'PERMISSION_DENIED': 'アクセス権限がありません',
    'INTERNAL_ERROR': '内部エラーが発生しました',
    'DUPLICATE_REQUEST': 'このリクエストは既に処理されています'
  };
  
  const response = {
    version: '1.0',
    requestId: requestId || 'unknown',
    timestamp: new Date().toISOString(),
    status: {
      success: false,
      code: errorCode,
      message: message || errorMessages[errorCode]
    },
    fallback: {
      action: 'showPhoneContact',
      data: {
        phone: '03-1234-5678',
        hours: '月〜金 9:00-17:00'
      }
    },
    presentation: {
      displayText: `申し訳ございません。システムに一時的な問題が発生しています。\n\nお急ぎの場合は下記までお電話ください：\n📞 03-1234-5678`,
      quickReplies: [
        {
          text: 'もう一度試す',
          action: 'retry'
        }
      ]
    }
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 表示テキストを生成
 */
function generateDisplayText(actionType, data) {
  switch (actionType) {
    case 'getAvailableSlots':
      if (data.availableSlots.length === 0) {
        return '申し訳ございません。指定された条件で利用可能な予約枠が見つかりませんでした。';
      }
      return `${data.availableSlots.length}件の予約枠が見つかりました。ご希望の日時を選択してください。`;
      
    case 'getUserReservations':
      if (data.reservations.length === 0) {
        return '現在、予約はありません。';
      }
      return `${data.reservations.length}件の予約があります。`;
      
    case 'getClinicInfo':
      return data.clinicInfo;
      
    case 'getContactInfo':
      return data.contactInfo;
      
    default:
      return '処理が完了しました。';
  }
}

/**
 * クイックリプライを生成
 */
function generateQuickReplies(actionType, data) {
  switch (actionType) {
    case 'getAvailableSlots':
      if (data.availableSlots.length > 0) {
        return [
          {
            text: 'この中から予約する',
            action: 'selectReservation'
          }
        ];
      }
      return [
        {
          text: '他の日時を探す',
          action: 'searchOtherSlots'
        }
      ];
      
    case 'getUserReservations':
      return [
        {
          text: '新しい予約を取る',
          action: 'createReservation'
        }
      ];
      
    default:
      return [];
  }
}

/**
 * 日付を日本語形式にフォーマット
 */
function formatDateJapanese(dateString) {
  const date = new Date(dateString);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  
  return `${month}月${day}日(${weekday})`;
}

/**
 * リクエスト/レスポンスをログに記録
 */
function logLineBotRequest(request, response, processingTime) {
  const log = {
    timestamp: new Date().toISOString(),
    requestId: request.requestId,
    userId: request.source.userId,
    action: request.action.type,
    success: response.success,
    processingTime: processingTime,
    error: response.error || null
  };
  
  Logger.log(`LINE Bot API Log: ${JSON.stringify(log)}`);
  
  // 必要に応じてスプレッドシートにもログを保存
  try {
    const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
    const logSheet = sheet.getSheetByName('LINE Bot Logs') || sheet.insertSheet('LINE Bot Logs');
    
    if (logSheet.getLastRow() === 0) {
      // ヘッダー行を追加
      logSheet.appendRow(['Timestamp', 'Request ID', 'User ID', 'Action', 'Success', 'Processing Time', 'Error']);
    }
    
    logSheet.appendRow([
      log.timestamp,
      log.requestId,
      log.userId,
      log.action,
      log.success,
      log.processingTime,
      log.error
    ]);
  } catch (e) {
    Logger.log(`ログ保存エラー: ${e.toString()}`);
  }
}