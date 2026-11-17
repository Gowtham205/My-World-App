import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myworld.sanctuary',
  appName: 'My World',
  webDir: 'dist',
  server: {
    // Use HTTPS scheme inside Android WebView so IndexedDB, Web Crypto (AES-256 Vault),
    // and microphone permissions work reliably offline and online.
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0F1115',
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sanctuary',
      iconColor: '#9EC5AB',
    },
  },
};

export default config;
