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
      `🏃‍♀️ *TRACEN SPRINT REPORT (PONG!)* 🏃‍♀️\n\n` +
      `⏱️ *Lap Latency:* \`${latency} ms\`\n` +
      `🏟️ *Race Venue:* \`Tokyo Racecourse (Turf 2400m)\`\n` +
      `🌿 *Turf Condition:* \`Firm (良) - Optimal Racing State\`\n` +
      `⏳ *Trainer Uptime:* \`${uptime}\`\n` +
      `🐎 *Mascot:* \`Oguri Cap (オグリキャップ)\`\n` +
      `📦 *Node Runtime:* \`${nodeVersion}\`\n` +
      `🌐 *WA Engine:* \`${ctx.wa.getStatus().engineName}\`\n\n` +
      `💬 _"Garis akhir sudah terlihat di depan mata, Trainer! Akselerasi puncak siap diluncurkan!"_`;

    await ctx.reply({
      text: response,
      footer: 'Tracen Academy Sprint Diagnostics',
      showMascot: true,
    });
  }
}

export default PingPlugin;
