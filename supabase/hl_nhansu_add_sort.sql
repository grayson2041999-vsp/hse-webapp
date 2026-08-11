-- ============================================================
--  HL_NHANSU — Bổ sung cột cho trang Huấn luyện - Đào tạo
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Mục đích:
--    1) "sort"    : lưu thứ tự kéo–thả nhân sự (đồng bộ giữa các máy)
--    2) "subType" : loại T-BOSIET / T-FOET (tab BOSIET/FOET)
--                   — thêm cho chắc vì code có ghi trường này.
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại
--  (dùng "if not exists").
--
--  GHI CHÚ: Trang vẫn hoạt động bình thường nếu CHƯA chạy file này
--  (thứ tự được lưu tạm trên localStorage của trình duyệt). Chạy file
--  này để thứ tự & loại đồng bộ lên Supabase cho mọi người dùng.
-- ============================================================

alter table public.hl_nhansu add column if not exists "sort"    bigint;
alter table public.hl_nhansu add column if not exists "subType" text;

-- Kiểm tra:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'hl_nhansu'
order by ordinal_position;
