/* Theo dõi nộp số liệu Kiểm tra cấp 1/2 — assets/kt-nop.js
   Chạy file thật trong vm (không chép tay), giống các test khác.
   Chạy: node tests/kt-nop.test.js                                          */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'kt-nop.js'), 'utf8');
const ctx = vm.createContext({ Date, Math, String, Number, isNaN });
ctx.window = ctx;
vm.runInContext(SRC, ctx);
const K = ctx.HSE_KT_NOP;

let fail = 0, total = 0;
const T = (ten, got, mong) => { total++; const ok = String(got) === String(mong); if (!ok) fail++;
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + ten + '  →  ' + got + (ok ? '' : '  (mong ' + mong + ')')); };
const G = t => console.log('\n' + t);
const ngay = (y, m, d, h) => new Date(y, m - 1, d, h || 0);

G('Tiện ích tháng');
T('cộng tháng qua năm', K.ymCong('2026-12', 1), '2027-01');
T('trừ tháng qua năm', K.ymCong('2027-01', -1), '2026-12');
T('nhãn tháng', K.nhanThang('2026-09'), 'T9/2026');
T('hết hạn tháng 9 = 00:00 ngày 2/10', K.mocHetHan('2026-09').getTime(), ngay(2026, 10, 2).getTime());
T('hết hạn tháng 12 = 00:00 ngày 2/1 năm sau', K.mocHetHan('2026-12').getTime(), ngay(2027, 1, 2).getTime());

G('Trạng thái ô chưa nộp (hạn = ngày 1 tháng sau)');
T('tháng 9, đang 30/9', K.trangThaiO('2026-09', null, ngay(2026, 9, 30, 17)), 'trongky');
T('tháng 9, đang 1/10 → đã báo chưa nhập (không còn "hạn hôm nay")', K.trangThaiO('2026-09', null, ngay(2026, 10, 1, 0)), 'quahan');
T('tháng 9, đang 2/10', K.trangThaiO('2026-09', null, ngay(2026, 10, 2, 0)), 'quahan');
T('tháng 11, đang 2/10', K.trangThaiO('2026-11', null, ngay(2026, 10, 2)), 'chuadenky');
T('tháng 3 (trước mốc theo dõi 04/2026)', K.trangThaiO('2026-03', null, ngay(2026, 10, 2)), 'ngoai');
T('mốc theo dõi đổi được', K.trangThaiO('2026-03', null, ngay(2026, 10, 2), { tuThang: '2026-01' }), 'quahan');
T('hạn ngày 10: nộp 5/10 vẫn đúng hạn', K.trangThaiO('2026-09', { createdAt: ngay(2026, 10, 5).toISOString() }, ngay(2026, 10, 6), { hanNgay: 10 }), 'danop');

G('Trạng thái ô đã nộp');
T('nộp 30/9 cho tháng 9', K.trangThaiO('2026-09', { createdAt: ngay(2026, 9, 30).toISOString() }, ngay(2026, 10, 5)), 'danop');
T('nộp 1/10 cho tháng 9 (đúng hạn)', K.trangThaiO('2026-09', { createdAt: ngay(2026, 10, 1, 16).toISOString() }, ngay(2026, 10, 5)), 'danop');
T('nộp 2/10 cho tháng 9 (trễ)', K.trangThaiO('2026-09', { createdAt: ngay(2026, 10, 2, 9).toISOString() }, ngay(2026, 10, 5)), 'noptre');
T('có bản ghi trước mốc theo dõi vẫn là đã nộp', K.trangThaiO('2026-02', { createdAt: '' }, ngay(2026, 10, 5)), 'danop');
T('nhập 0 lần vẫn là đã nộp', K.trangThaiO('2026-09', { soLanKiemTra: 0, createdAt: ngay(2026, 9, 30).toISOString() }, ngay(2026, 10, 5)), 'danop');

G('Danh sách thiếu — dữ liệu thật ngày 02/10/2026');
// [đơn vị, tháng, cấp] của 35 bản ghi trên Supabase lúc phân tích
const CO = {
  'Cảng biển':              ['06:12', '07:12', '08:12', '09:12'],
  'Xưởng sửa chữa':         ['04:12', '05:12', '06:12', '07:12'],
  'Căn cứ Kho - Giao nhận': ['04:12', '05:12', '06:12', '07:12'],
  'Đội xe VTHH&PTTBCD':     ['04:12', '05:12', '06:12'],
  'Đội xe VCHK':            ['04:12', '05:1', '06:12'],
};
const recs = [];
Object.keys(CO).forEach(dv => CO[dv].forEach(s => {
  const [m, caps] = s.split(':');
  caps.split('').forEach(c => recs.push({ donVi: dv, thang: '2026-' + m, type: 'cap' + c, createdAt: '2026-07-01T00:00:00Z' }));
}));
T('đủ 35 bản ghi mẫu', recs.length, 35);
const DV = Object.keys(CO);
const thieu = K.danhSachThieu(recs, DV, ngay(2026, 10, 2, 9));
T('thiếu 25 ô (60 − 35)', thieu.length, 25);
T('tất cả đều quá hạn', thieu.every(x => x.trangThai === 'quahan'), true);
const nhom = K.nhomTheoDonVi(thieu);
const mo = dv => nhom.find(n => n.donVi === dv).thang.map(t => K.moTaThang(t)).join(', ');
T('Cảng biển', mo('Cảng biển'), 'T4/2026, T5/2026');
T('Xưởng sửa chữa', mo('Xưởng sửa chữa'), 'T8/2026, T9/2026');
T('Đội xe VCHK (thiếu riêng cấp 2 tháng 5)', mo('Đội xe VCHK'), 'T5/2026 (cấp 2), T7/2026, T8/2026, T9/2026');
const ngay1 = K.danhSachThieu(recs, DV, ngay(2026, 10, 1, 9));
T('ngày 1/10: tháng 9 đã vào danh sách chưa nhập (4 đơn vị × 2 cấp)', ngay1.filter(x => x.thang === '2026-09').length, 8);
T('ngày 30/9: chưa tính tháng 9', K.danhSachThieu(recs, DV, ngay(2026, 9, 30)).some(x => x.thang === '2026-09'), false);

G('So khớp tên đơn vị');
const norm = s => String(s).trim().toLowerCase();
T('khác hoa thường / khoảng trắng vẫn khớp',
  K.danhSachThieu([{ donVi: ' cảng BIỂN ', thang: '2026-04', type: 'cap1' }], ['Cảng biển'], ngay(2026, 5, 5), {}, norm).length, 1);
T('bản ghi trùng: giữ bản nộp sớm nhất',
  K.lapChiMuc([{ donVi: 'A', thang: '2026-04', type: 'cap1', createdAt: '2026-05-09', id: 2 },
               { donVi: 'A', thang: '2026-04', type: 'cap1', createdAt: '2026-05-01', id: 1 }])['a|2026-04|cap1'].id, 1);

console.log('\n' + (total - fail) + '/' + total + ' đạt' + (fail ? ' — ' + fail + ' LỖI' : ''));
process.exit(fail ? 1 : 0);
