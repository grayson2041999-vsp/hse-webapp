/* =========================================================
   KIỂM TRA — DANH MỤC ĐƠN VỊ (assets/don-vi.js) và việc trang
   Kế hoạch dùng danh mục thay cho danh sách viết cứng.
   Chạy: node tests/don-vi.test.js
   ========================================================= */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── Giả lập môi trường trình duyệt tối thiểu ── */
function freshEnv() {
  const store = {};
  global.localStorage = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
    setItem(k,v){ store[k] = String(v); },
    removeItem(k){ delete store[k]; }
  };
  global.document = { readyState:'complete', addEventListener(){}, createEvent(){ return { initEvent(){} }; } };
  global.window = global;
  global.CustomEvent = function(n,o){ this.type=n; this.detail=o&&o.detail; };
  global.dispatchEvent = function(){};
  global.addEventListener = function(){};
  return store;
}
function loadUnits() {
  const p = path.join(ROOT, 'assets', 'don-vi.js');
  delete require.cache[require.resolve(p)];
  require(p);
  return global.HSE_UNITS;
}
/* Nạp đúng các hàm đơn vị của ke-hoach.html (không cần trình duyệt) */
function loadKeHoachUnitFns() {
  const src = fs.readFileSync(path.join(ROOT, 'ke-hoach.html'), 'utf8');
  const i = src.indexOf('function unitBase()');
  const j = src.indexOf('function toggleMultiKhac(id){');
  if (i < 0 || j < 0) throw new Error('Không tìm thấy khối hàm đơn vị trong ke-hoach.html');
  global.esc = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fn = new Function('esc', 'window', src.slice(i, j) + '; return { unitBase, unitDropdown, unitMultiCheck, unitCanon, unitInBase };');
  return fn(global.esc, global);
}

let pass = 0, fail = 0;
function check(name, cond, got) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (got !== undefined ? '  → ' + JSON.stringify(got) : '')); }
}
const has = (h, n) => String(h).indexOf(n) >= 0;

freshEnv();
let U = loadUnits();
let KH = loadKeHoachUnitFns();

console.log('── Danh mục mặc định khớp hiện trạng đang hard-code ──');
check('ke-hoach: 6 đơn vị (5 đơn vị SX + Phòng Kỹ thuật - Vật tư)', U.list('ke-hoach').length === 6, U.list('ke-hoach'));
check('kiem-tra-cac-cap: 5 đơn vị sản xuất', U.list('kiem-tra-cac-cap').length === 5);
check('huan-luyen-dao-tao: đủ 12 đơn vị chính thức', U.list('huan-luyen-dao-tao').length === 12);
check('cap-phat-bhld: 5 + Bộ máy điều hành + Test', U.list('cap-phat-bhld').length === 7);
check('đơn vị hệ thống chỉ hiện ở trang được gán', U.list('ke-hoach').indexOf('Test') < 0);

console.log('\n── Tra cứu tên (bí danh & chuẩn hoá) ──');
check('tra theo mã', (U.resolve('cang_bien')||{}).ten === 'Cảng biển');
check('gạch ngang DÀI vẫn khớp (lỗi "Phòng Kỹ thuật – Vật tư")', (U.resolve('Phòng Kỹ thuật – Vật tư')||{}).ma === 'p_ky_thuat_vat_tu');
check('thừa khoảng trắng / khác hoa thường vẫn khớp', (U.resolve('  cảng   BIỂN ')||{}).ma === 'cang_bien');
check('tên lạ trả về null', U.resolve('Không tồn tại') === null);
check('label() giữ nguyên chuỗi không tra được', U.label('Nhà thầu ABC') === 'Nhà thầu ABC');

console.log('\n── Bí danh: đổi tên KHÔNG làm mồ côi dữ liệu cũ ──');
const cangBien = JSON.parse(JSON.stringify(U.byMa('cang_bien')));
cangBien.ten_cu = ['Cảng biển'];
cangBien.ten = 'Cảng biển Vietsovpetro';
U.saveUnit(cangBien);
check('bản ghi cũ mang tên cũ vẫn tra ra đúng đơn vị', (U.resolve('Cảng biển')||{}).ma === 'cang_bien');
check('label() quy tên cũ về tên mới', U.label('Cảng biển') === 'Cảng biển Vietsovpetro');

