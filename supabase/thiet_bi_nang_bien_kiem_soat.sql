-- ============================================================
--  THIẾT BỊ NÂNG — BỔ SUNG CỘT "BIỂN KIỂM SOÁT"
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Dành cho người đã chạy thiet_bi_nang.sql ở bản TRƯỚC khi có ô nhập
--  Biển kiểm soát. Chạy 1 lần trong Supabase → SQL Editor.
--  An toàn khi chạy lại, không đụng tới dữ liệu đã nhập.
--
--  ⚠️ VÌ SAO PHẢI CHẠY
--     Giao diện gửi lên cả trường bien_kiem_soat. Bảng chưa có cột này thì
--     PostgREST từ chối NGUYÊN CẢ bản ghi — thêm/sửa thiết bị sẽ không lên
--     được máy chủ (dữ liệu chỉ còn trong máy người dùng), mà lỗi lại im
--     lặng vì module bắt lỗi để không chặn thao tác.
--
--  (Nếu chạy lại toàn bộ thiet_bi_nang.sql bản mới thì KHÔNG cần file này —
--   trong đó đã có sẵn câu lệnh y hệt.)
-- ============================================================
alter table public."ThietBi_ThietBiNang"
  add column if not exists bien_kiem_soat text;

-- Kiểm tra: phải thấy dòng bien_kiem_soat | text
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name  = 'ThietBi_ThietBiNang'
  and column_name = 'bien_kiem_soat';
