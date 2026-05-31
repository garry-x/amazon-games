/** 视觉主题定义 */
export interface Theme {
  id: string;
  name: string;
  description: string;

  /** 棋盘颜色 */
  board: {
    light: number;  // 浅色格 hex
    dark: number;   // 深色格 hex
    border: number; // 边框颜色
    highlight: number; // 高亮格子
    shotHighlight: number; // 射击目标高亮
  };

  /** 背景 */
  background: {
    primary: number;
    secondary: number;
    accent: number;
  };

  /** 棋子颜色 */
  pieces: {
    white: number;
    whiteGlow: number;
    black: number;
    blackGlow: number;
  };

  /** 特殊效果 */
  effects: {
    arrow: number;
    arrowTrail: number;
    burn: number;
    burnGlow: number;
    particle: number;
  };
}

/** 将 hex 字符串转换为数字（PixiJS 用） */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
