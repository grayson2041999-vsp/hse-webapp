/**
 * bhld-sync.js — Engine đồng bộ Google Sheets cho trang Cấp phát BHLĐ
 * Sử dụng INSERT / UPDATE / DELETE thay vì bulkWrite để tránh ghi đè toàn bộ.
 *
 * Cách dùng:
 *   BHLD.pull()               — kéo toàn bộ dữ liệu từ Sheet về localStorage
 *   BHLD.push.insert(sheet, obj)   — thêm bản ghi mới lên Sheet
 *   BHLD.push.update(sheet, id, obj) — cập nhật bản ghi lên Sheet
 *   BHLD.push.delete(sheet, id)    — xóa bản ghi trên Sheet
 *   BHLD.testConnection()     — kiểm tra kết nối
 *   BHLD.getUrl()             — lấy URL hiện tại
 *   BHLD.setUrl(url)          — lưu URL mới
 */

var BHLD = (function() {
  'use strict';

  var HARDCODED_URL = 'https://script.google.com/macros/s/AKfycbzX8VPvbi5A9Cqi8bKQzkrT-rDTlgzAKiNtR5zilGEJm3AL_skKAUbd06_dQd2Em49knQ/exec';
  var LS_URL_KEY = 'bhld-sync-url';
  var TIMEOUT_MS = 15000;

  // ── Danh sách sheet cần pull ──
  var PULL_SHEETS = [
    'nhanvien', 'phieu_requests', 'pending_changes', 'notifications',
    'danh_muc', 'dinh_muc', 'ton_kho', 'lich_su_nhap_xuat',
    'nhom_nv', 'quy_list', 'nhom_tb', 'chuc_danh'
  ];

  // ── Map sheet → localStorage key ──
  var LS_MAP = {
    'nhanvien':        'bhld_nhanvien',
    'phieu_requests':  'bhld_phieu_requests',
    'pending_changes': 'bhld_pending_changes',
    'notifications':   'bhld_notifications',
    'danh_muc':        'bhld_danh_muc',
    'dinh_muc':        'bhld_dinh_muc',
    'ton_kho':         'bhld_ton_kho',
    'lich_su_nhap_xuat': 'bhld_lich_su_nhap_xuat',
    'nhom_nv':         'bhld_nhom_nv',
    'quy_list':        'bhld_quy_list',
    'nhom_tb':         'bhld_nhom_tb',
    'chuc_danh':       'bhld_chuc_danh'
  };

  // ─── Helpers ───

  function getUrl() { return HARDCODED_URL; }
  function setUrl(url) { /* URL đã được hardcode, không cần lưu */ }

  function lsGet(sheet) {
    try { return JSON.parse(localStorage.getItem(LS_MAP[sheet]) || '[]'); } catch(e) { return []; }
  }
  function lsSet(sheet, data) {
    localStorage.setItem(LS_MAP[sheet], JSON.stringify(data));
  }

  function _getCurrentUser() {
    try {
      var un = localStorage.getItem('hse_session');
      if (!un) return 'anonymous';
      var users = JSON.parse(localStorage.getItem('hse_users') || '[]');
      var u = users.find(function(x) { return x.username === un; });
      return u ? (u.fullname || u.username) : un;
    } catch(e) { return 'anonymous'; }
  }

  function _apiFetch(params, method, bodyObj) {
    var url = getUrl();
    if (!url) return Promise.reject(new Error('Chưa cấu hình URL đồng bộ BHLĐ.'));

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function() { controller.abort(); }, TIMEOUT_MS) : null;

    var fetchOpts = { signal: controller ? controller.signal : undefined };

    if (!method || method === 'GET') {
      var qs = Object.keys(params).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      return fetch(url + '?' + qs, fetchOpts)
        .then(function(r) { clearTimeout(timer); return r.json(); })
        .catch(function(e) { clearTimeout(timer); throw e; });
    } else {
      // POST
      var qs2 = Object.keys(params).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      fetchOpts.method = 'POST';
      fetchOpts.body = JSON.stringify(Object.assign({ user: _getCurrentUser() }, bodyObj));
      // Dùng text/plain thay vì application/json để tránh CORS preflight (OPTIONS)
      // Google Apps Script không xử lý OPTIONS → preflight fail → POST không được gửi
      fetchOpts.headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
      return fetch(url + '?' + qs2, fetchOpts)
        .then(function(r) { clearTimeout(timer); return r.json(); })
        .catch(function(e) { clearTimeout(timer); throw e; });
    }
  }

  // ─── Pull toàn bộ ───

  function pull(onProgress) {
    var url = getUrl();
    if (!url) return Promise.reject(new Error('Chưa cấu hình URL đồng bộ BHLĐ.'));

    var total = PULL_SHEETS.length;
    var done = 0;

    var promises = PULL_SHEETS.map(function(sheet) {
      return _apiFetch({ action: 'getAll', sheet: sheet })
        .then(function(res) {
          if (res.ok && Array.isArray(res.data)) {
            lsSet(sheet, res.data);
          }
          done++;
          if (typeof onProgress === 'function') onProgress(done, total, sheet);
          return { sheet: sheet, count: (res.data || []).length };
        })
        .catch(function(e) {
          done++;
          if (typeof onProgress === 'function') onProgress(done, total, sheet);
          return { sheet: sheet, error: e.message };
        });
    });

    return Promise.all(promises);
  }

  // ─── Push: Insert ───

  function insert(sheet, obj) {
    if (!obj.id) obj.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if (!obj.createdAt) obj.createdAt = new Date().toISOString();

    // Lưu localStorage ngay (optimistic)
    var local = lsGet(sheet);
    local.push(obj);
    lsSet(sheet, local);

    // Nếu chưa có URL → dừng ở localStorage
    if (!getUrl()) return Promise.resolve({ ok: true, local: true, data: obj });

    return _apiFetch({ action: 'insert', sheet: sheet }, 'POST', { data: obj })
      .then(function(res) {
        if (!res.ok) throw new Error(res.error || 'Insert thất bại');
        return res;
      });
  }

  // ─── Push: Bulk Replace — XOÁ TOÀN BỘ sheet rồi ghi lại ───
  // Dùng cho ton_kho (snapshot trạng thái hiện tại), KHÔNG dùng cho log/lịch sử
  function bulkReplace(sheet, rows) {
    if (!rows || !rows.length) return Promise.resolve({ ok: true, count: 0 });
    var now = new Date().toISOString();
    rows.forEach(function(obj) {
      if (!obj.id) obj.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (!obj.createdAt) obj.createdAt = now;
    });
    if (!getUrl()) return Promise.resolve({ ok: true, local: true });
    return _apiFetch({ action: 'bulkWrite', sheet: sheet }, 'POST', { data: rows })
      .then(function(res) {
        if (!res.ok) throw new Error(res.error || 'bulkReplace thất bại');
        return res;
      });
  }

  // ─── Push: Bulk Append — CHÈN THÊM nhiều dòng, không xoá dữ liệu cũ ───
  // Dùng cho lich_su_nhap_xuat (log giao dịch), không bao giờ thay thế lịch sử
  function bulkAppend(sheet, rows) {
    if (!rows || !rows.length) return Promise.resolve({ ok: true, count: 0 });
    var now = new Date().toISOString();
    rows.forEach(function(obj) {
      if (!obj.id) obj.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (!obj.createdAt) obj.createdAt = now;
    });
    if (!getUrl()) return Promise.resolve({ ok: true, local: true });
    return _apiFetch({ action: 'bulkAppend', sheet: sheet }, 'POST', { data: rows })
      .then(function(res) {
        if (!res.ok) throw new Error(res.error || 'bulkAppend thất bại');
        return res;
      });
  }

  // ─── Push: Update ───

  function update(sheet, id, changes) {
    changes.updatedAt = new Date().toISOString();

    // Cập nhật localStorage ngay
    var local = lsGet(sheet);
    var idx = local.findIndex(function(r) { return String(r.id) === String(id); });
    if (idx >= 0) {
      local[idx] = Object.assign({}, local[idx], changes, { id: id });
      lsSet(sheet, local);
    }

    if (!getUrl()) return Promise.resolve({ ok: true, local: true });

    return _apiFetch({ action: 'update', sheet: sheet, id: id }, 'POST', { data: changes })
      .then(function(res) {
        if (!res.ok) throw new Error(res.error || 'Update thất bại');
        return res;
      });
  }

  // ─── Push: Delete ───

  function remove(sheet, id) {
    // Xóa localStorage ngay
    var local = lsGet(sheet);
    lsSet(sheet, local.filter(function(r) { return String(r.id) !== String(id); }));

    if (!getUrl()) return Promise.resolve({ ok: true, local: true });

    return _apiFetch({ action: 'delete', sheet: sheet, id: id }, 'POST', {})
      .then(function(res) {
        if (!res.ok) throw new Error(res.error || 'Delete thất bại');
        return res;
      });
  }

  // ─── Kiểm tra kết nối ───

  function testConnection() {
    return _apiFetch({ action: 'ping' })
      .then(function(res) {
        if (!res.ok) throw new Error(res.error || 'Kết nối thất bại');
        return res;
      });
  }

  // ─── Public API ───

  return {
    getUrl: getUrl,
    setUrl: setUrl,
    lsGet: lsGet,
    lsSet: lsSet,
    pull: pull,
    push: { insert: insert, bulkReplace: bulkReplace, bulkAppend: bulkAppend, update: update, delete: remove },
    testConnection: testConnection,
    LS_MAP: LS_MAP
  };

})();
