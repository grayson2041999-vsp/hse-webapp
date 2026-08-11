-- ============================================================
--  TỐI ƯU SCHEMA — Bỏ cột thời gian/audit TRÙNG LẶP không dùng
--  Webapp Quản lý HSE · Vietsovpetro
--  Sinh tự động từ đối chiếu schema thật + mã nguồn (11/07/2026)
--
--  Cột GIỮ LẠI (code đang dùng): createdAt, updatedAt, createdBy, updatedBy
--  Cột BỎ (chết trên bảng nghiệp vụ): created_at, updated_at, created, updated
--  NGOẠI LỆ (KHÔNG đụng): activity_log.created_at, app_settings.updated_at,
--                          profiles.created, profiles.updated
--
--  ⚠️  CHẠY BƯỚC 0 TRƯỚC. Chỉ chạy BƯỚC 1 khi Bước 0 cho thấy các cột này RỖNG.
-- ============================================================

-- ─── BƯỚC 0: KIỂM TRA có dữ liệu trong cột sắp bỏ không ───
-- (Nếu mọi giá trị = 0 => an toàn tuyệt đối để bỏ)
select 'binh_ap_luc' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.binh_ap_luc
union all
select 'chuc_danh' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.chuc_danh
union all
select 'danh_muc' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.danh_muc
union all
select 'dinh_muc' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.dinh_muc
union all
select 'hl_nhansu' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.hl_nhansu
union all
select 'hl_settings' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.hl_settings
union all
select 'ke_hoach_lap_lai' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.ke_hoach_lap_lai
union all
select 'ke_hoach_mot_lan' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.ke_hoach_mot_lan
union all
select 'kiem_tra_cap12' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.kiem_tra_cap12
union all
select 'kiem_tra_cap34' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.kiem_tra_cap34
union all
select 'ksk' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.ksk
union all
select 'lich_su_nhap_xuat' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.lich_su_nhap_xuat
union all
select 'moi_truong' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.moi_truong
union all
select 'nha_thau' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.nha_thau
union all
select 'nhanvien' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.nhanvien
union all
select 'nhom_nv' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.nhom_nv
union all
select 'nhom_tb' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.nhom_tb
union all
select 'notifications' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.notifications
union all
select 'pccc_devices' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.pccc_devices
union all
select 'pccc_errors' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.pccc_errors
union all
select 'pccc_locked_months' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.pccc_locked_months
union all
select 'pending_changes' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.pending_changes
union all
select 'phieu_requests' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.phieu_requests
union all
select 'quy_list' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.quy_list
union all
select 'sop' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.sop
union all
select 'tnsc_gio_cong' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.tnsc_gio_cong
union all
select 'tnsc_su_kien' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.tnsc_su_kien
union all
select 'ton_kho' as tbl, count("created_at") as "created_at", count("updated_at") as "updated_at", count("created") as "created", count("updated") as "updated" from public.ton_kho;


-- ─── BƯỚC 1: BỎ CỘT (idempotent, an toàn chạy lại) ───
-- Kết quả Bước 0 (11/07/2026): 27/28 bảng RỖNG hoàn toàn.
-- Riêng pccc_locked_months.created_at có 6 giá trị -> CHÉP sang "createdAt"
-- (cột code đang dùng) trước khi bỏ, để không mất mốc thời gian.
begin;

-- Bảo toàn dữ liệu cho pccc_locked_months: chỉ chép khi cột created_at còn tồn tại
-- (bọc DO để chạy lại nhiều lần không lỗi)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pccc_locked_months' and column_name='created_at'
  ) then
    update public.pccc_locked_months
       set "createdAt" = "created_at"
     where ("createdAt" is null or "createdAt" = '') and "created_at" is not null;
  end if;
end $$;

alter table public.binh_ap_luc drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.chuc_danh drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.danh_muc drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.dinh_muc drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.hl_nhansu drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.hl_settings drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.ke_hoach_lap_lai drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.ke_hoach_mot_lan drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.kiem_tra_cap12 drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.kiem_tra_cap34 drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.ksk drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.lich_su_nhap_xuat drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.moi_truong drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.nha_thau drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.nhanvien drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.nhom_nv drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.nhom_tb drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.notifications drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.pccc_devices drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.pccc_errors drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.pccc_locked_months drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.pending_changes drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.phieu_requests drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.quy_list drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.sop drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.tnsc_gio_cong drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.tnsc_su_kien drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
alter table public.ton_kho drop column if exists "created_at", drop column if exists "updated_at", drop column if exists "created", drop column if exists "updated";
commit;

-- Tổng: bỏ 112 cột trên 28 bảng.