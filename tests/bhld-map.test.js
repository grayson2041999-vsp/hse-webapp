/* Kiểm tra lớp ánh xạ tên bảng của trang Cấp phát BHLĐ.
   Trang này KHÔNG dùng db.js — nó có bảng ánh xạ riêng trong bhld-sync.js.
   Chạy: node tests/bhld-map.test.js                                        */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

let calls = [];
function mkQ(rec) {
  const q = {
    select(){ rec.ops.push('select'); return q; },
    eq(c,v){ rec.ops.push('eq'); rec.eq.push([c,v]); return q; },
    not(){ rec.ops.push('not'); return q; },
    upsert(d){ rec.ops.push('upsert'); rec.payload=d; return q; },
    update(d){ rec.ops.push('update'); rec.payload=d; return q; },
    insert(d){ rec.ops.push('insert'); rec.payload=d; return q; },
    delete(){ rec.ops.push('delete'); return q; },
    then(res,rej){ return Promise.resolve({ data: [], error: null, count: 0 }).then(res,rej); }
  };
  return q;
}
const sb = { from(t){ const rec={table:t,ops:[],eq:[],payload:null}; calls.push(rec); return mkQ(rec); } };

const store = {};
const ctx = {
  window: { HSE_SB: sb, addEventListener(){}, dispatchEvent(){} },
  localStorage: {
    getItem(k){ return k in store ? store[k] : null; },
    setItem(k,v){ store[k]=String(v); }, removeItem(k){ delete store[k]; }
  },
  console, Promise, Object, Date, Math, JSON, String, Array, setTimeout, clearTimeout
};
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/bhld-sync.js'),'utf8') + '\n;this.BHLD=BHLD;', ctx);
const BHLD = ctx.BHLD;

let pass=0, fail=0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}
const last = () => calls[calls.length-1];

const MONG_DOI = {
  nhanvien:            'CapPhatBHLD_NhanVien',
  danh_muc:            'CapPhatBHLD_DanhMuc',
  dinh_muc:            'CapPhatBHLD_DinhMuc',
  chuc_danh:           'CapPhatBHLD_ChucDanh',
  lich_su_nhap_xuat:   'CapPhatBHLD_LichSuNhapXuat',
  cap_phat_tien_trinh: 'CapPhatBHLD_TienTrinh',
  nhom_nv:             'CapPhatBHLD_NhomNhanVien',
  nhom_tb:             'CapPhatBHLD_NhomTrangBi',
  notifications:       'CapPhatBHLD_ThongBao',
  pending_changes:     'CapPhatBHLD_ChoDuyet',
  phieu_requests:      'CapPhatBHLD_PhieuYeuCau',
  quy_list:            'CapPhatBHLD_DanhSachQuy',
  size_chart:          'CapPhatBHLD_BangSize',
  ton_kho:             'CapPhatBHLD_TonKho',
  test_baseline:       'CapPhatBHLD_Test'
};

(async () => {
console.log('\n── Bảng ánh xạ ──');
check('BHLD.tbl được xuất ra ngoài', typeof BHLD.tbl === 'function');
for (const [cu, moi] of Object.entries(MONG_DOI)) {
  check(cu.padEnd(20) + '→ ' + moi, BHLD.tbl(cu) === moi, BHLD.tbl(cu));
}
check('profiles KHÔNG bị đổi (gắn với Auth)', BHLD.tbl('profiles') === 'profiles', BHLD.tbl('profiles'));
check('tên lạ thì giữ nguyên', BHLD.tbl('bang_la_hoac') === 'bang_la_hoac');

console.log('\n── Mọi đường ghi/đọc đều đi qua tbl() ──');
calls=[]; await BHLD.push.insert('nhanvien', { ten:'X' });
check('insert → ' + MONG_DOI.nhanvien, last().table === MONG_DOI.nhanvien, last().table);

calls=[]; await BHLD.push.update('ton_kho', 'id1', { sl: 5 });
check('update → ' + MONG_DOI.ton_kho, last().table === MONG_DOI.ton_kho, last().table);

calls=[]; await BHLD.push.delete('phieu_requests', 'id1');
check('delete → ' + MONG_DOI.phieu_requests, last().table === MONG_DOI.phieu_requests, last().table);

calls=[]; await BHLD.push.bulkReplace('ton_kho', [{id:'a'},{id:'b'}]);
check('bulkReplace → mọi lời gọi đều đúng bảng',
      calls.length > 0 && calls.every(c => c.table === MONG_DOI.ton_kho),
      calls.map(c=>c.table));

calls=[]; await BHLD.push.bulkAppend('lich_su_nhap_xuat', [{id:'a'}]);
check('bulkAppend → ' + MONG_DOI.lich_su_nhap_xuat, last().table === MONG_DOI.lich_su_nhap_xuat, last().table);

calls=[]; await BHLD.testConnection();
check('testConnection → ' + MONG_DOI.nhanvien, last().table === MONG_DOI.nhanvien, last().table);

calls=[]; await BHLD.pull();
const sai = calls.map(c=>c.table).filter(t => !t.startsWith('CapPhatBHLD_'));
check('pull → cả ' + calls.length + ' bảng đều dùng tên mới', sai.length === 0, sai);

console.log('\n── Không còn tên bảng viết cứng trong cap-phat-bhld.html ──');
const html = fs.readFileSync(path.join(ROOT,'cap-phat-bhld.html'),'utf8');
const cungFrom  = html.match(/\.from\('[a-zA-Z_0-9]+'\)/g) || [];
const cungTable = html.match(/table:\s*'[a-z_0-9]+'/g)      || [];
check('không còn .from("ten") viết cứng', cungFrom.length === 0, cungFrom);
check('không còn table:"ten" viết cứng (realtime)', cungTable.length === 0, cungTable);
check('có dùng BHLD.tbl() ở các kênh realtime', (html.match(/table:BHLD\.tbl\(/g)||[]).length === 6,
      (html.match(/table:BHLD\.tbl\(/g)||[]).length);

console.log('\n' + (fail===0 ? '🎉 TẤT CẢ ' + pass + ' KIỂM TRA ĐỀU ĐẠT' : '⚠️  ' + fail + ' lỗi / ' + (pass+fail)));
process.exit(fail ? 1 : 0);
})();
