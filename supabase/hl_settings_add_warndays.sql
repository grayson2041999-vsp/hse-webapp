-- ============================================================
--  HL_SETTINGS — Bổ sung cột warn_days
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Mục đích: lưu "số ngày báo sắp hết hạn" cho từng nhóm huấn luyện
--  (Admin chỉnh trong ô "Sắp hết hạn" ở mỗi mục). Đồng bộ giữa các máy.
--
--  Chạy 1 lần trong SQL Editor của ĐÚNG project web app dùng
--  (project ref: wvohlxxeatwirbusbtnj). An toàn khi chạy lại.
--
--  GHI CHÚ: trang vẫn chạy nếu CHƯA chạy file này (số ngày lưu tạm
--  trên localStorage). Chạy để đồng bộ lên Supabase cho mọi người.
-- ============================================================

alter table public.hl_settings add column if not exists "warn_days" integer;

-- Kiểm tra:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'hl_settings'
order by ordinal_position;
