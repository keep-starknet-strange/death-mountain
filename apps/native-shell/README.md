# Loot Survivor Native Shell

A React Native (Expo) wrapper app that provides native mobile support for the Loot Survivor web client, with integrated Cartridge Controller for native wallet functionality on iOS and Android.

## Overview

This app serves as a "native shell" - it loads the existing web client in a WebView while providing native wallet capabilities through a secure JavaScript bridge. The web client detects when it's running in this native environment and routes wallet operations through the bridge instead of browser-based connectors.

**Key Features:**
- Native Cartridge Controller integration (passkeys, session keys)
- Secure bridge for wallet operations (login, logout, transaction signing)
- WebView with Web Workers support
- Deep linking support
- Secure credential storage via Expo SecureStore

## Architecture

```
┌─────────────────────────────────────┐
│   React Native App (Expo)           │
│  ┌──────────────────────────────┐  │
│  │  WebView (Web Client)        │  │
│  │  - Detects native shell      │  │
│  │  - Uses bridge for wallet    │  │
│  └──────────────────────────────┘  │
│            ↕ Bridge                 │
│  ┌──────────────────────────────┐  │
│  │  Native Bridge Handler       │  │
│  │  - Request validation        │  │
│  │  - Method routing            │  │
│  └──────────────────────────────┘  │
│            ↕                        │
│  ┌──────────────────────────────┐  │
│  │  Cartridge Controller        │  │
│  │  - Passkey auth              │  │
│  │  - Transaction signing       │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Project Structure

```
apps/native-shell/
├── src/
│   ├── bridge/
│   │   └── BridgeHandler.ts       # Handles bridge requests
│   ├── cartridge/
│   │   └── CartridgeController.ts # Cartridge SDK integration
│   ├── components/
│   │   └── NativeWebView.tsx      # WebView with bridge
│   ├── types/
│   │   ├── bridge.ts              # Bridge type definitions
│   │   └── cartridge.ts           # Cartridge type definitions
│   ├── utils/
│   │   └── security.ts            # Security validation
│   └── App.tsx                    # Main app component
├── assets/                        # App icons and splash
├── app.json                       # Expo configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+ and pnpm
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode 14+ and iOS Simulator
- For Android: Android Studio and Android SDK

### Installation

1. **Install dependencies:**

```bash
cd apps/native-shell
pnpm install
```

2. **Configure environment variables:**

Create a `.env` file in `apps/native-shell/`:

```bash
# Web App URL - Point to your staging/production web app
EXPO_PUBLIC_NATIVE_WEB_URL=https://lootsurvivor.io

# Allowed origins for bridge communication (comma-separated)
EXPO_PUBLIC_ALLOWED_ORIGINS=https://lootsurvivor.io,https://staging.lootsurvivor.io

# Cartridge Configuration
EXPO_PUBLIC_CARTRIDGE_RPC_URL=https://api.cartridge.gg/x/starknet/mainnet
EXPO_PUBLIC_CHAIN_ID=SN_MAIN
```

3. **Add app assets:**

Add the following image files to `apps/native-shell/assets/`:
- `icon.png` (1024x1024) - App icon
- `splash.png` (2048x2048) - Splash screen
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `favicon.png` (48x48) - Web favicon

You can copy and resize from `client/public/favicon.png` or `client/public/banner.png`.

## Development

### Running the App

**Start Expo development server:**

```bash
pnpm start
```

**Run on iOS Simulator:**

```bash
pnpm ios
```

**Run on Android Emulator:**

```bash
pnpm android
```

**Run on physical device:**

1. Install Expo Go app on your device
2. Scan the QR code from `pnpm start`

### Testing the Bridge

The bridge includes an `echo` method for testing:

```javascript
// In the web client console (when running in native shell)
window.NativeBridge.request('echo', { test: 'hello' })
  .then(result => console.log('Echo result:', result));
```

### Development with Local Web Client

