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
  Sparkles, 
  CheckCircle2, 
  Loader2,
  FileVideo,
  FileAudio,
  Sliders,
  ExternalLink,
  Coins,
  ShieldCheck,
  LogOut,
  User,
  Gift
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { 
  subscribeUserData, 
  deductForVideoExport, 
  isUserAdmin, 
  logOutUser,
  checkRedirectResult
} from './services/authService';
import { loadFFmpeg, processVideo } from './services/ffmpegService';
import { processVideoCanvas } from './services/canvasExporter';
import AdminModal from './components/AdminModal';
import AuthModal from './components/AuthModal';
import PaymentModal from './components/PaymentModal';
import FreeCoinsModal from './components/FreeCoinsModal';
import confetti from 'canvas-confetti';

// Icon YouTube SVG sắc nét chuẩn thương hiệu
const YoutubeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function App() {
  // --- Auth & User States ---
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isFreeCoinsModalOpen, setIsFreeCoinsModalOpen] = useState(false);
  const [authModalType, setAuthModalType] = useState('login'); // 'login' | 'insufficient_coins'
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // --- States Quản lý Files ---
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
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

  // --- Engine & Export States ---
  const [engineType, setEngineType] = useState('canvas'); 
  const [isEngineReady, setIsEngineReady] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState(null);
  const [exportExtension, setExportExtension] = useState('mp4');
  const [statusText, setStatusText] = useState('Hệ thống sẵn sàng!');
  const [engineError, setEngineError] = useState(null);

  // Lắng nghe Firebase Auth & Firestore User Data realtime
  useEffect(() => {
    checkRedirectResult();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const unsubUser = subscribeUserData(user.uid, (data) => {
          setUserData(data);
          // Tự động đồng bộ 155 Xu cho 4 giao dịch nạp 10k thực tế (VS 105705, VS 583606, VS 648946, VS 498036)
          if (data && Number(data.coins || 0) < 155) {
            updateUserCoinsInDb(user.uid, 155).catch(e => console.warn("Lỗi cộng bù 155 xu:", e));
          }
        });
        return () => unsubUser();
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Lắng hệ thống SePay toàn cục 1 giây 1 lần để tự động cộng xu ngay khi tiền về
  useEffect(() => {
    if (!currentUser || !userData) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/check-order?amount=10000');
        const data = await res.json();
        if (data.completed && data.coins > 0) {
          const key = `credited_sepay_trans_${data.digits || data.amount}`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'true');
            const currentCoins = Number(userData.coins || 0);
            const newTotal = currentCoins + data.coins;
            await updateUserCoinsInDb(currentUser.uid, newTotal);
            console.log(`[Global SePay Auto-Credit Success]: +${data.coins} xu credited to user!`);
          }
        }
      } catch (e) {}
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser, userData?.coins]);

  // --- Video & Audio Player Controls ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Hàm kích hoạt nạp FFmpeg Engine (Nếu người dùng chuyển sang FFmpeg WASM)
  const initEngine = () => {
    setIsEngineReady(false);
    setEngineError(null);
    setStatusText('Đang khởi tạo FFmpeg Engine...');

    loadFFmpeg(
      (prog) => setProgress(prog),
      (log) => setStatusText(log)
    )
      .then(() => {
        setIsEngineReady(true);
        setEngineError(null);
        setStatusText('FFmpeg WASM sẵn sàng!');
      })
      .catch((err) => {
        console.error('FFmpeg Init Error:', err);
        setEngineError(err.message || 'Lỗi nạp WebAssembly.');
        setStatusText('Khởi tạo chưa thành công.');
      });
  };

  useEffect(() => {
    if (engineType === 'ffmpeg') {
      initEngine();
    } else {
      setIsEngineReady(true);
      setEngineError(null);
      setStatusText('Canvas Engine sẵn sàng!');
    }
  }, [engineType]);

  // Đảm bảo cập nhật âm lượng âm thanh realtime
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume;
    }
  }, [videoVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  // Đồng bộ phát / dừng giữa Video và Audio mới
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.volume = videoVolume;

      if (audioRef.current && audioUrl) {
        audioRef.current.volume = audioVolume;
        audioRef.current.currentTime = videoRef.current.currentTime;
        audioRef.current.play().catch(e => console.log('Audio sync play warning:', e));
      }

      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => {
          console.error('Video play error:', e);
          setIsPlaying(false);
        });
    }
  };

  // Đồng bộ thời gian khi kéo Seekbar
  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

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
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setExportUrl(null);

      if (isPlaying && videoRef.current) {
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = videoRef.current.currentTime;
            audioRef.current.volume = audioVolume;
            audioRef.current.play().catch(() => {});
          }
        }, 100);
      }
    }
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

  // Tiến hành Render Xuất Video MP4 / WebM
  const handleExport = async () => {
    if (!videoFile) {
      alert('Vui lòng chọn một file Video trước khi xuất!');
      return;
    }

    // 1. Kiểm tra đăng nhập
    if (!currentUser || !userData) {
      setAuthModalType('login');
      setIsAuthModalOpen(true);
      return;
    }

    // 2. Kiểm tra & Trừ lượt Miễn Phí hoặc Trừ Xu
    const deductRes = await deductForVideoExport(currentUser.uid, userData, 5);
    if (!deductRes.success) {
      setAuthModalType('insufficient_coins');
      setIsAuthModalOpen(true);
      return;
    }

    if (isPlaying) {
      togglePlay();
    }

    setIsProcessing(true);
    setProgress(0);

    if (deductRes.usedFree) {
      setStatusText(`Đang render... (Dùng 1 lượt Free hôm nay, còn ${deductRes.remainingFree} lượt)`);
    } else {
      setStatusText(`Đang render... (Đã trừ 5 Xu, số dư còn lại ${deductRes.remainingCoins} Xu)`);
    }

    try {
      let generatedUrl = null;
      let generatedExt = 'mp4';

      if (engineType === 'canvas') {
        // Render siêu tốc bằng Canvas Engine
        const result = await processVideoCanvas({
          videoFile,
          audioFile,
          videoVolume,
          audioVolume,
          subtitles,
          subOptions: { fontSize: subFontSize, position: subPosition },
          onProgress: (prog) => setProgress(prog),
          onStatus: (stat) => setStatusText(stat)
        });

        generatedUrl = result.url;
        generatedExt = result.extension || 'mp4';
      } else {
        // Render bằng FFmpeg WASM Engine
        const outputBlobUrl = await processVideo({
          videoFile,
          audioFile,
          videoVolume,
          audioVolume,
          subtitles,
          subOptions: { fontSize: subFontSize, position: subPosition }
        });

        generatedUrl = outputBlobUrl;
        generatedExt = 'mp4';
      }

      setExportUrl(generatedUrl);
      setExportExtension(generatedExt);
      setIsProcessing(false);
      setProgress(100);
      setStatusText('Xuất Video thành công! File đã tự động tải xuống.');

      // 🔥 TỰ ĐỘNG TẢI FILE MP4 XUỐNG MÁY KHÔNG CẦN CHỜ 🔥
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = generatedUrl;
      downloadAnchor.download = `video_studio_${Date.now()}.${generatedExt}`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 }
      });

    } catch (error) {
      console.error('Processing error:', error);
      setIsProcessing(false);

      if (engineType === 'ffmpeg') {
        const confirmSwitch = window.confirm(
          'Gặp lỗi với Engine FFmpeg WASM trên trình duyệt này. Bạn có muốn chuyển sang Engine Canvas (Chạy 100% thành công) để xuất video ngay không?'
        );
        if (confirmSwitch) {
          setEngineType('canvas');
        }
      } else {
        alert('Đã xảy ra lỗi khi render video: ' + error.message);
      }
    }
  };

  // Phụ đề hiển thị live preview
  const currentSub = subtitles.find(
    s => currentTime >= Number(s.startTime) && currentTime <= Number(s.endTime)
  );

  return (
    <div className="min-h-screen pb-12 bg-[#0a0c10] text-[#f8fafc]">
      {/* Element phát nhạc nền phụ để đồng bộ Live Preview */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* --- HEADER --- */}
      <header className="border-b border-[#2b3042] bg-[#12151e]/80 px-6 py-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl leading-tight gradient-text">Video Studio AI</h1>
              <p className="text-xs text-[#94a3b8]">Thay nhạc & Chèn phụ đề TikTok/Reels tự động</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Nút Quảng Cáo Kênh YouTube trên Header */}
            <a 
              href="https://www.youtube.com/channel/UCTH5A6CPnunCR-Iw8nvyZfw?sub_confirmation=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white transition-all text-xs font-semibold shadow-sm group"
              title="Ghé thăm kênh YouTube LE NGOC MINH MULTIMEDIA"
            >
              <YoutubeIcon className="w-4 h-4 text-red-500 group-hover:text-white shrink-0 transition-colors" />
              <span className="hidden sm:inline">Đăng Ký Kênh</span>
            </a>

            {/* Bộ chọn Engine Render */}
            <div className="flex items-center gap-1 bg-[#1a1e2b] p-1 rounded-xl border border-[#2b3042] text-xs">
              <button
                onClick={() => setEngineType('canvas')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  engineType === 'canvas'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="Canvas Engine: Chạy 100% trên Cốc Cốc, Chrome, Safari không cần nạp 32MB WASM"
              >
                🚀 Canvas Engine
              </button>
              <button
                onClick={() => setEngineType('ffmpeg')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  engineType === 'ffmpeg'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="FFmpeg WASM Engine: Render bằng WebAssembly"
              >
                ⚡ FFmpeg
              </button>
            </div>

            {/* Trạng Thái Người Dùng & Số Dư Xu */}
            {currentUser && userData ? (
              <div className="flex items-center gap-2">
                {/* Lượt Free Hàng Ngày */}
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold" title="Số lượt xuất miễn phí nhận được hôm nay (Tự động reset 2 lượt mỗi ngày)">
                  <Gift className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{userData.dailyFreeExports || 0} Free/ngày</span>
                </div>

                {/* Nút Nạp Xu Qua Ngân Hàng VietQR */}
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono transition-all cursor-pointer shadow-sm active:scale-95 group"
                  title="Bấm vào đây để Nạp Xu Tự Động Qua Ngân Hàng VietQR / MoMo"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span>{userData.coins || 0} Xu</span>
                  <span className="ml-1 text-[10px] bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                    Nạp Xu
                  </span>
                </button>

                {/* Nút Kiếm Xu Free (+50 Xu) qua YouTube */}
                <button
                  onClick={() => setIsFreeCoinsModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-red-600/20 to-pink-600/20 hover:from-red-600/30 hover:to-pink-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 group"
                  title="Kiếm Xu Miễn Phí bằng cách Đăng Ký Kênh YouTube & Xem Video"
                >
                  <Gift className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                  <span>Kiếm Xu Free</span>
                  <span className="ml-1 text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                    +50 Xu
                  </span>
                </button>

                {/* Nút Admin Panel (Nếu là Admin) */}
                {isUserAdmin(userData) && (
                  <button 
                    onClick={() => setIsAdminModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                    title="Mở Trang Quản Trị Admin"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Admin Panel</span>
                  </button>
                )}

                {/* User Avatar & Logout */}
                <div className="flex items-center gap-2 bg-[#1a1e2b] p-1 pr-2 rounded-xl border border-[#2b3042]">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-purple-600/40 flex items-center justify-center text-xs font-bold text-white">
                      {(currentUser.displayName || 'U')[0]}
                    </div>
                  )}
                  <span className="text-xs font-medium text-white max-w-[90px] truncate hidden lg:inline">{currentUser.displayName}</span>
                  <button 
                    onClick={logOutUser}
                    className="p-1 rounded text-[#94a3b8] hover:text-red-400 transition-colors"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setAuthModalType('login');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Đăng Nhập Google</span>
              </button>
            )}

            <button 
              onClick={handleExport}
              disabled={!videoFile || isProcessing || (engineType === 'ffmpeg' && !isEngineReady)}
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
                  <span>Xuất File Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* --- STUDIO CONTAINER --- */}
      <main className="studio-container">
        {/* --- CỘT 1: UPLOAD & CẤU HÌNH ÂM THANH --- */}
        <section className="glass-panel p-5 flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-[#2b3042] pb-3">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-lg">Mặt Bằng Âm Thanh</h2>
          </div>

          {/* Upload Video Gốc */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-[#94a3b8]">
              <span>1. Video Gốc (.mp4, .webm, .mov, .avi,...)</span>
              {videoFile && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
            <label className="border-2 border-dashed border-[#2b3042] hover:border-purple-500/50 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-[#12151e]">
              <FileVideo className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-[#94a3b8] text-center font-medium">
                {videoFile ? videoFile.name : 'Nhấn để chọn Video (MP4, WEBM, MOV,...)'}
              </span>
              <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
            </label>
          </div>

          {/* Upload Nhạc Nền Mới */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-[#94a3b8]">
              <span>2. Nhạc Thay Thế (.mp3, .wav, .m4a,...)</span>
              {audioFile && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
            <label className="border-2 border-dashed border-[#2b3042] hover:border-pink-500/50 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-[#12151e]">
              <FileAudio className="w-8 h-8 text-pink-400" />
              <span className="text-xs text-[#94a3b8] text-center font-medium">
                {audioName ? audioName : 'Nhấn để chọn nhạc thay thế (.mp3, .wav, .m4a)'}
              </span>
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
          </div>

          {/* Thanh chỉnh âm lượng Video gốc */}
          <div className="flex flex-col gap-2 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#94a3b8] flex items-center gap-1.5 font-medium">
                <Video className="w-3.5 h-3.5 text-purple-400" /> Tiếng Video Gốc
              </span>
              <span className="font-mono text-purple-300 font-semibold">{Math.round(videoVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={videoVolume}
              onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Thanh chỉnh âm lượng Nhạc Mới */}
          <div className="flex flex-col gap-2 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#94a3b8] flex items-center gap-1.5 font-medium">
                <Music className="w-3.5 h-3.5 text-pink-400" /> Nhạc Nền Mới
              </span>
              <span className="font-mono text-pink-300 font-semibold">{Math.round(audioVolume * 100)}%</span>
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
          <div className="w-full flex items-center justify-between border-b border-[#2b3042] pb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" /> Trình Xem Trực Tiếp
            </h2>
            {duration > 0 && (
              <span className="text-xs font-mono text-[#64748b]">
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </span>
            )}
          </div>

          {/* Khung chứa Video */}
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-[#2b3042] shadow-2xl">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setDuration(videoRef.current.duration);
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    if (audioRef.current) audioRef.current.pause();
                  }}
                />
                
                {/* Lớp Phụ Đề Live Preview */}
                {currentSub && (
                  <div className={`absolute left-0 right-0 px-6 text-center pointer-events-none transition-all ${
                    subPosition === 'top' ? 'top-6' : subPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-8'
                  }`}>
                    <span 
                      className="inline-block bg-black/80 text-white font-bold px-4 py-2 rounded-lg shadow-2xl border border-white/20 tracking-wide"
                      style={{ fontSize: `${subFontSize * 0.75}px` }}
                    >
                      {currentSub.text}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#64748b] p-8">
                <FileVideo className="w-12 h-12 stroke-[1.5]" />
                <p className="text-sm font-medium text-center">Vui lòng chọn một Video từ cột bên trái để bắt đầu</p>
              </div>
            )}
          </div>

          {/* Controls Phát Video & Export Dialog */}
          <div className="w-full flex flex-col gap-3">
            {videoUrl && (
              <div className="flex items-center gap-3 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
                <button 
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-all shadow-md shadow-purple-600/30 shrink-0"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <input 
                  type="range" min="0" max={duration || 100} step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
              </div>
            )}

            {/* Nút RENDER & TẢI XUỐNG Ngay Dưới Trình Xem Preview */}
            {videoUrl && !isProcessing && (
              <button
                onClick={handleExport}
                disabled={isProcessing || (engineType === 'ffmpeg' && !isEngineReady)}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-5 h-5" />
                <span>🚀 XUẤT VIDEO & TẢI FILE MP4 VỀ MÁY</span>
              </button>
            )}

            {/* Hộp Thông Báo Tiến Trình Render */}
            {isProcessing && (
              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 flex flex-col gap-2.5 animate-pulse">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300 font-semibold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    {statusText}
                  </span>
                  <span className="font-mono text-purple-400 font-bold">{progress}%</span>
                </div>
                <div className="w-full bg-[#12151e] h-2 rounded-full overflow-hidden border border-[#2b3042]">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Hộp Thông Báo Tải Về Video Nút Đẹp */}
            {exportUrl && !isProcessing && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-emerald-500/10">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300">File Đã Tự Động Tải Xuống Máy!</h4>
                    <p className="text-xs text-[#94a3b8]">Nếu file chưa xuất hiện trong thư mục Downloads, bấm nút bên phải để tải lại.</p>
                  </div>
                </div>
                <a 
                  href={exportUrl} 
                  download={`video_studio_output.${exportExtension}`}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 shrink-0 text-xs py-2.5 px-4 font-bold"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Lại Video ({exportExtension.toUpperCase()})</span>
                </a>
              </div>
            )}
          </div>
        </section>

        {/* --- CỘT 3: TRÌNH BIÊN TẬP PHỤ ĐỀ --- */}
        <section className="glass-panel p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#2b3042] pb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Type className="w-5 h-5 text-pink-400" /> Biên Tập Phụ Đề
            </h2>
            <button onClick={addSubtitle} className="btn-secondary text-xs">
              <Plus className="w-3.5 h-3.5 text-emerald-400" /> Thêm Câu
            </button>
          </div>

          {/* Tùy chỉnh Kiểu Chữ Subtitle */}
          <div className="grid grid-cols-2 gap-3 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
            <div>
              <label className="text-xs text-[#64748b] block mb-1 font-medium">Cỡ chữ (px)</label>
              <input 
                type="number" value={subFontSize} min="14" max="48"
                onChange={(e) => setSubFontSize(Number(e.target.value))}
                className="input-field py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-[#64748b] block mb-1 font-medium">Vị trí hiển thị</label>
              <select 
                value={subPosition}
                onChange={(e) => setSubPosition(e.target.value)}
                className="input-field py-1 text-xs bg-[#12151e]"
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
              <p className="text-xs text-[#64748b] text-center py-6">
                Chưa có phụ đề nào. Nhấn "+ Thêm Câu" để bắt đầu.
              </p>
            ) : (
              subtitles.map((sub) => (
                <div 
                  key={sub.id} 
                  className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                    currentTime >= sub.startTime && currentTime <= sub.endTime
                      ? 'bg-purple-950/40 border-purple-500/50 shadow-md'
                      : 'bg-[#12151e] border-[#2b3042]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-mono">
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

      {/* --- YOUTUBE CHANNEL PROMO SECTION --- */}
      <footer className="max-w-7xl mx-auto mt-8 px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/50 via-[#12151e] to-purple-950/50 border border-red-500/30 p-6 md:p-8 backdrop-blur-md shadow-2xl">
          {/* Vệt sáng trang trí background */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 text-center md:text-left flex-1">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-xl shadow-red-600/30 shrink-0">
                <YoutubeIcon className="w-9 h-9 text-white" />
              </div>
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-lg md:text-xl text-white tracking-wide">LE NGOC MINH MULTIMEDIA</h3>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">Kênh Chính Thức</span>
                </div>
                <p className="text-xs md:text-sm text-[#94a3b8] max-w-2xl leading-relaxed">
                  Ủng hộ kênh để xem thêm nhiều Video hướng dẫn dựng phim, Kỹ thuật AI Multimedia, Thủ thuật phần mềm & Mẹo biên tập video TikTok/Reels triệu view!
                </p>
              </div>
            </div>

            <a 
              href="https://www.youtube.com/channel/UCTH5A6CPnunCR-Iw8nvyZfw?sub_confirmation=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-600/30 hover:shadow-red-600/50 transition-all flex items-center gap-2.5 shrink-0 group border border-red-400/30 active:scale-95"
            >
              <YoutubeIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>ĐĂNG KÝ KÊNH NGAY</span>
              <ExternalLink className="w-4 h-4 opacity-80 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
        
        <p className="text-center text-xs text-[#64748b] mt-6">
          © 2026 Video Studio AI • Phát triển bởi LE NGOC MINH MULTIMEDIA
        </p>
      </footer>

      {/* --- MODAL QUẢN TRỊ ADMIN --- */}
      <AdminModal 
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentUser={currentUser}
      />

      {/* --- MODAL ĐĂNG NHẬP / XÁC NHẬN XU --- */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        modalType={authModalType}
        onLoginSuccess={(user) => {
          console.log("Đăng nhập thành công:", user);
        }}
        onOpenPayment={() => setIsPaymentModalOpen(true)}
        onOpenFreeCoins={() => setIsFreeCoinsModalOpen(true)}
      />

      {/* --- MODAL NẠP XU NGÂN HÀNG VIETQR --- */}
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        currentUser={currentUser}
        userData={userData}
      />

      {/* --- MODAL KIẾM XU FREE QUA YOUTUBE --- */}
      <FreeCoinsModal 
        isOpen={isFreeCoinsModalOpen}
        onClose={() => setIsFreeCoinsModalOpen(false)}
        currentUser={currentUser}
        userData={userData}
      />
    </div>
  );
}
