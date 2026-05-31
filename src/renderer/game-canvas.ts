import { Application, Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import type { GameState, Position } from '../game/types';
import type { Theme } from '../themes/types';
import { posEqual, getQueenMoves, buildBlockedSet } from '../game/rules';

interface ShotEffect {
  fx: number; fy: number;   // from (amazon position)
  tx: number; ty: number;   // to (target)
  startTime: number;
  duration: number;
  color: number;
  particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number; size: number }[];
  done: boolean;
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
  private burnGfx: Graphics | null = null;
  private pieceSprites: Map<string, Container> = new Map();
  private shotEffects: ShotEffect[] = [];
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
    if (this.burnGfx) { this.burnLayer.removeChild(this.burnGfx); this.burnGfx.destroy(); }
    if (!this.state) return;

    const g = new Graphics();
    const cs = this.cellSize;

    for (const b of this.state.burnedCells) {
      const x = this.ox + b.col * cs, y = this.oy + b.row * cs;
      const cx = x + cs / 2, cy = y + cs / 2;

      for (let i = 3; i >= 1; i--) {
        g.circle(cx, cy, cs * 0.4 * i / 3);
        g.fill({ color: this.theme.effects.burnGlow, alpha: 0.08 + i * 0.04 });
      }

      g.rect(x + 2, y + 2, cs - 4, cs - 4);
      g.fill({ color: this.theme.effects.burn, alpha: 0.18 });

      const m = cs * 0.2;
      g.moveTo(x + m, y + m);
      g.lineTo(x + cs - m, y + cs - m);
      g.stroke({ color: this.theme.effects.burn, width: Math.max(2, cs * 0.04), alpha: 0.55 });

      g.moveTo(x + cs - m, y + m);
      g.lineTo(x + m, y + cs - m);
      g.stroke({ color: this.theme.effects.burn, width: Math.max(2, cs * 0.04), alpha: 0.55 });
    }

    this.burnGfx = g;
    this.burnLayer.addChild(g);
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

    // Glow trail
    g.moveTo(fx, fy);
    g.lineTo(tx, ty);
    g.stroke({ color: this.theme.effects.arrowTrail, width: 6, alpha: 0.12 });

    // Dashed move line
    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.floor(dist / 6), 2);
    for (let i = 0; i < steps; i += 2) {
      g.moveTo(fx + dx * i / steps, fy + dy * i / steps);
      g.lineTo(fx + dx * Math.min(i + 1, steps) / steps, fy + dy * Math.min(i + 1, steps) / steps);
    }
    g.stroke({ color: this.theme.effects.arrowTrail, width: 2.5, alpha: 0.45 });

    this.effectLayer.addChild(g);
    setTimeout(() => { this.effectLayer.removeChild(g); g.destroy(); }, 3000);
  }

  // ========== Animated shot system ==========

  /** Launch a shot animation from `from` position to `to` target. */
  private startShotEffect(from: Position, to: Position): void {
    const cs = this.cellSize;
    const fx = this.ox + from.col * cs + cs / 2;
    const fy = this.oy + from.row * cs + cs / 2;
    const tx = this.ox + to.col * cs + cs / 2;
    const ty = this.oy + to.row * cs + cs / 2;

    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Generate impact particles
    const particles: ShotEffect['particles'] = [];
    const pColor = this.theme.effects.particle;
    for (let i = 0; i < 16; i++) {
      const a = angle + Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 40 + Math.random() * 100;
      particles.push({
        x: tx, y: ty,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.4 + Math.random() * 0.5,
        color: Math.random() > 0.5 ? pColor : this.theme.effects.burnGlow,
        size: 3 + Math.random() * 6,
      });
    }

    this.shotEffects.push({
      fx, fy, tx, ty,
      startTime: performance.now(),
      duration: Math.max(300, Math.min(600, dist * 1.5)),
      color: this.theme.effects.arrow,
      particles,
      done: false,
    });
  }

  /** Render all active shot animations (called from ticker). */
  private renderShotEffects(): void {
    const now = performance.now();
    // Use a single Graphics per frame for all effects
    if (this.shotEffects.length === 0) return;
    const g = new Graphics();

    for (const fx of this.shotEffects) {
      const elapsed = now - fx.startTime;
      const t = Math.min(elapsed / fx.duration, 1);
      // Ease-out
      const et = 1 - (1 - t) * (1 - t);

      // Arrow head position interpolated along path
      const hx = fx.fx + (fx.tx - fx.fx) * et;
      const hy = fx.fy + (fx.ty - fx.fy) * et;

      // Glow trail behind the arrow head
      const trailLen = 0.3;
      const tStart = Math.max(0, et - trailLen);
      const sx = fx.fx + (fx.tx - fx.fx) * tStart;
      const sy = fx.fy + (fx.ty - fx.fy) * tStart;

      // Trail glow (wide)
      g.moveTo(sx, sy);
      g.lineTo(hx, hy);
      g.stroke({ color: fx.color, width: 6, alpha: 0.15 * (1 - t * 0.3) });

      // Trail core
      g.moveTo(sx, sy);
      g.lineTo(hx, hy);
      g.stroke({ color: fx.color, width: 2.5, alpha: 0.55 * (1 - t * 0.3) });

      // Arrow head at current position
      const angle = Math.atan2(fx.ty - fx.fy, fx.tx - fx.fx);
      const hl = Math.max(7, this.cellSize * 0.12);
      const ha = Math.PI / 4.5;
      g.moveTo(hx, hy);
      g.lineTo(hx - hl * Math.cos(angle - ha), hy - hl * Math.sin(angle - ha));
      g.lineTo(hx - hl * 0.3 * Math.cos(angle), hy - hl * 0.3 * Math.sin(angle));
      g.lineTo(hx - hl * Math.cos(angle + ha), hy - hl * Math.sin(angle + ha));
      g.closePath();
      g.fill({ color: fx.color, alpha: 0.7 + 0.3 * (1 - t) });

      // Impact burst at target (only when close enough)
      if (et > 0.6) {
        const burstProgress = (et - 0.6) / 0.4;
        const br = burstProgress * this.cellSize * 0.35;
        g.circle(fx.tx, fx.ty, br);
        g.fill({ color: this.theme.effects.burnGlow, alpha: 0.12 * (1 - burstProgress * 0.5) });
        g.circle(fx.tx, fx.ty, br * 0.6);
        g.stroke({ color: this.theme.effects.arrow, width: 2, alpha: 0.4 * (1 - burstProgress) });
      }

      // Update particles
      const dt = Math.min(elapsed / 1000, 0.05);
      for (const p of fx.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.life -= dt;
      }
      // Draw particles
      for (const p of fx.particles) {
        if (p.life <= 0) continue;
        const alpha = p.life / p.maxLife;
        g.circle(p.x, p.y, p.size * alpha);
        g.fill({ color: p.color, alpha: alpha * 0.7 });
      }
    }

    this.effectLayer.addChild(g);
    // Clean up after the frame
    setTimeout(() => {
      this.effectLayer.removeChild(g);
      g.destroy();
      // Remove completed effects after render
      this.shotEffects = this.shotEffects.filter(fx => {
        const elapsed = performance.now() - fx.startTime;
        return elapsed < fx.duration + 800; // extra time for particles
      });
    }, 50);
  }

  // ========== Interaction ==========

  private setupInteraction(): void {
    if (!this.app?.canvas) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.cursor = 'pointer';

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

    // Render animated shot effects
    this.renderShotEffects();
  }
}
