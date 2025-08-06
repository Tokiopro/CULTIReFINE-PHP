/**
 * キャンセル予約管理サービス
 */
class CancelReservationService {
  constructor() {
    this.sheetName = 'キャンセル予約情報';
    this.headers = [
      'キャンセル済み',
      'キャンセルステータス',
      'reservation_id',
      'visitor_id',
      '患者名',
      '予約日',
      '予約時間',
      'メニュー'
    ];
  }
  
  /**
   * キャンセル予約情報を追加
   * @param {Object} cancelData - キャンセル予約データ
   * @returns {Object} 処理結果
   */
  addCancelReservation(cancelData) {
    try {
      // シートを取得または作成
      const sheet = Utils.getOrCreateSheet(this.sheetName);
      
      // ヘッダーが存在しない場合は追加
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, this.headers.length).setValues([this.headers]);
        // ヘッダー行のスタイル設定
        const headerRange = sheet.getRange(1, 1, 1, this.headers.length);
        headerRange.setBackground('#4CAF50');
        headerRange.setFontColor('#FFFFFF');
        headerRange.setFontWeight('bold');
      }
      
      // 予約日時を分割（例: "2025-08-20 10:30"）
      const [reservationDate, reservationTime] = (cancelData.reservationDateTime || '').split(' ');
      
      // データを配列形式に変換
      const rowData = [
        '',                              // キャンセル済み（空白）
        'キャンセルあり',                 // キャンセルステータス
        cancelData.reservationId || '',   // reservation_id
        cancelData.visitorId || '',       // visitor_id（PHPから送られてこない場合は空白）
        cancelData.patientName || '',     // 患者名
        reservationDate || '',            // 予約日
        reservationTime || '',            // 予約時間
        cancelData.menuName || ''         // メニュー
      ];
      
      // データを追加
      sheet.appendRow(rowData);
      
      // ログを記録
      Logger.log('キャンセル予約を追加しました: ' + JSON.stringify(cancelData));
      Utils.logToSheet('キャンセル予約追加', 'INFO', 
        `予約ID: ${cancelData.reservationId}, 患者名: ${cancelData.patientName}`);
      
      return {
        success: true,
        message: 'キャンセル予約情報を保存しました'
      };
      
    } catch (error) {
      Logger.log('キャンセル予約追加エラー: ' + error.toString());
      Utils.logToSheet('キャンセル予約追加エラー', 'ERROR', error.toString());
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * キャンセル予約一覧を取得
   * @param {Object} options - 検索オプション
   * @returns {Array} キャンセル予約リスト
   */
  getCancelReservations(options = {}) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet || sheet.getLastRow() <= 1) {
        return [];
      }
      
      // データを取得
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, this.headers.length);
      const data = dataRange.getValues();
      
      // オブジェクト配列に変換
      const cancelReservations = data.map(row => ({
        cancelCompleted: row[0],
        cancelStatus: row[1],
        reservationId: row[2],
        visitorId: row[3],
        patientName: row[4],
        reservationDate: row[5],
        reservationTime: row[6],
        menuName: row[7]
      }));
      
      // フィルタリング（必要に応じて）
      let filtered = cancelReservations;
      
      if (options.startDate) {
        filtered = filtered.filter(item => 
          new Date(item.reservationDate) >= new Date(options.startDate)
        );
      }
      
      if (options.endDate) {
        filtered = filtered.filter(item => 
          new Date(item.reservationDate) <= new Date(options.endDate)
        );
      }
      
      if (options.patientName) {
        filtered = filtered.filter(item => 
          item.patientName.includes(options.patientName)
        );
      }
      
      // 予約日時の降順でソート
      filtered.sort((a, b) => {
        const dateA = new Date(a.reservationDate + ' ' + a.reservationTime);
        const dateB = new Date(b.reservationDate + ' ' + b.reservationTime);
        return dateB - dateA;
      });
      
      return filtered;
      
    } catch (error) {
      Logger.log('キャンセル予約取得エラー: ' + error.toString());
      return [];
    }
  }
  
  /**
   * 予約IDでキャンセル予約を検索
   * @param {string} reservationId - 予約ID
   * @returns {Object|null} キャンセル予約情報
   */
  findByReservationId(reservationId) {
    try {
      const cancelReservations = this.getCancelReservations();
      return cancelReservations.find(item => item.reservationId === reservationId) || null;
    } catch (error) {
      Logger.log('キャンセル予約検索エラー: ' + error.toString());
      return null;
    }
  }
  
  /**
   * キャンセル予約の統計情報を取得
   * @param {Object} options - 期間指定オプション
   * @returns {Object} 統計情報
   */
  getStatistics(options = {}) {
    try {
      const cancelReservations = this.getCancelReservations(options);
      
      // メニュー別集計
      const menuStats = {};
      cancelReservations.forEach(item => {
        if (!menuStats[item.menuName]) {
          menuStats[item.menuName] = 0;
        }
        menuStats[item.menuName]++;
      });
      
      // 日別集計
      const dailyStats = {};
      cancelReservations.forEach(item => {
        const date = item.reservationDate;
        if (!dailyStats[date]) {
          dailyStats[date] = 0;
        }
        dailyStats[date]++;
      });
      
      return {
        total: cancelReservations.length,
        byMenu: menuStats,
        byDay: dailyStats,
        period: {
          start: options.startDate || 'すべて',
          end: options.endDate || 'すべて'
        }
      };
      
    } catch (error) {
      Logger.log('統計情報取得エラー: ' + error.toString());
      return {
        total: 0,
        byMenu: {},
        byDay: {},
        error: error.message
      };
    }
  }
}

/**
 * テスト関数
 */
function testCancelReservationService() {
  const service = new CancelReservationService();
  
  // テストデータ
  const testData = {
    requestDate: '2025-07-17',
    reservationId: '52ffd2a7-ab7c-4596-a40f-198a5419d751',
    visitorId: 'visitor-123',  // 追加
    patientName: '安達なつき',
    menuName: '水素吸入',
    reservationDateTime: '2025-08-20 10:30',
    timestamp: '2025-07-17T10:30:00Z'
  };
  
  // キャンセル予約を追加
  console.log('=== キャンセル予約追加テスト ===');
  const result = service.addCancelReservation(testData);
  console.log('結果:', result);
  
  // キャンセル予約一覧を取得
  console.log('\n=== キャンセル予約一覧取得テスト ===');
  const list = service.getCancelReservations();
  console.log('件数:', list.length);
  console.log('最新のキャンセル:', list[0]);
  
  // 予約IDで検索
  console.log('\n=== 予約ID検索テスト ===');
  const found = service.findByReservationId(testData.reservationId);
  console.log('検索結果:', found);
  
  // 統計情報を取得
  console.log('\n=== 統計情報取得テスト ===');
  const stats = service.getStatistics();
  console.log('統計:', stats);
}