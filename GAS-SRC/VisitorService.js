/**
 * 患者（Visitor）管理サービス
 */
class VisitorService {
  constructor() {
    this.apiClient = new ApiClient();
    this.sheetName = Config.getSheetNames().visitors;
  }
  
  /**
   * 更新日ベースで患者情報を同期（Medical Force APIの正しい仕様）
   * /developer/visitors は検索専用のため、更新日ベースで患者を取得します
   */
  syncVisitors(daysBack = 30) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('患者情報の同期を開始します（更新日ベース）');
      Logger.log(`使用するclinic_id: ${Config.getClinicId()}`);
      
      const allVisitors = [];
      const today = new Date();
      
      // 過去 N 日間の患者を取得
      for (let i = 0; i < daysBack; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        Logger.log(`${dateStr} の更新患者を取得中...`);
        
        try {
          // updated-brand-visitors エンドポイントで更新患者を取得
          const response = this.apiClient.get('/developer/updated-brand-visitors', {
            clinic_id: Config.getClinicId(),
            date: dateStr
          });
          
          if (response.success && response.data) {
            const visitors = Array.isArray(response.data) ? response.data : [];
            Logger.log(`${dateStr}: ${visitors.length}件の患者を取得`);
            
            if (visitors.length > 0) {
              // LINE_ID情報をログ出力
              visitors.forEach((visitor, index) => {
                const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
                if (lineId) {
                  Logger.log(`${dateStr} - 患者[${index}]: ID=${visitor.visitor_id || visitor.id}, LINE_ID=${lineId}`);
                }
              });
              allVisitors.push(...visitors);
            }
          } else {
            Logger.log(`${dateStr}: データ取得に失敗 - ${response.statusCode}`);
          }
        } catch (error) {
          Logger.log(`${dateStr}: エラー - ${error.toString()}`);
        }
        
        // API制限を考慮して少し待機
        if (i < daysBack - 1) {
          Utilities.sleep(200);  // 0.2秒待機
        }
      }
      
      // 重複を除去（visitor_id ベース）
      const uniqueVisitors = this._removeDuplicateVisitors(allVisitors);
      
      Logger.log(`合計${allVisitors.length}件を取得、重複除去後${uniqueVisitors.length}件`);
      
      // スプレッドシートに書き込み
      if (uniqueVisitors.length > 0) {
        this._writeVisitorsToSheet(uniqueVisitors);
      }
      
