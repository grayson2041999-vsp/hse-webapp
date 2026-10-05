/* =========================================================
   KIỂM TRA — Trang Tập thể xuất sắc ATSKMT (assets/tap-the-xuat-sac.js)
   Chạy: node tests/tap-the-xuat-sac.test.js
   ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
const G = t => console.log('\n' + t);

/* Nạp lõi tính toán (không có document → module chỉ xuất TTXS_CORE) */
const ctx = { console, Date, Math, JSON, String, Array, Object, parseInt };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('assets/tap-the-xuat-sac.js'), ctx);
const C = ctx.TTXS_CORE;
const D = (y, m, d) => new Date(y, m - 1, d);

G('Quý & nhãn');
check('nhãn La Mã giống file Excel', C.qlabel(2026, 3) === 'III/2026');
check('id cố định năm-quý', C.qid(2026, 3) === '2026-3');
check('quý của 05/10/2026 là IV/2026', JSON.stringify(C.quarterOf(D(2026, 10, 5))) === '{"nam":2026,"quy":4}');
check('quý vừa kết thúc (05/10/2026) là III/2026', JSON.stringify(C.lastFinished(D(2026, 10, 5))) === '{"nam":2026,"quy":3}');
check('quý vừa kết thúc (15/02/2027) là IV/2026', JSON.stringify(C.lastFinished(D(2027, 2, 15))) === '{"nam":2026,"quy":4}');
const rg = C.quarterRange([], D(2026, 10, 5));
check('dải quý từ I/2022 tới quý hiện tại = 20 quý', rg.length === 20, rg.length);
check('dải quý kết thúc ở IV/2026', rg[rg.length - 1].nam === 2026 && rg[rg.length - 1].quy === 4);
check('dữ liệu cũ hơn 2022 thì mở rộng dải', C.quarterRange([{ nam: 2021, quy: 3 }], D(2022, 1, 1))[0].nam === 2021);

G('Chuẩn hoá bản ghi');
const n1 = C.normRow({ id: '2024-3', trangThai: 'tnld', donVi: null, tnldIds: '["a1"]' });
check('suy năm/quý từ id khi thiếu cột', n1.nam === 2024 && n1.quy === 3);
check('đọc mảng lưu dạng chuỗi JSON', n1.tnldIds.length === 1 && n1.tnldIds[0] === 'a1');
check('trạng thái lạ → coi là "xet"', C.normRow({ nam: 2025, quy: 1, trangThai: 'abc' }).trangThai === 'xet');
check('bỏ tên rỗng / khoảng trắng', C.normRow({ nam: 2025, quy: 1, donVi: [' Cảng biển ', ''] }).donVi.join('|') === 'Cảng biển');

G('Kiểm tra trước khi lưu (giới hạn 2 đơn vị là chặn cứng)');
const T = D(2026, 10, 5);
check('2 đơn vị → hợp lệ', C.validate({ nam: 2026, quy: 3, trangThai: 'xet', donVi: ['A', 'B'] }, T) === '');
check('3 đơn vị → bị chặn', /tối đa 2/.test(C.validate({ nam: 2026, quy: 3, trangThai: 'xet', donVi: ['A', 'B', 'C'] }, T)));
check('quý chưa diễn ra → bị chặn', /chưa diễn ra/.test(C.validate({ nam: 2027, quy: 1, trangThai: 'xet', donVi: [] }, T)));
check('quý hiện tại vẫn nhập được', C.validate({ nam: 2026, quy: 4, trangThai: 'xet', donVi: ['A'] }, T) === '');
check('TNLĐ không liên kết, không ghi chú → bị chặn', /TNLĐ/.test(C.validate({ nam: 2024, quy: 3, trangThai: 'tnld', tnldIds: [], ghiChu: ' ' }, T)));
check('TNLĐ có ghi chú → hợp lệ', C.validate({ nam: 2024, quy: 3, trangThai: 'tnld', tnldIds: [], ghiChu: 'TNLĐ 8/2024' }, T) === '');
check('TNLĐ có liên kết vụ việc → hợp lệ', C.validate({ nam: 2024, quy: 3, trangThai: 'tnld', tnldIds: ['x'] }, T) === '');
check('thiếu quý → báo lỗi', C.validate({ nam: 2024, trangThai: 'xet' }, T) !== '');

