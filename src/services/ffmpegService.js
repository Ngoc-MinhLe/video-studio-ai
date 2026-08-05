import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let isFontLoaded = false;

/**
 * Khởi tạo engine FFmpeg WebAssembly từ file nội bộ (public/ffmpeg) hoặc CDN dự phòng
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

  const origin = window.location.origin;
  const localBaseURL = `${origin}/ffmpeg`;
  const jsdelivrURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
  const unpkgURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

  const sources = [
    { core: `${localBaseURL}/ffmpeg-core.js`, wasm: `${localBaseURL}/ffmpeg-core.wasm`, label: 'Server Nội Bộ' },
    { core: `${jsdelivrURL}/ffmpeg-core.js`, wasm: `${jsdelivrURL}/ffmpeg-core.wasm`, label: 'jsDelivr CDN' },
    { core: `${unpkgURL}/ffmpeg-core.js`, wasm: `${unpkgURL}/ffmpeg-core.wasm`, label: 'unpkg CDN' }
  ];

  let lastError = null;

  for (const src of sources) {
    try {
      if (onLog) onLog(`Đang nạp FFmpeg Core từ ${src.label}...`);
      
      const coreURL = await toBlobURL(src.core, 'text/javascript');
      const wasmURL = await toBlobURL(src.wasm, 'application/wasm');

      await ffmpeg.load({ coreURL, wasmURL });
      if (onLog) onLog('FFmpeg Core đã sẵn sàng!');
      return ffmpeg;
    } catch (err) {
      console.warn(`Không thể nạp FFmpeg từ ${src.label}:`, err);
      lastError = err;
    }
  }

  // Phương án nạp trực tiếp cuối cùng
  try {
    if (onLog) onLog('Thử nạp trực tiếp URL không qua Blob...');
    await ffmpeg.load({
      coreURL: `${localBaseURL}/ffmpeg-core.js`,
      wasmURL: `${localBaseURL}/ffmpeg-core.wasm`
    });
    return ffmpeg;
  } catch (err) {
    console.error('Không thể khởi tạo bất kỳ nguồn FFmpeg nào:', err);
    throw lastError || err;
  }
};

/**
 * Tải file phông chữ Roboto-Bold vào bộ nhớ ảo của FFmpeg để vẽ phụ đề (drawtext)
 */
const ensureFontLoaded = async () => {
  if (isFontLoaded) return;
  try {
    const fontUrl = `${window.location.origin}/fonts/Roboto-Bold.ttf`;
    const fontData = await fetchFile(fontUrl);
    await ffmpeg.writeFile('font.ttf', fontData);
    isFontLoaded = true;
    console.log('[FFmpeg]: Loaded font.ttf into virtual filesystem');
  } catch (err) {
    console.warn('[FFmpeg]: Cannot load local font.ttf, trying fallback CDN font...', err);
    try {
      const fallbackUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf';
      const fontData = await fetchFile(fallbackUrl);
      await ffmpeg.writeFile('font.ttf', fontData);
      isFontLoaded = true;
    } catch (fallbackErr) {
      console.error('[FFmpeg]: Failed to load font for drawtext:', fallbackErr);
    }
  }
};

