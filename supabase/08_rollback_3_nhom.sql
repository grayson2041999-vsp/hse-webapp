/* =========================================================
 *  08_rollback_3_nhom.sql — trả 8 bảng về tên cũ.
 *  An toàn ở mọi thời điểm, không mất dữ liệu.
 *  Nhớ khôi phục cả assets/db.js về commit trước đó.
 * ========================================================= */
begin;
alter table public."Svodka_TacVu"            rename to svodka_tacvu;
alter table public."Svodka_Buoc"             rename to svodka_buoc;
alter table public."Svodka_MatKhau"          rename to svodka_matkhau;
alter table public."HuanLuyen-DaoTao_NhanSu" rename to hl_nhansu;
alter table public."HuanLuyen-DaoTao_CaiDat" rename to hl_settings;
alter table public."HTBCTD_ThietBi"          rename to pccc_devices;
alter table public."HTBCTD_Loi"              rename to pccc_errors;
alter table public."HTBCTD_ThangDaKhoa"      rename to pccc_locked_months;
commit;
notify pgrst, 'reload schema';
