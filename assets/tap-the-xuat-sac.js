/* =========================================================
   TAP-THE-XUAT-SAC.JS — Tập thể xuất sắc ATSKMT theo quý
   Webapp Quản lý HSE · Vietsovpetro
   Nhóm menu: Theo dõi & Báo cáo · slug "tap-the-xuat-sac"

   BỐ CỤC (phương án D — Tổng hợp)
     • 4 thẻ chỉ số: số quý đã xét · quý không xét do TNLĐ ·
       tổng lượt công nhận · đơn vị nhiều lần nhất
     • Bản đồ nhiệt Đơn vị (hàng) × Quý (cột, thời gian chạy ngang)
       + cột Tổng · lọc giai đoạn · xuất Excel
     • Khối bên: quý gần nhất · các quý không xét do TNLĐ (kèm vụ việc)

   NHẬP LIỆU (chỉ Admin)
     Chọn Năm + Quý → trạng thái (Có xét / Không xét do TNLĐ / Chưa có
     kết quả) → tick tối đa MAX_DON_VI đơn vị → Lưu.
     • Danh sách đơn vị lấy từ danh mục (HSE_UNITS.list("tap-the-xuat-sac")),
       Admin bật/tắt ở Quản trị hệ thống → Danh mục đơn vị.
     • Giới hạn 2 đơn vị/quý là CHẶN CỨNG (ô thứ 3 bị khoá; DB cũng có
       ràng buộc check — xem tap_the_xuat_sac.sql).
     • Quý không xét do TNLĐ: liên kết tới vụ TNLĐ ghi ở module
       Tai nạn - Sự cố (bảng tnsc_su_kien, loai = "tai_nan_lao_dong")
       + ghi chú. Mở một quý chưa nhập mà quý đó có TNLĐ → form tự
       chọn sẵn "Không xét do TNLĐ" và tick các vụ trong quý.

   DỮ LIỆU — bảng "TapTheXuatSac" (tên logic: tap_the_xuat_sac)
     id         "2026-3"  (năm-quý, cố định → không tạo trùng)
     nam, quy   số nguyên
     trangThai  "xet" | "tnld"     (quý chưa có kết quả = không có dòng)
     donVi      mảng TÊN đơn vị (lưu theo tên như mọi trang khác,
                đổi tên hàng loạt qua RENAME_TARGETS trong don-vi.js)
     tnldIds    mảng id vụ việc ở bảng tnsc_su_kien
     ghiChu, updatedBy, updatedAt
   ========================================================= */
