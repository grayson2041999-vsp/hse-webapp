/* =========================================================
 *  07_doi_ten_bhld.sql — Đợt 2 của trang Cấp phát BHLĐ
 *  Đổi tên 15 bảng sang tiền tố "CapPhatBHLD_".
 *
 *  Chỉ đổi tên. Postgres giữ nguyên dữ liệu, khoá chính, khoá ngoại,
 *  index, RLS policy, quyền GRANT — và giữ nguyên cả tư cách thành viên
 *  trong publication supabase_realtime (realtime bám theo bảng, không
 *  bám theo tên), nên 6 kênh realtime vẫn chạy sau khi đổi.
 *
 *  Cả 15 nằm trong MỘT transaction: lỗi ở bất kỳ bảng nào thì huỷ sạch.
 *
 *  ⚠️  Tên có chữ hoa → mọi câu SQL viết tay sau này phải có nháy kép.
 *  ⚠️  Bảng cũ biến mất ngay. Trang Cấp phát BHLĐ trên Vercel sẽ lỗi
 *      cho tới khi bạn push code mới. Chạy lúc vắng người.
 * ========================================================= */

begin;

/* ── Chặn trước ── */
do $$
declare
  cu  text[] := array['nhanvien','danh_muc','dinh_muc','chuc_danh','lich_su_nhap_xuat',
                      'cap_phat_tien_trinh','nhom_nv','nhom_tb','notifications',
                      'pending_changes','phieu_requests','quy_list','size_chart',
                      'ton_kho','test_baseline'];
  moi text[] := array['CapPhatBHLD_NhanVien','CapPhatBHLD_DanhMuc','CapPhatBHLD_DinhMuc',
                      'CapPhatBHLD_ChucDanh','CapPhatBHLD_LichSuNhapXuat',
                      'CapPhatBHLD_TienTrinh','CapPhatBHLD_NhomNhanVien',
                      'CapPhatBHLD_NhomTrangBi','CapPhatBHLD_ThongBao',
                      'CapPhatBHLD_ChoDuyet','CapPhatBHLD_PhieuYeuCau',
                      'CapPhatBHLD_DanhSachQuy','CapPhatBHLD_BangSize',
                      'CapPhatBHLD_TonKho','CapPhatBHLD_Test'];
  i int;
begin
  for i in 1..array_length(cu,1) loop
    if to_regclass('public.' || quote_ident(cu[i])) is null then
      raise exception 'DỪNG: không tìm thấy bảng nguồn public.%', cu[i];
    end if;
    if to_regclass('public.' || quote_ident(moi[i])) is not null then
      raise exception 'DỪNG: tên đích public.% đã tồn tại', moi[i];
    end if;
  end loop;
  raise notice 'Kiểm tra trước: 15 bảng nguồn đều có, 15 tên đích đều trống.';
end $$;

/* ── Đổi tên ── */
alter table public.nhanvien            rename to "CapPhatBHLD_NhanVien";
alter table public.danh_muc            rename to "CapPhatBHLD_DanhMuc";
alter table public.dinh_muc            rename to "CapPhatBHLD_DinhMuc";
alter table public.chuc_danh           rename to "CapPhatBHLD_ChucDanh";
alter table public.lich_su_nhap_xuat   rename to "CapPhatBHLD_LichSuNhapXuat";
alter table public.cap_phat_tien_trinh rename to "CapPhatBHLD_TienTrinh";
alter table public.nhom_nv             rename to "CapPhatBHLD_NhomNhanVien";
alter table public.nhom_tb             rename to "CapPhatBHLD_NhomTrangBi";
alter table public.notifications       rename to "CapPhatBHLD_ThongBao";
alter table public.pending_changes     rename to "CapPhatBHLD_ChoDuyet";
alter table public.phieu_requests      rename to "CapPhatBHLD_PhieuYeuCau";
alter table public.quy_list            rename to "CapPhatBHLD_DanhSachQuy";
alter table public.size_chart          rename to "CapPhatBHLD_BangSize";
alter table public.ton_kho             rename to "CapPhatBHLD_TonKho";
alter table public.test_baseline       rename to "CapPhatBHLD_Test";

/* ── Đối chiếu sau khi đổi ── */
do $$
declare n int;
begin
  select count(*) into n
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relname like 'CapPhatBHLD\_%';
  if n <> 15 then
    raise exception 'DỪNG: chỉ thấy %/15 bảng sau khi đổi tên.', n;
  end if;
  raise notice 'Đã đổi tên đủ 15 bảng.';
end $$;

commit;

notify pgrst, 'reload schema';

/* ── Xem lại: RLS, số policy, số dòng ── */
select
  c.relname                                              as bang,
  c.relrowsecurity                                       as rls_bat,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname) as so_policy,
  (select n_live_tup from pg_stat_user_tables t
    where t.relname = c.relname)                          as so_dong_uoc_tinh
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname='public' and c.relname like 'CapPhatBHLD\_%'
order by c.relname;

/* ── QUAN TRỌNG: realtime phải hiện đúng 6 bảng với TÊN MỚI ──
   Nếu danh sách này trống hoặc thiếu, kênh realtime sẽ im lặng
   không báo lỗi mà cũng không nhận được sự kiện nào. */
select tablename as bang_co_realtime
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
