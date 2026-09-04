const fs = require('fs'), vm = require('vm');

let calls = [];
function mkQ(rec) {
  const q = {
    select(){ rec.ops.push('select'); return q; },
    match(o){ rec.ops.push('match'); rec.filters.push(o); return q; },
    eq(c,v){ rec.ops.push('eq'); rec.eq.push([c,v]); return q; },
    not(c,op,v){ rec.ops.push('not'); rec.not=[c,op,v]; return q; },
    maybeSingle(){ rec.ops.push('maybeSingle'); rec.single=true; return q; },
    upsert(d,o){ rec.ops.push('upsert'); rec.payload=d; rec.onConflict=o&&o.onConflict; return q; },
    update(d){ rec.ops.push('update'); rec.payload=d; return q; },
    insert(d){ rec.ops.push('insert'); rec.payload=d; return q; },
    delete(){ rec.ops.push('delete'); return q; },
    then(res,rej){ return Promise.resolve({ data: rec.single ? {id:'X'} : [], error:null }).then(res,rej); }
  };
  return q;
}
const sb = { from(t){ const rec={table:t,ops:[],filters:[],eq:[],payload:null}; calls.push(rec); return mkQ(rec); } };

const store = {};
const ctx = {
  window: { HSE_SB: sb, addEventListener(){}, dispatchEvent(){} },
  localStorage: {
    length:0, key(){return null;},
    getItem(k){ return k in store ? store[k] : null; },
    setItem(k,v){ store[k]=String(v); }, removeItem(k){ delete store[k]; }
  },
  console, Promise, Object, Date, Math, JSON, String, Array, setTimeout, clearTimeout, setInterval, clearInterval
};
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/db.js','utf8') + '\n;this.DB=DB;', ctx);
const DB = ctx.DB;

let pass=0, fail=0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}
const last = () => calls[calls.length-1];
const hasFilter = (r,o) => r.filters.some(f => JSON.stringify(f) === JSON.stringify(o));