(function (global) {
  "use strict";

  var SHEET    = "tap_the_xuat_sac";
  var LS_KEY   = "hse_tap_the_xuat_sac";
  var PAGE     = "tap-the-xuat-sac";
  var INC_SHEET = "tnsc_su_kien";
  var INC_LS    = "hse_tnsc_su_kien";      // cache của trang Tai nạn - Sự cố
  var MAX_DON_VI = 2;
  var START_YEAR = 2022;                   // năm đầu tiên có số liệu
  var ROMAN = ["", "I", "II", "III", "IV"];
  var PALETTE = ["#2F7FC8", "#7a4fbf", "#12866b", "#d9730d", "#ED3237", "#0e7490", "#a16207", "#be185d", "#4d7c0f", "#475569"];

  /* =========================================================
     LÕI TÍNH TOÁN (thuần, không đụng DOM — có unit test)
     ========================================================= */
  function asArr(v) {
    if (Array.isArray(v)) return v;
    if (v == null || v === "") return [];
    if (typeof v === "string") {
      var s = v.trim();
      if (s.charAt(0) === "[") { try { var p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch (e) {} }
      return s ? [s] : [];
    }
    return [v];
  }
  function qid(nam, quy) { return nam + "-" + quy; }
  function qlabel(nam, quy) { return ROMAN[quy] + "/" + nam; }
  function qindex(nam, quy) { return nam * 4 + (quy - 1); }
  function fromIndex(i) { return { nam: Math.floor(i / 4), quy: (i % 4) + 1 }; }
  function quarterOf(date) {
    return { nam: date.getFullYear(), quy: Math.floor(date.getMonth() / 3) + 1 };
  }
  /** Quý vừa kết thúc gần nhất (mặc định cho form nhập) */
  function lastFinished(today) {
    var c = quarterOf(today || new Date());
    return fromIndex(qindex(c.nam, c.quy) - 1);
  }

  function normRow(r) {
    var nam = parseInt(r.nam, 10), quy = parseInt(r.quy, 10);
    if ((!nam || !quy) && r.id) {
      var m = String(r.id).match(/^(\d{4})-([1-4])$/);
      if (m) { nam = +m[1]; quy = +m[2]; }
    }
    return {
      id: qid(nam, quy), nam: nam, quy: quy,
      trangThai: r.trangThai === "tnld" ? "tnld" : "xet",
      donVi: asArr(r.donVi).map(function (s) { return String(s).trim(); }).filter(Boolean),
      tnldIds: asArr(r.tnldIds).map(String),
      ghiChu: r.ghiChu || "",
      updatedBy: r.updatedBy || "", updatedAt: r.updatedAt || ""
    };
  }

  /** Danh sách quý từ đầu (quý I của năm có số liệu sớm nhất) tới quý hiện tại */
  function quarterRange(rows, today) {
    var minY = START_YEAR;
    rows.forEach(function (r) { if (r.nam && r.nam < minY) minY = r.nam; });
    var cur = quarterOf(today || new Date());
    var out = [];
    for (var i = qindex(minY, 1); i <= qindex(cur.nam, cur.quy); i++) out.push(fromIndex(i));
    return out;
  }

  /** Kiểm tra dữ liệu trước khi lưu. Trả về chuỗi lỗi hoặc "" */
  function validate(rec, today) {
    if (!rec || !rec.nam || !rec.quy || rec.quy < 1 || rec.quy > 4) return "Chưa chọn năm / quý.";
    var cur = quarterOf(today || new Date());
    if (qindex(rec.nam, rec.quy) > qindex(cur.nam, cur.quy)) return "Không thể nhập kết quả cho quý chưa diễn ra.";
    if (rec.trangThai === "xet") {
      if ((rec.donVi || []).length > MAX_DON_VI) return "Mỗi quý chỉ được công nhận tối đa " + MAX_DON_VI + " đơn vị.";
    } else if (rec.trangThai === "tnld") {
      if (!(rec.tnldIds || []).length && !String(rec.ghiChu || "").trim())
        return "Quý không xét do TNLĐ: chọn vụ tai nạn liên quan hoặc ghi chú lý do.";
    } else return "Trạng thái không hợp lệ.";
    return "";
  }

  /** Thống kê trên tập quý đang xem. keyOf: tên → khoá so khớp (mã đơn vị) */
  function stats(quarters, byId, keyOf) {
    keyOf = keyOf || function (s) { return s; };
    var s = { xet: 0, tnld: 0, cho: 0, luot: 0, perUnit: {} };
    quarters.forEach(function (q) {
      var r = byId[qid(q.nam, q.quy)];
      if (!r) { s.cho++; return; }
      if (r.trangThai === "tnld") { s.tnld++; return; }
      s.xet++;
      r.donVi.forEach(function (n) {
        var k = keyOf(n);
        s.perUnit[k] = (s.perUnit[k] || 0) + 1;
        s.luot++;
      });
    });
    var max = 0;
    Object.keys(s.perUnit).forEach(function (k) { if (s.perUnit[k] > max) max = s.perUnit[k]; });
    s.max = max;
    s.top = max ? Object.keys(s.perUnit).filter(function (k) { return s.perUnit[k] === max; }) : [];
    return s;
  }

  /** Vụ TNLĐ (đã chuẩn hoá) thuộc 1 quý */
  function parseIncDate(v) {
    if (!v) return null;
    if (global.HSEDate && HSEDate.parse) { var d0 = HSEDate.parse(String(v).slice(0, 10)); if (d0) return d0; }
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = String(v).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  function tnldInQuarter(incs, nam, quy) {
    return (incs || []).filter(function (r) {
      if (r.loai !== "tai_nan_lao_dong") return false;
      var d = parseIncDate(r.thoiGian);
      if (!d) return false;
      var q = quarterOf(d);
      return q.nam === nam && q.quy === quy;
    });
  }

  /** Bảng 2 chiều cho xuất Excel — giữ đúng bố cục file Excel cũ */
  function toAoa(quarters, byId, units, keyOf) {
    keyOf = keyOf || function (s) { return s; };
    var aoa = [["Quý"].concat(units.map(function (u) { return u.ten; }))];
    var tot = units.map(function () { return 0; });
    quarters.forEach(function (q) {
      var r = byId[qid(q.nam, q.quy)];
      var row = [qlabel(q.nam, q.quy)];
      if (r && r.trangThai === "tnld") {
        row.push("Không được nhận do TNLĐ");
        for (var i = 1; i < units.length; i++) row.push("");
      } else {
        var ks = r ? r.donVi.map(keyOf) : [];
        units.forEach(function (u, i) {
          var hit = ks.indexOf(u.key) >= 0;
          if (hit) tot[i]++;
          row.push(hit ? 1 : "");
        });
      }
      aoa.push(row);
    });
    aoa.push(["Tổng"].concat(tot));
    return aoa;
  }

  var CORE = {
    MAX_DON_VI: MAX_DON_VI, asArr: asArr, qid: qid, qlabel: qlabel, qindex: qindex,
    quarterOf: quarterOf, lastFinished: lastFinished, normRow: normRow,
    quarterRange: quarterRange, validate: validate, stats: stats,
    tnldInQuarter: tnldInQuarter, parseIncDate: parseIncDate, toAoa: toAoa
  };
  global.TTXS_CORE = CORE;
  if (typeof document === "undefined") return;   // môi trường test (node)

  /* =========================================================
     TRẠNG THÁI TRANG
     ========================================================= */
  var _c = null, _user = null, _canEdit = false;
  var _rows = [];          // bản ghi đã chuẩn hoá
  var _incs = [];          // vụ việc từ module Tai nạn - Sự cố
  var _period = "all";     // "all" | "3y" | "<năm>"
  var _bound = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lsLoad(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var ICON = {
    trophy: '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
    link: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
  };
  function ic(n, s) {
    s = s || 16;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;vertical-align:-0.15em">' + ICON[n] + '</svg>';
  }

  /* ── Đơn vị: tra qua danh mục dùng chung ── */
  function U() { return global.HSE_UNITS || null; }
  function unitKey(name) { var H = U(); return H ? H.maOf(name) : String(name).trim().toLowerCase(); }
  function unitLabel(name) { var H = U(); return H ? H.label(name) : String(name); }
  function catalogNames() {
    var H = U();
    return H ? H.list(PAGE, { excludeGop: true }) : [];
  }
  /** Hàng của bản đồ nhiệt: đơn vị đang bật cho trang + đơn vị cũ còn trong dữ liệu */
  function unitRows() {
    var seen = {}, out = [];
    catalogNames().forEach(function (n) {
      var k = unitKey(n);
      if (seen[k]) return;
      seen[k] = 1; out.push({ key: k, ten: n, active: true });
    });
    _rows.forEach(function (r) {
      r.donVi.forEach(function (n) {
        var k = unitKey(n);
        if (seen[k]) return;
        seen[k] = 1; out.push({ key: k, ten: unitLabel(n), active: false });
      });
    });
    out.forEach(function (u, i) { u.color = PALETTE[i % PALETTE.length]; });
    return out;
  }

  function byId() { var m = {}; _rows.forEach(function (r) { m[r.id] = r; }); return m; }
  function visibleQuarters() {
    var all = quarterRange(_rows);
    if (_period === "all") return all;
    if (_period === "3y") {
      var y = quarterOf(new Date()).nam;
      return all.filter(function (q) { return q.nam > y - 3; });
    }
    var yy = parseInt(_period, 10);
    return all.filter(function (q) { return q.nam === yy; });
  }
  function incById(id) { for (var i = 0; i < _incs.length; i++) if (String(_incs[i].id) === String(id)) return _incs[i]; return null; }
  function fmtIncDate(v) { var d = parseIncDate(v); return d ? ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear() : ""; }

  /* =========================================================
     TẢI DỮ LIỆU (hiện cache ngay, kéo server phía sau)
     ========================================================= */
  function loadLocal() {
    _rows = (lsLoad(LS_KEY, []) || []).map(normRow).filter(function (r) { return r.nam && r.quy; });
    _incs = (lsLoad(INC_LS, []) || []);
  }
  function pull(manual) {
    if (typeof DB === "undefined") return;
    var p1 = DB.getAll(SHEET).then(function (rows) {
      var norm = (rows || []).map(normRow).filter(function (r) { return r.nam && r.quy; });
      lsSave(LS_KEY, norm);
      _rows = norm;
      setSync("ok", "Đã đồng bộ");
    }).catch(function (e) {
      console.warn("[TTXS] Tải dữ liệu thất bại:", e && e.message || e);
      setSync("err", /does not exist|relation|schema cache/i.test(String(e && e.message))
        ? "Chưa tạo bảng TapTheXuatSac trên Supabase" : "Không tải được dữ liệu — đang hiện bản lưu tại máy");
    });
    var p2 = DB.getAll(INC_SHEET).then(function (rows) {
      _incs = (rows || []).filter(function (r) { return r.loai === "tai_nan_lao_dong"; });
    }).catch(function () {});
    if (manual) setSync("busy", "Đang tải…");
    Promise.all([p1, p2]).then(draw);
  }

  /* =========================================================
     VẼ TRANG
     ========================================================= */
  global.renderTapTheXuatSac = function (container, user, canEdit) {
    _c = container; _user = user; _canEdit = !!canEdit;
    if (!document.getElementById("ttxs-style")) document.head.appendChild(styles());
    loadLocal();
    draw();
    pull(false);
    if (!_bound) {
      _bound = true;
      // Admin đổi danh mục đơn vị → vẽ lại (chỉ khi trang này còn đang mở)
      global.addEventListener("hse-donvi-change", function () { if (_c && document.body.contains(_c)) draw(); });
    }
  };

  var _syncState = { s: "busy", t: "Đang tải…" };
  function setSync(s, t) {
    _syncState = { s: s, t: t };
    var el = document.getElementById("ttxs-sync");
    if (el) { el.className = "ttxs-sync " + s; el.lastChild.textContent = t; }
  }

  function draw() {
    if (!_c) return;
    var units = unitRows();
    var qs = visibleQuarters();
    var map = byId();
    var st = stats(qs, map, unitKey);

    var years = {};
    quarterRange(_rows).forEach(function (q) { years[q.nam] = 1; });
    var yearOpts = Object.keys(years).sort().reverse().map(function (y) {
      return '<option value="' + y + '"' + (_period === y ? " selected" : "") + '>Năm ' + y + '</option>';
    }).join("");

    var h = '';
    h += '<div class="page-title" style="display:flex;align-items:center;gap:9px">' + ic("trophy", 22) + 'Tập thể xuất sắc ATSKMT</div>';
    h += '<div class="page-desc">Thống kê các đơn vị được công nhận là tập thể xuất sắc về An toàn – Sức khoẻ – Môi trường theo quý.</div>';

    h += '<div class="ttxs-toolbar">' +
      '<select id="ttxs-period" class="inp">' +
        '<option value="all"' + (_period === "all" ? " selected" : "") + '>Tất cả các năm</option>' +
        '<option value="3y"' + (_period === "3y" ? " selected" : "") + '>3 năm gần nhất</option>' + yearOpts +
      '</select>' +
      '<button class="btn btn-ghost btn-sm" id="ttxs-xls">' + ic("sheet", 15) + ' Xuất Excel</button>' +
      '<button class="btn btn-ghost btn-sm" id="ttxs-reload" title="Tải lại từ máy chủ">' + ic("refresh", 15) + '</button>' +
      '<span id="ttxs-sync" class="ttxs-sync ' + _syncState.s + '"><i></i>' + esc(_syncState.t) + '</span>' +
      '<span class="spacer"></span>' +
      (_canEdit ? '<button class="btn btn-sm" id="ttxs-add">' + ic("pen", 15) + ' Cập nhật kết quả quý</button>' : '') +
    '</div>';

    // Nhắc Admin: quý vừa kết thúc chưa có kết quả
    var lf = lastFinished();
    if (_canEdit && !map[qid(lf.nam, lf.quy)]) {
      h += '<div class="ttxs-note">' + ic("alert", 15) + ' Quý <b>' + qlabel(lf.nam, lf.quy) + '</b> đã kết thúc nhưng chưa có kết quả. ' +
           '<a href="#" data-open="' + qid(lf.nam, lf.quy) + '">Cập nhật ngay</a></div>';
    }
    if (_canEdit && !catalogNames().length) {
      h += '<div class="ttxs-note">' + ic("alert", 15) + ' Chưa có đơn vị nào được bật cho trang này. Vào <a href="index.html#quan-tri-he-thong">Quản trị hệ thống → Danh mục đơn vị</a> và tick cột <b>Tập thể xuất sắc</b> cho các đơn vị cần xét.</div>';
    }

    // Thống kê: chỉ giữ "Đơn vị đạt nhiều lần nhất" (theo giai đoạn đang lọc; hoà thì liệt kê đủ)
    var topUnits = st.top.map(function (k) {
      for (var i = 0; i < units.length; i++) if (units[i].key === k) return units[i];
      return { key: k, ten: k, color: "#475569" };
    });
    var periodLbl = _period === "all" ? "Tất cả các năm" : _period === "3y" ? "3 năm gần nhất" : "Năm " + _period;
    h += '<div class="card ttxs-top">' +
      '<div class="ic">' + ic("trophy", 22) + '</div>' +
      '<div class="bd"><div class="lbl">Đơn vị đạt nhiều lần nhất <span>· ' + esc(periodLbl) + '</span></div>' +
        (topUnits.length
          ? '<div class="nm">' + topUnits.map(function (u) {
              return '<span class="ttxs-chip" style="background:' + u.color + '">' + esc(u.ten) + '</span>';
            }).join("") + '<b class="n">' + st.max + ' lần</b></div>'
          : '<div class="nm muted">Chưa có đơn vị nào được công nhận trong giai đoạn này.</div>') +
      '</div></div>';

    // Heatmap + khối bên
    h += '<div class="ttxs-split">';
    h += '<div class="card ttxs-card"><div class="ttxs-h">Bản đồ đơn vị × quý</div>' + heatmap(qs, map, units, st) + legend() + '</div>';
    h += '<div class="card ttxs-card">' + sidePanel(map, units) + '</div>';
    h += '</div>';

    _c.innerHTML = h;
    // Màn hẹp: cuộn bản đồ về các quý gần nhất (bên phải)
    var sc = _c.querySelector(".ttxs-scroll");
    if (sc) sc.scrollLeft = sc.scrollWidth;
    bind();
  }

  function heatmap(qs, map, units, st) {
    if (!units.length) return '<div class="ttxs-empty">Chưa có đơn vị nào để hiển thị.</div>';
    if (!qs.length) return '<div class="ttxs-empty">Không có quý nào trong giai đoạn đã chọn.</div>';
    var h = '<div class="ttxs-scroll"><table class="ttxs-heat"><thead><tr><th class="u"></th>';
    var prevY = null;
    qs.forEach(function (q) {
      var r = map[qid(q.nam, q.quy)];
      var cls = (q.nam !== prevY ? "ys " : "") + (_canEdit ? "ed" : "");
      var tip = qlabel(q.nam, q.quy) + (r ? (r.trangThai === "tnld" ? " — Không xét do TNLĐ" : " — " + r.donVi.length + " đơn vị") : " — Chưa có kết quả");
      h += '<th class="' + cls + '" title="' + esc(tip) + (_canEdit ? " (bấm để sửa)" : "") + '"' + (_canEdit ? ' data-open="' + qid(q.nam, q.quy) + '"' : '') + '>' +
        '<div class="y">' + (q.nam !== prevY || q.quy === 1 ? q.nam : "&nbsp;") + '</div>' + ROMAN[q.quy] + '</th>';
      prevY = q.nam;
    });
    h += '<th class="tot">Tổng</th></tr></thead><tbody>';
    units.forEach(function (u) {
      h += '<tr><td class="u' + (u.active ? "" : " off") + '" title="' + esc(u.ten) + (u.active ? "" : " — không còn trong danh sách xét") + '">' +
        '<i style="background:' + u.color + '"></i>' + esc(u.ten) + '</td>';
      prevY = null;
      qs.forEach(function (q) {
        var r = map[qid(q.nam, q.quy)];
        var c = !r ? "p" : r.trangThai === "tnld" ? "t" : (r.donVi.map(unitKey).indexOf(u.key) >= 0 ? "h" : "");
        var tip = qlabel(q.nam, q.quy) + " · " + u.ten + ": " +
          (c === "h" ? "Được công nhận" : c === "t" ? "Không xét do TNLĐ" : c === "p" ? "Chưa có kết quả" : "Không");
        h += '<td class="' + c + (q.nam !== prevY ? " ys" : "") + '" title="' + esc(tip) + '"></td>';
        prevY = q.nam;
      });
      h += '<td class="tot">' + (st.perUnit[u.key] || 0) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function legend() {
    return '<div class="ttxs-legend">' +
      '<span><i class="sw h"></i>Được công nhận</span>' +
      '<span><i class="sw t"></i>Không xét do TNLĐ</span>' +
      '<span><i class="sw p"></i>Chưa có kết quả</span>' +
    '</div>';
  }

  function chip(name, units) {
    var k = unitKey(name), col = "#475569";
    for (var i = 0; i < units.length; i++) if (units[i].key === k) col = units[i].color;
    return '<span class="ttxs-chip" style="background:' + col + '">' + ic("trophy", 12) + ' ' + esc(unitLabel(name)) + '</span>';
  }

  function sidePanel(map, units) {
    var h = '<div class="ttxs-h">Quý gần nhất</div>';
    var latest = _rows.slice().sort(function (a, b) { return qindex(b.nam, b.quy) - qindex(a.nam, a.quy); })
      .filter(function (r) { return r.trangThai === "xet"; })[0];
    if (latest) {
      h += '<div class="ttxs-last">Quý <b>' + qlabel(latest.nam, latest.quy) + '</b></div>' +
        (latest.donVi.length ? latest.donVi.map(function (n) { return chip(n, units); }).join("")
                             : '<span class="muted">Không có đơn vị nào được công nhận</span>');
      if (latest.ghiChu) h += '<div class="ttxs-gc">' + esc(latest.ghiChu) + '</div>';
    } else h += '<div class="muted">Chưa có kết quả nào.</div>';

    var tn = _rows.filter(function (r) { return r.trangThai === "tnld"; })
      .sort(function (a, b) { return qindex(b.nam, b.quy) - qindex(a.nam, a.quy); });
    h += '<div class="ttxs-h" style="margin-top:18px">Quý không xét do TNLĐ</div>';
    if (!tn.length) h += '<div class="muted">Không có.</div>';
    tn.forEach(function (r) {
      var incs = r.tnldIds.map(function (id) {
        var x = incById(id);
        return x ? '<div class="inc">' + esc(x.ten || "Tai nạn lao động") + (x.thoiGian ? ' · ' + fmtIncDate(x.thoiGian) : '') + '</div>'
                 : '<div class="inc muted">Vụ việc đã bị xoá khỏi module Tai nạn - Sự cố</div>';
      }).join("");
      h += '<div class="ttxs-tn">' +
        '<div class="q">' + ic("alert", 14) + ' Quý ' + qlabel(r.nam, r.quy) +
          (_canEdit ? '<a href="#" class="ed" data-open="' + r.id + '" title="Sửa">' + ic("pen", 13) + '</a>' : '') + '</div>' +
        incs + (r.ghiChu ? '<div class="gc">' + esc(r.ghiChu) + '</div>' : '') +
        (r.tnldIds.length ? '<a class="lk" href="tai-nan-su-co.html">' + ic("link", 12) + ' Xem ở Tai nạn - Sự cố</a>' : '') +
      '</div>';
    });
    return h;
  }

  function bind() {
    var sel = document.getElementById("ttxs-period");
    if (sel) sel.onchange = function () { _period = sel.value; draw(); };
    var xls = document.getElementById("ttxs-xls");
    if (xls) xls.onclick = exportExcel;
    var rl = document.getElementById("ttxs-reload");
    if (rl) rl.onclick = function () { pull(true); };
    var add = document.getElementById("ttxs-add");
    if (add) add.onclick = function () { var q = lastFinished(); openForm(q.nam, q.quy); };
    _c.querySelectorAll("[data-open]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var p = el.getAttribute("data-open").split("-");
        openForm(+p[0], +p[1]);
      });
    });
  }

  /* =========================================================
     FORM NHẬP (modal) — chỉ Admin
     ========================================================= */
  var _f = null;   // trạng thái form đang mở

  function openForm(nam, quy) {
    if (!_canEdit) return;
    closeForm();
    var bg = document.createElement("div");
    bg.className = "modal-bg open"; bg.id = "ttxs-modal";
    bg.innerHTML =
      '<div class="modal ttxs-modal">' +
        '<div class="modal-h"><h3>Kết quả xét tập thể xuất sắc</h3><button class="x" data-x>×</button></div>' +
        '<div class="modal-b" id="ttxs-fb"></div>' +
        '<div class="modal-f">' +
          '<span class="ttxs-meta" id="ttxs-fmeta"></span>' +
          '<button class="btn btn-ghost" data-x>Huỷ</button>' +
          '<button class="btn" id="ttxs-save">Lưu</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", function (e) { if (e.target === bg || e.target.hasAttribute("data-x")) closeForm(); });
    document.getElementById("ttxs-save").onclick = save;
    document.addEventListener("keydown", escClose);
    loadQuarter(nam, quy);
  }
  function escClose(e) { if (e.key === "Escape") closeForm(); }
  function closeForm() {
    var m = document.getElementById("ttxs-modal");
    if (m) m.parentNode.removeChild(m);
    document.removeEventListener("keydown", escClose);
    _f = null;
  }

  /** Nạp dữ liệu 1 quý vào form (khi mở hoặc khi đổi năm/quý) */
  function loadQuarter(nam, quy) {
    var r = byId()[qid(nam, quy)];
    var incs = tnldInQuarter(_incs, nam, quy);
    _f = {
      nam: nam, quy: quy, exists: !!r,
      trangThai: r ? r.trangThai : (incs.length ? "tnld" : "xet"),
      donVi: r ? r.donVi.slice() : [],
      tnldIds: r ? r.tnldIds.slice() : incs.map(function (x) { return String(x.id); }),
      ghiChu: r ? r.ghiChu : "",
      auto: !r && incs.length > 0,
      incs: incs,
      rec: r || null
    };
    if (_f.trangThai !== "tnld") _f.tnldIds = r ? r.tnldIds.slice() : [];
    drawForm();
  }

  function drawForm() {
    var f = _f, box = document.getElementById("ttxs-fb");
    if (!f || !box) return;
    var cur = quarterOf(new Date());
    var years = [];
    for (var y = cur.nam; y >= Math.min(START_YEAR, f.nam); y--) years.push(y);

    var h = '<div class="ttxs-row">' +
      '<div class="field"><label>Năm</label><select id="ttxs-fy" class="inp">' +
        years.map(function (y) { return '<option' + (y === f.nam ? " selected" : "") + '>' + y + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Quý</label><select id="ttxs-fq" class="inp">' +
        [1, 2, 3, 4].map(function (q) {
          var future = qindex(f.nam, q) > qindex(cur.nam, cur.quy);
          return '<option value="' + q + '"' + (q === f.quy ? " selected" : "") + (future ? " disabled" : "") + '>Quý ' + ROMAN[q] + (future ? " (chưa diễn ra)" : "") + '</option>';
        }).join("") + '</select></div>' +
      '<div class="ttxs-qst">' + (f.exists ? '<span class="ttxs-b ok">Đã có kết quả — đang sửa</span>' : '<span class="ttxs-b">Chưa có kết quả</span>') + '</div>' +
    '</div>';

    h += '<div class="field"><label>Kết quả xét quý</label><div class="ttxs-seg">' +
      seg("xet", "Có xét công nhận") + seg("tnld", "Không xét do TNLĐ") + seg("cho", "Chưa có kết quả") +
    '</div></div>';

    if (f.auto && f.trangThai === "tnld") {
      h += '<div class="ttxs-note">' + ic("alert", 15) + ' Module Tai nạn - Sự cố ghi nhận <b>' + f.incs.length + ' vụ TNLĐ</b> trong quý này nên đã chọn sẵn "Không xét do TNLĐ". Kiểm tra lại trước khi lưu.</div>';
    }

    if (f.trangThai === "xet") {
      if (f.incs.length) {
        h += '<div class="ttxs-note">' + ic("alert", 15) + ' Lưu ý: quý này có <b>' + f.incs.length + ' vụ TNLĐ</b> ghi nhận ở module Tai nạn - Sự cố.</div>';
      }
      // Danh sách chọn = danh mục đang bật + đơn vị đã chọn trước đây (kể cả đã tắt)
      var names = catalogNames().slice();
      var keys = names.map(unitKey);
      f.donVi.forEach(function (n) { if (keys.indexOf(unitKey(n)) < 0) { names.push(n); keys.push(unitKey(n)); } });
      var sel = f.donVi.map(unitKey);
      var full = sel.length >= MAX_DON_VI;
      h += '<div class="field"><label>Đơn vị được công nhận <span class="ttxs-cnt' + (full ? " full" : "") + '">Đã chọn ' + sel.length + '/' + MAX_DON_VI + '</span></label>';
      if (!names.length) {
        h += '<div class="ttxs-empty">Chưa có đơn vị nào được bật cho trang này. Vào <a href="index.html#quan-tri-he-thong">Quản trị hệ thống → Danh mục đơn vị</a> để tick cột <b>Tập thể xuất sắc</b>.</div>';
      } else {
        h += '<div class="ttxs-units">' + names.map(function (n, i) {
          var on = sel.indexOf(keys[i]) >= 0, dis = !on && full;
          return '<label class="ttxs-ck' + (on ? " on" : "") + (dis ? " dis" : "") + '"' + (dis ? ' title="Đã đủ ' + MAX_DON_VI + ' đơn vị — bỏ chọn một đơn vị khác trước"' : '') + '>' +
            '<input type="checkbox" data-u="' + esc(n) + '"' + (on ? " checked" : "") + (dis ? " disabled" : "") + '> ' + esc(unitLabel(n)) + '</label>';
        }).join("") + '</div>';
        h += '<div class="ttxs-hint">Mỗi quý công nhận tối đa ' + MAX_DON_VI + ' đơn vị. Danh sách lấy từ danh mục đơn vị ở Quản trị hệ thống.</div>';
      }
      h += '</div>';
    }

    if (f.trangThai === "tnld") {
      h += '<div class="field"><label>Vụ TNLĐ liên quan <span class="muted" style="font-weight:400">(từ module Tai nạn - Sự cố)</span></label>';
      // Vụ trong quý + vụ đã liên kết trước đây (nếu nằm ngoài quý)
      var list = f.incs.slice();
      f.tnldIds.forEach(function (id) {
        if (!list.some(function (x) { return String(x.id) === id; })) list.push(incById(id) || { id: id, ten: "(vụ việc không còn trong module Tai nạn - Sự cố)", missing: true });
      });
      if (!list.length) {
        h += '<div class="ttxs-empty">Không có vụ TNLĐ nào được ghi nhận trong quý ' + qlabel(f.nam, f.quy) + ' ở module Tai nạn - Sự cố. ' +
             'Có thể <a href="tai-nan-su-co.html" target="_blank">ghi nhận vụ việc</a> trước, hoặc ghi chú lý do bên dưới.</div>';
      } else {
        h += '<div class="ttxs-units one">' + list.map(function (x) {
          var on = f.tnldIds.indexOf(String(x.id)) >= 0;
          return '<label class="ttxs-ck red' + (on ? " on" : "") + '"><input type="checkbox" data-inc="' + esc(x.id) + '"' + (on ? " checked" : "") + '> ' +
            '<span><b>' + esc(x.ten || "Tai nạn lao động") + '</b>' + (x.thoiGian ? ' <span class="muted">· ' + fmtIncDate(x.thoiGian) + '</span>' : '') + '</span></label>';
        }).join("") + '</div>';
      }
      h += '</div>';
    }

    if (f.trangThai !== "cho") {
      h += '<div class="field"><label>Ghi chú' + (f.trangThai === "tnld" ? ' / lý do' : '') + '</label>' +
        '<textarea id="ttxs-gc" class="inp" rows="2" placeholder="' + (f.trangThai === "tnld" ? "VD: TNLĐ ngày 12/08/2024 tại Xưởng sửa chữa" : "VD: Quyết định số …/QĐ-DVCC ngày …") + '">' + esc(f.ghiChu) + '</textarea></div>';
    } else {
      h += '<div class="ttxs-hint">' + (f.exists ? "Lưu với trạng thái này sẽ <b>xoá kết quả</b> đã nhập của quý " + qlabel(f.nam, f.quy) + "." : "Quý này sẽ hiển thị là chưa có kết quả.") + '</div>';
    }

    box.innerHTML = h;

    var meta = document.getElementById("ttxs-fmeta");
    if (meta) meta.textContent = f.rec && f.rec.updatedBy ? "Sửa lần cuối: " + f.rec.updatedBy + (f.rec.updatedAt ? " · " + new Date(f.rec.updatedAt).toLocaleString("vi-VN") : "") : "";

    // Sự kiện
    document.getElementById("ttxs-fy").onchange = function () {
      var y = +this.value, q = f.quy;
      if (qindex(y, q) > qindex(cur.nam, cur.quy)) q = cur.quy;
      loadQuarter(y, q);
    };
    document.getElementById("ttxs-fq").onchange = function () { loadQuarter(f.nam, +this.value); };
    box.querySelectorAll("[data-st]").forEach(function (b) {
      b.onclick = function () { keepNote(); f.trangThai = b.getAttribute("data-st"); f.auto = false; drawForm(); };
    });
    box.querySelectorAll("input[data-u]").forEach(function (cb) {
      cb.onchange = function () {
        keepNote();
        var n = cb.getAttribute("data-u"), k = unitKey(n);
        f.donVi = f.donVi.filter(function (x) { return unitKey(x) !== k; });
        if (cb.checked) {
          if (f.donVi.length >= MAX_DON_VI) { cb.checked = false; return; }   // chặn cứng
          f.donVi.push(unitLabel(n));
        }
        drawForm();
      };
    });
    box.querySelectorAll("input[data-inc]").forEach(function (cb) {
      cb.onchange = function () {
        keepNote();
        var id = cb.getAttribute("data-inc");
        f.tnldIds = f.tnldIds.filter(function (x) { return x !== id; });
        if (cb.checked) f.tnldIds.push(id);
        drawForm();
      };
    });
  }
  function seg(v, t) {
    return '<button type="button" data-st="' + v + '" class="' + (_f.trangThai === v ? "on " + v : "") + '">' + t + '</button>';
  }
  function keepNote() { var g = document.getElementById("ttxs-gc"); if (g && _f) _f.ghiChu = g.value; }

  function save() {
    keepNote();
    var f = _f; if (!f) return;
    var id = qid(f.nam, f.quy);

    if (f.trangThai === "cho") {
      if (!f.exists) { closeForm(); return; }
      if (!confirm("Xoá kết quả đã nhập của quý " + qlabel(f.nam, f.quy) + "?")) return;
      _rows = _rows.filter(function (r) { return r.id !== id; });
      lsSave(LS_KEY, _rows);
      closeForm(); draw();
      if (typeof DB !== "undefined") DB.delete(SHEET, id).then(function () {
          setSync("ok", "Đã lưu");
          act("delete", "đã xoá kết quả xét quý " + qlabel(f.nam, f.quy), id);
        })
        .catch(function (e) { toastErr("Xoá trên máy chủ thất bại: " + (e && e.message || e) + ". Sẽ thử lại khi có mạng."); });
      return;
    }

    var rec = {
      id: id, nam: f.nam, quy: f.quy, trangThai: f.trangThai,
      donVi: f.trangThai === "xet" ? f.donVi.map(unitLabel).slice(0, MAX_DON_VI) : [],
      tnldIds: f.trangThai === "tnld" ? f.tnldIds.slice() : [],
      ghiChu: String(f.ghiChu || "").trim(),
      updatedBy: _user ? (_user.username || "") : "",
      updatedAt: new Date().toISOString()
    };
    var err = validate(rec);
    if (err) { alert(err); return; }
    if (rec.trangThai === "xet" && !rec.donVi.length &&
        !confirm("Chưa chọn đơn vị nào. Lưu quý " + qlabel(f.nam, f.quy) + " là không có đơn vị được công nhận?")) return;

    _rows = _rows.filter(function (r) { return r.id !== id; }).concat([rec]);
    lsSave(LS_KEY, _rows);
    closeForm(); draw();
    if (typeof DB === "undefined") return;
    setSync("busy", "Đang lưu…");
    var wasNew = !f.exists;
    DB.insert(SHEET, rec).then(function () {
      setSync("ok", "Đã lưu");
      act(wasNew ? "create" : "update", (wasNew ? "đã nhập" : "đã cập nhật") + " kết quả quý " + qlabel(rec.nam, rec.quy) + ": " +
        (rec.trangThai === "tnld" ? "không xét do TNLĐ"
          : rec.donVi.length ? rec.donVi.join(", ") : "không có đơn vị được công nhận"), id);
    })
      .catch(function (e) {
        setSync("err", "Chưa lưu được lên máy chủ");
        toastErr("Lưu lên máy chủ thất bại: " + (e && e.message || e) + ". Dữ liệu vẫn giữ tại máy và sẽ gửi lại sau.");
      });
  }

  /* Nhật ký hoạt động (assets/hse-activity.js) — ghi tay để mô tả rõ quý/đơn vị */
  function act(action, detail, id) {
    try {
      if (global.HSE_ACT && HSE_ACT.log)
        HSE_ACT.log({ action: action, module: "Tập thể xuất sắc ATSKMT", detail: detail, ref_table: SHEET, ref_id: id });
    } catch (e) {}
  }

  function toastErr(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#D32F2F;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:9999;max-width:380px;box-shadow:0 4px 16px rgba(0,0,0,.2)";
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 6000);
  }

  /* =========================================================
     XUẤT EXCEL — bố cục giống file Excel gốc (Quý × Đơn vị)
     ========================================================= */
  var _xlsxLoading = null;
  function ensureXLSX() {
    if (typeof XLSX !== "undefined") return Promise.resolve(true);
    if (_xlsxLoading) return _xlsxLoading;
    _xlsxLoading = new Promise(function (resolve) {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      sc.onload = function () { resolve(typeof XLSX !== "undefined"); };
      sc.onerror = function () { _xlsxLoading = null; resolve(false); };
      document.head.appendChild(sc);
    });
    return _xlsxLoading;
  }
  function exportExcel() {
    var qs = visibleQuarters(), units = unitRows();
    var aoa = toAoa(qs, byId(), units, unitKey);
    ensureXLSX().then(function (ok) {
      if (!ok) { alert("Không tải được thư viện xuất Excel. Kiểm tra kết nối mạng."); return; }
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 10 }].concat(units.map(function (u) { return { wch: Math.max(12, u.ten.length + 2) }; }));
      // Gộp ô cho dòng "Không được nhận do TNLĐ" như file gốc
      var merges = [];
      aoa.forEach(function (row, i) {
        if (row[1] === "Không được nhận do TNLĐ" && units.length > 1) merges.push({ s: { r: i, c: 1 }, e: { r: i, c: units.length } });
      });
      ws["!merges"] = merges;
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tập thể xuất sắc");
      var tag = _period === "all" ? "tat-ca" : _period === "3y" ? "3-nam" : _period;
      XLSX.writeFile(wb, "Tap-the-xuat-sac-ATSKMT_" + tag + ".xlsx");
    });
  }

  /* =========================================================
     STYLE
     ========================================================= */
  function styles() {
    var s = document.createElement("style");
    s.id = "ttxs-style";
    s.textContent = [
      ".ttxs-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}",
      ".ttxs-toolbar .spacer{flex:1}",
      ".ttxs-sync{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)}",
      ".ttxs-sync i{width:8px;height:8px;border-radius:50%;background:#c0c8d6}",
      ".ttxs-sync.ok i{background:#11964E}.ttxs-sync.err i{background:var(--accent)}.ttxs-sync.err{color:var(--accent)}",
      ".ttxs-sync.busy i{background:var(--warning)}",
      ".ttxs-note{display:block;line-height:1.6;background:#fff8e6;border:1px solid #f3dfa6;color:#7a5a00;border-radius:8px;padding:9px 12px;font-size:13px;margin-bottom:12px}",
      ".ttxs-note a{font-weight:600}",
      ".ttxs-note svg{margin-right:4px}",
      ".ttxs-top{display:flex;align-items:center;gap:14px;padding:14px 18px;margin-bottom:14px;border-left:4px solid #d9a400}",
      ".ttxs-top .ic{width:44px;height:44px;border-radius:12px;background:#fff6d6;color:#a17800;display:flex;align-items:center;justify-content:center;flex-shrink:0}",
      ".ttxs-top .bd{min-width:0}",
      ".ttxs-top .lbl{font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:5px}",
      ".ttxs-top .lbl span{text-transform:none;letter-spacing:0;font-weight:500}",
      ".ttxs-top .nm{display:flex;align-items:center;flex-wrap:wrap;gap:2px}",
      ".ttxs-top .nm .ttxs-chip{font-size:13px;padding:4px 12px}",
      ".ttxs-top .n{font-size:15px;color:var(--text);margin-left:6px}",
      ".ttxs-split{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}",
      ".ttxs-card{padding:16px}",
      ".ttxs-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:var(--brand);margin-bottom:10px}",
      ".ttxs-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}",
      ".ttxs-heat{border-collapse:collapse;width:auto;font-size:12px}",
      ".ttxs-heat th,.ttxs-heat td{border:1px solid var(--border);padding:0;text-align:center;white-space:nowrap;text-transform:none;letter-spacing:0}",
      ".ttxs-heat th{background:#f6f8fc;color:var(--brand);font-weight:700;min-width:30px;padding:3px 2px;font-size:11.5px}",
      ".ttxs-heat th .y{font-size:10px;color:var(--text-muted);font-weight:600}",
      ".ttxs-heat th.ed{cursor:pointer}.ttxs-heat th.ed:hover{background:#e4ebf7}",
      ".ttxs-heat td{height:28px;min-width:30px}",
      ".ttxs-heat td.u,.ttxs-heat th.u{position:sticky;left:0;z-index:1;background:#fff;text-align:left;padding:4px 10px;min-width:170px;max-width:220px;overflow:hidden;text-overflow:ellipsis;font-weight:600;font-size:12.5px}",
      ".ttxs-heat th.u{background:#f6f8fc}",
      ".ttxs-heat td.u i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}",
      ".ttxs-heat td.u.off{color:var(--text-muted);font-weight:500;font-style:italic}",
      ".ttxs-heat td.h{background:#d9a400}",
      ".ttxs-heat td.t{background:#f8d3d8}",
      ".ttxs-heat td.p{background:repeating-linear-gradient(45deg,#f3f5fa,#f3f5fa 4px,#e3e8f1 4px,#e3e8f1 8px)}",
      ".ttxs-heat .ys{border-left:2px solid var(--brand)}",
      ".ttxs-heat .tot{font-weight:800;color:var(--text);padding:0 10px;background:#f6f8fc;border-left:2px solid var(--brand)}",
      ".ttxs-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);margin-top:10px}",
      ".ttxs-legend span{display:inline-flex;align-items:center;gap:6px}",
      ".ttxs-legend .sw{width:13px;height:13px;border-radius:3px;border:1px solid var(--border);display:inline-block}",
      ".ttxs-legend .sw.h{background:#d9a400}.ttxs-legend .sw.t{background:#f8d3d8}",
      ".ttxs-legend .sw.p{background:repeating-linear-gradient(45deg,#f3f5fa,#f3f5fa 3px,#e3e8f1 3px,#e3e8f1 6px)}",
      ".ttxs-empty{background:var(--bg);border-radius:8px;padding:14px;font-size:13px;color:var(--text-muted)}",
      ".ttxs-last{font-size:13px;margin-bottom:6px}",
      ".ttxs-chip{display:inline-flex;align-items:center;gap:5px;color:#fff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:14px;margin:2px 4px 2px 0}",
      ".ttxs-gc{font-size:12px;color:var(--text-muted);margin-top:6px}",
      ".ttxs-tn{background:#fdecee;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12.5px}",
      ".ttxs-tn .q{display:flex;align-items:center;gap:6px;color:var(--accent);font-weight:700}",
      ".ttxs-tn .q .ed{margin-left:auto;color:var(--brand-light)}",
      ".ttxs-tn .inc{margin-top:3px;color:var(--text)}",
      ".ttxs-tn .gc{margin-top:3px;color:var(--text-muted);font-style:italic}",
      ".ttxs-tn .lk{display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-size:12px;font-weight:600}",
      ".ttxs-modal{max-width:560px}",
      ".ttxs-modal .field{margin-bottom:14px}",
      ".ttxs-modal textarea{width:100%;resize:vertical;font-family:inherit}",
      ".ttxs-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}",
      ".ttxs-row .field select{min-width:110px}",
      ".ttxs-qst{margin-bottom:16px}",
      ".ttxs-b{display:inline-block;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:20px;background:var(--bg);color:var(--text-muted)}",
      ".ttxs-b.ok{background:#e4ebf7;color:var(--brand)}",
      ".ttxs-seg{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}",
      ".ttxs-seg button{flex:1;border:none;border-right:1px solid var(--border);background:#fff;padding:8px 6px;font-size:12.5px;font-weight:600;color:var(--text-muted)}",
      ".ttxs-seg button:last-child{border-right:none}",
      ".ttxs-seg button.on{background:var(--brand);color:#fff}",
      ".ttxs-seg button.on.tnld{background:var(--accent)}",
      ".ttxs-seg button.on.cho{background:#5F6E82}",
      ".ttxs-units{display:grid;grid-template-columns:1fr 1fr;gap:6px}",
      ".ttxs-units.one{grid-template-columns:1fr}",
      ".ttxs-ck{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;cursor:pointer;font-weight:500 !important;margin:0 !important}",
      ".ttxs-ck input{width:16px !important;height:16px;padding:0 !important;accent-color:var(--brand);flex-shrink:0}",
      ".ttxs-modal .ttxs-ck{display:flex}",
      ".ttxs-ck.on{border-color:#d9a400;background:#fff6d6}",
      ".ttxs-ck.red.on{border-color:#f2b8c0;background:#fdecee}",
      ".ttxs-ck.red input{accent-color:var(--accent)}",
      ".ttxs-ck.dis{opacity:.45;cursor:not-allowed}",
      ".ttxs-cnt{font-weight:600;font-size:11.5px;color:var(--text-muted);margin-left:6px}",
      ".ttxs-cnt.full{color:#8a6500}",
      ".ttxs-hint{font-size:12px;color:var(--text-muted);margin-top:6px}",
      ".ttxs-meta{flex:1;font-size:11.5px;color:var(--text-muted);align-self:center}",
      "@media (max-width:980px){.ttxs-split{grid-template-columns:minmax(0,1fr)}}",
      "@media (max-width:520px){.ttxs-units{grid-template-columns:1fr}.ttxs-heat td.u,.ttxs-heat th.u{min-width:120px;max-width:140px}}"
    ].join("\n");
    return s;
  }
})(typeof window !== "undefined" ? window : globalThis);
