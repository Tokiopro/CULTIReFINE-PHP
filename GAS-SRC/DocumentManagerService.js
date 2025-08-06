/**
 * 書類管理サービス
 * 書類とフォルダの管理機能を提供
 */
class DocumentManagerService {
  constructor() {
    // SpreadsheetManagerは静的メソッドのみを持つため、インスタンス化は不要
  }

  /**
   * 書類のプレビューURLを生成
   * @param {string} documentId 書類ID
   * @returns {string} プレビューURL
   */
  generatePreviewUrl(documentId) {
    // 実際の実装に応じてURLを調整
    // 例: Google DriveのファイルIDを使用する場合
    // return `https://drive.google.com/file/d/${documentId}/preview`;
    
    // 現在は仮のURL形式を返す
    return `/preview/document/${documentId}`;
  }

  /**
   * 患者のフォルダ一覧を取得
   * @param {string} patientId 患者ID
   * @returns {Array} フォルダのリスト
   */
  getFoldersByPatient(patientId) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    if (!sheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      // デフォルトフォルダ定義を返す
      return this.getDefaultFolderDefinitions();
    }

    const folders = [];
    const defaultFolders = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // フォルダIDが空の行はスキップ
      
      const folderData = {
        folderId: row[0],
        patientId: row[1],
        folderName: row[2],
        parentFolderId: row[3] || null,
        description: row[4] || '',
        displayOrder: row[5] || 999,
        path: row[6] || '',
        createdAt: row[7] || new Date(),
        isDefault: !row[1] || row[1] === '' // 患者IDがない場合はデフォルトフォルダ
      };
      
