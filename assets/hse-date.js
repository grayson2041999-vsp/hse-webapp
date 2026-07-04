/* =====================================================================
   assets/hse-date.js  —  Chuẩn hoá ngày tháng cho toàn hệ thống HSE
   ---------------------------------------------------------------------
   • Lưu trữ chuẩn: ISO  "YYYY-MM-DD"  (không nhập nhằng, sắp xếp đúng)
   • Hiển thị cho người dùng: "DD/MM/YYYY"
   • parse() đọc được MỌI định dạng cũ: ISO, YYYY-MM-DD, DD-MM-YYYY,
     DD/MM/YYYY, và chuỗi ISO có giờ ("2026-12-31T00:00:00.000Z")
   • attach()/attachAll(): gắn flatpickr (altInput) → mọi máy hiển thị
     giống nhau, không phụ thuộc locale của hệ điều hành.
   ===================================================================== */
(function (global) {
  "use strict";

  function pad(n) { return String(n).padStart(2, "0"); }

  /* Đọc mọi định dạng → đối tượng Date (00:00 giờ địa phương) hoặc null */
  function parse(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    s = String(s).trim();
    if (!s) return null;

    /* Chuỗi ISO có giờ: "2026-12-31T17:00:00.000Z" */
    if (s.indexOf("T") > 0) {
      var d0 = new Date(s);
      if (!isNaN(d0.getTime()))
        return new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
      s = s.split("T")[0];
    }

    var p;
    if (s.indexOf("-") >= 0) p = s.split("-");
    else if (s.indexOf("/") >= 0) p = s.split("/");
    else return null;
    if (p.length !== 3) return null;

    var a = parseInt(p[0], 10), b = parseInt(p[1], 10), c = parseInt(p[2], 10);
    if (isNaN(a) || isNaN(b) || isNaN(c)) return null;

    var y, m, d;
    if (String(p[0]).length === 4) { y = a; m = b; d = c; }  /* YYYY-MM-DD */
    else { d = a; m = b; y = c; }                            /* DD-MM-YYYY / DD/MM/YYYY */

    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  /* Bất kỳ → "YYYY-MM-DD" (định dạng LƯU TRỮ chuẩn) */
  function toISO(s) {
    var d = parse(s);
    if (!d) return (s == null ? "" : String(s));
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  /* Bất kỳ → "DD/MM/YYYY" (định dạng HIỂN THỊ) */
  function fmt(s) {
    var d = parse(s);
    if (!d) return (s == null ? "" : String(s));
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  /* Gắn flatpickr cho 1 <input type="date">; lưu ISO, hiển thị DD/MM/YYYY */
  function attach(el) {
    if (!el) return null;
    if (el._flatpickr) return el._flatpickr;
    if (typeof global.flatpickr !== "function") return null;

    var cur = toISO(el.value); /* chuẩn hoá giá trị có sẵn về ISO */
    var hasVn = !!(global.flatpickr.l10ns && global.flatpickr.l10ns.vn);
    var inst = global.flatpickr(el, {
      dateFormat: "Y-m-d",   /* giá trị thật lưu xuống: 2026-12-31 */
      altInput: true,
      altFormat: "d/m/Y",    /* người dùng thấy: 31/12/2026 (mọi máy như nhau) */
      allowInput: true,
      locale: hasVn ? "vn" : "default"
    });
    if (cur) inst.setDate(cur, false, "Y-m-d");
    return inst;
  }

  /* Gắn cho mọi input[type=date] chưa được gắn, bên trong root (mặc định: document) */
  function attachAll(root) {
    root = root || document;
    var list = root.querySelectorAll('input[type="date"]:not(.flatpickr-input)');
    for (var i = 0; i < list.length; i++) attach(list[i]);
  }

  /* Đặt giá trị an toàn dù input đã gắn flatpickr hay chưa (nhận mọi định dạng) */
  function setValue(el, v) {
    if (!el) return;
    var iso = toISO(v);
    if (el._flatpickr) el._flatpickr.setDate(iso || null, false, "Y-m-d");
    else el.value = iso;
  }

  /* Luôn đọc ra ISO "YYYY-MM-DD" */
  function getValue(el) {
    if (!el) return "";
    return toISO(el.value);
  }

  /* Đặt giá trị = hôm nay (ISO) */
  function setToday(el) {
    var t = new Date();
    setValue(el, t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()));
  }

  global.HSEDate = {
    parse: parse, toISO: toISO, fmt: fmt,
    attach: attach, attachAll: attachAll,
    setValue: setValue, getValue: getValue, setToday: setToday
  };

  /* Tự động gắn flatpickr cho MỌI <input type="date"> — kể cả ô được tạo
     động trong modal/form sau này — không cần khai báo thủ công ở từng trang. */
  function _autoInit() {
    attachAll(document);
    if (typeof MutationObserver !== "function") return;
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.matches && n.matches('input[type="date"]:not(.flatpickr-input)')) attach(n);
          if (n.querySelectorAll) attachAll(n);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _autoInit);
  } else {
    _autoInit();
  }
})(window);
