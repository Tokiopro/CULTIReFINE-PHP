document.addEventListener('DOMContentLoaded', () => {
  const switchBtn = document.getElementById("pair-mode-switch");
  const switchThumb = switchBtn?.querySelector("span");
  const list = document.getElementById("patientList");
  const actionButton = document.querySelector('button[data-action="proceed-reservation"]');
  const dialogWrapper = document.getElementById("newPatientDialogWrapper");

  if (!switchBtn || !switchThumb || !list) {
    console.warn("スイッチまたは患者リストが見つかりません");
    return;
  }

  function isPairMode() {
    return switchBtn.getAttribute("data-state") === "checked";
  }

  function updateReservationButton() {
    const checkboxes = list.querySelectorAll('button[role="checkbox"][aria-checked="true"]');
    const checkedCount = checkboxes.length;

    if (actionButton) {
      actionButton.innerHTML = `選択した${checkedCount}名の予約へ進む
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class="lucide lucide-arrow-right ml-2 h-5 w-5">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>`;
      actionButton.disabled = checkedCount === 0;
    }
  }

  switchBtn.addEventListener("click", function () {
    const checked = isPairMode();
    const newState = checked ? "unchecked" : "checked";
    switchBtn.setAttribute("aria-checked", newState === "checked" ? "true" : "false");
    switchBtn.setAttribute("data-state", newState);
    switchThumb.setAttribute("data-state", newState);

    const description = document.querySelector("p.text-sm.text-muted-foreground");
    if (description) {
      description.textContent = newState === "checked"
        ? "ペア予約のため、2名の来院者を選択してください。"
        : "今回同時に予約する来院者を選択してください。";
    }

    // 全てのチェックをリセット
    const allCheckboxes = list.querySelectorAll('button[role="checkbox"]');
    allCheckboxes.forEach(button => {
      button.setAttribute('aria-checked', 'false');
      button.setAttribute('data-state', 'unchecked');

      const parent = button.closest('.flex.items-center');
      parent?.classList.remove('bg-teal-50', 'border-teal-500', 'ring-2', 'ring-teal-500');

      const icon = button.querySelector('svg');
      if (icon) icon.parentElement.remove();
    });

    if (newState === "checked") {
      actionButton.innerHTML = `ペア予約へ進む
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class="lucide lucide-arrow-right ml-2 h-5 w-5">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>`;
      actionButton.disabled = false;
    } else {
      updateReservationButton();
    }
  });

  // イベント委任で動的に追加された来院者も対応
  list.addEventListener("click", function (event) {
    const button = event.target.closest('button[role="checkbox"]');
    if (!button) return;

    const parent = button.closest('.flex.items-center');
    const isChecked = button.getAttribute('aria-checked') === 'true';

    if (!isChecked && isPairMode()) {
      const checkedCount = list.querySelectorAll('button[role="checkbox"][aria-checked="true"]').length;
      if (checkedCount >= 2) {
        alert("ペア予約では2名まで選択できます。");
        return;
      }
    }

    button.setAttribute('aria-checked', isChecked ? 'false' : 'true');
    button.setAttribute('data-state', isChecked ? 'unchecked' : 'checked');
    parent?.classList.toggle('bg-teal-50', !isChecked);
    parent?.classList.toggle('border-teal-500', !isChecked);
    parent?.classList.toggle('ring-2', !isChecked);
    parent?.classList.toggle('ring-teal-500', !isChecked);

    if (isChecked) {
      const icon = button.querySelector('svg');
      if (icon) icon.parentElement.remove();
    } else {
      const span = document.createElement('span');
      span.setAttribute('data-state', 'checked');
      span.className = 'flex items-center justify-center text-current';
      span.style.pointerEvents = 'none';
      span.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class="lucide lucide-check h-4 w-4">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>`;
      button.appendChild(span);
    }

    updateReservationButton();
  });

  // キャンセルボタンでダイアログを閉じる
  if (dialogWrapper) {
    const cancelBtn = dialogWrapper.querySelector('button[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        dialogWrapper.style.display = "none";
        const dialog = dialogWrapper.querySelector('[role="dialog"]');
        const overlay = dialogWrapper.querySelector('div[data-aria-hidden="true"]');
        if (dialog) dialog.setAttribute("data-state", "closed");
        if (overlay) overlay.remove();
      });
    }
  }

  updateReservationButton();
});
