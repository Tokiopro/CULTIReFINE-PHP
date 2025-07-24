/**
 * 患者管理コントローラー
 * 患者（来院者）に関する全ての操作を管理
 */
class PatientController extends BaseController {
  /**
   * 患者詳細を取得
   * GET /api/v1/patients/:id
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 患者情報
   */
  static show(e) {
    try {
      const patientId = this.getRequiredParam(e, 'id');
      
      const service = new VisitorService();
      const patient = service.getVisitorById(patientId);
      
      if (!patient) {
        return this.error('Patient not found', 404);
      }
      
      return this.success(patient);
      
    } catch (error) {
      Logger.log(`PatientController.show error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 患者一覧を取得
   * GET /api/v1/patients
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 患者一覧
   */
  static index(e) {
    try {
      const params = this.getParams(e, ['page', 'per_page', 'search', 'company_id']);
      
      const service = new VisitorService();
      
      // 検索条件の構築
      const searchParams = {};
      if (params.search) {
        searchParams.name = params.search;
      }
      if (params.company_id) {
        searchParams.company_id = params.company_id;
      }
      
      // ページング処理
      const page = parseInt(params.page || '1');
      const perPage = parseInt(params.per_page || '20');
      
      const result = service.searchVisitorsFromSheet(searchParams);
      
      // ページング適用
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedItems = result.items.slice(startIndex, endIndex);
      
      return this.successWithPagination(paginatedItems, {
        page: page,
        perPage: perPage,
        total: result.total
      });
      
    } catch (error) {
      Logger.log(`PatientController.index error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 患者別メニューを取得
   * GET /api/v1/patients/:id/menus
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} メニュー情報
   */
  static menus(e) {
    try {
      const patientId = this.getRequiredParam(e, 'id');
      const companyId = this.getParam(e, 'company_id');
      
      const service = new PatientMenuService();
      const menuData = service.getPatientMenus(patientId, companyId);
      
      // PatientMenuServiceが既にstatusとdataを含む形式で返すため、そのまま返す
      if (menuData.status === 'success') {
        return ContentService.createTextOutput(JSON.stringify({
          ...menuData,
          timestamp: new Date().toISOString()
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return this.error('メニュー取得に失敗しました', 500);
      }
      
    } catch (error) {
      Logger.log(`PatientController.menus error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 予約可能スロットを取得
   * GET /api/v1/patients/:id/available-slots
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 予約可能スロット
   */
  static availableSlots(e) {
    try {
      const patientId = this.getRequiredParam(e, 'id');
      const menuId = this.getRequiredParam(e, 'menu_id');
      const date = this.getParam(e, 'date', Utils.getToday());
      
      const options = {
        dateRange: parseInt(this.getParam(e, 'date_range', '7')),
        includeRoomInfo: this.getParam(e, 'include_room_info') === 'true'
      };
      
      const service = new AvailabilityCheckService();
      const slots = service.getAvailableSlots(patientId, menuId, date, options);
      
      return this.success(slots);
      
    } catch (error) {
      Logger.log(`PatientController.availableSlots error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 患者を作成
   * POST /api/v1/patients
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 作成された患者情報
   */
  static create(e) {
    try {
      const patientData = e.body || {};
      
      // バリデーション
      const validation = this.validate(patientData, {
        name: { required: true, maxLength: 100 },
        name_kana: { required: true, maxLength: 100 },
        email: { type: 'email' },
        phone: { maxLength: 20 }
      });
      
      if (!validation.isValid) {
        return this.validationError(validation.errors);
      }
      
      // 名前の分割処理
      if (!patientData.last_name && patientData.name) {
        const nameParts = patientData.name.split(/[\s　]+/);
        patientData.last_name = nameParts[0];
        patientData.first_name = nameParts.slice(1).join(' ');
      }
      
      if (!patientData.last_name_kana && patientData.name_kana) {
        const kanaParts = patientData.name_kana.split(/[\s　]+/);
        patientData.last_name_kana = kanaParts[0];
        patientData.first_name_kana = kanaParts.slice(1).join(' ');
      }
      
      const service = new VisitorService();
      const result = service.createVisitor(patientData);
      
      return this.success({
        visitor_id: result.visitor_id || result.id,
        name: result.name,
        message: '患者登録が完了しました'
      }, 201);
      
    } catch (error) {
      Logger.log(`PatientController.create error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 患者情報を更新
   * PUT /api/v1/patients/:id
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 更新された患者情報
   */
  static update(e) {
    try {
      const patientId = this.getRequiredParam(e, 'id');
      const updateData = e.body || {};
      
      // 更新可能フィールドのみ抽出
      const allowedFields = ['email', 'phone', 'address', 'note'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });
      
      const service = new VisitorService();
      const result = service.updateVisitor(patientId, filteredData);
      
      if (!result.success) {
        return this.error(result.error || '更新に失敗しました', 400);
      }
      
      return this.success({
        visitor_id: patientId,
        message: '患者情報を更新しました'
      });
      
    } catch (error) {
      Logger.log(`PatientController.update error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 患者を検索
   * POST /api/v1/patients/search
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 検索結果
   */
  static search(e) {
    try {
      const searchParams = e.body || {};
      
      const service = new VisitorService();
      const results = service.searchVisitors(searchParams);
      
      return this.success({
        items: results,
        total: results.length
      });
      
    } catch (error) {
      Logger.log(`PatientController.search error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 患者を削除（論理削除）
   * DELETE /api/v1/patients/:id
   * @param {Object} e - イベントオブジェクト
   * @returns {TextOutput} 削除結果
   */
  static delete(e) {
    try {
      const patientId = this.getRequiredParam(e, 'id');
      
      // 実装は要件に応じて
      // 現在は物理削除ではなく、ステータス変更などの論理削除を推奨
      
      return this.error('Delete operation not implemented', 501);
      
    } catch (error) {
      Logger.log(`PatientController.delete error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
}

/**
 * PatientControllerのテスト関数
 */
function testPatientController() {
  console.log('=== PatientController テスト開始 ===');
  
  // テスト用イベントオブジェクト
  const e = {
    pathParams: {
      id: '123'
    },
    parameter: {
      company_id: 'COMP001',
      menu_id: 'MENU001',
      date: '2024-01-01'
    },
    body: {
      name: 'テスト 太郎',
      name_kana: 'テスト タロウ',
      email: 'test@example.com'
    }
  };
  
  // show のテスト
  console.log('--- show test ---');
  const showResult = PatientController.show(e);
  console.log(showResult.getContent());
  
  // menus のテスト
  console.log('--- menus test ---');
  const menusResult = PatientController.menus(e);
  console.log(menusResult.getContent());
  
  console.log('=== テスト完了 ===');
}