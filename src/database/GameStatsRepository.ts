import { IGameStatsRepository, IStorageEngine } from './interfaces';
import { GameStatsEntity } from './models';

export class GameStatsRepository implements IGameStatsRepository {
  private storage: IStorageEngine;
  private readonly COLLECTION = 'gameStats';

  constructor(storage: IStorageEngine) {
    this.storage = storage;
  }

  private getKey(userId: string, gameType: string): string {
    return `${gameType}:${userId}`;
  }

  async findByUserAndGame(userId: string, gameType: string): Promise<GameStatsEntity | null> {
    const all = await this.storage.read<GameStatsEntity>(this.COLLECTION);
    return all[this.getKey(userId, gameType)] || null;
  }

  async save(stats: GameStatsEntity): Promise<void> {
    const all = await this.storage.read<GameStatsEntity>(this.COLLECTION);
    all[stats.id] = stats;
    await this.storage.write(this.COLLECTION, all);
  }

  async recordGameResult(
    userId: string,
    gameType: string,
    score: number,
    lines: number,
    level: number,
    combo: number
  ): Promise<{ isNewHighScore: boolean; stats: GameStatsEntity }> {
    const current = (await this.findByUserAndGame(userId, gameType)) || {
      id: this.getKey(userId, gameType),
      userId,
      gameType,
      gamesPlayed: 0,
      highScore: 0,
      totalScore: 0,
      linesCleared: 0,
      maxLevel: 1,
      lastPlayedAt: Date.now(),
      bestCombo: 0,
    };

    const isNewHighScore = score > current.highScore;
    current.gamesPlayed += 1;
    current.totalScore += score;
    current.linesCleared += lines;
    current.lastPlayedAt = Date.now();
    if (score > current.highScore) {
      current.highScore = score;
    }
    if (level > current.maxLevel) {
      current.maxLevel = level;
    }
    if (combo > current.bestCombo) {
      current.bestCombo = combo;
    }

    await this.save(current);
    return { isNewHighScore, stats: current };
  }
}
