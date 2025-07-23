// components/patient-menu-loader.js
// 患者別メニューをロードして表示するモジュール

import { getPatientMenus } from '../data/gas-api.js';
import { createElement } from '../core/ui-helpers.js';

/**
 * 患者別メニューをロードして表示
 * @param {string} containerId - メニューを表示するコンテナのID
 * @param {string} patientId - 患者ID
 * @param {string} companyId - 会社ID（オプション）
 * @param {function} onSelectCallback - メニュー選択時のコールバック
 */
export async function loadPatientMenus(containerId, patientId, companyId, onSelectCallback) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Menu container not found:', containerId);
        return;
    }
    
    // ローディング表示
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner"></div><p class="mt-2">メニューを読み込んでいます...</p></div>';
    
    try {
        // 患者別メニューを取得
        const result = await getPatientMenus(patientId, companyId);
        
        if (!result.success) {
            throw new Error(result.message || 'メニューの取得に失敗しました');
        }
        
        const data = result.data;
        container.innerHTML = '';
        
        // 患者情報表示（新形式対応）
        if (data.patient_info || data.visitor) {
            const infoElement = createPatientInfoElement(data);
            container.appendChild(infoElement);
        }
        
        // メニュー表示（新形式のcategories配列に対応）
        const menuCategories = data.categories || data.menu_categories || data.menus;
        if (menuCategories && (Array.isArray(menuCategories) ? menuCategories.length > 0 : Object.keys(menuCategories).length > 0)) {
            const menuElement = createMenuAccordion(menuCategories, data.recommended_category, patientId, onSelectCallback);
            container.appendChild(menuElement);
        } else {
            container.innerHTML += '<p class="text-center text-gray-500 py-8">利用可能なメニューがありません</p>';
        }
        
    } catch (error) {
        console.error('Error loading patient menus:', error);
        container.innerHTML = '<div class="text-center text-red-600 py-8"><p>メニューの読み込みに失敗しました</p><p class="text-sm mt-2">' + error.message + '</p></div>';
    }
}

/**
 * 患者情報表示要素を作成
 */
function createPatientInfoElement(data) {
    const infoDiv = createElement('div', 'bg-gray-50 rounded-lg p-4 mb-4');
    
    let html = '<h3 class="font-bold text-lg mb-2">患者情報</h3>';
    
    // 新・旧両方の形式に対応
    const patientInfo = data.patient_info || data.visitor;
    const companyInfo = data.company_info || data.company;
    
    if (patientInfo && patientInfo.visitor_id) {
        html += '<p>患者ID: ' + patientInfo.visitor_id + '</p>';
    }
    
    // 会社情報表示（新形式対応）
    if (companyInfo) {
        html += '<p>会社: ' + (companyInfo.name || companyInfo.company_name || '---');
        if (companyInfo.plan) {
            html += ' (' + companyInfo.plan + ')';
        }
        html += '</p>';
    }
    
    // 来院履歴表示（新形式対応）
    if (patientInfo) {
        if (patientInfo.has_visit_history !== undefined) {
            // 新形式
            html += '<p>来院履歴: ';
            if (patientInfo.has_visit_history) {
                html += patientInfo.visit_count_6months + '回 (最終: ' + patientInfo.last_visit_date + ')';
            } else {
                html += '初回来院';
            }
            html += '</p>';
        } else if (data.visit_history) {
            // 旧形式（後方互換性）
            html += '<p>来院履歴: ';
            if (data.visit_history.has_visits) {
                html += data.visit_history.visit_count + '回 (最終: ' + data.visit_history.last_visit_date + ')';
            } else {
                html += '初回来院';
            }
            html += '</p>';
        }
    }
    
    // チケット残数表示（新形式対応）
    const ticketBalance = data.ticket_balance || data.ticketBalance;
    if (ticketBalance && Object.keys(ticketBalance).length > 0) {
        html += '<div class="mt-2"><strong>チケット残数:</strong>';
        
        // 新形式のチケット名
        const ticketLabels = {
            'stem_cell': '幹細胞',
            'treatment': '施術',
            'drip': '点滴'
        };
        
        for (const [type, count] of Object.entries(ticketBalance)) {
            if (count > 0) {
                const label = ticketLabels[type] || type;
                html += '<span class="ml-3 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">' + label + ': ' + count + '枚</span>';
            }
        }
        html += '</div>';
    }
    
    infoDiv.innerHTML = html;
    return infoDiv;
}

