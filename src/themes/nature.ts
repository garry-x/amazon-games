import type { Theme } from './types';

export const natureTheme: Theme = {
  id: 'nature',
  name: '自然之息',
  description: '翡翠森林中的精灵棋局，绿叶与藤蔓的生机盎然',

  board: {
    light: 0xd4e8c2,
    dark: 0x4a7c3f,
    border: 0x2d5a1e,
    highlight: 0xf9a826,
    shotHighlight: 0xe74c3c,
  },

  background: {
    primary: 0x0a1609,
    secondary: 0x142810,
    accent: 0x6b8f3b,
    surface: 0x0e1c0c,
  },

  pieces: {
    white: 0xf5f9e9,
    whiteGlow: 0xa8e6cf,
    whiteShadow: 0x3e6b3a,
    black: 0x0f1f0d,
    blackGlow: 0x2e7d32,
    blackShadow: 0x050e04,
  },

  effects: {
    arrow: 0xf9a826,
    arrowTrail: 0xffc107,
    burn: 0xe74c3c,
    burnGlow: 0xff5722,
    particle: 0x8bc34a,
  },
};
