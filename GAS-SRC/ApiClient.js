/**
 * Medical Force API通信クライアント
 */
class ApiClient {
  constructor() {
    this.config = Config.getApiConfig();
    this.baseUrl = this.config.baseUrl;
    // ヘッダーは各リクエスト時に動的に生成（トークンの有効期限対応）
  }
  
  /**
   * GETリクエストを送信
   */
  get(endpoint, params = {}) {
    const url = this._buildUrl(endpoint, params);
    const options = {
      method: 'get',
      headers: this._getHeaders(),
      muteHttpExceptions: true
    };
    
    return this._request(url, options);
  }
  
  /**
   * POSTリクエストを送信
   */
  post(endpoint, data = {}) {
    const url = this._buildUrl(endpoint);
    const options = {
      method: 'post',
      headers: this._getHeaders(),
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    return this._request(url, options);
  }
  
  /**
   * DELETEリクエストを送信
   */
  delete(endpoint) {
    const url = this._buildUrl(endpoint);
    const options = {
      method: 'delete',
      headers: this._getHeaders(),
      muteHttpExceptions: true
    };
    
    return this._request(url, options);
  }
  
  /**
   * リクエストを実行
   */
  _request(url, options) {
    try {
      Logger.log(`API Request: ${options.method.toUpperCase()} ${url}`);
      
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      Logger.log(`API Response: Status ${statusCode}`);
      
      if (statusCode >= 200 && statusCode < 300) {
        // 成功
        if (responseText) {
          return {
            success: true,
            data: JSON.parse(responseText),
            statusCode: statusCode
          };
        } else {
          return {
            success: true,
            data: null,
            statusCode: statusCode
          };
        }
      } else if (statusCode === 401) {
        // 認証エラー
        throw new Error('認証エラー: APIキーが無効か、有効期限が切れています。');
      } else {
        // その他のエラー
        let errorMessage = `APIエラー: Status ${statusCode}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message) {
            errorMessage += ` - ${errorData.message}`;
          }
        } catch (e) {
          errorMessage += ` - ${responseText}`;
        }
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      Logger.log(`API Error: ${error.toString()}`);
      throw error;
    }
  }
  
  /**
   * 認証ヘッダーを動的に生成
   */
  _getHeaders() {
    // OAuth 2.0アクセストークンを取得（自動更新される）
    const accessToken = TokenManager.getAccessToken();
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
  
  /**
   * URLを構築
   */
  _buildUrl(endpoint, params = {}) {
    let url = this.baseUrl + endpoint;
    
    // パスパラメータの置換
    Object.keys(params).forEach(key => {
      if (url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, params[key]);
        delete params[key];
      }
    });
    
    // クエリパラメータの追加
    const queryParams = [];
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        queryParams.push(`${key}=${encodeURIComponent(params[key])}`);
      }
    });
    
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }
    
    return url;
  }
  
  /**
   * 患者情報を取得
   */
  getVisitors(params = {}) {
    params.clinic_id = params.clinic_id || Config.getClinicId();
    return this.get(this.config.endpoints.visitors, params);
  }
  
  /**
   * 患者情報を作成
   */
  createVisitor(data) {
    data.clinic_id = data.clinic_id || Config.getClinicId();
    return this.post(this.config.endpoints.createVisitor, data);
  }
  
  /**
   * 予約情報を取得
   */
  getReservations(params = {}) {
    params.clinic_id = params.clinic_id || Config.getClinicId();
    return this.get(this.config.endpoints.reservations, params);
  }
  
  /**
   * 予約を作成
   */
  createReservation(data) {
    data.clinic_id = data.clinic_id || Config.getClinicId();
    return this.post(this.config.endpoints.createReservation, data);
  }
  
  /**
   * メニュー一覧を取得
   */
  getMenus(params = {}) {
    params.clinic_id = params.clinic_id || Config.getClinicId();
    return this.get(this.config.endpoints.menus, params);
  }
  
  /**
   * 空き時間を取得（POST方式）
   */
  postVacancies(data = {}) {
    data.clinic_id = data.clinic_id || Config.getClinicId();
    return this.post(this.config.endpoints.vacancies, data);
  }
  
  /**
   * 空き時間を取得（GET方式 - 互換性のため残す）
   */
  getVacancies(params = {}) {
    params.clinic_id = params.clinic_id || Config.getClinicId();
    return this.get(this.config.endpoints.vacancies, params);
  }
  
  /**
   * 患者の書類一覧を取得（フォルダ階層付き）
   */
  getDocuments(visitorId) {
    if (!visitorId) {
      throw new Error('患者IDが指定されていません');
    }
    
    // ローカルのDocumentManagerServiceを使用してフォルダ階層付きの書類を取得
    const documentService = new DocumentManagerService();
    
    // 患者のフォルダ一覧を取得
    const folders = documentService.getFoldersByPatient(visitorId);
    
    // フォルダツリー構造を構築
    const folderTree = documentService.buildFolderTree(folders);
    
    // 患者の全書類を取得
    const documents = documentService.getDocumentsByPatient(visitorId);
    
    // 書類情報を期待される形式に変換
    const transformDocument = (doc) => {
      return {
        title: doc.documentName,
        url: documentService.generatePreviewUrl(doc.documentId), // 統一化されたURL生成
        createdAt: doc.uploadDate,
        treatmentName: doc.treatmentName || doc.remarks || '一般書類' // treatmentNameを優先
      };
    };
    
    // フォルダごとに書類を整理
    const documentsMap = {};
    documents.forEach(doc => {
      if (!documentsMap[doc.folderId]) {
        documentsMap[doc.folderId] = [];
      }
      documentsMap[doc.folderId].push(transformDocument(doc));
    });
    
    // フォルダ情報を期待される形式に変換
    const transformFolder = (folder) => {
      const transformed = {
        name: folder.folderName,
        documents: documentsMap[folder.folderId] || [],
        children: []
      };
      
      if (folder.children && folder.children.length > 0) {
        transformed.children = folder.children.map(child => transformFolder(child));
      }
      
      return transformed;
    };
    
    // フォルダツリーに書類を追加し、形式を変換
    const transformedFolders = folderTree.map(folder => transformFolder(folder));
    
    // ルートレベルの書類（フォルダに属さない書類）も変換
    const rootDocuments = documents
      .filter(doc => !doc.folderId)
      .map(doc => transformDocument(doc));
    
    return {
      success: true,
      data: {
        folders: transformedFolders,
        rootDocuments: rootDocuments,
        totalDocuments: documents.length
      }
    };
  }
}