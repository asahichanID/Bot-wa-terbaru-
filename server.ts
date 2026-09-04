import 'dotenv/config';
import express from 'express';
import path from 'path';
import readline from 'readline';
import { createServer as createViteServer } from 'vite';
import { BotEngine } from './src/core/BotEngine';
import { PingPlugin } from './src/plugins/ping';
import { InfoPlugin } from './src/plugins/info';
import { UpdatePlugin } from './src/plugins/update';
import { UmamusumePlugin } from './src/plugins/umamusume';
import { MusicPlugin } from './src/plugins/music';
import { SimulatorEngine } from './src/whatsapp/SimulatorEngine';
import { BaileysEngine } from './src/whatsapp/BaileysEngine';
import { Logger } from './src/utils/logger';
import { runAllTests } from './src/tests/bot.test';

import { setupConsoleInput } from './src/utils/consoleInput';

const logger = new Logger('Server');
const PORT = parseInt(process.env.PORT || '3000', 10);

import fs from 'fs';

// Detect environment: Pterodactyl, container, or production
const isPterodactyl = !!(
  process.env.P_SERVER_UUID ||
  process.env.P_SERVER_LOCATION ||
  process.cwd().includes('/home/container') ||
  process.env.HOME === '/home/container' ||
  process.env.NODE_ENV === 'production'
);

// Determine initial engine mode: Default to 'baileys' for real WhatsApp connection
let currentEngineMode: 'baileys' | 'simulator' =
  process.env.WA_ENGINE === 'simulator' ? 'simulator' : 'baileys';

// Singleton Process Lock: Ensures only ONE bot instance ever runs on this machine/session
function acquireSingleInstanceLock(): boolean {
  const lockFile = path.join(process.cwd(), 'data', 'bot.pid');
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(lockFile)) {
      const pidStr = fs.readFileSync(lockFile, 'utf8').trim();
      const existingPid = parseInt(pidStr, 10);
      if (existingPid && existingPid !== process.pid) {
        try {
          // Check if the other process is actively running
          process.kill(existingPid, 0);
          logger.warn(`⚠️ Instance bot lain telah aktif berjalan (PID: ${existingPid}). Menutup proses ini agar tidak terjadi bentrok sesi enkripsi WhatsApp (MessageCounterError).`);
          return false;
        } catch {
          // Process does not exist (stale lock file), safe to proceed
        }
      }
    }
    fs.writeFileSync(lockFile, String(process.pid), 'utf8');

    const cleanLock = () => {
      try {
        if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8').trim() === String(process.pid)) {
          fs.unlinkSync(lockFile);
        }
      } catch {}
    };

    process.on('exit', cleanLock);
    process.on('SIGINT', () => { cleanLock(); process.exit(0); });
    process.on('SIGTERM', () => { cleanLock(); process.exit(0); });
    return true;
  } catch {
    return true;
  }
}

// Shared Bot Instance
let botInstance: BotEngine | null = null;

async function initBot() {
  if (botInstance) return botInstance;

  logger.info(`Booting Oguri Cap Bot Engine (Engine: ${currentEngineMode})...`);
  botInstance = new BotEngine({
    waEngine: currentEngineMode,
    botName: process.env.BOT_NAME || 'Oguri Cap',
  });

  botInstance.pluginLoader.registerPlugin(new UmamusumePlugin());
  botInstance.pluginLoader.registerPlugin(new PingPlugin());
  botInstance.pluginLoader.registerPlugin(new InfoPlugin());
  botInstance.pluginLoader.registerPlugin(new UpdatePlugin());
  botInstance.pluginLoader.registerPlugin(new MusicPlugin());

  await botInstance.start();
  logger.info('Oguri Cap bot booted successfully inside server!');
  return botInstance;
}

