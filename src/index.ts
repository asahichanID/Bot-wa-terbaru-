import { BotEngine } from './core/BotEngine';
import { PingPlugin } from './plugins/ping';
import { InfoPlugin } from './plugins/info';
import { UpdatePlugin } from './plugins/update';
import { TetrisPlugin } from './plugins/tetris';
import { Logger } from './utils/logger';

const logger = new Logger('App');

async function bootstrap() {
  logger.info('==========================================');
  logger.info('   MODULAR WHATSAPP BOT (NODE 20)         ');
  logger.info('   Pterodactyl & Container Ready          ');
  logger.info('==========================================');

  // Initialize Core Bot Engine
  const bot = new BotEngine();

  // Register built-in plugins
  bot.pluginLoader.registerPlugin(new PingPlugin());
  bot.pluginLoader.registerPlugin(new InfoPlugin());
  bot.pluginLoader.registerPlugin(new UpdatePlugin());
  bot.pluginLoader.registerPlugin(new TetrisPlugin());

  logger.info(`Loaded ${bot.pluginLoader.getPluginCount()} plugins and ${bot.pluginLoader.getCommandCount()} commands.`);

  // Global exception safety net
  process.on('uncaughtException', (err) => {
    bot.errorHandler.handleFatalError(err, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    bot.errorHandler.handleFatalError(reason, 'unhandledRejection');
  });

  // Start the bot
  await bot.start();
  return bot;
}

// Auto-run when executed directly
if (import.meta.url === `file://${process.argv[1]}` || !process.env.TEST_MODE) {
  bootstrap().catch((err) => {
    logger.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

export { bootstrap };
