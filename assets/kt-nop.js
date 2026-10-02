/* =========================================================
 *  KT-NOP.JS — Theo dõi việc nộp số liệu Kiểm tra cấp 1 / cấp 2
 *  Webapp Quản lý HSE · Vietsovpetro
 *
 *  Chỉ chứa hàm TÍNH TOÁN thuần (không đụng DOM, không gọi server),
 *  dùng chung cho:
 *    • kiem-tra-cac-cap.html — bảng theo dõi + thông báo quá hạn
 *    • assets/app.js         — ô cảnh báo ở trang Tổng quan
 *  Test: node tests/kt-nop.test.js
 *
 *  QUY TẮC (đã thống nhất 02/10/2026):
 *    • Mỗi đơn vị, mỗi tháng phải có 1 bản ghi cấp 1 và 1 bản ghi cấp 2
 *      (nhập "0 lần" vẫn tính là đã nộp).
 *    • Hạn nộp số liệu tháng M là ngày HAN_NGAY của tháng M+1 (hiện = ngày 1).
 *      Qua hết ngày đó mà chưa có bản ghi → QUÁ HẠN.
 *    • Chỉ theo dõi từ tháng TU_THANG (tháng đầu tiên có dữ liệu trên hệ thống).
 *    • Đơn vị được theo dõi = danh mục đơn vị đang gán cho trang
 *      "kiem-tra-cac-cap" (Quản trị → Danh mục đơn vị).
 * ========================================================= */
