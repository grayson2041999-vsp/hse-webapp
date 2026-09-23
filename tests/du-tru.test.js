/* Dự trù vật tư theo quý — giả lập nhiều quý liên tiếp trên bản nháp tháng cấp.
   Trích hàm thật từ cap-phat-bhld.html và chạy bằng vm.
   Chạy: node tests/du-tru.test.js                                          */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'cap-phat-bhld.html'), 'utf8');

const NAMES = ['_yyyymm', '_addMonths', '_ckSo', '_slTheoQuy', '_mocCapMoi', 'getQuarterMonths',
               '_compareQuy', '_nextQuy', '_parsePhieuItems', '_duTruMoPhong', '_duTruQuyDau', '_duTruTongHop'];
const code = NAMES.map(n => {
  const m = SRC.match(new RegExp('\\nfunction ' + n + '\\([^\\n]*\\}\\n'))
         || SRC.match(new RegExp('\\nfunction ' + n + '\\([\\s\\S]*?\\n\\}'));
  if (!m) { console.error('KHÔNG tìm thấy hàm ' + n); process.exit(1); }
  return m[0];
}).join('\n');
const ctx = vm.createContext({ Date, Number, String, Math, isFinite, JSON, Object, Array, parseInt, parseFloat,
  console: { warn: () => {}, log: () => {} } });
vm.runInContext(code, ctx);
const { _duTruMoPhong, _duTruQuyDau, _duTruTongHop, _addMonths } = ctx;

let fail = 0, total = 0;
const T = (ten, got, mong) => { total++; const ok = JSON.stringify(got) === JSON.stringify(mong); if (!ok) fail++;
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + ten + '  →  ' + JSON.stringify(got) + (ok ? '' : '  (mong ' + JSON.stringify(mong) + ')')); };
const G = t => console.log('\n' + t);

// Trang bị giả: X theo tháng (trường thangCapX), GT theo quý (găng tay), UNG chỉ có trong phiếu
const TB = { X: { id: 'X', ten: 'Vật tư X', field: 'thangCapX' }, GT: { id: 'GT', ten: 'Găng tay', quy: true } };
const Q4 = ['Q4/2026', 'Q1/2027', 'Q2/2027', 'Q3/2027'];
function chay(nvs, dm, trangThai, phieu) {
  return _duTruMoPhong({
    quyList: Q4, units: ['A'], nhanVien: nvs, cungDonVi: (a, b) => a === b,
    trangThai: trangThai || (() => 'chua'), phieu: phieu || (() => null),
    dinhMuc: () => dm,
    hanTiepTheo: (nv, d) => { const tb = TB[d.tb]; if (tb.quy) return 'quarterly';
      return nv[tb.field] ? _addMonths(nv[tb.field], Number(d.chuKy)) : null; },
    truongThang: tb => tb.field || null,
    vatTu: tb => ({ id: tb.id, ten: tb.ten }),
    vatTuTheoId: (id, it) => ({ id: id, ten: it.ten || id }),
  });
}
const soTheoQuy = (res, id) => { const r = res.rows.find(x => x.id === id); return Q4.map(q => r && r.q[q] ? (r.q[q].A || 0) : 0); };
const X6 = [{ d: { chuKy: '6', soLuong: '1', tb: 'X' }, tb: TB.X }];

G('Ví dụ anh A: nhận X tháng 9/2026, chu kỳ 6 tháng');
const nvA = { id: 1, boPhan: 'A', loaiNV: 'cu', thangCapX: '2026-09' };
const r1 = chay([nvA], X6);
T('Q4/26, Q1/27 (giả định nhận 3/2027), Q2/27, Q3/27 (9/2027)', soTheoQuy(r1, 'X'), [0, 1, 0, 1]);
T('không sửa dữ liệu gốc', nvA.thangCapX, '2026-09');

G('Quá hạn từ trước: dồn vào quý đầu, rồi tính tiếp từ mốc giả định');
T('mốc 12/2025 ck 6 → hạn 6/2026 đã quá', soTheoQuy(chay([{ id: 2, boPhan: 'A', loaiNV: 'cu', thangCapX: '2025-12' }], X6), 'X'), [1, 0, 1, 0]);

