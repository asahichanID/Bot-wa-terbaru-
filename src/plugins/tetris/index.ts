import { PluginBase } from '../../core/PluginBase';
import { PluginManifest, CommandContext } from '../../core/types';
import { TetrisManager } from './TetrisManager';
import { defaultTetrisConfig, TetrisConfig } from './config';
import { maskPhoneNumber } from '../../utils/numberMasker';

export class TetrisPlugin extends PluginBase {
  readonly manifest: PluginManifest = {
    name: 'tetris',
    version: '1.0.0',
    description: 'WhatsApp Interactive Tetris with isolated player state & persistent leaderboard',
    author: 'Modular WhatsApp Bot Core',
  };

  private manager!: TetrisManager;
  private pluginConfig: TetrisConfig;

  constructor(customConfig?: Partial<TetrisConfig>) {
    super();
    this.pluginConfig = { ...defaultTetrisConfig, ...customConfig };
  }

  onLoad(): void {
    if (!this.db) {
      throw new Error('Database service required for TetrisPlugin');
    }
    this.manager = new TetrisManager(this.db, this.pluginConfig);

    // Register primary .tetris command
    this.registerCommand({
      name: 'tetris',
      aliases: ['tt', 'game', 'playtetris'],
      description: 'Mainkan game Tetris klasik di WhatsApp dengan leaderboard',
      usage: '.tetris [start|l|r|rot|d|h|hold|pause|restart|stats|lb]',
      category: 'Games',
      execute: this.handleTetrisCommand.bind(this),
    });

    // Register direct text commands & shortcuts for fast one-tap play
    const quickActions: Array<{ name: string; action: string }> = [
      { name: 'kiri', action: 'left' },
      { name: 'kanan', action: 'right' },
      { name: 'putar', action: 'rotate' },
      { name: 'turun', action: 'drop' },
      { name: 'hard', action: 'hard' },
      { name: 'hold', action: 'hold' },
      { name: 'jeda', action: 'pause' },
      { name: 'ulang', action: 'restart' },
      // Direct button symbols & text from the video
      { name: '←', action: 'left' },
      { name: '⬅️', action: 'left' },
      { name: '🔄', action: 'rotate' },
      { name: '→', action: 'right' },
      { name: '➡️', action: 'right' },
      { name: '↓', action: 'drop' },
      { name: '⬇️', action: 'drop' },
      { name: 'jatuhkan', action: 'hard' },
      { name: '⚡', action: 'hard' },
      { name: 'main ulang', action: 'restart' },
      { name: 'mainulang', action: 'restart' },
      { name: 'lanjut', action: 'pause' },
      { name: '📦', action: 'hold' },
      { name: '⏸️', action: 'pause' },
    ];

    for (const qa of quickActions) {
      this.registerCommand({
        name: qa.name,
        description: `Shortcut Tetris: ${qa.action}`,
        category: 'Games',
        execute: async (ctx: CommandContext) => {
          await this.executeGameAction(ctx, qa.action);
        },
      });
    }
  }

