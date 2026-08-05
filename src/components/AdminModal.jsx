import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Coins, 
  ShieldCheck, 
  User, 
  Check, 
  Loader2, 
  RefreshCw,
  Gift
} from 'lucide-react';
import { getAllUsers, updateUserCoinsInDb, isUserAdmin } from '../services/authService';

export default function AdminModal({ isOpen, onClose, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUid, setEditingUid] = useState(null);
  const [coinInput, setCoinInput] = useState('');
  const [savingUid, setSavingUid] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      // Sap xep: Admin len dau, sau do theo ngay tao
      data.sort((a, b) => {
        if (isUserAdmin(a) && !isUserAdmin(b)) return -1;
        if (!isUserAdmin(a) && isUserAdmin(b)) return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      setUsers(data);
    } catch (err) {
      console.error(err);
      setStatusMsg('Không thể tải danh sách người dùng. Kiểm tra kết nối Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCoins = async (targetUid) => {
    const val = parseInt(coinInput, 10);
    if (isNaN(val) || val < 0) {
      alert('Vui lòng nhập số xu hợp lệ (>= 0)');
      return;
    }

    setSavingUid(targetUid);
    try {
      await updateUserCoinsInDb(targetUid, val);
      setUsers(users.map(u => u.uid === targetUid ? { ...u, coins: val } : u));
      setEditingUid(null);
      setStatusMsg(`Đã cập nhật số xu cho tài khoản thành ${val} Xu!`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e) {
      alert('Lỗi cập nhật số xu: ' + e.message);
    } finally {
      setSavingUid(null);
    }
  };

  const handleQuickAdd = async (userObj, amount) => {
    const newTotal = (userObj.coins || 0) + amount;
    setSavingUid(userObj.uid);
    try {
      await updateUserCoinsInDb(userObj.uid, newTotal);
      setUsers(users.map(u => u.uid === userObj.uid ? { ...u, coins: newTotal } : u));
      setStatusMsg(`Đã cộng thêm +${amount} Xu cho ${userObj.displayName}!`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e) {
      alert('Lỗi nạp xu nhanh: ' + e.message);
    } finally {
      setSavingUid(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#12151e] border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3042] bg-[#1a1e2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                Trang Quản Trị Hệ Thống (Admin Panel)
              </h2>
              <p className="text-xs text-[#94a3b8]">Quản lý người dùng, duyệt lượt miễn phí & cấp phát Xu</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[#2b3042] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH & REFRESH BAR */}
        <div className="p-4 border-b border-[#2b3042] bg-[#161a26] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input 
              type="text" 
              placeholder="Tìm theo tên hoặc email người dùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#12151e] border border-[#2b3042] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-3">
            {statusMsg && (
              <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 animate-pulse">
                {statusMsg}
              </span>
            )}
            <button 
              onClick={fetchUsers}
              disabled={loading}
              className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Tải Lại</span>
            </button>
          </div>
        </div>

        {/* USER LIST TABLE */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#94a3b8]">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-xs font-medium">Đang nạp danh sách người dùng từ Firestore...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-[#64748b] text-xs">
              Chưa tìm thấy người dùng nào phù hợp.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredUsers.map((u) => {
                const isAdmin = isUserAdmin(u);
                const isEditing = editingUid === u.uid;

                return (
                  <div 
                    key={u.uid}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isAdmin 
                        ? 'bg-purple-950/20 border-purple-500/30' 
                        : 'bg-[#161a26] border-[#2b3042] hover:border-[#3b4259]'
                    }`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3.5 min-w-[240px]">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full border border-purple-500/40 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-sm">
                          {(u.displayName || 'U')[0].toUpperCase()}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-white">{u.displayName || 'Người dùng'}</h4>
                          {isAdmin && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#94a3b8] font-mono">{u.email}</p>
                      </div>
                    </div>

                    {/* Stats: Free Daily & Current Coins */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="bg-[#12151e] px-3 py-1.5 rounded-lg border border-[#2b3042] text-center">
                        <span className="text-[#64748b] block text-[10px]">Free hôm nay</span>
                        <span className="font-mono text-emerald-400 font-bold">{u.dailyFreeExports || 0} lượt</span>
                      </div>

                      <div className="bg-[#12151e] px-3 py-1.5 rounded-lg border border-amber-500/30 text-center">
                        <span className="text-[#64748b] block text-[10px]">Số Xu hiện có</span>
                        <span className="font-mono text-amber-400 font-bold text-sm">🪙 {u.coins || 0} Xu</span>
                      </div>
                    </div>

                    {/* Actions: Add / Edit Coins */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            min="0"
                            value={coinInput}
                            onChange={(e) => setCoinInput(e.target.value)}
                            placeholder="Số xu mới"
                            className="w-24 bg-[#12151e] border border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                          />
                          <button 
                            onClick={() => handleSaveCoins(u.uid)}
                            disabled={savingUid === u.uid}
                            className="btn-primary py-1 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500"
                          >
                            {savingUid === u.uid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={() => setEditingUid(null)}
                            className="btn-secondary py-1 px-2 text-xs"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleQuickAdd(u, 10)}
                            disabled={savingUid === u.uid}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all"
                            title="Nạp nhanh 10 xu"
                          >
                            +10 Xu
                          </button>

                          <button 
                            onClick={() => handleQuickAdd(u, 50)}
                            disabled={savingUid === u.uid}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-all"
                            title="Nạp nhanh 50 xu"
                          >
                            +50 Xu
                          </button>

                          <button 
                            onClick={() => {
                              setEditingUid(u.uid);
                              setCoinInput(String(u.coins || 0));
                            }}
                            className="btn-secondary py-1 px-2.5 text-xs"
                          >
                            Sửa Xu
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="p-4 border-t border-[#2b3042] bg-[#1a1e2b] flex items-center justify-between text-xs text-[#94a3b8]">
          <span>Tổng số người dùng: <strong className="text-white">{users.length}</strong></span>
          <span>Admin cao nhất: <strong className="text-purple-300">admin@gmail.com</strong></span>
        </div>

      </div>
    </div>
  );
}
