import { Application, Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
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
interface ShotAnim {
  fx: number; fy: number;
  tx: number; ty: number;
  elapsed: number;
  bowDuration: number;   // draw phase
  flyDuration: number;    // arrow flight
  color: number;
  particles: Particle[];
  phase: 'bow' | 'fly' | 'impact' | 'done';
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
  private shotAnims: ShotAnim[] = [];
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

    // Make canvas fill the container
    if (!this.app?.canvas) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    container.appendChild(canvas);
    this.setupInteraction();

    this.app.ticker.add(() => this.tick());

    this.resizeObs = new ResizeObserver(() => this.handleResize());
    this.resizeObs.observe(container);

    this.initialized = true;

    // Load pre-generated textures for current theme
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

    // Piece textures
    this.loadImage(`/textures/${themeId}-piece-white.png`, (img) => {
      this.pieceTexWhite = Texture.from(img);
      this.redraw();
    });
    this.loadImage(`/textures/${themeId}-piece-black.png`, (img) => {
      this.pieceTexBlack = Texture.from(img);
      this.redraw();
    });
    // Burn/crater texture
    this.loadImage(`/textures/${themeId}-burn.png`, (img) => {
      this.burnTex = Texture.from(img);
      this.redraw();
    });
  }

  private loadImage(url: string, onLoad: (img: HTMLImageElement) => void): void {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.onerror = () => {}; // Silently skip if not generated
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

    // — Table surface shadow —
    const sp = cs * 0.35;
    for (let i = 3; i >= 1; i--) {
      g.rect(bx - sp * i / 3 - i, by - sp * i / 3 - i,
             bw + sp * i / 3 * 2 + i * 2, bw + sp * i / 3 * 2 + i * 2);
      g.fill({ color: 0x000000, alpha: 0.12 - i * 0.03 });
    }

    // — Outer frame —
    const fw = cs * 0.25;
    g.rect(bx - fw, by - fw, bw + fw * 2, bw + fw * 2);
    g.fill({ color: this.theme.board.border, alpha: 0.5 });

    // — Board surface (semi-transparent over texture) —
    g.rect(bx, by, bw, bw);
    g.fill({ color: this.theme.background.surface, alpha: this.boardTexSprite ? 0.65 : 0.9 });
    g.stroke({ color: this.theme.board.border, width: 2, alpha: 0.9 });

    // — Cells (semi-transparent over board surface) —
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = bx + c * cs, y = by + r * cs;
        const isLight = (r + c) % 2 === 0;
        g.rect(x, y, cs, cs);
        g.fill({ color: isLight ? this.theme.board.light : this.theme.board.dark, alpha: 0.75 });
      }
    }

    // — Corner ornaments —
    this.drawCorner(g, bx, by, cs, 1);
    this.drawCorner(g, bx + bw, by, cs, -1);
    this.drawCorner(g, bx, by + bw, cs, -1, 1);
    this.drawCorner(g, bx + bw, by + bw, cs, 1, 1);

    // — Coordinate labels —
    const fs = Math.max(10, cs * 0.15);
    const ls = { fontSize: fs, fill: this.theme.board.border, fontFamily: 'serif', fontWeight: 'bold' };
    for (let i = 0; i < size; i++) {
      const cl = new Text({ text: String.fromCharCode(65 + i), style: ls });
      cl.x = bx + i * cs + cs / 2 - cl.width / 2;
      cl.y = by - fw / 2 - cl.height / 2;
      g.addChild(cl);

      const rl = new Text({ text: String(size - i), style: ls });
      rl.x = bx - fw / 2 - rl.width / 2;
      rl.y = by + i * cs + cs / 2 - rl.height / 2;
      g.addChild(rl);
    }

    this.boardGfx = g;
    this.boardLayer.addChild(g);
  }

  private drawCorner(g: Graphics, cx: number, cy: number, cs: number, dx: number, dy?: number): void {
    const s = cs * 0.18;
    const ox = dx < 0 ? -s : 0;
    const oy = (dy ?? dx) < 0 ? -s : 0;
    g.moveTo(cx + ox, cy + oy + s);
    g.lineTo(cx + ox, cy + oy);
    g.lineTo(cx + ox + s, cy + oy);
    g.stroke({ color: this.theme.board.border, width: 2.5, alpha: 0.7 });
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
        // Use AI-generated crater texture
        const sprite = new Sprite(this.burnTex);
        sprite.anchor.set(0.5);
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
      this.startShotEffect(last.to, last.arrow);
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

  private startShotEffect(from: Position, to: Position): void {
    const cs = this.cellSize;
    const fx = this.ox + from.col * cs + cs / 2;
    const fy = this.oy + from.row * cs + cs / 2;
    const tx = this.ox + to.col * cs + cs / 2;
    const ty = this.oy + to.row * cs + cs / 2;

    const dist = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2);
    const color = this.theme.effects.arrow;
    const pColor = this.theme.effects.particle;
    const burnColor = this.theme.effects.burnGlow;

    // Pre-spawn particles for impact burst
    const particles: Particle[] = [];
    const shootAngle = Math.atan2(ty - fy, tx - fx);
    for (let i = 0; i < 50; i++) {
      const p = poolGet();
      p.x = tx; p.y = ty;
      // Fan out from the arrow's direction
      const a = shootAngle + Math.PI + (Math.random() - 0.5) * Math.PI * 0.7;
      const speed = 50 + Math.random() * 200;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.life = 0; p.maxLife = 0.5 + Math.random() * 0.6;
      p.color = i < 12 ? color : (i < 24 ? pColor : burnColor);
      p.size = 2 + Math.random() * 5;
      particles.push(p);
    }

    this.shotAnims.push({
      fx, fy, tx, ty,
      elapsed: 0,
      bowDuration: 0.18,                    // draw flash (visible)
      flyDuration: Math.max(300, Math.min(550, dist * 1.5)),
      color,
      particles,
      phase: 'bow',
    });
  }

  private renderShotEffects(dt: number): void {
    // Create persistent Graphics if not exists
    if (!this.shotGfx) {
      this.shotGfx = new Graphics();
      this.effectLayer.addChild(this.shotGfx);
    }

    // Clean up completed animations
    this.shotAnims = this.shotAnims.filter(a => {
      if (a.phase === 'impact') {
        a.elapsed += dt;
        if (a.elapsed > 1.2) {
          for (const p of a.particles) poolPut(p);
          return false;
        }
      }
      return true;
    });

    // Destroy Graphics when all done
    if (this.shotAnims.length === 0) {
      if (this.shotGfx) {
        this.effectLayer.removeChild(this.shotGfx);
        this.shotGfx.destroy();
        this.shotGfx = null;
      }
      return;
    }

    const g = this.shotGfx;
    g.clear();
    const cs = this.cellSize;

    for (const a of this.shotAnims) {
      a.elapsed += dt;

      // ── BOW DRAW ──
      if (a.phase === 'bow') {
        const t = Math.min(a.elapsed / a.bowDuration, 1);
        const ringR = cs * 0.4 * Ease.outCubic(t);
        g.circle(a.fx, a.fy, ringR);
        g.stroke({ color: 0xffffff, width: 3, alpha: 0.8 * (1 - t) });
        g.circle(a.fx, a.fy, ringR * 1.4);
        g.stroke({ color: a.color, width: 2, alpha: 0.5 * (1 - t) });
        g.circle(a.fx, a.fy, cs * 0.15 * (1 - t));
        g.fill({ color: 0xffffff, alpha: 0.7 * (1 - t) });
        if (t >= 1) { a.phase = 'fly'; a.elapsed = 0; }
      }

      // ── ARROW FLIGHT ──
      if (a.phase === 'fly') {
        const t = Math.min(a.elapsed / a.flyDuration, 1);
        const et = Ease.inQuad(t);
        const hx = a.fx + (a.tx - a.fx) * et;
        const hy = a.fy + (a.ty - a.fy) * et;
        const angle = Math.atan2(a.ty - a.fy, a.tx - a.fx);
        const hl = Math.max(8, cs * 0.12);

        // Full trail from start to current (persistent on the shared gfx)
        g.moveTo(a.fx, a.fy);
        g.lineTo(hx, hy);
        g.stroke({ color: a.color, width: 3, alpha: 0.7 });

        g.moveTo(a.fx, a.fy);
        g.lineTo(hx, hy);
        g.stroke({ color: 0xffffff, width: 7, alpha: 0.2 });

        // Arrow head
        const ha = Math.PI / 5;
        g.moveTo(hx, hy);
        g.lineTo(hx - hl * Math.cos(angle - ha), hy - hl * Math.sin(angle - ha));
        g.lineTo(hx - hl * 0.2 * Math.cos(angle), hy - hl * 0.2 * Math.sin(angle));
        g.lineTo(hx - hl * Math.cos(angle + ha), hy - hl * Math.sin(angle + ha));
        g.closePath();
        g.fill({ color: a.color, alpha: 0.9 });

        // Feathers
        const tx = hx - hl * 1.1 * Math.cos(angle);
        const ty = hy - hl * 1.1 * Math.sin(angle);
        const fa = angle + Math.PI / 2;
        g.moveTo(tx, ty);
        g.lineTo(tx + hl * 0.6 * Math.cos(fa - 0.4), ty + hl * 0.6 * Math.sin(fa - 0.4));
        g.moveTo(tx, ty);
        g.lineTo(tx + hl * 0.6 * Math.cos(fa + 0.4), ty + hl * 0.6 * Math.sin(fa + 0.4));
        g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.7 });

        if (t >= 1) { a.phase = 'impact'; a.elapsed = 0; }
      }

      // ── IMPACT ──
      if (a.phase === 'impact') {
        const t = Math.min(a.elapsed / 0.7, 1);
        const ringR = cs * 0.5 * t;
        g.circle(a.tx, a.ty, ringR);
        g.stroke({ color: a.color, width: 3, alpha: 0.7 * (1 - t) });
        g.circle(a.tx, a.ty, ringR * 0.6);
        g.fill({ color: this.theme.effects.burnGlow, alpha: 0.2 * (1 - t) });

        // Activate & update particles
        if (a.elapsed < 0.1) {
          // First frame of impact — activate all
          for (const p of a.particles) { p.life = p.maxLife; p.maxLife = -1; }
        }
        for (const p of a.particles) {
          if (p.life <= 0) continue;
          const pdt = Math.min(dt, 0.05);
          p.x += p.vx * pdt;
          p.y += p.vy * pdt;
          p.vx *= 0.92;
          p.vy *= 0.92;
          p.life -= pdt;
          if (p.life <= 0) continue;
          const alpha = p.life / Math.abs(p.maxLife);
          g.circle(p.x, p.y, Math.max(2, p.size * alpha));
          g.fill({ color: p.color, alpha: alpha * 0.7 });
        }
      }
    }
  }

  // ========== Interaction ==========

  private setupInteraction(): void {
    if (!this.app?.canvas) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.cursor = 'pointer';
    canvas.style.touchAction = 'none'; // prevent scroll/zoom on touch

    canvas.addEventListener('click', (e: MouseEvent) => {
      const pos = this.eventToPos(e);
      if (pos && this.onCellClick) this.onCellClick(pos);
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const next = this.eventToPos(e);
      const changed = (this.hoveredCell === null) !== (next === null)
        || (this.hoveredCell && next && !posEqual(this.hoveredCell, next));
      this.hoveredCell = next;
      if (changed && this.initialized) this.redraw();
    });
    canvas.addEventListener('mouseleave', () => {
      this.hoveredCell = null;
      if (this.initialized) this.redraw();
    });
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      const pos = this.eventToPos(e.touches[0]);
      if (pos && this.onCellClick) this.onCellClick(pos);
    }, { passive: false });
  }

  private eventToPos(e: { clientX: number; clientY: number }): Position | null {
    if (!this.state || this.cellSize === 0 || !this.app?.canvas) return null;
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const col = Math.floor((x - this.ox) / this.cellSize);
    const row = Math.floor((y - this.oy) / this.cellSize);
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
    this.renderShotEffects(dt);
  }
}
