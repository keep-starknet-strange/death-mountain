# Quick Start Guide

Get the Loot Survivor native shell app running in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- For iOS: macOS with Xcode 14+
- For Android: Android Studio with SDK

## Step 1: Install Dependencies

```bash
cd apps/native-shell
pnpm install
```

## Step 2: Configure Environment

Create a `.env` file:

```bash
cp env.example .env
```

Edit `.env` and set the web URL:

```bash
EXPO_PUBLIC_NATIVE_WEB_URL=https://lootsurvivor.io
EXPO_PUBLIC_ALLOWED_ORIGINS=https://lootsurvivor.io
```

For local development, use:

```bash
EXPO_PUBLIC_NATIVE_WEB_URL=http://localhost:5173
EXPO_PUBLIC_ALLOWED_ORIGINS=http://localhost:5173
```

## Step 3: Add Assets (Optional)

The app will run without custom assets, but for a better experience:

1. Copy `client/public/favicon.png` to `assets/icon.png`
2. Copy `client/public/banner.png` to `assets/splash.png`
3. Resize as needed (icon: 1024x1024, splash: 2048x2048)

## Step 4: Start Development Server

```bash
pnpm start
```

You'll see a QR code and options to run on different platforms.

## Step 5: Run on Device/Simulator

### iOS Simulator

Press `i` in the terminal, or run:

```bash
pnpm ios
```

### Android Emulator

Press `a` in the terminal, or run:

```bash
pnpm android
```

### Physical Device

1. Install Expo Go app on your device
2. Scan the QR code from Step 4

## Testing the Bridge

Once the app loads:

1. Open the WebView developer tools (shake device → "Debug")
2. In the console, test the bridge:

```javascript
// Test echo
await window.NativeBridge.request('echo', { test: 'hello' });

// Check if logged in
await window.NativeBridge.request('controller.getAddress');
```

## Common Issues

### "Unable to resolve module"

```bash
# Clear cache and reinstall
rm -rf node_modules
pnpm install
pnpm start --clear
```

### "Native module not found"

This is expected - Cartridge native SDK needs to be integrated. The app will still run and load the web client, but native login won't work yet.

### WebView shows blank screen

1. Check that `EXPO_PUBLIC_NATIVE_WEB_URL` is set correctly
2. Verify the URL is accessible
3. Check console for errors

### Bridge not responding

1. Verify you're running in the native app (not browser)
2. Check that `window.NativeBridge` exists
3. Look for origin validation errors in logs

## Next Steps

1. **Test the web client:** Navigate through the app in the WebView
2. **Review logs:** Check both native and WebView console logs
3. **Integrate Cartridge:** Follow `CARTRIDGE_INTEGRATION.md` to add native login
4. **Build for production:** Use `eas build` when ready

## Development Tips

### Hot Reload

The app supports hot reload. Changes to native code will reload automatically.

### Debugging

**Native code:**
- iOS: Xcode debugger
- Android: Android Studio debugger

**WebView:**
- iOS: Safari → Develop → Simulator → Your App
- Android: Chrome → chrome://inspect

### Environment Switching

Switch between environments easily:

```bash
# Production
EXPO_PUBLIC_NATIVE_WEB_URL=https://lootsurvivor.io pnpm start

# Staging
EXPO_PUBLIC_NATIVE_WEB_URL=https://staging.lootsurvivor.io pnpm start

# Local
EXPO_PUBLIC_NATIVE_WEB_URL=http://localhost:5173 pnpm start
```

## Building for Production

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Build

```bash
# Generate native projects
npx expo prebuild

# iOS
cd ios && pod install && cd ..
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release
```

## Resources

- **Full Documentation:** See `README.md`
- **Bridge Specification:** See `BRIDGE_SPEC.md`
- **Cartridge Integration:** See `CARTRIDGE_INTEGRATION.md`
- **Expo Docs:** https://docs.expo.dev/
- **React Native Docs:** https://reactnative.dev/

## Getting Help

If you run into issues:

1. Check the logs (both native and WebView)
2. Review the full README.md
3. Check existing GitHub issues
4. Ask in the project Discord/community

Happy coding! 🎮
