/* =========================================================
   HUAN-LUYEN-DAO-TAO.JS
   Module quản lý huấn luyện, đào tạo HSE
   - 6 loại huấn luyện (ATVSLĐ nhóm 1-4, T-BOSIET/T-FOET, hoá chất)
   - Phân quyền tích hợp với HSE.renderPage (admin / user / viewer)
   - Lưu localStorage + sync Supabase qua DB.*
   - Ngày huấn luyện gần nhất lưu & hiển thị dạng DD/MM/YYYY
   - Sửa INLINE trực tiếp trên bảng (họ tên, danh số, chức danh, đơn vị, ngày)
   - Kéo–thả (drag) để đổi thứ tự nhân sự; thứ tự lưu localStorage + đồng bộ DB
   ========================================================= */
(function () {
  "use strict";

  /* ──────────────────────────────────────────
     CẤU HÌNH LOẠI HUẤN LUYỆN
  ────────────────────────────────────────── */
  var PAGES = [
    { key: "nhom1",   label: "ATVSLĐ – Nhóm 1",        icon: "1️⃣", sheet: "hl_nhom1",   defaultMonths: 24,
      desc: "Người sử dụng lao động, người đứng đầu đơn vị, cán bộ quản lý" },
    { key: "nhom2",   label: "ATVSLĐ – Nhóm 2",        icon: "2️⃣", sheet: "hl_nhom2",   defaultMonths: 24,
      desc: "Người làm công tác an toàn, vệ sinh lao động" },
    { key: "nhom3",   label: "ATVSLĐ – Nhóm 3",        icon: "3️⃣", sheet: "hl_nhom3",   defaultMonths: 12,
      desc: "Người lao động làm công việc có yêu cầu nghiêm ngặt về ATVSLĐ" },
    { key: "nhom4",   label: "ATVSLĐ – Nhóm 4",        icon: "4️⃣", sheet: "hl_nhom4",   defaultMonths: 24,
      desc: "Người lao động không thuộc nhóm 1, 2, 3" },
    { key: "bosiet_foet", label: "T-BOSIET / T-FOET",   icon: "🚁", sheet: "hl_bosiet_foet", defaultMonths: 48,
      desc: "T-BOSIET (lần đầu) và T-FOET (huấn luyện lại) – offshore emergency training",
      subTypes: ["T-BOSIET", "T-FOET"] },
    { key: "hoachat", label: "An toàn hoá chất",        icon: "⚗️", sheet: "hl_hoachat", defaultMonths: 12,
      desc: "Theo Nghị định 44/2016/NĐ-CP và các quy định hiện hành" },
  ];

  var UNITS = [
    "Ban giám đốc",
    "Phòng Kỹ thuật - Vật tư",
    "Phòng Kinh tế - Tổ chức nhân sự",
    "Phòng Kế toán",
    "Phòng Thương mại - Dịch vụ",
    "Ban Thực hiện hợp đồng",
    "Ban Điều độ sản xuất",
    "Cảng biển",
    "Xưởng sửa chữa",
    "Căn cứ Kho - Giao nhận",
    "Đội xe VTHH&PTTBCD",
    "Đội xe VCHK",
  ];

  /* ──────────────────────────────────────────
     STATE
  ────────────────────────────────────────── */
  var _currentKey  = "nhom1";
  var _editingId   = null;
  var _editingKey  = null;
  var _container   = null;
  var _user        = null;
  var _canEdit     = false;
  var _isAdmin     = false;
  var _dragId      = null;   // id hàng đang kéo
  var _dragUnit    = null;   // đơn vị của hàng đang kéo (chỉ kéo trong cùng đơn vị)
  var _editRowId   = null;   // id hàng đang sửa inline (bấm bút chì)
  var _statusFilter = "all"; // bộ lọc theo cột Trạng thái
  /* Cập nhật khoá đào tạo hàng loạt (wizard) */
  var _batchMode  = false;
  var _batchStep  = 1;       // 1: chọn ngày · 2: chọn nhân viên · 3: xác nhận
  var _batchDate  = "";      // ngày khoá (YYYY-MM-DD)
  var _batchSel   = {};      // { id: true } nhân viên được chọn

  /* ──────────────────────────────────────────
     DỮ LIỆU (localStorage cache + Supabase)
  ────────────────────────────────────────── */
  var LS_NHANSU   = "hl_nhansu";
  var LS_SETTINGS = "hl_settings";
  var LS_ORDER    = "hl_order";     // { key: [id1, id2, ...] } – thứ tự kéo–thả
  var LS_WARN     = "hl_warndays";  // { key: số ngày báo sắp hết hạn }
  var DEFAULT_WARN_DAYS = 60;       // mặc định ~2 tháng

  /* Lấy / ghi toàn bộ danh sách nhân sự (localStorage only) */
  function _getAllData() {
    var arr;
    try { arr = JSON.parse(localStorage.getItem(LS_NHANSU) || "[]"); } catch (e) { arr = []; }
    /* Chuẩn hoá ngày cũ "YYYY-MM" → "YYYY-MM-01" để phần còn lại chỉ xử lý 1 dạng */
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && /^\d{4}-\d{2}$/.test(arr[i].lastDate)) arr[i].lastDate = arr[i].lastDate + "-01";
    }
    return arr;
  }
  function _setAllData(arr) {
    localStorage.setItem(LS_NHANSU, JSON.stringify(arr));
  }

  /* ── Thứ tự kéo–thả (localStorage) ── */
  function _getOrderMap() {
    try { return JSON.parse(localStorage.getItem(LS_ORDER) || "{}"); } catch (e) { return {}; }
  }
  function _setOrderMap(m) {
    localStorage.setItem(LS_ORDER, JSON.stringify(m || {}));
  }
  function _getOrder(key) {
    var m = _getOrderMap();
    return Array.isArray(m[key]) ? m[key] : [];
  }
  function _setOrder(key, ids) {
    var m = _getOrderMap();
    m[key] = ids;
    _setOrderMap(m);
  }

  /* Vị trí đơn vị theo thứ tự droplist (đơn vị lạ → xuống cuối) */
  function _unitIndex(u) { var i = UNITS.indexOf(u); return i < 0 ? UNITS.length + 1 : i; }

  /* Lọc nhân sự theo loại + gom nhóm theo đơn vị (thứ tự droplist),
     trong từng đơn vị xếp theo thứ tự kéo–thả */
  function getData(key) {
    var arr = _getAllData().filter(function (p) { return p.loai_huan_luyen === key; });
    var order = _getOrder(key);
    arr.sort(function (a, b) {
      var ua = _unitIndex(a.unit), ub = _unitIndex(b.unit);
      if (ua !== ub) return ua - ub;                 // gom theo đơn vị trước
      var ia = order.indexOf(a.id); if (ia < 0) ia = Infinity;
      var ib = order.indexOf(b.id); if (ib < 0) ib = Infinity;
      if (ia !== ib) return ia - ib;                 // rồi thứ tự kéo tay trong đơn vị
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
    return arr;
  }

  /* Insert 1 record lên Supabase + localStorage */
  function _insertRecord(record) {
    var all = _getAllData();
    all.push(record);
    _setAllData(all);
    /* Thêm vào cuối thứ tự của loại tương ứng */
    var ord = _getOrder(record.loai_huan_luyen);
    if (ord.indexOf(record.id) < 0) { ord.push(record.id); _setOrder(record.loai_huan_luyen, ord); }
    if (typeof DB !== "undefined" && DB.isReady()) {
      DB.insert("hl_nhansu", record).catch(function () {});
    }
  }

  /* Update 1 record lên Supabase + localStorage.
     LƯU Ý: object record KHÔNG chứa trường "sort" → không đụng schema.  */
  function _updateRecord(record) {
    var all = _getAllData();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === record.id) { all[i] = record; break; }
    }
    _setAllData(all);
    if (typeof DB !== "undefined" && DB.isReady()) {
      DB.update("hl_nhansu", record.id, record).catch(function () {});
    }
  }

  /* Delete 1 record trên Supabase + localStorage */
  function _deleteRecord(id) {
    var rec = _getAllData().filter(function (p) { return p.id === id; })[0];
    _setAllData(_getAllData().filter(function (p) { return p.id !== id; }));
    if (rec) {
      var ord = _getOrder(rec.loai_huan_luyen).filter(function (x) { return x !== id; });
      _setOrder(rec.loai_huan_luyen, ord);
    }
    if (typeof DB !== "undefined" && DB.isReady()) {
      DB.delete("hl_nhansu", id).catch(function () {});
    }
  }

  /* Đồng bộ thứ tự lên DB (best-effort, KHÔNG bắt buộc có cột "sort").
     Gửi riêng patch {sort:i} cho từng record → nếu cột chưa có, chỉ lệnh này
     thất bại (được nuốt lặng), các thao tác ghi khác KHÔNG bị ảnh hưởng.  */
  function _syncOrderToDB(key) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    var ids = _getOrder(key);
    ids.forEach(function (id, i) {
      DB.update("hl_nhansu", id, { sort: i }).catch(function () {});
    });
  }

  /* Settings: lưu dạng object {nhom1:24, ...} trong localStorage */
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}"); } catch (e) { return {}; }
  }
  function saveSettings(s) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    if (typeof DB !== "undefined" && DB.isReady()) {
      var arr = Object.keys(s).map(function (k) { return { loai: k, thoi_han_thang: s[k] }; });
      DB.bulkWrite("hl_settings", arr).catch(function () {});
    }
  }

  function getMonths(key) {
    var s  = getSettings();
    var pg = pageByKey(key);
    return s[key] !== undefined ? parseInt(s[key]) : (pg ? pg.defaultMonths : 12);
  }
  function setMonths(key, val) {
    var s = getSettings();
    s[key] = val;
    saveSettings(s);
  }

  /* Số ngày báo "sắp hết hạn" theo từng mục (localStorage + best-effort DB) */
  function getWarnDays(key) {
    try {
      var m = JSON.parse(localStorage.getItem(LS_WARN) || "{}");
      return (m[key] !== undefined) ? parseInt(m[key]) : DEFAULT_WARN_DAYS;
    } catch (e) { return DEFAULT_WARN_DAYS; }
  }
  function setWarnDays(key, val) {
    var m;
    try { m = JSON.parse(localStorage.getItem(LS_WARN) || "{}"); } catch (e) { m = {}; }
    m[key] = val;
    localStorage.setItem(LS_WARN, JSON.stringify(m));
    if (typeof DB !== "undefined" && DB.isReady()) {
      DB.update("hl_settings", key, { warn_days: val }).catch(function () {});
    }
  }
  function pageByKey(k) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].key === k) return PAGES[i];
    return null;
  }

  /* ── Kiểm tra trùng Danh số / Họ tên (trong cùng 1 nhóm) ── */
  function _norm(s) {
    return String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");
  }
  function _dupCheck(key, pid, name, excludeId) {
    var arr = getData(key), dupPid = null, dupName = null;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (p.id === excludeId) continue;
      if (!dupPid  && pid  && _norm(p.pid)  === _norm(pid))  dupPid  = p;
      if (!dupName && name && _norm(p.name) === _norm(name)) dupName = p;
    }
    return { pid: dupPid, name: dupName };
  }
  /* Trả về true nếu được phép lưu (không trùng, hoặc người dùng đồng ý) */
  function _confirmDup(key, pid, name, excludeId) {
    var d = _dupCheck(key, pid, name, excludeId);
    if (!d.pid && !d.name) return true;
    var msg = "⚠ CẢNH BÁO TRÙNG trong mục này:\n";
    if (d.pid)  msg += "\n• Danh số \"" + pid + "\" đã tồn tại (" + (d.pid.name || "?") + ").";
    if (d.name) msg += "\n• Họ tên \"" + name + "\" đã tồn tại (danh số " + (d.name.pid || "?") + ").";
    msg += "\n\nVẫn tiếp tục lưu?";
    return confirm(msg);
  }

  /* Xây thứ tự từ dữ liệu server (nếu có cột "sort") */
  function _rebuildOrderFromRows() {
    var all = _getAllData();
    var m = _getOrderMap();
    PAGES.forEach(function (pg) {
      var rows = all.filter(function (r) { return r.loai_huan_luyen === pg.key; });
      var hasSort = rows.some(function (r) { return typeof r.sort === "number"; });
      if (!hasSort) return; // giữ thứ tự localStorage nếu server chưa có cột sort
      rows.sort(function (a, b) {
        var sa = typeof a.sort === "number" ? a.sort : Infinity;
        var sb = typeof b.sort === "number" ? b.sort : Infinity;
        return sa - sb;
      });
      m[pg.key] = rows.map(function (r) { return r.id; });
    });
    _setOrderMap(m);
  }

  /* Sync từ Supabase khi tải trang, re-render sau khi có data */
  function syncFromSheets() {
    if (typeof DB === "undefined" || !DB.isReady()) return;

    var p1 = DB.getAll("hl_nhansu").then(function (rows) {
      if (rows && rows.length) _setAllData(rows);
    }).catch(function () {});

    var p2 = DB.getAll("hl_settings").then(function (rows) {
      if (rows && rows.length) {
        var s = {}, w = {};
        rows.forEach(function (r) {
          s[r.loai] = parseInt(r.thoi_han_thang);
          if (r.warn_days !== undefined && r.warn_days !== null) w[r.loai] = parseInt(r.warn_days);
        });
        localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
        if (Object.keys(w).length) localStorage.setItem(LS_WARN, JSON.stringify(w));
      }
    }).catch(function () {});

    Promise.all([p1, p2]).then(function () {
      _rebuildOrderFromRows();
      _renderTabContent(_currentKey);
    }).catch(function () {});
  }

  /* ──────────────────────────────────────────
     RENDER ENTRY POINT
  ────────────────────────────────────────── */
  window.renderHuanLuyen = function (container, user, canEditPage, isAdminUser) {
    _container = container;
    _user      = user;
    _canEdit   = !!canEditPage;
    _isAdmin   = !!isAdminUser;
    syncFromSheets();
    _render();
  };

  function _render() {
    _container.innerHTML = "";
    _container.appendChild(_buildStyles());

    var _pt = document.createElement("div");
    _pt.className = "page-title";
    _pt.style.cssText = "display:flex;align-items:center;gap:9px;margin-bottom:16px;";
    _pt.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg><span>Huấn luyện - Đào tạo</span>';
    _container.appendChild(_pt);

    /* Thanh tra cứu tổng hợp (xuyên suốt 6 nhóm) */
    var gs = document.createElement("div");
    gs.className = "hl-gsearch";
    gs.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
      '<input type="text" id="hl-global-search" placeholder="Tra cứu nhân viên theo tên hoặc danh số — xem tất cả khoá học đã tham gia...">';
    _container.appendChild(gs);

    var tabBar = _buildTabBar();
    _container.appendChild(tabBar);
    var body = document.createElement("div");
    body.id = "hl-body";
    _container.appendChild(body);

    var lookup = document.createElement("div");
    lookup.id = "hl-lookup";
    lookup.style.display = "none";
    _container.appendChild(lookup);

    _renderTabContent(_currentKey);
    _wireModal();

    var gsInput = document.getElementById("hl-global-search");
    gsInput.addEventListener("input", function () {
      var q = this.value.trim();
      if (!q) {
        lookup.style.display = "none"; lookup.innerHTML = "";
        tabBar.style.display = ""; body.style.display = "";
      } else {
        tabBar.style.display = "none"; body.style.display = "none";
        lookup.style.display = "block";
        _renderLookup(q, lookup);
      }
    });
  }

  /* ──────────────────────────────────────────
     TRA CỨU TỔNG HỢP — gom theo danh số, hiện mọi khoá học
  ────────────────────────────────────────── */
  function _renderLookup(q, lookup) {
    var all = _getAllData();
    var qn = _norm(q);

    /* Danh số nào có bản ghi khớp (theo tên hoặc danh số) */
    var matchPids = {};
    all.forEach(function (p) {
      if (_norm(p.pid).indexOf(qn) >= 0 || _norm(p.name).indexOf(qn) >= 0) matchPids[_norm(p.pid)] = true;
    });

    /* Gom toàn bộ khoá học của các danh số khớp */
    var groups = {}, orderKeys = [];
    all.forEach(function (p) {
      var kp = _norm(p.pid);
      if (!matchPids[kp]) return;
      if (!groups[kp]) { groups[kp] = { pid: p.pid, name: p.name, title: p.title, unit: p.unit, courses: [] }; orderKeys.push(kp); }
      groups[kp].courses.push(p);
    });

    if (!orderKeys.length) {
      lookup.innerHTML = '<div class="hl-lk-note">Không tìm thấy nhân viên phù hợp với "' + _esc(q) + '".</div>';
      return;
    }

    /* Sắp xếp nhân viên theo tên */
    orderKeys.sort(function (a, b) { return String(groups[a].name || "").localeCompare(String(groups[b].name || "")); });

    var pgIndex = {};
    PAGES.forEach(function (pg, i) { pgIndex[pg.key] = i; });

    var html = '<div class="hl-lk-note">Tìm thấy <b>' + orderKeys.length + '</b> nhân viên · ' +
      'tổng <b>' + orderKeys.reduce(function (s, k) { return s + groups[k].courses.length; }, 0) + '</b> khoá học.</div>';

    orderKeys.forEach(function (kp) {
      var g = groups[kp];
      /* Sắp khoá theo thứ tự nhóm PAGES */
      g.courses.sort(function (a, b) { return (pgIndex[a.loai_huan_luyen] || 0) - (pgIndex[b.loai_huan_luyen] || 0); });

      var rows = g.courses.map(function (c) {
        var pg = pageByKey(c.loai_huan_luyen);
        var months = getMonths(c.loai_huan_luyen);
        var st = _calcStatus(c.lastDate, months, getWarnDays(c.loai_huan_luyen));
        var nextColor = st === "expired" ? "var(--danger)" : st === "warn" ? "#e68900" : "#1a7a3c";
        return '<tr>' +
          '<td style="font-weight:600;">' + _esc(pg ? pg.label : c.loai_huan_luyen) + '</td>' +
          '<td>' + (c.subType ? '<span class="hl-badge ' + (c.subType === "T-BOSIET" ? "hl-blue" : "hl-gray") + '">' + _esc(c.subType) + '</span>' : '–') + '</td>' +
          '<td>' + _fmtDate(c.lastDate) + '</td>' +
          '<td style="font-weight:600;color:' + nextColor + ';">' + _calcNext(c.lastDate, months) + '</td>' +
          '<td>' + _statusBadge(st, c.lastDate) + '</td>' +
        '</tr>';
      }).join("");

      html +=
        '<div class="hl-lk-card">' +
          '<div class="hl-lk-head">' +
            '<div class="hl-lk-name">' + _esc(g.name) + '</div>' +
            '<div class="hl-lk-meta">Danh số <b>' + _esc(g.pid) + '</b> · ' + _esc(g.title || "–") + ' · ' + _esc(g.unit || "–") + '</div>' +
          '</div>' +
          '<div class="hl-tw"><table><thead><tr>' +
            '<th>Khoá học</th><th>Loại</th><th>Ngày HL gần nhất</th><th>Ngày HL tiếp theo</th><th>Trạng thái</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    });

    lookup.innerHTML = html;
  }

  /* ──────────────────────────────────────────
     STYLE TAG (nội tuyến, phụ thêm style.css)
  ────────────────────────────────────────── */
  function _buildStyles() {
    var s = document.createElement("style");
    s.textContent = [
      /* Thanh tra cứu tổng hợp */
      ".hl-gsearch{position:relative;margin-bottom:16px;}",
      ".hl-gsearch input{width:100%;box-sizing:border-box;padding:11px 14px 11px 40px;",
      "border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--surface);}",
      ".hl-gsearch input:focus{outline:none;border-color:var(--brand-light);box-shadow:0 0 0 3px rgba(37,99,235,.1);}",
      ".hl-gsearch svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text-muted);}",
      ".hl-lk-note{font-size:13px;color:var(--text-muted);margin-bottom:12px;}",
      ".hl-lk-card{background:var(--surface);border-radius:10px;box-shadow:0 1px 3px rgba(16,24,40,.08);",
      "margin-bottom:16px;overflow:hidden;}",
      ".hl-lk-head{padding:12px 18px;background:#f8fafd;border-bottom:1px solid var(--border);}",
      ".hl-lk-name{font-size:15px;font-weight:800;color:var(--brand);}",
      ".hl-lk-meta{font-size:12.5px;color:var(--text-muted);margin-top:2px;}",
      /* Tab bar */
      ".hl-tabs{display:flex;gap:2px;flex-wrap:wrap;background:var(--surface);",
      "border-radius:10px;padding:6px;box-shadow:0 1px 3px rgba(16,24,40,.07);margin-bottom:20px;}",
      ".hl-tab{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:7px;",
      "font-size:13px;font-weight:600;cursor:pointer;border:none;background:transparent;",
      "color:var(--text-muted);transition:.15s;}",
      ".hl-tab:hover{background:var(--bg);}",
      ".hl-tab.active{background:var(--brand);color:#fff;}",
      ".hl-tab .ic{font-size:14px;}",
      /* Card */
      ".hl-card{background:var(--surface);border-radius:10px;",
      "box-shadow:0 1px 3px rgba(16,24,40,.08);margin-bottom:18px;overflow:hidden;}",
      ".hl-card-h{padding:13px 18px;border-bottom:1px solid var(--border);",
      "display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f8fafd;}",
      ".hl-card-title{font-size:13.5px;font-weight:700;color:var(--brand);}",
      ".hl-card-b{padding:18px;}",
      /* Settings row */
      ".hl-set-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}",
      ".hl-set-input{width:80px;padding:6px 10px;border:1.5px solid var(--border);",
      "border-radius:7px;font-size:15px;font-weight:700;text-align:center;",
      "color:var(--brand);background:#fff;}",
      ".hl-set-input:focus{outline:none;border-color:var(--brand-light);}",
      ".hl-set-input:disabled{background:var(--bg);color:var(--text-muted);cursor:not-allowed;}",
      /* Stats */
      ".hl-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));",
      "gap:12px;margin-bottom:18px;}",
      ".hl-stat{background:var(--surface);border-radius:9px;padding:13px 16px;",
      "box-shadow:0 1px 3px rgba(16,24,40,.07);}",
      ".hl-stat.blue{border-left:4px solid var(--brand);}",
      ".hl-stat.green{border-left:4px solid #1a7a3c;}",
      ".hl-stat.orange{border-left:4px solid #e68900;}",
      ".hl-stat.red{border-left:4px solid var(--danger);}",
      ".hl-val{font-size:26px;font-weight:800;color:var(--text);}",
      ".hl-lbl{font-size:11.5px;color:var(--text-muted);margin-top:1px;}",
      ".hl-warn-input{width:50px;padding:1px 4px;border:1px solid #f0c987;border-radius:5px;",
      "font-size:12px;font-weight:800;text-align:center;color:#e68900;background:#fff;vertical-align:middle;}",
      ".hl-warn-input:focus{outline:none;border-color:#e68900;box-shadow:0 0 0 2px rgba(230,137,0,.15);}",
      ".hl-warn-save{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;",
      "margin-left:4px;border:1px solid #f0c987;border-radius:5px;background:#fff;color:#e68900;",
      "cursor:pointer;vertical-align:middle;padding:0;}",
      ".hl-warn-save:hover{background:#e68900;color:#fff;border-color:#e68900;}",
      /* Nút Xuất Excel – xanh lá Excel, in đậm */
      ".hl-btn-excel{background:#217346;color:#fff;font-weight:700;border:1px solid #217346;}",
      ".hl-btn-excel:hover{background:#1a5c38;border-color:#1a5c38;color:#fff;}",
      /* Nút + wizard cập nhật khoá hàng loạt – nổi bật */
      ".hl-btn-batch{background:var(--brand);color:#fff;font-weight:800;border:1px solid var(--brand);",
      "padding:8px 16px;box-shadow:0 2px 6px rgba(37,99,235,.35);letter-spacing:.2px;}",
      ".hl-btn-batch:hover{background:var(--brand-light);border-color:var(--brand-light);color:#fff;",
      "box-shadow:0 3px 10px rgba(37,99,235,.45);}",
      ".hl-batch{border-top:3px solid var(--brand);}",
      ".hl-batch-h{padding:12px 18px;border-bottom:1px solid var(--border);background:#f8fafd;}",
      ".hl-batch-steps{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}",
      ".hl-bstep{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--text-muted);}",
      ".hl-bstep .hl-bnum{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;",
      "border-radius:50%;border:1.5px solid var(--border);font-size:12px;background:#fff;}",
      ".hl-bstep.cur{color:var(--brand);}",
      ".hl-bstep.cur .hl-bnum{border-color:var(--brand);color:var(--brand);}",
      ".hl-bstep.done{color:#1a7a3c;}",
      ".hl-bstep.done .hl-bnum{background:#1a7a3c;border-color:#1a7a3c;color:#fff;}",
      ".hl-bsep{width:24px;height:2px;background:var(--border);}",
      ".hl-batch-b{padding:16px 18px;}",
      ".hl-batch-f{padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;}",
      ".hl-btn-batch-apply{background:var(--brand);color:#fff;font-weight:700;border:none;}",
      ".hl-btn-batch-apply:hover{background:var(--brand-light);color:#fff;}",
      ".hl-btn-batch-apply:disabled{opacity:.6;cursor:not-allowed;}",
      ".hl-batch-date.hl-invalid{border-color:var(--danger);background:#fdedec;}",
      ".hl-bprog{display:flex;align-items:center;gap:10px;}",
      ".hl-bprog-track{flex:1;height:12px;background:var(--border);border-radius:6px;overflow:hidden;max-width:420px;}",
      ".hl-bprog-fill{height:100%;background:var(--brand);width:0;transition:width .1s;}",
      /* Table */
      ".hl-tw{overflow-x:auto;}",
      ".hl-tw table{width:100%;border-collapse:collapse;font-size:13px;}",
      ".hl-tw thead th{background:#dde6f3;color:var(--brand);font-weight:700;",
      "padding:10px 12px;text-align:center;white-space:nowrap;border-bottom:2px solid #b8cde4;}",
      ".hl-tw tbody td{padding:7px 10px;border-bottom:1px solid #eef1f7;vertical-align:middle;text-align:center;}",
      /* Riêng cột Họ và tên căn trái */
      ".hl-tw th.hl-col-name, .hl-tw td.hl-col-name{text-align:left;}",
      /* Ô trùng danh số / họ tên */
      ".hl-tw td.hl-dup{background:#fdecec !important;}",
      ".hl-dup-ic{color:#c0392b;}",
      ".hl-dupwarn{background:#fdedec;color:#c0392b;padding:8px 18px;font-size:12.5px;",
      "font-weight:600;border-bottom:1px solid #f5c6cb;}",
      ".hl-tw tbody tr:hover td{background:#eef3fb;}",
      ".hl-tw tbody tr:last-child td{border-bottom:none;}",
      /* Kẻ dọc ngăn cách giữa các cột */
      ".hl-tw th, .hl-tw td{border-right:1px solid #e4eaf3;}",
      ".hl-tw th:last-child, .hl-tw td:last-child{border-right:none;}",
      /* Hàng đang sửa inline */
      ".hl-tw tbody tr.hl-editing td{background:#fffdf3;}",
      ".hl-tw tbody tr.hl-editing:hover td{background:#fffdf3;}",
      /* Nút icon (bút chì) cho ô thời hạn */
      ".hl-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;",
      "border:1.5px solid var(--border);border-radius:7px;background:#fff;color:var(--brand);cursor:pointer;transition:.12s;}",
      ".hl-icon-btn:hover{background:var(--brand);color:#fff;border-color:var(--brand);}",
      ".hl-icon-btn.active{background:var(--brand);color:#fff;border-color:var(--brand);}",
      /* Inline edit fields */
      ".hl-inline{width:100%;box-sizing:border-box;border:1px solid transparent;",
      "background:transparent;border-radius:6px;padding:5px 7px;font-size:13px;",
      "font-family:inherit;color:var(--text);transition:.12s;}",
      ".hl-inline:hover{border-color:var(--border);background:#fff;}",
      ".hl-inline:focus{outline:none;border-color:var(--brand-light);background:#fff;",
      "box-shadow:0 0 0 2px rgba(37,99,235,.12);}",
      ".hl-inline-sel{cursor:pointer;}",
      ".hl-inline-date{max-width:120px;letter-spacing:.4px;}",
      ".hl-inline.hl-invalid{border-color:var(--danger);background:#fdedec;}",
      ".hl-inline-name{font-weight:600;}",
      /* Drag handle */
      ".hl-handle-cell{width:26px;text-align:center;padding-left:4px!important;padding-right:0!important;}",
      ".hl-handle{cursor:grab;color:var(--text-muted);opacity:.6;display:inline-flex;}",
      ".hl-handle:hover{opacity:1;color:var(--brand);}",
      ".hl-tw tbody tr.hl-dragging{opacity:.4;}",
      ".hl-tw tbody tr.hl-drop-before td{box-shadow:inset 0 2px 0 0 var(--brand);}",
      ".hl-tw tbody tr.hl-drop-after td{box-shadow:inset 0 -2px 0 0 var(--brand);}",
      /* Badges */
      ".hl-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11.5px;font-weight:600;}",
      ".hl-ok{background:#eafaf1;color:#1a7a3c;}",
      ".hl-warn{background:#fef5e4;color:#e68900;}",
      ".hl-exp{background:#fdedec;color:#c0392b;}",
      ".hl-blue{background:#dceaf7;color:var(--brand);}",
      ".hl-gray{background:#f2f3f4;color:var(--text-muted);}",
      /* Form grid */
      ".hl-fg{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:14px;}",
      ".hl-fg .field{margin-bottom:0;}",
      ".hl-fg .field-full{grid-column:1/-1;}",
      /* Toolbar */
      ".hl-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;",
      "border-bottom:1px solid var(--border);background:#f8fafd;}",
      ".hl-search{padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;",
      "font-size:12.5px;width:200px;}",
      ".hl-search:focus{outline:none;border-color:var(--brand-light);}",
      ".hl-stfilter{display:block;margin-top:5px;width:100%;box-sizing:border-box;padding:3px 5px;",
      "font-size:11px;font-weight:600;border:1px solid var(--border);border-radius:5px;",
      "background:#fff;color:var(--text);cursor:pointer;}",
      ".hl-stfilter:focus{outline:none;border-color:var(--brand-light);}",
      ".hl-hint{font-size:11.5px;color:var(--text-muted);font-style:italic;}",
      ".hl-empty td{text-align:center;padding:28px;color:var(--text-muted);font-style:italic;}",
      /* Page header */
      ".hl-ph{display:flex;align-items:flex-start;justify-content:space-between;",
      "margin-bottom:18px;flex-wrap:wrap;gap:10px;}",
      ".hl-pt{font-size:18px;font-weight:700;color:var(--brand);}",
      ".hl-ps{font-size:12.5px;color:var(--text-muted);margin-top:3px;}",
      /* Modal */
      ".hl-modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);",
      "z-index:200;align-items:center;justify-content:center;}",
      ".hl-modal-bg.open{display:flex;}",
      ".hl-modal{background:#fff;border-radius:12px;width:90%;max-width:580px;",
      "box-shadow:0 8px 32px rgba(0,0,0,.2);overflow:hidden;max-height:90vh;overflow-y:auto;}",
      ".hl-mh{padding:15px 20px;background:linear-gradient(135deg,var(--brand),var(--brand-light));",
      "color:#fff;display:flex;align-items:center;justify-content:space-between;}",
      ".hl-mt{font-size:14.5px;font-weight:700;}",
      ".hl-mx{background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;",
      "border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;}",
      ".hl-mx:hover{background:rgba(255,255,255,.3);}",
      ".hl-mb{padding:20px;}",
      ".hl-mf{padding:13px 20px;border-top:1px solid var(--border);",
      "display:flex;gap:10px;justify-content:flex-end;}",
    ].join("");
    return s;
  }

  /* ──────────────────────────────────────────
     TAB BAR
  ────────────────────────────────────────── */
  function _buildTabBar() {
    var wrap = document.createElement("div");
    wrap.className = "hl-tabs";
    PAGES.forEach(function (pg) {
      var btn = document.createElement("button");
      btn.className = "hl-tab" + (pg.key === _currentKey ? " active" : "");
      btn.dataset.key = pg.key;
      btn.textContent = pg.label;
      btn.addEventListener("click", function () {
        _currentKey = pg.key;
        _statusFilter = "all";
        document.querySelectorAll(".hl-tab").forEach(function (t) {
          t.classList.toggle("active", t.dataset.key === pg.key);
        });
        _renderTabContent(pg.key);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  /* ──────────────────────────────────────────
     NỘI DUNG TAB
  ────────────────────────────────────────── */
  function _renderTabContent(key) {
    var body = document.getElementById("hl-body");
    if (!body) return;
    body.innerHTML = "";

    var pg = pageByKey(key);
    var months = getMonths(key);
    var warnDays = getWarnDays(key);
    var data = getData(key);

    /* Tính thống kê */
    var total = data.length, ok = 0, warn = 0, exp = 0;
    data.forEach(function (p) {
      var s = _calcStatus(p.lastDate, months, warnDays);
      if (s === "ok") ok++; else if (s === "warn") warn++; else exp++;
    });

    /* Page header */
    var ph = document.createElement("div");
    ph.className = "hl-ph";
    ph.innerHTML =
      '<div>' +
        '<div class="hl-pt">' + pg.label + '</div>' +
        '<div class="hl-ps">' + pg.desc + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        (_canEdit ? '' : '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">Chế độ xem</span>') +
        (_canEdit && !_batchMode ? '<button class="btn btn-sm hl-btn-batch" id="hl-btn-batch" title="Cập nhật ngày huấn luyện cho nhiều nhân viên"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg> Cập nhật ngày HL</button>' : '') +
        '<button class="btn btn-sm hl-btn-excel" id="hl-btn-export" title="Xuất Excel tất cả 6 nhóm"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg> Xuất Excel</button>' +
      '</div>';
    body.appendChild(ph);

    /* Stats */
    var stats = document.createElement("div");
    stats.className = "hl-stats";
    var warnLbl = 'Sắp hết hạn (≤ ' +
      (_canEdit
        ? '<input type="number" class="hl-warn-input" id="hl-warn-' + key + '" value="' + warnDays + '" min="1" max="365" title="Số ngày báo sắp hết hạn">' +
          '<button class="hl-warn-save" id="hl-warn-save-' + key + '" title="Lưu"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></button>'
        : '<b>' + warnDays + '</b>') +
      ' ngày)';
    stats.innerHTML =
      _stat("blue", total, "Tổng nhân sự") +
      _stat("green", ok, "Còn hiệu lực") +
      _stat("orange", warn, warnLbl) +
      _stat("red", exp, "Đã hết hạn / Chưa có");
    body.appendChild(stats);

    /* Card cài đặt thời hạn – khoá sẵn, bấm bút chì mới sửa được */
    var settCard = document.createElement("div");
    settCard.className = "hl-card";
    settCard.innerHTML =
      '<div class="hl-card-b">' +
        '<div class="hl-set-row">' +
          '<span style="font-size:13.5px;font-weight:600;">Thời hạn huấn luyện lại:</span>' +
          '<input type="number" class="hl-set-input" id="hl-months-' + key + '" ' +
            'value="' + months + '" min="1" max="120" disabled>' +
          (_canEdit ? '<button class="hl-icon-btn" id="hl-months-edit-' + key + '" title="Bấm để sửa"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></button>' : '') +
          '<span style="font-size:13px;color:var(--text-muted);">tháng</span>' +
          '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">– Áp dụng cho toàn bộ nhân sự trong mục này</span>' +
        '</div>' +
      '</div>';
    body.appendChild(settCard);

    /* Wizard cập nhật khoá đào tạo hàng loạt */
    if (_batchMode) body.appendChild(_buildBatchPanel(key));

    /* Card bảng nhân sự */
    var tableCard = document.createElement("div");
    tableCard.className = "hl-card";
    tableCard.innerHTML =
      '<div class="hl-card-h">' +
        '<input type="text" class="hl-search" id="hl-search-' + key + '" placeholder="Tìm kiếm...">' +
      '</div>' +
      '<div id="hl-dupwarn-' + key + '" class="hl-dupwarn" style="display:none"></div>' +
      (_canEdit && !_batchMode ? '<div class="hl-toolbar" style="padding:8px 18px;"><span class="hl-hint">✎ Bấm bút chì ở cột Thao tác để sửa dòng · ⣿ Kéo hàng để đổi thứ tự · ＋ Nhập vào dòng cuối rồi bấm ✓ (hoặc Enter) để thêm nhân sự (khi không tìm kiếm)</span></div>' : '') +
      '<div class="hl-tw"><table><thead><tr>' +
        (_batchMode
          ? '<th style="width:36px;text-align:center"><input type="checkbox" id="hl-cb-all-' + key + '" title="Chọn tất cả đang hiển thị"></th>'
          : (_canEdit ? '<th class="hl-handle-cell"></th>' : '')) +
        '<th style="width:40px;text-align:center">STT</th>' +
        '<th class="hl-col-name">Họ và tên</th>' +
        '<th>Danh số</th>' +
        '<th>Chức danh</th>' +
        '<th>Đơn vị</th>' +
        (pg.subTypes ? '<th>Loại</th>' : '') +
        '<th>Ngày HL gần nhất</th>' +
        '<th>Ngày HL tiếp theo</th>' +
        '<th style="min-width:130px">Trạng thái' +
          '<select class="hl-stfilter" id="hl-stfilter-' + key + '">' +
            '<option value="all">Tất cả</option>' +
            '<option value="ok">Còn hiệu lực</option>' +
            '<option value="warn">Sắp hết hạn</option>' +
            '<option value="expired">Hết hạn</option>' +
          '</select>' +
        '</th>' +
        (_canEdit && !_batchMode ? '<th style="width:96px;text-align:center">Thao tác</th>' : '') +
      '</tr></thead>' +
      '<tbody id="hl-tbody-' + key + '"></tbody>' +
      '</table></div>';
    body.appendChild(tableCard);

    /* Điền dữ liệu vào bảng */
    _fillTable(key);

    /* Wire events */
    var monthsInput = document.getElementById("hl-months-" + key);
    var monthsEdit  = document.getElementById("hl-months-edit-" + key);
    if (monthsInput && _canEdit) {
      /* Lưu + khoá lại */
      var saveMonths = function () {
        var v = parseInt(monthsInput.value);
        if (!isNaN(v) && v >= 1) { setMonths(key, v); }
        else { monthsInput.value = getMonths(key); }
        monthsInput.disabled = true;
        if (monthsEdit) monthsEdit.classList.remove("active");
        _fillTable(key);
      };
      monthsInput.addEventListener("change", saveMonths);
      monthsInput.addEventListener("blur", function () { if (!monthsInput.disabled) saveMonths(); });
      monthsInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); monthsInput.blur(); } });
      if (monthsEdit) {
        monthsEdit.addEventListener("click", function () {
          monthsInput.disabled = false;
          monthsEdit.classList.add("active");
          monthsInput.focus();
          monthsInput.select && monthsInput.select();
        });
      }
    }

    var warnInput = document.getElementById("hl-warn-" + key);
    var warnSave  = document.getElementById("hl-warn-save-" + key);
    if (warnInput && _canEdit) {
      var doSaveWarn = function () {
        var v = parseInt(warnInput.value);
        if (!isNaN(v) && v >= 1) { setWarnDays(key, v); _renderTabContent(key); }
        else { warnInput.value = getWarnDays(key); }
      };
      if (warnSave) warnSave.addEventListener("click", doSaveWarn);
      warnInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doSaveWarn(); } });
    }

    var searchInput = document.getElementById("hl-search-" + key);
    if (searchInput) searchInput.addEventListener("input", function () { _fillTable(key); });

    var stFilter = document.getElementById("hl-stfilter-" + key);
    if (stFilter) {
      stFilter.value = _statusFilter;
      stFilter.addEventListener("change", function () { _statusFilter = this.value; _fillTable(key); });
    }

    var addBtn = document.getElementById("hl-btn-add");
    if (addBtn) addBtn.addEventListener("click", function () { _openModal(key, null); });

    var exportBtn = document.getElementById("hl-btn-export");
    if (exportBtn) exportBtn.addEventListener("click", _exportExcel);

    var batchBtn = document.getElementById("hl-btn-batch");
    if (batchBtn) batchBtn.addEventListener("click", function () {
      _batchMode = true; _batchStep = 1; _batchDate = ""; _batchSel = {};
      _renderTabContent(key);
    });

    _wireBatchPanel(key);

    var cbAll = document.getElementById("hl-cb-all-" + key);
    if (cbAll) cbAll.addEventListener("change", function () {
      var on = this.checked;
      var tbody = document.getElementById("hl-tbody-" + key);
      Array.prototype.forEach.call(tbody.querySelectorAll(".hl-batch-cb"), function (cb) {
        cb.checked = on; _batchSel[cb.getAttribute("data-id")] = on ? true : undefined;
        if (!on) delete _batchSel[cb.getAttribute("data-id")];
      });
      _batchUpdateCount(key);
    });
  }

  /* ──────────────────────────────────────────
     XUẤT EXCEL — 6 nhóm = 6 sheet (SheetJS nạp từ CDN khi cần)
  ────────────────────────────────────────── */
  function _loadXLSX(cb) {
    if (window.XLSX) return cb();
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = function () { cb(); };
    s.onerror = function () { alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại."); };
    document.head.appendChild(s);
  }

  function _nextPlain(lastDate, months) {
    var dt = _nextDateObj(lastDate, months);
    if (!dt) return "";
    return _pad(dt.getDate()) + "/" + _pad(dt.getMonth() + 1) + "/" + dt.getFullYear();
  }
  function _statusText(status, lastDate) {
    if (!lastDate) return "Chưa có dữ liệu";
    return status === "ok" ? "Còn hiệu lực" : status === "warn" ? "Sắp hết hạn" : "Hết hạn";
  }

  function _exportExcel() {
    _loadXLSX(function () {
      var wb = XLSX.utils.book_new();
      PAGES.forEach(function (pg) {
        var months = getMonths(pg.key), warnDays = getWarnDays(pg.key);
        var hasSub = !!pg.subTypes;
        var rows = getData(pg.key);
        var header = ["STT", "Họ tên", "Danh số", "Chức danh", "Đơn vị"];
        if (hasSub) header.push("Loại");
        header = header.concat(["Ngày HL gần nhất", "Ngày HL tiếp theo", "Trạng thái", "Ghi chú"]);
        var aoa = [header];
        rows.forEach(function (p, i) {
          var st = _calcStatus(p.lastDate, months, warnDays);
          var r = [i + 1, p.name || "", p.pid || "", p.title || "", p.unit || ""];
          if (hasSub) r.push(p.subType || "");
          r.push(_toDisplay(p.lastDate) || "", _nextPlain(p.lastDate, months), _statusText(st, p.lastDate), p.note || "");
          aoa.push(r);
        });
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        var nm = pg.label.replace(/[\\\/?*\[\]:]/g, "-").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, nm);
      });
      var t = new Date();
      var fn = "HuanLuyen_HSE_" + t.getFullYear() + _pad(t.getMonth() + 1) + _pad(t.getDate()) + ".xlsx";
      XLSX.writeFile(wb, fn);
    });
  }

  function _stat(cls, val, lbl) {
    return '<div class="hl-stat ' + cls + '">' +
      '<div class="hl-val">' + val + '</div>' +
      '<div class="hl-lbl">' + lbl + '</div>' +
    '</div>';
  }

  /* ──────────────────────────────────────────
     WIZARD — CẬP NHẬT KHOÁ ĐÀO TẠO HÀNG LOẠT
  ────────────────────────────────────────── */
  function _batchSelCount() { return Object.keys(_batchSel).length; }

  function _buildBatchPanel(key) {
    var el = document.createElement("div");
    el.className = "hl-card hl-batch";
    el.id = "hl-batch-panel";

    var steps = [[1, "Chọn ngày"], [2, "Chọn nhân viên"], [3, "Xác nhận & cập nhật"]];
    var stepHtml = steps.map(function (s) {
      var cls = s[0] < _batchStep ? "done" : (s[0] === _batchStep ? "cur" : "todo");
      return '<div class="hl-bstep ' + cls + '"><span class="hl-bnum">' + (s[0] < _batchStep ? "✓" : s[0]) + '</span>' + s[1] + '</div>';
    }).join('<span class="hl-bsep"></span>');

    var body;
    if (_batchStep === 1) {
      body = '<div class="hl-batch-b">' +
        '<label style="font-weight:600;font-size:13.5px;">Ngày huấn luyện của khoá: </label>' +
        '<input class="inp hl-batch-date" id="hl-batch-date" maxlength="10" placeholder="DD/MM/YYYY" value="' + _esc(_toDisplay(_batchDate)) + '" autocomplete="off" style="width:150px;letter-spacing:1px;">' +
        '<div class="hl-hint" style="margin-top:6px;">Ngày này sẽ được đặt làm “Ngày HL gần nhất” cho các nhân viên bạn chọn.</div>' +
      '</div>';
    } else if (_batchStep === 2) {
      body = '<div class="hl-batch-b">' +
        '<div style="font-size:13.5px;">Tick chọn nhân viên tham gia khoá ở <b>cột đầu của bảng bên dưới</b>. Đã chọn: <b id="hl-batch-count">' + _batchSelCount() + '</b> nhân viên.</div>' +
        '<div class="hl-hint" style="margin-top:4px;">Mẹo: dùng ô tìm kiếm / bộ lọc trạng thái rồi tick ô ở tiêu đề để chọn nhanh cả nhóm đang hiển thị.</div>' +
      '</div>';
    } else {
      body = '<div class="hl-batch-b">' +
        '<div style="font-size:13.5px;">Sẽ đặt <b>Ngày HL gần nhất = ' + _esc(_toDisplay(_batchDate)) + '</b> cho <b>' + _batchSelCount() + '</b> nhân viên đã chọn.</div>' +
        '<div class="hl-bprog" style="margin-top:12px;"><div class="hl-bprog-track"><div class="hl-bprog-fill" id="hl-batch-bar"></div></div><span id="hl-batch-pct" class="hl-hint"></span></div>' +
      '</div>';
    }

    var footer = '<div class="hl-batch-f">' +
      '<button class="btn btn-ghost btn-sm" id="hl-batch-cancel">Huỷ</button>' +
      (_batchStep > 1 ? '<button class="btn btn-ghost btn-sm" id="hl-batch-back">← Quay lại</button>' : '') +
      (_batchStep < 3
        ? '<button class="btn btn-accent btn-sm" id="hl-batch-next">Tiếp theo →</button>'
        : '<button class="btn btn-sm hl-btn-batch-apply" id="hl-batch-apply">✓ Cập nhật khoá đào tạo</button>') +
    '</div>';

    el.innerHTML = '<div class="hl-batch-h"><div class="hl-batch-steps">' + stepHtml + '</div></div>' + body + footer;
    return el;
  }

  function _wireBatchPanel(key) {
    if (!_batchMode) return;
    var cancel = document.getElementById("hl-batch-cancel");
    if (cancel) cancel.addEventListener("click", function () { _batchExit(key); });
    var back = document.getElementById("hl-batch-back");
    if (back) back.addEventListener("click", function () { if (_batchStep > 1) { _batchStep--; _renderTabContent(key); } });
    var next = document.getElementById("hl-batch-next");
    if (next) next.addEventListener("click", function () { _batchNext(key); });
    var apply = document.getElementById("hl-batch-apply");
    if (apply) apply.addEventListener("click", function () { _batchApply(key); });
    var dateEl = document.getElementById("hl-batch-date");
    if (dateEl) {
      dateEl.addEventListener("input", function () { this.value = _fmtDMYInput(this.value); this.classList.remove("hl-invalid"); });
      dateEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); _batchNext(key); } });
      setTimeout(function () { dateEl.focus(); }, 50);
    }
  }

  function _batchUpdateCount(key) {
    var c = document.getElementById("hl-batch-count");
    if (c) c.textContent = _batchSelCount();
    /* Đồng bộ trạng thái ô "chọn tất cả" */
    var cbAll = document.getElementById("hl-cb-all-" + key);
    var tbody = document.getElementById("hl-tbody-" + key);
    if (cbAll && tbody) {
      var all = tbody.querySelectorAll(".hl-batch-cb");
      var checked = tbody.querySelectorAll(".hl-batch-cb:checked");
      cbAll.checked = all.length > 0 && all.length === checked.length;
    }
  }

  function _batchNext(key) {
    if (_batchStep === 1) {
      var dateEl = document.getElementById("hl-batch-date");
      var stored = _toStorage(dateEl ? dateEl.value : "");
      if (!stored) { if (dateEl) dateEl.classList.add("hl-invalid"); alert("Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY."); return; }
      _batchDate = stored; _batchStep = 2; _renderTabContent(key); return;
    }
    if (_batchStep === 2) {
      if (_batchSelCount() === 0) { alert("Vui lòng chọn ít nhất 1 nhân viên tham gia khoá."); return; }
      _batchStep = 3; _renderTabContent(key); return;
    }
  }

  function _batchExit(key) {
    _batchMode = false; _batchStep = 1; _batchDate = ""; _batchSel = {};
    _renderTabContent(key);
  }

  function _batchApply(key) {
    var ids = Object.keys(_batchSel);
    if (!ids.length || !_batchDate) return;
    var all = _getAllData();
    var bar = document.getElementById("hl-batch-bar");
    var pct = document.getElementById("hl-batch-pct");
    var applyBtn = document.getElementById("hl-batch-apply");
    if (applyBtn) applyBtn.disabled = true;
    var total = ids.length, i = 0, delay = Math.max(8, Math.round(500 / total));
    function step() {
      if (i < total) {
        var r = all.filter(function (p) { return p.id === ids[i]; })[0];
        if (r) r.lastDate = _batchDate;
        i++;
        var p = Math.round(i / total * 100);
        if (bar) bar.style.width = p + "%";
        if (pct) pct.textContent = p + "% (" + i + "/" + total + ")";
        setTimeout(step, delay);
      } else {
        _setAllData(all);
        if (typeof DB !== "undefined" && DB.isReady()) {
          ids.forEach(function (id) {
            var r = all.filter(function (p) { return p.id === id; })[0];
            if (r) DB.update("hl_nhansu", id, r).catch(function () {});
          });
        }
        var done = total, dt = _toDisplay(_batchDate);
        setTimeout(function () {
          alert("Đã cập nhật “Ngày HL gần nhất” = " + dt + " cho " + done + " nhân viên.");
          _batchExit(key);
        }, 150);
      }
    }
    step();
  }

  /* ──────────────────────────────────────────
     FILL TABLE
  ────────────────────────────────────────── */
  function _fillTable(key) {
    var tbody = document.getElementById("hl-tbody-" + key);
    if (!tbody) return;
    var searchEl = document.getElementById("hl-search-" + key);
    var q = searchEl ? searchEl.value.toLowerCase() : "";
    var data = getData(key);
    var months = getMonths(key);
    var warnDays = getWarnDays(key);

    /* Đếm trùng danh số / họ tên trong cả nhóm */
    var pidCounts = {}, nameCounts = {};
    data.forEach(function (p) {
      var kp = _norm(p.pid);  if (kp) pidCounts[kp]  = (pidCounts[kp]  || 0) + 1;
      var kn = _norm(p.name); if (kn) nameCounts[kn] = (nameCounts[kn] || 0) + 1;
    });
    var dupPidGroups  = Object.keys(pidCounts).filter(function (k) { return pidCounts[k]  > 1; }).length;
    var dupNameGroups = Object.keys(nameCounts).filter(function (k) { return nameCounts[k] > 1; }).length;

    /* Cập nhật thanh cảnh báo trùng phía trên bảng */
    var dw = document.getElementById("hl-dupwarn-" + key);
    if (dw) {
      if (dupPidGroups || dupNameGroups) {
        var parts = [];
        if (dupPidGroups)  parts.push(dupPidGroups + " danh số trùng");
        if (dupNameGroups) parts.push(dupNameGroups + " họ tên trùng");
        dw.style.display = "block";
        dw.innerHTML = "⚠ Phát hiện " + parts.join(" và ") + " trong mục này — các ô bị bôi đỏ bên dưới.";
      } else {
        dw.style.display = "none";
        dw.innerHTML = "";
      }
    }

    var filtered = data.filter(function (p) {
      var textOk = !q ||
        (p.name  || "").toLowerCase().indexOf(q) >= 0 ||
        (p.pid   || "").toLowerCase().indexOf(q) >= 0 ||
        (p.unit  || "").toLowerCase().indexOf(q) >= 0 ||
        (p.title || "").toLowerCase().indexOf(q) >= 0;
      if (!textOk) return false;
      if (_statusFilter === "all") return true;
      var sk = p.lastDate ? _calcStatus(p.lastDate, months, warnDays) : "nodata";
      return sk === _statusFilter;
    });

    var pg = pageByKey(key);
    var hasSubTypes = !!(pg && pg.subTypes);
    var colCount = 8 + (hasSubTypes ? 1 : 0) + (_batchMode ? 1 : (_canEdit ? 2 : 0));
    var dragOn = _canEdit && !q && !_batchMode; // chỉ kéo–thả khi không lọc/không cập nhật hàng loạt

    var rowsHtml = !filtered.length
      ? '<tr class="hl-empty"><td colspan="' + colCount + '">' +
          (data.length ? "Không tìm thấy nhân sự phù hợp." : "Chưa có nhân sự nào. Nhập vào dòng bên dưới để thêm.") +
        '</td></tr>'
      : filtered.map(function (p, i) {
      var status    = _calcStatus(p.lastDate, months, warnDays);
      var nextLabel = _calcNext(p.lastDate, months);
      var nextColor = status === "expired" ? "var(--danger)" : status === "warn" ? "#e68900" : "#1a7a3c";
      var id = _esc(p.id);

      var editing = _canEdit && !_batchMode && (p.id === _editRowId);

      var handleCell = _batchMode
        ? '<td style="text-align:center"><input type="checkbox" class="hl-batch-cb" data-id="' + id + '"' + (_batchSel[p.id] ? ' checked' : '') + '></td>'
        : (_canEdit ? '<td class="hl-handle-cell">' + (dragOn && !editing ? _gripSVG(id) : "") + '</td>' : "");

      /* Ô Loại (subType) */
      var subTypeCell = "";
      if (hasSubTypes) {
        subTypeCell = editing
          ? '<td>' + _selCell(id, "subType", p.subType, [
                { v: "T-BOSIET", t: "T-BOSIET" }, { v: "T-FOET", t: "T-FOET" }
              ], "-- Chọn --") + '</td>'
          : '<td><span class="hl-badge ' + (p.subType === "T-BOSIET" ? "hl-blue" : "hl-gray") + '">' + _esc(p.subType || "–") + '</span></td>';
      }

      /* Các ô — mặc định chỉ xem; chỉ hiện input khi hàng đang được sửa */
      var nameCell, pidCell, titleCell, unitCell, lastCell;
      if (editing) {
        nameCell  = '<td class="hl-col-name">' + _inpCell(id, "name",  p.name,  "hl-inline-name", "Họ và tên") + '</td>';
        pidCell   = '<td>' + _inpCell(id, "pid",   p.pid,   "", "Danh số") + '</td>';
        titleCell = '<td>' + _inpCell(id, "title", p.title, "", "Chức danh") + '</td>';
        unitCell  = '<td>' + _selCell(id, "unit",  p.unit, UNITS.map(function (u) { return { v: u, t: u }; }), "-- Chọn đơn vị --") + '</td>';
        lastCell  = '<td><input class="hl-inline hl-inline-date" data-id="' + id + '" data-field="lastDate" ' +
                      'maxlength="10" placeholder="DD/MM/YYYY" value="' + _esc(_toDisplay(p.lastDate)) + '" autocomplete="off"></td>';
      } else {
        var dupName = nameCounts[_norm(p.name)] > 1;
        var dupPid  = pidCounts[_norm(p.pid)]  > 1;
        nameCell  = '<td class="hl-col-name' + (dupName ? ' hl-dup' : '') + '" style="font-weight:600;"' + (dupName ? ' title="Trùng họ tên"' : '') + '>' + _esc(p.name) + (dupName ? ' <span class="hl-dup-ic">⚠</span>' : '') + '</td>';
        pidCell   = '<td' + (dupPid ? ' class="hl-dup" title="Trùng danh số"' : '') + '><span class="hl-badge ' + (dupPid ? 'hl-exp' : 'hl-blue') + '">' + _esc(p.pid) + (dupPid ? ' ⚠' : '') + '</span></td>';
        titleCell = '<td>' + _esc(p.title || "–") + '</td>';
        unitCell  = '<td style="font-size:12.5px;">' + _esc(p.unit) + '</td>';
        lastCell  = '<td>' + _fmtDate(p.lastDate) + '</td>';
      }

      /* Cột Thao tác: bút chì (sửa) + xoá; khi đang sửa → lưu (✓) + huỷ (✗) */
      var editBtn = '<button class="btn btn-ghost btn-sm" style="margin-right:3px" data-act="edit" data-id="' + id + '" data-k="' + key + '" title="Sửa"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></button>';
      var delBtn  = '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + id + '" data-k="' + key + '" title="Xoá"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      var saveBtn = '<button class="btn btn-accent btn-sm" style="margin-right:3px" data-act="save" data-id="' + id + '" data-k="' + key + '" title="Lưu"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></button>';
      var cancelBtn = '<button class="btn btn-ghost btn-sm" data-act="cancel" data-k="' + key + '" title="Huỷ"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>';
      var actCell = (_canEdit && !_batchMode)
        ? '<td style="text-align:center;white-space:nowrap;">' + (editing ? (saveBtn + cancelBtn) : (editBtn + delBtn)) + '</td>'
        : "";

      return '<tr data-row-id="' + id + '"' + (editing ? ' class="hl-editing"' : '') + '>' +
        handleCell +
        '<td style="text-align:center;color:var(--text-muted);font-size:12px;">' + (i + 1) + '</td>' +
        nameCell + pidCell + titleCell + unitCell +
        subTypeCell +
        lastCell +
        '<td style="font-weight:600;color:' + nextColor + ';">' + nextLabel + '</td>' +
        '<td>' + _statusBadge(status, p.lastDate) + '</td>' +
        actCell +
      '</tr>';
    }).join("");

    /* Dòng thêm mới inline ở cuối bảng (khi có quyền & không đang tìm kiếm & không cập nhật hàng loạt) */
    if (_canEdit && !q && !_batchMode) rowsHtml += _buildAddRow(key, hasSubTypes);

    tbody.innerHTML = rowsHtml;

    /* Wire nút Thao tác: xoá / sửa / lưu / huỷ */
    Array.prototype.forEach.call(tbody.querySelectorAll("button[data-act]"), function (btn) {
      var act = btn.getAttribute("data-act");
      if (act === "addrow") return; // dòng thêm mới xử lý riêng
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var k  = btn.getAttribute("data-k");
        if (act === "del")         _deletePerson(k, id);
        else if (act === "edit")   { _editRowId = id; _fillTable(k); _focusFirstEdit(k); }
        else if (act === "cancel") { _editRowId = null; _fillTable(k); }
        else if (act === "save")   _commitRowEdit(k, id);
      });
    });

    if (_batchMode) {
      Array.prototype.forEach.call(tbody.querySelectorAll(".hl-batch-cb"), function (cb) {
        cb.addEventListener("change", function () {
          var pid = this.getAttribute("data-id");
          if (this.checked) _batchSel[pid] = true; else delete _batchSel[pid];
          _batchUpdateCount(key);
        });
      });
    } else if (_canEdit) {
      _wireInlineEdit(tbody, key);
      if (dragOn) _wireDrag(tbody, key);
      _wireAddRow(tbody, key);
    }
  }

  function _focusFirstEdit(key) {
    var tbody = document.getElementById("hl-tbody-" + key);
    if (!tbody) return;
    var el = tbody.querySelector("tr.hl-editing .hl-inline[data-field='name']");
    if (el) { el.focus(); el.select && el.select(); }
  }

  /* Lưu 1 hàng đang sửa inline */
  function _commitRowEdit(key, id) {
    var tbody = document.getElementById("hl-tbody-" + key);
    var row = tbody ? tbody.querySelector("tr.hl-editing[data-row-id='" + id + "']") : null;
    if (!row) return;
    function val(f) { var el = row.querySelector(".hl-inline[data-field='" + f + "']"); return el ? (el.value || "").trim() : undefined; }

    var all = _getAllData();
    var rec = null;
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) { rec = all[i]; break; } }
    if (!rec) { _editRowId = null; _fillTable(key); return; }

    var name = val("name"), pid = val("pid"), title = val("title"), unit = val("unit");
    var pg = pageByKey(key), needSub = !!(pg && pg.subTypes);
    var subType = val("subType");
    var dateRaw = val("lastDate");
    var lastDate = _toStorage(dateRaw);

    if (dateRaw && !lastDate) {
      var d = row.querySelector(".hl-inline-date");
      if (d) d.classList.add("hl-invalid");
      alert("Ngày không hợp lệ. Nhập theo định dạng DD/MM/YYYY, ví dụ: 15/04/2025");
      return;
    }
    if (!name || !pid || !title || !unit || !lastDate || (needSub && !subType)) {
      alert("Vui lòng điền đủ: Họ tên, Danh số, Chức danh, Đơn vị, Ngày (DD/MM/YYYY)" + (needSub ? ", Loại" : "") + ".");
      return;
    }
    if (!_confirmDup(key, pid, name, id)) return;

    rec.name = name; rec.pid = pid; rec.title = title; rec.unit = unit; rec.lastDate = lastDate;
    if (needSub) rec.subType = subType;
    _updateRecord(rec);
    _editRowId = null;
    _fillTable(key);
  }

  /* ──────────────────────────────────────────
     DÒNG THÊM MỚI INLINE
  ────────────────────────────────────────── */
  function _newInp(field, extraCls, ph) {
    return '<input class="hl-inline hl-new ' + (extraCls || "") + '" data-field="' + field + '" ' +
      'placeholder="' + _esc(ph || "") + '" autocomplete="off">';
  }
  function _newSel(field, opts, placeholder) {
    var o = '<option value="">' + _esc(placeholder || "-- Chọn --") + '</option>';
    o += opts.map(function (op) {
      return '<option value="' + _esc(op.v) + '">' + _esc(op.t) + '</option>';
    }).join("");
    return '<select class="hl-inline hl-inline-sel hl-new" data-field="' + field + '">' + o + '</select>';
  }

  function _buildAddRow(key, hasSubTypes) {
    var sub = hasSubTypes
      ? '<td>' + _newSel("subType", [{ v: "T-BOSIET", t: "T-BOSIET" }, { v: "T-FOET", t: "T-FOET" }], "-- Loại --") + '</td>'
      : "";
    return '<tr class="hl-addrow">' +
      '<td class="hl-handle-cell" style="text-align:center;color:var(--brand);font-weight:800;">＋</td>' +
      '<td style="text-align:center;color:var(--brand);font-size:11px;font-weight:600;">Mới</td>' +
      '<td class="hl-col-name">' + _newInp("name",  "hl-inline-name", "Họ và tên") + '</td>' +
      '<td>' + _newInp("pid",   "", "Danh số") + '</td>' +
      '<td>' + _newInp("title", "", "Chức danh") + '</td>' +
      '<td>' + _newSel("unit", UNITS.map(function (u) { return { v: u, t: u }; }), "-- Đơn vị --") + '</td>' +
      sub +
      '<td><input class="hl-inline hl-inline-date hl-new" data-field="lastDate" maxlength="10" placeholder="DD/MM/YYYY" autocomplete="off"></td>' +
      '<td style="color:var(--text-muted)">–</td>' +
      '<td style="color:var(--text-muted)">–</td>' +
      '<td style="text-align:center;"><button class="btn btn-accent btn-sm" data-act="addrow" data-k="' + key + '" title="Thêm nhân sự"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></button></td>' +
    '</tr>';
  }

  function _wireAddRow(tbody, key) {
    var row = tbody.querySelector(".hl-addrow");
    if (!row) return;
    /* Auto-format ngày + Enter để thêm nhanh */
    Array.prototype.forEach.call(row.querySelectorAll(".hl-inline-date.hl-new"), function (el) {
      el.addEventListener("input", function () { this.value = _fmtDMYInput(this.value); this.classList.remove("hl-invalid"); });
    });
    Array.prototype.forEach.call(row.querySelectorAll("input.hl-new"), function (el) {
      el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); _commitAddRow(key); } });
    });
    var btn = row.querySelector("button[data-act='addrow']");
    if (btn) btn.addEventListener("click", function () { _commitAddRow(key); });
  }

  function _commitAddRow(key) {
    var tbody = document.getElementById("hl-tbody-" + key);
    var row = tbody ? tbody.querySelector(".hl-addrow") : null;
    if (!row) return;
    function val(f) { var el = row.querySelector("[data-field='" + f + "']"); return el ? (el.value || "").trim() : ""; }

    var name = val("name"), pid = val("pid"), title = val("title"), unit = val("unit");
    var pg = pageByKey(key), needSub = !!(pg && pg.subTypes);
    var subType = val("subType");
    var dateRaw = val("lastDate");
    var lastDate = _toStorage(dateRaw);

    if (dateRaw && !lastDate) {
      var d = row.querySelector(".hl-inline-date");
      if (d) d.classList.add("hl-invalid");
      alert("Ngày không hợp lệ. Nhập theo định dạng DD/MM/YYYY, ví dụ: 15/04/2025");
      return;
    }
    if (!name || !pid || !title || !unit || !lastDate || (needSub && !subType)) {
      alert("Vui lòng điền đủ: Họ tên, Danh số, Chức danh, Đơn vị, Ngày (DD/MM/YYYY)" + (needSub ? ", Loại" : "") + ".");
      return;
    }
    if (!_confirmDup(key, pid, name, null)) return;

    var record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      createdAt: new Date().toISOString(),
      name: name, pid: pid, title: title, unit: unit, lastDate: lastDate, note: "",
      loai_huan_luyen: key
    };
    if (needSub) record.subType = subType;
    _insertRecord(record);
    _renderTabContent(key);
  }

  /* Ô input inline */
  function _inpCell(id, field, val, extraCls, ph) {
    return '<input class="hl-inline ' + extraCls + '" data-id="' + id + '" data-field="' + field + '" ' +
      'value="' + _esc(val || "") + '" placeholder="' + _esc(ph || "") + '" autocomplete="off">';
  }
  /* Ô select inline */
  function _selCell(id, field, val, opts, placeholder) {
    var o = '<option value="">' + _esc(placeholder || "-- Chọn --") + '</option>';
    o += opts.map(function (op) {
      return '<option value="' + _esc(op.v) + '"' + (op.v === val ? " selected" : "") + '>' + _esc(op.t) + '</option>';
    }).join("");
    return '<select class="hl-inline hl-inline-sel" data-id="' + id + '" data-field="' + field + '">' + o + '</select>';
  }

  /* ──────────────────────────────────────────
     INLINE EDIT — hàng đang sửa (bấm bút chì); lưu bằng nút ✓ hoặc Enter
  ────────────────────────────────────────── */
  function _wireInlineEdit(tbody, key) {
    /* Ô ngày: auto-format DD/MM/YYYY khi gõ (bỏ qua dòng thêm mới) */
    Array.prototype.forEach.call(tbody.querySelectorAll("tr.hl-editing .hl-inline-date"), function (el) {
      el.addEventListener("input", function () { this.value = _fmtDMYInput(this.value); this.classList.remove("hl-invalid"); });
    });

    /* Enter trong hàng đang sửa → lưu hàng */
    Array.prototype.forEach.call(tbody.querySelectorAll("tr.hl-editing input.hl-inline"), function (el) {
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var tr = this.closest("tr");
          if (tr) _commitRowEdit(key, tr.getAttribute("data-row-id"));
        }
      });
    });
  }

  /* ──────────────────────────────────────────
     DRAG & DROP — đổi thứ tự
  ────────────────────────────────────────── */
  function _wireDrag(tbody, key) {
    /* Chỉ tay cầm (grip) mới kéo được → không cản trở việc bôi/sửa text trong ô */
    var handles = tbody.querySelectorAll(".hl-handle[draggable='true']");
    Array.prototype.forEach.call(handles, function (h) {
      h.addEventListener("dragstart", function (e) {
        _dragId = h.getAttribute("data-drag-id");
        var rec = _getAllData().filter(function (p) { return p.id === _dragId; })[0];
        _dragUnit = rec ? rec.unit : null;
        var tr = h.closest("tr");
        if (tr) tr.classList.add("hl-dragging");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", _dragId); } catch (ex) {}
      });
      h.addEventListener("dragend", function () {
        _dragId = null; _dragUnit = null;
        Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (r) {
          r.classList.remove("hl-dragging", "hl-drop-before", "hl-drop-after");
        });
      });
    });

    var rows = tbody.querySelectorAll("tr[data-row-id]");
    Array.prototype.forEach.call(rows, function (row) {
      row.addEventListener("dragover", function (e) {
        if (!_dragId) return;
        e.preventDefault();
        /* Chỉ cho thả trong cùng đơn vị */
        if (_rowUnit(row) !== _dragUnit) {
          try { e.dataTransfer.dropEffect = "none"; } catch (ex) {}
          row.classList.remove("hl-drop-before", "hl-drop-after");
          return;
        }
        try { e.dataTransfer.dropEffect = "move"; } catch (ex) {}
        var after = _isAfter(row, e.clientY);
        row.classList.toggle("hl-drop-after", after);
        row.classList.toggle("hl-drop-before", !after);
      });
      row.addEventListener("dragleave", function () {
        row.classList.remove("hl-drop-before", "hl-drop-after");
      });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        var targetId = row.getAttribute("data-row-id");
        var after = _isAfter(row, e.clientY);
        row.classList.remove("hl-drop-before", "hl-drop-after");
        if (_dragId && targetId && _dragId !== targetId) {
          _reorder(key, _dragId, targetId, after);
        }
      });
    });
  }

  function _isAfter(row, clientY) {
    var r = row.getBoundingClientRect();
    return clientY > r.top + r.height / 2;
  }

  /* Đơn vị của 1 hàng (theo id) */
  function _rowUnit(row) {
    var id = row.getAttribute("data-row-id");
    var rec = _getAllData().filter(function (p) { return p.id === id; })[0];
    return rec ? rec.unit : null;
  }

  function _reorder(key, dragId, targetId, after) {
    var all = _getAllData();
    var dr = all.filter(function (p) { return p.id === dragId; })[0];
    var tg = all.filter(function (p) { return p.id === targetId; })[0];
    if (!dr || !tg) return;
    if (dr.unit !== tg.unit) return; // chỉ đổi thứ tự trong cùng đơn vị
    var ids = getData(key).map(function (p) { return p.id; }); // thứ tự hiển thị hiện tại
    var from = ids.indexOf(dragId);
    if (from < 0) return;
    ids.splice(from, 1);
    var to = ids.indexOf(targetId);
    if (to < 0) to = ids.length - 1;
    ids.splice(after ? to + 1 : to, 0, dragId);
    _setOrder(key, ids);
    _syncOrderToDB(key);
    _fillTable(key);
  }

  function _gripSVG(id) {
    return '<span class="hl-handle" draggable="true" data-drag-id="' + id + '" title="Kéo để đổi thứ tự"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>' +
      '<circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>' +
      '<circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>';
  }

  /* ──────────────────────────────────────────
     MODAL THÊM (dùng cho thêm mới; sửa có thể làm inline)
  ────────────────────────────────────────── */
  function _wireModal() {
    var existing = document.getElementById("hl-modal-bg");
    if (existing) existing.remove();

    var bg = document.createElement("div");
    bg.className = "hl-modal-bg";
    bg.id = "hl-modal-bg";
    bg.innerHTML =
      '<div class="hl-modal">' +
        '<div class="hl-mh">' +
          '<span class="hl-mt" id="hl-modal-title">Thêm nhân sự</span>' +
          '<button class="hl-mx" id="hl-modal-close"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
        '</div>' +
        '<div class="hl-mb">' +
          '<div class="hl-fg">' +
            '<div class="field field-full" style="grid-column:1/-1">' +
              '<label>Họ và tên <span style="color:var(--danger)">*</span></label>' +
              '<input class="inp" id="hl-f-name" style="width:100%" placeholder="Nguyễn Văn A">' +
            '</div>' +
            '<div class="field">' +
              '<label>Danh số <span style="color:var(--danger)">*</span></label>' +
              '<input class="inp" id="hl-f-pid" style="width:100%">' +
            '</div>' +
            '<div class="field">' +
              '<label>Chức danh <span style="color:var(--danger)">*</span></label>' +
              '<input class="inp" id="hl-f-title" style="width:100%">' +
            '</div>' +
            '<div class="field" id="hl-f-subtype-wrap" style="display:none;grid-column:1/-1">' +
              '<label>Loại <span style="color:var(--danger)">*</span></label>' +
              '<select class="inp" id="hl-f-subtype" style="width:100%">' +
                '<option value="">-- Chọn loại --</option>' +
                '<option value="T-BOSIET">T-BOSIET (lần đầu)</option>' +
                '<option value="T-FOET">T-FOET (huấn luyện lại)</option>' +
              '</select>' +
            '</div>' +
            '<div class="field" style="grid-column:1/-1">' +
              '<label>Đơn vị <span style="color:var(--danger)">*</span></label>' +
              '<select class="inp" id="hl-f-unit" style="width:100%">' +
                '<option value="">-- Chọn đơn vị --</option>' +
                UNITS.map(function (u) { return '<option>' + _esc(u) + '</option>'; }).join("") +
              '</select>' +
            '</div>' +
            '<div class="field" style="grid-column:1/-1">' +
              '<label>Thời gian huấn luyện gần nhất <span style="color:var(--danger)">*</span></label>' +
              '<input class="inp" id="hl-f-lastdate" maxlength="10" placeholder="DD/MM/YYYY" ' +
                'style="width:150px;letter-spacing:1px;" autocomplete="off">' +
              '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">Nhập theo định dạng DD/MM/YYYY, ví dụ: 15/04/2025</div>' +
            '</div>' +
            '<div class="field" style="grid-column:1/-1">' +
              '<label>Ghi chú</label>' +
              '<input class="inp" id="hl-f-note" style="width:100%" placeholder="Ghi chú thêm (nếu có)">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hl-mf">' +
          '<button class="btn btn-ghost" id="hl-modal-cancel">Huỷ</button>' +
          '<button class="btn btn-accent" id="hl-modal-save"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Lưu</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);

    document.getElementById("hl-modal-close").addEventListener("click", _closeModal);
    document.getElementById("hl-modal-cancel").addEventListener("click", _closeModal);
    bg.addEventListener("click", function (e) { if (e.target === bg) _closeModal(); });
    document.getElementById("hl-modal-save").addEventListener("click", _savePerson);

    /* Auto-format DD/MM/YYYY khi gõ */
    document.getElementById("hl-f-lastdate").addEventListener("input", function () {
      this.value = _fmtDMYInput(this.value);
    });
  }

  function _openModal(key, id) {
    _editingKey = key;
    _editingId  = id;
    var pg = pageByKey(key);
    var isEdit = !!id;
    document.getElementById("hl-modal-title").textContent =
      (isEdit ? "✏️ Chỉnh sửa nhân sự" : "➕ Thêm nhân sự") + " – " + pg.label;

    var subTypeWrap = document.getElementById("hl-f-subtype-wrap");
    if (subTypeWrap) subTypeWrap.style.display = pg.subTypes ? "block" : "none";

    if (isEdit) {
      var p = (getData(key).filter(function (x) { return x.id === id; })[0]) || {};
      document.getElementById("hl-f-name").value     = p.name     || "";
      document.getElementById("hl-f-pid").value      = p.pid      || "";
      document.getElementById("hl-f-title").value    = p.title    || "";
      document.getElementById("hl-f-unit").value     = p.unit     || "";
      document.getElementById("hl-f-lastdate").value = _toDisplay(p.lastDate);
      document.getElementById("hl-f-note").value     = p.note     || "";
      document.getElementById("hl-f-subtype").value  = p.subType  || "";
    } else {
      document.getElementById("hl-f-name").value     = "";
      document.getElementById("hl-f-pid").value      = "";
      document.getElementById("hl-f-title").value    = "";
      document.getElementById("hl-f-unit").value     = "";
      document.getElementById("hl-f-lastdate").value = "";
      document.getElementById("hl-f-note").value     = "";
      document.getElementById("hl-f-subtype").value  = "";
    }

    document.getElementById("hl-modal-bg").classList.add("open");
    setTimeout(function () { document.getElementById("hl-f-name").focus(); }, 80);
  }

  function _closeModal() {
    var bg = document.getElementById("hl-modal-bg");
    if (bg) bg.classList.remove("open");
  }

  function _savePerson() {
    var name     = (document.getElementById("hl-f-name").value     || "").trim();
    var pid      = (document.getElementById("hl-f-pid").value      || "").trim();
    var title    = (document.getElementById("hl-f-title").value    || "").trim();
    var unit     = document.getElementById("hl-f-unit").value;
    var lastDate = _toStorage(document.getElementById("hl-f-lastdate").value);
    var note     = (document.getElementById("hl-f-note").value     || "").trim();
    var subType  = document.getElementById("hl-f-subtype").value;
    var pg       = pageByKey(_editingKey);
    var needSubType = !!(pg && pg.subTypes);

    if (!name || !pid || !title || !unit || !lastDate || (needSubType && !subType)) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc (*). Ngày phải đúng dạng DD/MM/YYYY.");
      return;
    }
    if (!_confirmDup(_editingKey, pid, name, _editingId)) return;

    var record = { name: name, pid: pid, title: title, unit: unit, lastDate: lastDate, note: note,
      loai_huan_luyen: _editingKey };
    if (needSubType) record.subType = subType;

    if (_editingId) {
      var existing = (_getAllData().filter(function (x) { return x.id === _editingId; })[0]) || {};
      _updateRecord(Object.assign({}, existing, record));
    } else {
      record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      record.createdAt = new Date().toISOString();
      _insertRecord(record);
    }

    _closeModal();
    _renderTabContent(_editingKey);
  }

  function _deletePerson(key, id) {
    if (!confirm("Xác nhận xoá nhân sự này?")) return;
    _deleteRecord(id);
    _renderTabContent(key);
  }

  /* ──────────────────────────────────────────
     HELPERS — NGÀY THÁNG (DD/MM/YYYY)
  ────────────────────────────────────────── */
  /* Lưu nội bộ: "YYYY-MM-DD".  Hiển thị / nhập: "DD/MM/YYYY". */
  function _pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* Parse chuỗi lưu → {y,m,d} (chấp nhận cả YYYY-MM cũ) */
  function _parseStored(stored) {
    if (!stored) return null;
    var p = String(stored).split("-");
    var y = parseInt(p[0]), m = parseInt(p[1]), d = p.length >= 3 ? parseInt(p[2]) : 1;
    if (isNaN(y) || isNaN(m)) return null;
    if (isNaN(d)) d = 1;
    return { y: y, m: m, d: d };
  }

  /* "YYYY-MM-DD" → "DD/MM/YYYY" (YYYY-MM cũ → 01/MM/YYYY) */
  function _toDisplay(stored) {
    var o = _parseStored(stored);
    if (!o) return "";
    return _pad(o.d) + "/" + _pad(o.m) + "/" + o.y;
  }

  /* "DD/MM/YYYY" → "YYYY-MM-DD" (chấp nhận "MM/YYYY" cũ → ngày 01). "" nếu sai */
  function _toStorage(display) {
    if (!display) return "";
    var p = String(display).split("/");
    var d, m, y;
    if (p.length === 3) {
      d = parseInt(p[0]); m = parseInt(p[1]); y = parseInt(p[2]);
      if (p[0].length < 1 || p[1].length < 1 || p[2].length !== 4) return "";
    } else if (p.length === 2) { // MM/YYYY cũ
      d = 1; m = parseInt(p[0]); y = parseInt(p[1]);
      if (p[1].length !== 4) return "";
    } else return "";
    if (isNaN(d) || isNaN(m) || isNaN(y)) return "";
    if (m < 1 || m > 12 || y < 1900 || y > 2100 || d < 1 || d > 31) return "";
    /* Kiểm tra ngày thực sự tồn tại (vd 31/02 không hợp lệ) */
    var dim = new Date(y, m, 0).getDate();
    if (d > dim) return "";
    return y + "-" + _pad(m) + "-" + _pad(d);
  }

  /* Auto-format khi gõ → chèn dấu "/" thành DD/MM/YYYY */
  function _fmtDMYInput(v) {
    var d = String(v).replace(/\D/g, "").slice(0, 8);
    if (d.length >= 5) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
    if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
    return d;
  }

  /* Hiển thị ngày trong bảng (chế độ xem) */
  function _fmtDate(stored) {
    if (!stored) return '<span style="color:var(--text-muted)">–</span>';
    return _toDisplay(stored);
  }

  function _esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Ngày huấn luyện tiếp theo = ngày gần nhất + N tháng (giữ ngày, kẹp theo số ngày trong tháng) */
  function _nextDateObj(lastDate, months) {
    var o = _parseStored(lastDate);
    if (!o) return null;
    var total = (o.m - 1) + Number(months);
    var ny = o.y + Math.floor(total / 12);
    var nm = ((total % 12) + 12) % 12;       // 0-11
    var dim = new Date(ny, nm + 1, 0).getDate();
    var nd = Math.min(o.d, dim);
    return new Date(ny, nm, nd);
  }

  function _calcNext(lastDate, months) {
    var dt = _nextDateObj(lastDate, months);
    if (!dt) return '<span style="color:var(--text-muted)">Chưa có dữ liệu</span>';
    return _pad(dt.getDate()) + "/" + _pad(dt.getMonth() + 1) + "/" + dt.getFullYear();
  }

  function _calcStatus(lastDate, months, warnDays) {
    var dt = _nextDateObj(lastDate, months);
    if (!dt) return "expired";
    var now = new Date(); now.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    var diffDays = Math.round((dt - now) / 86400000);
    if (diffDays < 0) return "expired";
    if (diffDays <= (warnDays || DEFAULT_WARN_DAYS)) return "warn";
    return "ok";
  }

  function _statusBadge(status, lastDate) {
    if (!lastDate) return '<span class="hl-badge hl-gray">Chưa có dữ liệu</span>';
    if (status === "ok")   return '<span class="hl-badge hl-ok"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Còn hiệu lực</span>';
    if (status === "warn") return '<span class="hl-badge hl-warn"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Sắp hết hạn</span>';
    return '<span class="hl-badge hl-exp">✗ Hết hạn</span>';
  }

})();
