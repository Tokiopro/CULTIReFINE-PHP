/**
 * 統一APIルーター
 * 全てのHTTPリクエストのルーティングを管理
 */
class Router {
  /**
   * リクエストをルーティング
   * @param {Object} e - Google Apps Script イベントオブジェクト
   * @param {string} method - HTTPメソッド (GET, POST, PUT, DELETE)
   * @returns {TextOutput} レスポンス
   */
  static route(e, method) {
    try {
      const path = e.parameter.path || '';
      const routes = this.getRoutes();
      
      Logger.log(`Router: ${method} ${path}`);
      
      // ルートが存在しない場合
      if (!routes[method]) {
        return this.notFound(`Method ${method} not supported`);
      }
      
      // パスマッチング
      for (const route of routes[method]) {
        const match = this.matchPath(path, route.pattern);
        if (match) {
          Logger.log(`Router: Matched route ${route.pattern}`);
          e.pathParams = match.params;
          
          // 認証チェック（公開エンドポイント以外）
          if (!AuthMiddleware.isPublicEndpoint(e)) {
            if (!AuthMiddleware.authenticate(e)) {
              Logger.log('Router: Authentication failed');
              return BaseController.error('Unauthorized', 401);
            }
          }
          
          return route.handler(e);
        }
      }
      
      return this.notFound(`No route found for ${method} ${path}`);
      
    } catch (error) {
      Logger.log(`Router error: ${error.toString()}`);
      return BaseController.error('Internal Server Error', 500, error.toString());
    }
  }
  
  /**
   * ルート定義
   * @returns {Object} メソッド別のルート定義
   */
  static getRoutes() {
    return {
      GET: [
        // ヘルスチェック
        { pattern: '/api/v1/health', handler: (e) => this.healthCheck(e) },
        
        // 患者管理
        { pattern: '/api/v1/patients/:id', handler: (e) => PatientController.show(e) },
        { pattern: '/api/v1/patients/:id/menus', handler: (e) => PatientController.menus(e) },
        { pattern: '/api/v1/patients/:id/available-slots', handler: (e) => PatientController.availableSlots(e) },
        
        // 予約管理
        { pattern: '/api/v1/reservations', handler: (e) => ReservationController.index(e) },
        { pattern: '/api/v1/reservations/history', handler: (e) => ReservationController.history(e) },
        { pattern: '/api/v1/reservations/:id', handler: (e) => ReservationController.show(e) },
        
        // 会社管理
        { pattern: '/api/v1/companies/:id/visitors', handler: (e) => CompanyController.visitors(e) },
        
        // 書類管理
        { pattern: '/api/v1/documents', handler: (e) => DocumentController.index(e) },
        
        // LINEユーザー
        { pattern: '/api/v1/users/line/:lineId', handler: (e) => LineUserController.show(e) },
        { pattern: '/api/v1/users/line/:lineId/full', handler: (e) => LineUserController.fullInfo(e) },
        
        // 後方互換性のための旧エンドポイント
        { pattern: '/api/health', handler: (e) => this.healthCheck(e) },
        { pattern: '/api/patients/:id/menus', handler: (e) => PatientController.menus(e) },
        { pattern: '/api/users/line/:lineId/full', handler: (e) => LineUserController.fullInfo(e) }
      ],
      
      POST: [
        // 患者管理
        { pattern: '/api/v1/patients', handler: (e) => PatientController.create(e) },
        { pattern: '/api/v1/patients/search', handler: (e) => PatientController.search(e) },
        
        // 予約管理
        { pattern: '/api/v1/reservations', handler: (e) => ReservationController.create(e) },
        
        // 会社管理
        { pattern: '/api/v1/companies/:id/visitors', handler: (e) => CompanyController.addVisitor(e) },
        
        // 後方互換性
        { pattern: '/api/visitors', handler: (e) => CompanyController.createVisitor(e) }
      ],
      
      PUT: [
        // 患者管理
        { pattern: '/api/v1/patients/:id', handler: (e) => PatientController.update(e) },
        
        // 会社管理
        { pattern: '/api/v1/companies/:companyId/visitors/:visitorId', handler: (e) => CompanyController.updateVisitor(e) },
        { pattern: '/api/v1/companies/:companyId/visitors/:visitorId/visibility', handler: (e) => CompanyController.updateVisibility(e) },
        
        // 後方互換性
        { pattern: '/api/company/:companyId/visitors/:visitorId/visibility', handler: (e) => CompanyController.updateVisibility(e) }
      ],
      
      DELETE: [
        // 患者管理
        { pattern: '/api/v1/patients/:id', handler: (e) => PatientController.delete(e) },
        
        // 予約管理
        { pattern: '/api/v1/reservations/:id', handler: (e) => ReservationController.delete(e) }
      ]
    };
  }
  
  /**
   * パスマッチング
   * @param {string} path - リクエストパス
   * @param {string} pattern - ルートパターン
   * @returns {Object|null} マッチ結果とパラメータ
   */
  static matchPath(path, pattern) {
    // パスの正規化
    path = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    pattern = pattern.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    // パスセグメントに分割
    const pathParts = path.split('/').filter(p => p);
    const patternParts = pattern.split('/').filter(p => p);
    
    // セグメント数が異なる場合はマッチしない
    if (pathParts.length !== patternParts.length) {
      return null;
    }
    
    const params = {};
    
    // 各セグメントをチェック
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      // パラメータの場合
      if (patternPart.startsWith(':')) {
        const paramName = patternPart.substring(1);
        params[paramName] = decodeURIComponent(pathPart);
      }
      // 固定文字列の場合
      else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return { matched: true, params };
  }
  
  /**
   ヘルスチェック
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} レスポンス
   */
  static healthCheck(e) {
    return BaseController.success({
      message: 'API is working',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: {
        deployment: 'production',
        region: 'asia-northeast1'
      }
    });
  }
  
  /**
   * 404 Not Found レスポンス
   * @param {string} message - エラーメッセージ
   * @returns {TextOutput} レスポンス
   */
  static notFound(message = 'Not Found') {
    return BaseController.error(message, 404);
  }
}

/**
 * ルーターのテスト関数
 */
function testRouter() {
  console.log('=== Router テスト開始 ===');
  
  // パスマッチングテスト
  const testCases = [
    { path: '/api/v1/patients/123', pattern: '/api/v1/patients/:id', expected: { id: '123' } },
    { path: '/api/v1/companies/456/visitors/789', pattern: '/api/v1/companies/:companyId/visitors/:visitorId', expected: { companyId: '456', visitorId: '789' } },
    { path: '/api/v1/health', pattern: '/api/v1/health', expected: {} },
    { path: '/api/v1/patients', pattern: '/api/v1/patients/:id', expected: null }
  ];
  
  testCases.forEach(test => {
    const result = Router.matchPath(test.path, test.pattern);
    console.log(`Path: ${test.path}, Pattern: ${test.pattern}`);
    console.log(`Result: ${JSON.stringify(result)}`);
    console.log(`Expected: ${JSON.stringify(test.expected)}`);
    console.log('---');
  });
  
  console.log('=== テスト完了 ===');
}