/**
 * メニューアコーディオンを作成
 */
function createMenuAccordion(menuCategories, recommendedCategory, patientId, onSelectCallback) {
    const accordionDiv = createElement('div', 'space-y-2');
    
    // 新形式のcategories配列の場合
    if (Array.isArray(menuCategories)) {
        menuCategories.forEach(category => {
            if (category.menus && category.menus.length > 0) {
                const categoryDiv = createCategoryAccordion(category, patientId, onSelectCallback);
                accordionDiv.appendChild(categoryDiv);
            }
        });
    }
    // 中間形式（first_time_menus/repeat_menus）の場合  
    else if (menuCategories.first_time_menus || menuCategories.repeat_menus) {
        // 推奨カテゴリを先に表示
        const categoryOrder = recommendedCategory === 'first_time_menus' 
            ? ['first_time_menus', 'repeat_menus']
            : ['repeat_menus', 'first_time_menus'];
        
        const categoryLabels = {
            'first_time_menus': '初回メニュー',
            'repeat_menus': 'リピートメニュー'
        };
        
        categoryOrder.forEach(categoryKey => {
            if (menuCategories[categoryKey]) {
                const label = categoryLabels[categoryKey] + (categoryKey === recommendedCategory ? ' （推奨）' : '');
                const categoryDiv = createNewFormatCategoryAccordion(label, menuCategories[categoryKey], patientId, onSelectCallback);
                accordionDiv.appendChild(categoryDiv);
            }
        });
    } 
    // 旧形式の場合
    else {
        Object.entries(menuCategories).forEach(([majorCategory, middleCategories]) => {
            const majorDiv = createMajorCategoryAccordion(majorCategory, middleCategories, patientId, onSelectCallback);
            accordionDiv.appendChild(majorDiv);
        });
    }
    
    return accordionDiv;
}

/**
 * 新形式のカテゴリアコーディオンを作成（categories配列用）
 */
function createCategoryAccordion(category, patientId, onSelectCallback) {
    const categoryDiv = createElement('div', 'border border-gray-200 rounded-lg');
    const categoryId = 'cat-' + category.category_id;
    const contentId = 'content-' + categoryId;
    
    // ヘッダー
    const headerButton = createElement('button', 'w-full px-4 py-3 text-left font-medium hover:bg-gray-50 flex justify-between items-center');
    headerButton.innerHTML = category.category_name + '<span class="accordion-arrow">▼</span>';
    headerButton.onclick = () => toggleMenuAccordion(categoryId, contentId);
    headerButton.id = categoryId;
    
    // コンテンツ
    const contentDiv = createElement('div', 'hidden px-4 py-2');
    contentDiv.id = contentId;
    
    // メニューアイテムを直接追加
    const itemsDiv = createElement('div', 'space-y-2');
    category.menus.forEach(menu => {
        if (menu.should_display) {
            const menuItem = createMenuItem(menu, patientId, onSelectCallback);
            itemsDiv.appendChild(menuItem);
        }
    });
    
    contentDiv.appendChild(itemsDiv);
    categoryDiv.appendChild(headerButton);
    categoryDiv.appendChild(contentDiv);
    
    return categoryDiv;
}

/**
 * 中間形式のカテゴリアコーディオンを作成
 */
