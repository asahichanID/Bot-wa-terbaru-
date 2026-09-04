export type MessageType = 'text' | 'button_response' | 'interactive' | 'reaction' | 'unknown';

export interface InboundMessage {
  id: string;
  from: string; // Remote JID (chat or group)
  sender: string; // Sender JID (individual)
  pushName: string;
  isGroup: boolean;
  text: string;
  type: MessageType;
  timestamp: number;
  quotedMessageId?: string;
  reactionTargetId?: string;
  raw?: unknown;
}

export interface ButtonOption {
  id: string;
  text: string;
}

export interface OutboundContent {
  text: string;
  footer?: string;
  buttons?: ButtonOption[];
  quotedId?: string;
  editId?: string; // If editing an existing message
  mentions?: string[];
  imageUrl?: string; // Image path or URL to attach image with text caption
  imageBuffer?: Buffer; // Raw image buffer
  showMascot?: boolean; // When true, attaches the Oguri Cap mascot image with text caption
}

export type ConnectionState = 'disconnected' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ConnectionStatus {
  state: ConnectionState;
  qrCode?: string; // Base64 or QR string
  pairingCode?: string; // 8-digit pairing code (e.g. ABCD-1234)
  userJid?: string;
  reconnectAttempts: number;
  uptimeSeconds: number;
  engineName: string;
}
