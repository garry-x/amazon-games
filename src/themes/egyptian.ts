import type { Theme } from './types';

export const egyptianTheme: Theme = {
  id: 'egyptian',
  name: '古埃及',
  description: '尼罗河畔的金色沙漠，金字塔下的智慧博弈',

  board: {
    light: 0xf5e6c8,
    dark: 0xc4953d,
    border: 0x8b6914,
    highlight: 0x4ecdc4,
    shotHighlight: 0xff6b35,
  },

  background: {
    primary: 0x1a0f07,
    secondary: 0x2d1f0e,
    accent: 0xd4a017,
  },

  pieces: {
    white: 0xfdf5e6,
    whiteGlow: 0xffd700,
    black: 0x2f1f0e,
    blackGlow: 0xd4a017,
  },

  effects: {
    arrow: 0xff6b35,
    arrowTrail: 0xffaa55,
    burn: 0xff4500,
    burnGlow: 0xff6347,
    particle: 0xffd700,
  },
};