function createNewFormatCategoryAccordion(categoryName, subCategories, patientId, onSelectCallback) {
    const categoryDiv = createElement('div', 'border border-gray-200 rounded-lg');
    const categoryId = 'cat-' + categoryName.replace(/[^a-zA-Z0-9]/g, '');
    const contentId = 'content-' + categoryId;
    
    // ヘッダー
    const headerButton = createElement('button', 'w-full px-4 py-3 text-left font-medium hover:bg-gray-50 flex justify-between items-center');
    headerButton.innerHTML = categoryName + '<span class="accordion-arrow">▼</span>';
    headerButton.onclick = () => toggleMenuAccordion(categoryId, contentId);
    headerButton.id = categoryId;
    
    // コンテンツ
    const contentDiv = createElement('div', 'hidden px-4 py-2');
    contentDiv.id = contentId;
    
    // サブカテゴリ（通常/チケット制）を追加
    const subCategoryLabels = {
        'regular': '通常メニュー',
        'ticket_based': 'チケット制メニュー'
    };
    
    Object.entries(subCategoryLabels).forEach(([subKey, subLabel]) => {
        if (subCategories[subKey] && subCategories[subKey].length > 0) {
            const subDiv = createElement('div', 'mb-4');
            subDiv.innerHTML = '<h4 class="font-medium text-gray-700 mb-2">' + subLabel + '</h4>';
            
            const itemsDiv = createElement('div', 'space-y-2 ml-4');
            subCategories[subKey].forEach(menu => {
                const menuItem = createMenuItem(menu, patientId, onSelectCallback);
                itemsDiv.appendChild(menuItem);
            });
            
            subDiv.appendChild(itemsDiv);
            contentDiv.appendChild(subDiv);
        }
    });
    
    categoryDiv.appendChild(headerButton);
    categoryDiv.appendChild(contentDiv);
    
    return categoryDiv;
}

/**
 * 大カテゴリアコーディオンを作成
 */
function createMajorCategoryAccordion(categoryName, middleCategories, patientId, onSelectCallback) {
    const categoryDiv = createElement('div', 'border border-gray-200 rounded-lg');
    const categoryId = 'major-' + categoryName.replace(/[^a-zA-Z0-9]/g, '');
    const contentId = 'content-' + categoryId;
    
    // ヘッダー
    const headerButton = createElement('button', 'w-full px-4 py-3 text-left font-medium hover:bg-gray-50 flex justify-between items-center');
    headerButton.innerHTML = categoryName + '<span class="accordion-arrow">▼</span>';
    headerButton.onclick = () => toggleMenuAccordion(categoryId, contentId);
    headerButton.id = categoryId;
    
    // コンテンツ
    const contentDiv = createElement('div', 'hidden px-4 py-2');
    contentDiv.id = contentId;
    
    // 中カテゴリを追加
    Object.entries(middleCategories).forEach(([middleCategory, smallCategories]) => {
        const middleDiv = createMiddleCategoryAccordion(middleCategory, smallCategories, patientId, onSelectCallback);
        contentDiv.appendChild(middleDiv);
    });
    
    categoryDiv.appendChild(headerButton);
    categoryDiv.appendChild(contentDiv);
    
    return categoryDiv;
}

/**
 * 中カテゴリアコーディオンを作成
 */
function createMiddleCategoryAccordion(categoryName, smallCategories, patientId, onSelectCallback) {
    const categoryDiv = createElement('div', 'ml-4 border-l-2 border-gray-200 pl-4 mb-2');
    const categoryId = 'middle-' + categoryName.replace(/[^a-zA-Z0-9]/g, '');
    const contentId = 'content-' + categoryId;
    
    // ヘッダー
    const headerButton = createElement('button', 'w-full py-2 text-left font-medium text-sm hover:bg-gray-50 flex justify-between items-center');
    headerButton.innerHTML = categoryName + '<span class="accordion-arrow text-xs">▼</span>';
    headerButton.onclick = () => toggleMenuAccordion(categoryId, contentId);
    headerButton.id = categoryId;
    
    // コンテンツ
    const contentDiv = createElement('div', 'hidden py-1');
    contentDiv.id = contentId;
    
    // 小カテゴリとメニューを追加
    Object.entries(smallCategories).forEach(([smallCategory, menuItems]) => {
        const smallDiv = createElement('div', 'ml-4 mb-2');
        smallDiv.innerHTML = '<h5 class="text-sm font-medium text-gray-700 mb-1">' + smallCategory + '</h5>';
        
        const itemsDiv = createElement('div', 'space-y-1');
        menuItems.forEach(menu => {
            const menuItem = createMenuItem(menu, patientId, onSelectCallback);
            itemsDiv.appendChild(menuItem);
        });
        
        smallDiv.appendChild(itemsDiv);
        contentDiv.appendChild(smallDiv);
    });
    
    categoryDiv.appendChild(headerButton);
    categoryDiv.appendChild(contentDiv);
    
    return categoryDiv;
}

