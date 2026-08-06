import React from 'react';
import { 
  Upload, Image, Music, Disc, Activity, Sparkles, Sliders, Volume2, 
  Trash2, Plus, Zap, RefreshCw, ZoomIn, Eye, Play, Pause, Layers, Maximize, Move, Sparkle, Waves, Gauge
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
  zoomSpeed = 0.2,
  setZoomSpeed,
  zoomRange = 30,
  setZoomRange,
  visualizerType = 'sinewave',
  setVisualizerType,
  visualizerPosY = 50,
  setVisualizerPosY,
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
    <section className="glass-panel p-4 flex flex-col gap-4 overflow-y-auto max-h-[82vh] custom-scrollbar">
      {/* Header Module */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2b3042]">
        <h2 className="text-sm font-bold text-[#e2e8f0] flex items-center gap-2">
          <Image className="w-4 h-4 text-emerald-400" /> Bảng Căn Chỉnh Ảnh & Sóng DJ
        </h2>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
          ⚡ GPU Engine
        </span>
      </div>

      {/* THẺ 1: FILE ẢNH NỀN & BÀI HÁT MP3 */}
      <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
        <span className="text-xs font-bold text-[#e2e8f0] flex items-center gap-1.5 border-b border-[#2b3042] pb-2">
          <Upload className="w-3.5 h-3.5 text-blue-400" /> 1. Nạp File Ảnh Nền & File Nhạc MP3
        </span>

        {/* Upload Ảnh Nền */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#94a3b8]">
            <span>Ảnh Nền (JPG, PNG):</span>
            {bgImage && <span className="text-emerald-400 font-bold">✓ Đã nạp</span>}
          </div>

          {bgImage ? (
            <div className="flex items-center justify-between bg-[#1a1e2b] p-2 rounded-lg border border-emerald-500/40 text-xs">
              <div className="flex items-center gap-2 truncate">
                <img src={bgImage.url} alt="" className="w-7 h-7 rounded object-cover border border-white/20 shrink-0" />
                <span className="truncate text-emerald-200 font-medium text-[11px]">{bgImage.file?.name || 'Ảnh Nền'}</span>
              </div>
              <button 
                onClick={removeBgImage} 
                className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/20 shrink-0 cursor-pointer"
                title="Tháo ảnh nền"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 border border-dashed border-emerald-500/40 hover:border-emerald-400 bg-[#1a1e2b] hover:bg-[#232838] p-2.5 rounded-lg cursor-pointer transition-all text-xs text-emerald-300 font-medium">
              <Image className="w-4 h-4 text-emerald-400" />
              <span>Nạp Ảnh Nền (JPG, PNG)</span>
              <input type="file" accept="image/*" onChange={handleBgImageUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Upload Nhạc MP3 */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-[#2b3042]/50">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#94a3b8]">
            <span>File Nhạc MP3 / DJ Mix (1-2 tiếng):</span>
            {audioFile && <span className="text-blue-400 font-bold">✓ Đã nạp</span>}
          </div>

          {audioFile ? (
            <div className="flex items-center justify-between bg-[#1a1e2b] p-2 rounded-lg border border-blue-500/40 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Music className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate text-blue-200 font-medium text-[11px]">{audioFile.name}</span>
              </div>
              <button 
                onClick={removeAudioTrack} 
                className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/20 shrink-0 cursor-pointer"
                title="Xóa nhạc"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 border border-dashed border-blue-500/40 hover:border-blue-400 bg-[#1a1e2b] hover:bg-[#232838] p-2.5 rounded-lg cursor-pointer transition-all text-xs text-blue-300 font-medium">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Nạp File Nhạc MP3 / WAV / DJ</span>
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* THẺ 2: CĂN KHUNG, THU PHÓNG & HIỆU ỨNG GƯƠNG MỜ */}
      <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
        <span className="text-xs font-bold text-[#e2e8f0] flex items-center justify-between border-b border-[#2b3042] pb-2">
          <span className="flex items-center gap-1.5">
            <Maximize className="w-3.5 h-3.5 text-emerald-400" /> 2. Căn Ảnh & Hiệu Ứng Gương Mờ
          </span>
          <button
            onClick={() => setBgMirrorBlur(!bgMirrorBlur)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              bgMirrorBlur 
                ? 'bg-emerald-600 text-white shadow' 
                : 'bg-[#1a1e2b] text-[#94a3b8] border border-[#2b3042]'
            }`}
          >
            {bgMirrorBlur ? '✨ Gương Mờ (On)' : '⬛ Viền Đen (Off)'}
          </button>
        </span>

        {/* Chọn Lấp Đầy Cover vs Contain */}
        <div className="grid grid-cols-2 gap-2">
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
            onClick={() => setBgFit('contain')}
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

        {/* Slider Zoom Ảnh Kích Thước Ban Đầu */}
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between text-[11px] text-[#94a3b8]">
            <span>Thu Phóng Tỷ Lệ Ảnh Khởi Đầu:</span>
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

      {/* THẺ 3: DI CHUYỂN TÂM ĐIỂM NHÌN ẢNH (X/Y OFFSET & CENTER SNAP) */}
      <div className="flex flex-col gap-2.5 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
        <div className="flex items-center justify-between border-b border-[#2b3042] pb-2">
          <span className="text-xs font-bold text-[#e2e8f0] flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-sky-400" /> 3. Di Chuyển Tâm Điểm Nhìn Ảnh (X/Y)
          </span>
          <button
            onClick={() => {
              setBgOffsetX(0);
              setBgOffsetY(0);
            }}
            className="text-[10px] text-sky-300 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-500/30 hover:bg-sky-600 hover:text-white transition-colors cursor-pointer"
            title="Căn lại điểm nhìn chính giữa"
          >
            🎯 Căn Giữa
          </button>
        </div>

        {/* Slider X & Y Offset 2 cột */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Ngang (X):</span>
              <span className="font-mono text-sky-300 font-bold">{bgOffsetX}%</span>
            </div>
            <input 
              type="range" min="-50" max="50" step="1"
              value={bgOffsetX}
              onChange={(e) => setBgOffsetX(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Dọc (Y):</span>
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
      </div>

      {/* THẺ 4: HIỆU ỨNG SÓNG ÂM NEON DJ & ĐĨA VINYL */}
      <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-[#2b3042]">
        <span className="text-xs font-bold text-[#e2e8f0] flex items-center gap-1.5 border-b border-[#2b3042] pb-2">
          <Waves className="w-3.5 h-3.5 text-amber-400" /> 4. Hiệu Ứng Sóng Âm & Đĩa Quay
        </span>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            onClick={() => setVisualizerType('sinewave')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
              visualizerType === 'sinewave' 
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold shadow ring-1 ring-pink-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            🌊 Sóng Sine DJ Line
          </button>
          <button
            onClick={() => setVisualizerType('vinyl')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
              visualizerType === 'vinyl' 
                ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            💿 Đĩa Quay Vinyl
          </button>
          <button
            onClick={() => setVisualizerType('bars')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
              visualizerType === 'bars' 
                ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            📊 Bars Sóng Âm
          </button>
          <button
            onClick={() => setVisualizerType('ring')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
              visualizerType === 'ring' 
                ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            🌟 Vòng Hào Quang
          </button>
        </div>

        {/* Slider Vị trí Sóng Âm Y */}
        <div className="flex flex-col gap-1 text-xs pt-1 border-t border-[#2b3042]/50">
          <div className="flex justify-between text-[11px] text-[#94a3b8]">
            <span>Vị Trí Sóng Âm Y (Trải Ngang/Dọc):</span>
            <span className="font-mono text-amber-300 font-bold">{visualizerPosY}%</span>
          </div>
          <input 
            type="range" min="10" max="90" step="1"
            value={visualizerPosY}
            onChange={(e) => setVisualizerPosY(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
      </div>

      {/* THẺ 5: CHỐNG NHÁY MỜ - CAMERA ZOOM TO RÕ ĐỊNH DẠNG TỐC ĐỘ */}
      <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-purple-500/40">
        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 border-b border-purple-500/20 pb-2">
          <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> 5. Camera Continuous Focus Zoom (Sắc Nét 60FPS)
        </span>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            onClick={() => setBgEffect('zoom')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
              bgEffect === 'zoom' 
                ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            🔍 Zoom Focus Nhịp Nhàng
          </button>
          <button
            onClick={() => setBgEffect('pulse')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 ${
              bgEffect === 'pulse' 
                ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            🌊 Camera Pulsating
          </button>
          <button
            onClick={() => setBgEffect('none')}
            className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center gap-1.5 col-span-2 ${
              bgEffect === 'none' 
                ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400' 
                : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white'
            }`}
          >
            ⏹️ Ảnh Tĩnh Giữ Nguyên
          </button>
        </div>

        {/* Sliders Tốc Độ & Độ Phóng Zoom Camera */}
        {bgEffect !== 'none' && (
          <div className="flex flex-col gap-2 pt-2 border-t border-purple-500/20">
            {/* Slider Tốc độ Zoom */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-[11px] text-[#94a3b8]">
                <span>Tốc Độ Zoom Camera:</span>
                <span className="font-mono text-purple-300 font-bold">{Math.round(zoomSpeed * 100) / 100}x</span>
              </div>
              <input 
                type="range" min="0.05" max="1.0" step="0.05"
                value={zoomSpeed}
                onChange={(e) => setZoomSpeed(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Slider Độ Biến Thiên Zoom (%) */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-[11px] text-[#94a3b8]">
                <span>Mức Độ Phóng To Biên Độ (Zoom Range):</span>
                <span className="font-mono text-purple-300 font-bold">+{zoomRange}%</span>
              </div>
              <input 
                type="range" min="10" max="100" step="5"
                value={zoomRange}
                onChange={(e) => setZoomRange(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
