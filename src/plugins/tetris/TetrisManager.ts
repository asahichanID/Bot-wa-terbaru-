import { TetrisGame } from './engine/TetrisGame';
import { BoardRenderer, AnimationEffect } from './engine/BoardRenderer';
import { DatabaseService } from '../../database/DatabaseService';
import { TetrisConfig, defaultTetrisConfig } from './config';
import { ButtonOption } from '../../whatsapp/types';

export class TetrisManager {
  private activeGames: Map<string, TetrisGame> = new Map();
  private gameMessageIds: Map<string, string> = new Map();
  private db: DatabaseService;
  private config: TetrisConfig;

  constructor(db: DatabaseService, config?: Partial<TetrisConfig>) {
    this.db = db;
    this.config = { ...defaultTetrisConfig, ...config };
  }

  getOrCreateGame(userId: string, playerName: string): TetrisGame {
    let game = this.activeGames.get(userId);
    if (!game) {
      game = new TetrisGame(userId, playerName, this.config);
      this.activeGames.set(userId, game);
    }
    return game;
  }

  getGame(userId: string): TetrisGame | undefined {
    return this.activeGames.get(userId);
  }

  hasActiveGame(userId: string): boolean {
    const game = this.activeGames.get(userId);
    return !!game && game.getStatus() === 'playing';
  }

  setGameMessageId(userId: string, messageId: string): void {
    this.gameMessageIds.set(userId, messageId);
  }

  getGameMessageId(userId: string): string | undefined {
    return this.gameMessageIds.get(userId);
  }

  clearGameMessageId(userId: string): void {
    this.gameMessageIds.delete(userId);
  }

  deleteGame(userId: string): void {
    this.activeGames.delete(userId);
    this.gameMessageIds.delete(userId);
  }

  async renderGameState(
    userId: string,
    playerName: string,
    animation?: AnimationEffect
  ): Promise<{ text: string; buttons: ButtonOption[] }> {
    const game = this.getOrCreateGame(userId, playerName);
    const snapshot = game.getSnapshot();

    // Check personal best & record game results if game over
    const userStats = await this.db.gameStats.findByUserAndGame(userId, 'tetris');
    const pbScore = userStats?.highScore ?? 0;

    if (snapshot.status === 'game_over' && snapshot.score > 0) {
      await this.db.gameStats.recordGameResult(
        userId,
        'tetris',
        snapshot.score,
        snapshot.lines,
        snapshot.level,
        snapshot.combo
      );
    }

    const top5 = await this.db.leaderboard.getTopScores('tetris', 5);
    return BoardRenderer.render(snapshot, top5, pbScore, animation);
  }

  getActiveGameCount(): number {
    return this.activeGames.size;
  }
}
