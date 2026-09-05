/* =========================================================
   DON-VI.JS — Danh mục Phòng/Ban/Đơn vị dùng chung
   Webapp Quản lý HSE · Vietsovpetro

   VẤN ĐỀ GIẢI QUYẾT
   Trước đây danh sách đơn vị được viết cứng trong từng trang
   (ke-hoach.html, kiem-tra-cac-cap.html, huan-luyen-dao-tao.js,
   app.js, cap-phat-bhld.html...) với 4 phiên bản khác nhau
   (5 / 6 / 7 / 12 mục). Đổi tên hay thêm bớt phòng ban phải sửa code.
   Module này gom về MỘT danh mục do Admin quản lý (bảng "DonVi").

   NGUYÊN TẮC THIẾT KẾ
   1. Bản ghi nghiệp vụ vẫn LƯU THEO TÊN (như hiện nay) → không phải
      di trú dữ liệu, các trang không phải đổi cách đọc/ghi.
   2. Mỗi đơn vị có MÃ CỐ ĐỊNH (ma) không bao giờ đổi, và danh sách
      BÍ DANH (ten_cu) tự động lưu mọi tên cũ. resolve() tra được đơn vị
      từ bất kỳ tên nào từng dùng → báo cáo cũ không bị mồ côi.
   3. Khi Admin đổi tên, gọi renameScan()/renameApply() để cập nhật
      hàng loạt bản ghi cũ. Nếu bước này lỗi/offline, bí danh ở (2)
      vẫn giữ cho hệ thống chạy đúng.
   4. Luôn có SEED mặc định trong code + cache localStorage → droplist
      hiện ngay lập tức, không chờ mạng; tải xong từ Supabase thì phát
      sự kiện "hse-donvi-change" để trang vẽ lại.

   ĐỐI SOÁT DỮ LIỆU (không có giao diện — chạy khi cần)
     Mở trang chủ → Quản trị hệ thống, bấm F12 → Console, dán:

       HSE_UNITS.audit().then(r=>{
         const out = 'Chua dung: ' + (r.chuaDung.map(u=>u.ten).join(', ')||'(khong)') + '\n'
           + 'Loi doc: '   + (r.errors.map(e=>e.target.label+' -> '+e.message).join(' | ')||'(khong)') + '\n\n'
           + r.rows.map(x =>
               `[${x.status}] ${x.total} ban ghi | ${x.value}`
               + (x.lech && x.lech.length ? ` | lech: ${x.lech.map(v=>'"'+v+'"').join(', ')}` : '')
               + (x.keyed ? ' | KHOA-TIEN-TRINH' : '')
               + '\n    ' + Object.keys(x.targets).map(k=>k+': '+x.targets[k]).join(' | ')
             ).join('\n');
         console.log(out); copy(out);
       });

     Nó quét mọi cột đang lưu tên đơn vị (xem RENAME_TARGETS) và chỉ ra:
     giá trị lạ, tên cũ chưa cập nhật, đơn vị đã ngừng, và các cách viết lệch
     chuẩn (thừa khoảng trắng / gạch ngang dài) — thứ mà giao diện không thấy.
     Nên chạy sau mỗi lần nhập liệu hàng loạt hoặc đổi tên đơn vị.
     ⚠️ Phải chạy ở trang chủ: cần cả db.js lẫn bhld-sync.js mới đọc đủ 12 cột.

   CÁCH DÙNG (trang nghiệp vụ)
     HSE_UNITS.list("ke-hoach")            → ["Cảng biển", ...]
     HSE_UNITS.allowOther("ke-hoach")      → true/false (mục "Khác")
     HSE_UNITS.optionsHtml("ke-hoach", val)→ chuỗi <option> đã chọn sẵn
     HSE_UNITS.onChange(fn)                → gọi lại khi danh mục đổi
     HSE_UNITS.ready().then(fn)            → chờ tải lần đầu (không bắt buộc)
   ========================================================= */
