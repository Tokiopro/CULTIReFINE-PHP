// core/ui-helpers.js
// UI共通関数モジュール

export function createElement(tag, className, innerHTML) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
}

export function showModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

export function hideModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

export function showAlert(containerId, type, title, message) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var alertClasses = {
        'info': 'bg-teal-50 border-l-4 border-teal-500 p-4 rounded',
        'warning': 'bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded',
        'error': 'bg-red-50 border-l-4 border-red-500 p-4 rounded'
    };

    container.className = alertClasses[type] || alertClasses['info'];
    var colorClass = type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'teal';
    container.innerHTML = '<h4 class="text-sm font-semibold text-' + colorClass + '-800">' + title + '</h4>' +
                         '<p class="text-xs text-' + colorClass + '-600">' + message + '</p>';
    container.classList.remove('hidden');
}

export function hideAlert(containerId) {
    var container = document.getElementById(containerId);
    if (container) {
        container.classList.add('hidden');
    }
}