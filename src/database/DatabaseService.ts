import { IGameStatsRepository, ILeaderboardRepository, IStorageEngine, IUserRepository } from './interfaces';
import { JsonFileStorage } from './JsonFileStorage';
import { UserRepository } from './UserRepository';
import { GameStatsRepository } from './GameStatsRepository';
import { LeaderboardRepository } from './LeaderboardRepository';
import { config } from '../config';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  public storage: IStorageEngine;
  public users: IUserRepository;
  public gameStats: IGameStatsRepository;
  public leaderboard: ILeaderboardRepository;

  constructor(storageEngine?: IStorageEngine) {
    this.storage = storageEngine || new JsonFileStorage(config.databasePath);
    this.users = new UserRepository(this.storage);
    this.gameStats = new GameStatsRepository(this.storage);
    this.leaderboard = new LeaderboardRepository(this.storage, this.users);
  }

  async init(): Promise<void> {
    await this.storage.init();

    // Seed initial records for leaderboard if empty (matching video demo leaderboard)
    const existing = await this.leaderboard.getTopScores('tetris', 1);
    if (existing.length === 0) {
      const initialSeed = [
        { userId: '62898765290@s.whatsapp.net', score: 350, lines: 3, level: 1 },
        { userId: '22891234111@s.whatsapp.net', score: 200, lines: 2, level: 1 },
        { userId: '62851234926@s.whatsapp.net', score: 100, lines: 1, level: 1 },
        { userId: '25491234037@s.whatsapp.net', score: 50, lines: 0, level: 1 },
        { userId: '62851234970@s.whatsapp.net', score: 50, lines: 0, level: 1 },
      ];
      for (const s of initialSeed) {
        await this.gameStats.recordGameResult(s.userId, 'tetris', s.score, s.lines, s.level, 1);
      }
    }
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
}
