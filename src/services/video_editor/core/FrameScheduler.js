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
    this.schedulerSkippedFrames = 0;
    this.expectedFrames = 0;
    this.renderStartRealTime = null;

    // Các thông số đo đạc đồng bộ (Sync Metrics)
    this.pauseCount = 0;
    this.totalPauseDuration = 0;
    this.maxDrift = 0;
    this.sumDrift = 0;
    this.driftCount = 0;
    this.playbackRateChanges = 0;
    this.lastPauseStartTime = null;
  }

  start() {
    this.reset();
    this.startTime = performance.now();
    this.renderStartRealTime = Date.now();
  }

  /**
   * Ghi nhận một lần đổi playbackRate
   */
  recordPlaybackRateChange() {
    this.playbackRateChanges += 1;
  }

  /**
   * Ghi nhận độ lệch drift hiện tại
   */
  recordDrift(drift) {
    const absDrift = Math.abs(drift);
    if (absDrift > this.maxDrift) {
      this.maxDrift = absDrift;
    }
    this.sumDrift += absDrift;
    this.driftCount += 1;
  }

  /**
   * Ghi nhận bắt đầu tạm dừng video để chờ sync
   */
  recordPauseStart() {
    this.pauseCount += 1;
    this.lastPauseStartTime = performance.now();
  }

  /**
   * Ghi nhận khi video phát lại sau khi tạm dừng sync
   */
  recordPauseEnd() {
    if (this.lastPauseStartTime !== null) {
      const duration = (performance.now() - this.lastPauseStartTime) / 1000;
      this.totalPauseDuration += duration;
      this.lastPauseStartTime = null;
    }
  }

  /**
   * Lấy các số liệu benchmark để hiển thị và lưu trữ log
   */
  getMetrics(totalDuration) {
    if (!this.startTime) return null;
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000;
    const renderFps = elapsed > 0 ? (this.renderedFrames / elapsed) : this.fps;

    let remainingTime = 0;
    if (totalDuration > 0 && elapsed < totalDuration) {
      const progress = elapsed / totalDuration;
      if (progress > 0) {
        remainingTime = (elapsed / progress) - elapsed;
      }
    }

    const averageDrift = this.driftCount > 0 ? (this.sumDrift / this.driftCount) : 0;

    return {
      elapsed,
      renderFps,
      expectedFrames: this.expectedFrames,
      renderedFrames: this.renderedFrames,
      schedulerSkippedFrames: this.schedulerSkippedFrames,
      skipRate: this.expectedFrames > 0 ? (this.schedulerSkippedFrames / this.expectedFrames) * 100 : 0,
      remainingTime,
      pauseCount: this.pauseCount,
      totalPauseDuration: this.totalPauseDuration,
      maxDrift: this.maxDrift,
      averageDrift,
      playbackRateChanges: this.playbackRateChanges
    };
  }

  /**
   * Kiểm tra xem đã đến thời điểm vẽ khung hình tiếp theo chưa
   */
  tick(totalDuration) {
    if (!this.startTime) return null;
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000;

    const currentMasterTime = Math.min(elapsed, totalDuration);
    const currentFrameIndex = Math.floor(currentMasterTime * this.fps);

    if (currentFrameIndex > this.lastRenderedFrameIndex) {
      // Đếm số lượng khung hình bị bỏ qua bởi Scheduler (Scheduler Skipped Frames)
      if (this.lastRenderedFrameIndex !== -1) {
        const skipped = currentFrameIndex - this.lastRenderedFrameIndex - 1;
        this.schedulerSkippedFrames += skipped;
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
