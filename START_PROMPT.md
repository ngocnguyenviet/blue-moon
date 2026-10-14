# Prompt khởi động giai đoạn làm rõ và lập kế hoạch

Dán phần dưới vào phiên Codex CLI chạy trong `D:\2026.1\KTPM\blue-moon-demo`, sau khi chuyển sang `/plan`.

---

Mục tiêu của tôi là làm website Blue Moon đáp ứng đúng yêu cầu đồ án Kỹ thuật phần mềm và có các tài liệu cần thiết để bảo vệ đồ án.

Bạn là GPT-6 Astra, phụ trách làm rõ yêu cầu, lập kế hoạch, kiến trúc và điều phối. Agent `developer` dùng GPT-6.1 Sol để viết code; agent `web_tester` dùng GPT-6 Luna để kiểm thử trình duyệt. Hãy đọc AGENTS.md và cấu hình các agent.

Hiện tại chỉ làm rõ yêu cầu và lập kế hoạch, chưa triển khai code, chưa cài thư viện, chưa khởi chạy web hoặc giao Sol viết code.

Trước tiên hãy đọc nguồn đề tài trong `D:\2026.1\KTPM\Slide_md`, đặc biệt Pr01, Pr03 và bài C7.6. Đọc thêm `D:\2026.1\KTPM\demo\docs\REQUIREMENTS.md`, `ANALYSIS.md`, `SOURCE_AUDIT.md`, `TRACEABILITY.md` để hiểu bản demo trước; không mặc định mọi quyết định cũ và trạng thái kiểm thử cũ áp dụng cho bản mới.

Hãy hỏi tôi mọi điểm chưa rõ có ảnh hưởng đến phạm vi, nghiệp vụ, tiêu chí nghiệm thu, kiến trúc hoặc kế hoạch. Chia thành từng nhóm tối đa 5 câu và chờ tôi trả lời. Nếu câu trả lời mở ra điểm chưa rõ mới, tiếp tục hỏi. Không tự xem điều chưa trả lời là đã đồng ý. Chỉ hỏi sau khi đã đọc nguồn, không lặp lại điều đã được xác nhận.

Nhóm đầu tiên cần làm rõ: xây mới hay kế thừa demo; đề bài/rubric nào được dùng; các tài liệu phải nộp; deadline và ràng buộc công nghệ. Nếu không tìm thấy rubric chính thức, hãy nói rõ và hỏi tôi nguồn đó.

Khi đã đủ thông tin, trình bày kế hoạch với: phạm vi trong/ngoài; vai trò, use case và nghiệp vụ; stack/kiến trúc đề xuất cùng lý do; dữ liệu/API; tiêu chí nghiệm thu kiểm chứng được; công việc theo phụ thuộc giao cho Sol; bộ kiểm thử giao cho Luna; tài liệu môn học cần tạo. Mỗi yêu cầu phải có nguồn hoặc quyết định của tôi và cách kiểm chứng.

Trước mắt hãy trả lời ngắn về những gì đã xác nhận từ tài liệu và bắt đầu nhóm câu hỏi đầu tiên. Chờ tôi yêu cầu triển khai sau giai đoạn lập kế hoạch.
