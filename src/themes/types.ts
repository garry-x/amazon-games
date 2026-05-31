export interface Theme {
  id: string;
  name: string;
  description: string;

  board: {
    light: number;
    dark: number;
    border: number;
    highlight: number;
    shotHighlight: number;
  };

  background: {
    primary: number;
    secondary: number;
    accent: number;
    surface: number;
  };

  pieces: {
    white: number;
    whiteGlow: number;
    whiteShadow: number;
    black: number;
    blackGlow: number;
    blackShadow: number;
  };

  effects: {
    arrow: number;
    arrowTrail: number;
    burn: number;
    burnGlow: number;
    particle: number;
  };
}
