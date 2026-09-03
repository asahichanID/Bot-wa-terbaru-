import { CommandDefinition, PluginManifest, CommandContext } from './types';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { DatabaseService } from '../database/DatabaseService';
import { EventBus } from './EventBus';
import { Logger } from '../utils/logger';

export abstract class PluginBase {
  abstract readonly manifest: PluginManifest;
  protected commands: Map<string, CommandDefinition> = new Map();
  protected eventBus?: EventBus;
  protected wa?: WhatsAppService;
  protected db?: DatabaseService;
  protected logger!: Logger;
  private unsubscribeCallbacks: Array<() => void> = [];

  init(wa: WhatsAppService, db: DatabaseService, eventBus: EventBus): void {
    this.wa = wa;
    this.db = db;
    this.eventBus = eventBus;
    this.logger = new Logger(`Plugin:${this.manifest.name}`);
  }

  abstract onLoad(): Promise<void> | void;

  onUnload(): Promise<void> | void {
    // Clean up any event listeners
    for (const unsubscribe of this.unsubscribeCallbacks) {
      unsubscribe();
    }
    this.unsubscribeCallbacks = [];
    this.commands.clear();
  }

  protected registerCommand(def: CommandDefinition): void {
    this.commands.set(def.name.toLowerCase(), def);
    if (def.aliases) {
      for (const alias of def.aliases) {
        this.commands.set(alias.toLowerCase(), def);
      }
    }
    this.logger.debug(`Registered command: .${def.name}`);
  }

  protected listenToEvent<K extends keyof import('./types').BotEvents>(
    event: K,
    handler: import('./types').BotEvents[K]
  ): void {
    if (this.eventBus) {
      const unsub = this.eventBus.on(event, handler);
      this.unsubscribeCallbacks.push(unsub);
    }
  }

  getCommands(): CommandDefinition[] {
    // Return unique commands (exclude duplicate alias keys)
    const unique = new Set<CommandDefinition>();
    for (const cmd of this.commands.values()) {
      unique.add(cmd);
    }
    return Array.from(unique);
  }

  findCommand(name: string): CommandDefinition | undefined {
    return this.commands.get(name.toLowerCase());
  }
}
