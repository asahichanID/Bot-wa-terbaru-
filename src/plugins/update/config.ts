export interface UpdatePluginConfig {
  enabled: boolean;
  adminOnly: boolean;
}

export const defaultUpdateConfig: UpdatePluginConfig = {
  enabled: true,
  adminOnly: false, // Accessible or configurable
};
