/* =========================================================
   SVODKA.JS
   Module "Nhập thông tin an toàn trên Svodka" – HSE Webapp
   - Admin lưu các trang nhập: tác vụ + link + tài khoản + mật khẩu
     + các bước hướng dẫn (workflow)
   - Hiển thị cho user/viewer dạng thẻ + workflow
   - Mật khẩu: admin/user xem được (che sẵn, nút Hiện & Copy);
     viewer/khách chỉ thấy ••••••
   - Toàn bộ icon dùng Lucide (không emoji)
   - Khoá bảo mật thật nằm ở RLS Supabase (supabase/svodka.sql)
   ========================================================= */
(function () {
  "use strict";

  var T_TACVU = "svodka_tacvu";
  var T_BUOC  = "svodka_buoc";
  var T_MK     = "svodka_matkhau";

  /* ── Icon Lucide inline ── */
  var ICO = {
    "database":"<ellipse cx='12' cy='5' rx='9' ry='3'/><path d='M3 5v14a9 3 0 0 0 18 0V5'/><path d='M3 12a9 3 0 0 0 18 0'/>",
    "external-link":"<path d='M15 3h6v6'/><path d='M10 14 21 3'/><path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/>",
    "link":"<path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/>",
    "user":"<path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
    "key":"<path d='m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4'/><path d='m21 2-9.6 9.6'/><circle cx='7.5' cy='15.5' r='5.5'/>",
    "eye":"<path d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'/><circle cx='12' cy='12' r='3'/>",
    "eye-off":"<path d='M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49'/><path d='M14.084 14.158a3 3 0 0 1-4.242-4.242'/><path d='M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143'/><path d='m2 2 20 20'/>",
    "copy":"<rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/>",
    "check":"<path d='M20 6 9 17l-5-5'/>",
    "plus":"<path d='M5 12h14'/><path d='M12 5v14'/>",
    "square-pen":"<path d='M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z'/>",
    "trash-2":"<path d='M10 11v6'/><path d='M14 11v6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'/><path d='M3 6h18'/><path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>",
    "save":"<path d='M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'/><path d='M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7'/><path d='M7 3v4a1 1 0 0 0 1 1h7'/>",
    "x":"<path d='M18 6 6 18'/><path d='m6 6 12 12'/>",
    "lock":"<rect width='18' height='11' x='3' y='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>",
    "arrow-up":"<path d='m5 12 7-7 7 7'/><path d='M12 19V5'/>",
    "arrow-down":"<path d='M12 5v14'/><path d='m19 12-7 7-7-7'/>",
    "arrow-right":"<path d='M5 12h14'/><path d='m12 5 7 7-7 7'/>",
    "workflow":"<rect width='8' height='8' x='3' y='3' rx='2'/><path d='M7 11v4a2 2 0 0 0 2 2h4'/><rect width='8' height='8' x='13' y='13' rx='2'/>",
    "info":"<circle cx='12' cy='12' r='10'/><path d='M12 16v-4'/><path d='M12 8h.01'/>",
    "inbox":"<polyline points='22 12 16 12 14 15 10 15 8 12 2 12'/><path d='M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'/>"
  };
  function ic(name, size){
    var p = ICO[name]; if(!p) return "";
    var s = size || 16;
    return "<svg width='"+s+"' height='"+s+"' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='flex-shrink:0' aria-hidden='true'>"+p+"</svg>";
  }

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function isValidLink(s){ return /^https?:\/\//i.test(String(s||"").trim()); }
  function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  /* ── CSS module (chèn 1 lần) ── */
  function injectCss(){
    if(document.getElementById("svodka-css")) return;
    var css =
      ".sv-hint{font-size:12.5px;color:var(--text-muted,#6b7c93);background:#eef3fb;border:1px dashed #c3d3ee;padding:10px 14px;border-radius:8px;margin:14px 0 16px;display:flex;gap:8px;align-items:flex-start}"+
      ".sv-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}"+
      ".sv-task{background:var(--card,#fff);border:1px solid var(--border,#cdd6e8);border-left:4px solid var(--primary,#003087);border-radius:10px;padding:18px 20px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.07)}"+
      ".sv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}"+
      ".sv-name{font-size:16px;font-weight:700;color:var(--text,#1a2535);display:flex;align-items:center;gap:8px}"+
      ".sv-acts{display:flex;gap:6px;flex-wrap:wrap}"+
      ".sv-open{display:inline-flex;align-items:center;gap:6px;background:var(--accent,#C8102E);color:#fff;text-decoration:none;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600}"+
      ".sv-open:hover{background:var(--accent-dark,#9E0D24)}"+
      ".sv-btn{border:none;border-radius:8px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}"+
      ".sv-btn-primary{background:var(--primary-light,#0060B6);color:#fff}.sv-btn-primary:hover{background:var(--primary,#003087)}"+
      ".sv-btn-ghost{background:#fff;border:1.5px solid var(--border,#cdd6e8);color:var(--text,#1a2535)}.sv-btn-ghost:hover{background:#eef3fb}"+
      ".sv-btn-danger{background:#fff;border:1.5px solid #f0b8b8;color:var(--danger,#c0392b)}.sv-btn-danger:hover{background:#fdedec}"+
      ".sv-btn-sm{padding:5px 10px;font-size:12px}"+
      ".sv-creds{display:flex;gap:22px;flex-wrap:wrap;margin:14px 0 4px;padding:12px 14px;background:#f6f9fe;border:1px solid #e2ebf7;border-radius:8px}"+
      ".sv-cred{display:flex;flex-direction:column;gap:3px;min-width:180px;max-width:100%}"+
      ".sv-cred label{font-size:11px;color:var(--text-muted,#6b7c93);font-weight:600;text-transform:uppercase;letter-spacing:.3px;display:flex;align-items:center;gap:5px}"+
      ".sv-val{font-size:13.5px;font-weight:700;color:var(--text,#1a2535);font-family:'Consolas',monospace;display:flex;align-items:center;gap:8px;word-break:break-all}"+
      ".sv-val a{font-weight:700}"+
      ".sv-icobtn{border:1px solid var(--border,#cdd6e8);background:#fff;border-radius:6px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted,#6b7c93)}"+
      ".sv-icobtn:hover{background:#eef3fb;color:var(--primary,#003087)}"+
      ".sv-masked{letter-spacing:2px;color:var(--text-muted,#6b7c93)}"+
      ".sv-lock{font-size:11.5px;color:var(--text-muted,#6b7c93);display:inline-flex;align-items:center;gap:5px}"+
      ".sv-wf-title{font-size:12px;font-weight:700;color:var(--primary,#003087);margin:16px 0 12px;text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:6px}"+
      ".sv-flow{display:flex;align-items:stretch;flex-wrap:wrap;gap:6px 0}"+
      ".sv-step{background:#fff;border:1.5px solid var(--border,#cdd6e8);border-top:3px solid var(--primary-light,#0060B6);border-radius:9px;padding:11px 14px 12px;max-width:250px;min-width:150px;position:relative;flex:1}"+
      ".sv-step .n{position:absolute;top:-11px;left:12px;background:var(--primary,#003087);color:#fff;font-size:11px;font-weight:700;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center}"+
      ".sv-step .t{font-size:13.5px;line-height:1.55;margin-top:6px;color:var(--text,#1a2535);font-weight:500}"+
      ".sv-arr{display:flex;align-items:center;color:var(--primary-light,#0060B6);padding:0 4px}"+
      ".sv-empty{text-align:center;color:var(--text-muted,#6b7c93);padding:40px 20px;background:#fff;border:1px dashed var(--border,#cdd6e8);border-radius:10px}"+
      ".sv-empty svg{opacity:.5;margin-bottom:10px}"+
      /* modal */
      ".sv-ov{position:fixed;inset:0;background:rgba(15,25,45,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:30px 16px;overflow:auto}"+
      ".sv-modal{background:#fff;border-radius:12px;width:100%;max-width:640px;box-shadow:0 20px 50px rgba(0,0,0,.3)}"+
      ".sv-modal-h{background:linear-gradient(135deg,#003087,#0060B6);color:#fff;padding:15px 20px;border-radius:12px 12px 0 0;border-bottom:3px solid var(--accent,#C8102E);display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:15px}"+
      ".sv-modal-b{padding:20px}"+
      ".sv-field{margin-bottom:14px}"+
      ".sv-field label{display:block;font-size:12.5px;font-weight:600;color:var(--text,#1a2535);margin-bottom:5px}"+
      ".sv-inp{width:100%;padding:9px 12px;border:1.5px solid var(--border,#cdd6e8);border-radius:8px;font-size:13.5px;font-family:inherit;box-sizing:border-box}"+
      ".sv-inp:focus{outline:none;border-color:var(--primary-light,#0060B6)}"+
      ".sv-steprow{display:flex;gap:6px;align-items:center;margin-bottom:8px}"+
      ".sv-steprow .sv-inp{flex:1}"+
      ".sv-modal-f{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border,#cdd6e8)}"+
      ".sv-msg{font-size:12.5px;margin-right:auto;align-self:center}";
    var st = document.createElement("style");
    st.id = "svodka-css"; st.textContent = css;
    document.head.appendChild(st);
  }

  /* =========================================================
     RENDER CHÍNH
     ========================================================= */
  window.renderSvodka = function (container, u, admin) {
    injectCss();
    var canSeePass = !!(u && (u.role === "admin" || u.role === "user"));
    var state = { tasks: [], steps: {}, pass: {} };

    var hintText = admin
      ? "Bạn là <b>Admin</b>: thêm/sửa/xoá tác vụ, chỉnh sửa các bước hướng dẫn và xem mật khẩu."
      : canSeePass
        ? "Bạn đã đăng nhập: mật khẩu được che sẵn — bấm biểu tượng con mắt để hiện, hoặc sao chép."
        : "";

    container.innerHTML =
      "<div class='page-title' style='display:flex;align-items:center;gap:9px'>"+ic("database",22)+"Nhập thông tin an toàn trên Svodka</div>"+
      "<div class='page-desc'>Nơi lưu các trang nhập thông tin an toàn lên hệ thống Svodka.</div>"+
      (hintText ? "<div class='sv-hint'>"+ic("info",16)+"<span>"+hintText+"</span></div>" : "")+
      "<div class='sv-toolbar'><div id='sv-status' style='font-size:12.5px;color:var(--text-muted,#6b7c93)'></div>"+
        (admin ? "<button class='sv-btn sv-btn-primary' id='sv-add'>"+ic("plus",16)+"Thêm tác vụ nhập</button>" : "")+
      "</div>"+
      "<div id='sv-list'></div>";

    var listEl = container.querySelector("#sv-list");
    var statusEl = container.querySelector("#sv-status");
    if(admin){
      var addBtn = container.querySelector("#sv-add");
      if(addBtn) addBtn.addEventListener("click", function(){ openEditor(null); });
    }

    /* ── Nạp dữ liệu ── */
    function reload(){
      statusEl.textContent = "Đang tải...";
      var jobs = [ DB.getAll(T_TACVU), DB.getAll(T_BUOC) ];
      if(canSeePass) jobs.push(DB.getAll(T_MK));
      Promise.all(jobs).then(function(res){
        var tacvu = res[0] || [], buoc = res[1] || [], mk = res[2] || [];
        tacvu.sort(function(a,b){ return (a.sort_order||0)-(b.sort_order||0); });
        state.tasks = tacvu;
        state.steps = {};
        buoc.sort(function(a,b){ return (a.sort_order||0)-(b.sort_order||0); });
        buoc.forEach(function(b){ (state.steps[b.tacvu_id] = state.steps[b.tacvu_id] || []).push(b); });
        state.pass = {};
        mk.forEach(function(m){ state.pass[m.tacvu_id] = m.password || ""; });
        statusEl.textContent = tacvu.length + " tác vụ nhập";
        draw();
      }).catch(function(e){
        statusEl.textContent = "";
        listEl.innerHTML = "<div class='sv-empty'>"+ic("info",34)+"<div>Không tải được dữ liệu: "+esc(e && e.message || e)+"</div></div>";
      });
    }

    /* ── Vẽ danh sách ── */
    function draw(){
      if(!state.tasks.length){
        listEl.innerHTML = "<div class='sv-empty'>"+ic("inbox",40)+"<div>Chưa có tác vụ nhập nào."+
          (admin ? " Bấm <b>Thêm tác vụ nhập</b> để bắt đầu." : "")+"</div></div>";
        return;
      }
      listEl.innerHTML = state.tasks.map(taskCard).join("");
      bindCardEvents();
    }

    function passHtml(t){
      if(!canSeePass){
        return "<span class='sv-masked'>••••••••</span> <span class='sv-lock'>"+ic("lock",13)+"Đăng nhập nội bộ để xem</span>";
      }
      var real = state.pass[t.id];
      if(real == null || real === "") return "<span class='sv-lock'>(chưa đặt mật khẩu)</span>";
      return "<span class='sv-val sv-masked' data-pw='"+t.id+"' data-shown='0'>••••••••</span>"+
        "<button class='sv-icobtn' data-toggle='"+t.id+"' title='Hiện/Ẩn'>"+ic("eye",15)+"</button>"+
        "<button class='sv-icobtn' data-copy='"+t.id+"' title='Sao chép'>"+ic("copy",15)+"</button>";
    }

    function stepsHtml(t){
      var arr = state.steps[t.id] || [];
      if(!arr.length) return "<div style='font-size:12.5px;color:var(--text-muted,#6b7c93);margin-top:12px'>(Chưa có bước hướng dẫn)</div>";
      var boxes = arr.map(function(s,i){
        var box = "<div class='sv-step'><span class='n'>"+(i+1)+"</span><div class='t'>"+esc(s.content)+"</div></div>";
        return box + (i < arr.length-1 ? "<div class='sv-arr'>"+ic("arrow-right",20)+"</div>" : "");
      }).join("");
      return "<div class='sv-wf-title'>"+ic("workflow",15)+"Các bước hướng dẫn</div><div class='sv-flow'>"+boxes+"</div>";
    }

    function taskCard(t){
      var adminActs = admin
        ? "<button class='sv-btn sv-btn-ghost sv-btn-sm' data-edit='"+t.id+"'>"+ic("square-pen",15)+"Sửa</button>"+
          "<button class='sv-btn sv-btn-danger sv-btn-sm' data-del='"+t.id+"'>"+ic("trash-2",15)+"Xoá</button>"
        : "";
      var linkRow = isValidLink(t.link)
        ? "<div class='sv-cred'><label>"+ic("link",13)+"Link nhập</label><span class='sv-val'><a href='"+esc(t.link)+"' target='_blank' rel='noopener' style='color:var(--primary-light,#0060B6);font-size:12.5px'>"+esc(t.link)+"</a></span></div>"
        : "";
      return "<div class='sv-task'>"+
        "<div class='sv-head'>"+
          "<div class='sv-name'>"+ic("database",18)+esc(t.name)+"</div>"+
          "<div class='sv-acts'>"+adminActs+"</div>"+
        "</div>"+
        "<div class='sv-creds'>"+
          linkRow+
          "<div class='sv-cred'><label>"+ic("user",13)+"Tài khoản</label><span class='sv-val'>"+(t.account?esc(t.account):"<span class='sv-lock'>(chưa có)</span>")+"</span></div>"+
          "<div class='sv-cred'><label>"+ic("key",13)+"Mật khẩu</label><span class='sv-val'>"+passHtml(t)+"</span></div>"+
        "</div>"+
        stepsHtml(t)+
      "</div>";
    }

    function bindCardEvents(){
      listEl.querySelectorAll("[data-toggle]").forEach(function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-toggle");
          var span = listEl.querySelector("[data-pw='"+id+"']");
          if(!span) return;
          if(span.getAttribute("data-shown")==="1"){
            span.textContent="••••••••"; span.classList.add("sv-masked"); span.setAttribute("data-shown","0");
            btn.innerHTML = ic("eye",15);
          } else {
            span.textContent = state.pass[id]; span.classList.remove("sv-masked"); span.setAttribute("data-shown","1");
            btn.innerHTML = ic("eye-off",15);
          }
        });
      });
      listEl.querySelectorAll("[data-copy]").forEach(function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-copy");
          var val = state.pass[id] || "";
          if(navigator.clipboard) navigator.clipboard.writeText(val);
          var old = btn.innerHTML; btn.innerHTML = ic("check",15);
          setTimeout(function(){ btn.innerHTML = old; }, 1000);
        });
      });
      if(!admin) return;
      listEl.querySelectorAll("[data-edit]").forEach(function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-edit");
          openEditor(state.tasks.filter(function(t){return t.id===id;})[0]);
        });
      });
      listEl.querySelectorAll("[data-del]").forEach(function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-del");
          var t = state.tasks.filter(function(x){return x.id===id;})[0];
          if(!t) return;
          if(!window.confirm("Xoá tác vụ \""+t.name+"\"? Các bước hướng dẫn và mật khẩu kèm theo cũng bị xoá.")) return;
          DB.del(T_TACVU, id).then(reload).catch(function(e){ alert("Xoá thất bại: "+(e&&e.message||e)); });
        });
      });
    }

    /* =========================================================
       EDITOR (Admin) — thêm/sửa tác vụ + các bước
       ========================================================= */
    function openEditor(task){
      var editing = !!task;
      var draft = {
        id: task ? task.id : genId(),
        name: task ? task.name : "",
        link: task ? (task.link||"") : "",
        account: task ? (task.account||"") : "",
        password: task ? (state.pass[task.id]||"") : "",
        steps: task ? (state.steps[task.id]||[]).map(function(s){return s.content;}) : [""]
      };
      if(!draft.steps.length) draft.steps = [""];

      var ov = document.createElement("div");
      ov.className = "sv-ov";
      ov.innerHTML =
        "<div class='sv-modal'>"+
          "<div class='sv-modal-h'><span>"+(editing?"Sửa tác vụ nhập":"Thêm tác vụ nhập")+"</span>"+
            "<button class='sv-icobtn' id='sv-close' style='background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);color:#fff'>"+ic("x",16)+"</button></div>"+
          "<div class='sv-modal-b'>"+
            "<div class='sv-field'><label>Tên tác vụ nhập *</label><input class='sv-inp' id='f-name' placeholder='VD: Nhập số giờ công lao động an toàn' value='"+esc(draft.name)+"'></div>"+
            "<div class='sv-field'><label>Link trang nhập</label><input class='sv-inp' id='f-link' placeholder='https://...' value='"+esc(draft.link)+"'></div>"+
            "<div class='sv-field'><label>Tài khoản</label><input class='sv-inp' id='f-acc' placeholder='Tên đăng nhập cổng Svodka' value='"+esc(draft.account)+"'></div>"+
            "<div class='sv-field'><label>Mật khẩu</label><input class='sv-inp' id='f-pass' placeholder='Mật khẩu đăng nhập' value='"+esc(draft.password)+"'></div>"+
            "<div class='sv-field'><label>Các bước hướng dẫn</label><div id='f-steps'></div>"+
              "<button class='sv-btn sv-btn-ghost sv-btn-sm' id='f-addstep' style='margin-top:4px'>"+ic("plus",15)+"Thêm bước</button></div>"+
          "</div>"+
          "<div class='sv-modal-f'><span class='sv-msg' id='f-msg'></span>"+
            "<button class='sv-btn sv-btn-ghost' id='f-cancel'>Huỷ</button>"+
            "<button class='sv-btn sv-btn-primary' id='f-save'>"+ic("save",16)+"Lưu</button></div>"+
        "</div>";
      document.body.appendChild(ov);

      var stepsWrap = ov.querySelector("#f-steps");
      function drawSteps(){
        stepsWrap.innerHTML = draft.steps.map(function(s,i){
          return "<div class='sv-steprow'>"+
            "<span style='font-size:12px;font-weight:700;color:var(--primary,#003087);width:20px;text-align:center'>"+(i+1)+"</span>"+
            "<input class='sv-inp' data-si='"+i+"' placeholder='Nội dung bước "+(i+1)+"' value='"+esc(s)+"'>"+
            "<button class='sv-icobtn' data-up='"+i+"' title='Lên'>"+ic("arrow-up",14)+"</button>"+
            "<button class='sv-icobtn' data-down='"+i+"' title='Xuống'>"+ic("arrow-down",14)+"</button>"+
            "<button class='sv-icobtn' data-rm='"+i+"' title='Xoá bước'>"+ic("trash-2",14)+"</button>"+
          "</div>";
        }).join("");
        stepsWrap.querySelectorAll("[data-si]").forEach(function(inp){
          inp.addEventListener("input", function(){ draft.steps[+inp.getAttribute("data-si")] = inp.value; });
        });
        stepsWrap.querySelectorAll("[data-up]").forEach(function(b){
          b.addEventListener("click", function(){ var i=+b.getAttribute("data-up"); if(i>0){ syncSteps(); var x=draft.steps.splice(i,1)[0]; draft.steps.splice(i-1,0,x); drawSteps(); } });
        });
        stepsWrap.querySelectorAll("[data-down]").forEach(function(b){
          b.addEventListener("click", function(){ var i=+b.getAttribute("data-down"); if(i<draft.steps.length-1){ syncSteps(); var x=draft.steps.splice(i,1)[0]; draft.steps.splice(i+1,0,x); drawSteps(); } });
        });
        stepsWrap.querySelectorAll("[data-rm]").forEach(function(b){
          b.addEventListener("click", function(){ var i=+b.getAttribute("data-rm"); syncSteps(); draft.steps.splice(i,1); if(!draft.steps.length) draft.steps=[""]; drawSteps(); });
        });
      }
      function syncSteps(){
        stepsWrap.querySelectorAll("[data-si]").forEach(function(inp){ draft.steps[+inp.getAttribute("data-si")] = inp.value; });
      }
      drawSteps();

      ov.querySelector("#f-addstep").addEventListener("click", function(){ syncSteps(); draft.steps.push(""); drawSteps(); });
      function close(){ document.body.removeChild(ov); }
      ov.querySelector("#sv-close").addEventListener("click", close);
      ov.querySelector("#f-cancel").addEventListener("click", close);
      ov.addEventListener("click", function(e){ if(e.target===ov) close(); });

      ov.querySelector("#f-save").addEventListener("click", function(){
        syncSteps();
        var msg = ov.querySelector("#f-msg");
        var name = ov.querySelector("#f-name").value.trim();
        var link = ov.querySelector("#f-link").value.trim();
        var acc  = ov.querySelector("#f-acc").value.trim();
        var pass = ov.querySelector("#f-pass").value;
        if(!name){ msg.style.color="var(--accent,#C8102E)"; msg.textContent="Nhập tên tác vụ."; return; }
        if(link && !isValidLink(link)){ msg.style.color="var(--accent,#C8102E)"; msg.textContent="Link phải bắt đầu bằng http:// hoặc https://"; return; }
        var cleanSteps = draft.steps.map(function(s){return (s||"").trim();}).filter(function(s){return s;});
        var saveBtn = ov.querySelector("#f-save");
        saveBtn.disabled = true; msg.style.color="var(--text-muted,#6b7c93)"; msg.textContent="Đang lưu...";

        var now = new Date().toISOString();
        var sortOrder = task ? (task.sort_order||0) : state.tasks.length;
        // 1) Lưu tác vụ
        DB.insert(T_TACVU, { id:draft.id, name:name, link:link, account:acc, sort_order:sortOrder, updated_at:now })
        // 2) Lưu mật khẩu (upsert theo tacvu_id)
        .then(function(){ return DB.insert(T_MK, { tacvu_id:draft.id, password:pass, updated_at:now }); })
        // 3) Xoá các bước cũ rồi ghi lại theo thứ tự mới
        .then(function(){
          var old = editing ? (state.steps[draft.id]||[]) : [];
          return Promise.all(old.map(function(s){ return DB.del(T_BUOC, s.id); }));
        })
        .then(function(){
          return Promise.all(cleanSteps.map(function(content,i){
            return DB.insert(T_BUOC, { id:genId(), tacvu_id:draft.id, content:content, sort_order:i, updated_at:now });
          }));
        })
        .then(function(){ close(); reload(); })
        .catch(function(e){ saveBtn.disabled=false; msg.style.color="var(--accent,#C8102E)"; msg.textContent="Lưu thất bại: "+(e&&e.message||e); });
      });
    }

    reload();
  };
})();
