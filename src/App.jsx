import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Music, 
  Type, 
  Download, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  CheckCircle2, 
  Loader2,
  FileVideo,
  FileAudio,
  Sliders,
  Layers
} from 'lucide-react';
import { loadFFmpeg, processVideo } from './services/ffmpegService';
import confetti from 'canvas-confetti';

export default function App() {
  // --- States Quản lý Files ---
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState('');

  // --- States Âm lượng ---
  const [videoVolume, setVideoVolume] = useState(1);
  const [audioVolume, setAudioVolume] = useState(1);

  // --- States Phụ đề ---
  const [subtitles, setSubtitles] = useState([
    { id: 1, startTime: 0, endTime: 3, text: '👋 Chào mừng bạn đến với Studio Video!' },
    { id: 2, startTime: 3, endTime: 6, text: '✨ Thay nhạc & thêm phụ đề cực kỳ dễ dàng.' }
  ]);
  const [subFontSize, setSubFontSize] = useState(24);
  const [subPosition, setSubPosition] = useState('bottom');

  // --- FFmpeg Engine & Export States ---
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState(null);
  const [statusText, setStatusText] = useState('Đang khởi tạo Engine xử lý video...');

  // --- Video Player Controls ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  // Khởi chạy Engine FFmpeg khi ứng dụng mở
  useEffect(() => {
    loadFFmpeg(
      (prog) => setProgress(prog),
      (log) => setStatusText(log)
    )
      .then(() => {
        setIsEngineReady(true);
        setStatusText('Hệ thống sẵn sàng!');
      })
      .catch((err) => {
        console.error('FFmpeg Init Error:', err);
        setStatusText('Lỗi khởi tạo Engine. Hãy kiểm tra trình duyệt.');
      });
  }, []);

  // Xử lý upload Video
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setExportUrl(null);
      setIsPlaying(false);
    }
  };

  // Xử lý upload Audio
  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setAudioName(file.name);
      setExportUrl(null);
    }
  };

  // Phát / Tạm dừng video
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Quản lý Phụ đề
  const addSubtitle = () => {
    const newId = subtitles.length > 0 ? Math.max(...subtitles.map(s => s.id)) + 1 : 1;
    const start = Math.floor(currentTime);
    setSubtitles([
      ...subtitles,
      { id: newId, startTime: start, endTime: start + 3, text: 'Phụ đề mới...' }
    ]);
  };

  const updateSubtitle = (id, field, value) => {
    setSubtitles(subtitles.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteSubtitle = (id) => {
    setSubtitles(subtitles.filter(s => s.id !== id));
  };

  // Tiến hành Render Xuất Video MP4
  const handleExport = async () => {
    if (!videoFile) {
      alert('Vui lòng chọn một file Video trước khi xuất!');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusText('Đang xử lý ghép nhạc & phụ đề...');

    try {
      const outputBlobUrl = await processVideo({
        videoFile,
        audioFile,
        videoVolume,
        audioVolume,
        subtitles,
        subOptions: { fontSize: subFontSize, position: subPosition }
      });

      setExportUrl(outputBlobUrl);
      setIsProcessing(false);
      setProgress(100);
      setStatusText('Xuất Video thành công!');

      // Hiệu ứng ăn mừng khi render xong
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (error) {
      console.error('Processing error:', error);
      alert('Đã xảy ra lỗi trong quá trình xử lý video: ' + error.message);
      setIsProcessing(false);
    }
  };

  // Lấy phụ đề đang hiển thị theo thời gian thực
  const currentSub = subtitles.find(
    s => currentTime >= Number(s.startTime) && currentTime <= Number(s.endTime)
  );

  return (
    <div className="min-h-screen pb-12">
      {/* --- HEADER --- */}
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl leading-tight gradient-text">Video Studio AI</h1>
              <p className="text-xs text-[var(--text-secondary)]">Thay nhạc & Tạo phụ đề TikTok/Reels tự động</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)]">
              {isEngineReady ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-400 font-medium">Engine WASM Sẵn sàng</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span className="text-purple-300">Đang khởi tạo FFmpeg...</span>
                </>
              )}
            </div>

            <button 
              onClick={handleExport}
              disabled={!videoFile || !isEngineReady || isProcessing}
              className="btn-primary"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Render ({progress}%)</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Xuất File MP4</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* --- STUDIO CONTAINER --- */}
      <main className="studio-container">
        {/* --- CỘT 1: UPLOAD & CẤU HÌNH ÂM THANH --- */}
        <section className="glass-panel p-5 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-lg">Mặt Bằng Âm Thanh</h2>
          </div>

          {/* Upload Video Gốc */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center justify-between">
              <span>Video Gốc (.mp4)</span>
              {videoFile && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </label>
            <label className="border-2 border-dashed border-[var(--border-color)] hover:border-purple-500/50 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-[var(--bg-secondary)]">
              <FileVideo className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-[var(--text-secondary)] text-center">
                {videoFile ? videoFile.name : 'Tải lên Video MP4'}
              </span>
              <input type="file" accept="video/mp4,video/*" onChange={handleVideoUpload} className="hidden" />
            </label>
          </div>

          {/* Upload Nhạc Nền Mới */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center justify-between">
              <span>Nhạc Thay Thế (.mp3 / .wav)</span>
              {audioFile && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </label>
            <label className="border-2 border-dashed border-[var(--border-color)] hover:border-pink-500/50 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-[var(--bg-secondary)]">
              <FileAudio className="w-8 h-8 text-pink-400" />
              <span className="text-xs text-[var(--text-secondary)] text-center">
                {audioName ? audioName : 'Tải lên file Nhạc mới'}
              </span>
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
          </div>

          {/* Thanh chỉnh âm lượng Video gốc */}
          <div className="flex flex-col gap-2 bg-[var(--bg-secondary)] p-3.5 rounded-xl border border-[var(--border-color)]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-purple-400" /> Tiếng Video Gốc
              </span>
              <span className="font-mono text-purple-300">{Math.round(videoVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={videoVolume}
              onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Thanh chỉnh âm lượng Nhạc Mới */}
          <div className="flex flex-col gap-2 bg-[var(--bg-secondary)] p-3.5 rounded-xl border border-[var(--border-color)]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-pink-400" /> Nhạc Nền Mới
              </span>
              <span className="font-mono text-pink-300">{Math.round(audioVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={audioVolume}
              onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
              className="w-full accent-pink-500 cursor-pointer"
            />
          </div>
        </section>

        {/* --- CỘT 2: VIDEO PREVIEW & TIMELINE --- */}
        <section className="glass-panel p-5 flex flex-col items-center justify-between gap-4">
          <div className="w-full flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" /> Trình Xem Trực Tiếp
            </h2>
            {duration > 0 && (
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </span>
            )}
          </div>

          {/* Khung chứa Video */}
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-[var(--border-color)] shadow-2xl">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => setCurrentTime(videoRef.current ? videoRef.current.currentTime : 0)}
                  onLoadedMetadata={() => setDuration(videoRef.current ? videoRef.current.duration : 0)}
                  onEnded={() => setIsPlaying(false)}
                />
                
                {/* Lớp Phụ Đề Live Preview */}
                {currentSub && (
                  <div className={`absolute left-0 right-0 px-6 text-center pointer-events-none transition-all ${
                    subPosition === 'top' ? 'top-6' : subPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-8'
                  }`}>
                    <span 
                      className="inline-block bg-black/75 text-white font-bold px-4 py-1.5 rounded-lg shadow-lg tracking-wide border border-white/10"
                      style={{ fontSize: `${subFontSize * 0.8}px` }}
                    >
                      {currentSub.text}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                <FileVideo className="w-12 h-12 stroke-[1.5]" />
                <p className="text-sm">Vui lòng tải lên một Video MP4 để xem trước</p>
              </div>
            )}
          </div>

          {/* Controls Phát Video & Export Dialog */}
          <div className="w-full flex flex-col gap-3">
            {videoUrl && (
              <div className="flex items-center gap-3 bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
                <button 
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-all shadow-md shadow-purple-600/30"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <input 
                  type="range" min="0" max={duration || 100} step="0.1"
                  value={currentTime}
                  onChange={(e) => {
                    const time = parseFloat(e.target.value);
                    setCurrentTime(time);
                    if (videoRef.current) videoRef.current.currentTime = time;
                  }}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
              </div>
            )}

            {/* Hộp Thông Báo Tiến Trình / Tải Về Video Nút Đẹp */}
            {exportUrl && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm text-emerald-300">Video Đã Sẵn Sàng!</h4>
                    <p className="text-xs text-[var(--text-secondary)]">File MP4 đã xử lý hoàn tất chuẩn nét.</p>
                  </div>
                </div>
                <a 
                  href={exportUrl} 
                  download="studio_output.mp4"
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Video MP4</span>
                </a>
              </div>
            )}
          </div>
        </section>

        {/* --- CỘT 3: TRÌNH BIÊN TẬP PHỤ ĐỀ --- */}
        <section className="glass-panel p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Type className="w-5 h-5 text-pink-400" /> Biên Tập Phụ Đề
            </h2>
            <button onClick={addSubtitle} className="btn-secondary text-xs px-2.5 py-1.5">
              <Plus className="w-4 h-4 text-emerald-400" /> Thêm Câu
            </button>
          </div>

          {/* Tùy chỉnh Kiểu Chữ Subtitle */}
          <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Cỡ chữ (px)</label>
              <input 
                type="number" value={subFontSize} min="14" max="48"
                onChange={(e) => setSubFontSize(Number(e.target.value))}
                className="input-field py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Vị trí hiển thị</label>
              <select 
                value={subPosition}
                onChange={(e) => setSubPosition(e.target.value)}
                className="input-field py-1 text-xs bg-[var(--bg-secondary)]"
              >
                <option value="bottom">Dưới cùng (TikTok)</option>
                <option value="center">Chính giữa</option>
                <option value="top">Trên cùng</option>
              </select>
            </div>
          </div>

          {/* Danh sách danh sách phụ đề */}
          <div className="flex-1 overflow-y-auto max-h-[480px] flex flex-col gap-3 pr-1">
            {subtitles.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">
                Chưa có phụ đề nào. Nhấn "+ Thêm Câu" để bắt đầu.
              </p>
            ) : (
              subtitles.map((sub) => (
                <div 
                  key={sub.id} 
                  className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                    currentTime >= sub.startTime && currentTime <= sub.endTime
                      ? 'bg-purple-950/40 border-purple-500/50 shadow-md shadow-purple-900/20'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-mono">
                      <input 
                        type="number" step="0.5" min="0" value={sub.startTime}
                        onChange={(e) => updateSubtitle(sub.id, 'startTime', parseFloat(e.target.value) || 0)}
                        className="w-14 input-field py-0.5 px-1 text-center font-mono text-xs"
                      />
                      <span>s ➔</span>
                      <input 
                        type="number" step="0.5" min="0" value={sub.endTime}
                        onChange={(e) => updateSubtitle(sub.id, 'endTime', parseFloat(e.target.value) || 0)}
                        className="w-14 input-field py-0.5 px-1 text-center font-mono text-xs"
                      />
                      <span>s</span>
                    </div>

                    <button 
                      onClick={() => deleteSubtitle(sub.id)}
                      className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                      title="Xóa phụ đề này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input 
                    type="text" 
                    value={sub.text}
                    onChange={(e) => updateSubtitle(sub.id, 'text', e.target.value)}
                    placeholder="Nhập nội dung phụ đề..."
                    className="input-field text-xs py-1.5"
                  />
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
