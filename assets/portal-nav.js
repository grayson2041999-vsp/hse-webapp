/* =========================================================
   PORTAL-NAV.JS — Đồng bộ điều hướng cho các trang standalone
   - Ẩn sidebar cũ, giãn nội dung full màn hình
   - Chèn nút "← Trang chủ" vào topbar/header
   - Đổi tiêu đề module sang icon Lucide + tên chuẩn
   Dùng chung cho: tai-nan-su-co, pccc-cnch, kiem-tra-cac-cap,
   moi-truong, ke-hoach, cap-phat-bhld, kham-suc-khoe
   ========================================================= */
(function(){
  "use strict";

  var ICONS = {
    "arrow-left":'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    "triangle-alert":'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    "flame":'<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    "list-checks":'<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
    "recycle":'<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>',
    "calendar-days":'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
    "shield-check":'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    "stethoscope":'<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    "settings":'<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
    "user":'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "log-out":'<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>'
  };

  var MAP = {
    "tai-nan-su-co":   { icon:"triangle-alert", title:"Tai nạn - Sự cố" },
    "pccc-cnch":       { icon:"flame",          title:"PCCC & CNCH" },
    "kiem-tra-cac-cap":{ icon:"list-checks",    title:"Kiểm tra các cấp" },
    "moi-truong":      { icon:"recycle",        title:"Xử lý chất thải" },
    "ke-hoach":        { icon:"calendar-days",  title:"Kế hoạch" },
    "cap-phat-bhld":   { icon:"shield-check",   title:"Cấp phát BHLĐ" },
    "kham-suc-khoe":   { icon:"stethoscope",    title:"Khám sức khoẻ nghề nghiệp" }
  };

  function svg(name, size){
    var p = ICONS[name]; if(!p) return "";
    var s = size||18;
    return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0" aria-hidden="true">'+p+'</svg>';
  }

  /* CSS: ẩn sidebar, giãn full màn hình, style nút back */
  var css =
    '.sidebar{display:none!important}'+
    '.main{margin-left:0!important}'+
    '.topbar{left:0!important}'+
    '.header{left:0!important}'+
    '.portal-back{display:inline-flex;align-items:center;gap:6px;color:#fff;text-decoration:none;'+
      'font-size:12.5px;font-weight:600;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);'+
      'padding:6px 12px;border-radius:7px;transition:.15s;white-space:nowrap}'+
    '.portal-back:hover{background:rgba(255,255,255,.28)}'+
    /* Nhóm nút Trang chủ + tiêu đề/tên đơn vị ở bên trái topbar */
    '.pn-left{display:flex;align-items:center;gap:14px;min-width:0}'+
    /* Nút hamburger cũ (sidebar đã ẩn) → bỏ */
    '.btn-hamburger,.menu-btn{display:none!important}'+
    /* Khung phải chuẩn: gear + user-box + logout */
    '.pn-right{display:flex;align-items:center;gap:8px}'+
    '.pn-gear{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;'+
      'border-radius:7px;color:#fff;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);text-decoration:none;transition:.15s}'+
    '.pn-gear:hover{background:rgba(255,255,255,.28)}'+
    '.pn-user{display:inline-flex;align-items:center;gap:7px;color:#fff;background:rgba(255,255,255,.15);'+
      'border:1.5px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:7px;font-size:12.5px;font-weight:600;white-space:nowrap}'+
    '.pn-chip{padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;color:#fff}'+
    '.pn-logout{display:inline-flex;align-items:center;gap:6px;color:#fff;background:rgba(255,255,255,.15);'+
      'border:1.5px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer;transition:.15s}'+
    '.pn-logout:hover{background:rgba(255,255,255,.28)}'+
    '.pn-viewer{font-size:11.5px;color:#fff;background:rgba(255,255,255,.12);padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.25)}';
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var slug = (location.pathname.split("/").pop() || "").replace(".html", "");
  var info = MAP[slug];

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function pnUser(){
    try{
      var un=JSON.parse(localStorage.getItem("hse_session")||"null");
      if(!un) return null;
      var us=JSON.parse(localStorage.getItem("hse_users")||"[]");
      for(var i=0;i<us.length;i++) if(us[i] && us[i].username===un) return us[i];
    }catch(e){}
    return null;
  }
  function roleLabel(r){ return r==="admin"?"Admin":(r==="viewer"?"Viewer":"User"); }
  function roleColor(r){ return r==="admin"?"#C8102E":(r==="viewer"?"#6b7c93":"#1a7a3c"); }
  window.__pnLogout = function(){ try{ localStorage.removeItem("hse_session"); }catch(e){} location.reload(); };

  function run(){
    /* 1) Nút quay về trang chủ — chỉ chèn nếu trang chưa có link về trang chủ */
    var bar = document.querySelector(".topbar") || document.querySelector(".header");
    // CHỈ kiểm tra trong thanh tiêu đề (bar), KHÔNG quét cả trang: sidebar ẩn của
    // vài trang có mục "Tổng quan" → tong-quan.html khiến guard hiểu nhầm là trang
    // đã có nút về trang chủ → bỏ chèn nút. Đây là lý do 6 trang thiếu nút.
    var hasBack = bar && bar.querySelector('a[href="index.html"], a[href="tong-quan.html"], .portal-back');
    if(bar && !hasBack){
      var a = document.createElement("a");
      a.href = "index.html";
      a.className = "portal-back";
      a.innerHTML = svg("arrow-left",16) + '<span>Trang chủ</span>';
      // Gom nút Trang chủ CHUNG NHÓM với khối tiêu đề/tên đơn vị bên trái,
      // để tiêu đề không bị "space-between" đẩy ra giữa topbar.
      var leftInfo = bar.firstElementChild;
      var isRight = leftInfo && (leftInfo.id === "topbarRight" || (leftInfo.className || "").indexOf("topbar-right") >= 0);
      if(leftInfo && !isRight){
        var group = document.createElement("div");
        group.className = "pn-left";
        bar.insertBefore(group, leftInfo);
        group.appendChild(a);
        group.appendChild(leftInfo);
      } else {
        bar.insertBefore(a, bar.firstChild);
      }
    }

    /* 2) Đổi tiêu đề module: icon Lucide + tên chuẩn */
    if(info){
      var t = document.querySelector(".header-title")
           || document.querySelector(".topbar-title")
           || document.querySelector(".page-title");
      if(t){
        t.innerHTML = svg(info.icon,20) + '<span>'+info.title+'</span>';
        t.style.display = "flex";
        t.style.alignItems = "center";
        t.style.gap = "8px";
      }
    }

    /* 3) Cập nhật tiêu đề tab trình duyệt cho trang đổi tên */
    if(slug === "moi-truong"){
      document.title = document.title.replace("Môi trường", "Xử lý chất thải");
    }

    /* 4) Chuẩn hoá khung phải: gear Quản trị (admin) + user-box Lucide + logout */
    var right = document.getElementById("topbarRight");
    if(right){
      var u = pnUser();
      var gear = (u && u.role==="admin")
        ? '<a href="index.html#quan-tri-he-thong" class="pn-gear" title="Quản trị hệ thống" aria-label="Quản trị hệ thống">'+svg("settings",18)+'</a>'
        : '';
      var box;
      if(u){
        box = '<div class="pn-user">'+svg("user",15)+'<span>'+esc(u.fullname||u.username)+'</span>'+
                '<span class="pn-chip" style="background:'+roleColor(u.role)+'">'+roleLabel(u.role)+'</span>'+
              '</div>'+
              '<button class="pn-logout" onclick="__pnLogout()">'+svg("log-out",15)+'<span>Đăng xuất</span></button>';
      } else {
        box = '<span class="pn-viewer">Chế độ xem</span>';
      }
      right.className = "pn-right";
      right.innerHTML = gear + box;
    } else {
      /* cap-phat-bhld dùng khung .header riêng — chỉ chèn gear cạnh user-box sẵn có */
      var hu = document.getElementById("header-user-info");
      var u2 = pnUser();
      if(hu && u2 && u2.role==="admin" && !document.querySelector(".pn-gear")){
        var g = document.createElement("a");
        g.href = "index.html#quan-tri-he-thong";
        g.className = "pn-gear";
        g.title = "Quản trị hệ thống";
        g.setAttribute("aria-label","Quản trị hệ thống");
        g.innerHTML = svg("settings",18);
        hu.parentNode.insertBefore(g, hu);
      }
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
