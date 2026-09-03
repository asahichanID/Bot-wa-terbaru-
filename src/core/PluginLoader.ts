import fs from 'fs';
import path from 'path';
import { PluginBase } from './PluginBase';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { DatabaseService } from '../database/DatabaseService';
import { EventBus } from './EventBus';
import { Logger } from '../utils/logger';
import { CommandDefinition } from './types';

const logger = new Logger('PluginLoader');

export class PluginLoader {
  private plugins: Map<string, PluginBase> = new Map();
  private commandMap: Map<string, { plugin: PluginBase; command: CommandDefinition }> = new Map();
  private wa: WhatsAppService;
  private db: DatabaseService;
  private eventBus: EventBus;

  constructor(wa: WhatsAppService, db: DatabaseService, eventBus: EventBus) {
    this.wa = wa;
    this.db = db;
    this.eventBus = eventBus;
  }

  registerPlugin(plugin: PluginBase): boolean {
    const name = plugin.manifest.name;
    if (this.plugins.has(name)) {
      logger.warn(`Plugin '${name}' is already loaded. Unloading previous instance...`);
      this.unloadPlugin(name);
    }

    try {
      plugin.init(this.wa, this.db, this.eventBus);
      const loadResult = plugin.onLoad();
      if (loadResult instanceof Promise) {
        loadResult.catch((err) => {
          logger.error(`Async error while loading plugin '${name}':`, err);
        });
      }

      this.plugins.set(name, plugin);

      // Register all commands to global command map
      for (const cmd of plugin.getCommands()) {
        this.commandMap.set(cmd.name.toLowerCase(), { plugin, command: cmd });
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            this.commandMap.set(alias.toLowerCase(), { plugin, command: cmd });
          }
        }
      }

      this.eventBus.emit('plugin:loaded', plugin.manifest);
      logger.info(`Loaded plugin: [${plugin.manifest.name} v${plugin.manifest.version}]`);
      return true;
    } catch (err) {
      logger.error(`Failed to load plugin '${name}':`, err);
      return false;
    }
  }

  unloadPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    try {
      plugin.onUnload();

      // Remove its commands
      for (const [key, val] of this.commandMap.entries()) {
        if (val.plugin === plugin) {
          this.commandMap.delete(key);
        }
      }

      this.plugins.delete(name);
      this.eventBus.emit('plugin:unloaded', name);
      logger.info(`Unloaded plugin: ${name}`);
      return true;
    } catch (err) {
      logger.error(`Error unloading plugin '${name}':`, err);
      return false;
    }
  }

  getCommand(trigger: string): { plugin: PluginBase; command: CommandDefinition } | undefined {
    return this.commandMap.get(trigger.toLowerCase());
  }

  getAllPlugins(): PluginBase[] {
    return Array.from(this.plugins.values());
  }

  getAllCommands(): CommandDefinition[] {
    const unique = new Set<CommandDefinition>();
    for (const val of this.commandMap.values()) {
      unique.add(val.command);
    }
    return Array.from(unique);
  }

  getPluginCount(): number {
    return this.plugins.size;
  }

  getCommandCount(): number {
    return this.getAllCommands().length;
  }
}
