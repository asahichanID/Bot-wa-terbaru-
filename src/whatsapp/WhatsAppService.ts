import { IWhatsAppEngine } from './IWhatsAppEngine';
import { InboundMessage, OutboundContent, ConnectionStatus } from './types';
import { BaileysEngine } from './BaileysEngine';
import { SimulatorEngine } from './SimulatorEngine';
import { Logger } from '../utils/logger';

const logger = new Logger('WhatsAppService');

export class WhatsAppService {
  private engine: IWhatsAppEngine;
  private messageListeners: Array<(msg: InboundMessage) => Promise<void>> = [];
  private connectionListeners: Array<(status: ConnectionStatus) => void> = [];

  constructor(engineType: 'baileys' | 'simulator' = 'baileys') {
    this.engine = engineType === 'simulator' ? new SimulatorEngine() : new BaileysEngine();
    this.setupEngineHooks();
  }

  private setupEngineHooks(): void {
    this.engine.onMessage(async (msg) => {
      for (const listener of this.messageListeners) {
        try {
          await listener(msg);
        } catch (err) {
          logger.error('Error in message listener:', err);
        }
      }
    });

    this.engine.onConnectionUpdate((status) => {
      for (const listener of this.connectionListeners) {
        try {
          listener(status);
        } catch (err) {
          logger.error('Error in connection listener:', err);
        }
      }
    });
  }

  async switchEngine(newEngine: IWhatsAppEngine): Promise<void> {
    logger.info(`Switching WhatsApp engine to: ${newEngine.engineName}`);
    await this.engine.disconnect();
    this.engine = newEngine;
    this.setupEngineHooks();
    await this.engine.init();
    await this.engine.connect();
  }

  getEngine(): IWhatsAppEngine {
    return this.engine;
  }

  async init(): Promise<void> {
    await this.engine.init();
  }

  async connect(): Promise<void> {
    await this.engine.connect();
  }

  async disconnect(): Promise<void> {
    await this.engine.disconnect();
  }

  async sendMessage(to: string, content: OutboundContent): Promise<{ id: string }> {
    return this.engine.sendMessage(to, content);
  }

  async reply(msg: InboundMessage, content: OutboundContent | string): Promise<{ id: string }> {
    const payload: OutboundContent = typeof content === 'string' ? { text: content } : content;
    payload.quotedId = msg.id;
    return this.engine.sendMessage(msg.from, payload);
  }

  onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageListeners.push(handler);
  }

  onConnectionUpdate(handler: (status: ConnectionStatus) => void): void {
    this.connectionListeners.push(handler);
  }

  getStatus(): ConnectionStatus {
    return this.engine.getStatus();
  }
}
