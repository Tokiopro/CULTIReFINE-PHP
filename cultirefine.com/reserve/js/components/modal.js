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

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !nameInput) return;

    function closeModal() {
        hideModal('add-patient-modal');
        nameInput.value = '';
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', function() {
        var name = nameInput.value.trim();
        
        if (!name) {
            alert("氏名を入力してください。");
            return;
        }
        if (/[^\p{L}\p{N}\s]/u.test(name) && !/[-']/.test(name)) {
            alert("氏名に絵文字や特殊記号は使用できません。");
            return;
        }
        if (name.length > 30) {
            alert("氏名は30文字以内で入力してください。");
            return;
        }

        mockAddPatient({ name: name }).then(function(result) {
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
            } else {
                alert("患者の追加に失敗しました: " + result.message);
            }
        }).catch(function(error) {
            alert("患者の追加中にエラーが発生しました。");
        });
    });

    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}