(function (g) {
  "use strict";

  var CAU_HINH = {
    tuThang: "2026-04",       // mốc bắt đầu theo dõi (YYYY-MM)
    hanNgay: 1,               // hạn nộp: ngày thứ mấy của tháng sau
    caps: ["cap1", "cap2"]
  };

  var NHAN_CAP = { cap1: "cấp 1", cap2: "cấp 2" };

  function _cfg(c) {
    c = c || {};
    return {
      tuThang: c.tuThang || CAU_HINH.tuThang,
      hanNgay: c.hanNgay || CAU_HINH.hanNgay,
      caps: c.caps || CAU_HINH.caps
    };
  }
  function _pad(n) { return (n < 10 ? "0" : "") + n; }
  function _normMacDinh(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  /** Date → "YYYY-MM" (theo giờ máy người dùng) */
  function ymCua(d) { return d.getFullYear() + "-" + _pad(d.getMonth() + 1); }

  /** "YYYY-MM" ± n tháng */
  function ymCong(ym, n) {
    var p = String(ym).split("-"), y = +p[0], m = +p[1] - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + _pad(m + 1);
  }

  /** "2026-09" → "T9/2026" */
  function nhanThang(ym) {
    var p = String(ym).split("-");
    return "T" + (+p[1]) + "/" + p[0];
  }

  /** Thời điểm HẾT HẠN nộp số liệu tháng ym: 00:00 ngày (hanNgay+1) của tháng sau.
      Nộp trước mốc này là đúng hạn. */
  function mocHetHan(ym, cfg) {
    cfg = _cfg(cfg);
    var p = String(ym).split("-");
    return new Date(+p[0], +p[1], cfg.hanNgay + 1);   // tháng +p[1] (0-based) = tháng sau
  }

  /** Bảng tra nhanh bản ghi: khoá = norm(đơn vị)|YYYY-MM|cap.
      Trùng khoá thì giữ bản ghi nộp SỚM nhất. */
  function lapChiMuc(records, norm) {
    norm = norm || _normMacDinh;
    var idx = {};
    (records || []).forEach(function (r) {
      if (!r || !r.thang || !r.type) return;
      var k = norm(r.donVi) + "|" + r.thang + "|" + r.type;
      var cu = idx[k];
      if (!cu || String(r.createdAt || "") < String(cu.createdAt || "")) idx[k] = r;
    });
    return idx;
  }

  /**
   * Trạng thái một ô (đơn vị × tháng × cấp):
   *   'danop'     đã nhập, đúng hạn
   *   'noptre'    đã nhập, nhưng sau hạn
   *   'quahan'    chưa nhập, đã quá hạn
   *   'denhan'    chưa nhập, hôm nay là ngày hạn chót
   *   'trongky'   tháng hiện tại, chưa nhập (chưa đến hạn)
   *   'chuadenky' tháng tương lai
   *   'ngoai'     trước mốc bắt đầu theo dõi, không có dữ liệu
   */
  function trangThaiO(ym, rec, homNay, cfg) {
    cfg = _cfg(cfg);
    var het = mocHetHan(ym, cfg);
    if (rec) {
      var t = rec.createdAt ? new Date(rec.createdAt) : null;
      return (t && !isNaN(t) && t >= het) ? "noptre" : "danop";
    }
    if (ym < cfg.tuThang) return "ngoai";
    var cur = ymCua(homNay);
    if (ym > cur) return "chuadenky";
    if (ym === cur) return "trongky";
    return homNay >= het ? "quahan" : "denhan";
  }

  /**
   * Danh sách các ô CHƯA NỘP đã đến/quá hạn, từ mốc theo dõi đến tháng trước.
   * → [{donVi, thang, cap, trangThai:'quahan'|'denhan'}]
   */
  function danhSachThieu(records, donViList, homNay, cfg, norm) {
    cfg = _cfg(cfg); norm = norm || _normMacDinh;
    var idx = lapChiMuc(records, norm);
    var out = [];
    var cuoi = ymCong(ymCua(homNay), -1);
    (donViList || []).forEach(function (dv) {
      for (var ym = cfg.tuThang; ym <= cuoi; ym = ymCong(ym, 1)) {
        cfg.caps.forEach(function (cap) {
          if (idx[norm(dv) + "|" + ym + "|" + cap]) return;
          var tt = trangThaiO(ym, null, homNay, cfg);
          if (tt === "quahan" || tt === "denhan") out.push({ donVi: dv, thang: ym, cap: cap, trangThai: tt });
        });
      }
    });
    return out;
  }

  /** Gom danh sách thiếu theo đơn vị → theo tháng.
      → [{donVi, thang:[{ym, caps:['cap1','cap2'], trangThai}]}] (giữ thứ tự đơn vị) */
  function nhomTheoDonVi(list) {
    var thuTu = [], map = {};
    (list || []).forEach(function (x) {
      if (!map[x.donVi]) { map[x.donVi] = { donVi: x.donVi, thang: [], _t: {} }; thuTu.push(x.donVi); }
      var d = map[x.donVi];
      if (!d._t[x.thang]) { d._t[x.thang] = { ym: x.thang, caps: [], trangThai: x.trangThai }; d.thang.push(d._t[x.thang]); }
      d._t[x.thang].caps.push(x.cap);
    });
    return thuTu.map(function (k) { var d = map[k]; delete d._t; return d; });
  }

  /** "T7/2026" nếu thiếu cả hai cấp, "T5/2026 (cấp 2)" nếu thiếu một */
  function moTaThang(t, soCap) {
    soCap = soCap || CAU_HINH.caps.length;
    var s = nhanThang(t.ym);
    if (t.caps.length < soCap) s += " (" + t.caps.map(function (c) { return NHAN_CAP[c] || c; }).join(", ") + ")";
    return s;
  }

  g.HSE_KT_NOP = {
    CAU_HINH: CAU_HINH,
    NHAN_CAP: NHAN_CAP,
    ymCua: ymCua,
    ymCong: ymCong,
    nhanThang: nhanThang,
    mocHetHan: mocHetHan,
    lapChiMuc: lapChiMuc,
    trangThaiO: trangThaiO,
    danhSachThieu: danhSachThieu,
    nhomTheoDonVi: nhomTheoDonVi,
    moTaThang: moTaThang
  };
})(typeof window !== "undefined" ? window : this);
