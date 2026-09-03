/**
 * Database Domain Models
 * Clean separation between User Profile and Game Statistics
 */

export interface UserEntity {
  id: string; // WhatsApp JID or unique ID
  phoneNumber: string; // e.g. 628123456789
  pushName: string; // WhatsApp display name
  nickname?: string;
  createdAt: number;
  lastSeenAt: number;
  role: 'user' | 'admin' | 'owner';
}

export interface GameStatsEntity {
  id: string; // composite: `${gameType}:${userId}`
  userId: string;
  gameType: string; // e.g. 'tetris'
  gamesPlayed: number;
  highScore: number;
  totalScore: number;
  linesCleared: number;
  maxLevel: number;
  lastPlayedAt: number;
  bestCombo: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  maskedName: string;
  score: number;
  lines: number;
  level: number;
  date: number;
}
