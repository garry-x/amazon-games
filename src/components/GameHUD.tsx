import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';
import { motion, AnimatePresence } from 'framer-motion';

export function GameHUD() {
  const gameState = useGameStore(s => s.gameState);
  const variant = useGameStore(s => s.variant);
  const forfeit = useGameStore(s => s.forfeit);
  const theme = useUIStore(s => s.theme);

  if (!gameState || gameState.phase !== 'playing') return null;

  const currentPlayer = gameState.currentPlayer;
  const step = gameState.step;
  const accentColor = '#' + theme.background.accent.toString(16).padStart(6, '0');

  const playerColor = currentPlayer === 'white'
    ? '#' + theme.pieces.whiteGlow.toString(16).padStart(6, '0')
    : '#' + theme.pieces.blackGlow.toString(16).padStart(6, '0');

  const moveCount = gameState.moveHistory.length;
  const burnedCount = gameState.burnedCells.length;

  return (
    <div
      className="p-4 rounded-xl border border-white/10 min-w-[220px]"
      style={{
        background: 'rgba(10,10,20,0.7)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Current player */}
      <div className="mb-3">
        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">当前回合</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPlayer + step}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 10, opacity: 0 }}
            className="flex items-center gap-3"
          >
            {/* Player indicator piece */}
            <div
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{
                background: playerColor,
                boxShadow: `0 0 15px ${playerColor}88`,
              }}
            />
            <div>
              <div className="text-lg font-bold text-white">
                {currentPlayer === 'white' ? '白方' : '黑方'}
              </div>
              <div className="text-xs" style={{ color: accentColor }}>
                {step === 'move' ? '→ 移动亚马逊' : '→ 选择射箭目标'}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatItem label="步数" value={moveCount.toString()} />
        <StatItem label="燃烧" value={burnedCount.toString()} />
      </div>

      {/* Phase indicator */}
      {step === 'shoot' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center py-2 px-3 rounded-lg text-sm font-bold"
          style={{
            background: `${accentColor}22`,
            color: accentColor,
            border: `1px solid ${accentColor}44`,
          }}
        >
          🏹 选择箭矢目标
        </motion.div>
      )}

      {/* Forfeit button */}
      <button
        onClick={forfeit}
        className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-red-400
          border border-white/5 hover:border-red-400/30 transition-all duration-200"
      >
        认输
      </button>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-white/30">{label}</div>
    </div>
  );
}
