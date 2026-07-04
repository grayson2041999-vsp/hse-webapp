/* =========================================================
   HUAN-LUYEN-DAO-TAO.JS
   Module quản lý huấn luyện, đào tạo HSE
   - 6 loại huấn luyện (ATVSLĐ nhóm 1-4, T-BOSIET/T-FOET, hoá chất)
   - Phân quyền tích hợp với HSE.renderPage (admin / user / viewer)
   - Lưu localStorage + sync Google Sheets qua DB.cachedLoad/cachedSave
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

  /* ──────────────────────────────────────────
     DỮ LIỆU (localStorage cache + Sheets)
     - 1 sheet "hl_nhansu"  : toàn bộ nhân sự, lọc theo cột loai_huan_luyen
     - 1 sheet "hl_settings": thời hạn từng loại [{loai, thoi_han_thang}]
  ────────────────────────────────────────── */
  var LS_NHANSU   = "hl_nhansu";
  var LS_SETTINGS = "hl_settings";

  /* Lấy / ghi toàn bộ danh sách nhân sự (localStorage only) */
  function _getAllData() {
    try { return JSON.parse(localStorage.getItem(LS_NHANSU) || "[]"); } catch (e) { return []; }
  }
  function _setAllData(arr) {
    localStorage.setItem(LS_NHANSU, JSON.stringify(arr));
  }

  /* Lọc nhân sự theo loại */
  function getData(key) {
    return _getAllData().filter(function (p) { return p.loai_huan_luyen === key; });
  }

  /* Insert 1 record lên Sheets + localStorage */
  function _insertRecord(record) {
    var all = _getAllData();
    all.push(record);
    _setAllData(all);
    if (typeof DB !== "undefined" && DB.isReady()) {
      DB.insert("hl_nhansu", record).catch(function () {});
    }
  }

  /* Update 1 record lên Sheets + localStorage */
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

  /* Delete 1 record trên Sheets + localStorage */
  function _deleteRecord(id) {
    _setAllData(_getAllData().filter(function (p) { return p.id !== id; }));
    if (typeof DB !== "undefined" && DB.isReady()) {
      DB.delete("hl_nhansu", id).catch(function () {});
    }
  }

  /* Settings: lưu dạng object {nhom1:24, nhom2:24, ...} trong localStorage */
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}"); } catch (e) { return {}; }
  }
  function saveSettings(s) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    if (typeof DB !== "undefined" && DB.isReady()) {
      /* Ghi lên Sheets dạng [{loai, thoi_han_thang}] */
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
  function pageByKey(k) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].key === k) return PAGES[i];
    return null;
  }

  /* Sync từ Sheets khi tải trang, re-render sau khi có data */
  function syncFromSheets() {
    if (typeof DB === "undefined" || !DB.isReady()) return;

    var p1 = DB.getAll("hl_nhansu").then(function (rows) {
      if (rows && rows.length) _setAllData(rows);
    }).catch(function () {});

    var p2 = DB.getAll("hl_settings").then(function (rows) {
      if (rows && rows.length) {
        var s = {};
        rows.forEach(function (r) { s[r.loai] = parseInt(r.thoi_han_thang); });
        localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
      }
    }).catch(function () {});

    /* Re-render sau khi cả 2 đã về */
    Promise.all([p1, p2]).then(function () {
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

    _container.appendChild(_buildTabBar());
    var body = document.createElement("div");
    body.id = "hl-body";
    _container.appendChild(body);
    _renderTabContent(_currentKey);
    _wireModal();
  }

  /* ──────────────────────────────────────────
     STYLE TAG (nội tuyến, phụ thêm style.css)
  ────────────────────────────────────────── */
  function _buildStyles() {
    var s = document.createElement("style");
    s.textContent = [
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
      /* Table */
      ".hl-tw{overflow-x:auto;}",
      ".hl-tw table{width:100%;border-collapse:collapse;font-size:13px;}",
      ".hl-tw thead th{background:#dde6f3;color:var(--brand);font-weight:700;",
      "padding:10px 12px;text-align:left;white-space:nowrap;border-bottom:2px solid #b8cde4;}",
      ".hl-tw tbody td{padding:9px 12px;border-bottom:1px solid #eef1f7;vertical-align:middle;}",
      ".hl-tw tbody tr:hover td{background:#eef3fb;}",
      ".hl-tw tbody tr:last-child td{border-bottom:none;}",
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
      ".hl-empty td{text-align:center;padding:28px;color:var(--text-muted);font-style:italic;}",
      /* Page header */
      ".hl-ph{display:flex;align-items:flex-start;justify-content:space-between;",
      "margin-bottom:18px;flex-wrap:wrap;gap:10px;}",
      ".hl-pt{font-size:18px;font-weight:700;color:var(--brand);}",
      ".hl-ps{font-size:12.5px;color:var(--text-muted);margin-top:3px;}",
      /* Viewer notice */
      ".hl-viewer-note{background:#fef9e7;border-left:3px solid var(--warning);",
      "padding:9px 14px;border-radius:0 8px 8px 0;font-size:12.5px;color:#856404;margin-bottom:14px;}",
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
      btn.innerHTML = '<span class="ic">' + pg.icon + '</span>' + pg.label;
      btn.addEventListener("click", function () {
        _currentKey = pg.key;
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
    var data = getData(key);

    /* Tính thống kê */
    var total = data.length, ok = 0, warn = 0, exp = 0;
    data.forEach(function (p) {
      var s = _calcStatus(p.lastDate, months);
      if (s === "ok") ok++; else if (s === "warn") warn++; else exp++;
    });

    /* Page header */
    var ph = document.createElement("div");
    ph.className = "hl-ph";
    ph.innerHTML =
      '<div>' +
        '<div class="hl-pt">' + pg.icon + ' ' + pg.label + '</div>' +
        '<div class="hl-ps">' + pg.desc + '</div>' +
      '</div>' +
      (_canEdit
        ? '<button class="btn btn-accent btn-sm" id="hl-btn-add">＋ Thêm nhân sự</button>'
        : '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">Chế độ xem</span>');
    body.appendChild(ph);

    /* Viewer notice */
    if (!_user) {
      var vn = document.createElement("div");
      vn.className = "hl-viewer-note";
      vn.innerHTML = "<svg class='lic-emoji' width='1.05em' height='1.05em' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='display:inline-block;vertical-align:-0.15em;flex-shrink:0' aria-hidden='true'><path d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'/><circle cx='12' cy='12' r='3'/></svg> Bạn đang xem ở chế độ khách. <a href='#' onclick='return false' id='hl-login-link' style='color:var(--brand);font-weight:600'>Đăng nhập</a> để thêm/sửa dữ liệu.";
      body.appendChild(vn);
    }

    /* Stats */
    var stats = document.createElement("div");
    stats.className = "hl-stats";
    stats.innerHTML =
      _stat("blue", total, "Tổng nhân sự") +
      _stat("green", ok, "Còn hiệu lực") +
      _stat("orange", warn, "Sắp hết hạn (≤ 2 tháng)") +
      _stat("red", exp, "Đã hết hạn / Chưa có");
    body.appendChild(stats);

    /* Card cài đặt thời hạn */
    var settCard = document.createElement("div");
    settCard.className = "hl-card";
    var lockNote = _isAdmin
      ? '<span style="color:#1a7a3c;font-size:12px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Admin – có thể điều chỉnh</span>'
      : '<span style="font-size:12px;color:var(--text-muted);"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Chỉ Admin mới chỉnh được</span>';
    settCard.innerHTML =
      '<div class="hl-card-h"><div class="hl-card-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg> Thời hạn huấn luyện lại</div>' + lockNote + '</div>' +
      '<div class="hl-card-b">' +
        '<div class="hl-set-row">' +
          '<span style="font-size:13.5px;font-weight:600;">Thời hạn huấn luyện lại:</span>' +
          '<input type="number" class="hl-set-input" id="hl-months-' + key + '" ' +
            'value="' + months + '" min="1" max="120" ' + (_isAdmin ? '' : 'disabled') + '>' +
          '<span style="font-size:13px;color:var(--text-muted);">tháng</span>' +
          '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">– Áp dụng cho toàn bộ nhân sự trong mục này</span>' +
        '</div>' +
      '</div>';
    body.appendChild(settCard);

    /* Card bảng nhân sự */
    var tableCard = document.createElement("div");
    tableCard.className = "hl-card";
    tableCard.innerHTML =
      '<div class="hl-card-h">' +
        '<div class="hl-card-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg> Danh sách nhân sự</div>' +
        '<input type="text" class="hl-search" id="hl-search-' + key + '" placeholder="Tìm kiếm...">' +
      '</div>' +
      '<div class="hl-tw"><table><thead><tr>' +
        '<th style="width:40px;text-align:center">STT</th>' +
        '<th>Họ và tên</th>' +
        '<th>Danh số</th>' +
        '<th>Chức danh</th>' +
        '<th>Đơn vị</th>' +
        (pg.subTypes ? '<th>Loại</th>' : '') +
        '<th>TG huấn luyện gần nhất</th>' +
        '<th>TG huấn luyện tiếp theo</th>' +
        '<th>Trạng thái</th>' +
        (_canEdit ? '<th style="width:90px;text-align:center">Thao tác</th>' : '') +
      '</tr></thead>' +
      '<tbody id="hl-tbody-' + key + '"></tbody>' +
      '</table></div>';
    body.appendChild(tableCard);

    /* Điền dữ liệu vào bảng */
    _fillTable(key);

    /* Wire events */
    var monthsInput = document.getElementById("hl-months-" + key);
    if (monthsInput && _isAdmin) {
      monthsInput.addEventListener("change", function () {
        var v = parseInt(this.value);
        if (!isNaN(v) && v >= 1) { setMonths(key, v); _fillTable(key); }
      });
    }

    var searchInput = document.getElementById("hl-search-" + key);
    if (searchInput) searchInput.addEventListener("input", function () { _fillTable(key); });

    var addBtn = document.getElementById("hl-btn-add");
    if (addBtn) addBtn.addEventListener("click", function () { _openModal(key, null); });

    var loginLink = document.getElementById("hl-login-link");
    if (loginLink) {
      loginLink.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof openLoginModal === "function") openLoginModal();
      });
    }
  }

  function _stat(cls, val, lbl) {
    return '<div class="hl-stat ' + cls + '">' +
      '<div class="hl-val">' + val + '</div>' +
      '<div class="hl-lbl">' + lbl + '</div>' +
    '</div>';
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

    var filtered = data.filter(function (p) {
      return !q ||
        (p.name  || "").toLowerCase().indexOf(q) >= 0 ||
        (p.pid   || "").toLowerCase().indexOf(q) >= 0 ||
        (p.unit  || "").toLowerCase().indexOf(q) >= 0 ||
        (p.title || "").toLowerCase().indexOf(q) >= 0;
    });

    var pg = pageByKey(key);
    var hasSubTypes = !!(pg && pg.subTypes);
    var colCount = 8 + (hasSubTypes ? 1 : 0) + (_canEdit ? 1 : 0);

    if (!filtered.length) {
      tbody.innerHTML = '<tr class="hl-empty"><td colspan="' + colCount + '">' +
        (data.length ? "Không tìm thấy nhân sự phù hợp." : "Chưa có nhân sự nào. Nhấn &#8220;Thêm nhân sự&#8221; để bắt đầu.") +
        '</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (p, i) {
      var status = _calcStatus(p.lastDate, months);
      var nextLabel = _calcNext(p.lastDate, months);
      var nextColor = status === "expired" ? "var(--danger)" : status === "warn" ? "#e68900" : "#1a7a3c";
      var subTypeCell = hasSubTypes
        ? '<td><span class="hl-badge ' + (p.subType === "T-BOSIET" ? "hl-blue" : "hl-gray") + '">' + _esc(p.subType || "–") + '</span></td>'
        : "";
      var actions = _canEdit
        ? '<td style="text-align:center;white-space:nowrap;">' +
            '<button class="btn btn-ghost btn-sm" style="margin-right:3px" data-act="edit" data-id="' + _esc(p.id) + '" data-k="' + key + '"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></button>' +
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + _esc(p.id) + '" data-k="' + key + '"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
          '</td>'
        : "";
      return '<tr>' +
        '<td style="text-align:center;color:var(--text-muted);font-size:12px;">' + (i + 1) + '</td>' +
        '<td style="font-weight:600;">' + _esc(p.name) + '</td>' +
        '<td><span class="hl-badge hl-blue">' + _esc(p.pid) + '</span></td>' +
        '<td>' + _esc(p.title || "–") + '</td>' +
        '<td style="font-size:12.5px;">' + _esc(p.unit) + '</td>' +
        subTypeCell +
        '<td>' + _fmtMonth(p.lastDate) + '</td>' +
        '<td style="font-weight:600;color:' + nextColor + ';">' + nextLabel + '</td>' +
        '<td>' + _statusBadge(status, p.lastDate) + '</td>' +
        actions +
      '</tr>';
    }).join("");

    /* Wire action buttons */
    Array.prototype.forEach.call(tbody.querySelectorAll("button[data-act]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var k  = btn.getAttribute("data-k");
        if (btn.getAttribute("data-act") === "edit") _openModal(k, id);
        else _deletePerson(k, id);
      });
    });
  }

  /* ──────────────────────────────────────────
     MODAL THÊM / SỬA
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
              '<input class="inp" id="hl-f-lastdate" maxlength="7" placeholder="MM/YYYY" ' +
                'style="width:140px;letter-spacing:1px;" autocomplete="off">' +
              '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">Nhập theo định dạng MM/YYYY, ví dụ: 04/2025</div>' +
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

    /* Auto-format MM/YYYY khi gõ */
    document.getElementById("hl-f-lastdate").addEventListener("input", function () {
      var raw = this.value.replace(/\D/g, "").slice(0, 6);
      if (raw.length > 2) raw = raw.slice(0, 2) + "/" + raw.slice(2);
      this.value = raw;
    });
  }

  function _openModal(key, id) {
    _editingKey = key;
    _editingId  = id;
    var pg = pageByKey(key);
    var isEdit = !!id;
    document.getElementById("hl-modal-title").textContent =
      (isEdit ? "✏️ Chỉnh sửa nhân sự" : "➕ Thêm nhân sự") + " – " + pg.label;

    /* Hiện/ẩn dropdown Loại tuỳ theo tab */
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
      alert("Vui lòng điền đầy đủ các trường bắt buộc (*)");
      return;
    }

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
     HELPERS
  ────────────────────────────────────────── */
  /* Chuyển "YYYY-MM" ↔ "MM/YYYY" để hiển thị / lưu */
  function _toDisplay(stored) {
    if (!stored) return "";
    var p = stored.split("-");
    return p.length === 2 ? p[1] + "/" + p[0] : "";
  }
  function _toStorage(display) {
    if (!display) return "";
    var p = display.split("/");
    if (p.length !== 2 || p[0].length !== 2 || p[1].length !== 4) return "";
    var m = parseInt(p[0]), y = parseInt(p[1]);
    if (m < 1 || m > 12 || y < 2000 || y > 2100) return "";
    return p[1] + "-" + p[0];
  }

  function _esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function _calcNext(lastDate, months) {
    if (!lastDate) return '<span style="color:var(--text-muted)">Chưa có dữ liệu</span>';
    var parts = lastDate.split("-").map(Number);
    var y = parts[0], m = parts[1];
    var nm = m - 1 + Number(months);
    var ny = y + Math.floor(nm / 12);
    nm = nm % 12 + 1;
    return "Tháng " + nm + "/" + ny;
  }

  function _calcStatus(lastDate, months) {
    if (!lastDate) return "expired";
    var parts = lastDate.split("-").map(Number);
    var nextDate = new Date(parts[0], parts[1] - 1 + Number(months), 1);
    var now = new Date();
    var diffM = (nextDate.getFullYear() - now.getFullYear()) * 12 + (nextDate.getMonth() - now.getMonth());
    if (diffM < 0) return "expired";
    if (diffM <= 2) return "warn";
    return "ok";
  }

  function _statusBadge(status, lastDate) {
    if (!lastDate) return '<span class="hl-badge hl-gray">Chưa có dữ liệu</span>';
    if (status === "ok")   return '<span class="hl-badge hl-ok"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Còn hiệu lực</span>';
    if (status === "warn") return '<span class="hl-badge hl-warn"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Sắp hết hạn</span>';
    return '<span class="hl-badge hl-exp">✗ Hết hạn</span>';
  }

  function _fmtMonth(lastDate) {
    if (!lastDate) return '<span style="color:var(--text-muted)">–</span>';
    var parts = lastDate.split("-");
    return "Tháng " + parseInt(parts[1]) + "/" + parts[0];
  }

})();