To test with a local web client instance:

1. Start the web client locally:
   ```bash
   cd ../../client
   pnpm dev
   ```

2. Update `.env` to point to localhost:
   ```bash
   EXPO_PUBLIC_NATIVE_WEB_URL=http://localhost:5173
   EXPO_PUBLIC_ALLOWED_ORIGINS=http://localhost:5173
   ```

3. Restart the Expo app

**Note:** Web Workers may not work reliably with `file://` URLs. For production, always use HTTPS URLs.

## Building for Production

### Using EAS Build (Recommended)

1. **Install EAS CLI:**

```bash
npm install -g eas-cli
```

2. **Login to Expo:**

```bash
eas login
```

3. **Configure EAS:**

```bash
eas build:configure
```

4. **Build for iOS:**

```bash
eas build --platform ios
```

5. **Build for Android:**

```bash
eas build --platform android
```

### Local Builds (Advanced)

If you need to build locally (e.g., for native modules):

```bash
# Generate native projects
npx expo prebuild

# iOS
cd ios && pod install && cd ..
npx expo run:ios

# Android
npx expo run:android
```

## Bridge API Reference

The bridge provides a JSON-RPC-like interface for communication between the WebView and native code.

### Request Format

```typescript
{
  id: string;           // Unique request ID
  method: string;       // Method name
  params?: any;         // Method parameters
  timestamp: number;    // Request timestamp
}
```

### Response Format

```typescript
{
  id: string;           // Matching request ID
  result?: any;         // Success result
  error?: {             // Error object (if failed)
    code: number;
    message: string;
    data?: any;
  };
  timestamp: number;    // Response timestamp
}
```

### Available Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `echo` | `any` | `{ echo: any }` | Test method that echoes back params |
| `controller.login` | none | `{ address: string, username?: string }` | Login with Cartridge Controller |
| `controller.logout` | none | `{ success: boolean }` | Logout and clear session |
| `controller.getAddress` | none | `{ address: string \| null }` | Get current account address |
| `controller.getUsername` | none | `{ username: string \| null }` | Get current username |
| `controller.openProfile` | none | `{ success: boolean }` | Open Cartridge profile (if supported) |
| `starknet.execute` | `{ calls: Call[] }` | `{ transaction_hash: string }` | Execute transaction calls |
| `starknet.waitForTransaction` | `{ transactionHash: string, retryInterval?: number }` | `TransactionReceipt` | Wait for transaction confirmation |

### Call Structure

For `starknet.execute`, each call should have:

```typescript
{
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32600 | INVALID_REQUEST | Invalid request format |
| -32601 | METHOD_NOT_FOUND | Method not allowed |
| -32602 | INVALID_PARAMS | Invalid parameters |
| -32603 | INTERNAL_ERROR | Internal error |
| -32000 | UNAUTHORIZED | Unauthorized origin |
| -32001 | NOT_CONNECTED | Not connected (login required) |
| -32002 | USER_REJECTED | User rejected the request |
| -32003 | TRANSACTION_FAILED | Transaction failed |

## Web Client Integration

The web client automatically detects when running in the native shell and routes wallet operations through the bridge.

### Detection

```typescript
// In client/src/utils/nativeBridge.ts
export function isNativeShell(): boolean {
  return typeof window !== 'undefined' && 
         window.__NATIVE_SHELL__ === true &&
         typeof window.ReactNativeWebView !== 'undefined';
}
```

### Usage in Web Client

The integration is transparent - existing code continues to work:

```typescript
// In client/src/contexts/controller.tsx
const { account, address } = useController();

// account will be NativeAccountAdapter when in native shell
// account will be regular Starknet Account when in browser
await account.execute(calls);
```

**Important:** All changes to the web client are strictly gated behind `isNativeShell()` checks. Browser behavior is completely unchanged.

## Security

### Origin Validation

The bridge validates all incoming messages against an allowlist of origins:

```typescript
// Configured via EXPO_PUBLIC_ALLOWED_ORIGINS
const ALLOWED_ORIGINS = [
  'https://lootsurvivor.io',
  'https://staging.lootsurvivor.io'
];
```

In development mode, `localhost` and `file://` are automatically allowed.

