import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coins, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  Gift, 
  Clock, 
  ThumbsUp, 
  ExternalLink,
  Loader2,
  Award,
  Video,
  AlertTriangle
} from 'lucide-react';
import { isUserAdmin, updateUserCoinsInDb } from '../services/authService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import confetti from 'canvas-confetti';

// Icon YouTube SVG chuẩn
const YoutubeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

// Cấu hình Kênh YouTube & Video mặc định của bạn
const YOUTUBE_CONFIG = {
  channelUrl: "https://www.youtube.com/channel/UCTH5A6CPnunCR-Iw8nvyZfw?sub_confirmation=1",
  videoUrl: "https://www.youtube.com/watch?v=UCTH5A6CPnunCR-Iw8nvyZfw",
  embedVideoId: "UCTH5A6CPnunCR-Iw8nvyZfw" 
};

export default function FreeCoinsModal({
  isOpen,
  onClose,
  currentUser,
  userData
}) {
  // Trạng thái Nhiệm vụ 1: Sub Kênh
  const [hasOpenedSubLink, setHasOpenedSubLink] = useState(false);
  const [subTimer, setSubTimer] = useState(15);
  const [subClaiming, setSubClaiming] = useState(false);

  // Trạng thái Nhiệm vụ 2: Xem Video 60s
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [watchTimer, setWatchTimer] = useState(60);
  const [watchClaiming, setWatchClaiming] = useState(false);

  // Trạng thái Nhiệm vụ 3: Like & Comment
  const [hasOpenedLikeLink, setHasOpenedLikeLink] = useState(false);
  const [likeTimer, setLikeTimer] = useState(15);
  const [likeClaiming, setLikeClaiming] = useState(false);

  const [isResetting, setIsResetting] = useState(false);

  // Đếm ngược Sub Kênh (Yêu cầu phải bấm mở tab YouTube thật trước)
  useEffect(() => {
    let timer;
    if (hasOpenedSubLink && subTimer > 0) {
      timer = setInterval(() => {
        setSubTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [hasOpenedSubLink, subTimer]);

  // Đếm ngược Xem Video (Yêu cầu bật player video thật)
  useEffect(() => {
    let timer;
    if (isPlayingVideo && watchTimer > 0) {
      timer = setInterval(() => {
        setWatchTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlayingVideo, watchTimer]);

  // Đếm ngược Like & Comment
  useEffect(() => {
    let timer;
    if (hasOpenedLikeLink && likeTimer > 0) {
      timer = setInterval(() => {
        setLikeTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [hasOpenedLikeLink, likeTimer]);

  if (!isOpen) return null;

  const claimedTasks = userData?.claimedTasks || {};

  // Admin Reset tất cả nhiệm vụ để Test lại
  const handleAdminResetTasks = async () => {
    if (!currentUser) return;
    setIsResetting(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        claimedTasks: {}
      });
      setHasOpenedSubLink(false);
      setSubTimer(15);
      setIsPlayingVideo(false);
      setWatchTimer(60);
      setHasOpenedLikeLink(false);
      setLikeTimer(15);
      setIsResetting(false);
    } catch (e) {
      console.error(e);
      setIsResetting(false);
    }
  };

  // Mở tab đăng ký kênh thật
  const handleOpenSubChannel = () => {
    window.open(YOUTUBE_CONFIG.channelUrl, "_blank");
    setHasOpenedSubLink(true);
    setSubTimer(15);
  };

  // Mở tab video để Like/Comment
  const handleOpenLikeVideo = () => {
    window.open(YOUTUBE_CONFIG.videoUrl, "_blank");
    setHasOpenedLikeLink(true);
    setLikeTimer(15);
  };

  // Nhận 50 Xu cho nhiệm vụ Đăng Ký Kênh
  const handleClaimSubReward = async () => {
    if (!currentUser || !userData || !hasOpenedSubLink || subTimer > 0) return;
    setSubClaiming(true);
    try {
      const newCoins = (userData.coins || 0) + 50;
      await updateUserCoinsInDb(currentUser.uid, newCoins);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "claimedTasks.sub_youtube": true
      });

      setSubClaiming(false);
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
    } catch (e) {
      console.error(e);
      setSubClaiming(false);
    }
  };

  // Nhận 10 Xu cho nhiệm vụ Xem Video
  const handleClaimWatchReward = async () => {
    if (!currentUser || !userData || watchTimer > 0) return;
    setWatchClaiming(true);
    try {
      const newCoins = (userData.coins || 0) + 10;
      await updateUserCoinsInDb(currentUser.uid, newCoins);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "claimedTasks.watch_video": true
      });

      setWatchClaiming(false);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
    } catch (e) {
      console.error(e);
      setWatchClaiming(false);
    }
  };

  // Nhận 10 Xu cho nhiệm vụ Like/Comment
  const handleClaimLikeReward = async () => {
    if (!currentUser || !userData || !hasOpenedLikeLink || likeTimer > 0) return;
    setLikeClaiming(true);
    try {
      const newCoins = (userData.coins || 0) + 10;
      await updateUserCoinsInDb(currentUser.uid, newCoins);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "claimedTasks.like_comment": true
      });

      setLikeClaiming(false);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
    } catch (e) {
      console.error(e);
      setLikeClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#12151e] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 text-left">
        
        {/* Nút Đóng */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[#2b3042] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề Modal */}
        <div className="flex items-center justify-between border-b border-[#2b3042] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-pink-500 flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Kiếm Xu Miễn Phí</h3>
              <p className="text-xs text-[#94a3b8]">Ủng hộ Kênh YouTube <strong className="text-red-400">LE NGOC MINH MULTIMEDIA</strong></p>
            </div>
          </div>

          {/* Nút Admin Reset Trạng Thái Để Test */}
          {isUserAdmin(userData) && (
            <button
              onClick={handleAdminResetTasks}
              disabled={isResetting}
              className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              title="Khôi phục trạng thái chưa làm nhiệm vụ để Admin test lại"
            >
              {isResetting ? <Loader2 className="w-3 h-3 animate-spin" /> : "🔄 Reset Test"}
            </button>
          )}
        </div>

        {/* Danh sách Nhiệm Vụ */}
        <div className="flex flex-col gap-4 max-h-[68vh] overflow-y-auto pr-1">

          {/* NHIỆM VỤ 1: ĐĂNG KÝ KÊNH YOUTUBE (TẶNG KHỦNG 50 XU) */}
          <div className="bg-[#161a26] p-4 rounded-xl border border-red-500/30 flex flex-col gap-3 relative overflow-hidden">
            <span className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-red-600 to-rose-600 text-white font-extrabold text-[10px] uppercase rounded-bl-xl shadow-md">
              🔥 Thưởng Khủng +50 Xu
            </span>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 shrink-0">
                <YoutubeIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">1. Đăng Ký Kênh LE NGOC MINH MULTIMEDIA (+50 Xu)</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">
                  Bắt buộc phải bấm mở link YouTube ➔ Bấm nút <strong>Đăng Ký Kênh</strong> ➔ Quay lại đây đợi kiểm tra đếm ngược để nhận 50 Xu.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-[#2b3042]">
              {claimedTasks.sub_youtube ? (
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 py-1">
                  <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành & Nhận 50 Xu thành công!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Nút 1: Mở trang Kênh YouTube thật */}
                  <button
                    onClick={handleOpenSubChannel}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <YoutubeIcon className="w-4 h-4" />
                    <span>Mở Trang YouTube Để Đăng Ký Kênh</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {/* Nút 2: Nhận Xu sau khi đã mở tab YouTube và đếm ngược */}
                  {hasOpenedSubLink && (
                    subTimer > 0 ? (
                      <div className="w-full py-2 px-3 rounded-xl bg-[#2b3042] text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 border border-amber-500/30">
                        <Clock className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Đang kiểm tra trạng thái Đăng ký... ({subTimer}s)</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleClaimSubReward}
                        disabled={subClaiming}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 animate-pulse"
                      >
                        {subClaiming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Award className="w-4 h-4 text-yellow-300" />
                            <span>Xác Nhận Đã Đăng Ký & Nhận +50 Xu</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* NHIỆM VỤ 2: TRÌNH PHÁT VIDEO THẬT YOUTUBE 60s (+10 XU) */}
          <div className="bg-[#161a26] p-4 rounded-xl border border-purple-500/30 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">2. Xem Video Kênh YouTube 60 Giây (+10 Xu)</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Phát video ngay trên màn hình bên dưới và xem đủ 60 giây để nhận thưởng 10 Xu.
                </p>
              </div>
            </div>

            {claimedTasks.watch_video ? (
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 py-1">
                <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành nhận 10 Xu hôm nay!
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-2 border-t border-[#2b3042]">
                {/* Trình Xem Video YouTube thật dạng Embed IFrame */}
                {isPlayingVideo ? (
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#2b3042] bg-black shadow-lg">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/videoseries?list=UUTH5A6CPnunCR-Iw8nvyZfw&autoplay=1`}
                        title="Video Kênh LE NGOC MINH MULTIMEDIA"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>

                    <div className="w-full bg-[#2b3042] h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000"
                        style={{ width: `${((60 - watchTimer) / 60) * 100}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-purple-300 font-mono flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        Đang xem video...
                      </span>
                      <span className="font-bold text-amber-400 font-mono text-sm">Còn {watchTimer} Giây</span>
                    </div>

                    {watchTimer === 0 && (
                      <button
                        onClick={handleClaimWatchReward}
                        disabled={watchClaiming}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 animate-bounce mt-1"
                      >
                        {watchClaiming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Award className="w-4 h-4 text-yellow-300" />
                            <span>Nhận Ngay +10 Xu Xem Video</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPlayingVideo(true)}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Mở Video YouTube & Bắt Đầu Xem (60s)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* NHIỆM VỤ 3: LIKE & BÌNH LUẬN VIDEO (+10 XU) */}
          <div className="bg-[#161a26] p-4 rounded-xl border border-blue-500/30 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                <ThumbsUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">3. Like & Bình Luận Video Kênh (+10 Xu)</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Mở bài viết video trên YouTube, bấm Thích và để lại 1 bình luận ủng hộ kênh.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-[#2b3042]">
              {claimedTasks.like_comment ? (
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 py-1">
                  <CheckCircle2 className="w-4 h-4" /> Đã nhận 10 Xu hôm nay
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleOpenLikeVideo}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Mở Video Trên YouTube Để Like & Bình Luận</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {hasOpenedLikeLink && (
                    likeTimer > 0 ? (
                      <div className="w-full py-2 px-3 rounded-xl bg-[#2b3042] text-blue-300 font-semibold text-xs flex items-center justify-center gap-2 border border-blue-500/30">
                        <Clock className="w-4 h-4 animate-spin text-blue-400" />
                        <span>Đang đếm ngược kiểm tra Like/Comment... ({likeTimer}s)</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleClaimLikeReward}
                        disabled={likeClaiming}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 animate-pulse"
                      >
                        {likeClaiming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Award className="w-4 h-4 text-yellow-300" />
                            <span>Xác Nhận Đã Like/Comment & Nhận +10 Xu</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