(async () => {
console.log('\n── ĐỌC ──');
calls=[]; await DB.getAll('ke_hoach_mot_lan');
check('getAll(mot_lan) → bảng "KeHoach"', last().table === 'KeHoach', last().table);
check('getAll(mot_lan) → lọc loai=mot_lan', hasFilter(last(), {loai:'mot_lan'}), last().filters);

calls=[]; await DB.getAll('ke_hoach_lap_lai');
check('getAll(lap_lai) → lọc loai=lap_lai', hasFilter(last(), {loai:'lap_lai'}), last().filters);

calls=[]; await DB.getAll('nhanvien');
check('getAll(nhanvien) → không đổi, không lọc', last().table==='nhanvien' && last().filters.length===0, last());

calls=[]; await DB.getAll('users');
check('getAll(users) → profiles (ánh xạ cũ còn nguyên)', last().table==='profiles', last().table);

calls=[]; await DB.getAll('ke_hoach_mot_lan', { status:'Đã hoàn thành' });
check('getAll + where → cộng dồn 2 điều kiện',
      hasFilter(last(),{loai:'mot_lan'}) && hasFilter(last(),{status:'Đã hoàn thành'}), last().filters);

console.log('\n── GHI ──');
calls=[]; await DB.insert('ke_hoach_lap_lai', { name:'KH định kỳ' });
check('insert → bảng "KeHoach"', last().table==='KeHoach', last().table);
check('insert → tự gắn loai=lap_lai', last().payload.loai==='lap_lai', last().payload);
check('insert → tự sinh id', !!last().payload.id, last().payload);

calls=[]; await DB.update('ke_hoach_mot_lan','abc123',{ name:'sửa' });
check('update → gắn loai vào dữ liệu', last().payload.loai==='mot_lan', last().payload);
check('update → khoá theo id', last().eq.some(e=>e[0]==='id'&&e[1]==='abc123'), last().eq);
check('update → GIỚI HẠN trong nhóm mot_lan', hasFilter(last(),{loai:'mot_lan'}), last().filters);

calls=[]; await DB.delete('ke_hoach_mot_lan','abc123');
check('delete → GIỚI HẠN trong nhóm mot_lan', hasFilter(last(),{loai:'mot_lan'}), last().filters);

console.log('\n── bulkWrite (chỗ nguy hiểm nhất) ──');
calls=[]; await DB.bulkWrite('ke_hoach_mot_lan', [{id:'a',name:'1'},{id:'b',name:'2'}]);
const up = calls.find(c=>c.ops.includes('upsert'));
const del = calls.find(c=>c.ops.includes('delete'));
check('bulkWrite → upsert vào "KeHoach"', up && up.table==='KeHoach', up && up.table);
check('bulkWrite → mọi dòng đều có loai', up && up.payload.every(r=>r.loai==='mot_lan'), up && up.payload);
check('bulkWrite → XOÁ bị giới hạn trong loai=mot_lan', del && hasFilter(del,{loai:'mot_lan'}), del && del.filters);
check('bulkWrite → vẫn giữ điều kiện not-in id', del && del.not && del.not[1]==='in', del && del.not);

console.log('\n── Tai nạn - Sự cố (chỉ đổi tên) ──');
calls=[]; await DB.getAll('tnsc_gio_cong');
check('getAll(tnsc_gio_cong) → "TaiNan-SuCo_GioCong"', last().table==='TaiNan-SuCo_GioCong', last().table);
check('getAll(tnsc_gio_cong) → KHÔNG lọc (2 bảng riêng)', last().filters.length===0, last().filters);

calls=[]; await DB.getAll('tnsc_su_kien');
check('getAll(tnsc_su_kien) → "TaiNan-SuCo_SuKien"', last().table==='TaiNan-SuCo_SuKien', last().table);

calls=[]; await DB.insert('tnsc_su_kien', { ten:'thu', loai:'tai_nan_lao_dong' });
check('insert(tnsc_su_kien) → đúng bảng', last().table==='TaiNan-SuCo_SuKien', last().table);
check('insert → cột loai sẵn có KHÔNG bị ghi đè', last().payload.loai==='tai_nan_lao_dong', last().payload);

calls=[]; await DB.update('tnsc_su_kien','id9',{ ten:'sua' });
check('update(tnsc_su_kien) → không thêm điều kiện lọc thừa', last().filters.length===0, last().filters);

calls=[]; await DB.delete('tnsc_gio_cong','abc');
check('delete(tnsc_gio_cong) → chỉ khoá theo id', last().filters.length===0 && last().eq.some(e=>e[0]==='id'), last());

console.log('\n── SOP (đổi tên hoa/thường) ──');
calls=[]; await DB.getAll('sop');
check('getAll(sop) → bảng "SOP" viết hoa', last().table==='SOP', last().table);
check('getAll(sop) → không lọc', last().filters.length===0, last().filters);

calls=[]; await DB.bulkWrite('sop', [{id:'s1',ma:'QT-01'},{id:'s2',ma:'QT-02'}]);
const upS = calls.find(c=>c.ops.includes('upsert'));
const delS = calls.find(c=>c.ops.includes('delete'));
check('bulkWrite(sop) → upsert vào "SOP"', upS && upS.table==='SOP', upS && upS.table);
check('bulkWrite(sop) → xoá KHÔNG bị giới hạn thừa', delS && delS.filters.length===0, delS && delS.filters);
check('bulkWrite(sop) → vẫn giữ not-in id', delS && delS.not && delS.not[1]==='in', delS && delS.not);

// Đây là lỗi đã sửa: testConnection từng hardcode from("sop"), bỏ qua lớp ánh xạ
calls=[]; await DB.testConnection();
check('testConnection() → dùng "SOP" chứ không phải sop', last().table==='SOP', last().table);

console.log('\n── Sáu bảng đổi tên đợt 6 ──');
const doiTen = {
  ksk:            'KhamSucKhoe',
  moi_truong:     'XuLyChatThai',
  nha_thau:       'NhaThau',
  binh_ap_luc:    'ThietBi_BinhApLuc',
  kiem_tra_cap12: 'KiemTraCacCap_12',
  kiem_tra_cap34: 'KiemTraCacCap_34'
};
for (const [cu, moi] of Object.entries(doiTen)) {
  calls=[]; await DB.getAll(cu);
  check('getAll('+cu+') → "'+moi+'"', last().table===moi, last().table);
  check('  '+cu+' không bị gắn bộ lọc thừa', last().filters.length===0, last().filters);
}

// bulkWrite là chỗ nguy hiểm nhất: các bảng này KHÔNG dùng chung bảng vật lý
// nên phạm vi xoá phải là toàn bảng, không được có điều kiện lọc nào thêm.
calls=[]; await DB.bulkWrite('kiem_tra_cap12', [{id:'k1'},{id:'k2'}]);
const upK  = calls.find(c=>c.ops.includes('upsert'));
const delK = calls.find(c=>c.ops.includes('delete'));
check('bulkWrite(kiem_tra_cap12) → upsert đúng bảng', upK && upK.table==='KiemTraCacCap_12', upK && upK.table);
check('bulkWrite(kiem_tra_cap12) → xoá không bị giới hạn thừa', delK && delK.filters.length===0, delK && delK.filters);

// cap12 và cap34 là hai bảng RIÊNG, thao tác bên này không được chạm bên kia
calls=[]; await DB.delete('kiem_tra_cap34','x9');
check('delete(cap34) → đúng bảng cap34, không đụng cap12', last().table==='KiemTraCacCap_34', last().table);

console.log('\n── Không ảnh hưởng bảng khác ──');
calls=[]; await DB.update('hl_settings','huanluyen',{ warn_days:30 });
check('hl_settings vẫn dùng PK "loai" làm khoá', last().eq.some(e=>e[0]==='loai'&&e[1]==='huanluyen'), last().eq);
check('hl_settings KHÔNG bị gắn filter', last().filters.length===0, last().filters);
check('hl_settings không bị đổi tên bảng', last().table==='hl_settings', last().table);

console.log('\n' + (fail===0 ? '🎉 TẤT CẢ ' + pass + ' KIỂM TRA ĐỀU ĐẠT' : '⚠️  ' + fail + ' lỗi / ' + (pass+fail) + ' kiểm tra'));
process.exit(fail ? 1 : 0);
})();
