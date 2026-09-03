import { GameSnapshot, CellValue, Piece, TetrominoType, GameStatus } from './types';
import { PieceBag, createPiece, SHAPES } from './Tetrominoes';
import { TetrisConfig, defaultTetrisConfig } from '../config';

export class TetrisGame {
  readonly userId: string;
  readonly playerName: string;
  private config: TetrisConfig;
  private board: CellValue[][];
  private bag: PieceBag;
  private currentPiece: Piece | null = null;
  private nextPieceType: TetrominoType;
  private holdPieceType: TetrominoType | null = null;
  private canHold = true;
  private score = 0;
  private lines = 0;
  private level = 1;
  private combo = 0;
  private status: GameStatus = 'idle';
  private startedAt = Date.now();
  private lastActionAt = Date.now();
  private lastClearedLines: number[] = [];

  constructor(userId: string, playerName: string, config?: Partial<TetrisConfig>) {
    this.userId = userId;
    this.playerName = playerName;
    this.config = { ...defaultTetrisConfig, ...config };
    this.bag = new PieceBag();
    this.board = this.createEmptyBoard();
    this.nextPieceType = this.bag.next();
  }

  private createEmptyBoard(): CellValue[][] {
    const b: CellValue[][] = [];
    for (let r = 0; r < this.config.boardHeight; r++) {
      b[r] = new Array(this.config.boardWidth).fill(null);
    }
    return b;
  }

  start(): GameSnapshot {
    this.board = this.createEmptyBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = 0;
    this.holdPieceType = null;
    this.canHold = true;
    this.status = 'playing';
    this.startedAt = Date.now();
    this.lastActionAt = Date.now();

    this.spawnNextPiece();
    return this.getSnapshot();
  }

  restart(): GameSnapshot {
    return this.start();
  }

  pauseToggle(): GameSnapshot {
    if (this.status === 'playing') {
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.status = 'playing';
    }
    this.lastActionAt = Date.now();
    return this.getSnapshot();
  }