/**
 * Xử lý Video: Thay nhạc & chèn phụ đề bằng FFmpeg WASM
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

  // 1. Nạp file video vào virtual filesystem
  await ffmpeg.writeFile(inputVideoName, await fetchFile(videoFile));

  let hasNewAudio = false;
  if (audioFile) {
    await ffmpeg.writeFile(inputAudioName, await fetchFile(audioFile));
    hasNewAudio = true;
  }

  // 2. Chuẩn bị phụ đề vẽ trực tiếp bằng filter `drawtext`
  const validSubtitles = (subtitles || []).filter(s => s.text && s.text.trim() !== '');
  const hasSubtitles = validSubtitles.length > 0;
  const createdSubFiles = [];

  if (hasSubtitles) {
    await ensureFontLoaded();
    for (let i = 0; i < validSubtitles.length; i++) {
      const filename = `sub_${i}.txt`;
      const textContent = validSubtitles[i].text.trim();
      await ffmpeg.writeFile(filename, new TextEncoder().encode(textContent));
      createdSubFiles.push(filename);
    }
  }

  // 3. Hàm tạo danh sách câu lệnh FFmpeg với cấu hình filtergraph
  const runFFmpegExec = async (useAudioMix) => {
    const ffmpegArgs = ['-i', inputVideoName];
    if (hasNewAudio) {
      ffmpegArgs.push('-i', inputAudioName);
    }

    const filterComplexParts = [];

    // --- VIDEO FILTER (Subtitles với drawtext) ---
    if (hasSubtitles && isFontLoaded) {
      const drawtextChain = validSubtitles.map((sub, i) => {
        let yPos = 'h-text_h-40';
        if (subOptions.position === 'top') yPos = '40';
        if (subOptions.position === 'center') yPos = '(h-text_h)/2';

        const start = Math.max(0, Number(sub.startTime) || 0);
        const end = Math.max(start + 0.1, Number(sub.endTime) || (start + 2));
        const fontSize = Math.max(12, Number(subOptions.fontSize) || 24);

        return `drawtext=fontfile=font.ttf:textfile=sub_${i}.txt:fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8:x=(w-text_w)/2:y=${yPos}:enable='between(t,${start},${end})'`;
      }).join(',');

      filterComplexParts.push(`[0:v]${drawtextChain}[vout]`);
    }

    // --- AUDIO FILTER ---
    let mappedAudioStream = null;
    if (hasNewAudio) {
      if (useAudioMix && videoVolume > 0) {
        filterComplexParts.push(`[0:a]volume=${videoVolume}[a0];[1:a]volume=${audioVolume}[a1];[a0][a1]amix=inputs=2:duration=first[aout]`);
        mappedAudioStream = '[aout]';
      } else {
        filterComplexParts.push(`[1:a]volume=${audioVolume}[aout]`);
        mappedAudioStream = '[aout]';
      }
    } else if (videoVolume !== 1) {
      filterComplexParts.push(`[0:a]volume=${videoVolume}[aout]`);
      mappedAudioStream = '[aout]';
    }

    // Ghép filter_complex nếu có
    if (filterComplexParts.length > 0) {
      ffmpegArgs.push('-filter_complex', filterComplexParts.join(';'));
    }

    // Map các luồng (Streams)
    if (hasSubtitles && isFontLoaded) {
      ffmpegArgs.push('-map', '[vout]');
    } else {
      ffmpegArgs.push('-map', '0:v');
    }

    if (mappedAudioStream) {
      ffmpegArgs.push('-map', mappedAudioStream);
    } else if (hasNewAudio) {
      ffmpegArgs.push('-map', '1:a');
    } else {
      ffmpegArgs.push('-map', '0:a?');
    }

    // Encoder options chuẩn MP4
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y', outputName
    );

    console.log('[FFmpeg Command]:', ffmpegArgs.join(' '));
    await ffmpeg.exec(ffmpegArgs);
  };

  // 4. Tiến hành render với cơ chế Fallback tự động
  try {
    await runFFmpegExec(true);
  } catch (err) {
    console.warn('Lỗi khi mix audio (có thể video gốc không có âm thanh), đang thử lại với audio thay thế...', err);
    if (hasNewAudio) {
      await runFFmpegExec(false);
    } else {
      throw err;
    }
  }

  // 5. Đọc kết quả file MP4 đã xuất
  const data = await ffmpeg.readFile(outputName);
  const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
  const resultUrl = URL.createObjectURL(videoBlob);

  // 6. Dọn dẹp tệp ảo tạm thời
  try {
    await ffmpeg.deleteFile(inputVideoName);
    if (hasNewAudio) await ffmpeg.deleteFile(inputAudioName);
    for (const f of createdSubFiles) {
      await ffmpeg.deleteFile(f);
    }
    await ffmpeg.deleteFile(outputName);
  } catch (e) {
    console.warn('Lỗi dọn dẹp file tạm:', e);
  }

  return resultUrl;
};

