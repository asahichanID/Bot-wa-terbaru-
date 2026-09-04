import React, { useState } from 'react';
import { Music, Play, X, Search, Sparkles, Clock, User, Eye } from 'lucide-react';
import { InteractiveListPayload, InteractiveListItem } from '../whatsapp/types';

interface FloatingSongPickerModalProps {
  interactiveList: InteractiveListPayload;
  onSelectSong: (commandId: string, songTitle: string) => void;
  onClose: () => void;
}

export const FloatingSongPickerModal: React.FC<FloatingSongPickerModalProps> = ({
  interactiveList,
  onSelectSong,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const items = interactiveList.items || [];
  const filtered = items.filter(
    (it) =>
      it.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (it.author && it.author.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Panel Mengambang Pemilihan Lagu</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono">
                  Maks. 30 Hasil
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Tracen Jukebox • {items.length} Lagu Ditemukan via Neoxr API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Tutup Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="p-3 bg-slate-950 border-b border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari judul lagu atau nama artis di dalam daftar hasil..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* List of songs (up to 30 results) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/50">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Tidak ada lagu yang cocok dengan kata kunci "{filterQuery}".
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id + idx}
                className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-700 bg-slate-950">
                    <img
                      src={item.thumbnail || '/assets/oguri_cap.jpg'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    {item.duration && (
                      <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 rounded text-[9px] font-mono text-white">
                        {item.duration}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-slate-100 truncate group-hover:text-amber-300 transition">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                      <span className="text-amber-400/90">
                        {item.mode === 'play2' ? 'Versi Penuh (.play2)' : 'Spotify UI (.play)'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectSong(item.id, item.title);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-xs font-medium transition cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Pilih Lagu</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tema Uma Musume: Oguri Cap • Tracen Jukebox</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
