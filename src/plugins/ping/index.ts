import { PluginBase } from '../../core/PluginBase';
import { PluginManifest, CommandContext } from '../../core/types';
import { defaultPingConfig, PingPluginConfig } from './config';
import { formatUptime } from '../../utils/timeUtils';

export class PingPlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'ping',
    version: '1.0.0',
    description: 'Ping latency, uptime, and system status',
    author: 'Modular WhatsApp Bot Core',
  };

  private pluginConfig: PingPluginConfig;

  constructor(customConfig?: Partial<PingPluginConfig>) {
    super();
    this.pluginConfig = { ...defaultPingConfig, ...customConfig };
  }

  onLoad(): void {
    if (!this.pluginConfig.enabled) return;

    this.registerCommand({
      name: 'ping',
      aliases: ['p', 'speed'],
      description: 'Cek latensi, uptime, versi bot, dan versi Node.js',
      category: 'General',
      cooldownMs: this.pluginConfig.cooldownMs,
      execute: this.handlePing.bind(this),
    });
  }

  private async handlePing(ctx: CommandContext): Promise<void> {
    const start = Date.now();
    const nodeVersion = process.version;
    const uptime = formatUptime(process.uptime());
    const botVersion = '1.0.0';

    // Calculate response latency
    const latency = Date.now() - start;

    const response =
      `🏓 *PONG!*\n\n` +
      `⚡ *Latency:* \`${latency} ms\`\n` +
      `⏱️ *Uptime:* \`${uptime}\`\n` +
      `🤖 *Bot Version:* \`v${botVersion}\`\n` +
      `📦 *Node Version:* \`${nodeVersion}\`\n` +
      `🌐 *WA Engine:* \`${ctx.wa.getStatus().engineName}\``;

    await ctx.reply(response);
  }
}

export default PingPlugin;
