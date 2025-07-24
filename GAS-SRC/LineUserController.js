/**
 * LINEユーザー管理コントローラー
 * LINE連携ユーザーの情報管理
 */
class LineUserController extends BaseController {
  /**
   * LINEユーザー情報を取得
   * GET /api/v1/users/line/:lineId
   */
  static show(e) {
    try {
      const lineId = this.getRequiredParam(e, 'lineId');
      
      // PhpIntegrationApiのロジックを呼び出し
      const userInfo = getPhpUserByLineId(lineId);
      
      if (!userInfo) {
        return this.error('LINE user not found', 404);
      }
      
      return this.success(userInfo);
      
    } catch (error) {
      Logger.log(`LineUserController.show error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * LINEユーザーの全情報を取得
   * GET /api/v1/users/line/:lineId/full
   */
  static fullInfo(e) {
    try {
      const lineId = this.getRequiredParam(e, 'lineId');
      
      // PhpIntegrationApiの新形式レスポンス関数を呼び出し
      const result = getUserFullInfoByLineIdFormatted(lineId);
      
      // エラーチェック（新形式に対応）
      if (result.error) {
        return this.error(result.error, 404);
      }
      
      // フラット構造で直接返す（success()でラップしない）
      Logger.log(`LineUserController.fullInfo returning flat response`);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
      
    } catch (error) {
      Logger.log(`LineUserController.fullInfo error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * LINEユーザーの全情報を取得（テスト版）
   * GET /api/v1/users/line/:lineId/full/test
   */
  static fullInfoTest(e) {
    try {
      const lineId = this.getRequiredParam(e, 'lineId');
      
      // PhpIntegrationApiのテスト版関数を呼び出し
      const result = getUserFullInfoByLineIdFormattedTest(lineId);
      
      // エラーチェック
      if (result.error) {
        return this.error(result.error, 404);
      }
      
      // テスト版のレスポンスをそのまま返す
      return this.success(result);
      
    } catch (error) {
      Logger.log(`LineUserController.fullInfoTest error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
}