### Method Validation

Only explicitly allowed methods can be called:

```typescript
const ALLOWED_METHODS = [
  'echo',
  'controller.login',
  'controller.logout',
  'controller.getAddress',
  'controller.getUsername',
  'controller.openProfile',
  'starknet.execute',
  'starknet.waitForTransaction',
];
```

### Request Validation

Each request is validated for:
- Correct structure (id, method, timestamp)
- Timestamp within 5 minutes of current time
- Method in allowlist
- Origin in allowlist

### Secure Storage

Credentials are stored using Expo SecureStore, which uses:
- iOS: Keychain Services
- Android: EncryptedSharedPreferences (AES-256)

## Cartridge Controller Integration

### Current Status

The app includes scaffolding for Cartridge Controller integration. The actual native SDK integration requires:

1. **Native Modules:** Cartridge's native SDK may require custom native modules
2. **Config Plugins:** Expo config plugins for native configuration
3. **Policies:** Define transaction policies for session keys

### Implementation Notes

See `src/cartridge/CartridgeController.ts` for the integration interface. The `login()` method includes TODO comments indicating where the actual Cartridge SDK calls should be integrated.

**Reference:** https://github.com/cartridge-gg/controller.c/tree/main/examples/react-native

### Session Management

Sessions are stored securely and include:
- Account address
- Username (if available)
- Session expiration time
- Session key (for transaction signing)

## Troubleshooting

### Web Workers Not Loading

If the web client reports Web Worker errors:

1. Ensure you're using an HTTPS URL (not `file://`)
2. Check that the web server sends correct CORS headers
3. Verify `allowFileAccessFromFileURLs` is enabled in WebView

### Bridge Not Responding

1. Check console logs in both native and WebView
2. Verify origin is in the allowlist
3. Test with the `echo` method first
4. Check that `window.NativeBridge` is defined in WebView

### Login Fails

1. Ensure Cartridge Controller is properly initialized
2. Check network connectivity
3. Verify RPC URL is correct
4. Check console for specific error messages

### Build Errors

If you encounter build errors:

1. Clear cache: `npx expo start -c`
2. Reinstall dependencies: `rm -rf node_modules && pnpm install`
3. For iOS: `cd ios && pod install && cd ..`
4. For Android: Clean build in Android Studio

## Testing Checklist

Before releasing, test the following flows:

- [ ] App launches and loads web client
- [ ] Native login flow works
- [ ] Address and username are displayed correctly
- [ ] Transaction execution works (test with a simple game action)
- [ ] Transaction confirmation works
- [ ] Logout clears session
- [ ] App restart restores session (if not expired)
- [ ] Deep links work (if configured)
- [ ] Web Workers function correctly
- [ ] No impact on web browser behavior

## Known Limitations

1. **Cartridge SDK:** Native SDK integration is scaffolded but requires actual implementation
2. **Payments:** Apple Pay / StoreKit / Play Billing are not implemented (out of scope)
3. **Web Workers:** May have issues with `file://` URLs - use HTTPS for production
4. **Profile:** `openProfile` is stubbed and requires native SDK support

## Contributing

When making changes:

1. Keep web client changes minimal and gated behind `isNativeShell()`
2. Add security validation for new bridge methods
3. Update this README with new methods or configuration
4. Test on both iOS and Android
5. Verify no impact on desktop/mobile browser behavior

## License

See the main repository LICENSE files.

## Support

For issues specific to the native shell, please check:
1. This README
2. Console logs (both native and WebView)
3. Cartridge documentation: https://docs.cartridge.gg/
4. Expo documentation: https://docs.expo.dev/
