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
      
      // PhpIntegrationApiのロジックを呼び出し
      const result = getUserFullInfoByLineId(lineId);
      
      if (result.status === 'error') {
        return this.error(result.error.message, 400, result.error.details);
      }
      
      return this.success(result.data);
      
    } catch (error) {
      Logger.log(`LineUserController.fullInfo error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
}