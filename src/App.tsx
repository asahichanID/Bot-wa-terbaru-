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
  Check,
  Forward,
  Utensils,
  Flame,
  Award,
  Sparkles,
  Heart,
  Carrot,
  Flag,
  Coffee,
  Info
} from 'lucide-react';

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  commandCount: number;
}

interface BotStatus {
  botName: string;
  mascot?: string;
  theme?: string;
  mascotImage?: string;
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
}

interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  buttons?: Array<{ id: string; text: string }>;
  footer?: string;
  imageUrl?: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('.menu');
  const [logs, setLogs] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<{ running: boolean; message?: string; success?: boolean }>({
    running: false,
  });
  const [selectedTrainer, setSelectedTrainer] = useState('6281234567890@s.whatsapp.net');
  const [trainerName, setTrainerName] = useState('Trainer');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [resStatus, resChat, resLogs] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/chat/history').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
      ]);

      if (resStatus && !resStatus.error) setStatus(resStatus);
      if (resChat?.messages) setChatMessages(resChat.messages);
      if (resLogs?.logs) setLogs(resLogs.logs);
    } catch {
      // Background poll silently
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const switchEngine = async (mode: 'baileys' | 'simulator') => {
    try {
      const res = await fetch('/api/engine/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err: any) {
      alert('Gagal ganti mode: ' + err.message);
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
        body: JSON.stringify({ phoneNumber: pairingPhone.trim() }),
      });
      const data = await res.json();
      if (data.success && data.code) {
        fetchData();
      } else {
        setPairingError(data.error || 'Gagal meminta pairing code.');
      }
    } catch (err: any) {
      setPairingError(err.message || 'Koneksi error.');
    } finally {
      setPairingLoading(false);
    }
  };

  const copyPairingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          senderJid: selectedTrainer,
          pushName: trainerName,
        }),
      });
      const data = await res.json();
      if (data.success && data.history) {
        setChatMessages(data.history);
      }
      if (!textToSend) setInputText('');
    } catch (err: any) {
      console.error('Send error:', err);
    }
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
      fetchData();
    } catch (err: any) {
      setTestResult({
        running: false,
        success: false,
        message: 'Gagal menjalankan test suite: ' + err.message,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <img
            src="/assets/oguri_cap.jpg"
            alt="Oguri Cap"
            className="w-10 h-10 rounded-xl object-cover border border-amber-500/40 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Oguri Cap</span>
                <span className="text-amber-400 text-xs font-normal font-mono">(オグリキャップ)</span>
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Uma Musume • Tracen Academy
              </span>
            </div>
            <p className="text-xs text-slate-400">The Monster of Kasamatsu • Cinderella Gray • Baileys WhatsApp Engine</p>
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
            <span>{testResult.running ? 'Running Tests...' : 'Jalankan 6 Test Wajib'}</span>
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* Left Column: WhatsApp Status & Engine Control */}
        <div className="lg:col-span-4 space-y-5">
          {/* Mascot Profile Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-start gap-4">
              <img
                src="/assets/oguri_cap.jpg"
                alt="Oguri Cap Mascot"
                className="w-20 h-20 rounded-xl object-cover border-2 border-amber-400/50 shadow-md shrink-0"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-100">Oguri Cap</h2>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                    オグリキャップ
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Akademi Balap Tracen • The Monster of Kasamatsu
                </p>
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-300 font-medium">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>Motivasi: <strong>絶好調 (Peak!)</strong></span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              "Aku tidak akan berhenti berlari sampai melewati garis akhir. Dan... sebelum makan malam bersama Trainer!"
            </p>
          </div>

          {/* Engine & Session Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                WhatsApp Transport Layer
              </h2>
              <span className="text-xs text-slate-400 font-mono">v2.0.0</span>
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

            {/* Live Baileys Connection Setup */}
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
                  </div>
                )}
              </div>
            )}

            {/* Test Results Display */}
            {testResult.message && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs border flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{testResult.success ? 'Semua Test Berhasil!' : 'Test Gagal'}</div>
                  <div className="text-[11px] opacity-90">{testResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Plugin & System Diagnostics */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Plugin Tracen Academy ({status?.plugins.length || 0})
              </h2>
            </div>
            <div className="space-y-2">
              {status?.plugins.map((p) => (
                <div key={p.name} className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 capitalize flex items-center gap-1.5">
                      <span>{p.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">v{p.version}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">{p.description}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-300">
                    {p.commandCount} cmd
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: WhatsApp Interactive Chat Simulator & Oguri Action Pad */}
        <div className="lg:col-span-8 flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden h-[750px]">
          {/* Chat Header */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/oguri_cap.jpg"
                alt="Oguri Cap"
                className="w-8 h-8 rounded-lg object-cover border border-amber-500/30"
              />
              <div>
                <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>Oguri Cap (WhatsApp Chat)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </h3>
                <p className="text-[10px] text-slate-400">Pesan Bergambar Otomatis + Teks Caption</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-400 text-[11px]">Trainer:</label>
              <input
                type="text"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono w-28 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/90">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <img
                  src="/assets/oguri_cap.jpg"
                  alt="Oguri Cap"
                  className="w-16 h-16 rounded-2xl object-cover opacity-60 border border-amber-500/20"
                />
                <p className="text-xs">Belum ada percakapan dengan Oguri Cap.</p>
                <p className="text-[11px] text-slate-600">Ketik <code className="text-amber-400">.menu</code> atau klik tombol menu di bawah.</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl overflow-hidden shadow-md text-xs ${
                      msg.direction === 'inbound'
                        ? 'bg-emerald-700 text-white rounded-tr-xs p-3.5'
                        : 'bg-slate-800/95 text-slate-200 border border-slate-700/70 rounded-tl-xs'
                    }`}
                  >
                    {/* Outbound WhatsApp Forwarded Badge */}
                    {msg.direction === 'outbound' && (
                      <div className="px-3.5 pt-2.5 pb-1 text-[11px] text-slate-400 flex items-center gap-1 border-b border-slate-700/50">
                        <Forward className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">Diteruskan</span>
                        <span className="text-slate-400 font-normal">• 🏃‍♀️ Uma Musume: Oguri Cap (オグリキャップ)</span>
                      </div>
                    )}

                    {/* Gambar Mascot Oguri Cap nempel ke teks caption */}
                    {msg.direction === 'outbound' && (msg.imageUrl || true) && (
                      <div className="relative">
                        <img
                          src={msg.imageUrl || '/assets/oguri_cap.jpg'}
                          alt="Oguri Cap Mascot"
                          className="w-full max-h-56 object-cover border-b border-slate-700"
                        />
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] text-amber-300 font-mono">
                          Oguri Cap
                        </div>
                      </div>
                    )}

                    {/* Message Body & Metadata */}
                    <div className="p-3.5 space-y-1.5">
                      <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between gap-4">
                        <span>{msg.direction === 'inbound' ? trainerName : 'Oguri Cap (Tracen)'}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>

                      {/* Message Text Caption */}
                      <div className="leading-relaxed whitespace-pre-wrap font-sans text-[12px]">{msg.text}</div>

                      {msg.footer && (
                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-700/40">
                          _{msg.footer}_
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Action Oguri Cap Pad */}
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Menu Interaktif Oguri Cap (Tracen Academy)
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Gambar + Teks Caption
                </span>
              </span>
              <span className="text-[10px] text-slate-500">Klik perintah untuk menjalankan</span>
            </div>

            {/* Uma Musume Buttons */}
            <div className="grid grid-cols-5 gap-1.5">
              <button
                onClick={() => sendMessage('.menu')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700 text-xs"
              >
                <span>📜</span>
                <span className="font-medium">.menu</span>
              </button>

              <button
                onClick={() => sendMessage('.oguri')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700 text-xs"
              >
                <span>⭐</span>
                <span className="font-medium">.oguri</span>
              </button>

              <button
                onClick={() => sendMessage('.makan ramen')}
                className="py-1.5 px-2 bg-amber-900/50 hover:bg-amber-800/60 active:bg-amber-700/70 rounded-lg text-amber-200 flex items-center justify-center gap-1 transition cursor-pointer border border-amber-700/50 text-xs"
              >
                <span>🍜</span>
                <span className="font-medium">.makan ramen</span>
              </button>

              <button
                onClick={() => sendMessage('.makan yakiniku')}
                className="py-1.5 px-2 bg-rose-900/50 hover:bg-rose-800/60 active:bg-rose-700/70 rounded-lg text-rose-200 flex items-center justify-center gap-1 transition cursor-pointer border border-rose-700/50 text-xs"
              >
                <span>🥩</span>
                <span className="font-medium">.makan yakiniku</span>
              </button>

              <button
                onClick={() => sendMessage('.latih speed')}
                className="py-1.5 px-2 bg-emerald-900/50 hover:bg-emerald-800/60 active:bg-emerald-700/70 rounded-lg text-emerald-200 flex items-center justify-center gap-1 transition cursor-pointer border border-emerald-700/50 text-xs"
              >
                <span>⚡</span>
                <span className="font-medium">.latih speed</span>
              </button>

              <button
                onClick={() => sendMessage('.race')}
                className="py-1.5 px-2 bg-blue-900/50 hover:bg-blue-800/60 active:bg-blue-700/70 rounded-lg text-blue-200 flex items-center justify-center gap-1 transition cursor-pointer border border-blue-700/50 text-xs"
              >
                <span>🏁</span>
                <span className="font-medium">.race Turf</span>
              </button>

              <button
                onClick={() => sendMessage('.gacha')}
                className="py-1.5 px-2 bg-purple-900/50 hover:bg-purple-800/60 active:bg-purple-700/70 rounded-lg text-purple-200 flex items-center justify-center gap-1 transition cursor-pointer border border-purple-700/50 text-xs"
              >
                <span>🌈</span>
                <span className="font-medium">.gacha 3★</span>
              </button>

              <button
                onClick={() => sendMessage('.quote')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700 text-xs"
              >
                <span>💬</span>
                <span className="font-medium">.quote</span>
              </button>

              <button
                onClick={() => sendMessage('.ping')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700 text-xs"
              >
                <span>⏱️</span>
                <span className="font-medium">.ping</span>
              </button>

              <button
                onClick={() => sendMessage('.info')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-100 flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700 text-xs"
              >
                <span>🏛️</span>
                <span className="font-medium">.info</span>
              </button>
            </div>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="bg-slate-950 p-3 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik pesan atau perintah (contoh: .menu, .makan bento, .race)..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