async function startServer() {
  if (!acquireSingleInstanceLock()) {
    logger.warn('🚫 Instance bot lain terdeteksi aktif. Proses duplikat dibatalkan.');
    process.exit(0);
    return;
  }

  const app = express();
  app.use(express.json());

  // Serve static mascot assets
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
  app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets')));

  // Initialize bot in background
  const botPromise = initBot();

  // Attach interactive console command prompt for Pterodactyl console
  setupConsoleInput(() => botPromise);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Audio Streaming Proxy & CDN for WhatsApp Baileys and Web Player
  app.get('/api/audio/stream', async (req, res) => {
    const targetUrl = req.query.url as string;
    const localAudioPath = path.join(process.cwd(), 'assets', 'audio', 'tracen_preview.mp3');

    if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
      try {
        const audioFetch = await fetch(targetUrl, {
          headers: { 'User-Agent': 'WhatsApp/2.24.6.77 A' },
          signal: AbortSignal.timeout(6000),
        });
        const contentType = audioFetch.headers.get('content-type') || '';
        if (audioFetch.ok && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
          res.setHeader('Content-Type', contentType.includes('audio') ? contentType : 'audio/mpeg');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const arrayBuf = await audioFetch.arrayBuffer();
          res.send(Buffer.from(arrayBuf));
          return;
        }
      } catch (err: any) {
        logger.warn(`Audio proxy failed (${err.message}), falling back to local audio.`);
      }
    }

    if (fs.existsSync(localAudioPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const stream = fs.createReadStream(localAudioPath);
      stream.pipe(res);
    } else {
      res.redirect('https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample.mp3');
    }
  });

  app.get('/api/status', async (req, res) => {
    try {
      const bot = await botPromise;
      const waStatus = bot.wa.getStatus();
      const plugins = bot.pluginLoader.getAllPlugins().map(p => ({
        name: p.manifest.name,
        version: p.manifest.version,
        description: p.manifest.description,
        commandCount: p.getCommands().length,
      }));

      res.json({
        botName: bot.config.botName,
        mascot: 'Oguri Cap (オグリキャップ)',
        theme: 'Uma Musume Pretty Derby',
        mascotImage: '/assets/oguri_cap.jpg',
        uptime: bot.getUptimeSeconds(),
        engineMode: currentEngineMode,
        waStatus,
        plugins,
        commandCount: bot.pluginLoader.getCommandCount(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/logs', (req, res) => {
    res.json({ logs: Logger.getRecentLogs() });
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const bot = await botPromise;
      const top = await bot.db.leaderboard.getTopScores('tetris', 10);
      res.json({ leaderboard: top });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // WhatsApp Chat Simulator API (Allows web users to test commands & Tetris controls in real-time)
  app.get('/api/chat/history', async (req, res) => {
    const bot = await botPromise;
    const engine = bot.wa.getEngine();
    if (engine instanceof SimulatorEngine) {
      res.json({ messages: engine.getChatHistory() });
    } else {
      res.json({ messages: [] });
    }
  });

  app.post('/api/chat/send', async (req, res) => {
    const { text, senderJid, pushName, isControllerAction, displayText } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text message is required' });
      return;
    }

    try {
      const bot = await botPromise;
      const engine = bot.wa.getEngine();
      const jid = senderJid || '6281234567890@s.whatsapp.net';
      const name = pushName || 'WebTester';

      if (engine instanceof SimulatorEngine) {
        await engine.simulateInboundMessage(jid, text, name, !!isControllerAction, displayText);
        res.json({
          success: true,
          lastResponse: engine.getLastOutboundMessage(),
          history: engine.getChatHistory(),
        });
      } else {
        res.status(400).json({
          error: 'Current engine is live Baileys. Use connected phone to send messages or switch to Simulator engine.',
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Request WhatsApp Pairing Code (Baileys)
  app.post('/api/whatsapp/pairing-code', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: 'Nomor telepon wajib diisi (contoh: 628123456789)' });
      return;
    }

    try {
      const bot = await botPromise;
      const engine = bot.wa.getEngine();
      if (engine instanceof BaileysEngine) {
        const code = await engine.requestPairingCode(phoneNumber);
        res.json({ success: true, code });
      } else {
        res.status(400).json({ error: 'Pairing code hanya tersedia saat menggunakan Baileys Engine' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal meminta pairing code' });
    }
  });

  // Switch Engine (Baileys vs Simulator)
  app.post('/api/engine/switch', async (req, res) => {
    const { mode } = req.body;
    if (mode !== 'baileys' && mode !== 'simulator') {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    try {
      const bot = await botPromise;
      if (mode === currentEngineMode) {
        res.json({ success: true, mode });
        return;
      }

      currentEngineMode = mode;
      const newEngine = mode === 'baileys' ? new BaileysEngine() : new SimulatorEngine();
      await bot.wa.switchEngine(newEngine);
      res.json({ success: true, mode, status: bot.wa.getStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Run WAJIB Test Suite via API
  app.post('/api/tests/run', async (req, res) => {
    try {
      logger.info('Running WAJIB Test Suite on demand...');
      await runAllTests();
      res.json({ success: true, message: 'All 6 WAJIB tests passed successfully!' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Static web dashboard or Vite integration
  const distPath = path.join(process.cwd(), 'dist');
  const hasDistHtml = fs.existsSync(path.join(distPath, 'index.html'));

  if (hasDistHtml || process.env.NODE_ENV === 'production' || isPterodactyl) {
    if (hasDistHtml) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      logger.warn('Vite dev middleware skipped:', viteErr.message || viteErr);
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server & Web Dashboard running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', async (e: any) => {
    if (e.code === 'EADDRINUSE') {
      logger.warn(`⚠️ Port ${PORT} sedang digunakan oleh proses lain. Menghentikan instance duplikat untuk mencegah tabrakan sesi enkripsi WhatsApp.`);
      if (botInstance) {
        await botInstance.stop().catch(() => {});
      }
      process.exit(0);
    } else {
      logger.error('HTTP Server error:', e.message || e);
    }
  });
}

startServer().catch(err => {
  logger.error('Failed to start server:', err);
});
