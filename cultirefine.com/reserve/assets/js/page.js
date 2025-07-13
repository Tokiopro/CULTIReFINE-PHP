function loadPage(url, pageTitle) {
  fetch(url)
    .then(response => response.text())
    .then(html => {
      document.getElementById("main-content").innerHTML = html;
      document.title = pageTitle; // ← ここでタイトルを変更
    })
    .catch(error => {
      console.error('読み込みエラー:', error);
      document.getElementById("main-content").innerHTML = "<p>読み込みに失敗しました。</p>";
      document.title = "エラー";
    });
}
