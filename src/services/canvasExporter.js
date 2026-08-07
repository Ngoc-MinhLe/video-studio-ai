/**
 * Canvas Exporter Service - Multi-Clip Non-Linear Video Editor Engine
 * Xuất Video trực tiếp bằng HTML5 Canvas + Web Audio API + MediaRecorder.
 * Hỗ trợ Dựng nhiều Video Clips (Nối clip, Cắt xẻ clip ✂️, Xóa đoạn thừa 🗑️).
 * Hỗ trợ Tùy chỉnh Tỷ lệ Khung hình (16:9 YouTube, 9:16 TikTok, 1:1 Insta, 4:5 FB).
 * Chạy 100% mượt mà trên tất cả trình duyệt (Cốc Cốc, Chrome, Edge, Safari, Mobile).
 */

import { Canvas2DRenderer } from './video_editor/renderers/Canvas2DRenderer';
import { FrameScheduler } from './video_editor/core/FrameScheduler';

export const processVideoCanvas = async ({
  mode = 'video_studio',
  bgImage = null,
  bgEffect = 'zoom',
  bgFit = 'cover',
  bgZoom = 100,
  bgOffsetX = 0,
  bgOffsetY = 0,
  bgMirrorBlur = true,
  zoomSpeed = 0.2,
  zoomRange = 30,
  activeVisualizers = ['sinewave'],
  sinePosX = 50,
  sinePosY = 50,
  vinylPosX = 50,
  vinylPosY = 50,
  barsPosX = 50,
  barsPosY = 75,
  ringPosX = 50,
  ringPosY = 50,
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
  videoBitsPerSecond = 3000000,
  onProgress,
  onStatus,
  onBenchmark
}) => {
  if (onStatus) onStatus('Đang khởi tạo Trình Render Đa Luồng Canvas...');
  if (onProgress) onProgress(5);

  let bgImgEl = null;
  if (mode === 'image_music' && bgImage) {
    bgImgEl = new Image();
    const srcStr = bgImage.url || (bgImage.file ? URL.createObjectURL(bgImage.file) : bgImage);
    bgImgEl.src = srcStr;
    if (srcStr && !srcStr.startsWith('blob:') && !srcStr.startsWith('data:')) {
      bgImgEl.crossOrigin = 'anonymous';
    }
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
    const srcStr = clip.url || URL.createObjectURL(clip.file);
    videoEl.src = srcStr;
    videoEl.muted = false;
    videoEl.playsInline = true;
    if (srcStr && !srcStr.startsWith('blob:') && !srcStr.startsWith('data:')) {
      videoEl.crossOrigin = 'anonymous';
    }

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
      audioGain.connect(dest);
    } catch (e) {
      console.warn('Lỗi kết nối nhạc nền:', e);
    }
    if (mode === 'image_music') {
      totalProjectDuration = audioEl.duration || 30;
    }
  } else if (mode === 'image_music') {
    totalProjectDuration = 30;
  }

  // 5. Khởi tạo Canvas & Renderer
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  const renderer = new Canvas2DRenderer(canvas);

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
    videoBitsPerSecond: videoBitsPerSecond || 3000000
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
    let isVideoPausedForSync = false;
    let lastPlaybackRate = 1.0;

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      if (loadedVideoElements && loadedVideoElements.length > 0) {
        loadedVideoElements.forEach(item => {
          if (item && item.videoEl) {
            try { item.videoEl.pause(); } catch (e) {}
          }
        });
      }
      if (audioEl) {
        try { audioEl.pause(); } catch (e) {}
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch (e) {}
      }
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

    // Phát clip đầu tiên (chỉ đối với chế độ video_studio)
    if (mode !== 'image_music' && loadedVideoElements.length > 0) {
      const firstItem = loadedVideoElements[0];
      if (firstItem && firstItem.videoEl) {
        firstItem.videoEl.currentTime = firstItem.clipStart;
        firstItem.videoEl.play().catch(reject);
      }
    }

    const fps = 30;
    const scheduler = new FrameScheduler(fps);
    scheduler.start();

    const renderLoop = () => {
      // 1. Dùng scheduler.tick() để đồng bộ cứng thời gian thực theo 1x
      const targetTime = scheduler.tick(totalProjectDuration);
      if (targetTime === null) {
        // Chưa đến lúc vẽ hoặc bỏ qua frame trùng lặp
        animId = requestAnimationFrame(renderLoop);
        return;
      }

      projectTime = targetTime;

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
        let motionScale = 1.0;
        const zSpeed = zoomSpeed !== undefined ? zoomSpeed : 0.2;
        const zRange = zoomRange !== undefined ? zoomRange : 30;

        if (bgEffect === 'zoom') {
          motionScale = 1.0 + (Math.sin(projectTime * zSpeed * 3) + 1) * (zRange / 200);
        } else if (bgEffect === 'pulse') {
          motionScale = 1.0 + Math.abs(Math.sin(projectTime * zSpeed * 4)) * (zRange / 200);
        }

        const customScale = (bgZoom !== undefined ? bgZoom : 100) / 100;
        const totalScale = motionScale * customScale;

        // 1. Vẽ Ảnh Nền
        renderer.drawBackground(bgImgEl, bgMirrorBlur, bgFit, bgZoom, bgOffsetX, bgOffsetY, bgEffect, zoomSpeed, zoomRange, totalScale, canvasW, canvasH);

        // 2. Vẽ các hiệu ứng Visualizers lồng nhau
        renderer.drawVisualizers(activeVisualizers, { sinePosX, sinePosY, vinylPosX, vinylPosY, barsPosX, barsPosY, ringPosX, ringPosY }, projectTime, bgImgEl, canvasW, canvasH);
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

        if (activeVideoEl.paused) {
          activeVideoEl.play().catch(() => {});
        }

        // Đồng bộ mềm (Smooth synchronization) bằng cách điều chỉnh tốc độ phát
        const targetVideoTime = projectTime - activeItem.timelineStart + activeItem.clipStart;
        const actualVideoTime = activeVideoEl.currentTime;
        const drift = actualVideoTime - targetVideoTime;

        scheduler.recordDrift(drift);

        if (Math.abs(drift) > 0.5) {
          activeVideoEl.currentTime = targetVideoTime;
          activeVideoEl.playbackRate = 1.0;
          if (isVideoPausedForSync) {
            isVideoPausedForSync = false;
            scheduler.recordPauseEnd();
          }
        } else if (drift > 0.04) {
          // Hysteresis Band: Tạm dừng video nguồn nếu chạy nhanh hơn project timeline (>40ms)
          if (!isVideoPausedForSync) {
            activeVideoEl.pause();
            isVideoPausedForSync = true;
            scheduler.recordPauseStart();
          }
        } else if (isVideoPausedForSync && drift <= 0.01) {
          // Hysteresis Band: Chỉ cho phép phát lại khi độ lệch giảm xuống dưới 10ms để tránh dao động bật/tắt liên tục
          activeVideoEl.play().catch(() => {});
          isVideoPausedForSync = false;
          scheduler.recordPauseEnd();
        }

        // Điều tiết tốc độ phát tinh vi (±3%) nếu đang phát bình thường
        if (!isVideoPausedForSync) {
          if (activeVideoEl.paused) {
            activeVideoEl.play().catch(() => {});
          }

          let targetRate = 1.0;
          if (drift < -0.03) {
            targetRate = 1.03; // Video chạy hơi chậm -> Tăng nhẹ (+3%)
          } else if (drift > 0.01) {
            targetRate = 0.97; // Video chạy hơi nhanh -> Giảm nhẹ (-3%)
          }

          if (targetRate !== lastPlaybackRate) {
            activeVideoEl.playbackRate = targetRate;
            lastPlaybackRate = targetRate;
            scheduler.recordPlaybackRateChange();
          }
        }

        renderer.clear();
        renderer.drawVideoFrame(activeVideoEl, canvasW, canvasH);
      }

      // 3. Vẽ phụ đề (sử dụng cache Offscreen Canvas bên trong Renderer)
      renderer.drawSubtitles(subtitles, projectTime, subOptions, canvasW, canvasH);

      if (onProgress && totalProjectDuration > 0) {
        const percent = Math.min(99, Math.round((projectTime / totalProjectDuration) * 100));
        onProgress(percent);
      }

      // 4. Phát Benchmark dữ liệu
      if (onBenchmark) {
        const frameCount = scheduler.renderedFrames;
        if (frameCount % 15 === 0) {
          const metrics = scheduler.getMetrics(totalProjectDuration);
          if (metrics) {
            onBenchmark({
              resolution: `${canvasW}x${canvasH}`,
              sourceFps: '30',
              targetFps: fps,
              renderFps: metrics.renderFps.toFixed(1),
              expectedFrames: metrics.expectedFrames,
              renderedFrames: metrics.renderedFrames,
              schedulerSkippedFrames: metrics.schedulerSkippedFrames,
              skipRate: metrics.skipRate.toFixed(2),
              elapsed: metrics.elapsed.toFixed(1),
              remaining: metrics.remainingTime.toFixed(1),
              pauseCount: metrics.pauseCount,
              totalPauseDuration: metrics.totalPauseDuration.toFixed(2),
              maxDrift: metrics.maxDrift.toFixed(3),
              averageDrift: metrics.averageDrift.toFixed(3),
              playbackRateChanges: metrics.playbackRateChanges,
              progress: Math.min(99, Math.round((projectTime / totalProjectDuration) * 100))
            });
          }
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
};
