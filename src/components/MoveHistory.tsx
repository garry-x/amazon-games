import { useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';

export function MoveHistory() {
  const gameState = useGameStore(s => s.gameState);
  const theme = useUIStore(s => s.theme);
  const scrollRef = useRef<HTMLDivElement>(null);
  const accent = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [gameState?.moveHistory.length]);

  if (!gameState) return null;

  const moves = gameState.moveHistory;
  const pairs: { num: number; white?: typeof moves[0]; black?: typeof moves[0] }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const fmt = (p: { row: number; col: number }) =>
    `${String.fromCharCode(65 + p.col)}${gameState.boardSize - p.row}`;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: accent + '22' }}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: accent }}>走棋记录</h3>
          <p className="text-white/35 text-[10px] mt-1">共 {moves.length} 步</p>
        </div>
        {moves.length > 0 && (
          <button
            onClick={() => {
              const text = pairs.map(({ num, white, black }) => {
                const w = white ? `${fmt(white.from)}→${fmt(white.to)}🏹${fmt(white.arrow)}` : '';
                const b = black ? ` ${fmt(black.from)}→${fmt(black.to)}🏹${fmt(black.arrow)}` : '';
                return `${num}. ${w}${b}`;
              }).join('\n');
              navigator.clipboard.writeText(text).catch(() => {});
            }}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded border border-white/10"
            title="复制走棋记录">
            📋 复制
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {moves.length === 0 && (
          <p className="text-white/25 text-xs text-center py-10">暂无记录</p>
        )}

        {pairs.map(({ num, white, black }) => (
          <div key={num}
            className="flex items-center gap-1.5 text-xs font-mono p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-white/30 w-6 text-right flex-shrink-0">{num}.</span>
            {white && (
              <>
                <span className="text-white/70">{fmt(white.from)}→{fmt(white.to)}</span>
                <span className="text-red-400/60">🏹{fmt(white.arrow)}</span>
              </>
            )}
            {black && (
              <>
                <span className="text-white/30 mx-0.5">·</span>
                <span className="text-white/70">{fmt(black.from)}→{fmt(black.to)}</span>
                <span className="text-red-400/60">🏹{fmt(black.arrow)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
