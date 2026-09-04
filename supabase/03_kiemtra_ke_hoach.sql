/* =========================================================
 *  03_kiemtra_ke_hoach.sql
 *  Đối chiếu TỪNG Ô giữa 2 bảng cũ và bảng "KeHoach".
 *
 *  ⚠️  CHỈ ĐỌC — không thay đổi gì.
 *
 *  ✅ ĐẠT khi cả 4 con số đều bằng 0.
 *     Khác 0 nghĩa là có dòng lệch → chạy 01_rollback_ke_hoach.sql
 *     và báo lại cho tôi con số đó.
 *
 *  Chạy NGAY BÂY GIỜ (trước khi mở webapp), lúc dữ liệu hai bên
 *  còn phải giống hệt nhau.
 * ========================================================= */

with
m_cu as (
  select id, name, status, "start", "end", "chuTri", "phoiHop", "coSo",
         "ghiChu", pages, "order", "updatedAt", "completionDate",
         "completionReport", "createdAt", "createdBy", "updatedBy"
  from public.ke_hoach_mot_lan
),
m_moi as (
  select id, name, status, "start", "end", "chuTri", "phoiHop", "coSo",
         "ghiChu", pages, "order", "updatedAt", "completionDate",
         "completionReport", "createdAt", "createdBy", "updatedBy"
  from public."KeHoach" where loai = 'mot_lan'
),
l_cu as (
  select id, name, "allMonths", months, "execDay", "lastDay", "chuTri",
         "phoiHop", "coSo", "ghiChu", pages, "updatedAt",
         "createdAt", "createdBy", "updatedBy"
  from public.ke_hoach_lap_lai
),
l_moi as (
  select id, name, "allMonths", months, "execDay", "lastDay", "chuTri",
         "phoiHop", "coSo", "ghiChu", pages, "updatedAt",
         "createdAt", "createdBy", "updatedBy"
  from public."KeHoach" where loai = 'lap_lai'
)
select
  (select count(*) from (select * from m_cu  except select * from m_moi) x) as mot_lan_thieu_hoac_sai,
  (select count(*) from (select * from m_moi except select * from m_cu ) x) as mot_lan_thua,
  (select count(*) from (select * from l_cu  except select * from l_moi) x) as lap_lai_thieu_hoac_sai,
  (select count(*) from (select * from l_moi except select * from l_cu ) x) as lap_lai_thua;
