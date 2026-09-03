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

    this.registerCommand({
      name: 'help',
      aliases: ['menu', 'bantuan', '?'],
      description: 'Menampilkan daftar perintah lengkap bot',
      category: 'General',
      cooldownMs: this.pluginConfig.cooldownMs,
      execute: this.handleHelp.bind(this),
    });
  }

  private async handleHelp(ctx: CommandContext): Promise<void> {
    const text =
      `📋 *DAFTAR PERINTAH BOT* 🤖\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎮 *GAME TETRIS:*\n` +
      `• \`.tetris\` - Mulai main Tetris (single message update)\n` +
      `• \`.tetris lb\` - Lihat Leaderboard top player\n` +
      `• \`.tetris stats\` - Cek statistik bermain kamu\n` +
      `• \`.tetris stop\` - Berhenti / reset sesi permainan\n\n` +
      `🕹️ *KONTROL CEPAT TETRIS:*\n` +
      `Ketik langsung saat game berjalan:\n` +
      `• \`kiri\` / \`⬅️\` : Geser balok ke kiri\n` +
      `• \`kanan\` / \`➡️\` : Geser balok ke kanan\n` +
      `• \`putar\` / \`🔄\` : Putar rotasi balok\n` +
      `• \`turun\` / \`⬇️\` : Jatuhkan pelan (soft drop)\n` +
      `• \`hard\` / \`⚡\` : Jatuhkan langsung ke dasar\n` +
      `• \`hold\` / \`📦\` : Simpan balok cadangan\n` +
      `• \`jeda\` / \`⏸️\` : Pause / Lanjut game\n` +
      `• \`ulang\` : Mulai ulang permainan baru\n\n` +
      `⚙️ *INFO & SISTEM:*\n` +
      `• \`.ping\` - Cek respon & latensi bot\n` +
      `• \`.info\` - Informasi detail sistem server\n` +
      `• \`.help\` - Menampilkan menu panduan ini\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply({
      text,
      footer: 'Ketik .tetris untuk mulai bermain!',
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
