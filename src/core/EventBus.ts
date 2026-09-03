import { BotEvents } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('EventBus');

type EventKey = keyof BotEvents;

export class EventBus {
  private listeners: Map<EventKey, Set<(...args: any[]) => void>> = new Map();

  on<K extends EventKey>(event: K, listener: BotEvents[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener);

    return () => {
      set.delete(listener);
    };
  }

  emit<K extends EventKey>(event: K, ...args: Parameters<BotEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    for (const listener of set) {
      try {
        listener(...args);
      } catch (err) {
        logger.error(`Error in event listener for ${String(event)}:`, err);
      }
    }
  }

  removeAllListeners(event?: EventKey): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
