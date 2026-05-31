import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameState, Position } from '../game/types';
import type { Theme } from '../themes/types';
import { posEqual, getQueenMoves, buildBlockedSet } from '../game/rules';

export class GameCanvas {
  private app: Application;
  private boardContainer: Container;
  private piecesContainer: Container;
  private effectsContainer: Container;
  private overlayContainer: Container;
  private cellSize: number = 0;
  private boardPixelSize: number = 0;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private theme: Theme;
  private state: GameState | null = null;
  private onCellClick?: (pos: Position) => void;
  private hoveredCell: Position | null = null;
  private highlightedCells: Position[] = [];
  private boardGraphics: Graphics | null = null;
  private pieceSprites: Map<string, Container> = new Map();

  constructor(theme: Theme) {
    this.theme = theme;

    this.app = new Application();
    this.boardContainer = new Container();
    this.piecesContainer = new Container();
    this.effectsContainer = new Container();
    this.overlayContainer = new Container();

    this.app.stage.addChild(this.boardContainer);
    this.app.stage.addChild(this.effectsContainer);
    this.app.stage.addChild(this.piecesContainer);
    this.app.stage.addChild(this.overlayContainer);
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      background: this.theme.background.primary,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this.app.ticker.add(() => this.updateEffects());
    this.setupInteraction();
    window.addEventListener('resize', () => this.handleResize());
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    if (this.app) {
      this.app.renderer.background.color = theme.background.primary;
    }
    this.redraw();
  }

  setState(state: GameState): void {
    this.state = state;
    this.redraw();
  }

  setOnCellClick(cb: (pos: Position) => void): void {
    this.onCellClick = cb;
  }

  resize(width: number, height: number): void {
    if (!this.state) return;
    const size = this.state.boardSize;
    const padding = 40;
    const maxCellW = (width - padding * 2) / size;
    const maxCellH = (height - padding * 2) / size;
    this.cellSize = Math.floor(Math.min(maxCellW, maxCellH));
    this.boardPixelSize = this.cellSize * size;
    this.offsetX = Math.floor((width - this.boardPixelSize) / 2);
    this.offsetY = Math.floor((height - this.boardPixelSize) / 2);

    this.app.renderer.resize(width, height);
    this.redraw();
  }

  private handleResize(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;
    const parent = canvas.parentElement;
    if (parent) {
      this.resize(parent.clientWidth, parent.clientHeight);
    }
  }

  getBoardPixelSize(): number {
    return this.boardPixelSize;
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  getCellSize(): number {
    return this.cellSize;
  }

  destroy(): void {
    this.app.destroy(true);
  }

  // --- Drawing ---

  redraw(): void {
    if (!this.state || this.cellSize === 0) return;
    this.drawBoard();
    this.drawBurnedCells();
    this.drawHighlights();
    this.drawPieces();
  }

  private drawBoard(): void {
    if (this.boardGraphics) {
      this.boardContainer.removeChild(this.boardGraphics);
      this.boardGraphics.destroy();
    }

    const g = new Graphics();
    const { size } = { size: this.state!.boardSize };
    const cs = this.cellSize;

    // Draw border glow
    g.rect(this.offsetX - 3, this.offsetY - 3, this.boardPixelSize + 6, this.boardPixelSize + 6);
    g.fill({ color: this.theme.board.border, alpha: 0.3 });
    g.stroke({ color: this.theme.board.border, width: 2, alpha: 0.8 });

    // Draw cells
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = this.offsetX + c * cs;
        const y = this.offsetY + r * cs;
        const isLight = (r + c) % 2 === 0;
        const color = isLight ? this.theme.board.light : this.theme.board.dark;

        g.rect(x, y, cs, cs);
        g.fill({ color });
      }
    }

    // Draw coordinate labels
    const labelStyle = {
      fontSize: Math.max(10, cs * 0.18),
      fill: this.theme.board.dark,
      fontFamily: 'monospace',
    };

    for (let i = 0; i < size; i++) {
      // Column labels
      const colLabel = new Text({
        text: String.fromCharCode(65 + i),
        style: labelStyle,
      });
      colLabel.x = this.offsetX + i * cs + cs / 2 - colLabel.width / 2;
      colLabel.y = this.offsetY - colLabel.height - 4;
      g.addChild(colLabel);

      // Row labels
      const rowLabel = new Text({
        text: String(size - i),
        style: labelStyle,
      });
      rowLabel.x = this.offsetX - rowLabel.width - 6;
      rowLabel.y = this.offsetY + i * cs + cs / 2 - rowLabel.height / 2;
      g.addChild(rowLabel);
    }

