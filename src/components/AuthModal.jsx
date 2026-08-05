import React, { useState } from 'react';
import { 
  X, 
  Coins, 
  Sparkles, 
  Gift, 
  Loader2,
  Mail,
  Lock,
  LogIn
} from 'lucide-react';
import { signInWithGoogle, signInWithEmail } from '../services/authService';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  modalType = 'login', // 'login' | 'insufficient_coins'
  onLoginSuccess,
  onOpenPayment,
  onOpenFreeCoins
}) {
  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'google'
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const userData = await signInWithEmail(email, password);
      if (onLoginSuccess) onLoginSuccess(userData);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Không thể đăng nhập bằng Email này.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const userData = await signInWithGoogle();
      if (onLoginSuccess) onLoginSuccess(userData);
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Cửa sổ Google Popup bị đóng hoặc bị trình duyệt Cốc Cốc ngắt kết nối. Vui lòng bấm Đăng Nhập lại hoặc dùng Đăng Nhập Email.');
      } else {
        setErrorMsg(err.message || 'Không thể đăng nhập Google.');
      }
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
          /* MODAL ĐĂNG NHẬP (EMAIL/PASSWORD VÀ GOOGLE) */
          <div className="flex flex-col items-center text-center gap-4 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-600/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>

            <div>
              <h3 className="font-bold text-xl text-white">Yêu Cầu Đăng Nhập</h3>
              <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                Đăng nhập để nhận <strong className="text-emerald-400">2 lượt xuất video miễn phí/ngày</strong> + <strong className="text-amber-400">20 Xu chào mừng</strong>!
              </p>
            </div>

            {/* Chuyển đổi phương thức đăng nhập */}
            <div className="grid grid-cols-2 w-full bg-[#1a1e2b] p-1 rounded-xl border border-[#2b3042] text-xs">
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`py-1.5 rounded-lg font-semibold transition-all ${
                  authMethod === 'email'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                ✉️ Email / Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('google')}
                className={`py-1.5 rounded-lg font-semibold transition-all ${
                  authMethod === 'google'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                🌐 Google Account
              </button>
            </div>

            {errorMsg && (
              <div className="w-full text-xs text-red-300 bg-red-500/10 p-3 rounded-xl border border-red-500/30 text-left leading-relaxed">
                ⚠️ {errorMsg}
              </div>
            )}

            {authMethod === 'email' ? (
              /* FORM ĐĂNG NHẬP BẰNG EMAIL */
              <form onSubmit={handleEmailLogin} className="w-full flex flex-col gap-3 text-left">
                <div>
                  <label className="text-xs text-[#94a3b8] mb-1 block font-medium">Email tài khoản</label>
                  <div className="flex items-center gap-2 bg-[#161a26] border border-[#2b3042] rounded-xl px-3 py-2 focus-within:border-purple-500 transition-colors">
                    <Mail className="w-4 h-4 text-[#64748b] shrink-0" />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@gmail.com"
                      className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#94a3b8] mb-1 block font-medium">Mật khẩu</label>
                  <div className="flex items-center gap-2 bg-[#161a26] border border-[#2b3042] rounded-xl px-3 py-2 focus-within:border-purple-500 transition-colors">
                    <Lock className="w-4 h-4 text-[#64748b] shrink-0" />
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đã đặt trên Firebase..."
                      className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Đăng Nhập</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* NÚT ĐĂNG NHẬP GOOGLE */
              <div className="w-full flex flex-col gap-3 py-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-xl transition-all flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            )}
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
              <p>• Nạp Xu tự động qua Ngân Hàng VietQR (Nhận xu ngay sau 3 giây).</p>
              <p>• Hoặc Kiếm Xu Miễn Phí bằng cách Đăng ký Kênh & Xem Video.</p>
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => {
                  onClose();
                  if (onOpenPayment) onOpenPayment();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Coins className="w-4 h-4" />
                <span>NẠP XU QUA NGÂN HÀNG VIETQR</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenFreeCoins) onOpenFreeCoins();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Gift className="w-4 h-4" />
                <span>KIẾM XU FREE (SUB KÊNH +50 XU)</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
