import { PluginBase } from '../../core/PluginBase';
import { CommandContext, PluginManifest } from '../../core/types';
import { neoxrService } from './neoxrService';
import { NeoxrYtsItem } from './types';

const OGURI_MUSIC_QUOTES = [
  'Setelah makan kenyang, mendengarkan musik membuat ritme lariku semakin seimbang! 絶好調!',
  'Lagu yang bertenaga! Ini mengingatkanku pada sorak jutaan penonton di lintasan Arima Kinen!',
  'Musik yang menenangkan... seperti semilir angin sepoi di padang rumput Kasamatsu.',
  'Ritme pacuan dan melodi lagu ini berpadu sempurna. Ayo melangkah dengan percaya diri, Trainer!',
  'Setiap detak nada ini mengalirkan energi baru ke langkah kakiku. Mari berlari hingga garis akhir!',
];

function getRandomQuote(): string {
  return OGURI_MUSIC_QUOTES[Math.floor(Math.random() * OGURI_MUSIC_QUOTES.length)];
}

interface MusicSearchSession {
  mode: 'play' | 'play2';
  query: string;
  items: NeoxrYtsItem[];
  timestamp: number;
}

export class MusicPlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'music',
    version: '1.0.0',
    description: 'Tracen Audio Jukebox (.play & .play2) dengan dukungan Neoxr API & UI Spotify WhatsApp',
    author: 'Oguri Cap Team',
  };

  // Active music search sessions for fallback numeric replies (1-30)
  private sessions = new Map<string, MusicSearchSession>();

  onLoad(): void {
    this.logger.info('MusicPlugin loaded with .play, .play2, .yt, and .yt2 commands.');
    this.registerCommands();
  }

  private registerCommands(): void {
    // 1. .play - Interactive search with Spotify UI output
    this.registerCommand({
      name: 'play',
      aliases: ['lagu', 'song', 'music'],
      description: 'Cari & putar lagu YouTube via UI Spotify Tracen (pilihan mengambang maks 30 hasil)',
      category: 'Tracen Jukebox',
      execute: async (ctx: CommandContext) => this.handlePlay(ctx, 'play'),
    });

    // 2. .play2 - Full audio version with separate audio message
    this.registerCommand({
      name: 'play2',
      aliases: ['song2', 'lagufull', 'fullplay'],
      description: 'Cari & unduh lagu YouTube versi audio durasi penuh terpisah',
      category: 'Tracen Jukebox',
      execute: async (ctx: CommandContext) => this.handlePlay(ctx, 'play2'),
    });

    // 3. .yt - Internal / direct processor for Spotify UI (.play target)
    this.registerCommand({
      name: 'yt',
      aliases: ['ytmp3', 'playmp3'],
      description: 'Proses pemutaran lagu YouTube dengan UI Spotify 1-pesan',
      category: 'Tracen Jukebox',
      execute: async (ctx: CommandContext) => this.handleProcessYt(ctx, 'play'),
    });

    // 4. .yt2 - Internal / direct processor for Full Audio (.play2 target)
    this.registerCommand({
      name: 'yt2',
      aliases: ['ytmp3full', 'ytfull'],
      description: 'Proses pemutaran lagu YouTube versi audio durasi penuh terpisah',
      category: 'Tracen Jukebox',
      execute: async (ctx: CommandContext) => this.handleProcessYt(ctx, 'play2'),
    });
  }

  /**
   * Search handler for .play and .play2
   */
  private async handlePlay(ctx: CommandContext, mode: 'play' | 'play2'): Promise<void> {
    const query = ctx.args.join(' ').trim();
    if (!query) {
      await ctx.reply({
        text: `⚠️ *Format salah, Trainer!*\n\nSilakan masukkan judul atau kata kunci lagu yang ingin dicari:\nContoh:\n▫️ *.play Komang*\n▫️ *.play2 Umapyoi Densetsu*`,
        showMascot: true,
        footer: 'Akademi Balap Tracen • Jukebox Music System',
      });
      return;
    }

    // If query is a pure number (e.g. .play 1 or .play2 2)
    if (/^[1-9]\d*$/.test(query)) {
      const session = this.sessions.get(ctx.msg.sender) || this.sessions.get(ctx.msg.from);
      if (session) {
        const idx = parseInt(query, 10) - 1;
        if (idx >= 0 && idx < session.items.length) {
          ctx.args = [session.items[idx].url];
          await this.handleProcessYt(ctx, mode);
          return;
        } else {
          await ctx.reply({
            text: `⚠️ Nomor lagu *${query}* di luar jangkauan (1-${session.items.length}).`,
            footer: 'Tracen Jukebox Selection',
          });
          return;
        }
      }
    }

    // If query is a direct YouTube URL, route directly to processor
    if (query.startsWith('http://') || query.startsWith('https://')) {
      if (mode === 'play2') {
        ctx.args = [query];
        await this.handleProcessYt(ctx, 'play2');
      } else {
        ctx.args = [query];
        await this.handleProcessYt(ctx, 'play');
      }
      return;
    }

    const startTime = Date.now();
    let items: NeoxrYtsItem[] = [];

    try {
      items = await neoxrService.search(query);
    } catch (err: any) {
      this.logger.error(`Error searching YouTube for "${query}":`, err);
    }

    const latencyMs = Date.now() - startTime;
    const latencySec = (latencyMs / 1000).toFixed(2);
    const quote = getRandomQuote();

    if (!items || items.length === 0) {
      await ctx.reply({
        text: `❌ Tidak ditemukan lagu untuk pencarian: "*${query}*"\n⚡ *Kecepatan:* ${latencySec}s (${latencyMs}ms)\n\n💬 _"${quote}"_`,
        showMascot: true,
        footer: 'Tracen Jukebox Search',
      });
      return;
    }

    // Limit to max 30 results as requested
    const displayItems = items.slice(0, 30);
    const cmdPrefix = mode === 'play2' ? '.yt2' : '.yt';

    // Save session for user and chat so they can reply with pure numbers (1-30)
    const sessionData: MusicSearchSession = {
      mode,
      query,
      items: displayItems,
      timestamp: Date.now(),
    };
    this.sessions.set(ctx.msg.sender, sessionData);
    this.sessions.set(ctx.msg.from, sessionData);

    // Interactive quick-reply buttons (taking top options for native WhatsApp buttons)
    const buttonOptions = displayItems.slice(0, 3).map((item, idx) => ({
      id: `${cmdPrefix} ${item.url}`,
      text: `${idx + 1}. ${item.title.substring(0, 20)}`,
    }));

    // Interactive List Payload for native WhatsApp single_select and Web simulator floating picker
    const interactiveItems = displayItems.map((item, idx) => ({
      id: `${cmdPrefix} ${item.url}`,
      title: `${idx + 1}. ${item.title}`,
      description: `${item.author?.name || 'Artist'} • ⏱️ ${item.timestamp || 'N/A'}${item.views ? ` • 👁️ ${Number(item.views).toLocaleString('id-ID')}` : ''}`,
      thumbnail: item.thumbnail,
      duration: item.timestamp,
      author: item.author?.name,
      url: item.url,
      mode,
    }));

    const modeName = mode === 'play2' ? '.PLAY2 (FULL AUDIO)' : '.PLAY (SPOTIFY UI)';
    const text =
`╔═══════════════════════════════════╗
   🎵  *TRACEN JUKEBOX: ${modeName}*  🎵
   *Maskot Resmi: Oguri Cap (オグリキャップ)*
╚═══════════════════════════════════╝

⚡ *Kecepatan Respon:* ${latencySec}s (${latencyMs}ms)
🔍 *Pencarian:* "${query}"
📊 *Total Hasil:* ${displayItems.length} Lagu (Maks. 30 Sesuai API)

💬 *Kutipan Oguri Cap:*
_"${quote}"_

📋 *DAFTAR PILIHAN LAGU (Ketik nomor 1-${displayItems.length} atau gunakan tombol interaktif):*
${displayItems.map((it, i) => `*${i + 1}.* ${it.title} _[${it.timestamp || 'N/A'}]_`).join('\n')}

💡 *Cara Memilih Lagu:*
1️⃣ *Tombol Interaktif WhatsApp:* Tekan tombol interaktif di bawah (*${mode === 'play2' ? 'Pilih Lagu Full' : 'Pilih Lagu Spotify'}*) untuk memilih langsung di menu WhatsApp.
2️⃣ *Balas Angka Saja:* Cukup balas pesan ini dengan mengetik *angka (contoh: 1)* atau *.yt <angka>*.
${mode === 'play' ? '▶️ _Hasil akan diputar langsung via UI Spotify (Preview 1 Menit)._' : '💾 _Hasil akan mengirim info lagu dan berkas audio durasi penuh secara terpisah._'}`;

    await ctx.reply({
      text,
      footer: `Tracen Academy Sound • ${displayItems.length} Lagu Tersedia`,
      showMascot: true,
      buttons: buttonOptions,
      interactiveList: {
        title: `🎵 Tracen Jukebox: "${query}"`,
        buttonText: `🎵 Buka Daftar Lagu (${displayItems.length})`,
        items: interactiveItems,
      },
    });
  }

  /**
   * Processing handler when user selects a song from .play, .play2, or numeric reply (1-30)
   */
  private async handleProcessYt(ctx: CommandContext, mode: 'play' | 'play2'): Promise<void> {
    let targetUrl = ctx.args[0]?.trim();

    // Fallback: If targetUrl is a number (e.g. 1, 2, ... 30) from numeric reply or .yt <number>
    if (targetUrl && /^[1-9]\d*$/.test(targetUrl)) {
      const session = this.sessions.get(ctx.msg.sender) || this.sessions.get(ctx.msg.from);
      if (session) {
        const idx = parseInt(targetUrl, 10) - 1;
        if (idx >= 0 && idx < session.items.length) {
          const selectedItem = session.items[idx];
          mode = session.mode; // Use the search session's intended mode (.play or .play2)
          targetUrl = selectedItem.url;
        } else {
          await ctx.reply({
            text: `⚠️ Nomor lagu *${targetUrl}* di luar jangkauan (1-${session.items.length}). Silakan pilih nomor yang tertera pada daftar.`,
            footer: 'Tracen Jukebox Selection',
          });
          return;
        }
      } else {
        await ctx.reply({
          text: `⚠️ Sesi pemilihan lagu telah kedaluwarsa atau belum ada.\nSilakan cari lagu terlebih dahulu dengan mengetik *.play <judul lagu>*.`,
          footer: 'Tracen Jukebox Selection',
        });
        return;
      }
    }

    if (!targetUrl) {
      await ctx.reply({
        text: '⚠️ URL YouTube tidak valid. Silakan lakukan pencarian ulang dengan *.play <judul>*.',
        showMascot: true,
      });
      return;
    }

    const startTime = Date.now();
    let downloadInfo: any = null;

    try {
      downloadInfo = await neoxrService.getAudioDownload(targetUrl);
    } catch (err: any) {
      this.logger.error(`Error downloading YouTube audio from ${targetUrl}:`, err);
    }

    const latencyMs = Date.now() - startTime;
    const latencySec = (latencyMs / 1000).toFixed(2);
    const quote = getRandomQuote();

    if (!downloadInfo || !downloadInfo.data?.url) {
      await ctx.reply({
        text: `❌ Gagal memproses audio dari YouTube.\n⚡ *Latency:* ${latencySec}s\n\n💬 _"${quote}"_`,
        showMascot: true,
      });
      return;
    }

    const title = downloadInfo.title || 'Unknown Title';
    const channel = downloadInfo.channel || 'Tracen Sound';
    const duration = downloadInfo.duration || '03:00';
    const thumbnail = downloadInfo.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
    const audioUrl = downloadInfo.data.url;
    const size = downloadInfo.data.size || '3.5 MB';
    const views = downloadInfo.views || '1,000,000';
    const videoId = downloadInfo.id || 'fKRtnMYMW08';

    // Ambil bagian tengah lagu 1 menit sebagai preview asli
    const totalSec = downloadInfo.duration_seconds || 180;
    const middleStartSeconds = Math.max(0, Math.floor((totalSec - 60) / 2));

    if (mode === 'play') {
      // .play mode: SPOTIFY UI IN 1 SINGLE MESSAGE (Bukan pesan biasa)
      // Wajib gada statistik / teks kosong, 1 pesan 1 UI penuh tanpa terganggu
      await ctx.reply({
        text: '',
        musicCard: {
          title,
          channel,
          duration: '01:00 (Preview 1 Menit Tengah)',
          fullDuration: duration,
          durationSeconds: 60,
          thumbnail,
          audioUrl,
          videoId,
          middleStartSeconds,
          isSnippetOnly: true,
          botName: 'Oguri Cap • Tracen Sound',
          mode: 'play',
        },
      });
    } else {
      // .play2 mode: 2 SEPARATE MESSAGES
      // Message 1: Thumbnail Ori + Teks Statistik + Quote Maskot
      const statText =
`╔═══════════════════════════════════╗
   🎧  *TRACEN AUDIO PLAYER (.PLAY2)*  🎧
   *Versi Audio Durasi Penuh (Full MP3)*
╚═══════════════════════════════════╝

🎵 *Judul:* ${title}
👤 *Channel / Artis:* ${channel}
⏱️ *Durasi:* ${duration} (Full Duration)
📦 *Ukuran File:* ${size} (${downloadInfo.data.quality || '128kbps'})
👁️ *Penonton:* ${views}
⚡ *Kecepatan Respon:* ${latencySec}s (${latencyMs}ms)

💬 *Kata Oguri Cap:*
_"${quote}"_

─────────────────────────────────────
_Berkas audio versi penuh sedang dikirim di pesan baru di bawah ini..._`;

      await ctx.reply({
        text: statText,
        imageUrl: thumbnail,
        footer: 'Tracen Academy Audio • Full Version',
      });

      // Message 2: Separate Audio File Message
      await ctx.reply({
        text: `🎵 ${title}.mp3`,
        audioUrl,
        audioMimetype: 'audio/mp4',
        footer: `Tracen Sound • ${duration}`,
      });
    }
  }
}
