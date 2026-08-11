-- ============================================================
--  ACTIVITY FEED — Nhật ký hoạt động người dùng (kiểu Facebook)
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  Gồm:
--    1) Cột avatar_url trên bảng profiles
--    2) Bảng activity_log (nhật ký thao tác)
--    3) RLS: mọi người (kể cả Viewer) được XEM; user đăng nhập được GHI
--    4) Bật realtime cho activity_log
--    5) Bucket 'avatars' công khai + policy upload ảnh đại diện
-- ============================================================

-- 1) AVATAR ─────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text;

-- 2) BẢNG NHẬT KÝ ───────────────────────────────────────────
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid    references auth.users(id) on delete set null,
  username    text,                 -- snapshot: giữ lại dù profile đổi/xoá
  fullname    text,                 -- snapshot họ tên hiển thị
  avatar_url  text,                 -- snapshot ảnh đại diện lúc thao tác
  role        text,                 -- admin / user / viewer (snapshot)
  action      text not null,        -- mã hành động: create / update / delete / approve / close / complete / report ...
  module      text not null,        -- nhãn module: "Cấp phát BHLĐ", "PCCC", "Sự cố – tai nạn"...
  detail      text,                 -- mô tả ngắn: "đã tạo phiếu cấp phát Quý 3/2026"
  ref_table   text,                 -- bảng gốc (tuỳ chọn, để truy vết)
  ref_id      text,                 -- id bản ghi liên quan (tuỳ chọn)
  created_at  timestamptz not null default now()
);

-- Index cho feed "20 mục mới nhất"
create index if not exists activity_log_created_idx
  on public.activity_log (created_at desc);

-- 3) RLS ────────────────────────────────────────────────────
alter table public.activity_log enable row level security;

-- Ai cũng XEM được (Viewer, kể cả khách chưa đăng nhập nếu app cho phép)
drop policy if exists "activity_log_select_all" on public.activity_log;
create policy "activity_log_select_all"
  on public.activity_log for select
  using (true);

-- Chỉ user ĐÃ ĐĂNG NHẬP mới GHI, và chỉ ghi dòng của chính mình
drop policy if exists "activity_log_insert_own" on public.activity_log;
create policy "activity_log_insert_own"
  on public.activity_log for insert
  to authenticated
  with check (user_id = auth.uid());

-- Không cho sửa/xoá nhật ký (giữ tính toàn vẹn audit trail).
-- Nếu muốn Admin dọn dẹp, có thể thêm policy delete cho role admin sau.

-- 4) REALTIME ───────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_log'
  ) then
    execute 'alter publication supabase_realtime add table public.activity_log';
    raise notice 'Đã bật realtime cho public.activity_log';
  else
    raise notice 'activity_log đã bật realtime sẵn';
  end if;
end $$;

-- 5) STORAGE — ẢNH ĐẠI DIỆN ─────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Ai cũng xem được ảnh (bucket public)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- User đăng nhập được upload/ghi đè ảnh trong thư mục mang UID của mình:
--   đường dẫn dạng  <uid>/avatar.png
drop policy if exists "avatars_user_upload" on storage.objects;
create policy "avatars_user_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kiểm tra:
select 'activity_log' as obj, count(*) as rows from public.activity_log;
