-- ============================================================
--  DANH MỤC ĐƠN VỊ — BỔ SUNG ĐỢT 2
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Chạy SAU supabase/don_vi.sql. An toàn khi chạy lại.
--
--  Gồm 3 việc:
--    1) Cột "muc_gop" — đánh dấu dòng KHÔNG phải một đơn vị thật mà là
--       một cách nói gộp ("Tất cả các ĐVSX"). Chọn được trong droplist
--       nhưng không bị đếm như một đơn vị khi thống kê.
--    2) Cột "icon" — Admin chọn icon cho thẻ đơn vị ở trang Cấp phát BHLĐ.
--    3) Thêm 3 dòng mà đối soát dữ liệu thật đã phát hiện: Công đoàn và
--       hai cách nói gộp người dùng đang gõ tay qua mục "Khác".
--       TÊN giữ ĐÚNG chuỗi đang có trong dữ liệu → không phải sửa bản ghi nào.
-- ============================================================

-- 1) & 2) Cột mới ────────────────────────────────────────────
alter table public."DonVi" add column if not exists muc_gop boolean not null default false;
alter table public."DonVi" add column if not exists icon    text;

-- 3) Ba dòng phát hiện qua đối soát ──────────────────────────
--    on conflict do nothing → chạy lại không ghi đè chỉnh sửa của Admin.
insert into public."DonVi" (ma, ten, nhom, sort, he_thong, muc_gop, pages, ghi_chu) values
  ('cong_doan', 'Công đoàn', 'doan_the', 130, false, false,
   '["ke-hoach","huan-luyen-dao-tao"]'::jsonb,
   'Phát hiện qua đối soát: đang được nhập tay ở mục "Khác" của trang Kế hoạch.'),

  ('gop_tat_ca_dvsx', 'Tất cả các ĐVSX', 'muc_gop', 300, false, true,
   '["ke-hoach"]'::jsonb,
   'Cách nói gộp, không phải một đơn vị. Tên giữ đúng chuỗi đang có trong dữ liệu.'),

  ('gop_toan_xn', 'Tất cả đơn vị/phòng/ban', 'muc_gop', 310, false, true,
   '["ke-hoach"]'::jsonb,
   'Cách nói gộp, không phải một đơn vị. Tên giữ đúng chuỗi đang có trong dữ liệu.')
on conflict (ma) do nothing;

-- 4) Icon mặc định cho các đơn vị của trang Cấp phát BHLĐ ────
--    Chỉ điền vào dòng CHƯA có icon, không ghi đè lựa chọn của Admin.
update public."DonVi" set icon = 'anchor'    where ma = 'cang_bien'        and icon is null;
update public."DonVi" set icon = 'package'   where ma = 'can_cu_kho_gn'    and icon is null;
update public."DonVi" set icon = 'wrench'    where ma = 'xuong_sua_chua'   and icon is null;
update public."DonVi" set icon = 'truck'     where ma = 'doi_xe_vthh'      and icon is null;
update public."DonVi" set icon = 'car'       where ma = 'doi_xe_vchk'      and icon is null;
update public."DonVi" set icon = 'landmark'  where ma = 'bo_may_dieu_hanh' and icon is null;
update public."DonVi" set icon = 'flask'     where ma = 'test'             and icon is null;

-- Kiểm tra:
select ma, ten, nhom, sort, active, he_thong, muc_gop, icon, pages
from public."DonVi" order by sort;
