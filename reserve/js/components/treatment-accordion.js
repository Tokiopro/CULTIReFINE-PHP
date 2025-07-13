// components/treatment-accordion.js
// 新しい階層構造に対応した施術メニューアコーディオンコンポーネント

import { treatmentCategories } from '../data/treatment-data.js';
import { createElement } from '../core/ui-helpers.js';

export function createTreatmentAccordion(containerId, patientId) {
    var container = document.getElementById(containerId);
    if (!container) {
        console.error('Treatment accordion container not found:', containerId);
        return;
    }
    
    container.innerHTML = '';

    for (var i = 0; i < treatmentCategories.length; i++) {
        var category = treatmentCategories[i];
        var categoryElement = createMainCategoryAccordion(category, containerId, patientId);
        container.appendChild(categoryElement);
    }
}

function createMainCategoryAccordion(category, containerId, patientId) {
    var categoryElement = createElement('div', 'border-b border-gray-200 last:border-b-0');
    
    var triggerId = 'trigger-' + category.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
    var contentId = 'content-' + category.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
    
    var subItemsHtml = '';
    for (var j = 0; j < category.items.length; j++) {
        var item = category.items[j];
        if (item.isSubCategory) {
            subItemsHtml += createSubCategoryHtml(item, containerId, patientId);
        } else {
            // 直接的な施術アイテム（従来の形式との互換性のため）
            var itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
            subItemsHtml += createTreatmentItemHtml(item, patientId, itemJson);
        }
    }
    
    categoryElement.innerHTML = 
        '<button class="accordion-trigger w-full px-4 py-3 text-left font-medium hover:bg-slate-50 flex justify-between items-center" ' +
                'id="' + triggerId + '" ' +
                'onclick="toggleAccordion(\'' + triggerId + '\', \'' + contentId + '\')">' +
            category.name +
            '<span class="accordion-arrow">▼</span>' +
        '</button>' +
        '<div class="accordion-content hidden px-4 pt-2 pb-4 bg-white border-t border-gray-200" id="' + contentId + '">' +
            '<div class="space-y-2">' + subItemsHtml + '</div>' +
        '</div>';

    return categoryElement;
}

function createSubCategoryHtml(subCategory, containerId, patientId) {
    var subTriggerId = 'sub-trigger-' + subCategory.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
    var subContentId = 'sub-content-' + subCategory.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
    
    var subItemsHtml = '';
    
    if (subCategory.subItems) {
        // さらにサブカテゴリがある場合
        for (var k = 0; k < subCategory.subItems.length; k++) {
            var subItem = subCategory.subItems[k];
            if (subItem.isSubSubCategory && subItem.treatments) {
                // 3層目：幹細胞培養上清液のような場合
                subItemsHtml += createSubSubCategoryHtml(subItem, containerId, patientId);
            } else {
                // 2層目で終わり：美容施術のような場合
                var itemJson = JSON.stringify(subItem).replace(/"/g, '&quot;');
                subItemsHtml += createTreatmentItemHtml(subItem, patientId, itemJson);
            }
        }
    }
    
    return '<div class="ml-4 border-l-2 border-teal-200">' +
               '<button class="accordion-trigger w-full px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 flex justify-between items-center" ' +
                       'id="' + subTriggerId + '" ' +
                       'onclick="toggleAccordion(\'' + subTriggerId + '\', \'' + subContentId + '\')">' +
                   subCategory.name +
                   '<span class="accordion-arrow text-xs">▼</span>' +
               '</button>' +
               '<div class="accordion-content hidden px-3 pt-1 pb-2" id="' + subContentId + '">' +
                   '<div class="space-y-1">' + subItemsHtml + '</div>' +
               '</div>' +
           '</div>';
}

function createSubSubCategoryHtml(subSubCategory, containerId, patientId) {
    var subSubTriggerId = 'subsub-trigger-' + subSubCategory.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
    var subSubContentId = 'subsub-content-' + subSubCategory.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
    
    var treatmentsHtml = '';
    for (var l = 0; l < subSubCategory.treatments.length; l++) {
        var treatment = subSubCategory.treatments[l];
        var itemJson = JSON.stringify(treatment).replace(/"/g, '&quot;');
        treatmentsHtml += createTreatmentItemHtml(treatment, patientId, itemJson);
    }
    
    return '<div class="ml-4 border-l-2 border-blue-200">' +
               '<button class="accordion-trigger w-full px-2 py-1 text-left text-xs font-medium hover:bg-slate-50 flex justify-between items-center" ' +
                       'id="' + subSubTriggerId + '" ' +
                       'onclick="toggleAccordion(\'' + subSubTriggerId + '\', \'' + subSubContentId + '\')">' +
                   subSubCategory.name +
                   '<span class="accordion-arrow text-xs">▼</span>' +
               '</button>' +
               '<div class="accordion-content hidden px-2 pt-1 pb-2" id="' + subSubContentId + '">' +
                   '<div class="space-y-1">' + treatmentsHtml + '</div>' +
               '</div>' +
           '</div>';
}

function createTreatmentItemHtml(treatment, patientId, itemJson) {
    var ticketInfo = treatment.ticketInfo ? 
        '<div class="text-xs text-green-600 mt-1">' + treatment.ticketInfo + '</div>' : '';
    
    return '<div class="treatment-item flex items-start space-x-3 p-3 rounded-md cursor-pointer transition-all bg-slate-50 hover:bg-slate-100" ' +
           'onclick="selectTreatment(\'' + patientId + '\', ' + itemJson + ')">' +
               '<input type="radio" name="treatment-' + patientId + '" class="treatment-checkbox mt-0.5" value="' + treatment.id + '">' +
               '<div class="flex-1">' +
                   '<div class="treatment-name font-medium text-gray-800">' + treatment.name + '</div>' +
                   '<div class="text-xs text-gray-600">' +
                       '時間目安: ' + treatment.duration + '<br>' +
                       '目安金額: ' + treatment.price +
                   '</div>' +
                   ticketInfo +
               '</div>' +
           '</div>';
}

export function toggleAccordion(triggerId, contentId) {
    var trigger = document.getElementById(triggerId);
    var content = document.getElementById(contentId);
    
    console.log('toggleAccordion called:', triggerId, contentId);
    console.log('Elements found:', !!trigger, !!content);
    
    if (!trigger || !content) {
        console.error('Accordion elements not found:', { triggerId, contentId, trigger: !!trigger, content: !!content });
        return;
    }
    
    var isActive = trigger.classList.contains('active');
    console.log('Current state:', isActive ? 'active' : 'inactive');
    
    // Close all accordions at the same level
    var container = trigger.closest('.border-gray-200') || trigger.closest('[class*="border-"]');
    if (container) {
        var sameLevelTriggers = container.querySelectorAll('.accordion-trigger');
        var sameLevelContents = container.querySelectorAll('.accordion-content');
        
        for (var i = 0; i < sameLevelTriggers.length; i++) {
            // 同じレベルのもののみクローズ（子要素は除外）
            if (sameLevelTriggers[i].parentElement === trigger.parentElement) {
                sameLevelTriggers[i].classList.remove('active');
            }
        }
        for (var i = 0; i < sameLevelContents.length; i++) {
            if (sameLevelContents[i].parentElement === content.parentElement) {
                sameLevelContents[i].classList.remove('active');
            }
        }
    }
    
    // Toggle the clicked accordion
    if (!isActive) {
        trigger.classList.add('active');
        content.classList.add('active');
        console.log('Accordion opened');
    } else {
        console.log('Accordion closed');
    }
}