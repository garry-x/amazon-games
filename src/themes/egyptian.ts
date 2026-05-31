import type { Theme } from './types';

export const egyptianTheme: Theme = {
  id: 'egyptian',
  name: '古埃及',
  description: '尼罗河畔的金色沙漠，金字塔下的智慧博弈',

  board: {
    light: 0xeed9b0,
    dark: 0xb8860b,
    border: 0x6b4c1a,
    highlight: 0x4ecdc4,
    shotHighlight: 0xff6b35,
  },

  background: {
    primary: 0x150c06,
    secondary: 0x261a0e,
    accent: 0xd4a017,
    surface: 0x1e1408,
  },

  pieces: {
    white: 0xfdf5e6,
    whiteGlow: 0xffd700,
    whiteShadow: 0x8b6914,
    black: 0x1a0e04,
    blackGlow: 0xd4a017,
    blackShadow: 0x0a0500,
  },

  effects: {
    arrow: 0xff6b35,
    arrowTrail: 0xffaa55,
    burn: 0xff4500,
    burnGlow: 0xff6347,
    particle: 0xffd700,
  },
};
