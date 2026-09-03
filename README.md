# 🤖 Modular WhatsApp Bot (Node.js 20 + TypeScript)

Production-ready, highly modular WhatsApp bot built with Clean Architecture, plugin auto-discovery, persistent session protection, and interactive Tetris game. Designed for seamless deployment on **Pterodactyl Panels**, Docker containers, and VPS environments.

---

## 🏗️ Architecture Overview

```
src/
├── core/                # Core engine & orchestration (isolated from specific features)
│   ├── BotEngine.ts     # Main coordinator & lifecycle manager
│   ├── PluginBase.ts    # Abstract base class for all plugins
│   ├── PluginLoader.ts  # Auto-discovery & dynamic plugin registry
│   ├── EventBus.ts      # Strongly typed asynchronous event bus
│   ├── RateLimiter.ts   # Anti-spam and per-command cooldowns
│   └── ErrorHandler.ts  # Centralized error isolation
├── whatsapp/            # Transport abstraction layer
│   ├── IWhatsAppEngine.ts  # Unified engine interface
│   ├── BaileysEngine.ts    # Baileys Multi-Device (Node 20 pure sockets, no Chromium)
│   ├── SimulatorEngine.ts  # In-memory simulator for zero-delay tests & web preview
│   └── WhatsAppService.ts  # Pluggable engine switcher & message dispatcher
├── database/            # Data layer (Clean separation of User & Game Stats)
│   ├── interfaces.ts    # IUserRepository, IGameStatsRepository, ILeaderboardRepository
│   ├── JsonFileStorage.ts # Atomic disk writes preventing corruption on shutdown
│   ├── UserRepository.ts
│   ├── GameStatsRepository.ts
│   └── LeaderboardRepository.ts # TOP 5 rankings with masked phone numbers
├── plugins/             # 100% self-contained feature plugins
│   ├── ping/            # Latency, uptime, Node version, Bot version
│   ├── info/            # System stats, WA engine, memory, plugin count
│   ├── update/          # Version checker & safe restart without deleting session
│   └── tetris/          # Full 7-tetromino game with isolated state & leaderboard
├── config/              # Centralized environment configuration
└── utils/               # Sanitized logger, number masker, formatters
```

---

## 🧩 Adding a New Feature (Plugin)

To add a new feature, you **only** create a new folder under `src/plugins/`. You **never** need to modify the core, database engine, or any other plugin!

### Example: `src/plugins/quotes/index.ts`

```typescript
import { PluginBase } from '../../core/PluginBase';
import { PluginManifest, CommandContext } from '../../core/types';

export class QuotesPlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'quotes',
    version: '1.0.0',
    description: 'Daily inspirational quotes',
  };

  onLoad(): void {
    this.registerCommand({
      name: 'quote',
      aliases: ['q', 'motivate'],
      description: 'Get an inspirational quote',
      category: 'Fun',
      cooldownMs: 2000,
      execute: async (ctx: CommandContext) => {
        await ctx.reply('✨ "The secret of getting ahead is getting started."');
      },
    });
  }
}

export default QuotesPlugin;
```

---

## 🎮 WhatsApp Tetris Feature

- **Command:** `.tetris` (or `.tetris play`)
- **Movements:**
  - ⬅️ Kiri (`.tetris l`)
  - ➡️ Kanan (`.tetris r`)
  - 🔄 Putar (`.tetris rot`)
  - ⬇️ Soft Drop (`.tetris d`)
  - ⚡ Hard Drop (`.tetris h`)
  - 📦 Hold Piece (`.tetris hold`)
  - ⏸️ Jeda / Lanjut (`.tetris pause`)
  - 🔄 Restart (`.tetris restart`)
- **Single-message UI:** Board, Current Score, Level, Lines, Next Piece preview, Hold Piece preview, and Quick Action buttons / emoji controls.
- **Top 5 Leaderboard:** Displayed below the board with personal best. Numbers are masked for privacy (e.g. `62812****7890`).
- **Isolated State:** Each WhatsApp user plays in their own independent game instance.

---

## 🚀 Pterodactyl Deployment Guide

1. **Egg / Image:** Standard **Node.js 20** (Alpine or Ubuntu).
2. **Build Step:**
   ```bash
   npm install
   npm run build
   ```
3. **Startup Command:**
   ```bash
   node dist/index.js
   ```
4. **Environment Variables:**
   Configure variables via the Pterodactyl Startup tab (see `.env.example`):
   - `BOT_NAME`
   - `BOT_PREFIX=.`
   - `WA_ENGINE=baileys`
   - `SESSION_DIR=./data/session`
   - `DATABASE_PATH=./data/database.json`
5. **Session Safety:**
   `./data/session` is maintained across restarts and updates. Credentials will not be lost.

---

## 🧪 Verification & Tests

Run all 6 mandatory tests:
```bash
npm test
```
Verifies:
1. TypeScript compilation (0 errors).
2. Dynamic plugin addition without core changes.
3. Multi-player Tetris state isolation.
4. Persistent database & leaderboard reload.
5. Plugin error isolation (bot stays running).
6. Auto-reconnect & connection lifecycle.
