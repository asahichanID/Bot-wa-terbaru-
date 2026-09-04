import { PluginBase } from '../../core/PluginBase';
import { CommandContext, PluginManifest } from '../../core/types';
import { OguriCapStatus, FoodOption } from './types';

const OGURI_FOODS: Record<string, FoodOption> = {
  wortel: {
    id: 'wortel',
    name: '🥕 Wortel Emas Tracen (Golden Carrot)',
    staminaGain: 20,
    satietyGain: 15,
    description: 'Wortel segar pilihan khusus siswa Akademi Tracen.',
    quote: '"Hmm... Renyah dan manis. Terima kasih, Trainer. Tapi... apa masih ada porsi kedua?"',
  },
  ramen: {
    id: 'ramen',
    name: '🍜 Donburi Ramen Jumbo Kasamatsu',
    staminaGain: 50,
    satietyGain: 35,
    description: 'Semangkuk ramen porsi raksasa khas kampung halaman Kasamatsu.',
    quote: '"Kuahnya meresap sempurna ke dalam tubuhku! Aku merasakan kekuatan Kasamatsu mengalir!"',
  },
  yakiniku: {
    id: 'yakiniku',
    name: '🥩 Paket Daging Yakiniku All-You-Can-Eat',
    staminaGain: 100,
    satietyGain: 60,
    description: 'Daging sapi panggang lezat tanpa batas untuk nafsu makan sang legenda.',
    quote: '"Daging panggang yang luar biasa! Perutku mulai merasa hangat dan bertenaga penuh! 絶好調!"',
  },
  bento: {
    id: 'bento',
    name: '🍱 Bento Kasamatsu Spesial Juara',
    staminaGain: 40,
    satietyGain: 25,
    description: 'Nasi kepal besar dengan lauk pauk bergizi tinggi.',
    quote: '"Nasi kepal ini mengingatkanku pada awal perjuanganku di Kasamatsu. Enak sekali, Trainer."',
  },
};

const UMA_GACHA_POOL = [
  { name: '⭐⭐⭐ Oguri Cap [Starry Nocturne]', role: 'Betweener / Pace', title: 'The Monster of Kasamatsu' },
  { name: '⭐⭐⭐ Tamamo Cross [White Inazuma]', role: 'Chaser / End Closer', title: 'The Inazuma of Kasamatsu' },
  { name: '⭐⭐⭐ Super Creek [Heart of Care]', role: 'Leader / Stayer', title: 'The Generous Matron' },
  { name: '⭐⭐⭐ Inari One [Edo no Hono]', role: 'Chaser / Betweener', title: 'Fire of the Downtown' },
  { name: '⭐⭐⭐ Tokai Teio [Top of the World]', role: 'Leader / Runner', title: 'The Miracle Maiden' },
  { name: '⭐⭐⭐ Mejiro McQueen [Graceful Elegance]', role: 'Leader / Stayer', title: 'Noble Stayer' },
  { name: '⭐⭐⭐ Symboli Rudolf [Emperor of the Turf]', role: 'Leader / Betweener', title: 'The 7 Crown Emperor' },
  { name: '⭐⭐⭐ Silence Suzuka [Silent Horizon]', role: 'Escape Runner', title: 'Sight Beyond Fast' },
  { name: '⭐⭐ Special Week [General Turf]', role: 'Betweener', title: 'Japan\'s No.1 Horse Girl' },
  { name: '⭐⭐ Gold Ship [Unpredictable Wave]', role: 'Chaser', title: 'The Gold Eccentric' },
  { name: '⭐ Haru Urara [Sunshine Runner]', role: 'Chaser / Dirt', title: 'Indomitable Spirit' },
];

