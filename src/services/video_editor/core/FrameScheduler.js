export class FrameScheduler {
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
    this.renderStartRealTime = null;
  }

  start() {
    this.reset();
    this.startTime = performance.now();
    this.renderStartRealTime = Date.now();
  }

  /**
   * Returns current master clock metrics for debugging and benchmark display.
   */
  getMetrics(totalDuration) {
    if (!this.startTime) return null;
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000;
    const renderFps = elapsed > 0 ? (this.renderedFrames / elapsed) : this.fps;

    // Ước lượng thời gian còn lại dựa trên tốc độ render thực tế
    let remainingTime = 0;
    if (totalDuration > 0 && elapsed < totalDuration) {
      const progress = elapsed / totalDuration;
      if (progress > 0) {
        remainingTime = (elapsed / progress) - elapsed;
      }
    }

    return {
      elapsed,
      renderFps,
      expectedFrames: this.expectedFrames,
      renderedFrames: this.renderedFrames,
      droppedFrames: this.droppedFrames,
      dropRate: this.expectedFrames > 0 ? (this.droppedFrames / this.expectedFrames) * 100 : 0,
      remainingTime
    };
  }

  /**
   * Kiểm tra xem đã đến thời điểm vẽ khung hình tiếp theo chưa.
   * Nếu có, trả về projectTime tương ứng, nếu không trả về null.
   */
  tick(totalDuration) {
    if (!this.startTime) return null;
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000;

    // Giới hạn thời gian tối đa của dự án
    const currentMasterTime = Math.min(elapsed, totalDuration);
    const currentFrameIndex = Math.floor(currentMasterTime * this.fps);

    if (currentFrameIndex > this.lastRenderedFrameIndex) {
      // Đếm số lượng khung hình bị bỏ qua (dropped frames)
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