G('Liên kết vụ TNLĐ theo quý (module Tai nạn - Sự cố)');
const incs = [
  { id: 'i1', loai: 'tai_nan_lao_dong', thoiGian: '2024-08-12 09:30', ten: 'Kẹp tay' },
  { id: 'i2', loai: 'su_co_ky_thuat',   thoiGian: '2024-08-20 10:00', ten: 'Sự cố cẩu' },
  { id: 'i3', loai: 'tai_nan_lao_dong', thoiGian: '2024-10-01 08:00', ten: 'Trượt ngã' },
  { id: 'i4', loai: 'tai_nan_lao_dong', thoiGian: '15/02/2023', ten: 'Định dạng cũ' }
];
const q3 = C.tnldInQuarter(incs, 2024, 3);
check('chỉ lấy TNLĐ (bỏ sự cố kỹ thuật) trong đúng quý', q3.length === 1 && q3[0].id === 'i1', q3.map(x => x.id));
check('ngày 01/10 thuộc quý IV', C.tnldInQuarter(incs, 2024, 4).map(x => x.id).join() === 'i3');
check('đọc được ngày dạng DD/MM/YYYY', C.tnldInQuarter(incs, 2023, 1).map(x => x.id).join() === 'i4');

/* ── Dữ liệu thật từ file Excel ── */
const SEED = {
  '2022-1': ['XSC', 'VTHH'], '2022-2': ['CB', 'CCK'], '2022-3': ['VCHK', 'VTHH'], '2022-4': ['CB', 'CCK'],
  '2023-1': 'TN', '2023-2': ['XSC', 'CCK'], '2023-3': ['CB', 'VTHH'], '2023-4': ['CCK', 'VCHK'],
  '2024-1': ['CB', 'VTHH'], '2024-2': ['CCK', 'VCHK'], '2024-3': 'TN', '2024-4': ['XSC', 'VTHH'],
  '2025-1': ['CB', 'VCHK'], '2025-2': ['XSC', 'CCK'], '2025-3': ['VCHK', 'VTHH'], '2025-4': ['CB', 'CCK'],
  '2026-1': ['XSC', 'VTHH'], '2026-2': ['CB', 'CCK']
};
const byId = {};
Object.keys(SEED).forEach(id => {
  const [nam, quy] = id.split('-').map(Number), v = SEED[id];
  byId[id] = C.normRow({ id, nam, quy, trangThai: v === 'TN' ? 'tnld' : 'xet', donVi: v === 'TN' ? [] : v });
});

G('Thống kê (khớp file Excel)');
const st = C.stats(rg, byId);
check('16 quý đã xét', st.xet === 16, st.xet);
check('2 quý không xét do TNLĐ', st.tnld === 2, st.tnld);
check('2 quý chưa có kết quả (III, IV/2026)', st.cho === 2, st.cho);
check('32 lượt công nhận', st.luot === 32, st.luot);
check('tổng từng đơn vị: CB 7 · XSC 5 · CCK 8 · VCHK 5 · VTHH 7',
  ['CB', 'XSC', 'CCK', 'VCHK', 'VTHH'].map(k => st.perUnit[k]).join() === '7,5,8,5,7', st.perUnit);
check('nhiều lần nhất là CCK (8)', st.top.join() === 'CCK' && st.max === 8);
const st25 = C.stats(rg.filter(q => q.nam === 2025), byId);
check('lọc năm 2025: 4 quý xét, 8 lượt', st25.xet === 4 && st25.luot === 8);
check('hoà nhau thì liệt kê đủ (2025: CB, CCK, VCHK cùng 2 lần)', st25.max === 2 && st25.top.slice().sort().join() === 'CB,CCK,VCHK', st25.top);
check('so khớp qua khoá (đổi tên vẫn đếm đúng)',
  C.stats([{ nam: 2022, quy: 1 }], { '2022-1': C.normRow({ nam: 2022, quy: 1, donVi: ['Tên cũ'] }) }, () => 'K').perUnit.K === 1);

