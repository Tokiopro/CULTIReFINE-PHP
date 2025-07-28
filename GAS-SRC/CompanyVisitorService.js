/**
 * 会社別来院者管理サービスクラス
 */
class CompanyVisitorService {
  constructor() {
    console.log('CompanyVisitorService初期化開始');
    this.spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    const sheetNames = Config.getSheetNames();
    console.log('シート名設定:', sheetNames);
    
    // 全シートの名前を取得してログ出力
    const allSheets = this.spreadsheet.getSheets();
    const allSheetNames = allSheets.map(sheet => sheet.getName());
    console.log('スプレッドシート内の全シート名:', allSheetNames);
    
    // 会社別来院者管理シートを取得
    const targetSheetName = sheetNames.companyVisitors;
    console.log(`探しているシート名: "${targetSheetName}"`);
    this.sheet = this.spreadsheet.getSheetByName(targetSheetName);
    
    if (!this.sheet) {
      console.error(`シート "${targetSheetName}" が見つかりません`);
      // シートが存在しない場合は作成
      console.log('シートを新規作成します...');
      this.sheet = SpreadsheetManager.initializeCompanyVisitorsSheet();
      console.log('シート作成結果:', this.sheet ? '成功' : '失敗');
    } else {
      console.log(`会社別来院者管理シート取得: 成功`);
    }
    
    // 患者マスタシートを取得
    this.visitorSheet = this.spreadsheet.getSheetByName(sheetNames.visitors);
    console.log(`患者マスタシート取得結果:`, this.visitorSheet ? '成功' : '失敗');
  }
  
  /**
   * 会社に紐づく来院者一覧を取得
   */
  getCompanyVisitors(companyId) {
    console.log(`=== getCompanyVisitors開始 - 会社ID: ${companyId} ===`);
    
    if (!this.sheet) {
      console.error('会社別来院者管理シートが設定されていません');
      console.log('空の配列を返します');
      return [];
    }
    
    try {
      const data = this.sheet.getDataRange().getValues();
      console.log(`シートの全行数: ${data.length}`);
    
    // ヘッダー行を確認
    if (data.length > 0) {
      console.log('ヘッダー行:', data[0]);
    }
    
    const visitors = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === companyId) {
        console.log(`行${i+1}のデータ:`, data[i]);
        
        // positionフィールドの値を正規化（役職は7番目のインデックス）
        const position = data[i][7];
        console.log(`生の役職データ (data[${i}][7]):`, {
          value: position,
          type: typeof position,
          length: position ? String(position).length : 0,
          charCodes: position ? Array.from(String(position)).map(c => c.charCodeAt(0)) : []
        });
        
        const normalizedPosition = (position === null || position === undefined || position === '') ? '' : String(position).trim();
        console.log(`正規化後の役職: "${normalizedPosition}"`);
        
        // Dateオブジェクトを文字列に変換
        const createdAt = data[i][8];  // 登録日時
        const updatedAt = data[i][9];   // 更新日時
        
        const visitor = {
          companyId: data[i][0],        // 会社ID
          companyName: data[i][1],      // 会社名
          visitorId: data[i][2],        // visitor_id
          visitorName: data[i][3],      // 氏名
          lineId: data[i][4] || '',     // LINE_ID（5番目の列）
          memberType: data[i][5] || 'サブ会員',  // 会員種別
          isPublic: data[i][6],         // 公開設定
          position: normalizedPosition,  // 役職（正規化済み）
          gender: '',                    // genderは会社別来院者管理シートには存在しないため空文字
          createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
          updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
          // LINE連携情報を追加（10番目以降の列）
          expireTime: data[i][10] || '',      // 有効期限
          isUsed: data[i][11] || false,       // 使用済み
          lineDisplayName: data[i][12] || '', // LINE表示名
          linkedAt: data[i][13] || '',        // 紐付け日時
          url: data[i][14] || '',             // URL
          linkStatus: data[i][15] || '',      // 連携ステータス
          linkUrl: data[i][16] || ''          // LINE連携用URLリンク
        };
        
        visitors.push(visitor);
        
        console.log(`作成したvisitorオブジェクト:`, visitor);
      }
    }
    
