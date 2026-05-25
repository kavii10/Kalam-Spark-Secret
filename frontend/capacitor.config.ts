import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kalamspark.app',
  appName: 'Kalam Spark',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
