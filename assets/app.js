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
    { slug:"pccc-cnch",          title:"PCCC & CNCH",                 icon:"🧯", licon:"flame",            group:"theo-doi", sub:["Phương tiện CC & CNCH"] },
    { slug:"sop",                title:"SOP",                         icon:"📑", licon:"file-text",        group:"theo-doi", sub:[], adminEditOnly:true },
    { slug:"kiem-tra-cac-cap",   title:"Kiểm tra các cấp",            icon:"🔍", licon:"list-checks",      group:"theo-doi", sub:["Số lượng kiểm tra các cấp","Ghi nhận các lỗi vào hệ thống","Ghi nhận hành động khắc phục, thời hạn"] },
    { slug:"quan-ly-thiet-bi",   title:"Quản lý thiết bị",            icon:"⚙️", licon:"wrench",           group:"theo-doi", sub:["Thiết bị nâng","Bình áp lực"] },
    { slug:"kham-suc-khoe",      title:"Khám sức khoẻ nghề nghiệp",   icon:"🩺", licon:"stethoscope",      group:"theo-doi", sub:["Theo dõi khám sức khoẻ nghề nghiệp","Theo dõi khám bệnh nghề nghiệp"] },
    { slug:"moi-truong",         title:"Xử lý chất thải",             icon:"🌿", licon:"recycle",          group:"theo-doi", sub:["Thống kê khối lượng rác thải xử lý"] },
    { slug:"quan-ly-nha-thau",   title:"Quản lý nhà thầu",            icon:"👷", licon:"hard-hat",         group:"theo-doi", sub:["Thông tin các nhà thầu đang làm việc","Thuê kho, bãi, văn phòng làm việc"] },
    { slug:"ke-hoach",           title:"Kế hoạch",                    icon:"🗓️", licon:"calendar-days",    group:"theo-doi", sub:["Lập kế hoạch (chọn các mục liên quan)","Báo cáo kế hoạch cụ thể"] },
    { slug:"cap-phat-bhld",      title:"Cấp phát BHLĐ",               icon:"🦺", licon:"shield-check",     group:"ung-dung", sub:["Quản lý cấp phát","Danh mục BHLĐ","Định mức cấp phát","Phiếu yêu cầu","Tồn kho","Nhu cầu mua sắm"] },
    { slug:"huan-luyen-dao-tao", title:"Huấn luyện - Đào tạo",        icon:"🎓", licon:"graduation-cap",   group:"ung-dung", sub:["Thống kê các loại đào tạo, huấn luyện","Kiểm tra kiến thức an toàn","Đào tạo nội bộ"] },
    { slug:"bao-chay-tu-dong",   title:"Báo cáo hệ thống báo cháy tự động", icon:"🔔", licon:"bell",       group:"ung-dung", sub:["Danh sách thiết bị báo cháy","Ghi nhận lỗi & khắc phục"] },
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
      active:p.active, pendingApproval:p.pendingApproval, created:p.created };
  }
  function _profilePayload(u){
    var o={ username:u.username, fullname:u.fullname||"", danhSo:u.danhSo||"", role:u.role,
      perms:u.perms||[], capPhatUnits:u.capPhatUnits||[], updated:new Date().toISOString() };
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
        var arr=getUsers(); var i=arr.findIndex(function(x){return String(x.id)===String(u.id);});
        if(i>=0) arr[i]=u; else arr.push(u); setUsers(arr);
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

  /* -------- TIỆN ÍCH -------- */
  function $(s, r){ return (r||document).querySelector(s); }
  function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function load(k, def){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; } }
  function sheetDateToLocal(s){ if(!s||typeof s!=="string"||s.indexOf("T")<0) return s; var d=new Date(s); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  /* -------- TOAST DÙNG CHUNG --------
     Trước đây showToast chỉ được định nghĩa trong một vài trang standalone
     (ke-hoach.html, pccc-cnch.html, cap-phat-bhld.html). Ở index.html (nơi
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
    "tai-nan-su-co":1, "pccc-cnch":1, "kiem-tra-cac-cap":1, "moi-truong":1,
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
    "key":'<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>'
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
              active: userOrId.active!==false
            }}).then(_edgeCheck);
      } else {
        // Tự đăng ký → signUp (chờ Admin duyệt); KHÔNG giữ đăng nhập người mới
        p = sb.auth.signUp({ email: emailOf(userOrId.username), password: userOrId.password,
              options:{ data:{ username:userOrId.username, fullname:userOrId.fullname,
                danhSo:userOrId.danhSo||"", role:'viewer', perms:[], capPhatUnits:[],
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
  function isHashed(pw){ return !!pw && /^[0-9a-f]{64}$/.test(pw); }

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
        if(r.ok){ location.reload(); }
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
      userBoxHtml= activeSlug==="tong-quan"
        ? '<div class="user-box">'+
            '<span class="viewer-notice">Chế độ xem</span>'+
            '<button class="btn btn-sm btn-login-top" id="lo" style="display:inline-flex;align-items:center;gap:6px;">'+lic("lock",14)+' Đăng nhập</button>'+
          '</div>'
        : '<div class="user-box">'+
            '<span class="viewer-notice">Chế độ xem</span>'+
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
    } else if(activeSlug==="tong-quan") {
      ensureLoginModal();
      $("#lo").addEventListener("click", openLoginModal);
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
      '<div class="page-title" style="display:flex;align-items:center;gap:9px">'+(m.licon?lic(m.licon,22):"")+esc(m.title)+'</div>'+
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

    // Lưới launcher: 2 nhóm ô điều hướng (icon to trên, chữ dưới)
    wrap.appendChild(buildLauncher(u));

    // (Đã chuyển bảng kế hoạch sang tab "Công việc trong quý" trong trang Kế hoạch)
    renderShell("tong-quan", wrap);
    var dl = document.getElementById("dashLoginLink");
    if(dl){ dl.addEventListener("click", function(e){ e.preventDefault(); openLoginModal(); }); }

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
     RENDER: QUẢN TRỊ HỆ THỐNG (quản lý user + phân quyền)
     ========================================================= */
  function renderAdmin(container){
    container.innerHTML="";
    container.appendChild(el("div","",
      '<div class="page-title" style="display:flex;align-items:center;gap:9px">'+lic("settings",22)+'Quản trị hệ thống</div>'+
      '<div class="page-desc">Quản lý người dùng, vai trò và phân quyền truy cập từng trang.</div>'));

    var bar = el("div","toolbar");
    bar.innerHTML='<button class="btn btn-accent" id="addU">＋ Thêm người dùng</button>'+
      '<div class="muted">Vai trò: <b>Admin</b> toàn quyền · <b>User</b> thao tác theo phân quyền · <b>Viewer</b> chỉ xem.</div>'+
      '<div class="spacer"></div><input class="inp" id="q" placeholder="Tìm theo tên / tài khoản...">';
    container.appendChild(bar);

    var tw = el("div","table-wrap"); var tbl = el("table"); tbl.id="utbl"; tw.appendChild(tbl); container.appendChild(tw);

    var modal = buildModal(); container.appendChild(modal.bg);

    function draw(filter){
      var u = getUsers(); var me = currentUser();
      var rows = u.filter(function(x){
        if(!filter) return true; var f=filter.toLowerCase();
        return (x.username+" "+(x.fullname||"")).toLowerCase().indexOf(f)!==-1;
      });
      var nMod = MENU.length;
      var html='<thead><tr><th>Tài khoản</th><th>Danh số</th><th>Họ tên</th><th>Vai trò</th><th>Trang được phép sửa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>';
      rows.forEach(function(x){
        var permCount = x.role==="admin" ? nMod : (x.perms||[]).length;
        var isPending = x.pendingApproval && x.active===false;
        var statusHtml = isPending
          ? '<span class="badge" style="background:#fef9e7;color:#856404;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg> Chờ duyệt</span>'
          : (x.active===false
            ? '<span class="badge badge-viewer">Đã khoá</span>'
            : '<span class="badge badge-user">Hoạt động</span>');
        html+='<tr>'+
          '<td><b>'+esc(x.username)+'</b></td>'+
          '<td style="color:var(--text-muted);font-size:12.5px;">'+(x.danhSo||'—')+'</td>'+
          '<td>'+esc(x.fullname||"")+'</td>'+
          '<td><span class="badge badge-'+x.role+'">'+roleLabel(x.role)+'</span></td>'+
          '<td>'+permCount+' / '+nMod+'</td>'+
          '<td>'+statusHtml+'</td>'+
          '<td>'+
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="'+esc(x.id)+'">'+(isPending?'✅ Duyệt / Sửa':'Sửa')+'</button> '+
            (!isPending?'<button class="btn btn-ghost btn-sm" data-act="lock" data-id="'+esc(x.id)+'">'+(x.active===false?"Mở khoá":"Khoá")+'</button> ':'')+
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="'+esc(x.id)+'"'+((me&&String(x.id)===String(me.id))?' disabled':'')+'>Xoá</button>'+
          '</td></tr>';
      });
      if(!rows.length) html+='<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Không có người dùng phù hợp.</td></tr>';
      html+='</tbody>';
      tbl.innerHTML=html;

      Array.prototype.forEach.call(tbl.querySelectorAll("button[data-act]"), function(b){
        b.addEventListener("click", function(){
          var id=b.getAttribute("data-id"), act=b.getAttribute("data-act");
          if(act==="edit") modal.open(findUserById(id));
          else if(act==="del") delUser(id);
          else if(act==="lock") lockUser(id);
        });
      });
    }

    function delUser(id){
      var me=currentUser(); var target=findUserById(id);
      if(!target) return;
      if(me && String(target.id)===String(me.id)){ alert("Không thể xoá tài khoản đang đăng nhập."); return; }
      if(!confirm("Xoá người dùng \""+(target.username||target.fullname||"")+"\"?")) return;
      setUsers(getUsers().filter(function(x){return String(x.id)!==String(id);}));
      _syncUserSheet('delete', target.id);
      draw($("#q").value);
    }
    function lockUser(id){
      var u=getUsers(); var me=currentUser(); var changedUser=null;
      u.forEach(function(x){ if(String(x.id)===String(id)){ if(me && String(x.id)===String(me.id) && x.active!==false){ alert("Không thể khoá tài khoản đang đăng nhập."); return; } x.active = x.active===false; changedUser=x; } });
      setUsers(u); if(changedUser) _syncUserSheet('update', changedUser); draw($("#q").value);
    }

    modal.onSave=function(data, originalId){
      var u=getUsers(); var sheetUser=null; var sheetAction=null;
      if(originalId){
        for(var i=0;i<u.length;i++){
          if(String(u[i].id)===String(originalId)){
            u[i].fullname=data.fullname;
            u[i].danhSo=data.danhSo||"";
            u[i].role=data.role;
            u[i].perms=data.perms;
            u[i].capPhatUnits=data.capPhatUnits||[];
            u[i].updated=new Date().toISOString();
            if(data.password){ u[i].password=data.password; }
            if(data.approve){ u[i].active=true; u[i].pendingApproval=false; }
            sheetUser=u[i]; sheetAction='update';
          }
        }
      } else {
        if(findUser(data.username)){ alert("Email này đã được sử dụng."); return false; }
        var newUser={ id:Date.now().toString(36), username:data.username,
          password:data.password, fullname:data.fullname,
          danhSo:data.danhSo||"", role:data.role, perms:data.perms,
          capPhatUnits:data.capPhatUnits||[],
          active:true, created:new Date().toISOString() };
        u.push(newUser);
        sheetUser=newUser; sheetAction='insert';
      }
      setUsers(u); if(sheetUser) _syncUserSheet(sheetAction, sheetUser); draw($("#q").value); return true;
    };

    $("#addU").addEventListener("click", function(){ modal.open(null); });
    $("#q").addEventListener("input", function(){ draw(this.value); });
    draw("");

    // Khi đồng bộ users từ Sheets hoàn tất (sau ~2s), vẽ lại bảng để hiển thị
    // đầy đủ người dùng thay vì chỉ tài khoản admin seed sẵn trên localStorage
    _onUsersSynced = function(){
      if(!document.body.contains(tbl)) return; // Đã rời trang thì bỏ qua
      var qEl = $("#q"); draw(qEl ? qEl.value : "");
    };

    // Phần cài đặt kết nối Google Sheets DB
    var dbSection = el("div");
    container.appendChild(dbSection);
    renderDBSettings(dbSection);
  }

  function buildModal(){
    var bg = el("div","modal-bg");
    bg.innerHTML=
      '<div class="modal"><div class="modal-h"><h3 id="mt">Người dùng</h3><button class="x" id="mx">×</button></div>'+
      '<div class="modal-b">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
          '<div class="field"><label>Email</label><input class="inp" id="m_un" type="text" style="width:100%" placeholder="VD: sonlhh.sd"></div>'+
          '<div class="field"><label>Danh số</label><input class="inp" id="m_ds" style="width:100%" placeholder="VD: 21398"></div>'+
        '</div>'+
        '<div class="field"><label>Họ và tên</label><input class="inp" id="m_fn" style="width:100%"></div>'+
        '<div class="field"><label>Vai trò</label><select id="m_role" style="width:100%">'+
          '<option value="user">User — thao tác theo phân quyền</option>'+
          '<option value="admin">Admin — toàn quyền</option></select></div>'+
        '<div class="field" id="permWrap"><label>Phân quyền truy cập trang '+
          '<span class="muted">(<a href="#" id="selAll">chọn tất cả</a> · <a href="#" id="selNone">bỏ chọn</a>)</span></label>'+
          '<div class="perm-grid" id="m_perms"></div>'+
          '<div class="muted" id="adminNote" style="display:none;margin-top:6px">Admin mặc định có toàn quyền tất cả các trang.</div></div>'+
        '<div id="m_pw_wrap" style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px;display:none">'+
          '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg> Đặt mật khẩu ban đầu</div>'+
          '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Chỉ dùng khi tạo tài khoản mới. Người dùng tự đổi mật khẩu qua hồ sơ cá nhân.</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
            '<div class="field"><label>Mật khẩu <span style="color:var(--danger)">*</span></label><input class="inp" id="m_pw" type="password" style="width:100%" placeholder="Tối thiểu 6 ký tự"></div>'+
            '<div class="field"><label>Xác nhận mật khẩu</label><input class="inp" id="m_pw2" type="password" style="width:100%" placeholder="Nhập lại mật khẩu"></div>'+
          '</div>'+
        '</div>'+
        '<div id="m_approve_wrap" style="display:none;background:#fef9e7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-top:12px;">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">'+
            '<input type="checkbox" id="m_approve" style="width:16px;height:16px;accent-color:var(--brand);">'+
            '<span><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> Phê duyệt & kích hoạt tài khoản này</span>'+
          '</label>'+
        '</div>'+
      '</div>'+
      '<div class="modal-f"><button class="btn btn-ghost" id="mc">Huỷ</button><button class="btn btn-accent" id="ms">Lưu</button></div></div>';

    var permBox = $("#m_perms",bg);
    var CAP_PHAT_UNITS = ['Cảng biển','Căn cứ Kho - Giao nhận','Xưởng sửa chữa','Đội xe VTHH&PTTBCD','Đội xe VCHK','Bộ máy điều hành'];
    MENU.forEach(function(item){
      if(item.adminOnly) return;
      if(item.adminEditOnly) return;
      var lab = el("label","perm-item");
      lab.innerHTML='<input type="checkbox" value="'+item.slug+'"><span>'+item.icon+' '+esc(item.title)+'</span>';
      permBox.appendChild(lab);
    });

    // Sub-panel phân quyền đơn vị con cho Cấp phát BHLĐ
    var cpUnitWrap = document.createElement("div");
    cpUnitWrap.id = "cpUnitWrap";
    cpUnitWrap.style.cssText = "display:none;grid-column:1/-1;background:#f0f7ff;border:1.5px solid #b3d0f0;border-radius:8px;padding:12px 14px;margin-top:4px;";
    cpUnitWrap.innerHTML = '<div style="font-size:12px;font-weight:700;color:#003087;margin-bottom:8px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg> Đơn vị được phép xem trong Cấp phát BHLĐ</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;" id="cpUnitGrid"></div>'+
      '<div style="margin-top:8px;display:flex;gap:10px;"><a href="#" id="cpSelAll" style="font-size:12px;">chọn tất cả</a> · <a href="#" id="cpSelNone" style="font-size:12px;">bỏ chọn</a></div>';
    permBox.parentNode.insertBefore(cpUnitWrap, permBox.nextSibling);
    // Dùng querySelector trên cpUnitWrap vì bg chưa được thêm vào document DOM lúc này
    var cpGrid = cpUnitWrap.querySelector("#cpUnitGrid");
    CAP_PHAT_UNITS.forEach(function(u){
      var lab = el("label","perm-item");
      lab.innerHTML='<input type="checkbox" value="'+u+'"><span>'+u+'</span>';
      cpGrid.appendChild(lab);
    });
    cpUnitWrap.querySelector("#cpSelAll").addEventListener("click",function(e){e.preventDefault();cpGrid.querySelectorAll("input").forEach(function(c){c.checked=true;});});
    cpUnitWrap.querySelector("#cpSelNone").addEventListener("click",function(e){e.preventDefault();cpGrid.querySelectorAll("input").forEach(function(c){c.checked=false;});});

    function getCapPhatUnits(){ var a=[]; cpGrid.querySelectorAll("input:checked").forEach(function(c){a.push(c.value);}); return a; }
    function setCapPhatUnits(arr){ cpGrid.querySelectorAll("input").forEach(function(c){c.checked=arr.indexOf(c.value)!==-1;}); }
    function updateCpUnitWrap(){
      var cpChk = permBox.querySelector("input[value='cap-phat-bhld']");
      var isAdm = $("#m_role",bg).value==="admin";
      cpUnitWrap.style.display = (!isAdm && cpChk && cpChk.checked) ? "block" : "none";
    }
    // Lắng nghe thay đổi trên checkbox cap-phat-bhld
    var cpChkEl = permBox.querySelector("input[value='cap-phat-bhld']");
    if(cpChkEl) cpChkEl.addEventListener("change", updateCpUnitWrap);

    var editing = null;
    function setPerms(arr){ Array.prototype.forEach.call(permBox.querySelectorAll("input"), function(c){ c.checked=arr.indexOf(c.value)!==-1; }); updateCpUnitWrap(); }
    function getPerms(){ var a=[]; Array.prototype.forEach.call(permBox.querySelectorAll("input:checked"), function(c){ a.push(c.value); }); return a; }
    function toggleRoleUI(){
      var isAdm = $("#m_role",bg).value==="admin";
      $("#m_perms",bg).style.display=isAdm?"none":"grid";
      $("#adminNote",bg).style.display=isAdm?"block":"none";
      updateCpUnitWrap();
    }

    var api = { bg:bg, onSave:null };
    api.open=function(user){
      editing=user;
      $("#mt",bg).textContent=user?"Phân quyền người dùng":"Thêm người dùng mới";
      $("#m_un",bg).value=user?user.username:"";
      $("#m_un",bg).disabled=!!user;
      $("#m_fn",bg).value=user?(user.fullname||""):"";
      $("#m_ds",bg).value=user?(user.danhSo||""):"";
      $("#m_pw",bg).value="";
      $("#m_pw2",bg).value="";
      // Chỉ hiện ô mật khẩu khi tạo mới
      var pwWrap=document.getElementById("m_pw_wrap");
      if(pwWrap) pwWrap.style.display=user?"none":"block";
      $("#m_role",bg).value=user?user.role:"user";
      setPerms(user?(user.role==="admin"?[]:(user.perms||[])):[]);
      setCapPhatUnits(user?(Array.isArray(user.capPhatUnits)?user.capPhatUnits:[]):[]);
      toggleRoleUI();
      // Hiện ô phê duyệt nếu tài khoản đang chờ
      var approveWrap=document.getElementById("m_approve_wrap");
      var approveChk=document.getElementById("m_approve");
      if(user && user.pendingApproval && !user.active){
        approveWrap.style.display="block";
        approveChk.checked=false;
        // Fix 5: gợi ý phân quyền mặc định khi duyệt (chọn sẵn các trang cơ bản)
        var defaultPerms=["tong-quan","pccc-cnch","cap-phat-bhld","huan-luyen-dao-tao",
          "kiem-tra-cac-cap","quan-ly-thiet-bi",
          "kham-suc-khoe","moi-truong",
          "quan-ly-nha-thau","ke-hoach"];
        if(!(user.perms && user.perms.length)) setPerms(defaultPerms);
      } else { approveWrap.style.display="none"; }
      bg.classList.add("open");
    };
    function close(){ bg.classList.remove("open"); }
    $("#mx",bg).addEventListener("click",close);
    $("#mc",bg).addEventListener("click",close);
    $("#m_role",bg).addEventListener("change",toggleRoleUI);
    $("#selAll",bg).addEventListener("click",function(e){e.preventDefault(); setPerms(allSlugs());});
    $("#selNone",bg).addEventListener("click",function(e){e.preventDefault(); setPerms([]);});
    bg.addEventListener("click",function(e){ if(e.target===bg) close(); });
    $("#ms",bg).addEventListener("click",function(){
      var un=$("#m_un",bg).value.trim();
      var fn=$("#m_fn",bg).value.trim();
      var ds=$("#m_ds",bg).value.trim();
      var role=$("#m_role",bg).value;
      var pw=$("#m_pw",bg).value;
      var pw2=$("#m_pw2",bg).value;
      if(!editing && !un){ alert("Vui lòng nhập tên đăng nhập."); return; }
      if(!fn){ alert("Vui lòng nhập họ tên."); return; }
      // Fix 3: bắt buộc nhập mật khẩu khi tạo mới
      if(!editing && !pw){ alert("Vui lòng nhập mật khẩu cho tài khoản mới."); return; }
      if(pw && pw.length<6){ alert("Mật khẩu phải có tối thiểu 6 ký tự."); return; }
      if(pw && pw!==pw2){ alert("Mật khẩu xác nhận không khớp."); return; }
      var perms = role==="admin" ? allSlugs() : getPerms();
      var capPhatUnits = role==="admin" ? CAP_PHAT_UNITS : getCapPhatUnits();
      var approve = document.getElementById("m_approve") && document.getElementById("m_approve").checked;
      var saveBtn=document.getElementById("ms"); if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Đang lưu...";}
      function doSave(hashedPw){
        var data={username:un, fullname:fn, danhSo:ds, role:role, perms:perms, capPhatUnits:capPhatUnits, password:hashedPw, pwHash:!!hashedPw, approve:approve};
        var ok=api.onSave && api.onSave(data, editing?editing.id:null);
        if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Lưu";}
        if(ok!==false) close();
      }
      // Fix 4: hash nếu có mật khẩu mới
      if(pw){ hashPw(pw).then(doSave); } else { doSave(null); }
    });
    return api;
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
    var dbReady = typeof DB !== "undefined" && DB.isReady();
    var currentUrl = dbReady ? localStorage.getItem("hse_db_url") || "" : "";
    container.innerHTML =
      '<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">' +
        '<h3 style="font-size:15px;font-weight:700;color:var(--brand);margin-bottom:6px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Kết nối Google Sheets Database</h3>' +
        '<p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;">Dán URL Apps Script Web App vào đây. Dữ liệu sẽ được lưu lên Google Sheets và đồng bộ giữa các máy.</p>' +
        '<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
          '<input id="hse-db-url" class="inp" style="flex:1;min-width:300px;font-size:12.5px;" ' +
            'placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(currentUrl) + '">' +
          '<button class="btn btn-accent btn-sm" id="hse-db-save"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Lưu URL</button>' +
          '<button class="btn btn-ghost btn-sm" id="hse-db-test"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg> Kiểm tra kết nối</button>' +
          '<button class="btn btn-ghost btn-sm" id="hse-db-sync"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Sync Users</button>' +
        '</div>' +
        '<div id="hse-db-status" style="font-size:12.5px;padding:8px 12px;border-radius:6px;display:none;"></div>' +
      '</div>';

    var urlInput = document.getElementById("hse-db-url");
    var statusEl = document.getElementById("hse-db-status");

    function showStatus(msg, ok) {
      statusEl.style.display = "block";
      statusEl.style.background = ok ? "#eafaf1" : "#fdedec";
      statusEl.style.color = ok ? "#1a7a3c" : "#c0392b";
      statusEl.style.border = "1px solid " + (ok ? "#a9dfbf" : "#f1948a");
      statusEl.textContent = msg;
    }

    document.getElementById("hse-db-save").onclick = function() {
      var url = urlInput.value.trim();
      if(typeof DB === "undefined") { showStatus("❌ db.js chưa được tải.", false); return; }
      DB.init(url);
      showStatus(url ? "✅ Đã lưu URL thành công!" : "⚠️ Đã xóa URL (chế độ offline).", !!url);
    };

    document.getElementById("hse-db-test").onclick = function() {
      if(typeof DB === "undefined" || !DB.isReady()) { showStatus("❌ Chưa nhập URL.", false); return; }
      showStatus("⏳ Đang kiểm tra...", true);
      DB.testConnection().then(function(r) {
        showStatus("✅ Kết nối OK — " + r.count + " sheets: " + r.sheets.slice(0,5).join(", ") + "...", true);
      }).catch(function(e) {
        showStatus("❌ Lỗi: " + e.message, false);
      });
    };

    document.getElementById("hse-db-sync").onclick = function() {
      if(typeof DB === "undefined" || !DB.isReady()) { showStatus("❌ Chưa kết nối Sheets.", false); return; }
      var users = getUsers();
      if(!users.length) { showStatus("⚠️ Không có tài khoản nào để đẩy lên.", false); return; }
      showStatus("⏳ Đang đẩy " + users.length + " tài khoản lên Sheets...", true);
      DB.bulkWrite("users", users).then(function() {
        showStatus("✅ Đã đẩy " + users.length + " tài khoản lên Sheets thành công!", true);
      }).catch(function(e) {
        showStatus("❌ Lỗi: " + e.message, false);
      });
    };
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
      '<div class="page-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> SOP</div>'+
      '<div class="page-desc">'+esc(descText)+'</div>'));

    // ── Toolbar: tìm kiếm + lọc đơn vị + nút thêm (admin) ──
    var bar = el("div","toolbar");
    bar.innerHTML =
      '<input class="inp" id="sop-q" placeholder="Tìm theo mã hoặc tên SOP..." style="min-width:220px">'+
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
            (s.link ? '<a href="'+esc(s.link)+'" target="_blank" title="Xem tài liệu" style="display:inline-flex;align-items:center;gap:5px;background:var(--primary);color:white;text-decoration:none;padding:5px 12px;border-radius:6px;font-size:12.5px;font-weight:600"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Xem</a>' : '<span title="Chưa đính kèm tài liệu" style="display:inline-flex;color:var(--text-muted)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg></span>')+
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
