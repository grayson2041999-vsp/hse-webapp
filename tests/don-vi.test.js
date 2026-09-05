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

/* ─────────────────────────────────────────────
   TRANG KIỂM TRA CÁC CẤP
   ───────────────────────────────────────────── */
function loadKtccUnitFns() {
  const src = fs.readFileSync(path.join(ROOT, 'kiem-tra-cac-cap.html'), 'utf8');
  const i = src.indexOf('function donViList()');
  const j = src.indexOf('/* Bước 1 → Bước 2');
  if (i < 0 || j < 0) throw new Error('Không tìm thấy khối hàm đơn vị trong kiem-tra-cac-cap.html');
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fn = new Function('esc', 'window', 'document',
    src.slice(i, j) + '; return { donViList, donViAllowOther, donViCanon, donViInList, isKhacDonVi, buildDonViSelect, setDonVi1 };');
  return fn(esc, global, global.document);
}

freshEnv(); U = loadUnits();
/* DOM giả cho droplist Bước 1 */
function fakeSelect() {
  const mk = (value, text) => ({ value, textContent: text, tagName:'OPTION' });
  return {
    _opts: [], value: '', style:{},
    set innerHTML(h) {
      this._opts = [...h.matchAll(/<option(?:\s+value="([^"]*)")?>([^<]*)<\/option>/g)]
        .map(m => mk(m[1] !== undefined ? m[1] : m[2].replace(/&amp;/g,'&'), m[2]));
    },
    get options(){ return this._opts; },
    appendChild(o){ this._opts.push(o); }
  };
}
const KT = (() => {
  const sel = fakeSelect(), inp = { value:'', style:{} };
  global.document = Object.assign({}, global.document, {
    getElementById(id){ return id === 'c12DonViSel' ? sel : (id === 'c12DonViKhac' ? inp : null); },
    createElement(){ return { value:'', textContent:'' }; }
  });
  return { api: loadKtccUnitFns(), sel, inp };
})();

console.log('\n── Kiểm tra các cấp: droplist Bước 1 ──');
KT.api.buildDonViSelect();
check('droplist có 5 đơn vị + placeholder + "Khác"', KT.sel.options.length === 7, KT.sel.options.map(o=>o.value));
check('đúng 5 đơn vị sản xuất', KT.sel.options.slice(1,6).map(o=>o.value).join('|') ===
  'Cảng biển|Căn cứ Kho - Giao nhận|Xưởng sửa chữa|Đội xe VTHH&PTTBCD|Đội xe VCHK', KT.sel.options.map(o=>o.value));
check('mục "Khác" dùng giá trị __khac__', KT.sel.options[6].value === '__khac__');

KT.api.setDonVi1('Cảng biển');
check('setDonVi1 chọn đúng đơn vị trong danh mục', KT.sel.value === 'Cảng biển' && KT.inp.style.display === 'none');
KT.api.setDonVi1('Xí nghiệp Cơ khí');
check('giá trị ngoài danh mục → chuyển sang "Khác" + giữ chữ', KT.sel.value === '__khac__' && KT.inp.value === 'Xí nghiệp Cơ khí');
check('isKhacDonVi nhận đúng đơn vị lạ', KT.api.isKhacDonVi('Xí nghiệp Cơ khí') === true);
check('isKhacDonVi KHÔNG báo nhầm đơn vị trong danh mục', KT.api.isKhacDonVi('Cảng biển') === false);
check('isKhacDonVi xử lý đúng gạch ngang dài', KT.api.isKhacDonVi('Cảng  biển') === false);

console.log('\n── Kiểm tra các cấp: tắt mục "Khác" ──');
{
  const cfg = U.config(); cfg.other['kiem-tra-cac-cap'] = false; U.saveConfig(cfg);
  KT.api.buildDonViSelect();
  check('không còn mục "Khác"', !KT.sel.options.some(o => o.value === '__khac__'));
  KT.api.setDonVi1('Xí nghiệp Cơ khí');
  check('giá trị cũ vẫn được thêm vào droplist và chọn sẵn',
    KT.sel.value === 'Xí nghiệp Cơ khí' && KT.sel.options.some(o => /không còn dùng/.test(o.textContent)));
  const cfg2 = U.config(); cfg2.other['kiem-tra-cac-cap'] = true; U.saveConfig(cfg2);
}

console.log('\n── Không còn danh sách viết cứng ở 2 trang mới ──');
const ktcc = fs.readFileSync(path.join(ROOT, 'kiem-tra-cac-cap.html'), 'utf8');
check('kiem-tra-cac-cap.html: không còn hằng DON_VI_FIXED', !/var\s+DON_VI_FIXED\s*=/.test(ktcc));
check('kiem-tra-cac-cap.html: không còn mảng DON_VI viết cứng', !/var\s+DON_VI\s*=\s*\[\s*"/.test(ktcc));
check('kiem-tra-cac-cap.html: không còn <option> đơn vị viết cứng', !/<option>Cảng biển<\/option>/.test(ktcc));
check('kiem-tra-cac-cap.html: có nạp assets/don-vi.js', /assets\/don-vi\.js/.test(ktcc));

const hldt = fs.readFileSync(path.join(ROOT, 'assets', 'huan-luyen-dao-tao.js'), 'utf8');
check('huan-luyen-dao-tao.js: không còn hằng UNITS', !/var\s+UNITS\s*=\s*\[/.test(hldt));
check('huan-luyen-dao-tao.js: không còn tên đơn vị viết cứng', !/"Phòng Kinh tế - Tổ chức nhân sự"/.test(hldt));
check('huan-luyen-dao-tao.js: có dùng HSE_UNITS', /HSE_UNITS\.list\("huan-luyen-dao-tao"\)/.test(hldt));

console.log('\n── Báo cáo Kiểm tra các cấp không bỏ sót đơn vị cũ ──');
{
  /* Mô phỏng đúng logic dựng danh sách dòng của bảng 1 */
  const donViList = () => U.list('kiem-tra-cac-cap');
  const donViNorm = v => U.norm(v);
  const donViCanon = v => U.label(v);
  const data12 = [
    { donVi: 'Cảng biển' }, { donVi: 'Xí nghiệp Cơ khí' }, { donVi: 'Cảng biển' }
  ];
  const DON_VI = donViList().slice();
  data12.forEach(r => {
    const dv = donViCanon(r.donVi || ''); if (!dv) return;
    if (!DON_VI.some(u => donViNorm(u) === donViNorm(dv))) DON_VI.push(dv);
  });
  check('gộp thêm đơn vị chỉ còn trong dữ liệu cũ', DON_VI.length === 6 && DON_VI[5] === 'Xí nghiệp Cơ khí', DON_VI);
  check('không nhân đôi đơn vị đã có trong danh mục', DON_VI.filter(u => u === 'Cảng biển').length === 1);
}

/* ─────────────────────────────────────────────
   TRANG HUẤN LUYỆN - ĐÀO TẠO
   ───────────────────────────────────────────── */
console.log('\n── Huấn luyện - Đào tạo: droplist đơn vị ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'huan-luyen-dao-tao.js'), 'utf8');
  const i = src.indexOf('function _units()');
  const j = src.indexOf('/* Đổ danh sách vào ô Đơn vị');
  if (i < 0 || j < 0) throw new Error('Không tìm thấy khối hàm đơn vị trong huan-luyen-dao-tao.js');
  const HL = new Function('window',
    src.slice(i, j) + '; return { _units, _unitCanon, _unitInList, _unitOpts };')(global);

  check('lấy đủ 12 đơn vị từ danh mục', HL._units().length === 12);
  check('_unitOpts cho dòng thêm mới = đúng 12 mục', HL._unitOpts('').length === 12);
  check('_unitOpts giữ đơn vị không còn trong danh mục',
    HL._unitOpts('Xí nghiệp Cơ khí').length === 13 &&
    /không còn dùng/.test(HL._unitOpts('Xí nghiệp Cơ khí')[12].t));
  check('_unitOpts KHÔNG nhân đôi đơn vị đang có', HL._unitOpts('Cảng biển').length === 12);
  check('_unitCanon quy tên cũ về tên hiện hành (sau khi Admin đổi tên)', (() => {
    const u = JSON.parse(JSON.stringify(U.byMa('doi_xe_vchk')));
    u.ten_cu = ['Đội xe VCHK']; u.ten = 'Đội xe vận chuyển hành khách';
    U.saveUnit(u);
    const ok = HL._unitCanon('Đội xe VCHK') === 'Đội xe vận chuyển hành khách'
            && HL._unitOpts('Đội xe VCHK').length === 12;   // vẫn khớp, không thêm dòng "không còn dùng"
    u.ten = 'Đội xe VCHK'; u.ten_cu = []; U.saveUnit(u);    // trả lại
    return ok;
  })());

  /* Thứ tự gom nhóm theo đơn vị */
  const k = src.indexOf('function _unitIndex(');
  const m = src.indexOf('/* Lọc nhân sự theo loại');
  const HL2 = new Function('window', '_units', '_unitNorm',
    src.slice(k, m) + '; return _unitIndex;')(global, HL._units, v => U.norm(v));
  check('_unitIndex trả đúng vị trí theo danh mục', HL2('Cảng biển') === 7, HL2('Cảng biển'));
  check('_unitIndex đẩy đơn vị lạ xuống cuối', HL2('Xí nghiệp Cơ khí') === 13);
  check('_unitIndex bỏ qua khác biệt gạch ngang / hoa thường', HL2('phòng kỹ thuật – vật tư') === 1);
}

console.log('\n' + (fail === 0 ? '🎉 TẤT CẢ ' + pass + ' KIỂM TRA ĐỀU ĐẠT' : '⚠️  ' + fail + ' lỗi / ' + (pass + fail) + ' kiểm tra'));
process.exit(fail ? 1 : 0);
