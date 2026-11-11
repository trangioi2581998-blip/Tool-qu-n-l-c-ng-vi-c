# Nhịp việc

Website tiếng Việt để mỗi người theo dõi việc của mình và cùng nhóm quản lý tiến độ. Frontend dùng React và Vite. Backend dùng Supabase Auth, Postgres và Row Level Security (RLS).

## Nghiên cứu sản phẩm

Câu hỏi của bản đầu là mỗi người bắt đầu từ đâu để biết việc nào cần làm trước, và nhóm xem tiến độ chung ở đâu.

| Tham chiếu | Cách áp dụng |
| --- | --- |
| [Asana My Tasks](https://help.asana.com/s/article/my-tasks) gom các việc được giao qua nhiều dự án và hỗ trợ tạo việc riêng. | **Việc của tôi** gom việc được giao trong nhóm đang mở và việc **Chỉ mình tôi**. Dùng bộ lọc để xem riêng từng loại. |
| [Linear Display Options](https://linear.app/docs/display-options) hỗ trợ chuyển giữa danh sách và bảng, nhóm theo thuộc tính. | Bảng Kanban mở mặc định, nhóm theo bốn trạng thái và hỗ trợ kéo thả. Danh sách dùng để rà hạn và ưu tiên. Lịch dùng ngày đến hạn làm mốc. |

Tiến độ tính bằng số việc đã hoàn thành chia cho tổng số việc của góc nhìn đang mở. Bộ lọc ngày **7 ngày tới** tính cả hôm nay. Nếu tham gia nhiều nhóm, dùng menu chọn nhóm để chuyển dữ liệu nhóm đang xem.

## Cấp việc và phân công

| Cấp | Quan hệ | Ví dụ |
| --- | --- | --- |
| **L1 · Việc chính** | Đứng đầu một nhóm việc | Rà soát lỗi đăng nhập |
| **L2.1, L2.2… · Việc con** | Thuộc một việc L1, đánh số theo thứ tự thêm trong việc chính đó | Kiểm tra lỗi trên app, kiểm tra lỗi trên web |

Trong chế độ **Danh sách**, việc con nằm ngay dưới việc chính theo thứ tự L2.1, L2.2… Bấm mũi tên cạnh L1 để thu gọn hoặc mở nhánh. Khi tìm kiếm hoặc lọc ra một việc con, dòng **Việc chính liên quan** cho biết việc con thuộc nhánh nào. Bấm tên công việc để mở chi tiết và cập nhật trạng thái.

Mỗi dòng việc có **Người giao** và **Người được giao**. Người giao là người tạo phân công hoặc người gần nhất thay đổi danh sách người được giao. Với dữ liệu cũ chưa lưu người giao, danh sách hiển thị người tạo việc. Nếu một việc có nhiều người được giao, tất cả tên xuất hiện trong cùng cột.

Chọn **Tạo công việc** để mở cây hai cấp. Nhập việc chính L1 ở gốc, rồi bấm **Thêm việc con** để thêm các nhánh L2.1, L2.2… ngay bên dưới. Bấm **Lưu công việc** để tạo cả việc chính lẫn các việc con cùng lúc. Mỗi nút L1 và L2 có mô tả tùy chọn, người thực hiện, trạng thái, ưu tiên, ngày giao và ngày hoàn thành. Ngày hoàn thành trong biểu mẫu là hạn dự kiến. Việc con lấy sẵn người thực hiện, ngày và ưu tiên từ L1 và khởi tạo ở **Cần làm**. Bạn có thể chỉnh riêng ngay trong từng nhánh trước khi lưu. Khi trưởng nhóm tạo việc trong nhóm đang mở, biểu mẫu mặc định chọn **Việc của nhóm** để có thể phân công ngay từ L1. Chọn **Chỉ mình tôi** khi tạo việc cá nhân.

Mở công việc từ Kanban, Danh sách hoặc Lịch để xem cùng bố cục cây. Trong chi tiết L1, bấm tên một nhánh để mở và sửa việc con, hoặc chọn **Thêm việc con L2** để thêm nhánh. Khi mở một việc L2, bạn vẫn xem được L1 và các nhánh cùng cấp. Trưởng nhóm có thể bấm **Đổi người thực hiện L1** để mở ngay danh sách người thực hiện của việc chính. Việc con theo phạm vi nhóm hoặc cá nhân của L1. Nếu muốn đổi cấp hoặc xóa một việc đang có cấp dưới, hãy chuyển hoặc xóa các việc con trước. Mã của việc con đã lưu giữ nguyên khi thêm hoặc xóa việc khác trong cùng việc chính. Mỗi việc có một trạng thái chung cho tất cả người được giao.

| Vai trò | Quyền |
| --- | --- |
| **Trưởng nhóm** | Người tạo nhóm giữ vai trò này. Trưởng nhóm tạo việc nhóm, chọn một hoặc nhiều người thực hiện, đổi phân công, tổ chức các cấp việc, duyệt gia hạn và tạo tài khoản cho thành viên. |
| **Nhân viên** | Người được mời vào nhóm giữ vai trò này. Nhân viên xem việc nhóm và bình luận. Với việc được giao, nhân viên có thể cập nhật nội dung, trạng thái và ưu tiên. Khi việc quá hạn, nhân viên có thể gửi yêu cầu gia hạn. |
| **Chủ việc riêng** | Mỗi người có thể tạo, chỉnh sửa và xóa việc riêng của mình. |

Trong mục **Việc của nhóm**, trưởng nhóm có thể lọc theo người thực hiện hoặc cấp việc. Việc được giao xuất hiện trong **Việc của tôi** của từng nhân viên. Nhân viên có thể cập nhật trên thẻ việc hoặc di chuyển thẻ trên Kanban.

Lời mời gắn với email đã xác nhận, dùng một lần và có hiệu lực 7 ngày. Trưởng nhóm có thể gửi liên kết mời đã sao chép hoặc dùng **Thành viên → Tạo tài khoản**. Để tạo tài khoản, nhập họ tên, email, mật khẩu ban đầu và xác nhận mật khẩu. Thành viên xác nhận email rồi đăng nhập bằng mật khẩu ban đầu. Nếu email đã có tài khoản, thao tác thêm tài khoản đó vào nhóm.

## Tài liệu đính kèm

Trong thẻ L1 hoặc L2, chọn **Chọn tệp** để đính kèm một hoặc nhiều tài liệu, tối đa 10 MB mỗi tệp. Tệp được tải lên khi lưu công việc. Nếu có tệp tải lên lỗi, có thể thử lại riêng các tệp đó trong hộp thoại.

Mở **Chi tiết công việc** để tải tài liệu xuống. Người có quyền sửa công việc có thể thêm hoặc gỡ tài liệu. Hãy gỡ tài liệu trước khi xóa công việc. Bản demo lưu nội dung tệp trên trình duyệt bằng IndexedDB. Bản kết nối Supabase lưu tệp trong bucket riêng tư và áp dụng quyền xem hoặc sửa theo công việc. [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)

## Hoàn thành việc chính

- Bạn chỉ có thể chuyển L1 sang **Hoàn thành** khi mọi việc L2 bên dưới đã hoàn thành. L1 đứng riêng có thể hoàn thành trực tiếp.
- Khi cần mở lại một việc con hoặc thêm việc con chưa hoàn thành vào L1 đã đóng, hãy mở lại L1 trước.
- Quy tắc áp dụng khi đổi trạng thái trong chi tiết công việc, kéo thả Kanban hoặc cập nhật qua Supabase. Migration đưa L1 từng được đánh dấu hoàn thành khi vẫn còn L2 chưa xong về **Đang làm**.

## Ngày giao và gia hạn

- Việc mới ở cả hai cấp có **Ngày giao** và **Ngày hoàn thành (hạn)**. Khi tạo việc, ngày giao mặc định là hôm nay. Hạn hoàn thành phải từ ngày giao trở đi.
- Hạn kết thúc lúc hết ngày theo giờ Việt Nam. Từ ngày hôm sau, người được giao có thể mở thẻ quá hạn, chọn **Xin gia hạn**, nhập hạn đề xuất và lý do.
- Mỗi việc có một yêu cầu chờ duyệt tại một thời điểm. Trưởng nhóm lọc **Chờ duyệt gia hạn**, mở thẻ rồi chọn **Duyệt gia hạn** hoặc **Từ chối**. Khi duyệt, hạn mới thay thế hạn cũ. Khi từ chối, hạn cũ tiếp tục áp dụng và người gửi xem được lý do.
- Nếu công việc hoàn thành trong lúc chờ, hệ thống đóng yêu cầu và gửi thông báo. Ngày giao của việc cũ được lấy từ ngày tạo. Nếu một việc cũ thiếu hạn, hãy bổ sung hạn trước khi giao lại.

## Chạy trong Antigravity

1. Giải nén ZIP rồi dùng **Open Folder** để mở thư mục `nhip-viec`.
2. Cài Node.js 22.12 trở lên. Mở Terminal trong Antigravity và chạy:

   ```bash
   npm ci
   npm run dev
   ```

3. Mở địa chỉ `Local` mà Vite in ra. Khi chưa điền thông số Supabase, website mở ở chế độ demo và lưu thay đổi trên trình duyệt. Dữ liệu demo và dữ liệu tài khoản được lưu riêng.

## Kết nối Supabase

1. Trong **SQL Editor**, chạy từng file trong `supabase/migrations/` theo thứ tự tên. Với cơ sở dữ liệu mới, chạy cả mười file. Nếu đã kết nối phiên bản cũ, chạy các file còn thiếu trước khi cập nhật frontend.
   - Nếu đã chạy đến `20261111140000_task_attachments.sql`, chạy `20261111153000_task_assigned_by.sql` để bắt đầu lưu người giao.
   - Bản nâng cấp đưa việc từng gắn dự án vào góc nhìn **Việc của nhóm**. Công việc, liên kết L1–L2 và dữ liệu lịch sử được giữ lại. Có thể chuyển một L2 sang L1 khác trong cùng nhóm.
   - Migration cây hai cấp đưa việc L3 cũ thành các nhánh L2 dưới L1 ban đầu. Mã L2 đã có, ID công việc, ngày giao, hạn, người thực hiện và bình luận được giữ lại.
2. Tạo `.env.local` ở thư mục gốc dựa trên `.env.example`. Lấy **Project URL** và **Publishable key** từ project Supabase:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   Giá trị `VITE_*` đi vào mã phía trình duyệt. Dùng Publishable key. Mọi thao tác dữ liệu kiểm tra phiên đăng nhập và quyền trong Postgres.

3. Trong **Authentication**, bật nhà cung cấp **Email** và **Confirm email**. Tại **URL Configuration**, thêm địa chỉ chạy website vào **Redirect URLs**. Ví dụ môi trường phát triển có thể dùng `http://localhost:5173/**` để giữ tham số lời mời khi xác nhận email. Khi có URL chính thức, đặt URL đó làm **Site URL** rồi thêm URL gốc và mẫu cho liên kết mời (`https://viec.example.com/?invite=*`). Nếu đã phát hành lời mời bằng phiên bản cũ, giữ URL `https://viec.example.com/?setup=invite` cho các lời mời đó. Liên kết mời tạo ở website chạy trên máy chỉ mở được với người có thể truy cập địa chỉ đó.
4. Cấu hình **Custom SMTP** cho nhóm thật. SMTP mặc định của Supabase chỉ gửi email xác thực tới địa chỉ thuộc nhóm quản trị project Supabase. Cài SMTP riêng để đồng đội bên ngoài nhóm quản trị nhận được email xác nhận và đặt lại mật khẩu.
5. Khởi động lại `npm run dev`, đăng ký tài khoản đầu tiên rồi tạo nhóm. Làm theo phần bên dưới để bật nút **Tạo tài khoản** và email công việc cho project.

Tài liệu Supabase gồm [Kết nối React](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) · [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) và [Database functions](https://supabase.com/docs/guides/database/functions).

## Bật tạo tài khoản và email thật

### Triển khai hai Edge Functions

Chạy từ thư mục `nhip-viec` bằng Supabase CLI đã đăng nhập. Thay `YOUR_PROJECT_REF` bằng mã project.

```bash
supabase functions deploy provision-work-member --project-ref YOUR_PROJECT_REF
supabase functions deploy notify-work-email --project-ref YOUR_PROJECT_REF
```

Trong **Edge Functions → Secrets**, đặt các giá trị sau. Supabase cung cấp `SUPABASE_URL` và khóa phía máy chủ cho Edge Functions. Hai hàm đọc khóa `default` từ `SUPABASE_SECRET_KEYS`, có hỗ trợ cấu hình một khóa và `SUPABASE_SERVICE_ROLE_KEY` của project cũ.

| Biến | Giá trị |
| --- | --- |
| `WORK_APP_URL` | URL gốc mà nhóm có thể mở, ví dụ `https://viec.example.com/`. |
| `WORK_ALLOWED_ORIGINS` | Tùy chọn. Các origin bổ sung được phân tách bằng dấu phẩy, ví dụ `http://localhost:5173`. |
| `RESEND_API_KEY` | Khóa Resend có quyền gửi email. |
| `WORK_EMAIL_FROM` | Địa chỉ gửi thuộc tên miền đã xác minh trong Resend, ví dụ `Nhịp việc <viec@example.com>`. |
| `WORK_EMAIL_WORKER_SECRET` | Chuỗi ngẫu nhiên dài ít nhất 32 byte dùng để xác thực yêu cầu từ lịch gửi mail. |

**Tạo tài khoản** dùng mẫu **Confirm signup** của Supabase Auth qua SMTP đã cấu hình. Mẫu cần dùng liên kết `{{ .ConfirmationURL }}` để nhân viên xác nhận email trước khi đăng nhập. Mật khẩu được xử lý bởi Supabase Auth. Tài khoản đã đăng ký được thêm vào nhóm và nhận thông báo qua Resend. Edge Function kiểm tra phiên đăng nhập và quyền trưởng nhóm ở phía máy chủ.

Khi nâng cấp từ bản gửi email mời đặt mật khẩu, triển khai lại `provision-work-member` trước khi cập nhật giao diện. Bản thay đổi mật khẩu dùng cấu trúc cơ sở dữ liệu hiện có. Nếu hệ thống báo lỗi gửi email xác nhận sau khi tạo, trưởng nhóm có thể mở **Tạo tài khoản** và thử lại với cùng email.

### Lập lịch gửi thông báo

1. Trong **Vault**, tạo `work_supabase_url` với Project URL và `work_email_worker_secret` với cùng giá trị `WORK_EMAIL_WORKER_SECRET` ở Edge Functions.
2. Chạy `supabase/setup-email-cron.sql` trong SQL Editor. Tác vụ email xử lý hàng đợi mỗi phút. Tác vụ quá hạn chạy lúc 00:05 giờ Việt Nam khi lịch Postgres dùng UTC.
3. Dùng hai tài khoản thử nghiệm để tạo việc, đổi trạng thái, gửi và duyệt gia hạn. Kiểm tra email đến từng người và mở liên kết trong email. Có thể xem nhật ký chạy trong Supabase Cron và Edge Functions.

Email việc nhóm gửi đến trưởng nhóm và người được giao qua Resend khi tạo hoặc xóa việc, đổi phân công, cập nhật nội dung, trạng thái, ngày giao hoặc hạn, có bình luận, việc quá hạn, hoặc có kết quả gia hạn. Thông báo quá hạn được gửi một lần cho mỗi hạn và người nhận. Hàng đợi chỉ chuyển email công việc đến địa chỉ đã xác nhận.

Tham chiếu triển khai gồm [Supabase Auth Create User](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Supabase Auth Resend](https://supabase.com/docs/reference/javascript/auth-resend), [Supabase Edge Function Auth](https://supabase.com/docs/guides/functions/auth), [Lập lịch Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) và [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email).

## Build và kiểm thử

- `npm run build` tạo thư mục tĩnh `dist/`. Đặt hai biến môi trường khi build cho môi trường dùng Supabase. Đặt lại URL xác thực khi đổi domain.
- `npm run build:demo` tạo `demo-dist/nhip-viec-demo.html`, một file tự chứa có thể mở trực tiếp bằng trình duyệt.
- Thử tạo một cây có L1 và hai nhánh L2 với người thực hiện và trạng thái khác nhau. Lưu, thử hoàn thành L1 khi còn một L2 chưa xong, rồi hoàn thành L2 đó và thử lại L1.
- Bản demo mở bằng vai **Trần Quý · Trưởng nhóm**. Chọn **Bản demo → Mai Linh · Nhân viên**, mở thẻ **Rà soát luồng đăng nhập trên mobile** khi quá hạn, rồi gửi yêu cầu gia hạn.
- Chuyển lại vai trưởng nhóm, mở việc vừa có yêu cầu và bấm **Duyệt gia hạn**. Kiểm tra hạn mới trên thẻ và chọn biểu tượng chuông để mở **Email mô phỏng**.
- Trong vai trưởng nhóm, mở **Thành viên → Tạo tài khoản** để tạo nhân viên mẫu với mật khẩu thử. Bản demo dùng menu **Bản demo** để chuyển sang thành viên và xem email mô phỏng. Với Supabase, mở email xác nhận rồi thử đăng nhập bằng email và mật khẩu đã đặt.
- Đã kiểm tra luồng giao diện, migration và phân quyền trên Postgres cục bộ. Việc triển khai Supabase và gửi email thật cần cấu hình project và tài khoản gửi mail theo hướng dẫn bên trên.

## Cấu trúc mã

- `src/App.jsx` quản lý điều hướng và trạng thái dữ liệu.
- `src/dashboard.jsx`, `src/dialogs.jsx`, `src/ui.jsx`, `src/styles.css` là giao diện.
- `src/demo.js` là kho dữ liệu mẫu. `src/backend.js` kết nối Supabase.
- `supabase/migrations/` chứa migration và chính sách truy cập. `supabase/functions/` chứa hai Edge Functions. `supabase/setup-email-cron.sql` tạo lịch gửi email.

Prompt tiếp tục trong Antigravity:

> Đọc README.md và các migration Supabase của dự án Nhịp việc. Chạy `npm ci` rồi `npm run dev`. Kiểm tra Kanban, giao việc có ngày giao và hạn, gửi và duyệt gia hạn, và tạo tài khoản thành viên. Khi có .env.local, kiểm tra tiếp bằng hai tài khoản theo kịch bản trong README.
