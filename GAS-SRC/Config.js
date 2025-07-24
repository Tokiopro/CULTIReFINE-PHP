/**
 * Medical Force API設定管理
 */
class Config {
  static getApiConfig() {
    return {
      baseUrl: 'https://api.medical-force.com',
      endpoints: {
        // クリニック関連
        clinics: '/developer/clinics',
        
        // 患者（visitor）関連
        visitors: '/developer/visitors',
        visitorById: '/developer/visitors/{id}',
        updatedVisitors: '/developer/updated-brand-visitors',
        createVisitor: '/developer/visitors',
        
        // 顧客関連
        customers: '/developer/customers',
        
        // 予約関連
        reservations: '/developer/reservations',
        reservationById: '/developer/reservations/{id}',
        checkReservation: '/developer/check-reservations/{id}',
        updatedReservations: '/developer/updated-brand-reservations',
        createReservation: '/developer/reservations',
        deleteProcessingReservation: '/developer/reservations/processing/{id}',
        vacancies: '/developer/vacancies',
        dailyVacancies: '/developer/daily-vacancies',
        createVacancy: '/developer/vacancies',
        
        // 役務（コース）関連
        updatedCourses: '/developer/updated-brand-courses',
        updatedCourseCounts: '/developer/updated-brand-course-counts',
        
        // 在庫関連
        updatedDrugs: '/developer/updated-brand-drugs',
        updatedProducts: '/developer/updated-brand-products',
        
        // メニュー関連
        menus: '/developer/menus',
        createMenuRelation: '/developer/menu-relations',
        
        // 問い合わせ関連
        updatedInquiries: '/developer/updated-brand-inquiries',
        
        // 書類関連
        documents: '/developer/visitors/{visitorId}/documents',
        
        // 施術関連
        operations: '/developer/operations',
        operationById: '/developer/operations/{id}'
      }
    };
  }
  
  // OAuth 2.0認証に移行したため、このメソッドは不要
  // static getApiKey() {
  //   // スクリプトプロパティから取得
  //   const scriptProperties = PropertiesService.getScriptProperties();
  //   const apiKey = scriptProperties.getProperty('MEDICAL_FORCE_API_KEY');
  //   
  //   if (!apiKey) {
  //     throw new Error('APIキーが設定されていません。スクリプトプロパティにMEDICAL_FORCE_API_KEYを設定してください。');
  //   }
  //   
  //   return apiKey;
  // }
  
  static getClinicId() {
    // スクリプトプロパティから取得
    const scriptProperties = PropertiesService.getScriptProperties();
    const clinicId = scriptProperties.getProperty('CLINIC_ID');
    
    if (!clinicId) {
      throw new Error('クリニックIDが設定されていません。スクリプトプロパティにCLINIC_IDを設定してください。');
    }
    
    return clinicId;
  }
  
  static getSpreadsheetId() {
    // スクリプトプロパティから環境別のスプレッドシートIDを取得
    const scriptProperties = PropertiesService.getScriptProperties();
    const envSpreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
    
    if (envSpreadsheetId) {
      // 環境別のスプレッドシートIDが設定されている場合はそれを使用
      return envSpreadsheetId;
    }
    
    // 設定されていない場合は現在のスプレッドシートのIDを返す（従来の動作）
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  }
  
  static getSheetNames() {
    return {
      config: '設定',
      visitors: '患者マスタ',
      reservations: '予約情報',
      menus: 'メニュー管理',
      menuCategories: 'メニューカテゴリ管理',
      logs: '実行ログ',
      companyMaster: '会社マスタ',
      companyVisitors: '会社別来院者管理',
      treatmentInterval: '施術間隔定義',
      roomManagement: '部屋管理',
      menuMapping: 'メニューマッピング',
      documentManagement: '書類管理',
      documentFolders: '書類フォルダ定義',
      treatmentMaster: '施術マスタ',
      treatmentCategories: 'カテゴリマスタ',
      generatedMenus: '生成メニュー',
      notificationSettings: '通知設定',
      notificationHistory: '通知履歴',
      staff: 'スタッフ管理'
    };
  }
  
  static getDefaultHeaders() {
    // OAuth 2.0認証を使用
    const accessToken = TokenManager.getAccessToken();
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
  
  static getTimeZone() {
    return 'Asia/Tokyo';
  }
  
  static getDateFormat() {
    return 'yyyy-MM-dd';
  }
  
  static getDateTimeFormat() {
    return 'yyyy-MM-dd HH:mm:ss';
  }
  
  static getPHPSyncEndpoint() {
    // PHP側の同期エンドポイント
    return 'https://cultirefine.com/reserve/api-bridge.php';
  }
  
  static getAdminEmail() {
    // 管理者メールアドレス（同期エラー通知用）
    const scriptProperties = PropertiesService.getScriptProperties();
    return scriptProperties.getProperty('ADMIN_EMAIL') || '';
  }
}