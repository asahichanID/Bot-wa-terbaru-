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
  private static isSilent: boolean = false;
  private static logHistory: Array<{ timestamp: string; level: string; scope: string; message: string }> = [];

  constructor(scope: string) {
    this.scope = scope;
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      this.currentLevel = LogLevel.DEBUG;
    }
  }

  static setSilent(silent: boolean): void {
    Logger.isSilent = silent;
  }

  static isCurrentlySilent(): boolean {
    return Logger.isSilent;
  }

  private format(level: LogLevel, message: string, ...args: unknown[]): string {
    const time = new Date().toISOString().substring(11, 19);
    const levelStr = LEVEL_NAMES[level].padEnd(5);
    const formattedArgs = args.length > 0
      ? ' ' + args.map(a => {
          if (a instanceof Error) {
            return a.message || String(a);
          }
          if (typeof a === 'object' && a !== null) {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        }).join(' ')
      : '';
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
    const formatted = this.format(LogLevel.DEBUG, message, ...args);
    if (!Logger.isSilent && this.currentLevel <= LogLevel.DEBUG) {
      console.debug('\x1b[90m' + formatted + '\x1b[0m');
    }
  }

  info(message: string, ...args: unknown[]): void {
    const formatted = this.format(LogLevel.INFO, message, ...args);
    if (!Logger.isSilent && this.currentLevel <= LogLevel.INFO) {
      console.log('\x1b[36m' + formatted + '\x1b[0m');
    }
  }

  warn(message: string, ...args: unknown[]): void {
    const formatted = this.format(LogLevel.WARN, message, ...args);
    if (!Logger.isSilent && this.currentLevel <= LogLevel.WARN) {
      console.warn('\x1b[33m' + formatted + '\x1b[0m');
    }
  }

  error(message: string, ...args: unknown[]): void {
    const formatted = this.format(LogLevel.ERROR, message, ...args);
    if (!Logger.isSilent && this.currentLevel <= LogLevel.ERROR) {
      console.error('\x1b[31m' + formatted + '\x1b[0m');
    }
  }

  static getRecentLogs() {
    return [...Logger.logHistory];
  }
}