  private async handleTetrisCommand(ctx: CommandContext): Promise<void> {
    const sub = (ctx.args[0] || '').toLowerCase();

    if (sub === 'stats' || sub === 'stat') {
      await this.showPlayerStats(ctx);
      return;
    }

    if (sub === 'lb' || sub === 'leaderboard' || sub === 'top') {
      await this.showLeaderboard(ctx);
      return;
    }

    if (sub === 'stop' || sub === 'quit') {
      const existingId = this.manager.getGameMessageId(ctx.msg.sender);
      this.manager.deleteGame(ctx.msg.sender);
      if (existingId) {
        await ctx.reply({
          text: '🛑 *Sesi permainan Tetris telah dihentikan.*\n\n_Ketik \`.tetris\` untuk memulai permainan baru._',
          editId: existingId,
        });
      } else {
        await ctx.reply('🛑 *Sesi permainan Tetris telah dihentikan.*');
      }
      return;
    }

    const forceNew = sub === 'new';

    // Process movements / game actions
    if (['left', 'l', 'kiri', '←', '⬅️'].includes(sub)) {
      await this.executeGameAction(ctx, 'left');
    } else if (['right', 'r', 'kanan', '→', '➡️'].includes(sub)) {
      await this.executeGameAction(ctx, 'right');
    } else if (['rotate', 'rot', 'putar', 'spin', '🔄'].includes(sub)) {
      await this.executeGameAction(ctx, 'rotate');
    } else if (['drop', 'd', 'down', 'turun', '↓', '⬇️'].includes(sub)) {
      await this.executeGameAction(ctx, 'drop');
    } else if (['hard', 'h', 'harddrop', 'jatuh', 'jatuhkan', '⚡'].includes(sub)) {
      await this.executeGameAction(ctx, 'hard');
    } else if (['hold', 'simpan', 'swap', '📦'].includes(sub)) {
      await this.executeGameAction(ctx, 'hold');
    } else if (['pause', 'p', 'jeda', 'resume', 'lanjut', '⏸️'].includes(sub)) {
      await this.executeGameAction(ctx, 'pause');
    } else if (['restart', 'reset', 'ulang', 'mainulang', 'main ulang'].includes(sub)) {
      await this.executeGameAction(ctx, 'restart');
    } else {
      // Default: Start game or render current board (attached in 1 single message)
      const userId = ctx.msg.sender;
      const playerName = ctx.msg.pushName || maskPhoneNumber(userId);
      const game = this.manager.getOrCreateGame(userId, playerName);
      if (game.getStatus() === 'idle' || game.getStatus() === 'game_over') {
        game.start();
      }
      await this.renderAndSendGameState(ctx, userId, playerName, forceNew);
    }
  }

  private async executeGameAction(ctx: CommandContext, action: string): Promise<void> {
    const userId = ctx.msg.sender;
    const playerName = ctx.msg.pushName || maskPhoneNumber(userId);
    const game = this.manager.getOrCreateGame(userId, playerName);

    if (game.getStatus() === 'idle' || game.getStatus() === 'game_over') {
      game.start();
    } else {
      switch (action) {
        case 'left':
          game.moveLeft();
          break;
        case 'right':
          game.moveRight();
          break;
        case 'rotate':
          game.rotate();
          break;
        case 'drop': {
          game.softDrop();
          const existingMsgId = this.manager.getGameMessageId(userId);
          const cleared = game.getLastClearedLines();
          if (cleared.length > 0 && existingMsgId) {
            const flashRender = await this.manager.renderGameState(userId, playerName, {
              type: 'line_clear',
              clearedRows: cleared,
            });
            await ctx.reply({
              text: flashRender.text,
              buttons: flashRender.buttons,
              editId: existingMsgId,
            });
            await new Promise((resolve) => setTimeout(resolve, 90));
          }
          break;
        }
        case 'hard': {
          const destY = game.getHardDropDestinationY();
          const currentY = game.getCurrentPieceY();
          const distance = destY - currentY;
          const existingMsgId = this.manager.getGameMessageId(userId);

          // Light drop animation: render intermediate frame with motion trail if dropping >= 2 rows
          if (distance >= 2 && existingMsgId) {
            const midY = Math.floor(currentY + distance / 2);
            game.setCurrentPieceY(midY);

            const midRender = await this.manager.renderGameState(userId, playerName, {
              type: 'falling',
              trailRows: Array.from({ length: midY - currentY }, (_, i) => currentY + i),
            });

            await ctx.reply({
              text: midRender.text,
              buttons: midRender.buttons,
              editId: existingMsgId,
            });

            // Brief 80ms animation frame duration
            await new Promise((resolve) => setTimeout(resolve, 80));

            // Restore position before executing final hardDrop
            game.setCurrentPieceY(currentY);
          }

          game.hardDrop();

          // Line clear flash animation
          const cleared = game.getLastClearedLines();
          if (cleared.length > 0 && existingMsgId) {
            const flashRender = await this.manager.renderGameState(userId, playerName, {
              type: 'line_clear',
              clearedRows: cleared,
            });
            await ctx.reply({
              text: flashRender.text,
              buttons: flashRender.buttons,
              editId: existingMsgId,
            });
            await new Promise((resolve) => setTimeout(resolve, 90));
          }
          break;
        }
        case 'hold':
          game.hold();
          break;
        case 'pause':
          game.pauseToggle();
          break;
        case 'restart':
          game.restart();
          break;
      }
    }

    await this.renderAndSendGameState(ctx, userId, playerName);
  }