G('Xuất Excel — bố cục giống file gốc');
const units = ['CB', 'XSC', 'CCK', 'VCHK', 'VTHH'].map(k => ({ key: k, ten: k }));
const aoa = C.toAoa(rg, byId, units);
check('dòng tiêu đề', aoa[0].join() === 'Quý,CB,XSC,CCK,VCHK,VTHH');
check('dòng I/2022 đánh số 1 đúng cột', aoa[1].join() === 'I/2022,,1,,,1', aoa[1]);
check('dòng I/2023 ghi "Không được nhận do TNLĐ"', aoa[5][1] === 'Không được nhận do TNLĐ');
check('dòng tổng', aoa[aoa.length - 1].join() === 'Tổng,7,5,8,5,7', aoa[aoa.length - 1]);

G('Nối vào ứng dụng');
const app = read('assets/app.js'), idx = read('index.html'), db = read('assets/db.js'), dv = read('assets/don-vi.js');
check('MENU có trang, nhóm Theo dõi & Báo cáo, chỉ Admin sửa',
  /slug:"tap-the-xuat-sac"[^\n]*group:"theo-doi"[^\n]*adminEditOnly:true/.test(app));
check('có icon trophy', /"trophy":'/.test(app));
check('renderPage gọi renderTapTheXuatSac với quyền Admin', /renderTapTheXuatSac\(ttxsContainer, u, isAdmin\(u\)\)/.test(app));
check('router index.html nhận slug', /"tap-the-xuat-sac":1/.test(idx));
check('index.html nạp module', /assets\/tap-the-xuat-sac\.js/.test(idx));
check('db.js ánh xạ bảng TapTheXuatSac', /tap_the_xuat_sac:\s*"TapTheXuatSac"/.test(db));
check('danh mục đơn vị có điểm sử dụng mới', /slug: "tap-the-xuat-sac"/.test(dv));
check('đổi tên đơn vị hàng loạt có quét cột donVi', /sheet: "tap_the_xuat_sac", col: "donVi",\s+type: "array"/.test(dv));

G('Danh mục đơn vị — seed mặc định bật 5 ĐVSX cho trang');
const store = {};
const uctx = {
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { readyState: 'complete', addEventListener() {}, createEvent() { return { initEvent() {} }; } },
  CustomEvent: function () {}, dispatchEvent() {}, addEventListener() {}, console, JSON, Promise, setTimeout
};
uctx.window = uctx; uctx.global = uctx; uctx.globalThis = uctx;
vm.createContext(uctx);
vm.runInContext(dv, uctx);
const list = uctx.HSE_UNITS.list('tap-the-xuat-sac', { excludeGop: true });
check('5 đơn vị sản xuất', list.length === 5 && list.indexOf('Cảng biển') >= 0 && list.indexOf('Đội xe VTHH&PTTBCD') >= 0, list);

G('File SQL');
const sqlPath = ['Claude outputs/tap_the_xuat_sac.sql', 'supabase/tap_the_xuat_sac.sql'].map(p => path.join(ROOT, p)).find(p => fs.existsSync(p));
if (!sqlPath) console.log('  (bỏ qua — không thấy tap_the_xuat_sac.sql)');
else {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  check('ràng buộc tối đa 2 đơn vị ở DB', /jsonb_array_length\("donVi"\) <= 2/.test(sql));
  check('RLS: chỉ admin ghi', /hse_current_role\(\) = 'admin'/.test(sql));
  const names = { 'Cảng biển': 'CB', 'Xưởng sửa chữa': 'XSC', 'Căn cứ Kho - Giao nhận': 'CCK', 'Đội xe VCHK': 'VCHK', 'Đội xe VTHH&PTTBCD': 'VTHH' };
  const rows = [...sql.matchAll(/\('(\d{4}-\d)', \d{4}, \d, '(xet|tnld)',\s*'(\[[^']*\])'/g)];
  const same = rows.length === 18 && rows.every(m => {
    const want = SEED[m[1]];
    if (want === 'TN') return m[2] === 'tnld';
    return m[2] === 'xet' && JSON.parse(m[3]).map(n => names[n]).join() === want.join();
  });
  check('18 dòng seed khớp đúng dữ liệu Excel, tên đơn vị đúng danh mục', same, rows.length);
}

console.log('\n' + (fail ? '❌ ' + fail + ' lỗi / ' : '✅ ') + (pass + fail) + ' kiểm tra');
process.exit(fail ? 1 : 0);
