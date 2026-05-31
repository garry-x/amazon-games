import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameState, Position } from '../game/types';
import type { Theme } from '../themes/types';
import { posEqual, getQueenMoves, buildBlockedSet } from '../game/rules';

export class GameCanvas {
  private app!: Application;
  private boardContainer!: Container;
  private piecesContainer!: Container;
  private effectsContainer!: Container;
  private cellSize = 0;
  private boardPixelSize = 0;
  private offsetX = 0;
  private offsetY = 0;
  private theme: Theme;
  private state: GameState | null = null;
  private onCellClick?: (pos: Position) => void;
  private hoveredCell: Position | null = null;
  private boardGraphics: Graphics | null = null;
  private pieceSprites: Map<string, Container> = new Map();
  private initialized = false;
  private pendingState: GameState | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private container: HTMLElement | null = null;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    this.app = new Application();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    await this.app.init({
      background: this.theme.background.primary,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width,
      height,
    });

    // Build layer tree
    this.boardContainer = new Container();
    this.piecesContainer = new Container();
    this.effectsContainer = new Container();

    this.app.stage.addChild(this.boardContainer);
    this.app.stage.addChild(this.effectsContainer);
    this.app.stage.addChild(this.piecesContainer);

    // Append canvas to the container
    container.appendChild(this.app.canvas as HTMLCanvasElement);

    // Interaction
    this.setupInteraction();

    // Animation ticker
    this.app.ticker.add(() => this.updateEffects());

    // Manual resize observer (avoid PixiJS v8.18 internal _cancelResize bug)
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.initialized = true;

    // Apply any pending state
    if (this.pendingState) {
      this.setState(this.pendingState);
      this.pendingState = null;
    }

