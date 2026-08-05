import React, { useState } from 'react';
import { 
  X, 
  Coins, 
  Sparkles, 
  Gift, 
  ShieldCheck, 
  AlertCircle, 
  Loader2,
  ExternalLink
} from 'lucide-react';
import { signInWithGoogle } from '../services/authService';

const YoutubeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function AuthModal({ 
  isOpen, 
  onClose, 
  modalType = 'login', // 'login' | 'insufficient_coins'
  onLoginSuccess 
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const userData = await signInWithGoogle();
      if (onLoginSuccess) onLoginSuccess(userData);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Không thể đăng nhập Google. Vui lòng kiểm tra lại cửa sổ popup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#12151e] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden p-6">
        
        {/* Nút Đóng */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[#2b3042] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {modalType === 'login' ? (
          /* MODAL ĐĂNG NHẬP GOOGLE */
          <div className="flex flex-col items-center text-center gap-5 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-600/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <div>
              <h3 className="font-bold text-xl text-white">Yêu Cầu Đăng Nhập</h3>
              <p className="text-xs text-[#94a3b8] mt-1.5 leading-relaxed">
                Đăng nhập để nhận ngay <strong className="text-emerald-400">2 lượt xuất video miễn phí mỗi ngày</strong> + <strong className="text-amber-400">20 Xu chào mừng</strong>!
              </p>
            </div>

            {/* Quyền lợi tài khoản */}
            <div className="w-full bg-[#1a1e2b] p-3.5 rounded-xl border border-[#2b3042] flex flex-col gap-2.5 text-left text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-medium">
                <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Miễn phí 2 lượt xuất video mỗi ngày (tự động làm mới)</span>
              </div>
              <div className="flex items-center gap-2 text-amber-300 font-medium">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Tặng ngay 20 Xu tích lũy khi tạo tài khoản</span>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30">
                {errorMsg}
              </p>
            )}

            {/* Nút Đăng nhập Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Đăng Nhập Bằng Google</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* MODAL THÔNG BÁO KHÔNG ĐỦ XU */
          <div className="flex flex-col items-center text-center gap-5 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <Coins className="w-8 h-8 text-amber-400" />
            </div>

            <div>
              <h3 className="font-bold text-xl text-white">Không Đủ Xu Render</h3>
              <p className="text-xs text-[#94a3b8] mt-1.5 leading-relaxed">
                Hôm nay bạn đã dùng hết <strong className="text-emerald-400">2 lượt xuất miễn phí</strong> và tài khoản không đủ <strong className="text-amber-400">5 Xu</strong> để render tiếp.
              </p>
            </div>

            <div className="w-full bg-[#1a1e2b] p-4 rounded-xl border border-[#2b3042] text-xs text-[#94a3b8] text-left flex flex-col gap-2">
              <p className="font-semibold text-white">💡 Làm sao để có thêm Xu?</p>
              <p>• Quay lại vào ngày mai để tự động nhận thêm <strong>2 lượt xuất miễn phí mới</strong>.</p>
              <p>• Hoặc liên hệ Admin qua kênh YouTube <strong>LE NGOC MINH MULTIMEDIA</strong> để được hỗ trợ cấp thêm xu!</p>
            </div>

            <a 
              href="https://www.youtube.com/channel/UCTH5A6CPnunCR-Iw8nvyZfw?sub_confirmation=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span>LIÊN HỆ ADMIN CẤP XU</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
