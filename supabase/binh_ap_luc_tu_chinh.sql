-- ============================================================
--  BÌNH ÁP LỰC — CHO PHÉP SỬA TAY NGÀY KIỂM ĐỊNH TIẾP THEO
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  Ngày kiểm định tiếp theo vẫn được TỰ TÍNH theo tuổi thiết bị và môi chất,
--  nhưng nay chỉ mang tính đề xuất — người dùng sửa lại và lưu được.
--
--  Cột mới đánh dấu bản ghi nào đã được sửa tay:
--    false (mặc định) → hiển thị ngày TỰ TÍNH, cập nhật theo mọi thay đổi
--    true             → giữ nguyên ngày người dùng đã nhập
--
--  ⚠️ Mặc định là false cho MỌI bản ghi hiện có — đây là chủ ý. Các giá trị
--     ngay_kd_tiep_theo đang lưu được sinh ra bởi bản code có lỗi ép kiểu
--     boolean (chuỗi "false" bị coi là true, làm chu kỳ bị rút ngắn), nên
--     KHÔNG được coi chúng là "người dùng đã chọn". Để false thì hệ thống
--     tính lại bằng công thức đã sửa đúng.
-- ============================================================
alter table public."ThietBi_BinhApLuc"
  add column if not exists ngay_kd_tu_chinh boolean not null default false;

-- Kiểm tra:
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'ThietBi_BinhApLuc'
order by ordinal_position;
