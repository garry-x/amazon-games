import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/ui-store';
import { useGameStore } from '../store/game-store';
import { GameSetup } from './GameSetup';
import { GameBoard } from './GameBoard';
import { GameHUD } from './GameHUD';
import { MoveHistory } from './MoveHistory';
import { ThemePicker } from './ThemePicker';
import { ResultDialog } from './ResultDialog';
import { Tutorial } from './Tutorial';
import { useState, useMemo } from 'react';
import type { BoardSize, VariantConfig } from '../game/types';

export function Layout() {
  const { showSetup, setShowSetup } = useUIStore();
  const { gameState, startGame } = useGameStore();
  const theme = useUIStore(s => s.theme);
  const [showHistory, setShowHistory] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const isPlaying = gameState && gameState.phase !== 'finished';
  const accent = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const bg1 = useMemo(() => '#' + theme.background.primary.toString(16).padStart(6, '0'), [theme]);
  const bg2 = useMemo(() => '#' + theme.background.secondary.toString(16).padStart(6, '0'), [theme]);

  const handleStart = (v: VariantConfig, s: BoardSize) => { startGame(v, s); setShowSetup(false); };

  return (
    <div className="h-full flex flex-col relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 40%, ${bg2}dd 0%, ${bg1} 70%, #050510 100%)` }}>

      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{
              background: accent,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.1 + Math.random() * 0.15,
            }}
            animate={{ y: [0, -40, 0], opacity: [0.08, 0.22, 0.08] }}
            transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 4 }}
          />
        ))}
      </div>

      {/* Top bar */}
      {isPlaying && (
        <motion.div
          initial={{ y: -64 }} animate={{ y: 0 }}
          className="relative z-10 flex items-center justify-between px-5 py-2.5 border-b border-white/5"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-wider"
              style={{ color: accent, textShadow: `0 0 16px ${accent}44` }}>
              ⚔ 亚马逊棋
            </h1>
            <span className="text-white/30 text-xs font-mono hidden sm:inline">Game of the Amazons</span>
          </div>
          <div className="flex items-center gap-2">
            <TopBtn onClick={() => setShowTutorial(true)}>📖 教程</TopBtn>
            <ThemePicker />
            <TopBtn onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? '隐藏记录' : '走棋记录'}
            </TopBtn>
            <TopBtn onClick={() => setShowSetup(true)}>新游戏</TopBtn>
          </div>
        </motion.div>
      )}

      {/* Main */}
      <div className="flex-1 flex relative overflow-hidden">
        <AnimatePresence>
          {showSetup && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35 }}
              className="absolute inset-0 z-20 flex items-center justify-center"
            >
              <GameSetup onStart={handleStart} />
            </motion.div>
          )}
        </AnimatePresence>

        {!showSetup && gameState && (
          <div className="flex-1 flex relative">
            <div className="flex-1 relative">
              <GameBoard />
              <div className="absolute top-4 left-4 z-10"><GameHUD /></div>
            </div>
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-l border-white/10 overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}
                >
                  <MoveHistory />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {gameState?.phase === 'finished' && <ResultDialog />}
        </AnimatePresence>

        <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    </div>
  );
}

function TopBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
        border border-white/8 hover:border-white/25 text-white/60 hover:text-white"
      style={{ background: 'rgba(255,255,255,0.04)' }}>
      {children}
    </button>
  );
}
