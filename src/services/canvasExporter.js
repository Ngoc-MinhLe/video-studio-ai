/**
 * Canvas Exporter Service
 * Xuất Video trực tiếp bằng HTML5 Canvas + Web Audio API + MediaRecorder.
 * Hỗ trợ Tùy chỉnh Tỷ lệ Khung hình (9:16 TikTok, 16:9 YouTube, 1:1 Insta, 4:5 FB).
 * Chạy 100% mượt mà trên tất cả trình duyệt (Cốc Cốc, Chrome, Edge, Safari, Mobile).
 */

export const processVideoCanvas = async ({
  videoFile,
  audioFile,
  videoVolume = 1,
  audioVolume = 1,
  subtitles = [],
  subOptions = { fontSize: 24, fontColor: 'white', position: 'bottom' },
  aspectRatio = 'original', // 'original', '9:16', '16:9', '1:1', '4:5'
  onProgress,
  onStatus
}) => {
  if (onStatus) onStatus('Đang chuẩn bị môi trường Render Canvas...');
  if (onProgress) onProgress(5);

  // 1. Tạo Element Video Ẩn
  const videoEl = document.createElement('video');
  videoEl.src = URL.createObjectURL(videoFile);
  videoEl.muted = false; // Cần bật âm thanh để Web Audio API lấy được stream
  videoEl.playsInline = true;
  videoEl.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    videoEl.onloadedmetadata = resolve;
    videoEl.onerror = () => reject(new Error('Không thể đọc file Video gốc.'));
  });

  const origW = videoEl.videoWidth || 1280;
  const origH = videoEl.videoHeight || 720;
  const duration = videoEl.duration;

  // Tính toán kích thước Canvas theo Tỷ Lệ Khung Hình được chọn
  let canvasW = origW;
  let canvasH = origH;

  if (aspectRatio === '9:16') {
    canvasW = 1080;
    canvasH = 1920;
  } else if (aspectRatio === '16:9') {
    canvasW = 1920;
    canvasH = 1080;
  } else if (aspectRatio === '1:1') {
    canvasW = 1080;
    canvasH = 1080;
  } else if (aspectRatio === '4:5') {
    canvasW = 1080;
    canvasH = 1350;
  }

  // Tính toán căn giữa Video trong Canvas (Aspect Contain)
  const srcRatio = origW / origH;
  const targetRatio = canvasW / canvasH;

  let drawW = canvasW;
  let drawH = canvasH;
  let drawX = 0;
  let drawY = 0;

  if (srcRatio > targetRatio) {
    // Video rộng hơn khung target
    drawW = canvasW;
    drawH = canvasW / srcRatio;
    drawY = (canvasH - drawH) / 2;
  } else {
    // Video cao hơn khung target
    drawH = canvasH;
    drawW = canvasH * srcRatio;
    drawX = (canvasW - drawW) / 2;
  }

  // 2. Tạo Element Audio Ẩn (nếu có nhạc mới)
  let audioEl = null;
  if (audioFile) {
    audioEl = document.createElement('audio');
    audioEl.src = URL.createObjectURL(audioFile);
    audioEl.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      audioEl.onloadedmetadata = resolve;
      audioEl.onerror = resolve; // Bỏ qua nếu lỗi audio nhẹ
    });
  }

  // 3. Khởi tạo Web Audio API để Trộn Âm Thanh
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  await audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();

  // Nguồn âm thanh từ Video gốc
  try {
    const videoSource = audioCtx.createMediaElementSource(videoEl);
    const videoGain = audioCtx.createGain();
    videoGain.gain.value = videoVolume;
    videoSource.connect(videoGain);
    videoGain.connect(dest);
  } catch (e) {
    console.warn('Lỗi khởi tạo AudioSource từ video (có thể video không có âm thanh):', e);
  }

  // Nguồn âm thanh từ Nhạc Mới
  if (audioEl) {
    try {
      const audioSource = audioCtx.createMediaElementSource(audioEl);
      const audioGain = audioCtx.createGain();
      audioGain.gain.value = audioVolume;
      audioSource.connect(audioGain);
      audioGain.connect(dest);
    } catch (e) {
      console.warn('Lỗi kết nối nhạc nền mới:', e);
    }
  }

  // 4. Tạo Canvas Vẽ Khung Hình & Phụ Đề
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Hàm vẽ phụ đề chuẩn TikTok/Reels/YouTube lên Canvas
  const drawSubtitles = (currentTime) => {
    const validSubs = subtitles || [];
    const currentSub = validSubs.find(
      s => s.text && s.text.trim() !== '' && currentTime >= Number(s.startTime) && currentTime <= Number(s.endTime)
    );

    if (!currentSub) return;

    const text = currentSub.text.trim();
    // Tỷ lệ cỡ chữ tương ứng với độ phân giải canvas
    const scaleFactor = canvasH / 720;
    const fontSize = Math.max(16, Math.round((subOptions.fontSize || 24) * scaleFactor));

    ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.3;

    let x = canvasW / 2;
    let y = canvasH - textHeight - (60 * scaleFactor);

    if (subOptions.position === 'top') {
      y = textHeight + (60 * scaleFactor);
    } else if (subOptions.position === 'center') {
      y = canvasH / 2;
    }

    // Vẽ Khung Đen Làm Nổi Phụ Đề (Background Box)
    const paddingX = fontSize * 0.5;
    const paddingY = fontSize * 0.3;
    const boxWidth = textWidth + (paddingX * 2);
    const boxHeight = textHeight + (paddingY * 2);
    const boxX = x - (boxWidth / 2);
    const boxY = y - (boxHeight / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }

    // Viền sáng nhẹ xung quanh khung
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Chữ màu trắng nổi bật
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  };

  // 5. Chuẩn bị Stream & MediaRecorder
  const canvasStream = canvas.captureStream(30); // 30 FPS
  const audioTracks = dest.stream.getAudioTracks();

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks
  ]);

  // Kiểm tra định dạng hỗ trợ của Trình duyệt
  let mimeType = 'video/webm';
  if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
    mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
    mimeType = 'video/webm;codecs=vp9,opus';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }

  console.log('[Canvas Exporter]: AspectRatio:', aspectRatio, 'Using MimeType:', mimeType);

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 6000000 // 6 Mbps chất lượng cao
  });

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // 6. Bắt đầu Quá Trình Render
  if (onStatus) onStatus(`Đang render video tỷ lệ ${aspectRatio} & phụ đề...`);

  videoEl.currentTime = 0;
  if (audioEl) audioEl.currentTime = 0;

  return new Promise((resolve, reject) => {
    let animId = null;

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      videoEl.pause();
      if (audioEl) audioEl.pause();
      URL.revokeObjectURL(videoEl.src);
      if (audioEl) URL.revokeObjectURL(audioEl.src);
      audioCtx.close();
    };

    mediaRecorder.onstop = () => {
      cleanup();
      const isMp4 = mimeType.includes('mp4');
      const finalBlob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
      const finalUrl = URL.createObjectURL(finalBlob);
      if (onProgress) onProgress(100);
      if (onStatus) onStatus('Render hoàn tất!');
      resolve({ url: finalUrl, isMp4, mimeType, extension: isMp4 ? 'mp4' : 'webm' });
    };

    mediaRecorder.onerror = (err) => {
      cleanup();
      reject(err);
    };

    // Bắt đầu ghi
    mediaRecorder.start(100);

    videoEl.play().catch(reject);
    if (audioEl) audioEl.play().catch(() => {});

    const renderLoop = () => {
      if (videoEl.ended || videoEl.paused) {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        return;
      }

      // Xóa canvas & Tô nền tối sang trọng
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Vẽ khung hình video được căn giữa đẹp mắt
      ctx.drawImage(videoEl, drawX, drawY, drawW, drawH);

      // Vẽ phụ đề
      drawSubtitles(videoEl.currentTime);

      // Cập nhật tiến trình %
      if (onProgress && duration > 0) {
        const percent = Math.min(99, Math.round((videoEl.currentTime / duration) * 100));
        onProgress(percent);
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  });
};
