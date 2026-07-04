/**
 * =========================================================
 *  GOOGLE APPS SCRIPT — HSE Webapp Database API
 *  Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị
 * =========================================================
 *
 *  CÁCH TRIỂN KHAI:
 *  1. Mở Google Sheets → Extensions → Apps Script
 *  2. Dán toàn bộ file này vào editor
 *  3. Chạy setupSheets() một lần để tạo các tab
 *  4. Deploy → New deployment → Web App:
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Copy URL và dán vào trang Quản trị hệ thống → ô URL Sheets
 *
 *  LƯU Ý: Các sheet chưa có trong SCHEMA sẽ được tự động tạo
 *  lần đầu tiên khi trang tương ứng ghi dữ liệu (autoCreate).
 * =========================================================
 */

var SS = SpreadsheetApp.getActiveSpreadsheet();

// Timezone của Spreadsheet — dùng để format ngày khi đọc ra,
// tránh lệch 1 ngày khi timezone của Apps Script project khác (VN vs UTC)
var _TZ = SS.getSpreadsheetTimeZone();

// ─────────── CẤU TRÚC CÁC SHEET ĐANG HOẠT ĐỘNG ───────────
var SCHEMA = {

  // ── HỆ THỐNG ──
  users: {
    cols: ["id","username","password","fullname","danhSo","role","perms","capPhatUnits","active","pendingApproval","created","updated"],
    desc: "Tài khoản người dùng"
  },

  // ── MÔI TRƯỜNG ──
  moi_truong: {
    cols: ["id","nam","thang","rac_nh_long","rac_nh_ran","rac_knh","thung_suc_rua","phuy_sat","phuy_nhua","can","thung_nhua_1m3","pin_ac_quy","amiang","dau_nhot","nuoc_thai","createdBy","createdAt","updatedAt"],
    desc: "Môi trường – Thống kê chất thải theo tháng/năm"
  },

  // ── PCCC & CNCH ──
  pt_cc_cnch_types: {
    cols: ["id","name","createdBy","createdAt"],
    desc: "PCCC – Danh mục loại phương tiện CC & CNCH"
  },
  pt_cc_cnch_markers: {
    cols: ["id","zoneId","type","qty","note","x","y","createdBy","createdAt"],
    desc: "PCCC – Vị trí phương tiện CC & CNCH trên sơ đồ"
  },
  pccc_devices: {
    cols: ["id","name","location","createdAt","updatedAt"],
    desc: "PCCC – Danh sách thiết bị"
  },
  pccc_errors: {
    cols: ["id","deviceId","month","year","errorDate","errorDesc","fixDesc","status","reporter","createdAt","updatedAt"],
    desc: "PCCC – Nhật ký lỗi / sự cố"
  },
  pccc_locked_months: {
    cols: ["id","month","year","lockedBy","lockedAt"],
    desc: "PCCC – Tháng đã khoá báo cáo"
  },

  // ── KẾ HOẠCH ──
  ke_hoach_mot_lan: {
    cols: ["id","name","status","start","end","chuTri","phoiHop","coSo","ghiChu","pages","order","updatedAt","completionDate","completionReport"],
    desc: "Kế hoạch – Công việc có kỳ hạn"
  },
  ke_hoach_lap_lai: {
    cols: ["id","name","allMonths","months","execDay","lastDay","chuTri","phoiHop","coSo","ghiChu","pages","updatedAt"],
    desc: "Kế hoạch – Công việc định kỳ"
  },

  // ── SOP ──
  sop: {
    cols: ["id","ma_td","ten_sop","don_vi","ngay_pd","link"],
    desc: "Danh sách SOP"
  },

  // ── HUẤN LUYỆN - ĐÀO TẠO ──
  hl_nhansu: {
    cols: ["id","loai_huan_luyen","name","pid","title","unit","lastDate","note","createdAt"],
    desc: "Huấn luyện – Danh sách nhân sự"
  },
  hl_settings: {
    cols: ["loai","thoi_han_thang"],
    desc: "Huấn luyện – Thời hạn huấn luyện lại theo loại"
  },

  // ── KIỂM TRA CÁC CẤP ──
  kiem_tra_cap12: {
    cols: ["id","type","thang","donVi","soLanKiemTra","soViPham","violations","createdBy","createdAt"],
    desc: "Kiểm tra Cấp 1 & Cấp 2"
  },
  kiem_tra_cap34: {
    cols: ["id","type","tenKhac","ngayKT","noiKT","doanKT","violations","createdBy","createdAt"],
    desc: "Kiểm tra Cấp 3, Cấp IV & Khác"
  },

  // ── KHÁM SỨC KHOẺ ──
  ksk: {
    cols: ["id","nam","loai","tong","da_kham","updatedBy","updatedAt","createdAt"],
    desc: "Khám sức khoẻ – Tiến độ khám SK định kỳ & bệnh nghề nghiệp (loai: dinh_ky/benh_nghe_1/benh_nghe_2)"
  },

  // ── QUẢN LÝ NHÀ THẦU ──
  nha_thau: {
    cols: ["id","ten_nha_thau","khu_vuc","hang_muc","lh_ho_ten","lh_chuc_danh","lh_sdt","hd_bat_dau","hd_ket_thuc","ghi_chu","createdAt"],
    desc: "Quản lý nhà thầu – Thông tin các nhà thầu thuê kho, bãi, văn phòng"
  },

  // ── QUẢN LÝ THIẾT BỊ – BÌNH ÁP LỰC ──
  binh_ap_luc: {
    cols: ["id","section","order","ten_thiet_bi","vi_tri","v_m3","plv_kgcm2","nam_van_hanh","so_dang_ky","ngay_kd_gan_nhat","ngay_kd_tiep_theo","moi_chat_an_mon","moi_chat_chay_no","ghi_chu","createdBy","createdAt","updatedAt"],
    desc: "Quản lý thiết bị – Bình áp lực (section: cang_bien / xuong_sua_chua)"
  },

  // ── TAI NẠN - SỰ CỐ ──
  tnsc_gio_cong: {
    cols: ["id","nam","thang","gio_cong","createdBy","createdAt","updatedBy","updatedAt"],
    desc: "Tai nạn - Sự cố – Giờ công lao động an toàn theo tháng"
  },
  tnsc_su_kien: {
    cols: ["id","ten","loai","mucDo","thoiGian","moTa","nanNhan","otms","createdBy","createdAt","updatedBy","updatedAt"],
    desc: "Tai nạn - Sự cố – Ghi nhận TNLĐ / sự cố kỹ thuật (loai: tai_nan_lao_dong/su_co_ky_thuat; nanNhan & otms lưu JSON; thoiGian dạng 'YYYY-MM-DD HH:mm')"
  }
};