console.log('\n── Sinh mã ổn định ──');
check('bỏ dấu, gạch dưới', U.suggestMa('Phòng Kiểm định & An toàn') === 'phong_kiem_dinh_an_toan');
check('tránh trùng mã đã có', U.suggestMa('Đội xe VCHK') === 'doi_xe_vchk_2');

/* Nạp lại danh mục sạch cho phần sau */
freshEnv(); U = loadUnits(); KH = loadKeHoachUnitFns();

console.log('\n── Trang Kế hoạch: droplist 1 lựa chọn ──');
let d = KH.unitDropdown('x', 'Cảng biển');
check('chọn đúng giá trị trong danh mục', has(d, 'value="Cảng biển" selected'));
check('có placeholder + 6 đơn vị + Khác', (d.match(/<option/g) || []).length === 8);
d = KH.unitDropdown('x', 'XN Cơ khí');
check('giá trị ngoài danh mục → rơi vào "Khác"', has(d, 'value="Khác" selected'));
check('giá trị ngoài danh mục → giữ nguyên chữ trong ô nhập', has(d, 'value="XN Cơ khí"') && has(d, 'display:block'));
d = KH.unitDropdown('x', 'Phòng Kỹ thuật – Vật tư');
check('gạch ngang dài vẫn chọn đúng, không rơi vào "Khác"',
  has(d, 'value="Phòng Kỹ thuật - Vật tư" selected') && !has(d, 'value="Khác" selected'));
d = KH.unitDropdown('x', '');
check('giá trị rỗng → chỉ hiện placeholder', !has(d, 'selected'));

console.log('\n── Trang Kế hoạch: checkbox nhiều lựa chọn ──');
let m = KH.unitMultiCheck('y', ['Cảng biển', 'Xưởng sửa chữa']);
check('tích đúng 2 đơn vị', (m.match(/checked/g) || []).length === 2);
m = KH.unitMultiCheck('y', ['Cảng biển', 'Nhà thầu ABC']);
check('giá trị lạ → tích "Khác" và điền vào ô nhập', has(m, 'value="Khác" checked') && has(m, 'value="Nhà thầu ABC"'));
check('rỗng → không tích ô nào', (KH.unitMultiCheck('y', []).match(/checked/g) || []).length === 0);

console.log('\n── Khi Admin TẮT mục "Khác" (dữ liệu cũ không được phép mất) ──');
const cfg = U.config(); cfg.other['ke-hoach'] = false; U.saveConfig(cfg);
d = KH.unitDropdown('x', 'XN Cơ khí');
check('không còn mục "Khác" trong droplist', !has(d, 'value="Khác"'));
check('giá trị cũ VẪN được giữ và chọn sẵn', has(d, 'value="XN Cơ khí" selected') && has(d, '(không còn dùng)'));
m = KH.unitMultiCheck('y', ['Cảng biển', 'Nhà thầu ABC']);
check('checkbox giá trị cũ vẫn được tích', has(m, 'value="Nhà thầu ABC" checked') && has(m, '(không còn dùng)'));

console.log('\n── Ánh xạ bảng trong db.js ──');
const dbjs = fs.readFileSync(path.join(ROOT, 'assets', 'db.js'), 'utf8');
check('don_vi → bảng "DonVi"', /don_vi:\s*"DonVi"/.test(dbjs));
check('don_vi dùng khoá chính "ma"', /don_vi:\s*"ma"/.test(dbjs));

console.log('\n── Không còn danh sách đơn vị viết cứng ở trang Kế hoạch ──');
const kh = fs.readFileSync(path.join(ROOT, 'ke-hoach.html'), 'utf8');
check('ke-hoach.html không còn UNIT_LIST', !/var\s+UNIT_LIST\s*=/.test(kh));
check('ke-hoach.html không còn tên đơn vị viết cứng', !/"Căn cứ Kho - Giao nhận"/.test(kh));
check('ke-hoach.html có nạp assets/don-vi.js', /assets\/don-vi\.js/.test(kh));

console.log('\n' + (fail === 0 ? '🎉 TẤT CẢ ' + pass + ' KIỂM TRA ĐỀU ĐẠT' : '⚠️  ' + fail + ' lỗi / ' + (pass + fail) + ' kiểm tra'));
process.exit(fail ? 1 : 0);
