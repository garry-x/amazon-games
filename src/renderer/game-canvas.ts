import { Application, Container, Graphics, Text, Sprite, Texture, Rectangle, Matrix } from 'pixi.js';
import type { GameState, Position } from '../game/types';
import type { Theme } from '../themes/types';
import { posEqual, getQueenMoves, buildBlockedSet } from '../game/rules';

// ── Easing functions ──
const Ease = {
  inQuad: (t: number) => t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// ── Particle pool (avoid GC) ──
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: number; size: number;
}
const POOL_SIZE = 200;
let particlePool: Particle[] = [];
function poolGet(): Particle {
  return particlePool.pop() || { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: 0, size: 0 };
}
function poolPut(p: Particle) {
  if (particlePool.length < POOL_SIZE) particlePool.push(p);
}

// ── Animation state ──
interface TrailPoint { x: number; y: number; }

interface MeteorAnim {
  tx: number; ty: number;
  elapsed: number;
  fallDuration: number;
  color: number;
  particles: Particle[];
  phase: 'fall' | 'impact' | 'done';
  trail: TrailPoint[];  // position history for comet tail
}

export class GameCanvas {
  private app!: Application;
  private bgLayer!: Container;
  private boardLayer!: Container;
  private boardTexLayer!: Container;
  private burnLayer!: Container;
  private pieceLayer!: Container;
  private effectLayer!: Container;