    console.log(`=== getCompanyVisitors終了 - 取得件数: ${visitors.length} ===`);
    return visitors;
    } catch (error) {
      console.error('getCompanyVisitorsでエラーが発生:', error);
      console.error('エラースタック:', error.stack);
      return [];
    }
  }
  
  /**
   * 役職制限をチェック
   */
  checkPositionLimits(companyId, position, excludeVisitorId = null) {
    const existing = this.getCompanyVisitors(companyId);
    
    if (position === '社長') {
      const presidents = existing.filter(v => v.position === '社長' && v.visitorId !== excludeVisitorId);
      return {
        canAssign: true, // 社長は既存を自動で変更するため常にtrue
        existing: presidents,
        message: presidents.length > 0 ? `既存の社長（${presidents[0].visitorName}）がサブ会員に変更されます` : null
      };
    }
    
    if (position === '秘書') {
      const secretaries = existing.filter(v => v.position === '秘書' && v.visitorId !== excludeVisitorId);
      return {
        canAssign: secretaries.length === 0,
        existing: secretaries,
        message: secretaries.length > 0 ? `秘書は既に設定済みです（${secretaries[0].visitorName}）` : null
      };
    }
    
    return { canAssign: true, existing: [], message: null };
  }

  /**
   * 会社に来院者を追加
   */
  addVisitorToCompany(companyId, companyName, visitorData) {
    if (!this.sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    // 役職制限チェック
    if (visitorData.position) {
      const limitCheck = this.checkPositionLimits(companyId, visitorData.position, visitorData.visitorId);
      if (!limitCheck.canAssign) {
        return {
          success: false,
          error: limitCheck.message
        };
      }
    }
    
    // 重複チェック
    const existing = this.getCompanyVisitors(companyId);
    const existingVisitor = existing.find(v => v.visitorId === visitorData.visitorId);
    
    if (existingVisitor) {
      // 既存データがある場合は更新処理
      return this.updateCompanyVisitor(companyId, visitorData.visitorId, visitorData);
    }
    
    // 来院者名を取得
    const visitorName = this._getVisitorName(visitorData.visitorId);
    
    // 現在日時
    const now = new Date();
    
    // データを準備
    const rowData = [
      companyId,
      companyName,
      visitorData.visitorId,
      visitorName,
      visitorData.gender || '',
      visitorData.lineId || '',
      visitorData.memberType || 'サブ会員',
      visitorData.isPublic !== false,
      visitorData.position || '',
      now,
      now
    ];
    
    // シートに追加
    this.sheet.appendRow(rowData);
    
    return {
      success: true,
      message: '来院者を会社に追加しました'
    };
  }
  
  /**
   * 会社の来院者情報を更新
   */
  updateCompanyVisitor(companyId, visitorId, updateData) {
    if (!this.sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    const data = this.sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === companyId && data[i][2] === visitorId) {
        // 更新可能なフィールドを更新
        if (updateData.memberType !== undefined) {
          this.sheet.getRange(i + 1, 7).setValue(updateData.memberType);
        }
        if (updateData.isPublic !== undefined) {
          this.sheet.getRange(i + 1, 8).setValue(updateData.isPublic);
        }
        if (updateData.position !== undefined) {
          this.sheet.getRange(i + 1, 9).setValue(updateData.position);
        }
        if (updateData.lineId !== undefined) {
          this.sheet.getRange(i + 1, 6).setValue(updateData.lineId);
        }
        if (updateData.gender !== undefined) {
          this.sheet.getRange(i + 1, 5).setValue(updateData.gender);
        }
        
        // 更新日時を更新
        this.sheet.getRange(i + 1, 11).setValue(new Date());
        
        return {
          success: true,
          message: '来院者情報を更新しました'
        };
      }
    }
    
    throw new Error('指定された来院者が見つかりません');
  }
  
  /**
   * 会社から来院者を削除
   */
  removeVisitorFromCompany(companyId, visitorId) {
    if (!this.sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    const data = this.sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === companyId && data[i][2] === visitorId) {
        this.sheet.deleteRow(i + 1);
        return {
          success: true,
          message: '来院者を会社から削除しました'
        };
      }
    }
    
    throw new Error('指定された来院者が見つかりません');
  }
  
  /**
   * 会社の代表者（本会員）を取得
   */
  getCompanyRepresentative(companyId) {
    const visitors = this.getCompanyVisitors(companyId);
    return visitors.find(v => v.memberType === '本会員') || null;
  }
  
  /**
   * 会社の代表者を設定（既存の本会員はサブ会員に変更）
   */
  setCompanyRepresentative(companyId, visitorId) {
    if (!this.sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    const data = this.sheet.getDataRange().getValues();
    
    // まず、既存の本会員をサブ会員に変更し、役職も削除
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === companyId && data[i][6] === '本会員') {
        this.sheet.getRange(i + 1, 7).setValue('サブ会員');
        this.sheet.getRange(i + 1, 9).setValue(''); // 役職を削除（I列）
        this.sheet.getRange(i + 1, 11).setValue(new Date());
      }
    }
    
    // 指定された来院者を本会員に設定
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === companyId && data[i][2] === visitorId) {
        this.sheet.getRange(i + 1, 7).setValue('本会員');
        this.sheet.getRange(i + 1, 9).setValue('社長'); // 役職を社長に設定
        this.sheet.getRange(i + 1, 11).setValue(new Date());
        
        return {
          success: true,
          message: '代表者を設定しました'
        };
      }
    }
    
    throw new Error('指定された来院者が見つかりません');
  }
  
  /**
   * 会社の秘書を設定
   */
  setCompanySecretary(companyId, visitorId) {
    if (!this.sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }
    
    // 秘書制限チェック
    const limitCheck = this.checkPositionLimits(companyId, '秘書', visitorId);
    if (!limitCheck.canAssign) {
      return {
        success: false,
        error: limitCheck.message
      };
    }
    
    const data = this.sheet.getDataRange().getValues();
    
    // 指定された来院者を秘書に設定
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === companyId && data[i][2] === visitorId) {
        this.sheet.getRange(i + 1, 7).setValue('サブ会員'); // 会員種別
        this.sheet.getRange(i + 1, 9).setValue('秘書'); // 役職を秘書に設定
        this.sheet.getRange(i + 1, 11).setValue(new Date()); // 更新日時
        
        return {
          success: true,
          message: '秘書を設定しました'
        };
      }
    }
    
    throw new Error('指定された来院者が見つかりません');
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
   * 全ての来院者を取得（会社への追加用）
   */
  getAllVisitorsForCompany() {
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
          name_kana: data[i][2] || '',
          phone: data[i][10] || '',
          email: data[i][11] || ''
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
   * 新規来院者を作成
   */
  createNewVisitor(visitorData) {
    const visitorService = new VisitorService();
    return visitorService.createVisitor(visitorData);
  }

  /**
   * 一括変更を処理（通信回数を削減）
   */
  batchUpdateCompanyVisitors(companyId, changes) {
    console.log(`=== batchUpdateCompanyVisitors開始 - 会社ID: ${companyId} ===`);
    
    if (!this.sheet) {
      throw new Error('会社別来院者管理シートが見つかりません');
    }

    try {
      // 現在のデータを取得
      const data = this.sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      // 更新用のデータ配列を準備（既存データのコピー）
      const updatedData = rows.slice();
      
      // 変更を適用
      changes.forEach(change => {
        console.log(`処理中の変更: ${change.action}`, change.data);
        
        switch (change.action) {
          case 'add':
            // 同じ来院者の既存データをまず削除
            const existingIndex = updatedData.findIndex(row => 
              row[0] === companyId && row[2] === change.data.visitorId
            );
            if (existingIndex !== -1) {
              console.log(`既存データを削除: ${change.data.visitorId}`);
              updatedData.splice(existingIndex, 1);
            }
            
            // 新規追加
            const newRow = this._createNewRow(companyId, change.data);
            updatedData.push(newRow);
            console.log(`新規データを追加: ${change.data.visitorId} - ${change.data.position}`);
            break;
            
          case 'update':
            // 既存レコードの更新
            const updateIndex = updatedData.findIndex(row => 
              row[0] === companyId && row[2] === change.data.visitorId
            );
            if (updateIndex !== -1) {
              updatedData[updateIndex] = this._updateRow(updatedData[updateIndex], change.data);
              console.log(`データを更新: ${change.data.visitorId}`);
            } else {
              console.warn(`更新対象が見つかりません: ${change.data.visitorId}`);
            }
            break;
            
          case 'remove':
            // 削除（フィルタリングで除外）
            const removeIndex = updatedData.findIndex(row => 
              row[0] === companyId && row[2] === change.data.visitorId
            );
            if (removeIndex !== -1) {
              updatedData.splice(removeIndex, 1);
              console.log(`データを削除: ${change.data.visitorId}`);
            } else {
              console.warn(`削除対象が見つかりません: ${change.data.visitorId}`);
            }
            break;
        }
      });
      
      // ヘッダーを含めた全データを準備
      const finalData = [headers, ...updatedData];
      
      // シートをクリアして一括更新
      this.sheet.clear();
      if (finalData.length > 0) {
        const range = this.sheet.getRange(1, 1, finalData.length, finalData[0].length);
        range.setValues(finalData);
      }
      
      console.log(`=== batchUpdateCompanyVisitors完了 - ${changes.length}件の変更を適用 ===`);
      
      // キャッシュを無効化
      if (typeof companyCacheService !== 'undefined') {
        companyCacheService.invalidateCompanyCache(companyId);
        companyCacheService.invalidatePatientNamesCache();
      }
      
      return { success: true, message: `${changes.length}件の変更を保存しました` };
      
    } catch (error) {
      console.error('バッチ更新エラー:', error);
      throw error;
    }
  }

  /**
   * 新規行データを作成（プライベートメソッド）
   */
  _createNewRow(companyId, data) {
    const companyName = this._getCompanyName(companyId);
    const now = new Date();
    
    return [
      companyId,                          // 会社ID
      companyName,                        // 会社名
      data.visitorId,                     // 来院者ID
      data.visitorName || '',             // 来院者名
      data.gender || '',                  // 性別
      data.lineId || '',                  // LINE ID
      data.memberType || 'サブ会員',      // 会員種別
      data.isPublic !== false,            // 公開フラグ
      data.position || '',                // 役職
      now,                                // 作成日時
      now,                                // 更新日時
      '',                                 // 有効期限
      '',                                 // 使用済み
      '',                                 // LINE表示名
      '',                                 // 紐付け日時
      '',                                 // URL
      '',                                 // 連携ステータス
      ''                                  // LINE連携用URLリンク
    ];
  }

  /**
   * 既存行データを更新（プライベートメソッド）
   */
  _updateRow(existingRow, data) {
    const updatedRow = existingRow.slice();
    const now = new Date();
    
    // 更新可能なフィールドのみ更新
    if (data.gender !== undefined) updatedRow[4] = data.gender;
    if (data.memberType !== undefined) updatedRow[6] = data.memberType;
    if (data.isPublic !== undefined) updatedRow[7] = data.isPublic;
    if (data.position !== undefined) updatedRow[8] = data.position;
    updatedRow[10] = now; // 更新日時
    
    return updatedRow;
  }

  /**
   * 会社名を取得（プライベートメソッド）
   */
  _getCompanyName(companyId) {
    try {
      // 会社マスタシートから会社名を取得
      const companySheet = this.spreadsheet.getSheetByName(Config.getSheetNames().companyMaster);
      if (companySheet) {
        const companyData = companySheet.getDataRange().getValues();
        for (let i = 1; i < companyData.length; i++) {
          if (companyData[i][0] === companyId) {
            return companyData[i][1];
          }
        }
      }
    } catch (error) {
      console.error('会社名取得エラー:', error);
    }
    return '';
  }
}