      // 患者IDが一致するか、デフォルトフォルダの場合
      if (row[1] === patientId) {
        folders.push(folderData);
      } else if (!row[1] || row[1] === '') {
        // デフォルトフォルダを別配列に保存
        defaultFolders.push(folderData);
      }
    }

    // 患者専用フォルダがない場合はデフォルトフォルダを返す
    if (folders.length === 0 && defaultFolders.length > 0) {
      // デフォルトフォルダをテンプレートとして表示（読み取り専用フラグ付き）
      return defaultFolders.map(folder => ({
        ...folder,
        isTemplate: true,
        folderName: folder.folderName + ' (テンプレート)'
      }));
    }

    // 表示順でソート
    return folders.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * すべてのフォルダ定義を取得（管理画面用）
   * @returns {Array} フォルダ定義の配列
   */
  getAllFolderDefinitions() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    if (!sheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const folders = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // フォルダIDが空の行はスキップ
      
      const folderData = {
        folderId: row[0],
        patientId: row[1] || '',
        folderName: row[2] || '',
        parentFolderId: row[3] || '',
        description: row[4] || '',
        displayOrder: row[5] || 999,
        path: row[6] || '',
        createdAt: row[7] || '',
        isDefault: !row[1] || row[1] === ''
      };
      
      folders.push(folderData);
    }

    // 表示順でソート
    return folders.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * フォルダ定義を保存（管理画面用）
   * @param {Object} folderData - フォルダデータ
   * @returns {Object} 処理結果
   */
  saveFolderDefinition(folderData) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    if (!sheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // 既存のフォルダを探す
    if (folderData.folderId) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === folderData.folderId) {
          rowIndex = i + 1; // シートの行番号は1ベース
          break;
        }
      }
    }

    // データを準備
    const rowData = [
      folderData.folderId || Utilities.getUuid(),
      folderData.patientId || '',
      folderData.folderName,
      folderData.parentFolderId || '',
      folderData.description || '',
      folderData.displayOrder || 999,
      folderData.path || '',
      folderData.createdAt || new Date()
    ];

    if (rowIndex > 0) {
      // 既存のフォルダを更新
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: 'フォルダ定義を更新しました' };
    } else {
      // 新規フォルダを追加
      sheet.appendRow(rowData);
      return { success: true, message: 'フォルダ定義を追加しました' };
    }
  }

  /**
   * フォルダ定義を削除（管理画面用）
   * @param {string} folderId - フォルダID
   * @returns {Object} 処理結果
   */
  deleteFolderDefinition(folderId) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    if (!sheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    
    // フォルダを探す
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === folderId) {
        sheet.deleteRow(i + 1); // シートの行番号は1ベース
        return { success: true, message: 'フォルダ定義を削除しました' };
      }
    }

    throw new Error('指定されたフォルダが見つかりません');
  }

  /**
   * デフォルトフォルダ定義を取得
   */
  getDefaultFolderDefinitions() {
    return [
      {
        folderId: 'DEFAULT-001',
        patientId: '',
        folderName: '同意書 (テンプレート)',
        parentFolderId: null,
        description: '各種同意書を管理するフォルダ',
        displayOrder: 1,
        path: '/同意書',
        createdAt: new Date(),
        isTemplate: true
      },
      {
        folderId: 'DEFAULT-002',
        patientId: '',
        folderName: '契約書 (テンプレート)',
        parentFolderId: null,
        description: '契約関連の書類を管理するフォルダ',
        displayOrder: 2,
        path: '/契約書',
        createdAt: new Date(),
        isTemplate: true
      },
      {
        folderId: 'DEFAULT-003',
        patientId: '',
        folderName: '診療記録 (テンプレート)',
        parentFolderId: null,
        description: '診療に関する記録を管理するフォルダ',
        displayOrder: 3,
        path: '/診療記録',
        createdAt: new Date(),
        isTemplate: true
      },
      {
        folderId: 'DEFAULT-004',
        patientId: '',
        folderName: 'その他 (テンプレート)',
        parentFolderId: null,
        description: 'その他の書類を管理するフォルダ',
        displayOrder: 99,
        path: '/その他',
        createdAt: new Date(),
        isTemplate: true
      }
    ];
  }

  /**
   * フォルダツリー構造を構築
   * @param {Array} folders フォルダリスト
   * @param {string} parentId 親フォルダID
   * @returns {Array} ツリー構造のフォルダリスト
   */
  buildFolderTree(folders, parentId = null) {
    return folders
      .filter(f => f.parentFolderId === parentId)
      .map(folder => ({
        ...folder,
        children: this.buildFolderTree(folders, folder.folderId)
      }));
  }

  /**
   * フォルダパスを生成
   * @param {string} folderId フォルダID
   * @param {Array} allFolders 全フォルダリスト
   * @returns {string} フォルダパス
   */
  getFolderPath(folderId, allFolders) {
    const folder = allFolders.find(f => f.folderId === folderId);
    if (!folder) return '';

    const path = [folder.folderName];
    let currentFolder = folder;

    while (currentFolder.parentFolderId) {
      const parentFolder = allFolders.find(f => f.folderId === currentFolder.parentFolderId);
      if (!parentFolder) break;
      path.unshift(parentFolder.folderName);
      currentFolder = parentFolder;
    }

    return path.join(' / ');
  }

  /**
   * フォルダを保存（新規作成または更新）
   * @param {Object} folderData フォルダ情報
   * @returns {Object} 保存結果
   */
  saveFolder(folderData) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    if (!sheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    
    // フォルダIDの生成（新規の場合）
    if (!folderData.folderId) {
      folderData.folderId = 'FOLDER_' + Utilities.getUuid().substring(0, 8).toUpperCase();
      folderData.createdAt = new Date();
    }

    // パスの生成
    if (folderData.parentFolderId && folderData.patientId) {
      const allFolders = this.getFoldersByPatient(folderData.patientId);
      const parentPath = this.getFolderPath(folderData.parentFolderId, allFolders);
      folderData.path = parentPath ? `${parentPath} / ${folderData.folderName}` : folderData.folderName;
    } else {
      folderData.path = folderData.folderName;
    }

    // 既存フォルダの検索
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === folderData.folderId) {
        rowIndex = i + 1; // シートの行番号は1から始まる
        break;
      }
    }

    const rowData = [
      folderData.folderId,
      folderData.patientId,
      folderData.folderName,
      folderData.parentFolderId || '',
      folderData.description || '',
      folderData.displayOrder || 999,
      folderData.path,
      folderData.createdAt || new Date()
    ];

    if (rowIndex > 0) {
      // 更新
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // 新規追加
      sheet.appendRow(rowData);
    }

    return {
      success: true,
      folderId: folderData.folderId,
      message: rowIndex > 0 ? 'フォルダを更新しました' : '新しいフォルダを作成しました'
    };
  }

  /**
   * フォルダを削除
   * @param {string} folderId フォルダID
   * @returns {Object} 削除結果
   */
  deleteFolder(folderId) {
    // まず関連する書類があるかチェック
    const documents = this.getDocumentsByFolder(folderId);
    if (documents.length > 0) {
      return {
        success: false,
        error: 'このフォルダには書類が登録されているため削除できません'
      };
    }

    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    if (!sheet) {
      throw new Error('書類フォルダ定義シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === folderId) {
        sheet.deleteRow(i + 1);
        return {
          success: true,
          message: 'フォルダを削除しました'
        };
      }
    }

    return {
      success: false,
      error: '指定されたフォルダが見つかりません'
    };
  }

  /**
   * 患者の書類一覧を取得
   * @param {string} patientId 患者ID
   * @returns {Array} 書類のリスト
   */
  getDocumentsByPatient(patientId) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentManagement);
    if (!sheet) {
      throw new Error('書類管理シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const documents = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 患者IDが一致する書類のみ取得
      if (row[4] !== patientId) continue;
      
      documents.push({
        folderId: row[0],
        documentId: row[1],
        documentName: row[2],
        url: row[3],
        patientId: row[4],
        patientName: row[5],
        treatmentName: row[6] || '一般書類',
        uploadDate: row[7],
        updateDate: row[8],
        remarks: row[9] || '',
        // 互換性のため追加
        folderName: '', // フォルダ名は別シートから取得する必要がある
        expiryDate: null,
        status: '有効'
      });
    }

    // アップロード日時の降順でソート
    return documents.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  }

  /**
   * 患者の初期フォルダを作成
   * @param {string} patientId 患者ID
   * @returns {Object} 作成結果
   */
  createDefaultFoldersForPatient(patientId) {
    const defaultFolders = [
      { folderName: '同意書', description: '各種同意書を管理するフォルダ', displayOrder: 1 },
      { folderName: '契約書', description: '契約関連の書類を管理するフォルダ', displayOrder: 2 },
      { folderName: '診療記録', description: '診療に関する記録を管理するフォルダ', displayOrder: 3 },
      { folderName: 'その他', description: 'その他の書類を管理するフォルダ', displayOrder: 99 }
    ];

    const results = [];
    for (const folderData of defaultFolders) {
      const result = this.saveFolder({
        ...folderData,
        patientId: patientId,
        parentFolderId: null
      });
      results.push(result);
    }

    return {
      success: true,
      message: `${results.length}個のデフォルトフォルダを作成しました`
    };
  }

  /**
   * フォルダ内の書類を取得
   * @param {string} folderId フォルダID
   * @returns {Array} 書類のリスト
   */
  getDocumentsByFolder(folderId) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentManagement);
    if (!sheet) {
      throw new Error('書類管理シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const documents = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[3] === folderId) { // フォルダIDが一致
        documents.push({
          documentId: row[0],
          patientId: row[1],
          patientName: row[2],
          folderId: row[3],
          folderName: row[4],
          documentName: row[5],
          uploadDate: row[6],
          expiryDate: row[7],
          status: row[8] || '有効',
          treatmentName: row[9] || '一般書類', // treatmentNameとして取得
          remarks: row[9] || '' // 後方互換性のため残す
        });
      }
    }

    return documents;
  }

  /**
   * 書類を保存（新規作成または更新）
   * @param {Object} documentData 書類情報
   * @returns {Object} 保存結果
   */
  saveDocument(documentData) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentManagement);
    if (!sheet) {
      throw new Error('書類管理シートが見つかりません');
    }

    // フォルダ名を取得
    const folders = this.getFoldersByPatient(documentData.patientId);
    const folder = folders.find(f => f.folderId === documentData.folderId);
    if (!folder) {
      return {
        success: false,
        error: '指定されたフォルダが見つかりません'
      };
    }

    // 患者名を取得（必要に応じて）
    if (!documentData.patientName && documentData.patientId) {
      const visitorService = new VisitorService();
      try {
        const patient = visitorService.getVisitorById(documentData.patientId);
        documentData.patientName = patient.name;
      } catch (e) {
        console.error('患者情報の取得に失敗:', e);
        documentData.patientName = '不明';
      }
    }

    const data = sheet.getDataRange().getValues();
    
    // 書類IDの生成（新規の場合）
    if (!documentData.documentId) {
      documentData.documentId = 'DOC_' + Utilities.getUuid().substring(0, 8).toUpperCase();
      documentData.uploadDate = new Date();
    }

    // 既存書類の検索
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === documentData.documentId) {
        rowIndex = i + 1; // シートの行番号は1から始まる
        break;
      }
    }

    const rowData = [
      documentData.documentId,
      documentData.patientId,
      documentData.patientName,
      documentData.folderId,
      folder.folderName,
      documentData.documentName,
      documentData.uploadDate || new Date(),
      documentData.expiryDate || '',
      documentData.status || '有効',
      documentData.treatmentName || documentData.remarks || '一般書類' // treatmentNameを優先、なければremarksを使用
    ];

    if (rowIndex > 0) {
      // 更新
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // 新規追加
      sheet.appendRow(rowData);
    }

    return {
      success: true,
      documentId: documentData.documentId,
      message: rowIndex > 0 ? '書類を更新しました' : '新しい書類を登録しました'
    };
  }

  /**
   * 書類を削除
   * @param {string} documentId 書類ID
   * @returns {Object} 削除結果
   */
  deleteDocument(documentId) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentManagement);
    if (!sheet) {
      throw new Error('書類管理シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === documentId) {
        sheet.deleteRow(i + 1);
        return {
          success: true,
          message: '書類を削除しました'
        };
      }
    }

    return {
      success: false,
      error: '指定された書類が見つかりません'
    };
  }

  /**
   * 有効期限が近い書類を取得
   * @param {number} days 日数（デフォルト: 30日）
   * @returns {Array} 有効期限が近い書類のリスト
   */
  getExpiringDocuments(days = 30) {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentManagement);
    if (!sheet) {
      throw new Error('書類管理シートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + days);

    const expiringDocuments = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const expiryDate = row[7];
      
      if (expiryDate && expiryDate instanceof Date) {
        if (expiryDate >= today && expiryDate <= targetDate) {
          expiringDocuments.push({
            documentId: row[0],
            patientId: row[1],
            patientName: row[2],
            folderName: row[4],
            documentName: row[5],
            expiryDate: expiryDate,
            daysRemaining: Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
          });
        }
      }
    }

    // 有効期限の昇順でソート
    return expiringDocuments.sort((a, b) => a.expiryDate - b.expiryDate);
  }
}