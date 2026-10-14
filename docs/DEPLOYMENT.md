# Cấu hình online miễn phí

Đây là hướng dẫn chuẩn bị; người dùng chưa tạo tài khoản ngoài. Không gửi DATABASE_URL, mật khẩu, merchant secret hoặc BRIDGE_SECRET vào chat/Git. Chỉ dùng dữ liệu hư cấu cho bài tập.

## Neon và Render

1. Tạo Neon project **Free**, database BlueMoon, chọn vùng gần Singapore nếu có. Lấy connection string **Direct/unpooled**, giữ TLS theo chuỗi Neon cấp; có thể thêm `connection_limit=3`. Lưu riêng để điền `DATABASE_URL`.
2. Đưa mã nguồn/lockfile lên Git repository của bạn. Không đưa `.env`, `.local`, dữ liệu database hoặc `node_modules` vào Git.
3. Tạo Render Web Service qua `render.yaml` hoặc thủ công: Node 24, region Singapore, instance **Free**, build `npm ci --include=dev && npm run build`, start `npm run db:deploy && npm start`, health check `/api/health`.
4. Điền biến môi trường: `NODE_ENV=production`, `DEMO_MODE=false`, `DATABASE_URL`, `APP_URL` là URL HTTPS thật không có `/` cuối, `BRIDGE_SECRET` ngẫu nhiên ít nhất 32 ký tự. Blueprint có thể sinh secret này. Các biến Gmail/VNPAY để trống đến bước tương ứng.
5. Deploy, kiểm tra `/api/health` trả `status: ok` và trang đăng nhập mở được. Startup không tự seed.

