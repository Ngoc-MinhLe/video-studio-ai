/**
 * Canvas Exporter Service - Multi-Clip Non-Linear Video Editor Engine
 * Xuất Video trực tiếp bằng HTML5 Canvas + Web Audio API + MediaRecorder.
 * Hỗ trợ Dựng nhiều Video Clips (Nối clip, Cắt xẻ clip ✂️, Xóa đoạn thừa 🗑️).
 * Hỗ trợ Tùy chỉnh Tỷ lệ Khung hình (16:9 YouTube, 9:16 TikTok, 1:1 Insta, 4:5 FB).
 * Chạy 100% mượt mà trên tất cả trình duyệt (Cốc Cốc, Chrome, Edge, Safari, Mobile).
 */

export const processVideoCanvas = async ({
  mode = 'video_studio',
  bgImage = null,
  bgEffect = 'zoom',
  visualizerType = 'vinyl',
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

  let bgImgEl = null;
  if (mode === 'image_music' && bgImage) {
    bgImgEl = new Image();
    bgImgEl.src = bgImage.url || (bgImage.file ? URL.createObjectURL(bgImage.file) : bgImage);
    bgImgEl.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      bgImgEl.onload = resolve;
      bgImgEl.onerror = resolve;
    });
  }

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

  if (mode !== 'image_music' && clipsToProcess.length === 0) {
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
    const activeSubs = validSubs.filter(
      s => s.text && s.text.trim() !== '' && projectTime >= Number(s.startTime) && projectTime <= Number(s.endTime)
    );

    if (!activeSubs || activeSubs.length === 0) return;

    activeSubs.forEach((sub, subIdx) => {
      const text = sub.text.trim();
      const scaleFactor = canvasH / 720;
      const baseFontSize = Math.max(16, Math.round(((sub.fontSize !== undefined ? sub.fontSize : subOptions.fontSize) || 24) * scaleFactor));
      const style = sub.style || subOptions.subStyle || 'tiktok';
      const anim = sub.anim || subOptions.subAnimation || 'bounce';
      const rotationDeg = sub.rotation !== undefined ? sub.rotation : (subOptions.subRotation || 0);
      const customColor = sub.color || subOptions.subColor || '#ffffff';
      const customBgColor = sub.bgColor || subOptions.subBgColor || '#000000';
      const animSpeed = sub.animSpeed !== undefined ? sub.animSpeed : (subOptions.subAnimSpeed || 1.0);
      const posX = sub.x !== undefined ? sub.x : (subOptions.subX !== undefined ? subOptions.subX : 50);
      const posY = sub.y !== undefined ? sub.y : (subOptions.subY !== undefined ? subOptions.subY : 85);

      // Tính toán tiến trình hiệu ứng animation
      const elapsed = projectTime - Number(sub.startTime);
      let animScale = 1.0;
      let animAlpha = 1.0;
      let animOffsetY = 0;
      let animShakeX = 0;
      let animShakeY = 0;
      let displayText = text;

      if (anim === 'typewriter') {
        const words = text.split(' ');
        const subDuration = (Number(sub.endTime) - Number(sub.startTime)) || 3;
        const revealProgress = Math.min(1, Math.max(0, (elapsed * animSpeed) / subDuration));
        const visibleWordCount = Math.max(1, Math.ceil(revealProgress * words.length));
        displayText = words.slice(0, visibleWordCount).join(' ');
      } else if (anim === 'marquee') {
        const subDuration = (Number(sub.endTime) - Number(sub.startTime)) || 3;
        const progress = Math.min(1, Math.max(0, (elapsed * animSpeed) / subDuration));
        animShakeX = (0.5 - progress) * (canvasW * 1.4);
      } else if (anim === 'bounce') {
        const dur = 0.35 / animSpeed;
        if (elapsed < dur) {
          const progress = elapsed / dur;
          animScale = 0.5 + Math.sin(progress * Math.PI) * 0.75;
        }
      } else if (anim === 'fade') {
        const dur = 0.3 / animSpeed;
        if (elapsed < dur) {
          const progress = elapsed / dur;
          animAlpha = Math.min(1, Math.max(0, progress));
          animOffsetY = (1 - progress) * (20 * scaleFactor);
        }
      } else if (anim === 'pulse') {
        animScale = 1.0 + Math.sin(elapsed * 4 * animSpeed) * 0.05;
      } else if (anim === 'shake') {
        animShakeX = (Math.random() - 0.5) * (6 * scaleFactor * animSpeed);
        animShakeY = (Math.random() - 0.5) * (6 * scaleFactor * animSpeed);
        animScale = 1.0 + Math.sin(elapsed * 8 * animSpeed) * 0.03;
      }

      const fontSize = Math.round(baseFontSize * animScale);
      ctx.save();
      ctx.globalAlpha = animAlpha;

      let x = canvasW * (posX / 100) + animShakeX;
      let y = canvasH * (posY / 100) - animOffsetY + animShakeY;

    // Áp dụng Xoay Nghiêng Chữ
    ctx.translate(x, y);
    if (rotationDeg !== 0) {
      ctx.rotate((rotationDeg * Math.PI) / 180);
    }

    ctx.font = `extrabold ${fontSize}px "Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.35;

    const isMarqueeMode = anim === 'marquee' || style === 'led';
    const boxWPercent = sub.boxWidth !== undefined ? sub.boxWidth : (subOptions.subBoxWidth || 80);
    const boxWidth = isMarqueeMode
      ? (canvasW * (boxWPercent / 100))
      : (textWidth + (fontSize * 1.0));
    const boxHeight = textHeight + (fontSize * 0.6);

    let boxX = - (boxWidth / 2);
    let boxY = - (boxHeight / 2);
    let textX = 0;
    let textY = 0;

    if (posX >= 75) {
      boxX = - boxWidth;
      textX = - boxWidth / 2;
    } else if (posX <= 25) {
      boxX = 0;
      textX = boxWidth / 2;
    }

    if (posY >= 75) {
      boxY = - boxHeight;
      textY = - boxHeight / 2;
    } else if (posY <= 25) {
      boxY = 0;
      textY = boxHeight / 2;
    }

    // Render Theo Mẫu Style Đã Chọn
    if (style === 'led' || isMarqueeMode) {
      // Style Bảng Đèn LED Chạy Chữ Tin Tức (LED Ticker Banner)
      ctx.fillStyle = '#06080d';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      // Cắt Vùng Khung Đèn LED (Clipping Window)
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4);
      ctx.clip();

      if (isMarqueeMode) {
        const scrollSpeed = 65 * scaleFactor * animSpeed;
        const totalDist = textWidth + boxWidth;
        const currentOffset = (elapsed * scrollSpeed) % totalDist;
        const mTextX = boxX + boxWidth - currentOffset + (textWidth / 2);
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12 * scaleFactor;
        ctx.fillText(text, mTextX, textY);
      } else {
        ctx.fillStyle = '#fef08a';
        ctx.fillText(text, textX, textY);
      }
      ctx.restore();
    } else if (style === 'tiktok') {
      // Style 1: TikTok Vàng Rực Rỡ Chữ Đen
      ctx.fillStyle = '#facc15';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#090b10';
      ctx.fillText(displayText, textX, textY);
    } else if (style === 'victory') {
      // Style 2: ⚡ VICTORY Sấm Sét Neon Aura (CapCut Trending)
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 25 * scaleFactor;
      ctx.fillStyle = 'rgba(15, 7, 32, 0.9)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 12 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#e9d5ff';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 15 * scaleFactor;
      ctx.fillText(`⚡ ${text} ⚡`, textX, textY);
    } else if (style === 'boom') {
      // Style 3: 💥 BOOM Bùng Nổ Đỏ 3D
      ctx.fillStyle = '#dc2626';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3.5 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(`💥 ${text}`, textX, textY);
    } else if (style === 'sponge') {
      // Style 4: 🟩 SPONGE Viền Xanh 3D
      ctx.fillStyle = '#15803d';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3.5 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 15 * scaleFactor;
      ctx.fillText(displayText, textX, textY);
    } else if (style === 'social') {
      // Style 5: 📢 LIKE & SHARE BADGE
      ctx.fillStyle = '#2563eb';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 20 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(`📢 ${text}`, textX, textY);
    } else if (style === 'custom') {
      // Style 6: 🎨 TỰ CHỌN MÀU TÙY Ý
      ctx.fillStyle = customBgColor;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.fillStyle = customColor;
      ctx.fillText(displayText, textX, textY);
    } else if (style === 'neon') {
      // Style 7: Cyber Neon Tím Hồng
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 20 * scaleFactor;
      ctx.fillStyle = 'rgba(24, 9, 43, 0.85)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 12 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2 * scaleFactor;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#f472b6';
      ctx.fillText(text, textX, textY);
    } else if (style === 'cinema') {
      // Style 8: Điện Ảnh Sang Trọng
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6 * scaleFactor);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10 * scaleFactor;
      ctx.fillText(text, textX, textY);
    } else {
      // Style Default
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
      ctx.fillText(text, textX, textY);
    }

    ctx.restore();
    });
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

      // Nếu ở chế độ Image Music Visualizer
      if (mode === 'image_music') {
        // 1. Vẽ Ảnh Nền + Ken Burns Zoom / Pulse Effect
        if (bgImgEl) {
          let scale = 1.0;
          if (bgEffect === 'zoom') {
            scale = 1.0 + (Math.sin(projectTime * 0.15) + 1) * 0.06;
          } else if (bgEffect === 'pulse') {
            scale = 1.0 + Math.abs(Math.sin(projectTime * 3)) * 0.04;
          }
          const scaledW = canvasW * scale;
          const scaledH = canvasH * scale;
          const offsetX = (canvasW - scaledW) / 2;
          const offsetY = (canvasH - scaledH) / 2;
          ctx.drawImage(bgImgEl, offsetX, offsetY, scaledW, scaledH);
        } else {
          ctx.fillStyle = '#090b10';
          ctx.fillRect(0, 0, canvasW, canvasH);
        }

        // 2. Vẽ Hiệu Ứng Sóng Âm / Đĩa Nhạc Quay Vinyl
        if (visualizerType === 'vinyl') {
          ctx.save();
          const centerX = canvasW / 2;
          const centerY = canvasH / 2;
          const radius = Math.min(canvasW, canvasH) * 0.22;

          ctx.translate(centerX, centerY);
          const angle = (projectTime * 90 * Math.PI) / 180;
          ctx.rotate(angle);

          // Outer Vinyl Black Disc
          ctx.fillStyle = '#111319';
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2b3042';
          ctx.lineWidth = 4 * (canvasH / 720);
          ctx.stroke();

          // Vinyl Grooves
          for (let r = radius * 0.45; r < radius * 0.95; r += 10 * (canvasH / 720)) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Center Album Artwork Badge
          if (bgImgEl) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(bgImgEl, -radius * 0.4, -radius * 0.4, radius * 0.8, radius * 0.8);
            ctx.restore();
          }

          // Center Spindle Hole
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.06, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        } else if (visualizerType === 'bars') {
          ctx.save();
          const barCount = 24;
          const barWidth = (canvasW * 0.6) / barCount;
          const startX = (canvasW - (barCount * barWidth)) / 2;
          const baseY = canvasH * 0.82;

          for (let b = 0; b < barCount; b++) {
            const barHeight = Math.abs(Math.sin(projectTime * 4 + b * 0.4)) * (canvasH * 0.15) + (canvasH * 0.02);
            const bx = startX + b * barWidth;
            const by = baseY - barHeight;

            const grad = ctx.createLinearGradient(bx, baseY, bx, by);
            grad.addColorStop(0, '#c084fc');
            grad.addColorStop(1, '#38bdf8');

            ctx.fillStyle = grad;
            ctx.fillRect(bx + 2, by, barWidth - 4, barHeight);
          }
          ctx.restore();
        } else if (visualizerType === 'ring') {
          ctx.save();
          const centerX = canvasW / 2;
          const centerY = canvasH / 2;
          const baseRadius = Math.min(canvasW, canvasH) * 0.22;
          const pulseRadius = baseRadius + Math.abs(Math.sin(projectTime * 5)) * (baseRadius * 0.1);

          ctx.strokeStyle = '#ec4899';
          ctx.shadowColor = '#f472b6';
          ctx.shadowBlur = 30 * (canvasH / 720);
          ctx.lineWidth = 6 * (canvasH / 720);
          ctx.beginPath();
          ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      } else if (loadedVideoElements.length > 0) {
        // Chế độ Video Studio MP4 Clips
        let activeItemIndex = loadedVideoElements.findIndex(
          item => projectTime >= item.timelineStart && projectTime < item.timelineEnd
        );
        if (activeItemIndex === -1) activeItemIndex = loadedVideoElements.length - 1;

        if (activeItemIndex !== currentClipIdx) {
          loadedVideoElements[currentClipIdx].videoEl.pause();
          currentClipIdx = activeItemIndex;
          const newItem = loadedVideoElements[currentClipIdx];
          const offsetInClip = projectTime - newItem.timelineStart;
          newItem.videoEl.currentTime = newItem.clipStart + offsetInClip;
          newItem.videoEl.play().catch(() => {});
        }

        const activeItem = loadedVideoElements[currentClipIdx];
        const activeVideoEl = activeItem.videoEl;

        ctx.fillStyle = '#090b10';
        ctx.fillRect(0, 0, canvasW, canvasH);

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
      }

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
