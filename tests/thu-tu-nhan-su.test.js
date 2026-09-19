/* Thứ tự nhân sự: hàm sắp xếp phải là THỨ TỰ TOÀN PHẦN, nếu không màn hình
   và file Excel sẽ lệch nhau sau mỗi lần dữ liệu được sắp lại.
   Chạy: node tests/thu-tu-nhan-su.test.js                                  */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'cap-phat-bhld.html'), 'utf8');
const lay = n => {
  const m = SRC.match(new RegExp('\\nfunction ' + n + '\\([\\s\\S]*?\\n\\}'));
  if (!m) { console.error('KHÔNG tìm thấy ' + n); process.exit(1); }
  return m[0];
};
const ctx = vm.createContext({ Number, String, Array, Math });
vm.runInContext(lay('_sortNVByStt') + '\n' + lay('_sapThanhVien'), ctx);
const { _sortNVByStt, _sapThanhVien } = ctx;

let fail = 0, total = 0;
const T = (ten, got, mong) => { total++; const ok = String(got)===String(mong); if(!ok) fail++;
  console.log((ok?'  ok  ':'  FAIL')+' '+ten+'  →  '+got+(ok?'':'  (mong '+mong+')')); };
const G = t => console.log('\n' + t);
const nv = (boPhan, stt, ten) => ({ boPhan, stt, ten, id: boPhan+'|'+ten });
const ids = a => a.map(x => x.id).join(' , ');

// Dàn dữ liệu trộn lẫn đơn vị, giống hệt cách Supabase trả về
const DS = [
  nv('Cảng biển', 3, 'C3'), nv('Đội xe', 2, 'D2'), nv('Cảng biển', 1, 'C1'),
  nv('Xưởng', 5, 'X5'),     nv('Đội xe', 1, 'D1'), nv('Cảng biển', 2, 'C2'),
  nv('Xưởng', 1, 'X1'),     nv('Đội xe', 3, 'D3'),
];

G('Sắp đúng: gom theo đơn vị, trong đơn vị tăng dần theo stt');
T('thứ tự', ids(_sortNVByStt(DS)),
  'Cảng biển|C1 , Cảng biển|C2 , Cảng biển|C3 , Đội xe|D1 , Đội xe|D2 , Đội xe|D3 , Xưởng|X1 , Xưởng|X5');

G('Thứ tự toàn phần: kết quả KHÔNG phụ thuộc thứ tự đầu vào');
const a = ids(_sortNVByStt(DS));
T('đảo ngược đầu vào', ids(_sortNVByStt([...DS].reverse())), a);
T('xoay vòng đầu vào', ids(_sortNVByStt([...DS.slice(3), ...DS.slice(0,3)])), a);
T('sắp hai lần', ids(_sortNVByStt(_sortNVByStt(DS))), a);
let khac = 0;
for (let i = 0; i < 40; i++) {
  const tron = [...DS].sort(() => Math.random() - 0.5);
  if (ids(_sortNVByStt(tron)) !== a) khac++;
}
T('40 lần xáo trộn ngẫu nhiên đều ra cùng kết quả', khac, 0);

G('Trong từng đơn vị, stt luôn tăng dần');
const sap = _sortNVByStt(DS);
let saiThuTu = 0;
for (let i = 1; i < sap.length; i++)
  if (sap[i-1].boPhan === sap[i].boPhan && Number(sap[i-1].stt) > Number(sap[i].stt)) saiThuTu++;
T('số cặp sai thứ tự', saiThuTu, 0);

G('Biên');
T('mảng rỗng', _sortNVByStt([]).length, 0);
T('stt rỗng xuống cuối đơn vị',
  ids(_sortNVByStt([nv('A', null, 'sau'), nv('A', 1, 'truoc')])), 'A|truoc , A|sau');
T('cùng đơn vị, cùng stt → theo tên',
  ids(_sortNVByStt([nv('A', 1, 'Bình'), nv('A', 1, 'An')])), 'A|An , A|Bình');
T('thiếu boPhan không làm vỡ hàm', _sortNVByStt([{ten:'x'},{ten:'y'}]).length, 2);

G('_sapThanhVien — hàm dùng chung cho màn hình và file xuất');
const nhom = [nv('A', 3, 'Cường'), nv('A', 1, 'An'), nv('A', 2, 'Bình')];
T('sắp theo stt', ids(_sapThanhVien(nhom)), 'A|An , A|Bình , A|Cường');
T('không làm thay đổi mảng gốc', ids(nhom), 'A|Cường , A|An , A|Bình');
T('thiếu stt thì theo tên',
  ids(_sapThanhVien([nv('A', null, 'Bình'), nv('A', null, 'An')])), 'A|An , A|Bình');
T('stt = 0 vẫn được tôn trọng, không bị coi là thiếu',
  ids(_sapThanhVien([nv('A', 5, 'Sau'), nv('A', 0, 'Truoc')])), 'A|Truoc , A|Sau');
T('người có stt luôn đứng trước người thiếu stt',
  ids(_sapThanhVien([nv('A', null, 'An'), nv('A', 9, 'Zét')])), 'A|Zét , A|An');
const xaoTron = [...nhom].sort(() => Math.random() - 0.5);
T('kết quả không phụ thuộc thứ tự đầu vào', ids(_sapThanhVien(xaoTron)), ids(_sapThanhVien(nhom)));

console.log('\n' + (fail ? '✗ '+fail+'/'+total+' ca FAIL' : '✓ '+total+'/'+total+' ca PASS'));
process.exit(fail ? 1 : 0);
