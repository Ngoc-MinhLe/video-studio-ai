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
  Award
} from 'lucide-react';
import { updateUserCoinsInDb } from '../services/authService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import confetti from 'canvas-confetti';

// Icon YouTube SVG sắc nét
const YoutubeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function FreeCoinsModal({
  isOpen,
  onClose,
  currentUser,
  userData
}) {
  // Trạng thái đếm ngược & Nhiệm vụ
  const [subCountdown, setSubCountdown] = useState(0);
  const [isSubClick, setIsSubClick] = useState(false);
  const [subClaiming, setSubClaiming] = useState(false);

  const [watchTimer, setWatchTimer] = useState(60);
  const [isWatching, setIsWatching] = useState(false);
  const [watchClaiming, setWatchClaiming] = useState(false);

  const [likeCountdown, setLikeCountdown] = useState(0);
  const [isLikeClick, setIsLikeClick] = useState(false);
  const [likeClaiming, setLikeClaiming] = useState(false);

  // Đếm ngược Đăng ký Kênh (10s)
  useEffect(() => {
    let timer;
    if (isSubClick && subCountdown > 0) {
      timer = setInterval(() => {
        setSubCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSubClick, subCountdown]);

  // Đếm ngược Xem Video (60s)
  useEffect(() => {
    let timer;
    if (isWatching && watchTimer > 0) {
      timer = setInterval(() => {
        setWatchTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isWatching, watchTimer]);

  // Đếm ngược Like & Comment (15s)
  useEffect(() => {
    let timer;
    if (isLikeClick && likeCountdown > 0) {
      timer = setInterval(() => {
        setLikeCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLikeClick, likeCountdown]);

  if (!isOpen) return null;

  const claimedTasks = userData?.claimedTasks || {};

  // Xử lý khi bấm Nút Đăng Ký Kênh YouTube
  const handleStartSubTask = () => {
    window.open(
      "https://www.youtube.com/channel/UCTH5A6CPnunCR-Iw8nvyZfw?sub_confirmation=1",
      "_blank"
    );
    setIsSubClick(true);
    setSubCountdown(10);
  };

  // Nhận 50 Xu cho nhiệm vụ Đăng Ký Kênh
  const handleClaimSubReward = async () => {
    if (!currentUser || !userData) return;
    setSubClaiming(true);
    try {
      const newCoins = (userData.coins || 0) + 50;
      await updateUserCoinsInDb(currentUser.uid, newCoins);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "claimedTasks.sub_youtube": true
      });

      setSubClaiming(false);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } catch (e) {
      console.error(e);
      setSubClaiming(false);
    }
  };

  // Nhận 10 Xu cho nhiệm vụ Xem Video 60s
  const handleClaimWatchReward = async () => {
    if (!currentUser || !userData) return;
    setWatchClaiming(true);
    try {
      const newCoins = (userData.coins || 0) + 10;
      await updateUserCoinsInDb(currentUser.uid, newCoins);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "claimedTasks.watch_video": true
      });

      setWatchClaiming(false);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (e) {
      console.error(e);
      setWatchClaiming(false);
    }
  };

  // Nhận 10 Xu cho nhiệm vụ Like/Comment
  const handleStartLikeTask = () => {
    window.open(
      "https://www.youtube.com/channel/UCTH5A6CPnunCR-Iw8nvyZfw",
      "_blank"
    );
    setIsLikeClick(true);
    setLikeCountdown(15);
  };

  const handleClaimLikeReward = async () => {
    if (!currentUser || !userData) return;
    setLikeClaiming(true);
    try {
      const newCoins = (userData.coins || 0) + 10;
      await updateUserCoinsInDb(currentUser.uid, newCoins);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        "claimedTasks.like_comment": true
      });

      setLikeClaiming(false);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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
        <div className="flex items-center gap-3 border-b border-[#2b3042] pb-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-pink-500 flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Kiếm Xu Miễn Phí</h3>
            <p className="text-xs text-[#94a3b8]">Ủng hộ Kênh YouTube <strong className="text-red-400">LE NGOC MINH MULTIMEDIA</strong> để nhận Xu xuất video miễn phí!</p>
          </div>
        </div>

        {/* Danh sách 3 Nhiệm Vụ */}
        <div className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto pr-1">

          {/* NHIỆM VỤ 1: ĐĂNG KÝ KÊNH (TẶNG KHỦNG 50 XU) */}
          <div className="bg-[#161a26] p-4 rounded-xl border border-red-500/30 flex flex-col gap-3 relative overflow-hidden">
            <span className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-red-600 to-rose-600 text-white font-extrabold text-[10px] uppercase rounded-bl-xl shadow-md">
              🔥 Thưởng Khủng +50 Xu
            </span>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 shrink-0">
                <YoutubeIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">1. Đăng Ký Kênh YouTube (+50 Xu)</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Bấm Đăng Ký kênh LE NGOC MINH MULTIMEDIA để nhận ngay 50 Xu (Xuất được 10 Video miễn phí).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2b3042]">
              {claimedTasks.sub_youtube ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành & Nhận 50 Xu
                </span>
              ) : !isSubClick ? (
                <button
                  onClick={handleStartSubTask}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <YoutubeIcon className="w-4 h-4" />
                  <span>Đăng Ký Kênh Để Nhận +50 Xu</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : subCountdown > 0 ? (
                <div className="w-full py-2 px-3 rounded-xl bg-[#2b3042] text-amber-300 font-semibold text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Vui lòng bấm Đăng ký kênh... ({subCountdown}s)</span>
                </div>
              ) : (
                <button
                  onClick={handleClaimSubReward}
                  disabled={subClaiming}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {subClaiming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-yellow-300" />
                      <span>Nhận Ngay +50 Xu Thưởng</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* NHIỆM VỤ 2: XEM VIDEO HƯỚNG DẪN 60 GiÂY (+10 XU) */}
          <div className="bg-[#161a26] p-4 rounded-xl border border-purple-500/30 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">2. Xem Video Hướng Dẫn 60s (+10 Xu)</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Mở và xem video đếm ngược đủ 60 giây để nhận thưởng 10 Xu làm mới mỗi ngày.
                </p>
              </div>
            </div>

            {/* Trình Xem Video hoặc Đếm Ngược */}
            {claimedTasks.watch_video ? (
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-4 h-4" /> Đã nhận 10 Xu hôm nay (Reset vào ngày mai)
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1 border-t border-[#2b3042]">
                {!isWatching ? (
                  <button
                    onClick={() => setIsWatching(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Bắt Đầu Xem Video (60 Giây)</span>
                  </button>
                ) : watchTimer > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="w-full bg-[#2b3042] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000"
                        style={{ width: `${((60 - watchTimer) / 60) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-purple-300 font-mono">Đang xem video...</span>
                      <span className="font-bold text-amber-400 font-mono">Còn {watchTimer} Giây</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleClaimWatchReward}
                    disabled={watchClaiming}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    {watchClaiming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Award className="w-4 h-4 text-yellow-300" />
                        <span>Nhận Ngay +10 Xu</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* NHIỆM VỤ 3: LIKE & BÌNH LUẬN VIDEO YOUTUBE (+10 XU) */}
          <div className="bg-[#161a26] p-4 rounded-xl border border-blue-500/30 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                <ThumbsUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">3. Like & Bình Luận Video (+10 Xu)</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Mở bài viết video YouTube, bấm Thích và để lại 1 bình luận ủng hộ kênh.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2b3042]">
              {claimedTasks.like_comment ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã nhận 10 Xu hôm nay
                </span>
              ) : !isLikeClick ? (
                <button
                  onClick={handleStartLikeTask}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Mở Video & Like/Comment</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : likeCountdown > 0 ? (
                <div className="w-full py-2 px-3 rounded-xl bg-[#2b3042] text-blue-300 font-semibold text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Đang đếm ngược... ({likeCountdown}s)</span>
                </div>
              ) : (
                <button
                  onClick={handleClaimLikeReward}
                  disabled={likeClaiming}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {likeClaiming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-yellow-300" />
                      <span>Nhận Ngay +10 Xu</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
