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

  addBtn.addEventListener("click", async function () {
    const lastNameInput = document.getElementById("newPatientLastName");
    const firstNameInput = document.getElementById("newPatientFirstName");
    const lastNameKanaInput = document.getElementById("newPatientLastNameKana");
    const firstNameKanaInput = document.getElementById("newPatientFirstNameKana");
    const genderSelect = document.getElementById("newPatientGender");
    const birthdayInput = document.getElementById("newPatientBirthday");
    
    const lastName = lastNameInput?.value.trim() || "";
    const firstName = firstNameInput?.value.trim() || "";
    const lastNameKana = lastNameKanaInput?.value.trim() || "";
    const firstNameKana = firstNameKanaInput?.value.trim() || "";
    const gender = genderSelect?.value || "MALE";
    const birthday = birthdayInput?.value || "";

    // バリデーション
    if (!lastName) {
      alert("姓を入力してください。");
      return;
    }
    if (!firstName) {
      alert("名を入力してください。");
      return;
    }
    if (!lastNameKana) {
      alert("セイを入力してください。");
      return;
    }
    if (!firstNameKana) {
      alert("メイを入力してください。");
      return;
    }

    const list = document.getElementById("patientList");
    if (!list) {
      alert("追加先（#patientList）が見つかりません。");
      return;
    }
    
    // ローディング表示
    addBtn.disabled = true;
    addBtn.textContent = "登録中...";
    
    try {
      // PHP側で2段階処理を実行（Medical Force API → GAS API）
      const visitorData = {
        last_name: lastName,
        first_name: firstName,
        last_name_kana: lastNameKana,
        first_name_kana: firstNameKana,
        gender: gender,
        birthday: birthday
      };
      
      const gasResponse = await registerVisitorToGAS(visitorData);
      
      if (!gasResponse.success) {
        throw new Error(gasResponse.message || "GAS APIエラー");
      }

      // 3. DOMに追加
      const newId = visitorId || `patient-new-${Date.now()}`;
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      
      // div（患者カード）作成
      const newPatientDiv = document.createElement("div");
      newPatientDiv.className = "flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-colors hover:bg-slate-50";
      newPatientDiv.id = newId;
      newPatientDiv.setAttribute("data-visitor-id", visitorId);

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
      dateSpan.textContent = `（最終来院: ${formattedDate}）`;

// ラベルに子要素追加
label.appendChild(nameSpan);
label.appendChild(dateSpan);

      // divにすべて追加
      newPatientDiv.appendChild(checkbox);
      newPatientDiv.appendChild(label);
      
      // 患者一覧に追加
      list.appendChild(newPatientDiv);
      
      // 成功メッセージ表示
      showSuccessMessage("来院者が正常に登録されました。");
      
      // モーダルを閉じる
      const dialog = dialogWrapper.querySelector('[role="dialog"]');
      const overlay = dialogWrapper.querySelector('div[data-aria-hidden="true"]');
      if (dialog) dialog.setAttribute("data-state", "closed");
      if (overlay) overlay.remove();
      
      dialogWrapper.style.display = "none";
      if (lastNameInput) lastNameInput.value = "";
      if (firstNameInput) firstNameInput.value = "";
      if (lastNameKanaInput) lastNameKanaInput.value = "";
      if (firstNameKanaInput) firstNameKanaInput.value = "";
      if (birthdayInput) birthdayInput.value = "";
      
    } catch (error) {
      console.error("来院者登録エラー:", error);
      alert("来院者の登録に失敗しました: " + error.message);
    } finally {
      // ボタンを元に戻す
      addBtn.disabled = false;
      addBtn.textContent = "追加して選択";
    }
  });
});

// Medical Force APIで来院者を作成（モック実装）
async function createVisitorInMedicalForce(patientData) {
  // 実際のMedical Force API呼び出しは別途実装が必要
  // ここではモックとしてランダムなIDを返す
  console.log("[Medical Force API] Creating visitor:", patientData);
  
  // モック遅延
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // モックレスポンス
  return {
    success: true,
    visitor_id: "MF" + Date.now(), // Medical Forceで生成されたID
    message: "Medical Forceで来院者が作成されました"
  };
}

// Medical Force API & GAS APIで来院者登録（2段階処理）
async function registerVisitorToGAS(visitorData) {
  try {
    const response = await fetch('/reserve/api-bridge.php?action=createVisitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(visitorData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'GAS APIエラー');
    }
    
    return result;
    
  } catch (error) {
    console.error('[GAS API] Error:', error);
    throw error;
  }
}

// 成功メッセージ表示
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300';
  successDiv.textContent = message;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.style.opacity = '0';
    setTimeout(() => successDiv.remove(), 300);
  }, 3000);
}
