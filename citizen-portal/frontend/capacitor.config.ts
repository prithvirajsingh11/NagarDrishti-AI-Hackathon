import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.nagardrishti.ai',
  appName: 'NagarDrishti AI',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
