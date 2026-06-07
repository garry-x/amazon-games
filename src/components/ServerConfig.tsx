import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../store/ui-store';
import { useServerStore, type ProviderConfig } from '../store/server-store';

interface Props {
  onDone: () => void;
}

/** Build a default provider from env vars (if available) */
function envDefault(): ProviderConfig | null {
  const baseUrl = import.meta.env.VITE_AI_BASE_URL as string | undefined;
  const model = import.meta.env.VITE_AI_MODEL as string | undefined;
  if (!baseUrl || !model) return null;
  return {
    name: (import.meta.env.VITE_AI_PROVIDER_NAME as string) ?? 'Custom Provider',
    baseUrl,
    apiKey: (import.meta.env.VITE_AI_API_KEY as string) ?? '',
    model,
  };
}

export function ServerConfig({ onDone }: Props) {
  const previewTheme = useUIStore(s => s.previewTheme);
  const { provider, setProvider, isConfigured } = useServerStore();
  const accent = useMemo(() => '#' + previewTheme.background.accent.toString(16).padStart(6, '0'), [previewTheme]);

  const defaults = useMemo(() => envDefault(), []);
  const current = provider ?? defaults;

  const [name, setName] = useState(current?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(current?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(current?.apiKey ?? '');
  const [model, setModel] = useState(current?.model ?? '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!baseUrl.trim()) {
      setError('请输入 Base URL');
      return;
    }
    if (!model.trim()) {
      setError('请输入 Model');
      return;
    }
    try {
      // Validate base URL is well-formed
      new URL(baseUrl.trim());
    } catch {
      setError('Base URL 格式无效');
      return;
    }
    setProvider({
      name: name.trim() || 'Custom Provider',
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    });
    onDone();
  };

  const handleSkip = () => {
    // Use env default if available, otherwise skip
    if (defaults) {
      setProvider(defaults);
    }
    onDone();
  };

  const handleReset = () => {
    setProvider(null);
    if (defaults) {
      setName(defaults.name);
      setBaseUrl(defaults.baseUrl);
      setApiKey(defaults.apiKey);
      setModel(defaults.model);
    } else {
      setName('');
      setBaseUrl('');
      setApiKey('');
      setModel('');
    }
    setError('');
  };

  const section = "rounded-2xl border p-3 sm:p-5";
  const inputClass = "w-full px-4 py-3 rounded-xl text-sm font-mono border focus:outline-none transition-colors";

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
          AI Provider 设置
        </h1>
        <p className="text-xs sm:text-sm text-white/50 leading-relaxed">
          配置远程 AI 大模型服务。<br />
          支持任何 OpenAI 兼容 API。
        </p>

        {/* Provider fields */}
        <div className={section} style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.1em] mb-1.5 block text-white/40 text-left">
                Provider 名称
              </label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="Volcengine Coding Plan"
                className={inputClass}
                style={{
                  color: accent,
                  borderColor: accent + '33',
                  background: 'rgba(0,0,0,0.3)',
                }}
              />
            </div>

            {/* Base URL */}
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.1em] mb-1.5 block text-white/40 text-left">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => { setBaseUrl(e.target.value); setError(''); }}
                placeholder="https://api.example.com/v1"
                className={inputClass}
                style={{
                  color: accent,
                  borderColor: error ? 'rgba(255,100,100,0.5)' : accent + '33',
                  background: 'rgba(0,0,0,0.3)',
                }}
              />
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.1em] mb-1.5 block text-white/40 text-left">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setError(''); }}
                placeholder="sk-..."
                className={inputClass}
                style={{
                  color: accent,
                  borderColor: accent + '33',
                  background: 'rgba(0,0,0,0.3)',
                }}
              />
            </div>

            {/* Model */}
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.1em] mb-1.5 block text-white/40 text-left">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={e => { setModel(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="deepseek-v4-pro"
                autoFocus
                className={inputClass}
                style={{
                  color: accent,
                  borderColor: error ? 'rgba(255,100,100,0.5)' : accent + '33',
                  background: 'rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs mt-3" style={{ color: 'rgba(255,100,100,0.8)' }}>{error}</p>
          )}
          {defaults && (
            <p className="text-[11px] text-white/25 mt-3 leading-relaxed">
              已从本地配置加载默认 Provider: {defaults.name}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 sm:gap-3 pt-1">
          <motion.button
            onClick={handleSkip}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold border transition-colors"
            style={{ color: '#ffffff88', borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
            {isConfigured ? '保持当前' : defaults ? '使用默认' : '跳过 (本地双人)'}
          </motion.button>
          {isConfigured && (
            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="px-4 py-3.5 rounded-xl text-sm border transition-colors"
              style={{ color: 'rgba(255,100,100,0.7)', borderColor: 'rgba(255,100,100,0.2)', background: 'rgba(255,100,100,0.05)' }}>
              重置
            </motion.button>
          )}
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
