export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export type CellValue = null | TetrominoType;

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  type: TetrominoType;
  shape: number[][]; // 2D matrix (1 or 0)
  colorEmoji: string;
  x: number;
  y: number;
  rotation: number;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'game_over';

export interface GameSnapshot {
  userId: string;
  playerName: string;
  board: CellValue[][];
  currentPiece: Piece | null;
  holdPiece: TetrominoType | null;
  canHold: boolean;
  nextPiece: TetrominoType;
  score: number;
  lines: number;
  level: number;
  combo: number;
  status: GameStatus;
  startedAt: number;
  lastActionAt: number;
}
