# Cartridge Controller Integration Guide

This document provides guidance on integrating Cartridge's native Controller SDK into the native shell app.

## Overview

The app currently includes scaffolding for Cartridge Controller integration. The actual native SDK integration requires additional work to connect with Cartridge's native modules.

## Current Status

**Implemented:**
- ✅ Bridge interface for controller methods
- ✅ Session storage using Expo SecureStore
- ✅ Account abstraction layer
- ✅ TypeScript types and interfaces

**Requires Implementation:**
- ⚠️ Actual Cartridge native SDK integration
- ⚠️ Passkey authentication flow
- ⚠️ Session key management
- ⚠️ Transaction policies configuration
- ⚠️ Native UI for authentication

## Reference Implementation

Cartridge provides a React Native example:
https://github.com/cartridge-gg/controller.c/tree/main/examples/react-native

## Integration Steps

### 1. Add Cartridge Native SDK

First, you'll need to add Cartridge's native SDK. This may require:

**Option A: If Cartridge provides an npm package:**

```bash
pnpm add @cartridge/controller-native
```

**Option B: If native modules are required:**

You may need to use Expo's custom development client:

```bash
npx expo install expo-dev-client
npx expo prebuild
```

Then add the native modules manually to iOS and Android projects.

### 2. Configure Native Modules

#### iOS Configuration

In `ios/Podfile`, add any required Cartridge pods:

```ruby
# Add Cartridge dependencies
pod 'CartridgeController', :path => '../node_modules/@cartridge/controller-native/ios'
```

#### Android Configuration

In `android/app/build.gradle`, add Cartridge dependencies:

```gradle
dependencies {
    implementation project(':cartridge-controller')
    // ... other dependencies
}
```

In `android/settings.gradle`:

```gradle
include ':cartridge-controller'
project(':cartridge-controller').projectDir = new File(
    rootProject.projectDir,
    '../node_modules/@cartridge/controller-native/android'
)
```

### 3. Update CartridgeController.ts

Replace the placeholder implementation in `src/cartridge/CartridgeController.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';
import { Account, RpcProvider, Call } from 'starknet';
import Constants from 'expo-constants';
// Import Cartridge native SDK
import CartridgeNative from '@cartridge/controller-native';

export class CartridgeController {
  private provider: RpcProvider;
  private account: Account | null = null;
  private session: CartridgeSession | null = null;
  private chainId: string;

  constructor() {
    // ... existing constructor code ...
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Cartridge native SDK
      await CartridgeNative.initialize({
        chainId: this.chainId,
        rpcUrl: this.provider.nodeUrl,
      });

      // Restore session if available
      const sessionData = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionData) {
        this.session = JSON.parse(sessionData);
        
        if (this.session && this.session.expiresAt > Date.now()) {
          // Restore account from session
          const restored = await CartridgeNative.restoreSession(this.session);
          if (restored) {
            this.account = new Account(
              this.provider,
              restored.address,
              restored.sessionKey
            );
          }
        } else {
          await this.clearSession();
        }
      }
    } catch (error) {
      console.error('Failed to initialize CartridgeController:', error);
    }
  }

  async login(): Promise<CartridgeAccount> {
    try {
      // Call Cartridge native SDK for passkey authentication
      const result = await CartridgeNative.login({
        chainId: this.chainId,
        policies: this.getPolicies(),
      });

      // Create session key for transactions
      const sessionKey = result.sessionKey;
      
      this.account = new Account(
        this.provider,
        result.address,
        sessionKey
      );

      this.session = {
        account: {
          address: result.address,
          username: result.username,
        },
        expiresAt: result.expiresAt,
      };

      await this.saveSession();
      return this.session.account;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  private getPolicies() {
    // Define transaction policies
    // These control what transactions can be executed without user approval
    return [
      {
        target: '0x...', // Game contract address
        method: 'explore',
        description: 'Allow exploring the dungeon',
      },
      {
        target: '0x...', // Game contract address
        method: 'attack',
        description: 'Allow attacking beasts',
      },
      // ... more policies
    ];
  }

  // ... rest of the implementation
}
```

### 4. Define Transaction Policies

Policies control what transactions can be executed without user approval:

```typescript
interface Policy {
  target: string;      // Contract address
  method: string;      // Method name
  description: string; // User-facing description
}

const GAME_POLICIES: Policy[] = [
  {
    target: GAME_ADDRESS,
    method: 'explore',
    description: 'Explore the dungeon',
  },
  {
    target: GAME_ADDRESS,
    method: 'attack',
    description: 'Attack beasts',
  },
  {
    target: GAME_ADDRESS,
    method: 'flee',
    description: 'Flee from combat',
  },
  {
    target: GAME_ADDRESS,
    method: 'equip',
    description: 'Equip items',
  },
  {
    target: GAME_ADDRESS,
    method: 'drop',
    description: 'Drop items',
  },
  {
    target: GAME_ADDRESS,
    method: 'buy_items',
    description: 'Buy items from shop',
  },
  {
    target: GAME_ADDRESS,
    method: 'select_stat_upgrades',
    description: 'Upgrade stats',
  },
];
```

### 5. Handle Passkey Authentication

Cartridge uses passkeys (WebAuthn) for authentication. Ensure your app:

1. **Requests proper permissions:**
   - iOS: Face ID / Touch ID
   - Android: Biometric authentication

2. **Handles authentication UI:**
   - Show loading states
   - Handle user cancellation
   - Display error messages

3. **Stores credentials securely:**
   - Use Expo SecureStore
   - Never log sensitive data
   - Clear on logout

### 6. Implement Session Key Management

Session keys allow transactions without repeated authentication:

