import { InboundMessage, OutboundContent } from '../whatsapp/types';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { DatabaseService } from '../database/DatabaseService';
import { BotConfig } from '../config';
import { Logger } from '../utils/logger';

export interface CommandContext {
  msg: InboundMessage;
  command: string;
  args: string[];
  rawText: string;
  reply: (content: OutboundContent | string) => Promise<{ id: string }>;
  wa: WhatsAppService;
  db: DatabaseService;
  config: BotConfig;
  logger: Logger;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category?: string;
  cooldownMs?: number;
  adminOnly?: boolean;
  execute: CommandHandler;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
}

export interface BotEvents {
  'bot:init': () => void;
  'bot:ready': () => void;
  'bot:shutdown': () => void;
  'message:received': (msg: InboundMessage) => void;
  'command:before': (command: string, ctx: CommandContext) => void;
  'command:after': (command: string, ctx: CommandContext) => void;
  'plugin:loaded': (manifest: PluginManifest) => void;
  'plugin:unloaded': (pluginName: string) => void;
  'plugin:error': (pluginName: string, error: Error, ctx?: CommandContext) => void;
}
