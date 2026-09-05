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
check('ke-hoach: 9 mục (6 đơn vị + Công đoàn + 2 mục gộp)', U.list('ke-hoach').length === 9, U.list('ke-hoach'));
check('ke-hoach: loại mục gộp ra thì còn 7 đơn vị thật',
  U.list('ke-hoach', { excludeGop: true }).length === 7, U.list('ke-hoach', { excludeGop: true }));
check('kiem-tra-cac-cap: 5 đơn vị sản xuất', U.list('kiem-tra-cac-cap').length === 5);
check('huan-luyen-dao-tao: 12 đơn vị chính thức + Công đoàn', U.list('huan-luyen-dao-tao').length === 13);
check('cap-phat-bhld: 5 + Bộ máy điều hành + Test', U.list('cap-phat-bhld').length === 7);
check('đơn vị hệ thống chỉ hiện ở trang được gán', U.list('ke-hoach').indexOf('Test') < 0);

console.log('\n── Mục gộp (không phải đơn vị thật) ──');
{
  const gop = U.all().filter(u => u.muc_gop);
  check('có 2 mục gộp trong danh mục', gop.length === 2, gop.map(u => u.ten));
  check('mục gộp hiện trong droplist Kế hoạch',
    U.list('ke-hoach').indexOf('Tất cả các ĐVSX') >= 0);
  check('mục gộp KHÔNG lọt vào chỗ đếm theo đơn vị',
    U.list('ke-hoach', { excludeGop: true }).indexOf('Tất cả các ĐVSX') < 0);
  check('mục gộp không xuất hiện ở trang Cấp phát BHLĐ',
    U.list('cap-phat-bhld').every(n => !/^Tất cả/.test(n)));
  check('tên mục gộp khớp ĐÚNG chuỗi đang có trong dữ liệu (không phải sửa bản ghi)',
    U.resolve('Tất cả các ĐVSX') && U.resolve('Tất cả đơn vị/phòng/ban') ? true : false);
  check('Công đoàn đã thành đơn vị thật', (U.resolve('Công đoàn') || {}).ma === 'cong_doan');
  check('maOf() trả mã ổn định để làm khoá', U.maOf('Cảng biển') === 'cang_bien');
  check('maOf() với tên lạ vẫn cho khoá duy nhất', U.maOf('Xí nghiệp Cơ khí') === 'xí_nghiệp_cơ_khí');
}

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
check('có placeholder + 9 mục + Khác', (d.match(/<option/g) || []).length === 11);
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

  check('lấy đủ 13 mục từ danh mục', HL._units().length === 13);
  check('_unitOpts cho dòng thêm mới = đúng 13 mục', HL._unitOpts('').length === 13);
  check('_unitOpts giữ đơn vị không còn trong danh mục',
    HL._unitOpts('Xí nghiệp Cơ khí').length === 14 &&
    /không còn dùng/.test(HL._unitOpts('Xí nghiệp Cơ khí')[13].t));
  check('_unitOpts KHÔNG nhân đôi đơn vị đang có', HL._unitOpts('Cảng biển').length === 13);
  check('_unitCanon quy tên cũ về tên hiện hành (sau khi Admin đổi tên)', (() => {
    const u = JSON.parse(JSON.stringify(U.byMa('doi_xe_vchk')));
    u.ten_cu = ['Đội xe VCHK']; u.ten = 'Đội xe vận chuyển hành khách';
    U.saveUnit(u);
    const ok = HL._unitCanon('Đội xe VCHK') === 'Đội xe vận chuyển hành khách'
            && HL._unitOpts('Đội xe VCHK').length === 13;   // vẫn khớp, không thêm dòng "không còn dùng"
    u.ten = 'Đội xe VCHK'; u.ten_cu = []; U.saveUnit(u);    // trả lại
    return ok;
  })());

  /* Thứ tự gom nhóm theo đơn vị */
  const k = src.indexOf('function _unitIndex(');
  const m = src.indexOf('/* Lọc nhân sự theo loại');
  const HL2 = new Function('window', '_units', '_unitNorm',
    src.slice(k, m) + '; return _unitIndex;')(global, HL._units, v => U.norm(v));
  check('_unitIndex trả đúng vị trí theo danh mục', HL2('Cảng biển') === 7, HL2('Cảng biển'));
  check('_unitIndex đẩy đơn vị lạ xuống cuối', HL2('Xí nghiệp Cơ khí') === 14);
  check('_unitIndex bỏ qua khác biệt gạch ngang / hoa thường', HL2('phòng kỹ thuật – vật tư') === 1);
}

/* ─────────────────────────────────────────────
   TRANG CẤP PHÁT BHLĐ
   ───────────────────────────────────────────── */
console.log('\n── Cấp phát BHLĐ: đơn vị & khoá tiến trình ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'cap-phat-bhld.html'), 'utf8');
  const i = src.indexOf('function unitOrder()');
  const j = src.indexOf('/* Icon Lucide (SVG path)');
  if (i < 0 || j < 0) throw new Error('Không tìm thấy khối hàm đơn vị trong cap-phat-bhld.html');
  const CP = new Function('window',
    src.slice(i, j) + '; return { unitOrder, _uMa, _uCanon, _uSame, _cpUnitRank, _uInOrder };')(global);

  check('7 đơn vị cấp phát, không lẫn mục gộp', CP.unitOrder().length === 7, CP.unitOrder());
  check('không có "Tất cả..." trong đơn vị cấp phát', CP.unitOrder().every(u => !/^Tất cả/.test(u)));
  check('giữ đúng thứ tự danh mục', CP._cpUnitRank('Cảng biển') === 0 && CP._cpUnitRank('Test') === 6,
    [CP._cpUnitRank('Cảng biển'), CP._cpUnitRank('Test')]);
  check('đơn vị lạ bị đẩy xuống cuối', CP._cpUnitRank('Xí nghiệp Cơ khí') === 999);
  check('_uSame bỏ qua khác biệt khoảng trắng / hoa thường', CP._uSame('Cảng  BIỂN', 'Cảng biển'));
  check('_uSame bỏ qua gạch ngang dài', CP._uSame('Phòng Kỹ thuật – Vật tư', 'Phòng Kỹ thuật - Vật tư'));

  /* Khoá tiến trình cấp phát: TÊN → MÃ */
  const key    = dv => CP._uMa(dv) + '__' + 'Q3/2026';
  const keyCu  = dv => dv + '__' + 'Q3/2026';
  check('khoá tiến trình dùng mã ổn định', key('Cảng biển') === 'cang_bien__Q3/2026');
  check('khoá mới KHÁC khoá cũ (nên cần bước tự chuyển)', key('Cảng biển') !== keyCu('Cảng biển'));
  check('đổi tên đơn vị KHÔNG làm đổi khoá', (() => {
    const u = JSON.parse(JSON.stringify(U.byMa('cang_bien')));
    u.ten_cu = ['Cảng biển']; u.ten = 'Cảng biển Vietsovpetro'; U.saveUnit(u);
    const sau = key('Cảng biển Vietsovpetro');
    const cu  = key('Cảng biển');           // tên cũ vẫn tra ra đúng mã
    u.ten = 'Cảng biển'; u.ten_cu = []; U.saveUnit(u);
    return sau === 'cang_bien__Q3/2026' && cu === 'cang_bien__Q3/2026';
  })());
  check('tên lạ vẫn cho khoá duy nhất, không đụng nhau',
    CP._uMa('Xí nghiệp A') !== CP._uMa('Xí nghiệp B'));

  /* Nhu cầu mua sắm: loại đơn vị Test */
  const k = src.indexOf('function nhuCauUnits()');
  const NC = new Function('unitOrder', '_uMa', src.slice(k, src.indexOf('function initNhuCauPage')) + '; return nhuCauUnits;')(CP.unitOrder, CP._uMa);
  check('nhu cầu mua sắm loại đơn vị Test', NC().length === 6 && NC().indexOf('Test') < 0, NC());
  check('nhu cầu mua sắm GIỮ Bộ máy điều hành', NC().indexOf('Bộ máy điều hành') >= 0);
}

