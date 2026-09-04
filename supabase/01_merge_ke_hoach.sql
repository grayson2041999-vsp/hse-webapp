/* =========================================================
 *  01_merge_ke_hoach.sql
 *  Gộp ke_hoach_mot_lan + ke_hoach_lap_lai → public."KeHoach"
 *
 *  • KHÔNG xoá, KHÔNG sửa 2 bảng cũ — chúng được giữ nguyên làm bản lưu.
 *  • Toàn bộ nằm trong 1 transaction: lỗi ở bất kỳ bước nào → tự huỷ sạch.
 *  • Chạy lại lần 2 sẽ báo lỗi "KeHoach đã tồn tại" (cố ý, tránh ghi đè).
 *
 *  ⚠️  Tên bảng có chữ hoa → MỌI câu SQL sau này đều phải đặt nháy kép:
 *        select * from public."KeHoach";      ✅
 *        select * from public.KeHoach;        ❌ (Postgres hiểu là "kehoach")
 *
 *  Chạy: Supabase → SQL Editor → dán cả file → Run
 * ========================================================= */

begin;

/* ── B0. Chặn trước: id trùng nhau giữa 2 bảng sẽ vỡ khoá chính ── */
do $$
declare n int;
begin
  select count(*) into n
  from public.ke_hoach_mot_lan a
  join public.ke_hoach_lap_lai b on a.id = b.id;
  if n > 0 then
    raise exception 'DỪNG: có % id trùng nhau giữa 2 bảng, không gộp được.', n;
  end if;
end $$;

/* ── B1. Bảng gộp ──
   Cột giữ NGUYÊN tên và NGUYÊN kiểu như bảng cũ (kể cả kiểu text của
   start/end/order/allMonths/lastDay) để không đổi hành vi của webapp. */
create table public."KeHoach" (
  id                 text primary key,
  loai               text not null check (loai in ('mot_lan','lap_lai')),

  -- dùng chung cho cả hai loại
  name               text,
  "chuTri"           text,
  "phoiHop"          text,
  "coSo"             text,
  "ghiChu"           text,
  pages              jsonb default '[]'::jsonb,
  "createdAt"        text,
  "createdBy"        text,
  "updatedAt"        text,
  "updatedBy"        text,

  -- chỉ dùng cho loai = 'mot_lan'
  status             text,
  "start"            text,
  "end"              text,
  "order"            text,
  "completionDate"   text,
  "completionReport" text,

  -- chỉ dùng cho loai = 'lap_lai'
  "allMonths"        text,
  months             jsonb default '[]'::jsonb,
  "execDay"          text,
  "lastDay"          text
);

comment on table  public."KeHoach" is
  'Kế hoạch HSE — gộp từ ke_hoach_mot_lan + ke_hoach_lap_lai. Phân biệt bằng cột loai.';
comment on column public."KeHoach".loai is
  'mot_lan = kế hoạch một lần (có start/end/status) | lap_lai = kế hoạch định kỳ (có months/execDay)';

/* ── B2. Chuyển dữ liệu ── */
insert into public."KeHoach" (
  id, loai, name, "chuTri", "phoiHop", "coSo", "ghiChu", pages,
  "createdAt", "createdBy", "updatedAt", "updatedBy",
  status, "start", "end", "order", "completionDate", "completionReport"
)
select
  id, 'mot_lan', name, "chuTri", "phoiHop", "coSo", "ghiChu", pages,
  "createdAt", "createdBy", "updatedAt", "updatedBy",
  status, "start", "end", "order", "completionDate", "completionReport"
from public.ke_hoach_mot_lan;

insert into public."KeHoach" (
  id, loai, name, "chuTri", "phoiHop", "coSo", "ghiChu", pages,
  "createdAt", "createdBy", "updatedAt", "updatedBy",
  "allMonths", months, "execDay", "lastDay"
)
select
  id, 'lap_lai', name, "chuTri", "phoiHop", "coSo", "ghiChu", pages,
  "createdAt", "createdBy", "updatedAt", "updatedBy",
  "allMonths", months, "execDay", "lastDay"
from public.ke_hoach_lap_lai;

/* ── B3. Index cho truy vấn lọc theo loai (webapp luôn lọc theo cột này) ── */
create index "KeHoach_loai_idx" on public."KeHoach" (loai);

/* ── B4. Quyền + RLS — sao chép đúng policy của 2 bảng cũ ── */
grant select                 on public."KeHoach" to anon, authenticated;
grant insert, update, delete on public."KeHoach" to authenticated;

alter table public."KeHoach" enable row level security;

create policy "KeHoach_sel" on public."KeHoach"
  for select to anon, authenticated
  using (true);

create policy "KeHoach_ins" on public."KeHoach"
  for insert to authenticated
  with check (hse_can_write());

create policy "KeHoach_upd" on public."KeHoach"
  for update to authenticated
  using (hse_can_write())
  with check (hse_can_write());

create policy "KeHoach_del" on public."KeHoach"
  for delete to authenticated
  using (hse_can_write());

/* ── B5. Đối chiếu số dòng — lệch là huỷ toàn bộ ── */
do $$
declare a int; b int; c int; d int;
begin
  select count(*) into a from public.ke_hoach_mot_lan;
  select count(*) into b from public.ke_hoach_lap_lai;
  select count(*) into c from public."KeHoach" where loai = 'mot_lan';
  select count(*) into d from public."KeHoach" where loai = 'lap_lai';
  if a <> c or b <> d then
    raise exception 'DỪNG: lệch số dòng — mot_lan %/%, lap_lai %/%', c, a, d, b;
  end if;
  raise notice 'OK — đã chuyển % dòng mot_lan và % dòng lap_lai sang "KeHoach".', c, d;
end $$;

commit;

/* ── B6. Báo PostgREST nạp lại schema để Data API thấy bảng mới ngay ── */
notify pgrst, 'reload schema';

/* ── B7. Xem lại kết quả ── */
select loai, count(*) as so_dong
from public."KeHoach"
group by loai
order by loai;
