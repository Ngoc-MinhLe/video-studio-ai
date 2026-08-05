import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coins, 
  Sparkles, 
  QrCode, 
  Copy, 
  Check, 
  ArrowRight, 
  ShieldCheck, 
  Loader2, 
  CheckCircle2,
  Building2,
  User,
  CreditCard,
  Zap
} from 'lucide-react';
import { updateUserCoinsInDb } from '../services/authService';
import confetti from 'canvas-confetti';

// Danh sách các gói nạp xu
const RECHARGE_PACKAGES = [
  { id: 'pkg_10k', amount: 10000, coins: 50, bonus: '+10 Xu Tặng', popular: false },
  { id: 'pkg_20k', amount: 20000, coins: 120, bonus: '+20 Xu Tặng', popular: true },
  { id: 'pkg_50k', amount: 50000, coins: 350, bonus: '+100 Xu Tặng', popular: false },
  { id: 'pkg_100k', amount: 100000, coins: 800, bonus: '+300 Xu Tặng', popular: false },
];

// Cấu hình ngân hàng mặc định (Có thể thay đổi số tài khoản & tên tài khoản của bạn tại đây)
const DEFAULT_BANK_CONFIG = {
  bankId: 'MB', // MBBank (Có thể đổi thành VCB, TCB, ACB, VPB, TPB...)
  bankName: 'Ngân hàng MBBank',
  accountNo: '0988888888', // <-- Số tài khoản ngân hàng của bạn
  accountName: 'LE NGOC MINH', // <-- Tên chủ tài khoản
};

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  currentUser,
  userData 
}) {
  const [selectedPkg, setSelectedPkg] = useState(RECHARGE_PACKAGES[1]);
  const [step, setStep] = useState('select'); // 'select' | 'qr' | 'success'
  const [orderId, setOrderId] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Khởi tạo mã đơn hàng duy nhất khi mở màn hình QR
  useEffect(() => {
    if (step === 'qr') {
      const randomCode = Math.floor(100000 + Math.random() * 900000);
      const memo = `VS ${randomCode}`;
      setOrderId(memo);
    }
  }, [step]);

  if (!isOpen) return null;

  // Sao chép thông tin vào bộ nhớ tạm
  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // URL tạo ảnh VietQR tự động theo chuẩn Napas Quốc Gia
  const vietQrUrl = `https://img.vietqr.io/image/${DEFAULT_BANK_CONFIG.bankId}-${DEFAULT_BANK_CONFIG.accountNo}-compact2.png?amount=${selectedPkg.amount}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(DEFAULT_BANK_CONFIG.accountName)}`;

  // Giả lập / Xử lý Nạp Xu Tự Động khi nhận được tín hiệu chuyển khoản Webhook thành công
  const handleSimulateWebhookPayment = async () => {
    if (!currentUser || !userData) return;
    setIsVerifying(true);
    
    setTimeout(async () => {
      try {
        const newTotalCoins = (userData.coins || 0) + selectedPkg.coins;
        await updateUserCoinsInDb(currentUser.uid, newTotalCoins);
        
        setIsVerifying(false);
        setStep('success');

        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.5 }
        });
      } catch (err) {
        console.error("Lỗi cộng xu:", err);
        setIsVerifying(false);
        alert("Lỗi cập nhật xu: " + err.message);
      }
    }, 1500);
  };

  const handleResetModal = () => {
    setStep('select');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#12151e] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 text-left">
        
        {/* Nút Đóng */}
        <button 
          onClick={handleResetModal}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[#2b3042] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'select' && (
          /* MÀN HÌNH 1: CHỌN GÓI NẠP XU */
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-[#2b3042] pb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Coins className="w-6 h-6 text-slate-950 font-bold" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Nạp Xu Tự Động Qua Ngân Hàng</h3>
                <p className="text-xs text-[#94a3b8]">Chọn gói nạp xu nâng cao để tiếp tục xuất video không giới hạn</p>
              </div>
            </div>

            {/* Danh sách gói nạp */}
            <div className="grid grid-cols-2 gap-3">
              {RECHARGE_PACKAGES.map((pkg) => {
                const isSelected = selectedPkg.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPkg(pkg)}
                    className={`relative cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-purple-600/15 border-purple-500 shadow-lg shadow-purple-500/10'
                        : 'bg-[#161a26] border-[#2b3042] hover:border-purple-500/50'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 right-3 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm">
                        Phổ biến nhất
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-lg">
                      <Coins className="w-5 h-5" />
                      <span>{pkg.coins} Xu</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-semibold">{pkg.bonus}</span>
                    <div className="text-sm font-bold text-white border-t border-[#2b3042] pt-2 mt-1">
                      {pkg.amount.toLocaleString('vi-VN')} VNĐ
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Nút Chuyển sang Màn hình Mã QR */}
            <button
              onClick={() => setStep('qr')}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Tạo Mã QR Ngân Hàng ({selectedPkg.amount.toLocaleString('vi-VN')}đ)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'qr' && (
          /* MÀN HÌNH 2: QUÉT MÃ QR VIETQR CHUYỂN KHOẢN NGÂN HÀNG */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#2b3042] pb-3">
              <button 
                onClick={() => setStep('select')}
                className="text-xs text-purple-400 hover:underline flex items-center gap-1"
              >
                ← Chọn lại gói nạp
              </button>
              <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Hệ thống nhận tiền tự động 24/7</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Ảnh Mã VietQR Tự Động */}
              <div className="flex flex-col items-center justify-center bg-white p-3 rounded-2xl shadow-xl border border-slate-200">
                <img 
                  src={vietQrUrl} 
                  alt="Mã VietQR Ngân Hàng" 
                  className="w-full max-w-[200px] h-auto object-contain rounded-lg"
                />
                <span className="text-[10px] text-slate-500 font-bold mt-1 tracking-wider uppercase">Quét mã bằng App Ngân Hàng / MoMo</span>
              </div>

              {/* Thông tin tài khoản & Mã đơn hàng */}
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="bg-[#161a26] p-2.5 rounded-xl border border-[#2b3042] flex flex-col gap-1">
                  <span className="text-[11px] text-[#64748b]">Ngân hàng nhận:</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" />
                    {DEFAULT_BANK_CONFIG.bankName}
                  </span>
                </div>

                <div className="bg-[#161a26] p-2.5 rounded-xl border border-[#2b3042] flex justify-between items-center">
                  <div>
                    <span className="text-[11px] text-[#64748b] block">Số tài khoản:</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">{DEFAULT_BANK_CONFIG.accountNo}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(DEFAULT_BANK_CONFIG.accountNo, 'acc')}
                    className="p-1.5 rounded-lg bg-[#2b3042] hover:bg-purple-600 text-white transition-colors"
                    title="Sao chép số tài khoản"
                  >
                    {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="bg-[#161a26] p-2.5 rounded-xl border border-[#2b3042] flex justify-between items-center">
                  <div>
                    <span className="text-[11px] text-[#64748b] block">Chủ tài khoản:</span>
                    <span className="font-bold text-white uppercase">{DEFAULT_BANK_CONFIG.accountName}</span>
                  </div>
                </div>

                <div className="bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/40 flex justify-between items-center">
                  <div>
                    <span className="text-[11px] text-purple-300 font-semibold block">Nội dung chuyển khoản (bắt buộc):</span>
                    <span className="font-mono font-bold text-pink-400 text-base">{orderId}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(orderId, 'memo')}
                    className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-md"
                    title="Sao chép nội dung"
                  >
                    {copiedField === 'memo' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Trạng thái lắng nghe biến động ngân hàng tự động */}
            <div className="bg-[#161a26] p-3 rounded-xl border border-[#2b3042] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-[#94a3b8]">Đang tự động kiểm tra biến động tiền về...</span>
              </div>

              {/* Nút Giả lập Webhook (Dành cho chạy thử nghiệm lập tức) */}
              <button
                onClick={handleSimulateWebhookPayment}
                disabled={isVerifying}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-md flex items-center gap-1 transition-all cursor-pointer shrink-0"
                title="Bấm vào đây để chạy thử nghiệm tín hiệu Ngân hàng tự động cộng xu"
              >
                {isVerifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                    <span>Thử nghiệm Tiền Về</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          /* MÀN HÌNH 3: THÔNG BÁO NẠP XU THÀNH CÔNG */
          <div className="flex flex-col items-center text-center gap-4 py-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>

            <div>
              <h3 className="font-bold text-xl text-white">Nạp Xu Thành Công!</h3>
              <p className="text-xs text-[#94a3b8] mt-1.5">
                Hệ thống ngân hàng đã xác nhận và cộng thành công <strong className="text-amber-400 font-bold">{selectedPkg.coins} Xu</strong> vào tài khoản của bạn.
              </p>
            </div>

            <div className="w-full bg-[#161a26] p-3.5 rounded-xl border border-[#2b3042] flex justify-between items-center text-xs font-mono">
              <span className="text-[#94a3b8]">Số dư Xu hiện tại:</span>
              <span className="font-bold text-amber-400 text-base flex items-center gap-1">
                <Coins className="w-4 h-4" />
                {(userData?.coins || 0)} Xu
              </span>
            </div>

            <button
              onClick={handleResetModal}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
            >
              Hoàn Tất & Tiếp Tục Xuất Video
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
