import { Application, Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import type { GameState, Position } from '../game/types';
import type { Theme } from '../themes/types';
import { posEqual, getQueenMoves, buildBlockedSet } from '../game/rules';

export class GameCanvas {
  private app!: Application;
  private bgLayer!: Container;
  private boardLayer!: Container;
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
  private burnGfx: Graphics | null = null;
  private pieceSprites: Map<string, Container> = new Map();
  private initialized = false;
  private pendingState: GameState | null = null;
  private resizeObs: ResizeObserver | null = null;
  private container: HTMLElement | null = null;
  private bgSprite: Sprite | null = null;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  // ========== Lifecycle ==========

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
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

    // Layer ordering: bg → board → burn → pieces → effects
    this.bgLayer = new Container();
    this.boardLayer = new Container();
    this.burnLayer = new Container();
    this.pieceLayer = new Container();
    this.effectLayer = new Container();

    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.boardLayer);
    this.app.stage.addChild(this.burnLayer);
    this.app.stage.addChild(this.pieceLayer);
    this.app.stage.addChild(this.effectLayer);

    container.appendChild(this.app.canvas as HTMLCanvasElement);
    this.setupInteraction();

    this.app.ticker.add(() => this.tick());

    this.resizeObs = new ResizeObserver(() => this.handleResize());
    this.resizeObs.observe(container);

    this.initialized = true;

    if (this.pendingState) {
      this.setState(this.pendingState);
      this.pendingState = null;
    }

    this.handleResize();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    if (this.initialized) {
      this.app.renderer.background = theme.background.primary;
      this.redraw();
    }
  }

  setState(state: GameState): void {
    if (!this.initialized) { this.pendingState = state; return; }
    this.state = state;
    this.recalcSize();
    this.redraw();
  }

  setOnCellClick(cb: (pos: Position) => void): void { this.onCellClick = cb; }

  /** Set an AI-generated background image. Pass undefined to remove. */
  setBackgroundImage(dataUrl: string | undefined): void {
    if (!this.initialized) return;
    // Remove existing
    if (this.bgSprite) { this.bgLayer.removeChild(this.bgSprite); this.bgSprite.destroy(); this.bgSprite = null; }
    if (!dataUrl) return;

    const img = new Image();
    img.onload = () => {
      const tex = Texture.from(img);
      const sprite = new Sprite(tex);
      // Cover the entire viewport
      const w = this.container?.clientWidth || 800;
      const h = this.container?.clientHeight || 600;
      const scale = Math.max(w / tex.width, h / tex.height);
      sprite.width = tex.width * scale;
      sprite.height = tex.height * scale;
      sprite.x = (w - sprite.width) / 2;
      sprite.y = (h - sprite.height) / 2;
      sprite.alpha = 0.5;
      this.bgLayer.addChild(sprite);
      this.bgSprite = sprite;
    };
    img.src = dataUrl;
  }

  destroy(): void {
    this.initialized = false;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    try { this.app.destroy(true); } catch { /* v8.18 _cancelResize */ }
  }

  // ========== Sizing ==========

  private handleResize(): void {
    if (!this.initialized || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.app.renderer.resize(w, h);
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
    const shadowPad = cs * 0.35;
    for (let i = 3; i >= 1; i--) {
      g.rect(bx - shadowPad * i / 3 - i, by - shadowPad * i / 3 - i,
             bw + shadowPad * i / 3 * 2 + i * 2, bw + shadowPad * i / 3 * 2 + i * 2);
      g.fill({ color: 0x000000, alpha: 0.12 - i * 0.03 });
    }

    // — Outer frame —
    const frameW = cs * 0.25;
    g.rect(bx - frameW, by - frameW, bw + frameW * 2, bw + frameW * 2);
    g.fill({ color: this.theme.board.border, alpha: 0.5 });

    // — Board surface —
    g.rect(bx, by, bw, bw);
    g.fill({ color: this.theme.background.surface, alpha: 0.9 });
    g.stroke({ color: this.theme.board.border, width: 2, alpha: 0.9 });

    // — Cells —
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = bx + c * cs, y = by + r * cs;
        const isLight = (r + c) % 2 === 0;
        g.rect(x, y, cs, cs);
        g.fill({ color: isLight ? this.theme.board.light : this.theme.board.dark });
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
      cl.y = by - frameW / 2 - cl.height / 2;
      g.addChild(cl);

      const rl = new Text({ text: String(size - i), style: ls });
      rl.x = bx - frameW / 2 - rl.width / 2;
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

      // Radial burn glow — concentric circles
      for (let i = 3; i >= 1; i--) {
        g.circle(cx, cy, cs * 0.4 * i / 3);
        g.fill({ color: this.theme.effects.burnGlow, alpha: 0.08 + i * 0.04 });
      }

      // Burn overlay
      g.rect(x + 2, y + 2, cs - 4, cs - 4);
      g.fill({ color: this.theme.effects.burn, alpha: 0.18 });

      // X mark — thicker, centered
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

    // Use a fresh graphics layer each frame (cheap)
    const g = this.boardGfx;
    if (!g) return;

    // — Last move indicators —
    if (this.state.moveHistory.length > 0) {
      const last = this.state.moveHistory[this.state.moveHistory.length - 1];
      this.drawCellGlow(g, last.from, 0xffffff, 0.12);
      this.drawCellGlow(g, last.to, 0xffffff, 0.15);
    }

    // — Legal move targets when a piece is selected —
    if (this.state.step === 'move' && this.state.selectedAmazonId) {
      const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
      if (amazon) {
        this.drawCellHighlight(g, amazon.position, this.theme.board.highlight, 0.55);
        for (const pos of this.getLegalMoves()) {
          this.drawCellDot(g, pos, 0x88ff88, 0.5);
        }
      }
    }

    // — Legal shot targets —
    if (this.state.step === 'shoot' && this.state.pendingMoveTo) {
      this.drawCellHighlight(g, this.state.pendingMoveTo, 0x44ff44, 0.3);
      for (const pos of this.getLegalShots()) {
        this.drawCellDot(g, pos, this.theme.board.shotHighlight, 0.5);
      }
    }

    // — Hovered cell —
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
    const cs = this.cellSize;
    g.rect(x + 2, y + 2, cs - 4, cs - 4);
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

    // Last move arrows
    if (this.state.moveHistory.length > 0) {
      const last = this.state.moveHistory[this.state.moveHistory.length - 1];
      this.drawMoveArrow(last.from, last.to);
      this.drawShotArrow(last.to, last.arrow);
    }
  }

  private createPiece(
    amazon: { id: string; player: 'white' | 'black'; position: Position },
  ): Container {
    const c = new Container();
    const cs = this.cellSize;
    const cx = this.ox + amazon.position.col * cs + cs / 2;
    const cy = this.oy + amazon.position.row * cs + cs / 2;
    const r = cs * 0.38;

    const isWhite = amazon.player === 'white';
    const fill = isWhite ? this.theme.pieces.white : this.theme.pieces.black;
    const glow = isWhite ? this.theme.pieces.whiteGlow : this.theme.pieces.blackGlow;
    const shadow = isWhite ? this.theme.pieces.whiteShadow : this.theme.pieces.blackShadow;

    // — Shadow (offset slightly) —
    const sd = cs * 0.04;
    const shade = new Graphics();
    shade.circle(sd, sd * 1.5, r);
    shade.fill({ color: 0x000000, alpha: 0.25 });

    // — Outer glow halo —
    const halo = new Graphics();
    halo.circle(0, 0, r + 4);
    halo.fill({ color: glow, alpha: 0.25 });

    // — Main body with 3D gradient (layered circles) —
    const body = new Graphics();
    // Base
    body.circle(0, 0, r);
    body.fill({ color: fill });
    // Highlight (upper-left)
    body.circle(-r * 0.25, -r * 0.25, r * 0.55);
    body.fill({ color: 0xffffff, alpha: 0.2 });
    // Rim
    body.circle(0, 0, r);
    body.stroke({ color: shadow, width: 1.5, alpha: 0.5 });

    // — Inner ring —
    const ring = new Graphics();
    ring.circle(0, 0, r * 0.68);
    ring.stroke({ color: glow, width: Math.max(1, cs * 0.025), alpha: 0.4 });

    // — Crown ornament —
    const crown = new Graphics();
    const s = r * 0.42;
    crown.moveTo(-s, s * 0.25);
    crown.lineTo(-s * 0.7, -s * 0.45);
    crown.lineTo(-s * 0.3, s * 0.08);
    crown.lineTo(0, -s * 0.75);
    crown.lineTo(s * 0.3, s * 0.08);
    crown.lineTo(s * 0.7, -s * 0.45);
    crown.lineTo(s, s * 0.25);
    crown.closePath();
    crown.fill({ color: glow, alpha: 0.45 });
    crown.stroke({ color: fill, width: 0.5, alpha: 0.6 });

    // — Selection ring (animated) —
    if (this.state?.selectedAmazonId === amazon.id) {
      const sel = new Graphics();
      sel.circle(0, 0, r + 6);
      sel.stroke({ color: 0x4ecdc4, width: 2.5, alpha: 0.9 });
      sel.circle(0, 0, r + 9);
      sel.stroke({ color: 0x4ecdc4, width: 1, alpha: 0.35 });
      c.addChild(sel);
      (c as any)._selRing = sel;
    }

    c.addChild(shade);
    c.addChild(halo);
    c.addChild(body);
    c.addChild(ring);
    c.addChild(crown);

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
    const fx = this.ox + from.col * cs + cs / 2;
    const fy = this.oy + from.row * cs + cs / 2;
    const tx = this.ox + to.col * cs + cs / 2;
    const ty = this.oy + to.row * cs + cs / 2;

    // Glow under-line
    g.moveTo(fx, fy);
    g.lineTo(tx, ty);
    g.stroke({ color: this.theme.effects.arrowTrail, width: 5, alpha: 0.15 });

    // Dashed line
    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.floor(dist / 7), 2);
    for (let i = 0; i < steps; i += 2) {
      g.moveTo(fx + dx * i / steps, fy + dy * i / steps);
      g.lineTo(fx + dx * Math.min(i + 1, steps) / steps, fy + dy * Math.min(i + 1, steps) / steps);
    }
    g.stroke({ color: this.theme.effects.arrowTrail, width: 2.5, alpha: 0.5 });

    this.effectLayer.addChild(g);
    setTimeout(() => { this.effectLayer.removeChild(g); g.destroy(); }, 2000);
  }

  private drawShotArrow(from: Position, to: Position): void {
    const g = new Graphics();
    const cs = this.cellSize;
    const fx = this.ox + from.col * cs + cs / 2;
    const fy = this.oy + from.row * cs + cs / 2;
    const tx = this.ox + to.col * cs + cs / 2;
    const ty = this.oy + to.row * cs + cs / 2;

    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Glow trail
    g.moveTo(fx, fy);
    g.lineTo(tx, ty);
    g.stroke({ color: this.theme.effects.arrow, width: 6, alpha: 0.12 });

    // Dashed line
    const steps = Math.max(Math.floor(dist / 5), 2);
    for (let i = 0; i < steps; i += 2) {
      g.moveTo(fx + dx * i / steps, fy + dy * i / steps);
      g.lineTo(fx + dx * Math.min(i + 1, steps) / steps, fy + dy * Math.min(i + 1, steps) / steps);
    }
    g.stroke({ color: this.theme.effects.arrow, width: 3, alpha: 0.6 });

    // Arrow head (filled)
    const angle = Math.atan2(dy, dx);
    const hl = Math.max(8, cs * 0.14), ha = Math.PI / 4.5;
    g.moveTo(tx, ty);
    g.lineTo(tx - hl * Math.cos(angle - ha), ty - hl * Math.sin(angle - ha));
    g.lineTo(tx - hl * 0.3 * Math.cos(angle), ty - hl * 0.3 * Math.sin(angle));
    g.lineTo(tx - hl * Math.cos(angle + ha), ty - hl * Math.sin(angle + ha));
    g.closePath();
    g.fill({ color: this.theme.effects.arrow, alpha: 0.8 });

    this.effectLayer.addChild(g);
    setTimeout(() => { this.effectLayer.removeChild(g); g.destroy(); }, 2000);
  }

  // ========== Interaction ==========

  private setupInteraction(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.cssText = 'position:absolute;top:0;left:0;cursor:pointer;';

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
    if (!this.state || this.cellSize === 0) return null;
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const col = Math.floor((x - this.ox) / this.cellSize);
    const row = Math.floor((y - this.oy) / this.cellSize);
    if (row < 0 || row >= this.state.boardSize || col < 0 || col >= this.state.boardSize) return null;
    return { row, col };
  }

  // ========== Legal targets ==========

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
    const now = performance.now();

    for (const [id, c] of this.pieceSprites) {
      const am = this.state?.amazons.find(a => a.id === id);
      if (!am) continue;
      const phase = (c as any)._pulsePhase || 0;
      if (am.player === this.state?.currentPlayer) {
        const halo = c.children[1] as Graphics | undefined;
        if (halo) halo.alpha = 0.2 + Math.sin(now / 1000 * 2.5 + phase) * 0.1;
      }
      const sel = (c as any)._selRing as Graphics | undefined;
      if (sel) {
        sel.alpha = 0.7 + Math.sin(now / 1000 * 3) * 0.3;
      }
    }
  }
}
