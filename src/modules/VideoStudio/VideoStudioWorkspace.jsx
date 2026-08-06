import React from 'react';
import { 
  Upload, Film, Music, Trash2, Plus, Sparkles, Sliders, Volume2, 
  RotateCw, RefreshCw, Layers, Monitor, ChevronRight
} from 'lucide-react';

export default function VideoStudioWorkspace({
  videoFile,
  videoFiles,
  handleVideoUpload,
  removeVideoClip,
  activeVideoIndex,
  setActiveVideoIndex,
  audioFile,
  handleAudioUpload,
  removeAudioTrack,
  subtitles,
  selectedSubId,
  setSelectedSubId,
  updateSubtitle,
  deleteSubtitle,
  activeSub,
  videoVolume,
  setVideoVolume,
  audioVolume,
  setAudioVolume,
  audioStartOffset,
  setAudioStartOffset,
  audioVideoOffset,
  setAudioVideoOffset,
  aspectRatio,
  setAspectRatio,
  currentTime,
  setSubtitles
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Cột 1: Tải File Video Clips & Nhạc Nền MP3 */}
      <div className="flex flex-col gap-4 bg-[#0d1017] p-4 rounded-2xl border border-[#1e2333] shadow-xl">
        <h2 className="text-sm font-bold text-[#e2e8f0] flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-400" /> 1. Quản Lý Clips & Nhạc Nền
        </h2>

        {/* Nút Upload Video (Hỗ trợ chọn nhiều clip) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#94a3b8] font-semibold">Tải Video MP4 / WebM (Nhiều Clips):</label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/30 hover:border-purple-500 bg-[#12151e] hover:bg-[#181d2a] p-4 rounded-xl cursor-pointer transition-all">
            <Upload className="w-6 h-6 text-purple-400 mb-1" />
            <span className="text-xs font-bold text-purple-300">Thêm Clips Video</span>
            <span className="text-[10px] text-[#64748b]">MP4, WebM (Chọn 1 hoặc nhiều file)</span>
            <input 
              type="file" 
              accept="video/*" 
              multiple
              onChange={handleVideoUpload} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Danh sách các Clips Video đã nạp */}
        {videoFiles.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[#94a3b8] font-semibold flex items-center justify-between">
              <span>Danh sách Clips ({videoFiles.length}):</span>
              <span className="text-[10px] text-purple-400 font-mono">Bấm chọn clip để xem</span>
            </span>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {videoFiles.map((clip, index) => (
                <div 
                  key={clip.id}
                  onClick={() => setActiveVideoIndex(index)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                    activeVideoIndex === index 
                      ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg' 
                      : 'bg-[#12151e] border-[#2b3042] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-purple-900/80 text-purple-200 text-[10px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium">{clip.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeVideoClip(index); }}
                    className="text-[#64748b] hover:text-red-400 p-1 transition-colors"
                    title="Xóa clip này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload & Quản Lý Nhạc Nền MP3 */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#1e2333]">
          <label className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-emerald-400" /> Nhạc Nền MP3 / WAV (Thay nhạc):
          </label>
          {audioFile ? (
            <div className="flex items-center justify-between bg-[#12151e] p-2.5 rounded-xl border border-emerald-500/40 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate font-medium text-emerald-200">{audioFile.name}</span>
              </div>
              <button 
                onClick={removeAudioTrack} 
                className="text-red-400 hover:text-red-300 p-1" 
                title="Xóa nhạc nền"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 border border-dashed border-emerald-500/30 hover:border-emerald-500 bg-[#12151e] hover:bg-[#181d2a] p-3 rounded-xl cursor-pointer transition-all text-xs text-emerald-300 font-medium">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Nạp Nhạc Nền Mới (MP3, WAV)</span>
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Hòa Trộn Âm Thanh Mixer */}
        {audioFile && (
          <div className="flex flex-col gap-2.5 bg-[#12151e] p-3 rounded-xl border border-[#2b3042]">
            <span className="text-xs text-[#94a3b8] font-semibold flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-400" /> Hòa Trộn Âm Thanh (Mixer)
            </span>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-[11px] text-[#94a3b8]">
                <span>Âm lượng Video Gốc:</span>
                <span className="font-mono text-blue-300">{Math.round(videoVolume * 100)}%</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.05"
                value={videoVolume} 
                onChange={(e) => setVideoVolume(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-[11px] text-[#94a3b8]">
                <span>Âm lượng Nhạc Nền MP3:</span>
                <span className="font-mono text-emerald-300">{Math.round(audioVolume * 100)}%</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.05"
                value={audioVolume} 
                onChange={(e) => setAudioVolume(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cột 2: Khung Trình Xem Trực Tiếp Video Studio */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Render từ App.jsx qua children hoặc props container */}
      </div>
    </div>
  );
}
