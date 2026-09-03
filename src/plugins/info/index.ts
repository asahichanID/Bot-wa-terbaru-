import os from 'os';
import { PluginBase } from '../../core/PluginBase';
import { PluginManifest, CommandContext } from '../../core/types';
import { defaultInfoConfig, InfoPluginConfig } from './config';
import { formatUptime, formatBytes } from '../../utils/timeUtils';

export class InfoPlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'info',
    version: '1.0.0',
    description: 'Display bot technical details, architecture info, and metrics',
    author: 'Modular WhatsApp Bot Core',
  };

  private pluginConfig: InfoPluginConfig;

  constructor(customConfig?: Partial<InfoPluginConfig>) {
    super();
    this.pluginConfig = { ...defaultInfoConfig, ...customConfig };
  }

  onLoad(): void {
    if (!this.pluginConfig.enabled) return;

    this.registerCommand({
      name: 'info',
      aliases: ['botinfo', 'status', 'about'],
      description: 'Menampilkan detail teknis bot, engine WA, plugin, dan memory',
      category: 'General',
      cooldownMs: this.pluginConfig.cooldownMs,
      execute: this.handleInfo.bind(this),
    });
  }

  private async handleInfo(ctx: CommandContext): Promise<void> {
    const memUsage = process.memoryUsage();
    const uptime = formatUptime(process.uptime());
    const waStatus = ctx.wa.getStatus();

    const response =
      `🤖 *SYSTEM INFORMATION*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *Bot Name:* ${ctx.config.botName}\n` +
      `🏷️ *Version:* v1.0.0 (Production)\n` +
      `⚙️ *Architecture:* Clean Architecture (Modular Plugin-based)\n` +
      `🌐 *WhatsApp Engine:* ${waStatus.engineName}\n` +
      `📶 *Connection State:* \`${waStatus.state.toUpperCase()}\`\n` +
      `⏱️ *Uptime:* ${uptime}\n` +
      `📊 *Memory (RSS):* ${formatBytes(memUsage.rss)}\n` +
      `🧠 *Heap Used:* ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}\n` +
      `💻 *Platform:* ${os.platform()} (${os.arch()}) Node ${process.version}\n` +
      `🚀 *Host Target:* Pterodactyl / Linux Docker Container\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Session storage persists in \`./data/session\` without data loss._`;

    await ctx.reply({
      text: response,
      footer: 'Type .help or .tetris to explore commands',
    });
  }
}

export default InfoPlugin;
