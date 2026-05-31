import { useRef, useEffect } from 'react';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';
import { GameCanvas } from '../renderer/game-canvas';
import type { Position } from '../game/types';

export function GameBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameCanvasRef = useRef<GameCanvas | null>(null);
  const initializedRef = useRef(false);
  const gameState = useGameStore(s => s.gameState);
  const handleCellClick = useGameStore(s => s.handleCellClick);
  const theme = useUIStore(s => s.theme);

  // Initialize PixiJS once on mount
  useEffect(() => {
    if (initializedRef.current || !canvasRef.current) return;
    initializedRef.current = true;

    const gc = new GameCanvas(theme);
    gameCanvasRef.current = gc;

    gc.init(canvasRef.current).then(() => {
      gc.setOnCellClick((pos: Position) => {
        handleCellClick(pos);
      });

      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        gc.resize(clientWidth, clientHeight);
      }

      if (gameState) {
        gc.setState(gameState);
      }
    });

    return () => {
      gc.destroy();
      gameCanvasRef.current = null;
      initializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update game state
  useEffect(() => {
    if (gameCanvasRef.current && gameState) {
      gameCanvasRef.current.setState(gameState);
    }
  }, [gameState]);

  // Update theme (without recreating PixiJS)
  useEffect(() => {
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setTheme(theme);
    }
  }, [theme]);

  // Handle resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (gameCanvasRef.current && width > 0 && height > 0) {
          gameCanvasRef.current.resize(width, height);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: 'pointer' }}
      />
    </div>
  );
}
