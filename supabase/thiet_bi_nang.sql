-- ============================================================
--  THIẾT BỊ NÂNG — BẢNG DỮ LIỆU + PHÂN QUYỀN
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  Phục vụ tab "Thiết bị nâng" trong Quản lý thiết bị
--  (assets/thiet-bi-nang.js · bảng logic "thiet_bi_nang" khai trong db.js).
--
--  ⚠️ VÌ SAO CÁC CỘT SỐ VÀ NGÀY ĐỀU LÀ TEXT
--     Giao diện gửi thẳng giá trị của ô nhập. Ô để trống gửi chuỗi RỖNG,
--     mà Postgres từ chối '' khi ép sang numeric/date → bản ghi không lưu
--     được. Giữ text thì thiết bị chưa có số liệu vẫn nhập được, phần tính
--     toán và định dạng do giao diện lo (HSEDate + _num()).
--     Ngày luôn được chuẩn hoá về ISO 'YYYY-MM-DD' trước khi lưu.
-- ============================================================

-- Hàm tra role của người đang đăng nhập (đã có sẵn nếu đã chạy svodka.sql)
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
-- 1) BẢNG THIẾT BỊ NÂNG
-- ============================================================
create table if not exists public."ThietBi_ThietBiNang" (
  id                 text primary key,
  section            text,                                  -- MÃ đơn vị quản lý (khớp DonVi.ma)
  "order"            integer not null default 0,            -- thứ tự kéo–thả trong đơn vị
  loai_thiet_bi      text,                                  -- Cầu trục / Cổng trục / Palăng / Xe nâng…
  ten_thiet_bi       text,
  vi_tri             text,
  tai_trong_tk       text,                                  -- tải trọng thiết kế, đơn vị TẤN
  tai_trong_lv       text,                                  -- tải trọng làm việc, đơn vị TẤN
  nam_su_dung        text,                                  -- năm đưa vào sử dụng
  so_che_tao         text,
  so_dang_ky         text,
  bien_kiem_soat     text,                                  -- biển số xe (xe nâng, cần trục bánh lốp…)
  ngay_kd_gan_nhat   text,                                  -- ISO YYYY-MM-DD
  ngay_kd_tiep_theo  text,                                  -- ISO YYYY-MM-DD
  ngay_kd_tu_chinh   boolean not null default false,        -- true = người dùng tự nhập, không tự tính
  ghi_chu            text,
  "createdBy"        text,
  "createdAt"        timestamptz,
  "updatedAt"        timestamptz
);

-- Bảng đã tạo từ bản trước (chưa có Biển kiểm soát) thì bổ sung cột ở đây.
-- Chạy lại nhiều lần vẫn an toàn.
alter table public."ThietBi_ThietBiNang"
  add column if not exists bien_kiem_soat text;

-- Lọc theo đơn vị và sắp thứ tự là truy vấn thường xuyên nhất
create index if not exists thietbinang_section_order_idx
  on public."ThietBi_ThietBiNang" (section, "order");

alter table public."ThietBi_ThietBiNang" enable row level security;

-- Ai cũng XEM được (kể cả Viewer)
drop policy if exists "tbnang_select_all" on public."ThietBi_ThietBiNang";
create policy "tbnang_select_all"
  on public."ThietBi_ThietBiNang" for select using (true);

-- ADMIN và USER thêm/sửa/xoá; VIEWER thì không
drop policy if exists "tbnang_write" on public."ThietBi_ThietBiNang";
create policy "tbnang_write"
  on public."ThietBi_ThietBiNang" for all
  to authenticated
  using (public.hse_current_role() in ('admin', 'user'))
  with check (public.hse_current_role() in ('admin', 'user'));

-- ============================================================
-- 2) GÁN ĐƠN VỊ CHO ĐIỂM SỬ DỤNG "thiet-bi-nang"
--
--    KHÔNG BẮT BUỘC: Admin có thể tích tay ở Quản trị hệ thống →
--    Danh mục đơn vị, cột "Thiết bị nâng". Chạy đoạn dưới chỉ để
--    có sẵn 2 đơn vị giống bên Bình áp lực, tránh mở tab ra trống trơn.
--    Cần thêm/bớt đơn vị nào thì sửa danh sách trong ngoặc.
-- ============================================================
update public."DonVi"
   set pages = pages || '["thiet-bi-nang"]'::jsonb
 where ma in ('cang_bien', 'xuong_sua_chua')
   and not (pages @> '["thiet-bi-nang"]'::jsonb);

-- ============================================================
-- KIỂM TRA
-- ============================================================
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'ThietBi_ThietBiNang'
order by ordinal_position;

select ma, ten, pages from public."DonVi" where pages @> '["thiet-bi-nang"]'::jsonb;