Giữ gói Free và không bật nâng cấp trả phí tự động. Kiểm tra quota ở dashboard và [Neon pricing](https://neon.com/pricing). Render Free có thể ngủ sau 15 phút không có traffic; lần truy cập đầu có thể chậm, giờ chạy miễn phí giới hạn theo workspace. Không dùng Render Postgres Free để giữ dữ liệu lâu dài vì database đó có hạn sử dụng. [Tài liệu Render Free](https://render.com/docs/free)

## Gmail Apps Script

Dùng Gmail riêng cho project. Tạo standalone Apps Script project, chép `integrations/apps-script/Code.gs`. Bật hiện manifest trong Project Settings và chép `appsscript.json`.

Trong Script Properties:

- `BRIDGE_SECRET`: cùng chuỗi đang lưu tại Render.
- `APP_URL`: URL HTTPS của website.
- `EMAIL_ALLOWLIST`: email thử nghiệm bạn kiểm soát, cách nhau bằng dấu phẩy; điền cùng danh sách vào Render.

Chạy `setupBridge` một lần, cấp quyền. Nó tạo Google Sheet riêng để ghi ID/hash/trạng thái gửi, không lưu nội dung email/OTP; `JOURNAL_ID` được tự ghi vào Script Properties. Giữ Sheet riêng tư. Nó cũng tạo trigger daily khoảng 08h giờ Việt Nam.

Deploy → New deployment → **Web app** → Execute as **Me** → Who has access **Anyone**. Server cần gọi endpoint công khai; HMAC, timestamp, nonce và allowlist kiểm soát lệnh gửi. Copy URL `/exec` vào `APPS_SCRIPT_URL` trên Render; không dùng `/dev`. Khi sửa Apps Script cần cập nhật deployment version. [Google Web Apps](https://developers.google.com/apps-script/guides/web)

MailApp kiểm tra quota trước khi gửi; tài khoản cá nhân thường có 100 người nhận/ngày. Quota có thể thay đổi: xem [Google quotas](https://developers.google.com/apps-script/guides/services/quotas) và [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).

Server lưu outbox cùng transaction nghiệp vụ. OTP ưu tiên, hạn 5 phút, gửi lại tối thiểu 60 giây. Một lượt xử lý tối đa 50 email; quản lý có thể bấm xử lý tiếp. SMS luôn **mô phỏng**, không gọi nhà mạng. Daily trigger xử lý bù khi Render thức dậy; không cần keep-alive liên tục.

- `QUEUED`/`RETRY`: chờ gửi.
- `ACCEPTED`: MailApp nhận lệnh thành công; không chứng minh thư vào Inbox hoặc đã đọc.
- `UNKNOWN`: chưa rõ kết quả; bridge không tự gửi lại một lệnh đã bắt đầu mà chưa rõ kết quả.
- `BLOCKED`/`NOT_CONFIGURED`: chưa có allowlist/cấu hình.
- `SUPPRESSED`/`EXPIRED`: không còn nợ cần nhắc, thông tin liên hệ đổi hoặc OTP hết hiệu lực.

Nếu journal có `SENDING`/`UNKNOWN`, kiểm tra thư đã gửi bằng **Mã thông báo** trong footer. Chỉ khi xác nhận đã có thư, đổi trạng thái journal thành `ACCEPTED`; lượt xử lý tiếp sẽ đối chiếu ID. Chỉ khi xác nhận chưa gửi mới đổi thành `RETRY`. Không xóa journal để thử lại vì có thể gửi trùng. Đây là thao tác đối chiếu thủ công khi kết quả mơ hồ, không phải cam kết Gmail giao thư đúng một lần.

## Quản lý đầu tiên trên database online mới

Từ local, dùng file `.env` riêng được bỏ qua bởi Git, trỏ `DATABASE_URL` đúng Neon. Đặt `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PHONE`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD`. Email phải nằm trong allowlist; mật khẩu ít nhất 10 ký tự có chữ hoa/thường/số.

```powershell
npm run db:deploy
npm run db:bootstrap
```

Lệnh từ chối nếu đã có quản lý, không ghi đè tài khoản. Xóa giá trị BOOTSTRAP sau khi dùng và trả `.env` về database local khi tiếp tục phát triển. Trên website: đăng nhập, đổi mật khẩu tạm, đăng nhập lại, xác minh email, rồi cấp tài khoản kế toán/hộ.

Không public database seed với mật khẩu demo đã biết. Dữ liệu online nhập qua quản lý riêng; dùng database local hoặc một database thử nghiệm riêng để trình diễn seed.

## VNPAY Sandbox

Đăng ký merchant theo [tài liệu VNPAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html). Điền `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` vào Render. Cổng mặc định là Sandbox, không đổi sang cổng tiền thật.

- Return: `https://<service>.onrender.com/api/v1/vnpay/return`.
- IPN: `https://<service>.onrender.com/api/v1/vnpay/ipn`; khai báo theo quy trình merchant VNPAY.
- Query dùng endpoint Sandbox chính thức. Không tích hợp refund API.

Return chỉ đưa trình duyệt về website. Server chỉ ghi thành công sau IPN/query đúng chữ ký, merchant, mã giao dịch, số tiền và trạng thái. IPN chậm khi Render ngủ: dùng đối soát giao dịch chờ, không nhập thêm phiếu thủ công chỉ dựa trên màn hình ngân hàng.

## Kiểm tra sau cấu hình

1. HTTPS/cookie Secure, login email/số điện thoại, logout.
2. Email VERIFY/RESET tới đúng địa chỉ thử nghiệm; mã sai/hết hạn/dùng lại bị từ chối.
3. VNPAY thành công/thất bại, return trước IPN, callback lặp, query lại; sổ chỉ tăng một lần.
4. Daily trigger, cold start, quota và lỗi gửi; hộ đã trả không nhận nhắc nợ cũ.
5. Cư dân A không xem hộ B; kế toán không sửa hồ sơ hoặc thao tác quản lý.
6. Excel/In/Lưu PDF và điện thoại.

Chưa coi các bước này là đạt đến khi đã thực hiện trên tài khoản của bạn. Sao lưu bằng `pg_dump` và thử phục hồi vào database riêng; giữ file sao lưu riêng tư, không phục hồi đè database đang dùng.
