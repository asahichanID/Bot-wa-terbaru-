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
  private messageStore = new Map<string, any>();
  private msgRetryCounterCache: any = null;

  private saveMessageToStore(id: string, message: any): void {
    if (!id || !message) return;
    if (this.messageStore.size > 2000) {
      const firstKey = this.messageStore.keys().next().value;
      if (firstKey) this.messageStore.delete(firstKey);
    }
    this.messageStore.set(id, message);
  }

  async init(): Promise<void> {
    const sessionPath = path.resolve(config.sessionDir);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    logger.info(`Initialized Baileys session storage at: ${sessionPath}`);

    // Install global safety guard on libsignal's hardcoded console.error for duplicate/out-of-order counter packets
    if (!(globalThis as any).__libsignal_console_error_patched) {
      (globalThis as any).__libsignal_console_error_patched = true;
      const originalConsoleError = console.error;
      console.error = function (...args: any[]) {
        const text = args.map(a => (typeof a === 'string' ? a : (a && a.message) || String(a))).join(' ');
        if (
          text.includes('Failed to decrypt message with any known session') ||
          text.includes('Key used already or never filled') ||
          text.includes('MessageCounterError')
        ) {
          logger.debug(`[Decryption Guard] Duplicate or replayed message counter handled safely: ${text.slice(0, 100)}`);
          return;
        }
        originalConsoleError.apply(console, args);
      };
    }
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
      const { useMultiFileAuthState, DisconnectReason, Browsers, makeCacheableSignalKeyStore } = baileys;

      const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);

      // Silent / minimal pino logger to avoid cluttering stdout
      const pino = (await import('pino')).default;
      const silentLogger = pino({ level: 'silent' });

      // Signal Key Store with cache and mutex to prevent key desync and MessageCounterError
      const cachedKeys = makeCacheableSignalKeyStore ? makeCacheableSignalKeyStore(state.keys, silentLogger) : state.keys;

      // Shared retry counter cache to track and prevent duplicate decryption attempts
      if (!this.msgRetryCounterCache) {
        try {
          const NodeCacheModule: any = await import('@cacheable/node-cache');
          const NodeCache = NodeCacheModule.default?.NodeCache || NodeCacheModule.NodeCache || NodeCacheModule.default;
          this.msgRetryCounterCache = new NodeCache({ stdTTL: 3600, useClones: false });
        } catch {
          const map = new Map<string, number>();
          this.msgRetryCounterCache = {
            get: (k: string) => map.get(k),
            set: (k: string, v: number) => map.set(k, v),
            del: (k: string) => map.delete(k),
            flushAll: () => map.clear(),
          };
        }
      }

      this.socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: cachedKeys,
        },
        logger: silentLogger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        enableAutoSessionRecreation: true,
        enableRecentMessageCache: true,
        msgRetryCounterCache: this.msgRetryCounterCache,
        shouldIgnoreJid: (jid: string) => jid === 'status@broadcast',
        getMessage: async (key: any) => {
          if (key && key.id && this.messageStore.has(key.id)) {
            return this.messageStore.get(key.id);
          }
          return undefined;
        },
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

          // Cache message in store for retry requests and decryption repairs
          if (msg.key?.id) {
            this.saveMessageToStore(msg.key.id, msg.message);
          }

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
    const isGroup = cleanTo.endsWith('@g.us');

    let messageText = content.text;
    if (content.footer) {
      messageText += `\n\n_${content.footer}_`;
    }

    // Official Forwarded Newsletter Badge ("Pesan Diteruskan")
    const forwardedContextInfo = {
      mentionedJid: [cleanTo],
      isForwarded: true,
      forwardingScore: 999999,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363144038483540@newsletter',
        newsletterName: '🏃‍♀️ Uma Musume: Oguri Cap (オグリキャップ)',
        serverMessageId: 100,
      },
    };

    try {
      // 0. IMAGE + CAPTION MESSAGE (Oguri Cap mascot illustration attached directly to text)
      if (content.imageUrl || content.imageBuffer || content.showMascot) {
        try {
          let imageSource: any;
          if (content.imageBuffer) {
            imageSource = content.imageBuffer;
          } else if (content.imageUrl && (content.imageUrl.startsWith('http://') || content.imageUrl.startsWith('https://'))) {
            imageSource = { url: content.imageUrl };
          } else {
            const localFile = content.imageUrl || path.join(process.cwd(), 'assets', 'oguri_cap.jpg');
            if (fs.existsSync(localFile)) {
              imageSource = fs.readFileSync(localFile);
            } else {
              imageSource = { url: 'https://raw.githubusercontent.com/asahichanID/media/refs/heads/main/images%20(6).jpeg' };
            }
          }

          logger.info(`📤 [Baileys] Mengirim pesan bergambar Oguri Cap + Teks ke ${cleanTo}`);
          const sent = await this.socket.sendMessage(cleanTo, {
            image: imageSource,
            caption: messageText,
            contextInfo: forwardedContextInfo,
          });

          const sentId = sent?.key?.id || String(Date.now());
          if (sentId && sent?.message) {
            this.saveMessageToStore(sentId, sent.message);
          }
          return { id: sentId };
        } catch (imgErr: any) {
          logger.warn(`⚠️ Pengiriman gambar gagal, fallback ke pesan teks biasa: ${imgErr?.message || imgErr}`);
        }
      }

      // 1. IN-PLACE EDIT (1 single message simulator gameplay without creating new messages)
      if (content.editId) {
        const editKey = {
          remoteJid: cleanTo,
          fromMe: true,
          id: content.editId,
        };
        logger.info(`🔄 [Baileys] Edit pesan game in-place (ID: ${content.editId}) ke ${cleanTo}`);

        try {
          const sent = await this.socket.sendMessage(cleanTo, {
            text: messageText,
            edit: editKey,
            contextInfo: forwardedContextInfo,
          });
          const sentId = sent?.key?.id || content.editId;
          if (sentId && sent?.message) {
            this.saveMessageToStore(sentId, sent.message);
          }
          return { id: sentId };
        } catch (editErr: any) {
          logger.warn(`⚠️ Edit pesan in-place gagal (${editErr?.message || editErr}), mencoba kirim ulang...`);
        }
      }

      // 2. NATIVE INTERACTIVE BUTTONS WITH BINARY NODES & FORWARDED BADGE
      if (content.buttons && content.buttons.length > 0 && this.baileysModule?.generateWAMessageFromContent) {
        try {
          const nativeButtons = content.buttons.map((btn) => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              id: btn.id,
            }),
          }));

          // WhatsApp binary nodes required for native flow quick_reply buttons
          const additionalNodes: any[] = [
            {
              tag: 'biz',
              attrs: {},
              content: [
                {
                  tag: 'interactive',
                  attrs: {
                    type: 'native_flow',
                    v: '1',
                  },
                  content: [
                    {
                      tag: 'native_flow',
                      attrs: {
                        name: 'quick_reply',
                      },
                    },
                  ],
                },
              ],
            },
          ];

          if (!isGroup) {
            additionalNodes.push({
              tag: 'bot',
              attrs: {
                biz_bot: '1',
              },
            });
          }

          const interactivePayload = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                  body: {
                    text: messageText,
                  },
                  footer: {
                    text: content.footer || '🎮 WhatsApp Tetris WebApp Simulator',
                  },
                  header: {
                    title: '🎮 *TETRIS WHATSAPP SIMULATOR*',
                    hasMediaAttachment: false,
                  },
                  nativeFlowMessage: {
                    buttons: nativeButtons,
                    messageParamsJson: '',
                  },
                  contextInfo: forwardedContextInfo,
                },
              },
            },
          };

          const waMsg = this.baileysModule.generateWAMessageFromContent(cleanTo, interactivePayload, {
            userJid: this.socket.user?.id || cleanTo,
          });

          logger.info(`📤 [Baileys] Mengirim interactive native message (${nativeButtons.length} tombol) dengan badge diteruskan & binary nodes ke ${cleanTo}`);

          await this.socket.relayMessage(cleanTo, waMsg.message, {
            messageId: waMsg.key.id,
            additionalNodes,
          });

          if (waMsg?.key?.id && waMsg?.message) {
            this.saveMessageToStore(waMsg.key.id, waMsg.message);
          }

          return { id: waMsg.key.id };
        } catch (intErr: any) {
          logger.warn(`Interactive relayMessage gagal, fallback ke pesan standar: ${intErr?.message || intErr}`);
        }
      }

      // 3. FALLBACK / REGULAR MESSAGE (with forwarded badge)
      logger.info(`📤 [Baileys] Mengirim pesan standar ke ${cleanTo}`);
      const sent = await this.socket.sendMessage(cleanTo, {
        text: messageText,
        contextInfo: forwardedContextInfo,
      });
      const finalId = sent?.key?.id || String(Date.now());
      if (finalId && sent?.message) {
        this.saveMessageToStore(finalId, sent.message);
      }
      return { id: finalId };
    } catch (err: any) {
      logger.error(`Failed to send message to ${cleanTo}:`, err?.message || err);
      // Fallback: If editing fails, send new message
      if (content.editId) {
        try {
          logger.info(`⚠️ Fallback mengirim pesan baru ke ${cleanTo}...`);
          const fallback = await this.socket.sendMessage(cleanTo, {
            text: messageText,
            contextInfo: forwardedContextInfo,
          });
          const fbId = fallback?.key?.id || String(Date.now());
          if (fbId && fallback?.message) {
            this.saveMessageToStore(fbId, fallback.message);
          }
          return { id: fbId };
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
