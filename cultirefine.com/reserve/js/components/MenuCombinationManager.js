/**
 * メニュー組み合わせ管理クラス
 * メニューの組み合わせルール、時間最適化、動的フィルタリングを管理
 */
class MenuCombinationManager {
    constructor() {
        this.selectedMenus = new Map(); // 選択されたメニューMap (ID -> メニューオブジェクト)
        this.allMenus = []; // 全メニューデータ
        this.normalizedMenus = new Map(); // 正規化されたメニューMap
        this.combinationRules = null; // 組み合わせルール
        this.patientId = null;
        this.realTimeCalculator = new RealTimeCalculator();
        
        // イベントリスナー
        this.onSelectionChange = null;
        this.onTimeUpdate = null;
        this.onValidationChange = null;
        
        this.init();
    }

    /**
     * 初期化
     */
    async init() {
        try {
            console.log('MenuCombinationManager初期化開始');
            
            // DOM要素を取得
            this.initializeDOMElements();
            
            // イベントリスナーを設定
            this.setupEventListeners();
            
            console.log('MenuCombinationManager初期化完了');
        } catch (error) {
            console.error('MenuCombinationManager初期化エラー:', error);
        }
    }

    /**
     * DOM要素を初期化
     * @private
     */
    initializeDOMElements() {
        // 時間表示エリア
        this.timeDisplayElement = document.getElementById('total-duration-display') || 
                                 this.createTimeDisplayElement();
        
        // 選択メニュー表示エリア
        this.selectedMenusElement = document.getElementById('selected-menus-display') || 
                                   this.createSelectedMenusElement();
        
        // エラー表示エリア
        this.errorDisplayElement = document.getElementById('combination-errors') || 
                                  this.createErrorDisplayElement();
    }

    /**
     * 時間表示要素を作成
     * @private
     */
    createTimeDisplayElement() {
        const element = document.createElement('div');
        element.id = 'total-duration-display';
        element.className = 'duration-display';
        element.innerHTML = `
            <div class="duration-summary">
                <div class="duration-item">
                    <span class="duration-label">合計時間:</span>
                    <span class="duration-value total-time">0分</span>
                </div>
                <div class="duration-item optimized">
                    <span class="duration-label">最適化後:</span>
                    <span class="duration-value optimized-time">0分</span>
                </div>
                <div class="duration-item saved">
                    <span class="duration-label">短縮時間:</span>
                    <span class="duration-value saved-time">0分</span>
                </div>
            </div>
        `;
        
        // メニュー選択エリアの上部に挿入
        const menuContainer = document.querySelector('.menu-container') || 
                             document.querySelector('#treatment-container');
        if (menuContainer) {
            menuContainer.insertBefore(element, menuContainer.firstChild);
        }
        
        return element;
    }

    /**
     * 選択メニュー表示要素を作成
     * @private
     */
    createSelectedMenusElement() {
        const element = document.createElement('div');
        element.id = 'selected-menus-display';
        element.className = 'selected-menus-container';
        element.innerHTML = `
            <div class="selected-menus-header">
                <h3>選択中のメニュー</h3>
                <button type="button" class="clear-all-btn" onclick="menuCombinationManager.clearAllSelections()">
                    すべてクリア
                </button>
            </div>
            <div class="selected-menus-list"></div>
        `;
        
        // 時間表示要素の下に挿入
        if (this.timeDisplayElement && this.timeDisplayElement.parentNode) {
            this.timeDisplayElement.parentNode.insertBefore(element, this.timeDisplayElement.nextSibling);
        }
        
        return element;
    }

    /**
     * エラー表示要素を作成
     * @private
     */
    createErrorDisplayElement() {
        const element = document.createElement('div');
        element.id = 'combination-errors';
        element.className = 'combination-errors';
        element.style.display = 'none';
        
        // 選択メニュー表示要素の下に挿入
        if (this.selectedMenusElement && this.selectedMenusElement.parentNode) {
            this.selectedMenusElement.parentNode.insertBefore(element, this.selectedMenusElement.nextSibling);
        }
        
        return element;
    }

