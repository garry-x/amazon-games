import type { Theme } from './types';

export const scifiTheme: Theme = {
  id: 'scifi',
  name: '科幻纪元',
  description: '霓虹闪烁的赛博空间，光剑与数据的冷艳交锋',

  board: {
    light: 0x1a1a2e,
    dark: 0x0f0f1a,
    border: 0x4ecdc4,
    highlight: 0x00ff88,
    shotHighlight: 0xff006e,
  },

  background: {
    primary: 0x050510,
    secondary: 0x0d0d2b,
    accent: 0x4ecdc4,
  },

  pieces: {
    white: 0xe0f7fa,
    whiteGlow: 0x00e5ff,
    black: 0xff006e,
    blackGlow: 0xff4081,
  },

  effects: {
    arrow: 0x00e5ff,
    arrowTrail: 0x40c4ff,
    burn: 0xff006e,
    burnGlow: 0xff4081,
    particle: 0x7c4dff,
  },
};
