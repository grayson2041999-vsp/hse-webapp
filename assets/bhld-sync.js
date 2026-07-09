/**
 * bhld-sync.js — Engine đồng bộ cho trang Cấp phát BHLĐ
 * PHIÊN BẢN SUPABASE (thay Google Apps Script / Sheets)
 *
 * ⚠️ GIỮ NGUYÊN interface như bản cũ:
 *   BHLD.pull(onProgress)
 *   BHLD.push.insert(sheet, obj)
 *   BHLD.push.update(sheet, id, changes)
 *   BHLD.push.delete(sheet, id)
 *   BHLD.push.bulkReplace(sheet, rows)   // xoá sạch rồi ghi lại (ton_kho)
 *   BHLD.push.bulkAppend(sheet, rows)    // chèn thêm, không xoá (lich_su_nhap_xuat)
 *   BHLD.lsGet / lsSet / getUrl / setUrl / testConnection / LS_MAP
 *
 * Yêu cầu: nạp assets/supabase-config.js (type=module) TRƯỚC file này.
 */
var BHLD = (function () {
  'use strict';

  var PULL_SHEETS = [
    'nhanvien', 'phieu_requests', 'pending_changes', 'notifications',
    'danh_muc', 'dinh_muc', 'ton_kho', 'lich_su_nhap_xuat',
    'nhom_nv', 'quy_list', 'nhom_tb', 'chuc_danh'
  ];

  // Cột chỉ dùng ở client, KHÔNG tồn tại trên bảng server (loại bỏ trước khi gửi lên).
  // 'nhomId' được dựng lại phía client từ 'nhomNoiBo', server không có cột này.
  // 'donVi' (ĐVT) của danh_muc được suy ra từ nhóm ở client, bảng server không có cột này.
  var CLIENT_ONLY = { nhanvien: ['nhomId'], danh_muc: ['donVi'] };
  function _stripClientOnly(sheet, obj) {
    var extra = CLIENT_ONLY[sheet];
    if (!extra || !obj || typeof obj !== 'object') return obj;
    var copy = {}; for (var k in obj) { if (extra.indexOf(k) < 0) copy[k] = obj[k]; }
    return copy;
  }

  var LS_MAP = {
    'nhanvien':          'bhld_nhanvien',
    'phieu_requests':    'bhld_phieu_requests',
    'pending_changes':   'bhld_pending_changes',
    'notifications':     'bhld_notifications',
    'danh_muc':          'bhld_danh_muc',
    'dinh_muc':          'bhld_dinh_muc',
    'ton_kho':           'bhld_ton_kho',
    'lich_su_nhap_xuat': 'bhld_lich_su_nhap_xuat',
    'nhom_nv':           'bhld_nhom_nv',
    'quy_list':          'bhld_quy_list',
    'nhom_tb':           'bhld_nhom_tb',
    'chuc_danh':         'bhld_chuc_danh'
  };

  // Tương thích: các trang cũ gọi getUrl()/setUrl() — giờ không cần URL nữa.
  function getUrl() { return window.HSE_SB ? 'supabase' : ''; }
  function setUrl() { /* no-op */ }

  function lsGet(sheet) {
    try { return JSON.parse(localStorage.getItem(LS_MAP[sheet]) || '[]'); } catch (e) { return []; }
  }
  function lsSet(sheet, data) {
    localStorage.setItem(LS_MAP[sheet], JSON.stringify(data));
  }

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function _ready() {
    if (window.HSE_SB) return Promise.resolve(window.HSE_SB);
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () { reject(new Error('Supabase client chưa sẵn sàng (thiếu supabase-config.js?)')); }, 12000);
      window.addEventListener('hse-sb-ready', function () { clearTimeout(to); resolve(window.HSE_SB); }, { once: true });
    });
  }

  // ─── Pull toàn bộ ───
  function pull(onProgress) {
    var total = PULL_SHEETS.length, done = 0;
    return _ready().then(function (sb) {
      var promises = PULL_SHEETS.map(function (sheet) {
        return sb.from(sheet).select('*').then(function (res) {
          if (!res.error && Array.isArray(res.data)) lsSet(sheet, res.data);
          done++;
          if (typeof onProgress === 'function') onProgress(done, total, sheet);
          return { sheet: sheet, count: (res.data || []).length, error: res.error && res.error.message };
        });
      });
      return Promise.all(promises);
    });
  }

  // ─── Insert (optimistic localStorage + upsert server) ───
  function insert(sheet, obj) {
    if (!obj.id) obj.id = genId();
    if (!obj.createdAt) obj.createdAt = new Date().toISOString();
    // Idempotent theo id: nếu đã có trong cache thì THAY THẾ, tránh nhân đôi
    // (nhiều nơi gọi đã tự lsSet trước rồi mới gọi insert).
    var local = lsGet(sheet);
    var _i = local.findIndex(function (r) { return String(r.id) === String(obj.id); });
    if (_i >= 0) local[_i] = obj; else local.push(obj);
    lsSet(sheet, local);
    return _ready().then(function (sb) {
      return sb.from(sheet).upsert(_stripClientOnly(sheet, obj), { onConflict: 'id' }).select();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true, data: obj };
    });
  }

  // ─── Update ───
  function update(sheet, id, changes) {
    changes = Object.assign({}, changes, { updatedAt: new Date().toISOString() });
    var local = lsGet(sheet);
    var idx = local.findIndex(function (r) { return String(r.id) === String(id); });
    if (idx >= 0) { local[idx] = Object.assign({}, local[idx], changes, { id: id }); lsSet(sheet, local); }
    return _ready().then(function (sb) {
      return sb.from(sheet).update(_stripClientOnly(sheet, changes)).eq('id', id).select();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true };
    });
  }

  // ─── Delete ───
  function remove(sheet, id) {
    var local = lsGet(sheet);
    lsSet(sheet, local.filter(function (r) { return String(r.id) !== String(id); }));
    return _ready().then(function (sb) {
      return sb.from(sheet).delete().eq('id', id);
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true };
    });
  }

  // ─── Bulk Replace: XOÁ TOÀN BỘ bảng rồi ghi lại (snapshot, dùng cho ton_kho) ───
  function bulkReplace(sheet, rows) {
    if (!rows || !rows.length) return Promise.resolve({ ok: true, count: 0 });
    var now = new Date().toISOString();
    rows.forEach(function (o) { if (!o.id) o.id = genId(); if (!o.createdAt) o.createdAt = now; });
    return _ready().then(function (sb) {
      return sb.from(sheet).delete().not('id', 'is', null).then(function () {
        return sb.from(sheet).upsert(rows, { onConflict: 'id' }).select();
      });
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true, count: rows.length };
    });
  }

  // ─── Bulk Append: CHÈN THÊM nhiều dòng, không xoá (log/lịch sử) ───
  function bulkAppend(sheet, rows) {
    if (!rows || !rows.length) return Promise.resolve({ ok: true, count: 0 });
    var now = new Date().toISOString();
    rows.forEach(function (o) { if (!o.id) o.id = genId(); if (!o.createdAt) o.createdAt = now; });
    return _ready().then(function (sb) {
      return sb.from(sheet).insert(rows).select();
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true, count: rows.length };
    });
  }

  function testConnection() {
    return _ready().then(function (sb) {
      return sb.from('nhanvien').select('id', { count: 'exact', head: true });
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return { ok: true, count: res.count };
    });
  }

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
