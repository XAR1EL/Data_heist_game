import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.x3r0phyt3.dataheist',
  appName: 'Data Heist Slot',
  webDir: 'www',
  cordova: {
    preferences: {
      FullScreen: 'true',
      Orientation: 'portrait'
    }
  }
};

export default config;