G('Chu kỳ không chia hết cho quý (4 tháng): giữ nhịp 01 → 05 → 09');
const X4 = [{ d: { chuKy: '4', soLuong: '1', tb: 'X' }, tb: TB.X }];
T('mốc 9/2026', soTheoQuy(chay([{ id: 3, boPhan: 'A', loaiNV: 'cu', thangCapX: '2026-09' }], X4), 'X'), [0, 1, 1, 1]);

G('Trạng thái đơn vị × quý');
const ttXongQ4 = (u, q) => q === 'Q4/2026' ? 'xong' : 'chua';
T('Q4 đã hoàn tất → Q4 không cần (mốc thật đã dời)', soTheoQuy(chay([{ id: 4, boPhan: 'A', loaiNV: 'cu', thangCapX: '2026-12' }], X6, ttXongQ4), 'X'), [0, 0, 1, 0]);
const ttDaDuyet = (u, q) => q === 'Q4/2026' ? 'daduyet' : 'chua';
T('đã duyệt chưa cập nhật thời hạn → Q4 không cần, mốc nháp vẫn dời', soTheoQuy(chay([{ id: 5, boPhan: 'A', loaiNV: 'cu', thangCapX: '2026-06' }], X6, ttDaDuyet), 'X'), [0, 0, 1, 0]);
const ttCho = (u, q) => q === 'Q4/2026' ? 'choduyet' : 'chua';
const phieu = () => ({ items: [{ nvId: '6', tbId: 'X', ten: 'Vật tư X', soLuongDinhMuc: 1, thucTe: 0 },
                               { nvId: '', tbId: 'UNG', ten: 'Ủng', soLuongDinhMuc: 0, thucTe: 5, extra: true }] });
const rCho = chay([{ id: 6, boPhan: 'A', loaiNV: 'cu', thangCapX: '2026-06' }], X6, ttCho, phieu);
T('chờ duyệt → lấy số trong phiếu (X thực tế 0)', soTheoQuy(rCho, 'X'), [0, 0, 1, 0]);
T('chờ duyệt → vật tư khác trong phiếu được tính', soTheoQuy(rCho, 'UNG'), [5, 0, 0, 0]);

G('Găng tay theo quý: mỗi quý một suất, trừ quý đã xong');
const GT = [{ d: { chuKy: '1', soLuong: '2', tb: 'GT' }, tb: TB.GT }];
T('2 đôi/tháng → 6 đôi/quý', soTheoQuy(chay([{ id: 7, boPhan: 'A', loaiNV: 'cu' }], GT, ttXongQ4), 'GT'), [0, 6, 6, 6]);

G('Nhân viên mới đi luồng riêng');
T('loaiNV moi bị bỏ qua', chay([{ id: 8, boPhan: 'A', loaiNV: 'moi', thangCapX: '2026-01' }], X6).rows.length, 0);

G('Quý bắt đầu dự trù');
const units = ['A', 'B'];
T('Q3 xong hết, B chưa làm Q4 → Q4/2026', _duTruQuyDau(units, 'Q3/2026', 'Q3/2026', (u, q) => q === 'Q3/2026' || (u === 'A' && q === 'Q4/2026') ? 'xong' : 'chua'), 'Q4/2026');
T('B còn nợ Q3 → Q3/2026', _duTruQuyDau(units, 'Q3/2026', 'Q4/2026', (u, q) => (u === 'B' && q === 'Q3/2026') ? 'chua' : 'xong'), 'Q3/2026');
T('xong hết tới quý hiện tại → quý sau', _duTruQuyDau(units, 'Q3/2026', 'Q4/2026', () => 'xong'), 'Q1/2027');

G('So với tồn kho');
const th = _duTruTongHop(r1.rows, Q4, () => 1)[0];
T('tổng 4 quý', th.tong, 2);
T('thừa/thiếu = tồn − tổng', th.thuaThieu, -1);
T('bắt đầu thiếu ở quý cộng dồn vượt tồn', th.quyThieu, 'Q3/2027');
T('đủ hàng → không có quý thiếu', _duTruTongHop(r1.rows, Q4, () => 5)[0].quyThieu, null);

console.log('\n' + (total - fail) + '/' + total + ' ok' + (fail ? ' — ' + fail + ' FAIL' : ''));
process.exit(fail ? 1 : 0);
