/**
 * 会社別来院者管理シートでのLINE連携リンク管理サービス
 * 
 * 機能:
 * - LINE_IDが空白の来院者に対するリンク自動生成
 * - 毎朝7時の自動実行
 * - リンクの有効期限管理
 * - ステータス管理とログ記録
 */

class CompanyLineLinkService {
  constructor() {
    this.sheetName = Config.getSheetNames().companyVisitors;
    this.logSheetName = Config.getSheetNames().logs;
    this.sheet = SpreadsheetApp.openById(Config.getSpreadsheetId()).getSheetByName(this.sheetName);
    this.logSheet = SpreadsheetApp.openById(Config.getSpreadsheetId()).getSheetByName(this.logSheetName);
    
    // シートの存在確認ログ
    if (!this.sheet) {
      Logger.log(`エラー: ${this.sheetName}シートが見つかりません`);
    } else {
      Logger.log(`${this.sheetName}シートを正常に取得`);
    }
    
    // 列インデックス定義（0ベース）
    this.columns = {
      companyId: 0,      // A列: 会社ID
      companyName: 1,    // B列: 会社名
      visitorId: 2,      // C列: visitor_id
      visitorName: 3,    // D列: 氏名
      lineId: 4,         // E列: LINE_ID
      memberType: 5,     // F列: 会員種別
      publicSetting: 6,  // G列: 公開設定
      position: 7,       // H列: 役職
      createdAt: 8,      // I列: 登録日時
      updatedAt: 9,      // J列: 更新日時
      expireTime: 10,    // K列: 有効期限
      isUsed: 11,        // L列: 使用済み
      lineDisplayName: 12, // M列: LINE表示名
      linkedAt: 13,      // N列: 紐付け日時
      status: 14,        // O列: ステータス
      linkCreatedAt: 15, // P列: 作成日時
      linkUrl: 16        // Q列: リンクURL
    };
  }

