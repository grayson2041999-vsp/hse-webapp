/* =========================================================
 *  07_rollback_bhld.sql — trả 15 bảng về tên cũ.
 *  An toàn ở mọi thời điểm, không mất dữ liệu.
 *  Nhớ khôi phục cả assets/bhld-sync.js về commit trước đó.
 * ========================================================= */
begin;
alter table public."CapPhatBHLD_NhanVien"        rename to nhanvien;
alter table public."CapPhatBHLD_DanhMuc"         rename to danh_muc;
alter table public."CapPhatBHLD_DinhMuc"         rename to dinh_muc;
alter table public."CapPhatBHLD_ChucDanh"        rename to chuc_danh;
alter table public."CapPhatBHLD_LichSuNhapXuat"  rename to lich_su_nhap_xuat;
alter table public."CapPhatBHLD_TienTrinh"       rename to cap_phat_tien_trinh;
alter table public."CapPhatBHLD_NhomNhanVien"    rename to nhom_nv;
alter table public."CapPhatBHLD_NhomTrangBi"     rename to nhom_tb;
alter table public."CapPhatBHLD_ThongBao"        rename to notifications;
alter table public."CapPhatBHLD_ChoDuyet"        rename to pending_changes;
alter table public."CapPhatBHLD_PhieuYeuCau"     rename to phieu_requests;
alter table public."CapPhatBHLD_DanhSachQuy"     rename to quy_list;
alter table public."CapPhatBHLD_BangSize"        rename to size_chart;
alter table public."CapPhatBHLD_TonKho"          rename to ton_kho;
alter table public."CapPhatBHLD_Test"            rename to test_baseline;
commit;
notify pgrst, 'reload schema';
