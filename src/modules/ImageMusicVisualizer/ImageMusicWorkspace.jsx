import React from 'react';
import { 
  Upload, Image, Music, Disc, Activity, Sparkles, Sliders, Volume2, 
  Trash2, Plus, Zap, RefreshCw, ZoomIn, Eye, Play, Pause, Layers, Maximize, Move, Sparkle
} from 'lucide-react';

export default function ImageMusicWorkspace({
  bgImage,
  handleBgImageUpload,
  removeBgImage,
  bgEffect,
  setBgEffect,
  bgFit = 'cover',
  setBgFit,
  bgZoom = 100,
  setBgZoom,
  bgOffsetX = 0,
  setBgOffsetX,
  bgOffsetY = 0,
  setBgOffsetY,
  bgMirrorBlur = true,
  setBgMirrorBlur,
  visualizerType,
  setVisualizerType,
  audioFile,
  handleAudioUpload,
  removeAudioTrack,
  audioVolume,
  setAudioVolume,
  subtitles,
  selectedSubId,
  setSelectedSubId,
  updateSubtitle,
  deleteSubtitle,
  activeSub,
  aspectRatio,
  setAspectRatio
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Cột 1: Quản Lý Ảnh Nền, Hiệu Ứng & Audio Track */}
      <div className="flex flex-col gap-4 bg-[#0d1017] p-4 rounded-2xl border border-[#1e2333] shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#e2e8f0] flex items-center gap-2">
            <Image className="w-4 h-4 text-emerald-400" /> 1. Ảnh Nền & Căn Chỉnh
          </h2>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
            ⚡ GPU Render Siêu Tốc
          </span>
        </div>

        {/* 1. Tải Ảnh Nền (Background Image) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center justify-between">
            <span>Tải Ảnh Nền (JPG, PNG):</span>
            {bgImage && <span className="text-[10px] text-emerald-400 font-bold">Đã chọn ảnh</span>}
          </label>

          {bgImage ? (
            <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 group h-32 bg-black">
              <img src={bgImage.url} alt="Background Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                <button 
                  onClick={removeBgImage}
                  className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Tháo Ảnh
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/30 hover:border-emerald-500 bg-[#12151e] hover:bg-[#181d2a] p-5 rounded-xl cursor-pointer transition-all">
              <Image className="w-7 h-7 text-emerald-400 mb-1" />
              <span className="text-xs font-bold text-emerald-300">Nạp Ảnh Nền (JPG, PNG)</span>
              <span className="text-[10px] text-[#64748b]">Tỷ lệ 16:9, 9:16 hoặc 1:1</span>
              <input type="file" accept="image/*" onChange={handleBgImageUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* 2. Hiệu Ứng Gương Kính Phủ Mờ Lề Dư (Blurred Mirror Background Fill) */}
        <div className="flex flex-col gap-2 bg-[#12151e] p-3 rounded-xl border border-emerald-500/30">
          <div className="flex items-center justify-between">
            <label className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
              <Sparkle className="w-3.5 h-3.5 text-emerald-400" /> Gương Kính Phủ Mờ Lề Dư:
            </label>
            <button
              onClick={() => setBgMirrorBlur(!bgMirrorBlur)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                bgMirrorBlur 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white border border-[#2b3042]'
              }`}
            >
              {bgMirrorBlur ? '✨ Bật Gương Mờ' : '⬛ Viền Đen Tĩnh'}
            </button>
          </div>
          <p className="text-[10px] text-[#94a3b8]">
            {bgMirrorBlur 
              ? 'Tự động lấy bóng ảnh nền phóng to phủ mờ 2 bên/trên dưới ➔ Không bao giờ bị lề đen xì!' 
              : 'Giữ lề màu đen truyền thống xung quanh ảnh.'}
          </p>
        </div>

        {/* 3. Căn Chỉnh Kích Thước & Thu Phóng Ảnh (Fit & Zoom) */}
        <div className="flex flex-col gap-2.5 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
              <Maximize className="w-3.5 h-3.5 text-emerald-400" /> Căn Khung & Thu Phóng Ảnh:
            </label>
            <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              {bgZoom}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => {
                setBgFit('cover');
                setBgOffsetX(0);
                setBgOffsetY(0);
              }}
              className={`p-2 rounded-lg font-semibold transition-all text-center text-[11px] cursor-pointer ${
                bgFit === 'cover' 
                  ? 'bg-emerald-600 text-white font-bold shadow ring-1 ring-emerald-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
              title="Lấp đầy khung hình (Tự xén lề dư)"
            >
              📐 Lấp Đầy (Cover)
            </button>
            <button
              onClick={() => {
                setBgFit('contain');
              }}
              className={`p-2 rounded-lg font-semibold transition-all text-center text-[11px] cursor-pointer ${
                bgFit === 'contain' 
                  ? 'bg-emerald-600 text-white font-bold shadow ring-1 ring-emerald-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
              title="Hiện trọn vẹn toàn bộ bức ảnh (Giữ nguyên tỷ lệ)"
            >
              🖼️ Trọn Vẹn (Contain)
            </button>
          </div>

          {/* Thanh trượt Thu Phóng Ảnh (%) */}
          <div className="flex flex-col gap-1 text-xs mt-1">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Thu phóng Zoom Ảnh:</span>
              <span className="font-mono text-emerald-300 font-bold">{bgZoom}%</span>
            </div>
            <input 
              type="range" min="50" max="250" step="5"
              value={bgZoom}
              onChange={(e) => setBgZoom(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 4. Di Chuyển Vị Trí Vùng Nhìn Ảnh (Image Position X / Y Offset) */}
        <div className="flex flex-col gap-2.5 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-sky-400" /> Di Chuyển Vùng Nhìn Ảnh:
            </label>
            <button
              onClick={() => {
                setBgOffsetX(0);
                setBgOffsetY(0);
              }}
              className="text-[10px] text-sky-300 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-500/30 hover:bg-sky-600 hover:text-white transition-colors cursor-pointer"
              title="Đặt lại ảnh về chính giữa khung hình"
            >
              🎯 Căn Giữa
            </button>
          </div>

          {/* Slider X Offset */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Vị trí Trái / Phải (X):</span>
              <span className="font-mono text-sky-300 font-bold">{bgOffsetX}%</span>
            </div>
            <input 
              type="range" min="-50" max="50" step="1"
              value={bgOffsetX}
              onChange={(e) => setBgOffsetX(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          {/* Slider Y Offset */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Vị trí Trên / Dưới (Y):</span>
              <span className="font-mono text-sky-300 font-bold">{bgOffsetY}%</span>
            </div>
            <input 
              type="range" min="-50" max="50" step="1"
              value={bgOffsetY}
              onChange={(e) => setBgOffsetY(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 5. Hiệu Ứng Chuyển Động Ảnh Nền (Background Image Motion) */}
        <div className="flex flex-col gap-2 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> Hiệu Ứng Chuyển Động Ảnh:
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => setBgEffect('zoom')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                bgEffect === 'zoom' 
                  ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              🔍 Ken Burns Zoom
            </button>
            <button
              onClick={() => setBgEffect('pulse')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                bgEffect === 'pulse' 
                  ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              🌊 Pulse Beat Co Giãn
            </button>
            <button
              onClick={() => setBgEffect('none')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 col-span-2 ${
                bgEffect === 'none' 
                  ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              ⏹️ Ảnh Tĩnh Không Chuyển Động
            </button>
          </div>
        </div>

        {/* 6. Hiệu Ứng Âm Nhạc (Audio Visualizer: Vinyl Record / Waveform Spectrum) */}
        <div className="flex flex-col gap-2 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
            <Disc className="w-3.5 h-3.5 text-amber-400" /> Hiệu Ứng Sóng / Đĩa Nhạc Quay:
          </label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => setVisualizerType('vinyl')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                visualizerType === 'vinyl' 
                  ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              💿 Đĩa Nhạc Quay Vinyl
            </button>
            <button
              onClick={() => setVisualizerType('bars')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                visualizerType === 'bars' 
                  ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              📊 Sóng Âm Thanh (Bars)
            </button>
            <button
              onClick={() => setVisualizerType('ring')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                visualizerType === 'ring' 
                  ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              🌟 Vòng Hào Quang Nhạc
            </button>
            <button
              onClick={() => setVisualizerType('none')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                visualizerType === 'none' 
                  ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              ❌ Tắt Hiệu Ứng Sóng
            </button>
          </div>
        </div>

        {/* 7. Nạp Bài Hát MP3 / WAV (Hỗ trợ DJ 1-2 Tiếng) */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#1e2333]">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-blue-400" /> File Nhạc MP3 / DJ Mix (Hỗ trợ 1-2 tiếng):
          </label>
          {audioFile ? (
            <div className="flex items-center justify-between bg-[#12151e] p-2.5 rounded-xl border border-blue-500/40 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Music className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate font-medium text-blue-200">{audioFile.name}</span>
              </div>
              <button 
                onClick={removeAudioTrack} 
                className="text-red-400 hover:text-red-300 p-1" 
                title="Xóa nhạc"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 border border-dashed border-blue-500/30 hover:border-blue-500 bg-[#12151e] hover:bg-[#181d2a] p-3 rounded-xl cursor-pointer transition-all text-xs text-blue-300 font-medium">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Nạp File Nhạc MP3 / WAV / DJ</span>
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
