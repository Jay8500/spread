import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jay.spread',
  appName: 'Spread',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000, // Show for 2 seconds
      launchAutoHide: true, // Automatically hide
      backgroundColor: '#050a12', // Matches your styles.xml
      androidScaleType: 'CENTER_CROP', // Keeps your logo from stretching
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
