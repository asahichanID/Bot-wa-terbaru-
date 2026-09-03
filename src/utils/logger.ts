/**
 * Sanitized Logger Utility
 * Ensures secrets, tokens, and raw session credentials are never leaked in logs.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

const SENSITIVE_PATTERNS = [
  /encKey['":\s]+([^\s,]+)/gi,
  /macKey['":\s]+([^\s,]+)/gi,
  /clientToken['":\s]+([^\s,]+)/gi,
  /serverToken['":\s]+([^\s,]+)/gi,
  /password['":\s]+([^\s,]+)/gi,
  /secret['":\s]+([^\s,]+)/gi,
  /token['":\s]+([^\s,]+)/gi,
  /authorization:\s*bearer\s+([^\s,]+)/gi,
];

export function sanitizeLogString(str: string): string {
  let sanitized = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, p1) => {
      return match.replace(p1, '***REDACTED***');
    });
  }
  return sanitized;
}

export class Logger {
  private scope: string;
  private currentLevel: LogLevel = LogLevel.INFO;
  private static logHistory: Array<{ timestamp: string; level: string; scope: string; message: string }> = [];

  constructor(scope: string) {
    this.scope = scope;
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      this.currentLevel = LogLevel.DEBUG;
    }
  }

  private format(level: LogLevel, message: string, ...args: unknown[]): string {
    const time = new Date().toISOString().substring(11, 19);
    const levelStr = LEVEL_NAMES[level].padEnd(5);
    const formattedArgs = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    const raw = `[${time}] [${levelStr}] [${this.scope}] ${message}${formattedArgs}`;
    const sanitized = sanitizeLogString(raw);

    Logger.logHistory.push({
      timestamp: time,
      level: LEVEL_NAMES[level],
      scope: this.scope,
      message: sanitizeLogString(`${message}${formattedArgs}`),
    });

    if (Logger.logHistory.length > 200) {
      Logger.logHistory.shift();
    }

    return sanitized;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.debug('\x1b[90m' + this.format(LogLevel.DEBUG, message, ...args) + '\x1b[0m');
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log('\x1b[36m' + this.format(LogLevel.INFO, message, ...args) + '\x1b[0m');
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn('\x1b[33m' + this.format(LogLevel.WARN, message, ...args) + '\x1b[0m');
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error('\x1b[31m' + this.format(LogLevel.ERROR, message, ...args) + '\x1b[0m');
    }
  }

  static getRecentLogs() {
    return [...Logger.logHistory];
  }
}