      return uniqueVisitors.length;
    }, '患者情報同期');
  }
  
  /**
   * 重複した患者データを除去（visitor_id ベース）
   */
  _removeDuplicateVisitors(visitors) {
    const uniqueMap = new Map();
    
    visitors.forEach(visitor => {
      const visitorId = visitor.visitor_id || visitor.id;
      if (visitorId) {
        // LINE_ID情報をログ出力
        const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
        if (lineId) {
          Logger.log(`重複除去処理 - 患者ID: ${visitorId}, LINE_ID: ${lineId}`);
        }
        // 新しいデータで上書き（最新のデータを優先）
        uniqueMap.set(visitorId, visitor);
      }
    });
    
    return Array.from(uniqueMap.values());
  }
  
  /**
   * 特定日の更新患者情報を同期
   */
  syncUpdatedVisitors(date = null) {
    return Utils.executeWithErrorHandling(() => {
      if (!date) {
        // デフォルトは今日の日付
        const today = new Date();
        date = today.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      
      Logger.log(`${date}に更新された患者情報を同期します`);
      
      // updated-brand-visitors エンドポイントで更新患者を取得
      const response = this.apiClient.get('/developer/updated-brand-visitors', {
        clinic_id: Config.getClinicId(),
        date: date
      });
      
      if (!response.success || !response.data) {
        throw new Error('更新された患者情報の取得に失敗しました');
      }
      
      // APIレスポンスは配列形式
      const visitors = Array.isArray(response.data) ? response.data : [];
      Logger.log(`${visitors.length}件の更新された患者情報を取得しました`);
      
      if (visitors.length > 0) {
        // LINE_ID情報をログ出力
        visitors.forEach((visitor, index) => {
          const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
          Logger.log(`更新患者[${index}]: ID=${visitor.visitor_id || visitor.id}, LINE_ID=${lineId}`);
          // LINE関連の全フィールドをチェック
          const lineRelatedFields = {};
          Object.keys(visitor).forEach(key => {
            if (key.toLowerCase().includes('line')) {
              lineRelatedFields[key] = visitor[key];
            }
          });
          if (Object.keys(lineRelatedFields).length > 0) {
            Logger.log(`更新患者[${index}]: LINE関連フィールド = ${JSON.stringify(lineRelatedFields)}`);
          }
        });
        
        // 既存データとマージして更新
        this._mergeVisitorsToSheet(visitors);
      }
      
      return visitors.length;
    }, '更新患者情報同期');
  }
  
  /**
   * 患者IDで患者情報を取得
   */
  getVisitorById(visitorId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`患者情報を取得: ID=${visitorId}`);
      
      const response = this.apiClient.get(`/developer/visitors/${visitorId}`, {
        clinic_id: Config.getClinicId()
      });
      
      if (!response.success || !response.data) {
        throw new Error('患者情報の取得に失敗しました');
      }
      
      return response.data;
    }, '患者情報取得');
  }
  
  /**
   * 新規患者を登録
   */
  createVisitor(visitorData) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('新規患者を登録します');
      Logger.log(`登録するclinic_id: ${visitorData.clinic_id || Config.getClinicId()}`);
      Logger.log(`登録データ: ${JSON.stringify(visitorData)}`);
      
      // 必須項目のチェック
      if (!visitorData.name || !visitorData.name_kana) {
        throw new Error('氏名とカナは必須項目です');
      }
      
      // clinic_idを設定
      const requestData = {
        clinic_id: Config.getClinicId(),
        ...visitorData
      };
      
      // APIに送信
      const response = this.apiClient.post('/developer/visitors', requestData);
      
      Logger.log(`登録APIレスポンス全体: ${JSON.stringify(response)}`);
      
      if (!response.success || !response.data) {
        throw new Error('患者の登録に失敗しました');
      }
      
      const visitor = response.data;
      
      // APIレスポンスの正規化: idをvisitor_idとしても保持
      if (visitor.id && !visitor.visitor_id) {
        visitor.visitor_id = visitor.id;
      }
      
      Logger.log(`患者を登録しました: ID=${visitor.visitor_id || visitor.id}`);
      
      // スプレッドシートに追加
      this._appendVisitorToSheet(visitor);
      
      return visitor;
    }, '患者登録');
  }
  
  /**
   * 患者情報をスプレッドシートに書き込み
   */
  _writeVisitorsToSheet(visitors) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    
    // データをクリア（ヘッダーは残す）
    Utils.clearSheet(sheet, true);
    
    if (visitors.length === 0) {
      Logger.log('書き込む患者データがありません');
      return;
    }
    
    // 動的にヘッダーを更新（新しいフィールドがあれば追加）
    SpreadsheetManager.updateSheetHeaders(this.sheetName, visitors);
    
    // 更新後のヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // データを配列に変換（updated-brand-visitorsのフィールドに対応）
    const data = visitors.map((visitor, index) => {
      const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
      if (lineId) {
        Logger.log(`_writeVisitorsToSheet - 患者[${index}]: ID=${visitor.visitor_id || visitor.id}, LINE_ID=${lineId}`);
      }
      return this._visitorToRowDynamic(visitor, headers);
    });
    
    // シートに書き込み
    Utils.writeDataToSheet(sheet, data);
    
    Logger.log(`${visitors.length}件の患者情報をシートに書き込みました`);
  }
  
  /**
   * 患者情報をマージして更新
   */
  _mergeVisitorsToSheet(visitors) {
    Logger.log(`_mergeVisitorsToSheet開始: ${visitors.length}件の患者データを処理`);
    
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    const existingData = sheet.getDataRange().getValues();
    
    Logger.log(`既存データ行数: ${existingData.length}`);
    
    if (existingData.length <= 1) {
      // 既存データがない場合は新規書き込み
      Logger.log('既存データなし。新規書き込みモードで処理');
      this._writeVisitorsToSheet(visitors);
      return;
    }
    
    // 動的にヘッダーを更新（新しいフィールドがあれば追加）
    SpreadsheetManager.updateSheetHeaders(this.sheetName, visitors);
    
    // 更新後のヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log(`ヘッダー: ${JSON.stringify(headers)}`);
    
    // visitor_idをキーとして既存データをマップ化
    const existingMap = new Map();
    for (let i = 1; i < existingData.length; i++) {
      const visitorId = existingData[i][0];
      if (visitorId) {
        existingMap.set(visitorId.toString(), i);
      }
    }
    Logger.log(`既存データマップサイズ: ${existingMap.size}`);
    
    // 更新データを処理
    let newCount = 0;
    let updateCount = 0;
    
    visitors.forEach(visitor => {
      const visitorId = (visitor.visitor_id || visitor.id || '').toString();
      const extractedKarteNumber = this._extractKarteNumber(visitor);
      
      // LINE_ID の詳細ログ追加
      const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
      Logger.log(`処理中の患者ID: ${visitorId}, 抽出されたカルテ番号: ${extractedKarteNumber}`);
      Logger.log(`LINE_ID情報: line_id=${visitor.line_id}, LINE_ID=${visitor.LINE_ID}, line_user_id=${visitor.line_user_id}, 最終値=${lineId}`);
      Logger.log(`karte_numbers配列: ${JSON.stringify(visitor.karte_numbers)}`);
      
      // 患者データの全フィールドをログに出力（LINE_ID関連フィールドを確認）
      const lineRelatedFields = {};
      Object.keys(visitor).forEach(key => {
        if (key.toLowerCase().includes('line')) {
          lineRelatedFields[key] = visitor[key];
        }
      });
      if (Object.keys(lineRelatedFields).length > 0) {
        Logger.log(`LINE関連フィールド: ${JSON.stringify(lineRelatedFields)}`);
      }
      
      const rowIndex = existingMap.get(visitorId);
      if (rowIndex) {
        // 既存レコードを更新
        updateCount++;
        const rowData = this._visitorToRowDynamic(visitor, headers);
        const range = sheet.getRange(rowIndex + 1, 1, 1, rowData.length);
        range.setValues([rowData]);
        Logger.log(`患者ID ${visitorId} を更新（行 ${rowIndex + 1}）, LINE_ID=${lineId}`);
      } else {
        // 新規レコードを追加
        newCount++;
        this._appendVisitorToSheet(visitor);
        Logger.log(`患者ID ${visitorId} を新規追加, LINE_ID=${lineId}`);
      }
    });
    
    Logger.log(`_mergeVisitorsToSheet完了: 新規${newCount}件、更新${updateCount}件`);
  }
  
  /**
   * 患者情報を1件追加
   */
  _appendVisitorToSheet(visitor) {
    const sheet = Utils.getOrCreateSheet(this.sheetName);
    
    // 動的にヘッダーを更新（新しいフィールドがあれば追加）
    SpreadsheetManager.updateSheetHeaders(this.sheetName, [visitor]);
    
    // 更新後のヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // データを変換
    const rowData = this._visitorToRowDynamic(visitor, headers);
    sheet.appendRow(rowData);
  }
  
  /**
   * 患者オブジェクトを行データに変換
   */
  _visitorToRow(visitor) {
    // 年齢を計算
    const age = this._calculateAge(visitor.birthday);
    
    // タグの配列を文字列に変換
    const tags = Array.isArray(visitor.visitor_tag_names) 
      ? visitor.visitor_tag_names.join(', ') 
      : (visitor.visitor_tag_names || '');
    
    return [
      visitor.visitor_id || visitor.id || '',
      visitor.name || '',
      visitor.name_kana || visitor.kana || '',
      visitor.last_name || '',
      visitor.first_name || '',
      visitor.last_name_kana || '',
      visitor.first_name_kana || '',
      visitor.birthday || '',
      age,
      visitor.gender || '',
      visitor.phone || '',
      visitor.email || '',
      visitor.postal_code || visitor.zipcode || visitor.zip_code || '',
      visitor.address || '',
      visitor.first_visit_date || visitor.first_visit || '',
      visitor.last_visit_date || visitor.last_visit || '',
      this._extractKarteNumber(visitor),
      visitor.code || visitor.visitor_code || '',
      visitor.memo || visitor.note || visitor.attention || '',
      visitor.allergies || '',
      visitor.histories || '',
      visitor.attention || '',
      visitor.is_subscribed !== undefined ? (visitor.is_subscribed ? 'はい' : 'いいえ') : '',
      visitor.inflow_source || visitor.inflow_source_name || '',
      visitor.inflow_source_label || '',
      visitor.invitation_code || '',
      tags,
      visitor.line_id || visitor.LINE_ID || '',
      visitor.api_collaborator_id || '',
      visitor.api_collaborator_customer_id || '',
      visitor.is_identification_confirmed !== undefined ? (visitor.is_identification_confirmed ? 'はい' : 'いいえ') : '',
      Utils.formatDateTime(visitor.deleted_at),
      Utils.formatDateTime(visitor.created_at),
      Utils.formatDateTime(visitor.updated_at)
    ];
  }
  
  /**
   * 年齢を計算
   */
  _calculateAge(birthday) {
    if (!birthday) return '';
    
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
  
  /**
   * karte_numbersまたはcolumns配列からカルテ番号を抽出
   * karte_numbersは[{"クリニック名": "番号"}]の形式の配列
   * columnsは[{"column_name": "カラム名", "values": ["値"]}]の形式の配列
   */
  _extractKarteNumber(visitor) {
    // 1. まずkarte_numbersをチェック（配列形式）
    if (visitor.karte_numbers && Array.isArray(visitor.karte_numbers)) {
      // クリニック名で検索
      const clinicName = 'CLUTIReFINEクリニック';
      
      for (const karteObj of visitor.karte_numbers) {
        // オブジェクトのキーを取得
        const keys = Object.keys(karteObj);
        
        // クリニック名と一致するキーを探す
        for (const key of keys) {
          if (key === clinicName || key.includes('CLUTIReFINE')) {
            return karteObj[key];
          }
        }
        
        // 最初の値を返す（クリニック名が一致しない場合）
        if (keys.length > 0) {
          return karteObj[keys[0]];
        }
      }
    }
    
    // 2. columns配列からカルテ番号を検索
    if (visitor.columns && Array.isArray(visitor.columns)) {
      for (const column of visitor.columns) {
        const columnName = column.column_name || '';
        
        // カルテ番号らしいカラムを検索
        if (columnName === 'カルテ番号' || 
            columnName === 'chart_number' ||
            columnName === 'karte_number' ||
            columnName.includes('カルテ') ||
            columnName.includes('chart') ||
            columnName.includes('番号')) {
          
          if (column.values && Array.isArray(column.values) && column.values.length > 0) {
            return column.values[0];
          }
        }
      }
    }
    
    // 3. フォールバック: chart_numberまたはkarte_numberフィールドをチェック
    if (visitor.chart_number) {
      return visitor.chart_number;
    }
    
    if (visitor.karte_number) {
      return visitor.karte_number;
    }
    
    return '';
  }
  
  /**
   * 患者オブジェクトを動的に行データに変換
   * スプレッドシートのヘッダーに基づいて、適切な値をマッピング
   */
  _visitorToRowDynamic(visitor, headers) {
    const row = [];
    
    // ヘッダーに基づいて値をマッピング
    headers.forEach(header => {
      let value = '';
      
      // 特殊なフィールドの処理
      if (header === '年齢') {
        value = this._calculateAge(visitor.birthday);
      } else if (header === 'タグ') {
        value = Array.isArray(visitor.visitor_tag_names) 
          ? visitor.visitor_tag_names.join(', ') 
          : (visitor.visitor_tag_names || '');
      } else if (header === 'カルテ番号') {
        // karte_numbersは配列形式で、クリニック名をキーとするオブジェクトの配列
        value = this._extractKarteNumber(visitor);
      } else if (header === 'メール配信希望' && visitor.is_subscribed !== undefined) {
        value = visitor.is_subscribed ? 'はい' : 'いいえ';
      } else if (header === '本人確認済み' && visitor.is_identification_confirmed !== undefined) {
        value = visitor.is_identification_confirmed ? 'はい' : 'いいえ';
      } else {
        // 通常のフィールドマッピング
        value = this._findFieldValue(visitor, header);
      }
      
      // LINE_IDフィールドの詳細ログ
      if (header === 'LINE_ID') {
        const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
        Logger.log(`_visitorToRowDynamic - ヘッダー: LINE_ID, 患者ID: ${visitor.visitor_id || visitor.id}, 値: ${value}, 元データ: line_id=${visitor.line_id}, LINE_ID=${visitor.LINE_ID}, line_user_id=${visitor.line_user_id}`);
      }
      
      // 日時フィールドの場合はフォーマット
      if (header.includes('日時') && value) {
        value = Utils.formatDateTime(value);
      }
      
      row.push(value || '');
    });
    
    return row;
  }
  
  /**
   * ヘッダー名に対応するフィールド値を検索
   */
  _findFieldValue(obj, header) {
    // ヘッダー名とAPIフィールド名のマッピング（updated-brand-visitors 対応）
    const headerToFieldMap = {
      'visitor_id': ['visitor_id', 'id'],
      '氏名': ['visitor_name', 'name'],
      'カナ': ['visitor_name_kana', 'name_kana', 'kana'],
      '姓': ['last_name'],
      '名': ['first_name'],
      '姓カナ': ['last_name_kana'],
      '名カナ': ['first_name_kana'],
      '生年月日': ['birthday'],
      '性別': ['gender'],
      '電話番号': ['phone'],
      'メールアドレス': ['email'],
      '郵便番号': ['zip_code', 'postal_code', 'zipcode'],
      '住所': ['address'],
      '初診日': ['first_visit_date', 'first_visit'],
      '最終来院日': ['last_visit_date', 'last_visit'],
      'カルテ番号': ['karte_numbers', 'chart_number', 'karte_number'],
      '患者コード': ['visitor_code', 'code'],
      'メモ': ['memo', 'note', 'attention'],
      'アレルギー': ['allergies'],
      '既往歴': ['histories'],
      '注意事項': ['attention'],
      '来院経路': ['inflow_source', 'inflow_source_name'],
      '来院経路ラベル': ['inflow_source_label'],
      '招待コード': ['invitation_code'],
      'LINE_ID': ['line_id', 'LINE_ID', 'line_user_id'],
      'api_collaborator_id': ['api_collaborator_id'],
      'api_collaborator_customer_id': ['api_collaborator_customer_id'],
      '削除日時': ['deleted_at'],
      '登録日時': ['created_at'],
      '更新日時': ['updated_at']
    };
    
    // マッピングから値を検索
    const possibleFields = headerToFieldMap[header];
    if (possibleFields) {
      for (const field of possibleFields) {
        if (obj[field] !== undefined && obj[field] !== null) {
          return obj[field];
        }
      }
    }
    
    // 直接フィールド名でも検索
    if (obj[header] !== undefined && obj[header] !== null) {
      return obj[header];
    }
    
    return '';
  }
  
  /**
   * 患者検索
   */
  searchVisitors(searchParams) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('患者を検索します');
      
      const response = this.apiClient.getVisitors(searchParams);
      
      if (!response.success || !response.data) {
        throw new Error('患者の検索に失敗しました');
      }
      
      return response.data;
    }, '患者検索');
  }
  
  /**
   * 患者マスタシートから患者検索
   */
  searchVisitorsFromSheet(searchParams) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log('患者マスタシートから患者を検索します');
      Logger.log(`シート名: ${this.sheetName}`);
      Logger.log(`検索条件: ${JSON.stringify(searchParams)}`);
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
      if (!sheet) {
        Logger.log(`エラー: シート「${this.sheetName}」が見つかりません`);
        throw new Error(`シート「${this.sheetName}」が見つかりません`);
      }
      
      const lastRow = sheet.getLastRow();
      Logger.log(`シートの行数: ${lastRow}`);
      
      if (lastRow <= 1) {
        Logger.log('警告: データ行が存在しません');
        return { items: [] };
      }
      
      // ヘッダー行を取得してインデックスを作成
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      Logger.log(`ヘッダー: ${JSON.stringify(headers)}`);
      
      // ヘッダーマッピング（英語→日本語、日本語→日本語）
      const headerMapping = {
        // 患者ID
        'visitor_id': '患者ID',
        'id': '患者ID',
        '患者ID': '患者ID',
        // 氏名
        'name': '氏名',
        '氏名': '氏名',
        // カナ
        'name_kana': 'カナ',
        'kana': 'カナ',
        'カナ': 'カナ',
        // 電話番号
        'phone': '電話番号',
        'tel': '電話番号',
        '電話番号': '電話番号',
        // メール
        'email': 'メールアドレス',
        'mail': 'メールアドレス',
        'メールアドレス': 'メールアドレス',
        'メール': 'メールアドレス',
        // カルテ番号
        'chart_number': 'カルテ番号',
        'カルテ番号': 'カルテ番号',
        // その他
        'birthday': '生年月日',
        '生年月日': '生年月日',
        'age': '年齢',
        '年齢': '年齢',
        'gender': '性別',
        '性別': '性別',
        'postal_code': '郵便番号',
        '郵便番号': '郵便番号',
        'address': '住所',
        '住所': '住所',
        'first_visit_date': '初診日',
        '初診日': '初診日',
        'last_visit_date': '最終来院日',
        '最終来院日': '最終来院日'
      };
      
      // ヘッダーインデックスを作成（マッピングを考慮）
      const columnIndices = {};
      headers.forEach((header, index) => {
        const normalizedHeader = headerMapping[header] || header;
        columnIndices[normalizedHeader] = index;
        // 元のヘッダー名でもアクセスできるように
        columnIndices[header] = index;
      });
      
      Logger.log(`カラムインデックス: ${JSON.stringify(columnIndices)}`);
      
      // 全データを取得
      const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      Logger.log(`データ行数: ${data.length}`);
      
      const results = [];
      
      // 検索条件が空かどうかをチェック（全件検索）
      const isEmptySearch = !searchParams || Object.keys(searchParams).length === 0 || 
        Object.values(searchParams).every(value => !value || value === '');
      
      Logger.log(`全件検索モード: ${isEmptySearch}`);
      
      // 各行を検索
      data.forEach((row, rowIndex) => {
        // 空の行はスキップ
        if (!row[0] && !row[1]) {
          return;
        }
        
        let match = true;
        
        // 全件検索の場合はすべてマッチ
        if (!isEmptySearch) {
          // 氏名検索（部分一致、大文字小文字区別なし）
          if (searchParams.name) {
            const nameIndex = columnIndices['氏名'] !== undefined ? columnIndices['氏名'] : 1;
            const name = (row[nameIndex] || '').toString().toLowerCase();
            const searchName = searchParams.name.toLowerCase();
            if (!name.includes(searchName)) {
              match = false;
            }
          }
          
          // カナ検索（部分一致、大文字小文字区別なし）
          if (match && searchParams.nameKana) {
            const kanaIndex = columnIndices['カナ'] !== undefined ? columnIndices['カナ'] : 2;
            const kana = (row[kanaIndex] || '').toString().toLowerCase();
            const searchKana = searchParams.nameKana.toLowerCase();
            if (!kana.includes(searchKana)) {
              match = false;
            }
          }
          
          // 電話番号検索（部分一致、ハイフンを除去して検索）
          if (match && searchParams.phone) {
            const phoneIndex = columnIndices['電話番号'];
            if (phoneIndex !== undefined) {
              const phone = (row[phoneIndex] || '').toString().replace(/-/g, '');
              const searchPhone = searchParams.phone.replace(/-/g, '');
              if (!phone.includes(searchPhone)) {
                match = false;
              }
            }
          }
          
          // メール検索（部分一致、大文字小文字区別なし）
          if (match && searchParams.email) {
            const emailIndex = columnIndices['メールアドレス'] || columnIndices['メール'];
            if (emailIndex !== undefined) {
              const email = (row[emailIndex] || '').toString().toLowerCase();
              const searchEmail = searchParams.email.toLowerCase();
              if (!email.includes(searchEmail)) {
                match = false;
              }
            }
          }
          
          // カルテ番号検索（完全一致）
          if (match && searchParams.chartNumber) {
            const chartIndex = columnIndices['カルテ番号'];
            if (chartIndex !== undefined) {
              const chartNumber = (row[chartIndex] || '').toString();
              if (chartNumber !== searchParams.chartNumber) {
                match = false;
              }
            }
          }
        }
        
        // マッチした場合、結果に追加
        if (match) {
          // 各フィールドのインデックスを取得（存在しない場合はデフォルト値）
          const getIndex = (fieldNames, defaultIndex) => {
            for (const fieldName of fieldNames) {
              if (columnIndices[fieldName] !== undefined) {
                return columnIndices[fieldName];
              }
            }
            return defaultIndex;
          };
          
          const karteIndex = getIndex(['カルテ番号', 'chart_number'], -1);
          const chartNumber = karteIndex !== -1 ? row[karteIndex] : '';
          
          results.push({
            visitor_id: row[getIndex(['患者ID', 'visitor_id', 'id'], 0)] || '',
            name: row[getIndex(['氏名', 'name'], 1)] || '',
            name_kana: row[getIndex(['カナ', 'name_kana', 'kana'], 2)] || '',
            birthday: row[getIndex(['生年月日', 'birthday'], 3)] || '',
            age: row[getIndex(['年齢', 'age'], 4)] || '',
            gender: row[getIndex(['性別', 'gender'], 5)] || '',
            phone: row[getIndex(['電話番号', 'phone', 'tel'], 6)] || '',
            email: row[getIndex(['メールアドレス', 'メール', 'email', 'mail'], 7)] || '',
            postal_code: row[getIndex(['郵便番号', 'postal_code'], 8)] || '',
            address: row[getIndex(['住所', 'address'], 9)] || '',
            first_visit_date: row[getIndex(['初診日', 'first_visit_date'], 10)] || '',
            last_visit_date: row[getIndex(['最終来院日', 'last_visit_date'], 11)] || '',
            chart_number: chartNumber
          });
        }
      });
      
      Logger.log(`${results.length}件の患者が見つかりました`);
      return { items: results };
      
    }, '患者マスタシート検索');
  }
  
  /**
   * カルテ番号を自動加算して患者情報を順次取得
   * @param {number} startNumber - 取得開始番号（デフォルト: 1）
   * @param {number} maxConsecutiveNotFound - 連続して見つからない場合の終了閾値（デフォルト: 5）
   * @param {number} batchSize - バッチ書き込みサイズ（デフォルト: 100）
   * @param {string} chartNumberPrefix - カルテ番号のプレフィックス（デフォルト: 'CLUTIReFINEクリニック '）
   */
  syncVisitorsByChartNumber(startNumber = 1, maxConsecutiveNotFound = 5, batchSize = 100, chartNumberPrefix = 'CLUTIReFINEクリニック ') {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`カルテ番号 ${chartNumberPrefix}${startNumber} から自動探索を開始します（連続${maxConsecutiveNotFound}件見つからなかったら終了、${batchSize}件ごとに書き込み）`);
      
      // 既存のカルテ番号を取得
      const sheet = Utils.getOrCreateSheet(this.sheetName);
      const existingChartNumbers = new Set();
      
      if (sheet.getLastRow() > 1) {
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const chartNumberIndex = headers.indexOf('カルテ番号');
        
        if (chartNumberIndex !== -1) {
          for (let i = 1; i < data.length; i++) {
            const chartNumber = data[i][chartNumberIndex];
            if (chartNumber) {
              existingChartNumbers.add(chartNumber.toString());
            }
          }
        }
      }
      
      Logger.log(`既存のカルテ番号: ${existingChartNumbers.size}件`);
      
      let newVisitors = [];
      let totalFetchedCount = 0;
      let totalSkippedCount = 0;
      let consecutiveNotFoundCount = 0;
      let chartNumber = startNumber;
      let lastChartNumber = startNumber;
      let batchCount = 0;
      
      // 連続して見つからない回数が閾値に達するまで続ける
      while (consecutiveNotFoundCount < maxConsecutiveNotFound) {
        const chartNumberStr = chartNumber.toString();
        const fullChartNumber = chartNumberPrefix + chartNumberStr;
        lastChartNumber = chartNumber;
        
        // 既に取得済みの場合はスキップ（フルカルテ番号でチェック）
        if (existingChartNumbers.has(fullChartNumber)) {
          totalSkippedCount++;
          consecutiveNotFoundCount = 0; // 既存データがあるということは有効な番号なのでリセット
          chartNumber++;
          continue;
        }
        
        try {
          // カルテ番号で患者を検索（プレフィックス付きの完全なカルテ番号で検索）
          const response = this.apiClient.get('/developer/visitors', {
            clinic_id: Config.getClinicId(),
            chart_number: fullChartNumber
          });
          
          Logger.log(`カルテ番号 ${fullChartNumber}: APIレスポンス全体 = ${JSON.stringify(response)}`);
          
          // APIレスポンスの形式をチェック（items配列またはdirect data）
          let visitors = [];
          if (response.success && response.data) {
            // response.data.items がある場合
            if (response.data.items && Array.isArray(response.data.items)) {
              visitors = response.data.items;
            }
            // response.data が直接配列の場合
            else if (Array.isArray(response.data)) {
              visitors = response.data;
            }
            // response.data が単一オブジェクトの場合
            else if (typeof response.data === 'object' && response.data.visitor_id) {
              visitors = [response.data];
            }
          }
          
          if (visitors.length > 0) {
            const visitor = visitors[0]; // カルテ番号は一意のはずなので最初の1件を取得
            
            // LINE_ID情報の詳細ログ
            const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
            Logger.log(`カルテ番号 ${fullChartNumber}: LINE_ID情報 - line_id=${visitor.line_id}, LINE_ID=${visitor.LINE_ID}, line_user_id=${visitor.line_user_id}, 最終値=${lineId}`);
            
            // LINE関連の全フィールドをチェック
            const lineRelatedFields = {};
            Object.keys(visitor).forEach(key => {
              if (key.toLowerCase().includes('line')) {
                lineRelatedFields[key] = visitor[key];
              }
            });
            if (Object.keys(lineRelatedFields).length > 0) {
              Logger.log(`カルテ番号 ${fullChartNumber}: LINE関連フィールド = ${JSON.stringify(lineRelatedFields)}`);
            }
            
            Logger.log(`カルテ番号 ${fullChartNumber}: 患者データ = ${JSON.stringify(visitor)}`);
            newVisitors.push(visitor);
            totalFetchedCount++;
            consecutiveNotFoundCount = 0; // 見つかったのでリセット
            Logger.log(`カルテ番号 ${fullChartNumber}: 患者情報を取得しました（累計${totalFetchedCount}件）, LINE_ID=${lineId}`);
            
            // バッチサイズに達したらシートに書き込み
            if (newVisitors.length >= batchSize) {
              batchCount++;
              Logger.log(`バッチ${batchCount}: ${newVisitors.length}件をシートに書き込みます`);
              this._mergeVisitorsToSheet(newVisitors);
              newVisitors = []; // 配列をクリア
              Logger.log(`バッチ${batchCount}: 書き込み完了`);
            }
          } else {
            consecutiveNotFoundCount++;
            Logger.log(`カルテ番号 ${fullChartNumber}: 患者が見つかりません（連続${consecutiveNotFoundCount}件目）`);
          }
        } catch (error) {
          consecutiveNotFoundCount++;
          Logger.log(`カルテ番号 ${fullChartNumber}: エラー - ${error.toString()}（連続${consecutiveNotFoundCount}件目）`);
        }
        
        // API制限を考慮して待機
        if (totalFetchedCount % 10 === 0 && totalFetchedCount > 0) {
          Utilities.sleep(500); // 0.5秒待機
        }
        
        chartNumber++;
      }
      
      // 残りの患者をシートに追加
      if (newVisitors.length > 0) {
        batchCount++;
        Logger.log(`最終バッチ${batchCount}: ${newVisitors.length}件をシートに書き込みます`);
        this._mergeVisitorsToSheet(newVisitors);
        Logger.log(`最終バッチ${batchCount}: 書き込み完了`);
      }
      
      Logger.log(`処理完了: 新規取得 ${totalFetchedCount}件、スキップ ${totalSkippedCount}件、最後に確認したカルテ番号 ${lastChartNumber}、バッチ数 ${batchCount}`);
      
      return {
        fetched: totalFetchedCount,
        skipped: totalSkippedCount,
        lastChartNumber: lastChartNumber,
        batchCount: batchCount
      };
    }, 'カルテ番号による患者同期');
  }
  
  /**
   * 患者IDから患者の詳細情報を取得
   * @param {string} visitor_id - 患者ID
   * @returns {Object} 患者の詳細情報
   */
  getVisitorDetailById(visitor_id) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`患者詳細情報を取得: visitor_id=${visitor_id}`);
      
      // APIから患者詳細を取得
      const response = this.apiClient.get(`/developer/visitors/${visitor_id}`, {
        clinic_id: Config.getClinicId()
      });
      
      Logger.log(`APIレスポンス全体: ${JSON.stringify(response)}`);
      
      if (!response.success || !response.data) {
        throw new Error(`患者詳細情報の取得に失敗しました: visitor_id=${visitor_id}`);
      }
      
      const visitor = response.data;
      
      // LINE_ID関連の詳細情報をログ出力
      const lineId = visitor.line_id || visitor.LINE_ID || visitor.line_user_id || '';
      Logger.log(`患者詳細: visitor_id=${visitor_id}, LINE_ID=${lineId}`);
      Logger.log(`LINE_ID詳細: line_id=${visitor.line_id}, LINE_ID=${visitor.LINE_ID}, line_user_id=${visitor.line_user_id}`);
      
      // LINE関連の全フィールドを検出してログ出力
      const lineRelatedFields = {};
      Object.keys(visitor).forEach(key => {
        if (key.toLowerCase().includes('line')) {
          lineRelatedFields[key] = visitor[key];
        }
      });
      if (Object.keys(lineRelatedFields).length > 0) {
        Logger.log(`LINE関連フィールド: ${JSON.stringify(lineRelatedFields)}`);
      }
      
      // その他の重要フィールドのログ出力
      Logger.log(`氏名: ${visitor.name || visitor.visitor_name || ''}`);
      Logger.log(`カナ: ${visitor.name_kana || visitor.visitor_name_kana || ''}`);
      Logger.log(`電話番号: ${visitor.phone || ''}`);
      Logger.log(`メールアドレス: ${visitor.email || ''}`);
      Logger.log(`生年月日: ${visitor.birthday || ''}`);
      Logger.log(`性別: ${visitor.gender || ''}`);
      
      // カルテ番号の詳細
      const karteNumber = this._extractKarteNumber(visitor);
      Logger.log(`カルテ番号: ${karteNumber}`);
      if (visitor.karte_numbers) {
        Logger.log(`karte_numbers配列: ${JSON.stringify(visitor.karte_numbers)}`);
      }
      
      // 登録・更新日時
      Logger.log(`登録日時: ${visitor.created_at || ''}`);
      Logger.log(`更新日時: ${visitor.updated_at || ''}`);
      
      return visitor;
    }, '患者詳細情報取得');
  }
  
  /**
   * LINE Bot用：LINEユーザーIDから患者情報を取得
   */
  getPatientByLineId(lineUserId) {
    return Utils.executeWithErrorHandling(() => {
      Logger.log(`LINE Bot用：LINEユーザーID ${lineUserId} から患者情報を取得します`);
      
      // スプレッドシートからLINE連携情報を検索
      const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
      const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
      
      if (!lineUserSheet) {
        Logger.log('LINEユーザー情報シートが見つかりません');
        return null;
      }
      
      const data = lineUserSheet.getDataRange().getValues();
      
      // ヘッダー行をスキップして検索
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === lineUserId) { // A列：LINEユーザーID
          const patientId = data[i][1]; // B列：患者ID
          
          if (!patientId) {
            Logger.log('患者IDが設定されていません');
            return null;
          }
          
          // 患者情報を取得
          const response = this.apiClient.get(
            this.apiClient.config.endpoints.visitorById,
            {
              id: patientId
            }
          );
          
          if (response.success && response.data) {
            return response.data;
          }
        }
      }
      
      Logger.log('該当するLINEユーザーが見つかりません');
      return null;
    }, 'LINE Bot患者取得');
  }
}