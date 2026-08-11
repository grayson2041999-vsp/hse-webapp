-- ============================================================
--  HL_NHANSU + HL_SETTINGS — Chính sách RLS (đọc/ghi)
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Dùng khi: import dữ liệu vào bảng nhưng web app KHÔNG hiển thị
--  (anon key bị RLS chặn SELECT). File này bật RLS và cấp:
--    - Ai cũng XEM được (kể cả khách chưa đăng nhập / anon)
--    - Người đã đăng nhập (authenticated) được thêm/sửa/xoá
--
--  An toàn khi chạy lại (drop policy if exists trước khi tạo).
--  Chạy trong Supabase → SQL Editor của ĐÚNG project mà web app dùng
--  (project ref: wvohlxxeatwirbusbtnj).
-- ============================================================

-- ---------- hl_nhansu ----------
alter table public.hl_nhansu enable row level security;

drop policy if exists "hl_nhansu_select_all" on public.hl_nhansu;
create policy "hl_nhansu_select_all"
  on public.hl_nhansu for select
  using (true);

drop policy if exists "hl_nhansu_write_auth" on public.hl_nhansu;
create policy "hl_nhansu_write_auth"
  on public.hl_nhansu for all
  to authenticated
  using (true)
  with check (true);

-- ---------- hl_settings (thời hạn huấn luyện) ----------
alter table public.hl_settings enable row level security;

drop policy if exists "hl_settings_select_all" on public.hl_settings;
create policy "hl_settings_select_all"
  on public.hl_settings for select
  using (true);

drop policy if exists "hl_settings_write_auth" on public.hl_settings;
create policy "hl_settings_write_auth"
  on public.hl_settings for all
  to authenticated
  using (true)
  with check (true);

-- Kiểm tra:
select tablename, policyname, cmd, roles
from pg_policies
where tablename in ('hl_nhansu','hl_settings')
order by tablename, policyname;

select count(*) as tong_nhansu from public.hl_nhansu;
