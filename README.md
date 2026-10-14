# BlueMoon

Website tiếng Việt quản lý cư trú, khoản thu và thanh toán thử nghiệm cho một chung cư; ba vai trò **quản lý**, **kế toán**, **cư dân**. Dữ liệu mẫu hư cấu, SMS và thanh toán local được ghi rõ là mô phỏng.

React + TypeScript, Express, Prisma, PostgreSQL. Một Express service phục vụ cả API và bản dựng React. Phiên đăng nhập lưu trong PostgreSQL, cookie HttpOnly; không lưu token phiên trong localStorage.

## Chạy trên máy hiện tại

Database riêng tại `.local/pgdata`, cổng **55432**; địa chỉ `127.0.0.1` và cổng đã được lưu trong cấu hình cluster. `.env` đã có cấu hình local và không được đưa lên Git. Nếu database chưa chạy, mở PowerShell trong project:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D "$PWD\.local\pgdata" status
# Chỉ chạy dòng sau nếu status báo chưa chạy:
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D "$PWD\.local\pgdata" -l "$PWD\.local\postgres.log" start
npm run build
npm start
```

Mở **http://localhost:3000**, dừng server bằng Ctrl+C. Windows: dừng Node server trước `prisma generate`/`npm run build` nếu gặp lỗi khóa `query_engine-windows.dll.node`.

Tài khoản demo local: `manager@bluemoon.local`, `accountant@bluemoon.local`, `resident@bluemoon.local`; mật khẩu chung **`BlueMoon2026!`**. Đây là thông tin công khai cho dữ liệu mẫu, không dùng làm tài khoản quản trị công khai trên Internet.

## Cài mới

Cần Node 22/24 và PostgreSQL. Tạo database riêng `bluemoon`; tài khoản kết nối cần quyền tạo bảng/schema. Chép `.env.example` thành `.env`, điền `DATABASE_URL`; giữ `NODE_ENV=development`, `DEMO_MODE=true`, `APP_URL=http://localhost:3000` cho local. Chưa cần Gmail/VNPAY.

```powershell
npm ci
npm run db:deploy
npm run db:seed
npm run build
npm start
```

Seed gồm 30 căn và sáu tháng 04–09/2026, có chuyển đi/chuyển vào, xe, điện nước, thanh toán một phần, nợ và điều chỉnh. Seed tiếp tục phần còn thiếu nếu bị ngắt; sau audit `SEED_COMPLETE` sẽ không ghi lại hoặc xóa dữ liệu đã sửa.

Khi phát triển, mở hai terminal `npm run dev` và `npm run dev:web`, truy cập http://localhost:5173. Không chạy `npm start` đồng thời với `npm run dev` trên cổng 3000.

## Luồng trình diễn

- Quản lý cấp tài khoản hộ, lưu lịch sử cư trú/số người/xe. Tài khoản mới phải đổi mật khẩu tạm, xác minh email.
- Kế toán nhập đơn giá/chỉ số, lập nháp tháng, kiểm tra cách tính rồi phát hành những khoản đủ dữ liệu. Thiếu chỉ số chỉ chặn phí điện/nước tương ứng.
- Cư dân xem đúng hộ mình, chọn một khoản để nộp đủ hoặc một phần, xem phiếu và thông báo. Local dùng trang thanh toán mô phỏng; online cần cấu hình VNPAY Sandbox.
- Quản lý điều chỉnh, ghi giảm/khôi phục nợ và hủy phiếu nhập tay có lý do. Hoàn tiền là ghi nhận khoản đã hoàn bên ngoài, cần số dư còn lại của đúng phiếu; không có API chuyển tiền hoàn tự động.
- Báo cáo chọn tháng/quý, xuất Excel hoặc In/Lưu PDF. Tiền nhận tính theo ngày giờ Việt Nam; phân bổ số dư không tính là thu mới. Dư nợ/phải thu là trạng thái hiện tại của các khoản trong kỳ, không phải ảnh chụp chốt sổ quá khứ.

Ngày chuyển đi/ngừng gửi xe không tính phí. Phí tháng chia theo số ngày thực; điện nước lấy chênh chỉ số, không chia ngày. Từng khoản làm tròn half-up đến một đồng sau khi cộng các khoảng. Nợ hộ cũ vẫn thuộc hộ cũ; hộ mới không chịu thay. Ghi giảm nợ không có nghĩa là đã thanh toán.

## Kiểm thử và mã nguồn

```powershell
npm test
npm run build
npm audit
```

`npm test` cần PostgreSQL. Kiểm thử tích hợp tự tạo schema `bm_test_<pid>_<timestamp>`, chạy migrations và xóa **chỉ schema tạm đó** khi xong, không reset database demo. Kiểm thử Apps Script dùng dịch vụ Google giả lập và không gửi email thật.

- `src/`: giao diện và gọi API; `server/`: auth, cư trú, tính phí, sổ thu, VNPAY, outbox, báo cáo.
- `prisma/`: schema/migrations; `tests/`: nghiệp vụ, API/DB, OTP, chữ ký, đồng thời và email bridge.
- `integrations/apps-script/`: Gmail bridge và lịch daily.
- [Yêu cầu](docs/REQUIREMENTS.md), [đối chiếu kiểm thử](docs/TRACEABILITY.md), [kiểm thử trình duyệt](docs/BROWSER_QA.md), [trạng thái thực hiện](docs/IMPLEMENTATION_STATUS.md).

API có prefix `/api/v1`: `auth`, `households`, `apartments`, `vehicles`, `readings`, `fees`, `billing-periods/generate`, `charges`, `payments`, `campaigns`, `reports`, `notifications`, `staff`, `audit`. Quyền kiểm tra tại server. Danh sách dùng `page`, `limit` (1–100), `search`; trường sort được giới hạn theo tài nguyên.

## Online và tài nguyên

[Hướng dẫn Render, Neon, Gmail và VNPAY Sandbox](docs/DEPLOYMENT.md). Chưa triển khai bên ngoài, chưa xác nhận email tới hộp thư hay callback Sandbox thực. Dùng miền miễn phí Render, không cần mua tên miền.

Logo mặt trăng/tòa nhà là SVG của project. Ảnh nền [Baruk Granda / Unsplash](https://unsplash.com/photos/modern-apartment-building-at-dusk-with-lit-windows-h88Wet8W2hM), theo [Unsplash License](https://unsplash.com/license), lưu trong `public/`. Không dùng logo Vinhomes.

Nguồn môn học là Pr01/Pr03 và C7.6 trong `../Slide_md`, kết hợp quyết định của người dùng. Chưa có rubric chấm điểm chính thức. `START_PROMPT.md` và [cấu hình nhóm ban đầu](docs/AGENT_WORKFLOW.md) là tài liệu khởi động lịch sử; người dùng đã cho phép triển khai trong hội thoại.
# blue-moon
