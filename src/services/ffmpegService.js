import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;

/**
 * Khởi tạo engine FFmpeg WebAssembly
 * @param {Function} onProgress Callback nhận tiến trình % (0 - 100)
 * @param {Function} onLog Callback nhận thông báo log từ FFmpeg
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

  // Tải core WebAssembly từ CDN (unpkg/jsdelivr)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

/**
 * Chuyển danh sách phụ đề sang định dạng SubRip (.srt)
 * @param {Array} subtitles [{ id, startTime, endTime, text }]
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
    .sort((a, b) => a.startTime - b.startTime)
    .map((sub, index) => {
      return `${index + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`;
    })
    .join('\n');
};

/**
 * Xử lý Video: Thay nhạc & chèn phụ đề
 * @param {Object} params
 * @param {File} params.videoFile File video gốc (.mp4)
 * @param {File} params.audioFile File audio mới (.mp3/.wav, tùy chọn)
 * @param {number} params.videoVolume Âm lượng video gốc (0.0 - 1.0)
 * @param {number} params.audioVolume Âm lượng nhạc mới (0.0 - 1.0)
 * @param {Array} params.subtitles Danh sách phụ đề
 * @param {Object} params.subOptions Cấu hình phụ đề (fontSize, color, position)
 * @returns {Promise<string>} Blob URL của Video MP4 xuất ra
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
    throw new Error('FFmpeg chưa được khởi tạo. Vui lòng thử lại.');
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
      // Trộn cả 2 âm thanh với âm lượng tùy chỉnh
      filterComplex.push(`[0:a]volume=${videoVolume}[a0];[1:a]volume=${audioVolume}[a1];[a0][a1]amix=inputs=2:duration=first[aout]`);
    } else {
      // Tắt hoàn toàn tiếng gốc, chỉ dùng nhạc mới
      filterComplex.push(`[1:a]volume=${audioVolume}[aout]`);
    }
  } else {
    filterComplex.push(`[0:a]volume=${videoVolume}[aout]`);
  }

  // Xử lý Subtitle Filter (Drawtext / Subtitles)
  let videoFilter = '';
  if (hasSubtitles) {
    // Định dạng kiểu chữ và màu sắc cho srt filter
    const yPos = subOptions.position === 'top' ? 'h/10' : subOptions.position === 'center' ? 'h/2-20' : 'h-h/8';
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

  // Ép codec MP4 chuẩn (H.264 + AAC)
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
