/**
 * Canvas Exporter Service - Multi-Clip Non-Linear Video Editor Engine
 * Xuất Video trực tiếp bằng HTML5 Canvas + Web Audio API + MediaRecorder.
 * Hỗ trợ Dựng nhiều Video Clips (Nối clip, Cắt xẻ clip ✂️, Xóa đoạn thừa 🗑️).
 * Hỗ trợ Tùy chỉnh Tỷ lệ Khung hình (16:9 YouTube, 9:16 TikTok, 1:1 Insta, 4:5 FB).
 * Chạy 100% mượt mà trên tất cả trình duyệt (Cốc Cốc, Chrome, Edge, Safari, Mobile).
 */

export const processVideoCanvas = async ({
  videoFile,
  videoClips = [],
  audioFile,
  audioClips = [],
  videoVolume = 1,
  audioVolume = 1,
  audioStartOffset = 0,
  audioVideoOffset = 0,
  subtitles = [],
  subOptions = { fontSize: 24, fontColor: 'white', position: 'bottom' },
  aspectRatio = '16:9',
  onProgress,
  onStatus
}) => {
  if (onStatus) onStatus('Đang khởi tạo Trình Render Đa Luồng Canvas...');
  if (onProgress) onProgress(5);

  // 1. Chuẩn hóa danh sách Video Clips
  let clipsToProcess = [];
  if (videoClips && videoClips.length > 0) {
    clipsToProcess = videoClips;
  } else if (videoFile) {
    clipsToProcess = [{
      id: 1,
      file: videoFile,
      name: videoFile.name,
      clipStart: 0,
      clipEnd: 0, // Sẽ tính sau metadata
      duration: 0
    }];
  }

  if (clipsToProcess.length === 0) {
    throw new Error('Chưa có Video Clip nào được nạp!');
  }

  // Khởi tạo các Element Video cho từng Clip
  const loadedVideoElements = [];
  let totalProjectDuration = 0;
  let firstVideoW = 1280;
  let firstVideoH = 720;

  for (let i = 0; i < clipsToProcess.length; i++) {
    const clip = clipsToProcess[i];
    const videoEl = document.createElement('video');
    videoEl.src = clip.url || URL.createObjectURL(clip.file);
    videoEl.muted = false;
    videoEl.playsInline = true;
    videoEl.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      videoEl.onloadedmetadata = resolve;
      videoEl.onerror = () => reject(new Error(`Không thể nạp clip video: ${clip.name}`));
    });

    const fileDur = videoEl.duration || 10;
    const clipStart = clip.clipStart || 0;
    const clipEnd = (clip.clipEnd && clip.clipEnd > clipStart) ? clip.clipEnd : fileDur;
    const effectiveDur = clipEnd - clipStart;

    if (i === 0) {
      firstVideoW = videoEl.videoWidth || 1280;
      firstVideoH = videoEl.videoHeight || 720;
    }

    loadedVideoElements.push({
      clip,
      videoEl,
      clipStart,
      clipEnd,
      effectiveDur,
      timelineStart: totalProjectDuration,
      timelineEnd: totalProjectDuration + effectiveDur
    });

    totalProjectDuration += effectiveDur;
  }

  // 2. Kích thước Canvas theo Tỷ lệ Khung hình
  let canvasW = firstVideoW;
  let canvasH = firstVideoH;

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

  // 3. Chuẩn bị Audio Elements
  let audioEl = null;
  const targetAudioFile = (audioClips && audioClips.length > 0) ? audioClips[0].file : audioFile;
  if (targetAudioFile) {
    audioEl = document.createElement('audio');
    audioEl.src = URL.createObjectURL(targetAudioFile);
    audioEl.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      audioEl.onloadedmetadata = resolve;
      audioEl.onerror = resolve;
    });
  }

  // 4. Khởi tạo Web Audio API để Trộn Âm Thanh
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  await audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();

  // Nối âm thanh các Video Clips vào Audio Context
  for (const item of loadedVideoElements) {
    try {
      const source = audioCtx.createMediaElementSource(item.videoEl);
      const gain = audioCtx.createGain();
      gain.gain.value = videoVolume;
      source.connect(gain);
      gain.connect(dest);
    } catch (e) {
      console.warn('Lỗi kết nối audio từ clip:', item.clip.name, e);
    }
  }

  // Nguồn âm thanh từ Nhạc Nền Mới
  if (audioEl) {
    try {
      const audioSource = audioCtx.createMediaElementSource(audioEl);
      const audioGain = audioCtx.createGain();
      audioGain.gain.value = audioVolume;
      audioSource.connect(audioGain);
      audioSource.connect(dest);
    } catch (e) {
      console.warn('Lỗi kết nối nhạc nền:', e);
    }
  }

  // 5. Khởi tạo Canvas & Hàm Vẽ
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  const drawSubtitles = (projectTime) => {
    const validSubs = subtitles || [];
    const currentSub = validSubs.find(
      s => s.text && s.text.trim() !== '' && projectTime >= Number(s.startTime) && projectTime <= Number(s.endTime)
    );

    if (!currentSub) return;

    const text = currentSub.text.trim();
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

    const paddingX = fontSize * 0.5;
    const paddingY = fontSize * 0.3;
    const boxWidth = textWidth + (paddingX * 2);
    const boxHeight = textHeight + (paddingY * 2);
    const boxX = x - (boxWidth / 2);
    const boxY = y - (boxHeight / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  };

  // 6. MediaRecorder Stream
  const canvasStream = canvas.captureStream(30);
  const audioTracks = dest.stream.getAudioTracks();

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks
  ]);

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

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 6000000
  });

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  if (onStatus) onStatus(`Đang render nối ${loadedVideoElements.length} clip video (${aspectRatio})...`);

  return new Promise((resolve, reject) => {
    let animId = null;
    let currentClipIdx = 0;
    let projectTime = 0;
    let lastTimestamp = null;
    let audioStarted = false;

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      loadedVideoElements.forEach(item => {
        item.videoEl.pause();
        if (item.clip.url) URL.revokeObjectURL(item.clip.url);
      });
      if (audioEl) audioEl.pause();
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

    mediaRecorder.start(100);

    // Phát clip đầu tiên
    const firstItem = loadedVideoElements[0];
    firstItem.videoEl.currentTime = firstItem.clipStart;
    firstItem.videoEl.play().catch(reject);

    const renderLoop = (timestamp) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      projectTime += delta;

      if (projectTime >= totalProjectDuration) {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        return;
      }

      // Xử lý phát nhạc nền
      if (audioEl) {
        if (projectTime >= audioVideoOffset && !audioStarted) {
          audioStarted = true;
          audioEl.currentTime = audioStartOffset || 0;
          audioEl.play().catch(() => {});
        }
      }

      // Tìm clip tương ứng với projectTime hiện tại
      let activeItemIndex = loadedVideoElements.findIndex(
        item => projectTime >= item.timelineStart && projectTime < item.timelineEnd
      );

      if (activeItemIndex === -1) activeItemIndex = loadedVideoElements.length - 1;

      if (activeItemIndex !== currentClipIdx) {
        // Dừng clip cũ, bật clip mới
        loadedVideoElements[currentClipIdx].videoEl.pause();
        currentClipIdx = activeItemIndex;
        const newItem = loadedVideoElements[currentClipIdx];
        const offsetInClip = projectTime - newItem.timelineStart;
        newItem.videoEl.currentTime = newItem.clipStart + offsetInClip;
        newItem.videoEl.play().catch(() => {});
      }

      const activeItem = loadedVideoElements[currentClipIdx];
      const activeVideoEl = activeItem.videoEl;

      // Xóa Canvas & Vẽ Nền tối
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Căn giữa Frame Video trên Canvas
      const vW = activeVideoEl.videoWidth || 1280;
      const vH = activeVideoEl.videoHeight || 720;
      const srcR = vW / vH;
      const targetR = canvasW / canvasH;

      let dW = canvasW;
      let dH = canvasH;
      let dX = 0;
      let dY = 0;

      if (srcR > targetR) {
        dW = canvasW;
        dH = canvasW / srcR;
        dY = (canvasH - dH) / 2;
      } else {
        dH = canvasH;
        dW = canvasH * srcR;
        dX = (canvasW - dW) / 2;
      }

      ctx.drawImage(activeVideoEl, dX, dY, dW, dH);

      // Vẽ phụ đề
      drawSubtitles(projectTime);

      if (onProgress && totalProjectDuration > 0) {
        const percent = Math.min(99, Math.round((projectTime / totalProjectDuration) * 100));
        onProgress(percent);
      }

      animId = requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
};