    this.boardGraphics = g;
    this.boardContainer.addChild(g);
  }

  private drawBurnedCells(): void {
    // Burned cells are drawn as part of the board background with special styling
    if (!this.state) return;
    const g = this.boardGraphics;
    if (!g) return;

    for (const burned of this.state.burnedCells) {
      const x = this.offsetX + burned.col * this.cellSize;
      const y = this.offsetY + burned.row * this.cellSize;
      const cs = this.cellSize;

      // Burned overlay
      g.rect(x + cs * 0.1, y + cs * 0.1, cs * 0.8, cs * 0.8);
      g.fill({ color: this.theme.effects.burn, alpha: 0.25 });

      // Burn mark (X pattern)
      g.moveTo(x + cs * 0.25, y + cs * 0.25);
      g.lineTo(x + cs * 0.75, y + cs * 0.75);
      g.stroke({ color: this.theme.effects.burn, width: 2, alpha: 0.5 });

      g.moveTo(x + cs * 0.75, y + cs * 0.25);
      g.lineTo(x + cs * 0.25, y + cs * 0.75);
      g.stroke({ color: this.theme.effects.burn, width: 2, alpha: 0.5 });
    }
  }

  private drawHighlights(): void {
    if (!this.state) return;
    const g = this.boardGraphics;
    if (!g) return;

    // Highlight selected amazon
    if (this.state.selectedAmazonId) {
      const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
      if (amazon) {
        this.drawCellHighlight(g, amazon.position, this.theme.board.highlight, 0.6);
      }
    }

    // Highlight hovered cell
    if (this.hoveredCell) {
      if (this.state.step === 'move' && this.state.selectedAmazonId) {
        // Check if hovered cell is a legal move
        const legal = this.getLegalMoves();
        if (legal.some(p => posEqual(p, this.hoveredCell!))) {
          this.drawCellHighlight(g, this.hoveredCell, 0x88ff88, 0.4);
        }
      } else if (this.state.step === 'shoot') {
        const legal = this.getLegalShots();
        if (legal.some(p => posEqual(p, this.hoveredCell!))) {
          this.drawCellHighlight(g, this.hoveredCell, this.theme.board.shotHighlight, 0.4);
        }
      }
    }

    // Highlight pending move position during shoot phase
    if (this.state.step === 'shoot' && this.state.pendingMoveTo) {
      this.drawCellHighlight(g, this.state.pendingMoveTo, 0x44ff44, 0.3);
    }
  }

  private drawCellHighlight(g: Graphics, pos: Position, color: number, alpha: number): void {
    const x = this.offsetX + pos.col * this.cellSize;
    const y = this.offsetY + pos.row * this.cellSize;
    const cs = this.cellSize;
    g.rect(x + 2, y + 2, cs - 4, cs - 4);
    g.fill({ color, alpha });
  }

  private drawPieces(): void {
    // Clear existing pieces
    for (const [_, sprite] of this.pieceSprites) {
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

    // Draw pending move ghost
    if (this.state.step === 'shoot' && this.state.selectedAmazonId && this.state.pendingMoveTo) {
      const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
      if (amazon) {
        this.drawMoveArrow(amazon.position, this.state.pendingMoveTo);
      }
    }

    // Draw last move arrow
    if (this.state.moveHistory.length > 0) {
      const lastMove = this.state.moveHistory[this.state.moveHistory.length - 1];
      this.drawMoveArrow(lastMove.from, lastMove.to);
      this.drawShotArrow(lastMove.to, lastMove.arrow);
    }
  }

  private createPieceSprite(amazon: Amazon): Container {
    const container = new Container();
    const cs = this.cellSize;
    const cx = this.offsetX + amazon.position.col * cs + cs / 2;
    const cy = this.offsetY + amazon.position.row * cs + cs / 2;
    const radius = cs * 0.38;

    const isWhite = amazon.player === 'white';
    const fillColor = isWhite ? this.theme.pieces.white : this.theme.pieces.black;
    const glowColor = isWhite ? this.theme.pieces.whiteGlow : this.theme.pieces.blackGlow;

    // Glow effect (outer ring)
    const glow = new Graphics();
    glow.circle(0, 0, radius + 3);
    glow.fill({ color: glowColor, alpha: 0.4 });

    // Main piece
    const piece = new Graphics();
    piece.circle(0, 0, radius);
    piece.fill({ color: fillColor });

    // Inner detail ring
    const inner = new Graphics();
    inner.circle(0, 0, radius * 0.6);
    inner.fill({ color: glowColor, alpha: 0.3 });

    // Crown shape (upper detail)
    const crown = new Graphics();
    const crownSize = radius * 0.5;
    crown.moveTo(-crownSize, crownSize * 0.3);
    crown.lineTo(-crownSize * 0.7, -crownSize * 0.5);
    crown.lineTo(-crownSize * 0.3, crownSize * 0.1);
    crown.lineTo(0, -crownSize * 0.8);
    crown.lineTo(crownSize * 0.3, crownSize * 0.1);
    crown.lineTo(crownSize * 0.7, -crownSize * 0.5);
    crown.lineTo(crownSize, crownSize * 0.3);
    crown.closePath();
    crown.fill({ color: glowColor, alpha: 0.6 });

    // Selected indicator
    const isSelected = this.state?.selectedAmazonId === amazon.id;
    if (isSelected) {
      const selectRing = new Graphics();
      selectRing.circle(0, 0, radius + 6);
      selectRing.stroke({ color: 0x4ecdc4, width: 3, alpha: 0.9 });
      container.addChild(selectRing);
    }

    container.addChild(glow);
    container.addChild(piece);
    container.addChild(inner);
    container.addChild(crown);

    container.x = cx;
    container.y = cy;

    // Pulsating glow for current player's amazons
    if (this.state && amazon.player === this.state.currentPlayer) {
      (container as any)._pulsePhase = Math.random() * Math.PI * 2;
    }

    return container;
  }

  private drawMoveArrow(from: Position, to: Position): void {
    const g = new Graphics();
    const cs = this.cellSize;
    const fcx = this.offsetX + from.col * cs + cs / 2;
    const fcy = this.offsetY + from.row * cs + cs / 2;
    const tcx = this.offsetX + to.col * cs + cs / 2;
    const tcy = this.offsetY + to.row * cs + cs / 2;

    // Dashed line effect
    const dx = tcx - fcx;
    const dy = tcy - fcy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(dist / 8);

    for (let i = 0; i < steps; i += 2) {
      const t1 = i / steps;
      const t2 = Math.min((i + 1) / steps, 1);
      g.moveTo(fcx + dx * t1, fcy + dy * t1);
      g.lineTo(fcx + dx * t2, fcy + dy * t2);
    }
    g.stroke({ color: this.theme.effects.arrowTrail, width: 2, alpha: 0.6 });
    this.effectsContainer.addChild(g);

    // Auto-remove after short delay
    setTimeout(() => {
      this.effectsContainer.removeChild(g);
      g.destroy();
    }, 2000);
  }

  private drawShotArrow(from: Position, to: Position): void {
    const g = new Graphics();
    const cs = this.cellSize;
    const fcx = this.offsetX + from.col * cs + cs / 2;
    const fcy = this.offsetY + from.row * cs + cs / 2;
    const tcx = this.offsetX + to.col * cs + cs / 2;
    const tcy = this.offsetY + to.row * cs + cs / 2;

    // Red dashed line
    const dx = tcx - fcx;
    const dy = tcy - fcy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(dist / 6);

    for (let i = 0; i < steps; i += 2) {
      const t1 = i / steps;
      const t2 = Math.min((i + 1) / steps, 1);
      g.moveTo(fcx + dx * t1, fcy + dy * t1);
      g.lineTo(fcx + dx * t2, fcy + dy * t2);
    }
    g.stroke({ color: this.theme.effects.arrow, width: 2.5, alpha: 0.7 });

    // Arrow head
    const angle = Math.atan2(dy, dx);
    const headLen = 8;
    const headAngle = Math.PI / 5;
    g.moveTo(tcx, tcy);
    g.lineTo(
      tcx - headLen * Math.cos(angle - headAngle),
      tcy - headLen * Math.sin(angle - headAngle),
    );
    g.moveTo(tcx, tcy);
    g.lineTo(
      tcx - headLen * Math.cos(angle + headAngle),
      tcy - headLen * Math.sin(angle + headAngle),
    );
    g.stroke({ color: this.theme.effects.arrow, width: 2, alpha: 0.9 });

    this.effectsContainer.addChild(g);

    setTimeout(() => {
      this.effectsContainer.removeChild(g);
      g.destroy();
    }, 2000);
  }

  // --- Interaction ---

  private setupInteraction(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;

    canvas.addEventListener('click', (e: MouseEvent) => {
      const pos = this.eventToPos(e);
      if (pos && this.onCellClick) {
        this.onCellClick(pos);
      }
    });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const pos = this.eventToPos(e);
      this.hoveredCell = pos;
      if (this.state) this.redraw();
    });

    canvas.addEventListener('mouseleave', () => {
      this.hoveredCell = null;
      if (this.state) this.redraw();
    });

    // Touch support
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pos = this.eventToPos(touch);
      if (pos && this.onCellClick) {
        this.onCellClick(pos);
      }
    });
  }

  private eventToPos(e: { clientX: number; clientY: number }): Position | null {
    if (!this.state || this.cellSize === 0) return null;
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);

    if (row < 0 || row >= this.state.boardSize || col < 0 || col >= this.state.boardSize) {
      return null;
    }
    return { row, col };
  }

  private getLegalMoves(): Position[] {
    if (!this.state || !this.state.selectedAmazonId) return [];
    const amazon = this.state.amazons.find(a => a.id === this.state.selectedAmazonId);
    if (!amazon) return [];
    const blocked = buildBlockedSet(this.state.amazons, this.state.burnedCells);
    return getQueenMoves(amazon.position, this.state.boardSize, blocked);
  }

  private getLegalShots(): Position[] {
    if (!this.state || !this.state.pendingMoveTo) return [];
    const tempAmazons = this.state.amazons.map(a =>
      a.id === this.state.selectedAmazonId
        ? { ...a, position: { ...this.state!.pendingMoveTo! } }
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
      if (!amazon || !this.state) continue;

      if (amazon.player === this.state.currentPlayer) {
        const phase = ((container as any)._pulsePhase || 0);
        const glowAlpha = 0.3 + Math.sin(now * 3 + phase) * 0.15;
        const glowSprite = container.children[0] as Graphics;
        if (glowSprite) {
          glowSprite.alpha = glowAlpha;
        }
      }
    }
  }
}
