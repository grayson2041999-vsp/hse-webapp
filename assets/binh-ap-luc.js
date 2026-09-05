/* =========================================================
   BINH-AP-LUC.JS
   Module quản lý Bình áp lực – Quản lý thiết bị HSE
   - Các section (đơn vị) do Admin quản lý ở Danh mục đơn vị
   - CRUD + reorder (drag & drop)
   - Sync Google Sheets: pull khi load trang, push sau mỗi thao tác
   ========================================================= */
(function () {
  "use strict";

  var LS_KEY  = "binh_ap_luc";
  var SHEET   = "binh_ap_luc";

  /* ── ĐƠN VỊ QUẢN LÝ, lấy từ DANH MỤC DÙNG CHUNG (assets/don-vi.js) ──
     Trang này trước đây chia thành các bảng riêng theo đơn vị. Nay chỉ MỘT
     bảng, đơn vị là một CỘT và chọn từ droplist. Danh sách droplist do Admin
     quản lý ở Quản trị hệ thống → Danh mục đơn vị (cột "Bình áp lực").

     Bản ghi vẫn lưu `section` = MÃ đơn vị ("cang_bien", "xuong_sua_chua"),
     đúng bằng mã trong danh mục → dữ liệu cũ dùng nguyên, không phải chuyển
     đổi. Đổi tên đơn vị chỉ đổi nhãn hiển thị, khoá giữ nguyên. */
  function _units() {
    var out = (window.HSE_UNITS ? HSE_UNITS.list("binh-ap-luc", { excludeGop: true }) : [])
      .map(function (ten) { return { key: HSE_UNITS.maOf(ten), label: ten }; });
    /* Giữ lại đơn vị chỉ còn trong dữ liệu (đã bỏ tích / đã ngừng) để thiết bị
       đã nhập không biến mất và sửa lại được. */
    var co = {}; out.forEach(function (o) { co[o.key] = true; });
    _load().forEach(function (r) {
      var k = r && r.section;
      if (!k || co[k]) return;
      co[k] = true;
      var u = window.HSE_UNITS ? HSE_UNITS.byMa(k) : null;
      out.push({ key: k, label: (u ? u.ten : k) + " (không còn dùng)", cu: true });
    });
    return out;
  }
  function _unitLabel(key) {
    if (!key) return "—";
    var us = _units();
    for (var i = 0; i < us.length; i++) if (us[i].key === key) return us[i].label;
    return key;
  }
  /* Thứ tự đơn vị theo danh mục — để thiết bị cùng đơn vị nằm liền nhau */
  function _unitRank(key) {
    var us = _units();
    for (var i = 0; i < us.length; i++) if (us[i].key === key) return i;
    return 999;
  }
  /* Toàn bộ thiết bị, sắp theo đơn vị rồi theo thứ tự kéo–thả trong đơn vị */
  function _rowsSorted(loc) {
    return _load()
      .filter(function (r) { return !loc || r.section === loc; })
      .sort(function (x, y) {
        var d = _unitRank(x.section) - _unitRank(y.section);
        if (d !== 0) return d;
        return (x.order || 0) - (y.order || 0);
      });
  }

  /* ── STATE ── */
  var _container = null;
  var _canEdit   = false;
  var _editMode  = false;   // chế độ điều chỉnh (reorder + sửa nhanh)
  var _filterUnit = "";     // mã đơn vị đang lọc ("" = tất cả)
  var _dragging  = null;    // element đang kéo

  /* ── LOCAL STORAGE ── */
  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
  }
  function _save(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }
  function _bySection(sec) {
    return _load().filter(function (r) { return r.section === sec; })
                  .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /* ── TÍNH NGÀY KIỂM ĐỊNH TIẾP THEO ── */
  function _calcNextDate(ngayGanNhat, namVanHanh, anMon, chayNo) {
    if (!ngayGanNhat || !namVanHanh) return "";
    var base = HSEDate.parse(ngayGanNhat);   /* nhận mọi định dạng */
    if (!base) return "";
    var d = base.getDate(), m = base.getMonth(), y = base.getFullYear();

    var nam = parseInt(namVanHanh);
    if (isNaN(nam)) return "";
    var tuoi = new Date().getFullYear() - nam;
    var dacBiet = !!(anMon || chayNo);

    var them;
    if (tuoi > 24 || (tuoi > 12 && dacBiet)) {
      them = 1;
    } else if (tuoi > 12 || dacBiet) {
      them = 2;
    } else {
      them = 3;
    }

    var next = new Date(y + them, m, d);
    return next.getFullYear() + "-" +
           String(next.getMonth() + 1).padStart(2, "0") + "-" +
           String(next.getDate()).padStart(2, "0");   /* trả về ISO YYYY-MM-DD */
  }

  /* ── TRẠNG THÁI KIỂM ĐỊNH ── */
  function _kdStatus(ngayTiepTheo) {
    if (!ngayTiepTheo) return null;
    var next = HSEDate.parse(ngayTiepTheo);   /* nhận mọi định dạng */
    if (!next) return null;
    var now  = new Date();
    var diff = (next - now) / (1000 * 60 * 60 * 24); // số ngày còn lại
    if (diff < 0)   return { cls: "kd-qua-han",  label: "Quá hạn" };
    if (diff <= 60) return { cls: "kd-sap-han",  label: "Sắp hạn" };
    return              { cls: "kd-con-han",  label: "Còn hạn" };
  }

  /* ── NORMALIZE: mọi định dạng → ISO YYYY-MM-DD (định dạng lưu trữ chuẩn) ── */
  function _normalizeRow(row) {
    row.ngay_kd_gan_nhat  = HSEDate.toISO(row.ngay_kd_gan_nhat);
    row.ngay_kd_tiep_theo = HSEDate.toISO(row.ngay_kd_tiep_theo);
    return row;
  }

  /* ── SYNC SHEETS ── */
  function _pullFromSheets(cb) {
    if (typeof DB === "undefined" || !DB.isReady()) { if (cb) cb(); return; }
    DB.getAll(SHEET).then(function (rows) {
      if (rows && rows.length) {
        _save(rows.map(_normalizeRow));
      }
      if (cb) cb();
    }).catch(function () { if (cb) cb(); });
  }

  function _pushInsert(rec) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.insert(SHEET, rec).catch(function () {});
  }
  function _pushUpdate(rec) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.update(SHEET, rec.id, rec).catch(function () {});
  }
  function _pushDelete(id) {
    if (typeof DB === "undefined" || !DB.isReady()) return;
    DB.delete(SHEET, id).catch(function () {});
  }

  /* ── ID ── */
  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ══════════════════════════════════════════
     RENDER ENTRY POINT
  ══════════════════════════════════════════ */
  /* Danh mục tải xong từ Supabase (hoặc Admin vừa sửa) → vẽ lại các section */
  if (window.HSE_UNITS) {
    HSE_UNITS.onChange(function () {
      if (document.getElementById("bal-sections")) _renderTable();
    });
  }

  window.renderBinhApLuc = function (container, canEdit) {
    _container = container;
    _canEdit   = !!canEdit;
    _editMode  = false;

    /* Pull từ Sheets khi load trang, rồi render */
    _pullFromSheets(function () {
      _render();
    });
  };

  /* ── RENDER CHÍNH ── */
  function _render() {
    _container.innerHTML = "";
    _container.appendChild(_buildStyles());

    /* Toolbar */
    var toolbar = document.createElement("div");
    toolbar.className = "bal-toolbar";

    /* Nút Làm mới */
    var btnRefresh = document.createElement("button");
    btnRefresh.className = "bal-btn bal-btn-outline";
    btnRefresh.innerHTML = "🔄 Làm mới";
    btnRefresh.title = "Tải lại dữ liệu từ Google Sheets";
    btnRefresh.onclick = function () {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = "⏳ Đang tải...";
      _pullFromSheets(function () {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = "🔄 Làm mới";
        _renderTable();
      });
    };
    toolbar.appendChild(btnRefresh);

    if (_canEdit) {
      /* Nút Chế độ điều chỉnh */
      var btnEdit = document.createElement("button");
      btnEdit.id = "bal-toggle-edit";
      btnEdit.className = _editMode ? "bal-btn bal-btn-primary" : "bal-btn bal-btn-outline";
      btnEdit.innerHTML = _editMode ? "✅ Xong" : "✏️ Chế độ điều chỉnh";
      btnEdit.onclick = function () {
        _editMode = !_editMode;
        _renderTable();
        var b = document.getElementById("bal-toggle-edit");
        if (b) {
          b.className  = _editMode ? "bal-btn bal-btn-primary" : "bal-btn bal-btn-outline";
          b.innerHTML  = _editMode ? "✅ Xong" : "✏️ Chế độ điều chỉnh";
        }
      };
      toolbar.appendChild(btnEdit);
    }

    /* Bộ lọc theo đơn vị — thay cho việc trước đây chia thành nhiều bảng */
    var sel = document.createElement("select");
    sel.id = "bal-filter-unit";
    sel.className = "bal-input";
    sel.style.cssText = "width:auto;min-width:180px;padding:7px 10px;";
    sel.onchange = function () { _filterUnit = this.value; _renderTable(); };
    toolbar.appendChild(sel);

    _container.appendChild(toolbar);

    /* Chú thích trạng thái */
    var legend = document.createElement("div");
    legend.className = "bal-legend";
    legend.innerHTML =
      '<span class="kd-badge kd-con-han">Còn hạn</span>' +
      '<span class="kd-badge kd-sap-han">Sắp hạn (≤ 60 ngày)</span>' +
      '<span class="kd-badge kd-qua-han">Quá hạn</span>';
    _container.appendChild(legend);

    /* Vùng các section */
    var sectionsWrap = document.createElement("div");
    sectionsWrap.id = "bal-sections";
    _container.appendChild(sectionsWrap);

    _renderTable();
  }

  function _renderTable() {
    var wrap = document.getElementById("bal-sections");
    if (!wrap) return;
    var units = _units();

    /* Đổ lại bộ lọc đơn vị (giữ lựa chọn hiện tại nếu còn hợp lệ) */
    var sel = document.getElementById("bal-filter-unit");
    if (sel) {
      if (!units.some(function (u) { return u.key === _filterUnit; })) _filterUnit = "";
      sel.innerHTML = '<option value="">— Tất cả đơn vị —</option>' +
        units.map(function (u) {
          return '<option value="' + _esc(u.key) + '"' + (u.key === _filterUnit ? " selected" : "") + '>' +
                 _esc(u.label) + "</option>";
        }).join("");
      sel.style.display = units.length ? "" : "none";
    }

    wrap.innerHTML = "";
    if (!units.length) {
      wrap.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:13px">' +
        "Chưa có đơn vị nào được gán cho mục Bình áp lực.<br>" +
        "Admin vào <b>Quản trị hệ thống → Danh mục đơn vị</b>, tích ô cột <b>Bình áp lực</b>." +
        "</div>";
      return;
    }
    wrap.appendChild(_buildTable(_rowsSorted(_filterUnit)));
  }

  /* ── BUILD BẢNG DUY NHẤT ── */
  function _buildTable(rows) {
    var box = document.createElement("div");
    box.className = "bal-section";

    /* Header */
    var hdr = document.createElement("div");
    hdr.className = "bal-section-hdr";
    hdr.innerHTML =
      '<span class="bal-section-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg> Danh sách bình áp lực' +
        (_filterUnit ? " — " + _esc(_unitLabel(_filterUnit)) : "") + "</span>" +
      '<span class="bal-section-count">' + rows.length + " thiết bị</span>";

    if (_canEdit && _editMode) {
      var btnAdd = document.createElement("button");
      btnAdd.className = "bal-btn bal-btn-sm bal-btn-primary";
      btnAdd.innerHTML = "+ Thêm thiết bị";
      btnAdd.onclick = function () { _openModal(null); };
      hdr.appendChild(btnAdd);
    }
    box.appendChild(hdr);

    /* Bảng */
    var tableWrap = document.createElement("div");
    tableWrap.className = "bal-table-wrap";

    var table = document.createElement("table");
    table.className = "bal-table";

    var thead = document.createElement("thead");
    thead.innerHTML =
      "<tr>" +
      (_editMode ? "<th class='col-drag'></th>" : "") +
      "<th class='col-no'>Nº</th>" +
      "<th class='col-ten'>Tên thiết bị</th>" +
      "<th class='col-donvi'>Đơn vị quản lý</th>" +
      "<th class='col-vitri'>Vị trí lắp đặt</th>" +
      "<th class='col-thongso'>Thông số chính</th>" +
      "<th class='col-nam'>Năm vận hành</th>" +
      "<th class='col-sodangky'>Số đăng ký</th>" +
      "<th class='col-kd'>Ngày KĐ gần nhất</th>" +
      "<th class='col-kd'>Ngày KĐ tiếp theo</th>" +
      "<th class='col-ghichu'>Ghi chú</th>" +
      (_editMode ? "<th class='col-action'></th>" : "") +
      "</tr>";
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    tbody.id = "bal-tbody";

    if (!rows.length) {
      var emptyRow = document.createElement("tr");
      var emptyTd = document.createElement("td");
      emptyTd.colSpan = _editMode ? 12 : 10;
      emptyTd.className = "bal-empty";
      emptyTd.textContent = "Chưa có thiết bị nào. " + (_editMode ? "Bấm '+ Thêm thiết bị' để thêm." : "");
      emptyRow.appendChild(emptyTd);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach(function (row, idx) {
        tbody.appendChild(_buildRow(row, idx + 1));
      });
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    box.appendChild(tableWrap);
    return box;
  }

  /* ── BUILD 1 ROW ── */
  function _buildRow(rec, no) {
    var tr = document.createElement("tr");
    tr.dataset.id  = rec.id;
    tr.dataset.sec = rec.section || "";
    if (_editMode) tr.className = "bal-row-draggable";

    var nextDate = _calcNextDate(rec.ngay_kd_gan_nhat, rec.nam_van_hanh, rec.moi_chat_an_mon, rec.moi_chat_chay_no);
    var status   = _kdStatus(nextDate);

    /* Cột kéo thả */
    if (_editMode) {
      var tdDrag = document.createElement("td");
      tdDrag.className = "col-drag";
      tdDrag.innerHTML = "⠿";
      tdDrag.title = "Kéo để sắp xếp (trong cùng một đơn vị)";
      tr.appendChild(tdDrag);
      _wireDrag(tr);
    }

    function td(content, cls) {
      var el = document.createElement("td");
      if (cls) el.className = cls;
      el.innerHTML = content;
      return el;
    }

    tr.appendChild(td(no, "col-no"));
    tr.appendChild(td(_esc(rec.ten_thiet_bi || ""), "col-ten"));
    var nhan = _unitLabel(rec.section), ghi = "";
    var _i = nhan.indexOf(" (không còn dùng)");
    if (_i >= 0) { ghi = '<br><span style="font-size:11px;color:#9a6700">không còn dùng</span>'; nhan = nhan.slice(0, _i); }
    tr.appendChild(td(_esc(nhan) + ghi, "col-donvi"));
    tr.appendChild(td(_esc(rec.vi_tri || ""), "col-vitri"));

    /* Thông số chính */
    var thongSo = "";
    if (rec.v_m3)    thongSo += "V = " + rec.v_m3 + " m³";
    if (rec.plv_kgcm2) thongSo += (thongSo ? "<br>" : "") + "P<sub>lv</sub> = " + rec.plv_kgcm2 + " kg/cm²";
    tr.appendChild(td(thongSo || "—", "col-thongso"));

    tr.appendChild(td(rec.nam_van_hanh || "—", "col-nam"));
    tr.appendChild(td(_esc(rec.so_dang_ky || "—"), "col-sodangky"));
    tr.appendChild(td(rec.ngay_kd_gan_nhat ? HSEDate.fmt(rec.ngay_kd_gan_nhat) : "—", "col-kd"));

    /* Ngày KĐ tiếp theo + badge trạng thái */
    var nextCell = document.createElement("td");
    nextCell.className = "col-kd";
    if (nextDate) {
      nextCell.innerHTML = HSEDate.fmt(nextDate);
      if (status) {
        var badge = document.createElement("span");
        badge.className = "kd-badge " + status.cls;
        badge.textContent = status.label;
        nextCell.appendChild(document.createElement("br"));
        nextCell.appendChild(badge);
      }
    } else {
      nextCell.textContent = "—";
    }
    tr.appendChild(nextCell);

    /* Ghi chú */
    var ghiChu = [];
    if (rec.moi_chat_an_mon) ghiChu.push('<span class="tag-moi-chat">Ăn mòn KL</span>');
    if (rec.moi_chat_chay_no) ghiChu.push('<span class="tag-moi-chat">Cháy nổ</span>');
    if (rec.ghi_chu) ghiChu.push(_esc(rec.ghi_chu));
    tr.appendChild(td(ghiChu.join(" ") || "—", "col-ghichu"));

    /* Cột action (edit mode) */
    if (_editMode) {
      var tdAct = document.createElement("td");
      tdAct.className = "col-action";

      var btnSua = document.createElement("button");
      btnSua.className = "bal-btn bal-btn-xs bal-btn-outline";
      btnSua.textContent = "Sửa";
      btnSua.onclick = function () { _openModal(rec); };

      var btnXoa = document.createElement("button");
      btnXoa.className = "bal-btn bal-btn-xs bal-btn-danger";
      btnXoa.textContent = "Xoá";
      btnXoa.onclick = function () { _deleteRow(rec.id); };

      tdAct.appendChild(btnSua);
      tdAct.appendChild(btnXoa);
      tr.appendChild(tdAct);
    }

    return tr;
  }

  /* ── DRAG & DROP ── */
  function _wireDrag(tr) {
    tr.draggable = true;
    tr.addEventListener("dragstart", function (e) {
      _dragging = tr;
      tr.classList.add("bal-dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    tr.addEventListener("dragend", function () {
      tr.classList.remove("bal-dragging");
      _dragging = null;
      document.querySelectorAll(".bal-drag-over").forEach(function (el) {
        el.classList.remove("bal-drag-over");
      });
    });
    tr.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (_dragging && _dragging !== tr && _dragging.dataset.sec === tr.dataset.sec) {
        tr.classList.add("bal-drag-over");
      }
    });
    tr.addEventListener("dragleave", function () {
      tr.classList.remove("bal-drag-over");
    });
    tr.addEventListener("drop", function (e) {
      e.preventDefault();
      tr.classList.remove("bal-drag-over");
      if (!_dragging || _dragging === tr) return;
      if (_dragging.dataset.sec !== tr.dataset.sec) return;

      var tbody = tr.parentNode;
      var rows  = Array.from(tbody.querySelectorAll("tr[data-id]"));
      var fromIdx = rows.indexOf(_dragging);
      var toIdx   = rows.indexOf(tr);
      if (fromIdx < toIdx) {
        tbody.insertBefore(_dragging, tr.nextSibling);
      } else {
        tbody.insertBefore(_dragging, tr);
      }

      /* Cập nhật order theo thứ tự DOM mới */
      _saveNewOrder(tbody, tr.dataset.sec);
    });
  }

  /* Đánh lại `order` cho ĐÚNG đơn vị vừa kéo, theo thứ tự DOM mới.
     Bảng chỉ có một, nên phải đếm riêng trong từng đơn vị. */
  function _saveNewOrder(tbody, secKey) {
    var all  = _load();
    var rows = Array.from(tbody.querySelectorAll("tr[data-id]"));
    var i = 0;
    rows.forEach(function (tr) {
      if (tr.dataset.sec !== secKey) return;
      var rec = all.find(function (r) { return r.id === tr.dataset.id; });
      if (rec) {
        rec.order     = i;
        rec.updatedAt = new Date().toISOString();
        _pushUpdate(rec);
      }
      i++;
    });
    _save(all);
    /* Đánh lại số thứ tự hiển thị cho toàn bảng */
    rows.forEach(function (tr, idx) {
      var noCell = tr.querySelector(".col-no");
      if (noCell) noCell.textContent = idx + 1;
    });
  }

  /* ── CRUD ── */
  function _deleteRow(id) {
    if (!confirm("Xoá thiết bị này?")) return;
    var all = _load().filter(function (r) { return r.id !== id; });
    _save(all);
    _pushDelete(id);
    _renderTable();
  }

  /* ── MODAL THÊM / SỬA ── */
  function _openModal(rec) {
    var isNew = !rec;
    var units = _units();
    if (isNew) {
      /* Đơn vị mặc định = đơn vị đang lọc, không thì đơn vị đầu danh sách */
      var mac = _filterUnit || (units[0] ? units[0].key : "");
      rec = { id: _genId(), section: mac, order: _bySection(mac).length };
    }

    /* Tính ngày tiếp theo để hiển thị preview */
    function previewNext() {
      var ngay  = HSEDate.getValue(document.getElementById("bal-inp-ngaykd"));
      var nam   = document.getElementById("bal-inp-nam").value;
      var anMon = document.getElementById("bal-inp-anmon").checked;
      var chayNo= document.getElementById("bal-inp-chayno").checked;
      var next  = _calcNextDate(ngay, nam, anMon, chayNo);
      var el = document.getElementById("bal-preview-next");
      if (el) el.textContent = next ? HSEDate.fmt(next) : "—";
    }

    var overlay = document.createElement("div");
    overlay.className = "bal-overlay";

    var modal = document.createElement("div");
    modal.className = "bal-modal";

    modal.innerHTML =
      '<div class="bal-modal-hdr">' +
        '<span>' + (isNew ? "➕ Thêm thiết bị" : "✏️ Sửa thiết bị") + '</span>' +
        '<button class="bal-modal-close" id="bal-modal-close"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
      '</div>' +
      '<div class="bal-modal-body">' +
        '<div class="bal-form-row">' +
          '<label>Đơn vị quản lý</label>' +
          '<select id="bal-inp-donvi" class="bal-input">' +
            units.map(function (u) {
              return '<option value="' + _esc(u.key) + '"' + (u.key === rec.section ? " selected" : "") + '>' +
                     _esc(u.label) + '</option>';
            }).join("") +
          '</select>' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Tên thiết bị</label>' +
          '<input id="bal-inp-ten" class="bal-input" type="text" value="' + _esc(rec.ten_thiet_bi || "") + '">' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Vị trí lắp đặt</label>' +
          '<input id="bal-inp-vitri" class="bal-input" type="text" value="' + _esc(rec.vi_tri || "") + '">' +
        '</div>' +
        '<div class="bal-form-row bal-form-row-2">' +
          '<div>' +
            '<label>V (m³)</label>' +
            '<input id="bal-inp-v" class="bal-input" type="number" step="0.01" min="0" value="' + (rec.v_m3 || "") + '">' +
          '</div>' +
          '<div>' +
            '<label>P<sub>lv</sub> (kg/cm²)</label>' +
            '<input id="bal-inp-plv" class="bal-input" type="number" step="0.01" min="0" value="' + (rec.plv_kgcm2 || "") + '">' +
          '</div>' +
        '</div>' +
        '<div class="bal-form-row bal-form-row-2">' +
          '<div>' +
            '<label>Năm đưa vào vận hành</label>' +
            '<input id="bal-inp-nam" class="bal-input" type="number" min="1900" max="2100" value="' + (rec.nam_van_hanh || "") + '">' +
          '</div>' +
          '<div>' +
            '<label>Số đăng ký</label>' +
            '<input id="bal-inp-sodangky" class="bal-input" type="text" value="' + _esc(rec.so_dang_ky || "") + '">' +
          '</div>' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Ngày kiểm định gần nhất</label>' +
          '<input id="bal-inp-ngaykd" class="bal-input" type="date" value="' + HSEDate.toISO(rec.ngay_kd_gan_nhat || "") + '">' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Ngày kiểm định tiếp theo <span style="font-weight:400;color:#6b7c93">(tự động)</span></label>' +
          '<div class="bal-next-date-preview" id="bal-preview-next">' + (rec.ngay_kd_tiep_theo ? HSEDate.fmt(rec.ngay_kd_tiep_theo) : "—") + '</div>' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Ghi chú – Môi chất</label>' +
          '<div class="bal-checkbox-row">' +
            '<label class="bal-check-label">' +
              '<input id="bal-inp-anmon" type="checkbox"' + (rec.moi_chat_an_mon ? " checked" : "") + '> Môi chất ăn mòn kim loại' +
            '</label>' +
            '<label class="bal-check-label">' +
              '<input id="bal-inp-chayno" type="checkbox"' + (rec.moi_chat_chay_no ? " checked" : "") + '> Môi chất cháy nổ' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Ghi chú khác</label>' +
          '<input id="bal-inp-ghichu" class="bal-input" type="text" value="' + _esc(rec.ghi_chu || "") + '">' +
        '</div>' +
      '</div>' +
      '<div class="bal-modal-ftr">' +
        '<button class="bal-btn bal-btn-outline" id="bal-modal-cancel">Huỷ</button>' +
        '<button class="bal-btn bal-btn-primary" id="bal-modal-save"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Lưu</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    /* Gắn flatpickr cho ô ngày (hiển thị DD/MM/YYYY đồng nhất, lưu ISO) */
    if (window.HSEDate) HSEDate.attachAll(modal);

    /* Wire preview */
    ["bal-inp-ngaykd","bal-inp-nam","bal-inp-anmon","bal-inp-chayno"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", previewNext);
    });
    previewNext();

    /* Close */
    function closeModal() { document.body.removeChild(overlay); }
    document.getElementById("bal-modal-close").onclick  = closeModal;
    document.getElementById("bal-modal-cancel").onclick = closeModal;
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });

    /* Save */
    document.getElementById("bal-modal-save").onclick = function () {
      var ngayISO     = HSEDate.getValue(document.getElementById("bal-inp-ngaykd"));
      var nam         = document.getElementById("bal-inp-nam").value;
      var anMon       = document.getElementById("bal-inp-anmon").checked;
      var chayNo      = document.getElementById("bal-inp-chayno").checked;

      var donViMoi = document.getElementById("bal-inp-donvi").value;
      /* Đổi đơn vị → xếp xuống cuối danh sách của đơn vị mới */
      var thuTu = (donViMoi === rec.section) ? rec.order : _bySection(donViMoi).length;

      var updated = {
        id:                rec.id,
        section:           donViMoi,
        order:             thuTu,
        ten_thiet_bi:      document.getElementById("bal-inp-ten").value.trim(),
        vi_tri:            document.getElementById("bal-inp-vitri").value.trim(),
        v_m3:              document.getElementById("bal-inp-v").value,
        plv_kgcm2:         document.getElementById("bal-inp-plv").value,
        nam_van_hanh:      nam,
        so_dang_ky:        document.getElementById("bal-inp-sodangky").value.trim(),
        ngay_kd_gan_nhat:  ngayISO,
        ngay_kd_tiep_theo: _calcNextDate(ngayISO, nam, anMon, chayNo),
        moi_chat_an_mon:   anMon,
        moi_chat_chay_no:  chayNo,
        ghi_chu:           document.getElementById("bal-inp-ghichu").value.trim(),
        updatedAt:         new Date().toISOString()
      };

      if (!updated.section)      { alert("Vui lòng chọn đơn vị quản lý."); return; }
      if (!updated.ten_thiet_bi) { alert("Vui lòng nhập tên thiết bị."); return; }

      var all = _load();
      if (isNew) {
        updated.createdBy  = typeof HSE !== "undefined" && HSE.currentUser ? HSE.currentUser().username : "";
        updated.createdAt = new Date().toISOString();
        all.push(updated);
        _save(all);
        _pushInsert(updated);
      } else {
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === updated.id) { all[i] = updated; break; }
        }
        _save(all);
        _pushUpdate(updated);
      }

      closeModal();
      _renderTable();
    };
  }

  /* ── ESCAPE HTML ── */
  function _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── STYLES ── */
  function _buildStyles() {
    var style = document.createElement("style");
    style.textContent = [
      /* Layout */
      ".bal-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}",
      ".bal-legend{display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;}",
      ".bal-section{background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);margin-bottom:28px;overflow:hidden;}",
      ".bal-section-hdr{display:flex;align-items:center;gap:12px;padding:14px 18px;background:#dde6f3;border-bottom:1px solid #cdd6e8;}",
      ".bal-section-title{font-weight:700;color:#003087;font-size:15px;flex:1;}",
      ".bal-section-count{font-size:12px;color:#6b7c93;background:#fff;border-radius:12px;padding:2px 10px;}",

      /* Table */
      ".bal-table-wrap{overflow-x:hidden;}",
      ".bal-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px;}",
      ".bal-table th{background:#dde6f3;color:#003087;font-weight:600;padding:9px 10px;text-align:left;white-space:nowrap;border-bottom:2px solid #cdd6e8;overflow:hidden;}",
      ".bal-table td{padding:8px 10px;border-bottom:1px solid #eef0f4;vertical-align:middle;overflow:hidden;word-break:break-word;overflow-wrap:anywhere;}",
      ".bal-table tbody tr:hover td{background:#eef3fb;}",
      ".bal-table th, .bal-table td{border-right:1px solid #e6ebf5;}",
      ".bal-table th:last-child, .bal-table td:last-child{border-right:none;}",
      ".bal-empty{text-align:center;color:#6b7c93;padding:24px!important;font-style:italic;}",

      /* Col widths */
      ".col-no{width:36px;text-align:center;color:#6b7c93;}",
      ".col-drag{width:26px;text-align:center;cursor:grab;color:#aaa;font-size:16px;user-select:none;}",
      ".col-ten{width:160px;}",
      ".col-vitri{width:130px;}",
      ".col-donvi{width:145px;color:#334155;white-space:normal;}",
      ".col-thongso{width:130px;}",
      ".col-nam{width:80px;}",
      ".col-sodangky{width:90px;}",
      ".col-kd{width:100px;}",
      ".col-ghichu{width:120px;}",
      ".col-action{width:60px;text-align:right;}",

      /* Drag */
      ".bal-row-draggable{cursor:default;}",
      ".bal-dragging{opacity:0.4;}",
      ".bal-drag-over td{background:#dceaf7!important;}",

      /* Buttons */
      ".bal-btn{border:none;border-radius:7px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s;}",
      ".bal-btn-primary{background:#0060B6;color:#fff;} .bal-btn-primary:hover{background:#003087;}",
      ".bal-btn-outline{background:#fff;color:#003087;border:1.5px solid #cdd6e8;} .bal-btn-outline:hover{background:#eef3fb;}",
      ".bal-btn-danger{background:#fff;color:#c0392b;border:1.5px solid #f5c6cb;} .bal-btn-danger:hover{background:#fdedec;}",
      ".bal-btn-sm{padding:5px 12px;font-size:12.5px;}",
      ".bal-btn-xs{padding:3px 9px;font-size:12px;margin-left:4px;}",

      /* KĐ badges */
      ".kd-badge{display:inline-block;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:600;margin-top:3px;}",
      ".kd-con-han{background:#eafaf1;color:#1a7a3c;}",
      ".kd-sap-han{background:#fef5e4;color:#e68900;}",
      ".kd-qua-han{background:#fdedec;color:#c0392b;}",

      /* Tag môi chất */
      ".tag-moi-chat{display:inline-block;background:#fef5e4;color:#e68900;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:600;margin:1px 2px;}",

      /* Modal */
      ".bal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;}",
      ".bal-modal{background:#fff;border-radius:12px;width:560px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2);}",
      ".bal-modal-hdr{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eee;font-weight:700;font-size:15px;color:#003087;}",
      ".bal-modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:#6b7c93;}",
      ".bal-modal-body{padding:20px;overflow-y:auto;flex:1;}",
      ".bal-modal-ftr{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #eee;}",
      ".bal-form-row{margin-bottom:14px;}",
      ".bal-form-row label{display:block;font-size:12.5px;font-weight:600;color:#003087;margin-bottom:5px;}",
      ".bal-form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}",
      ".bal-input{width:100%;padding:8px 10px;border:1.5px solid #cdd6e8;border-radius:7px;font-size:13px;box-sizing:border-box;outline:none;}",
      ".bal-input:focus{border-color:#0060B6;box-shadow:0 0 0 3px rgba(0,96,182,0.1);}",
      ".bal-next-date-preview{padding:8px 10px;background:#eef3fb;border-radius:7px;font-size:14px;font-weight:600;color:#003087;min-height:36px;display:flex;align-items:center;}",
      ".bal-checkbox-row{display:flex;gap:20px;flex-wrap:wrap;}",
      ".bal-check-label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400;cursor:pointer;}",
    ].join("\n");
    return style;
  }

})();
