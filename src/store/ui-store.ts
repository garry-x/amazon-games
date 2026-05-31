import { create } from 'zustand';
import type { Theme } from '../themes/types';
import { egyptianTheme } from '../themes/egyptian';
import { medievalTheme } from '../themes/medieval';
import { scifiTheme } from '../themes/scifi';
import { natureTheme } from '../themes/nature';

export const ALL_THEMES: Theme[] = [
  egyptianTheme,
  medievalTheme,
  scifiTheme,
  natureTheme,
];

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  showSetup: boolean;
  setShowSetup: (show: boolean) => void;
  /** AI-generated background image data URL */
  bgImage: string | undefined;
  setBgImage: (url: string | undefined) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: egyptianTheme,
  setTheme: (theme) => set({ theme }),
  showSetup: true,
  setShowSetup: (show) => set({ showSetup: show }),
  bgImage: undefined,
  setBgImage: (url) => set({ bgImage: url }),
}));
