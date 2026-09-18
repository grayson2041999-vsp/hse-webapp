/* Kiểm tra hàng rào chặn "tháng cấp gần nhất" nằm ở tương lai.
   Nạp hàm thật từ cap-phat-bhld.html vào vm, dựng dữ liệu giả cho
   daChucDanh / daNhomTB / daDinhMuc / BHLD để mô phỏng định mức và phiếu quý.
   Chạy: node tests/thang-cap-nhap.test.js                                  */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'cap-phat-bhld.html'), 'utf8');

const NAMES = ['today','_yyyymm','_addMonths','_ckSo','_fThangTxt','getTB','getChucDanhByTen',
               'getCurrentQuy','_compareQuy','getQuarterMonths','_tbToThangField',
               '_thangHienTai','_bienTrenThangCap','_chuKyTheoTruong','_laMocAoNVMoi','_loiThangCap'];
const code = NAMES.map(n => {
  // Hàm một dòng phải khớp TRƯỚC, nếu không mẫu nhiều dòng sẽ nuốt sang hàm kế tiếp.
  const m = SRC.match(new RegExp('\\nfunction ' + n + '\\([^\\n]*\\}\\n'))
         || SRC.match(new RegExp('\\nfunction ' + n + '\\([\\s\\S]*?\\n\\}'));
  if (!m) { console.error('KHÔNG tìm thấy hàm ' + n); process.exit(1); }
  return m[0];
}).join('\n');

