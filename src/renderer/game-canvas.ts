import { Application, Container, Graphics, Text, Sprite, Texture, Rectangle, Matrix, Assets } from 'pixi.js';

/** Get texture URL — use PNG for quality */
function texURL(path: string): string {
  return path; // PNG — quality over size
}
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
export class GameCanvas {
  private app!: Application;
  private bgContainer!: Container;
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
  private lastRedrawTime = 0;
  private lastBurnedCount = -1;
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
    this.boardTexLayer = new Container();
    this.boardLayer = new Container();
    this.burnLayer = new Container();
    this.pieceLayer = new Container();
    this.effectLayer = new Container();

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
    this.loadImage(texURL('/vfx/fireball.png'), (img) => { this.vfxFireball = Texture.from(img); });
    this.loadImage(texURL('/vfx/explosion.png'), (img) => { this.vfxExplosion = Texture.from(img); });
    this.loadImage(texURL('/vfx/smoke.png'), (img) => { this.vfxSmoke = Texture.from(img); });

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

    // Background texture — rendered in PixiJS below everything
    this.bgContainer = new Container();
    this.app.stage.addChildAt(this.bgContainer, 0); // insert at bottom
    this.loadImage(texURL(`/textures/${themeId}-bg.png`), (img) => {
      if (this.bgSprite) { this.bgContainer.removeChild(this.bgSprite); this.bgSprite.destroy(); }
      const tex = Texture.from(img);
      this.bgSprite = new Sprite(tex);
      this.bgSprite.alpha = 0.8;
      this.bgContainer.addChild(this.bgSprite);
      this.fitBackground();
    });

    // Board texture
    this.loadImage(texURL(`/textures/${themeId}-board.png`), (img) => {
      if (this.boardTexSprite) { this.boardTexLayer.removeChild(this.boardTexSprite); this.boardTexSprite.destroy(); }
      this.boardTexSprite = new Sprite(Texture.from(img));
      this.boardTexLayer.addChild(this.boardTexSprite);
      this.texturesLoaded = true;
      this.redraw();
    });

    // Piece textures — reuse avatar images
    this.loadTransparent(texURL(`/avatars/${themeId}-white.png`), (img) => {
      this.pieceTexWhite = Texture.from(img);
      this.redraw();
    });
    this.loadTransparent(texURL(`/avatars/${themeId}-black.png`), (img) => {
      this.pieceTexBlack = Texture.from(img);
      this.redraw();
    });
    // Burn/crater texture (transparent for overlay)
    this.loadTransparent(texURL(`/textures/${themeId}-burn.png`), (img) => {
      this.burnTex = Texture.from(img);
      this.redraw();
    });
    // Tile textures
    this.loadImage(texURL(`/textures/${themeId}-tile-light.png`), (img) => {
      this.tileLight = Texture.from(img);
      this.redraw();
    });
    this.loadImage(texURL(`/textures/${themeId}-tile-dark.png`), (img) => {
      this.tileDark = Texture.from(img);
      this.redraw();
    });
  }

  private loadImage(url: string, onLoad: (img: HTMLImageElement) => void): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => onLoad(img);
    img.onerror = () => {
      // WebP fallback → PNG
      if (url.endsWith('.webp')) {
        const pngUrl = url.replace('.webp', '.png');
        const fallback = new Image();
        fallback.crossOrigin = 'anonymous';
        fallback.onload = () => onLoad(fallback);
        fallback.src = pngUrl;
      }
    };
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

      // Aggressive chroma key — removes green/white bg, keeps subject
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const a = pixels[i + 3];
        // Key out green tones (broad range)
        const isGreen = g > 120 && g > r * 1.1 && g > b * 1.1;
        // Key out near-white/gray bg
        const isGray = r > 180 && g > 180 && b > 180 && Math.abs(r - g) < 40 && Math.abs(g - b) < 40;
        // Key out magenta
        const isMagenta = r > 150 && b > 150 && g < r * 0.6 && g < b * 0.6;
        if (isGreen || isGray || isMagenta) {
          pixels[i + 3] = 0;
        }
        // Edge feather: partial transparency for semi-green pixels
        if (a > 0 && g > 100 && g > r * 0.9 && g > b * 0.9) {
          const greenness = (g - Math.max(r, b)) / 255;
          pixels[i + 3] = Math.floor(a * Math.max(0, 1 - greenness * 2));
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

  /** Scale background to fill viewport using renderer dimensions */
  private fitBackground(): void {
    if (!this.bgSprite || !this.app?.renderer) return;
    const rw = this.app.renderer.width;
    const rh = this.app.renderer.height;
    if (rw === 0 || rh === 0) return;
    const tw = this.bgSprite.texture.width;
    const th = this.bgSprite.texture.height;
    if (tw === 0 || th === 0) return;
    const scale = Math.max(rw / tw, rh / th);
    this.bgSprite.width = Math.round(tw * scale);
    this.bgSprite.height = Math.round(th * scale);
    this.bgSprite.x = Math.round((rw - this.bgSprite.width) / 2);
    this.bgSprite.y = Math.round((rh - this.bgSprite.height) / 2);
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
    this.fitBackground();
    this.updateStageHitArea();
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
    if (!this.state) return;
    // Cache: only rebuild when burned cells change
    if (this.lastBurnedCount === this.state.burnedCells.length && this.burnGfx) return;
    this.lastBurnedCount = this.state.burnedCells.length;

    if (this.burnGfx) { this.burnLayer.removeChild(this.burnGfx); this.burnGfx.destroy({ children: true }); }

    const cs = this.cellSize;
    const c = new Container();

    for (const b of this.state.burnedCells) {
      const cx = this.ox + b.col * cs + cs / 2;
      const cy = this.oy + b.row * cs + cs / 2;

      if (this.burnTex) {
        const sprite = new Sprite(this.burnTex);
        sprite.anchor.set(0.5);
        sprite.alpha = 0.75;
        sprite.width = cs * 0.88;
        sprite.height = cs * 0.88;
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
      this.drawMoveArrow(last.from, last.to);
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

    // ── Main sprite (circular mask) ──
    if (tex) {
      // Circular mask to crop the sprite
      const mask = new Graphics();
      mask.circle(0, 0, size * 0.46);
      mask.fill({ color: 0xffffff });
      c.addChild(mask);

      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.width = size * 0.95;
      sprite.height = size * 0.95;
      sprite.mask = mask;
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
      // Throttle redraw to ~30fps on hover
      if (changed && this.initialized) {
        const now = performance.now();
        if (now - this.lastRedrawTime > 33) { this.lastRedrawTime = now; this.redraw(); }
      }
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
    this.renderFireParticles(dt);
  }
}
