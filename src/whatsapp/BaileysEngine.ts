import path from 'path';
import fs from 'fs';
import { IWhatsAppEngine } from './IWhatsAppEngine';
import { InboundMessage, OutboundContent, ConnectionStatus, ConnectionState } from './types';
import { Logger } from '../utils/logger';
import { config } from '../config';
import QRCode from 'qrcode';

const logger = new Logger('BaileysEngine');

export class BaileysEngine implements IWhatsAppEngine {
  readonly engineName = 'Baileys Multi-Device (Node 20)';
  private socket: any = null;
  private messageHandlers: Array<(msg: InboundMessage) => Promise<void>> = [];
  private connectionHandlers: Array<(status: ConnectionStatus) => void> = [];
  private state: ConnectionState = 'disconnected';
  private qrCodeString?: string;
  private pairingCodeString?: string;
  private userJid?: string;
  private reconnectAttempts = 0;
  private startTime = Date.now();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  async init(): Promise<void> {
    const sessionPath = path.resolve(config.sessionDir);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    logger.info(`Initialized Baileys session storage at: ${sessionPath}`);
  }

  async connect(): Promise<void> {
    this.isIntentionallyClosed = false;
    this.updateState('connecting');

    try {
      // Dynamic import to support ESM / CJS cleanly
      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason, Browsers } = baileys;

      const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);

      // Silent / minimal pino logger to avoid cluttering stdout
      const pino = (await import('pino')).default;
      const silentLogger = pino({ level: 'silent' });