    /**
     * イベントリスナーを設定
     * @private
     */
    setupEventListeners() {
        // メニュークリックイベント（動的に追加されるメニューに対応）
        document.addEventListener('click', (event) => {
            if (event.target.matches('.menu-item, .menu-item *')) {
                this.handleMenuClick(event);
            }
        });

        // チェックボックス変更イベント
        document.addEventListener('change', (event) => {
            if (event.target.matches('input[name="treatment_ids[]"]')) {
                this.handleMenuSelectionChange(event);
            }
        });
    }

    /**
     * メニューデータを設定
     * @param {Array} menuData - メニューデータ配列
     * @param {string} patientId - 患者ID
     */
    setMenuData(menuData, patientId = null) {
        this.allMenus = menuData || [];
        this.patientId = patientId;
        this.normalizeMenuData();
        this.updateMenuDisplay();
    }

    /**
     * メニューデータを正規化
     * @private
     */
    normalizeMenuData() {
        this.normalizedMenus.clear();
        
        this.allMenus.forEach(menu => {
            const normalizedName = this.normalizeMenuName(menu.name || menu.display_name || '');
            
            if (!this.normalizedMenus.has(normalizedName)) {
                this.normalizedMenus.set(normalizedName, {
                    id: this.generateNormalizedId(normalizedName),
                    normalizedName: normalizedName,
                    displayName: normalizedName,
                    variants: [],
                    category: menu.category || 'other',
                    basePrice: menu.price,
                    baseDuration: menu.duration,
                    ticketType: menu.ticket_type
                });
            }
            
            this.normalizedMenus.get(normalizedName).variants.push(menu);
        });
        
        console.log(`正規化メニュー: ${this.normalizedMenus.size}件`);
    }

    /**
     * メニュー名を正規化
     * @private
     * @param {string} menuName - メニュー名
     * @returns {string} 正規化されたメニュー名
     */
    normalizeMenuName(menuName) {
        return menuName
            .replace(/【初回】/g, '')
            .replace(/【2回目以降】/g, '')
            .replace(/（初回）/g, '')
            .replace(/（2回目以降）/g, '')
            .replace(/\(初回\)/g, '')
            .replace(/\(2回目以降\)/g, '')
            .replace(/初回/g, '')
            .replace(/2回目以降/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 正規化IDを生成
     * @private
     * @param {string} normalizedName - 正規化されたメニュー名
     * @returns {string} 正規化ID
     */
    generateNormalizedId(normalizedName) {
        return 'normalized_' + normalizedName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }

    /**
     * メニュー選択を処理
     * @param {string} menuId - メニューID
     * @param {boolean} selected - 選択状態
     */
    async handleMenuSelection(menuId, selected) {
        try {
            console.log(`メニュー選択変更: ${menuId}, 選択: ${selected}`);
            
            if (selected) {
                await this.addMenuSelection(menuId);
            } else {
                this.removeMenuSelection(menuId);
            }
            
            await this.updateAfterSelectionChange();
            
        } catch (error) {
            console.error('メニュー選択処理エラー:', error);
            this.showError('メニュー選択処理中にエラーが発生しました');
        }
    }

    /**
     * メニュー選択を追加
     * @private
     * @param {string} menuId - メニューID
     */
    async addMenuSelection(menuId) {
        // 適切なメニューデータを特定（履歴に基づく判定）
        const menuData = await this.determineAppropriateMenu(menuId);
        
        if (menuData) {
            this.selectedMenus.set(menuId, menuData);
        }
    }

    /**
     * 適切なメニューを判定（初回/2回目以降）
     * @private
     * @param {string} menuId - メニューID
     * @returns {Object} 適切なメニューデータ
     */
    async determineAppropriateMenu(menuId) {
        // 正規化されたメニューから基本データを取得
        let normalizedMenu = null;
        for (const [, menu] of this.normalizedMenus) {
            if (menu.id === menuId || menu.variants.some(v => v.id === menuId || v.menu_id === menuId)) {
                normalizedMenu = menu;
                break;
            }
        }
        
        if (!normalizedMenu) {
            console.warn('メニューが見つかりません:', menuId);
            return null;
        }

        // 患者履歴に基づいて適切なバリアントを選択
        try {
            if (this.patientId) {
                const response = await this.callGASAPI('determineMenuId', {
                    normalizedMenuName: normalizedMenu.normalizedName,
                    lineUserId: this.patientId
                });
                
                if (response.success && response.menuId) {
                    const appropriateVariant = normalizedMenu.variants.find(v => 
                        v.id === response.menuId || v.menu_id === response.menuId
                    );
                    
                    if (appropriateVariant) {
                        return appropriateVariant;
                    }
                }
            }
        } catch (error) {
            console.warn('履歴判定エラー、デフォルトメニューを使用:', error);
        }
        
        // デフォルトは最初のバリアント
        return normalizedMenu.variants[0];
    }

    /**
     * メニュー選択を削除
     * @private
     * @param {string} menuId - メニューID
     */
    removeMenuSelection(menuId) {
        this.selectedMenus.delete(menuId);
    }

    /**
     * 選択変更後の更新処理
     * @private
     */
    async updateAfterSelectionChange() {
        // 組み合わせ妥当性チェック
        const validationResult = await this.validateCombination();
        
        // 時間計算更新
        const timeResult = await this.calculateRealTimeDuration();
        
        // UI更新
        this.updateTimeDisplay(timeResult);
        this.updateSelectedMenusDisplay();
        this.updateValidationDisplay(validationResult);
        this.updateMenuAvailability();
        
        // コールバック呼び出し
        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedMenus.values()));
        }
        