  moveLeft(): boolean {
    if (this.status !== 'playing' || !this.currentPiece) return false;
    this.lastActionAt = Date.now();

    if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x - 1, this.currentPiece.y)) {
      this.currentPiece.x -= 1;
      return true;
    }
    return false;
  }

  moveRight(): boolean {
    if (this.status !== 'playing' || !this.currentPiece) return false;
    this.lastActionAt = Date.now();

    if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x + 1, this.currentPiece.y)) {
      this.currentPiece.x += 1;
      return true;
    }
    return false;
  }

  rotate(): boolean {
    if (this.status !== 'playing' || !this.currentPiece) return false;
    this.lastActionAt = Date.now();

    const nextRotation = (this.currentPiece.rotation + 1) % 4;
    const nextShape = SHAPES[this.currentPiece.type][nextRotation];

    // Try standard rotation
    if (!this.checkCollision(nextShape, this.currentPiece.x, this.currentPiece.y)) {
      this.currentPiece.shape = nextShape;
      this.currentPiece.rotation = nextRotation;
      return true;
    }

    // Wall kicks: try shifting 1 to left or 1 to right
    if (!this.checkCollision(nextShape, this.currentPiece.x - 1, this.currentPiece.y)) {
      this.currentPiece.x -= 1;
      this.currentPiece.shape = nextShape;
      this.currentPiece.rotation = nextRotation;
      return true;
    }

    if (!this.checkCollision(nextShape, this.currentPiece.x + 1, this.currentPiece.y)) {
      this.currentPiece.x += 1;
      this.currentPiece.shape = nextShape;
      this.currentPiece.rotation = nextRotation;
      return true;
    }

    // Double kick for 'I' piece
    if (this.currentPiece.type === 'I') {
      if (!this.checkCollision(nextShape, this.currentPiece.x - 2, this.currentPiece.y)) {
        this.currentPiece.x -= 2;
        this.currentPiece.shape = nextShape;
        this.currentPiece.rotation = nextRotation;
        return true;
      }
      if (!this.checkCollision(nextShape, this.currentPiece.x + 2, this.currentPiece.y)) {
        this.currentPiece.x += 2;
        this.currentPiece.shape = nextShape;
        this.currentPiece.rotation = nextRotation;
        return true;
      }
    }

    return false;
  }

  softDrop(): boolean {
    if (this.status !== 'playing' || !this.currentPiece) return false;
    this.lastActionAt = Date.now();

    if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y += 1;
      this.score += this.config.basePoints.softDrop;
      return true;
    } else {
      this.lockPiece();
      return true;
    }
  }

  softDropAndGetClears(): number[] {
    const prevCleared = [...this.lastClearedLines];
    this.softDrop();
    return this.lastClearedLines !== prevCleared ? this.lastClearedLines : [];
  }

  hardDrop(): boolean {
    if (this.status !== 'playing' || !this.currentPiece) return false;
    this.lastActionAt = Date.now();

    let dropDistance = 0;
    while (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y += 1;
      dropDistance += 1;
    }

    this.score += dropDistance * this.config.basePoints.hardDrop;
    this.lockPiece();
    return true;
  }

  hardDropAndGetClears(): number[] {
    this.hardDrop();
    return this.lastClearedLines;
  }

  getCurrentPiece(): Piece | null {
    return this.currentPiece;
  }

  getCurrentPieceY(): number {
    return this.currentPiece ? this.currentPiece.y : 0;
  }

  setCurrentPieceY(y: number): void {
    if (this.currentPiece) {
      this.currentPiece.y = y;
    }
  }

  getHardDropDestinationY(): number {
    if (!this.currentPiece) return 0;
    let ghostY = this.currentPiece.y;
    while (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x, ghostY + 1)) {
      ghostY += 1;
    }
    return ghostY;
  }

  getLastClearedLines(): number[] {
    return this.lastClearedLines;
  }

  hold(): boolean {
    if (this.status !== 'playing' || !this.currentPiece || !this.canHold) return false;
    this.lastActionAt = Date.now();

    const currentType = this.currentPiece.type;

    if (this.holdPieceType === null) {
      this.holdPieceType = currentType;
      this.spawnNextPiece();
    } else {
      const swappedType = this.holdPieceType;
      this.holdPieceType = currentType;
      this.currentPiece = createPiece(swappedType, this.config.boardWidth);
      if (this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
        this.status = 'game_over';
      }
    }

    this.canHold = false;
    return true;
  }

  private spawnNextPiece(): void {
    const nextType = this.nextPieceType;
    this.nextPieceType = this.bag.next();
    this.currentPiece = createPiece(nextType, this.config.boardWidth);
    this.canHold = true;

    // Check spawn collision -> Game Over
    if (this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
      this.status = 'game_over';
    }
  }

  private lockPiece(): void {
    if (!this.currentPiece) return;

    for (let r = 0; r < this.currentPiece.shape.length; r++) {
      for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
        if (this.currentPiece.shape[r][c] === 1) {
          const y = this.currentPiece.y + r;
          const x = this.currentPiece.x + c;
          if (y >= 0 && y < this.config.boardHeight && x >= 0 && x < this.config.boardWidth) {
            this.board[y][x] = this.currentPiece.type;
          }
        }
      }
    }

    this.clearLines();
    this.spawnNextPiece();
  }

  private clearLines(): void {
    const fullRows: number[] = [];
    for (let r = 0; r < this.config.boardHeight; r++) {
      if (this.board[r].every(cell => cell !== null)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      this.lastClearedLines = [...fullRows];
      for (let i = fullRows.length - 1; i >= 0; i--) {
        const r = fullRows[i];
        this.board.splice(r, 1);
        this.board.unshift(new Array(this.config.boardWidth).fill(null));
      }

      const clearedCount = fullRows.length;
      this.lines += clearedCount;
      this.combo += 1;

      // Scoring calculation
      let basePoint = 0;
      if (clearedCount === 1) basePoint = this.config.basePoints.single;
      else if (clearedCount === 2) basePoint = this.config.basePoints.double;
      else if (clearedCount === 3) basePoint = this.config.basePoints.triple;
      else if (clearedCount >= 4) basePoint = this.config.basePoints.tetris;

      const comboBonus = (this.combo - 1) * 50 * this.level;
      this.score += basePoint * this.level + comboBonus;

      // Level progression
      const newLevel = Math.floor(this.lines / this.config.linesPerLevel) + 1;
      this.level = newLevel;
    } else {
      this.combo = 0;
    }
  }

  private checkCollision(shape: number[][], x: number, y: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] === 1) {
          const ny = y + r;
          const nx = x + c;

          if (nx < 0 || nx >= this.config.boardWidth || ny >= this.config.boardHeight) {
            return true;
          }

          if (ny >= 0 && this.board[ny][nx] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getStatus(): GameStatus {
    return this.status;
  }

  getSnapshot(): GameSnapshot {
    return {
      userId: this.userId,
      playerName: this.playerName,
      board: this.board.map(row => [...row]),
      currentPiece: this.currentPiece ? { ...this.currentPiece } : null,
      holdPiece: this.holdPieceType,
      canHold: this.canHold,
      nextPiece: this.nextPieceType,
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      status: this.status,
      startedAt: this.startedAt,
      lastActionAt: this.lastActionAt,
    };
  }
}
