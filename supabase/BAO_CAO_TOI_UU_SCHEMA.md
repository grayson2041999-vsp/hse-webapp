# Báo cáo tối ưu hoá Database — Webapp Quản lý HSE

**Đơn vị:** Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị — Vietsovpetro
**Ngày:** 11/07/2026
**Phạm vi:** Đối chiếu 34 bảng schema thật (schema `public`) với logic thực tế trong mã nguồn (`assets/*.js` + các trang HTML).

---

## 1. Tóm tắt điều hành

Database hiện có **34 bảng**, tất cả đều đang được code sử dụng (không có bảng mồ côi). Vấn đề lớn nhất **không phải** ở số lượng bảng mà ở **cột trùng lặp**: mỗi bảng nghiệp vụ đang mang tới **8 cột thời gian/audit**, trong đó **4 cột hoàn toàn không được code đụng tới**.

Phát hiện chính:

- **112 cột "chết"** (`created_at`, `updated_at`, `created`, `updated`) nằm rải trên **28 bảng** — di sản từ thời chuyển đổi Google Sheets → Supabase. Bỏ được ngay, gần như không rủi ro.
- **Không nên gộp bảng.** Hai cặp bảng "trông giống nhau" (`kiem_tra_cap12/34`, `ke_hoach_lap_lai/mot_lan`) thực ra khác cấu trúc và có luồng UI riêng; gộp lại lợi ích rất nhỏ (bảng chỉ vài–vài chục dòng) mà rủi ro sửa code cao.
- **Chuẩn hoá kiểu dữ liệu** (mọi thứ đang là `text`) là cơ hội thật nhưng rủi ro cao hơn — xếp giai đoạn 2, không bắt buộc.

Khuyến nghị: **làm ngay việc dọn 112 cột chết** (đã có sẵn file `optimize_schema.sql` kèm bước kiểm tra an toàn). Các mục còn lại chỉ nên cân nhắc sau.

---

## 2. Cách hệ thống vận hành (để hiểu vì sao cột bị thừa)

Webapp là trang tĩnh HTML + JS thuần, gọi thẳng Supabase từ trình duyệt bằng `anon key`, bảo mật bằng RLS. Tầng truy cập dữ liệu là `assets/db.js`, giữ nguyên "hợp đồng" interface từ bản Google Sheets cũ (`getAll`, `insert`, `update`...). Mỗi "sheet" cũ được ánh xạ 1–1 sang một bảng Postgres cùng tên (riêng `users` → `profiles`).

Vì kế thừa từ Sheets, khi nhập dữ liệu lên Supabase, một loạt biến thể tên cột thời gian đã được tạo kèm (`createdAt` **và** `created_at` **và** `created`...). Code sau đó chỉ chuẩn hoá dùng **camelCase**, còn các biến thể kia bị bỏ lại thành cột rỗng.

**Bằng chứng đối chiếu code** (số lần xuất hiện trong toàn bộ mã nguồn):

| Cột | Số lần dùng | Kết luận |
|---|---|---|
| `createdAt` | 49 | Đang dùng — GIỮ |
| `createdBy` | 42 | Đang dùng — GIỮ |
| `updatedAt` | 14 | Đang dùng — GIỮ |
| `updatedBy` | 8 | Đang dùng — GIỮ |
| `created_at` | 2 | Chỉ dùng ở `activity_log`, `app_settings` |
| `updated_at` | 1 | Chỉ dùng ở `app_settings` |
| `created` / `updated` | rời rạc | Chỉ dùng ở `profiles`; còn lại là biến JS cục bộ |

---

## 3. Phát hiện #1 — 112 cột thời gian trùng lặp (ưu tiên cao)

Trên **28 bảng nghiệp vụ**, bốn cột `created_at`, `updated_at`, `created`, `updated` không hề được đọc/ghi. Code chỉ dùng `createdAt / updatedAt / createdBy / updatedBy`.

**Các bảng bị ảnh hưởng (mỗi bảng bỏ 4 cột):**
binh_ap_luc, chuc_danh, danh_muc, dinh_muc, hl_nhansu, hl_settings, ke_hoach_lap_lai, ke_hoach_mot_lan, kiem_tra_cap12, kiem_tra_cap34, ksk, lich_su_nhap_xuat, moi_truong, nha_thau, nhanvien, nhom_nv, nhom_tb, notifications, pccc_devices, pccc_errors, pccc_locked_months, pending_changes, phieu_requests, quy_list, sop, tnsc_gio_cong, tnsc_su_kien, ton_kho.

**Ngoại lệ — TUYỆT ĐỐI KHÔNG đụng tới** (đây là các bảng thiết kế đúng, dùng thật các cột này):

- `activity_log.created_at` — cột thời gian chính của nhật ký.
- `app_settings.updated_at` — code ghi trực tiếp khi lưu cấu hình.
- `profiles.created`, `profiles.updated` — code quản lý người dùng dùng đúng hai cột này.