console.log('\n── Không còn danh sách viết cứng ở Cấp phát BHLĐ ──');
{
  const cpb = fs.readFileSync(path.join(ROOT, 'cap-phat-bhld.html'), 'utf8');
  check('không còn hằng UNIT_ORDER', !/const\s+UNIT_ORDER\s*=/.test(cpb));
  check('không còn hằng NHUCAU_UNITS', !/const\s+NHUCAU_UNITS\s*=/.test(cpb));
  check('không còn bảng icon theo tên đơn vị', !/'Đội xe VTHH&PTTBCD':'🚛'/.test(cpb));
  check('có nạp assets/don-vi.js', /assets\/don-vi\.js/.test(cpb));
  check('khoá tiến trình đã dùng mã', /_cpwKey\(dv,q\)\{return _uMa\(dv\)/.test(cpb));
  check('vẫn giữ đường đọc khoá cũ để tự chuyển', /_cpwKeyCu/.test(cpb));

  const appjs = fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8');
  check('app.js không còn hằng CAP_PHAT_UNITS', !/CAP_PHAT_UNITS/.test(appjs));
  check('app.js lấy đơn vị cấp phát từ danh mục', /HSE_UNITS\.list\("cap-phat-bhld"/.test(appjs));
}

console.log('\n── Bình áp lực: cờ môi chất phải là boolean thật ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'binh-ap-luc.js'), 'utf8');
  const i = src.indexOf('function _toBool(');
  const j = src.indexOf('/* ── LOCAL STORAGE ── */');
  const T = new Function(src.slice(i, j) + '; return { _toBool, _fixBools };')();

  check('chuỗi "false" từ server → false (LỖI GỐC)', T._toBool('false') === false);
  check('"FALSE" / " False " cũng → false', T._toBool('FALSE') === false && T._toBool(' False ') === false);
  check('chuỗi rỗng → false', T._toBool('') === false && T._toBool('   ') === false);
  check('"0" và số 0 → false', T._toBool('0') === false && T._toBool(0) === false);
  check('null / undefined → false', T._toBool(null) === false && T._toBool(undefined) === false);
  check('"không" → false', T._toBool('không') === false);
  check('chuỗi "true" → true', T._toBool('true') === true && T._toBool('TRUE') === true);
  check('boolean thật giữ nguyên', T._toBool(true) === true && T._toBool(false) === false);
  check('"x" (tick kiểu bảng tính) → true', T._toBool('x') === true);

  const r = T._fixBools({ moi_chat_an_mon: 'false', moi_chat_chay_no: 'true' });
  check('_fixBools ép cả hai cờ', r.moi_chat_an_mon === false && r.moi_chat_chay_no === true);

  check('_load() ép kiểu ngay ở cửa vào', /return Array\.isArray\(arr\) \? arr\.map\(_fixBools\)/.test(src));
  check('_normalizeRow (đường pull từ server) cũng ép kiểu', /return _fixBools\(row\);/.test(src));

  /* Hệ quả nặng nhất: chu kỳ kiểm định bị rút ngắn */
  const k = src.indexOf('function _calcNextDate(');
  const m = src.indexOf('/* ── TRẠNG THÁI KIỂM ĐỊNH ── */');
  const CALC = new Function('HSEDate', src.slice(k, m) + '; return _calcNextDate;')({
    parse: v => new Date(v)
  });
  const nam = new Date().getFullYear() - 5;   // thiết bị 5 tuổi → chu kỳ 3 năm
  const binhThuong = CALC('2024-06-15', nam, false, false);
  const chuoiFalse = CALC('2024-06-15', nam, 'false', 'false');
  check('bình thường: chu kỳ 3 năm', binhThuong.slice(0, 4) === '2027', binhThuong);
  check('nếu KHÔNG ép kiểu, "false" rút chu kỳ còn 2 năm (bằng chứng lỗi)',
    chuoiFalse.slice(0, 4) === '2026', chuoiFalse);
  check('sau khi ép kiểu thì ra đúng 3 năm',
    CALC('2024-06-15', nam, T._toBool('false'), T._toBool('false')) === binhThuong);
}

console.log('\n── Bình áp lực: hai biểu đồ tròn ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'binh-ap-luc.js'), 'utf8');
  const i = src.indexOf('var CHART_MAU_DONVI');
  const j = src.indexOf('/* Một biểu đồ tròn:');
  let store = [];
  const CH = new Function('_load', '_unitRank', '_unitLabel', '_kdStatus', '_nextDateOf',
    src.slice(i, j) + '; return { _chartData, CHART_MAU_DONVI, CHART_MAU_TT };'
  )(() => store,
    k => ({ cang_bien: 0, xuong_sua_chua: 1, can_cu_kho_gn: 2, d4: 3, d5: 4, d6: 5 }[k] ?? 999),
    k => ({ cang_bien: 'Cảng biển', xuong_sua_chua: 'Xưởng sửa chữa', can_cu_kho_gn: 'Căn cứ Kho' }[k] || k),
    d => d ? ({ a: { cls: 'kd-con-han' }, b: { cls: 'kd-sap-han' }, c: { cls: 'kd-qua-han' } }[d] || null) : null,
    r => r.kd || '');

  /* Màu trạng thái phải TRÙNG màu badge trong bảng, để nối được hai chỗ */
  check('màu "Còn hạn" khớp .kd-con-han (#1a7a3c)', CH.CHART_MAU_TT['con-han'] === '#1a7a3c');
  check('màu "Sắp hạn" khớp .kd-sap-han (#e68900)', CH.CHART_MAU_TT['sap-han'] === '#e68900');
  check('màu "Quá hạn" khớp .kd-qua-han (#c0392b)', CH.CHART_MAU_TT['qua-han'] === '#c0392b');
  check('mỗi màu badge đều có mặt trong CSS của bảng',
    /\.kd-con-han\{[^"]*#1a7a3c/.test(src) && /\.kd-sap-han\{[^"]*#e68900/.test(src) && /\.kd-qua-han\{[^"]*#c0392b/.test(src));

  /* Bảng màu phân loại: đúng 4 màu đã qua validate_palette (all-pairs, nền trắng) */
  /* Pastel đổi lấy số lượng: mức nhạt tối đa còn qua kiểm tra chỉ cho 3 màu */
  check('chỉ 3 màu pastel — quá ngưỡng an toàn thì gộp "Khác"', CH.CHART_MAU_DONVI.length === 3);
  check('màu đơn vị đúng bộ pastel đã dò',
    CH.CHART_MAU_DONVI.join(',') === '#6fa4e3,#f29976,#65c9a5', CH.CHART_MAU_DONVI);

  store = [
    { section: 'cang_bien', kd: 'a' }, { section: 'cang_bien', kd: 'a' },
    { section: 'xuong_sua_chua', kd: 'b' }, { section: 'can_cu_kho_gn', kd: 'c' }
  ];
  let d = CH._chartData();
  check('đếm đúng số thiết bị mỗi đơn vị', d.donVi.map(x => x.giaTri).join(',') === '2,1,1', d.donVi);
  check('giữ thứ tự đơn vị theo danh mục', d.donVi[0].nhan === 'Cảng biển');
  check('gán màu theo đúng thứ tự bảng màu', d.donVi[0].mau === '#6fa4e3' && d.donVi[1].mau === '#f29976');
  check('đếm đúng từng trạng thái',
    d.trangThai.map(x => x.nhan + '=' + x.giaTri).join(',') === 'Còn hạn=2,Sắp hạn (≤60 ngày)=1,Quá hạn=1', d.trangThai);
  check('bỏ hẳn trạng thái không có thiết bị nào (không vẽ lát 0%)',
    !d.trangThai.some(x => x.giaTri === 0));

  /* Quá 4 đơn vị → gộp phần đuôi, KHÔNG sinh thêm màu mới */
  store = ['cang_bien','xuong_sua_chua','can_cu_kho_gn','d4','d5','d6'].map(s => ({ section: s, kd: 'a' }));
  d = CH._chartData();
  check('quá 3 đơn vị thì gộp thành 4 lát (3 + Khác)', d.donVi.length === 4, d.donVi.map(x => x.nhan));
  check('lát cuối là "Khác" và cộng dồn đúng',
    /^Khác \(3 đơn vị\)$/.test(d.donVi[3].nhan) && d.donVi[3].giaTri === 3, d.donVi[3]);
  check('"Khác" dùng màu xám trung tính, không phải màu phân loại mới',
    d.donVi[3].mau === '#c3ccd8' && CH.CHART_MAU_DONVI.indexOf(d.donVi[3].mau) < 0);

  /* Thiết bị chưa có ngày kiểm định vẫn phải được đếm */
  store = [{ section: 'cang_bien', kd: '' }, { section: 'cang_bien', kd: 'a' }];
  d = CH._chartData();
  check('thiết bị chưa có ngày KĐ vào nhóm riêng, không bị bỏ sót',
    d.trangThai.some(x => x.nhan === 'Chưa có ngày KĐ' && x.giaTri === 1), d.trangThai);
  check('tổng các lát = tổng thiết bị',
    d.trangThai.reduce((s, x) => s + x.giaTri, 0) === d.tong && d.tong === 2);

  store = [];
  check('không có thiết bị thì không vẽ biểu đồ', CH._chartData().tong === 0);

  /* Màu không được là kênh thông tin duy nhất */
  check('có nhãn % ngay trên lát cắt', /Math\.round\(phan \* 100\) \+ '%<\/text>'/.test(src));
  check('chú giải luôn kèm tên và số liệu', /bal-lg-name|bal-lg-val/.test(src));
  check('mỗi lát có tooltip mô tả bằng chữ', /<title>' \+ _esc\(m\.nhan\)/.test(src));
}

console.log('\n── Bình áp lực: ngày KĐ tiếp theo sửa tay được ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'binh-ap-luc.js'), 'utf8');
  const k = src.indexOf('function _calcNextDate(');
  const m = src.indexOf('/* ── TRẠNG THÁI KIỂM ĐỊNH ── */');
  const M = new Function('HSEDate', src.slice(k, m) + '; return { _calcNextDate, _nextDateOf };')({
    parse: v => new Date(v)
  });
  const nam = new Date().getFullYear() - 5;   // 5 tuổi → chu kỳ 3 năm

  const tuTinh = { ngay_kd_gan_nhat: '2024-06-15', nam_van_hanh: nam,
                   moi_chat_an_mon: false, moi_chat_chay_no: false,
                   ngay_kd_tiep_theo: '2030-01-01', ngay_kd_tu_chinh: false };
  check('chưa sửa tay → BỎ QUA giá trị đang lưu, tính lại theo công thức',
    M._nextDateOf(tuTinh).slice(0, 4) === '2027', M._nextDateOf(tuTinh));

  const suaTay = Object.assign({}, tuTinh, { ngay_kd_tu_chinh: true });
  check('đã sửa tay → giữ đúng ngày người dùng nhập',
    M._nextDateOf(suaTay) === '2030-01-01', M._nextDateOf(suaTay));

  const suaTayRong = Object.assign({}, tuTinh, { ngay_kd_tu_chinh: true, ngay_kd_tiep_theo: '' });
  check('đã sửa tay nhưng để trống → quay về ngày tự tính',
    M._nextDateOf(suaTayRong).slice(0, 4) === '2027');

  check('đổi ngày KĐ gần nhất: bản tự tính đi theo, bản sửa tay không',
    M._nextDateOf(Object.assign({}, tuTinh, { ngay_kd_gan_nhat: '2025-06-15' })).slice(0, 4) === '2028' &&
    M._nextDateOf(Object.assign({}, suaTay, { ngay_kd_gan_nhat: '2025-06-15' })) === '2030-01-01');

  check('cờ tự chỉnh cũng được ép kiểu boolean (tránh bẫy chuỗi "false")',
    /r\.ngay_kd_tu_chinh = _toBool\(r\.ngay_kd_tu_chinh\)/.test(src));
  check('form có ô nhập ngày KĐ tiếp theo', /id="bal-inp-ngaykdtt"/.test(src));
  check('form có nút quay lại ngày tự tính', /id="bal-btn-dungtutinh"/.test(src));
  check('bảng đánh dấu bản ghi sửa tay', /ngay_kd_tu_chinh \? ' <span title="Ngày do người dùng tự nhập/.test(src));
  check('lưu kèm cờ tự chỉnh', /ngay_kd_tu_chinh:\s+_tuChinh/.test(src));

  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'binh_ap_luc_tu_chinh.sql'), 'utf8');
  check('có SQL thêm cột, mặc định false cho bản ghi cũ',
    /add column if not exists ngay_kd_tu_chinh boolean not null default false/.test(sql));
}

console.log('\n── Bình áp lực: một bảng, đơn vị là một cột ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'binh-ap-luc.js'), 'utf8');
  const i = src.indexOf('function _units()');
  const j = src.indexOf('/* ── STATE ──');
  if (i < 0 || j < 0) throw new Error('Không tìm thấy _units() trong binh-ap-luc.js');
  let store = [];
  const BAL = new Function('window', '_load', '_kdStatus', '_nextDateOf',
    src.slice(i, j) + '; return { _units, _unitLabel, _unitRank, _rowsSorted, _ttLabel };')(
    global, () => store,
    d => d ? ({ x: { cls: 'kd-con-han' }, y: { cls: 'kd-sap-han' }, z: { cls: 'kd-qua-han' } }[d] || null) : null,
    r => r.kd || '');

  check('2 đơn vị mặc định trong droplist', BAL._units().length === 2, BAL._units().map(o => o.key));
  check('key = MÃ đơn vị (khớp dữ liệu cũ, không phải chuyển đổi)',
    BAL._units().map(o => o.key).join(',') === 'cang_bien,xuong_sua_chua', BAL._units().map(o => o.key));
  check('nhãn lấy từ tên trong danh mục',
    BAL._unitLabel('cang_bien') === 'Cảng biển' && BAL._unitLabel('xuong_sua_chua') === 'Xưởng sửa chữa');

  check('đổi tên đơn vị chỉ đổi NHÃN, key giữ nguyên', (() => {
    const u = JSON.parse(JSON.stringify(U.byMa('cang_bien')));
    u.ten_cu = ['Cảng biển']; u.ten = 'Cảng biển VSP'; U.saveUnit(u);
    const r = BAL._units()[0];
    u.ten = 'Cảng biển'; u.ten_cu = []; U.saveUnit(u);
    return r.key === 'cang_bien' && r.label === 'Cảng biển VSP';
  })());

  /* Thiết bị thuộc đơn vị đã bỏ tích vẫn phải hiện ra và sửa lại được */
  store = [{ id: 'x1', section: 'can_cu_kho_gn' }];
  const us = BAL._units();
  check('giữ đơn vị chỉ còn trong dữ liệu', us.length === 3 && us[2].key === 'can_cu_kho_gn', us.map(o => o.key));
  check('đánh dấu rõ đơn vị không còn dùng', /không còn dùng/.test(us[2].label));

  /* Sắp xếp: gom theo đơn vị rồi theo thứ tự kéo–thả trong đơn vị */
  store = [
    { id: 'a', section: 'xuong_sua_chua', order: 1 },
    { id: 'b', section: 'cang_bien',      order: 1 },
    { id: 'c', section: 'cang_bien',      order: 0 },
    { id: 'd', section: 'can_cu_kho_gn',  order: 0 }
  ];
  check('gom theo đơn vị rồi theo thứ tự trong đơn vị',
    BAL._rowsSorted().map(r => r.id).join('') === 'cbad', BAL._rowsSorted().map(r => r.id).join(''));
  check('đơn vị không còn trong danh mục xếp cuối', BAL._unitRank('can_cu_kho_gn') === 2);
  check('đơn vị lạ hoàn toàn xếp cuối cùng', BAL._unitRank('khong_co') === 999);
  check('lọc theo một đơn vị', BAL._rowsSorted('cang_bien').map(r => r.id).join('') === 'cb');

  /* Lọc theo hạn kiểm định ngay tại cột "Ngày KĐ tiếp theo" */
  store = [
    { id: 'p', section: 'cang_bien',      order: 0, kd: 'x' },   // còn hạn
    { id: 'q', section: 'cang_bien',      order: 1, kd: 'y' },   // sắp hạn
    { id: 'r', section: 'cang_bien',      order: 2, kd: 'z' },   // quá hạn
    { id: 's', section: 'xuong_sua_chua', order: 0, kd: 'z' },   // quá hạn, đơn vị khác
    { id: 't', section: 'cang_bien',      order: 3 }             // chưa có ngày KĐ
  ];
  check('lọc Còn hạn', BAL._rowsSorted('', 'con-han').map(r => r.id).join('') === 'p');
  check('lọc Sắp hạn', BAL._rowsSorted('', 'sap-han').map(r => r.id).join('') === 'q');
  check('lọc Quá hạn lấy đủ mọi đơn vị', BAL._rowsSorted('', 'qua-han').map(r => r.id).join('') === 'rs',
    BAL._rowsSorted('', 'qua-han').map(r => r.id).join(''));
  check('thiết bị chưa có ngày KĐ lọc được riêng, không lẫn vào Còn hạn',
    BAL._rowsSorted('', 'chua-co').map(r => r.id).join('') === 't');
  check('lọc chồng trạng thái với đơn vị',
    BAL._rowsSorted('cang_bien', 'qua-han').map(r => r.id).join('') === 'r');
  check('không lọc trạng thái thì lấy hết', BAL._rowsSorted().length === 5);
  check('nhãn trạng thái dùng chung cho chip và droplist', BAL._ttLabel('sap-han') === 'Sắp hạn (≤60 ngày)');
  store = [];

  check('không còn nhiều bảng theo section', !/function\s+_buildSection\s*\(/.test(src));
  check('không còn hàm _renderSections', !/function\s+_renderSections\s*\(/.test(src));
  check('có cột "Đơn vị quản lý" trong bảng',
    src.includes(`"<th class='col-donvi'>" + _thFilterDonVi()`));
  check('có droplist đơn vị trong form thêm\/sửa', /id="bal-inp-donvi"/.test(src));
  check('bộ lọc đơn vị nằm ngay tiêu đề cột',
    /_thFilter\("Đơn vị quản lý", "bal-filter-unit"/.test(src) &&
    /thead.querySelector\("#bal-filter-unit"\)/.test(src));
  check('bộ lọc hạn kiểm định nằm ngay tiêu đề cột Ngày KĐ tiếp theo',
    src.includes(`"<th class='col-kdtt'>" + _thFilterTT()`) &&
    /thead.querySelector\("#bal-filter-tt"\)/.test(src));
  check('khoá trạng thái khớp class badge trong bảng (không thể lệch nhau)',
    /st\.cls\.replace\("kd-", ""\)/.test(src) && /key: "qua-han"/.test(src));
  check('xuất Excel tôn trọng cả hai bộ lọc', /_rowsSorted\(_filterUnit, _filterTT\)/.test(src));
  check('kéo–thả vẫn giới hạn trong cùng đơn vị',
    /_dragging\.dataset\.sec !== tr\.dataset\.sec/.test(src));

  const bctd = fs.readFileSync(path.join(ROOT, 'bao-chay-tu-dong.html'), 'utf8');
  check('chữ ký Word không còn tên phòng viết cứng', !/run\("Phòng Kỹ thuật/.test(bctd));
  check('chữ ký Word tra theo mã ổn định', /PHONG_KY_TAT_MA\s*=\s*"p_ky_thuat_vat_tu"/.test(bctd));
  check('Bình áp lực và Thiết bị nâng là điểm sử dụng thứ 5 và 6',
    U.PAGES.length === 6 && U.PAGES[4].slug === 'binh-ap-luc' && U.PAGES[5].slug === 'thiet-bi-nang',
    U.PAGES.map(p => p.slug));
}

console.log('\n── Thiết bị nâng: bảng mới trong Quản lý thiết bị ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'thiet-bi-nang.js'), 'utf8');
  const i = src.indexOf('var LS_KEY');
  const j = src.indexOf('/* ── STATE ──');
  if (i < 0 || j < 0) throw new Error('Không tìm thấy phần đơn vị trong thiet-bi-nang.js');
  let store = [];
  const TBN = new Function('window', '_load', '_kdStatus', '_nextDateOf',
    src.slice(i, j) + '; return { _units, _unitLabel, _unitRank, _loaiDangCo, _rowsSorted, _ttLabel };')(
    global, () => store,
    d => d ? ({ x: { cls: 'kd-con-han' }, y: { cls: 'kd-sap-han' }, z: { cls: 'kd-qua-han' } }[d] || null) : null,
    r => r.kd || '');

  /* Chưa Admin tích ô nào thì bảng phải nói rõ là chưa có đơn vị,
     KHÔNG được tự mượn danh sách của trang khác. */
  check('chưa tích đơn vị nào thì droplist rỗng', TBN._units().length === 0, TBN._units());

  const ganTrang = (ma, them) => {
    const u = JSON.parse(JSON.stringify(U.byMa(ma)));
    const ps = (u.pages || []).filter(x => x !== 'thiet-bi-nang');
    u.pages = them ? ps.concat(['thiet-bi-nang']) : ps;
    U.saveUnit(u);
  };
  ganTrang('cang_bien', true); ganTrang('xuong_sua_chua', true);
  check('Admin tích ở danh mục là bảng có ngay đơn vị đó',
    TBN._units().map(o => o.key).join(',') === 'cang_bien,xuong_sua_chua', TBN._units().map(o => o.key));
  check('nhãn lấy từ tên trong danh mục', TBN._unitLabel('cang_bien') === 'Cảng biển');

  store = [
    { id: 'a', section: 'xuong_sua_chua', order: 1, loai_thiet_bi: 'Palăng'   },
    { id: 'b', section: 'cang_bien',      order: 1, loai_thiet_bi: 'Cầu trục' },
    { id: 'c', section: 'cang_bien',      order: 0, loai_thiet_bi: 'Palăng'   },
    { id: 'd', section: 'can_cu_kho_gn',  order: 0, loai_thiet_bi: 'Xe nâng'  }
  ];
  check('giữ đơn vị chỉ còn trong dữ liệu', TBN._units().length === 3 && /không còn dùng/.test(TBN._units()[2].label));
  check('gom theo đơn vị rồi theo thứ tự trong đơn vị',
    TBN._rowsSorted().map(r => r.id).join('') === 'cbad', TBN._rowsSorted().map(r => r.id).join(''));
  check('lọc theo đơn vị', TBN._rowsSorted('cang_bien').map(r => r.id).join('') === 'cb');
  check('lọc theo loại thiết bị', TBN._rowsSorted('', 'Palăng').map(r => r.id).join('') === 'ca');
  check('lọc chồng cả đơn vị lẫn loại', TBN._rowsSorted('cang_bien', 'Palăng').map(r => r.id).join('') === 'c');

  /* Lọc theo hạn kiểm định ngay tại cột "Ngày KĐ&TT tiếp theo" */
  store = [
    { id: 'p', section: 'cang_bien',      order: 0, kd: 'x' },   // còn hạn
    { id: 'q', section: 'cang_bien',      order: 1, kd: 'y' },   // sắp hạn
    { id: 'r', section: 'cang_bien',      order: 2, kd: 'z' },   // quá hạn
    { id: 's', section: 'xuong_sua_chua', order: 0, kd: 'z' },   // quá hạn, đơn vị khác
    { id: 't', section: 'cang_bien',      order: 3 }             // chưa có ngày KĐ
  ];
  check('lọc Còn hạn',  TBN._rowsSorted('', '', 'con-han').map(r => r.id).join('') === 'p');
  check('lọc Sắp hạn',  TBN._rowsSorted('', '', 'sap-han').map(r => r.id).join('') === 'q');
  check('lọc Quá hạn lấy đủ mọi đơn vị', TBN._rowsSorted('', '', 'qua-han').map(r => r.id).join('') === 'rs',
    TBN._rowsSorted('', '', 'qua-han').map(r => r.id).join(''));
  check('thiết bị chưa có ngày KĐ lọc được riêng, không lẫn vào Còn hạn',
    TBN._rowsSorted('', '', 'chua-co').map(r => r.id).join('') === 't');
  check('lọc chồng trạng thái với đơn vị',
    TBN._rowsSorted('cang_bien', '', 'qua-han').map(r => r.id).join('') === 'r');
  check('không lọc trạng thái thì lấy hết', TBN._rowsSorted().length === 5);
  check('nhãn trạng thái dùng chung cho chip và droplist', TBN._ttLabel('qua-han') === 'Quá hạn');

  store = [
    { id: 'a', section: 'xuong_sua_chua', order: 1, loai_thiet_bi: 'Palăng'   },
    { id: 'b', section: 'cang_bien',      order: 1, loai_thiet_bi: 'Cầu trục' },
    { id: 'c', section: 'cang_bien',      order: 0, loai_thiet_bi: 'Palăng'   },
    { id: 'd', section: 'can_cu_kho_gn',  order: 0, loai_thiet_bi: 'Xe nâng'  }
  ];
  check('droplist loại chỉ liệt kê loại đang có, theo thứ tự danh mục',
    TBN._loaiDangCo().join(',') === 'Cầu trục,Palăng,Xe nâng', TBN._loaiDangCo());
  store = [];

  /* Chu kỳ kiểm định & thử tải: 1 năm, sửa tay được */
  const k = src.indexOf('function _calcNextDate(');
  const m = src.indexOf('/* ── TRẠNG THÁI KIỂM ĐỊNH ── */');
  const M = new Function('HSEDate', 'CHU_KY_NAM',
    src.slice(k, m) + '; return { _calcNextDate, _nextDateOf };')({ parse: v => new Date(v) }, 1);

  check('chu kỳ 1 năm kể từ ngày KĐ&TT gần nhất',
    M._calcNextDate('2025-06-15') === '2026-06-15', M._calcNextDate('2025-06-15'));
  check('chưa có ngày gần nhất thì không bịa ngày tiếp theo', M._calcNextDate('') === '');
  check('chưa sửa tay → BỎ QUA giá trị đang lưu, tính lại',
    M._nextDateOf({ ngay_kd_gan_nhat: '2025-06-15', ngay_kd_tiep_theo: '2030-01-01',
                    ngay_kd_tu_chinh: false }) === '2026-06-15');
  check('đã sửa tay → giữ đúng ngày người dùng nhập',
    M._nextDateOf({ ngay_kd_gan_nhat: '2025-06-15', ngay_kd_tiep_theo: '2030-01-01',
                    ngay_kd_tu_chinh: true }) === '2030-01-01');
  check('đã sửa tay nhưng để trống → quay về ngày tự tính',
    M._nextDateOf({ ngay_kd_gan_nhat: '2025-06-15', ngay_kd_tiep_theo: '',
                    ngay_kd_tu_chinh: true }) === '2026-06-15');
  check('cờ tự chỉnh được ép kiểu boolean (tránh bẫy chuỗi "false")',
    /r\.ngay_kd_tu_chinh = _toBool\(r\.ngay_kd_tu_chinh\)/.test(src));

  /* Đủ 13 cột theo đúng yêu cầu nghiệp vụ */
  const cols = ['col-no', 'col-ten', 'col-donvi', 'col-vitri', 'col-tttk', 'col-ttlv',
                'col-nam', 'col-sct', 'col-sdk', 'col-kd', 'col-kdtt', 'col-ghichu'];
  check('đủ 12 cột trong bảng', cols.every(c => src.includes('"' + c + '"')),
    cols.filter(c => !src.includes('"' + c + '"')));
  check('cột Loại thiết bị đã gộp vào cột Tên thiết bị', !src.includes('"col-loai"'));
  check('ô Tên thiết bị hiển thị "<loại> <tên>"',
    /rec\.loai_thiet_bi \+ " " : ""\) \+ \(rec\.ten_thiet_bi \|\| ""\)\)\.trim\(\)/.test(src));
  check('Biển kiểm soát nằm dòng 2 trong ô Tên thiết bị, có nhãn nhạt màu',
    /id="tbn-inp-bks"/.test(src) &&
    /tbn-bks-nhan">Biển kiểm soát<\/span>/.test(src) &&
    /bien_kiem_soat:\s+document\.getElementById\("tbn-inp-bks"\)\.value/.test(src));
  check('Biển kiểm soát có cột riêng trong file Excel', /"Biển kiểm soát", "Ngày KĐ&TT gần nhất"/.test(src));
  check('SQL có cột Biển kiểm soát và bổ sung được cho bảng đã tạo trước', (() => {
    const q = fs.readFileSync(path.join(ROOT, 'supabase', 'thiet_bi_nang.sql'), 'utf8');
    return /bien_kiem_soat     text/.test(q) && /add column if not exists bien_kiem_soat text/.test(q);
  })());
  check('loại và tên vẫn là hai trường riêng trong dữ liệu (chỉ gộp lúc hiển thị)',
    /loai_thiet_bi:\s+document\.getElementById\("tbn-inp-loai"\)\.value/.test(src) &&
    /ten_thiet_bi:\s+document\.getElementById\("tbn-inp-ten"\)\.value/.test(src));
  check('Tải trọng là MỘT cột lớn tách thành hai cột con',
    /tbn-th-group' colspan='2'>Tải trọng \(tấn\)/.test(src) &&
    /tbn-th-sub'>Thiết kế/.test(src) && /tbn-th-sub'>Làm việc/.test(src));
  check('độ rộng cột khai bằng colgroup (tiêu đề hai tầng không suy được từ hàng đầu)',
    /createElement\("colgroup"\)/.test(src) && /'<col class="' \+ c \+ '">'/.test(src));
  check('tiêu đề tầng 2 được ĐO để dính đúng chỗ khi cuộn, không đoán số cố định',
    /_fixStickyRows/.test(src) && /getBoundingClientRect\(\)\.height/.test(src));
  check('lọc theo loại nằm ngay dưới tiêu đề cột Tên thiết bị',
    src.includes(`"<th class='col-ten' rowspan='2'>" + _thFilterLoai()`) &&
    /_thFilter\("Tên thiết bị", "tbn-filter-loai"/.test(src) &&
    /thead.querySelector\("#tbn-filter-loai"\)/.test(src));
  check('lọc Đơn vị quản lý nằm ngay tiêu đề cột',
    src.includes(`"<th class='col-donvi' rowspan='2'>" + _thFilterDonVi()`) && /thead.querySelector\("#tbn-filter-unit"\)/.test(src));
  check('có nút xuất Excel', /id="tbn-btn-xls"/.test(src));
  check('lọc hạn kiểm định nằm ngay tiêu đề cột Ngày KĐ&TT tiếp theo',
    src.includes(`"<th class='col-kdtt' rowspan='2'>" + _thFilterTT()`) &&
    /thead.querySelector\("#tbn-filter-tt"\)/.test(src));
  check('khoá trạng thái khớp class badge trong bảng (không thể lệch nhau)',
    /st\.cls\.replace\("kd-", ""\)/.test(src) && /key: "qua-han"/.test(src));
  check('xuất Excel tôn trọng cả ba bộ lọc',
    /_rowsSorted\(_filterUnit, _filterLoai, _filterTT\)/.test(src));
  check('cảnh báo khi tải trọng làm việc vượt tải trọng thiết kế', /lv > tk/.test(src));
  check('kéo–thả vẫn giới hạn trong cùng đơn vị',
    /_dragging\.dataset\.sec !== tr\.dataset\.sec/.test(src));
  check('CSS cột được bọc trong .tbn-table, không đụng bảng Bình áp lực',
    !/"\.col-[a-z]+\{/.test(src));

  /* Đấu nối */
  const tb = fs.readFileSync(path.join(ROOT, 'assets', 'thiet-bi.js'), 'utf8');
  check('tab gọi module thật, không còn màn hình "Đang xây dựng"',
    /window\.renderThietBiNang\(content/.test(tb) && !/Đang xây dựng/.test(tb));
  check('index.html có nạp module',
    /assets\/thiet-bi-nang\.js/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
  check('db.js ánh xạ đúng tên bảng Supabase',
    /thiet_bi_nang:\s+"ThietBi_ThietBiNang"/.test(fs.readFileSync(path.join(ROOT, 'assets', 'db.js'), 'utf8')));

  const sqlN = fs.readFileSync(path.join(ROOT, 'supabase', 'thiet_bi_nang.sql'), 'utf8');
  check('có SQL tạo bảng', /create table if not exists public\."ThietBi_ThietBiNang"/.test(sqlN));
  check('SQL bật RLS và cho Viewer chỉ đọc',
    /enable row level security/.test(sqlN) && /for select using \(true\)/.test(sqlN) &&
    /hse_current_role\(\) in \('admin', 'user'\)/.test(sqlN));
  check('cột số/ngày để text để ô trống vẫn lưu được', /tai_trong_tk       text/.test(sqlN));

  /* Trả danh mục về nguyên trạng để các phép đối soát phía sau không lệch */
  ganTrang('cang_bien', false); ganTrang('xuong_sua_chua', false);
}

console.log('\n── Thiết bị nâng: ba biểu đồ tròn ──');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'thiet-bi-nang.js'), 'utf8');
  const i = src.indexOf('var CHART_MAU_DONVI');
  const j = src.indexOf('function _mucChu(');
  let store = [];
  const CH = new Function('_load', '_unitRank', '_unitLabel', '_kdStatus', '_nextDateOf', 'LOAI_TB',
    src.slice(i, j) + '; return { _chartData, CHART_MAU_DONVI, CHART_MAU_KHAC };'
  )(() => store,
    k => ({ cang_bien: 0, xuong_sua_chua: 1 }[k] ?? 999),
    k => ({ cang_bien: 'Cảng biển', xuong_sua_chua: 'Xưởng sửa chữa' }[k] || k),
    d => d ? ({ a: { cls: 'kd-con-han' } }[d] || null) : null,
    r => r.kd || '',
    ['Cầu trục', 'Cổng trục', 'Cần trục', 'Palăng', 'Tời', 'Xe nâng', 'Thang nâng', 'Bàn nâng', 'Khác']);

  /* Biểu đồ loại thiết bị phải nằm GIỮA hai biểu đồ cũ */
  const iDV = src.indexOf('_pie("Tỷ lệ thiết bị theo đơn vị"');
  const iLO = src.indexOf('_pie("Tỷ lệ theo loại thiết bị"');
  const iKD = src.indexOf('_pie("Tỷ lệ theo hạn kiểm định"');
  check('vẽ đủ ba biểu đồ', iDV > 0 && iLO > 0 && iKD > 0);
  check('biểu đồ theo loại đặt ở GIỮA', iDV < iLO && iLO < iKD, [iDV, iLO, iKD]);

  store = [
    { section: 'cang_bien',      loai_thiet_bi: 'Palăng',   kd: 'a' },
    { section: 'cang_bien',      loai_thiet_bi: 'Palăng',   kd: 'a' },
    { section: 'cang_bien',      loai_thiet_bi: 'Palăng',   kd: 'a' },
    { section: 'xuong_sua_chua', loai_thiet_bi: 'Cầu trục', kd: 'a' },
    { section: 'xuong_sua_chua', loai_thiet_bi: 'Xe nâng',  kd: 'a' },
    { section: 'xuong_sua_chua',                            kd: 'a' }
  ];
  let d = CH._chartData();
  check('đếm đúng số thiết bị mỗi loại',
    d.loai.map(x => x.nhan + '=' + x.giaTri).join(',') === 'Palăng=3,Cầu trục=1,Xe nâng=1,Khác (1 loại)=1',
    d.loai.map(x => x.nhan + '=' + x.giaTri));
  check('loại đông nhất đứng đầu và được màu riêng',
    d.loai[0].nhan === 'Palăng' && d.loai[0].mau === CH.CHART_MAU_DONVI[0]);
  check('tổng các lát loại = tổng thiết bị',
    d.loai.reduce((s2, x) => s2 + x.giaTri, 0) === d.tong && d.tong === 6);

  /* Quá 3 loại → gộp đuôi vào "Khác" màu xám, KHÔNG sinh thêm màu mới */
  check('quá 3 loại thì gộp thành 4 lát (3 + Khác)', d.loai.length === 4, d.loai.map(x => x.nhan));
  check('lát cuối là "Khác", cộng dồn đúng và mang màu xám',
    /^Khác \(1 loại\)$/.test(d.loai[3].nhan) && d.loai[3].giaTri === 1 &&
    d.loai[3].mau === CH.CHART_MAU_KHAC, d.loai[3]);

  /* Thiết bị chưa chọn loại phải có chỗ đứng riêng, không bị bỏ sót */
  store = [
    { section: 'cang_bien', loai_thiet_bi: 'Tời', kd: 'a' },
    { section: 'cang_bien',                       kd: 'a' }
  ];
  d = CH._chartData();
  check('thiết bị chưa chọn loại vẫn được đếm, không bị bỏ sót',
    d.loai.some(x => x.nhan === 'Chưa phân loại' && x.giaTri === 1), d.loai.map(x => x.nhan));

  /* Ít loại thì không được sinh lát "Khác" thừa */
  store = [{ section: 'cang_bien', loai_thiet_bi: 'Tời', kd: 'a' }];
  d = CH._chartData();
  check('một loại duy nhất thì chỉ một lát', d.loai.length === 1 && d.loai[0].nhan === 'Tời');
  store = [];
  check('không có thiết bị thì không vẽ biểu đồ nào', CH._chartData().tong === 0);
}

/* ─────────────────────────────────────────────
   ĐỐI SOÁT DỮ LIỆU (HSE_UNITS.audit)
   ───────────────────────────────────────────── */
console.log('\n── Đối soát: khai báo cột lưu tên đơn vị ──');
{
  const T = U.RENAME_TARGETS;
  check('khai báo đủ 12 cột lưu tên đơn vị', T.length === 12, T.length);
  check('mọi cột đều ghi rõ đọc qua module nào', T.every(t => t.via === 'db' || t.via === 'bhld'));
  check('5 bảng của Cấp phát BHLĐ đọc qua bhld-sync', T.filter(t => t.via === 'bhld').length === 5);
  check('bảng tiến trình cấp phát được đánh dấu có tên trong khoá chính',
    T.some(t => t.sheet === 'cap_phat_tien_trinh' && t.keyed === 'id'));
  check('KHÔNG đọc bảng BHLĐ qua db.js (tên bảng sẽ sai)',
    !T.some(t => t.via === 'db' && ['nhanvien','nhom_nv','phieu_requests','pending_changes','cap_phat_tien_trinh'].includes(t.sheet)));
}

console.log('\n── Đối soát: phân loại giá trị ──');
{
  freshEnv(); U = loadUnits();
  /* Đổi tên 1 đơn vị + ngừng 1 đơn vị để có đủ 4 trạng thái */
  const dv = JSON.parse(JSON.stringify(U.byMa('doi_xe_vchk')));
  dv.ten_cu = ['Đội xe VCHK']; dv.ten = 'Đội xe vận chuyển hành khách'; U.saveUnit(dv);
  const kt = JSON.parse(JSON.stringify(U.byMa('p_ke_toan'))); kt.active = false; U.saveUnit(kt);

  /* DB giả: trả dữ liệu cho các sheet đọc qua db.js, và Supabase giả cho BHLĐ */
  global.DB = { getAll(sheet) {
    const data = {
      ke_hoach_mot_lan: [{ chuTri:'Cảng biển', phoiHop:['Xưởng sửa chữa'] },
                         { chuTri:'Đội xe VCHK', phoiHop:[] }],
      kiem_tra_cap12:   [{ donVi:'Cảng biển' }, { donVi:'Xí nghiệp Cơ khí' }],
      hl_nhansu:        [{ unit:'Phòng Kế toán' }],
      users:            [{ id:'u1', capPhatUnits:['Cảng biển'] }]
    };
    return Promise.resolve(data[sheet] || []);
  }};
  global.BHLD = { tbl: s => 'CapPhatBHLD_' + s };
  const sbData = {
    CapPhatBHLD_nhanvien:            [{ boPhan:'Cảng biển' }, { boPhan:'Cảng  Biển' }, { boPhan:'Kho vật tư' }],
    CapPhatBHLD_cap_phat_tien_trinh: [{ id:'Cảng biển__Q3/2026', donVi:'Cảng biển' }]
  };
  global.HSE_SB = { from: t => ({ select: () => Promise.resolve({ data: sbData[t] || [], error: null }) }) };

  U.audit().then(res => {
    const by = v => res.rows.find(r => U.norm(r.value) === U.norm(v));

    check('gộp các cách viết khác nhau của cùng một đơn vị làm một dòng',
      res.rows.filter(r => U.norm(r.value) === U.norm('Cảng biển')).length === 1);
    check('cộng đúng tổng số bản ghi', by('Cảng biển').total === 6, by('Cảng biển') && by('Cảng biển').total);
    check('"Cảng biển" khớp danh mục', by('Cảng biển').status === 'ok');
    check('"Đội xe VCHK" nhận diện là TÊN CŨ', by('Đội xe VCHK').status === 'ten_cu');
    check('tên cũ trỏ đúng về đơn vị hiện hành',
      by('Đội xe VCHK').unit.ten === 'Đội xe vận chuyển hành khách');
    check('"Phòng Kế toán" nhận diện là ĐÃ NGỪNG', by('Phòng Kế toán').status === 'ngung');
    check('"Xí nghiệp Cơ khí" nhận diện là LẠ', by('Xí nghiệp Cơ khí').status === 'la');
    check('"Kho vật tư" (chỉ có trong BHLĐ) cũng được phát hiện', by('Kho vật tư').status === 'la');
    check('đánh dấu đơn vị có tên nằm trong khoá tiến trình cấp phát', by('Cảng biển').keyed === true);
    check('đơn vị không dính khoá thì không bị đánh dấu', by('Xí nghiệp Cơ khí').keyed === false);
    check('xếp giá trị lạ lên đầu', res.rows[0].status === 'la');
    check('ghi rõ giá trị xuất hiện ở bảng nào',
      Object.keys(by('Cảng biển').targets).length === 5, Object.keys(by('Cảng biển').targets));
    /* 17 mục trong danh mục, 4 mục có dữ liệu (Cảng biển, Xưởng sửa chữa,
       Đội xe VCHK đã đổi tên, Phòng Kế toán) → còn 13 chưa dùng */
    check('liệt kê đơn vị trong danh mục chưa có dữ liệu', res.chuaDung.length === 13, res.chuaDung.length);
    check('đơn vị đã dùng KHÔNG bị liệt vào nhóm chưa dùng',
      !res.chuaDung.some(u => u.ma === 'cang_bien' || u.ma === 'doi_xe_vchk'));
    check('không có bảng nào lỗi khi đọc', res.errors.length === 0, res.errors);

    /* Biến thể chính tả — nguy hiểm vì canEditUnit() so chuỗi tuyệt đối */
    check('giữ lại từng cách viết thô', Object.keys(by('Cảng biển').variants).length === 2,
      Object.keys(by('Cảng biển').variants));
    check('chỉ ra cách viết lệch chuẩn', by('Cảng biển').lech.length === 1 && by('Cảng biển').lech[0] === 'Cảng  Biển',
      by('Cảng biển').lech);
    check('viết đúng chuẩn thì không bị báo lệch', by('Xưởng sửa chữa').lech.length === 0);

    console.log('\n' + (fail === 0 ? '🎉 TẤT CẢ ' + pass + ' KIỂM TRA ĐỀU ĐẠT' : '⚠️  ' + fail + ' lỗi / ' + (pass + fail) + ' kiểm tra'));
    process.exit(fail ? 1 : 0);
  });
}
