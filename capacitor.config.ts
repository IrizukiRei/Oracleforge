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
      // Test mode for development
      testingDevices: ['TEST_DEVICE_ID'],
      initializeForTesting: true
    }
  }
};

export default config;
