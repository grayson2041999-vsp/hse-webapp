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
  var PK = { hl_settings: "loai" };
  function pkOf(t) { return PK[t] || "id"; }

  /* ─── Ánh xạ "sheet" cũ → bảng Postgres ─── */
  //  users được quản lý qua Supabase Auth + bảng profiles.
  function tbl(sheet) { return sheet === "users" ? "profiles" : sheet; }

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
      var q = sb.from(tbl(sheet)).select("*");
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
      return sb.from(tbl(sheet)).select("*").eq(pkOf(sheet), id).maybeSingle();
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
    var obj = Object.assign({}, data);
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
    var patch = Object.assign({}, data);
    delete patch[pkOf(sheet)]; // không update khoá chính
    return _ready().then(function (sb) {
      return sb.from(tbl(sheet)).update(patch).eq(pkOf(sheet), id).select().maybeSingle();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
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
      return sb.from(tbl(sheet)).delete().eq(pkOf(sheet), id);
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
      var o = Object.assign({}, r);
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
      // Xoá các dòng server không còn trong danh sách mới
      var delQ = sbRef.from(tbl(sheet)).delete();
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
      return sb.from("sop").select("id", { count: "exact", head: true });
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true, count: res.count };
    });
  }

  function getCached(sheet) { return _cache[sheet] || null; }
  function clearCache(sheet) { if (sheet) delete _cache[sheet]; else _cache = {}; }

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
    DEFAULT_URL: DEFAULT_URL
  };
})();
