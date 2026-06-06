import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../store/ui-store';
import { useServerStore } from '../store/server-store';

interface Props {
  onDone: () => void;
}

/** Parse and normalize a server address input into a full vLLM API URL */
function normalizeUrl(input: string): string {
  let trimmed = input.trim();
  if (!trimmed) return '';

  // Add http:// if no protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'http://' + trimmed;
  }

  // If path already includes chat/completions, use as-is
  if (trimmed.includes('/chat/completions')) {
    return trimmed;
  }

  // Remove trailing slash
  trimmed = trimmed.replace(/\/+$/, '');

  // Check if it looks like an OpenAI-compatible endpoint (has /v1)
  if (trimmed.includes('/v1')) {
    return trimmed + '/chat/completions';
  }

  // Default: append vLLM API path
  return trimmed + '/v1/chat/completions';
}

export function ServerConfig({ onDone }: Props) {
  const previewTheme = useUIStore(s => s.previewTheme);
  const { serverUrl, setServerUrl } = useServerStore();
  const accent = useMemo(() => '#' + previewTheme.background.accent.toString(16).padStart(6, '0'), [previewTheme]);

  // Extract a user-friendly display from the stored URL
  const initialDisplay = useMemo(() => {
    try {
      const u = new URL(serverUrl);
      return u.host; // e.g. "192.168.1.100:8000"
    } catch {
      return serverUrl;
    }
  }, [serverUrl]);

  const [input, setInput] = useState(initialDisplay);
  const [error, setError] = useState('');

  const handleSave = () => {
    const url = normalizeUrl(input);
    if (!url) {
      setError('请输入有效的服务器地址');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('地址格式无效，请输入 IP:端口');
      return;
    }
    setServerUrl(url);
    onDone();
  };

  const handleSkip = () => {
    onDone();
  };

  const section = "rounded-2xl border p-3 sm:p-5";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-3 sm:px-6 py-5 sm:py-8 select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-4 sm:space-y-6 text-center">
        {/* Icon */}
        <div className="text-5xl mb-2">🤖</div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight"
          style={{ color: accent, textShadow: `0 0 40px ${accent}44` }}>
          AI 服务器设置
        </h1>
        <p className="text-xs sm:text-sm text-white/50 leading-relaxed">
          AI 对战需要连接到运行 vLLM 大模型的服务器。<br />
          请输入同一局域网内的服务器地址。
        </p>

        {/* Input */}
        <div className={section} style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <label className="text-xs font-bold uppercase tracking-[0.1em] mb-3 block text-white/40">
            服务器地址
          </label>
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="192.168.1.100:8000"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm font-mono text-center
              border focus:outline-none transition-colors"
            style={{
              color: accent,
              borderColor: error ? 'rgba(255,100,100,0.5)' : accent + '33',
              background: 'rgba(0,0,0,0.3)',
            }}
          />
          {error && (
            <p className="text-xs mt-2" style={{ color: 'rgba(255,100,100,0.8)' }}>{error}</p>
          )}
          <p className="text-[11px] text-white/25 mt-2 leading-relaxed">
            格式: IP:端口，例如 192.168.1.100:8000
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 sm:gap-3 pt-1">
          <motion.button
            onClick={handleSkip}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold border transition-colors"
            style={{ color: '#ffffff88', borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
            跳过 (本地双人)
          </motion.button>
          <motion.button
            onClick={handleSave}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 rounded-xl text-xl font-black transition-all tracking-wide"
            style={{
              color: '#0a0a10',
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              boxShadow: `0 0 40px ${accent}44, 0 8px 24px rgba(0,0,0,0.5)`,
            }}>
            连接
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