// ─────────── SETUP: TẠO CÁC SHEET ───────────
function setupSheets() {
  Object.keys(SCHEMA).forEach(function(name) {
    var schema = SCHEMA[name];
    var sh = SS.getSheetByName(name);
    if (!sh) {
      sh = SS.insertSheet(name);
    }
    if (sh.getLastRow() === 0) {
      sh.appendRow(schema.cols);
      var hr = sh.getRange(1, 1, 1, schema.cols.length);
      hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, schema.cols.length);
    }
  });

  // Seed tài khoản admin mặc định nếu chưa có
  var userSheet = SS.getSheetByName("users");
  if (userSheet && userSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    userSheet.appendRow([
      _genId(), "admin", "admin123", "Quản trị viên", "",
      "admin", JSON.stringify(["*"]), "true", "false", now, now
    ]);
  }

  SpreadsheetApp.flush();
  Logger.log("✅ Đã tạo " + Object.keys(SCHEMA).length + " sheets thành công!");
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
    if (schema && schema.cols && schema.cols.length) {
      sh.appendRow(schema.cols);
      var hr = sh.getRange(1, 1, 1, schema.cols.length);
      hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, schema.cols.length);
    }
    Logger.log("✅ Tự động tạo sheet: " + name);
  }
  return sh;
}

function _sheetToObjects(sh) {
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = row[i];
      // Convert Date objects → "yyyy-MM-dd" theo TIMEZONE CỦA SPREADSHEET.
      // KHÔNG dùng v.getDate()/getMonth()/getFullYear() vì các hàm đó chạy theo
      // timezone của Apps Script project (thường là UTC) → lệch lùi 1 ngày
      // so với ngày lưu trên Sheet (GMT+7). Cách fix giống code_apps_script_bhld.gs.
      if (v instanceof Date) {
        v = Utilities.formatDate(v, _TZ, "yyyy-MM-dd");
      } else if (typeof v === "string" && (v.charAt(0) === "[" || v.charAt(0) === "{")) {
        try { v = JSON.parse(v); } catch(e) {}
      }
      if (v === "TRUE" || v === true) v = true;
      else if (v === "FALSE" || v === false) v = false;
      obj[h] = v;
    });
    return obj;
  });
}

// Các cột phải lưu dạng text để Sheets không tự convert thành số
// (mất số 0 đầu ở SĐT, id bị format thành số thập phân, v.v.)
var TEXT_FIELDS = ["id", "lh_sdt", "createdAt", "updatedAt", "thoiGian"];

function _objToRow(sh, obj) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return headers.map(function(h) {
    var v = obj[h];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    // Ép string cho các cột mã/SĐT để Sheets không tự convert thành số
    if (TEXT_FIELDS.indexOf(h) >= 0) return String(v);
    return v;
  });
}

