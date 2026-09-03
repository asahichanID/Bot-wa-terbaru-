export interface PingPluginConfig {
  enabled: boolean;
  cooldownMs: number;
}

export const defaultPingConfig: PingPluginConfig = {
  enabled: true,
  cooldownMs: 1000,
};
