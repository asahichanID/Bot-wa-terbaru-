import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface BotConfig {
  botName: string;
  prefix: string;
  sessionDir: string;
  databasePath: string;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  adminNumbers: string[];
  port: number;
  nodeEnv: string;
  waEngine: 'baileys' | 'simulator';
  pairingNumber?: string;
  neoxrApiKey?: string;
}

export const config: BotConfig = {
  botName: process.env.BOT_NAME || 'Oguri Cap',
  prefix: process.env.BOT_PREFIX || '.',
  sessionDir: process.env.SESSION_DIR || path.resolve(process.cwd(), 'data', 'session'),
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'database.json'),
  maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10', 10),
  reconnectBaseDelayMs: parseInt(process.env.RECONNECT_BASE_DELAY_MS || '3000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '5000', 10),
  adminNumbers: (process.env.ADMIN_NUMBERS || '').split(',').map(n => n.trim()).filter(Boolean),
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  waEngine: (process.env.WA_ENGINE as 'baileys' | 'simulator') || 'baileys',
  pairingNumber: (() => {
    let num = process.env.PAIRING_NUMBER?.replace(/[^0-9]/g, '');
    if (!num) return undefined;
    if (num.startsWith('08')) num = '62' + num.slice(1);
    return num;
  })(),
  neoxrApiKey: process.env.NEOXR_API_KEY || '',
};
