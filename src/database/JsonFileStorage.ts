import fs from 'fs';
import path from 'path';
import { IStorageEngine } from './interfaces';
import { Logger } from '../utils/logger';

const logger = new Logger('JsonFileStorage');

export class JsonFileStorage implements IStorageEngine {
  private filePath: string;
  private cache: Record<string, Record<string, unknown>> = {};
  private writeQueue: Promise<void> = Promise.resolve();
  private isInitialized = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.cache = JSON.parse(raw);
      } else {
        this.cache = { users: {}, gameStats: {}, settings: {} };
        this.atomicWriteSync();
      }
      this.isInitialized = true;
      logger.info(`Database loaded from ${this.filePath}`);
    } catch (err) {
      logger.error('Failed to initialize JsonFileStorage, recovering with fresh state', err);
      this.cache = { users: {}, gameStats: {}, settings: {} };
      this.isInitialized = true;
    }
  }

  private atomicWriteSync(): void {
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(this.cache, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  async read<T>(collection: string): Promise<Record<string, T>> {
    if (!this.isInitialized) await this.init();
    return (this.cache[collection] as Record<string, T>) || {};
  }

  async write<T>(collection: string, data: Record<string, T>): Promise<void> {
    if (!this.isInitialized) await this.init();
    this.cache[collection] = data as Record<string, unknown>;

    // Queue atomic write
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const tempPath = `${this.filePath}.tmp.${Date.now()}`;
        await fs.promises.writeFile(tempPath, JSON.stringify(this.cache, null, 2), 'utf-8');
        await fs.promises.rename(tempPath, this.filePath);
      } catch (err) {
        logger.error(`Error flushing database to ${this.filePath}`, err);
      }
    });

    await this.writeQueue;
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }
}
