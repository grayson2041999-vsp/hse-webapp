/**
 * =========================================================
 *  DB.JS — Client-side database module cho HSE Webapp
 *  PHIÊN BẢN SUPABASE (thay Google Apps Script / Sheets)
 *
 *  ⚠️  GIỮ NGUYÊN "hợp đồng" interface như bản Sheets cũ:
 *      init, isReady, setUser, genId,
 *      getAll, getById, insert, update, delete, bulkWrite,
 *      cachedLoad, cachedSave, syncUsersFromSheets,
 *      startAutoSync, stopAutoSync, testConnection, getCached, clearCache
 *  → Các trang nghiệp vụ KHÔNG phải sửa.
 *
 *  Yêu cầu: nạp assets/supabase-config.js (type=module) TRƯỚC file này.
 * =========================================================
 */
var DB = (function () {
  "use strict";

  var DEFAULT_URL = ""; // (giữ để tương thích code cũ — không còn dùng)
  var _currentUser = "";
  var _cache = {};
  var _autoSyncTimer = null;

  /* ─── Bảng không dùng cột "id" làm khoá chính ─── */
  var PK = { hl_settings: "loai", app_settings: "key", svodka_matkhau: "tacvu_id", don_vi: "ma" };
  function pkOf(t) { return PK[t] || "id"; }

  /* =========================================================
     ÁNH XẠ "sheet" (tên logic dùng trong code) → bảng thật trên Postgres
     ---------------------------------------------------------
     Hai cách khai báo:
       'sheet': 'ten_bang'                       → chỉ đổi tên bảng
       'sheet': { table: 'TenBang',
                  filter: { cot: 'giá trị' } }   → nhiều sheet chung 1 bảng

     'filter' làm hai việc, luôn đi cùng nhau:
       • ĐỌC — tự thêm điều kiện lọc vào mọi truy vấn select
       • GHI — tự gắn thêm cột đó vào dữ liệu insert / update / bulkWrite
     Nhờ vậy các trang nghiệp vụ (ke-hoach.html, app.js) và
     hse-activity.js KHÔNG phải sửa một dòng nào.

     ⚠️  Tên bảng có chữ hoa phải viết ĐÚNG CHỮ ở đây ("KeHoach"),
         vì PostgREST so khớp phân biệt hoa thường.
     ========================================================= */
  var TABLE_MAP = {
    // users được quản lý qua Supabase Auth + bảng profiles.
    users:            "profiles",
    // Hai loại kế hoạch dùng chung bảng "KeHoach", phân biệt bằng cột loai.
    ke_hoach_mot_lan: { table: "KeHoach", filter: { loai: "mot_lan" } },
    ke_hoach_lap_lai: { table: "KeHoach", filter: { loai: "lap_lai" } },
    // Trang Tai nạn - Sự cố: chỉ đổi tên, vẫn là 2 bảng riêng biệt.
    // Tên có dấu gạch ngang -> trong SQL luôn phải đặt nháy kép.
    tnsc_gio_cong:    "TaiNan-SuCo_GioCong",
    tnsc_su_kien:     "TaiNan-SuCo_SuKien",
    // Trang SOP: đổi tên thành chữ hoa. Với Postgres "SOP" khác sop.
    sop:              "SOP",
    // Năm trang nhỏ, mỗi trang chỉ đổi tên bảng, không gộp gì.
    ksk:              "KhamSucKhoe",
    moi_truong:       "XuLyChatThai",
    nha_thau:         "NhaThau",
    binh_ap_luc:      "ThietBi_BinhApLuc",
    kiem_tra_cap12:   "KiemTraCacCap_12",
    kiem_tra_cap34:   "KiemTraCacCap_34",
    // Svodka — svodka_matkhau có khoá chính riêng "tacvu_id" (xem PK ở trên).
    svodka_tacvu:       "Svodka_TacVu",
    svodka_buoc:        "Svodka_Buoc",
    svodka_matkhau:     "Svodka_MatKhau",
    // Huấn luyện - Đào tạo. Tên có gạch ngang -> trong SQL luôn phải có nháy kép.
    // hl_settings có khoá chính riêng "loai" (xem PK ở trên), khoá đó tra theo
    // TÊN LOGIC nên đổi tên bảng không ảnh hưởng gì.
    hl_nhansu:          "HuanLuyen-DaoTao_NhanSu",
    hl_settings:        "HuanLuyen-DaoTao_CaiDat",
    // Báo cáo hệ thống báo cháy tự động.
    pccc_devices:       "HTBCTD_ThietBi",
    pccc_errors:        "HTBCTD_Loi",
    pccc_locked_months: "HTBCTD_ThangDaKhoa",
    // Kho key-value, hiện chỉ phục vụ tab Tra cứu ATVSLĐ.
    // Khoá chính là cột "key" (xem PK ở trên) — tra theo tên logic nên không đổi.
    app_settings:       "TraCuuATVSLD",
    // Danh mục Phòng/Ban/Đơn vị dùng chung — khoá chính là "ma" (xem PK ở trên).
    // Nguồn: supabase/don_vi.sql · truy cập qua assets/don-vi.js (HSE_UNITS).
    don_vi:             "DonVi"
    // ⚠️ 15 bảng của trang Cấp phát BHLĐ (nhanvien, danh_muc, phieu_requests...)
    //    KHÔNG nằm ở đây. Trang đó không dùng db.js — nó có bảng ánh xạ riêng
    //    trong assets/bhld-sync.js. Đừng sao chép qua lại, sẽ lệch nhau.
  };

  function _map(sheet) {
    var m = TABLE_MAP[sheet];
    if (!m) return { table: sheet, filter: null };
    return (typeof m === "string") ? { table: m, filter: null } : m;
  }
  function tbl(sheet) { return _map(sheet).table; }
  function filterOf(sheet) { return _map(sheet).filter || null; }

  /** Giới hạn query trong đúng nhóm của sheet (select / update / delete) */
  function _scope(q, sheet) {
    var f = filterOf(sheet);
    return f ? q.match(f) : q;
  }
  /** Gắn cột phân loại vào dữ liệu trước khi ghi lên server */
  function _stamp(obj, sheet) {
    var f = filterOf(sheet);
    if (!f || !obj || typeof obj !== "object") return obj;
    var o = Object.assign({}, obj);
    for (var k in f) o[k] = f[k];
    return o;
  }

  /* ─── Lấy supabase client (đợi supabase-config.js sẵn sàng) ─── */
  function _ready() {
    if (window.HSE_SB) return Promise.resolve(window.HSE_SB);
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () { reject(new Error("Supabase client chưa sẵn sàng (thiếu supabase-config.js?)")); }, 12000);
      window.addEventListener("hse-sb-ready", function () { clearTimeout(to); resolve(window.HSE_SB); }, { once: true });
    });
  }

  /* ─── init / trạng thái ─── */
  function init(url) { return url || DEFAULT_URL; } // no-op, giữ chữ ký cũ
  function isReady() { return !!window.HSE_SB; }
  function setUser(username) { _currentUser = username || ""; }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ─── OUTBOX: hàng đợi ghi chưa lên được server (giữ như bản cũ) ─── */
  function _outboxKey(sheet) { return "hse_db_outbox_" + sheet; }
  function _getOutbox(sheet) { try { return JSON.parse(localStorage.getItem(_outboxKey(sheet))) || []; } catch (e) { return []; } }
  function _setOutbox(sheet, arr) {
    if (arr && arr.length) localStorage.setItem(_outboxKey(sheet), JSON.stringify(arr));
    else localStorage.removeItem(_outboxKey(sheet));
  }
  function _outboxRemove(sheet, id) {
    _setOutbox(sheet, _getOutbox(sheet).filter(function (o) { return String(o.id) !== String(id); }));
  }
  function _outboxPush(sheet, entry) {
    var a = _getOutbox(sheet).filter(function (o) { return String(o.id) !== String(entry.id); });
    a.push(entry);
    _setOutbox(sheet, a);
  }

  /* =========================================================
     PUBLIC API — đọc
     ========================================================= */
  function getAll(sheet, where) {
    return _ready().then(function (sb) {
      var q = _scope(sb.from(tbl(sheet)).select("*"), sheet);
      if (where && typeof where === "object") q = q.match(where);
      return q;
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      _cache[sheet] = res.data || [];
      return res.data || [];
    });
  }

  function getById(sheet, id) {
    return _ready().then(function (sb) {
      return _scope(sb.from(tbl(sheet)).select("*"), sheet).eq(pkOf(sheet), id).maybeSingle();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (!res.data) throw new Error("Không tìm thấy record id=" + id);
      return res.data;
    });
  }

  /* =========================================================
     PUBLIC API — ghi
     ========================================================= */
  function insert(sheet, data) {
    var obj = _stamp(Object.assign({}, data), sheet);
    if (pkOf(sheet) === "id" && !obj.id) obj.id = genId();
    var id = obj[pkOf(sheet)];
    return _ready().then(function (sb) {
      // upsert để idempotent (bấm Lưu 2 lần / retry không tạo trùng)
      return sb.from(tbl(sheet)).upsert(obj, { onConflict: pkOf(sheet) }).select().maybeSingle();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (_cache[sheet]) _cache[sheet].push(res.data);
      _outboxRemove(sheet, id);
      return res.data;
    }).catch(function (e) {
      _outboxPush(sheet, { op: "insert", id: String(id), data: obj, ts: Date.now() });
      throw e;
    });
  }

  function update(sheet, id, data) {
    var patch = _stamp(Object.assign({}, data), sheet);
    delete patch[pkOf(sheet)]; // không update khoá chính
    return _ready().then(function (sb) {
      return _scope(sb.from(tbl(sheet)).update(patch).eq(pkOf(sheet), id), sheet).select().maybeSingle();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // Bản ghi chưa tồn tại trên server (vd: tạo lúc offline) -> chèn mới thay vì bỏ qua
      if (!res.data) {
        var full = Object.assign({}, patch);
        full[pkOf(sheet)] = id;
        return insert(sheet, full);
      }
      if (_cache[sheet]) {
        var idx = _cache[sheet].findIndex(function (r) { return String(r[pkOf(sheet)]) === String(id); });
        if (idx >= 0) _cache[sheet][idx] = res.data;
      }
      _outboxRemove(sheet, id);
      return res.data;
    }).catch(function (e) {
      _outboxPush(sheet, { op: "update", id: String(id), data: patch, ts: Date.now() });
      throw e;
    });
  }

  function del(sheet, id) {
    return _ready().then(function (sb) {
      return _scope(sb.from(tbl(sheet)).delete().eq(pkOf(sheet), id), sheet);
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (_cache[sheet]) _cache[sheet] = _cache[sheet].filter(function (r) { return String(r[pkOf(sheet)]) !== String(id); });
      _outboxRemove(sheet, id);
      return true;
    }).catch(function (e) {
      _outboxPush(sheet, { op: "delete", id: String(id), ts: Date.now() });
      throw e;
    });
  }

  /** Ghi đè TOÀN BỘ bảng: upsert các dòng mới + xoá dòng không còn (giữ ngữ nghĩa bulkWrite cũ) */
  function bulkWrite(sheet, rows) {
    rows = (rows || []).map(function (r) {
      var o = _stamp(Object.assign({}, r), sheet);
      if (pkOf(sheet) === "id" && !o.id) o.id = genId();
      return o;
    });
    // An toàn: KHÔNG xoá sạch bảng khi danh sách rỗng (tránh mất dữ liệu ngoài ý muốn).
    if (!rows.length) { _cache[sheet] = []; return Promise.resolve(0); }
    var pk = pkOf(sheet);
    var keepIds = rows.map(function (r) { return String(r[pk]); });
    var sbRef;
    return _ready().then(function (sb) {
      sbRef = sb;
      if (!rows.length) return { data: [], error: null };
      return sb.from(tbl(sheet)).upsert(rows, { onConflict: pk }).select();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // Xoá các dòng server không còn trong danh sách mới.
      // ⚠️ _scope() giới hạn việc xoá trong ĐÚNG nhóm của sheet này.
      //    Thiếu nó, lưu "ke_hoach_mot_lan" sẽ xoá sạch "ke_hoach_lap_lai"
      //    vì hai sheet dùng chung bảng "KeHoach".
      var delQ = _scope(sbRef.from(tbl(sheet)).delete(), sheet);
      if (keepIds.length) delQ = delQ.not(pk, "in", "(" + keepIds.map(function (x) { return JSON.stringify(x); }).join(",") + ")");
      return delQ.then(function () { return res; });
    }).then(function () {
      _cache[sheet] = rows;
      return rows.length;
    });
  }

  /* =========================================================
     CACHE-FIRST PATTERN (giữ nguyên như bản cũ)
     ========================================================= */
  function cachedLoad(lsKey, sheet, fallback, callback) {
    var cached;
    try { cached = JSON.parse(localStorage.getItem(lsKey)); } catch (e) {}
    if (cached === null || cached === undefined) cached = fallback;
    getAll(sheet).then(function (rows) {
      if (rows) {
        localStorage.setItem(lsKey, JSON.stringify(rows));
        if (callback) callback(rows);
      }
    }).catch(function () {});
    return cached;
  }

  function cachedSave(lsKey, sheet, data) {
    localStorage.setItem(lsKey, JSON.stringify(data));
    bulkWrite(sheet, data).catch(function () {});
  }

  /* =========================================================
     USERS / PROFILES — đồng bộ về localStorage cho UI đọc đồng bộ
     ========================================================= */
  function syncUsersFromSheets(lsKey) {
    lsKey = lsKey || "hse_users";
    return getAll("users").then(function (rows) {
      if (rows) localStorage.setItem(lsKey, JSON.stringify(rows));
      return rows;
    }).catch(function (e) {
      console.warn("[DB] syncUsers (profiles) failed:", e.message);
      return null;
    });
  }

  function startAutoSync(lsKey, intervalMinutes) {
    if (_autoSyncTimer) clearInterval(_autoSyncTimer);
    intervalMinutes = intervalMinutes || 5;
    _autoSyncTimer = setInterval(function () {
      syncUsersFromSheets(lsKey).catch(function () {});
    }, intervalMinutes * 60 * 1000);
  }
  function stopAutoSync() { if (_autoSyncTimer) { clearInterval(_autoSyncTimer); _autoSyncTimer = null; } }

  /* ─── Kiểm tra kết nối ─── */
  function testConnection() {
    return _ready().then(function (sb) {
      return sb.from(tbl("sop")).select("id", { count: "exact", head: true });
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true, count: res.count };
    });
  }

  function getCached(sheet) { return _cache[sheet] || null; }
  function clearCache(sheet) { if (sheet) delete _cache[sheet]; else _cache = {}; }

  /* ─── Gửi lại các thao tác còn tồn trong outbox (offline / lỗi tạm) ─── */
  function _outboxSheets() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("hse_db_outbox_") === 0) out.push(k.slice("hse_db_outbox_".length));
    }
    return out;
  }
  function flushOutbox(sheet) {
    var sheets = sheet ? [sheet] : _outboxSheets();
    var chain = Promise.resolve();
    var replayed = 0;
    sheets.forEach(function (s) {
      _getOutbox(s).forEach(function (e) {
        chain = chain.then(function () {
          var op;
          if (e.op === "delete") op = del(s, e.id);
          else if (e.op === "update") op = update(s, e.id, e.data);
          else op = insert(s, e.data);
          // Thành công thì các hàm trên tự xoá khỏi outbox; thất bại thì tự đẩy lại
          return op.then(function () { replayed++; }).catch(function () {});
        });
      });
    });
    return chain.then(function () { return replayed; });
  }

  return {
    init: init,
    isReady: isReady,
    setUser: setUser,
    genId: genId,
    getAll: getAll,
    getById: getById,
    insert: insert,
    update: update,
    delete: del,
    bulkWrite: bulkWrite,
    cachedLoad: cachedLoad,
    cachedSave: cachedSave,
    syncUsersFromSheets: syncUsersFromSheets,
    startAutoSync: startAutoSync,
    stopAutoSync: stopAutoSync,
    testConnection: testConnection,
    getCached: getCached,
    clearCache: clearCache,
    flushOutbox: flushOutbox,
    DEFAULT_URL: DEFAULT_URL
  };
})();
