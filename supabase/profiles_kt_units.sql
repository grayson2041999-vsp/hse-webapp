-- ============================================================
--  PROFILES — Bổ sung cột ktUnits (đơn vị được giao ở trang Kiểm tra các cấp)
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Mục đích: mỗi user có quyền trang "Kiểm tra các cấp" chỉ được NHẬP / SỬA
--  số liệu kiểm tra cấp 1, cấp 2 cho các đơn vị trong danh sách này.
--  Lưu TÊN đơn vị (giống cột capPhatUnits của trang Cấp phát BHLĐ).
--  Admin giao đơn vị ở Quản trị hệ thống → Người dùng, hoặc tab Phân công đơn vị.
--
--  Chạy 1 lần trong SQL Editor của ĐÚNG project web app dùng
--  (project ref: wvohlxxeatwirbusbtnj). An toàn khi chạy lại.
--
--  Tài khoản cũ: để TRỐNG (đã thống nhất 03/10/2026) — chưa được giao đơn vị
--  thì chỉ xem, Admin tự giao sau.
--
--  ⚠️ CHẠY FILE NÀY TRƯỚC khi đẩy code mới lên. Nếu chưa có cột, lưu phân
--  quyền ở trang Quản trị sẽ báo lỗi "column ktUnits does not exist".
-- ============================================================

alter table public.profiles
  add column if not exists "ktUnits" jsonb not null default '[]'::jsonb;

-- Kiểm tra:
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('perms', 'capPhatUnits', 'ktUnits');
