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

console.log('\n── Không ảnh hưởng bảng khác ──');
calls=[]; await DB.update('hl_settings','huanluyen',{ warn_days:30 });
check('hl_settings vẫn dùng PK "loai" làm khoá', last().eq.some(e=>e[0]==='loai'&&e[1]==='huanluyen'), last().eq);
check('hl_settings KHÔNG bị gắn filter', last().filters.length===0, last().filters);
check('hl_settings không bị đổi tên bảng', last().table==='hl_settings', last().table);

console.log('\n' + (fail===0 ? '🎉 TẤT CẢ ' + pass + ' KIỂM TRA ĐỀU ĐẠT' : '⚠️  ' + fail + ' lỗi / ' + (pass+fail) + ' kiểm tra'));
process.exit(fail ? 1 : 0);
})();
