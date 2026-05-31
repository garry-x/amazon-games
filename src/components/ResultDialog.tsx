import { motion } from 'framer-motion';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';

export function ResultDialog() {
  const gameState = useGameStore(s => s.gameState);
  const resetGame = useGameStore(s => s.resetGame);
  const setShowSetup = useUIStore(s => s.setShowSetup);
  const theme = useUIStore(s => s.theme);

  if (!gameState || gameState.phase !== 'finished') return null;

  const accent = '#' + theme.background.accent.toString(16).padStart(6, '0');
  const winner = gameState.winner;
  const isDraw = winner === null;
  const winnerColor = isDraw ? accent
    : winner === 'white'
      ? '#' + theme.pieces.whiteGlow.toString(16).padStart(6, '0')
      : '#' + theme.pieces.blackGlow.toString(16).padStart(6, '0');
  const bgColor = '#' + theme.background.primary.toString(16).padStart(6, '0');

  const moves = gameState.moveHistory.length;
  const whiteMoves = gameState.moveHistory.filter((_, i) => i % 2 === 0).length;
  const blackMoves = gameState.moveHistory.filter((_, i) => i % 2 === 1).length;
  const burned = gameState.burnedCells.length;
  const avatarSrc = isDraw ? '' : `/avatars/${theme.id}-${winner}.webp`;

  const title = isDraw ? '平局！' : `${winner === 'white' ? '白方' : '黑方'} 胜利！`;
  const icon = isDraw ? '🤝' : '👑';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)' }}>

      {/* Outer glow ring */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.08 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${winnerColor}, transparent 70%)` }}
      />

      <motion.div
        initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 16 }}
        className="relative rounded-3xl border max-w-sm w-full overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${bgColor}dd, ${bgColor})`,
          borderColor: winnerColor + '44',
          boxShadow: `0 0 80px ${winnerColor}18, 0 24px 80px rgba(0,0,0,0.6)`,
        }}>

        {/* Top glow bar */}
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${winnerColor}88, transparent)` }} />

        <div className="p-8 text-center">
          {/* Avatar */}
          {avatarSrc && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
              className="mx-auto mb-4 w-20 h-20 rounded-full overflow-hidden border-2"
              style={{ borderColor: winnerColor + '88', boxShadow: `0 0 32px ${winnerColor}44` }}>
              <img src={avatarSrc} className="w-full h-full object-cover" alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </motion.div>
          )}

          {/* Icon for draw */}
          {isDraw && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-6xl mb-4">{icon}</motion.div>
          )}

          {/* Title */}
          <motion.h2
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-3xl font-black mb-2 tracking-tight"
            style={{ color: winnerColor, textShadow: `0 0 24px ${winnerColor}44` }}>
            {title}
          </motion.h2>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center gap-4 mb-6 text-xs">
            <div className="text-center">
              <div className="text-white/70 font-bold">{moves}</div>
              <div className="text-white/25">总步数</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 font-bold">{whiteMoves}</div>
              <div className="text-white/25">白方</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 font-bold">{blackMoves}</div>
              <div className="text-white/25">黑方</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 font-bold">{burned}</div>
              <div className="text-white/25">燃烧</div>
            </div>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex gap-3">
            <button onClick={resetGame}
              className="flex-1 py-3 rounded-xl text-sm font-bold border transition-all duration-200 hover:scale-[1.02]"
              style={{ color: accent, borderColor: accent + '44', background: accent + '0d' }}>
              再来一局
            </button>
            <button onClick={() => { useGameStore.setState({ gameState: null }); setShowSetup(true); }}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02]"
              style={{ color: '#111', background: accent, boxShadow: `0 0 20px ${accent}44` }}>
              返回主菜单
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
