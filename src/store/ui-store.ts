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

const THEME_KEY = 'amazon-games.theme';

function loadTheme(): Theme {
  if (typeof localStorage === 'undefined') return egyptianTheme;
  const id = localStorage.getItem(THEME_KEY);
  return ALL_THEMES.find(theme => theme.id === id) ?? egyptianTheme;
}

function saveTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme.id);
}

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  previewTheme: Theme;  // live preview during setup
  setPreviewTheme: (theme: Theme) => void;
  showSetup: boolean;
  setShowSetup: (show: boolean) => void;
}

const initialTheme = loadTheme();

export const useUIStore = create<UIState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    saveTheme(theme);
    set({ theme, previewTheme: theme });
  },
  previewTheme: initialTheme,
  setPreviewTheme: (previewTheme) => set({ previewTheme }),
  showSetup: true,
  setShowSetup: (show) => set({ showSetup: show }),
}));
