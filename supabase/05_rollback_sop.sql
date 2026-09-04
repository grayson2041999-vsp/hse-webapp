/* =========================================================
 *  05_rollback_sop.sql — trả bảng "SOP" về tên sop
 *  An toàn ở mọi thời điểm, không mất dữ liệu.
 * ========================================================= */
begin;
alter table public."SOP" rename to sop;
commit;
notify pgrst, 'reload schema';

/* Khôi phục code về commit trước khi đổi tên:
     cd ~/Documents/GitHub/hse-webapp
     git log --oneline -- assets/db.js     # tìm commit trước khi đổi tên
     git checkout <commit> -- assets/db.js assets/app.js
*/
