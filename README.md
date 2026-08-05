# 🎥 Video Studio AI - Thay Nhạc & Chèn Phụ Đề Video MP4

Ứng dụng Web xử lý Video trực tiếp trên trình duyệt bằng công nghệ **React 18 + FFmpeg WebAssembly**, cho phép bạn:
1. 🎵 **Thay nhạc nền mới**: Đè hoặc trộn nhạc mới với âm thanh gốc.
2. ✍️ **Biên tập phụ đề chuẩn TikTok/Reels**: Tạo phụ đề theo từng mốc thời gian.
3. ⚡ **Render MP4 trực tiếp trên máy**: Không cần tốn phí server hay lưu trữ cloud.

---

## 🚀 1. Chạy Dự Án Cục Bộ (Local Dev)
```bash
npm run dev
```
Trình duyệt sẽ mở tại địa chỉ: `http://localhost:5173/`

---

## 📦 2. Hướng Dẫn Đưa Lên GitHub & Deploy Vercel

### Bước 2.1: Đưa Code Lên GitHub
1. Tạo một Repository mới trên [GitHub](https://github.com/new) (ví dụ: `video-studio-ai`).
2. Mở Terminal tại thư mục này và chạy các lệnh:
```bash
git init
git add .
git commit -m "Initial commit - Video Studio AI"
git branch -M main
git remote add origin https://github.com/<TEN-GITHUB-CUABAN>/video-studio-ai.git
git push -u origin main
```

### Bước 2.2: Deploy Lên Vercel
1. Truy cập [Vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub.
2. Bấm **"Add New..."** ➔ chọn **"Project"**.
3. Chọn Repository `video-studio-ai` vừa tải lên.
4. Bấm **"Deploy"**.

> 💡 **Lưu ý quan trọng**: Dự án đã được cấu hình sẵn file `vercel.json` bao gồm các Headers `Cross-Origin-Opener-Policy` và `Cross-Origin-Embedder-Policy` để FFmpeg WebAssembly hoạt động mượt mà trên Vercel mà không gặp bất kỳ lỗi bảo mật nào!
