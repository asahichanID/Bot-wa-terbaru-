import { IWhatsAppEngine } from './IWhatsAppEngine';
import { InboundMessage, OutboundContent, ConnectionStatus, ConnectionState, MusicCardPayload, InteractiveListPayload } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('SimulatorEngine');

export interface SimulatedChatLog {
  id: string;
  from: string;
  to: string;
  text: string;
  buttons?: Array<{ id: string; text: string }>;
  footer?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioMimetype?: string;
  musicCard?: MusicCardPayload;
  interactiveList?: InteractiveListPayload;
  timestamp: number;
  direction: 'inbound' | 'outbound';
}

export class SimulatorEngine implements IWhatsAppEngine {
  readonly engineName = 'In-Memory WhatsApp Simulator';
  private messageHandlers: Array<(msg: InboundMessage) => Promise<void>> = [];
  private connectionHandlers: Array<(status: ConnectionStatus) => void> = [];
  private state: ConnectionState = 'open';
  private startTime = Date.now();
  private chatHistory: SimulatedChatLog[] = [];
  private lastOutboundMessage?: OutboundContent;

  async init(): Promise<void> {
    logger.info('SimulatorEngine initialized');
  }

  async connect(): Promise<void> {
    this.state = 'open';
    this.notifyConnection();
    logger.info('Simulator WhatsApp Engine connected.');
  }

  async disconnect(): Promise<void> {
    this.state = 'closed';
    this.notifyConnection();
    logger.info('Simulator WhatsApp Engine disconnected.');
  }

  async sendMessage(to: string, content: OutboundContent): Promise<{ id: string }> {
    // If editId is specified, update the message in-place without creating a new message
    if (content.editId) {
      const existing = this.chatHistory.find(m => m.id === content.editId);
      if (existing) {
        existing.text = content.text;
        existing.buttons = content.buttons;
        existing.footer = content.footer;
        existing.timestamp = Date.now();
        this.lastOutboundMessage = content;
        logger.debug(`[Simulator Edited Message In-Place: ${content.editId}]`);
        return { id: content.editId };
      }
    }

    const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.lastOutboundMessage = content;

    const logEntry: SimulatedChatLog = {
      id,
      from: 'bot@s.whatsapp.net',
      to,
      text: content.text,
      buttons: content.buttons,
      footer: content.footer,
      imageUrl: content.imageUrl || (content.showMascot ? '/assets/oguri_cap.jpg' : undefined),
      audioUrl: content.audioUrl,
      audioMimetype: content.audioMimetype,
      musicCard: content.musicCard,
      interactiveList: content.interactiveList,
      timestamp: Date.now(),
      direction: 'outbound',
    };

    this.chatHistory.push(logEntry);
    if (this.chatHistory.length > 100) this.chatHistory.shift();

    logger.debug(`[Simulator Sent to ${to}] ${content.text.substring(0, 60)}...`);
    return { id };
  }

  /**
   * Helper to simulate a user sending a message to the bot
   */
  async simulateInboundMessage(
    from: string,
    text: string,
    pushName = 'Player',
    isControllerAction = false,
    displayText?: string
  ): Promise<void> {
    const id = `in-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (!isControllerAction) {
      const logEntry: SimulatedChatLog = {
        id,
        from,
        to: 'bot@s.whatsapp.net',
        text: displayText || text,
        timestamp: Date.now(),
        direction: 'inbound',
      };
      this.chatHistory.push(logEntry);
      if (this.chatHistory.length > 100) this.chatHistory.shift();
    }

    const msg: InboundMessage = {
      id,
      from,
      sender: from,
      pushName,
      isGroup: false,
      text: text.trim(),
      type: 'text',
      timestamp: Date.now(),
    };

    for (const handler of this.messageHandlers) {
      await handler(msg);
    }
  }

  onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onConnectionUpdate(handler: (status: ConnectionStatus) => void): void {
    this.connectionHandlers.push(handler);
    handler(this.getStatus());
  }

  private notifyConnection(): void {
    const status = this.getStatus();
    for (const handler of this.connectionHandlers) {
      handler(status);
    }
  }

  getStatus(): ConnectionStatus {
    return {
      state: this.state,
      userJid: 'bot@s.whatsapp.net',
      reconnectAttempts: 0,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      engineName: this.engineName,
    };
  }

  getChatHistory(): SimulatedChatLog[] {
    return [...this.chatHistory];
  }

  getLastOutboundMessage(): OutboundContent | undefined {
    return this.lastOutboundMessage;
  }
}
