/* Trạng thái 4 bước của wizard Cấp phát hàng quý.
   Trích _cpwTrangThaiBuoc() từ cap-phat-bhld.html và chạy bằng vm.
   Chạy: node tests/cpw-buoc.test.js                                        */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'cap-phat-bhld.html'), 'utf8');
const m = SRC.match(/\nfunction _cpwTrangThaiBuoc\([\s\S]*?\n\}/);
if (!m) { console.error('KHÔNG tìm thấy _cpwTrangThaiBuoc'); process.exit(1); }
const ctx = vm.createContext({ Number, String });
vm.runInContext(m[0], ctx);
const f = ctx._cpwTrangThaiBuoc;

let fail = 0, total = 0;
const T = (ten, got, mong) => { total++; const ok = String(got)===String(mong); if(!ok) fail++;
  console.log((ok?'  ok  ':'  FAIL')+' '+ten+'  →  '+got+(ok?'':'  (mong '+mong+')')); };
const G = t => console.log('\n' + t);
const bon = r => [r.s1, r.s2, r.s3, r.s4].join(' | ');

G('Chưa bắt đầu');
T('không cờ, không phiếu', bon(f({}, null, 0)), 'dang_lam | khoa | khoa | khoa');
T('đang chờ duyệt thay đổi nhân sự', bon(f({}, null, 3)), 'cho_duyet | khoa | khoa | khoa');

G('Đi từng bước bình thường');
T('xong Bước 1', bon(f({b1TrangThai:'dat'}, null, 0)), 'dat | dang_lam | khoa | khoa');
T('xong Bước 2', bon(f({b1TrangThai:'dat', buoc:3}, null, 0)), 'dat | dat | san_sang | khoa');
T('phiếu chờ duyệt', bon(f({b1TrangThai:'dat', buoc:3}, {status:'pending'}, 0)), 'dat | dat | cho_duyet | khoa');
T('phiếu đã duyệt',  bon(f({b1TrangThai:'dat', buoc:3}, {status:'approved'}, 0)), 'dat | dat | dat | san_sang');
T('đã hoàn tất',     bon(f({b1TrangThai:'dat', buoc:3, b3TrangThai:'xong'}, {status:'approved'}, 0)), 'dat | dat | dat | xong');

G('Lỗi đang sửa: cờ b1TrangThai thiếu nhưng các bước sau đã đi tiếp');
T('phiếu đã duyệt, b1 chưa đặt — Bước 1 KHÔNG được hỏi lại',
  bon(f({b1TrangThai:'chua', b3TrangThai:'xong'}, {status:'approved'}, 0)), 'dat | dat | dat | xong');
T('đúng dữ liệu thật của Căn cứ Kho Q3/2026 (b1=chua, b2=chua, b3=xong)',
  bon(f({b1TrangThai:'chua', b2TrangThai:'chua', b3TrangThai:'xong', buoc:3}, {status:'approved'}, 0)),
  'dat | dat | dat | xong');
T('phiếu mới gửi, b1 chưa đặt', bon(f({b1TrangThai:'chua'}, {status:'pending'}, 0)), 'dat | dat | cho_duyet | khoa');
T('có phiếu thì Bước 1 không còn nhận thay đổi chờ duyệt',
  bon(f({b1TrangThai:'chua'}, {status:'pending'}, 5)), 'dat | dat | cho_duyet | khoa');

G('Không suy diễn quá tay');
T('chưa có phiếu, b1 chưa đặt → vẫn phải làm Bước 1',
  bon(f({b1TrangThai:'chua', b3TrangThai:'chua'}, null, 0)), 'dang_lam | khoa | khoa | khoa');
T('b3 xong nhưng phiếu bị xoá → Bước 4 khoá lại',
  bon(f({b1TrangThai:'dat', buoc:3, b3TrangThai:'xong'}, null, 0)), 'dat | dat | san_sang | khoa');
T('state rỗng không làm vỡ hàm', bon(f(null, null, 0)), 'dang_lam | khoa | khoa | khoa');

G('Cờ b1done / b2done');
T('b1done suy ra từ b2done', f({b1TrangThai:'chua'}, {status:'pending'}, 0).b1done, true);
T('b2done khi đã có phiếu',  f({}, {status:'pending'}, 0).b2done, true);
T('b2done false khi chưa gì cả', f({b1TrangThai:'dat'}, null, 0).b2done, false);

console.log('\n' + (fail ? '✗ '+fail+'/'+total+' ca FAIL' : '✓ '+total+'/'+total+' ca PASS'));
process.exit(fail ? 1 : 0);