```typescript
interface SessionKey {
  privateKey: string;
  expiresAt: number;
  policies: Policy[];
}

async function createSessionKey(
  masterKey: string,
  policies: Policy[],
  duration: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<SessionKey> {
  // Generate a new session key
  const sessionPrivateKey = generatePrivateKey();
  
  // Sign the session key with master key
  const signature = await signSessionKey(masterKey, sessionPrivateKey, policies);
  
  // Store securely
  await SecureStore.setItemAsync('session_key', JSON.stringify({
    privateKey: sessionPrivateKey,
    expiresAt: Date.now() + duration,
    policies,
    signature,
  }));
  
  return {
    privateKey: sessionPrivateKey,
    expiresAt: Date.now() + duration,
    policies,
  };
}
```

### 7. Add Native UI Components

You may need native UI for:

- **Login flow:** Passkey authentication UI
- **Transaction approval:** For transactions outside policies
- **Profile view:** User account management

Example structure:

```
src/
├── native/
│   ├── ios/
│   │   └── CartridgeAuthViewController.swift
│   └── android/
│       └── CartridgeAuthActivity.kt
```

### 8. Test Integration

Create a test flow:

```typescript
// Test file: src/__tests__/cartridge.test.ts

describe('Cartridge Integration', () => {
  it('should initialize controller', async () => {
    const controller = getCartridgeController();
    await controller.initialize();
    expect(controller).toBeDefined();
  });

  it('should login with passkey', async () => {
    const controller = getCartridgeController();
    const account = await controller.login();
    expect(account.address).toMatch(/^0x[a-fA-F0-9]+$/);
  });

  it('should execute transaction', async () => {
    const controller = getCartridgeController();
    await controller.login();
    
    const result = await controller.execute([
      {
        contractAddress: '0x...',
        entrypoint: 'test_method',
        calldata: [],
      },
    ]);
    
    expect(result.transaction_hash).toBeDefined();
  });

  it('should restore session', async () => {
    const controller = getCartridgeController();
    await controller.login();
    
    // Create new instance
    const controller2 = new CartridgeController();
    await controller2.initialize();
    
    expect(controller2.isConnected()).toBe(true);
  });
});
```

## Configuration

### Environment Variables

Add Cartridge-specific configuration:

```bash
# .env
EXPO_PUBLIC_CARTRIDGE_APP_ID=your-app-id
EXPO_PUBLIC_CARTRIDGE_RPC_URL=https://api.cartridge.gg/x/starknet/mainnet
EXPO_PUBLIC_CHAIN_ID=SN_MAIN

# Game contract addresses for policies
EXPO_PUBLIC_GAME_ADDRESS=0x...
EXPO_PUBLIC_DUNGEON_ADDRESS=0x...
```

### App Configuration

In `app.json`, add required permissions:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSFaceIDUsageDescription": "Use Face ID to securely sign in to your account",
        "NSBiometricUsageDescription": "Use biometric authentication for secure login"
      }
    },
    "android": {
      "permissions": [
        "USE_BIOMETRIC",
        "USE_FINGERPRINT"
      ]
    }
  }
}
```

## Security Considerations

### 1. Secure Key Storage

- ✅ Use Expo SecureStore for all keys
- ✅ Never log private keys or session keys
- ✅ Clear keys on logout
- ✅ Validate key integrity on restore

### 2. Session Management

- ✅ Set reasonable expiration times (24 hours recommended)
- ✅ Refresh sessions before expiry
- ✅ Invalidate on logout
- ✅ Handle expired sessions gracefully

### 3. Transaction Policies

- ✅ Define minimal necessary policies
- ✅ Require approval for high-value transactions
- ✅ Log all policy executions
- ✅ Allow users to review policies

### 4. Biometric Authentication

- ✅ Use device biometrics when available
- ✅ Fall back to passkey if biometrics unavailable
- ✅ Handle authentication failures gracefully
- ✅ Limit retry attempts

## Troubleshooting

### Common Issues

**1. Native module not found**

```
Error: Native module 'CartridgeController' not found
```

Solution:
- Ensure native modules are properly linked
- Run `npx expo prebuild` to regenerate native projects
- Check iOS/Android configuration

**2. Passkey authentication fails**

```
Error: Passkey authentication failed
```

Solution:
- Check device supports passkeys (iOS 16+, Android 9+)
- Verify app permissions are granted
- Test on physical device (simulators may have limitations)

**3. Session restore fails**

```
Error: Failed to restore session
```

Solution:
- Check session hasn't expired
- Verify SecureStore is accessible
- Clear and re-login if corrupted

**4. Transaction fails with policy error**

```
Error: Transaction not allowed by policy
```

Solution:
- Verify transaction matches defined policies
- Check contract address is correct
- Ensure session key has required permissions

## Resources

- **Cartridge Documentation:** https://docs.cartridge.gg/
- **Cartridge GitHub:** https://github.com/cartridge-gg/controller.c
- **React Native Example:** https://github.com/cartridge-gg/controller.c/tree/main/examples/react-native
- **Starknet.js Docs:** https://www.starknetjs.com/
- **Expo SecureStore:** https://docs.expo.dev/versions/latest/sdk/securestore/

## Next Steps

1. Review Cartridge's React Native example
2. Contact Cartridge team for SDK access
3. Implement native modules
4. Test passkey authentication flow
5. Define game-specific policies
6. Test on physical devices
7. Submit for review

## Support

For Cartridge-specific issues:
- Discord: https://discord.gg/cartridge
- Email: support@cartridge.gg
- GitHub Issues: https://github.com/cartridge-gg/controller.c/issues
