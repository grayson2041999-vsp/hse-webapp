/* =========================================================
 *  04_doi_ten_tai_nan_su_co.sql
 *  tnsc_gio_cong → "TaiNan-SuCo_GioCong"
 *  tnsc_su_kien  → "TaiNan-SuCo_SuKien"
 *
 *  Đây chỉ là ĐỔI TÊN. Postgres giữ nguyên toàn bộ:
 *  dữ liệu, khoá chính, index, RLS policy, quyền GRANT.
 *  Không có dòng nào bị đụng tới.
 *
 *  ⚠️  TÊN CÓ DẤU GẠCH NGANG → LUÔN LUÔN phải có nháy kép:
 *        select * from public."TaiNan-SuCo_SuKien";   ✅
 *        select * from public.TaiNan-SuCo_SuKien;     ❌ lỗi cú pháp
 *
 *  ⚠️  KHÁC VỚI LẦN TRƯỚC: bảng cũ BIẾN MẤT ngay lập tức.
 *      Trang Tai nạn – Sự cố trên GitHub Pages sẽ lỗi cho đến khi
 *      bạn push db.js mới. Hãy chạy vào lúc không ai dùng.
 * ========================================================= */

begin;

/* ── Chặn trước: tên mới đã bị chiếm chưa ── */
do $$
begin
  if to_regclass('public."TaiNan-SuCo_GioCong"') is not null then
    raise exception 'DỪNG: bảng "TaiNan-SuCo_GioCong" đã tồn tại.';
  end if;
  if to_regclass('public."TaiNan-SuCo_SuKien"') is not null then
    raise exception 'DỪNG: bảng "TaiNan-SuCo_SuKien" đã tồn tại.';
  end if;
  if to_regclass('public.tnsc_gio_cong') is null then
    raise exception 'DỪNG: không tìm thấy bảng tnsc_gio_cong.';
  end if;
  if to_regclass('public.tnsc_su_kien') is null then
    raise exception 'DỪNG: không tìm thấy bảng tnsc_su_kien.';
  end if;
end $$;

/* ── Đổi tên ── */
alter table public.tnsc_gio_cong rename to "TaiNan-SuCo_GioCong";
alter table public.tnsc_su_kien  rename to "TaiNan-SuCo_SuKien";

commit;

/* ── Báo PostgREST nạp lại schema ── */
notify pgrst, 'reload schema';

/* ── Kiểm tra kết quả ──
   Số dòng phải đúng như trước, và mỗi bảng phải còn đủ RLS policy. */
select
  c.relname                                             as bang,
  c.relrowsecurity                                      as rls_bat,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as so_policy,
  (select count(*) from pg_indexes i
    where i.schemaname = 'public' and i.tablename = c.relname) as so_index
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('TaiNan-SuCo_GioCong','TaiNan-SuCo_SuKien')
order by c.relname;

select 'TaiNan-SuCo_GioCong' as bang, count(*) as so_dong from public."TaiNan-SuCo_GioCong"
union all
select 'TaiNan-SuCo_SuKien',          count(*)            from public."TaiNan-SuCo_SuKien";

/* Ghi chú: tên các RLS policy và khoá chính vẫn giữ tiền tố tnsc_ cũ.
   Điều này hoàn toàn vô hại — chúng bám theo bảng, không bám theo tên. */
