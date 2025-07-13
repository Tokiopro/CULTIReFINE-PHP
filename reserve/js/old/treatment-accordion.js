// components/treatment-accordion.js
// 施術メニューアコーディオンコンポーネント

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
        var categoryElement = createElement('div', 'border-b border-gray-200 last:border-b-0');
        
        // 修正: containerIdベースでユニークなIDを生成
        var triggerId = 'trigger-' + category.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
        var contentId = 'content-' + category.id + '-' + containerId.replace(/[^a-zA-Z0-9]/g, '');
        
        console.log('Creating accordion for container:', containerId, 'trigger:', triggerId, 'content:', contentId);
        
        var itemsHtml = '';
        for (var j = 0; j < category.items.length; j++) {
            var item = category.items[j];
            var itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
            itemsHtml += 
                '<div class="treatment-item flex items-start space-x-3 p-3 rounded-md cursor-pointer transition-all bg-slate-50 hover:bg-slate-100" ' +
                'onclick="selectTreatment(\'' + patientId + '\', ' + itemJson + ')">' +
                    '<input type="radio" name="treatment-' + patientId + '" class="treatment-checkbox mt-0.5" value="' + item.id + '">' +
                    '<div class="flex-1">' +
                        '<div class="treatment-name font-medium text-gray-800">' + item.name + '</div>' +
                        '<div class="text-xs text-gray-600">' +
                            '時間目安: ' + item.duration + '<br>' +
                            '目安金額: ' + item.price +
                        '</div>' +
                    '</div>' +
                '</div>';
        }
        
        categoryElement.innerHTML = 
            '<button class="accordion-trigger w-full px-4 py-3 text-left font-medium hover:bg-slate-50 flex justify-between items-center" ' +
                    'id="' + triggerId + '" ' +
                    'onclick="toggleAccordion(\'' + triggerId + '\', \'' + contentId + '\')">' +
                category.name +
                '<span class="accordion-arrow">▼</span>' +
            '</button>' +
            '<div class="accordion-content hidden px-4 pt-2 pb-4 bg-white border-t border-gray-200" id="' + contentId + '">' +
                '<div class="space-y-2">' + itemsHtml + '</div>' +
            '</div>';

        container.appendChild(categoryElement);
    }
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
    
    // Close all accordions in the same container
    var container = trigger.closest('.border-gray-200') && trigger.closest('.border-gray-200').parentElement;
    if (container) {
        var allTriggers = container.querySelectorAll('.accordion-trigger');
        var allContents = container.querySelectorAll('.accordion-content');
        
        for (var i = 0; i < allTriggers.length; i++) {
            allTriggers[i].classList.remove('active');
        }
        for (var i = 0; i < allContents.length; i++) {
            allContents[i].classList.remove('active');
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