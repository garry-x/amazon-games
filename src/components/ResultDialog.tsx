import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';

export function ResultDialog() {
  const gameState = useGameStore(s => s.gameState);
  const resetGame = useGameStore(s => s.resetGame);
  const setShowSetup = useUIStore(s => s.setShowSetup);
  const theme = useUIStore(s => s.theme);

  const accent = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const winnerColor = useMemo(() => {
    if (!gameState?.winner) return accent;
    return gameState.winner === 'white'
      ? '#' + theme.pieces.whiteGlow.toString(16).padStart(6, '0')
      : '#' + theme.pieces.blackGlow.toString(16).padStart(6, '0');
  }, [gameState, theme, accent]);

  if (!gameState || gameState.phase !== 'finished') return null;

  const { winner, moveHistory } = gameState;
  const moves = moveHistory.length;
  const isDraw = winner === null;

  const title = isDraw ? '平局！' : `${winner === 'white' ? '白方' : '黑方'} 胜利！`;
  const icon = isDraw ? '🤝' : '👑';
  const reason = isDraw
    ? '双方均无合法移动，握手言和'
    : '对方已无合法移动，无力再战';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}>
      <motion.div
        initial={{ scale: 0.85, y: 24 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="p-10 rounded-3xl text-center border max-w-sm mx-4"
        style={{
          background: 'rgba(8,8,18,0.92)',
          borderColor: accent + '44',
          boxShadow: `0 0 100px ${winnerColor}18, 0 20px 60px rgba(0,0,0,0.6)`,
        }}>
        <motion.div
          initial={{ rotate: isDraw ? 0 : -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
          className="text-7xl mb-5">{icon}</motion.div>

        <motion.h2 className="text-4xl font-extrabold mb-3 tracking-tight"
          style={{ color: winnerColor, textShadow: `0 0 32px ${winnerColor}44` }}>
          {title}
        </motion.h2>
        <p className="text-white/55 text-sm mb-8 leading-relaxed">
          {reason}<br />
          <span className="text-white/35 text-xs">共 {moves} 步</span>
        </p>

        <div className="flex gap-3">
          <button onClick={resetGame}
            className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors duration-200"
            style={{ color: accent, borderColor: accent + '44', background: accent + '0d' }}>
            再来一局
          </button>
          <button onClick={() => { useGameStore.setState({ gameState: null }); setShowSetup(true); }}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ color: '#111', background: accent, boxShadow: `0 0 24px ${accent}44` }}>
            返回主菜单
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
