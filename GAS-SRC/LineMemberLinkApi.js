/**
 * LINE会員連携専用のWebAPIエンドポイント
 * 
 * 既存のWebApi.jsとは独立したエンドポイントとして動作
 * LINE認証コールバックと会員番号紐付けを処理
 */

/**
 * LINE会員連携のGETリクエスト処理（WebApi.jsのdoGetから呼ばれる）
 */
function doGetLineMemberLink(e) {
  try {
    Logger.log('=== LINE会員連携処理開始 ===');
    Logger.log('パラメータ: ' + JSON.stringify(e.parameter));
    
    const action = e.parameter.action;
    const code = e.parameter.code;
    const state = e.parameter.state;
    const error = e.parameter.error;
    
    // actionは既にWebApi.jsでチェック済みなので、直接処理を開始
    
    // エラーチェック
    if (error) {
      Logger.log(`LINE認証エラー: ${error}`);
      return createLineMemberErrorPage('LINE認証でエラーが発生しました', error);
    }
    
    // 認証コードがない場合
    if (!code) {
      Logger.log('認証コードが見つかりません');
      return createLineMemberErrorPage('認証コードが取得できませんでした');
    }
    
    // stateからトークンを抽出
    if (!state || !state.startsWith('member_link_')) {
      Logger.log(`無効なstate: ${state}`);
      return createLineMemberErrorPage('無効なリクエストです');
    }
    
    const token = state.replace('member_link_', '');
    Logger.log(`トークン: ${token}`);
    
    // トークン検証とLINE認証処理
    return processLineMemberAuth(code, token);
    
  } catch (error) {
    Logger.log('doGetLineMemberLink エラー: ' + error.toString());
    return createLineMemberErrorPage('システムエラーが発生しました', error.toString());
  }
}

/**
 * LINE認証処理と会員番号紐付け
 * @param {string} code - LINE認証コード
 * @param {string} token - 会員連携トークン
 * @return {HtmlOutput} 結果ページ
 */
function processLineMemberAuth(code, token) {
  try {
    Logger.log('LINE認証処理開始');
    
    const service = new LineMemberLinkService();
    
    // 1. トークン検証
    const memberInfo = service.validateTokenAndGetMemberInfo(token);
    if (!memberInfo) {
      return createLineMemberErrorPage('無効または期限切れのリンクです');
    }
    
    Logger.log(`会員情報取得成功: 会員番号 ${memberInfo.memberNumber}`);
    
    // 2. LINE認証コードをアクセストークンに交換
    const lineUserInfo = LineTokenManager.exchangeCodeForUserInfo(code);
    if (!lineUserInfo) {
      return createLineMemberErrorPage('LINE認証に失敗しました');
    }
    
    Logger.log(`LINEユーザー情報取得成功: ${lineUserInfo.displayName} (${lineUserInfo.userId})`);
    
    // 3. 会員番号とLINE IDを紐付け
    const success = service.linkMemberWithLineId(token, lineUserInfo);
    Logger.log(`linkMemberWithLineId戻り値: ${success} (型: ${typeof success})`);
    if (!success) {
      Logger.log('紐付け処理失敗のため、エラーページを返します');
      return createLineMemberErrorPage('紐付け処理に失敗しました');
    }
    Logger.log('紐付け処理成功、会社別来院者シート更新に進みます');
    
    // 4. 会社別来院者管理シートも更新（memberNumberがvisitor_idの場合）
    try {
      Logger.log(`会社別来院者シート更新開始: memberNumber=${memberInfo.memberNumber}`);
      const companyService = new CompanyLineLinkService();
      Logger.log('CompanyLineLinkServiceインスタンス作成完了');
      companyService.updateLinkedInfo(memberInfo.memberNumber, lineUserInfo.userId, lineUserInfo.displayName);
      Logger.log(`会社別来院者シートも更新: visitor_id ${memberInfo.memberNumber}`);
    } catch (error) {
      Logger.log(`会社別来院者シート更新エラー: ${error.toString()}`);
      Logger.log(`エラースタック: ${error.stack || 'スタックなし'}`);
      // エラーが発生しても処理は継続
    }
    
    // 5. 成功ページを表示
    return createLineMemberSuccessPage(memberInfo, lineUserInfo);
    
  } catch (error) {
    Logger.log('processLineMemberAuth エラー: ' + error.toString());
    return createLineMemberErrorPage('処理中にエラーが発生しました', error.toString());
  }
}

/**
 * 成功ページを生成
 * @param {Object} memberInfo - 会員情報
 * @param {Object} lineUserInfo - LINEユーザー情報
 * @return {HtmlOutput} 成功ページ
 */
function createLineMemberSuccessPage(memberInfo, lineUserInfo) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LINE連携完了</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background-color: #06C755;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .success-icon::after {
      content: "✓";
      color: white;
      font-size: 48px;
      font-weight: bold;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .info {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      text-align: left;
    }
    .info-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .label {
      color: #666;
      font-weight: bold;
    }
    .value {
      color: #333;
      margin-left: 10px;
    }
    .button {
      background-color: #06C755;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 32px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 20px;
      text-decoration: none;
      display: inline-block;
    }
    .button:hover {
      background-color: #05A548;
    }
    .note {
      color: #666;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon"></div>
    <h1>LINE連携が完了しました</h1>
    <p>会員情報とLINEアカウントの連携が正常に完了しました。</p>
    
    <div class="info">
      <div class="info-row">
        <span class="label">会員番号:</span>
        <span class="value">${memberInfo.memberNumber}</span>
      </div>
      <div class="info-row">
        <span class="label">会員名:</span>
        <span class="value">${memberInfo.memberName || '未設定'}</span>
      </div>
      <div class="info-row">
        <span class="label">LINE表示名:</span>
        <span class="value">${lineUserInfo.displayName}</span>
      </div>
      <div class="info-row">
        <span class="label">連携日時:</span>
        <span class="value">${new Date().toLocaleString('ja-JP')}</span>
      </div>
    </div>
    
    <button class="button" onclick="window.close()">閉じる</button>
    
    <p class="note">
      今後、LINEから予約確認や各種通知をお受け取りいただけます。<br>
      このウィンドウは安全に閉じていただけます。
    </p>
  </div>
</body>
</html>
  `;
  
  return HtmlService.createHtmlOutput(html)
    .setTitle('LINE連携完了')
    .setWidth(450)
    .setHeight(600);
}

/**
 * エラーページを生成
 * @param {string} message - エラーメッセージ
 * @param {string} detail - 詳細情報（オプション）
 * @return {HtmlOutput} エラーページ
 */
function createLineMemberErrorPage(message, detail = '') {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>エラー</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      background-color: #FF4458;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .error-icon::after {
      content: "!";
      color: white;
      font-size: 48px;
      font-weight: bold;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .message {
      color: #666;
      margin: 20px 0;
      line-height: 1.6;
    }
    .detail {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
      font-size: 12px;
      color: #999;
      text-align: left;
      font-family: monospace;
      display: ${detail ? 'block' : 'none'};
    }
    .button {
      background-color: #666;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 32px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 20px;
    }
    .button:hover {
      background-color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon"></div>
    <h1>エラーが発生しました</h1>
    <div class="message">${message}</div>
    <div class="detail">${detail}</div>
    <button class="button" onclick="window.close()">閉じる</button>
  </div>
</body>
</html>
  `;
  
  return HtmlService.createHtmlOutput(html)
    .setTitle('エラー')
    .setWidth(450)
    .setHeight(500);
}