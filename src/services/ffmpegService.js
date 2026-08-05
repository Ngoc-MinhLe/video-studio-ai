import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;

/**
 * Khởi tạo engine FFmpeg WebAssembly từ file nội bộ (public/ffmpeg)
 */
export const loadFFmpeg = async (onProgress, onLog) => {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) {
      const percentage = Math.min(Math.round(progress * 100), 100);
      onProgress(percentage);
    }
  });

  ffmpeg.on('log', ({ message }) => {
    if (onLog) onLog(message);
    console.log('[FFmpeg WASM]:', message);
  });

  // Tải trực tiếp từ domain nội bộ (/ffmpeg/) để đảm bảo 100% không bị lỗi CORS/CDN
  const origin = window.location.origin;
  const localBaseURL = `${origin}/ffmpeg`;
  const jsdelivrURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

  const sources = [
    { core: `${localBaseURL}/ffmpeg-core.js`, wasm: `${localBaseURL}/ffmpeg-core.wasm`, label: 'Local Server' },
    { core: `${jsdelivrURL}/ffmpeg-core.js`, wasm: `${jsdelivrURL}/ffmpeg-core.wasm`, label: 'jsDelivr CDN' }
  ];

  let lastError = null;

  for (const src of sources) {
    try {
      if (onLog) onLog(`Đang khởi tạo FFmpeg Core từ ${src.label}...`);
      
      const coreURL = await toBlobURL(src.core, 'text/javascript');
      const wasmURL = await toBlobURL(src.wasm, 'application/wasm');

      await ffmpeg.load({ coreURL, wasmURL });
      if (onLog) onLog('FFmpeg Core đã khởi tạo thành công!');
      return ffmpeg;
    } catch (err) {
      console.warn(`Lỗi nạp FFmpeg từ ${src.label}:`, err);
      lastError = err;
    }
  }

  // Phương án dự phòng cuối cùng: Nạp trực tiếp URL không qua Blob
  try {
    if (onLog) onLog('Thử phương án nạp trực tiếp...');
    await ffmpeg.load({
      coreURL: `${localBaseURL}/ffmpeg-core.js`,
      wasmURL: `${localBaseURL}/ffmpeg-core.wasm`
    });
    return ffmpeg;
  } catch (err) {
    console.error('Lỗi khởi tạo tất cả các nguồn FFmpeg:', err);
    throw lastError || err;
  }
};

/**
 * Chuyển danh sách phụ đề sang định dạng SubRip (.srt)
 */
const formatSubtitlesToSRT = (subtitles) => {
  const formatTime = (seconds) => {
    const pad = (num, size = 2) => String(num).padStart(size, '0');
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
  };

  return subtitles
    .filter(s => s.text && s.text.trim() !== '')
    .sort((a, b) => a.startTime - b.startTime)
    .map((sub, index) => {
      return `${index + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`;
    })
    .join('\n');
};

/**
 * Xử lý Video: Thay nhạc & chèn phụ đề
 */
export const processVideo = async ({
  videoFile,
  audioFile,
  videoVolume = 1,
  audioVolume = 1,
  subtitles = [],
  subOptions = { fontSize: 24, fontColor: 'white', position: 'bottom' }
}) => {
  if (!ffmpeg || !ffmpeg.loaded) {
    throw new Error('FFmpeg chưa sẵn sàng. Hãy đợi quá trình tải hoàn tất.');
  }

  const inputVideoName = 'input.mp4';
  const inputAudioName = 'input_audio.mp3';
  const outputName = 'output.mp4';
  const srtName = 'subtitles.srt';

  // 1. Nạp file video vào virtual filesystem
  await ffmpeg.writeFile(inputVideoName, await fetchFile(videoFile));

  let hasNewAudio = false;
  if (audioFile) {
    await ffmpeg.writeFile(inputAudioName, await fetchFile(audioFile));
    hasNewAudio = true;
  }

  // 2. Chuẩn bị file phụ đề SRT nếu có
  let hasSubtitles = subtitles && subtitles.length > 0;
  if (hasSubtitles) {
    const srtContent = formatSubtitlesToSRT(subtitles);
    await ffmpeg.writeFile(srtName, new TextEncoder().encode(srtContent));
  }

  // 3. Xây dựng câu lệnh FFmpeg
  const ffmpegArgs = ['-i', inputVideoName];

  if (hasNewAudio) {
    ffmpegArgs.push('-i', inputAudioName);
  }

  // Xử lý Audio (Mix hoặc Thay thế)
  let filterComplex = [];
  
  if (hasNewAudio) {
    if (videoVolume > 0) {
      filterComplex.push(`[0:a]volume=${videoVolume}[a0];[1:a]volume=${audioVolume}[a1];[a0][a1]amix=inputs=2:duration=first[aout]`);
    } else {
      filterComplex.push(`[1:a]volume=${audioVolume}[aout]`);
    }
  } else {
    filterComplex.push(`[0:a]volume=${videoVolume}[aout]`);
  }

  // Xử lý Subtitle Filter
  let videoFilter = '';
  if (hasSubtitles) {
    videoFilter = `subtitles=${srtName}:force_style='FontSize=${subOptions.fontSize},PrimaryColour=&H00FFFFFF&,Alignment=2'`;
  }

  if (videoFilter) {
    ffmpegArgs.push('-vf', videoFilter);
  }

  if (filterComplex.length > 0) {
    ffmpegArgs.push('-filter_complex', filterComplex.join(';'));
    ffmpegArgs.push('-map', '0:v');
    ffmpegArgs.push('-map', '[aout]');
  }

  // Ép codec MP4 chuẩn
  ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-y', outputName);

  console.log('[FFmpeg Command]:', ffmpegArgs.join(' '));

  // 4. Chạy lệnh render
  await ffmpeg.exec(ffmpegArgs);

  // 5. Đọc kết quả xuất ra
  const data = await ffmpeg.readFile(outputName);
  const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
  const resultUrl = URL.createObjectURL(videoBlob);

  // Dọn dẹp tệp ảo
  try {
    await ffmpeg.deleteFile(inputVideoName);
    if (hasNewAudio) await ffmpeg.deleteFile(inputAudioName);
    if (hasSubtitles) await ffmpeg.deleteFile(srtName);
    await ffmpeg.deleteFile(outputName);
  } catch (e) {
    console.warn('Lỗi dọn dẹp file tạm:', e);
  }

  return resultUrl;
};
