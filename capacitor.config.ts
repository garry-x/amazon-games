import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mathgames.app',
  appName: 'Math Games',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Preferences: {},
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
