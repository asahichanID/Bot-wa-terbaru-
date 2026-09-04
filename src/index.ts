import { BotEngine } from './core/BotEngine';
import { PingPlugin } from './plugins/ping';
import { InfoPlugin } from './plugins/info';
import { UpdatePlugin } from './plugins/update';
import { UmamusumePlugin } from './plugins/umamusume';
import { Logger } from './utils/logger';
import { setupConsoleInput } from './utils/consoleInput';

const logger = new Logger('App');

async function bootstrap() {
  logger.info('==========================================');
  logger.info('   🏇 OGURI CAP - UMA MUSUME BOT (NODE 20) ');
  logger.info('   Tracen Academy & Kasamatsu Legend      ');
  logger.info('==========================================');

  // Initialize Core Bot Engine
  const bot = new BotEngine();

  // Register built-in plugins
  bot.pluginLoader.registerPlugin(new UmamusumePlugin());
  bot.pluginLoader.registerPlugin(new PingPlugin());
  bot.pluginLoader.registerPlugin(new InfoPlugin());
  bot.pluginLoader.registerPlugin(new UpdatePlugin());

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

  // Attach interactive console command prompt for Pterodactyl console
  setupConsoleInput(() => bot);

  return bot;
}

// Auto-run when executed directly or when not in test mode
const isDirectRun =
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  !process.env.TEST_MODE;

if (isDirectRun) {
  bootstrap().catch((err) => {
    logger.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

export { bootstrap };
