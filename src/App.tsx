import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Activity,
  Play,
  RotateCcw,
  Pause,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Zap,
  Package,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Send,
  Smartphone,
  Server,
  RefreshCw,
  Key,
  Copy,
  Check
} from 'lucide-react';

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  commandCount: number;
}

interface BotStatus {
  botName: string;
  uptime: number;
  engineMode: 'baileys' | 'simulator';
  waStatus: {
    state: string;
    engineName: string;
    qrCode?: string;
    pairingCode?: string;
    userJid?: string;
    reconnectAttempts: number;
  };
  plugins: PluginInfo[];
  commandCount: number;
  activeTetrisGames: number;
}

interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  buttons?: Array<{ id: string; text: string }>;
  timestamp: number;
  direction: 'inbound' | 'outbound';
}

interface LeaderboardItem {
  rank: number;
  userId: string;
  maskedName: string;
  score: number;
  lines: number;
  level: number;
  date: number;
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('.tetris');
  const [logs, setLogs] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<{ running: boolean; message?: string; success?: boolean }>({
    running: false,
  });
  const [selectedPlayer, setSelectedPlayer] = useState('6281234567890@s.whatsapp.net');
  const [playerName, setPlayerName] = useState('Player 1');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch status and leaderboard
  const fetchData = async () => {
    try {
      const [resStatus, resLb, resChat, resLogs] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/leaderboard').then(r => r.json()),
        fetch('/api/chat/history').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
      ]);

