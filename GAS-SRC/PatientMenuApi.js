/**
 * 患者別メニュー表示API
 * 患者の予約履歴に基づいて、初回/2回目以降のメニューを分類して返却する
 */

/**
 * 患者別メニュー情報を取得
 * @param {Object} params - リクエストパラメータ
 * @param {string} params.visitorId - 患者ID
 * @param {string} params.companyId - 会社ID（オプション）
 * @returns {Object} メニュー情報のレスポンス
 */
function getPatientMenus(params) {
  try {
    const { visitorId, companyId } = params;
    
    if (!visitorId) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message: '患者IDが指定されていません'
        }
      };
    }

    // PatientMenuServiceを使用してメニュー情報を取得
    const patientMenuService = new PatientMenuService();
    const menuData = patientMenuService.getPatientMenus(visitorId, companyId);
    
    // 来院履歴情報を取得
    const reservationService = new ReservationService();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const reservationHistory = patientMenuService.getPatientReservationHistory(visitorId, sixMonthsAgo);
    const hasVisits = reservationHistory.length > 0;
    
    // 最終来院日と来院回数を計算
    let lastVisitDate = null;
    if (hasVisits) {
      const sortedReservations = reservationHistory.sort((a, b) => 
        new Date(b['予約日時']) - new Date(a['予約日時'])
      );
      lastVisitDate = sortedReservations[0]['予約日時'].split(' ')[0]; // YYYY-MM-DD形式
    }
    
    // 推奨カテゴリーを決定
    const recommendedCategory = hasVisits ? '2回目以降メニュー' : '初回メニュー';
    
    // レスポンス形式を仕様書に合わせて整形
    const transformedMenus = transformMenuStructure(menuData.menus);
    
    return {
      status: 'success',
      data: {
        patient_info: {
          visitor_id: visitorId,
          has_company: menuData.company !== null,
          company_id: menuData.company ? menuData.company.id : null,
          company_name: menuData.company ? menuData.company.name : null
        },
        visit_history: {
          has_visits: hasVisits,
          last_visit_date: lastVisitDate,
          visit_count: reservationHistory.length,
          check_period: {
            months: 6,
            start_date: sixMonthsAgo.toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          }
        },
        ticket_balance: menuData.ticketBalance,
        recommended_category: recommendedCategory,
        menu_categories: transformedMenus
      }
    };
    
  } catch (error) {
    console.error('患者別メニュー取得エラー:', error);
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'メニュー情報の取得中にエラーが発生しました',
        details: error.toString()
      }
    };
  }
}

/**
 * メニュー構造を仕様書のフォーマットに変換
 * @param {Object} menus - PatientMenuServiceからのメニュー構造
 * @returns {Object} 変換されたメニュー構造
 */
function transformMenuStructure(menus) {
  const result = {
    '初回メニュー': {
      '通常メニュー': {},
      'チケット付与メニュー': {}
    },
    '2回目以降メニュー': {
      '通常メニュー': {},
      'チケット付与メニュー': {}
    }
  };
  
  // 元の構造から新しい構造への変換
  // 元: 通常メニュー/チケット付与メニュー -> 初回/2回目以降 -> カテゴリ
  // 新: 初回/2回目以降 -> 通常/チケット -> カテゴリ
  
  Object.entries(menus).forEach(([majorCategory, middleCategories]) => {
    Object.entries(middleCategories).forEach(([middleCategory, categories]) => {
      const targetMajor = middleCategory; // 初回メニュー or 2回目以降メニュー
      const targetMiddle = majorCategory; // 通常メニュー or チケット付与メニュー
      
      if (result[targetMajor] && result[targetMajor][targetMiddle]) {
        Object.entries(categories).forEach(([categoryName, menuList]) => {
          result[targetMajor][targetMiddle][categoryName] = menuList.map(menu => ({
            menu_id: menu.id,
            menu_name: menu.name,
            category: menu.category,
            price: menu.price || null,
            duration_minutes: menu.duration,
            display_order: menu.displayOrder,
            usage_count: menu.usageCount,
            last_used_date: menu.lastUsedDate ? 
              new Date(menu.lastUsedDate).toISOString().split('T')[0] : null,
            ticket_info: menu.ticketType ? {
              ticket_type: menu.ticketType,
              required_tickets: menu.requiredTickets,
              can_reserve: menu.canReserve
            } : null,
            can_reserve: menu.canReserve
          }));
        });
      }
    });
  });
  
  return result;
}

/**
 * 患者別メニューAPIのテスト関数
 */
function testPatientMenuApi() {
  console.log('=== 患者別メニューAPIテスト開始 ===');
  
  // テストケース1: 正常なリクエスト
  const testRequest1 = {
    visitorId: '1001',
    companyId: '1'
  };
  
  console.log('テストケース1 - 正常なリクエスト:', testRequest1);
  const result1 = getPatientMenus(testRequest1);
  console.log('結果:', JSON.stringify(result1, null, 2));
  
  // テストケース2: 患者IDなしのリクエスト
  const testRequest2 = {
    companyId: '1'
  };
  
  console.log('\nテストケース2 - 患者IDなし:', testRequest2);
  const result2 = getPatientMenus(testRequest2);
  console.log('結果:', JSON.stringify(result2, null, 2));
  
  console.log('\n=== テスト完了 ===');
}