    // Initial size calculation and render
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
    if (!this.initialized) {
      this.pendingState = state;
      return;
    }
    this.state = state;
    this.recalcSize();
    this.redraw();
  }

  setOnCellClick(cb: (pos: Position) => void): void {
    this.onCellClick = cb;
  }

  destroy(): void {
    this.initialized = false;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    try {
      this.app.destroy(true);
    } catch {
      // PixiJS v8.18 internal _cancelResize missing during destroy
    }
  }

  private handleResize(): void {
    if (!this.initialized || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.app.renderer.resize(w, h);
    this.recalcSize();
    this.redraw();
  }

  // --- Size ---

  private recalcSize(): void {
    if (!this.state) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width === 0 || height === 0) return;

    const size = this.state.boardSize;
    const padding = 40;
    const maxCellW = (width - padding * 2) / size;
    const maxCellH = (height - padding * 2) / size;
    this.cellSize = Math.floor(Math.min(maxCellW, maxCellH));
    this.boardPixelSize = this.cellSize * size;
    this.offsetX = Math.floor((width - this.boardPixelSize) / 2);
    this.offsetY = Math.floor((height - this.boardPixelSize) / 2);
  }

  // --- Drawing ---

  redraw(): void {
    if (!this.initialized || !this.state || this.cellSize === 0) return;
    this.drawBoard();
    this.drawBurnedCells();
    this.drawHighlights();
    this.drawPieces();
  }

  private drawBoard(): void {
    if (this.boardGraphics) {
      this.boardContainer.removeChild(this.boardGraphics);
      this.boardGraphics.destroy({ children: true });
      this.boardGraphics = null;
    }

    const g = new Graphics();
    const size = this.state!.boardSize;
    const cs = this.cellSize;

    // Outer border glow
    g.rect(this.offsetX - 4, this.offsetY - 4, this.boardPixelSize + 8, this.boardPixelSize + 8);
    g.fill({ color: this.theme.background.secondary, alpha: 0.8 });
    g.stroke({ color: this.theme.board.border, width: 3, alpha: 0.6 });

    // Inner shadow ring
    g.rect(this.offsetX - 1, this.offsetY - 1, this.boardPixelSize + 2, this.boardPixelSize + 2);
    g.stroke({ color: 0x000000, width: 1, alpha: 0.3 });

    // Cells
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = this.offsetX + c * cs;
        const y = this.offsetY + r * cs;
        const isLight = (r + c) % 2 === 0;
        const baseColor = isLight ? this.theme.board.light : this.theme.board.dark;

        g.rect(x, y, cs, cs);
        g.fill({ color: baseColor });

        // Subtle inner line for cell definition
        g.rect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        g.stroke({ color: isLight ? this.theme.board.dark : this.theme.board.light, width: 0.5, alpha: 0.08 });
      }
    }

    // Coordinate labels
    const fontSize = Math.max(10, cs * 0.16);
    const labelStyle = { fontSize, fill: this.theme.board.border, fontFamily: 'monospace' };

    for (let i = 0; i < size; i++) {
      const colLabel = new Text({ text: String.fromCharCode(65 + i), style: labelStyle });
      colLabel.x = this.offsetX + i * cs + cs / 2 - colLabel.width / 2;
      colLabel.y = this.offsetY - colLabel.height - 4;
      g.addChild(colLabel);

      const rowLabel = new Text({ text: String(size - i), style: labelStyle });
      rowLabel.x = this.offsetX - rowLabel.width - 6;
      rowLabel.y = this.offsetY + i * cs + cs / 2 - rowLabel.height / 2;
      g.addChild(rowLabel);
    }

    this.boardGraphics = g;
    this.boardContainer.addChild(g);
  }

  private drawBurnedCells(): void {
    if (!this.state || !this.boardGraphics) return;
    const g = this.boardGraphics;
    const cs = this.cellSize;

    for (const burned of this.state.burnedCells) {
      const x = this.offsetX + burned.col * cs;
      const y = this.offsetY + burned.row * cs;

      g.rect(x + cs * 0.1, y + cs * 0.1, cs * 0.8, cs * 0.8);
      g.fill({ color: this.theme.effects.burn, alpha: 0.3 });

      g.moveTo(x + cs * 0.25, y + cs * 0.25);
      g.lineTo(x + cs * 0.75, y + cs * 0.75);
      g.stroke({ color: this.theme.effects.burn, width: 2, alpha: 0.5 });

      g.moveTo(x + cs * 0.75, y + cs * 0.25);
      g.lineTo(x + cs * 0.25, y + cs * 0.75);
      g.stroke({ color: this.theme.effects.burn, width: 2, alpha: 0.5 });
    }
  }

  private drawHighlights(): void {
    if (!this.state || !this.boardGraphics) return;
    const g = this.boardGraphics;

    // Show all legal move targets when a piece is selected
    if (this.state.step === 'move' && this.state.selectedAmazonId) {
      const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
      if (amazon) {
        this.drawCellHighlight(g, amazon.position, this.theme.board.highlight, 0.6);

        const legal = this.getLegalMoves();
        for (const pos of legal) {
          this.drawCellDot(g, pos, 0x88ff88, 0.45);
        }
      }
    }

    // Show all legal shot targets during shoot phase
    if (this.state.step === 'shoot' && this.state.pendingMoveTo) {
      this.drawCellHighlight(g, this.state.pendingMoveTo, 0x44ff44, 0.35);

      const legal = this.getLegalShots();
      for (const pos of legal) {
        this.drawCellDot(g, pos, this.theme.board.shotHighlight, 0.45);
      }
    }

    // Hovered cell gets brighter highlight
    if (this.hoveredCell) {
      if (this.state.step === 'move' && this.state.selectedAmazonId) {
        const legal = this.getLegalMoves();
        if (legal.some(p => posEqual(p, this.hoveredCell!))) {
          this.drawCellHighlight(g, this.hoveredCell, 0x88ff88, 0.55);
        }
      } else if (this.state.step === 'shoot') {
        const legal = this.getLegalShots();
        if (legal.some(p => posEqual(p, this.hoveredCell!))) {
          this.drawCellHighlight(g, this.hoveredCell, this.theme.board.shotHighlight, 0.55);
        }
      }
    }
  }

  private drawCellHighlight(g: Graphics, pos: Position, color: number, alpha: number): void {
    const x = this.offsetX + pos.col * this.cellSize;
    const y = this.offsetY + pos.row * this.cellSize;
    const cs = this.cellSize;
    g.rect(x + 2, y + 2, cs - 4, cs - 4);
    g.fill({ color, alpha });
  }

  private drawCellDot(g: Graphics, pos: Position, color: number, alpha: number): void {
    const x = this.offsetX + pos.col * this.cellSize + this.cellSize / 2;
    const y = this.offsetY + pos.row * this.cellSize + this.cellSize / 2;
    const r = Math.max(4, this.cellSize * 0.12);
    g.circle(x, y, r);
    g.fill({ color, alpha });
    g.circle(x, y, r);
    g.stroke({ color, width: 1, alpha: alpha + 0.15 });
  }

  private drawPieces(): void {
    for (const [, sprite] of this.pieceSprites) {
      this.piecesContainer.removeChild(sprite);
      sprite.destroy({ children: true });
    }
    this.pieceSprites.clear();

    if (!this.state) return;

    for (const amazon of this.state.amazons) {
      const container = this.createPieceSprite(amazon);
      this.piecesContainer.addChild(container);
      this.pieceSprites.set(amazon.id, container);
    }

    // Last move arrow
    if (this.state.moveHistory.length > 0) {
      const lastMove = this.state.moveHistory[this.state.moveHistory.length - 1];
      this.drawMoveArrow(lastMove.from, lastMove.to);
      this.drawShotArrow(lastMove.to, lastMove.arrow);
    }
  }

  private createPieceSprite(amazon: { id: string; player: 'white' | 'black'; position: Position }): Container {
    const container = new Container();
    const cs = this.cellSize;
    const cx = this.offsetX + amazon.position.col * cs + cs / 2;
    const cy = this.offsetY + amazon.position.row * cs + cs / 2;
    const radius = cs * 0.38;

    const isWhite = amazon.player === 'white';
    const fillColor = isWhite ? this.theme.pieces.white : this.theme.pieces.black;
    const glowColor = isWhite ? this.theme.pieces.whiteGlow : this.theme.pieces.blackGlow;

    // Outer glow
    const glow = new Graphics();
    glow.circle(0, 0, radius + 3);
    glow.fill({ color: glowColor, alpha: 0.35 });

    // Main body
    const body = new Graphics();
    body.circle(0, 0, radius);
    body.fill({ color: fillColor });

    // Inner detail
    const inner = new Graphics();
    inner.circle(0, 0, radius * 0.55);
    inner.fill({ color: glowColor, alpha: 0.25 });

    // Crown
    const crown = new Graphics();
    const s = radius * 0.45;
    crown.moveTo(-s, s * 0.3);
    crown.lineTo(-s * 0.7, -s * 0.5);
    crown.lineTo(-s * 0.3, s * 0.1);
    crown.lineTo(0, -s * 0.8);
    crown.lineTo(s * 0.3, s * 0.1);
    crown.lineTo(s * 0.7, -s * 0.5);
    crown.lineTo(s, s * 0.3);
    crown.closePath();
    crown.fill({ color: glowColor, alpha: 0.5 });

    // Selection ring
    if (this.state?.selectedAmazonId === amazon.id) {
      const ring = new Graphics();
      ring.circle(0, 0, radius + 5);
      ring.stroke({ color: 0x4ecdc4, width: 3, alpha: 0.85 });
      container.addChild(ring);
    }

    container.addChild(glow);
    container.addChild(body);
    container.addChild(inner);
    container.addChild(crown);

    container.x = cx;
    container.y = cy;

    if (this.state && amazon.player === this.state.currentPlayer) {
      (container as any)._pulsePhase = Math.random() * Math.PI * 2;
    }

    return container;
  }

  private drawMoveArrow(from: Position, to: Position): void {
    const g = new Graphics();
    const cs = this.cellSize;
    const fx = this.offsetX + from.col * cs + cs / 2;
    const fy = this.offsetY + from.row * cs + cs / 2;
    const tx = this.offsetX + to.col * cs + cs / 2;
    const ty = this.offsetY + to.row * cs + cs / 2;

    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.floor(dist / 8), 2);
    for (let i = 0; i < steps; i += 2) {
      const t1 = i / steps, t2 = Math.min((i + 1) / steps, 1);
      g.moveTo(fx + dx * t1, fy + dy * t1);
      g.lineTo(fx + dx * t2, fy + dy * t2);
    }
    g.stroke({ color: this.theme.effects.arrowTrail, width: 2, alpha: 0.55 });

    this.effectsContainer.addChild(g);
    setTimeout(() => { this.effectsContainer.removeChild(g); g.destroy(); }, 2000);
  }

  private drawShotArrow(from: Position, to: Position): void {
    const g = new Graphics();
    const cs = this.cellSize;
    const fx = this.offsetX + from.col * cs + cs / 2;
    const fy = this.offsetY + from.row * cs + cs / 2;
    const tx = this.offsetX + to.col * cs + cs / 2;
    const ty = this.offsetY + to.row * cs + cs / 2;

    const dx = tx - fx, dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.floor(dist / 6), 2);
    for (let i = 0; i < steps; i += 2) {
      const t1 = i / steps, t2 = Math.min((i + 1) / steps, 1);
      g.moveTo(fx + dx * t1, fy + dy * t1);
      g.lineTo(fx + dx * t2, fy + dy * t2);
    }
    g.stroke({ color: this.theme.effects.arrow, width: 2.5, alpha: 0.65 });

    const angle = Math.atan2(dy, dx);
    const hl = 8, ha = Math.PI / 5;
    g.moveTo(tx, ty);
    g.lineTo(tx - hl * Math.cos(angle - ha), ty - hl * Math.sin(angle - ha));
    g.moveTo(tx, ty);
    g.lineTo(tx - hl * Math.cos(angle + ha), ty - hl * Math.sin(angle + ha));
    g.stroke({ color: this.theme.effects.arrow, width: 2, alpha: 0.85 });

    this.effectsContainer.addChild(g);
    setTimeout(() => { this.effectsContainer.removeChild(g); g.destroy(); }, 2000);
  }

  // --- Interaction ---

  private setupInteraction(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.cursor = 'pointer';

    canvas.addEventListener('click', (e: MouseEvent) => {
      const pos = this.eventToPos(e);
      if (pos && this.onCellClick) this.onCellClick(pos);
    });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      this.hoveredCell = this.eventToPos(e);
      if (this.initialized) this.redraw();
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
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);
    if (row < 0 || row >= this.state.boardSize || col < 0 || col >= this.state.boardSize) return null;
    return { row, col };
  }

  private getLegalMoves(): Position[] {
    if (!this.state?.selectedAmazonId) return [];
    const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
    if (!amazon) return [];
    const blocked = buildBlockedSet(this.state.amazons, this.state.burnedCells);
    return getQueenMoves(amazon.position, this.state.boardSize, blocked);
  }

  private getLegalShots(): Position[] {
    if (!this.state?.pendingMoveTo) return [];
    const tempAmazons = this.state.amazons.map(a =>
      a.id === this.state.selectedAmazonId
        ? { ...a, position: { ...this.state.pendingMoveTo! } }
        : a,
    );
    const blocked = buildBlockedSet(tempAmazons, this.state.burnedCells);
    return getQueenMoves(this.state.pendingMoveTo, this.state.boardSize, blocked);
  }

  // --- Effects ---

  private updateEffects(): void {
    const now = performance.now() / 1000;
    for (const [id, container] of this.pieceSprites) {
      const amazon = this.state?.amazons.find(a => a.id === id);
      if (!amazon) continue;
      if (amazon.player === this.state?.currentPlayer) {
        const phase = (container as any)._pulsePhase || 0;
        const sprite = container.children[1] as Graphics; // body is child[1]
        if (sprite?.alpha !== undefined) {
          // Pulse the glow (child[0])
          const glow = container.children[0] as Graphics;
          if (glow) glow.alpha = 0.25 + Math.sin(now * 2.5 + phase) * 0.12;
        }
      }
    }
  }
}
