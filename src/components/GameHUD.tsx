import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

export function GameHUD() {
  const gameState = useGameStore(s => s.gameState);
  const variant = useGameStore(s => s.variant);
  const forfeit = useGameStore(s => s.forfeit);
  const theme = useUIStore(s => s.theme);

  const accent = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const whiteClr = useMemo(() => '#' + theme.pieces.whiteGlow.toString(16).padStart(6, '0'), [theme]);
  const blackClr = useMemo(() => '#' + theme.pieces.blackGlow.toString(16).padStart(6, '0'), [theme]);

  if (!gameState || gameState.phase !== 'playing') return null;

  const player = gameState.currentPlayer;
  const step = gameState.step;
  const playerColor = player === 'white' ? whiteClr : blackClr;
  const moves = gameState.moveHistory.length;
  const burned = gameState.burnedCells.length;

  return (
    <div className="p-4 rounded-xl border border-white/8 min-w-[200px] select-none"
      style={{ background: 'rgba(8,8,18,0.75)', backdropFilter: 'blur(16px)', boxShadow: `0 0 30px ${accent}11` }}>

      {/* Turn indicator */}
      <div className="mb-4">
        <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mb-2">当前回合</div>
        <AnimatePresence mode="wait">
          <motion.div key={player + step}
            initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3">
            {/* Gem piece */}
            <div className="w-9 h-9 rounded-full flex-shrink-0 relative"
              style={{ background: `radial-gradient(circle at 35% 30%, ${playerColor}cc, ${playerColor}44)`, boxShadow: `0 0 18px ${playerColor}66, inset 0 0 6px ${playerColor}44` }}>
              <div className="absolute inset-[3px] rounded-full" style={{ background: `radial-gradient(circle at 30% 25%, #ffffff66, transparent)` }} />
            </div>
            <div>
              <div className="text-base font-bold text-white leading-tight">
                {player === 'white' ? '白方' : '黑方'}
              </div>
              <div className="text-[11px] leading-tight mt-0.5" style={{ color: accent }}>
                {step === 'move' ? '移动亚马逊' : '🏹 射箭目标'}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <Stat label="步数" value={moves} accent={accent} />
        <Stat label="燃烧格" value={burned} accent={accent} />
      </div>

      {/* Variant badge */}
      {variant && (
        <div className="mb-3 text-center">
          <span className="text-[10px] px-2 py-0.5 rounded-full text-white/30 border border-white/5"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            {variant.name}
          </span>
        </div>
      )}

      {/* Shoot phase alert */}
      <AnimatePresence>
        {step === 'shoot' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="text-center py-1.5 px-3 rounded-lg text-xs font-semibold mb-3"
            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33`, boxShadow: `0 0 12px ${accent}11` }}>
            🏹 选择箭矢目标
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={forfeit}
        className="w-full py-1.5 rounded-lg text-[11px] font-medium text-white/25 hover:text-red-400/80
          border border-white/5 hover:border-red-400/25 transition-all duration-200">
        认输
      </button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-white/25">{label}</div>
    </div>
  );
}