// Set format "@" (Plain text) cho các cột TEXT_FIELDS — phải gọi TRƯỚC khi ghi dữ liệu.
// Lý do: nếu gọi sau appendRow/setValues thì Sheets đã kịp convert "0901..." → 901...
// Format toàn bộ cột (đến hàng 2000) để bao phủ cả hàng sắp ghi vào.
function _applyTextFormat(sh) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (TEXT_FIELDS.indexOf(h) >= 0) {
      sh.getRange(2, i + 1, 2000, 1).setNumberFormat("@");
    }
  });
}

// Chạy 1 lần thủ công trong Apps Script Editor để set Plain text
// cho các cột TEXT_FIELDS trên TẤT CẢ các sheet → sửa ô cũ bị mất số 0
function fixTextFormat() {
  Object.keys(SCHEMA).forEach(function(name) {
    var sh = SS.getSheetByName(name);
    if (sh) _applyTextFormat(sh);
  });
  SpreadsheetApp.flush();
  Logger.log("✅ Đã set Plain text format cho tất cả cột mã số / SĐT!");
}

function _findRowById(sh, id) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}


// ─────────── CORS RESPONSE ───────────
function _cors(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────── API HANDLERS ───────────

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
  if (!row) return { ok: false, error: "Không tìm thấy record id=" + params.id };
  return { ok: true, data: row };
}

function _handleInsert(params, body) {
  var sh = _getSheet(params.sheet, true);
  var obj = body.data || body;
  if (!obj.id) obj.id = _genId();
  if (!obj.createdAt) obj.createdAt = new Date().toISOString();
  if (sh.getLastColumn() === 0) {
    var keys = Object.keys(obj);
    sh.appendRow(keys);
    var hr = sh.getRange(1, 1, 1, keys.length);
    hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  // UPSERT: nếu id đã tồn tại (retry / bấm Lưu 2 lần) → cập nhật thay vì thêm dòng mới
  var existingRow = _findRowById(sh, obj.id);
  if (existingRow > 0) {
    var existing = _sheetToObjects(sh).find(function(r) { return String(r.id) === String(obj.id); });
    var merged = Object.assign({}, existing, obj);
    _applyTextFormat(sh);
    sh.getRange(existingRow, 1, 1, _objToRow(sh, merged).length).setValues([_objToRow(sh, merged)]);
    return { ok: true, data: merged };
  }
  _applyTextFormat(sh);            // ← set Plain text TRƯỚC khi ghi
  var row = _objToRow(sh, obj);
  sh.appendRow(row);
  return { ok: true, data: obj };
}

function _handleUpdate(params, body) {
  var sh = _getSheet(params.sheet, true);
  var rowNum = _findRowById(sh, params.id);
  if (rowNum < 0) return { ok: false, error: "Không tìm thấy id=" + params.id };
  var existing = _sheetToObjects(sh).find(function(r) { return String(r.id) === String(params.id); });
  var updated = Object.assign({}, existing, body.data || body, { id: params.id, updatedAt: new Date().toISOString() });
  _applyTextFormat(sh);            // ← set Plain text TRƯỚC khi ghi
  var row = _objToRow(sh, updated);
  sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
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
  var allKeys = [];
  rows.forEach(function(obj) {
    Object.keys(obj).forEach(function(k) {
      if (allKeys.indexOf(k) < 0) allKeys.push(k);
    });
  });
  if (sh.getLastRow() === 0) {
    sh.appendRow(allKeys);
    var hr = sh.getRange(1, 1, 1, allKeys.length);
    hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    var existingHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    allKeys.forEach(function(k) {
      if (existingHeaders.indexOf(k) < 0) {
        var newCol = sh.getLastColumn() + 1;
        sh.getRange(1, newCol).setValue(k)
          .setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
        existingHeaders.push(k);
      }
    });
  }
  if (sh.getLastRow() > 1) {
    sh.deleteRows(2, sh.getLastRow() - 1);
  }
  _applyTextFormat(sh);            // ← set Plain text TRƯỚC khi ghi hàng loạt
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

// ─────────── ENTRY POINTS ───────────

function doGet(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || "getAll";
    var body = {};
    if (p.payload) {
      try { body = JSON.parse(p.payload); } catch(ex) {}
    }
    var result;
    switch (action) {
      case "getAll":    result = _handleGetAll(p); break;
      case "getById":   result = _handleGetById(p); break;
      case "schema":    result = _handleSchema(); break;
      case "insert":    result = _handleInsert(p, body); break;
      case "update":    result = _handleUpdate(p, body); break;
      case "delete":    result = _handleDelete(p, body); break;
      case "bulkWrite": result = _handleBulkWrite(p, body); break;
      default:          result = { ok: false, error: "Action không hợp lệ: " + action };
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
      case "bulkWrite": result = _handleBulkWrite(p, body); break;
      default:          result = { ok: false, error: "Action không hợp lệ: " + action };
    }
    return _cors(result);
  } catch(err) {
    return _cors({ ok: false, error: err.message });
  }
}
