/* =========================================================
   THIET-BI.JS — Renderer trang Quản lý thiết bị
   (tách từ quan-ly-thiet-bi.html cũ để dùng chung trong index.html)
   Tab: Bình áp lực (module binh-ap-luc.js) + Thiết bị nâng
   ========================================================= */
window.renderQuanLyThietBi = function(container, user, canEdit, isAdmin) {
  container.innerHTML = "";

  var _pt = document.createElement("div");
  _pt.className = "page-title";
  _pt.style.cssText = "display:flex;align-items:center;gap:9px;margin-bottom:16px;";
  _pt.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg><span>Quản lý thiết bị</span>';
  container.appendChild(_pt);

  var tabs = [
    { key: "binh-ap-luc",   label: "🔵 Bình áp lực" },
    { key: "thiet-bi-nang", label: "🏗️ Thiết bị nâng" }
  ];
  var activeTab = "binh-ap-luc";

  var content = document.createElement("div");

  function renderTabBar() {
    var old = container.querySelector(".qlhse-tab-bar");
    if (old) container.removeChild(old);
    var bar = document.createElement("div");
    bar.className = "qlhse-tab-bar";
    bar.style.cssText = "display:flex;gap:0;border-bottom:2px solid #cdd6e8;margin-bottom:20px;";
    tabs.forEach(function(tab) {
      var btn = document.createElement("button");
      btn.textContent = tab.label;
      var active = tab.key === activeTab;
      btn.style.cssText =
        "padding:10px 22px;font-size:13.5px;font-weight:" + (active ? "700" : "500") + ";" +
        "border:none;cursor:pointer;" +
        "background:" + (active ? "#fff" : "#f4f7fc") + ";" +
        "color:" + (active ? "#003087" : "#6b7c93") + ";" +
        "border-bottom:" + (active ? "3px solid #003087" : "3px solid transparent") + ";" +
        "margin-bottom:-2px;border-radius:8px 8px 0 0;transition:all 0.15s;";
      btn.onclick = function() { activeTab = tab.key; renderTabBar(); renderContent(); };
      bar.appendChild(btn);
    });
    container.insertBefore(bar, content);
  }

  function renderContent() {
    content.innerHTML = "";
    if (activeTab === "binh-ap-luc") {
      if (typeof window.renderBinhApLuc === "function") {
        window.renderBinhApLuc(content, canEdit || isAdmin);
      } else {
        content.innerHTML = "<p style='color:#c0392b'>Lỗi: không tải được module Bình áp lực.</p>";
      }
    } else {
      content.innerHTML =
        '<div style="text-align:center;padding:60px 20px;">' +
          '<div style="font-size:48px;margin-bottom:12px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/></svg></div>' +
          '<h3 style="color:#003087;margin-bottom:8px;">Thiết bị nâng</h3>' +
          '<p style="color:#6b7c93;">Đang xây dựng. Nội dung sẽ được bổ sung trong phiên bản tiếp theo.</p>' +
        '</div>';
    }
  }

  container.appendChild(content);
  renderTabBar();
  renderContent();
};