      this.socket = makeWASocket({
        auth: state,
        logger: silentLogger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info('New QR code received. Scan with WhatsApp.');
          try {
            // Generate QR data URL for web dashboard
            this.qrCodeString = await QRCode.toDataURL(qr);
            // Also print small ASCII QR to terminal if possible
            QRCode.toString(qr, { type: 'terminal', small: true }, (err, str) => {
              if (!err && str) console.log('\n' + str);
            });
          } catch {
            this.qrCodeString = qr;
          }
          this.notifyConnection();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isIntentionallyClosed;

          logger.warn(`Connection closed. Status code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
          this.updateState('disconnected');

          if (shouldReconnect) {
            this.scheduleReconnect();
          } else {
            this.updateState('closed');
          }
        } else if (connection === 'open') {
          this.reconnectAttempts = 0;
          this.qrCodeString = undefined;
          this.pairingCodeString = undefined;
          this.userJid = this.socket?.user?.id;
          this.updateState('open');
          logger.info(`WhatsApp connection established successfully! JID: ${this.userJid}`);
        }
      });

      if (!state.creds.registered && config.pairingNumber) {
        setTimeout(async () => {
          try {
            await this.requestPairingCode(config.pairingNumber!);
          } catch (e) {
            logger.error('Auto pairing code request failed:', e);
          }
        }, 3500);
      }

      this.socket.ev.on('messages.upsert', async (upsert: any) => {
        if (upsert.type !== 'notify') return;

        for (const msg of upsert.messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const parsed = this.parseInboundMessage(msg);
          if (!parsed) continue;

          for (const handler of this.messageHandlers) {
            try {
              await handler(parsed);
            } catch (err) {
              logger.error('Error in message handler:', err);
            }
          }
        }
      });
    } catch (err) {
      logger.error('Failed to connect Baileys engine:', err);
      this.updateState('disconnected');
      this.scheduleReconnect();
    }
  }

  private parseInboundMessage(msg: any): InboundMessage | null {
    const from = msg.key.remoteJid || '';
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || '';
    const isGroup = from.endsWith('@g.us');
    const timestamp = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now();

    const m = msg.message;
    let text = '';
    let type: InboundMessage['type'] = 'text';

    if (m.conversation) {
      text = m.conversation;
    } else if (m.extendedTextMessage?.text) {
      text = m.extendedTextMessage.text;
    } else if (m.buttonsResponseMessage?.selectedButtonId) {
      text = m.buttonsResponseMessage.selectedButtonId;
      type = 'button_response';
    } else if (m.templateButtonReplyMessage?.selectedId) {
      text = m.templateButtonReplyMessage.selectedId;
      type = 'button_response';
    } else if (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const params = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        text = params.id || params.text || '';
        type = 'interactive';
      } catch {
        text = '';
      }
    } else if (m.reactionMessage) {
      text = m.reactionMessage.text || '';
      type = 'reaction';
    }

    if (!text && !type) return null;

    return {
      id: msg.key.id || String(Date.now()),
      from,
      sender,
      pushName,
      isGroup,
      text: text.trim(),
      type,
      timestamp,
      reactionTargetId: m.reactionMessage?.key?.id,
      raw: msg,
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= config.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts (${config.maxReconnectAttempts}) reached. Giving up.`);
      this.updateState('closed');
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(config.reconnectBaseDelayMs * Math.pow(1.5, this.reconnectAttempts - 1), 60000);
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay / 1000)}s...`);
    this.updateState('reconnecting');

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  async disconnect(): Promise<void> {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        await this.socket.end();
      } catch (err) {
        logger.error('Error closing Baileys socket:', err);
      }
      this.socket = null;
    }
    this.updateState('closed');
    logger.info('Baileys engine disconnected gracefully.');
  }

  async sendMessage(to: string, content: OutboundContent): Promise<{ id: string }> {
    if (!this.socket || this.state !== 'open') {
      logger.warn(`Cannot send message: Baileys is ${this.state}. Content queued or dropped.`);
      return { id: `sim-${Date.now()}` };
    }

    // Build payload with interactive button fallback
    let messageText = content.text;
    if (content.buttons && content.buttons.length > 0 && !messageText.includes('Tombol Kontrol:')) {
      // Append clear text buttons for clients that don't render native buttons
      const buttonHints = content.buttons
        .map((b, idx) => `[${idx + 1}] ${b.text}`)
        .join('  ');
      messageText += `\n\n*Aksi:*\n${buttonHints}`;
    }

    if (content.footer) {
      messageText += `\n\n_${content.footer}_`;
    }

    try {
      if (content.editId) {
        // WhatsApp Baileys protocol message edit (in-place update)
        const editKey = {
          remoteJid: to,
          fromMe: true,
          id: content.editId,
        };
        const sent = await this.socket.sendMessage(to, {
          text: messageText,
          edit: editKey,
        });
        return { id: sent?.key?.id || content.editId };
      }

      const sent = await this.socket.sendMessage(to, {
        text: messageText,
      });
      return { id: sent?.key?.id || String(Date.now()) };
    } catch (err) {
      logger.error(`Failed to send message to ${to}:`, err);
      // Fallback: If editing fails (e.g. message too old or unsupported WhatsApp client), send new message
      if (content.editId) {
        try {
          const fallback = await this.socket.sendMessage(to, { text: messageText });
          return { id: fallback?.key?.id || String(Date.now()) };
        } catch {
          // ignore fallback error
        }
      }
      throw err;
    }
  }

  onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onConnectionUpdate(handler: (status: ConnectionStatus) => void): void {
    this.connectionHandlers.push(handler);
    handler(this.getStatus());
  }

  private updateState(newState: ConnectionState): void {
    this.state = newState;
    this.notifyConnection();
  }

  private notifyConnection(): void {
    const status = this.getStatus();
    for (const handler of this.connectionHandlers) {
      try {
        handler(status);
      } catch (err) {
        logger.error('Error in connection update handler:', err);
      }
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      throw new Error('Baileys socket is not initialized');
    }
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber) {
      throw new Error('Invalid phone number for WhatsApp pairing code');
    }

    try {
      const code = await this.socket.requestPairingCode(cleanNumber);
      this.pairingCodeString = code;
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`🔑 WHATSAPP PAIRING CODE: ${code}`);
      logger.info(`Buka WhatsApp di HP > Perangkat Tertaut > Tautkan dengan nomor telepon`);
      logger.info(`Masukkan 8 digit kode di atas untuk menghubungkan bot.`);
      logger.info('═══════════════════════════════════════════════════════════');
      this.notifyConnection();
      return code;
    } catch (err: any) {
      logger.error('Failed to request WhatsApp pairing code:', err);
      throw err;
    }
  }

  getStatus(): ConnectionStatus {
    return {
      state: this.state,
      qrCode: this.qrCodeString,
      pairingCode: this.pairingCodeString,
      userJid: this.userJid,
      reconnectAttempts: this.reconnectAttempts,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      engineName: this.engineName,
    };
  }
}