export class UmamusumePlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'umamusume',
    version: '2.0.0',
    description: 'Sistem Maskot Oguri Cap & Modul Akademi Balap Tracen (Uma Musume: Pretty Derby)',
    author: 'Oguri Cap Team',
  };

  private oguriStatus: OguriCapStatus = {
    speed: 1050,
    stamina: 980,
    power: 1020,
    guts: 920,
    wit: 880,
    motivation: '絶好調',
    satiety: 65,
    totalMealsConsumed: 124,
    totalRacesWon: 22,
    totalRacesRun: 32,
    favoriteFood: '🥩 Yakiniku Jumbo & 🥕 Wortel Manis',
    skillName: '『勝利の鼓動』(Shouri no Kodou - Heartbeat of Victory)',
  };

  onLoad(): void {
    this.logger.info('Uma Musume Oguri Cap plugin initialized with mascot image integration.');
    this.registerCommands();
  }

  private registerCommands(): void {
    // 1. .menu & .help - Tracen Academy Guidebook
    this.registerCommand({
      name: 'menu',
      aliases: ['help', 'panduan', 'bantuan'],
      description: 'Buka Panduan Tracen Academy & Daftar Perintah Oguri Cap',
      category: 'Tracen Academy',
      execute: async (ctx: CommandContext) => this.handleMenu(ctx),
    });

    // 2. .oguri, .profile, .status - Data Profil Oguri Cap
    this.registerCommand({
      name: 'oguri',
      aliases: ['profile', 'status'],
      description: 'Lihat data statistik & kondisi Oguri Cap saat ini',
      category: 'Tracen Academy',
      execute: async (ctx: CommandContext) => this.handleProfile(ctx),
    });

    // 3. .makan, .feed, .bento, .lapar - Beri Makan Oguri Cap
    this.registerCommand({
      name: 'makan',
      aliases: ['feed', 'bento'],
      description: 'Beri makan Oguri Cap (contoh: .makan ramen / .makan yakiniku)',
      category: 'Tracen Dining',
      execute: async (ctx: CommandContext) => this.handleMakan(ctx),
    });

    this.registerCommand({
      name: 'lapar',
      aliases: ['hunger', 'perut'],
      description: 'Cek tingkat nafsu makan dan rasa lapar Oguri Cap',
      category: 'Tracen Dining',
      execute: async (ctx: CommandContext) => this.handleLapar(ctx),
    });

    // 4. .latih, .training - Latihan Tracen Academy
    this.registerCommand({
      name: 'latih',
      aliases: ['training', 'train'],
      description: 'Latihan Tracen (pilihan: speed, stamina, power, guts, wit)',
      category: 'Tracen Training',
      execute: async (ctx: CommandContext) => this.handleTraining(ctx),
    });

    // 5. .race, .balap - Simulasi Balapan Turf
    this.registerCommand({
      name: 'race',
      aliases: ['balap', 'pacuan'],
      description: 'Mulai simulasi balapan turf bersama Oguri Cap',
      category: 'Tracen Racing',
      execute: async (ctx: CommandContext) => this.handleRace(ctx),
    });

    // 6. .gacha, .scout - Scout Card Tracen
    this.registerCommand({
      name: 'gacha',
      aliases: ['scout', 'tarik'],
      description: 'Scout kartu Uma Musume Tracen Academy',
      category: 'Tracen Scout',
      execute: async (ctx: CommandContext) => this.handleGacha(ctx),
    });

    // 7. .quote - Kutipan Ikonik
    this.registerCommand({
      name: 'quote',
      aliases: ['bicara', 'kata'],
      description: 'Dengarkan kutipan inspiratif dari Oguri Cap',
      category: 'Tracen Academy',
      execute: async (ctx: CommandContext) => this.handleQuote(ctx),
    });
  }

  private async handleMenu(ctx: CommandContext): Promise<void> {
    const trainer = ctx.msg.pushName || 'Trainer';
    const text = 
`╔═══════════════════════════════════╗
   🏇  *TRACEN ACADEMY GUIDEBOOK*  🏇
   *Maskot Resmi: Oguri Cap (オグリキャップ)*
╚═══════════════════════════════════╝
_"Aku tidak akan berhenti berlari sampai melewati garis akhir. Dan... sebelum makan malam!"_

Halo, Trainer *${trainer}*! Selamat datang di bot Tracen Academy. Semua perintah siap dijalankan bersama sang Monster Kasamatsu, Oguri Cap:

🍱 *KONSUMSI & ENERGI OGURI:*
▫️ *.makan* <wortel|ramen|yakiniku|bento>
    Beri makan Oguri Cap untuk menaikkan stamina & mood.
▫️ *.lapar*
    Cek kapasitas nafsu makan & rasa lapar Oguri saat ini.

🏃‍♀️ *LATIHAN & STATUS TRACEN:*
▫️ *.oguri* / *.profile* / *.status*
    Lihat kartu statistik balap & kondisi motivasi Oguri Cap.
▫️ *.latih* <speed|stamina|power|guts|wit>
    Jadwalkan menu latihan intensif di lintasan Tracen.
▫️ *.race* / *.balap*
    Simulasi pacuan balap Turf bergengsi (Arima Kinen, Japan Cup).

✨ *HIBURAN & TRIVIA:*
▫️ *.gacha* / *.scout*
    Pencarian bakat (Scout) Uma Musume bintang 3 Tracen.
▫️ *.quote*
    Dengarkan tekad & kata-kata ikonik dari Oguri Cap.

⚙️ *SISTEM & DIAGNOSTIK:*
▫️ *.ping*
    Cek waktu putaran sprint (lap time) & kondisi lintasan Turf.
▫️ *.info*
    Spesifikasi terminal Tracen Academy & status server bot.

─────────────────────────────────────
*Tips Trainer:* _Gunakan Oguri Cap dengan penuh perhatian, jangan biarkan dia kelaparan saat sesi latihan!_`;

    await ctx.reply({
      text,
      footer: 'Akademi Balap Tracen • Cinderella Gray',
      showMascot: true,
    });
  }

  private async handleProfile(ctx: CommandContext): Promise<void> {
    const s = this.oguriStatus;
    const text =
`╔═══════════════════════════════════╗
   🌟 *PROFIL UMA MUSUME: OGURI CAP* 🌟
   _Title: The Monster of Kasamatsu (笠松の怪物)_
╚═══════════════════════════════════╝

👤 *Nama:* Oguri Cap (オグリキャップ)
🏫 *Akademi:* Tracen Academy (Transfer dari Kasamatsu)
🏆 *Rekor Balap:* ${s.totalRacesWon} Menang / ${s.totalRacesRun} Balapan
❤️ *Motivasi:* [ ${s.motivation} ]
🍱 *Kekenyangan:* ${s.satiety}% / 100%
🍽️ *Makanan Dikonsumsi:* ${s.totalMealsConsumed} Porsi Jumbo

📊 *STATISTIK KEMAMPUAN:*
⚡ *Speed:*   ${s.speed} [S]
🏃 *Stamina:* ${s.stamina} [A+]
💪 *Power:*   ${s.power} [S]
🔥 *Guts:*    ${s.guts} [A]
🧠 *Wit:*     ${s.wit} [A]

🎯 *Gaya Berlari:* Betweener / Late Surger (差・先行)
✨ *Keahlian Khusus:* ${s.skillName}
🍛 *Makanan Favorit:* ${s.favoriteFood}

💬 *Kata Oguri:*
_"Trainer, lintasan hari ini tampak bagus. Setelah latihan nanti, bisakah kita pergi ke kedai yakiniku di seberang stasiun?"_`;

    await ctx.reply({
      text,
      footer: 'Tracen Academy Racer Status Profile',
      showMascot: true,
    });
  }

  private async handleMakan(ctx: CommandContext): Promise<void> {
    const trainer = ctx.msg.pushName || 'Trainer';
    const rawArg = ctx.args[0]?.toLowerCase();
    let foodKey = 'wortel';

    if (rawArg && OGURI_FOODS[rawArg]) {
      foodKey = rawArg;
    } else if (rawArg) {
      const matched = Object.keys(OGURI_FOODS).find(k => k.includes(rawArg));
      if (matched) foodKey = matched;
    }

    const food = OGURI_FOODS[foodKey];
    this.oguriStatus.stamina = Math.min(1200, this.oguriStatus.stamina + food.staminaGain);
    this.oguriStatus.satiety = Math.min(100, this.oguriStatus.satiety + food.satietyGain);
    this.oguriStatus.totalMealsConsumed += 1;
    this.oguriStatus.motivation = '絶好調';

    const text =
`🍽️ *SESI MAKAN BESAR OGURI CAP* 🍽️
─────────────────────────────────────
Trainer *${trainer}* menyuguhkan:
👉 *${food.name}*
_${food.description}_

📈 *Efek Nutrisi:*
• Stamina: +${food.staminaGain} (Sekarang: ${this.oguriStatus.stamina})
• Tingkat Kenyang: +${food.satietyGain}% (Total: ${this.oguriStatus.satiety}%)
• Motivasi Meningkat: *絶好調 (Super Motivated!)* ✨

💬 *Reaksi Oguri:*
${food.quote}

_Nafsu makan Oguri Cap telah terpuaskan dan energinya kembali meluap untuk balapan berikutnya!_`;

    await ctx.reply({
      text,
      footer: 'Oguri Cap Dining Hall • Kasamatsu Taste',
      showMascot: true,
    });
  }

  private async handleLapar(ctx: CommandContext): Promise<void> {
    const s = this.oguriStatus;
    let statusText = '';
    if (s.satiety >= 80) {
      statusText = '😋 Kenyang & Sangat Bersemangat! (Bisa lari 10 putaran lagi!)';
    } else if (s.satiety >= 50) {
      statusText = '🥪 Masih ada ruang untuk 3 porsi ramen lagi.';
    } else if (s.satiety >= 20) {
      statusText = '⚠️ Agak Lapar! Mulai melirik keranjang wortel di kantin.';
    } else {
      statusText = '🚨 Sangat Lapar! Oguri Cap butuh yakiniku secepatnya!';
    }

    const text =
`🍱 *STATUS NAFSU MAKAN OGURI CAP*
─────────────────────────────────────
Tingkat Kekenyangan: [ ${s.satiety}% ]
Status Perut: ${statusText}
Total Porsi Sejak Bergabung: ${s.totalMealsConsumed} Piring

Ketik *.makan <wortel|ramen|yakiniku|bento>* untuk memberinya makanan lezat!`;

    await ctx.reply({
      text,
      footer: 'Tracen Cafeteria Log',
      showMascot: true,
    });
  }

  private async handleTraining(ctx: CommandContext): Promise<void> {
    const trainer = ctx.msg.pushName || 'Trainer';
    const rawType = ctx.args[0]?.toLowerCase() || 'speed';
    const validTypes = ['speed', 'stamina', 'power', 'guts', 'wit'];
    const type = validTypes.includes(rawType) ? rawType : 'speed';

    const gain = Math.floor(Math.random() * 15) + 12;
    let statLabel = 'Speed';

    if (type === 'speed') {
      statLabel = 'Speed ⚡';
      this.oguriStatus.speed = Math.min(1200, this.oguriStatus.speed + gain);
    } else if (type === 'stamina') {
      statLabel = 'Stamina 🏃';
      this.oguriStatus.stamina = Math.min(1200, this.oguriStatus.stamina + gain);
    } else if (type === 'power') {
      statLabel = 'Power 💪';
      this.oguriStatus.power = Math.min(1200, this.oguriStatus.power + gain);
    } else if (type === 'guts') {
      statLabel = 'Guts 🔥';
      this.oguriStatus.guts = Math.min(1200, this.oguriStatus.guts + gain);
    } else {
      statLabel = 'Wit 🧠';
      this.oguriStatus.wit = Math.min(1200, this.oguriStatus.wit + gain);
    }

    // Training burns calories
    this.oguriStatus.satiety = Math.max(10, this.oguriStatus.satiety - 12);

    const text =
`🏃‍♀️ *HASIL LATIHAN TRACEN ACADEMY* 🏃‍♀️
─────────────────────────────────────
Trainer: *${trainer}*
Fokus Latihan: *${statLabel}*

✨ *Peningkatan Kemampuan:*
• Stat ${statLabel}: *+${gain} Poin!*
• Kalori Terbakar: -12% Kenyang (Tersisa: ${this.oguriStatus.satiety}%)

💬 *Komentar Oguri Cap:*
_"Keringat ini terasa memuaskan. Langkah kakiku semakin mantap saat menikung di tikungan akhir. Terima kasih telah melatihku, Trainer!"_`;

    await ctx.reply({
      text,
      footer: 'Tracen Training Grounds',
      showMascot: true,
    });
  }

  private async handleRace(ctx: CommandContext): Promise<void> {
    const races = [
      { name: 'Arima Kinen (有馬記念)', dist: 'Turf 2500m (Nakayama)', rival: 'Tamamo Cross' },
      { name: 'Japan Cup (ジャパンカップ)', dist: 'Turf 2400m (Tokyo)', rival: 'Pay the Butler' },
      { name: 'Mile Championship (マイルCS)', dist: 'Turf 1600m (Kyoto)', rival: 'Bamboo Memory' },
    ];
    const picked = races[Math.floor(Math.random() * races.length)];

    this.oguriStatus.totalRacesRun += 1;
    this.oguriStatus.totalRacesWon += 1;
    this.oguriStatus.satiety = Math.max(5, this.oguriStatus.satiety - 20);

    const text =
`🏁 *PACUAN TURF G1: ${picked.name.toUpperCase()}* 🏁
─────────────────────────────────────
🏟️ Lintasan: ${picked.dist}
🐎 Rival Utama: *${picked.rival}*
🏆 Peserta Unggulan: *Oguri Cap (No. 4)*

📢 *JALANNYA BALAPAN:*
1️⃣ *Start!* Oguri Cap keluar dari gerbang dengan tenang di posisi tengah (Betweener).
2️⃣ *Tikungan Ke-3:* Kecepatan meningkat tajam, Tamamo Cross mencoba menekan dari sisi luar!
3️⃣ *Lurus Terakhir 200m!* Oguri Cap mengaktifkan keahlian:
    ✨ *『${this.oguriStatus.skillName}』* ✨
    Akselerasi dahsyat tak terbendung membelah kerumunan!
4️⃣ *GOAL IN!* Oguri Cap memenangkan perlombaan dengan selisih 1 1/2 panjang kuda! 🥇

🎉 *HASIL AKHIR:*
• Juara 1: *Oguri Cap* (Waktu: 2:34.2)
• Juara 2: *${picked.rival}*

💬 *Oguri Cap di Panggung Kemenangan:*
_"Sorakan para penonton... rasanya luar biasa. Trainer, terima kasih telah percaya padaku. Sekarang, bisakah kita rayakan ini dengan pesta makan?"_`;

    await ctx.reply({
      text,
      footer: 'JRA Grade 1 Turf Championship Victory',
      showMascot: true,
    });
  }

  private async handleGacha(ctx: CommandContext): Promise<void> {
    const picked = UMA_GACHA_POOL[Math.floor(Math.random() * UMA_GACHA_POOL.length)];
    const text =
`🌈 *TRACEN ACADEMY SCOUTING REPORT* 🌈
─────────────────────────────────────
Pintu gerbang emas Tracen terbuka... Pintu berkedip pelangi! ✨

🎉 *HASIL REKRUTMEN:*
👉 *${picked.name}*
• Gaya Lari: ${picked.role}
• Gelar: "${picked.title}"

💬 *Sambutan Selamat Datang:*
_"Aku siap berlari di bawah bimbinganmu di Akademi Tracen!"_`;

    await ctx.reply({
      text,
      footer: 'Tracen Uma Musume Scouting',
      showMascot: true,
    });
  }

  private async handleQuote(ctx: CommandContext): Promise<void> {
    const quotes = [
      '"Aku datang dari Kasamatsu membawa harapan semua orang yang telah mendukungku. Aku tidak akan mengecewakan mereka."',
      '"Tidak ada rahasia dalam kekuatanku. Berlari sekuat tenaga, dan makan dengan lahap."',
      '"Di lintasan balap, yang ada hanyalah garis akhir dan kemauan keras untuk mencapainya pertama kali."',
      '"Trainer, jangan cemas. Selama kita percaya satu sama lain, tidak ada jarak yang tak bisa kita lalui."',
      '"Kemenangan terasa manis, tapi seporsi ramen hangat setelahnya terasa jauh lebih manis."',
    ];
    const picked = quotes[Math.floor(Math.random() * quotes.length)];

    const text =
`💬 *KUTIPAN OGURI CAP (オグリキャップ)*
─────────────────────────────────────
${picked}

— _The Monster of Kasamatsu, Cinderella Gray_`;

    await ctx.reply({
      text,
      footer: 'Oguri Cap Wisdom & Determination',
      showMascot: true,
    });
  }
}
