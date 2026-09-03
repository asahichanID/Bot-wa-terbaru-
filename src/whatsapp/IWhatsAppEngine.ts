import { InboundMessage, OutboundContent, ConnectionStatus } from './types';

export interface IWhatsAppEngine {
  readonly engineName: string;
  init(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(to: string, content: OutboundContent): Promise<{ id: string }>;
  onMessage(handler: (msg: InboundMessage) => Promise<void>): void;
  onConnectionUpdate(handler: (status: ConnectionStatus) => void): void;
  getStatus(): ConnectionStatus;
}
