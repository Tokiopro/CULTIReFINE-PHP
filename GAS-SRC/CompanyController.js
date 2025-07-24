/**
 * 会社管理コントローラー
 * 会社と来院者の関係管理
 */
class CompanyController extends BaseController {
  /**
   * 会社別来院者一覧を取得
   * GET /api/v1/companies/:id/visitors
   */
  static visitors(e) {
    try {
      const companyId = this.getRequiredParam(e, 'id');
      
      // PhpIntegrationApiのロジックを呼び出し
      const result = getCompanyVisitors(companyId);
      
      if (result.status === 'error') {
        return this.error(result.error.message, 400, result.error.details);
      }
      
      return this.success(result.data);
      
    } catch (error) {
      Logger.log(`CompanyController.visitors error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 会社に来院者を追加
   * POST /api/v1/companies/:id/visitors
   */
  static addVisitor(e) {
    try {
      const companyId = this.getRequiredParam(e, 'id');
      const visitorData = e.body || {};
      
      // バリデーション
      const validation = this.validate(visitorData, {
        visitor_id: { required: true },
        member_type: { required: true }
      });
      
      if (!validation.isValid) {
        return this.validationError(validation.errors);
      }
      
      const service = new CompanyVisitorService();
      const result = service.addVisitorToCompany(companyId, visitorData.company_name, {
        visitorId: visitorData.visitor_id,
        memberType: visitorData.member_type,
        isPublic: visitorData.is_public !== false,
        position: visitorData.position || '',
        lineId: visitorData.line_id || ''
      });
      
      if (!result.success) {
        return this.error(result.error || '来院者の追加に失敗しました', 400);
      }
      
      return this.success(result, 201);
      
    } catch (error) {
      Logger.log(`CompanyController.addVisitor error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 会社別来院者を更新
   * PUT /api/v1/companies/:companyId/visitors/:visitorId
   */
  static updateVisitor(e) {
    try {
      const companyId = this.getRequiredParam(e, 'companyId');
      const visitorId = this.getRequiredParam(e, 'visitorId');
      const updateData = e.body || {};
      
      const service = new CompanyVisitorService();
      const result = service.updateCompanyVisitor(companyId, visitorId, updateData);
      
      if (!result.success) {
        return this.error(result.error || '更新に失敗しました', 400);
      }
      
      return this.success({
        message: '更新しました'
      });
      
    } catch (error) {
      Logger.log(`CompanyController.updateVisitor error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 公開設定を更新
   * PUT /api/v1/companies/:companyId/visitors/:visitorId/visibility
   */
  static updateVisibility(e) {
    try {
      const companyId = this.getRequiredParam(e, 'companyId');
      const visitorId = this.getRequiredParam(e, 'visitorId');
      const isPublic = this.getParam(e, 'is_public');
      
      if (isPublic === null || isPublic === undefined) {
        return this.validationError({ is_public: 'is_public is required' });
      }
      
      const service = new CompanyVisitorService();
      const result = service.updateCompanyVisitor(companyId, visitorId, {
        isPublic: isPublic === true || isPublic === 'true'
      });
      
      if (!result.success) {
        return this.error(result.error || '公開設定の更新に失敗しました', 400);
      }
      
      return this.success({
        company_id: companyId,
        visitor_id: visitorId,
        is_public: isPublic,
        message: '公開設定を更新しました'
      });
      
    } catch (error) {
      Logger.log(`CompanyController.updateVisibility error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 来院者を作成（後方互換性）
   * POST /api/visitors
   */
  static createVisitor(e) {
    try {
      const requestData = e.body || {};
      
      // PhpIntegrationApiのロジックを呼び出し
      const result = createCompanyVisitor(requestData);
      
      if (result.status === 'error') {
        return this.error(result.error.message, 400, result.error.details);
      }
      
      return this.success(result.data, 201);
      
    } catch (error) {
      Logger.log(`CompanyController.createVisitor error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
}