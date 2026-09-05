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

  /* Icon nét (lucide) thay cho emoji: emoji mỗi hệ điều hành vẽ một kiểu và
     không ăn theo màu chữ của tab đang chọn. SVG thì dùng currentColor nên
     tab hoạt động icon cũng đậm màu theo. */
  var ICON_BAL   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>';
  var ICON_TBN   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M3 21h18"/><path d="M7 21V4"/><path d="M4 4h16"/><path d="M7 8l4-4"/><path d="M17 4v5"/><path d="M15.5 9h3v2a1.5 1.5 0 0 1-3 0z"/></svg>';
  var tabs = [
    { key: "binh-ap-luc",   label: "Bình áp lực",   icon: ICON_BAL },
    { key: "thiet-bi-nang", label: "Thiết bị nâng", icon: ICON_TBN }
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
      btn.innerHTML = tab.icon + "<span>" + tab.label + "</span>";
      var active = tab.key === activeTab;
      btn.style.cssText =
        "display:inline-flex;align-items:center;gap:8px;" +
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
      if (typeof window.renderThietBiNang === "function") {
        window.renderThietBiNang(content, canEdit || isAdmin);
      } else {
        content.innerHTML = "<p style='color:#c0392b'>Lỗi: không tải được module Thiết bị nâng.</p>";
      }
    }
  }

  container.appendChild(content);
  renderTabBar();
  renderContent();
};
