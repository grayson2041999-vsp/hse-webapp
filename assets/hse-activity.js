/* =========================================================
 *  HSE-ACTIVITY.JS — Nhật ký hoạt động (Activity Feed)
 *  Webapp Quản lý HSE · Vietsovpetro
 *
 *  Cửa sổ nổi góc phải trang Tổng quan: avatar tròn + mô tả
 *  "ai đã làm gì", cập nhật realtime kiểu thông báo Facebook.
 *
 *  Yêu cầu nạp SAU: supabase-config.js (module), db.js, app.js
 *  Yêu cầu DB: đã chạy supabase/activity-log.sql
 *
 *  Ghi log 2 cách:
 *    1) Tự động — bám vào DB.insert/update/delete cho các bảng
 *       thuộc whitelist MODULES (không phải sửa trang nghiệp vụ).
 *    2) Thủ công — trang bất kỳ gọi:
 *         HSE_ACT.log({ action:"approve", module:"Cấp phát BHLĐ",
 *                       detail:"đã duyệt phiếu cấp phát Quý 3/2026",
 *                       ref_table:"phieu_requests", ref_id:"..." });
 * ========================================================= */
(function (global) {
  "use strict";
  if (global.HSE_ACT) return; // tránh nạp trùng

  /* ─── Bảng màu portal ─── */
  var C = { primary:"#003087", primaryLight:"#0060B6", accent:"#C8102E",
            success:"#1a7a3c", text:"#1a2535", light:"#6b7c93", border:"#cdd6e8" };

  var MAX_ITEMS = 20;

  /* ─── Whitelist: bảng đi qua DB → nhãn module + hành động có ý nghĩa ─── */
  var MODULES = {
    ke_hoach_mot_lan: { label:"Kế hoạch HSE",        icon:"📋", noun:"kế hoạch" },
    ke_hoach_lap_lai: { label:"Kế hoạch HSE",        icon:"📋", noun:"kế hoạch định kỳ" },
    pccc_devices:     { label:"PCCC & CNCH",         icon:"🧯", noun:"thiết bị PCCC" },
    pccc_errors:      { label:"PCCC & CNCH",         icon:"🧯", noun:"sự cố PCCC" },
    hl_nhansu:        { label:"Huấn luyện – Đào tạo", icon:"🎓", noun:"hồ sơ đào tạo" },
    sop:              { label:"SOP / Quy trình",     icon:"📑", noun:"quy trình SOP" }
  };
  // Nhãn màu cho từng loại hành động
  var ACT_COLOR = { create:C.success, update:C.primaryLight, delete:C.accent,
                    approve:C.primary, close:C.light, complete:C.success, report:C.accent };

  /* ─── Supabase client (đợi sẵn sàng) ─── */
  function _ready() {
    if (global.HSE_SB) return Promise.resolve(global.HSE_SB);
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () { reject(new Error("Supabase chưa sẵn sàng")); }, 12000);
      global.addEventListener("hse-sb-ready", function () { clearTimeout(to); resolve(global.HSE_SB); }, { once: true });
    });
  }

  /* ─── Người dùng hiện tại (id + snapshot hiển thị) ─── */
  var _me = null, _mePromise = null;
  function whoami(force) {
    if (_me && !force) return Promise.resolve(_me);
    if (_mePromise && !force) return _mePromise;
    _mePromise = _ready().then(function (sb) {
      return sb.auth.getUser().then(function (r) {
        var au = r && r.data && r.data.user;
        if (!au) { _me = null; return null; }
        return sb.from("profiles").select("id,username,fullname,avatar_url,role").eq("id", au.id).maybeSingle()
          .then(function (res) {
            var p = res && res.data;
            _me = { id: au.id,
                    username: p && p.username || (au.email || "").split("@")[0],
                    fullname: p && p.fullname || "",
                    avatar_url: p && p.avatar_url || "",
                    role: p && p.role || "user" };
            return _me;
          });
      });
    }).catch(function () { _me = null; return null; });
    return _mePromise;
  }

  /* ─── Ghi 1 dòng nhật ký ─── */
  function log(entry) {
    return whoami().then(function (m) {
      if (!m) return null; // chưa đăng nhập → không ghi (RLS cũng chặn)
      return _ready().then(function (sb) {
        return sb.from("activity_log").insert({
          user_id: m.id, username: m.username, fullname: m.fullname,
          avatar_url: m.avatar_url, role: m.role,
          action: entry.action || "update",
          module: entry.module || "Hệ thống",
          detail: entry.detail || "",
          ref_table: entry.ref_table || null,
          ref_id: entry.ref_id != null ? String(entry.ref_id) : null
        });
      });
    }).catch(function (e) { try { console.warn("[HSE_ACT] log lỗi:", e && e.message || e); } catch (x) {} });
  }

  /* ─── Auto-hook DB.insert/update/delete ─── */
  function _nameOf(o) { return o && (o.name || o.ten || o.tenNhanVien || o.title) || ""; }
  function _buildAuto(op, sheet, cfg, args) {
    var noun = cfg.noun, label = cfg.label;
    if (op === "delete") return { action:"delete", module:label, detail:"đã xoá " + noun, ref_table:sheet, ref_id:args[1] };
    if (op === "insert") {
      var nm = _nameOf(args[1]); return { action:"create", module:label,
        detail:"đã thêm " + noun + (nm ? " “" + nm + "”" : ""), ref_table:sheet, ref_id:args[1] && args[1].id };
    }
    // update: cố gắng nhận diện hoàn thành / duyệt / đóng
    var patch = args[2] || {};
    var st = String(patch.status || patch.trangThai || patch.tinhTrang || "").toLowerCase();
    var nm2 = _nameOf(patch);
    if (patch.completionDate || /hoàn thành|complete|done/.test(st))
      return { action:"complete", module:label, detail:"đã hoàn thành " + noun + (nm2 ? " “" + nm2 + "”" : ""), ref_table:sheet, ref_id:args[1] };
    if (/duyệt|approve/.test(st))
      return { action:"approve", module:label, detail:"đã duyệt " + noun, ref_table:sheet, ref_id:args[1] };
    if (/đóng|close|huỷ|hủy/.test(st))
      return { action:"close", module:label, detail:"đã đóng " + noun, ref_table:sheet, ref_id:args[1] };
    return { action:"update", module:label, detail:"đã cập nhật " + noun, ref_table:sheet, ref_id:args[1] };
  }
  // bulkWrite ghi đè cả bảng → so cache cũ với danh sách mới để biết thêm/xoá/sửa
  function _buildBulk(sheet, cfg, before, rows) {
    var noun = cfg.noun, label = cfg.label;
    rows = rows || [];
    var oldIds = (before || []).map(function (r) { return String(r.id); });
    var newIds = rows.map(function (r) { return String(r.id); });
    var added = rows.filter(function (r) { return oldIds.indexOf(String(r.id)) < 0; });
    var removed = oldIds.filter(function (id) { return newIds.indexOf(id) < 0; }).length;
    if (added.length) { var nm = _nameOf(added[0]); return { action:"create", module:label, detail:"đã thêm " + noun + (nm ? " “" + nm + "”" : ""), ref_table:sheet, ref_id:added[0].id }; }
    if (removed) return { action:"delete", module:label, detail:"đã xoá " + noun, ref_table:sheet };
    return { action:"update", module:label, detail:"đã cập nhật " + noun, ref_table:sheet };
  }

  function hookDB() {
    if (typeof DB === "undefined" || DB.__actHooked) return;
    DB.__actHooked = true;
    ["insert", "update", "delete"].forEach(function (op) {
      var orig = DB[op];
      if (typeof orig !== "function") return;
      DB[op] = function (sheet) {
        var args = arguments, p = orig.apply(DB, args);
        try {
          var cfg = MODULES[sheet];
          if (cfg && p && typeof p.then === "function") {
            p.then(function () { log(_buildAuto(op, sheet, cfg, args)); }, function () {});
          }
        } catch (e) {}
        return p;
      };
    });
    // bulkWrite (VD trang SOP, Kế hoạch) — cần bắt riêng
    var origBulk = DB.bulkWrite;
    if (typeof origBulk === "function") {
      DB.bulkWrite = function (sheet, rows) {
        var cfg = MODULES[sheet], before = null;
        try { before = cfg && DB.getCached ? DB.getCached(sheet) : null; } catch (e) {}
        var p = origBulk.apply(DB, arguments);
        try {
          if (cfg && p && typeof p.then === "function") {
            p.then(function () { log(_buildBulk(sheet, cfg, before, rows)); }, function () {});
          }
        } catch (e) {}
        return p;
      };
    }
  }

  /* =========================================================
     GIAO DIỆN — CỬA SỔ FEED NỔI GÓC PHẢI
     ========================================================= */
  var HOST_ID = "hse-act-widget";
  var BELL_ID = "hse-act-bell";
  var RAIL_W = 288;      // bề rộng cột — gọn, không lấn sự tập trung
  var NARROW = 1100;     // dưới ngưỡng này: thu về nút chuông (overlay)
  var _open = false;     // trạng thái mở overlay khi màn hẹp

  // Bảng gốc → trang mở khi bấm vào một hoạt động (bấm-để-nhảy)
  var REF_PAGE = {
    ke_hoach_mot_lan: "ke-hoach.html", ke_hoach_lap_lai: "ke-hoach.html",
    pccc_devices: "pccc-cnch.html", pccc_errors: "pccc-cnch.html",
    hl_nhansu: "index.html#huan-luyen-dao-tao", sop: "index.html#sop",
    phieu_requests: "cap-phat-bhld.html", cap_phat_tien_trinh: "cap-phat-bhld.html",
    nhanvien: "cap-phat-bhld.html"
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  function relTime(ts) {
    var d = new Date(ts), now = new Date(), s = Math.floor((now - d) / 1000);
    if (s < 45) return "vừa xong";
    if (s < 3600) return Math.floor(s / 60) + " phút trước";
    if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
    if (s < 172800) return "hôm qua";
    return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function initials(name, user) {
    var base = (name || user || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).slice(-2).join("");
    return base.toUpperCase();
  }
  function avatarColor(role) { return role === "admin" ? C.accent : role === "viewer" ? C.light : C.success; }

  function itemHTML(r) {
    var color = ACT_COLOR[r.action] || C.primaryLight;
    var av = r.avatar_url
      ? '<img src="' + esc(r.avatar_url) + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex:0 0 38px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.15);">'
      : '<div style="width:38px;height:38px;border-radius:50%;flex:0 0 38px;background:' + avatarColor(r.role) + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">' + esc(initials(r.fullname, r.username)) + '</div>';
    var who = esc(r.fullname || r.username || "Người dùng");
    var page = r.ref_table && REF_PAGE[r.ref_table] ? REF_PAGE[r.ref_table] : "";
    return '<div class="hse-act-item' + (page ? ' clk' : '') + '"' + (page ? ' data-page="' + esc(page) + '"' : '') +
        ' style="display:flex;gap:10px;padding:9px 12px;border-bottom:1px solid #eef1f7;align-items:flex-start;">' +
        '<div style="position:relative;">' + av +
          '<span style="position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #fff;"></span>' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:12.5px;line-height:1.45;color:' + C.text + ';">' +
            '<b>' + who + '</b> ' + esc(r.detail || r.action) +
            ' <span style="color:' + C.light + ';">·</span> ' +
            '<span style="color:' + C.primary + ';font-weight:600;">' + esc(r.module || "") + '</span>' +
          '</div>' +
          '<div style="font-size:11px;color:' + C.light + ';margin-top:2px;">' + relTime(r.created_at) + '</div>' +
        '</div>' +
      '</div>';
  }

  function panelHTML(items, me) {
    var body = items.length
      ? items.map(itemHTML).join("")
      : '<div style="padding:26px 16px;text-align:center;color:' + C.light + ';font-size:12.5px;">Chưa có hoạt động nào.</div>';

    var meRow = me
      ? '<div style="display:flex;align-items:center;gap:9px;padding:9px 12px;background:#f5f8ff;border-bottom:1px solid ' + C.border + ';">' +
          '<div style="position:relative;">' +
            (me.avatar_url
              ? '<img id="hse-act-my-av" src="' + esc(me.avatar_url) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">'
              : '<div id="hse-act-my-av" style="width:32px;height:32px;border-radius:50%;background:' + avatarColor(me.role) + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">' + esc(initials(me.fullname, me.username)) + '</div>') +
          '</div>' +
          '<div style="flex:1;font-size:12px;color:' + C.text + ';"><b>' + esc(me.fullname || me.username) + '</b><div style="color:' + C.light + ';font-size:11px;">Cập nhật ảnh đại diện của bạn</div></div>' +
          '<button id="hse-act-avatar-btn" title="Đổi ảnh đại diện" style="border:1px solid ' + C.border + ';background:#fff;border-radius:6px;cursor:pointer;padding:5px 9px;font-size:12px;color:' + C.primary + ';font-weight:600;">📷 Ảnh</button>' +
          '<input id="hse-act-avatar-file" type="file" accept="image/*" style="display:none;">' +
        '</div>'
      : '<div style="padding:9px 12px;background:#f5f8ff;border-bottom:1px solid ' + C.border + ';font-size:11.5px;color:' + C.light + ';">Đăng nhập để tạo ảnh đại diện và ghi hoạt động của bạn.</div>';

    var closeBtn = '<button id="hse-act-close" title="Đóng" aria-label="Đóng" style="display:none;background:rgba(255,255,255,.18);border:none;color:#fff;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;">×</button>';

    return '' +
      '<div style="flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 13px;background:' + C.primary + ';color:#fff;border-bottom:2px solid ' + C.accent + ';">' +
        '<div style="flex:1;font-size:13px;font-weight:600;">Hoạt động gần đây</div>' +
        closeBtn +
      '</div>' +
      meRow +
      '<div id="hse-act-list" style="flex:1 1 auto;overflow-y:auto;">' + body + '</div>';
  }

  function injectStyle() {
    if (document.getElementById("hse-act-style")) return;
    var s = document.createElement("style");
    s.id = "hse-act-style";
    s.textContent = ".hse-act-item.clk{cursor:pointer;transition:background .12s}" +
      ".hse-act-item.clk:hover{background:#f2f6ff}";
    document.head.appendChild(s);
  }
  function topOffset() {
    var tb = document.querySelector(".topbar");
    return (tb && tb.offsetHeight) || 58;
  }
  function buildHost() {
    injectStyle();
    var host = document.createElement("div");
    host.id = HOST_ID;
    // Cột cố định cao full bên phải; vị trí/khung do applyMode() đặt theo màn hình
    host.style.cssText = "position:fixed;right:0;bottom:0;width:" + RAIL_W + "px;max-width:86vw;" +
      "background:#fff;display:flex;flex-direction:column;overflow:hidden;" +
      "font-family:'Segoe UI',Arial,sans-serif;";
    return host;
  }

  var _items = [];
  function renderPanel(host) {
    whoami().then(function (me) {
      host.innerHTML = panelHTML(_items, me);
      wirePanel(host);
    });
  }

  function wirePanel(host) {
    var closeB = host.querySelector("#hse-act-close");
    if (closeB) {
      if (narrow()) closeB.style.display = "";
      closeB.addEventListener("click", function () { _open = false; applyMode(); });
    }

    var btn = host.querySelector("#hse-act-avatar-btn");
    var file = host.querySelector("#hse-act-avatar-file");
    if (btn && file) {
      btn.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function () {
        if (file.files && file.files[0]) uploadAvatar(file.files[0], host);
      });
    }

    // Bấm một hoạt động → mở trang liên quan
    var list = host.querySelector("#hse-act-list");
    if (list) list.addEventListener("click", function (e) {
      var it = e.target && e.target.closest ? e.target.closest(".hse-act-item.clk") : null;
      var page = it && it.getAttribute("data-page");
      if (page) location.href = page;
    });
  }

  function prepend(row) {
    _items.unshift(row);
    if (_items.length > MAX_ITEMS) _items = _items.slice(0, MAX_ITEMS);
    var host = document.getElementById(HOST_ID);
    if (!host) return;
    var list = host.querySelector("#hse-act-list");
    if (!list) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = itemHTML(row);
    var node = wrap.firstChild;
    if (node) {
      node.style.background = "#fffdf0";
      node.style.transition = "background 1.4s";
      // xoá dòng cũ nếu vượt quá 20
      var kids = list.querySelectorAll(".hse-act-item");
      if (kids.length >= MAX_ITEMS && kids[kids.length - 1]) kids[kids.length - 1].remove();
      list.insertBefore(node, list.firstChild);
      setTimeout(function () { node.style.background = "transparent"; }, 120);
    }
  }

  /* ─── Tải 20 mục mới nhất ─── */
  function loadFeed() {
    return _ready().then(function (sb) {
      return sb.from("activity_log").select("*").order("created_at", { ascending: false }).limit(MAX_ITEMS);
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      _items = res.data || [];
      var host = document.getElementById(HOST_ID);
      if (host) renderPanel(host);
    }).catch(function (e) { try { console.warn("[HSE_ACT] loadFeed:", e && e.message || e); } catch (x) {} });
  }

  /* ─── Realtime ─── */
  var _sub = null;
  function subscribe() {
    if (_sub) return;
    _ready().then(function (sb) {
      _sub = sb.channel("hse_activity_feed")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" },
          function (payload) { if (payload && payload.new) prepend(payload.new); })
        .subscribe();
    }).catch(function () {});
  }

  /* ─── Upload ảnh đại diện ─── */
  function uploadAvatar(fileObj, host) {
    var toast = global.showToast || function () {};
    whoami().then(function (me) {
      if (!me) { toast("Bạn cần đăng nhập.", "warning"); return; }
      var ext = (fileObj.name.split(".").pop() || "png").toLowerCase();
      var path = me.id + "/avatar_" + Date.now() + "." + ext;
      _ready().then(function (sb) {
        toast("Đang tải ảnh lên...", "info");
        return sb.storage.from("avatars").upload(path, fileObj, { upsert: true, contentType: fileObj.type || "image/png" })
          .then(function (up) {
            if (up.error) throw new Error(up.error.message);
            var pub = sb.storage.from("avatars").getPublicUrl(path);
            var url = pub && pub.data && pub.data.publicUrl;
            return sb.from("profiles").update({ avatar_url: url }).eq("id", me.id).then(function (r) {
              if (r.error) throw new Error(r.error.message);
              _me.avatar_url = url;
              toast("Đã cập nhật ảnh đại diện.", "success");
              if (host) renderPanel(host);
            });
          });
      }).catch(function (e) { toast("Lỗi tải ảnh: " + (e && e.message || e), "error"); });
    });
  }

  /* =========================================================
     GẮN / GỠ WIDGET THEO TRANG (chỉ hiện ở Tổng quan)
     ========================================================= */
  function isDashboard() {
    var p = location.pathname;
    var onIndex = /(^|\/)(index\.html)?$/.test(p) || /\/$/.test(p);
    var h = (location.hash || "").replace(/^#/, "");
    return onIndex && (h === "" || h === "tong-quan");
  }

  function narrow() { return (global.innerWidth || 1200) < NARROW; }

  /* Dời nội dung trang sang trái đúng bằng bề rộng cột (không đè lên nhau) */
  var _paddedEl = null;
  function reserve() {
    var c = document.getElementById("content");
    if (c) { c.style.paddingRight = RAIL_W + "px"; c.style.transition = "padding-right .15s"; _paddedEl = c; }
  }
  function unreserve() {
    if (_paddedEl) { _paddedEl.style.paddingRight = ""; _paddedEl = null; }
    var c = document.getElementById("content");
    if (c) c.style.paddingRight = "";
  }

  function ensureBell() {
    var bell = document.getElementById(BELL_ID);
    if (!bell) {
      bell = document.createElement("button");
      bell.id = BELL_ID;
      bell.setAttribute("aria-label", "Hoạt động gần đây");
      bell.innerHTML = "🔔";
      bell.style.cssText = "position:fixed;right:18px;bottom:18px;width:46px;height:46px;border-radius:50%;border:none;" +
        "background:" + C.primary + ";color:#fff;font-size:19px;cursor:pointer;z-index:40;box-shadow:0 6px 18px rgba(0,32,101,.28);";
      bell.addEventListener("click", function () { _open = !_open; applyMode(); });
      document.body.appendChild(bell);
    }
    return bell;
  }
  function removeBell() { var b = document.getElementById(BELL_ID); if (b) b.remove(); }

  /* Đặt vị trí/khung cột theo độ rộng màn hình */
  function applyMode() {
    var host = document.getElementById(HOST_ID);
    if (!host) return;
    host.style.top = topOffset() + "px";
    host.style.borderLeft = "1px solid " + C.border;
    var cl = host.querySelector("#hse-act-close");
    if (narrow()) {
      unreserve();
      host.style.zIndex = "40";
      host.style.boxShadow = "-6px 0 22px rgba(0,32,101,.20)";
      host.style.display = _open ? "flex" : "none";
      ensureBell();
      if (cl) cl.style.display = "";
    } else {
      _open = false;
      removeBell();
      host.style.zIndex = "15";
      host.style.boxShadow = "-2px 0 10px rgba(0,32,101,.05)";
      host.style.display = "flex";
      reserve();
      if (cl) cl.style.display = "none";
    }
  }

  var _mounting = false;
  function ensure() {
    if (_mounting) return;
    var existing = document.getElementById(HOST_ID);
    if (isDashboard()) {
      if (!existing && document.body) {
        _mounting = true;
        var host = buildHost();
        document.body.appendChild(host);
        renderPanel(host);
        _mounting = false;
      }
      applyMode();
    } else {
      if (existing) existing.remove();
      removeBell();
      unreserve();
    }
  }

  /* Quan sát body để tự gắn lại sau khi app render lại (innerHTML="") */
  function watch() {
    var pending = null;
    function schedule() { if (pending) return; pending = setTimeout(function () { pending = null; ensure(); }, 60); }
    var mo = new MutationObserver(schedule);
    if (document.body) mo.observe(document.body, { childList: true });
    global.addEventListener("hashchange", ensure);
    global.addEventListener("resize", schedule);
    // Quay lại tab sau khi máy ngủ/treo → tải lại lặng lẽ (bù realtime bị rớt)
    if (global.document) global.document.addEventListener("visibilitychange", function () {
      if (!global.document.hidden && isDashboard()) loadFeed();
    });
  }

  /* ─── Khởi động ─── */
  function boot() {
    hookDB();
    watch();
    ensure();
    loadFeed();
    subscribe();
    // profile có thể nạp muộn (sau đăng nhập) → làm mới header widget
    whoami(true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ─── API công khai ─── */
  global.HSE_ACT = {
    log: log,
    reloadFeed: loadFeed,
    whoami: whoami,
    refreshUser: function () { return whoami(true); },
    MODULES: MODULES
  };
})(typeof window !== "undefined" ? window : this);
