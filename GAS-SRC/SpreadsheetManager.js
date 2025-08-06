/**
 * スプレッドシート管理クラス
 */
class SpreadsheetManager {
  /**
   * 初期設定シートを作成
   */
  static initializeConfigSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().config);
    Utils.clearSheet(sheet, false);
    
    // ヘッダー設定
    const headers = ['設定項目', '値', '説明'];
    Utils.setHeaders(sheet, headers);
    
    // 設定項目を追加
    const configData = [
      ['API_BASE_URL', 'https://api.medical-force.com', 'Medical Force APIのベースURL'],
      ['CLINIC_ID', '', 'クリニックID（必須）'],
      ['API_KEY', '', 'APIキー（必須）- スクリプトプロパティに設定してください'],
      ['AUTO_SYNC_ENABLED', 'FALSE', '自動同期の有効/無効'],
      ['SYNC_INTERVAL_HOURS', '1', '同期間隔（時間）'],
      ['MAX_RECORDS_PER_SYNC', '100', '1回の同期で取得する最大レコード数'],
      ['LOG_RETENTION_DAYS', '30', 'ログ保持期間（日）']
    ];
    
    Utils.writeDataToSheet(sheet, configData);
    
    // 注意事項を追加
    const lastRow = sheet.getLastRow() + 2;
    sheet.getRange(lastRow, 1, 1, 3).merge();
    sheet.getRange(lastRow, 1).setValue('【重要】APIキーはスクリプトプロパティに設定してください（セキュリティのため）');
    sheet.getRange(lastRow, 1).setFontColor('#ff0000');
    
    return sheet;
  }
  
  /**
   * 患者マスタシートを初期化
   */
  static initializeVisitorsSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().visitors);
    
    const headers = [
      'visitor_id',
      '氏名',
      'カナ',
      '姓',
      '名',
      '姓カナ',
      '名カナ',
      '生年月日',
      '年齢',
      '性別',
      '電話番号',
      'メールアドレス',
      '郵便番号',
      '住所',
      '初診日',
      '最終来院日',
      'カルテ番号',
      '患者コード',
      'メモ',
      'アレルギー',
      '既往歴',
      '注意事項',
      'メール配信希望',
      '来院経路',
      '来院経路ラベル',
      '招待コード',
      'タグ',
      'LINE_ID',
      'LINE表示名',
      'LINEプロフィール画像URL',
      'api_collaborator_id',
      'api_collaborator_customer_id',
      '本人確認済み',
      '削除日時',
      '登録日時',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * 予約管理シートを初期化
   */
  static initializeReservationsSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().reservations);
    
    const headers = [
      'reservation_id',
      'patient_id',
      '患者名',
      '患者属性',
      'visitor_id',
      '予約者',
      '予約日',
      '予約時間',
      '終了時間',
      'メニュー',
      '担当スタッフ',
      'ステータス',
      'メモ',
      '作成日時',
      '更新日時',
      '会社ID',
      '会社名',
      '会員種別',
      '公開設定',
      '部屋ID',
      '部屋名'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  
  /**
   * メニュー管理シートを初期化
   */
  static initializeMenusSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().menus);
    
    const headers = [
      'menu_id',
      'メニュー名',
      'カテゴリ',
      'カテゴリID',
      '表示順',
      '所要時間（分）',
      '料金',
      '税込料金',
      '有効フラグ',
      'オンライン予約可',
      '説明',
      '作成日時',
      '更新日時',
      'チケットタイプ'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // 既存データにチケットタイプ列がない場合は追加
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existingHeaders.length > 0 && existingHeaders.indexOf('チケットタイプ') === -1) {
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue('チケットタイプ');
    }
    
    return sheet;
  }
  
  /**
   * ログシートを初期化
   */
  static initializeLogsSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().logs);
    
    const headers = [
      '実行日時',
      'ステータス',
      'メッセージ',
      '詳細'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * 会社別来院者管理シートを初期化
   */
  static initializeCompanyVisitorsSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().companyVisitors);
    
    // 既存データがある場合は構造を更新
    if (sheet.getLastRow() === 0) {
      // 新規作成の場合
      const headers = [
        '会社ID',
        '会社名',
        'visitor_id',
        '氏名',
        'LINE_ID',
        '会員種別',
        '公開設定',
        '役職',
        '登録日時',
        '更新日時',
        '有効期限',
        '使用済み',
        'LINE表示名',
        '紐付け日時',
        'URL',
        '連携ステータス',
        'LINE連携用URLリンク',
        'ステータス',
        '作成日時',
        'リンクURL'
      ];
      
      Utils.setHeaders(sheet, headers);
    } else {
      // 既存シートの場合、ヘッダーを確認して必要なカラムを追加
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newHeaders = [
        '会社ID',
        '会社名',
        'visitor_id',
        '氏名',
        'LINE_ID',
        '会員種別',
        '公開設定',
        '役職',
        '登録日時',
        '更新日時',
        '有効期限',
        '使用済み',
        'LINE表示名',
        '紐付け日時',
        'URL',
        '連携ステータス',
        'LINE連携用URLリンク',
        'ステータス',
        '作成日時',
        'リンクURL'
      ];
      
      // 既存の「本会員フラグ」カラムを「会員種別」に変換
      const flagIndex = currentHeaders.indexOf('本会員フラグ');
      if (flagIndex !== -1) {
        // ヘッダーを更新
        sheet.getRange(1, flagIndex + 1).setValue('会員種別');
        
        // データを変換（TRUE → '本会員', FALSE → 'サブ会員'）
        if (sheet.getLastRow() > 1) {
          const dataRange = sheet.getRange(2, flagIndex + 1, sheet.getLastRow() - 1, 1);
          const values = dataRange.getValues();
          const convertedValues = values.map(row => {
            if (row[0] === true || row[0] === 'TRUE' || row[0] === 'main') {
              return ['main'];
            } else {
              return ['sub'];
            }
          });
          dataRange.setValues(convertedValues);
        }
      }
      
      // 新しいヘッダーとの差分をチェックして列を追加
      const missingHeaders = newHeaders.filter(header => !currentHeaders.includes(header));
      if (missingHeaders.length > 0) {
        const lastCol = sheet.getLastColumn();
        // 不足している列を末尾に追加
        for (let i = 0; i < missingHeaders.length; i++) {
          sheet.getRange(1, lastCol + 1 + i).setValue(missingHeaders[i]);
        }
      }
      
      // 役職カラムが存在しない場合は追加（互換性のため）
      if (!currentHeaders.includes('役職') && !missingHeaders.includes('役職')) {
        const lastCol = sheet.getLastColumn();
        // 公開設定の後に役職カラムを挿入
        const publicIndex = currentHeaders.indexOf('公開設定');
        if (publicIndex !== -1) {
          sheet.insertColumnAfter(publicIndex + 1);
          sheet.getRange(1, publicIndex + 2).setValue('役職');
        }
      }
      
      // ヘッダーのスタイルを再適用
      const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
    }
    
    return sheet;
  }
  
  /**
   * 施術間隔定義シートを初期化（マトリクス形式）
   */
  static initializeTreatmentIntervalSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().treatmentInterval);
    Utils.clearSheet(sheet, false);
    
    // メニューサービスからメニュー一覧を取得
    const menuService = new MenuService();
    const menus = menuService.getMenusFromSheet();
    
    if (menus.length === 0) {
      // メニューがない場合は基本的なヘッダーのみ設定
      sheet.getRange(1, 1).setValue('施術間隔マトリクス');
      sheet.getRange(2, 1).setValue('メニューを同期してから再度初期化してください');
      return sheet;
    }
    
    // メニュー名のリストを作成
    const menuNames = menus.map(menu => menu.name);
    
    // ヘッダー行の設定（左上セルは「施術＼後」）
    sheet.getRange(1, 1).setValue('施術＼後');
    for (let i = 0; i < menuNames.length; i++) {
      sheet.getRange(1, i + 2).setValue(menuNames[i]);
    }
    
    // 左側の列（縦軸）にメニュー名を設定
    for (let i = 0; i < menuNames.length; i++) {
      sheet.getRange(i + 2, 1).setValue(menuNames[i]);
    }
    
    // 対角線（同じ施術同士）を0で初期化
    for (let i = 0; i < menuNames.length; i++) {
      sheet.getRange(i + 2, i + 2).setValue(0);
      sheet.getRange(i + 2, i + 2).setBackground('#f0f0f0'); // 薄いグレーで着色
    }
    
    // ヘッダー行・列のスタイル設定
    const headerRange = sheet.getRange(1, 1, 1, menuNames.length + 1);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#e0e0e0');
    headerRange.setHorizontalAlignment('center');
    
    const sideHeaderRange = sheet.getRange(2, 1, menuNames.length, 1);
    sideHeaderRange.setFontWeight('bold');
    sideHeaderRange.setBackground('#e0e0e0');
    
    // データ入力範囲に入力規則を設定（0以上365以下の整数）
    const dataRange = sheet.getRange(2, 2, menuNames.length, menuNames.length);
    const rule = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(0, 365)
      .setAllowInvalid(true) // 空欄も許可
      .setHelpText('0〜365の数値を入力してください（空欄=制限なし）')
      .build();
    dataRange.setDataValidation(rule);
    
    // 条件付き書式の設定（365日以上を赤色で強調）
    const conditionalRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(365)
      .setBackground('#ffcccc')
      .setRanges([dataRange])
      .build();
    
    const rules = sheet.getConditionalFormatRules();
    rules.push(conditionalRule);
    sheet.setConditionalFormatRules(rules);
    
    // シート保護の設定
    this.protectTreatmentIntervalSheet(sheet, menuNames.length);
    
    return sheet;
  }
  
  /**
   * 施術間隔シートの保護設定
   */
  static protectTreatmentIntervalSheet(sheet, menuCount) {
    // 既存の保護を削除
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(p => p.remove());
    
    // ヘッダー行の保護
    const headerProtection = sheet.getRange(1, 1, 1, menuCount + 1).protect();
    headerProtection.setDescription('ヘッダー行（編集不可）');
    headerProtection.setWarningOnly(true);
    
    // 左側のヘッダー列の保護
    const sideProtection = sheet.getRange(2, 1, menuCount, 1).protect();
    sideProtection.setDescription('メニュー名列（編集不可）');
    sideProtection.setWarningOnly(true);
    
    // データ範囲外の保護（右側と下側）
    if (sheet.getMaxColumns() > menuCount + 1) {
      const rightProtection = sheet.getRange(1, menuCount + 2, sheet.getMaxRows(), sheet.getMaxColumns() - menuCount - 1).protect();
      rightProtection.setDescription('データ範囲外（編集不可）');
      rightProtection.setWarningOnly(true);
    }
    
    if (sheet.getMaxRows() > menuCount + 1) {
      const bottomProtection = sheet.getRange(menuCount + 2, 1, sheet.getMaxRows() - menuCount - 1, sheet.getMaxColumns()).protect();
      bottomProtection.setDescription('データ範囲外（編集不可）');
      bottomProtection.setWarningOnly(true);
    }
  }
  
  /**
   * 既存の施術間隔データをマトリクス形式に移行
   */
  static migrateTreatmentIntervalToMatrix() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().treatmentInterval);
      if (!sheet) {
        throw new Error('施術間隔定義シートが見つかりません');
      }
      
      // 既存データをバックアップ
      const backupSheetName = '施術間隔_バックアップ_' + Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss');
      sheet.copyTo(SpreadsheetApp.getActiveSpreadsheet()).setName(backupSheetName);
      Logger.log(`バックアップシートを作成しました: ${backupSheetName}`);
      
      // 既存データを読み取り
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
        const intervalData = [];
        
        // データを解析（既存フォーマット: メニューID, メニュー名, 施術タイプ, 必要間隔, 関連施術ID, 関連施術名...）
        data.forEach(row => {
          if (row[1] && row[5] && row[4]) { // メニュー名、関連施術名、必要間隔が存在する場合
            intervalData.push({
              fromMenu: row[1],  // メニュー名
              toMenu: row[5],    // 関連施術名
              interval: parseInt(row[4]) || 0  // 必要間隔（日数）
            });
          }
        });
        
        // マトリクス形式で再初期化
        this.initializeTreatmentIntervalSheet();
        
        // 既存データをマトリクスに適用
        if (intervalData.length > 0) {
          this.applyIntervalDataToMatrix(sheet, intervalData);
        }
      }
      
      return `施術間隔データをマトリクス形式に移行しました。バックアップ: ${backupSheetName}`;
    });
  }
  
  /**
   * 施術間隔データをマトリクスに適用
   */
  static applyIntervalDataToMatrix(sheet, intervalData) {
    // ヘッダー行からメニュー名のマッピングを作成
    const headerRow = sheet.getRange(1, 2, 1, sheet.getLastColumn() - 1).getValues()[0];
    const sideColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(row => row[0]);
    
    // メニュー名からインデックスへのマッピング
    const columnIndex = new Map();
    const rowIndex = new Map();
    
    headerRow.forEach((menuName, index) => {
      if (menuName) columnIndex.set(menuName, index + 2);
    });
    
    sideColumn.forEach((menuName, index) => {
      if (menuName) rowIndex.set(menuName, index + 2);
    });
    
    // データを適用
    intervalData.forEach(data => {
      const row = rowIndex.get(data.fromMenu);
      const col = columnIndex.get(data.toMenu);
      
      if (row && col) {
        sheet.getRange(row, col).setValue(data.interval);
      }
    });
  }
  
  /**
   * 施術間隔マトリクスを取得
   */
  static getTreatmentIntervalMatrix() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().treatmentInterval);
    if (!sheet || sheet.getLastRow() <= 1) {
      return new Map();
    }
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    // ヘッダー行とサイド列を読み取り
    const headerRow = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
    const sideColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]);
    
    // データ範囲を読み取り
    const dataRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1).getValues();
    
    // マトリクスデータをMapに変換
    const intervalMap = new Map();
    
    sideColumn.forEach((fromMenu, rowIndex) => {
      if (!fromMenu) return;
      
      headerRow.forEach((toMenu, colIndex) => {
        if (!toMenu) return;
        
        const interval = dataRange[rowIndex][colIndex];
        if (interval !== '' && interval !== null) {
          const key = `${fromMenu}→${toMenu}`;
          intervalMap.set(key, parseInt(interval) || 0);
        }
      });
    });
    
    return intervalMap;
  }
  
  /**
   * 施術間隔マトリクスの整合性をチェック
   * @return {object} チェック結果
   */
  static validateTreatmentIntervalMatrix() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().treatmentInterval);
      if (!sheet || sheet.getLastRow() <= 1) {
        return {
          isValid: false,
          errors: ['施術間隔定義シートが見つからないか、データがありません']
        };
      }
      
      const errors = [];
      const warnings = [];
      
      // 1. ヘッダー行と左列のメニュー名を取得
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      const headerRow = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0].filter(name => name);
      const sideColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]).filter(name => name);
      
      // 2. 行数と列数が一致しているかチェック
      if (headerRow.length !== sideColumn.length) {
        errors.push(`行数(${sideColumn.length})と列数(${headerRow.length})が一致しません`);
      }
      
      // 3. メニュー名が同じ順序で並んでいるかチェック
      const mismatchedMenus = [];
      for (let i = 0; i < Math.min(headerRow.length, sideColumn.length); i++) {
        if (headerRow[i] !== sideColumn[i]) {
          mismatchedMenus.push({
            position: i + 1,
            header: headerRow[i],
            side: sideColumn[i]
          });
        }
      }
      
      if (mismatchedMenus.length > 0) {
        errors.push('メニューの順序が一致しません:');
        mismatchedMenus.forEach(m => {
          errors.push(`  - 位置${m.position}: ヘッダー「${m.header}」≠ 左列「${m.side}」`);
        });
      }
      
      // 4. 対角線（同じメニュー同士）の値をチェック
      const dataRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1).getValues();
      const diagonalIssues = [];
      
      for (let i = 0; i < Math.min(dataRange.length, dataRange[0].length); i++) {
        const value = dataRange[i][i];
        if (value !== '' && value !== 0 && value !== '0') {
          diagonalIssues.push({
            menu: sideColumn[i] || `行${i + 2}`,
            value: value
          });
        }
      }
      
      if (diagonalIssues.length > 0) {
        warnings.push('対角線（同じメニュー同士）に0以外の値があります:');
        diagonalIssues.forEach(d => {
          warnings.push(`  - ${d.menu}: ${d.value}日`);
        });
      }
      
      // 5. データの型チェック
      let invalidCells = 0;
      for (let i = 0; i < dataRange.length; i++) {
        for (let j = 0; j < dataRange[i].length; j++) {
          const value = dataRange[i][j];
          if (value !== '' && value !== null) {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue < 0) {
              invalidCells++;
              if (invalidCells <= 5) { // 最初の5件のみ報告
                errors.push(`無効な値: セル[${i + 2}, ${j + 2}] = "${value}"`);
              }
            }
          }
        }
      }
      
      if (invalidCells > 5) {
        errors.push(`他に${invalidCells - 5}件の無効な値があります`);
      }
      
      // 6. 最新のメニューリストとの照合
      const menuService = new MenuService();
      const currentMenus = menuService.getMenusFromSheet().map(m => m.name);
      
      const missingInMatrix = currentMenus.filter(menu => !headerRow.includes(menu));
      const extraInMatrix = headerRow.filter(menu => !currentMenus.includes(menu));
      
      if (missingInMatrix.length > 0) {
        warnings.push(`マトリクスに含まれていないメニュー: ${missingInMatrix.join(', ')}`);
      }
      
      if (extraInMatrix.length > 0) {
        warnings.push(`メニューマスタに存在しないメニュー: ${extraInMatrix.join(', ')}`);
      }
      
      const isValid = errors.length === 0;
      
      return {
        isValid: isValid,
        errors: errors,
        warnings: warnings,
        summary: {
          menuCount: headerRow.length,
          totalCells: dataRange.length * (dataRange[0] ? dataRange[0].length : 0),
          invalidCells: invalidCells,
          missingMenus: missingInMatrix.length,
          extraMenus: extraInMatrix.length
        }
      };
    });
  }
  
  /**
   * 施術間隔マトリクスの構造を修復
   * @return {object} 修復結果
   */
  static repairMatrixStructure() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().treatmentInterval);
      if (!sheet) {
        throw new Error('施術間隔定義シートが見つかりません');
      }
      
      // 現在のデータをバックアップ
      const currentMatrix = this.getTreatmentIntervalMatrix();
      
      // メニューリストを取得して再初期化
      this.initializeTreatmentIntervalSheet();
      
      // バックアップしたデータを復元
      const intervalData = [];
      currentMatrix.forEach((interval, key) => {
        const [fromMenu, toMenu] = key.split('→');
        intervalData.push({ fromMenu, toMenu, interval });
      });
      
      if (intervalData.length > 0) {
        this.applyIntervalDataToMatrix(sheet, intervalData);
      }
      
      // 修復後の検証
      const validation = this.validateTreatmentIntervalMatrix();
      
      return {
        success: validation.isValid,
        validation: validation,
        restoredCount: intervalData.length
      };
    });
  }
  
  /**
   * 施術間隔マトリクスを更新（メニュー追加/削除時）
   */
  static updateTreatmentIntervalMatrix() {
    return Utils.executeWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().treatmentInterval);
      if (!sheet) return;
      
      // 現在のマトリクスデータを取得
      const currentMatrix = this.getTreatmentIntervalMatrix();
      
      // 最新のメニュー一覧を取得
      const menuService = new MenuService();
      const menus = menuService.getMenusFromSheet();
      const menuNames = menus.map(menu => menu.name);
      
      // 現在のシートのメニュー一覧を取得
      const currentHeaderRow = sheet.getRange(1, 2, 1, sheet.getLastColumn() - 1).getValues()[0].filter(name => name);
      const currentSideColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(row => row[0]).filter(name => name);
      
      // メニューの追加/削除を検出
      const addedMenus = menuNames.filter(name => !currentHeaderRow.includes(name));
      const removedMenus = currentHeaderRow.filter(name => !menuNames.includes(name));
      
      if (addedMenus.length === 0 && removedMenus.length === 0) {
        Logger.log('メニューの変更はありません');
        return;
      }
      
      Logger.log(`追加メニュー: ${addedMenus.join(', ')}`);
      Logger.log(`削除メニュー: ${removedMenus.join(', ')}`);
      
      // シートを再初期化
      this.initializeTreatmentIntervalSheet();
      
      // 保持すべきデータを再適用
      const intervalData = [];
      currentMatrix.forEach((interval, key) => {
        const [fromMenu, toMenu] = key.split('→');
        // 削除されたメニューに関連するデータは除外
        if (!removedMenus.includes(fromMenu) && !removedMenus.includes(toMenu)) {
          intervalData.push({ fromMenu, toMenu, interval });
        }
      });
      
      if (intervalData.length > 0) {
        this.applyIntervalDataToMatrix(sheet, intervalData);
      }
      
      Logger.log('施術間隔マトリクスを更新しました');
    });
  }
  
  /**
   * 部屋管理シートを初期化
   * 病院スタッフが手動で入力するため、ヘッダーのみ作成
   */
  static initializeRoomManagementSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().roomManagement);
    
    const headers = [
      '部屋ID',
      '部屋名',
      '施術可能',
      '点滴可能',
      'その他利用可能項目',
      'ペア部屋1_ID',
      'ペア部屋1_名前',
      'ペア部屋2_ID',
      'ペア部屋2_名前',
      '最大収容人数',
      '有効フラグ',
      '備考'
    ];
    
    // ヘッダーのみ設定（データは入力しない）
    Utils.setHeaders(sheet, headers);
    
    // ヘッダーの説明行を追加（2行目）
    if (sheet.getLastRow() === 1) {
      const explanations = [
        '例: R001',
        '例: 診察室1',
        'TRUE/FALSE',
        'TRUE/FALSE',
        '例: カウンセリング、検査',
        'ペアで使用する部屋のID',
        'ペアで使用する部屋の名前',
        'ペアで使用する別の部屋のID',
        'ペアで使用する別の部屋の名前',
        '例: 1',
        'TRUE/FALSE',
        '任意のメモ'
      ];
      
      sheet.getRange(2, 1, 1, explanations.length).setValues([explanations]);
      sheet.getRange(2, 1, 1, explanations.length).setFontColor('#666666');
      sheet.getRange(2, 1, 1, explanations.length).setFontStyle('italic');
    }
    
    return sheet;
  }
  
  /**
   * メニューマッピングシートを初期化
   */
  static initializeMenuMappingSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().menuMapping);
    
    const headers = [
      'マッピングID',
      'メニューID',
      '初診/再診区分',
      '表示メニュー名',
      'APIメニューID',
      '表示順',
      '有効フラグ',
      '備考'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * メニューカテゴリ管理シートを初期化
   */
  static initializeMenuCategoriesSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().menuCategories);
    
    const headers = [
      'カテゴリID',
      'カテゴリレベル',
      'カテゴリ名',
      '親カテゴリID',
      '表示順',
      '有効フラグ',
      '説明',
      '作成日時',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // サンプルデータを追加
    const sampleData = [
      ['CAT001', '大', '施術メニュー', '', 1, true, '施術に関するメニュー', new Date(), new Date()],
      ['CAT002', '大', '物販', '', 2, true, '商品販売', new Date(), new Date()],
      ['CAT003', '中', '美容施術', 'CAT001', 1, true, '美容関連の施術', new Date(), new Date()],
      ['CAT004', '中', '医療施術', 'CAT001', 2, true, '医療関連の施術', new Date(), new Date()],
      ['CAT005', '小', 'ボトックス', 'CAT003', 1, true, 'ボトックス注射', new Date(), new Date()],
      ['CAT006', '小', 'ヒアルロン酸', 'CAT003', 2, true, 'ヒアルロン酸注入', new Date(), new Date()]
    ];
    
    // 既存データがない場合のみサンプルデータを追加
    if (sheet.getLastRow() === 1) {
      const dataRange = sheet.getRange(2, 1, sampleData.length, sampleData[0].length);
      dataRange.setValues(sampleData);
    }
    
    return sheet;
  }
  
  /**
   * 書類管理シートを初期化
   */
  static initializeDocumentManagementSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentManagement);
    
    // 既存データがある場合はヘッダーのみ確認・更新
    if (sheet.getLastRow() === 0) {
      // シートが空の場合のみヘッダーを設定
      const headers = [
        '書類ID',
        '書類タイトル',
        '書類URL',
        '対象患者ID',
        '対象患者名',
        '対象施術名',
        '登録日時',
        '更新日時',
        '備考'
      ];
      
      Utils.setHeaders(sheet, headers);
    }
    
    return sheet;
  }

  /**
   * プランマスタシートを初期化
   */
  static initializePlanMasterSheet() {
    const sheet = Utils.getOrCreateSheet('プランマスター');
    
    const headers = [
      'プラン名',
      '幹細胞',
      '施術',
      '点滴'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // サンプルプランデータを追加（既存データがない場合のみ）
    if (sheet.getLastRow() === 1) {
      const samplePlans = [
        ['ベーシック', 5, 10, 5],
        ['スタンダード', 10, 20, 10],
        ['プレミアム', 15, 30, 15]
      ];
      
      const dataRange = sheet.getRange(2, 1, samplePlans.length, samplePlans[0].length);
      dataRange.setValues(samplePlans);
    }
    
    return sheet;
  }

  /**
   * 会社マスタシートを初期化
   */
  static initializeCompanyMasterSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().companyMaster);
    
    const headers = [
      '会社ID',
      '会社名',
      'プラン',
      '開始日',
      '幹細胞チケット残数',
      '施術チケット残数',
      '点滴チケット残数'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // 既存データにチケット列がない場合は追加
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existingHeaders.indexOf('幹細胞チケット残数') === -1) {
      // チケット列を追加
      const startCol = existingHeaders.indexOf('開始日') + 2;
      sheet.getRange(1, startCol).setValue('幹細胞チケット残数');
      sheet.getRange(1, startCol + 1).setValue('施術チケット残数');
      sheet.getRange(1, startCol + 2).setValue('点滴チケット残数');
      
      // 既存の会社データに初期値を設定
      if (sheet.getLastRow() > 1) {
        const numRows = sheet.getLastRow() - 1;
        sheet.getRange(2, startCol, numRows, 3).setValue(0);
      }
    }
    
    return sheet;
  }
  
  /**
   * 施術マスタシートを初期化
   */
  static initializeTreatmentMasterSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().treatmentMaster);
    
    const headers = [
      'No',
      'カテゴリ',
      '名称 ※必須',
      '施術時間(分) ※必須',
      '種別',
      '回数 ※必須',
      '料金(税抜) ※必須',
      '料金(税込) ※必須',
      '対応可能な医療機器',
      '担当者|対応可能なスタッフ ※必須',
      '担当者|必要数 ※必須',
      '看護師|対応可能なスタッフ ※必須',
      '看護師|必要数 ※必須',
      '対応可能な施術部屋 ※必須',
      '薬剤名一覧',
      '物品名一覧',
      '問診票名',
      '回数が1の場合役務管理するか',
      '契約時に役務を消化する',
      '解約時の返金ルール',
      '役務残高に対する返金割合',
      '契約料に対する返金割合',
      '解約手数料(税抜)',
      '解約手数料(税込)',
      'コース有効期限(ヶ月)',
      'クーリングオフ有効期限(日)',
      '前受金',
      '注意書き',
      'カテゴリ優先順位',
      '名称優先順位',
      '施術内でのリソース優先順位を有効にする',
      '種別優先順位',
      '施術名(略称)',
      '詳細',
      '現在の院では非表示にする',
      'operation ID',
      'option ID',
      'URL',
      'インポート日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * 生成メニューシートを初期化
   */
  static initializeGeneratedMenusSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().generatedMenus);
    
    const headers = [
      'メニュー名',
      '施術時間',
      'カテゴリ',
      '金額',
      '説明文',
      'バリエーションタイプ',
      '施術名',
      'メニューの実施優先度',
      '施術ID',
      '作成日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * カテゴリマスタシートを初期化
   */
  static initializeTreatmentCategoriesSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().treatmentCategories);
    
    const headers = [
      'カテゴリID',
      'カテゴリ名',
      'カテゴリタイプ',
      '表示順',
      '有効フラグ',
      '説明',
      '作成日時',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * 通知設定シートを初期化
   */
  static initializeNotificationSettingsSheet() {
    const sheet = Utils.getOrCreateSheet('通知設定');
    
    const headers = [
      '設定項目',
      '設定値',
      '有効/無効',
      '説明',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * LINE通知設定シートを初期化
   */
  static initializeLineNotificationConfigSheet() {
    const sheet = Utils.getOrCreateSheet('LINE通知設定');
    
    const headers = [
      '通知タイプ',
      '有効/無効',
      '送信タイミング',
      '対象者',
      'チケット情報表示',
      '注意事項表示',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // デフォルト設定を追加（データがない場合のみ）
    if (sheet.getLastRow() <= 1) {
      const now = new Date();
      const defaultConfigs = [
        ['予約確定', '有効', '即時', '来院者', 'はい', 'はい', now],
        ['予約前日', '有効', '11:00', '来院者', 'はい', 'はい', now],
        ['予約当日', '有効', '09:00', '来院者', 'はい', 'はい', now],
        ['施術後', '有効', '1時間後', '来院者', 'はい', 'いいえ', now]
      ];
      
      Utils.writeDataToSheet(sheet, defaultConfigs, 2);
    }
    
    return sheet;
  }
  
  /**
   * LINE通知テンプレートシートを初期化
   */
  static initializeLineNotificationTemplatesSheet() {
    const sheet = Utils.getOrCreateSheet('LINE通知テンプレート');
    
    const headers = [
      '通知タイプ',
      'テンプレート名',
      'メッセージ本文',
      '使用変数',
      '有効フラグ',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // デフォルトテンプレートを追加（データがない場合のみ）
    if (sheet.getLastRow() <= 1) {
      const now = new Date();
      const defaultTemplates = [
        [
          '予約確定',
          '予約確定通知',
          '【予約確定のお知らせ】\n\n${来院者名}様\n\nご予約が確定いたしました。\n\n📅 予約日時\n${予約日} ${予約時間}\n\n📋 施術内容\n${施術内容}（${施術時間}）\n\n[チケット情報]\n\n[注意事項]\n\n[担当スタッフ]\n\nご来院お待ちしております。\n変更・キャンセルの場合はお早めにご連絡ください。\n\n${クリニック名}\n📞 ${クリニック電話番号}',
          '来院者名,予約日,予約時間,施術内容,施術時間,チケット消化予定枚数,チケット残枚数,施術注意点,クリニック名,クリニック電話番号,担当スタッフ',
          '有効',
          now
        ],
        [
          '予約前日',
          '前日リマインダー',
          '【明日のご予約のお知らせ】\n\n${来院者名}様\n\n明日のご予約をお知らせいたします。\n\n📅 予約日時\n${予約日} ${予約時間}\n\n📋 施術内容\n${施術内容}（${施術時間}）\n\n[チケット情報]\n\n[注意事項]\n\nお気をつけてお越しください。\n\n${クリニック名}',
          '来院者名,予約日,予約時間,施術内容,施術時間,チケット消化予定枚数,チケット残枚数,施術注意点,クリニック名',
          '有効',
          now
        ],
        [
          '予約当日',
          '当日リマインダー',
          '【本日のご予約のお知らせ】\n\n${来院者名}様\n\n本日 ${予約時間} のご予約をお待ちしております。\n\n📋 施術内容\n${施術内容}（${施術時間}）\n\n[チケット情報]\n\n[注意事項]\n\nお気をつけてお越しください。\n\n${クリニック名}',
          '来院者名,予約時間,施術内容,施術時間,チケット消化予定枚数,チケット残枚数,施術注意点,クリニック名',
          '有効',
          now
        ],
        [
          '施術後',
          '施術後フォローアップ',
          '【ご来院ありがとうございました】\n\n${来院者名}様\n\n本日はご来院いただき、ありがとうございました。\n\n📋 本日の施術\n${施術内容}\n\n[チケット情報]\n\nお体に変化がございましたら、お気軽にご相談ください。\n\nまたのご来院をお待ちしております。\n\n${クリニック名}\n📞 ${クリニック電話番号}',
          '来院者名,施術内容,チケット消化予定枚数,チケット残枚数,クリニック名,クリニック電話番号',
          '有効',
          now
        ]
      ];
      
      Utils.writeDataToSheet(sheet, defaultTemplates, 2);
    }
    
    return sheet;
  }
  
  /**
   * 予約通知履歴シートを初期化
   */
  static initializeNotificationHistorySheet() {
    const sheet = Utils.getOrCreateSheet('予約通知履歴');
    
    const headers = [
      '送信日時',
      '通知タイプ',
      '予約ID',
      '来院者ID',
      '来院者名',
      '受信者ID',
      '受信者名',
      '送信方法',
      '送信結果',
      'エラー詳細'
    ];
    
    Utils.setHeaders(sheet, headers);
    return sheet;
  }
  
  /**
   * スタッフ管理シートを初期化
   */
  static initializeStaffSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().staff);
    
    const headers = [
      'スタッフID',
      'スタッフ名',
      '職種',
      '有効フラグ',
      '備考',
      '作成日時',
      '更新日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // ヘッダーの説明行を追加（2行目）
    if (sheet.getLastRow() === 1) {
      const explanations = [
        '例: STAFF001',
        '例: 山田太郎',
        '例: 医師、看護師、受付',
        'TRUE/FALSE',
        '任意のメモ',
        '自動設定',
        '自動設定'
      ];
      
      sheet.getRange(2, 1, 1, explanations.length).setValues([explanations]);
      sheet.getRange(2, 1, 1, explanations.length).setFontColor('#666666');
      sheet.getRange(2, 1, 1, explanations.length).setFontStyle('italic');
    }
    
    return sheet;
  }
  
  /**
   * すべてのシートを初期化
   */
  static initializeAllSheets() {
    Logger.log('スプレッドシートの初期化を開始します');
    
    this.initializeConfigSheet();
    this.initializeVisitorsSheet();
    this.initializeReservationsSheet();
    this.initializeMenusSheet();
    this.initializeMenuCategoriesSheet();
    this.initializeLogsSheet();
    this.initializePlanMasterSheet();
    this.initializeCompanyMasterSheet();
    this.initializeCompanyVisitorsSheet();
    this.initializeTreatmentIntervalSheet();
    this.initializeRoomManagementSheet();
    this.initializeMenuMappingSheet();
    this.initializeDocumentManagementSheet();
    this.initializeDocumentFoldersSheet();
    this.initializeTreatmentMasterSheet();
    this.initializeTreatmentCategoriesSheet();
    this.initializeGeneratedMenusSheet();
    this.initializeNotificationSettingsSheet();
    this.initializeNotificationHistorySheet();
    this.initializeLineNotificationConfigSheet();
    this.initializeLineNotificationTemplatesSheet();
    this.initializeStaffSheet();
    
    Logger.log('スプレッドシートの初期化が完了しました');
    
    // 設定シートをアクティブにする
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = spreadsheet.getSheetByName(Config.getSheetNames().config);
    spreadsheet.setActiveSheet(configSheet);
    
    return true;
  }
  
  /**
   * 設定値を取得
   */
  static getConfigValue(key) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().config);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }
    return null;
  }
  
  /**
   * 設定値を更新
   */
  static setConfigValue(key, value) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().config);
    if (!sheet) return false;
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        return true;
      }
    }
    return false;
  }
  
  /**
   * スプレッドシートのヘッダーを動的に更新
   * APIレスポンスに含まれる未知のフィールドをヘッダーに追加
   */
  static updateSheetHeaders(sheetName, data) {
    if (!data || data.length === 0) return;
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return;
    
    // 現在のヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const existingHeaders = new Set(headers.filter(h => h));
    
    // データから全てのキーを収集
    const allKeys = new Set();
    
    // dataが配列の場合
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
    } else if (data && typeof data === 'object') {
      // dataがオブジェクトの場合
      Object.keys(data).forEach(key => allKeys.add(key));
    }
    
    // 新しいフィールドを検出
    const newFields = [];
    allKeys.forEach(key => {
      // フィールド名を日本語に変換（簡易マッピング）
      const displayName = this._getFieldDisplayName(key);
      if (!existingHeaders.has(displayName) && !existingHeaders.has(key)) {
        newFields.push(displayName || key);
      }
    });
    
    // 新しいフィールドがある場合、ヘッダーに追加
    if (newFields.length > 0) {
      const lastColumn = sheet.getLastColumn();
      const newHeaderRange = sheet.getRange(1, lastColumn + 1, 1, newFields.length);
      newHeaderRange.setValues([newFields]);
      
      Logger.log(`新しいフィールドを追加: ${newFields.join(', ')}`);
    }
  }
  
  /**
   * APIフィールド名を日本語表示名に変換
   */
  static _getFieldDisplayName(fieldName) {
    const fieldMapping = {
      'line_id': 'LINE_ID',
      'LINE_ID': 'LINE_ID',
      'line_user_id': 'LINE_ID',
      'columns': 'カスタムカラム',
      'is_online': 'オンライン対応',
      'is_offline': 'オフライン対応',
      'operate_date': '施術日',
      'amount': '金額',
      'price': '価格',
      'tax_category': '税区分',
      'staff_name': 'スタッフ名',
      'menu_name': 'メニュー名',
      'operation_name': '施術名',
      'clinic_name': 'クリニック名'
    };
    
    return fieldMapping[fieldName] || fieldName;
  }
  
  /**
   * 書類フォルダ定義シートを初期化
   */
  static initializeDocumentFoldersSheet() {
    const sheet = Utils.getOrCreateSheet(Config.getSheetNames().documentFolders);
    
    const headers = [
      'フォルダID',
      '患者ID',
      'フォルダ名',
      '親フォルダID',
      '説明',
      '表示順',
      'パス',
      '作成日時'
    ];
    
    Utils.setHeaders(sheet, headers);
    
    // デフォルトフォルダを追加（データがない場合のみ）
    if (sheet.getLastRow() <= 1) {
      const now = new Date();
      const createdAt = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd');
      
      const defaultFolders = [
        ['FLD-DEFAULT-001', '', '一般書類', '', '一般的な書類を格納するフォルダ', 1, '/一般書類', createdAt],
        ['FLD-DEFAULT-002', '', '同意書', '', '各種同意書を格納するフォルダ', 2, '/同意書', createdAt],
        ['FLD-DEFAULT-003', '', '診断書', '', '診断書関連の書類を格納するフォルダ', 3, '/診断書', createdAt],
        ['FLD-DEFAULT-004', '', '請求書', '', '請求書・領収書関連の書類を格納するフォルダ', 4, '/請求書', createdAt]
      ];
      
      Utils.writeDataToSheet(sheet, defaultFolders, 2);
    }
    
    return sheet;
  }
  
  /**
   * 実行ログを記録
   * @param {string} status - ステータス (SUCCESS, ERROR, INFO, WARNING)
   * @param {string} message - メッセージ
   * @param {string} details - 詳細情報（オプション）
   */
  static logExecution(status, message, details = '') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Config.getSheetNames().logs);
      if (!sheet) {
        Logger.log('実行ログシートが見つかりません');
        return;
      }
      
      const now = new Date();
      const timestamp = Utilities.formatDate(now, Config.getTimeZone(), Config.getDateTimeFormat());
      
      // ログデータを追加
      sheet.appendRow([timestamp, status, message, details]);
      
      // ログシートが大きくなりすぎないよう、古いログを削除（1000行を超えたら古いものから削除）
      if (sheet.getLastRow() > 1000) {
        sheet.deleteRows(2, 100); // ヘッダーを除いて古い100行を削除
      }
      
      // Logger.logにも出力
      Logger.log(`[${status}] ${message} ${details ? '- ' + details : ''}`);
    } catch (error) {
      // ログ記録自体が失敗してもメイン処理には影響させない
      Logger.log('ログ記録エラー: ' + error.toString());
    }
  }
  
  /**
   * シートからデータを取得してオブジェクト配列として返す
   * @param {string} sheetName - シート名
   * @returns {Array} データのオブジェクト配列
   */
  static getSheetData(sheetName) {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = spreadsheet.getSheetByName(sheetName);
      
      if (!sheet) {
        Logger.log(`SpreadsheetManager.getSheetData: シート "${sheetName}" が見つかりません`);
        return [];
      }
      
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      if (lastRow <= 1 || lastCol <= 0) {
        Logger.log(`SpreadsheetManager.getSheetData: シート "${sheetName}" にデータがありません`);
        return [];
      }
      
      // ヘッダー行を取得
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      // データ行を取得
      const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
      const data = dataRange.getValues();
      
      // オブジェクト配列に変換
      const result = this.convertToObjectArray(headers, data);
      
      Logger.log(`SpreadsheetManager.getSheetData: シート "${sheetName}" から ${result.length} 件のデータを取得`);
      return result;
      
    } catch (error) {
      Logger.log(`SpreadsheetManager.getSheetData エラー: ${error.toString()}`);
      return [];
    }
  }
  
  /**
   * ヘッダーとデータをオブジェクト配列に変換
   * @param {Array} headers - ヘッダー配列
   * @param {Array} data - データの2次元配列
   * @returns {Array} オブジェクト配列
   */
  static convertToObjectArray(headers, data) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      
      // 空の行をスキップ
      if (row.every(cell => cell === '' || cell === null || cell === undefined)) {
        continue;
      }
      
      // ヘッダーとデータを対応させてオブジェクトを作成
      for (let j = 0; j < headers.length && j < row.length; j++) {
        const header = headers[j];
        if (header && header !== '') {
          obj[header] = row[j];
        }
      }
      
      result.push(obj);
    }
    
    return result;
  }
}