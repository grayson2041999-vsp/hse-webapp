/* =========================================================
 *  05_doi_ten_sop.sql
 *  sop → "SOP"
 *
 *  Chỉ đổi tên. Postgres giữ nguyên dữ liệu, khoá chính,
 *  index, RLS policy và quyền GRANT.
 *
 *  ⚠️  Đây là đổi HOA/THƯỜNG. Với Postgres, sop và "SOP" là
 *      hai cái tên KHÁC NHAU, nên từ nay luôn phải có nháy kép:
 *        select * from public."SOP";   ✅
 *        select * from public.SOP;     ❌ Postgres hiểu là "sop"
 *
 *  ⚠️  Bảng cũ biến mất ngay. Mục SOP trên GitHub Pages sẽ lỗi
 *      cho đến khi bạn push db.js mới. Chạy lúc vắng người.
 * ========================================================= */

begin;

do $$
begin
  if to_regclass('public.sop') is null then
    raise exception 'DỪNG: không tìm thấy bảng sop.';
  end if;
  if to_regclass('public."SOP"') is not null then
    raise exception 'DỪNG: bảng "SOP" đã tồn tại.';
  end if;
end $$;

alter table public.sop rename to "SOP";

commit;

notify pgrst, 'reload schema';

/* ── Kiểm tra ── */
select
  c.relname                                              as bang,
  c.relrowsecurity                                       as rls_bat,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname) as so_policy,
  (select count(*) from public."SOP")                    as so_dong
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relname='SOP';
