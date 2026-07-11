/* =========================================================
   NHA-THAU.JS
   Module Quản lý Nhà thầu – HSE Webapp
   - Danh sách nhà thầu dạng bảng
   - CRUD: Thêm / Sửa / Xóa
   - Accordion "Thông tin khác" (HĐ + ghi chú)
   - Badge trạng thái hợp đồng tự động
   - Phân quyền: canEdit (Admin/User) / chỉ xem (Viewer)
   ========================================================= */
(function () {
  "use strict";

  var LS_KEY = "hse_nha_thau";
  var SHEET  = "nha_thau";

  /* ── TRẠNG THÁI HĐ ── */
  function _hdStatus(batDau, ketThuc) {
    if (!ketThuc) return null;
    var today = new Date();
    today.setHours(0,0,0,0);
    var end = HSEDate.parse(ketThuc);   /* đọc được mọi định dạng (ISO, DD-MM-YYYY, DD/MM/YYYY...) */
    if (!end) return null;
    var diff = Math.round((end - today) / 86400000);
    if (diff < 0)   return { cls: "nt-het-han",  label: "Hết hạn",    color: "#c0392b", bg: "#fdedec" };
    if (diff <= 30) return { cls: "nt-sap-han",  label: "Sắp hết hạn",color: "#e68900", bg: "#fef5e4" };
    return              { cls: "nt-con-han",  label: "Còn hiệu lực",color: "#1a7a3c", bg: "#eafaf1" };
  }

  /* Chuẩn hóa ngày về ISO YYYY-MM-DD (định dạng lưu trữ chuẩn) */
  function _normalizeRow(r) {
    r.hd_bat_dau  = HSEDate.toISO(r.hd_bat_dau);
    r.hd_ket_thuc = HSEDate.toISO(r.hd_ket_thuc);
    return r;
  }

  /* ── LOCAL STORAGE ── */
  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch(e) { return []; }
  }
  function _save(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }

  /* ── SHEETS SYNC ── */

  /* Pull thủ công (nút Làm mới): chờ Sheets rồi mới callback */
  function _pull(cb) {
    if (typeof DB === "undefined" || !DB.isReady()) { if (cb) cb(); return; }
    DB.getAll(SHEET).then(function(rows) {
      if (rows && rows.length) _save(rows.map(_normalizeRow));
      if (cb) cb();
    }).catch(function() { if (cb) cb(); });
  }

  /* Pull ngầm (stale-while-revalidate):
     - Render localStorage ngay (cb() trước)
     - Sau đó kéo Sheets → nếu có thay đổi → re-render bảng tự động */
  function _pullBackground() {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.getAll(SHEET).then(function(rows) {
      if (!rows || !rows.length) return;
      var normalized = rows.map(_normalizeRow);
      var current  = JSON.stringify(_load());
      var incoming = JSON.stringify(normalized);
      if (current !== incoming) {
        _save(normalized);
        _renderTable();
      }
    }).catch(function(e) {
      console.warn("[NhaThau] Pull ngầm thất bại:", e && e.message || e);
    });
  }

  /* Push helpers – hiện toast lỗi nếu Sheets thất bại */
  function _pushInsert(r) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.insert(SHEET, r).catch(function() { _toastErr("Lưu lên Sheets thất bại. Dữ liệu vẫn lưu tại máy."); });
  }
  function _pushUpdate(r) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.update(SHEET, r.id, r).catch(function() { _toastErr("Cập nhật Sheets thất bại. Dữ liệu vẫn lưu tại máy."); });
  }
  function _pushDelete(id) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.delete(SHEET, id).catch(function() { _toastErr("Xóa trên Sheets thất bại. Dữ liệu vẫn xóa tại máy."); });
  }

  /* Toast lỗi nhỏ góc phải */
  function _toastErr(msg) {
    var t = document.createElement("div");
    t.textContent = "" + msg;
    t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#c0392b;color:#fff;" +
      "padding:10px 16px;border-radius:8px;font-size:13px;z-index:9999;" +
      "box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:320px;";
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 5000);
  }

  function _genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  /* ── ESCAPE ── */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ════════════════════════════════════════
     ENTRY POINT
  ════════════════════════════════════════ */
  var _c, _canEdit, _editingId = null, _showForm = false;

  window.renderQuanLyNhaThau = function(container, user, canEdit) {
    _c       = container;
    _canEdit = !!canEdit;
    _editingId = null;
    _showForm  = false;
    /* Render từ localStorage ngay, pull Sheets ngầm phía sau */
    _render();
    _pullBackground();
  };

  /* ── RENDER CHÍNH ── */
  function _render() {
    _c.innerHTML = "";
    _c.appendChild(_styles());

    /* Tiêu đề tên trang (theo mẫu: tên trang nằm ở body) */
    var _pt = document.createElement("div");
    _pt.className = "page-title";
    _pt.style.cssText = "display:flex;align-items:center;gap:9px;margin-bottom:16px;";
    _pt.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/></svg><span>Quản lý nhà thầu</span>';
    _c.appendChild(_pt);

    /* Toolbar */
    var toolbar = document.createElement("div");
    toolbar.className = "nt-toolbar";

    if (_canEdit) {
      var btnAdd = document.createElement("button");
      btnAdd.className = "nt-btn nt-btn-primary";
      btnAdd.innerHTML = "＋ Thêm nhà thầu";
      btnAdd.onclick = function() {
        _editingId = null;
        _showForm = true;
        _renderForm();
      };
      toolbar.appendChild(btnAdd);
    }

    _c.appendChild(toolbar);

    /* Vùng form (ẩn ban đầu) */
    var formWrap = document.createElement("div");
    formWrap.id = "nt-form-wrap";
    _c.appendChild(formWrap);

    /* Bảng */
    var tableWrap = document.createElement("div");
    tableWrap.id = "nt-table-wrap";
    _c.appendChild(tableWrap);

    _renderTable();
  }

  /* ════════════════════════════════════════
     BẢNG DANH SÁCH
  ════════════════════════════════════════ */
  function _renderTable() {
    var wrap = document.getElementById("nt-table-wrap");
    if (!wrap) return;
    var rows = _load();
    wrap.innerHTML = "";

    if (rows.length === 0) {
      wrap.innerHTML =
        '<div style="text-align:center;padding:60px 20px;color:#6b7c93;">' +
          '<div style="font-size:48px;margin-bottom:12px;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/></svg></div>' +
          '<p style="font-size:15px;">Chưa có nhà thầu nào. ' +
          (_canEdit ? 'Nhấn <b>＋ Thêm nhà thầu</b> để bắt đầu.' : '') + '</p>' +
        '</div>';
      return;
    }

    var tbl = document.createElement("div");
    tbl.className = "nt-table-wrap";

    var table = document.createElement("table");
    table.className = "nt-table";
    table.innerHTML =
      '<thead><tr>' +
        '<th style="width:30px;">#</th>' +
        '<th style="width:200px;">Tên nhà thầu</th>' +
        '<th style="width:110px;">Khu vực thuê</th>' +
        '<th style="width:160px;">Hạng mục thuê</th>' +
        '<th style="width:140px;">Đầu mối liên hệ</th>' +
        '<th style="width:110px;">Trạng thái HĐ</th>' +
        '<th style="width:115px;">Thông tin HĐ</th>' +
        (_canEdit ? '<th style="width:72px;">Thao tác</th>' : '') +
      '</tr></thead>';

    var tbody = document.createElement("tbody");
    rows.forEach(function(r, i) {
      var st = _hdStatus(r.hd_bat_dau, r.hd_ket_thuc);
      var badge = st
        ? '<span class="nt-badge" style="background:'+st.bg+';color:'+st.color+'">'+st.label+'</span>'
        : '<span class="nt-badge" style="background:#f2f3f4;color:#6b7c93;">Chưa có</span>';

      /* Accordion: tóm tắt thời hạn HĐ */
      var hdSummary = "";
      if (r.hd_bat_dau || r.hd_ket_thuc) {
        hdSummary = (r.hd_bat_dau ? HSEDate.fmt(r.hd_bat_dau) : "?") + " → " + (r.hd_ket_thuc ? HSEDate.fmt(r.hd_ket_thuc) : "?");
      }
      var accordionId = "nt-acc-" + r.id;

      var hdCell =
        '<div class="nt-acc-toggle" onclick="document.getElementById(\''+accordionId+'\').classList.toggle(\'open\')">' +
          (hdSummary
            ? '<span class="nt-acc-label">'+esc(hdSummary)+'</span> <span class="nt-acc-arrow">▾</span>'
            : '<span style="color:#aaa;font-size:12px;">Chưa có ▾</span>') +
        '</div>' +
        '<div id="'+accordionId+'" class="nt-acc-detail">' +
          '<div class="nt-acc-row"><b>Bắt đầu:</b> '+(r.hd_bat_dau ? esc(HSEDate.fmt(r.hd_bat_dau)) : '—')+'</div>' +
          '<div class="nt-acc-row"><b>Kết thúc:</b> '+(r.hd_ket_thuc ? esc(HSEDate.fmt(r.hd_ket_thuc)) : '—')+'</div>' +
          (r.ghi_chu ? '<div class="nt-acc-row"><b>Ghi chú:</b> '+esc(r.ghi_chu)+'</div>' : '') +
        '</div>';

      var actions = _canEdit
        ? '<button class="nt-btn-icon" title="Sửa" onclick="window._ntEdit(\''+r.id+'\')"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></button>' +
          '<button class="nt-btn-icon nt-btn-del" title="Xóa" onclick="window._ntDelete(\''+r.id+'\')"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
        : "";

      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td style="color:#6b7c93;font-size:12px;">'+(i+1)+'</td>' +
        '<td><b style="color:#003087;">'+esc(r.ten_nha_thau)+'</b></td>' +
        '<td>'+esc(r.khu_vuc)+'</td>' +
        '<td style="max-width:200px;white-space:pre-wrap;font-size:12.5px;">'+esc(r.hang_muc)+'</td>' +
        '<td>' +
          '<div style="font-size:13px;font-weight:600;">'+esc(r.lh_ho_ten)+'</div>' +
          (r.lh_chuc_danh ? '<div style="font-size:11.5px;color:#6b7c93;">'+esc(r.lh_chuc_danh)+'</div>' : '') +
          (r.lh_sdt ? '<div style="font-size:12px;color:#0060B6;"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg> '+esc(r.lh_sdt)+'</div>' : '') +
        '</td>' +
        '<td>'+badge+'</td>' +
        '<td>'+hdCell+'</td>' +
        (_canEdit ? '<td style="text-align:center;">'+actions+'</td>' : '');
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tbl.appendChild(table);
    wrap.appendChild(tbl);
  }

  /* ════════════════════════════════════════
     FORM THÊM / SỬA
  ════════════════════════════════════════ */
  function _renderForm() {
    var wrap = document.getElementById("nt-form-wrap");
    if (!wrap) return;

    var rows = _load();
    var rec  = _editingId ? rows.find(function(r){ return r.id === _editingId; }) : null;

    var title = rec ? "✏️ Sửa nhà thầu" : "＋ Thêm nhà thầu mới";

    wrap.innerHTML = "";
    var card = document.createElement("div");
    card.className = "nt-form-card";

    card.innerHTML =
      '<div class="nt-form-header">' +
        '<span style="font-size:15px;font-weight:700;color:#003087;">'+title+'</span>' +
        '<button class="nt-btn nt-btn-ghost" id="nt-cancel-btn"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Hủy</button>' +
      '</div>' +

      '<div class="nt-form-grid">' +

        /* Tên nhà thầu */
        '<div class="nt-form-group nt-col-2">' +
          '<label class="nt-label">Tên nhà thầu <span class="nt-req">*</span></label>' +
          '<input id="ntf-ten" class="nt-input" type="text" placeholder="VD: Công ty TNHH ABC" value="'+esc(rec ? rec.ten_nha_thau : '')+'">' +
        '</div>' +

        /* Khu vực thuê */
        '<div class="nt-form-group">' +
          '<label class="nt-label">Khu vực thuê <span class="nt-req">*</span></label>' +
          '<input id="ntf-khu" class="nt-input" type="text" placeholder="VD: Kho trung tâm" value="'+esc(rec ? rec.khu_vuc : '')+'">' +
        '</div>' +

        /* Hạng mục thuê */
        '<div class="nt-form-group">' +
          '<label class="nt-label">Hạng mục thuê</label>' +
          '<textarea id="ntf-hang" class="nt-input" rows="3" placeholder="VD: Thuê kho chứa hàng – 500 m²&#10;Thuê văn phòng – tầng 2">'+esc(rec ? rec.hang_muc : '')+'</textarea>' +
        '</div>' +

      '</div>' + /* end grid row 1 */

      /* Đầu mối liên hệ */
      '<div class="nt-form-section-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg> Đầu mối liên hệ</div>' +
      '<div class="nt-form-grid">' +
        '<div class="nt-form-group">' +
          '<label class="nt-label">Họ và tên</label>' +
          '<input id="ntf-lh-ten" class="nt-input" type="text" placeholder="Nguyễn Văn A" value="'+esc(rec ? rec.lh_ho_ten : '')+'">' +
        '</div>' +
        '<div class="nt-form-group">' +
          '<label class="nt-label">Chức danh</label>' +
          '<input id="ntf-lh-cd" class="nt-input" type="text" placeholder="Giám đốc / Trưởng phòng..." value="'+esc(rec ? rec.lh_chuc_danh : '')+'">' +
        '</div>' +
        '<div class="nt-form-group">' +
          '<label class="nt-label">Số điện thoại</label>' +
          '<input id="ntf-lh-sdt" class="nt-input" type="tel" placeholder="0901 234 567" value="'+esc(rec ? rec.lh_sdt : '')+'">' +
        '</div>' +
      '</div>' +

      /* Thông tin khác – accordion */
      '<div class="nt-form-acc-toggle" id="nt-form-acc-toggle">' +
        '<span><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> Thông tin khác (Hợp đồng & Ghi chú)</span>' +
        '<span class="nt-acc-arrow" id="nt-form-acc-arrow">▾</span>' +
      '</div>' +
      '<div id="nt-form-acc-body" class="nt-form-acc-body">' +
        '<div class="nt-form-grid">' +
          '<div class="nt-form-group">' +
            '<label class="nt-label">Ngày bắt đầu HĐ</label>' +
            '<input id="ntf-bd" class="nt-input" type="date" value="'+esc(HSEDate.toISO(rec ? rec.hd_bat_dau : ''))+'">' +
          '</div>' +
          '<div class="nt-form-group">' +
            '<label class="nt-label">Ngày kết thúc HĐ</label>' +
            '<input id="ntf-kt" class="nt-input" type="date" value="'+esc(HSEDate.toISO(rec ? rec.hd_ket_thuc : ''))+'">' +
          '</div>' +
          '<div class="nt-form-group nt-col-2">' +
            '<label class="nt-label">Ghi chú</label>' +
            '<textarea id="ntf-ghichu" class="nt-input" rows="2" placeholder="Ghi chú thêm về hợp đồng...">'+esc(rec ? rec.ghi_chu : '')+'</textarea>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Footer nút */
      '<div class="nt-form-footer">' +
        '<button class="nt-btn nt-btn-outline" id="nt-cancel-btn2">Hủy</button>' +
        '<button class="nt-btn nt-btn-primary" id="nt-save-btn"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Lưu</button>' +
      '</div>' +
      '<div id="nt-form-err" style="color:#c0392b;font-size:13px;margin-top:6px;display:none;"></div>';

    wrap.appendChild(card);

    /* Gắn flatpickr cho ô ngày (hiển thị DD/MM/YYYY đồng nhất, lưu ISO) */
    if (window.HSEDate) HSEDate.attachAll(card);

    /* Accordion toggle */
    var accToggle = document.getElementById("nt-form-acc-toggle");
    var accBody   = document.getElementById("nt-form-acc-body");
    var accArrow  = document.getElementById("nt-form-acc-arrow");
    var accOpen   = !!(rec && (rec.hd_bat_dau || rec.hd_ket_thuc || rec.ghi_chu));
    function _syncAcc() {
      accBody.style.display = accOpen ? "block" : "none";
      accArrow.style.transform = accOpen ? "rotate(180deg)" : "";
    }
    _syncAcc();
    accToggle.addEventListener("click", function() { accOpen = !accOpen; _syncAcc(); });

    /* Cancel */
    function _cancel() { wrap.innerHTML = ""; _editingId = null; _showForm = false; }
    document.getElementById("nt-cancel-btn").addEventListener("click", _cancel);
    document.getElementById("nt-cancel-btn2").addEventListener("click", _cancel);

    /* Save */
    document.getElementById("nt-save-btn").addEventListener("click", function() {
      var ten = document.getElementById("ntf-ten").value.trim();
      var khu = document.getElementById("ntf-khu").value.trim();
      var errEl = document.getElementById("nt-form-err");
      if (!ten) { errEl.textContent = "Vui lòng nhập tên nhà thầu."; errEl.style.display="block"; return; }
      if (!khu) { errEl.textContent = "Vui lòng nhập khu vực thuê."; errEl.style.display="block"; return; }
      errEl.style.display = "none";

      var newRec = {
        id:           rec ? rec.id : _genId(),
        ten_nha_thau: ten,
        khu_vuc:      khu,
        hang_muc:     document.getElementById("ntf-hang").value.trim(),
        lh_ho_ten:    document.getElementById("ntf-lh-ten").value.trim(),
        lh_chuc_danh: document.getElementById("ntf-lh-cd").value.trim(),
        lh_sdt:       document.getElementById("ntf-lh-sdt").value.trim(),
        hd_bat_dau:   HSEDate.getValue(document.getElementById("ntf-bd")),
        hd_ket_thuc:  HSEDate.getValue(document.getElementById("ntf-kt")),
        ghi_chu:      document.getElementById("ntf-ghichu").value.trim()
      };

      var arr = _load();
      if (rec) {
        var idx = arr.findIndex(function(x){ return x.id === rec.id; });
        if (idx >= 0) arr[idx] = newRec; else arr.push(newRec);
        _pushUpdate(newRec);
      } else {
        arr.push(newRec);
        _pushInsert(newRec);
      }
      _save(arr);
      wrap.innerHTML = "";
      _editingId = null;
      _showForm  = false;
      _renderTable();
    });

    /* Cuộn đến form */
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ── GLOBAL HANDLERS (gọi từ onclick inline) ── */
  window._ntEdit = function(id) {
    _editingId = id;
    _showForm  = true;
    _renderForm();
    var fw = document.getElementById("nt-form-wrap");
    if (fw) fw.scrollIntoView({ behavior:"smooth", block:"nearest" });
  };

  window._ntDelete = function(id) {
    if (!confirm("Xóa nhà thầu này?")) return;
    var arr = _load().filter(function(r){ return r.id !== id; });
    _save(arr);
    _pushDelete(id);
    _renderTable();
  };

  /* ════════════════════════════════════════
     STYLES
  ════════════════════════════════════════ */
  function _styles() {
    var s = document.createElement("style");
    s.textContent = [
      /* Toolbar */
      ".nt-toolbar{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;}",

      /* Buttons */
      ".nt-btn{padding:8px 16px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s;}",
      ".nt-btn-primary{background:#0060B6;color:#fff;} .nt-btn-primary:hover{background:#003087;}",
      ".nt-btn-outline{background:#fff;color:#003087;border:1.5px solid #cdd6e8;} .nt-btn-outline:hover{background:#eef3fb;}",
      ".nt-btn-ghost{background:transparent;color:#6b7c93;border:1px solid #cdd6e8;padding:5px 10px;font-size:12px;}",
      ".nt-btn-ghost:hover{background:#f4f7fc;}",
      ".nt-btn-icon{background:transparent;border:none;cursor:pointer;font-size:15px;padding:3px 5px;border-radius:5px;transition:background 0.1s;}",
      ".nt-btn-icon:hover{background:#eef3fb;}",
      ".nt-btn-del:hover{background:#fdedec;}",

      /* Table */
      ".nt-table-wrap{overflow-x:hidden;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);}",
      ".nt-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12.5px;background:#fff;}",
      ".nt-table th{background:#dde6f3;color:#003087;font-weight:700;padding:8px 10px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".nt-table td{padding:8px 10px;border-bottom:1px solid #eef1f7;vertical-align:top;overflow:hidden;white-space:normal;word-break:break-word;overflow-wrap:anywhere;}",
      ".nt-table tbody tr:hover td{background:#f4f8fd;}",
      ".nt-table th, .nt-table td{border-right:1px solid #e6ebf5;}",
      ".nt-table th:last-child, .nt-table td:last-child{border-right:none;}",

      /* Badge */
      ".nt-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;}",

      /* Accordion (bảng) */
      ".nt-acc-toggle{cursor:pointer;display:flex;align-items:center;gap:4px;user-select:none;}",
      ".nt-acc-toggle:hover .nt-acc-label{color:#003087;}",
      ".nt-acc-label{font-size:12px;color:#555;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".nt-acc-arrow{font-size:11px;color:#888;transition:transform 0.2s;}",
      ".nt-acc-detail{display:none;margin-top:6px;padding:8px 10px;background:#f4f8fd;border-radius:7px;font-size:12px;line-height:1.7;}",
      ".nt-acc-detail.open{display:block;}",
      ".nt-acc-row{margin-bottom:2px;}",

      /* Form card */
      ".nt-form-card{background:#fff;border:1.5px solid #cdd6e8;border-radius:10px;padding:20px 24px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.07);}",
      ".nt-form-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;border-bottom:1px solid #eef1f7;padding-bottom:12px;}",
      ".nt-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;margin-bottom:16px;}",
      ".nt-col-2{grid-column:1/-1;}",
      ".nt-form-group{display:flex;flex-direction:column;gap:5px;}",
      ".nt-label{font-size:12.5px;font-weight:600;color:#1a2535;}",
      ".nt-req{color:#c0392b;}",
      ".nt-input{padding:8px 11px;border:1.5px solid #cdd6e8;border-radius:7px;font-size:13px;font-family:inherit;transition:border 0.15s;resize:vertical;}",
      ".nt-input:focus{outline:none;border-color:#0060B6;}",
      ".nt-form-section-title{font-size:13px;font-weight:700;color:#003087;margin:4px 0 10px;padding:6px 10px;background:#dde6f3;border-radius:6px;}",

      /* Form accordion */
      ".nt-form-acc-toggle{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:#f4f7fc;border:1.5px solid #cdd6e8;border-radius:7px;cursor:pointer;margin-bottom:0;user-select:none;font-size:13px;font-weight:600;color:#003087;}",
      ".nt-form-acc-toggle:hover{background:#eef3fb;}",
      ".nt-form-acc-body{border:1.5px solid #cdd6e8;border-top:none;border-radius:0 0 7px 7px;padding:14px 14px 4px;margin-bottom:16px;background:#fafbfd;}",

      /* Form footer */
      ".nt-form-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:8px;border-top:1px solid #eef1f7;padding-top:14px;}",

      /* Responsive */
      "@media(max-width:640px){.nt-form-grid{grid-template-columns:1fr;} .nt-col-2{grid-column:1;}}"
    ].join("\n");
    return s;
  }

})();
