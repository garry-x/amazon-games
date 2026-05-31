import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/ui-store';
import { ALL_THEMES } from '../store/ui-store';
import { ALL_VARIANTS, useGameStore } from '../store/game-store';
import { GameSetup } from './GameSetup';
import { GameBoard } from './GameBoard';
import { GameHUD } from './GameHUD';
import { MoveHistory } from './MoveHistory';
import { ThemePicker } from './ThemePicker';
import { ResultDialog } from './ResultDialog';
import { Tutorial } from './Tutorial';
import { useState } from 'react';
import type { BoardSize } from '../game/types';
import type { VariantConfig } from '../game/types';

export function Layout() {
  const { showSetup, setShowSetup } = useUIStore();
  const { gameState, startGame, resetGame } = useGameStore();
  const theme = useUIStore(s => s.theme);
  const [showHistory, setShowHistory] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const isPlaying = gameState && gameState.phase !== 'finished';

  const handleStartGame = (variant: VariantConfig, boardSize: BoardSize) => {
    startGame(variant, boardSize);
    setShowSetup(false);
  };

  const handleBackToSetup = () => {
    setShowSetup(true);
  };

  const bgColor = '#' + theme.background.primary.toString(16).padStart(6, '0');
  const accentColor = '#' + theme.background.accent.toString(16).padStart(6, '0');

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${bgColor} 0%, #0a0a0f 100%)` }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              background: accentColor,
              width: Math.random() * 4 + 1,
              height: Math.random() * 4 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.15,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Top bar */}
      {isPlaying && (
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          className="relative z-10 flex items-center justify-between px-6 py-3"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}
        >
          <div className="flex items-center gap-4">
            <h1
              className="text-2xl font-bold tracking-wider"
              style={{
                color: accentColor,
                textShadow: `0 0 20px ${accentColor}44`,
              }}
            >
              ⚔ 亚马逊棋
            </h1>
            <span className="text-white/40 text-sm font-mono">
              Game of the Amazons
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTutorial(true)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                border border-white/10 hover:border-white/30 text-white/70 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              📖 教程
            </button>
            <ThemePicker />
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                border border-white/10 hover:border-white/30 text-white/70 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {showHistory ? '隐藏记录' : '走棋记录'}
            </button>
            <button
              onClick={handleBackToSetup}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                border border-white/10 hover:border-white/30 text-white/70 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              新游戏
            </button>
          </div>
        </motion.div>
      )}

      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Setup screen */}
        <AnimatePresence>
          {showSetup && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-20 flex items-center justify-center"
            >
              <GameSetup onStart={handleStartGame} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game area */}
        {!showSetup && gameState && (
          <div className="flex-1 flex relative">
            {/* Board */}
            <div className="flex-1 relative">
              <GameBoard />

              {/* HUD overlay */}
              <div className="absolute top-4 left-4 z-10">
                <GameHUD />
              </div>
            </div>

            {/* Side panel: move history */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-l border-white/10 overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
                >
                  <MoveHistory />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Result dialog */}
        <AnimatePresence>
          {gameState?.phase === 'finished' && <ResultDialog />}
        </AnimatePresence>

        {/* Tutorial dialog */}
        <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    </div>
  );
}
