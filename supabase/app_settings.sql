-- ============================================================
--  "TraCuuATVSLD" — Bảng key-value (trước đây tên app_settings)
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Dùng cho: lưu link NotebookLM của tab "Tra cứu ATVSLĐ"
--  (và các cấu hình toàn hệ thống khác sau này).
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  RLS:
--    - Ai cũng XEM được (viewer, kể cả khách chưa đăng nhập)
--    - Chỉ ADMIN được thêm/sửa (kiểm tra role trong profiles)
-- ============================================================

create table if not exists public."TraCuuATVSLD" (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public."TraCuuATVSLD" enable row level security;

-- Ai cũng XEM được
drop policy if exists "app_settings_select_all" on public."TraCuuATVSLD";
create policy "app_settings_select_all"
  on public."TraCuuATVSLD" for select
  using (true);

-- Chỉ ADMIN được thêm
drop policy if exists "app_settings_admin_insert" on public."TraCuuATVSLD";
create policy "app_settings_admin_insert"
  on public."TraCuuATVSLD" for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Chỉ ADMIN được sửa
drop policy if exists "app_settings_admin_update" on public."TraCuuATVSLD";
create policy "app_settings_admin_update"
  on public."TraCuuATVSLD" for update
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Seed sẵn dòng link (rỗng) để admin điền
insert into public."TraCuuATVSLD" (key, value)
values ('notebooklm_atvsld', '')
on conflict (key) do nothing;

-- Kiểm tra:
select * from public."TraCuuATVSLD";
