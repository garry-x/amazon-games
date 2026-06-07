import { create } from 'zustand';

export interface ProviderConfig {
  /** Display name for the provider */
  name: string;
  /** Base URL of the OpenAI-compatible API (e.g. https://api.example.com/v1) */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Model identifier */
  model: string;
}

const PROVIDER_KEY = 'math-games.ai-provider';

function defaultProvider(): ProviderConfig | null {
  const baseUrl = import.meta.env.VITE_AI_BASE_URL;
  const apiKey = import.meta.env.VITE_AI_API_KEY;
  const model = import.meta.env.VITE_AI_MODEL;
  if (!baseUrl || !model) return null;
  return {
    name: import.meta.env.VITE_AI_PROVIDER_NAME ?? 'Custom Provider',
    baseUrl,
    apiKey: apiKey ?? '',
    model,
  };
}

function loadProvider(): ProviderConfig | null {
  if (typeof localStorage === 'undefined') return defaultProvider();
  try {
    const saved = localStorage.getItem(PROVIDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ProviderConfig;
      if (parsed.baseUrl && parsed.model) return parsed;
    }
  } catch {
    // Corrupted data — fall through to default
  }
  return defaultProvider();
}

function saveProvider(provider: ProviderConfig | null): void {
  if (typeof localStorage === 'undefined') return;
  if (provider) {
    localStorage.setItem(PROVIDER_KEY, JSON.stringify(provider));
  } else {
    localStorage.removeItem(PROVIDER_KEY);
  }
}

interface ServerStore {
  /** Current provider configuration (null = no provider configured) */
  provider: ProviderConfig | null;
  setProvider: (provider: ProviderConfig | null) => void;
  /** Whether a non-default provider has been configured */
  isConfigured: boolean;
  /** Compute the full chat completions endpoint from the provider's base URL */
  chatEndpoint: string | null;
}

/** Ensure the base URL ends with the chat completions path */
function buildChatEndpoint(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) {
    url += '/chat/completions';
  }
  return url;
}

export const useServerStore = create<ServerStore>((set) => {
  const saved = loadProvider();
  return {
    provider: saved,
    isConfigured: saved !== null,
    chatEndpoint: saved ? buildChatEndpoint(saved.baseUrl) : null,
    setProvider: (provider: ProviderConfig | null) => {
      saveProvider(provider);
      set({
        provider,
        isConfigured: provider !== null,
        chatEndpoint: provider ? buildChatEndpoint(provider.baseUrl) : null,
      });
    },
  };
});
