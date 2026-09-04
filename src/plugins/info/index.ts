import os from 'os';
import { PluginBase } from '../../core/PluginBase';
import { PluginManifest, CommandContext } from '../../core/types';
import { defaultInfoConfig, InfoPluginConfig } from './config';
import { formatUptime, formatBytes } from '../../utils/timeUtils';

export class InfoPlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'info',
    version: '2.0.0',
    description: 'Menampilkan data terminal Tracen Academy, engine WhatsApp, dan diagnostik server',
    author: 'Oguri Cap Team',
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
      aliases: ['botinfo', 'about'],
      description: 'Menampilkan detail terminal Tracen Academy, engine WA, dan memory',
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
      `🏛️ *TRACEN ACADEMY TERMINAL INFO*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🐎 *Nama Bot:* Oguri Cap (オグリキャップ)\n` +
      `👑 *Maskot:* The Monster of Kasamatsu (Cinderella Gray)\n` +
      `🏷️ *Versi Sistem:* v2.0.0 (Uma Musume Edition)\n` +
      `🌐 *WhatsApp Engine:* ${waStatus.engineName}\n` +
      `📶 *Status Koneksi:* \`${waStatus.state.toUpperCase()}\`\n` +
      `⏱️ *Waktu Aktif:* ${uptime}\n` +
      `📊 *Penggunaan RAM:* ${formatBytes(memUsage.rss)}\n` +
      `🧠 *Heap Aktif:* ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}\n` +
      `💻 *Platform Server:* ${os.platform()} (${os.arch()}) Node ${process.version}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Ketik *.menu* untuk membuka panduan lengkap Akademi Tracen._`;

    await ctx.reply({
      text: response,
      footer: 'Tracen Academy Central Control • Oguri Cap',
      showMascot: true,
    });
  }
}

export default InfoPlugin;
