/* =========================================================
 *  08_doi_ten_3_nhom.sql — Svodka, Huấn luyện, Báo cháy
 *
 *    svodka_tacvu        → "Svodka_TacVu"
 *    svodka_buoc         → "Svodka_Buoc"
 *    svodka_matkhau      → "Svodka_MatKhau"
 *    hl_nhansu           → "HuanLuyen-DaoTao_NhanSu"
 *    hl_settings         → "HuanLuyen-DaoTao_CaiDat"
 *    pccc_devices        → "HTBCTD_ThietBi"
 *    pccc_errors         → "HTBCTD_Loi"
 *    pccc_locked_months  → "HTBCTD_ThangDaKhoa"
 *
 *  Chỉ đổi tên. Giữ nguyên dữ liệu, khoá chính, khoá ngoại, index,
 *  RLS policy, quyền GRANT. Cả 8 trong MỘT transaction.
 *
 *  Ghi chú: svodka_buoc và svodka_matkhau có khoá ngoại trỏ tới
 *  svodka_tacvu. Khoá ngoại bám theo bảng chứ không bám theo tên
 *  nên vẫn nguyên vẹn sau khi đổi.
 *
 *  ⚠️  "HuanLuyen-DaoTao_*" có DẤU GẠCH NGANG và chữ hoa → mọi câu SQL
 *      viết tay sau này BẮT BUỘC phải có nháy kép, nếu không Postgres
 *      sẽ hiểu dấu gạch ngang là phép trừ.
 *
 *  ⚠️  Bảng cũ biến mất ngay. Ba trang tương ứng trên Vercel sẽ lỗi
 *      cho tới khi push code mới. Chạy lúc vắng người.
 * ========================================================= */

begin;

/* ── Chặn trước ── */
do $$
declare
  cu  text[] := array['svodka_tacvu','svodka_buoc','svodka_matkhau',
                      'hl_nhansu','hl_settings',
                      'pccc_devices','pccc_errors','pccc_locked_months'];
  moi text[] := array['Svodka_TacVu','Svodka_Buoc','Svodka_MatKhau',
                      'HuanLuyen-DaoTao_NhanSu','HuanLuyen-DaoTao_CaiDat',
                      'HTBCTD_ThietBi','HTBCTD_Loi','HTBCTD_ThangDaKhoa'];
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
  raise notice 'Kiểm tra trước: 8 bảng nguồn đều có, 8 tên đích đều trống.';
end $$;

/* ── Đổi tên ── */
alter table public.svodka_tacvu       rename to "Svodka_TacVu";
alter table public.svodka_buoc        rename to "Svodka_Buoc";
alter table public.svodka_matkhau     rename to "Svodka_MatKhau";
alter table public.hl_nhansu          rename to "HuanLuyen-DaoTao_NhanSu";
alter table public.hl_settings        rename to "HuanLuyen-DaoTao_CaiDat";
alter table public.pccc_devices       rename to "HTBCTD_ThietBi";
alter table public.pccc_errors        rename to "HTBCTD_Loi";
alter table public.pccc_locked_months rename to "HTBCTD_ThangDaKhoa";

/* ── Đối chiếu ── */
do $$
declare n int;
begin
  select count(*) into n
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname='public'
    and c.relname in ('Svodka_TacVu','Svodka_Buoc','Svodka_MatKhau',
                      'HuanLuyen-DaoTao_NhanSu','HuanLuyen-DaoTao_CaiDat',
                      'HTBCTD_ThietBi','HTBCTD_Loi','HTBCTD_ThangDaKhoa');
  if n <> 8 then
    raise exception 'DỪNG: chỉ thấy %/8 bảng sau khi đổi tên.', n;
  end if;
  raise notice 'Đã đổi tên đủ 8 bảng.';
end $$;

commit;

notify pgrst, 'reload schema';

/* ── Xem lại: RLS, policy, khoá chính (nhớ 2 bảng có khoá chính đặc biệt) ── */
select
  c.relname                                              as bang,
  c.relrowsecurity                                       as rls_bat,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.tablename=c.relname) as so_policy,
  (select pg_get_constraintdef(con.oid) from pg_constraint con
    where con.conrelid = c.oid and con.contype = 'p')      as khoa_chinh
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname='public'
  and c.relname in ('Svodka_TacVu','Svodka_Buoc','Svodka_MatKhau',
                    'HuanLuyen-DaoTao_NhanSu','HuanLuyen-DaoTao_CaiDat',
                    'HTBCTD_ThietBi','HTBCTD_Loi','HTBCTD_ThangDaKhoa')
order by c.relname;
