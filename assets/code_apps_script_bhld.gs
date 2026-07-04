/**
 * =========================================================
 *  GOOGLE APPS SCRIPT — HSE Webapp · Cấp phát BHLĐ
 *  Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị
 *  Liên doanh Việt - Nga Vietsovpetro
 * =========================================================
 *
 *  CÁCH TRIỂN KHAI:
 *  1. Tạo Google Sheets MỚI (riêng biệt với sheet accounts)
 *  2. Mở Extensions → Apps Script → dán toàn bộ file này
 *  3. Chạy setupSheets() một lần để tạo các tab
 *  4. Deploy → New deployment → Web App:
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Copy URL và dán vào trang Cấp phát BHLĐ → cài đặt đồng bộ
 *
 *  SHEET STRUCTURE:
 *  - nhanvien         : Hồ sơ nhân viên + lịch cấp phát
 *  - phieu_requests   : Phiếu yêu cầu cấp phát theo quý
 *  - pending_changes  : Thay đổi nhân viên chờ admin duyệt
 *  - danh_muc         : Danh mục BHLĐ (trang bị bảo hộ)
 *  - dinh_muc         : Định mức cấp phát theo chức danh
 *  - ton_kho          : Tồn kho hiện tại
 *  - lich_su_nhap_xuat      : Lịch sử nhập/xuất kho
 *  - quy_list         : Danh sách quý hợp lệ
 *  - logs             : Nhật ký thao tác
 * =========================================================
 */

var SS = SpreadsheetApp.getActiveSpreadsheet();

// ─────────── SCHEMA CÁC SHEET ───────────
var SCHEMA = {

  nhanvien: {
    cols: [
      "id","danhSo","ten","chucDanh","boPhan","loaiNV","gioiTinh",
      "coQuanAo","coGiay","stt",
      "thangCapQuanAo","thangCapQAHan","thangCapAoMua",
      "thangCapGiay","thangCapMu","thangCapKinh",
      "ngayVaoLam","nhomNoiBo","createdBy","createdAt","updatedAt"
    ],
    desc: "Hồ sơ nhân viên và lịch cấp phát BHLĐ"
  },

  phieu_requests: {
    cols: [
      "id","type","donVi","quyStr","status",
      "nvId","nvTen","nvDanhSo","chucDanh","ngayVaoLam",
      "items",
      "submittedBy","submittedByUsername","submittedAt","reviewedBy","reviewedAt",
      "rejectReason","createdAt","updatedAt"
    ],
    desc: "Phiếu yêu cầu cấp phát (type: quy | nv_moi) — pending/approved/rejected"
  },

  pending_changes: {
    cols: [
      "id","donVi","type","nvId","nvTen","payload","diffHtml","status",
      "submittedBy","submittedByUsername","submittedAt","reviewedBy","reviewedAt",
      "rejectReason","createdAt","updatedAt"
    ],
    desc: "Thay đổi danh sách nhân viên chờ admin duyệt (type: add | edit | delete)"
  },

  notifications: {
    cols: [
      "id","toUsername","type","title","message","relatedId",
      "snapshot","read","createdBy","createdAt"
    ],
    desc: "Thông báo gửi tới User (duyệt/từ chối NV mới, phiếu, thay đổi nhân sự...). read: '1'|'' "
  },

  danh_muc: {
    cols: ["id","nhomId","ma","ten","thuTu","createdAt","updatedAt"],
    desc: "Chi tiết trang bị bảo hộ (mã vật tư + tên + nhomId → nhom_tb)"
  },

  chuc_danh: {
    cols: ["id","ten","createdAt","updatedAt"],
    desc: "Danh mục chức danh. ten = tên chức danh (phải khớp với nhanvien.chucDanh)"
  },

  dinh_muc: {
    cols: ["id","chucDanhId","nhomTBId","chuKy","thuTu","createdAt","updatedAt"],
    desc: "Định mức cấp phát: chucDanhId → chuc_danh, nhomTBId → nhom_tb"
  },

  ton_kho: {
    cols: ["id","soLuong"],
    desc: "Tồn kho hiện tại — id = danh_muc.id, soLuong = số lượng hiện có"
  },

  lich_su_nhap_xuat: {
    cols: [
      "id","tenGiaoDich","loai","tbId","maVatTu","tenTrangBi",
      "soLuong","donViNhan","nguoiThucHien","thangGiaoDich","ghiChu","createdAt"
    ],
    desc: "Lịch sử nhập/xuất kho — 1 dòng per vật tư per giao dịch"
  },

  nhom_nv: {
    cols: ["id","donVi","ten","thu_tu","createdAt"],
    desc: "Nhóm nhân viên nội bộ trong từng đơn vị"
  },

  quy_list: {
    cols: ["id","quyStr","createdAt"],
    desc: "Danh sách quý hợp lệ để lập phiếu"
  },

  nhom_tb: {
    cols: ["id","ten","loaiCo","donVi","createdAt","updatedAt"],
    desc: "Nhóm trang bị bảo hộ lao động. loaiCo: 'quan_ao'|'giay'|'' (xác định cỡ khi cấp phát)"
  },

};

