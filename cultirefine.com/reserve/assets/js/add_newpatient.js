document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll("button");
  let addBtn = null;
  let openBtn = null;

  // 「追加して選択」ボタンと「新しい来院者を追加」ボタンをそれぞれ探す
  for (const btn of buttons) {
    const text = btn.textContent.trim();
    if (text === "追加して選択") addBtn = btn;
    if (text === "新しい来院者を追加") openBtn = btn;
  }

  const dialogWrapper = document.getElementById("newPatientDialogWrapper");

  // 🔓 ダイアログを開く処理
  if (openBtn && dialogWrapper) {
    openBtn.addEventListener("click", () => {
      dialogWrapper.style.display = "block";

      const dialog = dialogWrapper.querySelector('[role="dialog"]');
      const overlay = dialogWrapper.querySelector('div[data-aria-hidden="true"]');
      if (dialog) dialog.setAttribute("data-state", "open");
      if (overlay) overlay.setAttribute("data-state", "open");
    });
  }

  // ❌ ダイアログを閉じる（✕ ボタン）
  const closeBtn = dialogWrapper?.querySelector('button[type="button"] svg.lucide-x')?.closest("button");
  if (closeBtn && dialogWrapper) {
    closeBtn.addEventListener("click", () => {
      dialogWrapper.style.display = "none";
    });
  }

  // ➕ 「追加して選択」処理
  if (!addBtn) {
    console.warn("追加ボタンが見つかりません。");
    return;
  }

  addBtn.addEventListener("click", function () {
    const nameInput = document.getElementById("newPatientName");
    const name = nameInput.value.trim();

    if (!name) {
      alert("名前を入力してください。");
      return;
    }

    const list = document.getElementById("patientList");
    if (!list) {
      alert("追加先（#patientList）が見つかりません。");
      return;
    }

    const timestamp = Date.now();
const newId = `patient-new-${timestamp}`;

// 日付を「YYYY/MM/DD HH:mm」形式で表示
const now = new Date();
const formattedDate = `(${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")})`;

// div（患者カード）作成
const newPatientDiv = document.createElement("div");
newPatientDiv.className = "flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-colors hover:bg-slate-50";
newPatientDiv.id = newId;

// ボタン
const checkbox = document.createElement("button");
checkbox.type = "button";
checkbox.role = "checkbox";
checkbox.setAttribute("aria-checked", "false");
checkbox.setAttribute("data-state", "unchecked");
checkbox.value = "on";
checkbox.className = "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";
checkbox.id = newId;

// ラベル
const label = document.createElement("label");
label.className = "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow cursor-pointer";
label.setAttribute("for", newId);

// ラベル内の名前部分
const nameSpan = document.createElement("span");
nameSpan.className = "font-medium";
nameSpan.textContent = name;

// ラベル内の日時部分
const dateSpan = document.createElement("span");
dateSpan.className = "text-xs text-slate-500 ml-2";
dateSpan.textContent = `（最終来院: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}）`;

// ラベルに子要素追加
label.appendChild(nameSpan);
label.appendChild(dateSpan);

// divにすべて追加
newPatientDiv.appendChild(checkbox);
newPatientDiv.appendChild(label);

// 患者一覧に追加
list.appendChild(newPatientDiv);


    // モーダルを閉じる
    const dialog = dialogWrapper.querySelector('[role="dialog"]');
    const overlay = dialogWrapper.querySelector('div[data-aria-hidden="true"]');
    if (dialog) dialog.setAttribute("data-state", "closed");
    if (overlay) overlay.remove();

    dialogWrapper.style.display = "none";
    nameInput.value = "";
  });
});
