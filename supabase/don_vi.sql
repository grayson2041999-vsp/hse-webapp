-- ============================================================
--  DANH MỤC ĐƠN VỊ (bảng "DonVi")
--  Webapp Quản lý HSE · Vietsovpetro
--
--  Mục đích: gom danh sách phòng/ban/đơn vị vốn đang viết cứng rải rác
--  trong code của từng trang về MỘT chỗ do Admin quản lý.
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--
--  THIẾT KẾ (xem thêm assets/don-vi.js):
--    ma        khoá chính, MÃ CỐ ĐỊNH — sinh 1 lần, KHÔNG BAO GIỜ đổi.
--    ten       tên hiển thị, Admin sửa thoải mái.
--    ten_cu    danh sách BÍ DANH (các tên cũ). Mỗi lần đổi tên, tên cũ
--              được đẩy vào đây. Nhờ vậy bản ghi cũ trong KeHoach /
--              KiemTraCacCap / HuanLuyen... vẫn tra ra đúng đơn vị dù
--              chưa kịp cập nhật → báo cáo cũ không bị "mồ côi".
--    pages     mảng slug các trang được phép dùng đơn vị này trong droplist.
--    active    false = ngừng hoạt động (ẩn khỏi droplist, dữ liệu cũ vẫn đọc được).
--    he_thong  true  = đơn vị hệ thống (Bộ máy điều hành, Test) — không
--              thuộc 12 đơn vị chính thức, chỉ hiện ở trang được gán.
--
--  RLS: ai cũng XEM được (kể cả khách chưa đăng nhập, để droplist hiện
--       ngay khi chưa đăng nhập); chỉ ADMIN được thêm/sửa/xoá.
-- ============================================================

-- Hàm tiện ích lấy role người đang đăng nhập (đã có ở svodka.sql — tạo lại
-- ở đây để file này chạy độc lập được).
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
-- 1) BẢNG DANH MỤC
-- ============================================================
create table if not exists public."DonVi" (
  ma         text primary key,
  ten        text not null,
  ten_cu     jsonb   not null default '[]'::jsonb,
  nhom       text    not null default 'phong_ban',   -- phong_ban | don_vi_sx | he_thong
  sort       integer not null default 0,
  active     boolean not null default true,
  he_thong   boolean not null default false,
  pages      jsonb   not null default '[]'::jsonb,
  ghi_chu    text,
  updated_at timestamptz not null default now()
);

-- Chạy lại trên bảng đã có từ bản trước: bổ sung cột còn thiếu
alter table public."DonVi" add column if not exists ten_cu     jsonb   not null default '[]'::jsonb;
alter table public."DonVi" add column if not exists nhom       text    not null default 'phong_ban';
alter table public."DonVi" add column if not exists sort       integer not null default 0;
alter table public."DonVi" add column if not exists active     boolean not null default true;
alter table public."DonVi" add column if not exists he_thong   boolean not null default false;
alter table public."DonVi" add column if not exists pages      jsonb   not null default '[]'::jsonb;
alter table public."DonVi" add column if not exists ghi_chu    text;
alter table public."DonVi" add column if not exists updated_at timestamptz not null default now();

create index if not exists donvi_sort_idx on public."DonVi" (sort);

-- ============================================================
-- 2) RLS
-- ============================================================
alter table public."DonVi" enable row level security;

drop policy if exists "donvi_select_all" on public."DonVi";
create policy "donvi_select_all"
  on public."DonVi" for select
  using (true);

drop policy if exists "donvi_admin_write" on public."DonVi";
create policy "donvi_admin_write"
  on public."DonVi" for all
  to authenticated
  using (public.hse_current_role() = 'admin')
  with check (public.hse_current_role() = 'admin');

