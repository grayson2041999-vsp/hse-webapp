/* =========================================================
   THIET-BI-NANG.JS
   Module quản lý Thiết bị nâng – Quản lý thiết bị HSE
   Dựng theo đúng khuôn assets/binh-ap-luc.js:
   - Một bảng duy nhất, đơn vị là một CỘT lấy từ danh mục dùng chung
   - Lọc ngay tại tiêu đề cột (Loại thiết bị · Đơn vị quản lý)
   - CRUD + reorder (drag & drop) + xuất Excel
   - Sync Supabase: pull khi load trang, push sau mỗi thao tác

   KHÁC BÌNH ÁP LỰC:
   - Chu kỳ kiểm định & thử tải: 1 NĂM kể từ ngày KĐ&TT gần nhất, người dùng
     sửa tay được (cột ngay_kd_tu_chinh giữ dấu vết đã sửa).
   - Không có môi chất; thay bằng Loại thiết bị (có lọc) và Số chế tạo.
   - Hai cột tải trọng nhập bằng SỐ, đơn vị tấn.
   ========================================================= */
(function () {
  "use strict";

  var LS_KEY = "thiet_bi_nang";
  var SHEET  = "thiet_bi_nang";
  var PAGE   = "thiet-bi-nang";      /* slug điểm sử dụng trong danh mục đơn vị */

  /* Chu kỳ kiểm định & thử tải, tính bằng NĂM. Đổi con số ở đây là đổi toàn
     bộ cách tính — không rải rác nơi khác. */
  var CHU_KY_NAM = 1;

  /* Danh mục loại thiết bị nâng. Bản ghi cũ mang loại không còn trong danh
     sách vẫn hiện nguyên, không bị mất. */
  var LOAI_TB = ["Cầu trục", "Cổng trục", "Cần trục", "Palăng", "Tời",
                 "Xe nâng", "Thang nâng", "Sàn nâng", "Khác"];

  /* ── ĐƠN VỊ QUẢN LÝ, lấy từ DANH MỤC DÙNG CHUNG (assets/don-vi.js) ──
     Admin tích ô cột "Thiết bị nâng" ở Quản trị hệ thống → Danh mục đơn vị.
     Bản ghi lưu `section` = MÃ đơn vị, đổi tên đơn vị không ảnh hưởng dữ liệu. */
  function _units() {
    var out = (window.HSE_UNITS ? HSE_UNITS.list(PAGE, { excludeGop: true }) : [])
      .map(function (ten) { return { key: HSE_UNITS.maOf(ten), label: ten }; });
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
  function _unitRank(key) {
    var us = _units();
    for (var i = 0; i < us.length; i++) if (us[i].key === key) return i;
    return 999;
  }

  /* Các loại đang thực sự có trong dữ liệu — dùng đổ droplist lọc */
  function _loaiDangCo() {
    var co = {}, out = [];
    _load().forEach(function (r) { if (r.loai_thiet_bi) co[r.loai_thiet_bi] = true; });
    LOAI_TB.forEach(function (l) { if (co[l]) { out.push(l); delete co[l]; } });
    Object.keys(co).sort().forEach(function (l) { out.push(l); });
    return out;
  }

  /* Toàn bộ thiết bị, sắp theo đơn vị rồi theo thứ tự kéo–thả trong đơn vị */
  function _rowsSorted(loc, loai) {
    return _load()
      .filter(function (r) {
        if (loc && r.section !== loc) return false;
        if (loai && (r.loai_thiet_bi || "") !== loai) return false;
        return true;
      })
      .sort(function (x, y) {
        var d = _unitRank(x.section) - _unitRank(y.section);
        if (d !== 0) return d;
        return (x.order || 0) - (y.order || 0);
      });
  }

  /* ── STATE ── */
  var _container  = null;
  var _canEdit    = false;
  var _editMode   = false;
  var _filterUnit = "";
  var _filterLoai = "";
  var _dragging   = null;

  /* ── ÉP KIỂU BOOLEAN ──
     Server có thể trả về chuỗi "false", mà trong JavaScript "false" là TRUTHY.
     Mọi giá trị boolean đọc lên đều phải đi qua đây. */
  function _toBool(v) {
    if (typeof v === "boolean") return v;
    if (v === null || v === undefined) return false;
    if (typeof v === "number") return v !== 0;
    var t = String(v).trim().toLowerCase();
    if (t === "" || t === "false" || t === "0" || t === "no" || t === "n" ||
        t === "không" || t === "khong" || t === "null" || t === "undefined") return false;
    return true;
  }
  function _fixBools(r) {
    if (r && typeof r === "object") r.ngay_kd_tu_chinh = _toBool(r.ngay_kd_tu_chinh);
    return r;
  }

  /* ── LOCAL STORAGE ── */
  function _load() {
    var arr;
    try { arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
    return Array.isArray(arr) ? arr.map(_fixBools) : [];
  }
  function _save(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
  function _bySection(sec) {
    return _load().filter(function (r) { return r.section === sec; })
                  .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /* ── TÍNH NGÀY KIỂM ĐỊNH & THỬ TẢI TIẾP THEO ──
     Chu kỳ cố định CHU_KY_NAM năm kể từ ngày KĐ&TT gần nhất. */
  function _calcNextDate(ngayGanNhat) {
    if (!ngayGanNhat) return "";
    var base = HSEDate.parse(ngayGanNhat);
    if (!base) return "";
    var next = new Date(base.getFullYear() + CHU_KY_NAM, base.getMonth(), base.getDate());
    return next.getFullYear() + "-" +
           String(next.getMonth() + 1).padStart(2, "0") + "-" +
           String(next.getDate()).padStart(2, "0");
  }

  /* Ngày dùng để HIỂN THỊ:
     · ngay_kd_tu_chinh = true → giữ đúng ngày người dùng đã nhập
     · ngược lại               → tính lại, nên sửa ngày gần nhất là thấy đổi ngay */
  function _nextDateOf(rec) {
    if (rec.ngay_kd_tu_chinh && rec.ngay_kd_tiep_theo) return rec.ngay_kd_tiep_theo;
    return _calcNextDate(rec.ngay_kd_gan_nhat);
  }

  /* ── TRẠNG THÁI KIỂM ĐỊNH ── */
  function _kdStatus(ngayTiepTheo) {
    if (!ngayTiepTheo) return null;
    var next = HSEDate.parse(ngayTiepTheo);
    if (!next) return null;
    var diff = (next - new Date()) / (1000 * 60 * 60 * 24);
    if (diff < 0)   return { cls: "kd-qua-han", label: "Quá hạn" };
    if (diff <= 60) return { cls: "kd-sap-han", label: "Sắp hạn" };
    return              { cls: "kd-con-han", label: "Còn hạn" };
  }

  /* ── NORMALIZE: mọi định dạng ngày → ISO YYYY-MM-DD ── */
  function _normalizeRow(row) {
    row.ngay_kd_gan_nhat  = HSEDate.toISO(row.ngay_kd_gan_nhat);
    row.ngay_kd_tiep_theo = HSEDate.toISO(row.ngay_kd_tiep_theo);
    return _fixBools(row);
  }

  /* ── SYNC ── */
  function _pullFromSheets(cb) {
    if (typeof DB === "undefined" || !DB.isReady()) { if (cb) cb(); return; }
    DB.getAll(SHEET).then(function (rows) {
      if (rows && rows.length) _save(rows.map(_normalizeRow));
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

  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ══════════════════════════════════════════
     RENDER ENTRY POINT
  ══════════════════════════════════════════ */
  if (window.HSE_UNITS) {
    HSE_UNITS.onChange(function () {
      if (document.getElementById("tbn-sections")) _renderTable();
    });
  }

  window.renderThietBiNang = function (container, canEdit) {
    _container = container;
    _canEdit   = !!canEdit;
    _editMode  = false;
    _pullFromSheets(function () { _render(); });
  };

  /* ══════════════════════════════════════════
     BIỂU ĐỒ TRÒN — xem chú thích màu ở binh-ap-luc.js.
     Pastel chỉ an toàn với 3 màu; đơn vị thứ 4 trở đi gộp "Khác" màu xám.
  ══════════════════════════════════════════ */
  var CHART_MAU_DONVI = ["#6fa4e3", "#f29976", "#65c9a5"];
  var CHART_MAU_KHAC  = "#c3ccd8";
  var CHART_MAU_TT = {
    "con-han": "#1a7a3c", "sap-han": "#e68900", "qua-han": "#c0392b", "chua-co": "#94a3b8"
  };

  function _chartData() {
    var all = _load();

    var dem = {}, thuTu = [];
    all.forEach(function (r) {
      var k = r.section || "";
      if (!(k in dem)) { dem[k] = 0; thuTu.push(k); }
      dem[k]++;
    });
    thuTu.sort(function (a, b) { return _unitRank(a) - _unitRank(b); });
    var donVi = thuTu.map(function (k, i) {
      return { nhan: k ? _unitLabel(k).replace(" (không còn dùng)", "") : "Chưa phân đơn vị",
               giaTri: dem[k], mau: CHART_MAU_DONVI[i] || CHART_MAU_KHAC };
    });
    if (donVi.length > CHART_MAU_DONVI.length) {
      var giu = donVi.slice(0, CHART_MAU_DONVI.length);
      var con = donVi.slice(CHART_MAU_DONVI.length);
      giu.push({ nhan: "Khác (" + con.length + " đơn vị)",
                 giaTri: con.reduce(function (s, x) { return s + x.giaTri; }, 0),
                 mau: CHART_MAU_KHAC });
      donVi = giu;
    }

    /* Theo LOẠI thiết bị — xếp loại đông nhất lên trước để loại chính được
       một màu riêng; quá 3 loại thì gộp phần đuôi vào "Khác" màu xám, đúng
       giới hạn 3 màu pastel an toàn đã nêu ở trên. */
    var demL = {};
    all.forEach(function (r) {
      var k = r.loai_thiet_bi || "Chưa phân loại";
      demL[k] = (demL[k] || 0) + 1;
    });
    var loai = Object.keys(demL).map(function (k) {
      return { nhan: k, giaTri: demL[k] };
    }).sort(function (a, b) {
      if (b.giaTri !== a.giaTri) return b.giaTri - a.giaTri;
      var ia = LOAI_TB.indexOf(a.nhan), ib = LOAI_TB.indexOf(b.nhan);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    loai.forEach(function (x, i) { x.mau = CHART_MAU_DONVI[i] || CHART_MAU_KHAC; });
    if (loai.length > CHART_MAU_DONVI.length) {
      var giuL = loai.slice(0, CHART_MAU_DONVI.length);
      var conL = loai.slice(CHART_MAU_DONVI.length);
      giuL.push({ nhan: "Khác (" + conL.length + " loại)",
                  giaTri: conL.reduce(function (s2, x) { return s2 + x.giaTri; }, 0),
                  mau: CHART_MAU_KHAC });
      loai = giuL;
    }

    var tt = { "con-han": 0, "sap-han": 0, "qua-han": 0, "chua-co": 0 };
    all.forEach(function (r) {
      var st = _kdStatus(_nextDateOf(r));
      if (!st) { tt["chua-co"]++; return; }
      tt[st.cls.replace("kd-", "")]++;
    });
    var trangThai = [
      { nhan: "Còn hạn",            giaTri: tt["con-han"], mau: CHART_MAU_TT["con-han"] },
      { nhan: "Sắp hạn (≤60 ngày)", giaTri: tt["sap-han"], mau: CHART_MAU_TT["sap-han"] },
      { nhan: "Quá hạn",            giaTri: tt["qua-han"], mau: CHART_MAU_TT["qua-han"] },
      { nhan: "Chưa có ngày KĐ",    giaTri: tt["chua-co"], mau: CHART_MAU_TT["chua-co"] }
    ].filter(function (x) { return x.giaTri > 0; });

    return { tong: all.length, donVi: donVi, loai: loai, trangThai: trangThai };
  }

  function _mucChu(hex) {
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return L > 0.62 ? { fill: "#1f2937", vien: "rgba(255,255,255,.75)" }
                    : { fill: "#ffffff", vien: "rgba(0,0,0,.25)" };
  }

  function _pie(tieuDe, muc) {
    var tong = muc.reduce(function (s, x) { return s + x.giaTri; }, 0);
    var R = 78, C = 90, goc = -Math.PI / 2, lat = "", nhan = "";

    muc.forEach(function (m, i) {
      var phan = m.giaTri / tong, d;
      if (muc.length === 1) {
        d = "M " + C + " " + (C - R) + " A " + R + " " + R + " 0 1 1 " + (C - 0.01) + " " + (C - R) + " Z";
      } else {
        var g2 = goc + phan * Math.PI * 2;
        var x1 = C + R * Math.cos(goc), y1 = C + R * Math.sin(goc);
        var x2 = C + R * Math.cos(g2),  y2 = C + R * Math.sin(g2);
        d = "M " + C + " " + C + " L " + x1.toFixed(2) + " " + y1.toFixed(2) +
            " A " + R + " " + R + " 0 " + (phan > 0.5 ? 1 : 0) + " 1 " +
            x2.toFixed(2) + " " + y2.toFixed(2) + " Z";
      }
      lat += '<path d="' + d + '" fill="' + m.mau + '" stroke="#fff" stroke-width="2" ' +
             'class="tbn-slice"><title>' + _esc(m.nhan) + ": " + m.giaTri +
             " thiết bị (" + Math.round(phan * 100) + '%)</title></path>';

      if (phan >= 0.08) {
        var gm = goc + phan * Math.PI;
        var lx = muc.length === 1 ? C : C + R * 0.62 * Math.cos(gm);
        var ly = muc.length === 1 ? C : C + R * 0.62 * Math.sin(gm);
        var mc = _mucChu(m.mau);
        nhan += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" ' +
                'dominant-baseline="central" fill="' + mc.fill + '" font-size="13" font-weight="700" ' +
                'style="paint-order:stroke;stroke:' + mc.vien + ';stroke-width:2.5px">' +
                Math.round(phan * 100) + '%</text>';
      }
      goc += phan * Math.PI * 2;
    });

    var chuGiai = muc.map(function (m) {
      return '<div class="tbn-lg-item">' +
               '<span class="tbn-lg-dot" style="background:' + m.mau + '"></span>' +
               '<span class="tbn-lg-name">' + _esc(m.nhan) + "</span>" +
               '<span class="tbn-lg-val">' + m.giaTri + " · " + Math.round(m.giaTri / tong * 100) + "%</span>" +
             "</div>";
    }).join("");

    return '<div class="tbn-chart">' +
             '<div class="tbn-chart-title">' + _esc(tieuDe) + "</div>" +
             '<svg viewBox="0 0 180 180" class="tbn-pie" role="img" aria-label="' + _esc(tieuDe) + '">' +
               lat + nhan +
             "</svg>" +
             '<div class="tbn-legend-box">' + chuGiai + "</div>" +
           "</div>";
  }

  /* Luôn tính trên TOÀN BỘ thiết bị, không theo bộ lọc bảng. */
  function _buildCharts() {
    var d = _chartData();
    var box = document.createElement("div");
    if (!d.tong) return box;
    box.className = "tbn-charts";
    box.innerHTML = _pie("Tỷ lệ thiết bị theo đơn vị", d.donVi) +
                    _pie("Tỷ lệ theo loại thiết bị", d.loai) +
                    _pie("Tỷ lệ theo hạn kiểm định", d.trangThai);
    return box;
  }

  /* ── RENDER CHÍNH ── */
  function _render() {
    _container.innerHTML = "";
    _container.appendChild(_buildStyles());

    var sectionsWrap = document.createElement("div");
    sectionsWrap.id = "tbn-sections";
    _container.appendChild(sectionsWrap);

    _renderTable();
  }

  function _renderTable() {
    var wrap = document.getElementById("tbn-sections");
    if (!wrap) return;
    var units = _units();

    if (_filterUnit && !units.some(function (u) { return u.key === _filterUnit; })) _filterUnit = "";
    if (_filterLoai && _loaiDangCo().indexOf(_filterLoai) < 0) _filterLoai = "";

    wrap.innerHTML = "";
    wrap.appendChild(_buildCharts());
    if (!units.length) {
      wrap.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:13px">' +
        "Chưa có đơn vị nào được gán cho mục Thiết bị nâng.<br>" +
        "Admin vào <b>Quản trị hệ thống → Danh mục đơn vị</b>, tích ô cột <b>Thiết bị nâng</b>." +
        "</div>";
      return;
    }
    wrap.appendChild(_buildTable(_rowsSorted(_filterUnit, _filterLoai)));
    _fixStickyRows();
  }

  /* Tiêu đề hai tầng + position:sticky: tầng 2 phải biết tầng 1 cao bao nhiêu
     mới dừng đúng chỗ, mà chiều cao đó thay đổi theo bề rộng màn hình (nhãn
     xuống dòng) nên phải ĐO thật, không đoán bằng số cố định. */
  function _fixStickyRows() {
    var apply = function () {
      var r1 = document.querySelector("#tbn-sections .tbn-table thead tr");
      if (!r1) return;
      var h = Math.round(r1.getBoundingClientRect().height);
      var subs = document.querySelectorAll("#tbn-sections .tbn-table thead tr:nth-child(2) th");
      for (var i = 0; i < subs.length; i++) subs[i].style.top = h + "px";
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(apply);
    else setTimeout(apply, 0);
  }
  window.addEventListener("resize", function () {
    if (document.getElementById("tbn-sections")) _fixStickyRows();
  });

  /* ══════════════════════════════════════════
     XUẤT EXCEL — xuất đúng những gì đang thấy (theo bộ lọc và thứ tự hiện tại).
     SheetJS nạp trễ khi bấm nút; không nạp được thì rơi về .xls bảng HTML.
  ══════════════════════════════════════════ */
  var _xlsxLoading = null;
  function _ensureXLSX() {
    if (typeof XLSX !== "undefined") return Promise.resolve(true);
    if (_xlsxLoading) return _xlsxLoading;
    _xlsxLoading = new Promise(function (resolve) {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      sc.onload  = function () { resolve(typeof XLSX !== "undefined"); };
      sc.onerror = function () { resolve(false); };
      document.head.appendChild(sc);
    });
    return _xlsxLoading;
  }
  function _stamp() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  }
  function _num(v) {
    return (v === "" || v === null || v === undefined || isNaN(Number(v))) ? "" : Number(v);
  }
  function _exportRows() {
    var rows = _rowsSorted(_filterUnit, _filterLoai);
    var head = ["STT", "Tên thiết bị", "Loại thiết bị", "Đơn vị quản lý", "Vị trí lắp đặt",
                "Tải trọng thiết kế (tấn)", "Tải trọng làm việc (tấn)", "Năm đưa vào sử dụng",
                "Số chế tạo", "Số đăng ký", "Biển kiểm soát", "Ngày KĐ&TT gần nhất", "Ngày KĐ&TT tiếp theo",
                "Trạng thái", "Ghi chú"];
    var body = rows.map(function (r, i) {
      var nd = _nextDateOf(r), st = _kdStatus(nd);
      return [i + 1, r.ten_thiet_bi || "", r.loai_thiet_bi || "",
              _unitLabel(r.section).replace(" (không còn dùng)", ""), r.vi_tri || "",
              _num(r.tai_trong_tk), _num(r.tai_trong_lv),
              r.nam_su_dung || "", r.so_che_tao || "", r.so_dang_ky || "", r.bien_kiem_soat || "",
              r.ngay_kd_gan_nhat ? HSEDate.fmt(r.ngay_kd_gan_nhat) : "",
              nd ? HSEDate.fmt(nd) : "",
              st ? st.label : "Chưa có ngày KĐ",
              r.ghi_chu || ""];
    });
    return { head: head, body: body, count: rows.length };
  }
  function _exportFallback(tieuDe, phu, d, ten) {
    var html = '<meta charset="utf-8"><table border="1">' +
      '<tr><th colspan="' + d.head.length + '">' + _esc(tieuDe) + "</th></tr>" +
      '<tr><td colspan="' + d.head.length + '">' + _esc(phu) + "</td></tr><tr>" +
      d.head.map(function (x) { return "<th>" + _esc(x) + "</th>"; }).join("") + "</tr>" +
      d.body.map(function (r) {
        return "<tr>" + r.map(function (c) { return "<td>" + _esc(c) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</table>";
    var url = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
    var a = document.createElement("a");
    a.href = url; a.download = ten;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function _exportExcel(btn) {
    var d = _exportRows();
    if (!d.count) { alert("Không có thiết bị nào để xuất."); return; }
    var loc = [];
    if (_filterLoai) loc.push(_filterLoai.toUpperCase());
    if (_filterUnit) loc.push(_unitLabel(_filterUnit).toUpperCase());
    var tieuDe = "DANH SÁCH THIẾT BỊ NÂNG" + (loc.length ? " – " + loc.join(" · ") : "");
    var phu    = "Xuất ngày: " + new Date().toLocaleDateString("vi-VN") + " · Tổng: " + d.count + " thiết bị";
    var ten    = "ThietBiNang_" + (_filterUnit || "TatCa") + "_" + _stamp();

    var cu = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "⏳ Đang xuất...";
    _ensureXLSX().then(function (ok) {
      try {
        if (ok) {
          var aoa = [[tieuDe], [phu], []].concat([d.head]).concat(d.body);
          var ws  = XLSX.utils.aoa_to_sheet(aoa);
          ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
                         { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                         { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 28 }];
          ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: d.head.length - 1 } },
                           { s: { r: 1, c: 0 }, e: { r: 1, c: d.head.length - 1 } }];
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Thiết bị nâng");
          XLSX.writeFile(wb, ten + ".xlsx");
        } else {
          _exportFallback(tieuDe, phu, d, ten + ".xls");
        }
      } catch (e) {
        alert("Không xuất được Excel: " + (e && e.message ? e.message : e));
      }
      btn.disabled = false;
      btn.innerHTML = cu;
    });
  }

  /* ── Tiêu đề cột kèm droplist lọc ngay tại chỗ ── */
  function _thFilter(nhan, id, opts, dangLoc) {
    return '<div class="tbn-th-filter">' +
             '<span class="tbn-th-label">' + nhan + "</span>" +
             '<select id="' + id + '" class="tbn-th-select' + (dangLoc ? " is-on" : "") +
               '" title="Lọc theo ' + _esc(nhan) + '" aria-label="Lọc theo ' + _esc(nhan) + '">' +
               opts +
             "</select>" +
           "</div>";
  }
  function _thFilterLoai() {
    var opts = '<option value="">Tất cả loại</option>' +
      _loaiDangCo().map(function (l) {
        return '<option value="' + _esc(l) + '"' + (l === _filterLoai ? " selected" : "") + ">" + _esc(l) + "</option>";
      }).join("");
    /* Nhãn là "Tên thiết bị" vì hai cột đã gộp làm một; droplist vẫn lọc
       theo LOẠI, đúng thứ đứng đầu mỗi ô. */
    return _thFilter("Tên thiết bị", "tbn-filter-loai", opts, !!_filterLoai);
  }
  function _thFilterDonVi() {
    var opts = '<option value="">Tất cả đơn vị</option>' +
      _units().map(function (u) {
        return '<option value="' + _esc(u.key) + '"' + (u.key === _filterUnit ? " selected" : "") + ">" +
               _esc(u.label) + "</option>";
      }).join("");
    return _thFilter("Đơn vị quản lý", "tbn-filter-unit", opts, !!_filterUnit);
  }

  /* ── BUILD BẢNG ── */
  function _buildTable(rows) {
    var box = document.createElement("div");
    box.className = "tbn-section";

    /* Header: tiêu đề căn giữa · nút Xuất Excel + badge đếm ở mép phải */
    var hdr = document.createElement("div");
    hdr.className = "tbn-section-hdr";
    hdr.innerHTML =
      '<span class="tbn-section-title">' +
        '<svg width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/></svg>' +
        " Danh sách thiết bị nâng</span>" +
      '<div class="tbn-hdr-right">' +
        '<button class="tbn-btn-xls" id="tbn-btn-xls" title="Xuất danh sách đang hiển thị ra Excel">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;flex-shrink:0" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg> Xuất Excel</button>' +
        '<span class="tbn-section-count">' + rows.length + " thiết bị</span>" +
      "</div>";
    var btnXls = hdr.querySelector("#tbn-btn-xls");
    if (btnXls) btnXls.onclick = function () { _exportExcel(btnXls); };
    box.appendChild(hdr);

    /* Thanh thao tác ngay dưới tiêu đề */
    var bar = document.createElement("div");
    bar.className = "tbn-bar";

    var btnRefresh = document.createElement("button");
    btnRefresh.className = "tbn-btn tbn-btn-sm tbn-btn-outline";
    btnRefresh.innerHTML = "🔄 Làm mới";
    btnRefresh.title = "Tải lại dữ liệu từ máy chủ";
    btnRefresh.onclick = function () {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = "⏳ Đang tải...";
      _pullFromSheets(function () { _renderTable(); });
    };
    bar.appendChild(btnRefresh);

    if (_canEdit) {
      var btnEdit = document.createElement("button");
      btnEdit.className = "tbn-btn tbn-btn-sm " + (_editMode ? "tbn-btn-primary" : "tbn-btn-outline");
      btnEdit.innerHTML = _editMode ? "✅ Xong" : "✏️ Chế độ điều chỉnh";
      btnEdit.onclick = function () { _editMode = !_editMode; _renderTable(); };
      bar.appendChild(btnEdit);

      if (_editMode) {
        var btnAdd = document.createElement("button");
        btnAdd.className = "tbn-btn tbn-btn-sm tbn-btn-primary";
        btnAdd.innerHTML = "+ Thêm thiết bị";
        btnAdd.onclick = function () { _openModal(null); };
        bar.appendChild(btnAdd);
      }
    }

    if (_filterUnit || _filterLoai) {
      var mo = [];
      if (_filterLoai) mo.push(_esc(_filterLoai));
      if (_filterUnit) mo.push(_esc(_unitLabel(_filterUnit)));
      var chip = document.createElement("button");
      chip.className = "tbn-chip";
      chip.title = "Bỏ lọc, xem tất cả";
      chip.innerHTML = "Lọc: <b>" + mo.join(" · ") + "</b> ✕";
      chip.onclick = function () { _filterUnit = ""; _filterLoai = ""; _renderTable(); };
      bar.appendChild(chip);
    }
    box.appendChild(bar);

    /* Bảng */
    var tableWrap = document.createElement("div");
    tableWrap.className = "tbn-table-wrap";

    var table = document.createElement("table");
    table.className = "tbn-table";

    /* Bảng có tiêu đề HAI TẦNG (Tải trọng gộp trên, tách dưới) nên độ rộng
       cột KHÔNG thể suy từ hàng đầu như bảng một tầng. Khai bằng <colgroup>
       để table-layout:fixed lấy đúng số đo, không phụ thuộc hàng nào. */
    var COLS = (_editMode ? ["col-drag"] : [])
      .concat(["col-no", "col-ten", "col-donvi", "col-vitri", "col-tttk", "col-ttlv",
               "col-nam", "col-sct", "col-sdk", "col-kd", "col-kdtt", "col-ghichu"])
      .concat(_editMode ? ["col-action"] : []);
    var colgroup = document.createElement("colgroup");
    colgroup.innerHTML = COLS.map(function (c) { return '<col class="' + c + '">'; }).join("");
    table.appendChild(colgroup);

    var thead = document.createElement("thead");
    thead.innerHTML =
      "<tr>" +
      (_editMode ? "<th class='col-drag' rowspan='2'></th>" : "") +
      "<th class='col-no' rowspan='2'>Nº</th>" +
      "<th class='col-ten' rowspan='2'>" + _thFilterLoai() + "</th>" +
      "<th class='col-donvi' rowspan='2'>" + _thFilterDonVi() + "</th>" +
      "<th class='col-vitri' rowspan='2'>Vị trí<br>lắp đặt</th>" +
      "<th class='tbn-th-group' colspan='2'>Tải trọng (tấn)</th>" +
      "<th class='col-nam' rowspan='2'>Năm đưa vào<br>sử dụng</th>" +
      "<th class='col-sct' rowspan='2'>Số<br>chế tạo</th>" +
      "<th class='col-sdk' rowspan='2'>Số<br>đăng ký</th>" +
      "<th class='col-kd' rowspan='2'>Ngày KĐ&amp;TT<br>gần nhất</th>" +
      "<th class='col-kdtt' rowspan='2'>Ngày KĐ&amp;TT<br>tiếp theo</th>" +
      "<th class='col-ghichu' rowspan='2'>Ghi chú</th>" +
      (_editMode ? "<th class='col-action' rowspan='2'></th>" : "") +
      "</tr>" +
      "<tr>" +
        "<th class='tbn-th-sub'>Thiết kế</th>" +
        "<th class='tbn-th-sub'>Làm việc</th>" +
      "</tr>";
    table.appendChild(thead);

    var selLoai = thead.querySelector("#tbn-filter-loai");
    if (selLoai) selLoai.onchange = function () { _filterLoai = this.value; _renderTable(); };
    var selUnit = thead.querySelector("#tbn-filter-unit");
    if (selUnit) selUnit.onchange = function () { _filterUnit = this.value; _renderTable(); };

    var tbody = document.createElement("tbody");
    tbody.id = "tbn-tbody";

    if (!rows.length) {
      var emptyRow = document.createElement("tr");
      var emptyTd  = document.createElement("td");
      emptyTd.colSpan = _editMode ? 14 : 12;
      emptyTd.className = "tbn-empty";
      emptyTd.textContent = (_filterUnit || _filterLoai)
        ? "Không có thiết bị nào khớp bộ lọc."
        : "Chưa có thiết bị nào. " + (_editMode ? "Bấm '+ Thêm thiết bị' để thêm." : "");
      emptyRow.appendChild(emptyTd);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach(function (row, idx) { tbody.appendChild(_buildRow(row, idx + 1)); });
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
    if (_editMode) tr.className = "tbn-row-draggable";

    var nextDate = _nextDateOf(rec);
    var status   = _kdStatus(nextDate);
    if (status && status.cls === "kd-qua-han") tr.classList.add("tbn-row-qua-han");
    if (status && status.cls === "kd-sap-han") tr.classList.add("tbn-row-sap-han");

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
    /* Loại + tên gộp làm một chuỗi: "Cần trục KATO NK/20250E-v 72LA - 1153".
       Vẫn là HAI trường riêng trong dữ liệu — chỉ gộp lúc hiển thị, nên lọc
       theo loại và xuất Excel theo từng cột vẫn chạy như cũ. */
    var tenHienThi = ((rec.loai_thiet_bi ? rec.loai_thiet_bi + " " : "") + (rec.ten_thiet_bi || "")).trim();
    var tenHtml = _esc(tenHienThi) || "—";
    /* Biển kiểm soát xuống dòng thứ hai trong cùng ô, có nhãn nhạt màu đứng
       trước để phân biệt với tên thiết bị mà không tốn thêm một cột. */
    if (rec.bien_kiem_soat) {
      tenHtml += '<div class="tbn-bks"><span class="tbn-bks-nhan">Biển kiểm soát</span> ' +
                 _esc(rec.bien_kiem_soat) + "</div>";
    }
    tr.appendChild(td(tenHtml, "col-ten"));

    var nhan = _unitLabel(rec.section), ghi = "";
    var _i = nhan.indexOf(" (không còn dùng)");
    if (_i >= 0) { ghi = '<br><span style="font-size:11px;color:#9a6700">không còn dùng</span>'; nhan = nhan.slice(0, _i); }
    tr.appendChild(td(_esc(nhan) + ghi, "col-donvi"));
    tr.appendChild(td(_esc(rec.vi_tri || "—"), "col-vitri"));

    var tk = _num(rec.tai_trong_tk), lv = _num(rec.tai_trong_lv);
    tr.appendChild(td(tk === "" ? "—" : tk, "col-tttk"));
    /* Tải trọng làm việc vượt tải trọng thiết kế là dấu hiệu nhập sai hoặc
       thiết bị đang bị dùng quá tải → đánh dấu để người nhập nhìn thấy. */
    var lvHtml = lv === "" ? "—" : String(lv);
    if (tk !== "" && lv !== "" && lv > tk) {
      lvHtml = '<span class="tbn-canh-bao" title="Tải trọng làm việc đang lớn hơn tải trọng thiết kế">' + lv + " ⚠</span>";
    }
    tr.appendChild(td(lvHtml, "col-ttlv"));

    tr.appendChild(td(rec.nam_su_dung || "—", "col-nam"));
    tr.appendChild(td(_esc(rec.so_che_tao || "—"), "col-sct"));
    tr.appendChild(td(_esc(rec.so_dang_ky || "—"), "col-sdk"));
    tr.appendChild(td(rec.ngay_kd_gan_nhat ? HSEDate.fmt(rec.ngay_kd_gan_nhat) : "—", "col-kd"));

    var nextCell = document.createElement("td");
    nextCell.className = "col-kdtt";
    if (nextDate) {
      nextCell.innerHTML = HSEDate.fmt(nextDate) +
        (rec.ngay_kd_tu_chinh ? ' <span title="Ngày do người dùng tự nhập, không phải ngày hệ thống tự tính" style="font-size:11px;color:#6b7c93">✎</span>' : "");
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

    tr.appendChild(td(_esc(rec.ghi_chu || "") || "—", "col-ghichu"));

    if (_editMode) {
      var tdAct = document.createElement("td");
      tdAct.className = "col-action";

      var btnSua = document.createElement("button");
      btnSua.className = "tbn-btn tbn-btn-xs tbn-btn-outline";
      btnSua.textContent = "Sửa";
      btnSua.onclick = function () { _openModal(rec); };

      var btnXoa = document.createElement("button");
      btnXoa.className = "tbn-btn tbn-btn-xs tbn-btn-danger";
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
      tr.classList.add("tbn-dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    tr.addEventListener("dragend", function () {
      tr.classList.remove("tbn-dragging");
      _dragging = null;
      document.querySelectorAll(".tbn-drag-over").forEach(function (el) { el.classList.remove("tbn-drag-over"); });
    });
    tr.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (_dragging && _dragging !== tr && _dragging.dataset.sec === tr.dataset.sec) tr.classList.add("tbn-drag-over");
    });
    tr.addEventListener("dragleave", function () { tr.classList.remove("tbn-drag-over"); });
    tr.addEventListener("drop", function (e) {
      e.preventDefault();
      tr.classList.remove("tbn-drag-over");
      if (!_dragging || _dragging === tr) return;
      if (_dragging.dataset.sec !== tr.dataset.sec) return;

      var tbody = tr.parentNode;
      var rows  = Array.from(tbody.querySelectorAll("tr[data-id]"));
      if (rows.indexOf(_dragging) < rows.indexOf(tr)) tbody.insertBefore(_dragging, tr.nextSibling);
      else                                            tbody.insertBefore(_dragging, tr);

      _saveNewOrder(tbody, tr.dataset.sec);
    });
  }

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
    rows.forEach(function (tr, idx) {
      var noCell = tr.querySelector(".col-no");
      if (noCell) noCell.textContent = idx + 1;
    });
  }

  /* ── CRUD ── */
  function _deleteRow(id) {
    if (!confirm("Xoá thiết bị này?")) return;
    _save(_load().filter(function (r) { return r.id !== id; }));
    _pushDelete(id);
    _renderTable();
  }

  /* ── MODAL THÊM / SỬA ── */
  function _openModal(rec) {
    var isNew = !rec;
    var units = _units();
    if (isNew) {
      var mac = _filterUnit || (units[0] ? units[0].key : "");
      rec = { id: _genId(), section: mac, order: _bySection(mac).length,
              loai_thiet_bi: _filterLoai || LOAI_TB[0] };
    }

    var _tuChinh = !!rec.ngay_kd_tu_chinh;

    function _goiY() {
      return _calcNextDate(HSEDate.getValue(document.getElementById("tbn-inp-ngaykd")));
    }
    function previewNext() {
      var next = _goiY();
      var el = document.getElementById("tbn-preview-next");
      if (el) el.textContent = next ? HSEDate.fmt(next) : "—";
      var tag = document.getElementById("tbn-tag-tuchinh");
      if (tag) tag.style.display = _tuChinh ? "" : "none";
      if (!_tuChinh) {
        var inp = document.getElementById("tbn-inp-ngaykdtt");
        if (inp && window.HSEDate) HSEDate.setValue(inp, next || "");
      }
    }

    /* Loại thiết bị: giữ cả giá trị cũ không còn trong danh mục */
    var dsLoai = LOAI_TB.slice();
    if (rec.loai_thiet_bi && dsLoai.indexOf(rec.loai_thiet_bi) < 0) dsLoai.push(rec.loai_thiet_bi);

    var overlay = document.createElement("div");
    overlay.className = "tbn-overlay";
    var modal = document.createElement("div");
    modal.className = "tbn-modal";

    modal.innerHTML =
      '<div class="tbn-modal-hdr">' +
        "<span>" + (isNew ? "➕ Thêm thiết bị nâng" : "✏️ Sửa thiết bị nâng") + "</span>" +
        '<button class="tbn-modal-close" id="tbn-modal-close">✕</button>' +
      "</div>" +
      '<div class="tbn-modal-body">' +
        '<div class="tbn-form-row tbn-form-row-2">' +
          "<div>" +
            "<label>Đơn vị quản lý</label>" +
            '<select id="tbn-inp-donvi" class="tbn-input">' +
              units.map(function (u) {
                return '<option value="' + _esc(u.key) + '"' + (u.key === rec.section ? " selected" : "") + ">" +
                       _esc(u.label) + "</option>";
              }).join("") +
            "</select>" +
          "</div>" +
          "<div>" +
            "<label>Loại thiết bị</label>" +
            '<select id="tbn-inp-loai" class="tbn-input">' +
              dsLoai.map(function (l) {
                return '<option value="' + _esc(l) + '"' + (l === rec.loai_thiet_bi ? " selected" : "") + ">" +
                       _esc(l) + "</option>";
              }).join("") +
            "</select>" +
          "</div>" +
        "</div>" +
        '<div class="tbn-form-row">' +
          "<label>Tên thiết bị</label>" +
          '<input id="tbn-inp-ten" class="tbn-input" type="text" value="' + _esc(rec.ten_thiet_bi || "") + '">' +
        "</div>" +
        '<div class="tbn-form-row">' +
          "<label>Vị trí lắp đặt</label>" +
          '<input id="tbn-inp-vitri" class="tbn-input" type="text" value="' + _esc(rec.vi_tri || "") + '">' +
        "</div>" +
        '<div class="tbn-form-row tbn-form-row-2">' +
          "<div>" +
            "<label>Tải trọng thiết kế (tấn)</label>" +
            '<input id="tbn-inp-tttk" class="tbn-input" type="number" step="0.01" min="0" value="' + (rec.tai_trong_tk || "") + '">' +
          "</div>" +
          "<div>" +
            "<label>Tải trọng làm việc (tấn)</label>" +
            '<input id="tbn-inp-ttlv" class="tbn-input" type="number" step="0.01" min="0" value="' + (rec.tai_trong_lv || "") + '">' +
          "</div>" +
        "</div>" +
        '<div class="tbn-form-row tbn-form-row-2">' +
          "<div>" +
            "<label>Năm đưa vào sử dụng</label>" +
            '<input id="tbn-inp-nam" class="tbn-input" type="number" min="1900" max="2100" value="' + (rec.nam_su_dung || "") + '">' +
          "</div>" +
          "<div>" +
            "<label>Số chế tạo</label>" +
            '<input id="tbn-inp-sochetao" class="tbn-input" type="text" value="' + _esc(rec.so_che_tao || "") + '">' +
          "</div>" +
        "</div>" +
        '<div class="tbn-form-row tbn-form-row-2">' +
          "<div>" +
            "<label>Số đăng ký</label>" +
            '<input id="tbn-inp-sodangky" class="tbn-input" type="text" value="' + _esc(rec.so_dang_ky || "") + '">' +
          "</div>" +
          "<div>" +
            "<label>Biển kiểm soát</label>" +
            '<input id="tbn-inp-bks" class="tbn-input" type="text" placeholder="VD: 72LA - 1153" value="' + _esc(rec.bien_kiem_soat || "") + '">' +
          "</div>" +
        "</div>" +
        '<div class="tbn-form-row">' +
          "<label>Ngày kiểm định &amp; thử tải gần nhất</label>" +
          '<input id="tbn-inp-ngaykd" class="tbn-input" type="date" value="' + HSEDate.toISO(rec.ngay_kd_gan_nhat || "") + '">' +
        "</div>" +
        '<div class="tbn-form-row">' +
          "<label>Ngày kiểm định &amp; thử tải tiếp theo</label>" +
          '<input id="tbn-inp-ngaykdtt" class="tbn-input" type="date" value="' + HSEDate.toISO(_nextDateOf(rec) || "") + '">' +
          '<div style="margin-top:6px;font-size:12px;color:#6b7c93;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            "<span>Hệ thống tự tính (chu kỳ " + CHU_KY_NAM + " năm): <b id=\"tbn-preview-next\">—</b></span>" +
            '<button type="button" id="tbn-btn-dungtutinh" class="tbn-btn tbn-btn-xs tbn-btn-outline">Dùng ngày này</button>' +
            '<span id="tbn-tag-tuchinh" style="color:#9a6700;display:none">✎ đang dùng ngày tự nhập</span>' +
          "</div>" +
        "</div>" +
        '<div class="tbn-form-row">' +
          "<label>Ghi chú</label>" +
          '<input id="tbn-inp-ghichu" class="tbn-input" type="text" value="' + _esc(rec.ghi_chu || "") + '">' +
        "</div>" +
      "</div>" +
      '<div class="tbn-modal-ftr">' +
        '<button class="tbn-btn tbn-btn-outline" id="tbn-modal-cancel">Huỷ</button>' +
        '<button class="tbn-btn tbn-btn-primary" id="tbn-modal-save">💾 Lưu</button>' +
      "</div>";

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (window.HSEDate) HSEDate.attachAll(modal);

    var elNgay = document.getElementById("tbn-inp-ngaykd");
    if (elNgay) elNgay.addEventListener("change", previewNext);

    var _inpTT = document.getElementById("tbn-inp-ngaykdtt");
    if (_inpTT) _inpTT.addEventListener("change", function () {
      _tuChinh = true;
      var tag = document.getElementById("tbn-tag-tuchinh");
      if (tag) tag.style.display = "";
    });
    var _btnTT = document.getElementById("tbn-btn-dungtutinh");
    if (_btnTT) _btnTT.addEventListener("click", function () { _tuChinh = false; previewNext(); });
    previewNext();

    function closeModal() { document.body.removeChild(overlay); }
    document.getElementById("tbn-modal-close").onclick  = closeModal;
    document.getElementById("tbn-modal-cancel").onclick = closeModal;
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });

    document.getElementById("tbn-modal-save").onclick = function () {
      var ngayISO  = HSEDate.getValue(document.getElementById("tbn-inp-ngaykd"));
      var donViMoi = document.getElementById("tbn-inp-donvi").value;
      var thuTu    = (donViMoi === rec.section) ? rec.order : _bySection(donViMoi).length;

      var updated = {
        id:                rec.id,
        section:           donViMoi,
        order:             thuTu,
        loai_thiet_bi:     document.getElementById("tbn-inp-loai").value,
        ten_thiet_bi:      document.getElementById("tbn-inp-ten").value.trim(),
        vi_tri:            document.getElementById("tbn-inp-vitri").value.trim(),
        tai_trong_tk:      document.getElementById("tbn-inp-tttk").value,
        tai_trong_lv:      document.getElementById("tbn-inp-ttlv").value,
        nam_su_dung:       document.getElementById("tbn-inp-nam").value,
        so_che_tao:        document.getElementById("tbn-inp-sochetao").value.trim(),
        so_dang_ky:        document.getElementById("tbn-inp-sodangky").value.trim(),
        bien_kiem_soat:    document.getElementById("tbn-inp-bks").value.trim(),
        ngay_kd_gan_nhat:  ngayISO,
        ngay_kd_tiep_theo: _tuChinh
                             ? (HSEDate.getValue(document.getElementById("tbn-inp-ngaykdtt")) || _calcNextDate(ngayISO))
                             : _calcNextDate(ngayISO),
        ngay_kd_tu_chinh:  _tuChinh,
        ghi_chu:           document.getElementById("tbn-inp-ghichu").value.trim(),
        updatedAt:         new Date().toISOString()
      };

      if (!updated.section)      { alert("Vui lòng chọn đơn vị quản lý."); return; }
      if (!updated.ten_thiet_bi) { alert("Vui lòng nhập tên thiết bị."); return; }

      var tk = _num(updated.tai_trong_tk), lv = _num(updated.tai_trong_lv);
      if (tk !== "" && lv !== "" && lv > tk) {
        if (!confirm("Tải trọng làm việc (" + lv + " tấn) đang LỚN HƠN tải trọng thiết kế (" +
                     tk + " tấn).\n\nBấm OK nếu đúng như vậy, hoặc Cancel để nhập lại.")) return;
      }

      var all = _load();
      if (isNew) {
        updated.createdBy = (typeof HSE !== "undefined" && HSE.currentUser) ? HSE.currentUser().username : "";
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
      /* Khối bảng */
      ".tbn-section{background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);margin-bottom:28px;overflow:hidden;}",
      ".tbn-section-hdr{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 250px;min-height:56px;background:linear-gradient(180deg,#e6edf8 0%,#dde6f3 100%);border-bottom:2px solid #c3d0e6;}",
      ".tbn-section-title{display:inline-flex;align-items:center;gap:9px;justify-content:center;font-weight:800;color:#003087;font-size:19px;line-height:1.25;text-transform:uppercase;letter-spacing:.7px;text-align:center;}",
      ".tbn-hdr-right{position:absolute;right:18px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:10px;}",
      ".tbn-section-count{font-size:12px;font-weight:700;color:#41577a;background:#fff;border:1px solid #d5deee;border-radius:12px;padding:3px 11px;white-space:nowrap;}",
      ".tbn-btn-xls{display:inline-flex;align-items:center;gap:6px;background:#217346;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12.5px;font-weight:700;font-family:inherit;text-transform:none;cursor:pointer;white-space:nowrap;transition:background .15s;}",
      ".tbn-btn-xls:hover{background:#1a5c38;}",
      ".tbn-btn-xls:disabled{background:#9bb8a8;cursor:default;}",
      "@media(max-width:760px){.tbn-section-hdr{flex-direction:column;padding:14px 12px;}.tbn-section-title{font-size:16px;}.tbn-hdr-right{position:static;transform:none;}}",

      /* Thanh thao tác dưới tiêu đề */
      ".tbn-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 18px;background:#f6f8fc;border-bottom:1px solid #e6ebf5;}",
      ".tbn-chip{margin-left:auto;border:1px solid #cdd6e8;background:#fff;color:#41577a;border-radius:14px;padding:4px 11px;font-size:12px;font-weight:600;cursor:pointer;}",
      ".tbn-chip:hover{background:#eef3fb;border-color:#0060B6;color:#003087;}",

      /* Bảng */
      ".tbn-table-wrap{max-height:72vh;overflow:auto;-webkit-overflow-scrolling:touch;}",
      ".tbn-table{width:100%;min-width:1240px;table-layout:fixed;border-collapse:collapse;font-size:13px;}",
      ".tbn-table th{position:sticky;top:0;z-index:2;background:#dde6f3;color:#003087;font-weight:700;font-size:12.5px;letter-spacing:.2px;padding:10px;text-align:center;vertical-align:middle;white-space:normal;line-height:1.35;border-bottom:2px solid #b9c8e2;box-shadow:inset 0 -2px 0 #b9c8e2;overflow:hidden;}",
      ".tbn-table td{padding:10px;text-align:center;border-bottom:1px solid #eef0f4;vertical-align:middle;overflow:hidden;word-break:break-word;overflow-wrap:anywhere;font-weight:600;color:#1f2b3d;line-height:1.45;}",
      ".tbn-table thead tr:first-child th{z-index:3;}",
      ".tbn-th-group{border-bottom:1px solid #c3d0e6!important;box-shadow:none!important;}",
      ".tbn-th-sub{font-size:11.5px;}",
      ".tbn-table tbody tr:nth-child(even) td{background:#fafbfe;}",
      ".tbn-table tbody tr:hover td{background:#eef3fb;}",
      ".tbn-table th, .tbn-table td{border-right:1px solid #e6ebf5;}",
      ".tbn-table th:last-child, .tbn-table td:last-child{border-right:none;}",
      ".tbn-empty{text-align:center;color:#6b7c93;padding:24px!important;font-style:italic;font-weight:500;}",

      /* Độ rộng cột — tổng 100% */
      ".tbn-table .col-no{width:3%;color:#6b7c93;font-weight:700;}",
      ".tbn-table .col-drag{width:3%;cursor:grab;color:#aaa;font-size:16px;user-select:none;}",
      ".tbn-table .col-ten{width:22.5%;font-weight:700;color:#0f172a;}",
      ".tbn-table .col-donvi{width:10%;color:#334155;}",
      ".tbn-table .col-vitri{width:8.5%;}",
      ".tbn-table .col-tttk{width:6.5%;}",
      ".tbn-table .col-ttlv{width:6.5%;}",
      ".tbn-table .col-nam{width:5.5%;}",
      ".tbn-table .col-sct{width:7.5%;}",
      ".tbn-table .col-sdk{width:7.5%;}",
      ".tbn-table .col-kd{width:8%;}",
      ".tbn-table .col-kdtt{width:9%;}",
      ".tbn-table .col-ghichu{width:5.5%;}",
      ".tbn-table .col-action{width:7%;white-space:nowrap;}",
      /* Chỉ cột Tên thiết bị căn trái, còn lại căn giữa */
      ".tbn-table th.col-ten,.tbn-table td.col-ten{text-align:left;}",
      ".tbn-table td.col-tttk,.tbn-table td.col-ttlv,.tbn-table td.col-nam,.tbn-table td.col-kd,.tbn-table td.col-kdtt{font-variant-numeric:tabular-nums;}",
      ".tbn-canh-bao{color:#c0392b;font-weight:800;}",
      ".tbn-bks{margin-top:3px;font-size:12px;font-weight:700;color:#334155;line-height:1.3;}",
      ".tbn-bks-nhan{color:#9aa7b8;font-weight:500;}",

      /* Dải màu cảnh báo hạn kiểm định ở đầu hàng */
      ".tbn-table tbody tr>td:first-child{border-left:3px solid transparent;}",
      ".tbn-row-qua-han>td:first-child{border-left-color:#c0392b;}",
      ".tbn-row-sap-han>td:first-child{border-left-color:#e68900;}",
      ".tbn-row-qua-han>td{background:#fefafa;}",
      ".tbn-row-sap-han>td{background:#fffdf7;}",

      /* Bộ lọc ngay tại tiêu đề cột */
      ".tbn-th-filter{display:flex;flex-direction:column;align-items:center;gap:4px;}",
      ".tbn-th-label{display:block;}",
      ".tbn-table th.col-ten .tbn-th-filter{align-items:stretch;}",
      ".tbn-th-select{width:100%;max-width:100%;box-sizing:border-box;padding:3px 4px;font-size:11.5px;font-weight:600;font-family:inherit;text-transform:none;letter-spacing:0;text-align:center;color:#334155;background:#fff;border:1px solid #cdd6e8;border-radius:5px;cursor:pointer;outline:none;}",
      ".tbn-th-select:hover{border-color:#0060B6;}",
      ".tbn-th-select:focus{border-color:#0060B6;box-shadow:0 0 0 2px rgba(0,96,182,.15);}",
      ".tbn-th-select.is-on{border-color:#0060B6;background:#eef3fb;color:#003087;}",

      /* Kéo thả */
      ".tbn-row-draggable{cursor:default;}",
      ".tbn-dragging{opacity:0.4;}",
      ".tbn-drag-over td{background:#dceaf7!important;}",

      /* Nút */
      ".tbn-btn{border:none;border-radius:7px;padding:7px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 0.15s;}",
      ".tbn-btn-primary{background:#0060B6;color:#fff;} .tbn-btn-primary:hover{background:#003087;}",
      ".tbn-btn-outline{background:#fff;color:#003087;border:1.5px solid #cdd6e8;} .tbn-btn-outline:hover{background:#eef3fb;}",
      ".tbn-btn-danger{background:#fff;color:#c0392b;border:1.5px solid #f5c6cb;} .tbn-btn-danger:hover{background:#fdedec;}",
      ".tbn-btn-sm{padding:5px 12px;font-size:12.5px;}",
      ".tbn-btn-xs{padding:3px 9px;font-size:12px;margin-left:4px;}",

      /* Biểu đồ tròn */
      ".tbn-charts{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px;}",
      ".tbn-chart{flex:1 1 280px;min-width:250px;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);padding:16px 18px;display:flex;flex-direction:column;align-items:center;}",
      ".tbn-chart-title{font-weight:700;color:#003087;font-size:14px;margin-bottom:10px;text-align:center;}",
      ".tbn-pie{width:180px;height:180px;flex-shrink:0;}",
      ".tbn-slice{transition:opacity .12s;cursor:default;}",
      ".tbn-chart:hover .tbn-slice{opacity:.55;}",
      ".tbn-chart .tbn-slice:hover{opacity:1;}",
      ".tbn-legend-box{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:5px;}",
      ".tbn-lg-item{display:flex;align-items:center;gap:8px;font-size:12.5px;}",
      ".tbn-lg-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0;}",
      ".tbn-lg-name{color:#334155;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".tbn-lg-val{color:#6b7c93;font-weight:600;white-space:nowrap;}",
      "@media(max-width:700px){.tbn-charts{flex-direction:column;}}",

      /* Badge hạn kiểm định — định nghĩa lại tại đây để module tự đứng được */
      ".kd-badge{display:inline-block;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:600;margin-top:3px;}",
      ".kd-con-han{background:#eafaf1;color:#1a7a3c;}",
      ".kd-sap-han{background:#fef5e4;color:#e68900;}",
      ".kd-qua-han{background:#fdedec;color:#c0392b;}",

      /* Modal */
      ".tbn-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;}",
      ".tbn-modal{background:#fff;border-radius:12px;width:600px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2);}",
      ".tbn-modal-hdr{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eee;font-weight:700;font-size:15px;color:#003087;}",
      ".tbn-modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:#6b7c93;}",
      ".tbn-modal-body{padding:20px;overflow-y:auto;flex:1;}",
      ".tbn-modal-ftr{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #eee;}",
      ".tbn-form-row{margin-bottom:14px;}",
      ".tbn-form-row label{display:block;font-size:12.5px;font-weight:600;color:#003087;margin-bottom:5px;}",
      ".tbn-form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}",
      ".tbn-input{width:100%;padding:8px 10px;border:1.5px solid #cdd6e8;border-radius:7px;font-size:13px;font-family:inherit;box-sizing:border-box;outline:none;}",
      ".tbn-input:focus{border-color:#0060B6;box-shadow:0 0 0 3px rgba(0,96,182,0.1);}"
    ].join("\n");
    return style;
  }

})();