  /**
   * 毎朝7時に実行: LINE_IDが空白の来院者にリンク生成
   * @return {Object} 実行結果
   */
  async generateLinksForCompanyVisitors() {
    return Utils.executeWithErrorHandlingAsync(async () => {
      this.logExecution('AUTO_GENERATION', null, null, 'START', '自動リンク生成開始');
      
      const results = {
        processed: 0,
        generated: 0,
        skipped: 0,
        errors: 0,
        details: []
      };

      try {
        // シートの初期化を確認
        SpreadsheetManager.initializeCompanyVisitorsSheet();
        
        // データの取得
        const data = this.sheet.getDataRange().getValues();
        if (data.length <= 1) {
          this.logExecution('AUTO_GENERATION', null, null, 'INFO', 'データなし');
          return results;
        }

        // バッチ更新用の配列
        const updateBatch = [];

        // ヘッダー行を除いてデータを処理
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          results.processed++;

          try {
            // LINE_IDが空白かチェック
            if (row[this.columns.lineId] && row[this.columns.lineId].trim() !== '') {
              results.skipped++;
              continue;
            }

            const visitorId = row[this.columns.visitorId];
            const visitorName = row[this.columns.visitorName];

            if (!visitorId) {
              this.logExecution('AUTO_GENERATION', null, null, 'ERROR', `visitor_id不正: 行${i + 1}`);
              results.errors++;
              continue;
            }

            // 既存リンクの有効期限チェック
            const existingExpire = row[this.columns.expireTime];
            if (existingExpire && new Date(existingExpire) > new Date()) {
              results.skipped++;
              results.details.push(`${visitorName}: 有効なリンク存在`);
              continue;
            }

            // 新規リンク生成（書き込みはしない）
            const linkResult = await this.generateLinkForVisitor(visitorId, i + 1);
            if (linkResult.success) {
              results.generated++;
              results.details.push(`${visitorName}: リンク生成成功`);
              
              // バッチ更新用データを追加
              updateBatch.push({
                rowIndex: i + 1,
                data: {
                  expireTime: linkResult.expireTime,
                  isUsed: false,
                  status: 'リンク発行済み',
                  linkCreatedAt: new Date(),
                  linkUrl: linkResult.linkUrl
                }
              });
            } else {
              results.errors++;
              results.details.push(`${visitorName}: ${linkResult.error}`);
            }

          } catch (error) {
            results.errors++;
            this.logExecution('AUTO_GENERATION', null, row[this.columns.visitorId], 'ERROR', 
              `行${i + 1}処理エラー: ${error.toString()}`);
          }
        }

        // バッチで一括更新
        if (updateBatch.length > 0) {
          this.batchUpdateLinkData(updateBatch);
          Logger.log(`バッチ更新: ${updateBatch.length}件のリンクデータを一括更新`);
        }

        this.logExecution('AUTO_GENERATION', null, null, 'COMPLETE', 
          `完了: 処理${results.processed}, 生成${results.generated}, スキップ${results.skipped}, エラー${results.errors}`);

        return results;

      } catch (error) {
        this.logExecution('AUTO_GENERATION', null, null, 'ERROR', 
          `自動生成処理エラー: ${error.toString()}`);
        throw error;
      }
    }, 'CompanyLineLinkService.generateLinksForCompanyVisitors');
  }

  /**
   * 個別の来院者にLINEリンクを生成
   * @param {string} visitorId - visitor_id
   * @param {number} rowIndex - シートの行番号（1ベース）※バッチ処理時は使用しない
   * @return {Object} 生成結果（更新データを含む）
   */
  async generateLinkForVisitor(visitorId, rowIndex) {
    return Utils.executeWithErrorHandlingAsync(async () => {
      // 既存のLineMemberLinkServiceを使用してトークン生成
      const lineLinkService = new LineMemberLinkService();
      const token = lineLinkService.generateMemberLinkToken(visitorId);

      if (!token) {
        return { success: false, error: 'トークン生成失敗' };
      }

      // 有効期限を翌日午前7時に設定
      const expireTime = this.getNextMorning7AM();
      
      // リンクURL生成
      const linkUrl = lineLinkService.generateMemberLinkUrl(token);

      this.logExecution('GENERATE_LINK', null, visitorId, 'SUCCESS', 
        `リンク生成: ${linkUrl}`);

      // 更新データを返す（バッチ処理対応）
      return { 
        success: true, 
        token: token,
        linkUrl: linkUrl,
        expireTime: expireTime
      };
    }, `generateLinkForVisitor(${visitorId})`);
  }

  /**
   * リンク情報をシートに更新
   * @param {number} rowIndex - 行番号（1ベース）
   * @param {Object} data - 更新データ
   */
  updateLinkInfo(rowIndex, data) {
    try {
      if (data.expireTime !== undefined) {
        this.sheet.getRange(rowIndex, this.columns.expireTime + 1).setValue(data.expireTime);
      }
      if (data.isUsed !== undefined) {
        this.sheet.getRange(rowIndex, this.columns.isUsed + 1).setValue(data.isUsed);
      }
      if (data.lineDisplayName !== undefined) {
        this.sheet.getRange(rowIndex, this.columns.lineDisplayName + 1).setValue(data.lineDisplayName);
      }
      if (data.linkedAt !== undefined) {
        this.sheet.getRange(rowIndex, this.columns.linkedAt + 1).setValue(data.linkedAt);
      }
      if (data.status !== undefined) {
        this.sheet.getRange(rowIndex, this.columns.status + 1).setValue(data.status);
      }
      if (data.linkCreatedAt !== undefined) {
        this.sheet.getRange(rowIndex, this.columns.linkCreatedAt + 1).setValue(data.linkCreatedAt);
      }

      // 更新日時も更新
      this.sheet.getRange(rowIndex, this.columns.updatedAt + 1).setValue(new Date());

    } catch (error) {
      Logger.log(`updateLinkInfo エラー: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * LINE連携完了時の更新処理（CompanyVisitorsService内で呼び出し）
   * @param {string} visitorId - visitor_id
   * @param {string} lineId - LINE ID
   * @param {string} lineDisplayName - LINE表示名
   */
  updateLinkedInfo(visitorId, lineId, lineDisplayName) {
    try {
      Logger.log(`=== updateLinkedInfo開始 ===`);
      Logger.log(`入力パラメータ - visitorId: "${visitorId}", lineId: "${lineId}", displayName: "${lineDisplayName}"`);
      
      // visitor_idで該当行を検索
      const data = this.sheet.getDataRange().getValues();
      Logger.log(`シートデータ行数: ${data.length}`);
      
      let found = false;
      for (let i = 1; i < data.length; i++) {
        const sheetVisitorId = data[i][this.columns.visitorId];
        Logger.log(`行${i + 1}: シートのvisitor_id="${sheetVisitorId}" vs 検索対象="${visitorId}"`);
        
        // 型変換して比較（文字列として比較）
        if (String(sheetVisitorId).trim() === String(visitorId).trim()) {
          Logger.log(`一致する行を発見: 行${i + 1}`);
          found = true;
          
          this.updateLinkInfo(i + 1, {
            isUsed: true,
            lineDisplayName: lineDisplayName,
            linkedAt: new Date(),
            status: '連携完了'
          });

          // LINE_IDも更新
          this.sheet.getRange(i + 1, this.columns.lineId + 1).setValue(lineId);
          Logger.log(`LINE_ID更新完了: 行${i + 1}, 列${this.columns.lineId + 1}`);

          this.logExecution('LINK_COMPLETE', null, visitorId, 'SUCCESS', 
            `LINE連携完了: ${lineDisplayName}`);
          break;
        }
      }
      
      if (!found) {
        Logger.log(`警告: visitor_id "${visitorId}" がシートに見つかりません`);
        this.logExecution('LINK_COMPLETE', null, visitorId, 'WARNING', 
          `visitor_idがシートに見つかりません: ${visitorId}`);
      }

    } catch (error) {
      this.logExecution('LINK_COMPLETE', null, visitorId, 'ERROR', 
        `連携完了更新エラー: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * リンク情報をバッチで更新（高速化）
   * @param {Array} updates - 更新データの配列
   * [{rowIndex: number, data: {expireTime, isUsed, status, linkCreatedAt, linkUrl}}]
   */
  batchUpdateLinkData(updates) {
    try {
      if (!updates || updates.length === 0) {
        return;
      }
      
      // 最大行番号を取得
      const maxRow = Math.max(...updates.map(u => u.rowIndex));
      const lastRow = this.sheet.getLastRow();
      
      if (maxRow > lastRow) {
        Logger.log(`警告: 更新対象行 ${maxRow} がシートの最終行 ${lastRow} を超えています`);
        return;
      }
      
      // 更新する列ごとにデータを準備
      const columnsToUpdate = {
        expireTime: { col: this.columns.expireTime + 1, values: [] },
        isUsed: { col: this.columns.isUsed + 1, values: [] },
        status: { col: this.columns.status + 1, values: [] },
        linkCreatedAt: { col: this.columns.linkCreatedAt + 1, values: [] },
        linkUrl: { col: this.columns.linkUrl + 1, values: [] },
        updatedAt: { col: this.columns.updatedAt + 1, values: [] }
      };
      
      // 行番号でソート
      updates.sort((a, b) => a.rowIndex - b.rowIndex);
      
      // 連続した範囲ごとにグループ化して更新
      let rangeStart = updates[0].rowIndex;
      let rangeData = {
        expireTime: [],
        isUsed: [],
        status: [],
        linkCreatedAt: [],
        linkUrl: [],
        updatedAt: []
      };
      
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        const expectedRow = rangeStart + rangeData.expireTime.length;
        
        // 連続していない場合は、現在の範囲を書き込み
        if (update.rowIndex !== expectedRow) {
          this._writeRangeData(rangeStart, rangeData);
          
          // 新しい範囲を開始
          rangeStart = update.rowIndex;
          rangeData = {
            expireTime: [],
            isUsed: [],
            status: [],
            linkCreatedAt: [],
            linkUrl: [],
            updatedAt: []
          };
        }
        
        // データを追加
        rangeData.expireTime.push([update.data.expireTime || '']);
        rangeData.isUsed.push([update.data.isUsed || false]);
        rangeData.status.push([update.data.status || '']);
        rangeData.linkCreatedAt.push([update.data.linkCreatedAt || '']);
        rangeData.linkUrl.push([update.data.linkUrl || '']);
        rangeData.updatedAt.push([new Date()]);
      }
      
      // 最後の範囲を書き込み
      if (rangeData.expireTime.length > 0) {
        this._writeRangeData(rangeStart, rangeData);
      }
      
      Logger.log(`バッチ更新完了: ${updates.length}件`);
      
    } catch (error) {
      Logger.log(`batchUpdateLinkData エラー: ${error.toString()}`);
      throw error;
    }
  }
  
  /**
   * 範囲データを書き込み（ヘルパー関数）
   */
  _writeRangeData(startRow, rangeData) {
    const numRows = rangeData.expireTime.length;
    if (numRows === 0) return;
    
    // 各列を更新
    const columnsToUpdate = [
      { col: this.columns.expireTime + 1, data: rangeData.expireTime },
      { col: this.columns.isUsed + 1, data: rangeData.isUsed },
      { col: this.columns.status + 1, data: rangeData.status },
      { col: this.columns.linkCreatedAt + 1, data: rangeData.linkCreatedAt },
      { col: this.columns.linkUrl + 1, data: rangeData.linkUrl },
      { col: this.columns.updatedAt + 1, data: rangeData.updatedAt }
    ];
    
    columnsToUpdate.forEach(column => {
      if (column.data.some(row => row[0] !== '' && row[0] !== null && row[0] !== undefined)) {
        const range = this.sheet.getRange(startRow, column.col, numRows, 1);
        range.setValues(column.data);
      }
    });
  }

  /**
   * 会社の有効なリンク一覧を取得（UI用）
   * @param {string} companyId - 会社ID
   * @return {Array} リンク情報の配列
   */
  getActiveLinksForCompany(companyId) {
    try {
      const data = this.sheet.getDataRange().getValues();
      const now = new Date();
      const activeLinks = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        // 会社IDが一致し、LINE_IDが空白の行
        if (row[this.columns.companyId] === companyId && 
            (!row[this.columns.lineId] || row[this.columns.lineId].trim() === '')) {
          
          const expireTime = row[this.columns.expireTime];
          const status = row[this.columns.status];
          const linkUrl = row[this.columns.linkUrl];
          
          // 有効期限内かつリンク発行済みかつURLが存在する場合
          if (expireTime && new Date(expireTime) > now && status === 'リンク発行済み' && linkUrl) {
            activeLinks.push({
              visitorId: row[this.columns.visitorId],
              visitorName: row[this.columns.visitorName],
              linkUrl: linkUrl,  // Q列から直接取得
              expireTime: expireTime,
              status: status,
              createdAt: row[this.columns.linkCreatedAt]
            });
          }
        }
      }

      Logger.log(`会社ID ${companyId} の有効リンク: ${activeLinks.length}件`);
      return activeLinks;

    } catch (error) {
      this.logExecution('GET_ACTIVE_LINKS', companyId, null, 'ERROR', 
        `アクティブリンク取得エラー: ${error.toString()}`);
      throw error;
    }
  }

  /**
   * 翌日午前7時の日時を取得
   * @return {Date} 翌日午前7時
   */
  getNextMorning7AM() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);
    return tomorrow;
  }

  /**
   * 実行ログの記録
   * @param {string} type - 処理種別
   * @param {string} companyId - 会社ID
   * @param {string} visitorId - visitor_id
   * @param {string} status - ステータス
   * @param {string} details - 詳細
   */
  logExecution(type, companyId, visitorId, status, details) {
    try {
      if (!this.logSheet) {
        Logger.log(`ログシートが見つかりません: ${details}`);
        return;
      }

      const logData = [
        new Date(),
        'CompanyLineLinkService',
        type,
        companyId || '',
        visitorId || '',
        status,
        details
      ];

      this.logSheet.appendRow(logData);

    } catch (error) {
      Logger.log(`ログ記録エラー: ${error.toString()} - ${details}`);
    }
  }

  /**
   * 期限切れリンクのクリーンアップ
   * @return {number} クリーンアップした件数
   */
  cleanupExpiredLinks() {
    try {
      this.logExecution('CLEANUP', null, null, 'START', '期限切れリンククリーンアップ開始');
      
      const data = this.sheet.getDataRange().getValues();
      const now = new Date();
      let cleanupCount = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const expireTime = row[this.columns.expireTime];
        const status = row[this.columns.status];

        // 有効期限が過ぎていてリンク発行済みの場合
        if (expireTime && new Date(expireTime) <= now && status === 'リンク発行済み') {
          this.updateLinkInfo(i + 1, {
            status: '期限切れ'
          });
          cleanupCount++;
        }
      }

      this.logExecution('CLEANUP', null, null, 'COMPLETE', 
        `期限切れリンククリーンアップ完了: ${cleanupCount}件`);

      return cleanupCount;

    } catch (error) {
      this.logExecution('CLEANUP', null, null, 'ERROR', 
        `クリーンアップエラー: ${error.toString()}`);
      throw error;
    }
  }
}