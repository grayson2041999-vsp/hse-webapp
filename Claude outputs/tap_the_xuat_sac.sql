-- ============================================================
--  BẢNG "TapTheXuatSac" — Tập thể xuất sắc ATSKMT theo quý
--  Trang: index.html#tap-the-xuat-sac · module assets/tap-the-xuat-sac.js
--  Tên logic trong code: tap_the_xuat_sac (xem assets/db.js)
--
--  Chạy 1 lần trong Supabase → SQL Editor. An toàn khi chạy lại
--  (không ghi đè kết quả đã nhập trên web).
--
--  Mỗi dòng = kết quả xét của 1 quý. Quý chưa có kết quả = không có dòng.
--    id         '<năm>-<quý>'  vd '2026-3' → không bao giờ trùng
--    trangThai  'xet'  = có xét công nhận (donVi = các đơn vị đạt)
--               'tnld' = không xét do tai nạn lao động
--    donVi      mảng TÊN đơn vị, TỐI ĐA 2 (ràng buộc ở dưới)
--    tnldIds    mảng id vụ việc ở bảng "TaiNan-SuCo_SuKien"
--
--  RLS: ai cũng XEM được; chỉ ADMIN được thêm / sửa / xoá.
-- ============================================================

-- Hàm lấy role người đang đăng nhập (đã có từ don_vi.sql / svodka.sql —
-- tạo lại để file này chạy độc lập được).
create or replace function public.hse_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'anon');
$$;

-- ------------------------------------------------------------
-- 1) BẢNG
-- ------------------------------------------------------------
create table if not exists public."TapTheXuatSac" (
  id          text primary key,
  nam         integer not null,
  quy         integer not null,
  "trangThai" text    not null default 'xet',
  "donVi"     jsonb   not null default '[]'::jsonb,
  "tnldIds"   jsonb   not null default '[]'::jsonb,
  "ghiChu"    text,
  "updatedBy" text,
  "updatedAt" text,
  constraint ttxs_quy_chk        check (quy between 1 and 4),
  constraint ttxs_id_chk         check (id = nam::text || '-' || quy::text),
  constraint ttxs_trangthai_chk  check ("trangThai" in ('xet', 'tnld')),
  constraint ttxs_donvi_arr_chk  check (jsonb_typeof("donVi") = 'array'),
  -- Chặn cứng: mỗi quý tối đa 2 đơn vị
  constraint ttxs_donvi_max_chk  check (jsonb_array_length("donVi") <= 2),
  -- Quý không xét do TNLĐ thì không có đơn vị nào được công nhận
  constraint ttxs_tnld_rong_chk  check ("trangThai" <> 'tnld' or jsonb_array_length("donVi") = 0)
);

create index if not exists ttxs_nam_quy_idx on public."TapTheXuatSac" (nam, quy);

-- ------------------------------------------------------------
-- 2) RLS
-- ------------------------------------------------------------
alter table public."TapTheXuatSac" enable row level security;

drop policy if exists ttxs_select_all on public."TapTheXuatSac";
create policy ttxs_select_all on public."TapTheXuatSac"
  for select using (true);

drop policy if exists ttxs_admin_write on public."TapTheXuatSac";
create policy ttxs_admin_write on public."TapTheXuatSac"
  for all to authenticated
  using (public.hse_current_role() = 'admin')
  with check (public.hse_current_role() = 'admin');

