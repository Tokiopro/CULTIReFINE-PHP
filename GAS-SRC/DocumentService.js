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
    
    Logger.log(`DocumentService.getDocuments: 全データ行数: ${data.length - 1}`);
    Logger.log(`DocumentService.getDocuments: フィルタ条件: ${JSON.stringify(filters)}`);
    
    const headers = data[0];
    Logger.log(`DocumentService.getDocuments: ヘッダー: ${JSON.stringify(headers)}`);
    const documents = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // シートの列構造: フォルダID(0), 書類ID(1), 書類タイトル(2), 書類URL(3), 対象患者ID(4), 対象患者名(5), 対象施術名(6), 登録日時(7), 更新日時(8), 備考(9)
      const document = {
        folderId: row[0],
        documentId: row[1],
        title: row[2],
        url: row[3],
        visitorId: row[4],
        visitorName: row[5],
        treatmentName: row[6],
        createdAt: row[7],
        updatedAt: row[8],
        notes: row[9]
      };
      
      // 空の行をスキップ
      if (!document.documentId && !document.title && !document.visitorId) {
        continue;
      }
      
      // フィルタリング
      if (filters.visitorId) {
        const docVisitorId = document.visitorId ? String(document.visitorId).trim() : '';
        const filterVisitorId = String(filters.visitorId).trim();
        
        // デバッグ用詳細ログ（最初の5件のみ）
        if (i <= 5) {
          Logger.log(`DocumentService: 行${i} - visitorId比較:`);
          Logger.log(`  - 元の値: "${document.visitorId}" (型: ${typeof document.visitorId})`);
          Logger.log(`  - 変換後: "${docVisitorId}"`);
          Logger.log(`  - フィルタ: "${filterVisitorId}"`);
          Logger.log(`  - 一致: ${docVisitorId === filterVisitorId}`);
        }
        
        if (docVisitorId !== filterVisitorId) {
          continue;
        }
      }
      if (filters.treatmentName && !document.treatmentName.includes(filters.treatmentName)) continue;
      
      documents.push(document);
    }
    
    Logger.log(`DocumentService.getDocuments: 取得された書類数: ${documents.length}`);
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
    
    // データを準備（シートの列構造に合わせる）
    const rowData = [
      documentData.folderId || '',  // フォルダID
      documentId,                    // 書類ID
      documentData.title,           // 書類タイトル
      documentData.url,             // 書類URL
      documentData.visitorId,       // 対象患者ID
      visitorName,                  // 対象患者名
      documentData.treatmentName,   // 対象施術名
      now,                          // 登録日時
      now,                          // 更新日時
      documentData.notes || ''      // 備考
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
      if (data[i][1] === documentId) {  // 書類IDは2列目（インデックス1）
        // 患者IDが変更された場合は患者名も更新
        if (updateData.visitorId && updateData.visitorId !== data[i][4]) {
          const visitorName = this._getVisitorName(updateData.visitorId);
          this.sheet.getRange(i + 1, 6).setValue(visitorName);  // 対象患者名は6列目
          this.sheet.getRange(i + 1, 5).setValue(updateData.visitorId);  // 対象患者IDは5列目
        }
        
        // その他のフィールドを更新
        if (updateData.title) this.sheet.getRange(i + 1, 3).setValue(updateData.title);  // 書類タイトルは3列目
        if (updateData.url) this.sheet.getRange(i + 1, 4).setValue(updateData.url);  // 書類URLは4列目
        if (updateData.treatmentName !== undefined) this.sheet.getRange(i + 1, 7).setValue(updateData.treatmentName);  // 対象施術名は7列目
        if (updateData.notes !== undefined) this.sheet.getRange(i + 1, 10).setValue(updateData.notes);  // 備考は10列目
        
        // 更新日時を更新
        this.sheet.getRange(i + 1, 9).setValue(new Date());  // 更新日時は9列目
        
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
      if (data[i][1] === documentId) {  // 書類IDは2列目（インデックス1）
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