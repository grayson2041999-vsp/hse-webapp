-- ============================================================
--  BẬT REALTIME cho các bảng HSE Webapp (Cấp phát BHLĐ)
--  Chạy 1 lần trong Supabase → SQL Editor.
--  An toàn khi chạy lại nhiều lần (idempotent).
--
--  Sau khi chạy, các thao tác thêm/sửa/xoá nhân sự, phiếu cấp
--  phát quý, phiếu nhân viên mới và thông báo sẽ tự cập nhật
--  realtime trên mọi máy đang mở app.
-- ============================================================
do $$
declare
  t text;
  tables text[] := array[
    'nhanvien',
    'phieu_requests',
    'pending_changes',
    'notifications',
    'nhom_nv',
    'cap_phat_tien_trinh'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'Bỏ qua: bảng public.% không tồn tại', t;
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Đã bật realtime cho public.%', t;
    else
      raise notice 'Đã bật sẵn: public.%', t;
    end if;
  end loop;
end $$;

-- Kiểm tra kết quả:
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
