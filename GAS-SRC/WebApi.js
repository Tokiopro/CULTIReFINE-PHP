/**
 * Medical Force API連携システム - Web APIエンドポイント
 * 
 * 外部システムからのHTTPリクエストを受け付けて、
 * Medical Force APIへの橋渡しを行う
 */

/**
 * POSTリクエストのエントリーポイント
 * Google Apps ScriptのWeb Appとして公開される
 */
function doPost(e) {
  // デバッグ: すべてのPOSTリクエストをログに記録
  Logger.log('=== doPost 開始 ===');
  Logger.log('POSTリクエスト受信時刻: ' + new Date().toISOString());
  
  try {
    // リクエストの詳細をログ
    Logger.log('e.postData: ' + JSON.stringify(e.postData));
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
    Logger.log('e.parameters: ' + JSON.stringify(e.parameters));
    
    // ヘッダー情報もログ（LINE署名検証用）
    if (e.postData && e.postData.length) {
      Logger.log('postData length: ' + e.postData.length);
      Logger.log('postData type: ' + e.postData.type);
    }
    
    // LINE Webhookイベントの処理を優先
    if (e.postData && e.postData.contents) {
      Logger.log('POSTデータの内容を解析中...');
      try {
        const webhookData = JSON.parse(e.postData.contents);
        Logger.log('解析されたデータ: ' + JSON.stringify(webhookData));
        
        // LINE Webhookの署名検証（X-Line-Signatureヘッダー）
        if (webhookData.events) {
          Logger.log('LINE Webhookイベントを検出！');
          Logger.log('イベント数: ' + webhookData.events.length);
          Logger.log('LINE Webhookイベント詳細: ' + JSON.stringify(webhookData));
          return handleLineWebhookEvents(webhookData.events);
        } else {
          Logger.log('eventsフィールドが見つかりません');
        }
      } catch (webhookError) {
        Logger.log('Webhook解析エラー: ' + webhookError.toString());
        // Webhookでない場合は通常のAPI処理を続行
      }
    } else {
      Logger.log('postDataまたはcontentsが存在しません');
    }
    
    // リクエストの解析
    const requestData = parseRequest(e);
    
    // PHP Integration API用のルーティング（pathパラメータで判定）
    if (requestData.path && requestData.path.startsWith('api/')) {
      Logger.log('PHP Integration API へのPOSTリクエストを転送: path=' + requestData.path);
      return doPostPhpIntegration(e, requestData);
    }
    
    // APIキーの検証
    if (!validateApiKey(requestData.apiKey)) {
      return createErrorResponse('Invalid API key', 401);
    }
    
    // アクションに基づいてルーティング
    const action = requestData.action || e.parameter.action;
    
    switch (action) {
      case 'createPatient':
        return handleCreatePatient(requestData);
      case 'searchPatient':
        return handleSearchPatient(requestData);
      case 'getPatient':
        return handleGetPatient(requestData);
      case 'getLineUserInfo':
        return handleGetLineUserInfo(requestData);
      case 'getPatientByLineId':
        return handleGetPatientByLineId(requestData);
      case 'createPatientWithLine':
        return handleCreatePatientWithLine(requestData);
      case 'createCompanyVisitor':
        return handleCreateCompanyVisitor(requestData);
      case 'updateCompanyVisitorPublicSetting':
        return handleUpdateCompanyVisitorPublicSetting(requestData);
      case 'getDocuments':
        return handleGetDocuments(requestData);
      case 'sendLineNotification':
        return handleSendLineNotification(requestData);
      case 'scheduleLineNotification':
        return handleScheduleLineNotification(requestData);
      case 'getLineTemplates':
        return handleGetLineTemplates(requestData);
      case 'getLineNotificationStatus':
        return handleGetLineNotificationStatus(requestData);
      case 'cancelReservation':
        return handleCancelReservation(requestData);
      case 'syncTodayReservations':
        return handleSyncTodayReservations(requestData);
      case 'sync3DaysReservations':
        return handleSync3DaysReservations(requestData);
      case 'getStructuredMenus':
        return handleGetStructuredMenus(requestData);
      case 'getMenusByCategory':
        return handleGetMenusByCategory(requestData);
      case 'syncMenus':
        return handleSyncMenus(requestData);
      case 'getMenus':
        return handleGetMenus(requestData);
      default:
        return createErrorResponse('Unknown action: ' + action, 400);
    }
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return createErrorResponse('Internal server error: ' + error.message, 500);
  }
}

/**
 * GETリクエストのエントリーポイント（ヘルスチェック・LINE認証用）
 */