// ─────────── SETUP ───────────
function setupSheets() {
  Object.keys(SCHEMA).forEach(function(name) {
    var schema = SCHEMA[name];
    var sh = SS.getSheetByName(name);
    if (!sh) sh = SS.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(schema.cols);
      var hr = sh.getRange(1, 1, 1, schema.cols.length);
      hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, schema.cols.length);
    }
  });
  SpreadsheetApp.flush();
  Logger.log("✅ Đã tạo " + Object.keys(SCHEMA).length + " sheets BHLĐ thành công!");
}

// Chạy 1 lần để fix format Plain text cho các cột mã số trên tất cả sheets
function fixTextFormat() {
  Object.keys(SCHEMA).forEach(function(name) {
    var sh = SS.getSheetByName(name);
    if (sh) _applyTextFormatToCodeCols(sh);
  });
  SpreadsheetApp.flush();
  Logger.log("✅ Đã set Plain text format cho tất cả cột mã số!");
}

// ─────────── TIỆN ÍCH IMPORT ───────────

/**
 * Điền tự động cột "id" cho các hàng còn trống trong sheet nhanvien.
 * Cách dùng:
 *   1. Paste dữ liệu Excel vào sheet (paste từ cột B trở đi, bỏ trống cột A = id)
 *   2. Mở Apps Script Editor → chọn hàm fillMissingIds → nhấn Run
 */
function fillMissingIds() {
  var sheetName = "nhanvien";
  var sh = SS.getSheetByName(sheetName);
  if (!sh) { Logger.log("❌ Không tìm thấy sheet: " + sheetName); return; }

  var lastRow = sh.getLastRow();
  if (lastRow <= 1) { Logger.log("⚠️ Sheet trống, không có dữ liệu để điền."); return; }

  var idCol = 1; // Cột A = id
  var idValues = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  var filled = 0;

  for (var i = 0; i < idValues.length; i++) {
    if (!idValues[i][0] || String(idValues[i][0]).trim() === "") {
      var newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      sh.getRange(i + 2, idCol).setValue(newId);
      Utilities.sleep(1); // tránh trùng timestamp
      filled++;
    }
  }

  SpreadsheetApp.flush();
  Logger.log("✅ Đã điền " + filled + " id cho sheet [" + sheetName + "]. Tổng hàng: " + (lastRow - 1));
}

/**
 * Điền tự động cột "stt" cho các hàng còn trống trong sheet nhanvien.
 * Thứ tự stt được đánh theo từng boPhan riêng, bắt đầu từ 0.
 * Hàng đã có stt → giữ nguyên, không ghi đè.
 * Cách dùng:
 *   Mở Apps Script Editor → chọn hàm fillMissingStt → nhấn Run
 */
