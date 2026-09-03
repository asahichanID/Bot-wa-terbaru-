import { UserEntity, GameStatsEntity, LeaderboardEntry } from './models';

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
  getOrCreate(id: string, pushName?: string): Promise<UserEntity>;
  updateLastSeen(id: string): Promise<void>;
}

export interface IGameStatsRepository {
  findByUserAndGame(userId: string, gameType: string): Promise<GameStatsEntity | null>;
  save(stats: GameStatsEntity): Promise<void>;
  recordGameResult(
    userId: string,
    gameType: string,
    score: number,
    lines: number,
    level: number,
    combo: number
  ): Promise<{ isNewHighScore: boolean; stats: GameStatsEntity }>;
}

export interface ILeaderboardRepository {
  getTopScores(gameType: string, limit?: number): Promise<LeaderboardEntry[]>;
  getUserRank(userId: string, gameType: string): Promise<{ rank: number; score: number } | null>;
}

export interface IStorageEngine {
  init(): Promise<void>;
  read<T>(collection: string): Promise<Record<string, T>>;
  write<T>(collection: string, data: Record<string, T>): Promise<void>;
  flush(): Promise<void>;
}
