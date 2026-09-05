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