-- ------------------------------------------------------------
-- 3) SEED — số liệu I/2022 → II/2026 (theo file Excel theo dõi)
--    "on conflict do nothing": chạy lại không ghi đè dữ liệu đã sửa trên web.
-- ------------------------------------------------------------
insert into public."TapTheXuatSac" (id, nam, quy, "trangThai", "donVi", "updatedBy", "updatedAt") values
  ('2022-1', 2022, 1, 'xet',  '["Xưởng sửa chữa", "Đội xe VTHH&PTTBCD"]',          'seed', now()::text),
  ('2022-2', 2022, 2, 'xet',  '["Cảng biển", "Căn cứ Kho - Giao nhận"]',            'seed', now()::text),
  ('2022-3', 2022, 3, 'xet',  '["Đội xe VCHK", "Đội xe VTHH&PTTBCD"]',              'seed', now()::text),
  ('2022-4', 2022, 4, 'xet',  '["Cảng biển", "Căn cứ Kho - Giao nhận"]',            'seed', now()::text),
  ('2023-1', 2023, 1, 'tnld', '[]',                                                 'seed', now()::text),
  ('2023-2', 2023, 2, 'xet',  '["Xưởng sửa chữa", "Căn cứ Kho - Giao nhận"]',       'seed', now()::text),
  ('2023-3', 2023, 3, 'xet',  '["Cảng biển", "Đội xe VTHH&PTTBCD"]',                'seed', now()::text),
  ('2023-4', 2023, 4, 'xet',  '["Căn cứ Kho - Giao nhận", "Đội xe VCHK"]',          'seed', now()::text),
  ('2024-1', 2024, 1, 'xet',  '["Cảng biển", "Đội xe VTHH&PTTBCD"]',                'seed', now()::text),
  ('2024-2', 2024, 2, 'xet',  '["Căn cứ Kho - Giao nhận", "Đội xe VCHK"]',          'seed', now()::text),
  ('2024-3', 2024, 3, 'tnld', '[]',                                                 'seed', now()::text),
  ('2024-4', 2024, 4, 'xet',  '["Xưởng sửa chữa", "Đội xe VTHH&PTTBCD"]',           'seed', now()::text),
  ('2025-1', 2025, 1, 'xet',  '["Cảng biển", "Đội xe VCHK"]',                       'seed', now()::text),
  ('2025-2', 2025, 2, 'xet',  '["Xưởng sửa chữa", "Căn cứ Kho - Giao nhận"]',       'seed', now()::text),
  ('2025-3', 2025, 3, 'xet',  '["Đội xe VCHK", "Đội xe VTHH&PTTBCD"]',              'seed', now()::text),
  ('2025-4', 2025, 4, 'xet',  '["Cảng biển", "Căn cứ Kho - Giao nhận"]',            'seed', now()::text),
  ('2026-1', 2026, 1, 'xet',  '["Xưởng sửa chữa", "Đội xe VTHH&PTTBCD"]',           'seed', now()::text),
  ('2026-2', 2026, 2, 'xet',  '["Cảng biển", "Căn cứ Kho - Giao nhận"]',            'seed', now()::text)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4) TỰ LIÊN KẾT 2 quý TNLĐ cũ với vụ việc ở module Tai nạn - Sự cố
--    (chỉ điền khi chưa liên kết; bảng/ cột khác dự kiến thì bỏ qua,
--     Admin liên kết tay trên web cũng được)
-- ------------------------------------------------------------
do $$
begin
  update public."TapTheXuatSac" t
     set "tnldIds" = sub.ids
    from (
      select x.nam, x.quy, jsonb_agg(s.id order by s."thoiGian") as ids
        from public."TapTheXuatSac" x
        join public."TaiNan-SuCo_SuKien" s
          on s.loai = 'tai_nan_lao_dong'
         and substr(s."thoiGian", 1, 4)::int = x.nam
         and ((substr(s."thoiGian", 6, 2)::int - 1) / 3 + 1) = x.quy
       where x."trangThai" = 'tnld'
         and s."thoiGian" ~ '^\d{4}-\d{2}'
       group by x.nam, x.quy
    ) sub
   where t.nam = sub.nam and t.quy = sub.quy
     and jsonb_array_length(t."tnldIds") = 0;
exception when others then
  raise notice 'Bỏ qua bước tự liên kết TNLĐ: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5) DANH MỤC ĐƠN VỊ — bật trang "tap-the-xuat-sac" cho 5 ĐVSX.
--    Sau này Admin bật/tắt ở Quản trị hệ thống → Danh mục đơn vị
--    (cột "Tập thể xuất sắc").
-- ------------------------------------------------------------
update public."DonVi"
   set pages = pages || '["tap-the-xuat-sac"]'::jsonb,
       updated_at = now()
 where ma in ('cang_bien', 'xuong_sua_chua', 'can_cu_kho_gn', 'doi_xe_vchk', 'doi_xe_vthh')
   and not (pages ? 'tap-the-xuat-sac');

-- ------------------------------------------------------------
-- Kiểm tra
-- ------------------------------------------------------------
select id, "trangThai", "donVi", "tnldIds" from public."TapTheXuatSac" order by nam, quy;
