import React from 'react';
import { 
  Upload, Image, Music, Disc, Activity, Sparkles, Sliders, Volume2, 
  Trash2, Plus, Zap, RefreshCw, ZoomIn, Eye, Play, Pause, Layers, Maximize, Move, Sparkle, Waves, Check
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
  activeVisualizers = ['sinewave'],
  toggleVisualizer,
  selectedVizId = 'sinewave',
  setSelectedVizId,
  sinePosX = 50,
  setSinePosX,
  sinePosY = 50,
  setSinePosY,
  vinylPosX = 50,
  setVinylPosX,
  vinylPosY = 50,
  setVinylPosY,
  barsPosX = 50,
  setBarsPosX,
  barsPosY = 75,
  setBarsPosY,
  ringPosX = 50,
  setRingPosX,
  ringPosY = 50,
  setRingPosY,
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
  // Trích xuất tọa độ đang chỉnh sửa của hiệu ứng được chọn
  let currentVizX = 50;
  let currentVizY = 50;
  let setVizX = () => {};
  let setVizY = () => {};
  let vizLabel = 'Sóng Sine';

  if (selectedVizId === 'sinewave') {
    currentVizX = sinePosX;
    currentVizY = sinePosY;
    setVizX = setSinePosX;
    setVizY = setSinePosY;
    vizLabel = '🌊 Sóng Sine';
  } else if (selectedVizId === 'vinyl') {
    currentVizX = vinylPosX;
    currentVizY = vinylPosY;
    setVizX = setVinylPosX;
    setVizY = setVinylPosY;
    vizLabel = '💿 Đĩa Quay';
  } else if (selectedVizId === 'bars') {
    currentVizX = barsPosX;
    currentVizY = barsPosY;
    setVizX = setBarsPosX;
    setVizY = setBarsPosY;
    vizLabel = '📊 Bars Sóng Âm';
  } else if (selectedVizId === 'ring') {
    currentVizX = ringPosX;
    currentVizY = ringPosY;
    setVizX = setRingPosX;
    setVizY = setRingPosY;
    vizLabel = '🌟 Vòng Hào Quang';
  }

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

      {/* THẺ 4: TÙY CHỈNH NỀN LỒNG NHIỀU SÓNG ÂM VÀ VỊ TRÍ X/Y TỪNG LAYER ĐỘC LẬP */}
      <div className="flex flex-col gap-3 bg-[#12151e] p-3.5 rounded-xl border border-amber-500/40">
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-amber-400" /> 4. Lập Vị Trí Sóng Âm (Kéo thả chuột / Slider)
          </span>
          <button
            onClick={() => {
              setVizX(50);
              setVizY(selectedVizId === 'bars' ? 75 : 50);
            }}
            className="text-[10px] text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-500/30 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
            title="Đưa hiệu ứng đang chọn về tâm"
          >
            🎯 Đưa Về Giữa
          </button>
        </div>

        {/* Nút Chọn Nhiều Hiệu Ứng Lồng Nhau (Multi-select) */}
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="text-[11px] text-[#94a3b8] font-semibold">1. Bật/Tắt các hiệu ứng sóng âm lồng nhau:</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'sinewave', label: '🌊 Sóng Sine DJ Line', color: 'from-pink-600 to-purple-600' },
              { id: 'vinyl', label: '💿 Đĩa Quay Vinyl', color: 'from-amber-600 to-orange-600' },
              { id: 'bars', label: '📊 Bars Sóng Âm', color: 'from-cyan-600 to-blue-600' },
              { id: 'ring', label: '🌟 Vòng Hào Quang', color: 'from-fuchsia-600 to-pink-600' },
            ].map((v) => {
              const active = activeVisualizers.includes(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => toggleVisualizer(v.id)}
                  className={`p-2 rounded-lg font-semibold transition-all text-left text-[11px] cursor-pointer flex items-center justify-between ${
                    active 
                      ? `bg-gradient-to-r ${v.color} text-white font-bold shadow ring-1 ring-white/40` 
                      : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white border border-[#2b3042]'
                  }`}
                >
                  <span className="truncate">{v.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chọn Tiêu Điểm Hiệu Ứng Để Căn Chỉnh */}
        <div className="flex flex-col gap-1.5 text-xs pt-1 border-t border-[#2b3042]/50">
          <span className="text-[11px] text-[#94a3b8] font-semibold">2. Chọn hiệu ứng để chỉnh tọa độ X/Y:</span>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'sinewave', label: '🌊 Sine' },
              { id: 'vinyl', label: '💿 Vinyl' },
              { id: 'bars', label: '📊 Bars' },
              { id: 'ring', label: '🌟 Ring' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedVizId(tab.id)}
                className={`py-1 px-1.5 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                  selectedVizId === tab.id 
                    ? 'bg-purple-600 text-white shadow' 
                    : 'bg-[#1a1e2b] text-[#94a3b8] hover:text-white border border-[#2b3042]/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mẹo Kéo Thả Trực Tiếp */}
        <div className="text-[10px] text-pink-400 bg-pink-950/40 p-1.5 rounded border border-pink-500/20 text-center font-medium leading-relaxed">
          💡 Mẹo: Bấm & kéo trực tiếp hiệu ứng trên khung xem bằng chuột để di chuyển mượt mà!
        </div>

        {/* Sliders Tọa độ của hiệu ứng đang được lựa chọn */}
        <div className="grid grid-cols-2 gap-3 text-xs pt-1.5 border-t border-[#2b3042]/50">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Ngang (X) của {vizLabel}:</span>
              <span className="font-mono text-amber-300 font-bold">{currentVizX}%</span>
            </div>
            <input 
              type="range" min="10" max="90" step="1"
              value={currentVizX}
              onChange={(e) => setVizX(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-[#94a3b8]">
              <span>Dọc (Y) của {vizLabel}:</span>
              <span className="font-mono text-amber-300 font-bold">{currentVizY}%</span>
            </div>
            <input 
              type="range" min="10" max="90" step="1"
              value={currentVizY}
              onChange={(e) => setVizY(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
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