        if (this.onTimeUpdate) {
            this.onTimeUpdate(timeResult);
        }
        
        if (this.onValidationChange) {
            this.onValidationChange(validationResult);
        }
    }

    /**
     * 組み合わせを検証
     * @private
     * @returns {Object} 検証結果
     */
    async validateCombination() {
        try {
            const selectedMenuIds = Array.from(this.selectedMenus.keys());
            
            if (selectedMenuIds.length === 0) {
                return { valid: true, errors: [] };
            }
            
            const response = await this.callGASAPI('validateMenuCombination', {
                menuIds: selectedMenuIds
            });
            
            return response || { valid: false, errors: ['検証エラー'] };
            
        } catch (error) {
            console.error('組み合わせ検証エラー:', error);
            return { valid: false, errors: ['組み合わせ検証中にエラーが発生しました'] };
        }
    }

    /**
     * リアルタイム時間計算
     * @private
     * @returns {Object} 時間計算結果
     */
    async calculateRealTimeDuration() {
        try {
            const selectedMenus = Array.from(this.selectedMenus.values());
            
            if (selectedMenus.length === 0) {
                return { totalDuration: 0, optimizedDuration: 0, timeSaved: 0 };
            }
            
            // ローカル計算（高速化のため）
            return this.realTimeCalculator.calculate(selectedMenus);
            
        } catch (error) {
            console.error('時間計算エラー:', error);
            return { totalDuration: 0, optimizedDuration: 0, timeSaved: 0, error: error.message };
        }
    }

    /**
     * 時間表示を更新
     * @private
     * @param {Object} timeResult - 時間計算結果
     */
    updateTimeDisplay(timeResult) {
        if (!this.timeDisplayElement) return;
        
        const totalTimeElement = this.timeDisplayElement.querySelector('.total-time');
        const optimizedTimeElement = this.timeDisplayElement.querySelector('.optimized-time');
        const savedTimeElement = this.timeDisplayElement.querySelector('.saved-time');
        
        if (totalTimeElement) {
            totalTimeElement.textContent = `${timeResult.totalDuration || 0}分`;
        }
        
        if (optimizedTimeElement) {
            optimizedTimeElement.textContent = `${timeResult.optimizedDuration || 0}分`;
        }
        
        if (savedTimeElement) {
            const timeSaved = (timeResult.totalDuration || 0) - (timeResult.optimizedDuration || 0);
            savedTimeElement.textContent = `${timeSaved}分`;
            savedTimeElement.className = timeSaved > 0 ? 'duration-value saved-time positive' : 'duration-value saved-time';
        }
    }

    /**
     * 選択メニュー表示を更新
     * @private
     */
    updateSelectedMenusDisplay() {
        const listElement = this.selectedMenusElement?.querySelector('.selected-menus-list');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (this.selectedMenus.size === 0) {
            listElement.innerHTML = '<div class="no-selection">メニューが選択されていません</div>';
            return;
        }
        
        this.selectedMenus.forEach((menu, menuId) => {
            const menuElement = document.createElement('div');
            menuElement.className = 'selected-menu-item';
            menuElement.innerHTML = `
                <div class="menu-info">
                    <span class="menu-name">${menu.name || menu.display_name}</span>
                    <span class="menu-duration">${menu.duration || 60}分</span>
                    <span class="menu-price">${this.formatPrice(menu.price)}円</span>
                </div>
                <button type="button" class="remove-menu-btn" onclick="menuCombinationManager.removeMenuSelection('${menuId}'); menuCombinationManager.updateAfterSelectionChange();">
                    ×
                </button>
            `;
            listElement.appendChild(menuElement);
        });
    }

    /**
     * 検証結果表示を更新
     * @private
     * @param {Object} validationResult - 検証結果
     */
    updateValidationDisplay(validationResult) {
        if (!this.errorDisplayElement) return;
        
        if (validationResult.valid || !validationResult.errors || validationResult.errors.length === 0) {
            this.errorDisplayElement.style.display = 'none';
            return;
        }
        
        this.errorDisplayElement.innerHTML = `
            <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span class="error-title">組み合わせエラー</span>
            </div>
            <ul class="error-list">
                ${validationResult.errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        `;
        
        this.errorDisplayElement.style.display = 'block';
    }

    /**
     * メニューの有効性を更新（選択可能/不可の表示）
     * @private
     */
    async updateMenuAvailability() {
        try {
            if (this.selectedMenus.size === 0) {
                // 選択がない場合は全メニューを有効化
                this.enableAllMenus();
                return;
            }
            
            // 組み合わせ可能なメニューを取得
            const selectedIds = Array.from(this.selectedMenus.keys());
            const response = await this.callGASAPI('getCompatibleMenus', {
                selectedMenuIds: selectedIds,
                lineUserId: this.patientId
            });
            
            if (response.success && response.data) {
                this.updateMenuEnabledState(response.data.compatibleMenus);
            }
            
        } catch (error) {
            console.error('メニュー有効性更新エラー:', error);
        }
    }

    /**
     * メニューの有効/無効状態を更新
     * @private
     * @param {Array} compatibleMenus - 組み合わせ可能なメニュー配列
     */
    updateMenuEnabledState(compatibleMenus) {
        const compatibleIds = new Set(compatibleMenus.map(menu => menu.id || menu.menu_id));
        
        // 全メニューチェックボックスの状態を更新
        document.querySelectorAll('input[name="treatment_ids[]"]').forEach(checkbox => {
            const menuId = checkbox.value;
            const isCompatible = compatibleIds.has(menuId) || this.selectedMenus.has(menuId);
            
            checkbox.disabled = !isCompatible;
            
            // 親要素にクラスを追加/削除してスタイリング
            const menuItem = checkbox.closest('.menu-item');
            if (menuItem) {
                if (isCompatible) {
                    menuItem.classList.remove('disabled');
                } else {
                    menuItem.classList.add('disabled');
                }
            }
        });
    }

    /**
     * 全メニューを有効化
     * @private
     */
    enableAllMenus() {
        document.querySelectorAll('input[name="treatment_ids[]"]').forEach(checkbox => {
            checkbox.disabled = false;
            
            const menuItem = checkbox.closest('.menu-item');
            if (menuItem) {
                menuItem.classList.remove('disabled');
            }
        });
    }

    /**
     * 全選択をクリア
     */
    clearAllSelections() {
        // チェックボックスをクリア
        document.querySelectorAll('input[name="treatment_ids[]"]:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // 内部状態をクリア
        this.selectedMenus.clear();
        
        // UI更新
        this.updateAfterSelectionChange();
    }

    /**
     * メニュークリックを処理
     * @private
     * @param {Event} event - クリックイベント
     */
    handleMenuClick(event) {
        const checkbox = event.target.closest('.menu-item')?.querySelector('input[name="treatment_ids[]"]');
        if (checkbox && !checkbox.disabled) {
            checkbox.checked = !checkbox.checked;
            this.handleMenuSelectionChange({ target: checkbox });
        }
    }

    /**
     * メニュー選択変更を処理
     * @private
     * @param {Event} event - 変更イベント
     */
    handleMenuSelectionChange(event) {
        const checkbox = event.target;
        const menuId = checkbox.value;
        const selected = checkbox.checked;
        
        this.handleMenuSelection(menuId, selected);
    }

    /**
     * GAS APIを呼び出し
     * @private
     * @param {string} method - メソッド名
     * @param {Object} params - パラメータ
     * @returns {Object} レスポンス
     */
    async callGASAPI(method, params) {
        // 実際のAPI呼び出し実装
        // この部分は既存のAPI呼び出し方法に合わせて実装
        return { success: true, data: {} };
    }

    /**
     * 価格をフォーマット
     * @private
     * @param {number} price - 価格
     * @returns {string} フォーマットされた価格
     */
    formatPrice(price) {
        if (!price) return '0';
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * エラーを表示
     * @private
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        console.error(message);
        // エラー表示のUI実装
    }

    /**
     * メニュー表示を更新
     * @private
     */
    updateMenuDisplay() {
        // 既存のメニュー表示ロジックとの統合
        // 正規化されたメニューを表示
    }
}

