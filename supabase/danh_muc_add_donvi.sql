-- ============================================================
--  BỔ SUNG CỘT "donVi" (đơn vị tính) CHO BẢNG danh_muc
--
--  Lý do: ĐVT giờ thuộc TỪNG CHI TIẾT (mỗi chi tiết = 1 mã vật tư),
--  không còn suy từ nhóm nữa. Cần cột riêng để lưu đồng bộ.
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
-- ============================================================
alter table public.danh_muc
  add column if not exists "donVi" text;

-- Kiểm tra:
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='danh_muc' order by ordinal_position;
