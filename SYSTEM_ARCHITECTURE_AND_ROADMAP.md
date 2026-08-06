# 🗺️ HỆ THỐNG KIẾN TRÚC & LỘ TRÌNH PHÁT TRIỂN NÂNG CẤP (SYSTEM ARCHITECTURE & ROADMAP)

> **Tệp Kiến trúc Master & Sổ tay Định hướng Sản phẩm**
> *Mục đích: Lưu trữ toàn bộ tổng quan kiến trúc, nguyên lý thiết kế, các phân hệ làm việc và ý tưởng phát triển lâu dài để phục vụ công tác nâng cấp, mở rộng và bảo trì dễ dàng.*

---

## 🏛️ 1. TRIẾT LÝ THIẾT KẾ & TỔNG QUAN KIẾN TRÚC (DESIGN PHILOSOPHY)

Hệ thống được thiết kế dựa trên 3 trụ cột cốt lõi:
1. **Kiến trúc Module Độc lập (`Modular Micro-Workspaces`)**: Tách ứng dụng thành nhiều Phân hệ (Module) riêng biệt. Mỗi Module tự quản lý bộ nhớ, giao diện và logic riêng. Khi người dùng làm việc ở Module nào thì trình duyệt chỉ tải dữ liệu của Module đó ➔ **Siêu nhẹ, tải trang nhanh xé gió và không lo bị đè code**.
2. **Xử lý GPU Canvas Nâng Cao Trực Tiếp Trên Trình Duyệt (`Client-side GPU Rendering`)**: Toàn bộ quá trình cắt ghép, hòa trộn âm thanh và nén file MP4/WebM được thực hiện 100% bằng card màn hình (GPU) trên trình duyệt người dùng ➔ **Bảo mật tuyệt đối, riêng tư 100%, tiết kiệm chi phí Server**.
3. **Bộ Quản lý Doanh thu & Dịch vụ Trung tâm (`Centralized Platform Services`)**: Tất cả các Module đều kết nối về bộ dịch vụ dùng chung: Đăng nhập Firebase, Ví Coin (`credits`), Cổng thanh toán QR và Bảng Quản trị Admin thu tiền.

---

## 🏗️ 2. SƠ ĐỒ CẤU TRÚC THƯ MỤC DỰ ÁN (DIRECTORY BLUEPRINT)

```text
video-studio-ai/
├── SYSTEM_ARCHITECTURE_AND_ROADMAP.md // [MASTER BLUEPRINT] Tệp tài liệu kiến trúc & ý tưởng
├── index.html                         // HTML5 Root & SEO Meta tags
├── package.json                       // Dependencies (Vite, React, Lucide-react, Firebase)
├── src/
│   ├── main.jsx                       // Entry point React
│   ├── App.jsx                        // App Shell, Router & Header Chuyển Module (Tab Bar)
│   ├── index.css                      // Tailwind & Core Design Utilities
│   ├── components/                    // BỘ THÀNH PHẦN DÙNG CHUNG (SHARED COMPONENTS)
│   │   ├── Header.jsx                 // Header chung, Ví Coin & Thanh Chuyển Module
│   │   ├── SubtitleEditorControls.jsx // Bộ Biên tập Phụ đề, 9 Ô Định vị & Bảng Đèn LED
│   │   └── modals/                    // CORE PLATFORM MODALS
│   │       ├── AuthModal.jsx          // Đăng nhập Google / Email / Zalo
│   │       ├── PaymentModal.jsx       // Cổng QR Chuyển khoản Ngân hàng
│   │       ├── FreeCoinsModal.jsx     // Thưởng Coin miễn phí hàng ngày
│   │       └── AdminModal.jsx         // Bảng Admin Quản lý User & Doanh thu Realtime
│   ├── modules/                       // BỘ CÁC PHÂN HỆ BIÊN TẬP ĐỘC LẬP (WORKSPACES)
│   │   ├── VideoStudio/               // MODULE 1: Studio Biên Tập Video MP4 Chuyên Nghiệp
│   │   │   ├── VideoStudioWorkspace.jsx
│   │   │   └── VideoPreviewContainer.jsx
│   │   └── ImageMusicVisualizer/      // MODULE 2: Tạo Video Nhạc Siêu Tốc Từ 1 Bức Ảnh
│   │       ├── ImageMusicWorkspace.jsx
│   │       ├── VinylVisualizer.jsx    // Đĩa Nhạc Quay CD/Vinyl
│   │       └── WaveformVisualizer.jsx // Sóng Âm Thanh Nhảy Khớp Nhạc
│   └── services/                      // CÁC DỊCH VỤ NỀN TẢNG (CORE SERVICES)
│       ├── firebase.js                // Quản lý Firestore Realtime & Authentication
│       └── canvasExporter.js          // Động cơ GPU Nén & Xuất File MP4 / WebM Siêu Tốc
```

