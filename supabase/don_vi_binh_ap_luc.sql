-- ============================================================
--  DANH MỤC ĐƠN VỊ — GÁN CHO MỤC "BÌNH ÁP LỰC"
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Chạy SAU don_vi.sql và don_vi_bo_sung.sql. An toàn khi chạy lại.
--
--  Trang Quản lý thiết bị → Bình áp lực trước đây viết cứng 2 section
--  (Cảng biển, Xưởng sửa chữa). Nay lấy từ danh mục, nên phải tích 2 đơn vị
--  đó cho điểm sử dụng "binh-ap-luc".
--
--  KHÔNG BẮT BUỘC chạy file này: Admin có thể tích tay 2 ô ở cột "Bình áp lực"
--  trong Quản trị hệ thống → Danh mục đơn vị. Chạy SQL chỉ để giữ nguyên hiện
--  trạng ngay khi deploy, không có khoảng trống trang trống.
--
--  Dữ liệu thiết bị lưu section = MÃ đơn vị ("cang_bien", "xuong_sua_chua"),
--  đúng bằng mã trong danh mục → không phải chuyển đổi bản ghi nào.
-- ============================================================
update public."DonVi"
   set pages = pages || '["binh-ap-luc"]'::jsonb
 where ma in ('cang_bien', 'xuong_sua_chua')
   and not (pages @> '["binh-ap-luc"]'::jsonb);

-- Kiểm tra: hai dòng dưới đây phải có "binh-ap-luc" trong cột pages
select ma, ten, pages from public."DonVi" where ma in ('cang_bien','xuong_sua_chua');
