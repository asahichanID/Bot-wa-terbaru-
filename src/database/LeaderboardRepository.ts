import { IGameStatsRepository, ILeaderboardRepository, IStorageEngine, IUserRepository } from './interfaces';
import { GameStatsEntity, LeaderboardEntry } from './models';
import { maskPhoneNumber } from '../utils/numberMasker';

export class LeaderboardRepository implements ILeaderboardRepository {
  private storage: IStorageEngine;
  private userRepo: IUserRepository;
  private readonly COLLECTION = 'gameStats';

  constructor(storage: IStorageEngine, userRepo: IUserRepository) {
    this.storage = storage;
    this.userRepo = userRepo;
  }

  async getTopScores(gameType: string, limit = 5): Promise<LeaderboardEntry[]> {
    const all = await this.storage.read<GameStatsEntity>(this.COLLECTION);
    const filtered = Object.values(all).filter(entry => entry.gameType === gameType && entry.highScore > 0);

    // Sort descending by highScore
    filtered.sort((a, b) => b.highScore - a.highScore);
    const top = filtered.slice(0, limit);

    const result: LeaderboardEntry[] = [];
    for (let i = 0; i < top.length; i++) {
      const entry = top[i];
      const user = await this.userRepo.findById(entry.userId);
      const displayName = user?.pushName && user.pushName.trim().length > 0 && !user.pushName.includes('@')
        ? user.pushName
        : maskPhoneNumber(entry.userId);

      result.push({
        rank: i + 1,
        userId: entry.userId,
        maskedName: displayName,
        score: entry.highScore,
        lines: entry.linesCleared,
        level: entry.maxLevel,
        date: entry.lastPlayedAt,
      });
    }

    return result;
  }

  async getUserRank(userId: string, gameType: string): Promise<{ rank: number; score: number } | null> {
    const all = await this.storage.read<GameStatsEntity>(this.COLLECTION);
    const filtered = Object.values(all).filter(entry => entry.gameType === gameType && entry.highScore > 0);
    filtered.sort((a, b) => b.highScore - a.highScore);

    const index = filtered.findIndex(entry => entry.userId === userId);
    if (index === -1) return null;

    return {
      rank: index + 1,
      score: filtered[index].highScore,
    };
  }
}