/**
 * リアルタイム時間計算クラス
 */
class RealTimeCalculator {
    /**
     * 時間を計算
     * @param {Array} selectedMenus - 選択されたメニュー配列
     * @returns {Object} 計算結果
     */
    calculate(selectedMenus) {
        if (!selectedMenus || selectedMenus.length === 0) {
            return { totalDuration: 0, optimizedDuration: 0, timeSaved: 0 };
        }

        let totalDuration = 0;
        let optimizedDuration = 0;
        
        const counselingTime = 30; // カウンセリング時間
        const preparationTime = 10; // 準備時間
        const cleanupTime = 10; // 片付け時間

        // 基本時間計算
        selectedMenus.forEach(menu => {
            const baseDuration = parseInt(menu.duration) || 60;
            totalDuration += baseDuration + preparationTime + cleanupTime + counselingTime;
        });

        optimizedDuration = totalDuration;

        // カウンセリング重複除去（2件目以降）
        if (selectedMenus.length > 1) {
            const counselingReduction = counselingTime * (selectedMenus.length - 1);
            optimizedDuration -= counselingReduction;
        }

        // 点滴・注射の連続調整
        const ivMenus = selectedMenus.filter(menu => this.isIVMenu(menu));
        if (ivMenus.length > 1) {
            ivMenus.forEach((menu, index) => {
                if (index === 0) {
                    optimizedDuration -= 10; // 最初
                } else if (index === ivMenus.length - 1) {
                    optimizedDuration -= 10; // 最後
                } else {
                    optimizedDuration -= 20; // 中間
                }
            });
        }

        const timeSaved = totalDuration - optimizedDuration;

        return {
            totalDuration,
            optimizedDuration: Math.max(optimizedDuration, 0),
            timeSaved: Math.max(timeSaved, 0)
        };
    }

    /**
     * 点滴・注射メニューかチェック
     * @private
     * @param {Object} menu - メニューオブジェクト
     * @returns {boolean} 点滴・注射メニューかどうか
     */
    isIVMenu(menu) {
        const name = (menu.name || menu.display_name || '').toLowerCase();
        return name.includes('点滴') || name.includes('注射') || name.includes('幹細胞') || name.includes('nad');
    }
}

// グローバルインスタンス
let menuCombinationManager = null;

// 初期化関数
function initializeMenuCombinationManager() {
    if (!menuCombinationManager) {
        menuCombinationManager = new MenuCombinationManager();
    }
    return menuCombinationManager;
}

// DOMロード後に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMenuCombinationManager);
} else {
    initializeMenuCombinationManager();
}