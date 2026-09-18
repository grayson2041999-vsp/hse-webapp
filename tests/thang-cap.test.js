/* Kiểm tra cách tính "Tháng cấp gần nhất" của trang Cấp phát BHLĐ.
   Trích các hàm thuần tuý từ cap-phat-bhld.html và chạy lại bằng vm,
   nên test luôn bám theo code thật chứ không phải bản chép tay.
   Chạy: node tests/thang-cap.test.js                                       */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'cap-phat-bhld.html'), 'utf8');

const NAMES = ['_yyyymm', '_addMonths', '_ckSo', '_mocCapMoi', 'getQuarterMonths'];
const code = NAMES.map(n => {
  const re = new RegExp('\\nfunction ' + n + '\\([\\s\\S]*?\\n\\}');
  const m = SRC.match(re) || SRC.match(new RegExp('\\nfunction ' + n + '\\([^\\n]*\\}'));
  if (!m) { console.error('KHÔNG tìm thấy hàm ' + n + ' trong cap-phat-bhld.html'); process.exit(1); }
  return m[0];
}).join('\n');

const ctx = vm.createContext({ Date, Number, String, Math, isFinite, JSON, console });
vm.runInContext(code, ctx);
const { _addMonths, _ckSo, _mocCapMoi, getQuarterMonths } = ctx;
const qEnd = q => { const m = getQuarterMonths(q); return m[m.length - 1]; };

let fail = 0, total = 0;
function T(ten, got, mong) {
  total++;
  const ok = String(got) === String(mong);
  if (!ok) fail++;
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + ten + '  →  ' + got + (ok ? '' : '  (mong ' + mong + ')'));
}
const G = t => console.log('\n' + t);

G('Nhân viên mới: cấp đôi lần đầu, mốc ảo ở tương lai đúng một lần');
T('vào làm 01/2026 chu kỳ 6 → mốc ghi khi duyệt phiếu', _addMonths('2026-01', 6), '2026-07');
T('hạn cấp kế tiếp', _addMonths('2026-07', 6), '2027-01');
T('cấp ở Q1/2027 → mốc mới (hết tương lai)', _mocCapMoi('2026-07', 6, qEnd('Q1/2027')), '2027-01');
T('hạn kế tiếp sau đó', _addMonths('2027-01', 6), '2027-07');
T('cấp ở Q3/2027 → mốc mới', _mocCapMoi('2027-01', 6, qEnd('Q3/2027')), '2027-07');

G('Chu kỳ không chia hết cho quý (4 tháng): phải giữ nhịp 01–05–09');
T('mốc 01/2026, cấp Q2/2026', _mocCapMoi('2026-01', 4, qEnd('Q2/2026')), '2026-05');
T('mốc 05/2026, cấp Q3/2026', _mocCapMoi('2026-05', 4, qEnd('Q3/2026')), '2026-09');
T('mốc 09/2026, cấp Q1/2027', _mocCapMoi('2026-09', 4, qEnd('Q1/2027')), '2027-01');

G('Cấp trễ: đuổi kịp trong một lần, không lặp lại từng quý');
T('mốc 01/2025 ck 12, cấp Q3/2027', _mocCapMoi('2025-01', 12, qEnd('Q3/2027')), '2027-01');
T('mốc 01/2026 ck 4,  cấp Q3/2027', _mocCapMoi('2026-01', 4, qEnd('Q3/2027')), '2027-09');

G('Idempotent: bấm Hoàn tất hai lần không được cộng dồn');
const a = _mocCapMoi('2025-12', 9, qEnd('Q3/2026'));
T('lần 1', a, '2026-09');
T('lần 2 chạy lại', _mocCapMoi(a, 9, qEnd('Q3/2026')), '2026-09');

G('Hồi quy các ca đã sai trong dữ liệu thật (code cũ cộng thừa một chu kỳ)');
T('giày ck 9,  mốc 2025-12, Q3/2026 — code cũ ghi 2027-06', _mocCapMoi('2025-12', 9, qEnd('Q3/2026')), '2026-09');
T('mũ   ck 18, mốc 2025-03, Q3/2026 — code cũ ghi 2028-03', _mocCapMoi('2025-03', 18, qEnd('Q3/2026')), '2026-09');
T('kính ck 6,  mốc 2026-03, Q3/2026 — code cũ ghi 2027-03', _mocCapMoi('2026-03', 6, qEnd('Q3/2026')), '2026-09');

G('Chu kỳ nhập sai dấu thập phân (có thật: chức danh Thợ điện)');
T('_ckSo("0,25")', _ckSo('0,25'), 0.25);
T('_ckSo("0.25")', _ckSo('0.25'), 0.25);
T('_ckSo(null)', _ckSo(null), 0);
T('_ckSo("")', _ckSo(''), 0);
T('_ckSo("abc")', _ckSo('abc'), 0);

G('Biên');
T('mốc rỗng → null', _mocCapMoi('', 12, qEnd('Q4/2026')), 'null');
T('mốc sai định dạng → null', _mocCapMoi('2026', 12, qEnd('Q4/2026')), 'null');
T('chu kỳ 0 → null', _mocCapMoi('2026-01', 0, qEnd('Q4/2026')), 'null');
T('phát sớm hơn hạn → lấy tháng cuối quý', _mocCapMoi('2026-06', 12, qEnd('Q4/2026')), '2026-12');
T('quý bắc cầu sang năm sau', qEnd('Q4/2026'), '2026-12');

console.log('\n' + (fail ? '✗ ' + fail + '/' + total + ' ca FAIL' : '✓ ' + total + '/' + total + ' ca PASS'));
process.exit(fail ? 1 : 0);
