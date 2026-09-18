/* Dashboard tổng quan — trạng thái ô (đơn vị × quý) và quý cần làm tiếp.
   Trích hàm thật từ cap-phat-bhld.html và chạy bằng vm.
   Chạy: node tests/dashboard.test.js                                       */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'cap-phat-bhld.html'), 'utf8');

const NAMES = ['_compareQuy', '_cpwTrangThaiBuoc', '_dashTrangThaiO'];
const code = NAMES.map(n => {
  const m = SRC.match(new RegExp('\\nfunction ' + n + '\\([^\\n]*\\}\\n'))
         || SRC.match(new RegExp('\\nfunction ' + n + '\\([\\s\\S]*?\\n\\}'));
  if (!m) { console.error('KHÔNG tìm thấy hàm ' + n); process.exit(1); }
  return m[0];
}).join('\n');

const ctx = vm.createContext({
  Number, String, Date, parseInt,
  _uSame: (a, b) => String(a) === String(b),      // so tên đơn vị, bản thật chuẩn hoá qua HSE_UNITS
});
vm.runInContext(code, ctx);
const { _dashTrangThaiO } = ctx;

let fail = 0, total = 0;
const T = (ten, got, mong) => { total++; const ok = String(got)===String(mong); if(!ok) fail++;
  console.log((ok?'  ok  ':'  FAIL')+' '+ten+'  →  '+got+(ok?'':'  (mong '+mong+')')); };
const G = t => console.log('\n' + t);
const QS = 'Q3/2026';                             // mốc bắt đầu theo dõi
const o = (tt, p, q) => _dashTrangThaiO('A', q || 'Q3/2026', tt, p, QS);

G('Ngoài phạm vi theo dõi');
T('quý trước mốc bắt đầu', o([], [], 'Q2/2026'), 'ngoai');
T('quý đầu năm', o([], [], 'Q1/2026'), 'ngoai');
T('đúng mốc bắt đầu thì trong phạm vi', o([], [], 'Q3/2026'), 'chua');
T('năm sau vẫn trong phạm vi', o([], [], 'Q2/2027'), 'chua');

G('Các trạng thái');
T('chưa động gì', o([], []), 'chua');
T('mới xác nhận danh sách',
  o([{donVi:'A', quyStr:'Q3/2026', b1TrangThai:'dat'}], []), 'danglam');
T('đã sang bước 2', o([{donVi:'A', quyStr:'Q3/2026', buoc:3}], []), 'danglam');
T('phiếu chờ duyệt',
  o([], [{type:'quy', donVi:'A', quyStr:'Q3/2026', status:'pending'}]), 'choduyet');
T('phiếu đã duyệt, chưa xuất',
  o([], [{type:'quy', donVi:'A', quyStr:'Q3/2026', status:'approved'}]), 'daduyet');
T('đã hoàn tất',
  o([{donVi:'A', quyStr:'Q3/2026', b3TrangThai:'xong'}],
    [{type:'quy', donVi:'A', quyStr:'Q3/2026', status:'approved'}]), 'xong');

G('Không lẫn dữ liệu của đơn vị hay quý khác');
T('phiếu của đơn vị khác',
  o([], [{type:'quy', donVi:'B', quyStr:'Q3/2026', status:'approved'}]), 'chua');
T('phiếu của quý khác',
  o([], [{type:'quy', donVi:'A', quyStr:'Q4/2026', status:'approved'}]), 'chua');
T('phiếu nhân viên mới không tính vào tiến độ quý',
  o([], [{type:'nv_moi', donVi:'A', quyStr:'Q3/2026', status:'approved'}]), 'chua');
T('lấy phiếu mới nhất khi có nhiều phiếu', o([], [
    {type:'quy', donVi:'A', quyStr:'Q3/2026', status:'pending',  createdAt:'2026-08-01'},
    {type:'quy', donVi:'A', quyStr:'Q3/2026', status:'approved', createdAt:'2026-09-01'}
  ]), 'daduyet');

G('Hồi quy: cờ b1/b2 không đáng tin (lỗi đã gặp trong dữ liệu thật)');
T('b1=chua b2=chua b3=xong vẫn phải là hoàn tất',
  o([{donVi:'A', quyStr:'Q3/2026', b1TrangThai:'chua', b2TrangThai:'chua', b3TrangThai:'xong'}],
    [{type:'quy', donVi:'A', quyStr:'Q3/2026', status:'approved'}]), 'xong');
T('có phiếu nhưng b1=chua vẫn tính là đang chạy',
  o([{donVi:'A', quyStr:'Q3/2026', b1TrangThai:'chua'}],
    [{type:'quy', donVi:'A', quyStr:'Q3/2026', status:'pending'}]), 'choduyet');

console.log('\n' + (fail ? '✗ '+fail+'/'+total+' ca FAIL' : '✓ '+total+'/'+total+' ca PASS'));
process.exit(fail ? 1 : 0);
