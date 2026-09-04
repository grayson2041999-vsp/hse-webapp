/* =========================================================
 *  01_rollback_ke_hoach.sql
 *  Quay lại trạng thái trước khi gộp.
 *
 *  ⚠️  CHỈ AN TOÀN TUYỆT ĐỐI khi webapp CHƯA chạy bản db.js mới.
 *      Hai bảng cũ vẫn còn nguyên vẹn nên chỉ cần bỏ bảng gộp đi.
 *
 *  ⚠️  NẾU webapp ĐÃ chạy bản mới một thời gian: dữ liệu nhập trong
 *      khoảng đó CHỈ nằm ở "KeHoach", hai bảng cũ đã cũ. Chạy phần
 *      A trước để đẩy ngược dữ liệu về, rồi mới chạy phần B.
 * ========================================================= */

/* ─────────── PHẦN A — chỉ chạy nếu đã lỡ dùng bản mới ───────────
   Đẩy ngược các bản ghi mới/đã sửa từ "KeHoach" về 2 bảng cũ.
   Bỏ dấu chú thích để dùng.

begin;

insert into public.ke_hoach_mot_lan (
  id, name, status, "start", "end", "chuTri", "phoiHop", "coSo", "ghiChu",
  pages, "order", "updatedAt", "completionDate", "completionReport",
  "createdAt", "createdBy", "updatedBy")
select
  id, name, status, "start", "end", "chuTri", "phoiHop", "coSo", "ghiChu",
  pages, "order", "updatedAt", "completionDate", "completionReport",
  "createdAt", "createdBy", "updatedBy"
from public."KeHoach" where loai = 'mot_lan'
on conflict (id) do update set
  name = excluded.name, status = excluded.status,
  "start" = excluded."start", "end" = excluded."end",
  "chuTri" = excluded."chuTri", "phoiHop" = excluded."phoiHop",
  "coSo" = excluded."coSo", "ghiChu" = excluded."ghiChu",
  pages = excluded.pages, "order" = excluded."order",
  "updatedAt" = excluded."updatedAt",
  "completionDate" = excluded."completionDate",
  "completionReport" = excluded."completionReport",
  "updatedBy" = excluded."updatedBy";

insert into public.ke_hoach_lap_lai (
  id, name, "allMonths", months, "execDay", "lastDay", "chuTri", "phoiHop",
  "coSo", "ghiChu", pages, "updatedAt", "createdAt", "createdBy", "updatedBy")
select
  id, name, "allMonths", months, "execDay", "lastDay", "chuTri", "phoiHop",
  "coSo", "ghiChu", pages, "updatedAt", "createdAt", "createdBy", "updatedBy"
from public."KeHoach" where loai = 'lap_lai'
on conflict (id) do update set
  name = excluded.name, "allMonths" = excluded."allMonths",
  months = excluded.months, "execDay" = excluded."execDay",
  "lastDay" = excluded."lastDay", "chuTri" = excluded."chuTri",
  "phoiHop" = excluded."phoiHop", "coSo" = excluded."coSo",
  "ghiChu" = excluded."ghiChu", pages = excluded.pages,
  "updatedAt" = excluded."updatedAt", "updatedBy" = excluded."updatedBy";

commit;
─────────────────────────────────────────────────────────────── */


/* ─────────── PHẦN B — bỏ bảng gộp ─────────── */
drop table if exists public."KeHoach";

notify pgrst, 'reload schema';

/* Sau đó khôi phục code về commit trước khi gộp:
     cd ~/Documents/GitHub/hse-webapp
     git log --oneline -- assets/db.js     # tìm commit trước khi gộp
     git checkout <commit> -- assets/db.js */
