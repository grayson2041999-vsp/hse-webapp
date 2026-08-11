-- ============================================================
--  SVODKA — Nhập thông tin an toàn trên Svodka
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Admin lưu các trang nhập thông tin lên hệ thống Svodka:
--    - Tác vụ nhập + link + tài khoản + mật khẩu
--    - Các bước hướng dẫn (workflow) cho từng tác vụ
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  BẢO MẬT MẬT KHẨU (quan trọng):
--    Mật khẩu KHÔNG nằm trong bảng tác vụ. Nó ở bảng riêng
--    (svodka_matkhau) với RLS chỉ cho role admin/user ĐỌC.
--    → Viewer và khách chưa đăng nhập gọi API cũng không lấy
--      được chuỗi mật khẩu (không chỉ ẩn ở giao diện).
-- ============================================================

-- Hàm tiện ích: lấy role của người đang đăng nhập từ profiles
create or replace function public.hse_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'anon');
$$;

-- ============================================================
-- 1) BẢNG TÁC VỤ NHẬP  (không chứa mật khẩu)
-- ============================================================
create table if not exists public.svodka_tacvu (
  id         text primary key,
  name       text not null,               -- tên tác vụ nhập
  link       text,                         -- link trang nhập
  account    text,                         -- tài khoản đăng nhập
  sort_order int  not null default 0,      -- thứ tự hiển thị
  updated_at timestamptz not null default now()
);

alter table public.svodka_tacvu enable row level security;

-- Ai cũng XEM được tác vụ (viewer + khách)
drop policy if exists "svodka_tacvu_select_all" on public.svodka_tacvu;
create policy "svodka_tacvu_select_all"
  on public.svodka_tacvu for select using (true);

-- Chỉ ADMIN thêm/sửa/xoá
drop policy if exists "svodka_tacvu_admin_write" on public.svodka_tacvu;
create policy "svodka_tacvu_admin_write"
  on public.svodka_tacvu for all
  to authenticated
  using (public.hse_current_role() = 'admin')
  with check (public.hse_current_role() = 'admin');

-- ============================================================
-- 2) BẢNG MẬT KHẨU  (tách riêng — RLS chặt)
--    1 tác vụ ↔ 1 mật khẩu (khoá chính = tacvu_id)
-- ============================================================
create table if not exists public.svodka_matkhau (
  tacvu_id   text primary key references public.svodka_tacvu(id) on delete cascade,
  password   text,
  updated_at timestamptz not null default now()
);

alter table public.svodka_matkhau enable row level security;

-- CHỈ admin/user (đã đăng nhập) ĐỌC được mật khẩu.
-- Viewer (role='viewer') và khách (anon) → không có quyền → trả 0 dòng.
drop policy if exists "svodka_matkhau_select_priv" on public.svodka_matkhau;
create policy "svodka_matkhau_select_priv"
  on public.svodka_matkhau for select
  to authenticated
  using (public.hse_current_role() in ('admin','user'));

-- Chỉ ADMIN thêm/sửa/xoá mật khẩu
drop policy if exists "svodka_matkhau_admin_write" on public.svodka_matkhau;
create policy "svodka_matkhau_admin_write"
  on public.svodka_matkhau for all
  to authenticated
  using (public.hse_current_role() = 'admin')
  with check (public.hse_current_role() = 'admin');

-- ============================================================
-- 3) BẢNG CÁC BƯỚC HƯỚNG DẪN (workflow)
-- ============================================================
create table if not exists public.svodka_buoc (
  id         text primary key,
  tacvu_id   text not null references public.svodka_tacvu(id) on delete cascade,
  content    text not null,               -- nội dung bước
  sort_order int  not null default 0,      -- thứ tự bước
  updated_at timestamptz not null default now()
);

create index if not exists svodka_buoc_tacvu_idx on public.svodka_buoc(tacvu_id);

alter table public.svodka_buoc enable row level security;

-- Ai cũng XEM được các bước
drop policy if exists "svodka_buoc_select_all" on public.svodka_buoc;
create policy "svodka_buoc_select_all"
  on public.svodka_buoc for select using (true);

-- Chỉ ADMIN thêm/sửa/xoá bước
drop policy if exists "svodka_buoc_admin_write" on public.svodka_buoc;
create policy "svodka_buoc_admin_write"
  on public.svodka_buoc for all
  to authenticated
  using (public.hse_current_role() = 'admin')
  with check (public.hse_current_role() = 'admin');

-- ============================================================
-- KIỂM TRA
-- ============================================================
-- select * from public.svodka_tacvu order by sort_order;
-- select * from public.svodka_buoc order by tacvu_id, sort_order;
-- select * from public.svodka_matkhau;   -- chỉ admin/user thấy dữ liệu
