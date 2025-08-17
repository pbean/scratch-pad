// TypeScript interfaces for the plugin system

export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface PluginManager {
  getPluginInfo(): Promise<PluginInfo[]>;
  getPluginCount(): Promise<number>;
  getAvailableNoteFormats(): Promise<string[]>;
  reloadPlugins(): Promise<string>;
}

// Plugin-related API error types
export interface PluginApiError {
  code: string;
  message: string;
}