      if (resStatus && !resStatus.error) setStatus(resStatus);
      if (resLb?.leaderboard) setLeaderboard(resLb.leaderboard);
      if (resChat?.messages) setChatMessages(resChat.messages);
      if (resLogs?.logs) setLogs(resLogs.logs);
    } catch {
      // Background poll silently
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = async (text: string, isControllerAction = false) => {
    if (!text.trim()) return;
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          senderJid: selectedPlayer,
          pushName: playerName,
          isControllerAction,
        }),
      });
      setInputText('');
      await fetchData();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const switchEngine = async (mode: 'baileys' | 'simulator') => {
    try {
      await fetch('/api/engine/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      await fetchData();
    } catch (err) {
      console.error('Error switching engine:', err);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhone.trim()) return;
    setPairingLoading(true);
    setPairingError(null);
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: pairingPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal meminta kode pairing');
      }
      await fetchData();
    } catch (err: any) {
      setPairingError(err.message || 'Gagal terhubung ke WhatsApp');
    } finally {
      setPairingLoading(false);
    }
  };

  const copyPairingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const runWajibTests = async () => {
    setTestResult({ running: true });
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      const data = await res.json();
      setTestResult({
        running: false,
        success: data.success,
        message: data.message || data.error,
      });
      await fetchData();
    } catch (err: any) {
      setTestResult({
        running: false,
        success: false,
        message: err.message,
      });
    }
  };

  // Keyboard shortcut listener when focused on chat
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      sendMessage('.tetris left', true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      sendMessage('.tetris right', true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sendMessage('.tetris rotate', true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      sendMessage('.tetris drop', true);
    } else if (e.key === ' ') {
      e.preventDefault();
      sendMessage('.tetris hard', true);
    } else if (e.key.toLowerCase() === 'c') {
      e.preventDefault();
      sendMessage('.tetris hold', true);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-white">Modular WhatsApp Bot</h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Node.js 20 • Pterodactyl Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">Clean Architecture • Dynamic Plugin Discovery • Isolated Tetris State</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className={`w-2 h-2 rounded-full ${status?.waStatus.state === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-medium capitalize">
              {status?.waStatus.state || 'Connecting'} ({status?.engineMode === 'baileys' ? 'Baileys Multi-Device' : 'Simulator'})
            </span>
          </div>

          <button
            id="run-tests-btn"
            onClick={runWajibTests}
            disabled={testResult.running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition cursor-pointer"
          >
            {testResult.running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{testResult.running ? 'Running Tests...' : 'Run 6 WAJIB Tests'}</span>
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: WhatsApp Status & Engine Control */}
        <div className="lg:col-span-4 space-y-5">
          {/* Engine & Session Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                WhatsApp Transport Layer
              </h2>
              <span className="text-xs text-slate-400 font-mono">v1.0.0</span>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800 mb-4">
              <button
                id="btn-switch-simulator"
                onClick={() => switchEngine('simulator')}
                className={`py-1.5 px-3 rounded-md text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  status?.engineMode === 'simulator' ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Web Simulator</span>
              </button>
              <button
                id="btn-switch-baileys"
                onClick={() => switchEngine('baileys')}
                className={`py-1.5 px-3 rounded-md text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  status?.engineMode === 'baileys' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Live Baileys (QR)</span>
              </button>
            </div>

            {/* Live Baileys Connection Setup (QR or Pairing Code) */}
            {status?.engineMode === 'baileys' && (
              <div className="my-3 space-y-3">
                {status.waStatus.state === 'open' ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-lg text-xs flex items-center gap-2 text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>Terhubung ke WhatsApp: <strong className="font-mono text-emerald-200">+{status.waStatus.userJid?.split('@')[0]}</strong></span>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        Pairing Code (Rekomendasi Pterodactyl)
                      </span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">Tanpa QR</span>
                    </div>

                    {/* Active Pairing Code Display */}
                    {status.waStatus.pairingCode ? (
                      <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-center space-y-2">
                        <p className="text-[11px] text-slate-300 font-medium">Masukkan kode 8 digit ini ke WhatsApp Anda:</p>
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono text-xl font-bold tracking-widest text-amber-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-amber-500/40 select-all">
                            {status.waStatus.pairingCode}
                          </span>
                          <button
                            onClick={() => copyPairingCode(status.waStatus.pairingCode!)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
                            title="Salin Kode"
                          >
                            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed text-left pt-1 border-t border-slate-800">
                          <strong>Langkah:</strong> Buka WA di HP ➔ Titik Tiga (⋮) ➔ <em>Perangkat Tertaut</em> ➔ <em>Tautkan Perangkat</em> ➔ pilih <u>"Tautkan dengan nomor telepon saja"</u> di bagian bawah.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Nomor WA (contoh: 628123456789)"
                            value={pairingPhone}
                            onChange={(e) => setPairingPhone(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                          />
                          <button
                            onClick={handleRequestPairingCode}
                            disabled={pairingLoading || !pairingPhone.trim()}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            {pairingLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                            <span>Minta Kode</span>
                          </button>
                        </div>
                        {pairingError && <p className="text-[11px] text-rose-400">{pairingError}</p>}
                      </div>
                    )}

                    {/* Alternative QR Code View */}
                    {status.waStatus.qrCode && (
                      <div className="pt-2 border-t border-slate-800 text-center">
                        <p className="text-[10px] text-slate-400 mb-1.5">Atau Scan QR jika tidak menggunakan kode:</p>
                        <div className="inline-block p-2 bg-white rounded-lg">
                          <img src={status.waStatus.qrCode} alt="WhatsApp QR Code" className="w-36 h-36 mx-auto" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Info Badges */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Session Directory:</span>
                <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] border border-emerald-500/20">
                  ./data/session (Protected)
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Uptime:</span>
                <span className="font-medium text-slate-200">{formatSeconds(status?.uptime || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Active Tetris Games:</span>
                <span className="font-medium text-amber-400">{status?.activeTetrisGames || 0} isolated states</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Anti-Spam Rate Limit:</span>
                <span className="font-medium text-slate-300">10 requests / 5s</span>
              </div>
            </div>
          </div>

          {/* Test Results Alert */}
          {testResult.message && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                testResult.success ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' : 'bg-rose-950/40 border-rose-800 text-rose-200'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              <div>
                <p className="font-semibold">{testResult.success ? 'All 6 WAJIB Tests Passed!' : 'Test Execution Failed'}</p>
                <p className="mt-0.5 text-slate-300">{testResult.message}</p>
                <p className="mt-1 text-[11px] text-slate-400">1. Build • 2. Plugin Add • 3. State Isolation • 4. Persistence • 5. Error Isolation • 6. Reconnect</p>
              </div>
            </div>
          )}

          {/* Installed Plugins */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Discovered Plugins ({status?.plugins?.length || 0})
              </h2>
              <span className="text-xs text-slate-400">{status?.commandCount || 0} Commands</span>
            </div>

            <div className="space-y-2">
              {status?.plugins?.map((plugin) => (
                <div key={plugin.name} className="p-3 bg-slate-950 rounded-lg border border-slate-800/70 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">.{plugin.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">v{plugin.version}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{plugin.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center & Right Columns: Live WhatsApp Chat Simulator & Interactive Tetris Pad */}
        <div className="lg:col-span-8 space-y-5">
          {/* Chat Simulator Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[680px]">
            {/* Chat Header */}
            <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                  WA
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">WhatsApp Client Simulator</h3>
                  <p className="text-[11px] text-slate-400">Testing isolated player state in real time</p>
                </div>
              </div>

              {/* Multi-Player Switcher to prove State Isolation */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Simulate As:</label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => {
                    const jid = e.target.value;
                    setSelectedPlayer(jid);
                    setPlayerName(jid.includes('001') ? 'Player 1' : 'Player 2');
                  }}
                  className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="628123456001@s.whatsapp.net">Player 1 (62812****001)</option>
                  <option value="628123456002@s.whatsapp.net">Player 2 (62812****002)</option>
                </select>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs bg-slate-950/60" onKeyDown={handleKeyDown} tabIndex={0}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Terminal className="w-8 h-8 opacity-40" />
                  <p className="text-xs">Belum ada percakapan.</p>
                  <p className="text-[11px]">Ketik <code className="text-emerald-400">.tetris</code> atau klik tombol di bawah untuk memulai!</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-lg p-3.5 shadow-sm whitespace-pre-wrap ${
                        msg.direction === 'inbound'
                          ? 'bg-emerald-700 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none font-sans'
                      }`}
                    >
                      <div className="text-[10px] font-mono text-slate-300/80 mb-1 flex items-center justify-between gap-4">
                        <span>{msg.direction === 'inbound' ? playerName : 'Modular WhatsApp Bot'}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>

                      {/* Message Content */}
                      <div className="leading-relaxed font-mono text-[12px]">{msg.text}</div>

                      {/* Interactive Buttons (if sent with the message) */}
                      {msg.buttons && msg.buttons.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-4 gap-1.5 font-sans">
                          {msg.buttons.map((btn) => (
                            <button
                              key={btn.id}
                              onClick={() => sendMessage(btn.id, btn.id.startsWith('.tetris'))}
                              className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100 rounded text-[11px] font-medium transition cursor-pointer text-center"
                            >
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Action Tetris Game Controller Bar */}
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-amber-400" />
                  Tetris Controller Pad (Keyboard Arrow Keys supported)
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">1-Message In-Place UI</span>
                </span>
                <span className="text-[10px] text-slate-500">Live board updates in 1 single WhatsApp message</span>
              </div>

              {/* Tetris Controller Buttons */}
              <div className="grid grid-cols-8 gap-1.5">
                <button
                  id="btn-tetris-left"
                  onClick={() => sendMessage('.tetris left', true)}
                  title="Geser Kiri (←)"
                  className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex flex-col items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4 text-sky-400" />
                  <span className="text-[9px] mt-0.5 font-medium">Kiri</span>
                </button>

                <button
                  id="btn-tetris-rotate"
                  onClick={() => sendMessage('.tetris rotate', true)}
                  title="Putar Balok (↑)"
                  className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex flex-col items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  <span className="text-[9px] mt-0.5 font-medium">Putar</span>
                </button>

                <button
                  id="btn-tetris-right"
                  onClick={() => sendMessage('.tetris right', true)}
                  title="Geser Kanan (→)"
                  className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex flex-col items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <ArrowRight className="w-4 h-4 text-sky-400" />
                  <span className="text-[9px] mt-0.5 font-medium">Kanan</span>
                </button>

                <button
                  id="btn-tetris-drop"
                  onClick={() => sendMessage('.tetris drop', true)}
                  title="Turun Halus (↓)"
                  className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex flex-col items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <ArrowDown className="w-4 h-4 text-emerald-400" />
                  <span className="text-[9px] mt-0.5 font-medium">Turun</span>
                </button>

                <button
                  id="btn-tetris-hard"
                  onClick={() => sendMessage('.tetris hard', true)}
                  title="Hard Drop Meluncur Cepat (Space)"
                  className="py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 rounded-lg text-white flex flex-col items-center justify-center transition cursor-pointer font-bold shadow-sm"
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-[9px] mt-0.5 font-semibold">Hard</span>
                </button>

                <button
                  id="btn-tetris-hold"
                  onClick={() => sendMessage('.tetris hold', true)}
                  title="Simpan Balok (C)"
                  className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex flex-col items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <Package className="w-4 h-4 text-orange-400" />
                  <span className="text-[9px] mt-0.5 font-medium">Hold</span>
                </button>

                <button
                  id="btn-tetris-pause"
                  onClick={() => sendMessage('.tetris pause', true)}
                  title="Jeda / Lanjut"
                  className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex flex-col items-center justify-center transition cursor-pointer border border-slate-700"
                >
                  <Pause className="w-4 h-4 text-amber-400" />
                  <span className="text-[9px] mt-0.5 font-medium">Jeda</span>
                </button>

                <button
                  id="btn-tetris-restart"
                  onClick={() => sendMessage('.tetris restart', true)}
                  title="Mulai Ulang Permainan"
                  className="py-2 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 rounded-lg text-white flex flex-col items-center justify-center transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-[9px] mt-0.5 font-medium">Ulang</span>
                </button>
              </div>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(inputText);
              }}
              className="bg-slate-950 p-3 border-t border-slate-800 flex items-center gap-2"
            >
              <div className="flex gap-1.5 mr-1">
                <button
                  type="button"
                  onClick={() => sendMessage('.ping')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
                >
                  .ping
                </button>
                <button
                  type="button"
                  onClick={() => sendMessage('.info')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
                >
                  .info
                </button>
                <button
                  type="button"
                  onClick={() => sendMessage('.update')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
                >
                  .update
                </button>
                <button
                  type="button"
                  onClick={() => sendMessage('.tetris')}
                  className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-mono transition cursor-pointer font-bold"
                >
                  .tetris
                </button>
              </div>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type command (e.g. .tetris, .ping, .info, .tetris lb)..."
                className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2 rounded-lg outline-none focus:border-emerald-500 font-mono"
              />

              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>

          {/* Persistent Leaderboard Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">Global Tetris Leaderboard (Persistent Storage)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">TOP 5 High Scores</span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">Belum ada skor tercatat. Mainkan .tetris untuk mencatat rekor pertama!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-medium">Rank</th>
                      <th className="pb-2 font-medium">Player (Masked)</th>
                      <th className="pb-2 font-medium">High Score</th>
                      <th className="pb-2 font-medium">Lines Cleared</th>
                      <th className="pb-2 font-medium">Level</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {leaderboard.map((item, idx) => (
                      <tr key={item.userId} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 font-bold text-amber-400">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>
                        <td className="py-2.5 font-medium text-white">{item.maskedName}</td>
                        <td className="py-2.5 font-mono text-emerald-400 font-bold">{item.score.toLocaleString()}</td>
                        <td className="py-2.5 text-slate-300">{item.lines} lines</td>
                        <td className="py-2.5 text-slate-400">Lv.{item.level}</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">{new Date(item.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
