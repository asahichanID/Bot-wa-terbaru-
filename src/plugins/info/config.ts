export interface InfoPluginConfig {
  enabled: boolean;
  cooldownMs: number;
}

export const defaultInfoConfig: InfoPluginConfig = {
  enabled: true,
  cooldownMs: 2000,
};
