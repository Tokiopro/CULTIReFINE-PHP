/**
 * LINE Bot テストデータ生成
 * Medical Force APIが利用できない場合でも、スプレッドシート内でテストデータを作成して機能確認を行う
 */

/**
 * テスト用の患者データを生成
 */
function generateTestPatients() {
  Logger.log('テスト用患者データを生成します...');
  
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const visitorSheet = sheet.getSheetByName(Config.getSheetNames().visitors) || sheet.insertSheet(Config.getSheetNames().visitors);
  
  // ヘッダーが無い場合は作成
  if (visitorSheet.getLastRow() === 0) {
    const headers = [
      '患者ID', '氏名', 'カナ', '生年月日', '年齢', '性別', 
      '電話番号', 'メールアドレス', '郵便番号', '住所', 
      '初診日', '最終来院日', 'カルテ番号', 'メモ', '作成日時', '更新日時'
    ];
    visitorSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    visitorSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  // テスト患者データ
  const testPatients = [
    {
      id: 'TEST001',
      name: '山田太郎',
      kana: 'ヤマダタロウ',
      birthday: '1980-05-15',
      gender: '男性',
      phone: '090-1234-5678',
      email: 'yamada@example.com',
      postal_code: '123-4567',
      address: '東京都渋谷区1-2-3',
      first_visit_date: '2024-01-15',
      last_visit_date: '2025-06-15',
      chart_number: 'C001',
      memo: 'テスト患者1'
    },
    {
      id: 'TEST002',
      name: '鈴木花子',
      kana: 'スズキハナコ',
      birthday: '1990-08-20',
      gender: '女性',
      phone: '080-2345-6789',
      email: 'suzuki@example.com',
      postal_code: '234-5678',
      address: '東京都新宿区4-5-6',
      first_visit_date: '2024-03-20',
      last_visit_date: '2025-06-20',
      chart_number: 'C002',
      memo: 'テスト患者2'
    },
    {
      id: 'TEST003',
      name: '佐藤次郎',
      kana: 'サトウジロウ',
      birthday: '1975-12-10',
      gender: '男性',
      phone: '070-3456-7890',
      email: 'sato@example.com',
      postal_code: '345-6789',
      address: '東京都世田谷区7-8-9',
      first_visit_date: '2024-06-10',
      last_visit_date: '2025-05-10',
      chart_number: 'C003',
      memo: 'テスト患者3'
    }
  ];
  
  // 既存データをクリア（ヘッダーは残す）
  if (visitorSheet.getLastRow() > 1) {
    visitorSheet.getRange(2, 1, visitorSheet.getLastRow() - 1, visitorSheet.getLastColumn()).clear();
  }
  
  // テストデータを書き込み
  const now = new Date();
  testPatients.forEach((patient, index) => {
    const age = calculateAge(patient.birthday);
    const rowData = [
      patient.id,
      patient.name,
      patient.kana,
      patient.birthday,
      age,
      patient.gender,
      patient.phone,
      patient.email,
      patient.postal_code,
      patient.address,
      patient.first_visit_date,
      patient.last_visit_date,
      patient.chart_number,
      patient.memo,
      now,
      now
    ];
    visitorSheet.getRange(index + 2, 1, 1, rowData.length).setValues([rowData]);
  });
  
  Logger.log(`${testPatients.length}件のテスト患者データを作成しました`);
  return testPatients.length;
}

/**
 * テスト用の予約データを生成
 */
function generateTestReservations() {
  Logger.log('テスト用予約データを生成します...');
  
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const reservationSheet = sheet.getSheetByName('予約情報') || sheet.insertSheet('予約情報');
  
  // ヘッダーが無い場合は作成
  if (reservationSheet.getLastRow() === 0) {
    const headers = [
      '予約ID', '患者ID', '予約日', '開始時刻', '終了時刻', 
      '診療科', '医師名', 'ステータス', 'メモ', '作成日時', '更新日時'
    ];
    reservationSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    reservationSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  // 今日から7日間の予約を生成
  const today = new Date();
  const testReservations = [];
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    
    // 各日に3-5件の予約を生成
    const appointmentsPerDay = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < appointmentsPerDay; i++) {
      const hour = 9 + Math.floor(Math.random() * 9); // 9:00-17:00
      const minute = Math.random() < 0.5 ? '00' : '30';
      const startTime = `${hour.toString().padStart(2, '0')}:${minute}`;
      const endHour = minute === '00' ? hour : hour + 1;
      const endMinute = minute === '00' ? '30' : '00';
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute}`;
      
      const departments = ['内科', '外科', '整形外科', '皮膚科', '小児科'];
      const doctors = ['山田医師', '佐藤医師', '鈴木医師', '田中医師', '高橋医師'];
      const statuses = ['confirmed', 'pending', 'completed'];
      const patientIds = ['TEST001', 'TEST002', 'TEST003'];
      
      testReservations.push({
        id: `RES${dateStr.replace(/-/g, '')}_${i + 1}`,
        patient_id: patientIds[Math.floor(Math.random() * patientIds.length)],
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        department: departments[Math.floor(Math.random() * departments.length)],
        doctor: doctors[Math.floor(Math.random() * doctors.length)],
        status: dayOffset === 0 && hour < new Date().getHours() ? 'completed' : statuses[Math.floor(Math.random() * 2)],
        memo: `テスト予約 ${dayOffset + 1}日目`
      });
    }
  }
  
  // 既存データをクリア（ヘッダーは残す）
  if (reservationSheet.getLastRow() > 1) {
    reservationSheet.getRange(2, 1, reservationSheet.getLastRow() - 1, reservationSheet.getLastColumn()).clear();
  }
  
  // テストデータを書き込み
  const now = new Date();
  testReservations.forEach((reservation, index) => {
    const rowData = [
      reservation.id,
      reservation.patient_id,
      reservation.date,
      reservation.start_time,
      reservation.end_time,
      reservation.department,
      reservation.doctor,
      reservation.status,
      reservation.memo,
      now,
      now
    ];
    reservationSheet.getRange(index + 2, 1, 1, rowData.length).setValues([rowData]);
  });
  
  Logger.log(`${testReservations.length}件のテスト予約データを作成しました`);
  return testReservations.length;
}

/**
 * テスト用の予約枠（空き時間）データを生成
 */
function generateTestVacancies() {
  Logger.log('テスト用予約枠データを生成します...');
  
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const vacancySheet = sheet.getSheetByName('予約枠') || sheet.insertSheet('予約枠');
  
  // ヘッダーが無い場合は作成
  if (vacancySheet.getLastRow() === 0) {
    const headers = [
      '予約枠ID', '日付', '開始時刻', '終了時刻', '診療科ID', 
      '診療科名', '医師名', '利用可能数', '作成日時'
    ];
    vacancySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    vacancySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  // 今日から14日間の予約枠を生成
  const today = new Date();
  const testVacancies = [];
  
  const departments = [
    { id: 'DEPT001', name: '内科' },
    { id: 'DEPT002', name: '外科' },
    { id: 'DEPT003', name: '整形外科' },
    { id: 'DEPT004', name: '皮膚科' },
    { id: 'DEPT005', name: '小児科' }
  ];
  
  const doctors = ['山田医師', '佐藤医師', '鈴木医師', '田中医師', '高橋医師'];
  
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    
    // 各診療科に対して予約枠を生成
    departments.forEach((dept, deptIndex) => {
      // 午前の部（9:00-12:00）
      for (let hour = 9; hour < 12; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const endMinute = minute + 30;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const endTime = `${endHour.toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;
          
          testVacancies.push({
            id: `VAC_${dateStr}_${dept.id}_${hour}${minute}`,
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            department_id: dept.id,
            department_name: dept.name,
            doctor_name: doctors[deptIndex % doctors.length],
            available_count: Math.floor(Math.random() * 3) + 1
          });
        }
      }
      
      // 午後の部（14:00-17:00）
      for (let hour = 14; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const endMinute = minute + 30;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const endTime = `${endHour.toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;
          
          testVacancies.push({
            id: `VAC_${dateStr}_${dept.id}_${hour}${minute}`,
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            department_id: dept.id,
            department_name: dept.name,
            doctor_name: doctors[deptIndex % doctors.length],
            available_count: Math.floor(Math.random() * 3) + 1
          });
        }
      }
    });
  }
  
  // 既存データをクリア（ヘッダーは残す）
  if (vacancySheet.getLastRow() > 1) {
    vacancySheet.getRange(2, 1, vacancySheet.getLastRow() - 1, vacancySheet.getLastColumn()).clear();
  }
  
  // テストデータを書き込み
  const now = new Date();
  testVacancies.forEach((vacancy, index) => {
    const rowData = [
      vacancy.id,
      vacancy.date,
      vacancy.start_time,
      vacancy.end_time,
      vacancy.department_id,
      vacancy.department_name,
      vacancy.doctor_name,
      vacancy.available_count,
      now
    ];
    vacancySheet.getRange(index + 2, 1, 1, rowData.length).setValues([rowData]);
  });
  
  Logger.log(`${testVacancies.length}件のテスト予約枠データを作成しました`);
  return testVacancies.length;
}

/**
 * 年齢計算
 */
function calculateAge(birthday) {
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
 * すべてのテストデータを生成
 */
function generateAllTestData() {
  Logger.log('========== テストデータ生成開始 ==========');
  
  try {
    // 患者データ生成
    const patientCount = generateTestPatients();
    
    // 予約データ生成
    const reservationCount = generateTestReservations();
    
    // 予約枠データ生成
    const vacancyCount = generateTestVacancies();
    
    // LINEユーザー情報を更新
    updateTestLineUsers();
    
    Logger.log('\n========== テストデータ生成完了 ==========');
    Logger.log(`患者: ${patientCount}件`);
    Logger.log(`予約: ${reservationCount}件`);
    Logger.log(`予約枠: ${vacancyCount}件`);
    
    return {
      success: true,
      patientCount: patientCount,
      reservationCount: reservationCount,
      vacancyCount: vacancyCount
    };
    
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * LINEテストユーザーを更新
 */
function updateTestLineUsers() {
  const sheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
  const lineUserSheet = sheet.getSheetByName('LINEユーザー情報');
  
  if (!lineUserSheet) {
    Logger.log('LINEユーザー情報シートが見つかりません');
    return;
  }
  
  // 既存データをクリア（ヘッダーは残す）
  if (lineUserSheet.getLastRow() > 1) {
    lineUserSheet.getRange(2, 1, lineUserSheet.getLastRow() - 1, lineUserSheet.getLastColumn()).clear();
  }
  
  // テストユーザーを追加
  const testUsers = [
    ['U1234567890abcdef', 'TEST001', 'テストユーザー（山田太郎）', new Date(), new Date()],
    ['U2345678901bcdef', 'TEST002', 'テストユーザー（鈴木花子）', new Date(), new Date()],
    ['U3456789012cdef', 'TEST003', 'テストユーザー（佐藤次郎）', new Date(), new Date()]
  ];
  
  testUsers.forEach((user, index) => {
    lineUserSheet.getRange(index + 2, 1, 1, user.length).setValues([user]);
  });
  
  Logger.log(`${testUsers.length}件のLINEテストユーザーを更新しました`);
}