function doGet(e) {
  try {
    // デバッグ用：すべてのパラメータをログ出力
    Logger.log('=== doGet リクエスト受信 ===');
    Logger.log('parameters: ' + JSON.stringify(e.parameter));
    Logger.log('queryString: ' + e.queryString);
    Logger.log('contentLength: ' + e.contentLength);
    
    const action = e.parameter.action;
    const code = e.parameter.code;
    const state = e.parameter.state;
    const error = e.parameter.error;
    const path = e.parameter.path;
    
    // PHP統合API用のルーティング（/api/で始まるパス）
    Logger.log('デバッグ: path=' + path + ', action=' + action);
    
    // pathパラメータまたはactionでAPI判定
    if ((path && path.startsWith('api/')) || action === 'api') {
      Logger.log('PHP Integration API へのリクエストを転送: path=' + path + ', action=' + action);
      return doGetPhpIntegration(e);
    }
    
    // path指定がなく、他のパラメータもない場合はヘルスチェック
    if (!action && !code && !state && !error) {
      Logger.log('パラメータなしのリクエスト - ヘルスチェック or デフォルトAPIレスポンス');
      return doGetPhpIntegration(e);
    }
    
    // LINE認証エラーの場合
    if (error) {
      return ContentService.createTextOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>認証エラー</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <h1>認証エラー</h1>
          <p>LINE認証中にエラーが発生しました。</p>
          <p>エラー: ${error}</p>
          <p><a href="javascript:window.close()">閉じる</a></p>
        </body>
        </html>
      `).setMimeType(ContentService.MimeType.HTML);
    }
    
    // LINE認証成功の場合（認証コードがある場合）
    if (code) {
      Logger.log('LINE認証コード受信: ' + code);
      Logger.log('state値: ' + state);
      Logger.log('stateがphp_redirect_で始まるか: ' + (state && state.startsWith('php_redirect_')));
      
      // stateがphp_redirect_で始まる場合はPHPサイトへリダイレクト
      if (state && state.startsWith('php_redirect_')) {
        Logger.log('PHPリダイレクト処理開始');
        
        try {
          // リダイレクト先URL構築
          const redirectUrl = `https://608b-2001-f72-24e0-d00-487b-a4fc-86c8-86b6.ngrok-free.app/line-login/auth/line-callback.php?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&debug=1`;
          
          Logger.log('リダイレクト先: ' + redirectUrl);
          
          // 方法: 複数の方法でリダイレクトを試みる
          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>リダイレクト中...</title>
  <script>
    // 即座にリダイレクト
    window.location.replace('${redirectUrl}');
  </script>
  <meta http-equiv="refresh" content="0; url=${redirectUrl}">
</head>
<body>
  <p>リダイレクト中...</p>
  <p>自動的にリダイレクトされない場合は<a href="${redirectUrl}">こちら</a>をクリックしてください。</p>
  <noscript>
    <p>JavaScriptが無効です。<a href="${redirectUrl}">こちら</a>をクリックしてください。</p>
  </noscript>
</body>
</html>`;
          
          return HtmlService.createHtmlOutput(html)
            .setSandboxMode(HtmlService.SandboxMode.IFRAME)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
          
          /* 一旦コメントアウト - LINE API処理は後で実装
          // LINEユーザー情報を取得
          const lineUserInfo = LineTokenManager.exchangeCodeForUserInfo(code);
          
          // 一時認証トークンを生成
          const authToken = Utilities.getUuid();
          
          // ユーザー情報を一時保存（PHP側で取得可能にする）
          LineTokenManager.saveTemporaryUserInfo(authToken, lineUserInfo);
          */
          
          
        } catch (error) {
          Logger.log('PHP redirect error: ' + error.toString());
          
          // エラー時はエラーページを表示
          return ContentService.createTextOutput(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>認証エラー</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
              <h1>認証エラー</h1>
              <p>LINE認証の処理中にエラーが発生しました。</p>
              <p>エラー: ${error.message}</p>
              <p><a href="javascript:history.back()">戻る</a></p>
            </body>
            </html>
          `).setMimeType(ContentService.MimeType.HTML);
        }
      }
      
      // 既存のpostMessage方式（stateがphp_redirect_で始まらない場合）
      // ただし、LINE会員連携コールバックは除外
      Logger.log(`Debug: action=${action}, state=${state}, stateStartsWith=${state && state.startsWith('member_link_')}`);
      if (action !== 'lineMemberCallback' && (!state || !state.startsWith('member_link_'))) {
        return HtmlService.createHtmlOutput(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>認証成功</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            <h1>認証成功</h1>
            <p>LINE認証が完了しました。</p>
            <p>認証コード: ${code}</p>
            ${state ? `<p>状態: ${state}</p>` : ''}
            <p><a href="javascript:window.close()">閉じる</a></p>
            <script>
              // 親ウィンドウに認証情報を送信（必要に応じて）
              if (window.opener) {
                window.opener.postMessage({
                  type: 'LINE_AUTH_SUCCESS',
                  code: '${code}',
                  state: '${state || ''}'
                }, '*');
              }
            </script>
          </body>
          </html>
        `);
      }
      
      // デバッグ用：LINE会員連携判定
      Logger.log(`LINE会員連携判定: action=${action}, state=${state}`);
      
      // LINE会員連携の場合は専用処理へ（stateで確実に判定）
      if ((state && state.startsWith('member_link_'))) {
        Logger.log('LINE会員連携コールバック処理開始（state判定）');
        // actionパラメータを強制設定
        e.parameter.action = 'lineMemberCallback';
        return doGetLineMemberLink(e);
      }
    }
    
    // LINE会員連携コールバック（codeがない場合）
    if (action === 'lineMemberCallback' || (state && state.startsWith('member_link_'))) {
      Logger.log('LINE会員連携コールバック処理開始（codeなし）');
      // actionパラメータがない場合は設定
      if (!action) {
        e.parameter.action = 'lineMemberCallback';
      }
      return doGetLineMemberLink(e);
    }
    
    // 既存のヘルスチェック機能
    if (action === 'health') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        service: 'Medical Force API Bridge',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // LINE会員連携のテスト
    if (action === 'testLineMember') {
      return ContentService.createTextOutput('LINE会員連携機能は正常に動作しています')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // デフォルトレスポンス（パラメータがない場合）
    return ContentService.createTextOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Medical Force API Bridge</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <h1>Medical Force API Bridge</h1>
        <p>このサービスは正常に動作しています。</p>
        <p>受信パラメータ: ${JSON.stringify(e.parameter)}</p>
        <hr>
        <h3>利用可能なエンドポイント:</h3>
        <ul>
          <li><a href="?action=health">ヘルスチェック (JSON)</a></li>
          <li>LINE認証コールバック (自動処理)</li>
        </ul>
      </body>
      </html>
    `).setMimeType(ContentService.MimeType.HTML);
    
  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    return ContentService.createTextOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>システムエラー</title>
      </head>
      <body>
        <h1>システムエラー</h1>
        <p>処理中にエラーが発生しました。</p>
        <p><a href="javascript:window.close()">閉じる</a></p>
      </body>
      </html>
    `).setMimeType(ContentService.MimeType.HTML);
  }
}

/**
 * リクエストデータを解析
 */
function parseRequest(e) {
  let data = {};
  
  // POSTデータの解析
  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }
  
  // パラメータも含める
  if (e.parameter) {
    Object.assign(data, e.parameter);
  }
  
  return data;
}

/**
 * APIキーの検証
 */
function validateApiKey(apiKey) {
  if (!apiKey) {
    return false;
  }
  
  // スクリプトプロパティから許可されたAPIキーを取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const allowedApiKeys = scriptProperties.getProperty('ALLOWED_API_KEYS');
  
  if (!allowedApiKeys) {
    // APIキーが設定されていない場合は、デフォルトキーと比較
    const defaultKey = scriptProperties.getProperty('DEFAULT_API_KEY');
    return apiKey === defaultKey;
  }
  
  // 複数のAPIキーをサポート（カンマ区切り）
  const keys = allowedApiKeys.split(',').map(key => key.trim());
  return keys.includes(apiKey);
}

/**
 * 患者登録処理
 */
function handleCreatePatient(requestData) {
  try {
    const patientData = requestData.patient;
    
    if (!patientData) {
      return createErrorResponse('Patient data is required', 400);
    }
    
    // 必須項目のチェック
    if (!patientData.name || !patientData.name_kana) {
      return createErrorResponse('Name and name_kana are required', 400);
    }
    
    // VisitorServiceを使用して患者を登録
    const service = new VisitorService();
    const result = service.createVisitor(patientData);
    
    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        visitor_id: result.visitor_id || result.id,
        name: result.name,
        message: '患者登録が完了しました'
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleCreatePatient error: ' + error.toString());
    return createErrorResponse('Failed to create patient: ' + error.message, 500);
  }
}

/**
 * 患者検索処理
 */
function handleSearchPatient(requestData) {
  try {
    const searchParams = requestData.search || {};
    
    // VisitorServiceを使用して患者を検索
    const service = new VisitorService();
    const results = service.searchVisitors(searchParams);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleSearchPatient error: ' + error.toString());
    return createErrorResponse('Failed to search patients: ' + error.message, 500);
  }
}

/**
 * 患者情報取得処理
 */
function handleGetPatient(requestData) {
  try {
    const visitorId = requestData.visitor_id || requestData.id;
    
    if (!visitorId) {
      return createErrorResponse('Visitor ID is required', 400);
    }
    
    // VisitorServiceを使用して患者情報を取得
    const service = new VisitorService();
    const patient = service.getVisitorById(visitorId);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: patient,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetPatient error: ' + error.toString());
    return createErrorResponse('Failed to get patient: ' + error.message, 500);
  }
}

/**
 * LINE ユーザー情報取得処理
 */
function handleGetLineUserInfo(requestData) {
  try {
    const authToken = requestData.auth_token;
    
    if (!authToken) {
      return createErrorResponse('Auth token is required', 400);
    }
    
    // キャッシュからユーザー情報を取得
    const userInfo = LineTokenManager.getTemporaryUserInfo(authToken);
    
    if (!userInfo) {
      return createErrorResponse('User info not found or expired', 404);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: userInfo,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetLineUserInfo error: ' + error.toString());
    return createErrorResponse('Failed to get LINE user info: ' + error.message, 500);
  }
}

/**
 * LINE IDで患者情報を取得
 */
function handleGetPatientByLineId(requestData) {
  try {
    const lineUserId = requestData.lineUserId;
    
    if (!lineUserId) {
      return createErrorResponse('LINE User ID is required', 400);
    }
    
    // スプレッドシートからLINE ID連携情報を検索
    const lineMapping = getLINEPatientMapping(lineUserId);
    
    if (!lineMapping) {
      // 患者が見つからない場合
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: null,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // VisitorServiceを使用して患者情報を取得
    const service = new VisitorService();
    const patient = service.getVisitorById(lineMapping.visitor_id);
    
    // LINE IDも追加して返す
    if (patient) {
      patient.line_user_id = lineUserId;
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: patient,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetPatientByLineId error: ' + error.toString());
    return createErrorResponse('Failed to get patient by LINE ID: ' + error.message, 500);
  }
}

/**
 * LINE情報を含む患者を作成
 */
function handleCreatePatientWithLine(requestData) {
  try {
    const { lineUserId, name, email } = requestData;
    
    if (!lineUserId || !name) {
      return createErrorResponse('LINE User ID and name are required', 400);
    }
    
    // カナ名を自動生成（仮実装 - 実際はPHP側から送るべき）
    const nameKana = convertToKana(name);
    
    // 患者データを構築
    const patientData = {
      name: name,
      name_kana: nameKana,
      line_user_id: lineUserId,
      email: email || '',
      // LINEから登録された患者であることを記録
      note: `LINE ID: ${lineUserId}\n登録日: ${new Date().toLocaleString('ja-JP')}`
    };
    
    // 名前を分割（スペース区切りを想定）
    const nameParts = name.split(/[\s　]+/);
    if (nameParts.length >= 2) {
      patientData.last_name = nameParts[0];
      patientData.first_name = nameParts.slice(1).join(' ');
      patientData.last_name_kana = convertToKana(nameParts[0]);
      patientData.first_name_kana = convertToKana(nameParts.slice(1).join(' '));
    } else {
      patientData.last_name = name;
      patientData.first_name = '';
      patientData.last_name_kana = nameKana;
      patientData.first_name_kana = '';
    }
    
    // VisitorServiceを使用して患者を登録
    const service = new VisitorService();
    const result = service.createVisitor(patientData);
    
    // LINE連携情報を保存
    const visitorId = result.visitor_id || result.id;
    saveLINEPatientMapping(lineUserId, visitorId, name);
    
    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        visitor_id: visitorId,
        name: result.name,
        line_user_id: lineUserId,
        message: 'LINE連携患者が登録されました'
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleCreatePatientWithLine error: ' + error.toString());
    return createErrorResponse('Failed to create patient with LINE: ' + error.message, 500);
  }
}

/**
 * 会社別来院者を登録
 */
function handleCreateCompanyVisitor(requestData) {
  try {
    const { companyId, companyName, visitor } = requestData;
    
    if (!companyId || !companyName || !visitor) {
      return createErrorResponse('Company ID, company name, and visitor data are required', 400);
    }
    
    // 必須項目のチェック
    if (!visitor.name || !visitor.name_kana) {
      return createErrorResponse('Visitor name and name_kana are required', 400);
    }
    
    // まず来院者を作成
    const visitorService = new VisitorService();
    const visitorData = {
      name: visitor.name,
      name_kana: visitor.name_kana,
      phone: visitor.phone || '',
      email: visitor.email || '',
      // 名前を分割（スペース区切りを想定）
      last_name: visitor.last_name || visitor.name.split(/[\s　]+/)[0] || visitor.name,
      first_name: visitor.first_name || visitor.name.split(/[\s　]+/).slice(1).join(' ') || '',
      last_name_kana: visitor.last_name_kana || visitor.name_kana.split(/[\s　]+/)[0] || visitor.name_kana,
      first_name_kana: visitor.first_name_kana || visitor.name_kana.split(/[\s　]+/).slice(1).join(' ') || ''
    };
    
    // 患者を登録
    const createdVisitor = visitorService.createVisitor(visitorData);
    const visitorId = createdVisitor.visitor_id || createdVisitor.id;
    
    // 会社に紐付け
    const companyVisitorService = new CompanyVisitorService();
    const companyVisitorData = {
      visitorId: visitorId,
      memberType: visitor.memberType || 'サブ会員',
      isPublic: visitor.isPublic !== false, // デフォルトはtrue
      position: visitor.position || '',
      lineId: visitor.lineId || ''
    };
    
    const result = companyVisitorService.addVisitorToCompany(companyId, companyName, companyVisitorData);
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to add visitor to company', 400);
    }
    
    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        visitor_id: visitorId,
        company_id: companyId,
        company_name: companyName,
        visitor_name: visitor.name,
        member_type: companyVisitorData.memberType,
        is_public: companyVisitorData.isPublic,
        position: companyVisitorData.position,
        message: '会社別来院者が登録されました'
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleCreateCompanyVisitor error: ' + error.toString());
    return createErrorResponse('Failed to create company visitor: ' + error.message, 500);
  }
}

/**
 * 会社別来院者の公開設定を更新
 */
function handleUpdateCompanyVisitorPublicSetting(requestData) {
  try {
    const { companyId, visitorId, isPublic } = requestData;
    
    if (!companyId || !visitorId || isPublic === undefined) {
      return createErrorResponse('Company ID, visitor ID, and isPublic flag are required', 400);
    }
    
    // CompanyVisitorServiceを使用して更新
    const companyVisitorService = new CompanyVisitorService();
    const result = companyVisitorService.updateCompanyVisitor(companyId, visitorId, {
      isPublic: isPublic
    });
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to update public setting', 400);
    }
    
    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        company_id: companyId,
        visitor_id: visitorId,
        is_public: isPublic,
        message: '公開設定を更新しました'
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleUpdateCompanyVisitorPublicSetting error: ' + error.toString());
    return createErrorResponse('Failed to update public setting: ' + error.message, 500);
  }
}

/**
 * 患者の書類一覧を取得（フォルダ階層付き）
 */
function handleGetDocuments(requestData) {
  try {
    const { visitorId } = requestData;
    
    if (!visitorId) {
      return createErrorResponse('Visitor ID is required', 400);
    }
    
    // ApiClientを使用して書類情報を取得
    const apiClient = new ApiClient();
    const result = apiClient.getDocuments(visitorId);
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to get documents', 400);
    }
    
    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: {
        visitorId: visitorId,
        documents: result.data.folders,
        rootDocuments: result.data.rootDocuments,
        totalDocuments: result.data.totalDocuments
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetDocuments error: ' + error.toString());
    return createErrorResponse('Failed to get documents: ' + error.message, 500);
  }
}

/**
 * LINE通知を送信
 */
function handleSendLineNotification(requestData) {
  try {
    Logger.log('handleSendLineNotification: ' + JSON.stringify(requestData));
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // 通知を送信
    const result = lineNotificationApi.sendNotification(requestData);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleSendLineNotification error: ' + error.toString());
    return createErrorResponse('Failed to send LINE notification: ' + error.message, 500);
  }
}

/**
 * LINE通知をスケジュール
 */
function handleScheduleLineNotification(requestData) {
  try {
    Logger.log('handleScheduleLineNotification: ' + JSON.stringify(requestData));
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // 通知をスケジュール
    const result = lineNotificationApi.scheduleNotification(requestData);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleScheduleLineNotification error: ' + error.toString());
    return createErrorResponse('Failed to schedule LINE notification: ' + error.message, 500);
  }
}

/**
 * LINE通知テンプレート一覧を取得
 */
function handleGetLineTemplates(requestData) {
  try {
    Logger.log('handleGetLineTemplates');
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // テンプレート一覧を取得
    const result = lineNotificationApi.getTemplates();
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetLineTemplates error: ' + error.toString());
    return createErrorResponse('Failed to get LINE templates: ' + error.message, 500);
  }
}

/**
 * LINE通知ステータスを取得
 */
function handleGetLineNotificationStatus(requestData) {
  try {
    const { notificationId } = requestData;
    
    if (!notificationId) {
      return createErrorResponse('Notification ID is required', 400);
    }
    
    Logger.log('handleGetLineNotificationStatus: ' + notificationId);
    
    // LineNotificationApiインスタンスを作成
    const lineNotificationApi = new LineNotificationApi();
    
    // ステータスを取得
    const result = lineNotificationApi.getNotificationStatus(notificationId);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetLineNotificationStatus error: ' + error.toString());
    return createErrorResponse('Failed to get notification status: ' + error.message, 500);
  }
}

/**
 * 名前をカナに変換（簡易実装）
 */
function convertToKana(name) {
  // 実際の実装では、PHP側からカナを送ってもらうのが望ましい
  // ここでは仮実装として、そのまま返す
  return name;
}

/**
 * エラーレスポンスを作成
 */
function createErrorResponse(message, statusCode = 400) {
  const response = {
    success: false,
    error: {
      message: message,
      code: statusCode
    },
    timestamp: new Date().toISOString()
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * LINE患者連携情報を取得
 */
function getLINEPatientMapping(lineUserId) {
  try {
    const sheet = Utils.getOrCreateSheet('LINE連携');
    const headers = ['LINE_USER_ID', 'VISITOR_ID', 'NAME', 'CREATED_AT'];
    
    // ヘッダーがない場合は追加
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      return null;
    }
    
    // データを検索
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === lineUserId) {
        return {
          line_user_id: data[i][0],
          visitor_id: data[i][1],
          name: data[i][2],
          created_at: data[i][3]
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('Error in getLINEPatientMapping: ' + error.toString());
    return null;
  }
}

/**
 * LINE患者連携情報を保存
 */
function saveLINEPatientMapping(lineUserId, visitorId, name) {
  try {
    const sheet = Utils.getOrCreateSheet('LINE連携');
    const headers = ['LINE_USER_ID', 'VISITOR_ID', 'NAME', 'CREATED_AT'];
    
    // ヘッダーがない場合は追加
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // 既存の連携があるか確認
    const existingMapping = getLINEPatientMapping(lineUserId);
    if (existingMapping) {
      Logger.log('LINE連携情報は既に存在します: ' + lineUserId);
      return;
    }
    
    // 新規追加
    const newRow = [
      lineUserId,
      visitorId,
      name,
      new Date().toISOString()
    ];
    
    sheet.appendRow(newRow);
    Logger.log('LINE連携情報を保存しました: ' + lineUserId);
  } catch (error) {
    Logger.log('Error in saveLINEPatientMapping: ' + error.toString());
    throw error;
  }
}

/**
 * 書類フォルダ一覧を取得（患者別）
 */
function getDocumentFoldersByPatient(patientId) {
  try {
    const documentService = new DocumentManagerService();
    const folders = documentService.getFoldersByPatient(patientId);
    
    return {
      success: true,
      data: folders
    };
  } catch (error) {
    Logger.log('Error getting document folders: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * すべてのフォルダ定義を取得（管理画面用）
 */
function getAllFolderDefinitions() {
  try {
    const documentService = new DocumentManagerService();
    const folders = documentService.getAllFolderDefinitions();
    
    return {
      success: true,
      data: folders
    };
  } catch (error) {
    Logger.log('Error getting all folder definitions: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * フォルダ定義を保存（管理画面用）
 * @param {Object} folderData - フォルダデータ
 */
function saveFolderDefinition(folderData) {
  try {
    const documentService = new DocumentManagerService();
    const result = documentService.saveFolderDefinition(folderData);
    
    return result;
  } catch (error) {
    Logger.log('Error saving folder definition: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * フォルダ定義を削除（管理画面用）
 * @param {string} folderId - フォルダID
 */
function deleteFolderDefinition(folderId) {
  try {
    const documentService = new DocumentManagerService();
    const result = documentService.deleteFolderDefinition(folderId);
    
    return result;
  } catch (error) {
    Logger.log('Error deleting folder definition: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 書類フォルダを保存
 */
function saveDocumentFolder(folderData) {
  try {
    const documentService = new DocumentManagerService();
    return documentService.saveFolder(folderData);
  } catch (error) {
    Logger.log('Error saving document folder: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 書類フォルダを削除
 */
function deleteDocumentFolder(folderId) {
  try {
    const documentService = new DocumentManagerService();
    return documentService.deleteFolder(folderId);
  } catch (error) {
    Logger.log('Error deleting document folder: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 患者の書類を取得
 */
function getDocumentsForPatient(patientId) {
  try {
    const documentService = new DocumentManagerService();
    const documents = documentService.getDocumentsByPatient(patientId);
    
    return {
      success: true,
      data: documents
    };
  } catch (error) {
    Logger.log('Error getting documents: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 書類を保存
 */
function saveDocument(documentData) {
  try {
    const documentService = new DocumentManagerService();
    return documentService.saveDocument(documentData);
  } catch (error) {
    Logger.log('Error saving document: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 書類を削除
 */
function deleteDocument(documentId) {
  try {
    const documentService = new DocumentManagerService();
    return documentService.deleteDocument(documentId);
  } catch (error) {
    Logger.log('Error deleting document: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 書類管理用の患者検索
 */
function searchPatientsForDocument(query) {
  try {
    const visitorService = new VisitorService();
    // 患者マスタシートから検索
    const result = visitorService.searchVisitorsFromSheet({
      name: query  // 氏名での検索
    });
    
    return {
      success: true,
      data: result.items || []
    };
  } catch (error) {
    Logger.log('Error searching patients: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 患者のデフォルトフォルダを作成
 */
function createDefaultFoldersForPatient(patientId) {
  try {
    const documentService = new DocumentManagerService();
    return documentService.createDefaultFoldersForPatient(patientId);
  } catch (error) {
    Logger.log('Error creating default folders: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Web APIのログを記録
 */
function logApiRequest(action, requestData, responseData, success) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: action,
      success: success,
      request: {
        // APIキーは記録しない
        patient: requestData.patient,
        search: requestData.search
      },
      response: success ? 'Success' : responseData
    };
    
    Utils.logToSheet('Web API: ' + action, success ? 'INFO' : 'ERROR', JSON.stringify(logEntry));
  } catch (error) {
    Logger.log('Failed to log API request: ' + error.toString());
  }
}

/**
 * LINE Webhookイベントを処理
 */
function handleLineWebhookEvents(events) {
  try {
    const results = [];
    
    events.forEach(event => {
      Logger.log('=== LINE Webhookイベント詳細 ===');
      Logger.log('イベントタイプ: ' + event.type);
      Logger.log('ソースタイプ: ' + event.source.type);
      
      // グループ参加イベント
      if (event.type === 'join' && event.source.type === 'group') {
        const groupId = event.source.groupId;
        Logger.log('🎉 Botがグループに参加しました！');
        Logger.log('グループID: ' + groupId);
        
        // グループIDをスクリプトプロパティに保存（オプション）
        const scriptProperties = PropertiesService.getScriptProperties();
        const existingGroupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID');
        
        if (!existingGroupId) {
          scriptProperties.setProperty('LINE_NOTIFICATION_GROUP_ID', groupId);
          Logger.log('グループIDをスクリプトプロパティに保存しました');
        } else {
          Logger.log('既存のグループID: ' + existingGroupId);
          Logger.log('新しいグループID: ' + groupId);
        }
        
        results.push({
          type: 'join',
          groupId: groupId,
          saved: !existingGroupId
        });
      }
      
      // メッセージイベント（グループ内）
      if (event.type === 'message' && event.source.type === 'group') {
        const groupId = event.source.groupId;
        Logger.log('グループメッセージ受信');
        Logger.log('グループID: ' + groupId);
        Logger.log('メッセージ: ' + (event.message.text || '(テキスト以外)'));

        // グループIDをスクリプトプロパティに保存（オプション）
        const scriptProperties = PropertiesService.getScriptProperties();
        const existingGroupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID');
        
        if (!existingGroupId) {
          scriptProperties.setProperty('LINE_NOTIFICATION_GROUP_ID', groupId);
          Logger.log('グループIDをスクリプトプロパティに保存しました');
        } else {
          Logger.log('既存のグループID: ' + existingGroupId);
          Logger.log('新しいグループID: ' + groupId);
        }
        
        results.push({
          type: 'message',
          groupId: groupId,
          messageType: event.message.type
        });
      }
      
      // グループ退出イベント
      if (event.type === 'leave' && event.source.type === 'group') {
        const groupId = event.source.groupId;
        Logger.log('⚠️ Botがグループから退出しました');
        Logger.log('グループID: ' + groupId);
        
        results.push({
          type: 'leave',
          groupId: groupId
        });
      }
    });
    
    // Webhookの応答（200 OK）
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      processed: events.length,
      results: results
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('LINE Webhookエラー: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * LINE グループIDを取得するためのデバッグ関数
 */
function getLineGroupIdDebug() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const groupId = scriptProperties.getProperty('LINE_NOTIFICATION_GROUP_ID');
  
  if (groupId) {
    Logger.log('=== 保存されているグループID ===');
    Logger.log('グループID: ' + groupId);
    return groupId;
  } else {
    Logger.log('グループIDが保存されていません');
    Logger.log('Botをグループに招待するか、グループ内でメッセージを送信してください');
    return null;
  }
}

/**
 * キャンセル予約情報を処理
 */
function handleCancelReservation(requestData) {
  try {
    const cancelRequest = requestData.CancelRequest;
    const timestamp = requestData.timestamp;
    
    if (!cancelRequest) {
      return createErrorResponse('CancelRequest data is required', 400);
    }
    
    // 必須項目のチェック
    const requiredFields = ['request_date', 'request_reservationId', 'request_name', 'request_menu', 'request_reservedate'];
    for (const field of requiredFields) {
      if (!cancelRequest[field]) {
        return createErrorResponse(`${field} is required`, 400);
      }
    }
    
    // キャンセル予約サービスを作成してデータを保存
    const cancelReservationService = new CancelReservationService();
    const result = cancelReservationService.addCancelReservation({
      requestDate: cancelRequest.request_date,
      reservationId: cancelRequest.request_reservationId,
      patientName: cancelRequest.request_name,
      menuName: cancelRequest.request_menu,
      reservationDateTime: cancelRequest.request_reservedate,
      timestamp: timestamp || new Date().toISOString()
    });
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to save cancel reservation', 400);
    }
    
    // 成功レスポンス
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        message: 'キャンセル予約情報を保存しました',
        reservation_id: cancelRequest.request_reservationId,
        saved_at: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleCancelReservation error: ' + error.toString());
    return createErrorResponse('Failed to process cancel reservation: ' + error.message, 500);
  }
}

/**
 * 今日の予約同期を処理
 */
function handleSyncTodayReservations(requestData) {
  try {
    Logger.log('handleSyncTodayReservations: 今日の予約同期を開始');
    
    const service = new ReservationService();
    const count = service.syncTodayOnly();
    
    // APIレスポンスの詳細を取得
    const apiResponse = {
      status: 'success',
      dataCount: count,
      endpoint: '/developer/reservations'
    };
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: count,
      message: `${count}件の予約情報を同期しました`,
      apiResponse: apiResponse,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleSyncTodayReservations error: ' + error.toString());
    return createErrorResponse('Failed to sync today reservations: ' + error.message, 500);
  }
}

/**
 * 3日間の予約同期を処理
 */
function handleSync3DaysReservations(requestData) {
  try {
    Logger.log('handleSync3DaysReservations: 3日間の予約同期を開始');
    
    const service = new ReservationService();
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    
    const result = service.syncReservationsOptimized({
      date_from: Utils.formatDate(today),
      date_to: Utils.formatDate(threeDaysLater)
    });
    
    // APIレスポンスの詳細を取得
    const apiResponse = {
      status: result.success ? 'success' : 'error',
      dataCount: result.totalSynced || 0,
      apiCalls: result.timeBreakdown?.apiCalls || 0,
      endpoint: '/developer/reservations'
    };
    
    if (result.success) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        totalSynced: result.totalSynced,
        executionTime: result.executionTime,
        dateRange: result.dateRange,
        timeBreakdown: result.timeBreakdown,
        apiResponse: apiResponse,
        message: `${result.totalSynced}件の予約情報を同期しました`,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return createErrorResponse('同期処理が失敗しました', 500);
    }
    
  } catch (error) {
    Logger.log('handleSync3DaysReservations error: ' + error.toString());
    return createErrorResponse('Failed to sync 3 days reservations: ' + error.message, 500);
  }
}

/**
 * 階層構造化されたメニュー情報を取得
 */
function handleGetStructuredMenus(requestData) {
  try {
    Logger.log('handleGetStructuredMenus: 階層構造メニュー取得開始');
    
    const service = new MenuApiService();
    const result = service.getStructuredMenus();
    
    if (result.success) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return createErrorResponse(result.error || 'Failed to get structured menus', 500);
    }
    
  } catch (error) {
    Logger.log('handleGetStructuredMenus error: ' + error.toString());
    return createErrorResponse('Failed to get structured menus: ' + error.message, 500);
  }
}

/**
 * カテゴリ別メニュー取得
 */
function handleGetMenusByCategory(requestData) {
  try {
    const { categoryLevel, categoryName } = requestData;
    
    if (!categoryLevel || !categoryName) {
      return createErrorResponse('Category level and name are required', 400);
    }
    
    Logger.log(`handleGetMenusByCategory: ${categoryLevel}/${categoryName}`);
    
    const service = new MenuApiService();
    const result = service.getMenusByCategory(categoryLevel, categoryName);
    
    if (result.success) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return createErrorResponse(result.error || 'Failed to get menus by category', 500);
    }
    
  } catch (error) {
    Logger.log('handleGetMenusByCategory error: ' + error.toString());
    return createErrorResponse('Failed to get menus by category: ' + error.message, 500);
  }
}

/**
 * メニュー同期処理
 */
function handleSyncMenus(requestData) {
  try {
    Logger.log('handleSyncMenus: メニュー同期を開始');
    
    const service = new MenuService();
    const count = service.syncMenus();
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: count,
      message: `${count}件のメニュー情報を同期しました`,
      apiResponse: {
        status: 'success',
        dataCount: count,
        endpoint: '/developer/menus'
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleSyncMenus error: ' + error.toString());
    return createErrorResponse('Failed to sync menus: ' + error.message, 500);
  }
}

/**
 * メニュー一覧取得処理
 */
function handleGetMenus(requestData) {
  try {
    Logger.log('handleGetMenus: メニュー一覧取得開始');
    
    const { per_page, page, sort_column, order } = requestData;
    
    const apiClient = new ApiClient();
    const response = apiClient.getMenus({
      per_page: per_page || 100,
      page: page || 1,
      sort_column: sort_column || 'name',
      order: order || 'ASC'
    });
    
    if (!response.success) {
      return createErrorResponse(response.error || 'Failed to get menus', 500);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('handleGetMenus error: ' + error.toString());
    return createErrorResponse('Failed to get menus: ' + error.message, 500);
  }
}

function call_doGet() {
  const e = {
    parameter: {
      action: 'api',
      path: '/api/users/line/U423d10aeba6ed5e5b0cf420435dbab3b/full',
      authorization: 'Bearer php_api_key_123'  // 認証トークン
    },
    queryString: 'path=api/patients&authorization=Bearer%20php_api_key_123',
    contentLength: 0
  };
  const response = doGet(e);
  Logger.log(response.getContent());
}

function callmenu_doGet() {
  const e = {
    parameter: {
      action: 'api',
      path: '/api/menus/all-structured',
      authorization: 'Bearer php_api_key_123'  // 認証トークン
    },
    queryString: 'path=api/patients&authorization=Bearer%20php_api_key_123',
    contentLength: 0
  };
  const response = doGet(e);
  Logger.log(response.getContent());
}

/**
 * キャンセル予約エンドポイントのテスト関数
 */
function test_cancelReservation() {
  console.log('=== キャンセル予約エンドポイントテスト開始 ===');
  
  // テスト用のリクエストデータを作成
  const e = {
    postData: {
      contents: JSON.stringify({
        action: 'cancelReservation',
        apiKey: '0123456789',
        CancelRequest: {
          request_date: '2025-07-30',
          request_reservationId: 'test-' + Utilities.getUuid(),
          request_name: 'テスト太郎',
          request_menu: '水素吸入',
          request_reservedate: '2025-08-15 14:30'
        },
        timestamp: new Date().toISOString()
      }),
      type: 'application/json'
    },
    parameter: {}
  };
  
  // エンドポイントを呼び出し
  const response = doPost(e);
  const responseContent = response.getContent();
  const responseData = JSON.parse(responseContent);
  
  console.log('レスポンス:', responseData);
  
  // 結果を確認
  if (responseData.success) {
    console.log('✅ テスト成功！');
    console.log('保存された予約ID:', responseData.data.reservation_id);
    
    // 実際にシートに保存されたか確認
    const service = new CancelReservationService();
    const savedData = service.findByReservationId(responseData.data.reservation_id);
    
    if (savedData) {
      console.log('✅ シートへの保存確認OK');
      console.log('保存データ:', savedData);
    } else {
      console.log('❌ シートに保存されていません');
    }
  } else {
    console.log('❌ テスト失敗');
    console.log('エラー:', responseData.error);
  }
  
  console.log('=== テスト終了 ===');
}