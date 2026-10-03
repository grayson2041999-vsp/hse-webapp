/* =========================================================
   APP.JS - Lõi portal Quản lý HSE
   - Xem công khai không cần đăng nhập (chế độ Viewer)
   - Nút đăng nhập góc phải trên cho User / Admin
   - 3 vai trò: admin / user / viewer
   - Phân quyền truy cập theo từng trang (module)
   - Render sidebar, topbar, nội dung
   - Lưu dữ liệu bằng localStorage (bản demo, dễ thay backend sau)
   ========================================================= */
(function (global) {
  "use strict";

  /* -------- DANH MỤC MODULE (nguồn dữ liệu duy nhất) -------- */
  // group: "theo-doi" = Theo dõi & Báo cáo · "ung-dung" = Ứng dụng nghiệp vụ · "admin" = Quản trị (icon riêng)
  var MENU = [
    { slug:"tong-quan",          title:"Tổng quan",                   icon:"📊", licon:"layout-dashboard", group:"theo-doi", sub:["Số giờ làm việc an toàn","Tai nạn, sự cố gần nhất"] },
    { slug:"tai-nan-su-co",      title:"Tai nạn - Sự cố",             icon:"⚠️", licon:"triangle-alert",   group:"theo-doi", sub:["Giờ công lao động an toàn","Ghi nhận tai nạn - sự cố"] },
    { slug:"sop",                title:"SOP",                         icon:"📑", licon:"file-text",        group:"theo-doi", sub:[], adminEditOnly:true,
      // title  = nhãn ngắn cho ô trang chủ, menu và danh sách phân quyền
      // pageTitle = tên đầy đủ, chỉ dùng cho tiêu đề lớn trên đầu trang
      pageTitle:"Quy trình vận hành tiêu chuẩn (SOP)" },
    { slug:"kiem-tra-cac-cap",   title:"Kiểm tra các cấp",            icon:"🔍", licon:"list-checks",      group:"theo-doi", sub:["Số lượng kiểm tra các cấp","Ghi nhận các lỗi vào hệ thống","Ghi nhận hành động khắc phục, thời hạn"] },
    { slug:"quan-ly-thiet-bi",   title:"Quản lý thiết bị",            icon:"⚙️", licon:"wrench",           group:"theo-doi", sub:["Thiết bị nâng","Bình áp lực"] },
    { slug:"kham-suc-khoe",      title:"Khám sức khoẻ nghề nghiệp",   icon:"🩺", licon:"stethoscope",      group:"theo-doi", sub:["Theo dõi khám sức khoẻ nghề nghiệp","Theo dõi khám bệnh nghề nghiệp"] },
    { slug:"moi-truong",         title:"Xử lý chất thải",             icon:"🌿", licon:"recycle",          group:"theo-doi", sub:["Thống kê khối lượng rác thải xử lý"] },
    { slug:"quan-ly-nha-thau",   title:"Quản lý nhà thầu",            icon:"👷", licon:"hard-hat",         group:"theo-doi", sub:["Thông tin các nhà thầu đang làm việc","Thuê kho, bãi, văn phòng làm việc"] },
    { slug:"ke-hoach",           title:"Kế hoạch",                    icon:"🗓️", licon:"calendar-days",    group:"theo-doi", sub:["Lập kế hoạch (chọn các mục liên quan)","Báo cáo kế hoạch cụ thể"] },
    { slug:"cap-phat-bhld",      title:"Cấp phát BHLĐ",               icon:"🦺", licon:"shield-check",     group:"ung-dung", sub:["Quản lý cấp phát","Danh mục BHLĐ","Định mức cấp phát","Phiếu yêu cầu","Tồn kho","Nhu cầu mua sắm"] },
    { slug:"huan-luyen-dao-tao", title:"Huấn luyện - Đào tạo",        icon:"🎓", licon:"graduation-cap",   group:"ung-dung", sub:["Thống kê các loại đào tạo, huấn luyện","Kiểm tra kiến thức an toàn","Đào tạo nội bộ"] },
    { slug:"bao-chay-tu-dong",   title:"Báo cáo hệ thống báo cháy tự động", icon:"🔔", licon:"bell",       group:"ung-dung", sub:["Danh sách thiết bị báo cháy","Ghi nhận lỗi & khắc phục"] },
    { slug:"tra-cuu-atvsld",     title:"Tra cứu ATVSLĐ",              icon:"📚", licon:"book-open",       group:"ung-dung", sub:[] },
    { slug:"nhap-svodka",        title:"Nhập thông tin an toàn trên Svodka", icon:"🗄️", licon:"database",  group:"ung-dung", sub:["Danh mục tác vụ nhập","Hướng dẫn nhập từng bước"] },
    { slug:"quan-tri-he-thong",  title:"Quản trị hệ thống",           icon:"🛡️", licon:"settings",         group:"admin",    sub:[], adminOnly:true }
  ];

  var APP_NAME = "Quản lý HSE";
  var ORG_SHORT = "XN Dịch vụ Cảng & Cung ứng VTTB";
  var ORG = "Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị";
  var ORG_PARENT = "Liên doanh Việt - Nga Vietsovpetro";
  var LOGO_PATH = "assets/logo.svg";
  var K_USERS = "hse_users";
  var K_SESS  = "hse_session";
  // Callback để vẽ lại bảng Quản trị sau khi đồng bộ users từ Sheets xong
  var _onUsersSynced = null;

  /* =========================================================
     SUPABASE AUTH HELPERS (Phương án B)
     Tài khoản = user thật trong Supabase Auth; profiles lưu role/perms.
     Giữ cache localStorage (hse_users / hse_session) để UI đọc đồng bộ.
     ========================================================= */
  function _sbReady(){
    if(window.HSE_SB) return Promise.resolve(window.HSE_SB);
    return new Promise(function(resolve,reject){
      var to=setTimeout(function(){ reject(new Error("Supabase client chưa sẵn sàng (thiếu supabase-config.js?)")); },12000);
      window.addEventListener("hse-sb-ready", function(){ clearTimeout(to); resolve(window.HSE_SB); }, {once:true});
    });
  }
  function emailOf(un){
    var s = String(un||"").trim().toLowerCase();
    if(!s) return s;
    if(s.indexOf("@") >= 0) return s;          // đã là email đầy đủ → dùng nguyên
    return s + "@" + (window.HSE_EMAIL_DOMAIN || "vietsov.com.vn");
  }
  function _profileToUser(p){
    return { id:p.id, username:p.username, fullname:p.fullname||"", danhSo:p.danhSo||"",
      role:p.role||"viewer", perms:p.perms||[], capPhatUnits:p.capPhatUnits||[],
      ktUnits:p.ktUnits||[],
      active:p.active, pendingApproval:p.pendingApproval, created:p.created };
  }
  function _profilePayload(u){
    var o={ username:u.username, fullname:u.fullname||"", danhSo:u.danhSo||"", role:u.role,
      perms:u.perms||[], capPhatUnits:u.capPhatUnits||[], ktUnits:u.ktUnits||[],
      updated:new Date().toISOString() };
    if(typeof u.active!=="undefined") o.active=(u.active!==false);
    if(typeof u.pendingApproval!=="undefined") o.pendingApproval=!!u.pendingApproval;
    return o;
  }
  function _loginErr(err){
    var m=(err&&err.message||"").toLowerCase();
    if(m.indexOf("invalid login")>=0||m.indexOf("credentials")>=0) return "Sai tài khoản hoặc mật khẩu.";
    if(m.indexOf("email not confirmed")>=0) return "Tài khoản chưa được kích hoạt. Liên hệ Admin.";
    return (err&&err.message)||"Đăng nhập thất bại.";
  }
  // Nạp hồ sơ người dùng hiện tại từ profiles → cache localStorage + đặt phiên (hse_session)
  function refreshCurrentUser(authUser){
    return _sbReady().then(function(sb){ return sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle(); })
      .then(function(res){
        if(res.error||!res.data) return null;
        var u=_profileToUser(res.data);
        // Loại MỌI mục trùng: theo id HOẶC theo username (bỏ qua hoa/thường).
        // Chỉ so theo id là chưa đủ — mục cũ cùng username nhưng khác id sẽ ở
        // lại đầu mảng, và findUser() tra theo username lấy đúng mục cũ đó,
        // khiến người đã được cấp quyền vẫn bị coi là chỉ xem.
        var arr=getUsers();
        var _un=String(u.username||"").trim().toLowerCase();
        arr=arr.filter(function(x){
          return String(x.id)!==String(u.id) &&
                 String(x.username||"").trim().toLowerCase()!==_un;
        });
        arr.push(u); setUsers(arr);
        save(K_SESS, u.username);
        return u;
      });
  }
  // Gửi email đặt lại mật khẩu (đọc email/username từ ô đăng nhập)
  function requestPasswordReset(){
    var uEl=document.getElementById("hse-lm-u");
    var erEl=document.getElementById("hse-lm-err");
    var un=(uEl && uEl.value || "").trim();
    function msg(t, ok){ if(!erEl) return; erEl.textContent=t; erEl.style.color=ok?"#1a7a3c":""; erEl.style.display="block"; }
    if(!un){ msg("Nhập email/username của bạn vào ô trên rồi bấm 'Quên mật khẩu?'."); if(uEl) uEl.focus(); return; }
    _sbReady().then(function(sb){
      return sb.auth.resetPasswordForEmail(emailOf(un), { redirectTo: location.origin + location.pathname });
    }).then(function(r){
      if(r && r.error){ msg("Không gửi được email: " + r.error.message); return; }
      msg("✅ Đã gửi email đặt lại mật khẩu tới " + emailOf(un) + ". Vui lòng kiểm tra hộp thư.", true);
    }).catch(function(e){ msg("Lỗi: " + (e && e.message || e)); });
  }
  // Modal đặt mật khẩu mới (mở khi người dùng bấm link khôi phục trong email)
  function openSetNewPassword(){
    var ex=document.getElementById("hse-recovery-modal");
    if(ex){ ex.classList.add("open"); return; }
    var bg=el("div","modal-bg"); bg.id="hse-recovery-modal";
    bg.innerHTML='<div class="modal" style="max-width:420px;">'+
      '<div class="modal-h"><h3>Đặt mật khẩu mới</h3></div>'+
      '<div class="modal-b">'+
        '<div class="login-err" id="rec-err"></div>'+
        '<div id="rec-ok" style="display:none;background:#eafaf1;color:#1a7a3c;border:1px solid #a9dfbf;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
        '<div class="field"><label>Mật khẩu mới</label><input class="inp" id="rec-new" type="password" style="width:100%" placeholder="Tối thiểu 6 ký tự"></div>'+
        '<div class="field"><label>Xác nhận mật khẩu mới</label><input class="inp" id="rec-new2" type="password" style="width:100%"></div>'+
      '</div>'+
      '<div class="modal-f"><button class="btn btn-accent" id="rec-save">Cập nhật mật khẩu</button></div>'+
    '</div>';
    document.body.appendChild(bg);
    bg.classList.add("open");
    document.getElementById("rec-save").addEventListener("click", function(){
      var nw=document.getElementById("rec-new").value, nw2=document.getElementById("rec-new2").value;
      var er=document.getElementById("rec-err"), ok=document.getElementById("rec-ok");
      er.style.display="none";
      if(!nw || nw.length<6){ er.textContent="Mật khẩu tối thiểu 6 ký tự."; er.style.display="block"; return; }
      if(nw!==nw2){ er.textContent="Mật khẩu xác nhận không khớp."; er.style.display="block"; return; }
      var btn=this; btn.disabled=true;
      _sbReady().then(function(sb){ return sb.auth.updateUser({ password: nw }); }).then(function(r){
        if(r.error){ er.textContent=r.error.message; er.style.display="block"; btn.disabled=false; return; }
        ok.textContent="✅ Đã đặt mật khẩu mới. Đang chuyển về trang đăng nhập..."; ok.style.display="block";
        setTimeout(function(){ location.href=location.pathname; }, 1600);
      }).catch(function(e){ er.textContent=(e && e.message || e); er.style.display="block"; btn.disabled=false; });
    });
  }

  /* =========================================================
     QUAY LẠI TRANG CŨ SAU KHI ĐĂNG NHẬP
     Form đăng nhập chỉ có ở trang chủ. Các trang con gửi người dùng sang
     index.html?login=1&next=<trang-con>.html — modal tự mở, đăng nhập xong
     quay lại đúng trang thay vì bỏ họ lại ở trang chủ.
     ========================================================= */
  // Chỉ chấp nhận tên file .html cùng thư mục. Chặn URL tuyệt đối,
  // "//evil.com", "../" ... để không thành chỗ chuyển hướng mở.
  function safeNext(raw){
    var s = String(raw || "").trim();
    if(!s) return "";
    try { s = decodeURIComponent(s); } catch(e){ return ""; }
    if(!/^[A-Za-z0-9._-]+\.html$/.test(s)) return "";
    if(s.indexOf("..") >= 0) return "";
    return s;
  }
  function loginNextTarget(){
    try { return safeNext(new URLSearchParams(location.search).get("next")); }
    catch(e){ return ""; }
  }
  // Gọi sau khi đăng nhập/đăng ký thành công
  function afterLoginGo(){
    var next = loginNextTarget();
    if(next) location.href = next; else location.reload();
  }

  /* -------- TIỆN ÍCH -------- */
  function $(s, r){ return (r||document).querySelector(s); }
  function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function load(k, def){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; } }
  function sheetDateToLocal(s){ if(!s||typeof s!=="string"||s.indexOf("T")<0) return s; var d=new Date(s); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  /* -------- TOAST DÙNG CHUNG --------
     Trước đây showToast chỉ được định nghĩa trong một vài trang standalone
     (ke-hoach.html, bao-chay-tu-dong.html, cap-phat-bhld.html). Ở index.html (nơi
     có tab Quản trị hệ thống) không có showToast → mọi thao tác thêm/sửa/xoá/
     khoá user gọi showToast trong bước đồng bộ Sheets sẽ ném ReferenceError,
     khiến admin không nhận được phản hồi. Định nghĩa 1 bản tự chứa ở đây để
     dùng chung; chỉ tạo khi trang chưa có bản riêng. */
  if (typeof global.showToast !== "function") {
    global.showToast = function(msg, type){
      try {
        var box = document.getElementById("hse-toast-box");
        if(!box){
          box = document.createElement("div");
          box.id = "hse-toast-box";
          box.style.cssText = "position:fixed;z-index:99999;right:18px;bottom:18px;display:flex;flex-direction:column;gap:8px;max-width:340px;";
          document.body.appendChild(box);
        }
        var colors = { success:"#1a7f37", error:"#d1242f", warning:"#9a6700", info:"#0060B6" };
        var t = document.createElement("div");
        t.style.cssText = "background:"+(colors[type]||"#003087")+";color:#fff;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.4;box-shadow:0 4px 14px rgba(0,0,0,.18);opacity:0;transform:translateY(8px);transition:all .2s;";
        t.textContent = msg;
        box.appendChild(t);
        requestAnimationFrame(function(){ t.style.opacity="1"; t.style.transform="translateY(0)"; });
        setTimeout(function(){ t.style.opacity="0"; t.style.transform="translateY(8px)"; setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 250); }, 3200);
      } catch(e) { /* không bao giờ để toast làm hỏng luồng chính */ }
    };
  }

  function allSlugs(){ return MENU.map(function(m){return m.slug;}); }
  function menuBySlug(s){ for(var i=0;i<MENU.length;i++) if(MENU[i].slug===s) return MENU[i]; return null; }

  /* -------- ĐIỀU HƯỚNG --------
     Trang nhẹ (shell) render qua index.html#slug; trang nghiệp vụ lớn mở file .html riêng */
  var STANDALONE_PAGES = {
    "tai-nan-su-co":1, "kiem-tra-cac-cap":1, "moi-truong":1,
    "ke-hoach":1, "cap-phat-bhld":1, "kham-suc-khoe":1, "bao-chay-tu-dong":1
  };
  function pageHref(slug){
    return STANDALONE_PAGES[slug] ? (slug + ".html") : ("index.html#" + slug);
  }

  /* -------- ICON LUCIDE (inline SVG, chạy offline, không cần CDN) -------- */
  var ICON_PATHS = {
    "layout-dashboard":'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    "triangle-alert":'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    "flame":'<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    "file-text":'<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    "list-checks":'<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
    "wrench":'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    "stethoscope":'<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    "recycle":'<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>',
    "hard-hat":'<path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/>',
    "calendar-days":'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
    "shield-check":'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    "graduation-cap":'<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    "settings":'<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
    "arrow-left":'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    "log-out":'<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    "user":'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "bell":'<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    "lock":'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "key":'<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    "book-open":'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    "external-link":'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "info":'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "database":'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'
  };
  function lic(name, size){
    var p = ICON_PATHS[name]; if(!p) return "";
    var s = size||18;
    return '<svg class="lic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
  }

  /* -------- KHỞI TẠO DB (Google Sheets) -------- */
  function initDB(){
    if(typeof DB !== "undefined") DB.init();
    // Lắng nghe link đặt lại mật khẩu từ email (event PASSWORD_RECOVERY)
    _sbReady().then(function(sb){
      sb.auth.onAuthStateChange(function(event){
        if(event === "PASSWORD_RECOVERY"){ openSetNewPassword(); }
      });
    }).catch(function(){});
    // Khôi phục phiên Supabase (nếu có) → nạp hồ sơ vào cache để UI đọc đồng bộ
    _sbReady().then(function(sb){
      return sb.auth.getSession().then(function(r){
        var sess = r && r.data && r.data.session;
        if(!sess){ localStorage.removeItem(K_SESS); return; }
        return refreshCurrentUser(sess.user).then(function(u){
          if(!u) return;
          if(typeof DB !== "undefined") DB.setUser(u.username);
          if(u.role==="admin" && typeof DB !== "undefined"){
            DB.syncUsersFromSheets(K_USERS).then(function(){
              if(typeof _onUsersSynced === "function") _onUsersSynced();
            });
          }
        });
      });
    }).catch(function(e){ console.warn("[HSE] init auth:", e && e.message || e); });
  }

  /* -------- KHỞI TẠO TÀI KHOẢN MẶC ĐỊNH -------- */
  function seedUsers(){
    // Phương án B: tài khoản nằm trong Supabase Auth. KHÔNG seed admin giả ở localStorage.
    // (Admin đầu tiên được tạo trong Supabase Dashboard + bootstrap_admin — xem hướng dẫn.)
    return getUsers();
  }
  function getUsers(){ return load(K_USERS, []); }
  function dedupUsers(u){
    // Dedup theo id (khóa duy nhất). KHÔNG dedup theo username để tránh
    // gộp/ẩn mất các user khác nhau nhưng vô tình trùng username.
    var seen={}, out=[];
    (u||[]).forEach(function(x){ if(!x) return; var k=x.id!=null?String(x.id):x.username; if(k && !seen[k]){ seen[k]=true; out.push(x); } });
    return out;
  }
  function setUsers(u){
    u = dedupUsers(u);
    // KHÔNG lưu mật khẩu thô vào localStorage — mật khẩu do Supabase Auth quản lý.
    save(K_USERS, u.map(function(x){ var c=Object.assign({},x); delete c.password; delete c.pwHash; return c; }));
    // Đồng bộ Auth/profiles được thực hiện riêng tại từng thao tác qua _syncUserSheet()
  }

  // Đồng bộ 1 user lên Sheet theo đúng loại thao tác: 'insert' | 'update' | 'delete'
  // insert: userOrId là object user mới
  // update: userOrId là object user đầy đủ (cần có .id)
  // delete: userOrId là id string
  function _syncUserSheet(action, userOrId){
    var sb = window.HSE_SB;
    if(!sb){ showToast("⚠️ Supabase chưa sẵn sàng — chưa đồng bộ tài khoản.", "warning"); return; }
    var p, refresh = true;
    if(action === 'insert'){
      var me = currentUser();
      if(me && me.role === 'admin'){
        // Admin tạo tài khoản → Edge Function (service role)
        p = sb.functions.invoke('admin-users', { body: {
              action:'create', username:userOrId.username, password:userOrId.password,
              fullname:userOrId.fullname, danhSo:userOrId.danhSo||"", role:userOrId.role,
              perms:userOrId.perms||[], capPhatUnits:userOrId.capPhatUnits||[],
              ktUnits:userOrId.ktUnits||[],
              active: userOrId.active!==false
            }}).then(_edgeCheck).then(function(r){
              /* Edge Function có thể chưa biết cột ktUnits (mới thêm 03/10/2026)
                 → ghi bổ sung thẳng vào profiles cho chắc. */
              var ku=userOrId.ktUnits||[];
              if(!ku.length) return r;
              return sb.from('profiles').update({ ktUnits:ku }).eq('username', userOrId.username)
                .then(function(x){ if(x && x.error) throw x.error; return r; });
            });
      } else {
        // Tự đăng ký → signUp (chờ Admin duyệt); KHÔNG giữ đăng nhập người mới
        p = sb.auth.signUp({ email: emailOf(userOrId.username), password: userOrId.password,
              options:{ data:{ username:userOrId.username, fullname:userOrId.fullname,
                danhSo:userOrId.danhSo||"", role:'viewer', perms:[], capPhatUnits:[], ktUnits:[],
                active:false, pendingApproval:true } } })
            .then(function(r){ if(r.error) throw r.error; return sb.auth.signOut(); });
        refresh = false;
      }
    } else if(action === 'update'){
      var jobs = [ sb.from('profiles').update(_profilePayload(userOrId)).eq('id', userOrId.id) ];
      if(userOrId.password){ // admin đặt mật khẩu mới trong modal
        jobs.push( sb.functions.invoke('admin-users', { body:{ action:'resetPassword',
          username:userOrId.username, password:userOrId.password } }).then(_edgeCheck) );
      }
      p = Promise.all(jobs).then(function(rs){ rs.forEach(function(r){ if(r && r.error) throw r.error; }); });
    } else if(action === 'delete'){
      var u = findUserById(userOrId);
      p = sb.functions.invoke('admin-users', { body:{ action:'delete',
            username: u ? u.username : userOrId } }).then(_edgeCheck);
    }
    if(p) p.then(function(){
      showToast("☁️ Đã đồng bộ tài khoản!", "success");
      if(refresh && typeof DB !== "undefined"){
        DB.syncUsersFromSheets(K_USERS).then(function(){ if(typeof _onUsersSynced === "function") _onUsersSynced(); });
      }
    }).catch(function(e){
      showToast("⚠️ Chưa đồng bộ được tài khoản: " + (e && e.message || e), "warning");
    });
  }
  // Chuẩn hoá lỗi trả về từ Edge Function
  function _edgeCheck(r){
    if(r && r.error) throw r.error;
    if(r && r.data && r.data.ok === false) throw new Error(r.data.error || "Thao tác thất bại");
    return r;
  }
  function findUser(un){ var u=getUsers(); for(var i=0;i<u.length;i++) if(u[i].username===un) return u[i]; return null; }
  function findUserById(id){ var u=getUsers(); for(var i=0;i<u.length;i++) if(String(u[i].id)===String(id)) return u[i]; return null; }

  /* -------- PHIÊN LÀM VIỆC -------- */
  function currentUser(){ var un=load(K_SESS,null); return un?findUser(un):null; }
  /* -------- MẬT KHẨU — do Supabase Auth quản lý -------- */
  // hashPw giữ chữ ký cũ (Promise) nhưng KHÔNG hash nữa: mật khẩu được gửi thẳng
  // tới Supabase Auth. Các luồng UI cũ gọi hashPw(pw).then(fn) vẫn chạy đúng.
  function hashPw(pw){ return Promise.resolve(pw); }

  function login(un, pw, callback){
    un=(un||"").trim();
    _sbReady().then(function(sb){
      return sb.auth.signInWithPassword({ email: emailOf(un), password: pw }).then(function(res){
        if(res.error){ callback({ok:false, msg:_loginErr(res.error)}); return; }
        return refreshCurrentUser(res.data.user).then(function(u){
          if(!u){ sb.auth.signOut(); callback({ok:false,msg:"Không tải được hồ sơ tài khoản."}); return; }
          if(u.pendingApproval && u.active===false){ sb.auth.signOut(); localStorage.removeItem(K_SESS);
            callback({ok:false,msg:"⏳ Tài khoản đang chờ Admin phê duyệt. Vui lòng liên hệ quản trị viên."}); return; }
          if(u.active===false){ sb.auth.signOut(); localStorage.removeItem(K_SESS);
            callback({ok:false,msg:"🔒 Tài khoản đã bị khoá. Liên hệ Admin để mở khoá."}); return; }
          if(typeof DB !== "undefined") DB.setUser(u.username);
          if(u.role==="admin" && typeof DB !== "undefined") DB.syncUsersFromSheets(K_USERS);
          callback({ok:true});
        });
      });
    }).catch(function(e){ callback({ok:false, msg:(e && e.message)||"Lỗi kết nối máy chủ."}); });
  }
  function logout(){
    _sbReady().then(function(sb){ return sb.auth.signOut(); })
      .catch(function(){})
      .then(function(){ localStorage.removeItem(K_SESS); location.reload(); });
  }

  /* -------- PHÂN QUYỀN -------- */
  function isAdmin(u){ return u && u.role==="admin"; }
  function canView(u, slug){
    var m = menuBySlug(slug);
    // Trang adminOnly: chỉ admin đăng nhập mới xem được
    if(m && m.adminOnly) return u && u.role==="admin";
    // Tất cả người dùng (kể cả chưa đăng nhập) đều xem được trang thường
    return true;
  }
  function canEdit(u, slug){
    if(!u) return false;
    if(u.role==="admin") return true;
    if(u.role==="viewer") return false;
    // Trang chỉ admin được chỉnh sửa
    var m = menuBySlug(slug);
    if(m && m.adminEditOnly) return false;
    // User: chỉ edit được trang admin đã cấp quyền
    return (u.perms||[]).indexOf(slug) !== -1;
  }
  function roleLabel(r){ return r==="admin"?"Admin":(r==="viewer"?"Viewer":"User"); }

  /* =========================================================
     MODAL ĐĂNG NHẬP (popup nhỏ từ topbar)
     ========================================================= */
  function ensureLoginModal(){
    if(document.getElementById("hse-login-modal")) return;
    var bg = el("div","login-modal-bg"); bg.id="hse-login-modal";
    bg.innerHTML =
      '<div class="login-popup">'+
        '<div class="login-popup-h">'+
          '<div style="display:flex;align-items:center;gap:10px">'+
            '<div class="login-popup-logo"><img src="assets/logo.svg" alt="VSP" style="width:100%;height:100%;object-fit:contain"></div>'+
            '<div>'+
              '<div style="font-weight:700;font-size:14px;color:var(--brand)">'+APP_NAME+'</div>'+
              '<div style="font-size:10.5px;color:var(--text-muted);line-height:1.3">'+ORG+'</div>'+
              '<div style="font-size:10.5px;color:var(--text-muted);line-height:1.3">'+ORG_PARENT+'</div>'+
            '</div>'+
          '</div>'+
          '<button class="x" id="hse-lm-close">×</button>'+
        '</div>'+
        '<div class="login-popup-b">'+
          '<div class="login-err" id="hse-lm-err"></div>'+
          '<form id="hse-lm-form">'+
            '<div class="field"><label>Email</label><input id="hse-lm-u" class="inp" type="text" style="width:100%" autocomplete="username" placeholder="VD: sonlhh.sd"></div>'+
            '<div class="field"><label>Mật khẩu</label><input id="hse-lm-p" type="password" class="inp" style="width:100%" autocomplete="current-password" placeholder="Nhập mật khẩu"></div>'+
            '<button class="btn btn-block" type="submit">Đăng nhập</button>'+
          '</form>'+
          '<div style="text-align:right;margin-top:8px;">'+
            '<a href="#" id="hse-lm-forgot" style="font-size:12px;color:var(--text-muted);">Quên mật khẩu?</a>'+
          '</div>'+
          '<div style="text-align:center;margin-top:14px;">'+
            '<span style="font-size:12.5px;color:var(--text-muted);">Chưa có tài khoản? </span>'+
            '<a href="#" id="hse-lm-reg-link" style="font-size:12.5px;font-weight:600;color:var(--brand);">Đăng ký</a>'+
          '</div>'+
        '</div>'+
        '<!-- PANEL ĐĂNG KÝ (ẩn mặc định) -->'+
        '<div id="hse-reg-panel" style="display:none;padding:0 20px 20px;">'+
          '<div style="font-size:13px;font-weight:700;color:var(--brand);margin-bottom:14px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg> Đăng ký tài khoản</div>'+
          '<div class="login-err" id="hse-reg-err"></div>'+
          '<div class="field"><label>Email *</label><input id="reg-un" class="inp" type="text" style="width:100%" placeholder="VD: sonlhh.sd"></div>'+
          '<div class="field"><label>Họ và tên *</label><input id="reg-fn" class="inp" style="width:100%" placeholder="Nguyễn Văn A"></div>'+
          '<div class="field"><label>Danh số</label><input id="reg-ds" class="inp" style="width:100%" placeholder="VD: 21398"></div>'+
          '<div class="field"><label>Mật khẩu *</label><input id="reg-pw" type="password" class="inp" style="width:100%"></div>'+
          '<div class="field"><label>Xác nhận mật khẩu *</label><input id="reg-pw2" type="password" class="inp" style="width:100%"></div>'+
          '<div style="background:#fef9e7;border-left:3px solid var(--warning);padding:9px 12px;border-radius:6px;font-size:12px;color:#856404;margin-bottom:14px;">'+
            '⏳ Tài khoản mới cần Admin phê duyệt trước khi sử dụng.'+
          '</div>'+
          '<button class="btn btn-block" id="hse-reg-submit">Gửi đăng ký</button>'+
          '<div style="text-align:center;margin-top:12px;">'+
            '<a href="#" id="hse-reg-back" style="font-size:12.5px;color:var(--text-muted);">← Quay lại đăng nhập</a>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(bg);

    function close(){ bg.classList.remove("open"); showLoginPanel(); }
    function showLoginPanel(){
      document.getElementById("hse-lm-form").parentElement.style.display="block";
      document.getElementById("hse-reg-panel").style.display="none";
      document.getElementById("hse-lm-err").style.display="none";
    }
    function showRegPanel(){
      document.getElementById("hse-lm-form").parentElement.style.display="none";
      document.getElementById("hse-reg-panel").style.display="block";
      document.getElementById("hse-reg-err").style.display="none";
      document.getElementById("reg-un").value="";
      document.getElementById("reg-fn").value="";
      document.getElementById("reg-ds").value="";
      document.getElementById("reg-pw").value="";
      document.getElementById("reg-pw2").value="";
    }

    bg.addEventListener("click", function(e){ if(e.target===bg) close(); });
    $("#hse-lm-close").addEventListener("click", close);
    $("#hse-lm-form").addEventListener("submit", function(e){
      e.preventDefault();
      var btn=this.querySelector("button[type=submit]");
      if(btn){btn.disabled=true;btn.textContent="Đang kiểm tra...";}
      login($("#hse-lm-u").value, $("#hse-lm-p").value, function(r){
        if(btn){btn.disabled=false;btn.textContent="Đăng nhập";}
        if(r.ok){ afterLoginGo(); }
        else{ var er=$("#hse-lm-err"); er.textContent=r.msg; er.style.display="block"; }
      });
    });
    var forgotLink = document.getElementById("hse-lm-forgot");
    if(forgotLink) forgotLink.addEventListener("click", function(e){ e.preventDefault(); requestPasswordReset(); });
    document.getElementById("hse-lm-reg-link").addEventListener("click", function(e){ e.preventDefault(); showRegPanel(); });
    document.getElementById("hse-reg-back").addEventListener("click", function(e){ e.preventDefault(); showLoginPanel(); });
    document.getElementById("hse-reg-submit").addEventListener("click", function(){
      var un=(document.getElementById("reg-un").value||"").trim();
      var fn=(document.getElementById("reg-fn").value||"").trim();
      var ds=(document.getElementById("reg-ds").value||"").trim();
      var pw=document.getElementById("reg-pw").value;
      var pw2=document.getElementById("reg-pw2").value;
      var errEl=document.getElementById("hse-reg-err");
      function showErr(msg){ errEl.textContent=msg; errEl.style.display="block"; }
      if(!un||!fn||!pw){ return showErr("Vui lòng điền đầy đủ các trường bắt buộc (*)"); }
      if(!un){ return showErr("Vui lòng nhập email."); }
      if(pw!==pw2){ return showErr("Mật khẩu xác nhận không khớp."); }
      if(pw.length<6){ return showErr("Mật khẩu tối thiểu 6 ký tự."); }
      if(findUser(un)){ return showErr("Email này đã được đăng ký."); }
      var u=getUsers();
      var regBtn=document.getElementById("hse-reg-submit");
      if(regBtn){regBtn.disabled=true;regBtn.textContent="Đang xử lý...";}
      hashPw(pw).then(function(hashed){
        var newUser={ id:Date.now().toString(36), username:un, password:hashed, fullname:fn, danhSo:ds,
          role:"viewer", perms:[], active:false, pendingApproval:true, created:new Date().toISOString() };
        u.push(newUser);
        setUsers(u);
        _syncUserSheet('insert', newUser);
        document.getElementById("hse-reg-panel").innerHTML=
          '<div style="text-align:center;padding:24px 0;">'+
            '<div style="font-size:40px;margin-bottom:12px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></div>'+
            '<div style="font-size:14px;font-weight:700;color:var(--brand);margin-bottom:8px;">Đăng ký thành công!</div>'+
            '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Tài khoản <b>'+esc(un)+'</b> đã được tạo và đang chờ Admin phê duyệt.</div>'+
            '<button class="btn" onclick="document.getElementById(\'hse-login-modal\').classList.remove(\'open\')">Đóng</button>'+
          '</div>';
      }).catch(function(e){
        if(regBtn){regBtn.disabled=false;regBtn.textContent="Gửi đăng ký";}
        alert("❌ Đăng ký thất bại, vui lòng thử lại.\n(" + (e && e.message || "Lỗi kết nối") + ")");
      });
    });
  }

  function openLoginModal(){
    var bg = document.getElementById("hse-login-modal");
    if(!bg){ ensureLoginModal(); bg=document.getElementById("hse-login-modal"); }
    bg.classList.add("open");
    setTimeout(function(){ var f=document.getElementById("hse-lm-u"); if(f) f.focus(); }, 80);
  }

  /* =========================================================
     RENDER: KHUNG LAYOUT (sidebar + topbar)
     ========================================================= */
  function renderShell(activeSlug, contentNode){
    var u = currentUser();
    // Không redirect - cho phép xem không cần đăng nhập
    var m = menuBySlug(activeSlug);

    document.body.className="";
    document.body.innerHTML="";

    // Đếm tài khoản chờ duyệt để hiện badge trên icon Quản trị
    var pendingCount = isAdmin(u) ? getUsers().filter(function(x){ return x.pendingApproval && x.active===false; }).length : 0;

    /* MAIN — không còn sidebar; điều hướng qua lưới trang chủ + nút quay lại */
    var main = el("div","main main-full");
    var top = el("header","topbar");

    var userBoxHtml;
    if(u){
      var initials=(u.fullname||u.username).trim().split(/\s+/).map(function(w){return w[0];}).slice(-2).join("").toUpperCase();
      var roleColor = u.role==="admin" ? "#C8102E" : u.role==="viewer" ? "#6b7c93" : "#1a7a3c";
      userBoxHtml=
        '<div class="user-box" style="position:relative;display:flex;align-items:center;gap:8px;">'+
          '<button id="btn-profile"'+
            ' style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.15);'+
            'border:1.5px solid rgba(255,255,255,0.3);color:#fff;padding:5px 12px;border-radius:7px;'+
            'cursor:pointer;font-size:12.5px;transition:.15s;"'+
            ' onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'"'+
            ' onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">'+
            '<span style="display:inline-flex;">'+lic("user",15)+'</span>'+
            '<span style="font-weight:600;">'+esc(u.fullname||u.username)+'</span>'+
            '<span style="background:'+roleColor+';color:#fff;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;">'+roleLabel(u.role)+'</span>'+
          '</button>'+
          '<button id="lo"'+
            ' style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);'+
            'color:#fff;padding:5px 14px;border-radius:7px;cursor:pointer;font-size:12.5px;font-weight:600;transition:.15s;"'+
            ' onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'"'+
            ' onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">'+
            'Đăng xuất'+
          '</button>'+
          '<div id="profile-dropdown" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.14);min-width:220px;z-index:200;border:1px solid var(--border);overflow:hidden;">'+
            '<div style="padding:14px 16px;border-bottom:1px solid var(--border);background:#f8f9fd;">'+
              '<div style="font-weight:700;font-size:13.5px;color:var(--text);">'+esc(u.fullname||u.username)+'</div>'+
              '<div style="font-size:12px;color:var(--text-muted);">'+esc(u.username)+' · '+roleLabel(u.role)+'</div>'+
            '</div>'+
            '<button id="btn-edit-profile" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#f0f3fa\'" onmouseout="this.style.background=\'transparent\'">'+
              lic("user",15)+' Chỉnh sửa hồ sơ cá nhân'+
            '</button>'+
            '<button id="btn-doi-mk" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#f0f3fa\'" onmouseout="this.style.background=\'transparent\'">'+
              lic("key",15)+' Đổi mật khẩu'+
            '</button>'+
          '</div>'+
        '</div>';
    } else {
      // Cùng bộ class .pn-viewer/.pn-login với các trang module (assets/header-auth.css)
      // để header trông giống hệt nhau ở mọi trang. Ở đây form có sẵn nên mở modal
      // tại chỗ thay vì điều hướng.
      userBoxHtml= activeSlug==="tong-quan"
        ? '<div class="user-box">'+
            '<span class="pn-viewer">Chế độ xem</span>'+
            '<button class="pn-login" id="lo" title="Đăng nhập để thao tác và nhập liệu">'+lic("lock",14)+'<span>Đăng nhập</span></button>'+
          '</div>'
        : '<div class="user-box">'+
            '<span class="pn-viewer">Chế độ xem</span>'+
            '<button class="pn-login" id="lo" title="Đăng nhập để thao tác và nhập liệu">'+lic("lock",14)+'<span>Đăng nhập</span></button>'+
          '</div>';
    }

    var leftHtml;
    if(activeSlug==="tong-quan"){
      leftHtml=
        '<a href="index.html" class="tb-brand">'+
          '<span class="tb-logo"><img src="assets/logo.svg" alt="Vietsovpetro"></span>'+
          '<span class="tb-brand-t"><b>'+esc(APP_NAME)+'</b><i>'+esc(ORG_SHORT)+'</i></span>'+
        '</a>';
    } else {
      leftHtml=
        '<a href="index.html" class="tb-back">'+lic("arrow-left",16)+'<span>Trang chủ</span></a>'+
        '<span class="tb-sep"></span>'+
        '<div class="tb-org" style="display:flex;flex-direction:column;justify-content:center;line-height:1.3;">'+
          '<div style="font-size:11px;opacity:.75;">'+esc(ORG_PARENT)+'</div>'+
          '<div style="font-size:12px;font-weight:700;opacity:.95;">'+esc(ORG)+'</div>'+
        '</div>';
    }
    var gearHtml = isAdmin(u)
      ? '<a href="index.html#quan-tri-he-thong" class="tb-gear'+(activeSlug==="quan-tri-he-thong"?" on":"")+'" title="Quản trị hệ thống" aria-label="Quản trị hệ thống">'+
          lic("settings",19)+
          (pendingCount>0?'<span class="tb-gear-badge">'+pendingCount+'</span>':'')+
        '</a>'
      : '';
    top.innerHTML=
      leftHtml+
      '<div class="spacer"></div>'+
      gearHtml+
      userBoxHtml;

    main.appendChild(top);
    var content = el("main","content"); content.id="content";
    if(contentNode) content.appendChild(contentNode);
    main.appendChild(content);
    document.body.appendChild(main);

    if(u){
      // Profile dropdown toggle
      var profileBtn=document.getElementById("btn-profile");
      var profileDrop=document.getElementById("profile-dropdown");
      if(profileBtn&&profileDrop){
        profileBtn.addEventListener("click",function(e){
          e.stopPropagation();
          var open=profileDrop.style.display!=="none";
          profileDrop.style.display=open?"none":"block";
        });
        document.addEventListener("click",function(){ profileDrop.style.display="none"; },{once:false});
        profileDrop.addEventListener("click",function(e){e.stopPropagation();});
      }
      $("#lo").addEventListener("click", logout);
      var doiMkBtn = document.getElementById("btn-doi-mk");
      if(doiMkBtn) doiMkBtn.addEventListener("click", function(){ if(profileDrop)profileDrop.style.display="none"; openDoiMatKhau(); });
      var editProfileBtn = document.getElementById("btn-edit-profile");
      if(editProfileBtn) editProfileBtn.addEventListener("click", function(){ if(profileDrop)profileDrop.style.display="none"; openEditProfile(); });
    } else {
      // Chưa đăng nhập — #lo giờ là nút Đăng nhập trên MỌI trang, không riêng Tổng quan
      ensureLoginModal();
      var loBtn = $("#lo");
      if(loBtn) loBtn.addEventListener("click", openLoginModal);
      // Đến từ nút Đăng nhập ở trang module (?login=1) → mở sẵn modal
      try{
        if(new URLSearchParams(location.search).get("login")==="1") openLoginModal();
      }catch(e){}
    }
    return content;
  }

  /* =========================================================
     RENDER: TRANG MODULE
     ========================================================= */
  function renderPage(slug){
    seedUsers();
    var u = currentUser();

    // Quản trị hệ thống: chỉ admin
    if(slug==="quan-tri-he-thong"){
      if(!u){
        renderShell(slug, needLoginNode("Trang này yêu cầu đăng nhập với quyền Admin.")); return;
      }
      if(!isAdmin(u)){ renderShell(slug, deniedNode()); return; }
      var c = renderShell(slug, el("div")); renderAdmin(c); return;
    }

    // Trang SOP: custom renderer
    if(slug === "sop"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var sopContainer = renderShell(slug, el("div"));
      renderSop(sopContainer, u, isAdmin(u));
      return;
    }

    // Trang huấn luyện đào tạo: custom renderer (module riêng)
    if(slug === "huan-luyen-dao-tao"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var hlContainer = renderShell(slug, el("div"));
      if(typeof window.renderHuanLuyen === "function"){
        window.renderHuanLuyen(hlContainer, u, canEdit(u, slug), isAdmin(u));
      }
      return;
    }

    // Trang quản lý thiết bị: custom renderer (module riêng)
    if(slug === "quan-ly-thiet-bi"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var tbContainer = renderShell(slug, el("div"));
      if(typeof window.renderQuanLyThietBi === "function"){
        window.renderQuanLyThietBi(tbContainer, u, canEdit(u, slug), isAdmin(u));
      }
      return;
    }

    // Trang quản lý nhà thầu: custom renderer (module riêng)
    if(slug === "quan-ly-nha-thau"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var ntContainer = renderShell(slug, el("div"));
      if(typeof window.renderQuanLyNhaThau === "function"){
        window.renderQuanLyNhaThau(ntContainer, u, canEdit(u, slug) || isAdmin(u));
      }
      return;
    }

    // Trang Tra cứu ATVSLĐ: link NotebookLM do admin cấu hình
    if(slug === "tra-cuu-atvsld"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var atvsldContainer = renderShell(slug, el("div"));
      renderTraCuuAtvsld(atvsldContainer, u, isAdmin(u));
      return;
    }

    // Trang Nhập thông tin an toàn trên Svodka: module riêng
    if(slug === "nhap-svodka"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var svContainer = renderShell(slug, el("div"));
      if(typeof window.renderSvodka === "function"){
        window.renderSvodka(svContainer, u, isAdmin(u));
      }
      return;
    }

    // Trang thường: anonymous có thể xem, user/viewer theo phân quyền
    if(!canView(u, slug)){
      renderShell(slug, deniedNode()); return;
    }

    var m = menuBySlug(slug);
    var wrap = el("div");

    var descText;
    if(!u){
      descText='<span style="color:var(--text-muted)">Bạn đang xem ở chế độ khách. </span>'+
        '<a href="#" id="loginLink" style="color:var(--brand);font-weight:600">Đăng nhập</a>'+
        '<span style="color:var(--text-muted)"> để thao tác và nhập liệu.</span>';
    } else if(canEdit(u,slug)){
      descText='Bạn có quyền thao tác trên trang này.';
    } else {
      descText='Bạn chỉ có quyền xem trang này.';
    }

    wrap.appendChild(el("div","",
      '<div class="page-title" style="display:flex;align-items:center;gap:9px">'+(m.licon?lic(m.licon,22):"")+esc(m.pageTitle||m.title)+'</div>'+
      '<div class="page-desc">'+descText+'</div>'));

    // Widget kế hoạch tháng này
    renderKeHoachWidget(slug, wrap);

    wrap.appendChild(el("div","wip",
      '<div class="ic"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/></svg></div><h3>Đang xây dựng</h3>'+
      '<p>Trang <b>'+esc(m.title)+'</b> đang được phát triển. Nội dung chi tiết sẽ được bổ sung trong phiên bản tiếp theo.</p>'));

    if(m.sub && m.sub.length){
      wrap.appendChild(el("div","section-h","Các mục chức năng dự kiến"));
      var grid = el("div","grid grid-sub");
      m.sub.forEach(function(s){
        var card = el("div","card sub-card",
          '<div class="sic"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></div><div><h4>'+esc(s)+'</h4><span class="tag">Đang xây dựng</span></div>');
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    }

    renderShell(slug, wrap);

    // Wire up inline login link
    var ll = document.getElementById("loginLink");
    if(ll){ ll.addEventListener("click", function(e){ e.preventDefault(); openLoginModal(); }); }
  }

  function deniedNode(){
    return el("div","wip",
      '<div class="ic"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h3>Không có quyền truy cập</h3>'+
      '<p>Bạn chưa được cấp quyền truy cập trang này. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>');
  }

  function needLoginNode(msg){
    var d = el("div","wip");
    d.innerHTML='<div class="ic"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h3>Yêu cầu đăng nhập</h3>'+
      '<p>'+(msg||"Vui lòng đăng nhập để tiếp tục.")+'</p>'+
      '<button class="btn" style="margin-top:16px" id="needLoginBtn">Đăng nhập ngay</button>';
    setTimeout(function(){
      var b = document.getElementById("needLoginBtn");
      if(b) b.addEventListener("click", openLoginModal);
    }, 0);
    return d;
  }

  /* =========================================================
     RENDER: TRA CỨU THÔNG TIN ATVSLĐ (NotebookLM)
     - Admin: cấu hình & lưu link NotebookLM (lưu trên Supabase → app_settings)
     - User/Viewer: bấm → thông báo cần đăng nhập Google → mở link tab mới
     ========================================================= */
  var ATVSLD_KEY = "notebooklm_atvsld";
  var ATVSLD_GG_MSG =
    "Chức năng này sử dụng NotebookLM của Google.\n\n" +
    "Bạn cần đăng nhập tài khoản Google trên trình duyệt để xem tài liệu.\n\n" +
    "Bấm OK để tiếp tục mở tài liệu tra cứu.";

  function renderTraCuuAtvsld(container, u, admin){
    var FULL_TITLE = "Tra cứu thông tin về ATVSLĐ tại XNDV";
    var currentLink = "";

    container.innerHTML =
      '<div class="page-title" style="display:flex;align-items:center;gap:9px">'+lic("book-open",22)+esc(FULL_TITLE)+'</div>'+
      '<div class="page-desc">Tra cứu thông tin về An toàn - Vệ sinh lao động tại Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị qua trợ lý NotebookLM.</div>'+
      '<div id="atvsld-body" style="margin-top:18px"></div>';

    var body = $("#atvsld-body", container);

    function esc2(s){ return esc(s==null?"":s); }
    function isValidLink(s){ return /^https?:\/\//i.test(String(s||"").trim()); }

    function openDoc(){
      if(!isValidLink(currentLink)){
        alert("Quản trị viên chưa cấu hình liên kết tài liệu tra cứu. Vui lòng liên hệ Admin.");
        return;
      }
      // confirm() đồng bộ → window.open ngay sau OK không bị chặn popup
      if(window.confirm(ATVSLD_GG_MSG)){
        window.open(currentLink, "_blank", "noopener");
      }
    }

    function draw(){
      var hasLink = isValidLink(currentLink);
      var html =
        '<div class="card" style="max-width:640px;padding:26px 24px;text-align:center">'+
          '<div style="width:64px;height:64px;margin:0 auto 14px;border-radius:16px;display:flex;align-items:center;justify-content:center;'+
            'background:rgba(200,16,46,.08);color:var(--accent,#C8102E)">'+lic("book-open",34)+'</div>'+
          '<h3 style="margin:0 0 6px;font-size:17px;color:var(--text)">Kho tài liệu ATVSLĐ (NotebookLM)</h3>'+
          '<p style="margin:0 auto 20px;max-width:440px;color:var(--text-muted);font-size:13.5px;line-height:1.55">'+
            'Đặt câu hỏi và tra cứu nhanh các quy định, quy trình, tài liệu về An toàn - Vệ sinh lao động của Xí nghiệp.</p>'+
          '<button class="btn btn-accent" id="atvsld-open" '+(hasLink?'':'disabled style="opacity:.55;cursor:not-allowed"')+
            ' style="display:inline-flex;align-items:center;gap:8px;font-size:14px;padding:11px 22px">'+
            lic("external-link",17)+'<span>Mở tài liệu tra cứu</span></button>'+
          (hasLink?'':'<div style="margin-top:12px;font-size:12.5px;color:var(--text-muted)">Chưa có liên kết. Quản trị viên cần cấu hình bên dưới.</div>')+
          '<div style="margin-top:16px;font-size:12px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;gap:6px">'+
            lic("info",14)+'<span>Yêu cầu đăng nhập tài khoản Google để xem.</span></div>'+
        '</div>';

      if(admin){
        html +=
          '<div class="card" style="max-width:640px;margin-top:18px;padding:20px 24px">'+
            '<div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--text);margin-bottom:4px">'+
              lic("settings",17)+'<span>Cấu hình liên kết (chỉ Admin)</span></div>'+
            '<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px">Dán liên kết chia sẻ NotebookLM (đặt chế độ công khai để mọi người xem được).</div>'+
            '<div class="field"><label>Liên kết NotebookLM</label>'+
              '<input class="inp" id="atvsld-link" style="width:100%" placeholder="https://notebooklm.google.com/notebook/..." value="'+esc2(currentLink)+'"></div>'+
            '<div style="display:flex;gap:10px;align-items:center;margin-top:12px">'+
              '<button class="btn btn-accent" id="atvsld-save">Lưu liên kết</button>'+
              (hasLink?'<a href="#" id="atvsld-test" style="font-size:13px;color:var(--brand);font-weight:600">Mở thử</a>':'')+
              '<span id="atvsld-msg" style="font-size:13px"></span>'+
            '</div>'+
          '</div>';
      }
      body.innerHTML = html;

      var ob = $("#atvsld-open", body);
      if(ob) ob.addEventListener("click", openDoc);

      if(admin){
        var saveBtn = $("#atvsld-save", body);
        var msgEl = $("#atvsld-msg", body);
        var testEl = $("#atvsld-test", body);
        if(testEl) testEl.addEventListener("click", function(e){ e.preventDefault(); openDoc(); });
        saveBtn.addEventListener("click", function(){
          var val = ($("#atvsld-link", body).value || "").trim();
          if(val && !isValidLink(val)){
            msgEl.textContent = "Liên kết phải bắt đầu bằng http:// hoặc https://";
            msgEl.style.color = "var(--accent,#C8102E)"; return;
          }
          saveBtn.disabled = true;
          msgEl.style.color = "var(--text-muted)"; msgEl.textContent = "Đang lưu...";
          DB.insert("app_settings", { key: ATVSLD_KEY, value: val, updated_at: new Date().toISOString() })
            .then(function(){
              currentLink = val;
              msgEl.style.color = "#1a7a3c"; msgEl.textContent = "✅ Đã lưu.";
              saveBtn.disabled = false;
              draw();
            })
            .catch(function(e){
              saveBtn.disabled = false;
              msgEl.style.color = "var(--accent,#C8102E)";
              msgEl.textContent = "Lưu thất bại: " + (e && e.message || e);
            });
        });
      }
    }

    draw(); // vẽ ngay (trạng thái chưa có link) để không chờ mạng

    // Nạp link đã lưu từ Supabase
    if(window.DB && DB.getAll){
      DB.getAll("app_settings").then(function(rows){
        var row = (rows||[]).filter(function(r){ return r.key === ATVSLD_KEY; })[0];
        currentLink = (row && row.value) || "";
        draw();
      }).catch(function(){ /* giữ trạng thái mặc định nếu lỗi mạng */ });
    }
  }

  /* =========================================================
     RENDER: LƯỚI LAUNCHER TRANG CHỦ (icon to trên, chữ dưới)
     ========================================================= */
  function launcherSection(title, accent, items, u){
    var tiles = items.map(function(item){
      var viewOnly = (u && u.role!=="admin" && !canEdit(u, item.slug))
        ? '<span class="tile-tag">chỉ xem</span>' : '';
      return '<a class="tile'+(accent==="red"?" tile-app":"")+'" href="'+pageHref(item.slug)+'">'+
        '<span class="tile-ic">'+lic(item.licon,26)+'</span>'+
        '<span class="tile-lbl">'+esc(item.title)+'</span>'+
        viewOnly+
      '</a>';
    }).join("");
    return '<div class="launch-sec">'+
      '<div class="launch-h '+accent+'"><span class="bar"></span>'+esc(title)+'</div>'+
      '<div class="tile-grid">'+tiles+'</div>'+
    '</div>';
  }
  function buildLauncher(u){
    // Bỏ ô Tổng quan (chính là trang chủ) khỏi lưới
    var theoDoi = MENU.filter(function(x){ return x.group==="theo-doi" && x.slug!=="tong-quan"; });
    // Đưa Kế hoạch lên vị trí đầu tiên
    var kh   = theoDoi.filter(function(x){ return x.slug==="ke-hoach"; });
    var rest = theoDoi.filter(function(x){ return x.slug!=="ke-hoach"; });
    theoDoi = kh.concat(rest);
    var ungDung = MENU.filter(function(x){ return x.group==="ung-dung"; });
    var box = el("div","launcher");
    box.innerHTML =
      launcherSection("Theo dõi & Báo cáo", "navy", theoDoi, u) +
      launcherSection("Ứng dụng nghiệp vụ", "red", ungDung, u);
    return box;
  }

  /* =========================================================
     RENDER: TRANG TỔNG QUAN (dashboard có thẻ điều hướng)
     ========================================================= */
  function renderDashboard(){
    seedUsers();
    var u = currentUser();

    var wrap = el("div");

    var greeting;
    if(u){
      greeting = 'Xin chào <b>'+esc(u.fullname||u.username)+'</b>';
    } else {
      greeting = '<a href="#" id="dashLoginLink" style="color:var(--brand);font-weight:600">Đăng nhập</a> để thao tác và nhập liệu.';
    }

    wrap.appendChild(el("div","",
      '<div class="page-title" style="display:flex;align-items:center;gap:9px">'+lic("layout-dashboard",22)+'Tổng quan</div>'+
      '<div class="page-desc" style="margin-bottom:4px">'+greeting+'</div>'+
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">'+ORG+' · '+ORG_PARENT+'</div>'));

    // Cảnh báo đơn vị chưa nộp số liệu kiểm tra cấp 1/2 (điền ngầm sau khi tải dữ liệu)
    var ktNop = el("div"); ktNop.id = "dash-kt-nop"; wrap.appendChild(ktNop);

    // Lưới launcher: 2 nhóm ô điều hướng (icon to trên, chữ dưới)
    wrap.appendChild(buildLauncher(u));

    // (Đã chuyển bảng kế hoạch sang tab "Công việc trong quý" trong trang Kế hoạch)
    renderShell("tong-quan", wrap);
    var dl = document.getElementById("dashLoginLink");
    if(dl){ dl.addEventListener("click", function(e){ e.preventDefault(); openLoginModal(); }); }
    renderKtNopDashboard();

    // Fetch ngầm — cập nhật lại phần kế hoạch khi có data mới
    if(typeof DB !== "undefined" && DB.isReady()){
      Promise.all([
        DB.getAll("ke_hoach_mot_lan").then(function(rows){
          if(rows && rows.length){
            rows.forEach(function(r){
              r.start = sheetDateToLocal(r.start);
              r.end   = sheetDateToLocal(r.end);
              if(r.completionDate) r.completionDate = sheetDateToLocal(r.completionDate);
            });
            save("hse_ke_hoach_mot_lan", rows);
          }
        }).catch(function(e){ console.warn("[KeHoach] Pull mot_lan thất bại:", e && e.message || e); }),
        DB.getAll("ke_hoach_lap_lai").then(function(rows){
          if(rows && rows.length) save("hse_ke_hoach_lap_lai", rows);
        }).catch(function(e){ console.warn("[KeHoach] Pull lap_lai thất bại:", e && e.message || e); })
      ]).then(function(){
        // Rebuild hse_ke_hoach_links từ dữ liệu vừa pull
        var once  = load("hse_ke_hoach_mot_lan", []);
        var recur = load("hse_ke_hoach_lap_lai", []);
        var allLinks = {};
        var today = new Date(); today.setHours(0,0,0,0);
        once.forEach(function(item){
          var targetPages = (item.pages && item.pages.length) ? item.pages : ["ke-hoach"];
          targetPages.forEach(function(slug){
            if(!allLinks[slug]) allLinks[slug]=[];
            var st = item.status||"Chưa bắt đầu";
            if(st!=="Đã hoàn thành" && item.end && new Date(item.end)<today) st="Trễ hạn";
            allLinks[slug].push({ id:item.id, type:"oncetime", name:item.name,
              start:item.start, end:item.end, status:st,
              completionDate:item.completionDate||"", completionReport:item.completionReport||"",
              chuTri:item.chuTri, phoiHop:item.phoiHop, coSo:item.coSo, ghiChu:item.ghiChu });
          });
        });
        recur.forEach(function(item){
          var targetPages = (item.pages && item.pages.length) ? item.pages : ["ke-hoach"];
          targetPages.forEach(function(slug){
            if(!allLinks[slug]) allLinks[slug]=[];
            allLinks[slug].push({ id:item.id, type:"recurring", name:item.name,
              allMonths:item.allMonths, months:item.months||[],
              execDay:item.execDay, lastDay:item.lastDay,
              chuTri:item.chuTri, phoiHop:item.phoiHop, coSo:item.coSo, ghiChu:item.ghiChu });
          });
        });
        save("hse_ke_hoach_links", allLinks);
        // Chỉ cập nhật phần kế hoạch, không render lại toàn trang
        var existing = document.getElementById("dash-kh-section");
        if(existing){
          var tmp = el("div"); renderKeHoachDashboard(tmp);
          existing.parentNode.replaceChild(tmp.lastChild, existing);
        }
      }).catch(function(e){ console.warn("[Dashboard] Pull kế hoạch thất bại:", e && e.message || e); });
    }
  }

  /* =========================================================
     WIDGET: ĐƠN VỊ CHƯA NỘP SỐ LIỆU KIỂM TRA CẤP 1/2 (trang Tổng quan)
     Quy tắc (hạn ngày 1 tháng sau, mốc theo dõi) ở assets/kt-nop.js —
     dùng chung với kiem-tra-cac-cap.html. Chỉ hiện khi đã đăng nhập
     và có đơn vị quá hạn; đủ hết thì không chiếm chỗ trang chủ.
     ========================================================= */
  function renderKtNopDashboard(){
    var K = window.HSE_KT_NOP;
    if(!document.getElementById("dash-kt-nop") || !K || !window.HSE_UNITS) return;
    if(typeof DB === "undefined" || !DB.isReady() || !currentUser()) return;
    Promise.all([ DB.getAll("kiem_tra_cap12"), HSE_UNITS.ready() ]).then(function(rs){
      var box = document.getElementById("dash-kt-nop");
      if(!box) return;                                   // đã chuyển sang trang khác
      var rows = (rs[0] || []).map(function(r){
        var t = String(r.thang || ""), m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if(m) t = m[3] + "-" + String(m[2]).padStart(2, "0");
        else t = t.slice(0, 7);
        return Object.assign({}, r, { thang: t });
      });
      var norm = function(v){ return HSE_UNITS.norm(HSE_UNITS.label(v || "")); };
      /* Chia theo đơn vị: Admin thấy mọi đơn vị; user chỉ thấy đơn vị được giao
         ở trang Kiểm tra các cấp (ktUnits); chưa được giao → không hiện. */
      var me = currentUser(), admin = isAdmin(me);
      var dvs = HSE_UNITS.list("kiem-tra-cac-cap");
      if(!admin){
        var mine = (me && me.role==="user" && me.active!==false && asArr(me.perms).indexOf("kiem-tra-cac-cap")>=0) ? asArr(me.ktUnits) : [];
        dvs = dvs.filter(function(n){ return mine.some(function(x){ return unitEq(x, n); }); });
      }
      if(!dvs.length){ box.innerHTML = ""; return; }
      var thieu = K.danhSachThieu(rows, dvs, new Date(), null, norm);
      if(!thieu.length){ box.innerHTML = ""; return; }
      var nhom = K.nhomTheoDonVi(thieu);
      box.innerHTML =
        '<div style="background:#fdedec;border:1px solid #f5c6cb;color:#7b1d14;border-radius:10px;padding:12px 16px;margin:0 0 18px;font-size:13px;line-height:1.55">'+
          '<div style="font-weight:700;margin-bottom:4px">Kiểm tra cấp 1, cấp 2: '+(admin ? nhom.length+' đơn vị chưa nộp số liệu' : 'đơn vị của bạn chưa nộp số liệu')+'</div>'+
          nhom.map(function(d){
            return '<div><b>'+esc(d.donVi)+'</b>: '+d.thang.map(function(t){ return esc(K.moTaThang(t)); }).join(", ")+'</div>';
          }).join("")+
          '<div style="margin-top:6px;font-size:12px">'+
          '<a href="kiem-tra-cac-cap.html" style="color:#a12a1c;font-weight:700">Mở trang Kiểm tra các cấp →</a></div>'+
        '</div>';
    }).catch(function(e){ console.warn("[Dashboard] Theo dõi nộp số liệu cấp 1/2:", e && e.message || e); });
  }

  /* =========================================================
     RENDER: QUẢN TRỊ HỆ THỐNG (quản lý user + phân quyền)
     ========================================================= */
  /* =========================================================
     QUẢN TRỊ HỆ THỐNG — 3 tab: Người dùng · Phân công đơn vị · Danh mục đơn vị
     ---------------------------------------------------------
     Thiết kế đã chốt 03/10/2026 (phương án A + C):
       • Người dùng: danh sách gọn + ngăn chi tiết bên phải (công tắc quyền
         từng trang; trang phân theo đơn vị hiện thêm nút chọn đơn vị).
       • Phân công đơn vị: mỗi đơn vị một thẻ, ai phụ trách, còn thiếu tháng nào.
     Hai tab dùng chung dữ liệu profiles (perms, capPhatUnits, ktUnits).
     ========================================================= */

  /* Trang có quyền theo đơn vị → cột lưu danh sách TÊN đơn vị trong profiles.
     Thêm trang mới cần phân theo đơn vị: khai báo ở đây + cột trong profiles
     + RENAME_TARGETS trong assets/don-vi.js. */
  var UNIT_SCOPED = [
    { slug:"kiem-tra-cac-cap", field:"ktUnits",      short:"KT",
      hint:"Được nhập kiểm tra cấp 1, cấp 2 cho đơn vị:" },
    { slug:"cap-phat-bhld",    field:"capPhatUnits", short:"BHLĐ",
      hint:"Được lập phiếu cấp phát BHLĐ cho đơn vị:" }
  ];
  function unitScopeOf(slug){ for(var i=0;i<UNIT_SCOPED.length;i++) if(UNIT_SCOPED[i].slug===slug) return UNIT_SCOPED[i]; return null; }
  function scopeUnitList(sc){ return (typeof HSE_UNITS!=="undefined") ? HSE_UNITS.list(sc.slug,{excludeGop:true}) : []; }
  function unitEq(a,b){
    return (typeof HSE_UNITS!=="undefined")
      ? HSE_UNITS.norm(HSE_UNITS.label(a))===HSE_UNITS.norm(HSE_UNITS.label(b))
      : String(a)===String(b);
  }
  function asArr(v){
    if(Array.isArray(v)) return v.slice();
    if(typeof v==="string" && v){ try{ var a=JSON.parse(v); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
    return [];
  }
  function hasUnit(arr,name){ return asArr(arr).some(function(x){ return unitEq(x,name); }); }
  function userStatus(x){
    if(x.pendingApproval && x.active===false) return ["pending","Chờ duyệt"];
    if(x.active===false) return ["locked","Đã khoá"];
    return ["active","Hoạt động"];
  }
  function cloneUser(u){
    var c=JSON.parse(JSON.stringify(u||{}));
    // Không còn vai trò Viewer trên giao diện: user không được bật trang nào = chỉ xem
    if(c.role!=="admin") c.role="user";
    c.perms=asArr(c.perms); c.capPhatUnits=asArr(c.capPhatUnits); c.ktUnits=asArr(c.ktUnits);
    return c;
  }
  /* Trang có cấp quyền sửa cho user được. Bỏ:
       - tong-quan: trang chủ, không có gì để sửa
       - tra-cuu-atvsld: chỉ Admin sửa (renderTraCuuAtvsld nhận isAdmin) */
  var NO_EDIT_PERM = ["tong-quan","tra-cuu-atvsld"];
  function editablePages(){
    return MENU.filter(function(m){ return !m.adminOnly && !m.adminEditOnly && NO_EDIT_PERM.indexOf(m.slug)<0; });
  }
  function editablePerms(perms){
    var ok=editablePages().map(function(m){ return m.slug; });
    return asArr(perms).filter(function(s){ return ok.indexOf(s)>=0; });
  }
  // Gợi ý quyền khi duyệt tài khoản tự đăng ký (giữ như bản cũ)
  var DEFAULT_APPROVE_PERMS=["tong-quan","bao-chay-tu-dong","cap-phat-bhld","huan-luyen-dao-tao",
    "kiem-tra-cac-cap","quan-ly-thiet-bi","kham-suc-khoe","moi-truong","quan-ly-nha-thau","ke-hoach"];

  function ensureAdminCss(){
    if(document.getElementById("adm2-css")) return;
    var st=document.createElement("style"); st.id="adm2-css";
    st.textContent=[
      ".adm-tab{background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;padding:10px 16px;font-size:13.5px;font-weight:600;color:var(--text-muted);cursor:pointer;font-family:inherit;min-height:44px}",
      ".adm-tab:hover{color:var(--brand)}.adm-tab.on{color:var(--brand);border-bottom-color:var(--brand);font-weight:700}",
      ".adm2-pending{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fff8e1;border:1px solid #f0d58a;border-radius:10px;padding:10px 16px;margin-bottom:14px;font-size:13px;color:#6b4e00}",
      ".adm2-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}",
      ".adm2-bar .inp{height:40px;flex:1 1 240px;max-width:340px}",
      ".adm2-chip{min-height:36px;padding:0 12px;border-radius:18px;border:1px solid var(--border);background:#fff;color:#3d4c63;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}",
      ".adm2-chip.on{background:var(--brand);border-color:var(--brand);color:#fff}.adm2-chip span{opacity:.75;margin-left:3px}",
      ".adm2-row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}",
      ".adm2-list{flex:999 1 520px;min-width:0;background:#fff;border-radius:12px;box-shadow:var(--shadow);overflow-x:auto}",
      ".adm2-list table{width:100%;border-collapse:collapse;font-size:13.5px}",
      ".adm2-list th{background:#f4f7fc;color:#3d4c63;font-size:12px;font-weight:700;text-align:left;padding:11px 12px;text-transform:none;letter-spacing:0;border:none}",
      ".adm2-list td{padding:6px 12px;border-top:1px solid #edf1f7;vertical-align:middle}",
      ".adm2-list tbody tr{cursor:pointer}.adm2-list tbody tr:hover td{background:#f8fafd}",
      ".adm2-list tr.sel td{background:#eef3fc}.adm2-list tr.sel td:first-child{box-shadow:inset 3px 0 0 var(--brand)}",
      ".adm2-un{min-height:44px;background:none;border:none;cursor:pointer;text-align:left;padding:0 4px;font-family:inherit;display:flex;flex-direction:column;justify-content:center;gap:1px}",
      ".adm2-un b{font-size:13.5px;color:var(--text)}.adm2-un small{font-size:12px;color:var(--text-muted)}.adm2-list tr.sel .adm2-un b{color:var(--brand)}",
      ".adm2-pill{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap}",
      ".adm2-pill.s-active{background:#e6f4ea;color:#17663a}.adm2-pill.s-locked{background:#eef1f4;color:#4a5568}.adm2-pill.s-pending{background:#fff3cd;color:#7a5500}",
      ".adm2-sum b{font-weight:600}.adm2-sum div{font-size:12px;color:var(--text-muted);line-height:1.45}.adm2-warn{color:#9a3412!important;font-weight:600}",
      ".adm2-drawer{flex:1 1 380px;min-width:0;max-width:100%;background:#fff;border-radius:12px;box-shadow:var(--shadow);display:flex;flex-direction:column}",
      ".adm2-dh{padding:16px 20px;border-bottom:1px solid #e3e9f3;display:flex;align-items:center;justify-content:space-between;gap:8px}",
      ".adm2-dh h2{margin:0;font-size:17px;color:var(--brand)}",
      ".adm2-db{padding:16px 20px;display:flex;flex-direction:column;gap:16px}",
      ".adm2-df{padding:14px 20px;border-top:1px solid #e3e9f3;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto}",
      ".adm2-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
      ".adm2-field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#3d4c63}",
      ".adm2-field .inp{height:38px;font-weight:400;font-size:13.5px;width:100%;box-sizing:border-box}",
      ".adm2-lbl{font-size:12px;font-weight:700;color:#3d4c63;margin-bottom:6px}",
      ".adm2-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--border);border-radius:8px;overflow:hidden}",
      ".adm2-seg button{min-height:40px;border:none;background:#fff;color:#3d4c63;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}",
      ".adm2-seg button.on{background:var(--brand);color:#fff}",
      ".adm2-gt{font-size:12px;font-weight:700;padding:0 0 2px;display:flex;justify-content:space-between;align-items:center}",
      ".adm2-gt a{font-weight:600;font-size:12px}",
      ".adm2-sw{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 4px;background:none;border:none;cursor:pointer;text-align:left;font-size:13.5px;color:var(--text);font-family:inherit;border-radius:6px}",
      ".adm2-sw:hover{background:#f6f8fc}.adm2-sw>span{font-weight:700}",
      ".adm2-usum{display:flex;align-items:center;justify-content:space-between;gap:8px;width:calc(100% - 8px);margin:-4px 4px 8px;min-height:30px;padding:0 10px;border-radius:6px;cursor:pointer;font-size:12.5px;text-align:left;font-family:inherit;background:#f4f7fc;border:1px solid #dde5f1;color:#3d4c63}",
      ".adm2-usum span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".adm2-usum b{flex:none;font-size:12px;font-weight:400;transition:transform .15s}.adm2-usum[aria-expanded=true] b{transform:rotate(180deg)}",
      ".adm2-usum.none{background:#fff4ec;border-color:#f3c9a6;color:#9a3412;font-weight:600}",
      ".adm2-ubox{margin:0 4px 10px;border:1px solid var(--border);border-radius:8px;background:#fbfcfe;padding:6px 10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 10px}",
      ".adm2-ubox label{display:flex;align-items:center;gap:8px;min-height:34px;font-size:13px;color:var(--text);cursor:pointer}",
      ".adm2-ubox input{width:16px;height:16px;margin:0;accent-color:var(--brand);flex:none}.adm2-ubox small{color:var(--text-muted)}",
      ".adm2-sw i{flex:none;width:40px;height:22px;border-radius:11px;background:#c3cddd;position:relative;transition:background .15s}",
      ".adm2-sw i:after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:8px;background:#fff;transition:left .15s}",
      ".adm2-sw[aria-pressed=true] i{background:var(--brand)}.adm2-sw[aria-pressed=true] i:after{left:21px}",
      ".adm2-note{margin:0;padding:12px;background:#f4f7fc;border-radius:8px;color:#3d4c63;font-size:13px}",
      ".adm2-approve{background:#fff8e1;border:1px solid #f0d58a;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:#6b4e00}",
      ".adm2-dirty{font-size:12.5px;color:#9a6700;font-weight:600}.adm2-saved{font-size:12.5px;color:#17663a;font-weight:600}",
      ".adm2-link{min-height:40px;padding:0 10px;border:none;background:none;color:var(--text-muted);font-weight:600;cursor:pointer;font-family:inherit;font-size:13px}",
      ".adm2-link.danger{color:#b42318}.adm2-link:disabled{opacity:.4;cursor:not-allowed}",
      ".adm2-empty{padding:40px 20px;text-align:center;color:var(--text-muted);font-size:13.5px}",
      ".adm2-modbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}",
      ".adm2-modbar .adm2-seg{grid-template-columns:repeat(2,auto)}.adm2-modbar .adm2-seg button{padding:0 16px}",
      ".adm2-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}",
      ".adm2-card{background:#fff;border-radius:12px;box-shadow:var(--shadow);padding:16px;display:flex;flex-direction:column;gap:12px;min-height:200px;box-sizing:border-box}",
      ".adm2-card.empty{outline:2px dashed #f0b27a;outline-offset:-2px}",
      ".adm2-card h3{margin:0;font-size:15px;color:var(--brand)}",
      ".adm2-st{font-size:12px;font-weight:600;margin-top:3px}.adm2-st.bad{color:#b42318}.adm2-st.ok{color:#17663a}",
      ".adm2-people{display:flex;flex-wrap:wrap;gap:6px}",
      ".adm2-person{display:inline-flex;align-items:center;gap:2px;background:#e8eefb;color:var(--brand);border-radius:18px;padding-left:12px;font-size:13px;font-weight:600}",
      ".adm2-person button{width:32px;height:32px;border:none;background:none;color:var(--brand);cursor:pointer;font-size:16px;border-radius:16px;font-family:inherit}",
      ".adm2-person button:hover{background:#d5e0f6}",
      ".adm2-card select{height:40px;padding:0 10px;border:1px solid var(--border);border-radius:8px;background:#fff;font-size:13px;width:100%;font-family:inherit}",
      ".adm2-box{background:#fff;border-radius:12px;box-shadow:var(--shadow);padding:16px 18px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:#3d4c63;line-height:1.5}",
      ".adm2-box h3{margin:0;font-size:14.5px;color:var(--brand)}",
      "@media (max-width:640px){.adm2-grid2{grid-template-columns:1fr}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function renderAdmin(root){
    root.innerHTML="";
    ensureAdminCss();
    root.appendChild(el("div","",
      '<div class="page-title" style="display:flex;align-items:center;gap:9px">'+lic("settings",22)+'Quản trị hệ thống</div>'+
      '<div class="page-desc">Quản lý tài khoản, quyền sửa từng trang và đơn vị được phụ trách.</div>'));

    var tabBar = el("div");
    tabBar.style.cssText="display:flex;gap:4px;border-bottom:2px solid var(--border);margin:4px 0 16px;flex-wrap:wrap";
    tabBar.innerHTML=
      '<button class="adm-tab on" data-tab="users">Người dùng</button>'+
      '<button class="adm-tab" data-tab="phancong">Phân công đơn vị</button>'+
      '<button class="adm-tab" data-tab="donvi">Danh mục đơn vị</button>';
    root.appendChild(tabBar);

    var panes = { users: el("div"), phancong: el("div"), donvi: el("div") };
    Object.keys(panes).forEach(function(k){
      if(k!=="users") panes[k].style.display="none";
      root.appendChild(panes[k]);
    });

    var usersUI = renderUsersAdmin(panes.users);
    var pcUI = null, donviDrawn = false;
    function show(tab){
      Array.prototype.forEach.call(tabBar.querySelectorAll(".adm-tab"), function(x){ x.classList.toggle("on", x.getAttribute("data-tab")===tab); });
      Object.keys(panes).forEach(function(k){ panes[k].style.display = (k===tab) ? "" : "none"; });
      if(tab==="users") usersUI.refresh();
      if(tab==="phancong"){ if(!pcUI) pcUI = renderPhanCongAdmin(panes.phancong); else pcUI.refresh(); }
      if(tab==="donvi" && !donviDrawn){ donviDrawn = true; renderDonViAdmin(panes.donvi); }
    }
    Array.prototype.forEach.call(tabBar.querySelectorAll(".adm-tab"), function(b){
      b.addEventListener("click", function(){
        var tab=b.getAttribute("data-tab");
        if(tab!=="users" && !usersUI.confirmLeave()) return;
        show(tab);
      });
    });

    // Đồng bộ profiles từ Supabase xong → vẽ lại (giữ thay đổi chưa lưu trong ngăn chi tiết)
    _onUsersSynced = function(){
      if(!document.body.contains(root)) return;
      usersUI.refresh();
      if(pcUI) pcUI.refresh();
    };
    if(typeof HSE_UNITS!=="undefined" && HSE_UNITS.onChange){
      HSE_UNITS.onChange(function(){ if(!document.body.contains(root)) return; usersUI.refresh(); if(pcUI) pcUI.refresh(); });
    }
  }

  /* ---------- Tab NGƯỜI DÙNG: danh sách + ngăn chi tiết ---------- */
  function renderUsersAdmin(pane){
    var st = { filter:"user", q:"", selId:null, draft:null, dirty:false, isNew:false, saved:false };
    var pendEl = el("div"), bar = el("div","adm2-bar"), row = el("div","adm2-row");
    var list = el("section","adm2-list"), drawer = el("aside","adm2-drawer");
    drawer.setAttribute("aria-label","Phân quyền người dùng đang chọn");
    row.appendChild(list); row.appendChild(drawer);
    pane.appendChild(pendEl); pane.appendChild(bar); pane.appendChild(row);

    bar.innerHTML=
      '<input class="inp" type="search" name="hse_user_search" autocomplete="off" placeholder="Tìm theo tài khoản, họ tên, danh số…" aria-label="Tìm người dùng">'+
      '<div class="adm2-chipset" role="group" aria-label="Lọc theo vai trò" style="display:flex;gap:6px;flex-wrap:wrap"></div>'+
      '<div style="flex:1 1 0"></div>'+
      '<button class="btn btn-accent" type="button" data-act="add">＋ Thêm người dùng</button>';
    var qEl = bar.querySelector("input"), chipsEl = bar.querySelector(".adm2-chipset");
    qEl.addEventListener("input", function(){ st.q=this.value; drawList(); });
    bar.querySelector('[data-act="add"]').addEventListener("click", function(){ if(confirmLeave()) openNew(); });

    function confirmLeave(){
      if(!st.dirty) return true;
      if(!confirm("Có thay đổi chưa lưu. Bỏ các thay đổi này?")) return false;
      st.dirty=false; return true;
    }
    function isPending(x){ return x.pendingApproval && x.active===false; }
    function matches(x){
      var q=(st.q||"").trim().toLowerCase();
      if(q && ((x.username||"")+" "+(x.fullname||"")+" "+(x.danhSo||"")).toLowerCase().indexOf(q)<0) return false;
      // Chỉ 2 nhóm: Admin và User (User gồm cả tài khoản chờ duyệt / đã khoá)
      return st.filter==="admin" ? x.role==="admin" : x.role!=="admin";
    }
    function summary(x){
      if(isPending(x)) return '<b>Chưa phân quyền</b>';
      if(x.role==="admin") return '<b style="color:var(--brand)">Toàn quyền</b>';
      var perms=editablePerms(x.perms);
      if(x.role==="viewer" || !perms.length) return '<b>Chỉ xem</b>';
      var parts=[];
      UNIT_SCOPED.forEach(function(sc){
        if(perms.indexOf(sc.slug)<0) return;
        var a=asArr(x[sc.field]);
        parts.push(a.length ? esc(sc.short+": "+a.join(", "))
                            : '<span class="adm2-warn">'+esc(sc.short)+': chưa giao đơn vị</span>');
      });
      return '<b>'+perms.length+' trang</b>'+(parts.length?'<div>'+parts.join(" · ")+'</div>':'');
    }

    function drawPending(){
      var p=getUsers().filter(isPending);
      if(!p.length){ pendEl.innerHTML=""; return; }
      pendEl.innerHTML='<div class="adm2-pending"><span><b>'+p.length+' tài khoản</b> đăng ký mới đang chờ duyệt: '+
        esc(p.map(function(x){return x.username;}).join(", "))+'</span>'+
        '<button type="button" class="btn btn-ghost btn-sm" style="min-height:36px">Xem để duyệt</button></div>';
      pendEl.querySelector("button").addEventListener("click", function(){
        if(!confirmLeave()) return;
        st.filter="user"; drawChips(); select(p[0].id, true);
      });
    }
    function drawChips(){
      var all=getUsers();
      var n={ user:all.filter(function(x){return x.role!=="admin";}).length,
        admin:all.filter(function(x){return x.role==="admin";}).length };
      chipsEl.innerHTML=[["user","User"],["admin","Admin"]].map(function(f){
        var on=st.filter===f[0];
        return '<button type="button" class="adm2-chip'+(on?' on':'')+'" aria-pressed="'+on+'" data-f="'+f[0]+'">'+f[1]+'<span>'+n[f[0]]+'</span></button>';
      }).join("");
      Array.prototype.forEach.call(chipsEl.querySelectorAll("button"), function(b){
        b.addEventListener("click", function(){ st.filter=b.getAttribute("data-f"); drawChips(); drawList(); });
      });
    }
    function drawList(){
      var rows=getUsers().filter(matches);
      var html='<table><thead><tr><th>Tài khoản</th><th>Quyền sửa</th></tr></thead><tbody>';
      rows.forEach(function(x){
        var s=userStatus(x), on=String(x.id)===String(st.selId);
        html+='<tr data-id="'+esc(x.id)+'"'+(on?' class="sel"':'')+'>'+
          '<td><button type="button" class="adm2-un" aria-label="Mở phân quyền của '+esc(x.username)+'"><b>'+esc(x.username)+
            (s[0]!=="active"?' <span class="adm2-pill s-'+s[0]+'">'+s[1]+'</span>':'')+'</b>'+
            '<small>'+esc(x.fullname||"")+(x.danhSo?' · '+esc(x.danhSo):'')+'</small></button></td>'+
          '<td class="adm2-sum">'+summary(x)+'</td></tr>';
      });
      html+='</tbody></table>';
      if(!rows.length) html+='<div class="adm2-empty">Không có người dùng phù hợp.</div>';
      list.innerHTML=html;
      Array.prototype.forEach.call(list.querySelectorAll("tbody tr"), function(tr){
        tr.addEventListener("click", function(){ select(tr.getAttribute("data-id")); });
      });
    }

    function select(id, force){
      if(!force && String(id)===String(st.selId) && !st.isNew) return;
      if(!force && !confirmLeave()) return;
      var u=findUserById(id);
      st.isNew=false; st.selId=id; st.draft=u?cloneUser(u):null; st.dirty=false; st.saved=false; st.uOpen={};
      drawList(); drawDrawer();
    }
    function openNew(){
      st.isNew=true; st.selId=null; st.dirty=false; st.saved=false; st.uOpen={};
      st.draft={ username:"", fullname:"", danhSo:"", role:"user", perms:[], capPhatUnits:[], ktUnits:[], active:true, _pw:"", _pw2:"" };
      drawList(); drawDrawer();
      var f=drawer.querySelector('[data-k="username"]'); if(f) f.focus();
    }
    function markDirty(){
      st.dirty=true; st.saved=false;
      var d=drawer.querySelector(".adm2-state"); if(d){ d.className="adm2-state adm2-dirty"; d.textContent="Có thay đổi chưa lưu"; }
      var c=drawer.querySelector('[data-act="cancel"]'); if(c) c.style.display="";
    }

    function drawDrawer(){
      var d=st.draft;
      if(!d){ drawer.innerHTML='<div class="adm2-empty">Chọn một người trong danh sách để xem và sửa quyền.</div>'; return; }
      var me=currentUser(), isMe=!st.isNew && me && String(me.id)===String(d.id);
      var s=userStatus(d), pend=!st.isNew && isPending(d);
      var h='<div class="adm2-dh"><h2>'+(st.isNew?'Tài khoản mới':esc(d.username))+'</h2>'+
        (st.isNew||s[0]==="active"?'':'<span class="adm2-pill s-'+s[0]+'">'+s[1]+'</span>')+'</div><div class="adm2-db">';
      if(pend){
        h+='<div class="adm2-approve"><span>Tài khoản tự đăng ký, chưa được duyệt nên chưa đăng nhập được.</span>'+
          (d._approve ? '<b>✓ Sẽ duyệt khi bấm Lưu thay đổi.</b>'
                      : '<button type="button" class="btn btn-sm" data-act="approve" style="align-self:flex-start;background:var(--brand);color:#fff;min-height:36px">Duyệt thành User</button>')+'</div>';
      }
      if(st.isNew) h+='<label class="adm2-field">Email / tài khoản<input class="inp" data-k="username" value="'+esc(d.username||"")+'" placeholder="VD: sonlhh.sd" autocomplete="off"></label>';
      h+='<div class="adm2-grid2">'+
          '<label class="adm2-field">Họ và tên<input class="inp" data-k="fullname" value="'+esc(d.fullname||"")+'"></label>'+
          '<label class="adm2-field">Danh số<input class="inp" data-k="danhSo" value="'+esc(d.danhSo||"")+'" placeholder="VD: 21398"></label>'+
        '</div>';
      if(st.isNew){
        h+='<div class="adm2-grid2">'+
          '<label class="adm2-field">Mật khẩu<input class="inp" type="password" data-k="_pw" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự"></label>'+
          '<label class="adm2-field">Nhập lại mật khẩu<input class="inp" type="password" data-k="_pw2" autocomplete="new-password"></label></div>';
      }
      h+='<div><div class="adm2-lbl">Vai trò</div><div class="adm2-seg" role="group" aria-label="Vai trò" style="grid-template-columns:repeat(2,minmax(0,1fr))">'+
        [["user","User"],["admin","Admin"]].map(function(r){
          var on=d.role===r[0];
          return '<button type="button" class="'+(on?'on':'')+'" aria-pressed="'+on+'" data-role="'+r[0]+'">'+r[1]+'</button>';
        }).join("")+'</div></div>';
      if(d.role==="admin") h+='<p class="adm2-note">Admin có toàn quyền trên mọi trang và mọi đơn vị.</p>';
      else {
        [["theo-doi","THEO DÕI & BÁO CÁO","var(--brand)"],["ung-dung","ỨNG DỤNG NGHIỆP VỤ","#a5141f"]].forEach(function(g){
          var pages=editablePages().filter(function(m){ return m.group===g[0]; });
          h+='<div><div class="adm2-gt" style="color:'+g[2]+'"><span>'+g[1]+'</span></div>';
          pages.forEach(function(m){
            var on=d.perms.indexOf(m.slug)>=0, sc=unitScopeOf(m.slug);
            h+='<button type="button" class="adm2-sw" aria-pressed="'+on+'" data-perm="'+esc(m.slug)+'"><span>'+esc(m.title)+'</span><i aria-hidden="true"></i></button>';
            if(on && sc){
              /* Dòng tóm tắt đơn vị (bấm để mở/đóng) + khung ô tích, mặc định thu gọn */
              var units=scopeUnitList(sc), cur=asArr(d[sc.field]);
              var extra=cur.filter(function(v){ return !units.some(function(n){ return unitEq(v,n); }); });
              var open=!!(st.uOpen && st.uOpen[m.slug]);
              h+='<button type="button" class="adm2-usum'+(cur.length?'':' none')+'" data-uopen="'+esc(m.slug)+'" aria-expanded="'+open+'" title="'+esc(sc.hint)+'">'+
                '<span>'+(cur.length ? 'Đơn vị: '+esc(cur.join(", ")) : 'Chưa chọn đơn vị — bấm để chọn')+'</span>'+
                '<b aria-hidden="true">▾</b></button>';
              if(open){
                h+='<div class="adm2-ubox" role="group" aria-label="'+esc(sc.hint)+'">'+
                  units.concat(extra).map(function(n){
                    var has=hasUnit(cur,n), old=extra.indexOf(n)>=0;
                    return '<label><input type="checkbox" data-scope="'+sc.field+'" data-unit="'+esc(n)+'"'+(has?' checked':'')+'>'+
                      esc(n)+(old?' <small>(không còn trong danh mục)</small>':'')+'</label>';
                  }).join("")+'</div>';
              }
            }
          });
          h+='</div>';
        });
      }
      h+='</div><div class="adm2-df">'+
        '<button type="button" class="btn btn-accent" data-act="save">'+(st.isNew?'Tạo tài khoản':'Lưu thay đổi')+'</button>'+
        '<button type="button" class="btn btn-ghost" data-act="cancel"'+(st.isNew||st.dirty?'':' style="display:none"')+'>Huỷ</button>'+
        '<span class="adm2-state '+(st.dirty?'adm2-dirty':(st.saved?'adm2-saved':''))+'">'+(st.dirty?'Có thay đổi chưa lưu':(st.saved?'✓ Đã lưu':''))+'</span>'+
        '<div style="flex:1 1 0"></div>'+
        (st.isNew?'':
          (pend?'':'<button type="button" class="adm2-link" data-act="lock"'+(isMe?' disabled title="Không thể khoá tài khoản đang đăng nhập"':'')+'>'+(d.active===false?'Mở khoá':'Khoá tài khoản')+'</button>')+
          '<button type="button" class="adm2-link danger" data-act="del"'+(isMe?' disabled title="Không thể xoá tài khoản đang đăng nhập"':'')+'>Xoá</button>')+
        '</div>';
      drawer.innerHTML=h;
      bindDrawer();
    }

    function bindDrawer(){
      var d=st.draft;
      Array.prototype.forEach.call(drawer.querySelectorAll("input[data-k]"), function(inp){
        inp.addEventListener("input", function(){ d[inp.getAttribute("data-k")]=inp.value; markDirty(); });
      });
      Array.prototype.forEach.call(drawer.querySelectorAll("[data-role]"), function(b){
        b.addEventListener("click", function(){
          var r=b.getAttribute("data-role");
          var me=currentUser();
          if(!st.isNew && me && String(me.id)===String(d.id) && r!=="admin"){ alert("Không thể tự bỏ quyền Admin của chính mình."); return; }
          if(d.role===r) return;
          d.role=r; markDirty(); drawDrawer();
        });
      });
      Array.prototype.forEach.call(drawer.querySelectorAll("[data-perm]"), function(b){
        b.addEventListener("click", function(){
          var slug=b.getAttribute("data-perm"), i=d.perms.indexOf(slug);
          var sc=unitScopeOf(slug);
          if(i>=0){ d.perms.splice(i,1); if(sc) d[sc.field]=[]; }
          else { d.perms.push(slug); if(sc){ st.uOpen=st.uOpen||{}; st.uOpen[slug]=true; } }  // vừa bật → mở sẵn khung chọn đơn vị
          markDirty(); drawDrawer();
        });
      });
      Array.prototype.forEach.call(drawer.querySelectorAll("[data-uopen]"), function(b){
        b.addEventListener("click", function(){
          var k=b.getAttribute("data-uopen"); st.uOpen=st.uOpen||{}; st.uOpen[k]=!st.uOpen[k]; drawDrawer();
        });
      });
      Array.prototype.forEach.call(drawer.querySelectorAll("input[data-unit]"), function(b){
        b.addEventListener("change", function(){
          var f=b.getAttribute("data-scope"), n=b.getAttribute("data-unit");
          var a=asArr(d[f]);
          if(hasUnit(a,n)) a=a.filter(function(v){ return !unitEq(v,n); }); else a.push(n);
          // Giữ đúng thứ tự của danh mục đơn vị (đơn vị không còn trong danh mục để cuối)
          var sc=UNIT_SCOPED.filter(function(x){ return x.field===f; })[0];
          if(sc){
            var order=scopeUnitList(sc);
            var idx=function(v){ for(var i=0;i<order.length;i++) if(unitEq(order[i],v)) return i; return order.length; };
            a.sort(function(x,y){ return idx(x)-idx(y); });
          }
          d[f]=a; markDirty(); drawDrawer();
        });
      });
      var ap=drawer.querySelector('[data-act="approve"]');
      if(ap) ap.addEventListener("click", function(){
        d._approve=true; d.role="user";
        if(!d.perms.length) d.perms=editablePerms(DEFAULT_APPROVE_PERMS);
        markDirty(); drawDrawer();
      });
      drawer.querySelector('[data-act="save"]').addEventListener("click", save);
      drawer.querySelector('[data-act="cancel"]').addEventListener("click", function(){
        if(st.isNew){ st.isNew=false; st.draft=null; st.dirty=false; drawList(); drawDrawer(); return; }
        st.dirty=false; select(st.selId, true);
      });
      var lk=drawer.querySelector('[data-act="lock"]'); if(lk) lk.addEventListener("click", lockUser);
      var dl=drawer.querySelector('[data-act="del"]'); if(dl) dl.addEventListener("click", delUser);
    }

    function normalizeDraft(d){
      if(d.role==="admin"){
        d.perms=allSlugs();
        UNIT_SCOPED.forEach(function(sc){ d[sc.field]=scopeUnitList(sc); });
      } else {
        UNIT_SCOPED.forEach(function(sc){ if(d.perms.indexOf(sc.slug)<0) d[sc.field]=[]; });
      }
    }
    function save(){
      var d=st.draft;
      d.username=(d.username||"").trim(); d.fullname=(d.fullname||"").trim(); d.danhSo=(d.danhSo||"").trim();
      if(st.isNew && !d.username){ alert("Vui lòng nhập email / tài khoản."); return; }
      if(!d.fullname){ alert("Vui lòng nhập họ tên."); return; }
      if(st.isNew){
        if(findUser(d.username)){ alert("Email này đã được sử dụng."); return; }
        if(!d._pw || d._pw.length<6){ alert("Mật khẩu tối thiểu 6 ký tự."); return; }
        if(d._pw!==d._pw2){ alert("Mật khẩu xác nhận không khớp."); return; }
      }
      normalizeDraft(d);
      var u=getUsers(), target=null;
      if(st.isNew){
        target={ id:Date.now().toString(36), username:d.username, password:d._pw, fullname:d.fullname,
          danhSo:d.danhSo, role:d.role, perms:d.perms, capPhatUnits:d.capPhatUnits, ktUnits:d.ktUnits,
          active:true, created:new Date().toISOString() };
        u.push(target); setUsers(u); _syncUserSheet('insert', target);
        st.isNew=false; st.selId=target.id;
      } else {
        for(var i=0;i<u.length;i++){
          if(String(u[i].id)!==String(d.id)) continue;
          u[i].fullname=d.fullname; u[i].danhSo=d.danhSo; u[i].role=d.role; u[i].perms=d.perms;
          u[i].capPhatUnits=d.capPhatUnits; u[i].ktUnits=d.ktUnits;
          u[i].updated=new Date().toISOString();
          if(d._approve){ u[i].active=true; u[i].pendingApproval=false; }
          target=u[i];
        }
        if(!target){ alert("Không tìm thấy tài khoản này nữa — có thể đã bị xoá."); return; }
        setUsers(u); _syncUserSheet('update', target);
      }
      st.draft=cloneUser(findUserById(st.selId)||target); st.dirty=false; st.saved=true;
      drawPending(); drawChips(); drawList(); drawDrawer();
    }
    function lockUser(){
      var d=st.draft, me=currentUser();
      if(me && String(me.id)===String(d.id)){ alert("Không thể khoá tài khoản đang đăng nhập."); return; }
      if(!confirmLeave()) return;
      var u=getUsers(), t=null;
      u.forEach(function(x){ if(String(x.id)===String(d.id)){ x.active = x.active===false; t=x; } });
      if(!t) return;
      setUsers(u); _syncUserSheet('update', t);
      select(d.id, true); drawChips();
    }
    function delUser(){
      var d=st.draft, me=currentUser();
      if(me && String(me.id)===String(d.id)){ alert("Không thể xoá tài khoản đang đăng nhập."); return; }
      if(!confirm("Xoá hẳn tài khoản \""+(d.username||d.fullname||"")+"\"? Không khôi phục được.")) return;
      setUsers(getUsers().filter(function(x){ return String(x.id)!==String(d.id); }));
      _syncUserSheet('delete', d.id);
      st.selId=null; st.draft=null; st.dirty=false;
      drawPending(); drawChips(); drawList(); drawDrawer();
    }

    function refresh(){
      drawPending(); drawChips(); drawList();
      if(st.isNew || st.dirty) return;                 // không đè lên thay đổi đang soạn
      if(st.selId){ var u=findUserById(st.selId); st.draft=u?cloneUser(u):null; if(!u) st.selId=null; }
      if(!st.selId){
        var all=getUsers(), first=all.filter(isPending)[0] || all.filter(function(x){ return x.role==="user"; })[0] || all[0];
        if(first){ st.selId=first.id; st.draft=cloneUser(first); drawList(); }
      }
      drawDrawer();
    }
    refresh();
    return { refresh: refresh, confirmLeave: confirmLeave };
  }

  /* ---------- Tab PHÂN CÔNG ĐƠN VỊ: mỗi đơn vị một thẻ ---------- */
  function renderPhanCongAdmin(pane){
    var st = { slug: UNIT_SCOPED[0].slug, ktRows: null };
    function normRows(rows){
      return (rows||[]).map(function(r){
        var t=String(r.thang||""), m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        t = m ? (m[3]+"-"+String(m[2]).padStart(2,"0")) : t.slice(0,7);
        return Object.assign({}, r, { thang:t });
      });
    }
    if(typeof DB!=="undefined" && DB.isReady()){
      DB.getAll("kiem_tra_cap12").then(function(rows){ st.ktRows=normRows(rows); draw(); })
        .catch(function(e){ console.warn("[Phân công] Không tải được số liệu kiểm tra:", e && e.message || e); });
    }
    function ktStatus(name){
      var K=window.HSE_KT_NOP;
      if(!K || !st.ktRows) return null;
      var norm=function(v){ return (typeof HSE_UNITS!=="undefined") ? HSE_UNITS.norm(HSE_UNITS.label(v||"")) : String(v||"").toLowerCase(); };
      var g=K.nhomTheoDonVi(K.danhSachThieu(st.ktRows, [name], new Date(), null, norm))[0];
      if(g) return { bad:true, text:"Chưa nộp: "+g.thang.map(function(t){ return K.moTaThang(t); }).join(", ") };
      var last=K.ymCong(K.ymCua(new Date()), -1);
      return last<K.CAU_HINH.tuThang ? null : { bad:false, text:"✓ Đã nộp đủ đến "+K.nhanThang(last) };
    }
    function patchUser(id, fn){
      var u=getUsers(), t=null;
      u.forEach(function(x){ if(String(x.id)===String(id)){ fn(x); x.updated=new Date().toISOString(); t=x; } });
      if(!t) return;
      setUsers(u); _syncUserSheet('update', t); draw();
    }
    function draw(){
      var sc=unitScopeOf(st.slug), title=(menuBySlug(st.slug)||{}).title||st.slug;
      var people=getUsers().filter(function(x){ return x.role==="user" && x.active!==false; });
      var units=scopeUnitList(sc);
      var h='<div class="adm2-modbar"><span style="font-size:13px;font-weight:700;color:#3d4c63">Phân công cho trang:</span>'+
        '<div class="adm2-seg" role="group" aria-label="Chọn trang">'+UNIT_SCOPED.map(function(s){
          var on=s.slug===st.slug, t=(menuBySlug(s.slug)||{}).title||s.slug;
          return '<button type="button" class="'+(on?'on':'')+'" aria-pressed="'+on+'" data-mod="'+s.slug+'">'+esc(t)+'</button>';
        }).join("")+'</div></div>'+
        '<p style="margin:-4px 0 14px;font-size:12.5px;color:var(--text-muted)">'+esc(sc.hint.replace(/:$/,""))+
        '. Một người có thể phụ trách nhiều đơn vị; thêm người vào đơn vị sẽ tự cấp quyền sửa trang '+esc(title)+'. Thay đổi được lưu ngay.</p>';
      h+='<section class="adm2-cards" aria-label="Các đơn vị">';
      if(!units.length) h+='<div class="adm2-box">Chưa có đơn vị nào được gán cho trang '+esc(title)+' (tab Danh mục đơn vị).</div>';
      units.forEach(function(name, ui){
        var mine=people.filter(function(x){ return asArr(x.perms).indexOf(sc.slug)>=0 && hasUnit(x[sc.field], name); });
        var others=people.filter(function(x){ return mine.indexOf(x)<0; });
        var stt=sc.slug==="kiem-tra-cac-cap" ? ktStatus(name) : null;
        h+='<article class="adm2-card'+(mine.length?'':' empty')+'"><div><h3>'+esc(name)+'</h3>'+
          (stt?'<div class="adm2-st '+(stt.bad?'bad':'ok')+'">'+esc(stt.text)+'</div>':'')+'</div>'+
          '<div><div class="adm2-lbl">NGƯỜI PHỤ TRÁCH</div><div class="adm2-people">'+
          mine.map(function(x){
            return '<span class="adm2-person">'+esc(x.username)+'<button type="button" data-rm="'+esc(x.id)+'" data-u="'+ui+'" aria-label="Bỏ '+esc(x.username)+' khỏi '+esc(name)+'">×</button></span>';
          }).join("")+'</div>'+
          (mine.length?'':'<div class="adm2-warn" style="font-size:12.5px;margin-top:4px">Chưa có ai phụ trách — không ai nhập được số liệu của đơn vị này.</div>')+'</div>'+
          '<label class="adm2-field" style="margin-top:auto">Thêm người phụ trách'+
          '<select data-add="'+ui+'"><option value="">— Chọn tài khoản —</option>'+
          others.map(function(x){
            var hasPerm=asArr(x.perms).indexOf(sc.slug)>=0, n=asArr(x[sc.field]).length;
            return '<option value="'+esc(x.id)+'">'+esc(x.username)+(x.fullname?' — '+esc(x.fullname):'')+
              (hasPerm ? (n?' · đang phụ trách '+n+' ĐV':'') : ' (sẽ được cấp quyền trang)')+'</option>';
          }).join("")+'</select></label></article>';
      });
      h+='</section>';
      pane.innerHTML=h;

      Array.prototype.forEach.call(pane.querySelectorAll("[data-mod]"), function(b){
        b.addEventListener("click", function(){ st.slug=b.getAttribute("data-mod"); draw(); });
      });
      Array.prototype.forEach.call(pane.querySelectorAll("[data-rm]"), function(b){
        b.addEventListener("click", function(){
          var name=units[+b.getAttribute("data-u")];
          patchUser(b.getAttribute("data-rm"), function(x){ x[sc.field]=asArr(x[sc.field]).filter(function(v){ return !unitEq(v,name); }); });
        });
      });
      Array.prototype.forEach.call(pane.querySelectorAll("select[data-add]"), function(s){
        s.addEventListener("change", function(){
          var id=s.value; if(!id) return;
          var name=units[+s.getAttribute("data-add")];
          patchUser(id, function(x){
            x.perms=asArr(x.perms); if(x.perms.indexOf(sc.slug)<0) x.perms.push(sc.slug);
            var a=asArr(x[sc.field]); if(!hasUnit(a,name)) a.push(name); x[sc.field]=a;
          });
        });
      });
    }
    draw();
    return { refresh: draw };
  }


  /* =========================================================
     QUẢN TRỊ — DANH MỤC PHÒNG / BAN / ĐƠN VỊ
     ---------------------------------------------------------
     Thay cho việc viết cứng danh sách đơn vị trong code từng trang.
     Admin ở đây có thể:
       · Thêm / sửa / ngừng / xoá đơn vị và sắp thứ tự hiển thị
       · Chọn TRANG NÀO được dùng đơn vị nào trong droplist
       · Bật/tắt mục "Khác" (nhập tên tự do) cho từng trang
     Dữ liệu nằm ở bảng "DonVi" (supabase/don_vi.sql), truy cập qua
     assets/don-vi.js (HSE_UNITS).
     ========================================================= */
  function renderDonViAdmin(pane){
    if(typeof HSE_UNITS === "undefined"){
      pane.innerHTML='<div class="table-wrap" style="padding:24px;text-align:center" class="muted">'+
        'Chưa nạp <b>assets/don-vi.js</b> — không thể quản lý danh mục đơn vị.</div>';
      return;
    }
    var PG = HSE_UNITS.pages();
    var showInactive = false;
    // Ô tick trong modal nằm trong .field — cần ghi đè padding của ".field input"
    var CB = 'style="width:16px;height:16px;padding:0;flex-shrink:0;accent-color:var(--brand)"';
    /* Bộ icon cho thẻ đơn vị ở trang Cấp phát BHLĐ (khớp _unitIcon bên đó) */
    var DV_ICONS = [
      { v:"",          t:"(mặc định — toà nhà)" },
      { v:"anchor",    t:"Mỏ neo — cảng" },
      { v:"package",   t:"Thùng hàng — kho" },
      { v:"wrench",    t:"Cờ lê — xưởng" },
      { v:"truck",     t:"Xe tải" },
      { v:"car",       t:"Ô tô con" },
      { v:"landmark",  t:"Trụ sở" },
      { v:"flask",     t:"Ống nghiệm — thử nghiệm" },
      { v:"hard-hat",  t:"Mũ bảo hộ" },
      { v:"users",     t:"Nhóm người" }
    ];

    pane.innerHTML =
      '<div class="toolbar">'+
        '<div class="muted" style="max-width:680px;line-height:1.65">Danh mục dùng chung cho mọi droplist đơn vị trong hệ thống. '+
          'Tích ô ở cột của một trang để cho phép trang đó dùng đơn vị. '+
          '<b>Mã</b> của mỗi đơn vị là cố định — đổi tên bao nhiêu lần cũng không làm mất dữ liệu cũ.</div>'+
        '<div class="spacer"></div>'+
        '<label class="muted" style="display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap">'+
          '<input type="checkbox" id="dv-inactive" style="width:15px;height:15px"> Hiện cả đơn vị đã ngừng</label>'+
      '</div>'+
      '<div class="table-wrap"><table id="dv-tbl"></table></div>'+
      '<div style="display:flex;justify-content:center;margin:16px 0 4px">'+
        '<button class="btn btn-accent" id="dv-add">＋ Thêm đơn vị</button></div>'+
      '<div id="dv-other"></div>';

    var tbl      = pane.querySelector("#dv-tbl");
    var otherBox = pane.querySelector("#dv-other");
    pane.querySelector("#dv-inactive").addEventListener("change", function(){ showInactive=this.checked; draw(); });
    pane.querySelector("#dv-add").addEventListener("click", function(){ openUnitModal(null); });

    /* ── Bảng danh mục ── */
    function draw(){
      var rows = HSE_UNITS.all({ includeInactive: showInactive });
      var html = '<thead><tr>'+
        '<th style="width:32px">#</th>'+
        '<th style="min-width:230px">Tên đơn vị</th>'+
        '<th>Nhóm</th>'+
        PG.map(function(p){
          return '<th style="text-align:center;font-size:11.5px;line-height:1.35;min-width:92px">'+esc(p.title)+
            (p.applied?'':'<br><span style="font-weight:500;color:var(--text-muted)">(chưa áp dụng)</span>')+'</th>';
        }).join('')+
        '<th>Trạng thái</th><th style="white-space:nowrap">Thao tác</th></tr></thead><tbody>';

      rows.forEach(function(u,i){
        html += '<tr'+(u.active?'':' style="opacity:.55"')+'>'+
          '<td class="muted">'+(i+1)+'</td>'+
          '<td><b>'+esc(u.ten)+'</b>'+
            (u.he_thong?' <span class="badge" style="background:#eef1f4;color:var(--text-muted)">hệ thống</span>':'')+
            (u.muc_gop?' <span class="badge" style="background:#f3e8ff;color:#6b21a8">mục gộp</span>':'')+
            '<div class="muted" style="font-size:11px;margin-top:2px">mã: <code>'+esc(u.ma)+'</code>'+
              (u.ten_cu.length?' · tên cũ: '+esc(u.ten_cu.join(", ")):'')+'</div></td>'+
          '<td class="muted">'+esc(HSE_UNITS.nhomLabel(u.nhom))+'</td>'+
          PG.map(function(p){
            var on = u.pages.indexOf(p.slug)>=0;
            return '<td style="text-align:center"><input type="checkbox" class="dv-pg" data-ma="'+esc(u.ma)+'" '+
              'data-slug="'+esc(p.slug)+'"'+(on?' checked':'')+' style="width:16px;height:16px;accent-color:var(--brand);cursor:pointer"></td>';
          }).join('')+
          '<td>'+(u.active
            ? '<span class="badge badge-user">Hoạt động</span>'
            : '<span class="badge badge-viewer">Đã ngừng</span>')+'</td>'+
          '<td style="white-space:nowrap">'+
            '<button class="btn btn-ghost btn-sm" data-act="up"   data-ma="'+esc(u.ma)+'" title="Lên trên"'+(i===0?' disabled':'')+'>▲</button> '+
            '<button class="btn btn-ghost btn-sm" data-act="down" data-ma="'+esc(u.ma)+'" title="Xuống dưới"'+(i===rows.length-1?' disabled':'')+'>▼</button> '+
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-ma="'+esc(u.ma)+'">Sửa</button> '+
            /* Đơn vị hệ thống (Test, Bộ máy điều hành) bị so sánh theo TÊN ở
               nhiều chỗ trong trang Cấp phát BHLĐ → không cho ngừng/xoá. */
            (u.he_thong
              ? '<span class="muted" title="Đơn vị hệ thống — trang Cấp phát BHLĐ nhận diện theo tên, không được ngừng hoặc xoá">khoá</span>'
              : '<button class="btn btn-ghost btn-sm" data-act="toggle" data-ma="'+esc(u.ma)+'">'+(u.active?'Ngừng':'Bật lại')+'</button> '+
                '<button class="btn btn-danger btn-sm" data-act="del" data-ma="'+esc(u.ma)+'">Xoá</button>')+
          '</td></tr>';
      });
      if(!rows.length) html += '<tr><td colspan="'+(5+PG.length)+'" class="muted" style="text-align:center;padding:24px">Danh mục trống.</td></tr>';
      tbl.innerHTML = html + '</tbody>';

      Array.prototype.forEach.call(tbl.querySelectorAll(".dv-pg"), function(c){
        c.addEventListener("change", function(){ togglePage(c.getAttribute("data-ma"), c.getAttribute("data-slug"), c.checked); });
      });
      Array.prototype.forEach.call(tbl.querySelectorAll("button[data-act]"), function(b){
        b.addEventListener("click", function(){
          var ma=b.getAttribute("data-ma"), act=b.getAttribute("data-act");
          if(act==="edit")        openUnitModal(HSE_UNITS.byMa(ma));
          else if(act==="toggle") toggleActive(ma);
          else if(act==="del")    removeUnit(ma);
          else                    move(ma, act==="up"?-1:1, rows);
        });
      });
    }

    /* ── Bật/tắt đơn vị cho một trang ── */
    function togglePage(ma, slug, on){
      var u = HSE_UNITS.byMa(ma); if(!u) return;
      var pages = u.pages.filter(function(s){ return s!==slug; });
      if(on) pages.push(slug);
      var next = JSON.parse(JSON.stringify(u)); next.pages = pages;
      HSE_UNITS.saveUnit(next).then(function(){
        showToast(on ? 'Đã cho phép trang "'+pageTitle(slug)+'" dùng "'+u.ten+'".'
                     : 'Đã bỏ "'+u.ten+'" khỏi trang "'+pageTitle(slug)+'".', "success");
      }).catch(function(e){ showToast("Không lưu được: "+(e&&e.message||e), "error"); draw(); });
    }
    function pageTitle(slug){
      for(var i=0;i<PG.length;i++) if(PG[i].slug===slug) return PG[i].title;
      return slug;
    }

    /* ── Ngừng / bật lại ── */
    function toggleActive(ma){
      var u = HSE_UNITS.byMa(ma); if(!u) return;
      var next = JSON.parse(JSON.stringify(u)); next.active = !u.active;
      if(!next.active && !confirm('Ngừng hoạt động "'+u.ten+'"?\n\nĐơn vị sẽ biến mất khỏi mọi droplist, nhưng các bản ghi cũ vẫn đọc và hiển thị bình thường.')) return;
      HSE_UNITS.saveUnit(next).then(function(){ draw(); showToast("Đã cập nhật trạng thái.", "success"); })
        .catch(function(e){ showToast("Không lưu được: "+(e&&e.message||e), "error"); });
    }

    /* ── Đổi thứ tự hiển thị ── */
    function move(ma, dir, rows){
      var i = -1; rows.forEach(function(u,k){ if(u.ma===ma) i=k; });
      var j = i + dir;
      if(i<0 || j<0 || j>=rows.length) return;
      var a = JSON.parse(JSON.stringify(rows[i]));
      var b = JSON.parse(JSON.stringify(rows[j]));
      var t = a.sort; a.sort = b.sort; b.sort = t;
      if(a.sort === b.sort){ a.sort = (dir<0) ? b.sort-1 : b.sort+1; }
      HSE_UNITS.saveUnit(a).then(function(){ return HSE_UNITS.saveUnit(b); })
        .then(function(){ draw(); })
        .catch(function(e){ showToast("Không lưu được thứ tự: "+(e&&e.message||e), "error"); draw(); });
    }

    /* ── Xoá hẳn (chỉ khi không còn bản ghi nào dùng) ── */
    function removeUnit(ma){
      var u = HSE_UNITS.byMa(ma); if(!u) return;
      showToast('Đang kiểm tra dữ liệu đang dùng "'+u.ten+'"...', "info");
      HSE_UNITS.renameScan(u.ten).then(function(scan){
        if(scan.total>0){
          alert('Không thể xoá "'+u.ten+'".\n\nCòn '+scan.total+' bản ghi đang dùng đơn vị này:\n'+
            scan.hits.map(function(h){ return '· '+h.target.label+': '+h.rows.length; }).join("\n")+
            '\n\nHãy dùng "Ngừng" để ẩn khỏi droplist mà vẫn giữ được báo cáo cũ.');
          return;
        }
        if(!confirm('Xoá hẳn "'+u.ten+'" khỏi danh mục?\n\nKhông có bản ghi nào đang dùng đơn vị này.')) return;
        HSE_UNITS.removeUnit(ma).then(function(){ draw(); showToast("Đã xoá đơn vị.", "success"); })
          .catch(function(e){ showToast("Không xoá được: "+(e&&e.message||e), "error"); });
      }).catch(function(e){ showToast("Không kiểm tra được: "+(e&&e.message||e), "error"); });
    }

    /* ── Modal thêm / sửa ── */
    function openUnitModal(u){
      var isNew = !u;
      var bg = el("div","modal-bg");
      bg.innerHTML =
        '<div class="modal"><div class="modal-h"><h3>'+(isNew?"Thêm đơn vị":"Sửa đơn vị")+'</h3><button class="x" id="dvx">×</button></div>'+
        '<div class="modal-b">'+
          '<div class="field"><label>Tên đơn vị *</label>'+
            '<input class="inp" id="dv_ten" style="width:100%" placeholder="VD: Phòng Kỹ thuật - Vật tư" value="'+esc(isNew?"":u.ten)+'"></div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
            '<div class="field"><label>Nhóm</label><select class="inp" id="dv_nhom" style="width:100%">'+
              '<option value="phong_ban">Phòng / Ban</option>'+
              '<option value="don_vi_sx">Đơn vị sản xuất</option>'+
              '<option value="doan_the">Đoàn thể</option>'+
              '<option value="he_thong">Đơn vị hệ thống</option>'+
              '<option value="muc_gop">Mục gộp (không phải đơn vị)</option></select></div>'+
            '<div class="field"><label>Thứ tự hiển thị</label>'+
              '<input class="inp" id="dv_sort" type="number" style="width:100%" value="'+(isNew?nextSort():u.sort)+'"></div>'+
          '</div>'+
          '<div class="field"><label>Trang được dùng đơn vị này</label>'+
            '<div class="perm-grid" id="dv_pages" style="max-height:none;grid-template-columns:1fr 1fr"></div></div>'+
          '<div class="field"><label>Icon (thẻ đơn vị ở trang Cấp phát BHLĐ)</label>'+
            '<select class="inp" id="dv_icon" style="width:100%">'+
              DV_ICONS.map(function(o){ return '<option value="'+esc(o.v)+'">'+esc(o.t)+'</option>'; }).join('')+
            '</select></div>'+
          '<div class="field" style="display:flex;gap:18px;flex-wrap:wrap">'+
            '<label class="perm-item" style="margin:0"><input type="checkbox" id="dv_active"'+(isNew||u.active?" checked":"")+' '+CB+'><span>Đang hoạt động</span></label>'+
            '<label class="perm-item" style="margin:0"><input type="checkbox" id="dv_hethong"'+(!isNew&&u.he_thong?" checked":"")+' '+CB+(!isNew&&u.he_thong?" disabled":"")+'><span>Đơn vị hệ thống (ngoài 12 đơn vị chính thức)</span></label>'+
            '<label class="perm-item" style="margin:0"><input type="checkbox" id="dv_mucgop"'+(!isNew&&u.muc_gop?" checked":"")+' '+CB+'><span>Mục gộp — cách nói gộp, không phải một đơn vị</span></label>'+
          '</div>'+
          '<div class="field"><label>Ghi chú</label><input class="inp" id="dv_ghichu" style="width:100%" value="'+esc(isNew?"":(u.ghi_chu||""))+'"></div>'+
          (isNew ? '<div class="muted">Mã cố định sẽ được sinh tự động từ tên và không bao giờ thay đổi.</div>'
                 : '<div class="muted">Mã cố định: <code>'+esc(u.ma)+'</code> — không thay đổi. '+
                   'Đổi tên ở đây sẽ đề nghị cập nhật các bản ghi cũ mang tên cũ.'+
                   (u.ten_cu.length?'<br>Tên cũ đã ghi nhận: '+esc(u.ten_cu.join(", ")):'')+'</div>')+
        '</div>'+
        '<div class="modal-f"><button class="btn btn-ghost" id="dvc">Huỷ</button><button class="btn btn-accent" id="dvs">Lưu</button></div></div>';
      document.body.appendChild(bg);

      var grid = bg.querySelector("#dv_pages");
      grid.innerHTML = PG.map(function(p){
        var on = !isNew && u.pages.indexOf(p.slug)>=0;
        return '<label class="perm-item" style="align-items:flex-start"><input type="checkbox" value="'+esc(p.slug)+'"'+(on?" checked":"")+' '+CB+'>'+
               '<span>'+esc(p.title)+'<br><span class="muted">'+esc(p.note)+(p.applied?"":" · chưa áp dụng")+'</span></span></label>';
      }).join("");
      if(!isNew){
        bg.querySelector("#dv_nhom").value = u.nhom;
        bg.querySelector("#dv_icon").value = u.icon || "";
        /* Trang Cấp phát BHLĐ nhận diện đơn vị hệ thống bằng TÊN (so chuỗi ở
           ~23 chỗ, kể cả khoá bảng test_baseline) → khoá ô tên lại. */
        if(u.he_thong){
          var oTen = bg.querySelector("#dv_ten");
          oTen.readOnly = true;
          oTen.style.background = "#f4f6f8";
          oTen.title = "Đơn vị hệ thống — tên được dùng làm mã nhận diện trong trang Cấp phát BHLĐ, không đổi được.";
        }
      }
      bg.classList.add("open");
      bg.querySelector("#dv_ten").focus();

      function close(){ if(bg.parentNode) bg.parentNode.removeChild(bg); }
      bg.querySelector("#dvx").addEventListener("click", close);
      bg.querySelector("#dvc").addEventListener("click", close);
      bg.addEventListener("click", function(e){ if(e.target===bg) close(); });

      bg.querySelector("#dvs").addEventListener("click", function(){
        var ten = bg.querySelector("#dv_ten").value.trim();
        if(!ten){ alert("Vui lòng nhập tên đơn vị."); return; }
        var trung = HSE_UNITS.resolve(ten);
        if(trung && (isNew || trung.ma!==u.ma)){ alert('Tên "'+ten+'" đã trùng với đơn vị "'+trung.ten+'" trong danh mục.'); return; }

        var pages = [];
        Array.prototype.forEach.call(grid.querySelectorAll("input:checked"), function(c){ pages.push(c.value); });

        var next = {
          ma:       isNew ? HSE_UNITS.suggestMa(ten) : u.ma,
          ten:      ten,
          ten_cu:   isNew ? [] : u.ten_cu.slice(),
          nhom:     bg.querySelector("#dv_nhom").value,
          sort:     parseInt(bg.querySelector("#dv_sort").value,10) || 0,
          active:   bg.querySelector("#dv_active").checked,
          he_thong: isNew ? bg.querySelector("#dv_hethong").checked : u.he_thong,
          muc_gop:  bg.querySelector("#dv_mucgop").checked,
          icon:     bg.querySelector("#dv_icon").value,
          pages:    pages,
          ghi_chu:  bg.querySelector("#dv_ghichu").value.trim()
        };

        var tenCu = isNew ? "" : u.ten;
        var doiTen = !isNew && HSE_UNITS.norm(tenCu) !== HSE_UNITS.norm(ten);
        // Ghi nhận bí danh: dù có cập nhật được bản ghi cũ hay không, hệ thống
        // vẫn tra ra đúng đơn vị từ tên cũ → báo cáo cũ không bị mồ côi.
        if(doiTen && next.ten_cu.indexOf(tenCu)<0) next.ten_cu.push(tenCu);

        HSE_UNITS.saveUnit(next).then(function(){
          close(); draw();
          showToast(isNew?"Đã thêm đơn vị.":"Đã lưu đơn vị.", "success");
          if(doiTen) capNhatTenHangLoat(tenCu, ten);
        }).catch(function(e){ alert("Không lưu được: "+(e&&e.message||e)); });
      });
    }

    function nextSort(){
      var a = HSE_UNITS.all({includeInactive:true});
      var m = 0; a.forEach(function(u){ if(u.sort>m) m=u.sort; });
      return m + 10;
    }

    /* ── Đổi tên hàng loạt trong dữ liệu cũ ── */
    function capNhatTenHangLoat(tenCu, tenMoi){
      showToast('Đang rà soát bản ghi cũ mang tên "'+tenCu+'"...', "info");
      HSE_UNITS.renameScan(tenCu).then(function(scan){
        if(scan.errors.length) console.warn("[DonVi] Không đọc được một số bảng khi rà soát:", scan.errors);
        if(!scan.total){
          showToast("Không có bản ghi cũ nào cần cập nhật.", "success");
          return;
        }
        var chiTiet = scan.hits.map(function(h){ return "· "+h.target.label+": "+h.rows.length+" bản ghi"; }).join("\n");
        var ok = confirm('Tìm thấy '+scan.total+' bản ghi đang mang tên cũ "'+tenCu+'":\n\n'+chiTiet+
          '\n\nCập nhật tất cả sang "'+tenMoi+'"?\n\n'+
          '(Bỏ qua cũng không sao: hệ thống vẫn hiểu đúng nhờ bí danh tên cũ, nhưng bản ghi sẽ vẫn hiển thị tên cũ.)');
        if(!ok) return;
        showToast("Đang cập nhật "+scan.total+" bản ghi...", "info");
        HSE_UNITS.renameApply(scan, tenCu, tenMoi).then(function(res){
          if(res.errors.length){
            console.warn("[DonVi] Bản ghi cập nhật lỗi:", res.errors);
            showToast("Đã cập nhật "+res.updated+"/"+scan.total+" bản ghi · "+res.errors.length+" bản ghi lỗi (xem Console).", "warning");
          } else {
            showToast("✅ Đã cập nhật "+res.updated+" bản ghi sang tên mới.", "success");
          }
        });
      }).catch(function(e){
        showToast("Không rà soát được dữ liệu cũ: "+(e&&e.message||e), "error");
      });
    }

    /* ── Khối cấu hình mục "Khác" theo trang ── */
    function drawOther(){
      var cfg = HSE_UNITS.config(); if(!cfg.other) cfg.other = {};
      otherBox.innerHTML =
        '<div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--border)">'+
          '<h3 style="font-size:15px;font-weight:700;color:var(--brand);margin-bottom:6px">Cho phép nhập tên đơn vị tự do (mục "Khác")</h3>'+
          '<p class="muted" style="margin:0 0 12px;line-height:1.6;max-width:680px">Bật để người dùng chọn "Khác" rồi tự gõ tên — '+
            'tiện khi phối hợp với đơn vị ngoài Xí nghiệp. Tắt thì chỉ chọn được các đơn vị trong danh mục, dữ liệu sạch hơn.</p>'+
          '<div class="perm-grid" id="dv-other-grid" style="max-height:none;grid-template-columns:1fr 1fr"></div>'+
        '</div>';
      var g = otherBox.querySelector("#dv-other-grid");
      g.innerHTML = PG.map(function(p){
        return '<label class="perm-item"><input type="checkbox" data-slug="'+esc(p.slug)+'"'+(cfg.other[p.slug]?" checked":"")+' '+CB+'>'+
               '<span>'+esc(p.title)+(p.applied?"":' <span class="muted">(chưa áp dụng)</span>')+'</span></label>';
      }).join("");
      Array.prototype.forEach.call(g.querySelectorAll("input"), function(c){
        c.addEventListener("change", function(){
          var next = HSE_UNITS.config(); if(!next.other) next.other = {};
          next.other[c.getAttribute("data-slug")] = c.checked;
          HSE_UNITS.saveConfig(next).then(function(){ showToast("Đã lưu cấu hình.", "success"); })
            .catch(function(e){ showToast("Không lưu được: "+(e&&e.message||e), "error"); });
        });
      });
    }

    draw(); drawOther();
    // Tải xong danh mục từ Supabase (hoặc admin ở máy khác vừa sửa) → vẽ lại
    HSE_UNITS.onChange(function(){
      if(!document.body.contains(tbl)) return;
      draw(); drawOther();
    });
    HSE_UNITS.refresh();
  }



  /* -------- ĐỔI MẬT KHẨU (dùng cho cả admin & user) -------- */
  function openDoiMatKhau(){
    var existing = document.getElementById("hse-doi-mk-modal");
    if(existing) { existing.classList.add("open"); return; }

    var bg = el("div","modal-bg"); bg.id="hse-doi-mk-modal";
    bg.innerHTML=
      '<div class="modal" style="max-width:420px;">'+
        '<div class="modal-h"><h3><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg> Đổi mật khẩu</h3><button class="x" id="dmk-close">×</button></div>'+
        '<div class="modal-b">'+
          '<div class="login-err" id="dmk-err"></div>'+
          '<div id="dmk-ok" style="display:none;background:#eafaf1;color:#1a7a3c;border:1px solid #a9dfbf;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
          '<div class="field"><label>Mật khẩu hiện tại</label><input class="inp" id="dmk-cur" type="password" style="width:100%" placeholder="Nhập mật khẩu hiện tại"></div>'+
          '<div class="field"><label>Mật khẩu mới</label><input class="inp" id="dmk-new" type="password" style="width:100%" placeholder="Tối thiểu 6 ký tự"></div>'+
          '<div class="field"><label>Xác nhận mật khẩu mới</label><input class="inp" id="dmk-new2" type="password" style="width:100%" placeholder="Nhập lại mật khẩu mới"></div>'+
        '</div>'+
        '<div class="modal-f">'+
          '<button class="btn btn-ghost" id="dmk-cancel">Huỷ</button>'+
          '<button class="btn btn-accent" id="dmk-save"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Cập nhật</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(bg);

    function close(){
      bg.classList.remove("open");
      document.getElementById("dmk-cur").value="";
      document.getElementById("dmk-new").value="";
      document.getElementById("dmk-new2").value="";
      document.getElementById("dmk-err").style.display="none";
      document.getElementById("dmk-ok").style.display="none";
    }
    function showErr(msg){ var e=document.getElementById("dmk-err"); e.textContent=msg; e.style.display="block"; document.getElementById("dmk-ok").style.display="none"; }
    function showOk(msg){ var e=document.getElementById("dmk-ok"); e.textContent=msg; e.style.display="block"; document.getElementById("dmk-err").style.display="none"; }

    document.getElementById("dmk-close").addEventListener("click", close);
    document.getElementById("dmk-cancel").addEventListener("click", close);
    bg.addEventListener("click", function(e){ if(e.target===bg) close(); });
    document.getElementById("dmk-save").addEventListener("click", function(){
      var cur=document.getElementById("dmk-cur").value;
      var nw=document.getElementById("dmk-new").value;
      var nw2=document.getElementById("dmk-new2").value;
      var me=currentUser();
      if(!me){ showErr("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại."); return; }
      if(!cur){ showErr("Vui lòng nhập mật khẩu hiện tại."); return; }
      if(!nw||nw.length<6){ showErr("Mật khẩu mới phải có tối thiểu 6 ký tự."); return; }
      if(nw!==nw2){ showErr("Mật khẩu xác nhận không khớp."); return; }
      if(nw===cur){ showErr("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
      var saveBtn=document.getElementById("dmk-save");
      saveBtn.disabled=true;
      // Xác thực mật khẩu hiện tại bằng cách đăng nhập lại, rồi đổi qua Supabase Auth
      _sbReady().then(function(sb){
        return sb.auth.signInWithPassword({ email: emailOf(me.username), password: cur }).then(function(res){
          if(res.error){ showErr("Mật khẩu hiện tại không đúng."); saveBtn.disabled=false; return null; }
          return sb.auth.updateUser({ password: nw });
        });
      }).then(function(r){
        if(!r) return;
        if(r.error){ showErr(r.error.message || "Đổi mật khẩu thất bại."); saveBtn.disabled=false; return; }
        saveBtn.disabled=false;
        showOk("✅ Đổi mật khẩu thành công!");
        document.getElementById("dmk-cur").value="";
        document.getElementById("dmk-new").value="";
        document.getElementById("dmk-new2").value="";
      }).catch(function(e){ showErr((e && e.message) || "Lỗi kết nối."); saveBtn.disabled=false; });
    });

    bg.classList.add("open");
    setTimeout(function(){ document.getElementById("dmk-cur").focus(); }, 80);
  }

  /* -------- HỒ SƠ CÁ NHÂN -------- */
  function openEditProfile(){
    var me=currentUser();
    if(!me) return;
    var existing=document.getElementById("hse-profile-modal");
    if(existing){ existing.classList.add("open"); return; }
    var bg=el("div","modal-bg"); bg.id="hse-profile-modal";
    bg.innerHTML=
      '<div class="modal" style="max-width:440px;">'+
        '<div class="modal-h"><h3><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Hồ sơ cá nhân</h3><button class="x" id="pf-close">×</button></div>'+
        '<div class="modal-b">'+
          '<div id="pf-ok" style="display:none;background:#eafaf1;color:#1a7a3c;border:1px solid #a9dfbf;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
          '<div id="pf-err" style="display:none;background:#fdedec;color:#c0392b;border:1px solid #f1948a;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
          '<div class="field"><label>Tên đăng nhập</label>'+
            '<input class="inp" id="pf-un" disabled style="width:100%;background:#f8f9fd;color:var(--text-muted)">'+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
            '<div class="field"><label>Họ và tên <span style="color:var(--danger)">*</span></label>'+
              '<input class="inp" id="pf-fn" style="width:100%" placeholder="Nguyễn Văn A">'+
            '</div>'+
            '<div class="field"><label>Danh số</label>'+
              '<input class="inp" id="pf-ds" style="width:100%" placeholder="VD: 21398">'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="modal-f"><button class="btn btn-ghost" id="pf-cancel">Huỷ</button><button class="btn btn-accent" id="pf-save"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Lưu thông tin</button></div>'+
      '</div>';
    document.body.appendChild(bg);
    function close(){ bg.classList.remove("open"); }
    document.getElementById("pf-close").addEventListener("click",close);
    document.getElementById("pf-cancel").addEventListener("click",close);
    bg.addEventListener("click",function(e){ if(e.target===bg) close(); });
    document.getElementById("pf-save").addEventListener("click",function(){
      var fn=(document.getElementById("pf-fn").value||"").trim();
      var ds=(document.getElementById("pf-ds").value||"").trim();
      var errEl=document.getElementById("pf-err");
      var okEl=document.getElementById("pf-ok");
      errEl.style.display="none"; okEl.style.display="none";
      if(!fn){ errEl.textContent="Vui lòng nhập họ và tên."; errEl.style.display="block"; return; }
      var users=getUsers(); var me2=currentUser(); var changedUser=null;
      for(var i=0;i<users.length;i++){
        if(users[i].username===me2.username){ users[i].fullname=fn; users[i].danhSo=ds; users[i].updated=new Date().toISOString(); changedUser=users[i]; break; }
      }
      setUsers(users); if(changedUser) _syncUserSheet('update', changedUser);
      okEl.textContent="Đã cập nhật thông tin thành công!"; okEl.style.display="block";
      setTimeout(function(){ location.reload(); },1200);
    });
    bg.classList.add("open");
    var me2=currentUser();
    document.getElementById("pf-un").value=me2.username;
    document.getElementById("pf-fn").value=me2.fullname||"";
    document.getElementById("pf-ds").value=me2.danhSo||"";
    setTimeout(function(){ document.getElementById("pf-fn").focus(); },80);
  }

  /* -------- PHẦN CÀI ĐẶT DB (hiển thị trong trang Quản trị) -------- */
  function renderDBSettings(container) {
    if(!container) return;
    container.innerHTML =
      '<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">'+
        '<h3 style="font-size:15px;font-weight:700;color:var(--brand);margin-bottom:6px;">Kết nối cơ sở dữ liệu</h3>'+
        '<p style="font-size:12.5px;color:var(--text-muted);margin:0;">✅ Đang kết nối <b>Supabase</b>. Dữ liệu được lưu và đồng bộ tự động — không cần cấu hình gì thêm.</p>'+
      '</div>';
  }

  /* =========================================================
     WIDGET: KẾ HOẠCH THÁNG NÀY
     Đọc hse_ke_hoach_links, lọc theo slug + tháng hiện tại
     Hiển thị thêm: công việc trễ hạn + badge trạng thái
     ========================================================= */
  function renderKeHoachWidget(slug, wrap){
    var now = new Date();
    var curMonth = now.getMonth() + 1;
    var curYear  = now.getFullYear();
    var firstOfMonth = new Date(curYear, curMonth - 1, 1);
    var lastOfMonth  = new Date(curYear, curMonth, 0);

    var allLinks = load("hse_ke_hoach_links", {});
    var allTasks = allLinks[slug] || [];

    // Công việc trễ hạn: end < đầu tháng hiện tại, chưa hoàn thành
    var overdueTasks = allTasks.filter(function(t){
      if(t.type !== "oncetime") return false;
      if(t.status === "Đã hoàn thành") return false;
      if(!t.end) return false;
      return new Date(t.end) < firstOfMonth;
    });

    // Công việc trong tháng hiện tại
    var currentTasks = allTasks.filter(function(t){
      if(t.type === "oncetime"){
        var inRange = true;
        if(t.start && new Date(t.start) > lastOfMonth) inRange = false;
        if(t.end   && new Date(t.end)   < firstOfMonth) inRange = false;
        return inRange;
      } else {
        if(t.allMonths) return true;
        return (t.months||[]).indexOf(curMonth) >= 0;
      }
    });

    var monthLabel = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                      "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"][curMonth-1]
                     + "/" + curYear;

    // Badge trạng thái
    function statusBadge(status){
      if(!status) return "";
      var styles = {
        "Đã hoàn thành": "background:#eafaf1;color:#1a7a3c",
        "Đang thực hiện": "background:#fef5e4;color:#e68900",
        "Trễ hạn":        "background:#fdedec;color:#c0392b",
        "Chưa bắt đầu":   "background:#f0f3fa;color:#4a5568"
      };
      var s = styles[status] || "background:#f0f3fa;color:#4a5568";
      return '<span style="'+s+';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:4px">'+esc(status)+'</span>';
    }

    // Render hàng bảng
    function renderRows(tasks){
      return tasks.map(function(t, i){
        var typeBadge = t.type === "oncetime"
          ? '<span style="background:#dceaf7;color:#003087;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">Có kỳ hạn</span>'
          : '<span style="background:#eafaf1;color:#1a7a3c;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">Định kỳ</span>';
        var ngayTH = "";
        if(t.type === "oncetime"){
          var parts = [];
          if(t.start) parts.push(t.start.split("-").reverse().join("/"));
          if(t.end)   parts.push(t.end.split("-").reverse().join("/"));
          ngayTH = parts.join(" – ") || "—";
        } else {
          ngayTH = t.lastDay ? "Cuối tháng" : (t.execDay ? "Ngày " + t.execDay : "—");
        }
        var ph = Array.isArray(t.phoiHop) ? t.phoiHop.join(", ") : (t.phoiHop || "—");
        return '<tr>'+
          '<td style="color:var(--text-muted);font-size:12px;width:30px">'+(i+1)+'</td>'+
          '<td style="font-weight:600">'+ esc(t.name) + (t.status ? statusBadge(t.status) : "") +'</td>'+
          '<td>'+ typeBadge +'</td>'+
          '<td style="white-space:nowrap;font-size:12.5px">'+ esc(ngayTH) +'</td>'+
          '<td style="font-size:12.5px">'+ esc(t.chuTri||"—") +'</td>'+
          '<td style="font-size:12.5px">'+ esc(ph) +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.coSo||"—") +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.ghiChu||"—") +'</td>'+
          '</tr>';
      }).join("");
    }

    function tableWrap(rows, headerBg, headerColor){
      headerBg    = headerBg    || "#dde6f3";
      headerColor = headerColor || "#003087";
      var th = function(txt){ return '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left">'+txt+'</th>'; };
      return '<div style="background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);overflow:auto">'+
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr>'+
            '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left;width:30px">#</th>'+
            th('Nội dung công việc')+th('Loại')+th('Ngày thực hiện')+
            th('Đơn vị chủ trì')+th('Đơn vị phối hợp')+th('Cơ sở')+th('Ghi chú')+
          '</tr></thead>'+
          '<tbody>'+rows+'</tbody>'+
        '</table>'+
      '</div>';
    }

    var section = el("div");
    section.innerHTML =
      '<div class="section-h" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
        '<span><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> Kế hoạch ' + monthLabel + '</span>'+
        '<a href="ke-hoach.html" style="font-size:12px;color:var(--brand);font-weight:600;text-decoration:none">→ Xem & quản lý kế hoạch</a>'+
      '</div>';

    // --- Cảnh báo trễ hạn ---
    if(overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fdedec;border-left:4px solid #c0392b;border-radius:0 8px 8px 0;'+
          'padding:9px 14px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#c0392b;">'+
          '⚠️ ' + overdueTasks.length + ' công việc trễ hạn chưa hoàn thành'+
        '</div>';
      section.innerHTML += tableWrap(renderRows(overdueTasks), "#fdedec", "#c0392b");
      section.innerHTML += '<div style="height:14px"></div>';
    }

    // --- Công việc tháng hiện tại ---
    if(!currentTasks.length && !overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);'+
          'color:var(--text-muted);font-size:13px;text-align:center;">'+
          '✅ Không có công việc kế hoạch nào trong ' + monthLabel + '.'+
        '</div>';
    } else if(currentTasks.length){
      section.innerHTML += tableWrap(renderRows(currentTasks));
    }

    wrap.appendChild(section);
  }

  /* =========================================================
     RENDER: KẾ HOẠCH TỔNG HỢP CHO TRANG TỔNG QUAN
     Gom tất cả module, thêm cột Phân hệ
     ========================================================= */
  function renderKeHoachDashboard(wrap){
    var now = new Date();
    var curMonth = now.getMonth() + 1;
    var curYear  = now.getFullYear();
    var firstOfMonth = new Date(curYear, curMonth - 1, 1);
    var lastOfMonth  = new Date(curYear, curMonth, 0);

    var allLinks = load("hse_ke_hoach_links", {});
    var monthLabel = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                      "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"][curMonth-1]
                     + "/" + curYear;

    var overdueTasks = [];
    var currentTasks = [];

    MENU.forEach(function(item){
      if(item.slug === "tong-quan") return;
      var tasks = allLinks[item.slug] || [];
      tasks.forEach(function(t){
        var tw = Object.assign({}, t, { _phanHe: item.icon + " " + item.title });
        // Trễ hạn
        if(t.type === "oncetime" && t.status !== "Đã hoàn thành" && t.end && new Date(t.end) < firstOfMonth){
          overdueTasks.push(tw);
        }
        // Tháng hiện tại
        var inCurrent = false;
        if(t.type === "oncetime"){
          var ok = true;
          if(t.start && new Date(t.start) > lastOfMonth) ok = false;
          if(t.end   && new Date(t.end)   < firstOfMonth) ok = false;
          inCurrent = ok;
        } else {
          inCurrent = t.allMonths || (t.months||[]).indexOf(curMonth) >= 0;
        }
        if(inCurrent) currentTasks.push(tw);
      });
    });

    function statusBadge(status){
      if(!status) return "";
      var styles = {
        "Đã hoàn thành": "background:#eafaf1;color:#1a7a3c",
        "Đang thực hiện": "background:#fef5e4;color:#e68900",
        "Trễ hạn":        "background:#fdedec;color:#c0392b",
        "Chưa bắt đầu":   "background:#f0f3fa;color:#4a5568"
      };
      var s = styles[status] || "background:#f0f3fa;color:#4a5568";
      return '<span style="'+s+';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:4px">'+esc(status)+'</span>';
    }

    function renderRows(tasks){
      return tasks.map(function(t, i){
        var ngayTH = "";
        if(t.type === "oncetime"){
          var parts = [];
          if(t.start) parts.push(t.start.split("-").reverse().join("/"));
          if(t.end)   parts.push(t.end.split("-").reverse().join("/"));
          ngayTH = parts.join(" – ") || "—";
        } else {
          ngayTH = t.lastDay ? "Cuối tháng" : (t.execDay ? "Ngày " + t.execDay : "—");
        }
        var ph = Array.isArray(t.phoiHop) ? t.phoiHop.join(", ") : (t.phoiHop || "—");
        return '<tr>'+
          '<td style="color:var(--text-muted);font-size:12px;width:30px">'+(i+1)+'</td>'+
          '<td style="font-size:12px;color:var(--text-muted);white-space:nowrap">'+esc(t._phanHe||"—")+'</td>'+
          '<td style="font-weight:600">'+ esc(t.name) + (t.status ? statusBadge(t.status) : "") +'</td>'+
          '<td style="white-space:nowrap;font-size:12.5px">'+ esc(ngayTH) +'</td>'+
          '<td style="font-size:12.5px">'+ esc(t.chuTri||"—") +'</td>'+
          '<td style="font-size:12.5px">'+ esc(ph) +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.coSo||"—") +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.ghiChu||"—") +'</td>'+
          '</tr>';
      }).join("");
    }

    function tableWrap(rows, headerBg, headerColor){
      headerBg    = headerBg    || "#dde6f3";
      headerColor = headerColor || "#003087";
      var th = function(txt){ return '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left">'+txt+'</th>'; };
      return '<div style="background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);overflow:auto">'+
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr>'+
            '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left;width:30px">#</th>'+
            th('Phân hệ')+th('Nội dung công việc')+th('Ngày thực hiện')+
            th('Đơn vị chủ trì')+th('Đơn vị phối hợp')+th('Cơ sở')+th('Ghi chú')+
          '</tr></thead>'+
          '<tbody>'+rows+'</tbody>'+
        '</table>'+
      '</div>';
    }

    var section = el("div");
    section.innerHTML =
      '<div class="section-h" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
        '<span><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> Kế hoạch ' + monthLabel + '</span>'+
        '<a href="ke-hoach.html" style="font-size:12px;color:var(--brand);font-weight:600;text-decoration:none">→ Xem & quản lý kế hoạch</a>'+
      '</div>';

    if(overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fdedec;border-left:4px solid #c0392b;border-radius:0 8px 8px 0;'+
          'padding:9px 14px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#c0392b;">'+
          '⚠️ ' + overdueTasks.length + ' công việc trễ hạn chưa hoàn thành'+
        '</div>';
      section.innerHTML += tableWrap(renderRows(overdueTasks), "#fdedec", "#c0392b");
      section.innerHTML += '<div style="height:14px"></div>';
    }

    var oncetimeTasks  = currentTasks.filter(function(t){ return t.type === "oncetime"; });
    var recurringTasks = currentTasks.filter(function(t){ return t.type !== "oncetime"; });

    if(!currentTasks.length && !overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);'+
          'color:var(--text-muted);font-size:13px;text-align:center;">'+
          '✅ Không có công việc kế hoạch nào trong ' + monthLabel + '.'+
        '</div>';
    } else {
      if(oncetimeTasks.length){
        section.innerHTML += '<div style="font-size:13px;font-weight:700;color:var(--brand);margin:14px 0 8px"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg> Công việc có kỳ hạn</div>';
        section.innerHTML += tableWrap(renderRows(oncetimeTasks));
      }
      if(recurringTasks.length){
        section.innerHTML += '<div style="font-size:13px;font-weight:700;color:#1a7a3c;margin:14px 0 8px"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg> Công việc định kỳ</div>';
        section.innerHTML += tableWrap(renderRows(recurringTasks), "#eafaf1", "#1a7a3c");
      }
    }

    section.id = "dash-kh-section";
    wrap.appendChild(section);
  }

  /* =========================================================
     RENDER: TRANG SOP
     ========================================================= */
  var K_SOP = "hse_sop";
  function fmtSopDate(s){
    // Chuẩn hoá ISO → YYYY-MM-DD trước, rồi hiển thị DD/MM/YYYY
    var d = sheetDateToLocal(s);
    if(!d) return "—";
    var parts = d.split("-");
    if(parts.length === 3) return parts[2]+"/"+parts[1]+"/"+parts[0];
    return d;
  }

  function getSops(){ return load(K_SOP, []); }
  function setSops(arr){
    save(K_SOP, arr);
    if(typeof DB !== "undefined" && DB.isReady()){
      DB.bulkWrite("sop", arr).catch(function(e){ console.warn("[SOP] Sync Sheets thất bại:", e); });
    }
  }

  function renderSop(container, u, admin){
    container.innerHTML = "";

    // ── Tiêu đề trang ──
    var descText = admin
      ? 'Bạn có quyền thêm, chỉnh sửa và xoá tài liệu SOP.'
      : 'Bạn chỉ có quyền xem danh sách tài liệu SOP.';
    container.appendChild(el("div","",
      '<div class="page-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> '+esc((menuBySlug("sop")||{}).pageTitle||"SOP")+'</div>'+
      '<div class="page-desc">'+esc(descText)+'</div>'));

    // ── Toolbar: tìm kiếm + lọc đơn vị + nút thêm (admin) ──
    var bar = el("div","toolbar");
    bar.innerHTML =
      '<input class="inp" id="sop-q" type="search" name="tim-sop" autocomplete="off" placeholder="Tìm theo mã hoặc tên SOP..." style="min-width:220px">'+
      '<select class="inp" id="sop-filter-dv" style="min-width:180px">'+
        '<option value="">— Tất cả đơn vị —</option>'+
      '</select>'+
      '<div class="spacer"></div>'+
      (admin ? '<button class="btn btn-accent" id="sop-add">＋ Thêm SOP</button>' : '');
    container.appendChild(bar);

    // ── Bảng danh sách ──
    var tw = el("div","table-wrap");
    var tbl = el("table"); tbl.id = "sop-tbl"; tw.appendChild(tbl); container.appendChild(tw);

    // ── Modal thêm/sửa (chỉ admin) ──
    var modal = null;
    if(admin){ modal = buildSopModal(); container.appendChild(modal.bg); }

    // ── Cập nhật dropdown đơn vị ──
    function refreshDvOptions(){
      var sops = getSops();
      var dvSet = {};
      sops.forEach(function(s){ if(s.don_vi) dvSet[s.don_vi] = true; });
      var sel = document.getElementById("sop-filter-dv");
      if(!sel) return;
      var cur = sel.value;
      sel.innerHTML = '<option value="">— Tất cả đơn vị —</option>';
      Object.keys(dvSet).sort().forEach(function(dv){
        var opt = document.createElement("option");
        opt.value = dv; opt.textContent = dv;
        if(dv === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    }

    // ── Vẽ bảng ──
    function draw(){
      var q   = (document.getElementById("sop-q")||{value:""}).value.toLowerCase();
      var dv  = (document.getElementById("sop-filter-dv")||{value:""}).value;
      var sops = getSops().filter(function(s){
        var matchQ = !q || (s.ma_td||"").toLowerCase().indexOf(q)!==-1 || (s.ten_sop||"").toLowerCase().indexOf(q)!==-1;
        var matchDv = !dv || s.don_vi === dv;
        return matchQ && matchDv;
      });
      var html = '<thead><tr>'+
        '<th style="width:130px">Mã tài liệu</th>'+
        '<th>Tên SOP</th>'+
        '<th style="width:180px">Đơn vị thực hiện</th>'+
        '<th style="width:120px">Ngày phê duyệt</th>'+
        '<th style="width:120px;text-align:center">Tài liệu</th>'+
        (admin ? '<th style="width:110px;text-align:center">Thao tác</th>' : '')+
        '</tr></thead><tbody>';
      if(!sops.length){
        html += '<tr><td colspan="'+(admin?6:5)+'" class="muted" style="text-align:center;padding:28px">Không có tài liệu SOP nào.</td></tr>';
      }
      sops.forEach(function(s){
        html += '<tr>'+
          '<td><span style="font-family:monospace;font-size:12.5px;color:var(--primary);font-weight:600">'+esc(s.ma_td||'—')+'</span></td>'+
          '<td style="font-weight:700;color:var(--text);font-size:13.5px">'+esc(s.ten_sop||'')+'</td>'+
          '<td style="color:var(--text-muted)">'+esc(s.don_vi||'—')+'</td>'+
          '<td style="color:var(--text-muted);font-size:12.5px">'+esc(fmtSopDate(s.ngay_pd))+'</td>'+
          '<td style="text-align:center">'+
            (s.link ? '<a href="'+esc(s.link)+'" target="_blank" title="Xem tài liệu" style="display:inline-flex;align-items:center;gap:5px;background:var(--primary);color:white;text-decoration:none;padding:5px 12px;border-radius:6px;font-size:12.5px;font-weight:600"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg> Xem</a>' : '<span title="Chưa đính kèm tài liệu" style="display:inline-flex;color:#94a3b8"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg></span>')+
          '</td>'+
          (admin ?
            '<td style="text-align:center">'+
              '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="'+esc(s.id)+'">Sửa</button> '+
              '<button class="btn btn-danger btn-sm" data-act="del" data-id="'+esc(s.id)+'">Xoá</button>'+
            '</td>' : '')+
          '</tr>';
      });
      html += '</tbody>';
      tbl.innerHTML = html;

      if(admin){
        Array.prototype.forEach.call(tbl.querySelectorAll("button[data-act]"), function(b){
          b.addEventListener("click", function(){
            var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
            if(act==="edit"){ var rec = getSops().filter(function(x){return x.id===id;})[0]; if(rec) modal.open(rec); }
            else if(act==="del"){ delSop(id); }
          });
        });
      }
    }

    function delSop(id){
      if(!confirm("Xoá tài liệu SOP này?")) return;
      setSops(getSops().filter(function(x){ return x.id !== id; }));
      refreshDvOptions(); draw();
    }

    if(admin){
      modal.onSave = function(data, editId){
        var arr = getSops();
        if(editId){
          arr.forEach(function(x){ if(x.id===editId){ x.ma_td=data.ma_td; x.ten_sop=data.ten_sop; x.don_vi=data.don_vi; x.ngay_pd=data.ngay_pd; x.link=data.link; } });
        } else {
          arr.push({ id: Date.now().toString(36), ma_td:data.ma_td, ten_sop:data.ten_sop, don_vi:data.don_vi, ngay_pd:data.ngay_pd, link:data.link });
        }
        setSops(arr); refreshDvOptions(); draw();
      };
      document.getElementById("sop-add").addEventListener("click", function(){ modal.open(null); });
    }

    document.getElementById("sop-q").addEventListener("input", draw);
    document.getElementById("sop-filter-dv").addEventListener("change", draw);

    // Load từ Sheets nếu đã kết nối
    if(typeof DB !== "undefined" && DB.isReady()){
      DB.getAll("sop").then(function(rows){
        if(rows && rows.length){ save(K_SOP, rows); refreshDvOptions(); draw(); }
      }).catch(function(e){ console.warn("[SOP] Pull thất bại:", e && e.message || e); });
    }

    refreshDvOptions(); draw();
  }

  function buildSopModal(){
    var bg = el("div","modal-bg"); bg.id = "sop-modal";
    bg.innerHTML =
      '<div class="modal" style="max-width:480px">'+
        '<div class="modal-h"><span id="sop-mt">Thêm SOP</span><button class="x" id="sop-mx">×</button></div>'+
        '<div class="modal-b">'+
          '<div class="field"><label>Mã tài liệu <span style="color:var(--accent)">*</span></label><input class="inp" id="sop-ma" style="width:100%" placeholder="Nhập mã tài liệu"></div>'+
          '<div class="field"><label>Tên SOP <span style="color:var(--accent)">*</span></label><input class="inp" id="sop-ten" style="width:100%" placeholder="Tên đầy đủ của SOP"></div>'+
          '<div class="field"><label>Đơn vị thực hiện</label><input class="inp" id="sop-dv" style="width:100%" placeholder="Nhập đơn vị thực hiện"></div>'+
          '<div class="field"><label>Ngày phê duyệt</label><input class="inp" id="sop-nd" type="date" style="width:100%"></div>'+
          '<div class="field"><label>Link tài liệu</label><input class="inp" id="sop-lk" style="width:100%" placeholder="https://..."></div>'+
        '</div>'+
        '<div class="modal-f"><button class="btn btn-ghost" id="sop-mc">Huỷ</button><button class="btn btn-accent" id="sop-ms">Lưu</button></div>'+
      '</div>';

    var editId = null;
    var api = { bg: bg, onSave: null };

    api.open = function(rec){
      editId = rec ? rec.id : null;
      $("#sop-mt",bg).textContent = rec ? "Chỉnh sửa SOP" : "Thêm SOP mới";
      $("#sop-ma",bg).value  = rec ? (rec.ma_td||"")   : "";
      $("#sop-ten",bg).value = rec ? (rec.ten_sop||"")  : "";
      $("#sop-dv",bg).value  = rec ? (rec.don_vi||"")   : "";
      if(window.HSEDate) HSEDate.setValue($("#sop-nd",bg), rec ? (rec.ngay_pd||"") : "");
      else $("#sop-nd",bg).value  = rec ? (sheetDateToLocal(rec.ngay_pd)||"")  : "";
      $("#sop-lk",bg).value  = rec ? (rec.link||"")     : "";
      bg.classList.add("open");
    };
    function close(){ bg.classList.remove("open"); }

    $("#sop-mx",bg).addEventListener("click", close);
    $("#sop-mc",bg).addEventListener("click", close);
    bg.addEventListener("click", function(e){ if(e.target===bg) close(); });

    $("#sop-ms",bg).addEventListener("click", function(){
      var ma  = $("#sop-ma",bg).value.trim();
      var ten = $("#sop-ten",bg).value.trim();
      if(!ma || !ten){ alert("Vui lòng nhập Mã tài liệu và Tên SOP."); return; }
      if(api.onSave){
        api.onSave({
          ma_td:   ma,
          ten_sop: ten,
          don_vi:  $("#sop-dv",bg).value.trim(),
          ngay_pd: window.HSEDate ? HSEDate.getValue($("#sop-nd",bg)) : $("#sop-nd",bg).value,
          link:    $("#sop-lk",bg).value.trim()
        }, editId);
      }
      close();
    });

    return api;
  }

  /* -------- XUẤT API -------- */
  global.HSE = {
    MENU: MENU,
    renderPage: renderPage,
    renderDashboard: renderDashboard,
    currentUser: currentUser,
    logout: logout,
    renderDBSettings: renderDBSettings,
    DB: typeof DB !== "undefined" ? DB : null
  };

  /* -------- KHỞI ĐỘNG DB -------- */
  seedUsers();
  initDB();

})(window);
