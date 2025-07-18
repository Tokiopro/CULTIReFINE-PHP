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
        if (data.visitor) {
            const infoElement = createPatientInfoElement(data);
            container.appendChild(infoElement);
        }
        
        // メニュー表示
        if (data.menus && Object.keys(data.menus).length > 0) {
            const menuElement = createMenuAccordion(data.menus, patientId, onSelectCallback);
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
    html += '<p>名前: ' + (data.visitor.name || '---') + '</p>';
    
    if (data.company) {
        html += '<p>会社: ' + data.company.name + ' (' + data.company.plan + ')</p>';
    }
    
    if (data.ticketBalance && Object.keys(data.ticketBalance).length > 0) {
        html += '<div class="mt-2"><strong>チケット残数:</strong>';
        for (const [type, count] of Object.entries(data.ticketBalance)) {
            html += '<span class="ml-3 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">' + type + ': ' + count + '枚</span>';
        }
        html += '</div>';
    }
    
    infoDiv.innerHTML = html;
    return infoDiv;
}

/**
 * メニューアコーディオンを作成
 */
function createMenuAccordion(menus, patientId, onSelectCallback) {
    const accordionDiv = createElement('div', 'space-y-2');
    
    Object.entries(menus).forEach(([majorCategory, middleCategories]) => {
        const majorDiv = createMajorCategoryAccordion(majorCategory, middleCategories, patientId, onSelectCallback);
        accordionDiv.appendChild(majorDiv);
    });
    
    return accordionDiv;
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
    const itemDiv = createElement('div', 'p-2 rounded cursor-pointer transition-all ' + 
        (menu.canReserve ? 'bg-white hover:bg-blue-50 border border-gray-200' : 'bg-gray-100 opacity-60 cursor-not-allowed'));
    
    let html = '<div class="flex justify-between items-start">';
    html += '<div class="flex-1">';
    html += '<div class="font-medium">' + menu.name + '</div>';
    html += '<div class="text-sm text-gray-600">';
    html += '時間: ' + menu.duration + '分';
    
    if (menu.ticketType) {
        html += ' | ' + menu.ticketType + 'チケット: ' + menu.requiredTickets + '枚';
    } else if (menu.price) {
        html += ' | ¥' + menu.price.toLocaleString();
    }
    
    if (menu.usageCount > 0) {
        html += ' | 利用回数: ' + menu.usageCount + '回';
    }
    
    html += '</div>';
    
    if (!menu.canReserve && menu.reason) {
        html += '<div class="text-xs text-red-600 mt-1">※ ' + menu.reason;
        if (menu.nextAvailableDate) {
            const date = new Date(menu.nextAvailableDate);
            html += ' (次回可能日: ' + date.toLocaleDateString('ja-JP') + ')';
        }
        html += '</div>';
    }
    
    html += '</div>';
    html += '</div>';
    
    itemDiv.innerHTML = html;
    
    if (menu.canReserve && onSelectCallback) {
        itemDiv.onclick = () => onSelectCallback(menu, patientId);
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