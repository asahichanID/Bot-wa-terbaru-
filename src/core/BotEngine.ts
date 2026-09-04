import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { DatabaseService } from '../database/DatabaseService';
import { PluginLoader } from './PluginLoader';
import { EventBus } from './EventBus';
import { RateLimiter } from './RateLimiter';
import { ErrorHandler } from './ErrorHandler';
import { InboundMessage, OutboundContent } from '../whatsapp/types';
import { CommandContext } from './types';
import { config, BotConfig } from '../config';
import { Logger } from '../utils/logger';

const logger = new Logger('BotEngine');

export class BotEngine {
  public readonly wa: WhatsAppService;
  public readonly db: DatabaseService;
  public readonly eventBus: EventBus;
  public readonly pluginLoader: PluginLoader;
  public readonly rateLimiter: RateLimiter;
  public readonly errorHandler: ErrorHandler;
  public readonly config: BotConfig;
  private isRunning = false;
  private startTime = Date.now();

  constructor(customConfig?: Partial<BotConfig>, customWaService?: WhatsAppService, customDb?: DatabaseService) {
    this.config = { ...config, ...customConfig };
    this.wa = customWaService || new WhatsAppService(this.config.waEngine);
    this.db = customDb || new DatabaseService();
    this.eventBus = new EventBus();
    this.pluginLoader = new PluginLoader(this.wa, this.db, this.eventBus);
    this.rateLimiter = new RateLimiter(this.config.rateLimitMax, this.config.rateLimitWindowMs);
    this.errorHandler = new ErrorHandler(this.eventBus);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info(`Starting ${this.config.botName}...`);
    this.eventBus.emit('bot:init');

    // 1. Initialize Database
    await this.db.init();

    // 2. Setup Message Dispatcher
    this.wa.onMessage(this.handleInboundMessage.bind(this));

    // 3. Initialize WhatsApp Engine & Connect
    await this.wa.init();
    await this.wa.connect();

    this.eventBus.emit('bot:ready');
    logger.info(`${this.config.botName} initialized successfully!`);

    // Setup Process Handlers for Pterodactyl graceful stop
    this.setupProcessSignals();
  }

  private setupProcessSignals(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    logger.info('Stopping BotEngine...');

    this.eventBus.emit('bot:shutdown');

    // Disconnect WA
    await this.wa.disconnect();

    // Flush database
    await this.db.storage.flush();

    logger.info('BotEngine stopped cleanly.');
  }

  private async handleInboundMessage(msg: InboundMessage): Promise<void> {
    this.eventBus.emit('message:received', msg);

    // Update user profile in database
    await this.db.users.getOrCreate(msg.sender, msg.pushName);

    const text = msg.text.trim();
    if (!text) return;

    logger.info(`📩 [Pesan Masuk] Dari: ${msg.sender} (${msg.pushName || 'User'}) | Teks: "${text}"`);

    // Check prefix or special triggers
    const hasPrefix = text.startsWith(this.config.prefix);
    let trigger = '';
    let rawArgs = '';

    if (hasPrefix) {
      const withoutPrefix = text.slice(this.config.prefix.length).trim();
      const firstSpace = withoutPrefix.indexOf(' ');
      if (firstSpace === -1) {
        trigger = withoutPrefix.toLowerCase();
        rawArgs = '';
      } else {
        trigger = withoutPrefix.slice(0, firstSpace).toLowerCase();
        rawArgs = withoutPrefix.slice(firstSpace + 1).trim();
      }
    } else {
      // Check if message is a button response or single emoji controller
      const lower = text.toLowerCase();
      if (this.pluginLoader.getCommand(lower)) {
        trigger = lower;
        rawArgs = '';
      } else {
        const firstSpace = lower.indexOf(' ');
        if (firstSpace !== -1) {
          const potentialCmd = lower.slice(0, firstSpace).trim();
          if (this.pluginLoader.getCommand(potentialCmd)) {
            trigger = potentialCmd;
            rawArgs = text.slice(firstSpace + 1).trim();
          } else {
            trigger = lower;
          }
        } else {
          trigger = lower;
        }
      }
    }

    const matched = this.pluginLoader.getCommand(trigger);
    if (!matched) {
      logger.debug(`[BotEngine] Perintah "${trigger}" tidak dikenali.`);
      return;
    }

    const { plugin, command } = matched;
    logger.info(`⚡ [Eksekusi Perintah] Menjalankan .${command.name} untuk ${msg.sender}`);

    // Anti-spam / Rate Limiting per user
    const rateCheck = this.rateLimiter.check(msg.sender);
    if (!rateCheck.allowed) {
      logger.warn(`Rate limit exceeded for ${msg.sender}. Silently dropped.`);
      return;
    }

    // Command Cooldown check
    if (command.cooldownMs && command.cooldownMs > 0) {
      const cdCheck = this.rateLimiter.checkCommandCooldown(msg.sender, command.name, command.cooldownMs);
      if (!cdCheck.allowed) {
        const secs = (cdCheck.retryAfterMs / 1000).toFixed(1);
        await this.wa.reply(msg, `⏳ Tunggu *${secs}s* sebelum menggunakan command \`.${command.name}\` lagi.`);
        return;
      }
    }

    // Admin authorization check
    if (command.adminOnly) {
      const cleanSender = msg.sender.replace(/[^0-9]/g, '');
      const isAdmin = this.config.adminNumbers.some(n => cleanSender.includes(n));
      if (!isAdmin) {
        await this.wa.reply(msg, '⛔ Perintah ini hanya dapat dijalankan oleh Admin/Owner.');
        return;
      }
    }

    // Build Execution Context
    const args = rawArgs.length > 0 ? rawArgs.split(/\s+/) : [];
    const ctx: CommandContext = {
      msg,
      command: trigger,
      args,
      rawText: rawArgs,
      reply: (content: OutboundContent | string) => this.wa.reply(msg, content),
      wa: this.wa,
      db: this.db,
      config: this.config,
      logger: new Logger(`Cmd:${command.name}`),
    };

    // Execute with error isolation
    try {
      this.eventBus.emit('command:before', command.name, ctx);
      await command.execute(ctx);
      this.eventBus.emit('command:after', command.name, ctx);
      logger.info(`✅ [Selesai] Perintah .${command.name} berhasil dijalankan untuk ${msg.sender}`);
    } catch (err) {
      logger.error(`❌ [Error] Gagal mengeksekusi .${command.name}:`, err);
      await this.errorHandler.handlePluginError(plugin.manifest.name, err, ctx);
    }
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
