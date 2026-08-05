/**
 * Canvas Exporter Service
 * Xuất Video trực tiếp bằng HTML5 Canvas + Web Audio API + MediaRecorder.
 * Không cần nạp FFmpeg WebAssembly (0MB download), chạy 100% mượt mà trên tất cả trình duyệt (Cốc Cốc, Chrome, Edge, Safari, Mobile).
 */

export const processVideoCanvas = async ({
  videoFile,
  audioFile,
  videoVolume = 1,
  audioVolume = 1,
  subtitles = [],
  subOptions = { fontSize: 24, fontColor: 'white', position: 'bottom' },
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

  const width = videoEl.videoWidth || 1280;
  const height = videoEl.videoHeight || 720;
  const duration = videoEl.duration;

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
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Hàm vẽ phụ đề chuẩn TikTok/Reels lên Canvas
  const drawSubtitles = (currentTime) => {
    const validSubs = subtitles || [];
    const currentSub = validSubs.find(
      s => s.text && s.text.trim() !== '' && currentTime >= Number(s.startTime) && currentTime <= Number(s.endTime)
    );

    if (!currentSub) return;

    const text = currentSub.text.trim();
    // Tỷ lệ cỡ chữ tương ứng với độ phân giải video
    const scaleFactor = height / 720;
    const fontSize = Math.max(14, Math.round((subOptions.fontSize || 24) * scaleFactor));

    ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.3;

    let x = width / 2;
    let y = height - textHeight - (40 * scaleFactor);

    if (subOptions.position === 'top') {
      y = textHeight + (40 * scaleFactor);
    } else if (subOptions.position === 'center') {
      y = height / 2;
    }

    // Vẽ Khung Đen Làm Nổi Phụ Đề (Background Box)
    const paddingX = fontSize * 0.5;
    const paddingY = fontSize * 0.3;
    const boxWidth = textWidth + (paddingX * 2);
    const boxHeight = textHeight + (paddingY * 2);
    const boxX = x - (boxWidth / 2);
    const boxY = y - (boxHeight / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }

    // Viền trắng nhẹ xung quanh khung
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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

  console.log('[Canvas Exporter]: Using MimeType:', mimeType);

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 5000000 // 5 Mbps chất lượng cao
  });

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // 6. Bắt đầu Quá Trình Render
  if (onStatus) onStatus('Đang render video & phụ đề trực tiếp...');

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

      // Vẽ khung hình video
      ctx.drawImage(videoEl, 0, 0, width, height);

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

    videoEl.onended = () => {
      if (audioEl) audioEl.pause();
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    };
  });
};
