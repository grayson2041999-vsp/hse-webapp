-- ============================================================
--  BẢNG HTBCTD_XacNhan — Xác nhận "không có lỗi" của hệ thống
--  báo cháy tự động theo từng tháng (trang bao-chay-tu-dong.html).
--
--  Mỗi dòng = 1 hệ thống được xác nhận KHÔNG có lỗi trong 1 tháng.
--  id cố định: 'ok-<deviceId>-<tháng>-<năm>' → không tạo trùng.
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại.
--  Tên logic trong code: pccc_confirms (xem assets/db.js).
-- ============================================================
create table if not exists public."HTBCTD_XacNhan" (
  id          text primary key,
  "deviceId"  text not null,
  month       integer not null,
  year        integer not null,
  "createdBy" text,
  "createdAt" text,
  "updatedBy" text,
  "updatedAt" text
);

create index if not exists htbctd_xacnhan_thang_idx
  on public."HTBCTD_XacNhan" (year, month);

-- RLS: ai cũng XEM được (trang có chế độ xem không cần đăng nhập),
-- chỉ người ĐÃ ĐĂNG NHẬP mới thêm/sửa/xoá. Quyền chi tiết (ai được
-- xác nhận, tháng đã khoá) do trang kiểm tra.
alter table public."HTBCTD_XacNhan" enable row level security;

drop policy if exists htbctd_xacnhan_select on public."HTBCTD_XacNhan";
create policy htbctd_xacnhan_select on public."HTBCTD_XacNhan"
  for select using (true);

drop policy if exists htbctd_xacnhan_insert on public."HTBCTD_XacNhan";
create policy htbctd_xacnhan_insert on public."HTBCTD_XacNhan"
  for insert to authenticated with check (true);

drop policy if exists htbctd_xacnhan_update on public."HTBCTD_XacNhan";
create policy htbctd_xacnhan_update on public."HTBCTD_XacNhan"
  for update to authenticated using (true) with check (true);

drop policy if exists htbctd_xacnhan_delete on public."HTBCTD_XacNhan";
create policy htbctd_xacnhan_delete on public."HTBCTD_XacNhan"
  for delete to authenticated using (true);

-- Kiểm tra:
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='HTBCTD_XacNhan' order by ordinal_position;
