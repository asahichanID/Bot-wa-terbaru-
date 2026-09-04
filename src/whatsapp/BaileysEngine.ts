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
  private baileysModule: any = null;
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

  clearSession(): void {
    try {
      const sessionPath = path.resolve(config.sessionDir);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        fs.mkdirSync(sessionPath, { recursive: true });
        logger.info(`[BaileysEngine] Folder sesi ${sessionPath} berhasil dibersihkan.`);
      }
    } catch (err: any) {
      logger.error('Gagal membersihkan folder sesi:', err?.message || err);
    }
  }

  async connect(): Promise<void> {
    this.isIntentionallyClosed = false;
    this.updateState('connecting');

    try {
      // Dynamic import to support ESM / CJS cleanly
      const baileys = await import('@whiskeysockets/baileys');
      this.baileysModule = baileys;
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
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isBadSession = statusCode === DisconnectReason.badSession;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;

          logger.warn(`Connection closed. Status code: ${statusCode}. LoggedOut: ${isLoggedOut}. Reconnecting: ${!this.isIntentionallyClosed}`);
          this.updateState('disconnected');

          if (this.isIntentionallyClosed) {
            this.updateState('closed');
            return;
          }

          // If session was revoked by WhatsApp or corrupted, wipe old credentials and reconnect cleanly
          if (isLoggedOut || isBadSession) {
            logger.warn(`⚠️ [BaileysEngine] Sesi WhatsApp telah kedaluwarsa atau dikeluarkan (Status: ${statusCode}). Membersihkan sesi lama dan menyiapkan koneksi baru untuk pairing...`);
            this.clearSession();
            this.reconnectAttempts = 0;
            this.updateState('connecting');
            setTimeout(() => {
              this.connect();
            }, 2000);
            return;
          }

          // WhatsApp server requests immediate restart (common right after pairing / companion sync)
          if (isRestartRequired) {
            logger.info('🔄 [BaileysEngine] WhatsApp meminta restart koneksi (515). Menghubungkan ulang segera...');
            setTimeout(() => {
              this.connect();
            }, 1000);
            return;
          }

          // Normal disconnects (408 timedOut, 428 connectionClosed, 503 unavailableService, etc.)
          this.scheduleReconnect();
        } else if (connection === 'open') {
          this.reconnectAttempts = 0;
          this.qrCodeString = undefined;
          this.pairingCodeString = undefined;
          this.userJid = this.socket?.user?.id;
          this.updateState('open');
          logger.info(`WhatsApp connection established successfully! JID: ${this.userJid}`);
        }
      });

      if (!state.creds.registered) {
        if (config.pairingNumber) {
          logger.info(`Meminta Pairing Code otomatis untuk nomor ${config.pairingNumber}...`);
          setTimeout(async () => {
            try {
              await this.requestPairingCode(config.pairingNumber!);
            } catch (e) {
              logger.error('Gagal meminta pairing code otomatis:', e);
            }
          }, 3000);
        } else {
          setTimeout(() => {
            logger.info('─────────────────────────────────────────────────────────────');
            logger.info('📱 [Baileys] WHATSAPP SIAP DIPAIRING!');
            logger.info('💡 CARA MENDAPATKAN PAIRING CODE:');
            logger.info('   1. Ketik nomor HP Anda di konsol ini (contoh: 628123456789 lalu Enter)');
            logger.info('   ATAU');
            logger.info('   2. Masukkan PAIRING_NUMBER=628xxxxxx di file .env lalu restart');
            logger.info('─────────────────────────────────────────────────────────────');
          }, 1500);
        }
      }

      this.socket.ev.on('messages.upsert', async (upsert: any) => {
        if (!upsert.messages || !Array.isArray(upsert.messages)) return;

        for (const msg of upsert.messages) {
          if (!msg.message) continue;

          const from = msg.key.remoteJid || '';
          if (from === 'status@broadcast') continue;

          const parsed = this.parseInboundMessage(msg);
          if (!parsed || (!parsed.text && parsed.type !== 'reaction')) continue;

          // If fromMe is true (message sent from the WhatsApp account paired to this bot):
          // Allow if message starts with bot prefix (e.g. '.') or is a recognized game action.
          // This allows the bot owner to test and play directly from their own phone/account,
          // while preventing the bot from looping on its own automated outputs!
          if (msg.key.fromMe) {
            const isPrefixed = parsed.text.startsWith(config.prefix);
            const isQuickAction = this.isGameQuickAction(parsed.text);
            if (!isPrefixed && !isQuickAction) {
              continue;
            }
          }

          logger.info(`📨 [WhatsApp] Pesan masuk dari ${parsed.sender} (${parsed.pushName || 'User'}): "${parsed.text}"`);

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

  private isGameQuickAction(text: string): boolean {
    const clean = text.trim().toLowerCase();
    const actions = [
      'kiri', 'kanan', 'putar', 'turun', 'hard', 'hold', 'jeda', 'ulang',
      'left', 'right', 'rotate', 'rot', 'drop', 'stop', 'quit',
      '⬅️', '➡️', '🔄', '⬇️', '⚡', '📦', '⏸️',
      '←', '→', '↓', 'jatuhkan', 'main ulang', 'mainulang', 'lanjut'
    ];
    return actions.includes(clean) || clean.startsWith('.tetris');
  }

  private parseInboundMessage(msg: any): InboundMessage | null {
    let from = msg.key.remoteJid || '';
    if (!from || from === 'status@broadcast') return null;

    // Normalize device suffixes (e.g. 628123:1@s.whatsapp.net -> 628123@s.whatsapp.net)
    from = from.replace(/:\d+@/, '@');

    const isGroup = from.endsWith('@g.us');
    let sender = msg.key.participant || from;
    sender = sender.replace(/:\d+@/, '@');

    const pushName = msg.pushName || '';
    const timestamp = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now();

    // Unwrap nested wrappers: ephemeralMessage, viewOnceMessage, etc.
    let m = msg.message;
    while (
      m &&
      (m.ephemeralMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m.documentWithCaptionMessage?.message ||
        m.editedMessage?.message?.protocolMessage?.editedMessage)
    ) {
      m =
        m.ephemeralMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m.documentWithCaptionMessage?.message ||
        m.editedMessage?.message?.protocolMessage?.editedMessage;
    }

    if (!m) return null;

    let text = '';
    let type: InboundMessage['type'] = 'text';

    if (m.conversation) {
      text = m.conversation;
    } else if (m.extendedTextMessage?.text) {
      text = m.extendedTextMessage.text;
    } else if (m.imageMessage?.caption) {
      text = m.imageMessage.caption;
    } else if (m.videoMessage?.caption) {
      text = m.videoMessage.caption;
    } else if (m.documentMessage?.caption) {
      text = m.documentMessage.caption;
    } else if (m.buttonsResponseMessage?.selectedButtonId) {
      text = m.buttonsResponseMessage.selectedButtonId;
      type = 'button_response';
    } else if (m.templateButtonReplyMessage?.selectedId) {
      text = m.templateButtonReplyMessage.selectedId;
      type = 'button_response';
    } else if (m.interactiveResponseMessage) {
      type = 'interactive';
      const nf = m.interactiveResponseMessage.nativeFlowResponseMessage;
      if (nf?.paramsJson) {
        try {
          const params = JSON.parse(nf.paramsJson);
          text = params.id || params.display_text || params.text || '';
        } catch {
          text = nf.paramsJson;
        }
      }
      if (!text && m.interactiveResponseMessage.body?.text) {
        text = m.interactiveResponseMessage.body.text;
      }
    } else if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
      text = m.listResponseMessage.singleSelectReply.selectedRowId;
      type = 'button_response';
    } else if (m.reactionMessage) {
      text = m.reactionMessage.text || '';
      type = 'reaction';
    }

    if (!text && type !== 'reaction') return null;

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

    const cleanTo = to.replace(/:\d+@/, '@');

    let messageText = content.text;
    if (content.footer) {
      messageText += `\n\n_${content.footer}_`;
    }

    try {
      if (content.editId) {
        // WhatsApp Baileys protocol message edit (in-place update)
        const editKey = {
          remoteJid: cleanTo,
          fromMe: true,
          id: content.editId,
        };
        logger.info(`🔄 [Baileys] Edit pesan game in-place (ID: ${content.editId}) ke ${cleanTo}`);

        // If interactive buttons are present, try updating with interactive message protocol
        if (content.buttons && content.buttons.length > 0 && this.baileysModule?.generateWAMessageFromContent) {
          try {
            const nativeButtons = content.buttons.map(btn => ({
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: btn.text,
                id: btn.id
              })
            }));

            const editWaMsg = this.baileysModule.generateWAMessageFromContent(cleanTo, {
              protocolMessage: {
                key: editKey,
                type: 14, // MESSAGE_EDIT
                editedMessage: {
                  conversation: messageText,
                  viewOnceMessage: {
                    message: {
                      interactiveMessage: {
                        body: { text: messageText },
                        footer: { text: content.footer || 'Denia Tetris' },
                        nativeFlowMessage: { buttons: nativeButtons }
                      }
                    }
                  }
                }
              }
            }, { userJid: this.socket.user?.id || cleanTo });

            await this.socket.relayMessage(cleanTo, editWaMsg.message, {
              messageId: editWaMsg.key.id
            });
            return { id: content.editId };
          } catch (editErr) {
            logger.debug(`Relay edit interactive fallback to standard edit: ${editErr}`);
          }
        }

        const sent = await this.socket.sendMessage(cleanTo, {
          text: messageText,
          edit: editKey,
        });
        return { id: sent?.key?.id || content.editId };
      }

      // Native interactive buttons (Quick Reply buttons exactly as in video)
      if (content.buttons && content.buttons.length > 0 && this.baileysModule?.generateWAMessageFromContent) {
        try {
          const nativeButtons = content.buttons.map(btn => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              id: btn.id
            })
          }));

          const interactivePayload = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2
                },
                interactiveMessage: {
                  body: {
                    text: messageText
                  },
                  footer: {
                    text: content.footer || 'Denia Tetris'
                  },
                  nativeFlowMessage: {
                    buttons: nativeButtons
                  }
                }
              }
            }
          };

          const waMsg = this.baileysModule.generateWAMessageFromContent(cleanTo, interactivePayload, {
            userJid: this.socket.user?.id || cleanTo
          });

          logger.info(`📤 [Baileys] Mengirim interactive native message (${nativeButtons.length} tombol) ke ${cleanTo}`);
          await this.socket.relayMessage(cleanTo, waMsg.message, {
            messageId: waMsg.key.id
          });
          return { id: waMsg.key.id };
        } catch (intErr: any) {
          logger.warn(`Failed to send interactive message, falling back to text: ${intErr?.message || intErr}`);
        }
      }

      logger.info(`📤 [Baileys] Mengirim balasan ke ${cleanTo}`);
      const sent = await this.socket.sendMessage(cleanTo, {
        text: messageText,
      });
      return { id: sent?.key?.id || String(Date.now()) };
    } catch (err: any) {
      logger.error(`Failed to send message to ${cleanTo}:`, err?.message || err);
      // Fallback: If editing fails (e.g. message too old or unsupported WhatsApp client), send new message
      if (content.editId) {
        try {
          logger.info(`⚠️ Edit gagal, fallback mengirim pesan baru ke ${cleanTo}...`);
          const fallback = await this.socket.sendMessage(cleanTo, { text: messageText });
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
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('08')) {
      cleanNumber = '62' + cleanNumber.slice(1);
    }
    if (!cleanNumber || cleanNumber.length < 8) {
      throw new Error('Nomor telepon tidak valid untuk pairing code WhatsApp (contoh: 628123456789 atau 08123456789)');
    }

    // If socket is not initialized, closed, or disconnected, re-connect automatically
    if (!this.socket || this.state === 'closed' || this.state === 'disconnected') {
      logger.info('[BaileysEngine] Menghubungkan ulang socket WhatsApp sebelum meminta pairing code...');
      await this.connect();
      await new Promise(res => setTimeout(res, 1500));
    }

    // Retry loop: WebSocket handshake takes 1-2 seconds, so retry if connection closed initially
    let lastError: any = null;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        if (!this.socket) {
          throw new Error('Socket WhatsApp belum siap');
        }
        logger.info(`[BaileysEngine] Menghubungi server WhatsApp untuk kode pairing (Percobaan ${attempt}/6)...`);
        const rawCode = await this.socket.requestPairingCode(cleanNumber);

        // Format as XXXX-XXXX if 8 chars for ease of typing
        const code = rawCode && rawCode.length === 8
          ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`
          : rawCode;

        this.pairingCodeString = code;
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info(`🔑 KODE PAIRING WHATSAPP: ${code}`);
        logger.info(`Target Nomor: +${cleanNumber}`);
        logger.info(`Langkah di HP:`);
        logger.info(`1. Buka WhatsApp > Titik Tiga (⋮) > Perangkat Tertaut > Tautkan Perangkat`);
        logger.info(`2. Pilih "Tautkan dengan nomor telepon saja"`);
        logger.info(`3. Masukkan 8 digit kode di atas: ${code}`);
        logger.info('═══════════════════════════════════════════════════════════');
        this.notifyConnection();
        return code;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        logger.info(`[BaileysEngine] Percobaan ${attempt} belum siap (${errMsg}), menunggu koneksi WebSocket...`);
        await new Promise(res => setTimeout(res, 1500));
      }
    }

    logger.error('Gagal mendapatkan pairing code setelah 6 kali percobaan:', lastError);
    throw lastError || new Error('Gagal meminta pairing code dari server WhatsApp');
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
