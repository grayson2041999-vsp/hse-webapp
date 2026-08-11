-- ============================================================
--  BẢNG test_baseline — Mặc định ban đầu cho CHẾ ĐỘ TEST
--  Lưu 1 "ảnh chụp" (snapshot) danh sách nhân viên đơn vị Test.
--  Khi bấm "Trả về mặc định ban đầu", app khôi phục đúng snapshot này.
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  Cột dùng camelCase (khớp dữ liệu app gửi qua HSE_SB):
--    id (luôn = 'Test'), data (JSON mảng nhân viên), "updatedBy", "updatedAt"
-- ============================================================
create table if not exists public.test_baseline (
  id          text primary key,   -- luôn là 'Test'
  data        text,               -- JSON.stringify(mảng nhân viên Test)
  "updatedBy" text,
  "updatedAt" text
);

-- Bật RLS + policy cho phép đọc/ghi (khớp cách app dùng anon key + Supabase Auth)
alter table public.test_baseline enable row level security;
drop policy if exists test_baseline_all on public.test_baseline;
create policy test_baseline_all on public.test_baseline
  for all using (true) with check (true);

-- (tuỳ chọn) Bật realtime để đồng bộ tức thời trên mọi máy
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='test_baseline'
  ) then
    execute 'alter publication supabase_realtime add table public.test_baseline';
  end if;
end $$;

-- Kiểm tra:
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='test_baseline' order by ordinal_position;
