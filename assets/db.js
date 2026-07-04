/**
 * =========================================================
 *  DB.JS — Client-side database module cho HSE Webapp
 *  Kết nối Google Sheets qua Apps Script Web App
 * =========================================================
 *
 *  Cách dùng:
 *    DB.init("https://script.google.com/macros/s/.../exec");
 *
 *    // Lấy tất cả (async/await hoặc .then)
 *    var users = await DB.getAll("users");
 *
 *    // Lấy 1 record
 *    var u = await DB.getById("users", "id123");
 *
 *    // Thêm mới
 *    await DB.insert("nha_thau", { ten_nha_thau: "...", khu_vuc: "Cảng biển" });
 *
 *    // Cập nhật
 *    await DB.update("nha_thau", "id123", { trang_thai: "Đã duyệt" });
 *
 *    // Xóa
 *    await DB.delete("nha_thau", "id123");
 *
 *    // Ghi đè toàn bộ sheet (sync from localStorage)
 *    await DB.bulkWrite("users", arrayOfObjects);
 *
 *    // Cache-first: đọc từ localStorage, sync Sheets ngầm
 *    DB.cachedLoad("hse_users", "users", fallback);
 *    DB.cachedSave("hse_users", "users", data);
 * =========================================================
 */

var DB = (function() {
  "use strict";

  // ═══════════════════════════════════════════════════
  //  ⚙️  CẤU HÌNH — Dán URL Apps Script Web App vào đây
  //  Sau khi đặt URL này, mọi người dùng đều tự kết nối
  //  mà không cần nhập thủ công trong Quản trị hệ thống
  // ═══════════════════════════════════════════════════
  var DEFAULT_URL = "https://script.google.com/macros/s/AKfycbxwXyR3XJGaVd79Sq2csVzuXDFOCF78P00v3oam0oFILxuXLEpbeGynfjMCQZJRpkotnQ/exec";

  var _url = "";
  var _currentUser = "";
  var _cache = {};
  var _syncing = false;
  var _autoSyncTimer = null;

  /* ─── Lưu URL API vào localStorage ─── */
  function init(url) {
    if (url) {
      _url = url.trim();
      localStorage.setItem("hse_db_url", _url);
    } else {
      // Ưu tiên: localStorage → DEFAULT_URL trong code
      _url = localStorage.getItem("hse_db_url") || DEFAULT_URL;
      // Lưu lại DEFAULT_URL vào localStorage nếu chưa có
      if (!localStorage.getItem("hse_db_url") && DEFAULT_URL) {
        localStorage.setItem("hse_db_url", DEFAULT_URL);
      }
    }
    return _url;
  }

  /* ─── Kiểm tra đã cấu hình URL chưa ─── */
  function isReady() { return !!_url; }

  /* ─── Auto-sync định kỳ (mặc định mỗi 5 phút) ─── */
  function startAutoSync(lsKey, intervalMinutes) {
    if (_autoSyncTimer) clearInterval(_autoSyncTimer);
    intervalMinutes = intervalMinutes || 5;
    _autoSyncTimer = setInterval(function() {
      if (!_url) return;
      // Pull từ Sheets → cập nhật localStorage nếu có thay đổi
      getAll("users").then(function(rows) {
        if (rows && rows.length > 0) {
          var current = JSON.stringify(JSON.parse(localStorage.getItem(lsKey) || "[]"));
          var incoming = JSON.stringify(rows);
          if (current !== incoming) {
            localStorage.setItem(lsKey, incoming);
            console.log("[DB Auto-sync] Cập nhật " + rows.length + " users từ Sheets");
          }
        }
      }).catch(function(e) {
        console.warn("[DB Auto-sync] Pull users thất bại:", e && e.message || e);
      });
    }, intervalMinutes * 60 * 1000);
  }

  function stopAutoSync() {
    if (_autoSyncTimer) { clearInterval(_autoSyncTimer); _autoSyncTimer = null; }
  }

  /* ─── Đặt user hiện tại (dùng cho audit log) ─── */
  function setUser(username) { _currentUser = username || ""; }

  /* ─── Helper: fetch với timeout ─── */
  function _fetch(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    return new Promise(function(resolve, reject) {
      var timer = setTimeout(function() {
        reject(new Error("Request timeout"));
      }, timeoutMs);
      fetch(url, options)
        .then(function(r) { clearTimeout(timer); return r.json(); })
        .then(resolve)
        .catch(function(e) { clearTimeout(timer); reject(e); });
    });
  }

  /* ─── Gọi API (GET) ─── */
  function _get(params) {
    if (!_url) return Promise.reject(new Error("Chưa cấu hình DB URL. Vào Quản trị → Cài đặt DB."));
    var qs = Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    return _fetch(_url + "?" + qs);
  }

  /* ─── Gọi API write (POST với Content-Type text/plain) ───
     Dùng POST thật thay vì nhồi dữ liệu vào URL, để bỏ giới hạn độ dài
     URL khi ghi nhiều bản ghi (vd: Sync toàn bộ users → "Failed to fetch").
     "text/plain" là simple request nên KHÔNG kích hoạt CORS preflight;
     server doPost đọc dữ liệu từ e.postData.contents.
     Chỉ tham số ngắn (action/sheet/id) nằm trên URL. */
  function _post(params, body) {
    if (!_url) return Promise.reject(new Error("Chưa cấu hình DB URL."));
    var bodyWithUser = Object.assign({}, body, { user: _currentUser });
    var qs = Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    return _fetch(_url + (qs ? "?" + qs : ""), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(bodyWithUser),
      redirect: "follow"
    });
  }

  /* ─── ID generator (client-side) ─── */
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  /** Lấy tất cả records. where: object filter { col: value } */
  function getAll(sheet, where) {
    var params = { action: "getAll", sheet: sheet };
    if (where) params.where = JSON.stringify(where);
    return _get(params).then(function(res) {
      if (!res.ok) throw new Error(res.error);
      _cache[sheet] = res.data;
      return res.data;
    });
  }

  /** Lấy 1 record theo id */
  function getById(sheet, id) {
    return _get({ action: "getById", sheet: sheet, id: id }).then(function(res) {
      if (!res.ok) throw new Error(res.error);
      return res.data;
    });
  }

  /** Thêm record mới */
  function insert(sheet, data) {
    var obj = Object.assign({ id: genId(), created_at: new Date().toISOString() }, data);
    return _post({ action: "insert", sheet: sheet }, { data: obj }).then(function(res) {
      if (!res.ok) throw new Error(res.error);
      // Cập nhật cache
      if (_cache[sheet]) _cache[sheet].push(res.data);
      return res.data;
    });
  }

  /** Cập nhật record theo id */
  function update(sheet, id, data) {
    return _post({ action: "update", sheet: sheet, id: id }, { data: data }).then(function(res) {
      if (!res.ok) throw new Error(res.error);
      // Cập nhật cache
      if (_cache[sheet]) {
        var idx = _cache[sheet].findIndex(function(r) { return String(r.id) === String(id); });
        if (idx >= 0) _cache[sheet][idx] = res.data;
      }
      return res.data;
    });
  }

  /** Xóa record theo id */
  function del(sheet, id) {
    return _post({ action: "delete", sheet: sheet, id: id }, {}).then(function(res) {
      if (!res.ok) throw new Error(res.error);
      // Cập nhật cache
      if (_cache[sheet]) {
        _cache[sheet] = _cache[sheet].filter(function(r) { return String(r.id) !== String(id); });
      }
      return true;
    });
  }

  /** Ghi đè toàn bộ sheet (dùng khi sync từ localStorage lên) */
  function bulkWrite(sheet, rows) {
    return _post({ action: "bulkWrite", sheet: sheet }, { data: rows }).then(function(res) {
      if (!res.ok) throw new Error(res.error);
      _cache[sheet] = rows;
      return res.count;
    });
  }

  /* =========================================================
     CACHE-FIRST PATTERN
     Dùng cho các module đang chuyển từ localStorage sang Sheets.
     Đọc từ cache/localStorage ngay, đồng bộ Sheets ngầm định.
     ========================================================= */

  /**
   * cachedLoad(lsKey, sheet, fallback)
   * 1. Trả về localStorage ngay (synchronous)
   * 2. Fetch Sheets ngầm → cập nhật localStorage
   * callback(data) được gọi sau khi Sheets trả về
   */
  function cachedLoad(lsKey, sheet, fallback, callback) {
    var cached;
    try { cached = JSON.parse(localStorage.getItem(lsKey)); } catch(e) {}
    if (cached === null || cached === undefined) cached = fallback;

    // Sync Sheets ngầm
    if (_url) {
      getAll(sheet).then(function(rows) {
        if (rows && rows.length) {
          localStorage.setItem(lsKey, JSON.stringify(rows));
          if (callback) callback(rows);
        }
      }).catch(function() {}); // Không throw nếu offline
    }

    return cached;
  }

  /**
   * cachedSave(lsKey, sheet, data)
   * 1. Lưu localStorage ngay
   * 2. Sync lên Sheets ngầm (bulkWrite)
   */
  function cachedSave(lsKey, sheet, data) {
    localStorage.setItem(lsKey, JSON.stringify(data));
    if (_url) {
      bulkWrite(sheet, data).catch(function() {}); // Không throw nếu offline
    }
  }

  /* =========================================================
     USERS — Quản lý người dùng qua Sheets
     (thay thế localStorage trong app.js)
     ========================================================= */

  /**
   * syncUsersFromSheets()
   * Gọi khi khởi động app: kéo users từ Sheets về localStorage
   * Nếu Sheets chưa có → đẩy localStorage lên Sheets
   */
  function syncUsersFromSheets(lsKey) {
    lsKey = lsKey || "hse_users";
    if (!_url) return Promise.resolve(null);
    return getAll("users").then(function(rows) {
      // 1) Danh sách từ Sheets (dedup theo id — khóa duy nhất, không dùng username)
      function keyOf(x){ return x && x.id != null ? String(x.id) : (x && x.username); }
      var seen = {}, sheetUsers = [];
      (rows || []).forEach(function(r){ var k=keyOf(r); if(k && !seen[k]){ seen[k]=true; sheetUsers.push(r); } });

      // 2) Danh sách cục bộ
      var local = [];
      try { local = JSON.parse(localStorage.getItem(lsKey)) || []; } catch(e) {}

      // 3) User CHỈ có ở máy (id chưa có trên Sheets) — không được để mất
      var localOnly = local.filter(function(u){ var k=keyOf(u); return k && !seen[k]; });

      // 4) Hợp nhất: Sheets là nguồn chính + bổ sung user chỉ-có-ở-máy
      var merged = sheetUsers.concat(localOnly);
      localStorage.setItem(lsKey, JSON.stringify(merged));

      // 5) Đẩy các user chỉ-có-ở-máy lên Sheets để bền vững & hiển thị cho admin khác
      //    (insert phía server là UPSERT theo id nên an toàn, không tạo trùng)
      localOnly.forEach(function(u){ insert("users", u).catch(function(){}); });

      return merged;
    }).catch(function(e) {
      console.warn("[DB] syncUsers failed:", e.message);
      return null;
    });
  }

  /* ─── Kiểm tra kết nối ─── */
  function testConnection() {
    if (!_url) return Promise.reject(new Error("Chưa nhập URL"));
    return _get({ action: "schema" }).then(function(res) {
      if (!res.ok) throw new Error(res.error || "API lỗi");
      return { ok: true, sheets: Object.keys(res.data), count: Object.keys(res.data).length };
    });
  }

  /* ─── Lấy cache in-memory ─── */
  function getCached(sheet) { return _cache[sheet] || null; }

  /* ─── Xóa cache ─── */
  function clearCache(sheet) {
    if (sheet) delete _cache[sheet];
    else _cache = {};
  }

  /* ─── Export public API ─── */
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
