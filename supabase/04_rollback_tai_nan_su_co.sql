/* =========================================================
 *  04_rollback_tai_nan_su_co.sql
 *  Trả 2 bảng về tên cũ.
 *
 *  Vì chỉ là đổi tên nên rollback tuyệt đối an toàn ở BẤT KỲ
 *  thời điểm nào — không có dữ liệu nào bị mất, kể cả khi webapp
 *  đã chạy bản mới một thời gian.
 * ========================================================= */

begin;

alter table public."TaiNan-SuCo_GioCong" rename to tnsc_gio_cong;
alter table public."TaiNan-SuCo_SuKien"  rename to tnsc_su_kien;

commit;

notify pgrst, 'reload schema';

/* Sau đó khôi phục code về commit trước khi đổi tên:
     cd ~/Documents/GitHub/hse-webapp
     git log --oneline -- assets/db.js     # tìm commit trước khi đổi tên
     git checkout <commit> -- assets/db.js
*/
