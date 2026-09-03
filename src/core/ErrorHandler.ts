import { CommandContext } from './types';
import { Logger } from '../utils/logger';
import { EventBus } from './EventBus';

const logger = new Logger('ErrorHandler');

export class ErrorHandler {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async handlePluginError(pluginName: string, error: unknown, ctx?: CommandContext): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[Plugin: ${pluginName}] Runtime Error: ${err.message}`, err.stack);

    this.eventBus.emit('plugin:error', pluginName, err, ctx);

    if (ctx) {
      try {
        await ctx.reply(
          `⚠️ *Terjadi Kesalahan Pada Fitur*\n` +
          `Fitur \`${pluginName}\` mengalami kendala teknis sementara.\n` +
          `_Pesan error telah dicatat. Bot tetap berjalan normal._`
        );
      } catch (replyErr) {
        logger.error('Failed to send error notification reply:', replyErr);
      }
    }
  }

  handleFatalError(error: unknown, origin: string): void {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[FATAL] Caught from ${origin}: ${err.message}`, err.stack);
  }
}
