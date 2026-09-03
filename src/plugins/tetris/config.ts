export interface TetrisConfig {
  boardWidth: number;
  boardHeight: number;
  linesPerLevel: number;
  basePoints: {
    single: number;
    double: number;
    triple: number;
    tetris: number;
    softDrop: number;
    hardDrop: number;
  };
  inactivityTimeoutMs: number; // auto-pause or cleanup inactive games
}

export const defaultTetrisConfig: TetrisConfig = {
  boardWidth: 10,
  boardHeight: 18, // 18 is compact and renders cleanly without truncation on mobile WhatsApp screen!
  linesPerLevel: 10,
  basePoints: {
    single: 100,
    double: 300,
    triple: 500,
    tetris: 800,
    softDrop: 1,
    hardDrop: 2,
  },
  inactivityTimeoutMs: 10 * 60 * 1000, // 10 minutes
};
