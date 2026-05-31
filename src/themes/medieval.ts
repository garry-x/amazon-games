import type { Theme } from './types';

export const medievalTheme: Theme = {
  id: 'medieval',
  name: '中世纪',
  description: '城堡大厅中的王座对决，骑士与荣耀的战场',

  board: {
    light: 0xe8d5b0,
    dark: 0x6b4226,
    border: 0x3b170b,
    highlight: 0x5b9bd5,
    shotHighlight: 0xc0392b,
  },

  background: {
    primary: 0x100c08,
    secondary: 0x1e1610,
    accent: 0x8b7355,
    surface: 0x18120c,
  },

  pieces: {
    white: 0xf0e6d3,
    whiteGlow: 0xc9a96e,
    whiteShadow: 0x6b5b4a,
    black: 0x0d0704,
    blackGlow: 0x8b4513,
    blackShadow: 0x050200,
  },

  effects: {
    arrow: 0x8b0000,
    arrowTrail: 0xcd5c5c,
    burn: 0xdc143c,
    burnGlow: 0x8b0000,
    particle: 0xffd700,
  },
};
