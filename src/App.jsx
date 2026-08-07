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
  Zap,
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
import ImageMusicWorkspace from './modules/ImageMusicVisualizer/ImageMusicWorkspace';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { 
  subscribeUserData, 
  deductForVideoExport, 
  isUserAdmin, 
  logOutUser,
  checkRedirectResult,
  updateUserCoinsInDb
} from './services/authService';
import { processVideoCanvas } from './services/canvasExporter';
const AdminModal = React.lazy(() => import('./components/AdminModal'));
const AuthModal = React.lazy(() => import('./components/AuthModal'));
const PaymentModal = React.lazy(() => import('./components/PaymentModal'));
const FreeCoinsModal = React.lazy(() => import('./components/FreeCoinsModal'));
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

  // --- States Workspace Module ---
  const [activeTab, setActiveTab] = useState('video_studio'); // 'video_studio' | 'image_music'

  // --- States Module 2: Image Music Visualizer ---
  const [bgImage, setBgImage] = useState(null); // { file, url }
  const [bgEffect, setBgEffect] = useState('zoom'); // 'zoom' | 'pulse' | 'none'
  const [activeVisualizers, setActiveVisualizers] = useState(['sinewave']); // Mảng lồng ghép nhiều hiệu ứng sóng âm cùng lúc
  const [selectedVizId, setSelectedVizId] = useState('sinewave'); // ID Sóng âm đang được lựa chọn để kéo thả / biên tập
  
  // Tọa độ riêng biệt cho từng hiệu ứng sóng âm độc lập
  const [sinePosX, setSinePosX] = useState(50);
  const [sinePosY, setSinePosY] = useState(50);
  const [vinylPosX, setVinylPosX] = useState(50);
  const [vinylPosY, setVinylPosY] = useState(50);
  const [barsPosX, setBarsPosX] = useState(50);
  const [barsPosY, setBarsPosY] = useState(75);
  const [ringPosX, setRingPosX] = useState(50);
  const [ringPosY, setRingPosY] = useState(50);

  const toggleVisualizer = (id) => {
    setActiveVisualizers(prev => {
      const next = prev.includes(id)
        ? (prev.length > 1 ? prev.filter(v => v !== id) : prev)
        : [...prev, id];
      // Nếu hiệu ứng vừa được bật, tự động chọn hiệu ứng đó làm tiêu điểm biên tập
      if (!prev.includes(id)) {
        setSelectedVizId(id);
      }
      return next;
    });
  };
  const [bgFit, setBgFit] = useState('cover'); // 'cover' | 'contain'
  const [bgZoom, setBgZoom] = useState(100); // 50 to 200
  const [bgOffsetX, setBgOffsetX] = useState(0); // -50 to 50%
  const [bgOffsetY, setBgOffsetY] = useState(0); // -50 to 50%
  const [bgMirrorBlur, setBgMirrorBlur] = useState(true); // Gương Phủ Mờ Lề Dư
  const [zoomSpeed, setZoomSpeed] = useState(0.2); // 0.05 to 1.0
  const [zoomRange, setZoomRange] = useState(30); // 10 to 100%
  const [exportBitrate, setExportBitrate] = useState(2500000); // Mặc định 2.5 Mbps (Tiêu chuẩn)

  const handleBgImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgImage({ file, url });
  };

  const removeBgImage = () => {
    if (bgImage && bgImage.url) URL.revokeObjectURL(bgImage.url);
    setBgImage(null);
  };

  // --- States Quản lý Multi-Clip Video & Audio ---
  const [videoClips, setVideoClips] = useState([]);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState('');

  // --- States Âm lượng & Cắt ghép Nhạc ---
  const [videoVolume, setVideoVolume] = useState(1);
  const [audioVolume, setAudioVolume] = useState(1);
  const [audioStartOffset, setAudioStartOffset] = useState(0);
  const [audioVideoOffset, setAudioVideoOffset] = useState(0);

  // --- States Phụ đề Độc Lập (Mặc định để trống) ---
  const [subtitles, setSubtitles] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [isDraggingSub, setIsDraggingSub] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');

  // --- Export States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState(null);
  const [exportExtension, setExportExtension] = useState('mp4');
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  // Lắng nghe Firebase Auth & Firestore User Data realtime
  useEffect(() => {
    checkRedirectResult();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const unsubUser = subscribeUserData(user.uid, (data) => {
          setUserData(data);
        });
        return () => unsubUser();
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Lắng nghe realtime các đơn nạp tiền của currentUser đã hoàn thành để tự động nhảy số Xu màu vàng
  useEffect(() => {
    if (!currentUser || !userData) return;

    try {
      const q = query(
        collection(db, "orders"),
        where("uid", "==", currentUser.uid),
        where("status", "==", "completed")
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added" || change.type === "modified") {
            const orderData = change.doc.data();
            const orderId = change.doc.id;
            const key = `processed_realtime_order_${orderId}`;

            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, "true");
              const coinsToAdd = Number(orderData.coins || 25);
              const currentCoins = Number(userData.coins || 0);
              const newTotal = currentCoins + coinsToAdd;
              try {
                await updateUserCoinsInDb(currentUser.uid, newTotal);
                console.log(`[Realtime Order Credit Success]: +${coinsToAdd} coins credited for order ${orderId}`);
                confetti({
                  particleCount: 150,
                  spread: 90,
                  origin: { y: 0.5 }
                });
              } catch (e) {
                console.warn("Lỗi cộng xu realtime từ đơn nạp:", e);
              }
            }
          }
        });
      });

      return () => unsub();
    } catch (err) {
      console.warn("Lỗi tạo query orders:", err);
    }
  }, [currentUser, userData?.coins]);

  // --- Video & Audio Player Controls ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Tính tổng thời lượng Dự án của tất cả các Video Clips
  const totalProjectDuration = videoClips.reduce((acc, clip) => {
    const clipDur = (clip.clipEnd && clip.clipEnd > clip.clipStart) 
      ? (clip.clipEnd - clip.clipStart) 
      : (clip.duration || 10);
    return acc + clipDur;
  }, 0);

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const pendingSeekTimeRef = useRef(null);

  const [animTime, setAnimTime] = useState(0);

  // Vòng lặp 60 FPS mượt mà cho hiệu ứng Thu Phóng Camera và Sóng Âm Visualizer
  useEffect(() => {
    let animId;
    let lastT = performance.now();

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;
      if (isPlaying) {
        setAnimTime(prev => prev + dt);
      }
      animId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

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

  // Đồng bộ thời gian phát nhạc & Phụ đề trong Chế độ 2 (Image Music Visualizer)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleAudioTimeUpdate = () => {
      if (activeTab === 'image_music') {
        const t = audioEl.currentTime;
        setCurrentTime(t);
        if (audioEl.duration && !isNaN(audioEl.duration)) {
          setDuration(audioEl.duration);
        }
      }
    };

    const handleAudioEnded = () => {
      if (activeTab === 'image_music') {
        setIsPlaying(false);
      }
    };

    audioEl.addEventListener('timeupdate', handleAudioTimeUpdate);
    audioEl.addEventListener('ended', handleAudioEnded);
    return () => {
      audioEl.removeEventListener('timeupdate', handleAudioTimeUpdate);
      audioEl.removeEventListener('ended', handleAudioEnded);
    };
  }, [activeTab, audioUrl]);

  // Đồng bộ phát / dừng giữa Video và Audio mới
  const togglePlay = () => {
    if (activeTab === 'image_music') {
      if (isPlaying) {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (audioRef.current && audioUrl) {
          audioRef.current.volume = audioVolume;
          audioRef.current.play().catch(e => console.log('Audio play warning:', e));
        }
        setIsPlaying(true);
      }
      return;
    }

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

  // Hàm tính toán thông tin clip tại vị trí thời gian Dự án (projectTime)
  const getClipAtProjectTime = (projectTime) => {
    if (!videoClips || videoClips.length === 0) return null;
    let accum = 0;
    for (let i = 0; i < videoClips.length; i++) {
      const clip = videoClips[i];
      const clipDur = (clip.clipEnd && clip.clipEnd > clip.clipStart)
        ? (clip.clipEnd - clip.clipStart)
        : (clip.duration || 10);

      if (projectTime >= accum && projectTime < accum + clipDur) {
        const offsetInClip = projectTime - accum;
        return {
          clip,
          clipIndex: i,
          clipTimelineStart: accum,
          clipTimelineEnd: accum + clipDur,
          clipDur,
          localTime: clip.clipStart + offsetInClip
        };
      }
      accum += clipDur;
    }
    const lastClip = videoClips[videoClips.length - 1];
    const lastDur = (lastClip.clipEnd && lastClip.clipEnd > lastClip.clipStart)
      ? (lastClip.clipEnd - lastClip.clipStart)
      : (lastClip.duration || 10);
    return {
      clip: lastClip,
      clipIndex: videoClips.length - 1,
      clipTimelineStart: accum - lastDur,
      clipTimelineEnd: accum,
      clipDur: lastDur,
      localTime: lastClip.clipStart || 0
    };
  };

  // Đồng bộ thời gian khi kéo Seekbar hoặc bấm trên Trục Thời Gian
  const handleSeek = (val) => {
    const targetTime = typeof val === 'number' ? val : parseFloat(val.target.value);
    setCurrentTime(targetTime);

    const clipInfo = getClipAtProjectTime(targetTime);
    if (clipInfo) {
      setSelectedClipId(clipInfo.clip.id);

      if (videoUrl !== clipInfo.clip.url) {
        pendingSeekTimeRef.current = clipInfo.localTime;
        setVideoFile(clipInfo.clip.file);
        setVideoUrl(clipInfo.clip.url);
      } else {
        if (videoRef.current) {
          try {
            videoRef.current.currentTime = clipInfo.localTime;
          } catch (e) {}
        }
      }
    }

    if (audioRef.current) {
      const audioTime = Math.max(0, targetTime - audioVideoOffset + audioStartOffset);
      try {
        audioRef.current.currentTime = audioTime;
      } catch (e) {}
    }
  };

  // Xử lý khi Video đang phát cập nhật thời gian
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || videoClips.length === 0) return;

    const currentClipIdx = videoClips.findIndex(c => c.id === selectedClipId);
    if (currentClipIdx === -1) return;

    const currentClip = videoClips[currentClipIdx];
    const localTime = videoRef.current.currentTime;

    let accumBefore = 0;
    for (let i = 0; i < currentClipIdx; i++) {
      const c = videoClips[i];
      accumBefore += (c.clipEnd && c.clipEnd > c.clipStart) ? (c.clipEnd - c.clipStart) : (c.duration || 10);
    }

    const elapsedInClip = Math.max(0, localTime - currentClip.clipStart);
    const projectTime = accumBefore + elapsedInClip;

    setCurrentTime(projectTime);

    // Kiểm tra hết clip hiện tại ➔ tự phát tiếp clip kế tiếp
    const clipEnd = currentClip.clipEnd || currentClip.duration || 10;
    if (localTime >= clipEnd - 0.15) {
      if (currentClipIdx < videoClips.length - 1) {
        const nextClip = videoClips[currentClipIdx + 1];
        setSelectedClipId(nextClip.id);
        setVideoFile(nextClip.file);
        setVideoUrl(nextClip.url);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = nextClip.clipStart;
            if (isPlaying) videoRef.current.play().catch(() => {});
          }
        }, 50);
      } else {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
      }
    }
  };

  // Xử lý upload Thêm Video Clip (Cho phép nạp nhiều video nối đuôi)
  const handleVideoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newClipsPromises = files.map(async (file, idx) => {
      const url = URL.createObjectURL(file);
      const id = Date.now() + idx;

      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      await new Promise((res) => {
        tempVideo.onloadedmetadata = res;
        tempVideo.onerror = res;
      });

      const fileDur = tempVideo.duration || 10;

      return {
        id,
        file,
        url,
        name: file.name,
        clipStart: 0,
        clipEnd: fileDur,
        duration: fileDur
      };
    });

    const newClips = await Promise.all(newClipsPromises);

    setVideoClips(prev => {
      const updated = [...prev, ...newClips];
      if (!videoUrl && updated.length > 0) {
        setVideoFile(updated[0].file);
        setVideoUrl(updated[0].url);
        setSelectedClipId(updated[0].id);
      }
      return updated;
    });
    setExportUrl(null);
    setIsPlaying(false);
  };

  // Hàm Tách Video Clip tại vị trí Kim thời gian hiện tại (Split Clip ✂️)
  const splitCurrentClip = () => {
    if (videoClips.length === 0) return;
    const clipInfo = getClipAtProjectTime(currentTime);
    if (!clipInfo) return;

    const { clip: targetClip, clipIndex, localTime } = clipInfo;
    const splitSec = Math.floor(localTime * 10) / 10;

    if (splitSec <= targetClip.clipStart + 0.3 || splitSec >= (targetClip.clipEnd || targetClip.duration) - 0.3) {
      alert('Vị trí kim thời gian quá gần đầu hoặc cuối clip, không thể tách!');
      return;
    }

    const firstPart = {
      ...targetClip,
      clipEnd: splitSec,
      duration: splitSec - targetClip.clipStart
    };

    const secondPart = {
      ...targetClip,
      id: Date.now(),
      name: `${targetClip.name} (Phần 2)`,
      clipStart: splitSec,
      clipEnd: targetClip.clipEnd || targetClip.duration,
      duration: (targetClip.clipEnd || targetClip.duration) - splitSec
    };

    const nextClips = [...videoClips];
    nextClips.splice(clipIndex, 1, firstPart, secondPart);

    setVideoClips(nextClips);
    setSelectedClipId(secondPart.id);
    setVideoFile(secondPart.file);
    setVideoUrl(secondPart.url);
  };

  // Hàm Xóa Video Clip được chọn (Delete Clip 🗑️)
  const removeClip = (clipId) => {
    const nextClips = videoClips.filter(c => c.id !== clipId);
    setVideoClips(nextClips);
    if (nextClips.length > 0) {
      setVideoFile(nextClips[0].file);
      setVideoUrl(nextClips[0].url);
      setSelectedClipId(nextClips[0].id);
    } else {
      setVideoFile(null);
      setVideoUrl(null);
      setSelectedClipId(null);
    }
  };

  const removeAudioTrack = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(null);
    setAudioUrl(null);
    setAudioName('');
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

      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        if (tempAudio.duration && !isNaN(tempAudio.duration)) {
          setDuration(tempAudio.duration);
        }
      };

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
    setSubtitles(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      if (field === 'startTime' && Number(updated.startTime) >= Number(updated.endTime)) {
        updated.endTime = Math.floor((Number(updated.startTime) + 3) * 10) / 10;
      }
      return updated;
    }));
  };

  // Phụ đề đang được chọn biên tập riêng biệt
  const activeSub = subtitles.find(s => s.id === selectedSubId) || subtitles[0] || {
    id: 1, startTime: 0, endTime: 3, text: '', x: 50, y: 85, style: 'tiktok', anim: 'bounce', fontSize: 24, rotation: 0, color: '#ffffff', bgColor: '#000000', boxWidth: 80, animSpeed: 0.5
  };

  const deleteSubtitle = (id) => {
    setSubtitles(subtitles.filter(s => s.id !== id));
  };

  // Tiến hành Render Xuất Video MP4 / WebM
  const handleExport = async () => {
    if (activeTab === 'video_studio' && !videoFile && videoFiles.length === 0) {
      alert('Vui lòng nạp ít nhất một file Video trước khi xuất!');
      return;
    }
    if (activeTab === 'image_music' && !bgImage && !audioFile) {
      alert('Vui lòng nạp Ảnh Nền hoặc Bài Hát MP3 trước khi xuất!');
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
    setBenchmarkData(null);

    if (deductRes.usedFree) {
      setStatusText(`Đang render... (Dùng 1 lượt Free hôm nay, còn ${deductRes.remainingFree} lượt)`);
    } else {
      setStatusText(`Đang render... (Đã trừ 5 Xu, số dư còn lại ${deductRes.remainingCoins} Xu)`);
    }

    try {
      // Render siêu tốc bằng Native GPU Canvas Engine
      const result = await processVideoCanvas({
        mode: activeTab,
        bgImage,
        bgEffect,
        bgFit,
        bgZoom,
        bgOffsetX,
        bgOffsetY,
        bgMirrorBlur,
        zoomSpeed,
        zoomRange,
        activeVisualizers,
        sinePosX,
        sinePosY,
        vinylPosX,
        vinylPosY,
        barsPosX,
        barsPosY,
        ringPosX,
        ringPosY,
        videoFile,
        videoClips: videoClips,
        audioFile,
        videoVolume,
        audioVolume,
        audioStartOffset,
        audioVideoOffset,
        subtitles,
        aspectRatio,
        videoBitsPerSecond: exportBitrate,
        onProgress: (p) => setProgress(p),
        onStatus: (s) => setStatusText(s),
        onBenchmark: (b) => setBenchmarkData(b)
      });

      const generatedUrl = result.url;
      const generatedExt = result.extension || 'mp4';

      setExportUrl(generatedUrl);
      setExportExtension(generatedExt);
      setIsProcessing(false);
      setProgress(100);
      setStatusText('Xuất Video thành công! File đã tự động tải xuống.');

      // Thử nghiệm đo lường thời lượng thực tế của file xuất ra
      const tempVideo = document.createElement('video');
      tempVideo.src = generatedUrl;
      tempVideo.addEventListener('loadedmetadata', () => {
        const actualDur = tempVideo.duration;
        setBenchmarkData(prev => {
          if (!prev) return prev;
          let outputDurationStr = 'Not directly measurable (WebM missing duration headers)';
          if (actualDur && isFinite(actualDur)) {
            outputDurationStr = `${actualDur.toFixed(1)}s`;
          }
          return {
            ...prev,
            outputDuration: outputDurationStr
          };
        });
        // Dọn dẹp tài nguyên thẻ video tạm
        try {
          tempVideo.src = "";
          tempVideo.load();
        } catch (e) {}
      });
      tempVideo.addEventListener('error', () => {
        setBenchmarkData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            outputDuration: 'Not directly measurable (Failed to parse container)'
          };
        });
      });

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
      alert('Đã xảy ra lỗi khi render video: ' + error.message);
    }
  };

  // Danh sách các phụ đề hiển thị live preview song song cùng lúc
  const activeSubs = subtitles.filter(
    s => s.text && s.text.trim() !== '' && currentTime >= Number(s.startTime) && currentTime <= Number(s.endTime)
  );

  return (
    <div className="min-h-screen pb-12 bg-[#0a0c10] text-[#f8fafc]">
      {/* Element phát nhạc nền phụ để đồng bộ Live Preview */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* --- HEADER --- */}
      <header className="border-b border-[#2b3042] bg-[#12151e]/80 px-6 py-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl leading-tight gradient-text">Video Studio AI</h1>
                <p className="text-xs text-[#94a3b8]">Thay nhạc & Chèn phụ đề TikTok/Reels tự động</p>
              </div>
            </div>

            {/* Thanh Chuyển Module Độc Lập (Tab Bar Switcher) */}
            <div className="flex items-center gap-1 bg-[#0d1017] p-1 rounded-xl border border-[#1e2333]">
              <button
                onClick={() => setActiveTab('video_studio')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'video_studio'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1a1e2b]'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>🎬 Studio Video</span>
              </button>
              <button
                onClick={() => setActiveTab('image_music')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'image_music'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1a1e2b]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🖼️ Tạo Video Từ 1 Ảnh</span>
              </button>
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

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/40 text-xs font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Động Cơ GPU Canvas (Siêu Tốc 60 FPS)</span>
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

            {exportUrl && (
              <a
                href={exportUrl}
                download={`video_studio_${Date.now()}.${exportExtension || 'mp4'}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/30 transition-all animate-pulse cursor-pointer border border-emerald-300/40"
              >
                <Download className="w-4 h-4" />
                <span>📥 TẢI VIDEO MP4 VỀ MÁY</span>
              </a>
            )}

            {/* Bộ Chọn Chất Lượng Video Bitrate */}
            <select
              value={exportBitrate}
              onChange={(e) => setExportBitrate(Number(e.target.value))}
              disabled={isProcessing}
              className="bg-[#12151e] border border-[#2b3042] text-xs text-[#94a3b8] rounded-xl px-2.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold cursor-pointer shrink-0"
              title="Chọn chất lượng video (Bitrate)"
            >
              <option value={1200000}>💾 Tiết Kiệm (1.2 Mbps - Tối ưu 1-2 tiếng)</option>
              <option value={2500000}>📊 Tiêu Chuẩn (2.5 Mbps - Mặc định)</option>
              <option value={5000000}>🎬 Chất Lượng Cao (5.0 Mbps)</option>
              <option value={8000000}>🔥 Siêu Sắc Nét (8.0 Mbps)</option>
            </select>

            <button 
              onClick={handleExport}
              disabled={isProcessing || (activeTab === 'image_music' ? (!bgImage && !audioFile) : !videoFile)}
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
        {/* --- CỘT 1: UPLOAD & CẤU HÌNH THEO PHÂN HỆ WORKSPACE --- */}
        {activeTab === 'image_music' ? (
          <ImageMusicWorkspace
            bgImage={bgImage}
            handleBgImageUpload={handleBgImageUpload}
            removeBgImage={removeBgImage}
            bgEffect={bgEffect}
            setBgEffect={setBgEffect}
            bgFit={bgFit}
            setBgFit={setBgFit}
            bgZoom={bgZoom}
            setBgZoom={setBgZoom}
            bgOffsetX={bgOffsetX}
            setBgOffsetX={setBgOffsetX}
            bgOffsetY={bgOffsetY}
            setBgOffsetY={setBgOffsetY}
            bgMirrorBlur={bgMirrorBlur}
            setBgMirrorBlur={setBgMirrorBlur}
            zoomSpeed={zoomSpeed}
            setZoomSpeed={setZoomSpeed}
            zoomRange={zoomRange}
            setZoomRange={setZoomRange}
            activeVisualizers={activeVisualizers}
            toggleVisualizer={toggleVisualizer}
            selectedVizId={selectedVizId}
            setSelectedVizId={setSelectedVizId}
            sinePosX={sinePosX}
            setSinePosX={setSinePosX}
            sinePosY={sinePosY}
            setSinePosY={setSinePosY}
            vinylPosX={vinylPosX}
            setVinylPosX={setVinylPosX}
            vinylPosY={vinylPosY}
            setVinylPosY={setVinylPosY}
            barsPosX={barsPosX}
            setBarsPosX={setBarsPosX}
            barsPosY={barsPosY}
            setBarsPosY={setBarsPosY}
            ringPosX={ringPosX}
            setRingPosX={setRingPosX}
            ringPosY={ringPosY}
            setRingPosY={setRingPosY}
            audioFile={audioFile}
            handleAudioUpload={handleAudioUpload}
            removeAudioTrack={removeAudioTrack}
            audioVolume={audioVolume}
            setAudioVolume={setAudioVolume}
            subtitles={subtitles}
            selectedSubId={selectedSubId}
            setSelectedSubId={setSelectedSubId}
            updateSubtitle={updateSubtitle}
            deleteSubtitle={deleteSubtitle}
            activeSub={activeSub}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
          />
        ) : (
          <section className="glass-panel p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2 border-b border-[#2b3042] pb-3">
              <Sliders className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold text-lg">Mặt Bằng Âm Thanh</h2>
            </div>

            {/* Upload Video Gốc (Cho phép chọn nhiều Video nối đuôi) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-medium text-[#94a3b8]">
                <span>1. Nạp Video Clips (Có thể chọn nhiều Video)</span>
                {videoClips.length > 0 && (
                  <span className="text-xs text-purple-400 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                    {videoClips.length} Clip
                  </span>
                )}
              </div>
              <label className="border-2 border-dashed border-[#2b3042] hover:border-purple-500/50 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-[#12151e]">
                <FileVideo className="w-8 h-8 text-purple-400" />
                <span className="text-xs text-[#94a3b8] text-center font-medium">
                  {videoClips.length > 0 ? `Đã nạp ${videoClips.length} video (Nhấn để nạp thêm)` : 'Nhấn để chọn 1 hoặc nhiều Video (.MP4, .WEBM, .MOV)'}
                </span>
                <input type="file" accept="video/*" multiple onChange={handleVideoUpload} className="hidden" />
              </label>

              {/* Danh sách các Clip Video đã nạp */}
              {videoClips.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 max-h-36 overflow-y-auto pr-1">
                  {videoClips.map((clip, i) => (
                    <div 
                      key={clip.id}
                      onClick={() => {
                        setSelectedClipId(clip.id);
                        setVideoFile(clip.file);
                        setVideoUrl(clip.url);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all cursor-pointer ${
                        selectedClipId === clip.id 
                          ? 'bg-purple-950/70 border border-purple-500/70 text-purple-200 shadow-md ring-1 ring-purple-500/30' 
                          : 'bg-[#12151e] border border-[#2b3042] text-[#94a3b8] hover:bg-[#1a1e2b]'
                      }`}
                    >
                      <span className="truncate max-w-[170px] font-medium">
                        {i + 1}. {clip.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeClip(clip.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/20 transition-colors"
                        title="Xóa clip này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

            {/* Cấu Hình Cắt Ghép Nhạc Nền */}
            {audioFile && (
              <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-pink-500/30">
                <div className="flex items-center justify-between text-xs font-semibold text-pink-300 border-b border-[#2b3042] pb-2">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-pink-400" /> Cắt & Khớp Thời Gian Nhạc
                  </span>
                </div>

                {/* 1. Bắt đầu phát từ giây bao nhiêu của file MP3 */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#94a3b8]">
                    <span>Cắt nhạc từ giây thứ của MP3:</span>
                    <span className="font-mono text-pink-300 font-bold">{audioStartOffset}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="0" max="120" step="1"
                      value={audioStartOffset}
                      onChange={(e) => setAudioStartOffset(Number(e.target.value))}
                      className="flex-1 accent-pink-500 cursor-pointer"
                    />
                    <button 
                      onClick={() => setAudioStartOffset(Math.floor(currentTime))}
                      className="text-[10px] px-2 py-0.5 rounded bg-pink-600/30 text-pink-300 border border-pink-500/40 hover:bg-pink-600 transition-colors shrink-0 cursor-pointer"
                      title="Đặt giây bắt đầu nhạc = Giây hiện tại đang xem"
                    >
                      Lấy {Math.floor(currentTime)}s
                    </button>
                  </div>
                </div>

                {/* 2. Lồng vào Video từ giây thứ bao nhiêu của Video */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#94a3b8]">
                    <span>Lồng vào Video từ giây thứ của Video:</span>
                    <span className="font-mono text-purple-300 font-bold">{audioVideoOffset}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="0" max={Math.floor(duration || 100)} step="1"
                      value={audioVideoOffset}
                      onChange={(e) => setAudioVideoOffset(Number(e.target.value))}
                      className="flex-1 accent-purple-500 cursor-pointer"
                    />
                    <button 
                      onClick={() => setAudioVideoOffset(Math.floor(currentTime))}
                      className="text-[10px] px-2 py-0.5 rounded bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600 transition-colors shrink-0 cursor-pointer"
                      title="Đặt vị trí lồng nhạc = Giây hiện tại đang xem"
                    >
                      Lấy {Math.floor(currentTime)}s
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* --- CỘT 2: VIDEO PREVIEW & TIMELINE --- */}
        <section className="glass-panel p-5 flex flex-col items-center justify-between gap-4">
          <div className="w-full flex flex-wrap items-center justify-between gap-2 border-b border-[#2b3042] pb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" /> Trình Xem Trực Tiếp
            </h2>
            
            {/* Bộ chọn Tỷ lệ Khung hình Live Preview */}
            <div className="flex items-center gap-1 bg-[#12151e] p-1 rounded-xl border border-[#2b3042] text-xs">
              <button
                onClick={() => setAspectRatio('16:9')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  aspectRatio === '16:9'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="Tỷ lệ 16:9 Ngang (YouTube, Tivi)"
              >
                🎬 16:9 (YouTube)
              </button>
              <button
                onClick={() => setAspectRatio('9:16')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  aspectRatio === '9:16'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="Tỷ lệ 9:16 Dọc (TikTok, Facebook Reels, Shorts)"
              >
                📱 9:16 (TikTok)
              </button>
              <button
                onClick={() => setAspectRatio('1:1')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  aspectRatio === '1:1'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="Tỷ lệ 1:1 Vuông (Instagram Feed)"
              >
                🔳 1:1
              </button>
              <button
                onClick={() => setAspectRatio('4:5')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  aspectRatio === '4:5'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="Tỷ lệ 4:5 Dọc vừa (Facebook Post)"
              >
                🎞️ 4:5
              </button>
              <button
                onClick={() => setAspectRatio('original')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  aspectRatio === 'original'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
                title="Giữ nguyên Tỷ lệ Gốc của Video"
              >
                📺 Gốc
              </button>
            </div>
          </div>

          {/* Khung chứa Video xem trước theo đúng Tỷ Lệ được chọn */}
          <div className="w-full flex justify-center items-center py-2 bg-[#090b10] rounded-xl border border-[#2b3042]">
            <div className={`relative bg-black rounded-xl overflow-hidden flex items-center justify-center border border-purple-500/30 shadow-2xl transition-all duration-300 ${
              aspectRatio === '9:16' ? 'w-[280px] h-[497px]' :
              aspectRatio === '1:1' ? 'w-[360px] h-[360px]' :
              aspectRatio === '4:5' ? 'w-[320px] h-[400px]' :
              'w-full aspect-video max-h-[500px]'
            }`}>
              {activeTab === 'image_music' && bgImage ? (
                <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                  {/* Lớp Phủ Mờ Gương Kính Lấp Đầy 2 Lề Dư (Blurred Mirror Fill) */}
                  {bgMirrorBlur && (
                    <img 
                      src={bgImage.url} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover filter blur-2xl scale-125 opacity-70 pointer-events-none" 
                    />
                  )}

                  {/* Ảnh Nền Chính với Thu Phóng Focus & Di Chuyển X/Y 60 FPS Mượt Mà */}
                  {(() => {
                    const activeTime = isPlaying ? animTime : currentTime;
                    const cameraMotionScale = bgEffect === 'zoom' 
                      ? 1.0 + (Math.sin(activeTime * (zoomSpeed || 0.2) * 3) + 1) * ((zoomRange || 30) / 200)
                      : bgEffect === 'pulse' 
                      ? 1.0 + Math.abs(Math.sin(activeTime * (zoomSpeed || 0.2) * 4)) * ((zoomRange || 30) / 200)
                      : 1.0;

                    const totalScale = (bgZoom / 100) * cameraMotionScale;

                    return (
                      <img 
                        src={bgImage.url} 
                        alt="Background" 
                        className={`w-full h-full ${bgFit === 'contain' ? 'object-contain' : 'object-cover'} relative z-10`} 
                        style={{
                          transformOrigin: `${50 + bgOffsetX}% ${50 + bgOffsetY}%`,
                          transform: `translate(${bgOffsetX}%, ${bgOffsetY}%) scale(${totalScale})`
                        }}
                      />
                    );
                  })()}

                  {/* 1. SÓNG SINE DJ NEON ĐỘC ĐÁO ĐA TẦNG */}
                  {activeVisualizers.includes('sinewave') && (
                    <div 
                      className={`absolute z-20 pointer-events-auto cursor-grab active:cursor-grabbing select-none flex flex-col items-center justify-center px-2 py-3 ${
                        selectedVizId === 'sinewave' ? 'ring-2 ring-pink-500 rounded border border-dashed border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.5)] bg-pink-500/5' : ''
                      }`}
                      style={{ 
                        left: `${(sinePosX !== undefined ? sinePosX : 50) - 50}%`,
                        top: `${sinePosY !== undefined ? sinePosY : 50}%`, 
                        width: '100%',
                        transform: 'translateY(-50%)' 
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedVizId('sinewave');
                        const targetEl = e.currentTarget;
                        const container = targetEl.parentElement;
                        if (!container) return;

                        try { targetEl.setPointerCapture(e.pointerId); } catch (err) {}

                        const handlePointerMove = (moveEv) => {
                          const rect = container.getBoundingClientRect();
                          if (rect.width === 0 || rect.height === 0) return;
                          const relY = moveEv.clientY - rect.top;
                          const pctY = Math.max(10, Math.min(90, (relY / rect.height) * 100));
                          setSinePosY(Math.round(pctY));
                        };

                        const handlePointerUp = (upEv) => {
                          try { targetEl.releasePointerCapture(upEv.pointerId); } catch (err) {}
                          window.removeEventListener('pointermove', handlePointerMove);
                          window.removeEventListener('pointerup', handlePointerUp);
                        };

                        window.addEventListener('pointermove', handlePointerMove);
                        window.addEventListener('pointerup', handlePointerUp);
                      }}
                    >
                      <svg className="w-full h-28 overflow-visible pointer-events-none" viewBox="0 0 500 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="neonSineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ec4899" />
                            <stop offset="40%" stopColor="#a855f7" />
                            <stop offset="70%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Sóng Sine Nền Phát Sáng Rộng */}
                        <path 
                          d={`M 0 60 Q 125 ${60 + (isPlaying ? Math.sin((isPlaying ? animTime : currentTime) * 6) * 45 : 15)} 250 60 T 500 60`} 
                          fill="none" 
                          stroke="url(#neonSineGlow)" 
                          strokeWidth="8" 
                          opacity="0.6"
                          filter="url(#glowEffect)"
                        />

                        {/* Sóng Sine Chính Sắc Nét */}
                        <path 
                          d={`M 0 60 Q 125 ${60 + (isPlaying ? Math.sin((isPlaying ? animTime : currentTime) * 6) * 40 : 10)} 250 60 T 500 60`} 
                          fill="none" 
                          stroke="url(#neonSineGlow)" 
                          strokeWidth="4" 
                        />

                        {/* Sóng Sine Đối Xứng Nhảy Nhịp */}
                        <path 
                          d={`M 0 60 Q 125 ${60 - (isPlaying ? Math.sin((isPlaying ? animTime : currentTime) * 6) * 40 : 10)} 250 60 T 500 60`} 
                          fill="none" 
                          stroke="#38bdf8" 
                          strokeWidth="3" 
                          className="opacity-90"
                        />

                        {/* Các Hạt Kim Cương Nhấp Nháy Theo Nhạc */}
                        {[50, 150, 250, 350, 450].map((px, idx) => (
                          <circle 
                            key={idx}
                            cx={px}
                            cy={60 + (isPlaying ? Math.sin((isPlaying ? animTime : currentTime) * 6 + idx) * 35 : 0)}
                            r={isPlaying ? 4 + Math.abs(Math.sin((isPlaying ? animTime : currentTime) * 8 + idx)) * 3 : 3}
                            fill="#f472b6"
                            className="filter drop-shadow-[0_0_8px_rgba(244,114,182,1)]"
                          />
                        ))}
                      </svg>
                    </div>
                  )}

                  {/* 2. ĐĨA QUAY VINYL CHUYÊN NGHIỆP CÓ CẦN KIM NHẠC */}
                  {activeVisualizers.includes('vinyl') && (
                    <div 
                      className={`absolute z-25 pointer-events-auto cursor-grab active:cursor-grabbing select-none p-4 rounded-full ${
                        selectedVizId === 'vinyl' ? 'ring-2 ring-amber-500 border border-dashed border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] bg-amber-500/5' : ''
                      }`}
                      style={{ 
                        left: `${vinylPosX !== undefined ? vinylPosX : 50}%`, 
                        top: `${vinylPosY !== undefined ? vinylPosY : 50}%`, 
                        transform: 'translate(-50%, -50%)' 
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedVizId('vinyl');
                        const targetEl = e.currentTarget;
                        const container = targetEl.parentElement;
                        if (!container) return;

                        try { targetEl.setPointerCapture(e.pointerId); } catch (err) {}

                        const handlePointerMove = (moveEv) => {
                          const rect = container.getBoundingClientRect();
                          if (rect.width === 0 || rect.height === 0) return;
                          const relX = moveEv.clientX - rect.left;
                          const relY = moveEv.clientY - rect.top;
                          const pctX = Math.max(10, Math.min(90, (relX / rect.width) * 100));
                          const pctY = Math.max(10, Math.min(90, (relY / rect.height) * 100));
                          setVinylPosX(Math.round(pctX));
                          setVinylPosY(Math.round(pctY));
                        };

                        const handlePointerUp = (upEv) => {
                          try { targetEl.releasePointerCapture(upEv.pointerId); } catch (err) {}
                          window.removeEventListener('pointermove', handlePointerMove);
                          window.removeEventListener('pointerup', handlePointerUp);
                        };

                        window.addEventListener('pointermove', handlePointerMove);
                        window.addEventListener('pointerup', handlePointerUp);
                      }}
                    >
                      <div className="relative flex items-center justify-center pointer-events-none">
                        {/* Hào quang phát sáng sau đĩa */}
                        <div className={`absolute w-44 h-44 rounded-full bg-purple-600/30 filter blur-xl ${isPlaying ? 'animate-pulse' : ''}`} />

                        {/* Đĩa Than Quay */}
                        <div 
                          className="w-40 h-40 rounded-full border-4 border-slate-700 bg-[#0c0d12] shadow-2xl flex items-center justify-center relative transition-transform"
                          style={{
                            transform: `rotate(${(isPlaying ? animTime : currentTime) * 120}deg)`
                          }}
                        >
                          {/* Đường Rãnh Đĩa Than */}
                          {[...Array(5)].map((_, i) => (
                            <div 
                              key={i} 
                              className="absolute rounded-full border border-white/10"
                              style={{ width: `${60 + i * 14}%`, height: `${60 + i * 14}%` }}
                            />
                          ))}

                          {/* Nhãn Artwork Ở Giữa */}
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400/80 shadow-inner">
                            <img src={bgImage.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-900 shadow" />
                        </div>

                        {/* Cần Kim Đĩa Nhạc (Tonearm Needle) */}
                        <div 
                          className="absolute -top-6 -right-6 w-16 h-20 pointer-events-none transition-transform duration-500"
                          style={{ transform: isPlaying ? 'rotate(12deg)' : 'rotate(-10deg)', transformOrigin: 'top right' }}
                        >
                          <div className="w-2 h-14 bg-gradient-to-b from-slate-400 to-slate-200 rounded-full ml-auto shadow-md" />
                          <div className="w-4 h-4 bg-amber-500 rounded-sm ml-auto -mt-1 shadow-lg border border-amber-300" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. BARS EQUALIZER SPECTRUM 24 CỘT CÓ CHẤM ĐỈNH POKER */}
                  {activeVisualizers.includes('bars') && (
                    <div 
                      className={`absolute z-20 pointer-events-auto cursor-grab active:cursor-grabbing select-none flex items-end gap-1.5 h-24 p-2 rounded-lg ${
                        selectedVizId === 'bars' ? 'ring-2 ring-cyan-500 border border-dashed border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] bg-cyan-500/5' : ''
                      }`}
                      style={{ 
                        left: `${barsPosX !== undefined ? barsPosX : 50}%`, 
                        top: `${barsPosY !== undefined ? barsPosY : 75}%`, 
                        transform: 'translate(-50%, -50%)' 
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedVizId('bars');
                        const targetEl = e.currentTarget;
                        const container = targetEl.parentElement;
                        if (!container) return;

                        try { targetEl.setPointerCapture(e.pointerId); } catch (err) {}

                        const handlePointerMove = (moveEv) => {
                          const rect = container.getBoundingClientRect();
                          if (rect.width === 0 || rect.height === 0) return;
                          const relX = moveEv.clientX - rect.left;
                          const relY = moveEv.clientY - rect.top;
                          const pctX = Math.max(10, Math.min(90, (relX / rect.width) * 100));
                          const pctY = Math.max(10, Math.min(90, (relY / rect.height) * 100));
                          setBarsPosX(Math.round(pctX));
                          setBarsPosY(Math.round(pctY));
                        };

                        const handlePointerUp = (upEv) => {
                          try { targetEl.releasePointerCapture(upEv.pointerId); } catch (err) {}
                          window.removeEventListener('pointermove', handlePointerMove);
                          window.removeEventListener('pointerup', handlePointerUp);
                        };

                        window.addEventListener('pointermove', handlePointerMove);
                        window.addEventListener('pointerup', handlePointerUp);
                      }}
                    >
                      {[...Array(24)].map((_, i) => {
                        const t = isPlaying ? animTime : currentTime;
                        const h = isPlaying ? Math.floor(10 + Math.abs(Math.sin(t * 5 + i * 0.4)) * 55) : 8;
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 pointer-events-none">
                            {/* Chấm Đỉnh Bouncing Peak */}
                            <div 
                              className="w-2 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(6,182,212,1)]"
                              style={{
                                transform: `translateY(-${h + 4}px)`,
                                transition: 'transform 0.1s ease-out'
                              }}
                            />
                            {/* Cột Sóng Âm Neon Gradient */}
                            <div 
                              className="w-2 bg-gradient-to-t from-pink-500 via-purple-500 to-cyan-400 rounded-t-full shadow-[0_0_10px_rgba(168,85,247,0.7)]"
                              style={{
                                height: `${h}px`,
                                transition: 'height 0.08s ease'
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 4. VÒNG HÀO QUANG NEON CYBER PULSE */}
                  {activeVisualizers.includes('ring') && (
                    <div 
                      className={`absolute z-20 pointer-events-auto cursor-grab active:cursor-grabbing select-none p-4 rounded-full ${
                        selectedVizId === 'ring' ? 'ring-2 ring-fuchsia-500 border border-dashed border-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.5)] bg-fuchsia-500/5' : ''
                      }`}
                      style={{ 
                        left: `${ringPosX !== undefined ? ringPosX : 50}%`, 
                        top: `${ringPosY !== undefined ? ringPosY : 50}%`, 
                        transform: 'translate(-50%, -50%)' 
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedVizId('ring');
                        const targetEl = e.currentTarget;
                        const container = targetEl.parentElement;
                        if (!container) return;

                        try { targetEl.setPointerCapture(e.pointerId); } catch (err) {}

                        const handlePointerMove = (moveEv) => {
                          const rect = container.getBoundingClientRect();
                          if (rect.width === 0 || rect.height === 0) return;
                          const relX = moveEv.clientX - rect.left;
                          const relY = moveEv.clientY - rect.top;
                          const pctX = Math.max(10, Math.min(90, (relX / rect.width) * 100));
                          const pctY = Math.max(10, Math.min(90, (relY / rect.height) * 100));
                          setRingPosX(Math.round(pctX));
                          setRingPosY(Math.round(pctY));
                        };

                        const handlePointerUp = (upEv) => {
                          try { targetEl.releasePointerCapture(upEv.pointerId); } catch (err) {}
                          window.removeEventListener('pointermove', handlePointerMove);
                          window.removeEventListener('pointerup', handlePointerUp);
                        };

                        window.addEventListener('pointermove', handlePointerMove);
                        window.addEventListener('pointerup', handlePointerUp);
                      }}
                    >
                      <div className="relative flex items-center justify-center pointer-events-none">
                        <div 
                          className="w-44 h-44 rounded-full border-4 border-pink-500 shadow-[0_0_35px_rgba(236,72,153,0.9)] transition-all duration-100"
                          style={{
                            transform: `scale(${1 + Math.abs(Math.sin((isPlaying ? animTime : currentTime) * 6)) * 0.18})`
                          }}
                        />
                        <div 
                          className="absolute w-56 h-56 rounded-full border-2 border-dashed border-cyan-400/70"
                          style={{
                            transform: `rotate(${(isPlaying ? animTime : currentTime) * 60}deg)`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    playsInline
                    className="w-full h-full object-contain"
                    onTimeUpdate={handleVideoTimeUpdate}
                    onLoadedData={() => {
                      if (pendingSeekTimeRef.current !== null && videoRef.current) {
                        try {
                          videoRef.current.currentTime = pendingSeekTimeRef.current;
                        } catch (e) {}
                        pendingSeekTimeRef.current = null;
                      }
                      if (isPlaying && videoRef.current) {
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    onEnded={() => {
                      // Xử lý chuyển clip tiếp theo khi video hiện tại kết thúc
                      const currentClipIdx = videoClips.findIndex(c => c.id === selectedClipId);
                      if (currentClipIdx !== -1 && currentClipIdx < videoClips.length - 1) {
                        const nextClip = videoClips[currentClipIdx + 1];
                        setSelectedClipId(nextClip.id);
                        setVideoFile(nextClip.file);
                        setVideoUrl(nextClip.url);
                        setTimeout(() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = nextClip.clipStart;
                            if (isPlaying) videoRef.current.play().catch(() => {});
                          }
                        }, 50);
                      } else {
                        setIsPlaying(false);
                        if (audioRef.current) audioRef.current.pause();
                      }
                    }}
                  />
                  
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-[#64748b] p-8">
                  <FileVideo className="w-12 h-12 stroke-[1.5]" />
                  <p className="text-sm font-medium text-center">Vui lòng chọn một Video hoặc Ảnh Nền từ cột bên trái để bắt đầu</p>
                </div>
              )}

              {/* Lớp Phụ Đề Live Preview chuẩn kích thước - Hỗ trợ Kéo Thả & Phong Cách Riêng Biệt ✋ */}
              {(() => {
                const displaySubs = activeSubs.length > 0 
                  ? activeSubs 
                  : (activeSub && activeSub.text && activeSub.text.trim() !== '') ? [activeSub] : [];

                return displaySubs.map((sub) => {
                  const style = sub.style || 'tiktok';
                  const anim = sub.anim || 'bounce';
                  const fontSize = sub.fontSize || 24;
                  const rotation = sub.rotation || 0;
                  const color = sub.color || '#ffffff';
                  const bgColor = sub.bgColor || '#000000';
                  const boxWidth = sub.boxWidth || 80;
                  const animSpeed = sub.animSpeed || 0.5;
                  const posX = sub.x !== undefined ? sub.x : 50;
                  const posY = sub.y !== undefined ? sub.y : 85;
                  const isSelected = selectedSubId === sub.id;

                  const alignTransformX = posX >= 75 ? '-100%' : posX <= 25 ? '0%' : '-50%';
                  const alignTransformY = posY >= 75 ? '-100%' : posY <= 25 ? '0%' : '-50%';

                  return (
                    <div 
                      key={sub.id}
                      className={`absolute cursor-grab active:cursor-grabbing select-none group z-30 flex justify-center touch-none ${
                        isSelected ? 'ring-2 ring-pink-500 rounded-lg p-0.5 shadow-[0_0_15px_rgba(236,72,153,0.8)]' : ''
                      }`}
                      style={{ 
                        touchAction: 'none',
                        left: `${posX}%`, 
                        top: `${posY}%`,
                        width: style === 'led' || anim === 'marquee' ? `${boxWidth}%` : 'auto',
                        transform: `translate(${alignTransformX}, ${alignTransformY}) rotate(${rotation}deg)`
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSubId(sub.id);
                        const targetEl = e.currentTarget;
                        const container = targetEl.parentElement;
                        if (!container) return;
                        setIsDraggingSub(true);

                        try {
                          targetEl.setPointerCapture(e.pointerId);
                        } catch (err) {}

                        const handlePointerMove = (moveEv) => {
                          const rect = container.getBoundingClientRect();
                          if (rect.width === 0 || rect.height === 0) return;
                          const relX = moveEv.clientX - rect.left;
                          const relY = moveEv.clientY - rect.top;

                          const pctX = Math.max(5, Math.min(95, (relX / rect.width) * 100));
                          const pctY = Math.max(5, Math.min(95, (relY / rect.height) * 100));

                          updateSubtitle(sub.id, 'x', Math.round(pctX));
                          updateSubtitle(sub.id, 'y', Math.round(pctY));
                        };

                        const handlePointerUp = (upEv) => {
                          setIsDraggingSub(false);
                          try {
                            targetEl.releasePointerCapture(upEv.pointerId);
                          } catch (err) {}
                          window.removeEventListener('pointermove', handlePointerMove);
                          window.removeEventListener('pointerup', handlePointerUp);
                        };

                        window.addEventListener('pointermove', handlePointerMove);
                        window.addEventListener('pointerup', handlePointerUp);
                      }}
                    >
                      {style === 'led' || anim === 'marquee' ? (
                        /* Khung Bảng Đèn LED Chạy Chữ Quảng Cáo (LED Marquee Window) */
                        <div className="w-full overflow-hidden border-2 border-amber-500 bg-[#06080d]/95 p-2 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.7)] text-amber-200 font-mono font-extrabold whitespace-nowrap flex items-center">
                          <span 
                            style={{
                              fontSize: `${fontSize}px`,
                              animationDuration: `${10 / animSpeed}s`
                            }}
                            className="animate-marquee inline-block font-mono text-amber-200 tracking-wider shadow-amber-400"
                          >
                            📟 {sub.text}
                          </span>
                        </div>
                      ) : (
                        <span 
                          style={{
                            fontSize: `${fontSize}px`,
                            color: style === 'custom' ? color : undefined,
                            backgroundColor: style === 'custom' ? bgColor : undefined
                          }}
                          className={`inline-block font-extrabold px-3.5 py-1.5 rounded-lg shadow-2xl tracking-wide whitespace-nowrap transition-all ${
                            anim === 'bounce' ? 'animate-bounce' : 
                            anim === 'pulse' ? 'animate-pulse' : 
                            anim === 'shake' ? 'animate-ping' : ''
                          } ${
                            style === 'tiktok' ? 'bg-yellow-400 text-slate-950 border-2 border-black font-black shadow-yellow-500/20' :
                            style === 'victory' ? 'bg-[#0f0720]/90 text-purple-200 border-2 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.8)] font-black' :
                            style === 'boom' ? 'bg-red-600 text-white border-2 border-yellow-300 font-black shadow-lg' :
                            style === 'sponge' ? 'bg-green-700 text-white border-2 border-green-400 font-black shadow-green-500/30' :
                            style === 'social' ? 'bg-blue-600 text-white border-2 border-white font-bold shadow-md' :
                            style === 'neon' ? 'bg-[#18092b]/90 text-pink-400 border-2 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.6)] font-bold' :
                            style === 'cinema' ? 'bg-black/75 text-white border border-white/20 shadow-2xl font-semibold backdrop-blur-sm' :
                            'bg-black/85 text-white border border-white/20 shadow-xl'
                          }`}
                        >
                          {(() => {
                            let raw = sub.text;
                            if (anim === 'typewriter') {
                              const words = raw.split(' ');
                              const subDur = (Number(sub.endTime) - Number(sub.startTime)) || 3;
                              const elapsed = Math.max(0, currentTime - Number(sub.startTime));
                              const revealProg = Math.min(1, Math.max(0, (elapsed * animSpeed) / subDur));
                              const visibleCount = Math.max(1, Math.ceil(revealProg * words.length));
                              raw = words.slice(0, visibleCount).join(' ');
                            }
                            return style === 'victory' ? `⚡ ${raw} ⚡` : style === 'boom' ? `💥 ${raw}` : style === 'social' ? `📢 ${raw}` : raw;
                          })()}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Controls Phát Video & Live Audio Preview */}
          <div className="w-full flex flex-col gap-3">
            {exportUrl && (
              <div className="flex flex-col items-center gap-2 p-3 bg-emerald-950/80 border-2 border-emerald-500 rounded-xl shadow-xl">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  🎉 Video đã render thành công! Bấm nút để tải file MP4 về máy:
                </span>
                <a
                  href={exportUrl}
                  download={`video_studio_${Date.now()}.${exportExtension || 'mp4'}`}
                  className="w-full text-center py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-5 h-5 animate-bounce" />
                  <span>📥 TẢI VIDEO MP4 VỀ MÁY (TẢI FILE GỐC)</span>
                </a>
              </div>
            )}

            {(videoUrl || (activeTab === 'image_music' && (bgImage || audioFile))) && (
              <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
                {/* Nút Play/Pause & Sliderseek cơ bản */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-all shadow-md shadow-purple-600/30 shrink-0 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      type="range" min="0" max={totalProjectDuration || duration || 100} step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 accent-purple-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-purple-300 font-bold shrink-0 min-w-[90px] text-right">
                      {Math.floor(currentTime)}s / {Math.floor(totalProjectDuration || duration || 0)}s
                    </span>
                  </div>
                </div>

                {/* --- TRỤC TRUYỀN HÌNH CHUYÊN NGHIỆP: VISUAL MULTI-TRACK TIMELINE & CẮT XẺ --- */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#2b3042]/60">
                  <div className="flex items-center justify-between text-xs font-medium text-[#94a3b8]">
                    <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" /> Trục Thời Gian (Timeline Non-Linear)
                    </span>
                    
                    {/* BỘ NÚT TÁCH VIDEO ✂️ VÀ XÓA 🗑️ CHUYÊN NGHIỆP */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={splitCurrentClip}
                        disabled={!selectedClipId || videoClips.length === 0}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600 text-purple-200 border border-purple-500/40 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40"
                        title="Tách Video Clip làm 2 đoạn ngay tại Kim Thời Gian đỏ (Split Clip)"
                      >
                        <span>✂️ Tách Clip Tại {Math.floor(currentTime)}s</span>
                      </button>

                      {selectedClipId && (
                        <button
                          onClick={() => removeClip(selectedClipId)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600/30 hover:bg-red-600 text-red-200 border border-red-500/40 text-[11px] font-bold transition-all cursor-pointer"
                          title="Xóa đoạn clip đang được chọn"
                        >
                          <Trash2 className="w-3 h-3 text-red-300" />
                          <span>Xóa Đoạn Đang Chọn</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* --- THƯỚC ĐO THỜI GIAN CHUYÊN NGHIỆP (TIME RULER 📐) --- */}
                  <div className="relative w-full h-5 bg-[#12151e] rounded border border-[#2b3042] flex items-center px-1 font-mono text-[9px] text-[#64748b] select-none">
                    {(() => {
                      const totalDur = Math.max(10, Math.ceil(totalProjectDuration || duration || 10));
                      const steps = 10;
                      const interval = totalDur / steps;
                      const ticks = [];
                      for (let i = 0; i <= steps; i++) {
                        const sec = Math.round(i * interval);
                        const pct = (i / steps) * 100;
                        ticks.push(
                          <div 
                            key={i} 
                            className="absolute flex flex-col items-center -translate-x-1/2"
                            style={{ left: `${pct}%` }}
                          >
                            <span className="text-[9px] font-bold text-[#94a3b8]">{sec}s</span>
                            <div className="w-[1px] h-1.5 bg-[#2b3042]" />
                          </div>
                        );
                      }
                      return ticks;
                    })()}
                  </div>

                  {/* Khung Trục Thời Gian Đa Luồng */}
                  <div 
                    className="relative w-full bg-[#090b10] rounded-lg p-2 border border-[#2b3042] flex flex-col gap-2 cursor-pointer select-none overflow-hidden"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                      const totalDur = totalProjectDuration || duration || 1;
                      const targetProjectTime = ratio * totalDur;
                      handleSeek(targetProjectTime);
                    }}
                  >
                    {/* Kim Thời Gian (Playhead Red Line) */}
                    {(totalProjectDuration > 0 || duration > 0) && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 shadow-[0_0_10px_rgba(239,68,68,0.9)] pointer-events-none"
                        style={{ left: `${Math.min(100, Math.max(0, (currentTime / (totalProjectDuration || duration || 1)) * 100))}%` }}
                      >
                        <div className="w-3 h-3 bg-red-500 rotate-45 -translate-x-[4px] -mt-1 rounded-sm shadow-md" />
                      </div>
                    )}

                    {/* Track 1: Luồng Đa Clip Video (Hiển thị đầy đủ từng clip) */}
                    <div className="w-full h-7 bg-[#12151e] rounded flex items-center relative overflow-hidden p-0.5 border border-[#2b3042]/70">
                      {videoClips.length > 0 ? (
                        (() => {
                          const totalDur = totalProjectDuration || 1;
                          let accumTime = 0;

                          return videoClips.map((clip, idx) => {
                            const clipDur = (clip.clipEnd && clip.clipEnd > clip.clipStart) 
                              ? (clip.clipEnd - clip.clipStart) 
                              : (clip.duration || 10);

                            const startPct = (accumTime / totalDur) * 100;
                            const widthPct = Math.max(3, (clipDur / totalDur) * 100);
                            const isSelected = selectedClipId === clip.id;
                            const clipStartOnTimeline = accumTime;

                            accumTime += clipDur;

                            return (
                              <div
                                key={clip.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeek(clipStartOnTimeline);
                                }}
                                className={`absolute h-6 rounded text-[10px] font-bold px-2 flex items-center justify-between truncate transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white ring-2 ring-purple-400 z-10 shadow-lg shadow-purple-500/30'
                                    : 'bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-500/30'
                                }`}
                                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                                title={`Clip ${idx + 1}: ${clip.name} (Tách từ ${clip.clipStart}s đến ${clip.clipEnd || clip.duration}s)`}
                              >
                                <span className="truncate max-w-[120px]">🎬 {idx + 1}. {clip.name}</span>
                                <span className="text-[9px] font-mono opacity-80 shrink-0">({Math.round(clipDur)}s)</span>
                              </div>
                            );
                          });
                        })()
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-[#64748b]">
                          🎬 Chưa có Video Clip
                        </div>
                      )}
                    </div>

                    {/* Track 2: Luồng Nhạc Nền Mới */}
                    {audioFile && (
                      <div className="w-full h-5 bg-[#12151e] rounded flex items-center relative overflow-hidden border border-pink-500/30">
                        <div 
                          className="h-full bg-gradient-to-r from-pink-600/80 to-rose-500/80 rounded transition-all duration-100"
                          style={{ width: `${(totalProjectDuration || duration) > 0 ? Math.min(100, (currentTime / (totalProjectDuration || duration)) * 100) : 0}%` }}
                        />
                        <span className="absolute left-2 text-[10px] text-pink-200 font-bold pointer-events-none drop-shadow">
                          🎵 Nhạc Nền ({audioName || 'File Nhạc'}) (Từ {audioVideoOffset}s)
                        </span>
                      </div>
                    )}

                    {/* Track 3: Dải Băng Các Câu Phụ Đề */}
                    <div className="w-full h-6 bg-[#12151e] rounded relative flex items-center overflow-hidden border border-[#2b3042]/50">
                      {subtitles.map((sub) => {
                        const totalDur = totalProjectDuration || duration || 1;
                        const startPct = Math.min(100, Math.max(0, (sub.startTime / totalDur) * 100));
                        const endPct = Math.min(100, Math.max(0, (sub.endTime / totalDur) * 100));
                        const widthPct = Math.max(2, endPct - startPct);
                        const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

                        return (
                          <div
                            key={sub.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (videoRef.current) {
                                videoRef.current.currentTime = sub.startTime;
                                setCurrentTime(sub.startTime);
                              }
                            }}
                            className={`absolute h-4 rounded text-[9px] font-bold px-1 flex items-center truncate transition-all ${
                              isActive 
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 ring-2 ring-amber-300 shadow-md shadow-amber-400/30 z-10 scale-105' 
                                : 'bg-purple-600/60 hover:bg-purple-500/80 text-white border border-purple-400/30'
                            }`}
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                            title={`Phụ đề: "${sub.text}" (${sub.startTime}s - ${sub.endTime}s)`}
                          >
                            {sub.text}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Nút RENDER & TẢI XUỐNG Ngay Dưới Trình Xem Preview */}
            {videoUrl && !isProcessing && (
              <button
                onClick={handleExport}
                disabled={isProcessing}
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

                {benchmarkData && (
                  <div className="mt-1 text-xs border border-purple-500/20 bg-purple-950/20 p-2.5 rounded-lg flex flex-col gap-1.5 text-purple-300 font-mono">
                    <div className="flex justify-between items-center border-b border-purple-500/10 pb-1 mb-1">
                      <span className="font-bold text-[10px] uppercase text-purple-400">📊 Render Benchmark</span>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDebug(!showDebug); }} 
                        className="text-[10px] text-purple-400 hover:text-white underline cursor-pointer"
                      >
                        {showDebug ? '[Ẩn]' : '[Hiện]'}
                      </button>
                    </div>
                    {showDebug && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        <div>Chế Độ Ghi: <span className="text-white font-bold">{benchmarkData.captureMode}</span></div>
                        <div>Độ Phân Giải: <span className="text-white">{benchmarkData.resolution}</span></div>
                        <div>Render FPS: <span className="text-emerald-400 font-bold">{benchmarkData.renderFps}</span></div>
                        <div>Target FPS: <span className="text-white">{benchmarkData.targetFps}</span></div>
                        <div>Đã Vẽ: <span className="text-white">{benchmarkData.renderedFrames} / {benchmarkData.expectedFrames}</span></div>
                        <div>Capture Requests: <span className="text-white font-bold">{benchmarkData.captureRequests}</span></div>
                        <div>Bỏ Qua (Skipped): <span className="text-rose-400">{benchmarkData.schedulerSkippedFrames} ({benchmarkData.skipRate}%)</span></div>
                        <div>Thời gian Vẽ TB/Max: <span className="text-amber-400">{benchmarkData.averageRenderTime}ms / {benchmarkData.maxRenderTime}ms</span></div>
                        <div>Lần Tạm Dừng: <span className="text-amber-400">{benchmarkData.pauseCount} ({benchmarkData.totalPauseDuration}s)</span></div>
                        <div>Lệch Lớn / TB: <span className="text-white">{benchmarkData.maxDrift}s / {benchmarkData.averageDrift}s</span></div>
                        <div>Thay Tốc Độ: <span className="text-white">{benchmarkData.playbackRateChanges} lần</span></div>
                        <div>Thời gian Chạy Thực Tế: <span className="text-white">{benchmarkData.elapsed}s</span></div>
                        <div>Thời lượng Dự Án: <span className="text-white">{benchmarkData.projectDuration || '0.0'}s</span></div>
                        <div>Thời lượng Output: <span className="text-amber-400 font-bold">Đang đo khi hoàn tất...</span></div>
                        <div className="col-span-2 text-white border-t border-purple-500/10 pt-1 mt-1 font-bold">
                          Độ lệch Output - Project: <span className="text-amber-400">Đang đo khi hoàn tất...</span>
                        </div>
                        <div className="col-span-2 text-gray-500 border-t border-purple-500/10 pt-1">
                          Encoded/Dropped Frames: Not directly measurable from this pipeline
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-amber-400 bg-amber-950/40 p-2 rounded border border-amber-500/20 leading-relaxed font-bold mt-1 text-center">
                  ⚠️ KHÔNG CHUYỂN TAB HOẶC ẨN TRÌNH DUYỆT TRONG KHI XUẤT VIDEO ĐỂ TRÁNH BỊ ĐỨNG HÌNH (TRÌNH DUYỆT TỰ DỪNG VẼ KHI ẨN TAB).
                </div>
              </div>
            )}

            {/* Hộp Thông Báo Tải Về Video Nút Đẹp */}
            {exportUrl && !isProcessing && (
              <div className="flex flex-col gap-3">
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

                {/* Giữ lại summary benchmark kết quả sau khi export xong */}
                {benchmarkData && (
                  <div className="p-3 border border-purple-500/20 bg-purple-950/20 rounded-xl flex flex-col gap-2.5 text-purple-300 font-mono text-xs">
                    <div className="flex justify-between items-center border-b border-purple-500/10 pb-1.5">
                      <span className="font-bold text-[10px] uppercase text-purple-400">📊 TỔNG KẾT RENDER BENCHMARK (ĐÃ XUẤT XONG)</span>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDebug(!showDebug); }} 
                        className="text-[10px] text-purple-400 hover:text-white underline cursor-pointer"
                      >
                        {showDebug ? '[Ẩn Chi Tiết]' : '[Hiện Chi Tiết]'}
                      </button>
                    </div>
                    {showDebug && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                        <div>Chế Độ Ghi: <span className="text-white font-bold">{benchmarkData.captureMode}</span></div>
                        <div>Độ Phân Giải: <span className="text-white">{benchmarkData.resolution}</span></div>
                        <div>Render FPS TB: <span className="text-emerald-400 font-bold">{benchmarkData.renderFps}</span></div>
                        <div>Target FPS: <span className="text-white">{benchmarkData.targetFps}</span></div>
                        <div>Tổng Số Frame Đã Vẽ: <span className="text-white">{benchmarkData.renderedFrames} / {benchmarkData.expectedFrames}</span></div>
                        <div>Capture Requests: <span className="text-white font-bold">{benchmarkData.captureRequests}</span></div>
                        <div>Bỏ Qua (Skipped): <span className="text-rose-400">{benchmarkData.schedulerSkippedFrames} ({benchmarkData.skipRate}%)</span></div>
                        <div>Thời gian Vẽ TB/Max: <span className="text-amber-400">{benchmarkData.averageRenderTime}ms / {benchmarkData.maxRenderTime}ms</span></div>
                        <div>Lần Tạm Dừng: <span className="text-amber-400">{benchmarkData.pauseCount} ({benchmarkData.totalPauseDuration}s)</span></div>
                        <div>Lệch Lớn / TB: <span className="text-white">{benchmarkData.maxDrift}s / {benchmarkData.averageDrift}s</span></div>
                        <div>Thay Tốc Độ: <span className="text-white">{benchmarkData.playbackRateChanges} lần</span></div>
                        <div>Thời gian Chạy Thực Tế: <span className="text-white">{benchmarkData.elapsed}s</span></div>
                        <div>Thời lượng Dự Án: <span className="text-white">{benchmarkData.projectDuration || '0.0'}s</span></div>
                        <div>Thời lượng Output: <span className="text-amber-400 font-bold">{benchmarkData.outputDuration || 'Đang đo...'}</span></div>
                        <div className="col-span-2 text-white border-t border-purple-500/10 pt-1 mt-1 font-bold">
                          Độ lệch Output - Project: <span className="text-amber-400">
                            {(!benchmarkData.outputDuration || isNaN(parseFloat(benchmarkData.outputDuration))) 
                              ? 'Not directly measurable' 
                              : `${(parseFloat(benchmarkData.outputDuration) - parseFloat(benchmarkData.projectDuration)).toFixed(1)}s`
                            }
                          </span>
                        </div>
                        <div className="col-span-2 text-gray-500 border-t border-purple-500/10 pt-1">
                          Encoded/Dropped Frames: Not directly measurable from this pipeline
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
            <button 
              onClick={() => {
                const now = Math.floor(currentTime * 10) / 10;
                const newId = subtitles.length > 0 ? Math.max(...subtitles.map(s => s.id)) + 1 : 1;
                const newSub = { id: newId, startTime: now, endTime: Math.floor((now + 3) * 10) / 10, text: 'Phụ đề mới...', x: 50, y: 85, style: 'tiktok', anim: 'bounce', fontSize: 24, rotation: 0, color: '#ffffff', bgColor: '#000000', boxWidth: 80, animSpeed: 0.5 };
                setSubtitles([...subtitles, newSub]);
                setSelectedSubId(newId);
              }} 
              className="btn-secondary text-xs cursor-pointer"
              title="Thêm phụ đề mới ngay tại mốc thời gian đang xem"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" /> Thêm Tại {Math.floor(currentTime)}s
            </button>
          </div>

          {/* Tùy chỉnh Kiểu Chữ & Vị Trí Kéo Thả Subtitle Chi Tiết Theo Thẻ */}
          <div className="flex flex-col gap-2.5 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
            {activeSub ? (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[#94a3b8] font-medium flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" /> Vị Trí Phụ Đề (Thẻ #{activeSub.id})
                  </label>
                  <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                    X: {activeSub.x !== undefined ? activeSub.x : 50}% | Y: {activeSub.y !== undefined ? activeSub.y : 85}%
                  </span>
                </div>

                {/* Bộ Nút Định Vị 9 Ô Vị Trí Thông Minh (9-Grid Alignment Selector) */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-[#64748b]">🎯 Tự động căn chỉnh 9 vị trí chuẩn:</span>
                  <div className="grid grid-cols-3 gap-1 bg-[#1a1e2b] p-1.5 rounded-xl border border-[#2b3042]">
                    {/* Hàng 1: Trên Trái - Trên Giữa - Trên Phải */}
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 3); updateSubtitle(activeSub.id, 'y', 3); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 3 && activeSub.y === 3 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ↖️ Trên Trái
                    </button>
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 50); updateSubtitle(activeSub.id, 'y', 3); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 50 && activeSub.y === 3 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ⬆️ Trên Giữa
                    </button>
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 97); updateSubtitle(activeSub.id, 'y', 3); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 97 && activeSub.y === 3 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ↗️ Trên Phải
                    </button>

                    {/* Hàng 2: Giữa Trái - Chính Giữa - Giữa Phải */}
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 3); updateSubtitle(activeSub.id, 'y', 50); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 3 && activeSub.y === 50 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ⬅️ Giữa Trái
                    </button>
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 50); updateSubtitle(activeSub.id, 'y', 50); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 50 && activeSub.y === 50 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      🎯 Chính Giữa
                    </button>
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 97); updateSubtitle(activeSub.id, 'y', 50); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 97 && activeSub.y === 50 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ➡️ Giữa Phải
                    </button>

                    {/* Hàng 3: Dưới Trái - Dưới Giữa - Dưới Phải */}
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 3); updateSubtitle(activeSub.id, 'y', 97); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 3 && activeSub.y === 97 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ↙️ Dưới Trái
                    </button>
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 50); updateSubtitle(activeSub.id, 'y', 97); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 50 && activeSub.y === 97 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ⬇️ Dưới Giữa
                    </button>
                    <button
                      onClick={() => { updateSubtitle(activeSub.id, 'x', 97); updateSubtitle(activeSub.id, 'y', 97); }}
                      className={`py-1 px-1 rounded font-medium text-[10px] cursor-pointer transition-all ${
                        activeSub.x === 97 && activeSub.y === 97 ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' : 'bg-[#12151e] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      ↘️ Dưới Phải
                    </button>
                  </div>
                </div>

                {/* Thanh trượt tinh chỉnh tọa độ X & Y % */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[10px] text-[#94a3b8]">
                      <span>Ngang X:</span>
                      <span className="font-mono text-purple-300 font-bold">{activeSub.x !== undefined ? activeSub.x : 50}%</span>
                    </div>
                    <input 
                      type="range" min="5" max="95" step="1"
                      value={activeSub.x !== undefined ? activeSub.x : 50}
                      onChange={(e) => updateSubtitle(activeSub.id, 'x', Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[10px] text-[#94a3b8]">
                      <span>Dọc Y:</span>
                      <span className="font-mono text-purple-300 font-bold">{activeSub.y !== undefined ? activeSub.y : 85}%</span>
                    </div>
                    <input 
                      type="range" min="5" max="95" step="1"
                      value={activeSub.y !== undefined ? activeSub.y : 85}
                      onChange={(e) => updateSubtitle(activeSub.id, 'y', Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Mẹo Kéo Thả Trực Tiếp */}
                <div className="flex items-center gap-1.5 text-[10px] text-pink-300 bg-pink-950/30 p-1.5 rounded-lg border border-pink-500/20 font-medium">
                  <span>✋ Mẹo: Bấm chọn thẻ phụ đề bất kỳ rồi kéo thả trực tiếp trên màn hình!</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#64748b] text-center py-2">
                Chưa chọn thẻ phụ đề nào. Vui lòng bấm "+ Thêm Tại ..." để bắt đầu.
              </p>
            )}

            {/* Bộ Mẫu Template Phụ Đề Hot Trend (CapCut / VideoShow Style) */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#2b3042]/50">
              <label className="text-xs text-[#94a3b8] font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Mẫu Phong Cách (Thẻ #{activeSub.id})
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'tiktok')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'tiktok' ? 'bg-yellow-400 text-slate-950 shadow-md ring-2 ring-yellow-300' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  🟨 TikTok Viral
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'led')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'led' ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  📟 BẢNG ĐÈN LED
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'victory')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'victory' ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  ⚡ VICTORY Neon
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'boom')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'boom' ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  💥 BOOM 3D
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'sponge')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'sponge' ? 'bg-green-700 text-white shadow-md ring-2 ring-green-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  🟩 SPONGE 3D
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'social')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'social' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  📢 LIKE & SHARE
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'style', 'custom')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-left text-[11px] cursor-pointer ${
                    (activeSub.style || 'tiktok') === 'custom' ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md ring-2 ring-pink-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  🎨 Tự Chọn Màu
                </button>
              </div>
            </div>

            {/* Bảng Chọn Màu Tự Chọn (Khi chọn Style Custom) */}
            {activeSub.style === 'custom' && (
              <div className="grid grid-cols-2 gap-2 p-2 bg-[#1a1e2b] rounded-lg border border-[#2b3042] text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#94a3b8]">Màu chữ:</span>
                  <input 
                    type="color" value={activeSub.color || '#ffffff'} 
                    onChange={(e) => updateSubtitle(activeSub.id, 'color', e.target.value)}
                    className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#94a3b8]">Màu nền:</span>
                  <input 
                    type="color" value={activeSub.bgColor || '#000000'} 
                    onChange={(e) => updateSubtitle(activeSub.id, 'bgColor', e.target.value)}
                    className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            )}

            {/* Tùy chỉnh Độ rộng khung Bảng Đèn LED (Box Width Slider) */}
            {(activeSub.style === 'led' || activeSub.anim === 'marquee') && (
              <div className="flex flex-col gap-1 p-2 bg-[#1a1e2b] rounded-lg border border-[#2b3042]">
                <div className="flex justify-between text-[11px] text-[#94a3b8]">
                  <span>📟 Độ rộng khung Đèn LED:</span>
                  <span className="font-mono text-amber-300 font-bold">{activeSub.boxWidth || 80}%</span>
                </div>
                <input 
                  type="range" min="30" max="100" step="5"
                  value={activeSub.boxWidth || 80}
                  onChange={(e) => updateSubtitle(activeSub.id, 'boxWidth', Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            )}

            {/* Tùy Chỉnh Xoay Nghiêng Chữ (Rotation Angle) */}
            <div className="flex flex-col gap-1 pt-2 border-t border-[#2b3042]/50">
              <div className="flex justify-between text-xs text-[#94a3b8]">
                <span>Xoay nghiêng chữ:</span>
                <span className="font-mono text-purple-300 font-bold">{activeSub.rotation || 0}°</span>
              </div>
              <input 
                type="range" min="-45" max="45" step="1"
                value={activeSub.rotation || 0}
                onChange={(e) => updateSubtitle(activeSub.id, 'rotation', Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Bộ Hiệu Ứng Nhảy Múa Chữ (Kinetic Animation) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#2b3042]/50">
              <label className="text-xs text-[#94a3b8] font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Hiệu Ứng Chữ (Thẻ #{activeSub.id})
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'anim', 'typewriter')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-center text-[11px] cursor-pointer ${
                    (activeSub.anim || 'bounce') === 'typewriter' ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  ⌨️ Hiện Từng Chữ
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'anim', 'marquee')}
                  className={`p-1.5 rounded-lg font-bold transition-all text-center text-[11px] cursor-pointer ${
                    (activeSub.anim || 'bounce') === 'marquee' ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-400' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  ◀️ Phải Sang Trái
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'anim', 'shake')}
                  className={`p-1.5 rounded-lg font-medium transition-all text-center text-[11px] cursor-pointer ${
                    (activeSub.anim || 'bounce') === 'shake' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  ⚡ Lắc Lư Sấm Sét
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'anim', 'bounce')}
                  className={`p-1.5 rounded-lg font-medium transition-all text-center text-[11px] cursor-pointer ${
                    (activeSub.anim || 'bounce') === 'bounce' ? 'bg-purple-600 text-white font-bold shadow' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  💥 Bounce (Nảy Chữ)
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'anim', 'fade')}
                  className={`p-1.5 rounded-lg font-medium transition-all text-center text-[11px] cursor-pointer ${
                    (activeSub.anim || 'bounce') === 'fade' ? 'bg-purple-600 text-white font-bold shadow' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  ✨ Trượt Hiện
                </button>
                <button
                  onClick={() => updateSubtitle(activeSub.id, 'anim', 'pulse')}
                  className={`p-1.5 rounded-lg font-medium transition-all text-center text-[11px] cursor-pointer ${
                    (activeSub.anim || 'bounce') === 'pulse' ? 'bg-purple-600 text-white font-bold shadow' : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  🌊 Pulse Wave
                </button>
              </div>
            </div>

            {/* Tùy Chỉnh Tốc Độ Chạy Hiệu Ứng / Chạy Chữ LED */}
            <div className="flex flex-col gap-1 p-2.5 bg-[#1a1e2b] rounded-xl border border-[#2b3042]/80 mt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94a3b8] font-medium flex items-center gap-1">
                  ⚡ Tốc độ chạy chữ:
                </span>
                <span className="font-mono text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  {activeSub.animSpeed || 0.5}x
                </span>
              </div>
              <input 
                type="range" min="0.1" max="1.5" step="0.05"
                value={activeSub.animSpeed || 0.5}
                onChange={(e) => updateSubtitle(activeSub.id, 'animSpeed', Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748b] px-0.5">
                <span>0.1x (Siêu Chậm)</span>
                <span>0.5x (Vừa Vặn)</span>
                <span>1.5x (Nhanh)</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2b3042]/50">
              <span className="text-xs text-[#64748b] font-medium">Cỡ chữ lớn nhỏ (px)</span>
              <div className="flex items-center gap-2">
                <input 
                  type="range" min="14" max="64" step="1"
                  value={activeSub.fontSize || 24}
                  onChange={(e) => updateSubtitle(activeSub.id, 'fontSize', Number(e.target.value))}
                  className="w-24 accent-purple-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-purple-300 font-bold">{activeSub.fontSize || 24}px</span>
              </div>
            </div>
          </div>

          {/* Danh sách thẻ phụ đề với công cụ tinh chỉnh nhanh */}
          <div className="flex-1 overflow-y-auto max-h-[480px] flex flex-col gap-3 pr-1">
            {subtitles.length === 0 ? (
              <p className="text-xs text-[#64748b] text-center py-6">
                Chưa có phụ đề nào. Nhấn "+ Thêm Tại ..." để bắt đầu.
              </p>
            ) : (
              subtitles.map((sub) => {
                const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
                const isSelected = selectedSubId === sub.id;
                const nowSec = Math.floor(currentTime * 10) / 10;

                return (
                  <div 
                    key={sub.id} 
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`p-3 rounded-xl border transition-all flex flex-col gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/70 border-pink-500 shadow-lg ring-2 ring-pink-500/50'
                        : isActive
                        ? 'bg-purple-950/30 border-purple-500/40'
                        : 'bg-[#12151e] border-[#2b3042] hover:border-[#3b4259]'
                    }`}
                  >
                    {/* Nhập mốc thời gian & Nút gán thời gian nhanh */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-mono">
                          {isSelected && (
                            <span className="text-[10px] font-bold bg-pink-600 text-white px-1.5 py-0.5 rounded">
                              ✏️ Đang sửa
                            </span>
                          )}
                          <input 
                            type="number" step="0.1" min="0" value={sub.startTime}
                            onChange={(e) => updateSubtitle(sub.id, 'startTime', parseFloat(e.target.value) || 0)}
                            className="w-14 input-field py-0.5 px-1 text-center font-mono text-xs"
                          />
                          <span>s ➔</span>
                          <input 
                            type="number" step="0.1" min="0" value={sub.endTime}
                            onChange={(e) => updateSubtitle(sub.id, 'endTime', parseFloat(e.target.value) || 0)}
                            className="w-14 input-field py-0.5 px-1 text-center font-mono text-xs"
                          />
                          <span>s</span>
                        </div>

                        <button 
                          onClick={() => deleteSubtitle(sub.id)}
                          className="text-red-400 hover:text-red-300 p-1 rounded transition-colors cursor-pointer"
                          title="Xóa phụ đề này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Công cụ gán mốc thời gian xem video trực tiếp */}
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          onClick={() => updateSubtitle(sub.id, 'startTime', nowSec)}
                          className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600 text-purple-300 border border-purple-500/40 font-medium transition-colors cursor-pointer"
                          title="Đặt mốc Bắt Đầu đúng giây video đang xem"
                        >
                          ⏱️ Bắt đầu: {nowSec}s
                        </button>
                        <button
                          onClick={() => updateSubtitle(sub.id, 'endTime', nowSec)}
                          className="px-2 py-0.5 rounded bg-pink-600/30 hover:bg-pink-600 text-pink-300 border border-pink-500/40 font-medium transition-colors cursor-pointer"
                          title="Đặt mốc Kết Thúc đúng giây video đang xem"
                        >
                          ⏱️ Kết thúc: {nowSec}s
                        </button>
                      </div>
                    </div>

                    <input 
                      type="text" 
                      value={sub.text}
                      onChange={(e) => updateSubtitle(sub.id, 'text', e.target.value)}
                      placeholder="Nhập nội dung phụ đề..."
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                );
              })
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

      {/* --- MODALS (LAZY LOADED) --- */}
      <React.Suspense fallback={null}>
        {isAdminModalOpen && (
          <AdminModal 
            isOpen={isAdminModalOpen}
            onClose={() => setIsAdminModalOpen(false)}
            currentUser={currentUser}
          />
        )}

        {isAuthModalOpen && (
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
        )}

        {isPaymentModalOpen && (
          <PaymentModal 
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            currentUser={currentUser}
            userData={userData}
          />
        )}

        {isFreeCoinsModalOpen && (
          <FreeCoinsModal 
            isOpen={isFreeCoinsModalOpen}
            onClose={() => setIsFreeCoinsModalOpen(false)}
            currentUser={currentUser}
            userData={userData}
          />
        )}
      </React.Suspense>
    </div>
  );
}
