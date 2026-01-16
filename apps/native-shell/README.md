## Death Mountain Native Shell (Expo)

This is a **third client**: a native iOS/Android shell that loads the existing web client in a `WebView` and provides **native Cartridge Controller login + signing** via a hardened JSON-RPC bridge.

### What this stage includes

- **WebView shell** loading an **HTTPS** web URL (Web Workers work reliably)
- **Native login/session** using Cartridge’s `controller.c` React Native module (TurboModules/JSI)
- **Bridge methods**:
  - `controller.login`
  - `controller.logout`
  - `controller.getAddress`
  - `controller.getUsername`
  - `controller.openProfile` (best-effort fallback: opens `x.cartridge.gg`)
  - `controller.clearCache` (clears cached session data)
  - `starknet.execute(calls)`
  - `starknet.waitForTransaction` (stub for now)

### Prereqs

- Node.js **>= 20**
- `pnpm`
- Xcode + CocoaPods (iOS) / Android Studio (Android)

### Setup

From repo root:

```bash
cd apps/native-shell
pnpm install
```

#### 1) Set the web URL

The native shell loads the web client from:

- `EXPO_PUBLIC_NATIVE_WEB_URL` (must be HTTPS; local tunnels are fine)

Example:

```bash
export EXPO_PUBLIC_NATIVE_WEB_URL="https://your-staging.example.com/"
```

#### 2) Sync Cartridge native module assets (required)

The upstream Cartridge native module includes native sources and an iOS `xcframework` that we **do not commit** to this repo.

Important: the `xcframework` is stored in **Git LFS**, so you must have `git-lfs` installed.

macOS:

```bash
brew install git-lfs
git lfs install
```

Run:

```bash
pnpm sync:controller-module
```

Notes:
- This downloads from `cartridge-gg/controller.c` (default ref: `main`).
- To pin a tag/commit: `CONTROLLER_C_REF=0.1.0 pnpm sync:controller-module`
- If your environment has broken TLS certs: `CURL_INSECURE=1 pnpm sync:controller-module`

#### 3) Prebuild + run (dev client)

This app requires a dev client because the Controller module uses TurboModules/JSI.

```bash
pnpm prebuild
pnpm ios
# or
pnpm android
```

### Bridge contract

All messages are JSON strings exchanged via `WebView.postMessage`.

- **Request**:
  - `jsonrpc`: `"2.0"`
  - `id`: string
  - `method`: string
  - `params`: object (must include `nonce` + `origin`)
- **Response**:
  - `jsonrpc`: `"2.0"`
  - `id`: string
  - `result`: any OR `error`: `{ code, message, data? }`

#### Method table

- **`controller.login`**
  - **params**: `{ nonce, origin, rpcUrl?, cartridgeApiUrl?, keychainUrl?, maxFee?, policies? }`
  - **result**: `{ ok: true }`
- **`controller.logout`**
  - **params**: `{ nonce, origin }`
  - **result**: `{ ok: true }`
- **`controller.getAddress`**
  - **params**: `{ nonce, origin }`
  - **result**: `string | null`
- **`controller.getUsername`**
  - **params**: `{ nonce, origin }`
  - **result**: `string | null`
- **`controller.openProfile`**
  - **params**: `{ nonce, origin }`
  - **result**: `{ ok: true, url?: string }`
- **`controller.clearCache`**
  - **params**: `{ nonce, origin }`
  - **result**: `{ ok: true }`
  - **description**: Clears cached session data and regenerates session keys. Use this if the controller page is not loading correctly.
- **`starknet.execute`**
  - **params**: `{ nonce, origin, calls: Array<{ contractAddress, entrypoint, calldata }> }`
  - **result**: `{ transaction_hash: string }`

### Testing (manual)

- Start the native shell and confirm the WebView loads your web URL.
- In the web app, tap **Log In** (native shell only): it should open the Cartridge session flow and return to the app.
- Trigger any on-chain action that calls `account.execute(...)` in the web client; it should route to `starknet.execute`.

### Troubleshooting

#### Controller page not loading correctly

If the controller authentication page is not loading or showing stale data:

1. **Using ASWebAuthenticationSession** - We use `openAuthSessionAsync` instead of `openBrowserAsync` to avoid iOS simulator BrowserEngineKit crashes
2. **Cache is disabled by default** - The WebView has `cacheEnabled={false}` to prevent stale controller page data
3. **Session data is cleared on logout** - Logging out now clears all cached session keys
4. **Manual cache clear** - You can call `controller.clearCache()` from the web app to force clear all session data

#### Blank authentication page (BrowserEngineKit errors)

**Root Cause:** iOS simulator 18+ has a known bug where Safari popup view controllers (including `SFSafariViewController` and `ASWebAuthenticationSession`) fail to render due to BrowserEngineKit crashes.

**Solution:** The authentication page now opens in the **main WebView** instead of a popup. This works perfectly in both simulator and on real devices:

1. Tap login button
2. Main WebView navigates to the Cartridge authentication page
3. Complete authentication
4. Page redirects back to your app
5. Session connects automatically via WebSocket

The main WebView doesn't have the BrowserEngineKit issue, so authentication works seamlessly!

To manually clear cache from the web app:
```typescript
// In web app code (when running in native shell)
if (connector?.id === "native-shell") {
  await (connector as any).clearCache();
}
```

Or rebuild the app to clear all stored data:
```bash
pnpm prebuild:clean
pnpm ios
```

