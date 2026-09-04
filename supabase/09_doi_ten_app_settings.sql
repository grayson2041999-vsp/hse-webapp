/* =========================================================
 *  09_doi_ten_app_settings.sql
 *    app_settings → "TraCuuATVSLD"
 *
 *  Bảng key-value, hiện chỉ phục vụ tab Tra cứu ATVSLĐ
 *  (một dòng: key = 'notebooklm_atvsld').
 *
 *  Chỉ đổi tên. Khoá chính vẫn là cột "key" — db.js tra khoá theo
 *  TÊN LOGIC (app_settings) nên không cần sửa gì thêm ở đó.
 *
 *  ⚠️  Tên các RLS policy vẫn giữ tiền tố app_settings_ cũ. Vô hại,
 *      chúng bám theo bảng chứ không bám theo tên.
 * ========================================================= */

begin;

do $$
begin
  if to_regclass('public.app_settings') is null then
    raise exception 'DỪNG: không tìm thấy bảng app_settings.';
  end if;
  if to_regclass('public."TraCuuATVSLD"') is not null then
    raise exception 'DỪNG: bảng "TraCuuATVSLD" đã tồn tại.';
  end if;
end $$;

alter table public.app_settings rename to "TraCuuATVSLD";

commit;

notify pgrst, 'reload schema';

/* ── Kiểm tra: khoá chính phải vẫn là (key) ── */
select
  c.relname                                               as bang,
  c.relrowsecurity                                        as rls_bat,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname) as so_policy,
  (select pg_get_constraintdef(con.oid) from pg_constraint con
    where con.conrelid = c.oid and con.contype='p')        as khoa_chinh
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname='public' and c.relname='TraCuuATVSLD';

select key, left(value, 60) as value_rut_gon from public."TraCuuATVSLD" order by key;
