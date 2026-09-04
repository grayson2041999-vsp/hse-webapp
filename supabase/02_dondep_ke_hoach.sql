/* =========================================================
 *  02_dondep_ke_hoach.sql
 *  Dọn 2 bảng cũ SAU KHI đã chạy ổn định.
 *
 *  ⏳ Đừng chạy ngay. Hãy dùng trang Kế hoạch bình thường vài ngày
 *     (thêm / sửa / xoá cả hai loại, kiểm tra trang chủ) rồi mới chạy.
 *
 *  Bước 1 chỉ ĐỔI TÊN, không xoá dữ liệu — vẫn khôi phục được.
 *  Bước 2 (xoá hẳn) đang bị chú thích, chỉ mở khi đã thật sự yên tâm.
 * ========================================================= */

/* ── Bước 1: đưa 2 bảng cũ sang tên _backup_ cho khuất mắt ── */
begin;

alter table public.ke_hoach_mot_lan rename to "_backup_ke_hoach_mot_lan";
alter table public.ke_hoach_lap_lai rename to "_backup_ke_hoach_lap_lai";

commit;

notify pgrst, 'reload schema';

/* Muốn quay lại:
     alter table public."_backup_ke_hoach_mot_lan" rename to ke_hoach_mot_lan;
     alter table public."_backup_ke_hoach_lap_lai" rename to ke_hoach_lap_lai;
*/


/* ── Bước 2: XOÁ HẲN — KHÔNG THỂ HOÀN TÁC ──
   Chỉ mở chú thích khi đã chắc chắn hoàn toàn.

drop table if exists public."_backup_ke_hoach_mot_lan";
drop table if exists public."_backup_ke_hoach_lap_lai";
notify pgrst, 'reload schema';
*/