/**
 * メニューアイテムを作成
 */
function createMenuItem(menu, patientId, onSelectCallback) {
    // 新形式に対応（旧形式との互換性も維持）
    const menuId = menu.menu_id || menu.id;
    const menuName = menu.name || menu.menu_name;
    const duration = menu.duration_minutes || menu.duration;
    const canReserve = menu.can_reserve !== undefined ? menu.can_reserve : (menu.is_available !== undefined ? menu.is_available : menu.canReserve);
    const price = menu.price;
    
    const itemDiv = createElement('div', 'p-3 rounded cursor-pointer transition-all ' + 
        (canReserve ? 'bg-white hover:bg-blue-50 border border-gray-200' : 'bg-gray-100 opacity-60 cursor-not-allowed'));
    
    let html = '<div class="flex justify-between items-start">';
    html += '<div class="flex-1">';
    html += '<div class="font-medium">' + menuName + '</div>';
    
    // メニュータイプ表示（新形式）
    if (menu.menu_type) {
        html += '<div class="text-xs text-blue-600 mb-1">' + menu.menu_type;
        if (menu.is_first_time) {
            html += ' (初回限定)';
        }
        html += '</div>';
    }
    
    html += '<div class="text-sm text-gray-600">';
    html += '時間: ' + duration + '分';
    
    // 価格表示
    if (price) {
        html += ' | ¥' + price.toLocaleString();
    }
    
    // チケットメニューの場合
    if (menu.is_ticket_menu) {
        html += ' | チケットメニュー';
    }
    
    // 利用回数表示（新形式）
    if (menu.usage_count !== undefined) {
        html += ' | 利用回数: ' + menu.usage_count + '回';
    }
    
    html += '</div>';
    
    // 説明表示（新形式）
    if (menu.description) {
        html += '<div class="text-xs text-gray-600 mt-1">' + menu.description + '</div>';
    }
    
    // 予約不可理由表示
    if (!canReserve) {
        const reason = menu.reason || menu.availability_reason;
        if (reason) {
            html += '<div class="text-xs text-red-600 mt-1">※ ' + reason + '</div>';
        } else {
            html += '<div class="text-xs text-red-600 mt-1">※ 現在予約できません</div>';
        }
    }
    
    html += '</div>';
    
    // 予約可能ステータス表示
    html += '<div class="ml-2 text-right">';
    if (canReserve) {
        html += '<span class="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">予約可</span>';
    } else {
        html += '<span class="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">予約不可</span>';
    }
    html += '</div>';
    
    html += '</div>';
    
    itemDiv.innerHTML = html;
    
    if (canReserve && onSelectCallback) {
        itemDiv.onclick = () => onSelectCallback({
            id: menuId,
            name: menuName,
            ...menu
        }, patientId);
    }
    
    return itemDiv;
}

/**
 * アコーディオンの開閉
 */
function toggleMenuAccordion(triggerId, contentId) {
    const trigger = document.getElementById(triggerId);
    const content = document.getElementById(contentId);
    
    if (!trigger || !content) return;
    
    const isOpen = !content.classList.contains('hidden');
    
    if (isOpen) {
        content.classList.add('hidden');
        trigger.querySelector('.accordion-arrow').innerHTML = '▼';
    } else {
        content.classList.remove('hidden');
        trigger.querySelector('.accordion-arrow').innerHTML = '▲';
    }
}