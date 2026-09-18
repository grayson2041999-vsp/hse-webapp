# Việc cần làm — Cấp phát BHLĐ

Ghi lại các vấn đề đã xác định nhưng chưa sửa, để nghiên cứu và xử lý sau.
Cập nhật lần cuối: 18/09/2026.

---

## 1. Thay so khớp tên trang bị bằng trường cấu hình trên nhóm

**Mức độ:** cao — lỗi thuộc loại âm thầm, không có dấu hiệu nào khi xảy ra.

### Vấn đề

Việc xác định một trang bị thuộc cột tháng cấp nào đang dựa vào **so khớp chuỗi
tên**, rải trong nhiều hàm của `cap-phat-bhld.html`:

```js
if (t.includes('Mũ'))          return ['thangCapMu', 'Mũ'];
if (t === 'Kính bảo hộ')       return ['thangCapKinh', 'Kính'];
if (t === 'Áo mưa')            return ['thangCapAoMua', 'Áo mưa'];
if (t === 'Bộ quần áo thợ hàn')return ['thangCapQAHan', 'QA thợ hàn'];
if (t.includes('Găng tay') || t === 'Khẩu trang') return null;  // cấp theo quý
```

Các nơi phụ thuộc vào cách nhận diện này:

- `_tbToThangField()` — bản gốc
- `tinhThangCapTiepTheo()` — xác định món cấp đôi lần đầu (`isDoubleFirst`)
- `applyQuarterlyDeadlines()` — đã gọi lại `_tbToThangField`, nhưng vẫn còn
  so tên cho trường hợp "Bộ quần áo nữ"
- `approvePhieu()` nhánh `nv_moi` — vẫn tự viết lại chuỗi `if` so tên
- `computeQuyData()` và `_duBaoNhuCau()` — nhận diện găng tay / khẩu trang
- `_tbCategory()`

### Hậu quả

