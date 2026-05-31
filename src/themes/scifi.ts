import type { Theme } from './types';

export const scifiTheme: Theme = {
  id: 'scifi',
  name: '科幻纪元',
  description: '霓虹闪烁的赛博空间，光剑与数据的冷艳交锋',

  board: {
    light: 0x1a1a35,
    dark: 0x0d0d20,
    border: 0x4ecdc4,
    highlight: 0x00ff88,
    shotHighlight: 0xff006e,
  },

  background: {
    primary: 0x050510,
    secondary: 0x0a0a22,
    accent: 0x4ecdc4,
    surface: 0x080818,
  },

  pieces: {
    white: 0xe0f7fa,
    whiteGlow: 0x00e5ff,
    whiteShadow: 0x006064,
    black: 0xff006e,
    blackGlow: 0xff4081,
    blackShadow: 0x4a0028,
  },

  effects: {
    arrow: 0x00e5ff,
    arrowTrail: 0x40c4ff,
    burn: 0xff006e,
    burnGlow: 0xff4081,
    particle: 0x7c4dff,
  },
};