---

## 🎯 3. CÁC PHÂN HỆ CÔNG VIỆC HIỆN TẠI (ACTIVE MODULES)

### 🎬 MODULE 1: Studio Biên Tập Video MP4 (Video Studio Editor)
- **Công dụng**: Tải và biên tập video MP4/WebM chuyên nghiệp.
- **Tính năng nổi bật**:
  - Ghép nhiều đoạn Clips Multi-track.
  - Bộ hòa trộn âm thanh MP3 Mixer (nhạc nền + tiếng gốc video).
  - Biên tập Phụ đề Độc lập từng thẻ: Bộ 9 Ô Căn Gióng Sát Góc (↖️⬆️↗️⬅️🎯➡️↙️⬇️↘️), Thanh trượt % X/Y, Mẫu CapCut Hot Trend, Hiệu ứng chữ nảy múa & **📟 BẢNG ĐÈN LED QUẢNG CÁO RUNNING MARQUEE**.

### 🖼️ MODULE 2: Tạo Video Nhạc Siêu Tốc Từ 1 Bức Ảnh (Image-to-MP4 Music Visualizer)
- **Công dụng**: Biến 1 Bức ảnh tĩnh + Bài hát MP3/DJ dài 1-2 tiếng thành Video MP4 đỉnh cao.
- **Tính năng nổi bật**:
  - 🔍 **Ken Burns Motion**: Ảnh nền chuyển động Zoom In/Out ảo diệu.
  - 💿 **Đĩa Nhạc Quay Vinyl / Sóng Âm**: Đĩa CD quay tròn hoặc cột sóng nhảy theo điệu nhạc.
  - 💬 **Phụ đề & Bảng Đèn LED**: Đầy đủ tính năng phụ đề kéo thả.
  - ⚡ **Tốc độ GPU Render Siêu Tốc (150-300 FPS)**: Nén bản DJ 1-2 tiếng trong vài phút (không bị nghẽn decode video cũ).

---

## 💎 4. HỆ THỐNG DOANH THU & QUẢN LÝ (MONETIZATION & ADMIN PLATFORM)

- **Cơ chế Thu Tiền**:
  - **Mô hình Ví Coin**: Xuất 1 video MP4 trừ $X$ Coins.
  - **Mô hình Thuê bao (Pass)**: Gói Không giới hạn theo tháng/năm.
- **Bảng Admin Quản Trị**:
  - Quản lý tài khoản User, theo dõi lịch sử nạp tiền.
  - Cấp Coin, kích hoạt VIP và theo dõi biểu đồ doanh thu realtime.

---

## 🔮 5. LỘ TRÌNH PHÁT TRIỂN & Ý TƯỞNG TƯƠNG LAI (FEATURE BACKLOG & ROADMAP)

*Dưới đây là tệp danh sách các ý tưởng nâng cấp tiếp theo. Khi có ý tưởng mới, chúng ta sẽ liên tục bổ sung vào phần này:*

- [ ] **Module 3: AI Auto Shorts / TikTok Generator**:
  - Tự động cắt video ngang 16:9 dài thành nhiều video ngắn dọc 9:16 có sẵn phụ đề tự động để đăng TikTok / Shorts / Reels.
- [ ] **Module 4: AI Voiceover & Text-To-Speech Studio**:
  - Chuyển đổi văn bản chữ thành giọng đọc AI Tiếng Việt truyền cảm (giọng Nam/Nữ Bắc, Trung, Nam).
- [ ] **Module 5: Kho Mẫu Template Dành Cho Người Bán Hàng / DJ Nonstop**:
  - Kho template dựng sẵn cho các bài nhạc Remix, Nhạc Sàn, Bán hàng Livestream, Quảng cáo Sản phẩm.
- [ ] **Tích hợp Lưu trữ Cloud Dự Án**:
  - Cho phép lưu nháp dự án đang làm dở trên mây (Cloud Drafts) để chuyển sang thiết bị khác mở làm tiếp.

---

*Tệp tài liệu này sẽ được lưu giữ trực tiếp trong thư mục gốc của dự án để đảm bảo tính liên tục và chuyên nghiệp trong suốt quá trình phát triển.* 🚀
