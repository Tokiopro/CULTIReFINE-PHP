// core/polyfills.js
// ブラウザ互換性のためのポリフィル
// エンコーディング: UTF-8

// Array.from polyfill
if (!Array.from) {
    Array.from = function(arrayLike, mapFn) {
        var result = [];
        for (var i = 0; i < arrayLike.length; i++) {
            result.push(mapFn ? mapFn(arrayLike[i], i) : arrayLike[i]);
        }
        return result;
    };
}

// Object.assign polyfill
if (!Object.assign) {
    Object.assign = function(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var key in source) {
                if (source.hasOwnProperty(key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    };
}