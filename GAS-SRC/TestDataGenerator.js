/**
 * Medical Force テストデータ生成ツール
 * 
 * 注意：このファイルは開発・テスト用です。
 * 本番環境では使用しないでください。
 */

/**
 * ダミー患者データを生成して登録
 * @param {number} count - 生成する患者数（デフォルト: 5）
 */
function createDummyPatients(count = 5) {
  const ui = SpreadsheetApp.getUi();
  
  // 確認ダイアログ
  const response = ui.alert(
    'テストデータ生成',
    `${count}件のダミー患者データをMedical Forceに登録します。\n本当に実行しますか？`,
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const service = new VisitorService();
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  
  try {
    for (let i = 1; i <= count; i++) {
      const dummyPatient = generateDummyPatient(i);
      
      try {
        Logger.log(`ダミー患者 ${i}/${count} を登録中: ${dummyPatient.name}`);
        const result = service.createVisitor(dummyPatient);
        
        results.push({
          success: true,
          data: result,
          patient: dummyPatient
        });
        successCount++;
        
        // API制限を考慮して少し待機
        Utilities.sleep(500);
        
      } catch (error) {
        Logger.log(`患者登録エラー: ${error.toString()}`);
        results.push({
          success: false,
          error: error.toString(),
          patient: dummyPatient
        });
        errorCount++;
      }
    }
    
    // 結果を表示
    const message = `ダミーデータ生成完了\n\n` +
      `成功: ${successCount}件\n` +
      `エラー: ${errorCount}件`;
    
    ui.alert('実行結果', message, ui.ButtonSet.OK);
    
    // 詳細ログを出力
    Logger.log('=== ダミーデータ生成結果 ===');
    results.forEach((result, index) => {
      if (result.success) {
        Logger.log(`✓ ${index + 1}: ${result.patient.name} (ID: ${result.data.visitor_id || result.data.id})`);
      } else {
        Logger.log(`✗ ${index + 1}: ${result.patient.name} - ${result.error}`);
      }
    });
    
    // 患者マスタを更新
    service.syncVisitors({ limit: 20 });
    
    return results;
    
  } catch (error) {
    ui.alert('エラー', `処理中にエラーが発生しました: ${error.toString()}`, ui.ButtonSet.OK);
    throw error;
  }
}

/**
 * ダミー患者データを生成
 */
function generateDummyPatient(index) {
  // 姓のリスト
  const lastNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
  const lastNamesKana = ['サトウ', 'スズキ', 'タカハシ', 'タナカ', 'イトウ', 'ワタナベ', 'ヤマモト', 'ナカムラ', 'コバヤシ', 'カトウ'];
  
  // 名のリスト（男性）
  const maleFirstNames = ['太郎', '一郎', '次郎', '三郎', '健太', '翔太', '大輝', '雄大', '拓海', '健一'];
  const maleFirstNamesKana = ['タロウ', 'イチロウ', 'ジロウ', 'サブロウ', 'ケンタ', 'ショウタ', 'ダイキ', 'ユウダイ', 'タクミ', 'ケンイチ'];
  
  // 名のリスト（女性）
  const femaleFirstNames = ['花子', '美咲', '愛', '優子', '真由美', '由美子', '幸子', '智子', '陽子', '恵子'];
  const femaleFirstNamesKana = ['ハナコ', 'ミサキ', 'アイ', 'ユウコ', 'マユミ', 'ユミコ', 'サチコ', 'トモコ', 'ヨウコ', 'ケイコ'];
  
  // ランダムに性別を決定
  const isMale = Math.random() < 0.5;
  const gender = isMale ? 'MALE' : 'FEMALE';
  
  // 名前をランダムに選択
  const lastNameIndex = Math.floor(Math.random() * lastNames.length);
  const firstNameIndex = Math.floor(Math.random() * 10);
  
  const lastName = lastNames[lastNameIndex];
  const lastNameKana = lastNamesKana[lastNameIndex];
  const firstName = isMale ? maleFirstNames[firstNameIndex] : femaleFirstNames[firstNameIndex];
  const firstNameKana = isMale ? maleFirstNamesKana[firstNameIndex] : femaleFirstNamesKana[firstNameIndex];
  
  // 生年月日をランダムに生成（20歳～80歳）
  const birthYear = new Date().getFullYear() - Math.floor(Math.random() * 60 + 20);
  const birthMonth = String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0');
  const birthDay = String(Math.floor(Math.random() * 28 + 1)).padStart(2, '0');
  const birthday = `${birthYear}-${birthMonth}-${birthDay}`;
  
  // 電話番号を生成
  const phonePrefix = ['090', '080', '070'][Math.floor(Math.random() * 3)];
  const phoneNumber = `${phonePrefix}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  
  // メールアドレスを生成（ローマ字変換）
  // 姓のローマ字マッピング
  const lastNameRomaji = {
    '佐藤': 'sato', '鈴木': 'suzuki', '高橋': 'takahashi', '田中': 'tanaka', '伊藤': 'ito',
    '渡辺': 'watanabe', '山本': 'yamamoto', '中村': 'nakamura', '小林': 'kobayashi', '加藤': 'kato'
  };
  
  // 名のローマ字マッピング（男性）
  const maleFirstNameRomaji = {
    '太郎': 'taro', '一郎': 'ichiro', '次郎': 'jiro', '三郎': 'saburo', '健太': 'kenta',
    '翔太': 'shota', '大輝': 'daiki', '雄大': 'yudai', '拓海': 'takumi', '健一': 'kenichi'
  };
  
  // 名のローマ字マッピング（女性）
  const femaleFirstNameRomaji = {
    '花子': 'hanako', '美咲': 'misaki', '愛': 'ai', '優子': 'yuko', '真由美': 'mayumi',
    '由美子': 'yumiko', '幸子': 'sachiko', '智子': 'tomoko', '陽子': 'yoko', '恵子': 'keiko'
  };
  
  // ローマ字変換
  const lastNameEn = lastNameRomaji[lastName] || 'test';
  const firstNameEn = isMale ? 
    (maleFirstNameRomaji[firstName] || 'user') : 
    (femaleFirstNameRomaji[firstName] || 'user');
  
  // メールアドレス生成
  const emailUser = `${lastNameEn}.${firstNameEn}.${String(index).padStart(3, '0')}`;
  const emailDomains = ['example.com', 'test.jp', 'demo.co.jp'];
  const email = `${emailUser}@${emailDomains[Math.floor(Math.random() * emailDomains.length)]}`;
  
  // 住所を生成
  const prefectures = ['東京都', '神奈川県', '埼玉県', '千葉県', '大阪府', '愛知県', '福岡県'];
  const cities = ['渋谷区', '新宿区', '港区', '中央区', '千代田区', '品川区', '目黒区'];
  const address = `${prefectures[Math.floor(Math.random() * prefectures.length)]}${cities[Math.floor(Math.random() * cities.length)]}テスト町${index}-${Math.floor(Math.random() * 100 + 1)}-${Math.floor(Math.random() * 20 + 1)}`;
  
  // 患者データを構成
  const patient = {
    name: `${lastName} ${firstName}`,
    name_kana: lastNameKana + firstNameKana,
    first_name: firstName,
    last_name: lastName,
    first_name_kana: firstNameKana,
    last_name_kana: lastNameKana,
    gender: gender,
    birthday: birthday,
    phone: phoneNumber,
    email: email,
    address: address,
    code: `TEST${String(index).padStart(5, '0')}`,
    karte_number: `T${birthYear.toString().slice(-2)}${String(index).padStart(4, '0')}`,
    is_subscribed: Math.random() < 0.7, // 70%の確率でメール配信希望
    memo: `テストデータ ${index} - ${new Date().toLocaleString('ja-JP')}`
  };
  
  return patient;
}

/**
 * 生成したテストデータを削除
 * 注意：コードが"TEST"で始まる患者のみ削除対象
 */
function deleteTestPatients() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '警告',
    'テストデータ（患者コードが"TEST"で始まる患者）を削除しますか？\n\nこの操作は取り消せません。',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    // 現在この機能はMedical Force APIでサポートされていない可能性があります
    // 実装する場合は、APIの削除エンドポイントを確認する必要があります
    
    ui.alert('情報', 'Medical Force APIには患者削除のエンドポイントがない可能性があります。\n手動での削除が必要です。', ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('エラー', error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 単一のテスト患者を作成（カスタムデータ）
 */
function createSingleTestPatient() {
  const testPatient = {
    name: 'テスト 太郎',
    name_kana: 'テストタロウ',
    first_name: '太郎',
    last_name: 'テスト',
    first_name_kana: 'タロウ',
    last_name_kana: 'テスト',
    gender: 'MALE',
    birthday: '1990-01-01',
    phone: '090-0000-0000',
    email: 'test@example.com',
    address: '東京都渋谷区テスト1-2-3',
    code: 'TEST00001',
    // karte_number: 'T900001', // Medical Force側で自動採番させる
    is_subscribed: true,
    memo: 'APIテスト用患者データ'
  };
  
  try {
    const service = new VisitorService();
    const result = service.createVisitor(testPatient);
    
    Logger.log('テスト患者を作成しました:');
    Logger.log(result);
    
    SpreadsheetApp.getUi().alert(
      '成功',
      `テスト患者を作成しました。\n\n患者ID: ${result.visitor_id || result.id}\n氏名: ${result.name}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return result;
    
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    SpreadsheetApp.getUi().alert('エラー', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}