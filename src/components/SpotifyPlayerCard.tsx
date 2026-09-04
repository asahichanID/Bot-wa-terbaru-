import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Music, Volume2, VolumeX, Disc, ExternalLink, Sparkles } from 'lucide-react';
import { MusicCardPayload } from '../whatsapp/types';

interface SpotifyPlayerCardProps {
  card: MusicCardPayload;
  onPlayFullAudio?: (title: string, url: string) => void;
}

function extractVideoId(url?: string): string {
  if (!url) return 'fKRtnMYMW08';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : 'fKRtnMYMW08';
}

export const SpotifyPlayerCard: React.FC<SpotifyPlayerCardProps> = ({ card, onPlayFullAudio }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Video ID and Middle 1-minute calculation
  const videoId = card.videoId || extractVideoId(card.audioUrl);
  const totalSec = card.durationSeconds || 180;
  const middleStart = card.middleStartSeconds ?? Math.max(0, Math.floor((totalSec - 60) / 2));
  const middleEnd = middleStart + 60;

  // Send command to YouTube IFrame API via postMessage
  const sendYtCommand = useCallback((func: string, args: any = '') => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch (e) {
        console.warn('Failed to send YouTube iframe command:', e);
      }
    }
  }, []);

  // Timer loop for 1-minute playback tracking
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 60) {
            sendYtCommand('pauseVideo');
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, sendYtCommand]);

  // Global user interaction listener to ensure autoplay or unpause starts immediately
  useEffect(() => {
    const handleFirstGesture = () => {
      if (!isPlaying) {
        sendYtCommand('playVideo');
        setIsPlaying(true);
      }
    };

    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, [isPlaying, sendYtCommand]);

  const togglePlay = () => {
    if (isPlaying) {
      sendYtCommand('pauseVideo');
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      sendYtCommand('playVideo');
      if (audioRef.current) audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const targetYtTime = middleStart + val;
    sendYtCommand('seekTo', [targetYtTime, true]);
  };

  const toggleMute = () => {
    if (isMuted) {
      sendYtCommand('unMute');
      if (audioRef.current) audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      sendYtCommand('mute');
      if (audioRef.current) audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Embed URL playing genuine audio from middleStart to middleEnd
  const ytEmbedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${middleStart}&end=${middleEnd}&enablejsapi=1&controls=0&disablekb=1&fs=0&rel=0&iv_load_policy=3&modestbranding=1&loop=0`;

  return (
    <div className="bg-gradient-to-br from-emerald-950/95 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-xl p-4 shadow-2xl text-slate-100 space-y-3.5 my-2 relative overflow-hidden">
      {/* Hidden Genuine YouTube Audio Engine (tanpa CDN, lagu asli YouTube, tengah 1 menit) */}
      <div className="w-0 h-0 opacity-0 pointer-events-none absolute overflow-hidden">
        <iframe
          ref={iframeRef}
          src={ytEmbedUrl}
          title={card.title}
          allow="autoplay; encrypted-media"
          className="w-1 h-1"
        />
      </div>

      {/* Spotify Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-[10px] shadow-sm">
            <Music className="w-3 h-3 text-slate-950" />
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 tracking-wide uppercase">
            {card.botName || 'Oguri Cap • Tracen Sound System'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isPlaying && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Auto-Playing Asli
            </span>
          )}
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-medium">
            ⏱️ Preview Bagian Tengah 1 Menit
          </span>
        </div>
      </div>

      {/* Main Card Content: Genuine Thumbnail & Metadata */}
      <div className="flex gap-3.5 items-center">
        <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-emerald-500/30 shadow-md group">
          <img
            src={card.thumbnail}
            alt={card.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition duration-300 ${
              isPlaying ? 'ring-2 ring-emerald-400/60' : ''
            }`}
          />
          <button
            onClick={togglePlay}
            className="absolute inset-0 bg-black/40 hover:bg-black/25 flex items-center justify-center transition cursor-pointer"
            title={isPlaying ? 'Jeda' : 'Putar Lagu Asli'}
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg transition transform hover:scale-110">
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-slate-950 text-slate-950" />
              ) : (
                <Play className="w-4 h-4 fill-slate-950 text-slate-950 ml-0.5" />
              )}
            </div>
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.2 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-[9px] font-semibold uppercase tracking-wider">
              Lagu Asli
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              [Detik {middleStart} - {middleEnd}]
            </span>
          </div>
          <h4 className="font-semibold text-xs text-white line-clamp-2 leading-snug">
            {card.title}
          </h4>
          <p className="text-[11px] text-slate-400 line-clamp-1">{card.channel}</p>
        </div>
      </div>

      {/* Audio Scrubber & Controls */}
      <div className="space-y-1.5 pt-1">
        <input
          type="range"
          min="0"
          max="60"
          step="1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-emerald-400 font-medium">
              1:00 (Tengah Lagu)
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions: Clean, No-Spam, Instant Full Downloader */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 leading-tight">
          🎵 Bagian reff/tengah lagu diputar otomatis sebagai preview asli tanpa CDN.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {onPlayFullAudio && (
            <button
              onClick={() => onPlayFullAudio(card.title, card.audioUrl)}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-medium transition cursor-pointer flex items-center gap-1"
              title="Unduh versi lengkap MP3"
            >
              <Disc className="w-3 h-3 text-amber-400" />
              <span>Full MP3 (.play2)</span>
            </button>
          )}
          <a
            href={`https://youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-medium transition flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>YouTube</span>
          </a>
        </div>
      </div>
    </div>
  );
};