-- ============================================================
-- 3) SEED — 12 đơn vị chính thức + 2 đơn vị hệ thống
--    Cột "pages" giữ ĐÚNG hiện trạng đang hard-code trong code, để sau
--    khi chạy file này giao diện không thay đổi gì so với trước:
--      ke-hoach            : 5 đơn vị SX + Phòng Kỹ thuật - Vật tư
--      kiem-tra-cac-cap    : 5 đơn vị SX
--      huan-luyen-dao-tao  : đủ 12 đơn vị
--      cap-phat-bhld       : 5 đơn vị SX + Bộ máy điều hành + Test
--    on conflict do nothing → chạy lại KHÔNG ghi đè chỉnh sửa của Admin.
-- ============================================================
insert into public."DonVi" (ma, ten, nhom, sort, he_thong, pages) values
  ('ban_giam_doc',      'Ban giám đốc',                     'phong_ban',  10, false, '["huan-luyen-dao-tao"]'::jsonb),
  ('p_ky_thuat_vat_tu', 'Phòng Kỹ thuật - Vật tư',          'phong_ban',  20, false, '["ke-hoach","huan-luyen-dao-tao"]'::jsonb),
  ('p_kinh_te_tcns',    'Phòng Kinh tế - Tổ chức nhân sự',  'phong_ban',  30, false, '["huan-luyen-dao-tao"]'::jsonb),
  ('p_ke_toan',         'Phòng Kế toán',                    'phong_ban',  40, false, '["huan-luyen-dao-tao"]'::jsonb),
  ('p_thuong_mai_dv',   'Phòng Thương mại - Dịch vụ',       'phong_ban',  50, false, '["huan-luyen-dao-tao"]'::jsonb),
  ('ban_thuc_hien_hd',  'Ban Thực hiện hợp đồng',           'phong_ban',  60, false, '["huan-luyen-dao-tao"]'::jsonb),
  ('ban_dieu_do_sx',    'Ban Điều độ sản xuất',             'phong_ban',  70, false, '["huan-luyen-dao-tao"]'::jsonb),
  ('cang_bien',         'Cảng biển',                        'don_vi_sx',  80, false, '["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"]'::jsonb),
  ('can_cu_kho_gn',     'Căn cứ Kho - Giao nhận',           'don_vi_sx',  90, false, '["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"]'::jsonb),
  ('xuong_sua_chua',    'Xưởng sửa chữa',                   'don_vi_sx', 100, false, '["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"]'::jsonb),
  ('doi_xe_vthh',       'Đội xe VTHH&PTTBCD',               'don_vi_sx', 110, false, '["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"]'::jsonb),
  ('doi_xe_vchk',       'Đội xe VCHK',                      'don_vi_sx', 120, false, '["ke-hoach","kiem-tra-cac-cap","huan-luyen-dao-tao","cap-phat-bhld"]'::jsonb),
  ('bo_may_dieu_hanh',  'Bộ máy điều hành',                 'he_thong',  200, true,  '["cap-phat-bhld"]'::jsonb),
  ('test',              'Test',                             'he_thong',  210, true,  '["cap-phat-bhld"]'::jsonb)
on conflict (ma) do nothing;

-- ============================================================
-- 4) CẤU HÌNH THEO TRANG — công tắc mục "Khác" (nhập tên tự do)
--    Lưu trong bảng key-value sẵn có ("TraCuuATVSLD" — xem app_settings.sql).
--    Giữ đúng hiện trạng: Kế hoạch và Kiểm tra các cấp đang cho nhập "Khác".
-- ============================================================
insert into public."TraCuuATVSLD" (key, value)
values ('donvi_cauhinh', '{"other":{"ke-hoach":true,"kiem-tra-cac-cap":true,"huan-luyen-dao-tao":false,"cap-phat-bhld":false}}')
on conflict (key) do nothing;

-- ============================================================
-- 5) REALTIME (tuỳ chọn) — Admin sửa danh mục, các máy khác thấy ngay
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'DonVi'
  ) then
    execute 'alter publication supabase_realtime add table public."DonVi"';
  end if;
end $$;

-- Kiểm tra:
select ma, ten, nhom, sort, active, he_thong, pages from public."DonVi" order by sort;
