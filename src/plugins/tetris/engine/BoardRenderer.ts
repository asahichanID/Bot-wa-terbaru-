import { GameSnapshot, CellValue } from './types';
import { TETROMINO_EMOJIS, EMPTY_CELL_EMOJI, GHOST_CELL_EMOJI } from './Tetrominoes';
import { LeaderboardEntry } from '../../../database/models';
import { ButtonOption } from '../../../whatsapp/types';

export interface AnimationEffect {
  type?: 'falling' | 'line_clear';
  trailRows?: number[];
  clearedRows?: number[];
  banner?: string;
}

export class BoardRenderer {
  /**
   * Renders the game board, statistics, controls, and top 5 leaderboard into a single WhatsApp message.
   * Features light falling/trail animation and clean text-only buttons without emojis.
   */
  static render(
    game: GameSnapshot,
    topLeaderboard: LeaderboardEntry[],
    personalBest?: number,
    animation?: AnimationEffect
  ): { text: string; buttons: ButtonOption[] } {
    const width = game.board[0]?.length || 10;
    const height = game.board.length;

    // Create a copy of the board for rendering with current falling piece & ghost piece
    const displayGrid: string[][] = [];
    for (let r = 0; r < height; r++) {
      displayGrid[r] = [];
      for (let c = 0; c < width; c++) {
        const val = game.board[r][c];
        displayGrid[r][c] = val ? TETROMINO_EMOJIS[val] : EMPTY_CELL_EMOJI;
      }
    }

    // Line Clear Animation: highlight rows currently being cleared with flash sparkle
    if (animation?.type === 'line_clear' && animation.clearedRows && animation.clearedRows.length > 0) {
      for (const rowIdx of animation.clearedRows) {
        if (rowIdx >= 0 && rowIdx < height) {
          for (let c = 0; c < width; c++) {
            displayGrid[rowIdx][c] = '✨';
          }
        }
      }
    }

    // Calculate Ghost Piece & Falling Animation
    if (game.currentPiece && game.status === 'playing' && animation?.type !== 'line_clear') {
      const ghostY = this.calculateGhostY(game.board, game.currentPiece);

      // Render motion trail during drop
      if (animation?.type === 'falling' && animation.trailRows) {
        for (const tr of animation.trailRows) {
          if (tr >= 0 && tr < height) {
            for (let c = 0; c < game.currentPiece.shape[0].length; c++) {
              const gx = game.currentPiece.x + c;
              if (gx >= 0 && gx < width && displayGrid[tr][gx] === EMPTY_CELL_EMOJI) {
                displayGrid[tr][gx] = '▫️';
              }
            }
          }
        }
      }

      // Render ghost first if not same as current
      if (ghostY !== game.currentPiece.y) {
        for (let r = 0; r < game.currentPiece.shape.length; r++) {
          for (let c = 0; c < game.currentPiece.shape[r].length; c++) {
            if (game.currentPiece.shape[r][c] === 1) {
              const gy = ghostY + r;
              const gx = game.currentPiece.x + c;
              if (gy >= 0 && gy < height && gx >= 0 && gx < width) {
                if (displayGrid[gy][gx] === EMPTY_CELL_EMOJI) {
                  displayGrid[gy][gx] = GHOST_CELL_EMOJI;
                }
              }
            }
          }
        }
      }

      // Render actual falling piece
      for (let r = 0; r < game.currentPiece.shape.length; r++) {
        for (let c = 0; c < game.currentPiece.shape[r].length; c++) {
          if (game.currentPiece.shape[r][c] === 1) {
            const py = game.currentPiece.y + r;
            const px = game.currentPiece.x + c;
            if (py >= 0 && py < height && px >= 0 && px < width) {
              displayGrid[py][px] = game.currentPiece.colorEmoji;
            }
          }
        }
      }
    }

    // Convert grid to text
    const boardLines = displayGrid.map(row => row.join('')).join('\n');

    // Header info
    const nextEmoji = TETROMINO_EMOJIS[game.nextPiece];
    const holdEmoji = game.holdPiece ? TETROMINO_EMOJIS[game.holdPiece] : '—';
    const comboText = game.combo > 1 ? ` 🔥 *Combo x${game.combo}*` : '';

    let statusHeader = '🎮 *WHATSAPP TETRIS*';
    if (animation?.banner) {
      statusHeader = animation.banner;
    } else if (animation?.type === 'line_clear') {
      statusHeader = '✨ *LINE CLEAR!* ✨';
    } else if (animation?.type === 'falling') {
      statusHeader = '⚡ *BALOK MELUNCUR...*';
    } else if (game.status === 'paused') {
      statusHeader = '⏸️ *TETRIS (PAUSED)*';
    } else if (game.status === 'game_over') {
      statusHeader = '💥 *GAME OVER!*';
    }

    // Format Top 5 Leaderboard
    let lbText = '🏆 *TOP 5 LEADERBOARD:*\n';
    if (topLeaderboard.length === 0) {
      lbText += '   _Belum ada skor tercatat. Jadilah yang pertama!_\n';
    } else {
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      for (let i = 0; i < topLeaderboard.length; i++) {
        const entry = topLeaderboard[i];
        const medal = medals[i] || '▫️';
        lbText += `${medal} *${entry.maskedName}* — \`${entry.score.toLocaleString()}\` pts (Lv.${entry.level})\n`;
      }
    }

    const pbScore = personalBest ?? (game.score);
    lbText += `⭐ *Skor Terbaikmu:* \`${pbScore.toLocaleString()}\` pts\n`;

    // Interactive button definitions: STRICTLY NON-EMOJI for premium WhatsApp UI
    const buttons: ButtonOption[] = [
      { id: '.tetris left', text: 'Kiri' },
      { id: '.tetris rotate', text: 'Putar' },
      { id: '.tetris right', text: 'Kanan' },
      { id: '.tetris drop', text: 'Turun' },
      { id: '.tetris hard', text: 'Hard Drop' },
      { id: '.tetris hold', text: 'Hold' },
      { id: '.tetris pause', text: game.status === 'paused' ? 'Lanjut' : 'Jeda' },
      { id: '.tetris restart', text: 'Mulai Ulang' },
    ];

    const controlsGuide =
      `*Tombol Kontrol:*\n` +
      `[ Kiri ] \`.kiri\`   |  [ Putar ] \`.putar\`  |  [ Kanan ] \`.kanan\`\n` +
      `[ Turun ] \`.turun\` |  [ Hard ] \`.hard\`    |  [ Hold ] \`.hold\`\n` +
      `[ Jeda ] \`.jeda\`   |  [ Ulang ] \`.ulang\``;

    const fullText =
      `${statusHeader}\n` +
      `👤 *Pemain:* ${game.playerName}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *Score:* \`${game.score.toLocaleString()}\`${comboText}\n` +
      `📊 *Level:* \`${game.level}\`  |  🧱 *Lines:* \`${game.lines}\`\n` +
      `🔮 *Next:* ${nextEmoji} (${game.nextPiece})  |  📦 *Hold:* ${holdEmoji}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${boardLines}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${controlsGuide}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${lbText}`;

    return { text: fullText, buttons };
  }

  private static calculateGhostY(board: CellValue[][], piece: any): number {
    let ghostY = piece.y;
    const height = board.length;
    const width = board[0].length;

    while (true) {
      const nextY = ghostY + 1;
      let collides = false;

      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c] === 1) {
            const ny = nextY + r;
            const nx = piece.x + c;

            if (ny >= height || (ny >= 0 && board[ny][nx] !== null)) {
              collides = true;
              break;
            }
          }
        }
        if (collides) break;
      }

      if (collides) break;
      ghostY = nextY;
    }

    return ghostY;
  }
}
