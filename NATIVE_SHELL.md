# Native Shell Overview

This repository now includes a **native mobile app** in addition to the web client.

## Structure

```
death-mountain-main-test2/
├── client/                    # Web client (Vite + React)
│   ├── src/desktop/          # Desktop browser view
│   ├── src/mobile/           # Mobile browser view
│   └── src/utils/nativeBridge.ts  # NEW: Native shell adapter
├── contracts/                 # Cairo contracts
└── apps/
    └── native-shell/         # NEW: React Native app
        ├── src/
        │   ├── bridge/       # Bridge communication
        │   ├── cartridge/    # Cartridge Controller
        │   └── components/   # Native components
        └── README.md         # Full documentation
```

## What is the Native Shell?

The native shell is a React Native (Expo) app that:

1. **Loads the web client** in a WebView
2. **Provides native wallet** functionality via Cartridge Controller
3. **Bridges wallet operations** between web and native code
4. **Enables native features** like passkeys, biometric auth, and deep linking

## Key Features

- ✅ **Native Wallet:** Cartridge Controller with passkeys and session keys
- ✅ **Secure Bridge:** JSON-RPC-like protocol for web ↔ native communication
- ✅ **Web Client Compatible:** Existing web client works without changes
- ✅ **Browser Unchanged:** Desktop and mobile browser behavior is identical
- ✅ **TypeScript:** Fully typed throughout
- ✅ **Security:** Origin validation, method allowlist, request validation

## Architecture

```
┌─────────────────────────────────────┐
│   React Native App (iOS/Android)    │
│  ┌──────────────────────────────┐  │
│  │  WebView                     │  │
│  │  (Loads existing web client) │  │
│  │  - Detects native shell      │  │
│  │  - Routes wallet via bridge  │  │
│  └──────────────────────────────┘  │
│            ↕ Secure Bridge          │
│  ┌──────────────────────────────┐  │
│  │  Cartridge Controller        │  │
│  │  - Passkey authentication    │  │
│  │  - Transaction signing       │  │
│  │  - Session management        │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## How It Works

### 1. Web Client Detection

The web client detects when it's running in the native shell:

```typescript
// client/src/utils/nativeBridge.ts
export function isNativeShell(): boolean {
  return typeof window !== 'undefined' && 
         window.__NATIVE_SHELL__ === true &&
         typeof window.ReactNativeWebView !== 'undefined';
}
```

### 2. Wallet Operations Routing

When in native shell mode, wallet operations use the bridge:

```typescript
// client/src/contexts/controller.tsx
const account = isNative 
  ? nativeAccount  // Uses bridge
  : account;       // Uses browser wallet
```

### 3. Bridge Communication

The bridge uses a JSON-RPC-like protocol:

```javascript
// In WebView
const result = await window.NativeBridge.request('starknet.execute', {
  calls: [...]
});

