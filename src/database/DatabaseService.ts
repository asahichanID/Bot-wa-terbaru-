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
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
}
