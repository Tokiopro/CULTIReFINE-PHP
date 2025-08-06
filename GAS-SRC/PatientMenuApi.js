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
    first_time_menus: {
      category: '初回メニュー',
      description: '初めてご来院の方向けのメニューです',
      subcategories: {}
    },
    repeat_menus: {
      category: '2回目以降メニュー', 
      description: 'リピーターの方向けのメニューです',
      subcategories: {}
    },
    ticket_menus: {
      category: 'チケットメニュー',
      description: 'チケットをご利用いただけるメニューです',
      subcategories: {}
    }
  };

  // メニューをカテゴリごとにグループ化
  menus.forEach(menu => {
    let targetCategory;
    let subcategoryName = menu.category || '未分類';
    
    // メニュータイプによって振り分け
    if (menu.menu_type === '初回メニュー' || menu.is_first_time) {
      targetCategory = result.first_time_menus;
    } else if (menu.is_ticket_menu || menu.menu_type === 'チケットメニュー') {
      targetCategory = result.ticket_menus;
    } else {
      targetCategory = result.repeat_menus;
    }
    
    // サブカテゴリーが存在しない場合は作成
    if (!targetCategory.subcategories[subcategoryName]) {
      targetCategory.subcategories[subcategoryName] = {
        category: subcategoryName,
        menus: []
      };
    }
    
    // メニュー情報を整形して追加
    const transformedMenu = {
      menu_id: menu.menu_id,
      base_menu_id: menu.base_menu_id || menu.menu_id,
      name: menu.name,
      duration_minutes: menu.duration_minutes,
      description: menu.description,
      can_reserve: menu.can_reserve,
      availability_reason: menu.availability_reason,
      usage_count: menu.usage_count || 0
    };
    
    // チケットメニューの場合は追加情報
    if (menu.is_ticket_menu) {
      transformedMenu.ticket_type = menu.ticket_type;
      transformedMenu.required_tickets = menu.required_tickets;
      transformedMenu.ticket_balance = menu.ticket_balance;
    } else {
      transformedMenu.price = menu.price || 0;
      transformedMenu.price_with_tax = menu.price_with_tax || menu.price || 0;
    }
    
    targetCategory.subcategories[subcategoryName].menus.push(transformedMenu);
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