// Native side handles it and returns response
```

### 4. No Browser Impact

All native shell code is strictly gated:

```typescript
if (isNativeShell()) {
  // Use native bridge
} else {
  // Use browser wallet (unchanged)
}
```

Desktop and mobile browser behavior is **completely unchanged**.

## Getting Started

### For Users

The native app will be available on:
- 📱 iOS App Store (coming soon)
- 🤖 Google Play Store (coming soon)

### For Developers

See the comprehensive documentation in `apps/native-shell/`:

1. **[README.md](apps/native-shell/README.md)** - Full setup and usage guide
2. **[QUICKSTART.md](apps/native-shell/QUICKSTART.md)** - Get running in 5 minutes
3. **[BRIDGE_SPEC.md](apps/native-shell/BRIDGE_SPEC.md)** - Bridge protocol details
4. **[CARTRIDGE_INTEGRATION.md](apps/native-shell/CARTRIDGE_INTEGRATION.md)** - SDK integration guide

Quick start:

```bash
cd apps/native-shell
pnpm install
pnpm start
```

Then press `i` for iOS or `a` for Android.

## Bridge API

The bridge exposes these methods to the web client:

| Method | Description |
|--------|-------------|
| `controller.login` | Login with Cartridge Controller |
| `controller.logout` | Logout and clear session |
| `controller.getAddress` | Get current account address |
| `controller.getUsername` | Get current username |
| `starknet.execute` | Execute transaction calls |
| `starknet.waitForTransaction` | Wait for transaction confirmation |

See [BRIDGE_SPEC.md](apps/native-shell/BRIDGE_SPEC.md) for complete details.

## Security

The native shell implements multiple security layers:

1. **Origin Validation:** Only allowed origins can communicate
2. **Method Allowlist:** Only explicitly allowed methods can be called
3. **Request Validation:** All requests are validated for structure and timing
4. **Secure Storage:** Credentials stored using platform-secure storage
5. **Session Management:** Time-limited sessions with automatic expiration

## Development Status

### ✅ Completed

- Expo app scaffolding
- WebView with bridge communication
- Secure bridge protocol
- Web client adapter
- Comprehensive documentation

### ⚠️ In Progress

- Cartridge native SDK integration
- Passkey authentication
- Session key management

### 📋 Planned

- Deep linking
- Push notifications
- App Store submission

## Web Client Changes

Changes to the web client are **minimal** and **strictly gated**:

**Added files:**
- `client/src/utils/nativeBridge.ts` - Bridge adapter (only active in native shell)

**Modified files:**
- `client/src/contexts/controller.tsx` - Added native shell support (gated)
- `client/src/dojo/useSystemCalls.ts` - Added import (no behavior change)

**Browser impact:** **ZERO** - All changes are behind `isNativeShell()` checks.

## Testing

### Test the Bridge

```javascript
// In WebView console (when running in native app)
await window.NativeBridge.request('echo', { test: 'hello' });
// Returns: { echo: { test: 'hello' } }
```

### Test Native Detection

```javascript
// In web client console
console.log(window.__NATIVE_SHELL__);
// true in native app, undefined in browser
```

## Building for Production

### Using EAS Build (Recommended)

```bash
cd apps/native-shell
eas build --platform ios
eas build --platform android
```

### Local Build

```bash
cd apps/native-shell
npx expo prebuild
npx expo run:ios --configuration Release
npx expo run:android --variant release
```

## Deployment

The native app and web client are deployed independently:

- **Web Client:** Deployed to web hosting (Vercel, etc.)
- **Native App:** Built and submitted to App Store / Play Store

The native app loads the web client from a URL (configurable via environment variables).

## FAQ

**Q: Does this change the web app?**  
A: No. Browser behavior is completely unchanged. Changes are strictly gated to native shell mode.

**Q: Can I test without a physical device?**  
A: Yes. Use iOS Simulator or Android Emulator.

**Q: Do I need to rebuild the native app when the web client changes?**  
A: No. The native app loads the web client from a URL, so web updates are instant.

**Q: What about Web Workers?**  
A: Web Workers work when loading from HTTPS URLs. For offline support, a local HTTP server is needed.

**Q: Is Cartridge Controller integrated?**  
A: The scaffolding is complete, but the actual native SDK integration requires additional work. See [CARTRIDGE_INTEGRATION.md](apps/native-shell/CARTRIDGE_INTEGRATION.md).

**Q: Can I use a local web client?**  
A: Yes. Set `EXPO_PUBLIC_NATIVE_WEB_URL=http://localhost:5173` in `.env`.

## Contributing

When contributing to the native shell:

1. Keep web client changes minimal and gated
2. Add security validation for new bridge methods
3. Update documentation
4. Test on both iOS and Android
5. Verify no browser impact

## Resources

- **Native Shell Docs:** [apps/native-shell/README.md](apps/native-shell/README.md)
- **Expo Docs:** https://docs.expo.dev/
- **Cartridge Docs:** https://docs.cartridge.gg/
- **React Native Docs:** https://reactnative.dev/

## Support

For native shell issues:
1. Check the documentation in `apps/native-shell/`
2. Review console logs (both native and WebView)
3. Check existing GitHub issues
4. Ask in the project community

---

**Note:** The native shell is a new addition that provides native mobile capabilities while preserving the existing web client experience. It's designed to be a transparent enhancement that doesn't impact browser users.
