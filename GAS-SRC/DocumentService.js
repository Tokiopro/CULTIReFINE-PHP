/**
 * 書類管理サービスクラス
 */
class DocumentService {
  constructor() {
    this.spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = this.spreadsheet.getSheetByName(Config.getSheetNames().documentManagement);
    this.visitorSheet = this.spreadsheet.getSheetByName(Config.getSheetNames().visitors);
  }
  
  /**
   * 書類一覧を取得
   */
  getDocuments(filters = {}) {
    if (!this.sheet) {
      throw new Error('書類管理シートが見つかりません');
    }
    
    const data = this.sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // ヘッダーのみの場合
    
    const headers = data[0];
    const documents = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const document = {
        documentId: row[0],
        title: row[1],
        url: row[2],
        visitorId: row[3],
        visitorName: row[4],
        treatmentName: row[5],
        createdAt: row[6],
        updatedAt: row[7],
        notes: row[8]
      };
      
      // フィルタリング
      if (filters.visitorId && document.visitorId !== filters.visitorId) continue;
      if (filters.treatmentName && !document.treatmentName.includes(filters.treatmentName)) continue;
      
      documents.push(document);
    }
    
    return documents;
  }
  
  /**
   * 書類を追加
   */
  addDocument(documentData) {
    if (!this.sheet) {
      throw new Error('書類管理シートが見つかりません');
    }
    
    // 書類IDを生成
    const documentId = this._generateDocumentId();
    
    // 患者名を取得
    const visitorName = this._getVisitorName(documentData.visitorId);
    
    // 現在日時
    const now = new Date();
    
    // データを準備
    const rowData = [
      documentId,
      documentData.title,
      documentData.url,
      documentData.visitorId,
      visitorName,
      documentData.treatmentName,
      now,
      now,
      documentData.notes || ''
    ];
    
    // シートに追加
    this.sheet.appendRow(rowData);
    
    return {
      success: true,
      documentId: documentId,
      message: '書類を登録しました'
    };
  }
  
  /**
   * 書類を更新
   */
  updateDocument(documentId, updateData) {
    if (!this.sheet) {
      throw new Error('書類管理シートが見つかりません');
    }
    
    const data = this.sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === documentId) {
        // 患者IDが変更された場合は患者名も更新
        if (updateData.visitorId && updateData.visitorId !== data[i][3]) {
          const visitorName = this._getVisitorName(updateData.visitorId);
          this.sheet.getRange(i + 1, 5).setValue(visitorName);
          this.sheet.getRange(i + 1, 4).setValue(updateData.visitorId);
        }
        
        // その他のフィールドを更新
        if (updateData.title) this.sheet.getRange(i + 1, 2).setValue(updateData.title);
        if (updateData.url) this.sheet.getRange(i + 1, 3).setValue(updateData.url);
        if (updateData.treatmentName !== undefined) this.sheet.getRange(i + 1, 6).setValue(updateData.treatmentName);
        if (updateData.notes !== undefined) this.sheet.getRange(i + 1, 9).setValue(updateData.notes);
        
        // 更新日時を更新
        this.sheet.getRange(i + 1, 8).setValue(new Date());
        
        return {
          success: true,
          message: '書類情報を更新しました'
        };
      }
    }
    
    throw new Error('指定された書類が見つかりません');
  }
  
  /**
   * 書類を削除
   */
  deleteDocument(documentId) {
    if (!this.sheet) {
      throw new Error('書類管理シートが見つかりません');
    }
    
    const data = this.sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === documentId) {
        this.sheet.deleteRow(i + 1);
        return {
          success: true,
          message: '書類を削除しました'
        };
      }
    }
    
    throw new Error('指定された書類が見つかりません');
  }
  
  /**
   * 患者IDから患者名を取得
   */
  _getVisitorName(visitorId) {
    if (!this.visitorSheet) {
      return '不明';
    }
    
    const data = this.visitorSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === visitorId) {
        return data[i][1]; // 氏名カラム
      }
    }
    
    return '不明';
  }
  
  /**
   * 書類IDを生成
   */
  _generateDocumentId() {
    const prefix = 'DOC';
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
  
  /**
   * 患者一覧を取得（ドロップダウン用）
   */
  getVisitorsForDropdown() {
    if (!this.visitorSheet) {
      return [];
    }
    
    const data = this.visitorSheet.getDataRange().getValues();
    const visitors = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) { // visitor_idと氏名が存在する場合
        visitors.push({
          visitor_id: data[i][0],
          name: data[i][1],
          name_kana: data[i][2] || ''
        });
      }
    }
    
    // 氏名でソート
    visitors.sort((a, b) => {
      const nameA = a.name_kana || a.name;
      const nameB = b.name_kana || b.name;
      return nameA.localeCompare(nameB, 'ja');
    });
    
    return visitors;
  }
  
  /**
   * フォルダ一覧を取得
   */
  getFolders(filters = {}) {
    const folderSheet = this.spreadsheet.getSheetByName(Config.getSheetNames().documentFolders);
    if (!folderSheet) {
      // シートがない場合は空配列を返す（エラーにしない）
      return [];
    }
    
    const data = folderSheet.getDataRange().getValues();
    if (data.length <= 1) return []; // ヘッダーのみの場合
    
    const folders = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const folder = {
        folderId: row[0],
        folderName: row[1],
        description: row[2],
        displayOrder: row[3],
        createdAt: row[4],
        isActive: true // すべてのフォルダを有効として扱う
      };
      
      // フィルタリング（activeOnlyは現在未使用だが、将来の拡張のため残す）
      if (filters.activeOnly && !folder.isActive) continue;
      
      folders.push(folder);
    }
    
    // 表示順でソート
    folders.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    
    return folders;
  }
  
  /**
   * フォルダを追加
   */
  addFolder(folderData) {
    const folderSheet = this.spreadsheet.getSheetByName(Config.getSheetNames().documentFolders);
    if (!folderSheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }
    
    // フォルダIDを生成
    const folderId = this._generateFolderId();
    
    // データを準備
    const now = new Date();
    const createdAt = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd');
    
    const rowData = [
      folderId,
      folderData.folderName,
      folderData.description || '',
      folderData.displayOrder || 999,
      createdAt // 作成日時
    ];
    
    // シートに追加
    folderSheet.appendRow(rowData);
    
    return {
      success: true,
      folderId: folderId,
      message: 'フォルダを登録しました'
    };
  }
  
  /**
   * フォルダを更新
   */
  updateFolder(folderId, updateData) {
    const folderSheet = this.spreadsheet.getSheetByName(Config.getSheetNames().documentFolders);
    if (!folderSheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }
    
    const data = folderSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === folderId) {
        // フィールドを更新（作成日時は更新しない）
        if (updateData.folderName !== undefined) folderSheet.getRange(i + 1, 2).setValue(updateData.folderName);
        if (updateData.description !== undefined) folderSheet.getRange(i + 1, 3).setValue(updateData.description);
        if (updateData.displayOrder !== undefined) folderSheet.getRange(i + 1, 4).setValue(updateData.displayOrder);
        // 5列目は作成日時なので更新しない
        
        return {
          success: true,
          message: 'フォルダ情報を更新しました'
        };
      }
    }
    
    throw new Error('指定されたフォルダが見つかりません');
  }
  
  /**
   * フォルダを削除
   */
  deleteFolder(folderId) {
    const folderSheet = this.spreadsheet.getSheetByName(Config.getSheetNames().documentFolders);
    if (!folderSheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }
    
    const data = folderSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === folderId) {
        folderSheet.deleteRow(i + 1);
        return {
          success: true,
          message: 'フォルダを削除しました'
        };
      }
    }
    
    throw new Error('指定されたフォルダが見つかりません');
  }
  
  /**
   * フォルダIDを生成
   */
  _generateFolderId() {
    const prefix = 'FLD';
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
  
  /**
   * フォルダ一覧を取得（ドロップダウン用）
   */
  getFoldersForDropdown() {
    const folders = this.getFolders({ activeOnly: true });
    return folders.map(folder => ({
      folderId: folder.folderId,
      folderName: folder.folderName
    }));
  }
}