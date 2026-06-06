import { create } from 'zustand';

const SERVER_URL_KEY = 'math-games.server-url';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000/v1/chat/completions';

function loadServerUrl(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_SERVER_URL;
  return localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_SERVER_URL;
}

function saveServerUrl(url: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SERVER_URL_KEY, url);
}

interface ServerStore {
  /** Full vLLM API URL (e.g. http://192.168.1.100:8000/v1/chat/completions) */
  serverUrl: string;
  setServerUrl: (url: string) => void;
  /** Whether a non-default server has been configured */
  isConfigured: boolean;
}

export const useServerStore = create<ServerStore>((set) => {
  const saved = loadServerUrl();
  return {
    serverUrl: saved,
    isConfigured: saved !== DEFAULT_SERVER_URL,
    setServerUrl: (url: string) => {
      saveServerUrl(url);
      set({ serverUrl: url, isConfigured: url !== DEFAULT_SERVER_URL });
    },
  };
});
