
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1ced3d0c5b464aa581e60b645c90d997',
  appName: 'Love Islander',
  webDir: 'dist',
  // Enable hideable address bar in iOS
  ios: {
    contentInset: 'always',
    // Define icon specific configurations
    iconBackground: '#673AB7', // A purple that matches your theme
  },
  // Enable keyboard resizing in Android
  android: {
    captureInput: true,
    allowMixedContent: false,
    // Add version information for Play Store
    buildOptions: {
      keystorePath: undefined, // Path to your keystore file
      keystorePassword: undefined, // Your keystore password
      keystoreAlias: undefined, // Your key alias
      keystoreAliasPassword: undefined, // Your alias password
    },
    // Define icon specific configurations
    iconBackground: '#673AB7', // A purple that matches your theme
    splashScreenBackground: '#1A1F2C', // Your dark theme color
    icon: 'public/app-icon.png', // The path to your 512x512px icon
  },
  // Configure plugins
  plugins: {
    // Configure deep links for auth redirects
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
