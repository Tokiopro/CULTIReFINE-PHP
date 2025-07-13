// core/storage-manager.js
// localStorage管理モジュール

export const StorageManager = {
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('localStorage not available');
        }
    },
    
    load: function(key) {
        try {
            var data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('localStorage not available');
            return null;
        }
    },
    
    remove: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage not available');
        }
    }
};