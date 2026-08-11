-- ============================================================
--  BẢNG size_chart — Tra cứu kích cỡ quần áo (kèm ảnh thông số)
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  Cột dùng camelCase (khớp dữ liệu app gửi qua bhld-sync.js):
--    id, ten, anh (ảnh base64 dataURL), "createdAt", "updatedAt"
-- ============================================================
create table if not exists public.size_chart (
  id          text primary key,
  ten         text,
  anh         text,
  "createdAt" text,
  "updatedAt" text
);

-- Bật RLS + policy cho phép đọc/ghi (khớp cách app dùng anon key + Supabase Auth)
alter table public.size_chart enable row level security;
drop policy if exists size_chart_all on public.size_chart;
create policy size_chart_all on public.size_chart
  for all using (true) with check (true);

-- (tuỳ chọn) Bật realtime để đồng bộ tức thời trên mọi máy
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='size_chart'
  ) then
    execute 'alter publication supabase_realtime add table public.size_chart';
  end if;
end $$;

-- Kiểm tra:
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='size_chart' order by ordinal_position;
