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
        
        // 患者情報表示
        if (data.patient_info || data.visitor) {
            const infoElement = createPatientInfoElement(data);
            container.appendChild(infoElement);
        }
        
        // メニュー表示
        const menuCategories = data.menu_categories || data.menus;
        if (menuCategories && Object.keys(menuCategories).length > 0) {
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
    html += '<p>名前: ' + (patientInfo.name || '---') + '</p>';
    
    if (patientInfo.company_id || data.company) {
        const companyName = data.company ? data.company.name : patientInfo.company_id;
        html += '<p>会社: ' + companyName;
        if (data.company && data.company.plan) {
            html += ' (' + data.company.plan + ')';
        }
        html += '</p>';
    }
    
    // 来院履歴表示
    if (data.visit_history) {
        html += '<p>来院履歴: ';
        if (data.visit_history.has_visits) {
            html += data.visit_history.visit_count + '回 (最終: ' + data.visit_history.last_visit_date + ')';
        } else {
            html += '初回来院';
        }
        html += '</p>';
    }
    
    // チケット残数表示
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
    
    // 新形式の場合
    if (menuCategories.first_time_menus || menuCategories.repeat_menus) {
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
    } else {
        // 旧形式の場合
        Object.entries(menuCategories).forEach(([majorCategory, middleCategories]) => {
            const majorDiv = createMajorCategoryAccordion(majorCategory, middleCategories, patientId, onSelectCallback);
            accordionDiv.appendChild(majorDiv);
        });
    }
    
    return accordionDiv;
}

/**
 * 新形式のカテゴリアコーディオンを作成
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
    // 新形式と旧形式の両方に対応
    const menuId = menu.menu_id || menu.id;
    const menuName = menu.menu_name || menu.name;
    const duration = menu.duration_minutes || menu.duration;
    const canReserve = menu.is_available !== undefined ? menu.is_available : menu.canReserve;
    
    const itemDiv = createElement('div', 'p-2 rounded cursor-pointer transition-all ' + 
        (canReserve ? 'bg-white hover:bg-blue-50 border border-gray-200' : 'bg-gray-100 opacity-60 cursor-not-allowed'));
    
    let html = '<div class="flex justify-between items-start">';
    html += '<div class="flex-1">';
    html += '<div class="font-medium">' + menuName + '</div>';
    html += '<div class="text-sm text-gray-600">';
    html += '時間: ' + duration + '分';
    
    // 新形式のチケット情報
    if (menu.requires_ticket) {
        const ticketTypeLabels = {
            'stem_cell': '幹細胞',
            'treatment': '施術',
            'drip': '点滴'
        };
        const ticketLabel = ticketTypeLabels[menu.ticket_type] || menu.ticket_type;
        html += ' | ' + ticketLabel + 'チケット: ' + menu.ticket_consumption + '枚';
    } else if (menu.ticketType) {
        // 旧形式
        html += ' | ' + menu.ticketType + 'チケット: ' + menu.requiredTickets + '枚';
    } else if (menu.price) {
        html += ' | ¥' + menu.price.toLocaleString();
    }
    
    // カテゴリ表示（新形式）
    if (menu.category) {
        html += ' | ' + menu.category;
    }
    
    // 利用回数（旧形式）
    if (menu.usageCount > 0) {
        html += ' | 利用回数: ' + menu.usageCount + '回';
    }
    
    html += '</div>';
    
    // 説明（新形式）
    if (menu.description) {
        html += '<div class="text-xs text-gray-600 mt-1">' + menu.description + '</div>';
    }
    
    // 利用不可理由
    if (!canReserve) {
        const reason = menu.availability_reason || menu.reason;
        if (reason) {
            html += '<div class="text-xs text-red-600 mt-1">※ ' + reason;
            if (menu.nextAvailableDate) {
                const date = new Date(menu.nextAvailableDate);
                html += ' (次回可能日: ' + date.toLocaleDateString('ja-JP') + ')';
            }
            html += '</div>';
        }
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