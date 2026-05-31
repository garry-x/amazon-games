import type { Theme } from './types';

export const medievalTheme: Theme = {
  id: 'medieval',
  name: '中世纪',
  description: '城堡大厅中的王座对决，骑士与荣耀的战场',

  board: {
    light: 0xe8dcc8,
    dark: 0x6b4226,
    border: 0x3b170b,
    highlight: 0x4a90d9,
    shotHighlight: 0xc0392b,
  },

  background: {
    primary: 0x1a1210,
    secondary: 0x2c1e16,
    accent: 0x8b7355,
  },

  pieces: {
    white: 0xf0e6d3,
    whiteGlow: 0xc9a96e,
    black: 0x1a0f0a,
    blackGlow: 0x8b4513,
  },

  effects: {
    arrow: 0x8b0000,
    arrowTrail: 0xcd5c5c,
    burn: 0xdc143c,
    burnGlow: 0x8b0000,
    particle: 0xffd700,
  },
};
