/**
 * 書類管理コントローラー
 * 患者書類の管理
 */
class DocumentController extends BaseController {
  /**
   * 書類一覧を取得
   * GET /api/v1/documents
   */
  static index(e) {
    try {
      const visitorId = this.getParam(e, 'visitor_id');
      
      if (!visitorId) {
        return this.validationError({ visitor_id: 'visitor_id is required' });
      }
      
      // PhpIntegrationApiのロジックを呼び出し
      const result = getPatientDocuments(visitorId);
      
      if (result.status === 'error') {
        return this.error(result.error.message, 400, result.error.details);
      }
      
      return this.success(result.data);
      
    } catch (error) {
      Logger.log(`DocumentController.index error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
}