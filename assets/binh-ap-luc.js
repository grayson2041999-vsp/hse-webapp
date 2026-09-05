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
  /* Trạng thái hạn kiểm định — khoá dùng cho bộ lọc, nhãn để hiển thị.
     Khoá trùng phần đuôi class badge (.kd-con-han → "con-han") nên bảng và
     bộ lọc không thể lệch nhau. */
  var TRANG_THAI = [
    { key: "con-han",  label: "Còn hạn"            },
    { key: "sap-han",  label: "Sắp hạn (≤60 ngày)" },
    { key: "qua-han",  label: "Quá hạn"            },
    { key: "chua-co",  label: "Chưa có ngày KĐ"    }
  ];
  function _ttLabel(key) {
    for (var i = 0; i < TRANG_THAI.length; i++) if (TRANG_THAI[i].key === key) return TRANG_THAI[i].label;
    return key;
  }
  /* Trạng thái của MỘT bản ghi. Chỉ gọi khi thực sự lọc theo trạng thái —
     giữ _rowsSorted() không phụ thuộc phần tính ngày. */
  function _ttOf(rec) {
    var st = _kdStatus(_nextDateOf(rec));
    return st ? st.cls.replace("kd-", "") : "chua-co";
  }

  /* Toàn bộ thiết bị, sắp theo đơn vị rồi theo thứ tự kéo–thả trong đơn vị */
  function _rowsSorted(loc, tt) {
    return _load()
      .filter(function (r) {
        if (loc && r.section !== loc) return false;
        if (tt && _ttOf(r) !== tt) return false;
        return true;
      })
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
  var _filterTT   = "";     // trạng thái hạn kiểm định đang lọc
  var _dragging  = null;    // element đang kéo

  /* ── ÉP KIỂU BOOLEAN ──
     LỖI ĐÃ SỬA: server trả hai cờ môi chất về dưới dạng CHUỖI ("false"),
     và trong JavaScript chuỗi "false" là TRUTHY. Hậu quả:
       · ô tích "Ăn mòn KL" / "Cháy nổ" luôn tự bật;
       · nặng hơn: _calcNextDate() coi mọi bình đều là môi chất đặc biệt nên
         RÚT NGẮN chu kỳ kiểm định (3 năm → 2, hoặc 2 → 1), làm "Ngày KĐ tiếp
         theo" hiển thị sớm hơn thực tế.
     Vì vậy mọi giá trị đọc lên đều phải đi qua đây. */
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
    if (r && typeof r === "object") {
      r.moi_chat_an_mon  = _toBool(r.moi_chat_an_mon);
      r.moi_chat_chay_no = _toBool(r.moi_chat_chay_no);
      r.ngay_kd_tu_chinh = _toBool(r.ngay_kd_tu_chinh);
    }
    return r;
  }

  /* ── LOCAL STORAGE ── */
  function _load() {
    var arr;
    try { arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
    /* Ép kiểu ngay ở cửa vào: bản ghi cũ trong cache cũng được chữa. */
    return Array.isArray(arr) ? arr.map(_fixBools) : [];
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

  /* Ngày kiểm định tiếp theo DÙNG ĐỂ HIỂN THỊ.
     · ngay_kd_tu_chinh = true  → giữ đúng ngày người dùng đã nhập
     · ngược lại                → tự tính lại theo tuổi thiết bị + môi chất,
       nên mọi thay đổi ở ngày KĐ gần nhất / năm / môi chất đều phản ánh ngay. */
  function _nextDateOf(rec) {
    if (rec.ngay_kd_tu_chinh && rec.ngay_kd_tiep_theo) return rec.ngay_kd_tiep_theo;
    return _calcNextDate(rec.ngay_kd_gan_nhat, rec.nam_van_hanh, rec.moi_chat_an_mon, rec.moi_chat_chay_no);
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
    return _fixBools(row);   /* server có thể trả "false" dạng chuỗi */
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


  /* ══════════════════════════════════════════
     BIỂU ĐỒ TRÒN
     Hai biểu đồ: tỷ lệ thiết bị theo đơn vị, và tỷ lệ trạng thái kiểm định.
     Vẽ bằng SVG thuần, không cần thư viện ngoài.

     MÀU:
     · Đơn vị  — tông PASTEL. Đây là mức nhạt TỐI ĐA còn qua được kiểm tra
       (dò bằng validate_palette, all-pairs, nền trắng): làm nhạt thêm 33% từ
       bộ màu gốc là ngưỡng cuối; nhạt hơn nữa thì cặp xanh dương↔ngọc tụt
       xuống ΔE 13.9 — dưới sàn 15, mắt thường cũng khó phân biệt.
       Ở mức này: worst normal-vision ΔE 15.9, worst CVD ΔE 7.2 (trong dải
       6-8, hợp lệ vì đã có nhãn % trên lát và chú giải có chữ).
       Pastel đổi lấy số lượng màu: chỉ còn 3 màu an toàn thay vì 4. Đơn vị
       thứ 4 trở đi gộp vào "Khác" màu xám, KHÔNG sinh thêm màu mới — màu
       sinh thêm chắc chắn lẫn với màu đã có khi nhìn qua mắt người mù màu.
     · Trạng thái — dùng đúng màu của badge trong bảng để người đọc nối được
       hai chỗ với nhau. Cặp đỏ↔xanh chỉ cách nhau ΔE 6.2 với người mù màu đỏ-lục,
       nên BẮT BUỘC có nhãn chữ trên lát cắt và trong chú giải — màu không bao
       giờ là kênh thông tin duy nhất.
     ══════════════════════════════════════════ */
  var CHART_MAU_DONVI = ["#6fa4e3", "#f29976", "#65c9a5"];
  var CHART_MAU_KHAC  = "#c3ccd8";
  var CHART_MAU_TT = {
    "con-han": "#1a7a3c",   // khớp .kd-con-han
    "sap-han": "#e68900",   // khớp .kd-sap-han
    "qua-han": "#c0392b",   // khớp .kd-qua-han
    "chua-co": "#94a3b8"
  };

  /* Gom số liệu cho hai biểu đồ */
  function _chartData() {
    var all = _load();

    /* 1. Theo đơn vị — giữ thứ tự trong danh mục, quá 4 thì gộp "Khác" */
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

    /* 2. Theo trạng thái kiểm định */
    var tt = { "con-han": 0, "sap-han": 0, "qua-han": 0, "chua-co": 0 };
    all.forEach(function (r) {
      var st = _kdStatus(_nextDateOf(r));
      if (!st) { tt["chua-co"]++; return; }
      tt[st.cls.replace("kd-", "")]++;
    });
    var trangThai = [
      { nhan: "Còn hạn",           giaTri: tt["con-han"], mau: CHART_MAU_TT["con-han"] },
      { nhan: "Sắp hạn (≤60 ngày)", giaTri: tt["sap-han"], mau: CHART_MAU_TT["sap-han"] },
      { nhan: "Quá hạn",           giaTri: tt["qua-han"], mau: CHART_MAU_TT["qua-han"] },
      { nhan: "Chưa có ngày KĐ",   giaTri: tt["chua-co"], mau: CHART_MAU_TT["chua-co"] }
    ].filter(function (x) { return x.giaTri > 0; });

    return { tong: all.length, donVi: donVi, trangThai: trangThai };
  }

  /* Mực cho nhãn % trên lát: nền nhạt thì chữ đậm, nền đậm thì chữ trắng.
     Pastel gần như luôn rơi vào nhóm cần chữ đậm. */
  function _mucChu(hex) {
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return L > 0.62 ? { fill: "#1f2937", vien: "rgba(255,255,255,.75)" }
                    : { fill: "#ffffff", vien: "rgba(0,0,0,.25)" };
  }

  /* Một biểu đồ tròn: SVG + nhãn % trên lát cắt + chú giải có số liệu */
  function _pie(tieuDe, muc) {
    var tong = muc.reduce(function (s, x) { return s + x.giaTri; }, 0);
    var R = 78, C = 90;              // bán kính và tâm (viewBox 180×180)
    var goc = -Math.PI / 2;          // bắt đầu từ 12 giờ
    var lat = "", nhan = "";

    muc.forEach(function (m, i) {
      var phan = m.giaTri / tong;
      var d;
      if (muc.length === 1) {
        /* Một lát duy nhất: cung tròn suy biến, vẽ hình tròn đầy */
        d = "M " + C + " " + (C - R) + " A " + R + " " + R + " 0 1 1 " + (C - 0.01) + " " + (C - R) + " Z";
      } else {
        var g2 = goc + phan * Math.PI * 2;
        var x1 = C + R * Math.cos(goc),  y1 = C + R * Math.sin(goc);
        var x2 = C + R * Math.cos(g2),   y2 = C + R * Math.sin(g2);
        d = "M " + C + " " + C + " L " + x1.toFixed(2) + " " + y1.toFixed(2) +
            " A " + R + " " + R + " 0 " + (phan > 0.5 ? 1 : 0) + " 1 " +
            x2.toFixed(2) + " " + y2.toFixed(2) + " Z";
      }
      lat += '<path d="' + d + '" fill="' + m.mau + '" stroke="#fff" stroke-width="2" ' +
             'class="bal-slice" data-i="' + i + '"><title>' + _esc(m.nhan) + ": " + m.giaTri +
             " thiết bị (" + Math.round(phan * 100) + '%)</title></path>';

      /* Nhãn % ngay trên lát cắt — kênh thông tin thứ hai ngoài màu.
         Lát quá nhỏ thì bỏ nhãn cho khỏi chồng chữ, chú giải vẫn có đủ số. */
      if (phan >= 0.08) {
        var gm = goc + phan * Math.PI;
        /* Một lát duy nhất (100%) thì đặt nhãn ngay giữa hình tròn */
        var lx = muc.length === 1 ? C : C + R * 0.62 * Math.cos(gm);
        var ly = muc.length === 1 ? C : C + R * 0.62 * Math.sin(gm);
        var muc_ = _mucChu(m.mau);
        nhan += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" ' +
                'dominant-baseline="central" fill="' + muc_.fill + '" font-size="13" font-weight="700" ' +
                'style="paint-order:stroke;stroke:' + muc_.vien + ';stroke-width:2.5px">' +
                Math.round(phan * 100) + '%</text>';
      }
      goc += phan * Math.PI * 2;
    });

    var chuGiai = muc.map(function (m) {
      return '<div class="bal-lg-item">' +
               '<span class="bal-lg-dot" style="background:' + m.mau + '"></span>' +
               '<span class="bal-lg-name">' + _esc(m.nhan) + '</span>' +
               '<span class="bal-lg-val">' + m.giaTri + ' · ' + Math.round(m.giaTri / tong * 100) + '%</span>' +
             '</div>';
    }).join("");

    return '<div class="bal-chart">' +
             '<div class="bal-chart-title">' + _esc(tieuDe) + '</div>' +
             '<svg viewBox="0 0 180 180" class="bal-pie" role="img" aria-label="' + _esc(tieuDe) + '">' +
               lat + nhan +
             "</svg>" +
             '<div class="bal-legend-box">' + chuGiai + "</div>" +
           "</div>";
  }

  /* Khối hai biểu đồ. Luôn tính trên TOÀN BỘ thiết bị, không theo bộ lọc bảng —
     để con số tổng quan không đổi khi người dùng lọc xem từng đơn vị. */
  function _buildCharts() {
    var d = _chartData();
    var box = document.createElement("div");
    if (!d.tong) return box;          // chưa có thiết bị thì không vẽ gì
    box.className = "bal-charts";
    box.innerHTML =
      _pie("Tỷ lệ thiết bị theo đơn vị", d.donVi) +
      _pie("Tỷ lệ theo hạn kiểm định", d.trangThai);
    return box;
  }

  /* ── RENDER CHÍNH ── */
  function _render() {
    _container.innerHTML = "";
    _container.appendChild(_buildStyles());

    /* Vùng các section (biểu đồ + bảng). Các nút thao tác và bộ lọc đơn vị
       nằm NGAY TRONG khối bảng: nút dưới tiêu đề, bộ lọc ở tiêu đề cột
       "Đơn vị quản lý" — xem _buildTable(). */
    var sectionsWrap = document.createElement("div");
    sectionsWrap.id = "bal-sections";
    _container.appendChild(sectionsWrap);

    _renderTable();
  }

  function _renderTable() {
    var wrap = document.getElementById("bal-sections");
    if (!wrap) return;
    var units = _units();

    /* Bộ lọc đang chọn không còn trong danh mục → quay về "Tất cả đơn vị" */
    if (_filterUnit && !units.some(function (u) { return u.key === _filterUnit; })) _filterUnit = "";

    wrap.innerHTML = "";
    wrap.appendChild(_buildCharts());
    if (!units.length) {
      wrap.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:13px">' +
        "Chưa có đơn vị nào được gán cho mục Bình áp lực.<br>" +
        "Admin vào <b>Quản trị hệ thống → Danh mục đơn vị</b>, tích ô cột <b>Bình áp lực</b>." +
        "</div>";
      return;
    }
    wrap.appendChild(_buildTable(_rowsSorted(_filterUnit, _filterTT)));
  }

  /* ══════════════════════════════════════════
     XUẤT EXCEL
     Xuất đúng những gì đang thấy: theo bộ lọc đơn vị và thứ tự đang sắp.
     Thư viện SheetJS nạp trễ (chỉ khi bấm nút) để không làm nặng lúc mở trang.
     Không tải được thư viện (mạng nội bộ chặn) → rơi về file .xls dạng bảng
     HTML, Excel vẫn mở bình thường.
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

  function _exportRows() {
    var rows = _rowsSorted(_filterUnit, _filterTT);
    var head = ["STT", "Tên thiết bị", "Đơn vị quản lý", "Vị trí lắp đặt", "V (m³)", "Plv (kg/cm²)",
                "Năm vận hành", "Số đăng ký", "Ngày KĐ gần nhất", "Ngày KĐ tiếp theo", "Trạng thái", "Ghi chú"];
    var body = rows.map(function (r, i) {
      var nd = _nextDateOf(r), st = _kdStatus(nd), gc = [];
      if (r.moi_chat_an_mon)  gc.push("Môi chất ăn mòn kim loại");
      if (r.moi_chat_chay_no) gc.push("Môi chất cháy nổ");
      if (r.ghi_chu)          gc.push(r.ghi_chu);
      function num(v) { return (v === "" || v === null || v === undefined || isNaN(Number(v))) ? "" : Number(v); }
      return [i + 1,
              r.ten_thiet_bi || "",
              _unitLabel(r.section).replace(" (không còn dùng)", ""),
              r.vi_tri || "",
              num(r.v_m3), num(r.plv_kgcm2),
              r.nam_van_hanh || "", r.so_dang_ky || "",
              r.ngay_kd_gan_nhat ? HSEDate.fmt(r.ngay_kd_gan_nhat) : "",
              nd ? HSEDate.fmt(nd) : "",
              st ? st.label : "Chưa có ngày KĐ",
              gc.join("; ")];
    });
    return { head: head, body: body, count: rows.length };
  }

  /* Dự phòng khi không nạp được SheetJS: bảng HTML lưu đuôi .xls */
  function _exportFallback(tieuDe, phu, d, ten) {
    var html = '<meta charset="utf-8"><table border="1">' +
      '<tr><th colspan="' + d.head.length + '">' + _esc(tieuDe) + "</th></tr>" +
      '<tr><td colspan="' + d.head.length + '">' + _esc(phu) + "</td></tr><tr>" +
      d.head.map(function (x) { return "<th>" + _esc(x) + "</th>"; }).join("") + "</tr>" +
      d.body.map(function (r) {
        return "<tr>" + r.map(function (c) { return "<td>" + _esc(c) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</table>";
    var url = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" }));
    var a = document.createElement("a");
    a.href = url; a.download = ten;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function _exportExcel(btn) {
    var d = _exportRows();
    if (!d.count) { alert("Không có thiết bị nào để xuất."); return; }

    var loc = [];
    if (_filterUnit) loc.push(_unitLabel(_filterUnit).toUpperCase());
    if (_filterTT)   loc.push(_ttLabel(_filterTT).toUpperCase());
    var tieuDe = "DANH SÁCH BÌNH ÁP LỰC" + (loc.length ? " – " + loc.join(" · ") : "");
    var phu    = "Xuất ngày: " + new Date().toLocaleDateString("vi-VN") + " · Tổng: " + d.count + " thiết bị";
    var ten    = "BinhApLuc_" + (_filterUnit || "TatCa") + "_" + _stamp();

    var cu = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "⏳ Đang xuất...";
    _ensureXLSX().then(function (ok) {
      try {
        if (ok) {
          var aoa = [[tieuDe], [phu], []].concat([d.head]).concat(d.body);
          var ws  = XLSX.utils.aoa_to_sheet(aoa);
          ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 13 },
                         { wch: 13 }, { wch: 16 }, { wch: 17 }, { wch: 17 }, { wch: 14 }, { wch: 30 }];
          ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: d.head.length - 1 } },
                           { s: { r: 1, c: 0 }, e: { r: 1, c: d.head.length - 1 } }];
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Bình áp lực");
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

  /* Tiêu đề cột "Đơn vị quản lý" kèm droplist lọc ngay tại chỗ.
     Lọc đặt trong tiêu đề cột nào thì tác động lên đúng cột đó — người dùng
     không phải đi tìm bộ lọc ở nơi khác. */
  function _thFilter(nhan, id, opts, dangLoc, nhanText) {
    var t = _esc(nhanText || nhan);
    return '<div class="bal-th-filter">' +
             '<span class="bal-th-label">' + nhan + "</span>" +
             '<select id="' + id + '" class="bal-th-select' + (dangLoc ? " is-on" : "") +
               '" title="Lọc theo ' + t + '" aria-label="Lọc theo ' + t + '">' + opts + "</select>" +
           "</div>";
  }
  function _thFilterDonVi() {
    var opts = '<option value="">Tất cả đơn vị</option>' +
      _units().map(function (u) {
        return '<option value="' + _esc(u.key) + '"' + (u.key === _filterUnit ? " selected" : "") + ">" +
               _esc(u.label) + "</option>";
      }).join("");
    return _thFilter("Đơn vị quản lý", "bal-filter-unit", opts, !!_filterUnit);
  }
  function _thFilterTT() {
    var opts = '<option value="">Tất cả trạng thái</option>' +
      TRANG_THAI.map(function (t) {
        return '<option value="' + t.key + '"' + (t.key === _filterTT ? " selected" : "") + ">" +
               _esc(t.label) + "</option>";
      }).join("");
    return _thFilter("Ngày KĐ<br>tiếp theo", "bal-filter-tt", opts, !!_filterTT, "hạn kiểm định");
  }

  /* ── BUILD BẢNG DUY NHẤT ── */
  function _buildTable(rows) {
    var box = document.createElement("div");
    box.className = "bal-section";

    /* Header */
    var hdr = document.createElement("div");
    hdr.className = "bal-section-hdr";
    hdr.innerHTML =
      '<span class="bal-section-title"><svg class="lic-emoji" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg> Danh sách bình áp lực</span>' +
      '<div class="bal-hdr-right">' +
        '<button class="bal-btn-xls" id="bal-btn-xls" title="Xuất danh sách đang hiển thị ra Excel">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;flex-shrink:0" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg> Xuất Excel</button>' +
        '<span class="bal-section-count">' + rows.length + ' thiết bị</span>' +
      "</div>";

    var btnXls = hdr.querySelector("#bal-btn-xls");
    if (btnXls) btnXls.onclick = function () { _exportExcel(btnXls); };

    box.appendChild(hdr);

    /* ── Thanh thao tác: nằm ngay dưới tiêu đề, trên bảng ── */
    var bar = document.createElement("div");
    bar.className = "bal-bar";

    var btnRefresh = document.createElement("button");
    btnRefresh.className = "bal-btn bal-btn-sm bal-btn-outline";
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
      btnEdit.className = "bal-btn bal-btn-sm " + (_editMode ? "bal-btn-primary" : "bal-btn-outline");
      btnEdit.innerHTML = _editMode ? "✅ Xong" : "✏️ Chế độ điều chỉnh";
      btnEdit.onclick = function () { _editMode = !_editMode; _renderTable(); };
      bar.appendChild(btnEdit);

      if (_editMode) {
        var btnAdd = document.createElement("button");
        btnAdd.className = "bal-btn bal-btn-sm bal-btn-primary";
        btnAdd.innerHTML = "+ Thêm thiết bị";
        btnAdd.onclick = function () { _openModal(null); };
        bar.appendChild(btnAdd);
      }
    }

    /* Đang lọc → hiện chip cho biết, bấm để bỏ lọc */
    if (_filterUnit || _filterTT) {
      var mo = [];
      if (_filterUnit) mo.push(_esc(_unitLabel(_filterUnit)));
      if (_filterTT)   mo.push(_esc(_ttLabel(_filterTT)));
      var chip = document.createElement("button");
      chip.className = "bal-chip";
      chip.title = "Bỏ lọc, xem tất cả";
      chip.innerHTML = "Lọc: <b>" + mo.join(" · ") + "</b> ✕";
      chip.onclick = function () { _filterUnit = ""; _filterTT = ""; _renderTable(); };
      bar.appendChild(chip);
    }

    box.appendChild(bar);

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
      "<th class='col-donvi'>" + _thFilterDonVi() + "</th>" +
      "<th class='col-vitri'>Vị trí lắp đặt</th>" +
      "<th class='col-thongso'>Thông số chính</th>" +
      "<th class='col-nam'>Năm vận hành</th>" +
      "<th class='col-sodangky'>Số đăng ký</th>" +
      "<th class='col-kd'>Ngày KĐ<br>gần nhất</th>" +
      "<th class='col-kdtt'>" + _thFilterTT() + "</th>" +
      "<th class='col-ghichu'>Ghi chú</th>" +
      (_editMode ? "<th class='col-action'></th>" : "") +
      "</tr>";
    table.appendChild(thead);

    /* Wire droplist lọc đơn vị đặt trong tiêu đề cột */
    var selUnit = thead.querySelector("#bal-filter-unit");
    if (selUnit) {
      selUnit.onchange = function () { _filterUnit = this.value; _renderTable(); };
      selUnit.onclick  = function (e) { e.stopPropagation(); };
    }
    var selTT = thead.querySelector("#bal-filter-tt");
    if (selTT) {
      selTT.onchange = function () { _filterTT = this.value; _renderTable(); };
      selTT.onclick  = function (e) { e.stopPropagation(); };
    }

    var tbody = document.createElement("tbody");
    tbody.id = "bal-tbody";

    if (!rows.length) {
      var emptyRow = document.createElement("tr");
      var emptyTd = document.createElement("td");
      emptyTd.colSpan = _editMode ? 12 : 10;
      emptyTd.className = "bal-empty";
      emptyTd.textContent = (_filterUnit || _filterTT)
        ? "Không có thiết bị nào khớp bộ lọc."
        : "Chưa có thiết bị nào. " + (_editMode ? "Bấm '+ Thêm thiết bị' để thêm." : "");
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

    var nextDate = _nextDateOf(rec);
    var status   = _kdStatus(nextDate);
    /* Hàng quá hạn / sắp hạn được đánh dấu bằng dải màu ở mép trái */
    if (status && status.cls === "kd-qua-han") tr.classList.add("bal-row-qua-han");
    if (status && status.cls === "kd-sap-han") tr.classList.add("bal-row-sap-han");

    /* Cột kéo thả */
    if (_editMode) {
      var tdDrag = document.createElement("td");
      tdDrag.className = "col-drag";
      tdDrag.innerHTML = "⠿";
      tdDrag.title = "Kéo để sắp xếp (trong cùng một đơn vị)";
      tr.appendChild(tdDrag);
      _wireDrag(tr);
    }

    /* content = HTML hiển thị · nguyen = chữ đầy đủ cho tooltip · dong = số
       dòng tối đa. Dài hơn thì có dấu … và di chuột lên xem được đủ — KHÔNG
       cắt âm thầm như trước. */
    function td(content, cls, nguyen, dong) {
      var el = document.createElement("td");
      if (cls) el.className = cls;
      var box = document.createElement("div");
      box.className = "bal-clamp";
      if (dong) box.style.webkitLineClamp = String(dong);
      box.innerHTML = content;
      el.appendChild(box);
      if (nguyen) el.title = nguyen;
      return el;
    }

    tr.appendChild(td(no, "col-no"));
    tr.appendChild(td(_esc(rec.ten_thiet_bi || ""), "col-ten", rec.ten_thiet_bi || "", 3));
    var nhan = _unitLabel(rec.section), ghi = "";
    var _i = nhan.indexOf(" (không còn dùng)");
    if (_i >= 0) { ghi = '<br><span style="font-size:11px;color:#9a6700">không còn dùng</span>'; nhan = nhan.slice(0, _i); }
    tr.appendChild(td(_esc(nhan) + ghi, "col-donvi", _unitLabel(rec.section), 2));
    tr.appendChild(td(_esc(rec.vi_tri || "") || "—", "col-vitri", rec.vi_tri || "", 2));

    /* Thông số chính */
    var thongSo = "";
    if (rec.v_m3)    thongSo += "V = " + rec.v_m3 + " m³";
    if (rec.plv_kgcm2) thongSo += (thongSo ? "<br>" : "") + "P<sub>lv</sub> = " + rec.plv_kgcm2 + " kg/cm²";
    tr.appendChild(td(thongSo || "—", "col-thongso",
      ((rec.v_m3 ? "V = " + rec.v_m3 + " m³" : "") +
       (rec.plv_kgcm2 ? " · Plv = " + rec.plv_kgcm2 + " kg/cm²" : "")).trim(), 2));

    tr.appendChild(td(rec.nam_van_hanh || "—", "col-nam"));
    tr.appendChild(td(_esc(rec.so_dang_ky || "—"), "col-sodangky", rec.so_dang_ky || "", 2));
    tr.appendChild(td(rec.ngay_kd_gan_nhat ? HSEDate.fmt(rec.ngay_kd_gan_nhat) : "—", "col-kd"));

    /* Ngày KĐ tiếp theo + badge trạng thái */
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

    /* Ghi chú */
    var ghiChu = [];
    if (rec.moi_chat_an_mon) ghiChu.push('<span class="tag-moi-chat">Ăn mòn KL</span>');
    if (rec.moi_chat_chay_no) ghiChu.push('<span class="tag-moi-chat">Cháy nổ</span>');
    if (rec.ghi_chu) ghiChu.push(_esc(rec.ghi_chu));
    tr.appendChild(td(ghiChu.join(" ") || "—", "col-ghichu",
      ghiChu.length ? String(ghiChu.join(" ")).replace(/<[^>]*>/g, "") : "", 2));

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
    /* Đang dùng ngày tự nhập hay ngày hệ thống tính?
       Mở form ra thì giữ đúng trạng thái đã lưu của bản ghi. */
    var _tuChinh = !!rec.ngay_kd_tu_chinh;

    function _goiY() {
      return _calcNextDate(
        HSEDate.getValue(document.getElementById("bal-inp-ngaykd")),
        document.getElementById("bal-inp-nam").value,
        document.getElementById("bal-inp-anmon").checked,
        document.getElementById("bal-inp-chayno").checked
      );
    }
    /* Cập nhật dòng gợi ý. Nếu chưa chỉnh tay thì ô ngày đi theo gợi ý;
       đã chỉnh tay rồi thì để nguyên, chỉ hiện gợi ý bên dưới để đối chiếu. */
    function previewNext() {
      var next = _goiY();
      var el = document.getElementById("bal-preview-next");
      if (el) el.textContent = next ? HSEDate.fmt(next) : "—";
      var tag = document.getElementById("bal-tag-tuchinh");
      if (tag) tag.style.display = _tuChinh ? "" : "none";
      if (!_tuChinh) {
        var inp = document.getElementById("bal-inp-ngaykdtt");
        if (inp && window.HSEDate) HSEDate.setValue(inp, next || "");
      }
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
          '<label>Ngày kiểm định tiếp theo</label>' +
          '<input id="bal-inp-ngaykdtt" class="bal-input" type="date" value="' + HSEDate.toISO(_nextDateOf(rec) || "") + '">' +
          '<div style="margin-top:6px;font-size:12px;color:#6b7c93;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            '<span>Hệ thống tự tính: <b id="bal-preview-next">—</b></span>' +
            '<button type="button" id="bal-btn-dungtutinh" class="bal-btn bal-btn-xs bal-btn-outline">Dùng ngày này</button>' +
            '<span id="bal-tag-tuchinh" style="color:#9a6700;display:none">✎ đang dùng ngày tự nhập</span>' +
          '</div>' +
        '</div>' +
        '<div class="bal-form-row">' +
          '<label>Ghi chú – Môi chất</label>' +
          '<div class="bal-checkbox-row">' +
            '<label class="bal-check-label">' +
              '<input id="bal-inp-anmon" type="checkbox"' + (_toBool(rec.moi_chat_an_mon) ? " checked" : "") + '> Môi chất ăn mòn kim loại' +
            '</label>' +
            '<label class="bal-check-label">' +
              '<input id="bal-inp-chayno" type="checkbox"' + (_toBool(rec.moi_chat_chay_no) ? " checked" : "") + '> Môi chất cháy nổ' +
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
    /* Người dùng tự sửa ô ngày → từ đó về sau giữ nguyên ngày họ nhập,
       không bị ghi đè khi đổi ngày KĐ gần nhất / năm / môi chất nữa. */
    var _inpTT = document.getElementById("bal-inp-ngaykdtt");
    if (_inpTT) _inpTT.addEventListener("change", function () {
      _tuChinh = true;
      var tag = document.getElementById("bal-tag-tuchinh");
      if (tag) tag.style.display = "";
    });
    /* Quay lại dùng ngày hệ thống tính */
    var _btnTT = document.getElementById("bal-btn-dungtutinh");
    if (_btnTT) _btnTT.addEventListener("click", function () {
      _tuChinh = false;
      previewNext();
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
        ngay_kd_tiep_theo: _tuChinh
                             ? (HSEDate.getValue(document.getElementById("bal-inp-ngaykdtt")) || _calcNextDate(ngayISO, nam, anMon, chayNo))
                             : _calcNextDate(ngayISO, nam, anMon, chayNo),
        ngay_kd_tu_chinh:  _tuChinh,
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
      ".bal-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 18px;background:#f6f8fc;border-bottom:1px solid #e6ebf5;}",
      ".bal-chip{margin-left:auto;border:1px solid #cdd6e8;background:#fff;color:#41577a;border-radius:14px;padding:4px 11px;font-size:12px;font-weight:600;cursor:pointer;}",
      ".bal-chip:hover{background:#eef3fb;border-color:#0060B6;color:#003087;}",
      /* Bộ lọc ngay tại tiêu đề cột Đơn vị quản lý */
      ".bal-th-filter{display:flex;flex-direction:column;align-items:center;gap:4px;}",
      ".bal-th-label{display:block;}",
      ".bal-th-select{width:100%;max-width:100%;box-sizing:border-box;padding:3px 4px;font-size:11.5px;font-weight:600;font-family:inherit;text-transform:none;letter-spacing:0;text-align:center;color:#334155;background:#fff;border:1px solid #cdd6e8;border-radius:5px;cursor:pointer;outline:none;}",
      ".bal-th-select:hover{border-color:#0060B6;}",
      ".bal-th-select:focus{border-color:#0060B6;box-shadow:0 0 0 2px rgba(0,96,182,.15);}",
      ".bal-th-select.is-on{border-color:#0060B6;background:#eef3fb;color:#003087;}",
      ".bal-section{background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);margin-bottom:28px;overflow:hidden;}",
      ".bal-section-hdr{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 250px;min-height:56px;background:linear-gradient(180deg,#e6edf8 0%,#dde6f3 100%);border-bottom:2px solid #c3d0e6;}",
      ".bal-section-title{display:inline-flex;align-items:center;gap:9px;justify-content:center;font-weight:800;color:#003087;font-size:19px;line-height:1.25;text-transform:uppercase;letter-spacing:.7px;text-align:center;}",
      ".bal-hdr-right{position:absolute;right:18px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:10px;}",
      ".bal-section-count{font-size:12px;font-weight:700;color:#41577a;background:#fff;border:1px solid #d5deee;border-radius:12px;padding:3px 11px;white-space:nowrap;}",
      ".bal-btn-xls{display:inline-flex;align-items:center;gap:6px;background:#217346;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12.5px;font-weight:700;font-family:inherit;text-transform:none;cursor:pointer;white-space:nowrap;transition:background .15s;}",
      ".bal-btn-xls:hover{background:#1a5c38;}",
      ".bal-btn-xls:disabled{background:#9bb8a8;cursor:default;}",
      ".bal-section-hdr>.bal-btn{position:absolute;left:18px;top:50%;transform:translateY(-50%);}",
      "@media(max-width:760px){.bal-section-hdr{flex-direction:column;padding:14px 12px;}.bal-section-title{font-size:16px;}.bal-hdr-right{position:static;transform:none;}}",

      /* Table */
      ".bal-table-wrap{max-height:72vh;overflow:auto;-webkit-overflow-scrolling:touch;}",
      ".bal-table{width:100%;min-width:1040px;table-layout:fixed;border-collapse:collapse;font-size:13px;}",
      ".bal-table th{position:sticky;top:0;z-index:2;background:#dde6f3;color:#003087;font-weight:700;font-size:12.5px;letter-spacing:.2px;padding:10px 10px;text-align:center;vertical-align:middle;white-space:normal;line-height:1.35;border-bottom:2px solid #b9c8e2;box-shadow:inset 0 -2px 0 #b9c8e2;overflow:hidden;}",
      /* ⚠ white-space:normal BẮT BUỘC — assets/style.css đặt th,td{white-space:nowrap}
         cho toàn webapp; gặp ô overflow:hidden thì chữ dài bị CẮT CỤT không
         dấu hiệu gì, người xem không biết mình đang đọc thiếu. */
      ".bal-table td{padding:10px;text-align:center;white-space:normal;border-bottom:1px solid #eef0f4;vertical-align:middle;word-break:break-word;overflow-wrap:anywhere;font-weight:600;color:#1f2b3d;line-height:1.45;}",
      /* Cắt tối đa N dòng rồi thêm dấu … — nội dung đầy đủ xem bằng tooltip */
      ".bal-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;}",
      ".bal-table tbody tr:nth-child(even) td{background:#fafbfe;}",
      ".bal-table tbody tr:hover td{background:#eef3fb;}",
      ".bal-table th, .bal-table td{border-right:1px solid #e6ebf5;}",
      ".bal-table th:last-child, .bal-table td:last-child{border-right:none;}",
      ".bal-empty{text-align:center;color:#6b7c93;padding:24px!important;font-style:italic;}",

      /* Col widths */
      ".col-no{width:3.5%;text-align:center;color:#6b7c93;font-weight:700;}",
      ".col-drag{width:3%;text-align:center;cursor:grab;color:#aaa;font-size:16px;user-select:none;}",
      ".col-ten{width:17%;font-weight:700;color:#0f172a;}",
      ".col-donvi{width:13%;color:#334155;white-space:normal;}",
      ".col-vitri{width:9.5%;}",
      ".col-thongso{width:12%;white-space:nowrap;}",
      ".col-nam{width:7%;text-align:center;}",
      ".col-sodangky{width:10%;}",
      ".col-kd{width:9.5%;text-align:center;}",
      ".col-kdtt{width:11.5%;text-align:center;}",
      ".col-ghichu{width:7%;}",
      ".col-action{width:7%;white-space:nowrap;}",
      /* Chỉ cột Tên thiết bị căn trái, còn lại căn giữa */
      ".bal-table th.col-ten,.bal-table td.col-ten{text-align:left;}",
      ".bal-table td.col-thongso{font-variant-numeric:tabular-nums;}",
      ".bal-table td.col-kd,.bal-table td.col-kdtt{font-variant-numeric:tabular-nums;}",
      /* Dải màu cảnh báo hạn kiểm định ở đầu hàng */
      ".bal-table tbody tr>td:first-child{border-left:3px solid transparent;}",
      ".bal-row-qua-han>td:first-child{border-left-color:#c0392b;}",
      ".bal-row-sap-han>td:first-child{border-left-color:#e68900;}",
      ".bal-row-qua-han>td{background:#fefafa;}",
      ".bal-row-sap-han>td{background:#fffdf7;}",

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
      /* ── Biểu đồ tròn ── */
      ".bal-charts{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px;}",
      ".bal-chart{flex:1 1 320px;min-width:280px;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);padding:16px 18px;display:flex;flex-direction:column;align-items:center;}",
      ".bal-chart-title{font-weight:700;color:#003087;font-size:14px;margin-bottom:10px;text-align:center;}",
      ".bal-pie{width:180px;height:180px;flex-shrink:0;}",
      ".bal-slice{transition:opacity .12s;cursor:default;}",
      ".bal-chart:hover .bal-slice{opacity:.55;}",
      ".bal-chart .bal-slice:hover{opacity:1;}",
      ".bal-legend-box{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:5px;}",
      ".bal-lg-item{display:flex;align-items:center;gap:8px;font-size:12.5px;}",
      ".bal-lg-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0;}",
      ".bal-lg-name{color:#334155;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".bal-lg-val{color:#6b7c93;font-weight:600;white-space:nowrap;}",
      "@media(max-width:700px){.bal-charts{flex-direction:column;}}",
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
      ".bal-checkbox-row{display:flex;gap:20px;flex-wrap:wrap;}",
      ".bal-check-label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400;cursor:pointer;}",
    ].join("\n");
    return style;
  }

})();
