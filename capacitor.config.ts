import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sitterapp.care',
  appName: 'SitterApp',
  webDir: 'out',
  ios: {
    contentInset: 'never',
    scrollEnabled: true
  },
  server: {
    // For local development - comment out for production
    // url: 'http://localhost:3000',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff"
    },
    Geolocation: {
      // Native geolocation configuration
    },
    BackgroundTask: {
      // Background location tracking
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
