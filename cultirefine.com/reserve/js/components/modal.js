// components/modal.js
// モーダル管理モジュール

import { hideModal } from '../core/ui-helpers.js';
import { mockAddPatient } from '../data/gas-api.js';
import { appState } from '../core/app-state.js';

export function initAddPatientModal() {
    var modal = document.getElementById('add-patient-modal');
    var closeBtn = document.getElementById('modal-close-btn');
    var cancelBtn = document.getElementById('cancel-add-patient-btn');
    var confirmBtn = document.getElementById('confirm-add-patient-btn');
    var nameInput = document.getElementById('new-patient-name');
    var kanaInput = document.getElementById('new-patient-kana');
    var birthdayInput = document.getElementById('new-patient-birthday');
    var errorDiv = document.getElementById('patient-modal-error');
    var errorText = document.getElementById('patient-modal-error-text');
    var confirmBtnText = document.getElementById('confirm-btn-text');
    var confirmBtnSpinner = document.getElementById('confirm-btn-spinner');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !nameInput || !kanaInput) return;

    function closeModal() {
        hideModal('add-patient-modal');
        clearForm();
        hideError();
    }

    function clearForm() {
        nameInput.value = '';
        kanaInput.value = '';
        birthdayInput.value = '';
        document.querySelectorAll('input[name="gender"]').forEach(radio => radio.checked = false);
    }

    function showError(message) {
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }

    function setLoading(isLoading) {
        confirmBtn.disabled = isLoading;
        if (isLoading) {
            confirmBtnText.textContent = '登録中...';
            confirmBtnSpinner.classList.remove('hidden');
        } else {
            confirmBtnText.textContent = '追加して選択';
            confirmBtnSpinner.classList.add('hidden');
        }
    }

    function validateForm() {
        var name = nameInput.value.trim();
        var kana = kanaInput.value.trim();
        var gender = document.querySelector('input[name="gender"]:checked')?.value;
        var birthday = birthdayInput.value;

        // 必須フィールドチェック
        if (!name) {
            return { valid: false, message: '氏名を入力してください。' };
        }
        if (!kana) {
            return { valid: false, message: 'カナを入力してください。' };
        }
        if (!gender) {
            return { valid: false, message: '性別を選択してください。' };
        }

        // 氏名の検証
        if (name.length > 30) {
            return { valid: false, message: '氏名は30文字以内で入力してください。' };
        }

        // カナの検証
        if (kana.length > 60) {
            return { valid: false, message: 'カナは60文字以内で入力してください。' };
        }
        
        // 全角カタカナチェック
        var katakanaRegex = /^[ァ-ヶー\s　]+$/;
        if (!katakanaRegex.test(kana)) {
            return { valid: false, message: 'カナは全角カタカナで入力してください。' };
        }

        // 生年月日の検証（任意）
        if (birthday) {
            var today = new Date();
            var birthDate = new Date(birthday);
            if (birthDate > today) {
                return { valid: false, message: '生年月日は今日以前の日付を入力してください。' };
            }
            
            var age = today.getFullYear() - birthDate.getFullYear();
            if (age > 120) {
                return { valid: false, message: '生年月日が正しくありません。' };
            }
        }

        return { valid: true };
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', async function() {
        hideError();
        
        // バリデーション
        var validation = validateForm();
        if (!validation.valid) {
            showError(validation.message);
            return;
        }

        setLoading(true);
        
        try {
            var name = nameInput.value.trim();
            var kana = kanaInput.value.trim();
            var gender = document.querySelector('input[name="gender"]:checked').value;
            var birthday = birthdayInput.value;

            var patientData = {
                name: name,
                kana: kana,
                gender: gender
            };

            if (birthday) {
                patientData.birthday = birthday;
            }

            var result = await mockAddPatient(patientData);
            
            if (result.success && result.patient) {
                appState.addPatient(result.patient);
                
                // Auto-select if possible
                if (!appState.isPairBookingMode || appState.selectedPatientsForBooking.length < 2) {
                    appState.selectedPatientsForBooking.push(result.patient);
                }
                
                // Trigger update (will be handled by main.js)
                if (window.updatePatientsList) {
                    window.updatePatientsList();
                }
                if (window.updateProceedButton) {
                    window.updateProceedButton();
                }
                
                closeModal();
                
                // 成功メッセージを表示
                showSuccessMessage(result.message || '来院者が正常に登録されました。');
                
            } else {
                showError(result.message || '来院者の登録に失敗しました。');
            }
        } catch (error) {
            console.error('Patient registration error:', error);
            showError('システムエラーが発生しました。時間をおいて再度お試しください。');
        } finally {
            setLoading(false);
        }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

/**
 * 成功メッセージを表示する関数
 */
function showSuccessMessage(message) {
    // 既存の成功メッセージがあれば削除
    var existingMessage = document.getElementById('success-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // 成功メッセージを作成
    var successDiv = document.createElement('div');
    successDiv.id = 'success-message';
    successDiv.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center';
    successDiv.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
        </svg>
        <span>${message}</span>
    `;

    document.body.appendChild(successDiv);

    // 3秒後に自動的に削除
    setTimeout(function() {
        successDiv.remove();
    }, 3000);
}