  private async renderAndSendGameState(
    ctx: CommandContext,
    userId: string,
    playerName: string,
    forceNewMessage = false
  ): Promise<void> {
    const rendered = await this.manager.renderGameState(userId, playerName);
    const existingMsgId = forceNewMessage ? undefined : this.manager.getGameMessageId(userId);

    const game = this.manager.getGame(userId);
    const isGameOver = game ? game.getStatus() === 'game_over' : false;

    // Send or edit the message in-place
    const res = await ctx.reply({
      text: rendered.text,
      buttons: rendered.buttons,
      editId: existingMsgId,
    });

    if (res?.id) {
      this.manager.setGameMessageId(userId, res.id);
    }

    if (isGameOver) {
      // Keep or clear tracking
      this.manager.clearGameMessageId(userId);
    }
  }

  private async showPlayerStats(ctx: CommandContext): Promise<void> {
    const userId = ctx.msg.sender;
    const stats = await this.db!.gameStats.findByUserAndGame(userId, 'tetris');
    const rankInfo = await this.db!.leaderboard.getUserRank(userId, 'tetris');

    const displayName = ctx.msg.pushName || maskPhoneNumber(userId);
    const response =
      `📊 *STATISTIK TETRIS PEMAIN*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Pemain:* ${displayName}\n` +
      `🏆 *Peringkat Global:* ${rankInfo ? `#${rankInfo.rank}` : 'Unranked'}\n` +
      `⭐ *High Score:* \`${(stats?.highScore || 0).toLocaleString()}\` pts\n` +
      `🎮 *Total Game Dimainkan:* \`${stats?.gamesPlayed || 0}\` kali\n` +
      `🧱 *Total Lines Cleared:* \`${stats?.linesCleared || 0}\` baris\n` +
      `📈 *Level Tertinggi:* \`Lv.${stats?.maxLevel || 1}\`\n` +
      `🔥 *Best Combo:* \`${stats?.bestCombo || 0}x\`\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Ketik \`.tetris\` untuk mulai bermain!_`;

    await ctx.reply(response);
  }

  private async showLeaderboard(ctx: CommandContext): Promise<void> {
    const top = await this.db!.leaderboard.getTopScores('tetris', 10);
    const rankInfo = await this.db!.leaderboard.getUserRank(ctx.msg.sender, 'tetris');

    let text = `🏆 *TETRIS GLOBAL LEADERBOARD*\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (top.length === 0) {
      text += `_Belum ada rekor tercatat. Mainkan \`.tetris\` sekarang!_\n`;
    } else {
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      for (let i = 0; i < top.length; i++) {
        const item = top[i];
        const medal = medals[i] || '▫️';
        text += `${medal} *${item.maskedName}*\n   Skor: \`${item.score.toLocaleString()}\` | Lines: \`${item.lines}\` (Lv.${item.level})\n`;
      }
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (rankInfo) {
      text += `⭐ Peringkat Anda: *#${rankInfo.rank}* (\`${rankInfo.score.toLocaleString()}\` pts)`;
    } else {
      text += `⭐ Anda belum memiliki skor tercatat di papan peringkat.`;
    }

    await ctx.reply(text);
  }

  getManager(): TetrisManager {
    return this.manager;
  }
}

export default TetrisPlugin;
