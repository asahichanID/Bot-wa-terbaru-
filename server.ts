import 'dotenv/config';
import express from 'express';
import path from 'path';
import readline from 'readline';
import { createServer as createViteServer } from 'vite';
import { BotEngine } from './src/core/BotEngine';
import { PingPlugin } from './src/plugins/ping';
import { InfoPlugin } from './src/plugins/info';
import { UpdatePlugin } from './src/plugins/update';
import { TetrisPlugin } from './src/plugins/tetris';
import { SimulatorEngine } from './src/whatsapp/SimulatorEngine';
import { BaileysEngine } from './src/whatsapp/BaileysEngine';
import { Logger } from './src/utils/logger';
import { runAllTests } from './src/tests/bot.test';

const logger = new Logger('Server');
const PORT = parseInt(process.env.PORT || '3000', 10);

// Detect environment: Pterodactyl, container, or production
const isPterodactyl = !!(
  process.env.P_SERVER_UUID ||
  process.env.P_SERVER_LOCATION ||
  process.cwd().includes('/home/container') ||
  process.env.HOME === '/home/container' ||
  process.env.NODE_ENV === 'production'
);

// Determine initial engine mode: If user explicitly specified WA_ENGINE, respect it.
// In Pterodactyl or production or when PAIRING_NUMBER is given, default to 'baileys'.
let currentEngineMode: 'baileys' | 'simulator' =
  (process.env.WA_ENGINE as 'baileys' | 'simulator') ||
  (isPterodactyl || process.env.PAIRING_NUMBER ? 'baileys' : 'simulator');

// Shared Bot Instance
let botInstance: BotEngine | null = null;

async function initBot() {
  if (botInstance) return botInstance;

  logger.info(`Booting Modular WhatsApp Bot (Engine: ${currentEngineMode})...`);
  botInstance = new BotEngine({
    waEngine: currentEngineMode,
    botName: process.env.BOT_NAME || 'ModularWABot',
  });

  botInstance.pluginLoader.registerPlugin(new PingPlugin());
  botInstance.pluginLoader.registerPlugin(new InfoPlugin());
  botInstance.pluginLoader.registerPlugin(new UpdatePlugin());
  botInstance.pluginLoader.registerPlugin(new TetrisPlugin());

  await botInstance.start();
  logger.info('Bot booted successfully inside server!');
  return botInstance;
}

// Interactive terminal/console listener for Pterodactyl Console
function setupConsoleInput(getBot: () => Promise<BotEngine>) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return;

    // Check if input is a phone number to request pairing code
    const phoneMatch = text.match(/^(?:pair\s+)?(08\d{7,13}|62\d{8,13}|\+\d{9,15}|\d{9,15})$/i);
    if (phoneMatch) {
      let rawNumber = phoneMatch[1].replace(/[^0-9]/g, '');
      if (rawNumber.startsWith('08')) {
        rawNumber = '62' + rawNumber.slice(1);
      }
      logger.info(`[Console] Memproses permintaan pairing code untuk: ${rawNumber}...`);
      try {
        const bot = await getBot();
        let engine = bot.wa.getEngine();
        if (!(engine instanceof BaileysEngine)) {
          logger.info('[Console] Mengaktifkan Baileys Engine untuk koneksi WhatsApp...');
          currentEngineMode = 'baileys';
          engine = new BaileysEngine();
          await bot.wa.switchEngine(engine);
        }
        await (engine as BaileysEngine).requestPairingCode(rawNumber);
      } catch (err: any) {
        logger.error(`[Console] Gagal meminta pairing code untuk ${rawNumber}:`, err.message || err);
      }
      return;
    }

    if (text.toLowerCase() === 'status') {
      try {
        const bot = await getBot();
        const st = bot.wa.getStatus();
        logger.info(`[Status] Engine: ${st.engineName} | Koneksi: ${st.state} | JID: ${st.userJid || 'Belum terhubung'}`);
      } catch (e: any) {
        logger.error('Gagal mengambil status:', e.message);
      }
      return;
    }

    if (text.toLowerCase() === 'help') {
      logger.info('──────────────── Perintah Konsol Pterodactyl ────────────────');
      logger.info('• Ketik nomor HP (misal: 628123456789) -> Meminta Pairing Code WA');
      logger.info('• status -> Menampilkan status koneksi WhatsApp');
      logger.info('─────────────────────────────────────────────────────────────');
      return;
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize bot in background
  const botPromise = initBot();

  // Attach interactive console command prompt for Pterodactyl console
  setupConsoleInput(() => botPromise);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
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

      const tetrisPlugin = bot.pluginLoader.getAllPlugins().find(p => p.manifest.name === 'tetris') as TetrisPlugin;
      const activeGames = tetrisPlugin ? tetrisPlugin.getManager().getActiveGameCount() : 0;

      res.json({
        botName: bot.config.botName,
        uptime: bot.getUptimeSeconds(),
        engineMode: currentEngineMode,
        waStatus,
        plugins,
        commandCount: bot.pluginLoader.getCommandCount(),
        activeTetrisGames: activeGames,
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
    const { text, senderJid, pushName, isControllerAction } = req.body;
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
        await engine.simulateInboundMessage(jid, text, name, !!isControllerAction);
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

  // Vite integration for dev & prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server & Web Dashboard running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  logger.error('Failed to start server:', err);
});
