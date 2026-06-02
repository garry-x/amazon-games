import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, ALL_THEMES } from '../store/ui-store';

export function ThemePicker() {
  const { theme, setTheme } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const accentColor = '#' + theme.background.accent.toString(16).padStart(6, '0');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
          border border-white/10 hover:border-white/30 text-white/70 hover:text-white
          transition-all duration-200"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        {/* Color dots */}
        <div className="flex gap-1">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: '#' + theme.board.light.toString(16).padStart(6, '0') }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: '#' + theme.board.dark.toString(16).padStart(6, '0') }}
          />
        </div>
        {theme.name}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 p-2 rounded-xl border border-white/10 z-50 min-w-[200px]"
            style={{
              background: 'rgba(10,10,20,0.95)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {ALL_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  hover:bg-white/5 transition-all duration-150 text-left"
              >
                <div className="flex gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: '#' + t.board.light.toString(16).padStart(6, '0') }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: '#' + t.board.dark.toString(16).padStart(6, '0') }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: '#' + t.pieces.whiteGlow.toString(16).padStart(6, '0') }}
                  />
                </div>
                <span className="text-white/80">{t.name}</span>
                {t.id === theme.id && (
                  <div
                    className="w-2 h-2 rounded-full ml-auto"
                    style={{ background: accentColor }}
                  />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
