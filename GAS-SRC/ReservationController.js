/**
 * 予約管理コントローラー
 * 予約に関する全ての操作を管理
 */
class ReservationController extends BaseController {
  /**
   * 予約一覧を取得
   * GET /api/v1/reservations
   */
  static index(e) {
    try {
      const params = this.getParams(e, ['visitor_id', 'date_from', 'date_to', 'status']);
      
      const service = new ReservationService();
      const reservations = service.searchReservations(params);
      
      return this.success({
        items: reservations,
        total: reservations.length
      });
      
    } catch (error) {
      Logger.log(`ReservationController.index error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 予約履歴を取得
   * GET /api/v1/reservations/history
   */
  static history(e) {
    try {
      const memberType = this.getParam(e, 'member_type');
      const date = this.getParam(e, 'date');
      const companyId = this.getParam(e, 'company_id');
      
      // PhpIntegrationApiのロジックを呼び出し
      const result = getReservationHistory(memberType, date, companyId);
      
      if (result.status === 'error') {
        return this.error(result.error.message, 400, result.error.details);
      }
      
      return this.success(result.data);
      
    } catch (error) {
      Logger.log(`ReservationController.history error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 予約詳細を取得
   * GET /api/v1/reservations/:id
   */
  static show(e) {
    try {
      const reservationId = this.getRequiredParam(e, 'id');
      
      const service = new ReservationService();
      const reservation = service.getReservationById(reservationId);
      
      if (!reservation) {
        return this.error('Reservation not found', 404);
      }
      
      return this.success(reservation);
      
    } catch (error) {
      Logger.log(`ReservationController.show error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 予約を作成
   * POST /api/v1/reservations
   */
  static create(e) {
    try {
      const reservationData = e.body || {};
      
      // バリデーション
      const validation = this.validate(reservationData, {
        visitor_id: { required: true },
        menu_id: { required: true },
        reservation_date: { required: true },
        start_time: { required: true }
      });
      
      if (!validation.isValid) {
        return this.validationError(validation.errors);
      }
      
      const service = new ReservationService();
      const result = service.createReservation(reservationData);
      
      if (!result.success) {
        return this.error(result.error || '予約の作成に失敗しました', 400);
      }
      
      return this.success(result.data, 201);
      
    } catch (error) {
      Logger.log(`ReservationController.create error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
  
  /**
   * 予約を削除（キャンセル）
   * DELETE /api/v1/reservations/:id
   */
  static delete(e) {
    try {
      const reservationId = this.getRequiredParam(e, 'id');
      
      const service = new ReservationService();
      const result = service.cancelReservation(reservationId);
      
      if (!result.success) {
        return this.error(result.error || '予約のキャンセルに失敗しました', 400);
      }
      
      return this.success({
        message: '予約をキャンセルしました'
      });
      
    } catch (error) {
      Logger.log(`ReservationController.delete error: ${error.toString()}`);
      return this.error(error.message, 500);
    }
  }
}