**Lợi ích:** schema gọn hơn ~33% số cột audit, giảm nhầm lẫn khi bảo trì ("cột nào là thật?"), export/backup nhẹ hơn. **Rủi ro:** gần như bằng 0 nếu các cột đang rỗng.

**An toàn khi thực hiện:** file `optimize_schema.sql` có **Bước 0** đếm số giá trị khác NULL trong từng cột trước khi bỏ. Nếu tất cả = 0 thì bỏ hoàn toàn vô hại; nếu có dữ liệu di sản, cần xem lại trước.

---

## 4. Phát hiện #2 — Gộp bảng: KHÔNG khuyến nghị

Hai cặp bảng dễ tưởng là gộp được, nhưng phân tích cho thấy không nên:

**`kiem_tra_cap12` vs `kiem_tra_cap34`** (kiểm tra ATLĐ các cấp). Tuy cùng có cột `violations` (jsonb), phần còn lại khác hẳn: cấp 1–2 xoay quanh `thang / donVi / soLanKiemTra / soViPham` (thống kê theo tháng); cấp 3–4 xoay quanh `ngayKT / noiKT / doanKT` (theo đợt kiểm tra). Gộp lại sẽ tạo bảng nhiều cột NULL và phải viết lại toàn bộ logic trong `kiem-tra-cac-cap.html`.

**`ke_hoach_lap_lai` vs `ke_hoach_mot_lan`** (kế hoạch lặp lại vs một lần). Khác biệt bản chất: bản lặp lại có `months / allMonths / execDay`; bản một lần có `status / start / end / completionDate / completionReport`. Đây là hai loại thực thể khác nhau, đang được xử lý bằng hai luồng UI riêng trong `ke-hoach.html`.

**Kết luận:** các bảng này chỉ vài–vài chục dòng, nên gộp **không tiết kiệm gì đáng kể** về dung lượng/hiệu năng, trong khi buộc phải sửa code nghiệp vụ (rủi ro cao). Giữ nguyên là lựa chọn đúng. Cụm bảng danh mục (`chuc_danh`, `nhom_tb`, `nhom_nv`, `danh_muc`, `dinh_muc`, `quy_list`) và cụm PCCC (`pccc_devices/errors/locked_months`) đều đã tách đúng chuẩn — giữ nguyên.

---

## 5. Phát hiện #3 — Chuẩn hoá kiểu dữ liệu (giai đoạn 2, tuỳ chọn)

Các bảng nghiệp vụ kế thừa từ Sheets lưu **mọi thứ dưới dạng `text`**, kể cả:

- **Số** lưu bằng text: `nhanvien.stt`, `ton_kho.soLuong`, `kiem_tra_cap12.soLanKiemTra`, `tnsc_gio_cong.gio_cong`...
- **Ngày tháng** lưu bằng text: hầu hết các cột `*At`, `ngay*`, `thang`, `nam`.
- **Luận lý (true/false)** lưu bằng text: `nhanvien.coQuanAo`, `nhanvien.coGiay`.

Đáng chú ý: các bảng **mới** (`profiles`, `cap_phat_tien_trinh`) đã dùng kiểu chuẩn (`integer`, `boolean`, `jsonb`, `timestamptz`) — chứng tỏ hướng đi đúng đã có sẵn.

**Vì sao xếp giai đoạn 2:** đổi kiểu cột đòi hỏi code phải chắc chắn đọc/ghi đúng kiểu (hiện code đang thao tác chuỗi ở nhiều nơi). Lợi ích là truy vấn/sắp xếp/so sánh ngày–số chính xác hơn và ràng buộc dữ liệu chặt hơn, nhưng cần test kỹ từng trang. **Không nên làm chung đợt với việc dọn cột.**

---

## 6. Lộ trình đề xuất

**Bước 1 — Dọn cột chết (làm ngay).** Chạy `supabase/optimize_schema.sql`: Bước 0 kiểm tra rỗng → Bước 1 bỏ 112 cột. Backup trước (Supabase → Database → Backups) cho chắc.

**Bước 2 — Theo dõi.** Sau khi bỏ cột, dùng app bình thường vài ngày để xác nhận không có lỗi (rủi ro rất thấp vì code không tham chiếu các cột này).

**Bước 3 — (Tuỳ chọn) Chuẩn hoá kiểu dữ liệu** cho từng bảng, làm dần từng bảng một, mỗi lần kèm test trang tương ứng. Bắt đầu từ bảng đơn giản (`ton_kho`, `tnsc_gio_cong`) trước.

**Không làm:** gộp bảng — lợi ích không tương xứng rủi ro.

---

## 7. Phụ lục — Kiểm chứng trước khi bỏ cột

Trước khi chạy phần DROP, hãy chạy **Bước 0** trong `optimize_schema.sql`. Kết quả trả về số bản ghi có dữ liệu ở mỗi cột sắp bỏ. Nếu mọi ô đều bằng `0`, việc bỏ cột là an toàn tuyệt đối. Nếu có ô > 0, gửi lại kết quả để xử lý riêng bảng đó (ví dụ chép dữ liệu sang cột camelCase tương ứng trước khi bỏ).
