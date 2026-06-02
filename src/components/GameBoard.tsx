import { useRef, useEffect } from 'react';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';
import { GameCanvas } from '../renderer/game-canvas';
import type { Position } from '../game/types';

export function GameBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameCanvasRef = useRef<GameCanvas | null>(null);
  const initializedRef = useRef(false);
  const gameState = useGameStore(s => s.gameState);
  const handleCellClick = useGameStore(s => s.handleCellClick);
  const theme = useUIStore(s => s.theme);
  const handleCellClickRef = useRef(handleCellClick);
  const initialThemeRef = useRef(theme);

  useEffect(() => {
    handleCellClickRef.current = handleCellClick;
  }, [handleCellClick]);

  // Init once
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const gc = new GameCanvas(initialThemeRef.current);
    gameCanvasRef.current = gc;

    gc.init(containerRef.current).then(() => {
      gc.setOnCellClick((pos: Position) => handleCellClickRef.current(pos));
    });

    return () => {
      gc.destroy();
      gameCanvasRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  // Sync game state
  useEffect(() => {
    if (gameCanvasRef.current && gameState) {
      gameCanvasRef.current.setState(gameState);
    }
  }, [gameState]);

  // Sync theme
  useEffect(() => {
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setTheme(theme);
    }
  }, [theme]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden" />
  );
}
