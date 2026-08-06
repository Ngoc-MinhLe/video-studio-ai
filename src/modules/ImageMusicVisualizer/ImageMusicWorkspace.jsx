import React from 'react';
import { 
  Upload, Image, Music, Disc, Activity, Sparkles, Sliders, Volume2, 
  Trash2, Plus, Zap, RefreshCw, ZoomIn, Eye, Play, Pause, Layers
} from 'lucide-react';

export default function ImageMusicWorkspace({
  bgImage,
  handleBgImageUpload,
  removeBgImage,
  bgEffect,
  setBgEffect,
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
            <Image className="w-4 h-4 text-emerald-400" /> 1. Ảnh Nền & Âm Nhạc
          </h2>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
            ⚡ GPU Render Siêu Tốc
          </span>
        </div>

        {/* 1. Tải Ảnh Nền (Background Image) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center justify-between">
            <span>Tải Ảnh Nền (JPG, PNG):</span>
            {bgImage && <span className="text-[10px] text-emerald-400">Đã chọn ảnh</span>}
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

        {/* 2. Hiệu Ứng Chuyển Động Ảnh Nền (Background Image Motion) */}
        <div className="flex flex-col gap-2 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> Hiệu Ứng Ảnh Nền:
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
              🔍 Ken Burns Zoom (Phóng To)
            </button>
            <button
              onClick={() => setBgEffect('pulse')}
              className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
                bgEffect === 'pulse' 
                  ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                  : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
              }`}
            >
              🌊 Pulse Beat (Co Giãn Nhịp)
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

        {/* 3. Hiệu Ứng Âm Nhạc (Audio Visualizer: Vinyl Record / Waveform Spectrum) */}
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

        {/* 4. Nạp Bài Hát MP3 / WAV (Hỗ trợ DJ 1-2 Tiếng) */}
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

      {/* Cột 2 & 3 sẽ được ghép linh hoạt trong App.jsx */}
    </div>
  );
}