(function (global) {
  "use strict";

  var LS_LIST = "hse_don_vi";
  var LS_CFG  = "hse_don_vi_cauhinh";
  var SHEET   = "don_vi";          // → bảng "DonVi" (khai báo trong db.js)
  var CFG_SHEET = "app_settings";  // → bảng key-value "TraCuuATVSLD"
  var CFG_KEY = "donvi_cauhinh";

  /* ─────────────────────────────────────────────
     ĐIỂM SỬ DỤNG — các trang có droplist đơn vị.
     Thêm trang mới: thêm 1 dòng ở đây, giao diện Quản trị tự có thêm cột.
     "applied" = trang đã chuyển sang dùng danh mục hay chưa (để màn hình
     Quản trị nói thật với Admin, tránh tưởng đã có tác dụng).
     ───────────────────────────────────────────── */
  var PAGES = [
    { slug: "ke-hoach",           title: "Kế hoạch",             note: "Đơn vị chủ trì & phối hợp", applied: true  },
    { slug: "kiem-tra-cac-cap",   title: "Kiểm tra các cấp",     note: "Chọn đơn vị ở Bước 1",      applied: true  },
    { slug: "huan-luyen-dao-tao", title: "Huấn luyện - Đào tạo", note: "Đơn vị của từng nhân sự",   applied: true  },
    { slug: "cap-phat-bhld",      title: "Cấp phát BHLĐ",        note: "Đơn vị cấp phát & phân quyền", applied: true  },
    { slug: "binh-ap-luc",        title: "Bình áp lực",          note: "Tab trong Quản lý thiết bị", applied: true  },
    { slug: "thiet-bi-nang",      title: "Thiết bị nâng",        note: "Tab trong Quản lý thiết bị", applied: true  }
  ];

  /* ─────────────────────────────────────────────
     CÁC CỘT DỮ LIỆU ĐANG LƯU TÊN ĐƠN VỊ
     Dùng cho chức năng "đổi tên hàng loạt". Thêm trang mới có lưu tên
     đơn vị thì khai báo thêm ở đây — KHÔNG rải rác nơi khác.
     type: "text" = 1 chuỗi · "array" = mảng tên (có thể lưu dạng chuỗi JSON)
     ───────────────────────────────────────────── */
  var RENAME_TARGETS = [
    /* ── Đọc qua db.js (assets/db.js giữ bảng ánh xạ của các trang thường) ── */
    { sheet: "ke_hoach_mot_lan", col: "chuTri",       type: "text",  via: "db",   label: "Kế hoạch một lần — Chủ trì" },
    { sheet: "ke_hoach_mot_lan", col: "phoiHop",      type: "array", via: "db",   label: "Kế hoạch một lần — Phối hợp" },
    { sheet: "ke_hoach_lap_lai", col: "chuTri",       type: "text",  via: "db",   label: "Kế hoạch lặp lại — Chủ trì" },
    { sheet: "ke_hoach_lap_lai", col: "phoiHop",      type: "array", via: "db",   label: "Kế hoạch lặp lại — Phối hợp" },
    { sheet: "kiem_tra_cap12",   col: "donVi",        type: "text",  via: "db",   label: "Kiểm tra các cấp (cấp 1-2)" },
    { sheet: "hl_nhansu",        col: "unit",         type: "text",  via: "db",   label: "Huấn luyện - Đào tạo — Nhân sự" },
    { sheet: "users",            col: "capPhatUnits", type: "array", via: "db",   label: "Phân quyền đơn vị cấp phát" },
    /* ── Đọc qua bhld-sync.js — trang Cấp phát BHLĐ có bảng ánh xạ RIÊNG,
         KHÔNG nằm trong db.js. Phải hỏi BHLD.tbl() để lấy đúng tên bảng. ── */
    { sheet: "nhanvien",            col: "boPhan", type: "text", via: "bhld", label: "Cấp phát BHLĐ — Nhân viên" },
    { sheet: "nhom_nv",             col: "donVi",  type: "text", via: "bhld", label: "Cấp phát BHLĐ — Nhóm nội bộ" },
    { sheet: "phieu_requests",      col: "donVi",  type: "text", via: "bhld", label: "Cấp phát BHLĐ — Phiếu yêu cầu" },
    { sheet: "pending_changes",     col: "donVi",  type: "text", via: "bhld", label: "Cấp phát BHLĐ — Thay đổi chờ duyệt" },
    /* ⚠️ Bảng này ghép TÊN ĐƠN VỊ vào khoá chính: id = "<tên đơn vị>__<quý>"
       (xem _cpwKey trong cap-phat-bhld.html). Sửa riêng cột donVi KHÔNG đủ —
       khoá cũ vẫn mồ côi. Vì vậy chỉ ĐỌC để đối soát, không tự đổi tên. */
    { sheet: "cap_phat_tien_trinh", col: "donVi",  type: "text", via: "bhld", keyed: "id",
      label: "Cấp phát BHLĐ — Tiến trình cấp phát" }
  ];

  /* Đọc toàn bộ một bảng, định tuyến đúng module sở hữu bảng đó */
  function _readAll(t) {
    if (t.via === "bhld") {
      if (!window.BHLD || !window.HSE_SB) {
        return Promise.reject(new Error("Chưa nạp bhld-sync.js hoặc chưa kết nối Supabase"));
      }
      return window.HSE_SB.from(window.BHLD.tbl(t.sheet)).select("*").then(function (r) {
        if (r.error) throw new Error(r.error.message);
        return r.data || [];
      });
    }
    if (typeof DB === "undefined") return Promise.reject(new Error("Chưa nạp db.js"));
    return DB.getAll(t.sheet);
  }

  /* Các giá trị đơn vị có trong một bản ghi của một cột */
  function _valuesOf(t, r) {
    return (t.type === "array" ? asArr(r[t.col]) : [r[t.col]])
      .map(function (v) { return String(v == null ? "" : v).trim(); })
      .filter(Boolean);
  }

  /* ─────────────────────────────────────────────
     SEED MẶC ĐỊNH — khớp đúng hiện trạng đang hard-code trong code,
     để lần chạy đầu (chưa tạo bảng DonVi) giao diện không đổi gì.
     ───────────────────────────────────────────── */
  var DEFAULTS = [
    { ma:"ban_giam_doc",      ten:"Ban giám đốc",                    nhom:"phong_ban", sort:10,  he_thong:false, pages:["huan-luyen-dao-tao"] },
    { ma:"p_ky_thuat_vat_tu", ten:"Phòng Kỹ thuật - Vật tư",         nhom:"phong_ban", sort:20,  he_thong:false, pages:["ke-hoach","huan-luyen-dao-tao"] },
    { ma:"p_kinh_te_tcns",    ten:"Phòng Kinh tế - Tổ chức nhân sự", nhom:"phong_ban", sort:30,  he_thong:false, pages:["huan-luyen-dao-tao"] },
    { ma:"p_ke_toan",         ten:"Phòng Kế toán",                   nhom:"phong_ban", sort:40,  he_thong:false, pages:["huan-luyen-dao-tao"] },
    { ma:"p_thuong_mai_dv",   ten:"Phòng Thương mại - Dịch vụ",      nhom:"phong_ban", sort:50,  he_thong:false, pages:["huan-luyen-dao-tao"] },
    { ma:"ban_thuc_hien_hd",  ten:"Ban Thực hiện hợp đồng",          nhom:"phong_ban", sort:60,  he_thong:false, pages:["huan-luyen-dao-tao"] },
    { ma:"ban_dieu_do_sx",    ten:"Ban Điều độ sản xuất",            nhom:"phong_ban", sort:70,  he_thong:false, pages:["huan-luyen-dao-tao"] },
    { ma:"cang_bien",         ten:"Cảng biển",                       nhom:"don_vi_sx", sort:80,  he_thong:false, icon:"anchor",   pages:["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld","binh-ap-luc"] },
    { ma:"can_cu_kho_gn",     ten:"Căn cứ Kho - Giao nhận",          nhom:"don_vi_sx", sort:90,  he_thong:false, icon:"package",  pages:["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"] },
    { ma:"xuong_sua_chua",    ten:"Xưởng sửa chữa",                  nhom:"don_vi_sx", sort:100, he_thong:false, icon:"wrench",   pages:["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld","binh-ap-luc"] },
    { ma:"doi_xe_vthh",       ten:"Đội xe VTHH&PTTBCD",              nhom:"don_vi_sx", sort:110, he_thong:false, icon:"truck",    pages:["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"] },
    { ma:"doi_xe_vchk",       ten:"Đội xe VCHK",                     nhom:"don_vi_sx", sort:120, he_thong:false, icon:"car",      pages:["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"] },
    { ma:"cong_doan",         ten:"Công đoàn",                       nhom:"doan_the",  sort:130, he_thong:false, pages:["ke-hoach","huan-luyen-dao-tao"] },
    { ma:"bo_may_dieu_hanh",  ten:"Bộ máy điều hành",                nhom:"he_thong",  sort:200, he_thong:true,  icon:"landmark", pages:["cap-phat-bhld"] },
    { ma:"test",              ten:"Test",                            nhom:"he_thong",  sort:210, he_thong:true,  icon:"flask",    pages:["cap-phat-bhld"] },
    /* "Mục gộp" — cách nói gộp, KHÔNG phải một đơn vị. Chọn được trong
       droplist nhưng bị loại khỏi mọi chỗ đếm/thống kê theo đơn vị. */
    { ma:"gop_tat_ca_dvsx",   ten:"Tất cả các ĐVSX",                 nhom:"muc_gop",   sort:300, he_thong:false, muc_gop:true, pages:["ke-hoach"] },
    { ma:"gop_toan_xn",       ten:"Tất cả đơn vị/phòng/ban",         nhom:"muc_gop",   sort:310, he_thong:false, muc_gop:true, pages:["ke-hoach"] }
  ];

  var DEFAULT_CFG = {
    other: { "ke-hoach": true, "kiem-tra-cac-cap": true, "huan-luyen-dao-tao": false, "cap-phat-bhld": false }
  };

  var NHOM_LABEL = { phong_ban: "Phòng / Ban", don_vi_sx: "Đơn vị sản xuất", doan_the: "Đoàn thể",
                     he_thong: "Đơn vị hệ thống", muc_gop: "Mục gộp (không phải đơn vị)" };

  /* ─────────────── TIỆN ÍCH ─────────────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* Chuẩn hoá để SO KHỚP tên: bỏ hoa/thường, gộp khoảng trắng và quy mọi
     biến thể gạch ngang (– — ‒ ―) về "-". Đây là chỗ xử lý luôn lỗi
     "Phòng Kỹ thuật – Vật tư" (gạch dài) vs "Phòng Kỹ thuật - Vật tư". */
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[‐-―−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
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
  function bySort(a, b) {
    var d = (a.sort || 0) - (b.sort || 0);
    if (d !== 0) return d;
    return String(a.ten || "").localeCompare(String(b.ten || ""), "vi");
  }
  function normRow(r) {
    return {
      ma:       String(r.ma || "").trim(),
      ten:      String(r.ten || "").trim(),
      ten_cu:   asArr(r.ten_cu),
      nhom:     r.nhom || "phong_ban",
      sort:     parseInt(r.sort, 10) || 0,
      active:   r.active !== false,
      he_thong: !!r.he_thong,
      muc_gop:  !!r.muc_gop,
      icon:     r.icon || "",
      pages:    asArr(r.pages),
      ghi_chu:  r.ghi_chu || ""
    };
  }

  /* ─────────────── CACHE localStorage ─────────────── */
  function loadCache() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_LIST));
      if (v && v.length) return v.map(normRow).sort(bySort);
    } catch (e) {}
    return clone(DEFAULTS).map(normRow).sort(bySort);
  }
  function saveCache(arr) { try { localStorage.setItem(LS_LIST, JSON.stringify(arr)); } catch (e) {} }
  function loadCfgCache() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_CFG));
      if (v && typeof v === "object") return v;
    } catch (e) {}
    return clone(DEFAULT_CFG);
  }
  function saveCfgCache(c) { try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch (e) {} }

  /* ─────────────── TRẠNG THÁI ─────────────── */
  var _list = loadCache();
  var _cfg  = loadCfgCache();
  var _readyPromise = null;
  var _loaded = false;

  function emit() {
    try { global.dispatchEvent(new CustomEvent("hse-donvi-change", { detail: { list: _list } })); }
    catch (e) {
      try { var ev = document.createEvent("Event"); ev.initEvent("hse-donvi-change", false, false); global.dispatchEvent(ev); } catch (e2) {}
    }
  }

  /* ─────────────── ĐỌC (đồng bộ, từ cache) ─────────────── */
  function all(opt) {
    opt = opt || {};
    return _list.filter(function (u) {
      if (!u.active && !opt.includeInactive) return false;
      if (u.he_thong && opt.excludeHeThong) return false;
      // excludeGop: bỏ các "mục gộp" — dùng ở mọi nơi ĐẾM theo đơn vị
      if (u.muc_gop && opt.excludeGop) return false;
      return true;
    }).map(function (u) { return u; }).sort(bySort);
  }

  /** Danh sách TÊN đơn vị dùng cho droplist của 1 trang */
  function list(page, opt) {
    opt = opt || {};
    return all(opt).filter(function (u) {
      if (!page) return true;
      return u.pages.indexOf(page) >= 0;
    }).map(function (u) { return u.ten; });
  }

  /** Tra 1 chuỗi bất kỳ (tên hiện tại, tên cũ, hoặc mã) → bản ghi đơn vị */
  function resolve(x) {
    if (!x) return null;
    var k = norm(x), raw = String(x).trim();
    var i, u;
    for (i = 0; i < _list.length; i++) { u = _list[i]; if (u.ma === raw) return u; }
    for (i = 0; i < _list.length; i++) { u = _list[i]; if (norm(u.ten) === k) return u; }
    for (i = 0; i < _list.length; i++) {
      u = _list[i];
      for (var j = 0; j < u.ten_cu.length; j++) if (norm(u.ten_cu[j]) === k) return u;
    }
    return null;
  }
  /** Tên hiển thị hiện hành của một giá trị đã lưu (giữ nguyên nếu không tra được) */
  function label(x) { var u = resolve(x); return u ? u.ten : String(x == null ? "" : x); }

  function byMa(ma) { for (var i = 0; i < _list.length; i++) if (_list[i].ma === ma) return _list[i]; return null; }
  /* Mã ổn định của một tên đơn vị (dùng làm khoá thay cho tên).
     Không tra được thì trả lại chính chuỗi đã chuẩn hoá, để khoá vẫn duy nhất. */
  function maOf(x) { var u = resolve(x); return u ? u.ma : norm(x).replace(/\s+/g, "_"); }

  function allowOther(page) { return !!(_cfg && _cfg.other && _cfg.other[page]); }

  /**
   * Chuỗi <option> cho droplist của một trang.
   * - Tự đổi giá trị cũ sang tên mới nếu đơn vị đã được đổi tên.
   * - Giá trị không còn trong danh mục vẫn được GIỮ LẠI (kèm ghi chú),
   *   để người dùng mở bản ghi cũ ra sửa không làm mất dữ liệu.
   */
  function optionsHtml(page, val, placeholder) {
    var names = list(page);
    var cur = String(val == null ? "" : val).trim();
    var u = cur ? resolve(cur) : null;
    if (u) cur = u.ten;                       // quy về tên hiện hành
    var out = '<option value="">' + esc(placeholder || "-- Chọn đơn vị --") + "</option>";
    var found = false;
    names.forEach(function (n) {
      var sel = norm(n) === norm(cur);
      if (sel) found = true;
      out += '<option value="' + esc(n) + '"' + (sel ? " selected" : "") + ">" + esc(n) + "</option>";
    });
    if (cur && !found) {
      out += '<option value="' + esc(cur) + '" selected>' + esc(cur) + " (không còn dùng)</option>";
    }
    return out;
  }

  function pages() { return clone(PAGES); }
  function nhomLabel(n) { return NHOM_LABEL[n] || n; }

  /* ─────────────── TẢI TỪ SUPABASE ─────────────── */
  /* Đọc danh mục: qua db.js nếu có, không thì gọi thẳng Supabase.
     Trang Cấp phát BHLĐ KHÔNG nạp db.js — nó có bhld-sync.js riêng. */
  function _fetchList() {
    if (typeof DB !== "undefined") return DB.getAll(SHEET);
    if (!window.HSE_SB) return Promise.reject(new Error("Chưa kết nối Supabase"));
    return window.HSE_SB.from("DonVi").select("*").then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return r.data || [];
    });
  }
  function _fetchConfig() {
    if (typeof DB !== "undefined") return DB.getById(CFG_SHEET, CFG_KEY);
    if (!window.HSE_SB) return Promise.reject(new Error("Chưa kết nối Supabase"));
    return window.HSE_SB.from("TraCuuATVSLD").select("*").eq("key", CFG_KEY).maybeSingle()
      .then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; });
  }

  function refresh() {
    return _fetchList().then(function (rows) {
      if (rows && rows.length) {
        _list = rows.map(normRow).filter(function (u) { return !!u.ma; }).sort(bySort);
        saveCache(_list);
      }
      return _fetchConfig().catch(function () { return null; });
    }).then(function (row) {
      if (row && row.value) {
        try {
          var c = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
          if (c && typeof c === "object") { _cfg = c; saveCfgCache(_cfg); }
        } catch (e) {}
      }
      _loaded = true;
      emit();
      return _list;
    }).catch(function () {
      // Bảng chưa tạo / mất mạng → dùng cache, trang vẫn chạy bình thường
      _loaded = true;
      return _list;
    });
  }
  function ready() {
    if (!_readyPromise) _readyPromise = refresh();
    return _readyPromise;
  }
  function isLoaded() { return _loaded; }

  function onChange(fn) {
    if (typeof fn !== "function") return;
    global.addEventListener("hse-donvi-change", fn);
  }

  /* ─────────────── GHI (chỉ dùng ở trang Quản trị) ─────────────── */
  function saveUnit(u) {
    var row = normRow(u);
    if (!row.ma) return Promise.reject(new Error("Thiếu mã đơn vị."));
    if (!row.ten) return Promise.reject(new Error("Thiếu tên đơn vị."));
    // cập nhật cache trước để giao diện phản hồi ngay
    var idx = -1;
    for (var i = 0; i < _list.length; i++) if (_list[i].ma === row.ma) idx = i;
    if (idx >= 0) _list[idx] = row; else _list.push(row);
    _list.sort(bySort); saveCache(_list); emit();
    var payload = {
      ma: row.ma, ten: row.ten, ten_cu: row.ten_cu, nhom: row.nhom,
      sort: row.sort, active: row.active, he_thong: row.he_thong,
      muc_gop: row.muc_gop, icon: row.icon,
      pages: row.pages, ghi_chu: row.ghi_chu, updated_at: new Date().toISOString()
    };
    if (typeof DB === "undefined") {
      // Trang không nạp db.js (vd Cấp phát BHLĐ) → ghi thẳng qua Supabase
      if (!window.HSE_SB) return Promise.resolve(row);
      return window.HSE_SB.from("DonVi").upsert(payload, { onConflict: "ma" })
        .then(function (r) { if (r.error) throw new Error(r.error.message); return row; });
    }
    return DB.insert(SHEET, payload).then(function () { return row; });
  }

  function removeUnit(ma) {
    _list = _list.filter(function (u) { return u.ma !== ma; });
    saveCache(_list); emit();
    if (typeof DB !== "undefined") return DB.delete(SHEET, ma);
    if (!window.HSE_SB) return Promise.resolve(true);
    return window.HSE_SB.from("DonVi").delete().eq("ma", ma)
      .then(function (r) { if (r.error) throw new Error(r.error.message); return true; });
  }

  function config() { return clone(_cfg); }
  function saveConfig(cfg) {
    _cfg = cfg && typeof cfg === "object" ? cfg : clone(DEFAULT_CFG);
    saveCfgCache(_cfg); emit();
    var row = { key: CFG_KEY, value: JSON.stringify(_cfg) };
    if (typeof DB !== "undefined") return DB.insert(CFG_SHEET, row).then(function () { return _cfg; });
    if (!window.HSE_SB) return Promise.resolve(_cfg);
    return window.HSE_SB.from("TraCuuATVSLD").upsert(row, { onConflict: "key" })
      .then(function (r) { if (r.error) throw new Error(r.error.message); return _cfg; });
  }

  /** Sinh mã ổn định từ tên (chỉ dùng khi TẠO MỚI; sau đó không đổi nữa) */
  function suggestMa(ten) {
    var s = String(ten || "").normalize ? String(ten).normalize("NFD").replace(/[̀-ͯ]/g, "") : String(ten || "");
    s = s.replace(/đ/g, "d").replace(/Đ/g, "D")
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, "_")
         .replace(/^_+|_+$/g, "")
         .slice(0, 40);
    if (!s) s = "dv";
    var base = s, n = 2;
    while (byMa(s)) { s = base + "_" + n; n++; }
    return s;
  }

  /* ─────────────── ĐỔI TÊN HÀNG LOẠT ───────────────
     renameScan(tenCu)  → đếm xem có bao nhiêu bản ghi cũ ở mỗi bảng
     renameApply(...)   → cập nhật chúng sang tên mới
     Cả hai đều "mềm": một bảng lỗi (chưa tạo / thiếu quyền) không làm
     hỏng các bảng còn lại; danh sách lỗi được trả về để báo cho Admin.
     Dù cập nhật thất bại, bí danh (ten_cu) vẫn giúp hệ thống hiểu đúng.
     ───────────────────────────────────────────── */
  function renameScan(tenCu) {
    if (typeof DB === "undefined") return Promise.resolve({ hits: [], errors: [], total: 0 });
    var k = norm(tenCu);
    var hits = [], errors = [];
    var jobs = RENAME_TARGETS.map(function (t) {
      return _readAll(t).then(function (rows) {
        var matched = (rows || []).filter(function (r) {
          return _valuesOf(t, r).some(function (v) { return norm(v) === k; });
        });
        if (matched.length) hits.push({ target: t, rows: matched });
      }).catch(function (e) {
        errors.push({ target: t, message: (e && e.message) || String(e) });
      });
    });
    return Promise.all(jobs).then(function () {
      var total = hits.reduce(function (s, h) { return s + h.rows.length; }, 0);
      hits.sort(function (a, b) { return b.rows.length - a.rows.length; });
      return { hits: hits, errors: errors, total: total };
    });
  }

  function renameApply(scan, tenCu, tenMoi) {
    if (typeof DB === "undefined" || !scan || !scan.hits.length) {
      return Promise.resolve({ updated: 0, errors: [] });
    }
    var k = norm(tenCu);
    var updated = 0, errors = [], skipped = [];
    var chain = Promise.resolve();
    scan.hits.forEach(function (h) {
      /* Bảng ghép tên đơn vị vào khoá chính: sửa cột không đủ, phải đổi cả
         khoá → để riêng, báo cho Admin thay vì âm thầm làm hỏng. */
      if (h.target.keyed) { skipped.push({ target: h.target, count: h.rows.length }); return; }
      h.rows.forEach(function (r) {
        chain = chain.then(function () {
          var patch = {};
          if (h.target.type === "array") {
            var cu = asArr(r[h.target.col]);
            var arr = cu.map(function (v) { return norm(v) === k ? tenMoi : v; });
            // Đã đúng sẵn (chỉ là biến thể cách viết trùng khớp) → khỏi ghi
            if (arr.join("\u0000") === cu.join("\u0000")) return;
            // giữ nguyên KIỂU lưu ban đầu (mảng thật hay chuỗi JSON)
            patch[h.target.col] = (typeof r[h.target.col] === "string") ? JSON.stringify(arr) : arr;
          } else {
            if (r[h.target.col] === tenMoi) return;   // đã đúng chính tả → bỏ qua
            patch[h.target.col] = tenMoi;
          }
          var pk = (h.target.sheet === "users") ? r.id : r.id;
          return DB.update(h.target.sheet, pk, patch).then(function () { updated++; })
            .catch(function (e) { errors.push({ target: h.target, id: pk, message: (e && e.message) || String(e) }); });
        });
      });
    });
    return chain.then(function () { return { updated: updated, errors: errors, skipped: skipped }; });
  }

  /* ─────────────── ĐỐI SOÁT DỮ LIỆU ───────────────
     Quét MỌI cột đang lưu tên đơn vị trong toàn hệ thống, gom các giá trị
     thực có và đối chiếu với danh mục. Trả về:
       rows[]      mỗi giá trị thực có: { value, total, targets{}, unit, status }
                   status: "ok"     — khớp đúng tên hiện hành trong danh mục
                           "ten_cu" — khớp qua bí danh (đơn vị đã đổi tên)
                           "ngung"  — có trong danh mục nhưng đã ngừng hoạt động
                           "la"     — KHÔNG có trong danh mục (gõ sai / đơn vị ngoài)
       chuaDung[]  đơn vị có trong danh mục nhưng chưa bản ghi nào dùng
       errors[]    bảng không đọc được (chưa tạo / thiếu quyền / chưa nạp module)
     Chỉ ĐỌC, không ghi gì.
     ───────────────────────────────────────────── */
  function audit() {
    var errors = [];
    var jobs = RENAME_TARGETS.map(function (t) {
      return _readAll(t).then(function (rows) {
        var vals = {};
        (rows || []).forEach(function (r) {
          _valuesOf(t, r).forEach(function (v) { vals[v] = (vals[v] || 0) + 1; });
        });
        return { target: t, values: vals };
      }).catch(function (e) {
        errors.push({ target: t, message: (e && e.message) || String(e) });
        return null;
      });
    });

    return Promise.all(jobs).then(function (res) {
      var map = {};
      res.forEach(function (x) {
        if (!x) return;
        Object.keys(x.values).forEach(function (v) {
          var k = norm(v);
          if (!map[k]) map[k] = { value: v, total: 0, targets: {}, variants: {}, keyed: false };
          map[k].total += x.values[v];
          /* Giữ lại TỪNG cách viết thô. Hai bản ghi "Cảng biển" và "Cảng  Biển"
             gộp chung một dòng ở đây, nhưng canEditUnit() trong trang Cấp phát
             BHLĐ so chuỗi tuyệt đối → lệch một ký tự là mất quyền im lặng.
             Vì vậy phải chỉ ra cho Admin thấy. */
          map[k].variants[v] = (map[k].variants[v] || 0) + x.values[v];
          map[k].targets[x.target.label] = (map[k].targets[x.target.label] || 0) + x.values[v];
          if (x.target.keyed) map[k].keyed = true;   // tên nằm trong khoá chính ở đâu đó
        });
      });

      var rows = Object.keys(map).map(function (k) {
        var it = map[k];
        var u = resolve(it.value);
        it.unit = u || null;
        if (!u) it.status = "la";
        else if (norm(u.ten) !== norm(it.value)) it.status = "ten_cu";
        else if (!u.active) it.status = "ngung";
        else it.status = "ok";
        /* Cách viết trong dữ liệu lệch so với tên chuẩn trong danh mục
           (thừa khoảng trắng, khác hoa/thường, gạch ngang dài...) */
        var chuan = u ? u.ten : it.value;
        it.lech = Object.keys(it.variants).filter(function (v) { return v !== chuan; });
        return it;
      }).sort(function (a, b) {
        var rank = { la: 0, ten_cu: 1, ngung: 2, ok: 3 };
        var d = rank[a.status] - rank[b.status];
        return d !== 0 ? d : b.total - a.total;
      });

      var chuaDung = all({ includeInactive: true }).filter(function (u) {
        return !rows.some(function (r) { return r.unit && r.unit.ma === u.ma; });
      });

      return { rows: rows, chuaDung: chuaDung, errors: errors };
    });
  }

  /* ─────────────── XUẤT API ─────────────── */
  global.HSE_UNITS = {
    PAGES: PAGES,
    NHOM_LABEL: NHOM_LABEL,
    RENAME_TARGETS: RENAME_TARGETS,
    // đọc
    all: all,
    list: list,
    pages: pages,
    resolve: resolve,
    label: label,
    byMa: byMa,
    maOf: maOf,
    allowOther: allowOther,
    optionsHtml: optionsHtml,
    nhomLabel: nhomLabel,
    norm: norm,
    config: config,
    isLoaded: isLoaded,
    // đồng bộ
    ready: ready,
    refresh: refresh,
    onChange: onChange,
    // ghi (Quản trị)
    saveUnit: saveUnit,
    removeUnit: removeUnit,
    saveConfig: saveConfig,
    suggestMa: suggestMa,
    renameScan: renameScan,
    renameApply: renameApply,
    audit: audit
  };

  /* Tự tải nền khi trang mở (không chặn giao diện) */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { ready(); }, { once: true });
  } else {
    ready();
  }
})(window);