const addM = (v,n) => { const [y,m]=v.split('-').map(Number); const d=new Date(y,m-1+n,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };

let PHIEU = [];                                  // đổi được giữa các nhóm test
const ctx = vm.createContext({
  Date, Number, String, Math, isFinite, JSON, Object, Array, console, parseInt,
  BHLD: { lsGet: () => PHIEU },
  daChucDanh: [{ id: 'cd1', ten: 'Thợ hàn' }],
  daNhomTB: [
    { id: 101, ten: 'Bộ áo liền quần', loaiCo: 'quan_ao' },
    { id: 105, ten: 'Giày thấp cổ',    loaiCo: 'giay' },
    { id: 108, ten: 'Mũ bảo hộ',       loaiCo: '' },
    { id: 115, ten: 'Áo mưa',          loaiCo: '' },
  ],
  daDinhMuc: [
    { chucDanhId: 'cd1', trangBiId: 101, chuKy: 6  },
    { chucDanhId: 'cd1', trangBiId: 105, chuKy: 9  },
    { chucDanhId: 'cd1', trangBiId: 108, chuKy: 18 },
    { chucDanhId: 'cd1', trangBiId: 115, chuKy: 12 },
  ],
});
vm.runInContext('var _CAP_DOI_LAN_DAU=["thangCapQuanAo","thangCapGiay","thangCapKinh","thangCapQAHan"];\n' + code, ctx);
const { _loiThangCap, _laMocAoNVMoi, _chuKyTheoTruong, _bienTrenThangCap, _thangHienTai } = ctx;

let fail = 0, total = 0;
const T = (ten, got, mong) => { total++; const ok = String(got)===String(mong); if(!ok) fail++;
  console.log((ok?'  ok  ':'  FAIL')+' '+ten+'  →  '+got+(ok?'':'  (mong '+mong+')')); };
const G = t => console.log('\n' + t);
const co = v => v === null ? 'hợp lệ' : 'CHẶN';

const NOW  = _thangHienTai();
const BIEN = _bienTrenThangCap();               // không có phiếu → hết quý hiện tại
const cu   = { chucDanh:'Thợ hàn', ngayVaoLam:'' };
const moi  = { chucDanh:'Thợ hàn', ngayVaoLam: NOW };

G('Tra chu kỳ theo cột tháng');
T('quần áo', _chuKyTheoTruong('Thợ hàn','thangCapQuanAo'), 6);
T('giày',    _chuKyTheoTruong('Thợ hàn','thangCapGiay'), 9);
T('mũ',      _chuKyTheoTruong('Thợ hàn','thangCapMu'), 18);
T('chức danh lạ → 0', _chuKyTheoTruong('Không có','thangCapGiay'), 0);

G('Biên trên = hết quý muộn nhất đang có phiếu, tối thiểu quý hiện tại');
T('không có phiếu → biên ≥ tháng này', BIEN >= NOW, true);
T('biên là tháng cuối quý', ['03','06','09','12'].includes(BIEN.slice(5)), true);
PHIEU = [{ type:'quy', quyStr:'Q4/2099' }, { type:'quy', quyStr:'Q1/2030' }];
T('có phiếu quý xa → biên nới ra', _bienTrenThangCap(), '2099-12');
T('phiếu nhân viên mới không tính', (PHIEU = [{ type:'nv_moi', quyStr:'Q4/2099' }], _bienTrenThangCap()), BIEN);
PHIEU = [];

G('Nhân viên cũ: tháng vượt biên phải bị chặn');
T('đúng biên',      co(_loiThangCap(cu,'thangCapGiay',BIEN,'')), 'hợp lệ');
T('tháng quá khứ',  co(_loiThangCap(cu,'thangCapGiay','2020-01','')), 'hợp lệ');
T('để trống',       co(_loiThangCap(cu,'thangCapGiay','','')), 'hợp lệ');
T('vượt biên 1 tháng', co(_loiThangCap(cu,'thangCapGiay',addM(BIEN,1),'')), 'CHẶN');
T('vượt biên 1 năm',   co(_loiThangCap(cu,'thangCapGiay',addM(BIEN,12),'')), 'CHẶN');
T('sai định dạng',     co(_loiThangCap(cu,'thangCapGiay','2026','')), 'CHẶN');

G('Không sửa ô đó thì không chặn (tránh khoá cứng dữ liệu cũ)');
const tl = addM(BIEN,6);
T('giá trị vượt biên giữ nguyên', co(_loiThangCap(cu,'thangCapGiay',tl,tl)), 'hợp lệ');
T('giá trị vượt biên bị đổi',     co(_loiThangCap(cu,'thangCapGiay',tl,addM(BIEN,3))), 'CHẶN');

G('Nhân viên mới: mốc ảo ở tương lai vẫn phải qua được');
T('quần áo = vào làm + 6',  co(_loiThangCap(moi,'thangCapQuanAo',addM(NOW,6),'')), 'hợp lệ');
T('giày    = vào làm + 9',  co(_loiThangCap(moi,'thangCapGiay',addM(NOW,9),'')), 'hợp lệ');
T('giày lệch một tháng → chặn', co(_loiThangCap(moi,'thangCapGiay',addM(NOW,10),'')), 'CHẶN');
T('mũ      = vào làm',      _laMocAoNVMoi(moi,'thangCapMu',NOW), true);
T('áo mưa  = vào làm',      _laMocAoNVMoi(moi,'thangCapAoMua',NOW), true);
T('mũ KHÔNG được cộng chu kỳ',  _laMocAoNVMoi(moi,'thangCapMu',addM(NOW,18)), false);
T('mũ cộng chu kỳ → chặn',      co(_loiThangCap(moi,'thangCapMu',addM(NOW,18),'')), 'CHẶN');
T('thiếu ngày vào làm → chặn',  co(_loiThangCap(cu,'thangCapQuanAo',addM(BIEN,6),'')), 'CHẶN');
T('chức danh không có định mức giày → chặn',
  co(_loiThangCap({chucDanh:'Không có',ngayVaoLam:NOW},'thangCapGiay',addM(BIEN,9),'')), 'CHẶN');

console.log('\n' + (fail ? '✗ '+fail+'/'+total+' ca FAIL' : '✓ '+total+'/'+total+' ca PASS'));
process.exit(fail ? 1 : 0);
