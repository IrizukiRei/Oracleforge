import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oracleforge.app',
  appName: 'OracleForge',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    AdMob: {
      // Production mode
      testingDevices: [],
      initializeForTesting: false
    }
  }
};

export default config;