  private cellSize = 0;
  private boardPx = 0;
  private ox = 0;
  private oy = 0;
  private theme: Theme;
  private state: GameState | null = null;
  private onCellClick?: (pos: Position) => void;
  private hoveredCell: Position | null = null;
  private boardGfx: Graphics | null = null;
  private boardTexSprite: Sprite | null = null;
  private burnGfx: Container | null = null;
  private pieceSprites: Map<string, Container> = new Map();
  private meteorAnims: MeteorAnim[] = [];
  private meteorGfx: Graphics | null = null;
  /** Cells currently fading in their crater (key → elapsed seconds since impact) */
  private craterFadeIns: Map<string, number> = new Map();
  private fireParticles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; cellKey: string }[] = [];
  private fireGfx: Graphics | null = null;
  private lastRenderedMoveCount = 0;
  private initialized = false;
  private destroyed = false;
  private pendingState: GameState | null = null;
  private resizeObs: ResizeObserver | null = null;
  private container: HTMLElement | null = null;
  private bgSprite: Sprite | null = null;
  private texturesLoaded = false;
  private pieceTexWhite: Texture | null = null;
  private pieceTexBlack: Texture | null = null;
  private burnTex: Texture | null = null;
  private tileLight: Texture | null = null;
  private tileDark: Texture | null = null;
  private vfxFireball: Texture | null = null;
  private vfxExplosion: Texture | null = null;
  private vfxSmoke: Texture | null = null;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  // ========== Lifecycle ==========

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    // Clean up stale canvases from previous (StrictMode) mounts
    for (const old of container.querySelectorAll('canvas')) old.remove();

    this.app = new Application();

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    await this.app.init({
      background: this.theme.background.primary,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: w,
      height: h,
    });

    // Abort if destroyed during async init (React StrictMode)
    if (this.destroyed) return;

    // Layer ordering: bg → board-tex → board-gfx → burn → pieces → effects
    this.bgLayer = new Container();
    this.boardTexLayer = new Container();
    this.boardLayer = new Container();
    this.burnLayer = new Container();
    this.pieceLayer = new Container();
    this.effectLayer = new Container();

    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.boardTexLayer);
    this.app.stage.addChild(this.boardLayer);
    this.app.stage.addChild(this.burnLayer);
    this.app.stage.addChild(this.pieceLayer);
    this.app.stage.addChild(this.effectLayer);

    // Make canvas fill the container (critical for touch hit testing)
    if (!this.app?.canvas) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    this.setupPixiInteraction();

    this.app.ticker.add(() => this.tick());

    this.resizeObs = new ResizeObserver(() => this.handleResize());
    this.resizeObs.observe(container);

    this.initialized = true;

    // Load VFX textures (shared across themes)
    this.loadImage('/vfx/fireball.png', (img) => { this.vfxFireball = Texture.from(img); });
    this.loadImage('/vfx/explosion.png', (img) => { this.vfxExplosion = Texture.from(img); });
    this.loadImage('/vfx/smoke.png', (img) => { this.vfxSmoke = Texture.from(img); });

    // Load theme textures
    this.loadThemeTextures();

    if (this.pendingState) {
      this.setState(this.pendingState);
      this.pendingState = null;
    }

    this.handleResize();
  }

  setTheme(theme: Theme): void {
    const changed = this.theme.id !== theme.id;
    this.theme = theme;
    if (this.initialized && this.app?.renderer) {
      this.app.renderer.background = theme.background.primary;
      if (changed) this.loadThemeTextures();
      this.redraw();
    }
  }

  setState(state: GameState): void {
    if (!this.initialized || !this.app?.renderer) { this.pendingState = state; return; }

    // Detect new burn: trigger meteor BEFORE redraw so crater is hidden during animation
    if (this.state && state.moveHistory.length > this.state.moveHistory.length) {
      const lastMove = state.moveHistory[state.moveHistory.length - 1];
      if (lastMove && state.burnedCells.length > (this.state.burnedCells.length || 0)) {
        // New cell was burned — start meteor immediately
        const cs = this.cellSize;
        const tx = this.ox + lastMove.arrow.col * cs + cs / 2;
        const ty = this.oy + lastMove.arrow.row * cs + cs / 2;
        this.startMeteorEffectAt(tx, ty);
      }
    }

    this.state = state;
    this.recalcSize();
    this.redraw();
  }

  setOnCellClick(cb: (pos: Position) => void): void { this.onCellClick = cb; }

  destroy(): void {
    this.destroyed = true;
    this.initialized = false;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    if (this.app) {
      try {
        // Canvas getter may throw if app.init() never completed (StrictMode)
        const canvas = this.app.canvas as HTMLCanvasElement | undefined;
        if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
      } catch { /* Canvas not available — app never fully initialized */ }
      try { this.app.destroy(true); } catch { /* v8.18 */ }
    }
  }

  // ========== Texture loading ==========

  private loadThemeTextures(): void {
    const themeId = this.theme.id;

    // Background texture
    const bgUrl = `/textures/${themeId}-bg.png`;
    this.loadImage(bgUrl, (img) => {
      if (this.bgSprite) { this.bgLayer.removeChild(this.bgSprite); this.bgSprite.destroy(); }
      this.bgSprite = new Sprite(Texture.from(img));
      this.bgLayer.addChild(this.bgSprite);
      this.positionBackground();
    });

    // Board texture
    const boardUrl = `/textures/${themeId}-board.png`;
    this.loadImage(boardUrl, (img) => {
      if (this.boardTexSprite) { this.boardTexLayer.removeChild(this.boardTexSprite); this.boardTexSprite.destroy(); }
      this.boardTexSprite = new Sprite(Texture.from(img));
      this.boardTexLayer.addChild(this.boardTexSprite);
      this.texturesLoaded = true;
      this.redraw();
    });

    // Piece textures (with transparency extraction)
    this.loadTransparent(`/textures/${themeId}-piece-white.png`, (img) => {
      this.pieceTexWhite = Texture.from(img);
      this.redraw();
    });
    this.loadTransparent(`/textures/${themeId}-piece-black.png`, (img) => {
      this.pieceTexBlack = Texture.from(img);
      this.redraw();
    });
    // Burn/crater texture (transparent for overlay)
    this.loadTransparent(`/textures/${themeId}-burn.png`, (img) => {
      this.burnTex = Texture.from(img);
      this.redraw();
    });
    // Tile textures
    this.loadImage(`/textures/${themeId}-tile-light.png`, (img) => {
      this.tileLight = Texture.from(img);
      this.redraw();
    });
    this.loadImage(`/textures/${themeId}-tile-dark.png`, (img) => {
      this.tileDark = Texture.from(img);
      this.redraw();
    });
  }

  private loadImage(url: string, onLoad: (img: HTMLImageElement) => void): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => onLoad(img);
    img.onerror = () => {};
    img.src = url;
  }

  /** Load image and remove background to create transparent texture */
  private loadTransparent(url: string, onLoad: (img: HTMLImageElement) => void): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Create offscreen canvas to strip magenta/green background
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = data.data;

      // Remove green/magenta background pixels (chroma key)
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        // Only key out green (g > 180, r/b low) or magenta (r+b high, g low)
        const isGreen = g > 160 && r < g * 0.7 && b < g * 0.7;
        const isMagenta = r > 180 && b > 180 && g < 100;
        const isGrayBg = r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
        if (isGreen || isMagenta || isGrayBg) {
          pixels[i + 3] = 0;
        } else {
          // Soft edge: reduce alpha near key color boundary
          const grayDist = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
          if (r > 180 && g > 180 && b > 180 && grayDist < 40) {
            pixels[i + 3] = Math.floor(pixels[i + 3] * grayDist / 40);
          }
        }
      }
      ctx.putImageData(data, 0, 0);

      const outImg = new Image();
      outImg.onload = () => onLoad(outImg);
      outImg.src = canvas.toDataURL('image/png');
    };
    img.onerror = () => {};
    img.src = url;
  }

  private positionBackground(): void {
    if (!this.bgSprite || !this.container || !this.app?.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    const tw = this.bgSprite.texture.width;
    const th = this.bgSprite.texture.height;
    const scale = Math.max(w / tw, h / th);
    this.bgSprite.width = tw * scale;
    this.bgSprite.height = th * scale;
    this.bgSprite.x = (w - this.bgSprite.width) / 2;
    this.bgSprite.y = (h - this.bgSprite.height) / 2;
    this.bgSprite.alpha = 0.45;
  }

  private positionBoardTexture(): void {
    if (!this.boardTexSprite || this.cellSize === 0) return;
    const sprite = this.boardTexSprite;
    const tw = sprite.texture.width;
    const th = sprite.texture.height;
    const targetW = this.boardPx;
    const targetH = this.boardPx;
    const scale = Math.min(targetW / tw, targetH / th);
    sprite.width = tw * scale;
    sprite.height = th * scale;
    sprite.x = this.ox + (this.boardPx - sprite.width) / 2;
    sprite.y = this.oy + (this.boardPx - sprite.height) / 2;
    sprite.alpha = 0.5;
  }

  // ========== Sizing ==========

  private handleResize(): void {
    if (!this.initialized || !this.container || !this.app?.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.app.renderer.resize(w, h);
    this.updateStageHitArea();
    this.positionBackground();
    this.recalcSize();
    this.redraw();
  }

  private recalcSize(): void {
    if (!this.state) return;
    const p = this.container!;
    const w = p.clientWidth, h = p.clientHeight;
    if (w === 0 || h === 0) return;
    const size = this.state.boardSize;
    const pad = 48;
    this.cellSize = Math.floor(Math.min((w - pad * 2) / size, (h - pad * 2) / size));
    this.boardPx = this.cellSize * size;
    this.ox = Math.floor((w - this.boardPx) / 2);
    this.oy = Math.floor((h - this.boardPx) / 2);
  }

  // ========== Redraw ==========

  redraw(): void {
    if (!this.initialized || !this.state || this.cellSize === 0) return;
    this.positionBoardTexture();
    this.drawBoard();
    this.drawBurns();
    this.drawHighlights();
    this.drawPieces();
  }

  // ========== Board ==========

  private drawBoard(): void {
    if (this.boardGfx) { this.boardLayer.removeChild(this.boardGfx); this.boardGfx.destroy({ children: true }); }

    const g = new Graphics();
    const size = this.state!.boardSize;
    const cs = this.cellSize;
    const bx = this.ox, by = this.oy, bw = this.boardPx;
    const br = Math.min(cs * 0.25, 12); // board corner radius

    // — Deep, soft shadow (glass thickness illusion) —
    for (let i = 5; i >= 1; i--) {
      const offset = i * 1.2;
      g.roundRect(bx - offset, by - offset + i * 0.8, bw + offset * 2, bw + offset * 2, br + i);
      g.fill({ color: 0x000000, alpha: 0.08 - i * 0.012 });
    }

    // — Board surface base (dark, subtle) —
    g.roundRect(bx, by, bw, bw, br);
    g.fill({ color: 0x000000, alpha: 0.15 });

    // — Cells — texture or color at LOW opacity for subtlety —
    const hasTiles = !!(this.tileLight && this.tileDark);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = bx + c * cs + 0.5, y = by + r * cs + 0.5;
        const isLight = (r + c) % 2 === 0;
        g.rect(x, y, cs - 1, cs - 1);
        if (hasTiles) {
          const tex = isLight ? this.tileLight! : this.tileDark!;
          const m = new Matrix();
          m.scale((cs - 1) / tex.width, (cs - 1) / tex.height);
          m.translate(x, y);
          g.fill({ texture: tex, matrix: m, alpha: 0.55 });
        } else {
          g.fill({ color: isLight ? this.theme.board.light : this.theme.board.dark, alpha: 0.5 });
        }
        // Subtle cell border line
        g.stroke({ color: 0x000000, width: 0.5, alpha: 0.08 });
      }
    }

    // — Glass overlay: subtle gradient reflection —
    // Top highlight (light reflecting off glass surface)
    g.rect(bx, by, bw, bw * 0.3);
    g.fill({ color: 0xffffff, alpha: 0.04 });
    // Bottom subtle shadow
    g.rect(bx, by + bw * 0.7, bw, bw * 0.3);
    g.fill({ color: 0x000000, alpha: 0.06 });
    // Thin edge highlight (glass bevel)
    g.roundRect(bx + 0.5, by + 0.5, bw - 1, bw - 1, br);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.08 });

    // — Delicate border —
    g.roundRect(bx - 1, by - 1, bw + 2, bw + 2, br + 1);
    g.stroke({ color: this.theme.board.border, width: 1.5, alpha: 0.5 });

    // — Corner accents (small dots at corners) —
    const dotR = cs * 0.08;
    [[bx, by], [bx + bw, by], [bx, by + bw], [bx + bw, by + bw]].forEach(([cx, cy]) => {
      g.circle(cx, cy, dotR);
      g.fill({ color: this.theme.board.border, alpha: 0.35 });
    });

    // — Coordinate labels (subtle, outside the board) —
    const fs = Math.max(10, cs * 0.14);
    const pad = cs * 0.15;
    const ls: any = { fontSize: fs, fill: this.theme.board.border, fontFamily: 'sans-serif', fontWeight: '500' };
    for (let i = 0; i < size; i++) {
      const cl = new Text({ text: String.fromCharCode(65 + i), style: ls });
      cl.x = bx + i * cs + cs / 2 - cl.width / 2;
      cl.y = by - pad - cl.height;
      g.addChild(cl);

      const rl = new Text({ text: String(size - i), style: ls });
      rl.x = bx - pad - rl.width;
      rl.y = by + i * cs + cs / 2 - rl.height / 2;
      g.addChild(rl);
    }

    this.boardGfx = g;
    this.boardLayer.addChild(g);
  }

  // ========== Burned cells ==========

  private drawBurns(): void {
    if (this.burnGfx) { this.burnLayer.removeChild(this.burnGfx); this.burnGfx.destroy({ children: true }); }
    if (!this.state) return;

    const cs = this.cellSize;
    const c = new Container();

    for (const b of this.state.burnedCells) {
      const cx = this.ox + b.col * cs + cs / 2;
      const cy = this.oy + b.row * cs + cs / 2;

      if (this.burnTex) {
        // Delayed fade-in: crater starts appearing 0.8s after impact,
        // reaches full opacity at 1.4s (when explosion ends)
        const fadeKey = `${b.col},${b.row}`;
        const fadeElapsed = this.craterFadeIns.get(fadeKey) ?? 999;
        const fadeDelay = 0.8;  // wait for explosion peak to pass
        const fadeDuration = 0.6; // then fade in over 0.6s
        const fadeT = Math.max(0, Math.min((fadeElapsed - fadeDelay) / fadeDuration, 1));
        const fadeAlpha = fadeT < 0.01 ? 0 : 1 - (1 - fadeT) * (1 - fadeT);
        const scale = 0.85 + fadeT * 0.15;

        const sprite = new Sprite(this.burnTex);
        sprite.anchor.set(0.5);
        sprite.alpha = 0.75 * fadeAlpha;
        sprite.width = cs * 0.88 * scale;
        sprite.height = cs * 0.88 * scale;
        sprite.x = cx;
        sprite.y = cy;
        c.addChild(sprite);
      } else {
        // Fallback: glow circles + X mark
        const g = new Graphics();
        for (let i = 3; i >= 1; i--) {
          g.circle(cx, cy, cs * 0.4 * i / 3);
          g.fill({ color: this.theme.effects.burnGlow, alpha: 0.08 + i * 0.04 });
        }
        const x = this.ox + b.col * cs, y = this.oy + b.row * cs;
        const m = cs * 0.2;
        g.moveTo(x + m, y + m);
        g.lineTo(x + cs - m, y + cs - m);
        g.stroke({ color: this.theme.effects.burn, width: Math.max(2, cs * 0.04), alpha: 0.55 });
        g.moveTo(x + cs - m, y + m);
        g.lineTo(x + m, y + cs - m);
        g.stroke({ color: this.theme.effects.burn, width: Math.max(2, cs * 0.04), alpha: 0.55 });
        c.addChild(g);
      }
    }

    this.burnGfx = c as any;
    this.burnLayer.addChild(c);
  }

  // ========== Highlights ==========

  private drawHighlights(): void {
    if (!this.state) return;
    const g = this.boardGfx;
    if (!g) return;

    if (this.state.moveHistory.length > 0) {
      const last = this.state.moveHistory[this.state.moveHistory.length - 1];
      this.drawCellGlow(g, last.from, 0xffffff, 0.12);
      this.drawCellGlow(g, last.to, 0xffffff, 0.15);
    }

    if (this.state.step === 'move' && this.state.selectedAmazonId) {
      const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
      if (amazon) {
        this.drawCellHighlight(g, amazon.position, this.theme.board.highlight, 0.55);
        for (const pos of this.getLegalMoves()) {
          this.drawCellDot(g, pos, 0x88ff88, 0.5);
        }
      }
    }

    if (this.state.step === 'shoot' && this.state.pendingMoveTo) {
      this.drawCellHighlight(g, this.state.pendingMoveTo, 0x44ff44, 0.3);
      for (const pos of this.getLegalShots()) {
        this.drawCellDot(g, pos, this.theme.board.shotHighlight, 0.5);
      }
    }

    if (this.hoveredCell) {
      if (this.state.step === 'move' && this.state.selectedAmazonId) {
        const legal = this.getLegalMoves();
        if (legal.some(p => posEqual(p, this.hoveredCell!))) {
          this.drawCellHighlight(g, this.hoveredCell, 0x88ff88, 0.5);
        }
      } else if (this.state.step === 'shoot') {
        const legal = this.getLegalShots();
        if (legal.some(p => posEqual(p, this.hoveredCell!))) {
          this.drawCellHighlight(g, this.hoveredCell, this.theme.board.shotHighlight, 0.5);
        }
      }
    }
  }

  private drawCellHighlight(g: Graphics, pos: Position, color: number, alpha: number): void {
    const x = this.ox + pos.col * this.cellSize, y = this.oy + pos.row * this.cellSize;
    g.rect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    g.fill({ color, alpha });
  }

  private drawCellGlow(g: Graphics, pos: Position, color: number, alpha: number): void {
    const cx = this.ox + pos.col * this.cellSize + this.cellSize / 2;
    const cy = this.oy + pos.row * this.cellSize + this.cellSize / 2;
    g.circle(cx, cy, this.cellSize * 0.48);
    g.fill({ color, alpha });
  }

  private drawCellDot(g: Graphics, pos: Position, color: number, alpha: number): void {
    const cx = this.ox + pos.col * this.cellSize + this.cellSize / 2;
    const cy = this.oy + pos.row * this.cellSize + this.cellSize / 2;
    const r = Math.max(4, this.cellSize * 0.11);
    g.circle(cx, cy, r + 2);
    g.fill({ color: 0x000000, alpha: 0.2 });
    g.circle(cx, cy, r);
    g.fill({ color, alpha });
    g.circle(cx, cy, r);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
  }

  // ========== Pieces ==========

  private drawPieces(): void {
    for (const [, s] of this.pieceSprites) { this.pieceLayer.removeChild(s); s.destroy({ children: true }); }
    this.pieceSprites.clear();
    if (!this.state) return;

    for (const amazon of this.state.amazons) {
      const c = this.createPiece(amazon);
      this.pieceLayer.addChild(c);
      this.pieceSprites.set(amazon.id, c);
    }

    // Only trigger shot effect once when a new move is recorded
    if (this.state.moveHistory.length > this.lastRenderedMoveCount) {
      const last = this.state.moveHistory[this.state.moveHistory.length - 1];
      this.drawMoveArrow(last.from, last.to);
      // Meteor is now triggered from setState to ensure correct ordering
      // (crater hiding needs the animation to be active BEFORE drawBurns runs)
      this.lastRenderedMoveCount = this.state.moveHistory.length;
    }
  }

  /**
   * Create a piece using the AI-generated sprite texture.
   * Falls back to a simple colored circle if texture not loaded.
   */
  private createPiece(
    amazon: { id: string; player: 'white' | 'black'; position: Position },
  ): Container {
    const c = new Container();
    const cs = this.cellSize;
    const cx = this.ox + amazon.position.col * cs + cs / 2;
    const cy = this.oy + amazon.position.row * cs + cs / 2;
    const size = cs * 0.82; // sprite size

    const white = amazon.player === 'white';
    const accent = white ? this.theme.pieces.whiteGlow : this.theme.pieces.blackGlow;
    const tex = white ? this.pieceTexWhite : this.pieceTexBlack;

    // ── Drop shadow ──
    const sd = cs * 0.04;
    const shadow = new Graphics();
    shadow.ellipse(sd, sd * 1.8, size * 0.45, size * 0.18);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    c.addChild(shadow);

    // ── Glow halo (behind piece) ──
    const halo = new Graphics();
    halo.circle(0, 0, size * 0.52);
    halo.fill({ color: accent, alpha: 0.18 });
    c.addChild(halo);

    // ── Main sprite (or fallback circle) ──
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.width = size;
      sprite.height = size;
      c.addChild(sprite);
    } else {
      const fallback = new Graphics();
      fallback.circle(0, 0, size * 0.42);
      fallback.fill({ color: white ? 0xf0f0e0 : 0x1a1a1a });
      fallback.circle(0, 0, size * 0.42);
      fallback.stroke({ color: accent, width: 2, alpha: 0.5 });
      c.addChild(fallback);
    }

    // ── Selection ring ──
    if (this.state?.selectedAmazonId === amazon.id) {
      const sel = new Graphics();
      sel.circle(0, 0, size * 0.54);
      sel.stroke({ color: 0x4ecdc4, width: 2.5, alpha: 0.9 });
      sel.circle(0, 0, size * 0.58);
      sel.stroke({ color: 0x4ecdc4, width: 1, alpha: 0.3 });
      c.addChild(sel);
      (c as any)._selRing = sel;
    }

    c.x = cx;
    c.y = cy;

    if (this.state && amazon.player === this.state.currentPlayer) {
      (c as any)._pulsePhase = Math.random() * Math.PI * 2;
    }

    return c;
  }

  // ========== Arrows ==========

  private drawMoveArrow(from: Position, to: Position): void {
    const g = new Graphics();
    const cs = this.cellSize;
    const fx = this.ox + from.col * cs + cs / 2, fy = this.oy + from.row * cs + cs / 2;
    const tx = this.ox + to.col * cs + cs / 2, ty = this.oy + to.row * cs + cs / 2;

    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.floor(dist / 6), 2);
    for (let i = 0; i < steps; i += 2) {
      g.moveTo(fx + dx * i / steps, fy + dy * i / steps);
      g.lineTo(fx + dx * Math.min(i + 1, steps) / steps, fy + dy * Math.min(i + 1, steps) / steps);
    }
    g.stroke({ color: this.theme.effects.arrowTrail, width: 2, alpha: 0.4 });
    this.effectLayer.addChild(g);
    setTimeout(() => { this.effectLayer.removeChild(g); g.destroy(); }, 2500);
  }

  // ========== Animated shot system ==========

  // ========== Meteor strike animation ==========

  /** Trigger meteor at pixel coordinates (called from setState before redraw) */
  private startMeteorEffectAt(tx: number, ty: number): void {
    const color = this.theme.effects.arrow;
    const pColor = this.theme.effects.particle;
    const burnColor = this.theme.effects.burnGlow;

    // Register crater fade-in IMMEDIATELY so drawBurns sees it (alpha=0 until impact+delay)
    const cs = this.cellSize;
    const col = Math.round((tx - this.ox) / cs);
    const row = Math.round((ty - this.oy) / cs);
    this.craterFadeIns.set(`${col},${row}`, 0);

    const particles: Particle[] = [];
    for (let i = 0; i < 100; i++) {
      const p = poolGet();
      p.x = tx; p.y = ty;
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 350;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - Math.random() * 100;
      p.life = 0; p.maxLife = 0.5 + Math.random() * 0.9;
      p.color = i < 30 ? 0xffdd00 : (i < 55 ? color : (i < 75 ? pColor : burnColor));
      p.size = 3 + Math.random() * 10;
      particles.push(p);
    }

    this.meteorAnims.push({
      tx, ty, elapsed: 0, fallDuration: 0.7, color, particles, phase: 'fall', trail: [],
    });
  }

  /** Legacy entry point for drawPieces compatibility */
  private startMeteorEffect(from: Position, to: Position): void {
    const cs = this.cellSize;
    const tx = this.ox + to.col * cs + cs / 2;
    const ty = this.oy + to.row * cs + cs / 2;
    this.startMeteorEffectAt(tx, ty);
  }

  private renderMeteorEffects(dt: number): void {
    if (!this.meteorGfx) {
      this.meteorGfx = new Graphics();
      this.effectLayer.addChild(this.meteorGfx);
    }

    // Clean completed
    this.meteorAnims = this.meteorAnims.filter(a => {
      if (a.phase === 'impact') {
        a.elapsed += dt;
        if (a.elapsed > 2.0) {
          for (const p of a.particles) poolPut(p);
          return false;
        }
      }
      return true;
    });

    if (this.meteorAnims.length === 0) {
      if (this.meteorGfx) {
        this.effectLayer.removeChild(this.meteorGfx);
        this.meteorGfx.destroy();
        this.meteorGfx = null;
      }
      return;
    }

    const g = this.meteorGfx;
    g.clear();
    const cs = this.cellSize;

    for (const a of this.meteorAnims) {
      a.elapsed += dt;

      // ── METEOR FALL ──
      if (a.phase === 'fall') {
        const t = Math.min(a.elapsed / a.fallDuration, 1);
        const et = Ease.inQuad(t); // accelerate downward
        const topY = -cs * 2; // start above screen
        const my = topY + (a.ty - topY) * et;
        const mx = a.tx + Math.sin(t * Math.PI * 2) * cs * 0.3; // slight wobble

        // Record position for trail history (max 12 points)
        a.trail.push({ x: mx, y: my });
        if (a.trail.length > 12) a.trail.shift();

        // Draw comet tail — tapered, fading from bright to dark
        const maxWidth = cs * 0.22;
        const widthCurve = [1.0, 0.9, 0.75, 0.55, 0.35, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0];
        const colors = [0xfff8e0, 0xffe088, 0xffb040, 0xff8018, 0xff5000, 0xcc3000, 0x881800, 0x550800];

        for (let i = 0; i < a.trail.length; i++) {
          const pt = a.trail[i];
          const idx = a.trail.length - 1 - i; // 0 = oldest
          const frac = idx / 11; // normalize to 0..1
          if (frac >= 1) continue;
          const r = maxWidth * (widthCurve[idx] || 0.01);
          if (r < 0.5) continue;
          const ci = Math.min(colors.length - 1, Math.floor(frac * colors.length));
          const alpha = (1 - frac) * 0.6;
          g.circle(pt.x, pt.y, r);
          g.fill({ color: colors[ci], alpha });
        }

        // Meteor head — round fireball (AI texture or fallback circles)
        const headR = cs * 0.22;
        if (this.vfxFireball) {
          const tex = this.vfxFireball;
          const m = new Matrix();
          m.translate(-tex.width / 2, -tex.height / 2);
          m.scale(headR * 2.5 / tex.width, headR * 2.5 / tex.height);
          m.translate(mx, my);
          g.circle(mx, my, headR * 1.3);
          g.fill({ texture: tex, matrix: m, alpha: 0.9 });
          // Bright core glow
          g.circle(mx, my, headR * 0.5);
          g.fill({ color: 0xffffff, alpha: 0.5 });
        } else {
          g.circle(mx, my, headR * 1.5); g.fill({ color: 0xff6600, alpha: 0.35 });
          g.circle(mx, my, headR * 1.1); g.fill({ color: 0xff9900, alpha: 0.55 });
          g.circle(mx, my, headR * 0.6); g.fill({ color: 0xffdd00, alpha: 0.8 });
          g.circle(mx, my, headR * 0.2); g.fill({ color: 0xffffff, alpha: 0.9 });
        }

        // Screen flash when close
        if (et > 0.8) {
          const fa = (et - 0.8) / 0.2 * 0.3;
          g.rect(this.ox - 10, this.oy - 10, this.boardPx + 20, this.boardPx + 20);
          g.fill({ color: 0xff8800, alpha: fa });
        }

        if (t >= 1) {
          a.phase = 'impact'; a.elapsed = 0;
          // Crater fade-in already registered in startMeteorEffectAt
        }
      }

      // ── EXPLOSION ──
      if (a.phase === 'impact') {
        const t = Math.min(a.elapsed / 1.4, 1);

        // White flash
        if (t < 0.12) {
          const ft = t / 0.12;
          g.circle(a.tx, a.ty, cs * 0.7 * ft);
          g.fill({ color: 0xffffff, alpha: 0.95 * (1 - ft) });
        }

        // AI-generated explosion sprite (scales up, fades out)
        if (this.vfxExplosion) {
          const tex = this.vfxExplosion;
          const scale = 0.4 + t * 2.5;
          const size = cs * scale;
          const alpha = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85);
          const m = new Matrix();
          m.translate(-tex.width / 2, -tex.height / 2);
          m.scale(size / tex.width, size / tex.height);
          m.translate(a.tx, a.ty);
          g.rect(a.tx - size / 2, a.ty - size / 2, size, size);
          g.fill({ texture: tex, matrix: m, alpha: alpha * 0.85 });
        }

        // Shockwave rings
        for (let ring = 0; ring < 3; ring++) {
          const rt = Math.max(0, t - ring * 0.18);
          const ringR = cs * 1.2 * rt;
          g.circle(a.tx, a.ty, ringR);
          g.stroke({ color: 0xff6600, width: 3, alpha: 0.6 * (1 - rt) });
        }

        // AI smoke puff (appears after peak, expands)
        if (this.vfxSmoke && t > 0.2) {
          const st = (t - 0.2) / 0.8;
          const tex = this.vfxSmoke;
          const ssize = cs * (0.5 + st * 2.0);
          const salpha = st * 0.5 * (1 - st * 0.5);
          const sm = new Matrix();
          sm.translate(-tex.width / 2, -tex.height / 2);
          sm.scale(ssize / tex.width, ssize / tex.height);
          sm.translate(a.tx, a.ty);
          g.rect(a.tx - ssize / 2, a.ty - ssize / 2, ssize, ssize);
          g.fill({ texture: tex, matrix: sm, alpha: salpha });
        }

        // Debris particles (activate on first frame)
        if (a.elapsed < 0.08) {
          for (const p of a.particles) { p.life = p.maxLife; p.maxLife = -1; }
        }
        for (const p of a.particles) {
          if (p.life <= 0) continue;
          const pdt = Math.min(dt, 0.05);
          p.x += p.vx * pdt;
          p.y += p.vy * pdt;
          p.vx *= 0.91;
          p.vy *= 0.91;
          p.vy += 80 * pdt; // gravity
          p.life -= pdt;
          if (p.life <= 0) continue;
          const alpha = p.life / Math.abs(p.maxLife);
          const size = Math.max(2, p.size * (0.4 + alpha * 0.6));
          g.circle(p.x, p.y, size);
          g.fill({ color: p.color, alpha: alpha * 0.8 });
          if (size > 4) {
            g.circle(p.x, p.y, size * 2);
            g.stroke({ color: 0xffffff, width: 1, alpha: alpha * 0.1 });
          }
        }
      }
    }
  }

  // ========== Fire particles on burned cells ==========

  private renderFireParticles(dt: number): void {
    if (!this.state || this.cellSize === 0) return;

    const cs = this.cellSize;
    const burnedSet = new Set(this.state.burnedCells.map(b => `${b.row},${b.col}`));

    // Spawn new particles at each burned cell
    for (const b of this.state.burnedCells) {
      const key = `${b.row},${b.col}`;
      const cx = this.ox + b.col * cs + cs / 2;
      const cy = this.oy + b.row * cs + cs / 2;
      // Limit particles per cell
      const existing = this.fireParticles.filter(p => p.cellKey === key).length;
      if (existing < 3 && Math.random() < 0.15) {
        this.fireParticles.push({
          x: cx + (Math.random() - 0.5) * cs * 0.5,
          y: cy + cs * 0.15,
          vx: (Math.random() - 0.5) * 15,
          vy: -(20 + Math.random() * 40),
          life: 0.6 + Math.random() * 0.8,
          maxLife: 0.6 + Math.random() * 0.8,
          size: 2 + Math.random() * 4,
          cellKey: key,
        });
      }
    }

    // Clean up particles for cells that are no longer burned
    this.fireParticles = this.fireParticles.filter(p => burnedSet.has(p.cellKey));

    // Update and render
    if (this.fireGfx) {
      this.effectLayer.removeChild(this.fireGfx);
      this.fireGfx.destroy();
    }
    if (this.fireParticles.length === 0) return;

    const g = new Graphics();
    for (const p of this.fireParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 15 * dt; // slight upward acceleration
      p.life -= dt;
      if (p.life <= 0) continue;
      const t = p.life / p.maxLife;
      // Color transitions: yellow → orange → red → dark
      const r = 1, gr = 0.5 + t * 0.5, bl = t < 0.5 ? 0 : (t - 0.5) * 2;
      const color = (Math.floor(r * 255) << 16) | (Math.floor(gr * 200) << 8) | Math.floor(bl * 50);
      g.circle(p.x, p.y, p.size * t);
      g.fill({ color, alpha: t * 0.6 });
      // Glow
      g.circle(p.x, p.y, p.size * t * 2.5);
      g.fill({ color, alpha: t * 0.1 });
    }
    // Remove dead particles
    this.fireParticles = this.fireParticles.filter(p => p.life > 0);

    this.fireGfx = g;
    this.effectLayer.addChild(g);
  }

  // ========== Interaction ==========

  /**
   * Use PixiJS's built-in event system for reliable cross-platform interaction.
   * PixiJS internally handles touch→pointer mapping correctly for all devices.
   */
  private setupPixiInteraction(): void {
    const stage = this.app.stage;
    // Enable interaction on the stage (required for events to fire)
    stage.eventMode = 'static';
    // Full-screen hit area covering the renderer viewport
    stage.hitArea = new Rectangle(0, 0, this.app.renderer.width, this.app.renderer.height);

    // Pointer events (works for mouse + touch on all devices)
    stage.on('pointerdown', (e) => {
      const pos = this.eventToPos(e.global);
      if (pos && this.onCellClick) this.onCellClick(pos);
    });

    stage.on('pointermove', (e) => {
      const next = this.eventToPos(e.global);
      const changed = (this.hoveredCell === null) !== (next === null)
        || (this.hoveredCell && next && !posEqual(this.hoveredCell, next));
      this.hoveredCell = next;
      if (changed && this.initialized) this.redraw();
    });

    stage.on('pointerleave', () => {
      this.hoveredCell = null;
      if (this.initialized) this.redraw();
    });

    stage.on('pointerupoutside', () => {
      this.hoveredCell = null;
      if (this.initialized) this.redraw();
    });
  }

  /** Update stage hit area when canvas resizes */
  private updateStageHitArea(): void {
    if (!this.app?.renderer) return;
    this.app.stage.hitArea = new Rectangle(0, 0, this.app.renderer.width, this.app.renderer.height);
  }

  private eventToPos(pt: { x: number; y: number }): Position | null {
    if (!this.state || this.cellSize === 0) return null;
    const col = Math.floor((pt.x - this.ox) / this.cellSize);
    const row = Math.floor((pt.y - this.oy) / this.cellSize);
    if (row < 0 || row >= this.state.boardSize || col < 0 || col >= this.state.boardSize) return null;
    return { row, col };
  }

  private getLegalMoves(): Position[] {
    if (!this.state?.selectedAmazonId) return [];
    const am = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
    if (!am) return [];
    return getQueenMoves(am.position, this.state.boardSize,
      buildBlockedSet(this.state.amazons, this.state.burnedCells));
  }

  private getLegalShots(): Position[] {
    if (!this.state?.pendingMoveTo) return [];
    const temp = this.state.amazons.map(a =>
      a.id === this.state.selectedAmazonId ? { ...a, position: { ...this.state.pendingMoveTo! } } : a);
    return getQueenMoves(this.state.pendingMoveTo, this.state.boardSize,
      buildBlockedSet(temp, this.state.burnedCells));
  }

  // ========== Animation tick ==========

  private tick(): void {
    if (this.destroyed || !this.initialized) return;
    const now = performance.now();

    // Piece glow pulse
    for (const [id, c] of this.pieceSprites) {
      const am = this.state?.amazons.find(a => a.id === id);
      if (!am) continue;
      const phase = (c as any)._pulsePhase || 0;
      if (am.player === this.state?.currentPlayer) {
        // Halo is child[1] (shadow=0, halo=1, sprite/fallback=2, sel=3)
        const halo = c.children[1] as Graphics | undefined;
        if (halo) halo.alpha = 0.12 + Math.sin(now / 1000 * 2.5 + phase) * 0.08;
      }
      const sel = (c as any)._selRing as Graphics | undefined;
      if (sel) sel.alpha = 0.65 + Math.sin(now / 1000 * 3.5) * 0.35;
    }

    // Render animated shot effects with deltaTime
    const dt = this.app.ticker.deltaMS / 1000;
    this.renderMeteorEffects(dt);
    this.renderFireParticles(dt);
    // Advance crater fade-ins (only while explosion is playing)
    const anyExploding = this.meteorAnims.some(a => a.phase === 'impact');
    if (anyExploding) {
      for (const [key, elapsed] of this.craterFadeIns) {
        this.craterFadeIns.set(key, elapsed + dt);
      }
    }
  }
}
