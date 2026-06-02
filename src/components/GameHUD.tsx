import { useState, useEffect } from 'react';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

export function GameHUD() {
  const gameState = useGameStore(s => s.gameState);
  const variant = useGameStore(s => s.variant);
  const aiThinking = useGameStore(s => s.aiThinking);
  const forfeit = useGameStore(s => s.forfeit);
  const theme = useUIStore(s => s.theme);
  const gameStartTime = useGameStore(s => s.gameStartTime);
  const [elapsed, setElapsed] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const isPlaying = gameState?.phase === 'playing';

  // Timer — must be before early return (React hooks rules)
  useEffect(() => {
    if (!gameStartTime || !isPlaying) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - gameStartTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [gameStartTime, isPlaying]);

  const accent = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const whiteClr = useMemo(() => '#' + theme.pieces.whiteGlow.toString(16).padStart(6, '0'), [theme]);
  const blackClr = useMemo(() => '#' + theme.pieces.blackGlow.toString(16).padStart(6, '0'), [theme]);

  if (!gameState || gameState.phase !== 'playing') return null;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const player = gameState.currentPlayer;
  const step = gameState.step;
  const playerColor = player === 'white' ? whiteClr : blackClr;
  const moves = gameState.moveHistory.length;
  const burned = gameState.burnedCells.length;

  return (
    <div className="select-none"
      style={{ maxWidth: 'calc(100vw - 2rem)' }}>

      {/* Collapsed: compact bar */}
      {collapsed ? (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8"
          style={{ background: 'rgba(8,8,18,0.75)', backdropFilter: 'blur(16px)' }}>
          <div className="w-6 h-6 rounded-full flex-shrink-0"
            style={{ background: `radial-gradient(circle at 35% 30%, ${playerColor}cc, ${playerColor}44)`, boxShadow: `0 0 10px ${playerColor}66` }} />
          <span className="text-sm font-bold text-white">
            {player === 'white' ? '白' : '黑'}
          </span>
          <span className="text-white/40 text-xs">{moves}步</span>
          {step === 'shoot' && <span className="text-xs" style={{ color: accent }}>🏹</span>}
        </motion.button>
      ) : (
        /* Expanded panel */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="p-3 sm:p-4 rounded-xl border border-white/8"
          style={{ background: 'rgba(8,8,18,0.75)', backdropFilter: 'blur(16px)', boxShadow: `0 0 30px ${accent}11` }}>

          {/* Header row with collapse toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-[0.15em]">当前回合</div>
            <button onClick={() => setCollapsed(true)}
              className="text-white/30 hover:text-white/60 text-xs leading-none px-1">−</button>
          </div>

          {/* Turn indicator */}
          <AnimatePresence mode="wait">
            <motion.div key={player + step}
              initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 sm:gap-3 mb-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex-shrink-0 relative"
                style={{ background: `radial-gradient(circle at 35% 30%, ${playerColor}cc, ${playerColor}44)`, boxShadow: `0 0 14px ${playerColor}66, inset 0 0 4px ${playerColor}44` }}>
                <div className="absolute inset-[3px] rounded-full" style={{ background: `radial-gradient(circle at 30% 25%, #ffffff66, transparent)` }} />
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold text-white leading-tight">
                  {player === 'white' ? '白方' : '黑方'}
                </div>
                <div className="text-[10px] sm:text-[11px] leading-tight mt-0.5" style={{ color: accent }}>
                  {step === 'move' ? '移动亚马逊' : '🏹 射箭目标'}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Stats row */}
          <div className="flex gap-1.5 mb-2">
            <div className="flex-1 text-center p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-sm font-bold text-white tabular-nums">{moves}</div>
              <div className="text-[10px] text-white/25">步数</div>
            </div>
            <div className="flex-1 text-center p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-sm font-bold text-white tabular-nums">{burned}</div>
              <div className="text-[10px] text-white/25">燃烧</div>
            </div>
            <div className="flex-1 text-center p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-sm font-bold text-white tabular-nums">{fmt(elapsed)}</div>
              <div className="text-[10px] text-white/25">用时</div>
            </div>
            {variant && (
              <div className="flex-1 text-center p-1.5 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-[10px] text-white/30">{variant.name}</span>
              </div>
            )}
          </div>

          {/* AI thinking indicator */}
          <AnimatePresence>
            {aiThinking && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 mb-2 py-1.5 px-3 rounded-lg text-xs font-medium"
                style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}33` }}>
                <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${accent}44`, borderTopColor: accent }} />
                AI 思考中...
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shoot alert */}
          <AnimatePresence>
            {step === 'shoot' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="text-center py-1 px-2 rounded-lg text-xs font-semibold mb-2"
                style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}>
                🏹 选择箭矢目标
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={forfeit}
            className="w-full py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium text-white/25 hover:text-red-400/80
              border border-white/5 hover:border-red-400/25 transition-all duration-200">
            认输
          </button>
        </motion.div>
      )}
    </div>
  );
}
