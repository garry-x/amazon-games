import { useRef, useEffect } from 'react';
import { useGameStore } from '../store/game-store';
import { motion } from 'framer-motion';

export function MoveHistory() {
  const gameState = useGameStore(s => s.gameState);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState?.moveHistory.length]);

  if (!gameState) return null;

  const moves = gameState.moveHistory;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
          走棋记录
        </h3>
        <div className="text-xs text-white/30 mt-1">
          共 {moves.length} 步
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {moves.length === 0 && (
          <p className="text-sm text-white/20 text-center py-8">
            暂无记录
          </p>
        )}

        {moves.map((move, i) => {
          const amazon = gameState.amazons.find(a => a.id === move.amazonId);
          const player = amazon?.player || 'white';
          const moveNum = Math.floor(i / 2) + 1;

          return (
            <motion.div
              key={i}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.02 }}
              className="flex items-center gap-2 text-xs font-mono p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="text-white/30 w-8">
                {moveNum}{player === 'white' ? 'W' : 'B'}
              </span>
              <span className="text-white/60">
                {colLabel(move.from.col)}{rowLabel(move.from.row, gameState.boardSize)}
              </span>
              <span className="text-white/30">→</span>
              <span className="text-white/80">
                {colLabel(move.to.col)}{rowLabel(move.to.row, gameState.boardSize)}
              </span>
              <span className="text-red-400/60 mx-1">🏹</span>
              <span className="text-red-400/70">
                {colLabel(move.arrow.col)}{rowLabel(move.arrow.row, gameState.boardSize)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function colLabel(col: number): string {
  return String.fromCharCode(65 + col);
}

function rowLabel(row: number, size: number): string {
  return String(size - row);
}
