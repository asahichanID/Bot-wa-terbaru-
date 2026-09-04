import readline from 'readline';
import { BotEngine } from '../core/BotEngine';
import { BaileysEngine } from '../whatsapp/BaileysEngine';
import { Logger } from './logger';

const logger = new Logger('Console');

let isInitialized = false;

export function setupConsoleInput(getBot: () => Promise<BotEngine> | BotEngine) {
  if (isInitialized) return;
  isInitialized = true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return;

    // Remove leading slashes or command prefixes (e.g. /6281563808289 or .pair 6281563808289)
    const sanitized = text
      .replace(/^[\/\\]+/, '')
      .replace(/^(?:\.?pair\s+)/i, '')
      .trim();

    // Check if input is a phone number to request pairing code
    const phoneMatch = sanitized.match(/^(08\d{7,13}|62\d{8,13}|\+\d{9,15}|\d{9,15})$/);
    if (phoneMatch) {
      let rawNumber = phoneMatch[1].replace(/[^0-9]/g, '');
      if (rawNumber.startsWith('08')) {
        rawNumber = '62' + rawNumber.slice(1);
      }
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`📲 [Console] Memproses permintaan Pairing Code untuk: +${rawNumber}...`);
      logger.info('═══════════════════════════════════════════════════════════');

      try {
        const bot = await getBot();
        let engine = bot.wa.getEngine();
        if (!(engine instanceof BaileysEngine)) {
          logger.info('[Console] Mengalihkan ke Baileys Engine untuk koneksi WhatsApp asli...');
          engine = new BaileysEngine();
          await bot.wa.switchEngine(engine);
        }
        await (engine as BaileysEngine).requestPairingCode(rawNumber);
      } catch (err: any) {
        logger.error(`[Console] Gagal meminta pairing code untuk ${rawNumber}:`, err.message || err);
      }
      return;
    }

    if (text.toLowerCase() === 'reset' || text.toLowerCase() === 'logout') {
      logger.info('─────────────────────────────────────────────────────────────');
      logger.info('🔄 [Console] Mereset sesi WhatsApp (menghapus folder data/session)...');
      try {
        const bot = await getBot();
        const engine = bot.wa.getEngine();
        if (engine instanceof BaileysEngine) {
          await engine.disconnect();
          engine.clearSession();
          logger.info('✅ [Console] Folder sesi berhasil dibersihkan!');
          logger.info('🚀 [Console] Membuka koneksi baru... Ketik nomor HP Anda untuk meminta pairing code.');
          await engine.connect();
        }
      } catch (e: any) {
        logger.error('[Console] Gagal mereset sesi:', e.message || e);
      }
      logger.info('─────────────────────────────────────────────────────────────');
      return;
    }

    if (text.toLowerCase() === 'reconnect') {
      logger.info('[Console] Menghubungkan ulang socket WhatsApp...');
      try {
        const bot = await getBot();
        const engine = bot.wa.getEngine();
        if (engine instanceof BaileysEngine) {
          await engine.connect();
        }
      } catch (e: any) {
        logger.error('[Console] Gagal menghubungkan ulang:', e.message || e);
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
      logger.info('• Ketik nomor HP (contoh: 6281563808289) -> Minta Pairing Code WA');
      logger.info('• status -> Menampilkan status koneksi bot WhatsApp');
      logger.info('• reset / logout -> Hapus sesi & siapkan koneksi baru');
      logger.info('• reconnect -> Hubungkan ulang socket');
      logger.info('─────────────────────────────────────────────────────────────');
      return;
    }
  });
}
