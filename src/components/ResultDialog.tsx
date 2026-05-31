import { motion } from 'framer-motion';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';

export function ResultDialog() {
  const gameState = useGameStore(s => s.gameState);
  const resetGame = useGameStore(s => s.resetGame);
  const setShowSetup = useUIStore(s => s.setShowSetup);
  const theme = useUIStore(s => s.theme);

  if (!gameState || gameState.phase !== 'finished') return null;

  const winner = gameState.winner;
  const accentColor = '#' + theme.background.accent.toString(16).padStart(6, '0');
  const winnerColor = winner === 'white'
    ? '#' + theme.pieces.whiteGlow.toString(16).padStart(6, '0')
    : '#' + theme.pieces.blackGlow.toString(16).padStart(6, '0');

  const moveCount = gameState.moveHistory.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="p-8 rounded-2xl text-center border max-w-md mx-4"
        style={{
          background: 'rgba(10,10,20,0.9)',
          backdropFilter: 'blur(20px)',
          borderColor: `${accentColor}33`,
          boxShadow: `0 0 80px ${winnerColor}22`,
        }}
      >
        {/* Winner crown */}
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="text-6xl mb-4"
        >
          👑
        </motion.div>

        <motion.h2
          className="text-3xl font-bold mb-2"
          style={{ color: winnerColor }}
        >
          {winner === 'white' ? '白方' : '黑方'} 胜利！
        </motion.h2>

        <p className="text-white/40 text-sm mb-6">
          对方已无合法移动 · 共 {moveCount} 步
        </p>

        <div className="flex gap-3 justify-center">
          <motion.button
            onClick={resetGame}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white
              border border-white/10 hover:border-white/30 transition-all"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            再来一局
          </motion.button>
          <motion.button
            onClick={() => setShowSetup(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
            }}
          >
            返回主菜单
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
