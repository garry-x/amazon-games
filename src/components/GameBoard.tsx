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
  const bgImage = useUIStore(s => s.bgImage);

  // Init once
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const gc = new GameCanvas(theme);
    gameCanvasRef.current = gc;

    gc.init(containerRef.current).then(() => {
      gc.setOnCellClick((pos: Position) => handleCellClick(pos));
      // Apply any existing background
      const img = useUIStore.getState().bgImage;
      if (img) gc.setBackgroundImage(img);
    });

    return () => {
      gc.destroy();
      gameCanvasRef.current = null;
      initializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sync background image
  useEffect(() => {
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setBackgroundImage(bgImage);
    }
  }, [bgImage]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden" />
  );
}
