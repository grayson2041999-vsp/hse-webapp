-- =========================================================
--  Đổi nhãn log cũ: "PCCC & CNCH" → "Báo cáo HTBCTĐ"
--  Chạy trong Supabase → SQL Editor (bỏ qua RLS).
--  Chạy được nhiều lần: lần sau sẽ không còn dòng nào khớp.
-- =========================================================

-- BƯỚC 1 — XEM TRƯỚC (chạy riêng khối này, kiểm tra kết quả)
select id, created_at, module, detail,
       regexp_replace(detail, '\s*HTBCTĐ\s*$', '') as detail_moi
from public.activity_log
where module = 'PCCC & CNCH'
order by created_at desc;

-- BƯỚC 2 — CẬP NHẬT (chạy sau khi xem bước 1 thấy đúng)
begin;

update public.activity_log
set module = 'Báo cáo HTBCTĐ',
    detail = regexp_replace(detail, '\s*HTBCTĐ\s*$', '')
where module = 'PCCC & CNCH';

-- Kiểm tra: phải trả về 0
select count(*) as con_lai from public.activity_log where module = 'PCCC & CNCH';

commit;