Admin đổi tên một nhóm trong tab Danh mục (ví dụ "Kính bảo hộ" thành "Kính bảo
hộ chống hoá chất") là món đó **lặng lẽ biến mất khỏi mọi phiếu quý**:
`tinhThangCapTiepTheo` trả `null` với nhân viên cũ, `computeQuyData` bỏ qua, và
không có cảnh báo nào được phát ra.

### Đang bị ảnh hưởng (số liệu 18/09/2026)

- **Ghệt da** (nhóm 113, `loaiCo` rỗng) — không khớp điều kiện nào. Hiện chưa
  gây hại vì dòng định mức của nó thuộc chức danh đã bị xoá, nên không khớp
  nhân viên nào. Gắn lại vào một chức danh còn sống là lỗi phát tác ngay.
- **Năm nhóm thêm gần đây** đều cùng tình trạng: Bột giặt, Bảo vệ tai,
  Thiết bị & dụng cụ cho công tác hàn, Khác, Vật tư an toàn điện.
- **Mũ mềm** (nhóm 109) trước đây khớp `includes('Mũ')` nên dùng chung cột
  `thangCapMu` với Mũ bảo hộ — hai món chu kỳ khác nhau ghi đè lẫn nhau.
  Nhóm 109 nay đã bị xoá nên tạm thời hết va chạm, nhưng lỗi thiết kế còn đó.

### Hướng sửa đề xuất

Thêm trường cấu hình vào `DEFAULT_NHOM_TB` và bảng `CapPhatBHLD_NhomTrangBi`:

```js
{ id:108, ten:'Mũ bảo hộ', loaiCo:'', donVi:'cái',
  thangField:'thangCapMu',      // cột tháng cấp; null = không theo dõi tháng
  capTheoQuy:false,             // true với găng tay, khẩu trang
  capDoiLanDau:false }          // true với quần áo, giày, kính, QA thợ hàn
```

Rồi cho mọi nơi đọc từ trường này thay vì so tên. Thêm màn hình cấu hình trong
tab Danh mục để admin tự đặt khi tạo nhóm mới, và **cảnh báo khi một nhóm có
định mức nhưng chưa gán `thangField`** — biến lỗi âm thầm thành lỗi nhìn thấy
được. `tools/audit-bhld.html` đã có sẵn phép soát này (mục "Trang bị có định
mức nhưng không map được sang cột tháng nào").

Lưu ý khi sửa: `tools/audit-bhld.html` và `tools/sua-thang-cap.html` giữ bản sao
của `thangField()`; phải cập nhật cùng lúc để công cụ soát đúng code đang chạy.

---

## 2. Bốn nhân viên thiếu hoặc sai `ngày vào làm` — chờ nhân sự xác nhận

Cả bốn đều là nhân viên mới nhận đồ lần đầu, các ô tháng cấp tính đúng từ một
mốc gốc, chỉ sai ô `ngayVaoLam` nên hệ thống không nhận ra là mốc ảo hợp lệ và
báo cảnh báo ở ô Giày.

| Nhân viên | Danh số | Đơn vị | ngày vào làm | Mốc gốc suy ra |
|---|---|---|---|---|
| Đồng Huy Thắng | PSV06059 | Đội xe VTHH&PTTBCD | trống | 05/2026 |
| Nguyễn Tuấn Tài | PSV06022 | Căn cứ Kho - Giao nhận | trống | 06/2026 |
| Mai Bá Toản | PSV06023 | Đội xe VTHH&PTTBCD | 06/2026 | 05/2026 |
| Hoàng Phi Long | PSV04977 | Đội xe VTHH&PTTBCD | 08/2026 | 05/2026 |

Điền đúng `ngayVaoLam` là bốn cảnh báo tự hết. Với hai người cuối cần hỏi rõ:
ngày vào làm sai, hay các ô tháng cấp bị ghi sớm hơn thực tế.

Sai lệch nhỏ kèm theo (không gây cảnh báo vì còn trong biên 12/2026): ô Kính của
Hoàng Phi Long và Nguyễn Tuấn Tài đều muộn hơn mốc đúng 2 tháng.

---

## 3. Dọn dữ liệu rác

- **3 dòng định mức** trỏ tới nhóm trang bị đã bị xoá (nhóm 109 "Mũ mềm" ×2,
  nhóm 112 "Găng tay thợ hàn" ×1). `getTB()` trả `null` nên mọi hàm bỏ qua
  im lặng. Bảng `CapPhatBHLD_DanhMuc` cũng còn danh mục con `nhomId = 109`.
- **16 dòng định mức** thuộc chức danh đã bị xoá, đều thiếu chu kỳ. Hiện không
  khớp nhân viên nào nên vô hại, nhưng làm nhiễu bảng.
- **1 item trong phiếu Q3/2026 của Căn cứ Kho** trỏ tới danh mục đã bị xoá:
  "Bộ quần áo nữ cỡ 46", `tbId = mq6e7upnkyy0`. `applyQuarterlyDeadlines` bỏ qua
  item này (nay có ghi `console.warn`), nên nhân viên nữ đó đã nhận đồ mà tháng
  cấp không được cập nhật.
- Nên **chặn xoá nhóm / danh mục đang được định mức hoặc phiếu tham chiếu**,
  hoặc ít nhất cảnh báo trước khi xoá.

---

## 4. Hai lỗi tên trường trong `exportNV_PDF`

Trong hàm `exportNV_PDF` (`cap-phat-bhld.html`):

- dùng `n.thangCapNon` — trường không tồn tại, đúng là `thangCapMu`, nên cột
  "T.cấp Mũ BH" trong bản in **luôn hiện dấu gạch**;
- dùng `n.ma` — đúng là `danhSo`, nên cột Danh số **luôn trống**.

Hàm xuất Excel `_nvToExcelRow` không dính hai lỗi này, dùng làm mẫu đối chiếu.

---

## Đã xử lý xong (để tham khảo)

- `applyQuarterlyDeadlines` ghi mốc đến hạn cuối cùng còn nằm trong quý cấp,
  thay cho "mốc cũ + chu kỳ"; hàm nay idempotent. Đã sửa 168 bản ghi bị cộng
  thừa một chu kỳ (114 nhân viên, Căn cứ Kho và Đội xe VTHH&PTTBCD).
- Chu kỳ dạng chuỗi `"0,25"` làm số lượng cấp theo quý ra `NaN`; gom về
  `_ckSo()` và `_slTheoQuy()`, chuẩn hoá cả ô nhập ở form định mức.
- Chặn nhập tháng cấp nằm ở tương lai trên cả bốn đường nhập liệu; bật lại
  cảnh báo `future` với biên là hết quý muộn nhất đang có phiếu.
- Phiếu quý không còn lọc theo cột Thực tế: phiếu đã lập là đã cấp theo định
  mức, nhân viên không nhận thì thôi, mốc vẫn tính từ lần đó — thống nhất với
  luồng phiếu nhân viên mới.

## Công cụ

- `tools/audit-bhld.html` — soát dữ liệu, chạy lại bất cứ lúc nào.
- `tools/sua-thang-cap.html` — sửa các mốc bị cộng thừa chu kỳ, có sao lưu và
  hoàn tác. Cả hai phải mở cùng tên miền với webapp để dùng chung phiên đăng nhập.
- `tests/thang-cap.test.js`, `tests/thang-cap-nhap.test.js` — chạy bằng `node`.