function fillMissingStt() {
  var sh = SS.getSheetByName("nhanvien");
  if (!sh) { Logger.log("❌ Không tìm thấy sheet nhanvien"); return; }

  var lastRow = sh.getLastRow();
  if (lastRow <= 1) { Logger.log("⚠️ Sheet trống."); return; }

  // Đọc header để tìm cột stt và boPhan
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var sttCol  = headers.indexOf("stt") + 1;
  var bpCol   = headers.indexOf("boPhan") + 1;
  if (sttCol === 0 || bpCol === 0) { Logger.log("❌ Không tìm thấy cột stt hoặc boPhan trong header."); return; }

  var numRows = lastRow - 1;
  var sttVals = sh.getRange(2, sttCol, numRows, 1).getValues();
  var bpVals  = sh.getRange(2, bpCol,  numRows, 1).getValues();

  // Đếm stt hiện tại cao nhất theo từng boPhan (để tiếp nối, không ghi đè)
  var bpCounter = {};
  for (var i = 0; i < numRows; i++) {
    var bp  = String(bpVals[i][0] || "").trim();
    var stt = sttVals[i][0];
    if (bp && stt !== "" && stt !== null && !isNaN(Number(stt))) {
      var n = Number(stt);
      if (bpCounter[bp] === undefined || n >= bpCounter[bp]) {
        bpCounter[bp] = n + 1; // next available
      }
    }
  }

  var filled = 0;
  for (var j = 0; j < numRows; j++) {
    var bp2  = String(bpVals[j][0] || "").trim();
    var stt2 = sttVals[j][0];
    if (!bp2) continue; // bỏ hàng không có đơn vị
    if (stt2 !== "" && stt2 !== null && !isNaN(Number(stt2))) continue; // đã có stt
    if (bpCounter[bp2] === undefined) bpCounter[bp2] = 0;
    sh.getRange(j + 2, sttCol).setValue(bpCounter[bp2]);
    bpCounter[bp2]++;
    filled++;
  }

  SpreadsheetApp.flush();
  Logger.log("✅ Đã điền stt cho " + filled + " hàng. Tổng hàng: " + numRows);
}

// ─────────── HELPERS ───────────
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _getSheet(name, autoCreate) {
  var sh = SS.getSheetByName(name);
  if (!sh) {
    if (!autoCreate) throw new Error("Sheet không tồn tại: " + name);
    sh = SS.insertSheet(name);
    var schema = SCHEMA[name];
    if (schema && schema.cols.length) {
      sh.appendRow(schema.cols);
      var hr = sh.getRange(1, 1, 1, schema.cols.length);
      hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

// Các cột lưu tháng (YYYY-MM) — khi Sheets parse thành Date object, format lại đúng
var _MONTH_COLS = ["ngayVaoLam","thangCapQuanAo","thangCapQAHan","thangCapAoMua",
                   "thangCapGiay","thangCapMu","thangCapKinh"];
var _TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

function _sheetToObjects(sh) {
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = row[i];
      // Google Sheets có thể tự parse chuỗi "YYYY-MM" hoặc "YYYY-MM-DD" thành Date object
      // → format lại theo timezone của spreadsheet để tránh lệch UTC
      if (v instanceof Date) {
        if (_MONTH_COLS.indexOf(h) >= 0) {
          v = Utilities.formatDate(v, _TZ, "yyyy-MM");
        } else {
          v = Utilities.formatDate(v, _TZ, "yyyy-MM-dd");
        }
      } else {
        if (typeof v === "string" && (v.charAt(0) === "[" || v.charAt(0) === "{")) {
          try { v = JSON.parse(v); } catch(e) {}
        }
        if (v === "TRUE" || v === true) v = true;
        else if (v === "FALSE" || v === false) v = false;
      }
      obj[h] = (v === "" || v === null || v === undefined) ? "" : v;
    });
    return obj;
  });
}

function _getHeaders(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol === 0) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0];
}

// Các field luôn phải lưu dạng text (không để Sheet tự convert thành số)
var TEXT_FIELDS = ["ma","maVatTu","id","maDinhDanh","danhSo"];

function _objToRow(sh, obj) {
  var headers = _getHeaders(sh);
  return headers.map(function(h) {
    var v = obj[h];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    // Ép string cho các field mã số để tránh Sheet tự format thành số
    if (TEXT_FIELDS.indexOf(h) >= 0) return String(v);
    return v;
  });
}

