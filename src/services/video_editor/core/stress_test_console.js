/**
 * Stress Test Script for Video Studio AI Canvas Exporter
 * Copy and paste this script into your browser developer tools console (F12) while on the app page
 * to simulate a heavy workload and benchmark the FrameScheduler.
 */

async function runBrowserStressTest(durationSeconds = 30, targetFps = 30) {
  console.log("=== BẮT ĐẦU STRESS TEST RENDER ENGINE ===");
  console.log(`Resolution: 1920x1080 | Target FPS: ${targetFps} | Duration: ${durationSeconds}s`);

  // 1. Khởi tạo canvas 1080p giả lập tải nặng
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 2. Khởi tạo FrameScheduler
  // Import FrameScheduler từ bộ nhớ trình duyệt hoặc khai báo trực tiếp phiên bản tương đương
  class MockFrameScheduler {
    constructor(fps = 30) {
      this.fps = fps;
      this.frameDuration = 1 / fps;
      this.reset();
    }
    reset() {
      this.startTime = null;
      this.lastRenderedFrameIndex = -1;
      this.renderedFrames = 0;
      this.droppedFrames = 0;
      this.expectedFrames = 0;
    }
    start() {
      this.reset();
      this.startTime = performance.now();
    }
    getMetrics(totalDuration) {
      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      const renderFps = elapsed > 0 ? (this.renderedFrames / elapsed) : this.fps;
      return {
        elapsed,
        renderFps,
        expectedFrames: this.expectedFrames,
        renderedFrames: this.renderedFrames,
        droppedFrames: this.droppedFrames,
        dropRate: this.expectedFrames > 0 ? (this.droppedFrames / this.expectedFrames) * 100 : 0
      };
    }
    tick(totalDuration) {
      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      const currentMasterTime = Math.min(elapsed, totalDuration);
      const currentFrameIndex = Math.floor(currentMasterTime * this.fps);

      if (currentFrameIndex > this.lastRenderedFrameIndex) {
        if (this.lastRenderedFrameIndex !== -1) {
          const skipped = currentFrameIndex - this.lastRenderedFrameIndex - 1;
          this.droppedFrames += skipped;
          this.expectedFrames += skipped + 1;
        } else {
          this.expectedFrames += 1;
        }
        this.lastRenderedFrameIndex = currentFrameIndex;
        this.renderedFrames += 1;
        return currentFrameIndex / this.fps;
      }
      return null;
    }
  }

  const scheduler = new MockFrameScheduler(targetFps);
  scheduler.start();

  let isRunning = true;
  const totalFrames = durationSeconds * targetFps;

  console.log("Đang giả lập tải nặng: Vẽ chữ shadowBlur cực đại + Gương mờ lặp lại...");

  return new Promise((resolve) => {
    function loop() {
      if (!isRunning) return;

      const projectTime = scheduler.tick(durationSeconds);
      if (projectTime !== null) {
        // Thực thi các thao tác Canvas siêu nặng để ép tải CPU/GPU
        ctx.save();
        ctx.fillStyle = '#090b10';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Giả lập hiệu ứng gương phủ mờ lề cực nặng (filter blur)
        ctx.filter = 'blur(30px)';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(100, 100, 800, 500);
        ctx.filter = 'none';

        // Giả lập vẽ nhiều lớp sóng âm phát sinh Gradient
        for (let i = 0; i < 5; i++) {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
          grad.addColorStop(0, '#ec4899');
          grad.addColorStop(0.5, '#a855f7');
          grad.addColorStop(1, '#06b6d4');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(0, 540 + i * 20);
          ctx.bezierCurveTo(480, 200, 1440, 800, 1920, 540 + i * 20);
          ctx.stroke();
        }

        // Giả lập vẽ 10 phụ đề có bóng mờ Neon khổng lồ (shadowBlur 40) cùng lúc
        for (let i = 0; i < 10; i++) {
          ctx.shadowColor = '#ec4899';
          ctx.shadowBlur = 40;
          ctx.font = '800 64px "Segoe UI"';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`STRESS TEST SUBTITLE LAYER ${i} - TIME: ${projectTime.toFixed(2)}s`, 960, 200 + i * 80);
        }
        ctx.restore();

        // Kiểm tra kết thúc stress test
        if (projectTime >= durationSeconds) {
          isRunning = false;
          const metrics = scheduler.getMetrics(durationSeconds);
          console.log("=== KẾT QUẢ STRESS TEST BẢNG THÔNG SỐ ===");
          console.log(`Resolution: 1920x1080`);
          console.log(`Target FPS: ${targetFps}`);
          console.log(`Render FPS trung bình: ${metrics.renderFps.toFixed(2)}`);
          console.log(`Khung hình kỳ vọng (Expected): ${metrics.expectedFrames}`);
          console.log(`Khung hình thực tế vẽ (Rendered): ${metrics.renderedFrames}`);
          console.log(`Khung hình bị bỏ qua (Dropped): ${metrics.droppedFrames}`);
          console.log(`Tỷ lệ Drop Rate: ${metrics.dropRate.toFixed(2)}%`);
          console.log(`Thời gian chạy thực tế: ${metrics.elapsed.toFixed(2)}s`);
          console.log(`Thời gian media tệp tin: ${durationSeconds}s`);
          resolve(metrics);
          return;
        }
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  });
}

// Chạy test mặc định: 30 giây ở 30 FPS tải cực nặng
// Bạn có thể chạy lệnh này trong Console: runBrowserStressTest(30, 30);
window.runBrowserStressTest = runBrowserStressTest;
console.log("Đã đăng ký hàm 'runBrowserStressTest(duration, fps)' vào window. Hãy chạy lệnh này trong Console.");
