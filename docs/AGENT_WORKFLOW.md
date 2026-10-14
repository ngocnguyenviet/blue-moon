# Blue Moon — Cấu hình nhóm Codex CLI

Cấu hình hiện tại: Astra (`gpt-6-astra`, high) điều phối và lập kế hoạch; `developer` dùng Sol (`gpt-6.1-sol`, high) viết code; `web_tester` dùng Luna (`gpt-6-luna`, high) kiểm thử trình duyệt bằng Playwright MCP.

Thư mục này hiện mới có cấu hình nhóm, chưa có ứng dụng web. Astra phải làm rõ phạm vi và yêu cầu môn học trước khi giao triển khai.

## Bắt đầu

Mở PowerShell:

```powershell
cd "D:\2026.1\KTPM\blue-moon-demo"
codex --strict-config
```

Nếu Codex hỏi có tin cậy project không, chọn tin cậy cho thư mục này để nạp `.codex/config.toml`. Trong CLI, kiểm tra `/status` để xác nhận model chính là `gpt-6-astra`; `/mcp` phải hiện Playwright. Danh sách MCP chỉ chứng minh đã đăng ký, chưa chứng minh công cụ trình duyệt kết nối thành công.

Chuyển sang `/plan`, rồi dán nội dung [START_PROMPT.md](START_PROMPT.md). Trả lời từng nhóm câu hỏi của Astra. Giai đoạn này chưa cài thư viện hoặc viết ứng dụng.

Khi muốn chuyển sang triển khai, tắt Plan mode qua `/plan` và gửi:

> Triển khai kế hoạch vừa thống nhất. Dùng custom agent `developer` để viết code và kiểm tra API/database/build. Khi server sẵn sàng, dùng custom agent `web_tester` kiểm thử các luồng bằng Playwright MCP, báo lỗi có bằng chứng, để developer sửa rồi kiểm thử lại. Astra tổng hợp kết quả và các tiêu chí chưa đạt.

Dùng `/agent` để xem agent phụ. Kiểm tra mỗi agent dùng đúng model theo vai trò, tránh chỉ đổi tên một agent dùng model mặc định.

Playwright đang khai báo `npx -y @playwright/mcp@latest`; lần đầu có thể cần mạng để tải MCP và browser. Việc đăng nhập, tải công cụ và khởi chạy web sẽ được kiểm tra riêng khi đến giai đoạn triển khai.

## Nguồn tài liệu

Đề tài gốc nằm trong `../Slide_md`. Phân tích của bản trước nằm trong `../demo/docs`. Không dùng các mục `Tested` của bản trước làm bằng chứng cho ứng dụng mới.

Tài liệu chính thức:

- [Custom subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Project config và trust](https://learn.chatgpt.com/docs/config-file/config-basic)
- [CLI slash commands](https://learn.chatgpt.com/docs/reference/slash-commands)