// Set number format "@" (Plain text) cho các cột mã số trong 1 sheet
function _applyTextFormatToCodeCols(sh) {
  var headers = _getHeaders(sh);
  headers.forEach(function(h, i) {
    if (TEXT_FIELDS.indexOf(h) >= 0) {
      sh.getRange(2, i+1, Math.max(sh.getLastRow()-1, 1), 1).setNumberFormat("@");
    }
  });
}

function _findRowById(sh, id) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function _ensureColumns(sh, obj) {
  var sheetName = sh.getName();
  var allowedCols = SCHEMA[sheetName] ? SCHEMA[sheetName].cols : null;
  // Đọc lại headers trực tiếp từ sheet (không dùng cache) để tránh race condition
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  Object.keys(obj).forEach(function(k) {
    if (headers.indexOf(k) < 0) {
      if (allowedCols && allowedCols.indexOf(k) < 0) return;
      // Kiểm tra lại lần nữa ngay trước khi thêm (double-check)
      var currentHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      if (currentHeaders.indexOf(k) >= 0) return; // đã tồn tại, bỏ qua
      var newCol = sh.getLastColumn() + 1;
      sh.getRange(1, newCol).setValue(k)
        .setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      headers.push(k);
    }
  });
}


function _cors(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────── HANDLERS ───────────

function _handleGetAll(params) {
  var sh = _getSheet(params.sheet);
  var rows = _sheetToObjects(sh);
  if (params.where) {
    try {
      var where = JSON.parse(params.where);
      rows = rows.filter(function(row) {
        return Object.keys(where).every(function(k) {
          return String(row[k]) === String(where[k]);
        });
      });
    } catch(e) {}
  }
  return { ok: true, data: rows };
}

function _handleGetById(params) {
  var sh = _getSheet(params.sheet);
  var rows = _sheetToObjects(sh);
  var row = rows.find(function(r) { return String(r.id) === String(params.id); });
  if (!row) return { ok: false, error: "Không tìm thấy id=" + params.id };
  return { ok: true, data: row };
}

function _handleInsert(params, body) {
  var sh = _getSheet(params.sheet, true);
  var obj = body.data || body;
  if (!obj.id) obj.id = _genId();
  if (!obj.createdAt) obj.createdAt = new Date().toISOString();
  // Upsert: nếu id đã tồn tại → update thay vì thêm dòng mới
  var existingRow = _findRowById(sh, obj.id);
  if (existingRow >= 0) {
    _ensureColumns(sh, obj);
    var row = _objToRow(sh, obj);
    sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
    _applyTextFormatToCodeCols(sh);
    return { ok: true, data: obj };
  }
  _ensureColumns(sh, obj);
  var row = _objToRow(sh, obj);
  sh.appendRow(row);
  _applyTextFormatToCodeCols(sh);
  return { ok: true, data: obj };
}

function _handleUpdate(params, body) {
  var sh = _getSheet(params.sheet, true);
  var rowNum = _findRowById(sh, params.id);
  if (rowNum < 0) {
    // Nếu không tìm thấy → insert mới (upsert), gắn id từ params vào data
    body.data = Object.assign({ id: params.id }, body.data || {});
    return _handleInsert(params, body);
  }
  var existing = _sheetToObjects(sh).find(function(r) { return String(r.id) === String(params.id); });
  var updated = Object.assign({}, existing, body.data || body, {
    id: params.id,
    updatedAt: new Date().toISOString()
  });
  _ensureColumns(sh, updated);
  var row = _objToRow(sh, updated);
  sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
  _applyTextFormatToCodeCols(sh);
  return { ok: true, data: updated };
}

function _handleDelete(params, body) {
  var sh = _getSheet(params.sheet);
  var rowNum = _findRowById(sh, params.id);
  if (rowNum < 0) return { ok: false, error: "Không tìm thấy id=" + params.id };
  sh.deleteRow(rowNum);
  return { ok: true };
}

function _handleBulkWrite(params, body) {
  var sh = _getSheet(params.sheet, true);
  var rows = body.data || [];
  if (rows.length === 0) return { ok: true, count: 0 };

  var allKeys = [];
  rows.forEach(function(obj) {
    Object.keys(obj).forEach(function(k) { if (allKeys.indexOf(k) < 0) allKeys.push(k); });
  });

  if (sh.getLastRow() === 0) {
    sh.appendRow(allKeys);
    var hr = sh.getRange(1, 1, 1, allKeys.length);
    hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    var existingHeaders = _getHeaders(sh);
    allKeys.forEach(function(k) {
      if (existingHeaders.indexOf(k) < 0) {
        var newCol = sh.getLastColumn() + 1;
        sh.getRange(1, newCol).setValue(k)
          .setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
        existingHeaders.push(k);
      }
    });
  }

  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  rows.forEach(function(obj) {
    if (!obj.id) obj.id = _genId();
    sh.appendRow(_objToRow(sh, obj));
  });
  return { ok: true, count: rows.length };
}

// Chèn thêm nhiều dòng mà KHÔNG xoá dữ liệu cũ — dùng cho log/lịch sử
function _handleBulkAppend(params, body) {
  var sh = _getSheet(params.sheet, true);
  var rows = body.data || [];
  if (rows.length === 0) return { ok: true, count: 0 };

  // Đảm bảo các cột mới có trong header
  var allKeys = [];
  rows.forEach(function(obj) {
    Object.keys(obj).forEach(function(k) { if (allKeys.indexOf(k) < 0) allKeys.push(k); });
  });
  if (sh.getLastRow() === 0) {
    sh.appendRow(allKeys);
    var hr = sh.getRange(1, 1, 1, allKeys.length);
    hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    _ensureColumns(sh, rows[0]);
  }

  // Chèn thêm — không deleteRows
  rows.forEach(function(obj) {
    if (!obj.id) obj.id = _genId();
    sh.appendRow(_objToRow(sh, obj));
  });
  return { ok: true, count: rows.length };
}

function _handleSchema() {
  var result = {};
  Object.keys(SCHEMA).forEach(function(k) {
    result[k] = { cols: SCHEMA[k].cols, desc: SCHEMA[k].desc };
  });
  return { ok: true, data: result };
}

function _handlePing() {
  return { ok: true, message: "HSE BHLĐ API đang hoạt động", sheets: Object.keys(SCHEMA), timestamp: new Date().toISOString() };
}

// ─────────── ENTRY POINTS ───────────

function doGet(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || "getAll";
    var body = {};
    if (p.payload) { try { body = JSON.parse(p.payload); } catch(ex) {} }

    var result;
    switch (action) {
      case "getAll":    result = _handleGetAll(p); break;
      case "getById":   result = _handleGetById(p); break;
      case "schema":    result = _handleSchema(); break;
      case "ping":      result = _handlePing(); break;
      case "insert":    result = _handleInsert(p, body); break;
      case "update":    result = _handleUpdate(p, body); break;
      case "delete":    result = _handleDelete(p, body); break;
      case "bulkWrite":  result = _handleBulkWrite(p, body); break;
      case "bulkAppend": result = _handleBulkAppend(p, body); break;
      default:           result = { ok: false, error: "Action không hợp lệ: " + action };
    }
    return _cors(result);
  } catch(err) {
    return _cors({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || "insert";
    var body = {};
    try { body = JSON.parse(e.postData.contents); } catch(ex) {}

    var result;
    switch (action) {
      case "insert":    result = _handleInsert(p, body); break;
      case "update":    result = _handleUpdate(p, body); break;
      case "delete":    result = _handleDelete(p, body); break;
      case "bulkWrite":  result = _handleBulkWrite(p, body); break;
      case "bulkAppend": result = _handleBulkAppend(p, body); break;
      default:           result = { ok: false, error: "Action không hợp lệ: " + action };
    }
    return _cors(result);
  } catch(err) {
    return _cors({ ok: false, error: err.message });
  }
}
