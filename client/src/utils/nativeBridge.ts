/**
 * Native Bridge Adapter for Web Client
 * 
 * This module provides a bridge interface for the web client to communicate
 * with the native shell when running inside the React Native WebView.
 * 
 * IMPORTANT: This only activates when window.ReactNativeWebView exists.
 * Browser behavior remains completely unchanged.
 */

interface NativeBridge {
  request: (method: string, params?: any) => Promise<any>;
}

declare global {
  interface Window {
    __NATIVE_SHELL__?: boolean;
    NativeBridge?: NativeBridge;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

/**
 * Check if we're running in the native shell
 */
export function isNativeShell(): boolean {
  return typeof window !== 'undefined' && 
         window.__NATIVE_SHELL__ === true &&
         typeof window.ReactNativeWebView !== 'undefined';
}

/**
 * Native Bridge Client
 * Provides methods to communicate with the native shell
 */
class NativeBridgeClient {
  /**
   * Call a bridge method
   */
  async call(method: string, params?: any): Promise<any> {
    if (!isNativeShell()) {
      throw new Error('Native bridge not available');
    }

    if (!window.NativeBridge) {
      throw new Error('Native bridge not initialized');
    }

    return window.NativeBridge.request(method, params);
  }

  /**
   * Controller methods
   */
  async login(): Promise<{ address: string; username?: string }> {
    return this.call('controller.login');
  }

  async logout(): Promise<{ success: boolean }> {
    return this.call('controller.logout');
  }

  async getAddress(): Promise<{ address: string | null }> {
    return this.call('controller.getAddress');
  }

  async getUsername(): Promise<{ username: string | null }> {
    return this.call('controller.getUsername');
  }

  async openProfile(): Promise<{ success: boolean }> {
    return this.call('controller.openProfile');
  }

  /**
   * Starknet methods
   */
  async execute(calls: any[]): Promise<{ transaction_hash: string }> {
    return this.call('starknet.execute', { calls });
  }

  async waitForTransaction(
    transactionHash: string,
    retryInterval?: number
  ): Promise<any> {
    return this.call('starknet.waitForTransaction', {
      transactionHash,
      retryInterval,
    });
  }

  /**
   * Test method
   */
  async echo(data: any): Promise<any> {
    return this.call('echo', data);
  }
}

// Singleton instance
let bridgeClient: NativeBridgeClient | null = null;

export function getNativeBridge(): NativeBridgeClient {
  if (!bridgeClient) {
    bridgeClient = new NativeBridgeClient();
  }
  return bridgeClient;
}

/**
 * Native Account Adapter
 * Wraps the native bridge to provide an account-like interface
 */
export class NativeAccountAdapter {
  private bridge = getNativeBridge();
  public address: string | null = null;

  constructor(address?: string) {
    this.address = address || null;
  }

  /**
   * Execute transaction calls
   */
  async execute(calls: any[]): Promise<{ transaction_hash: string }> {
    return this.bridge.execute(calls);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    transactionHash: string,
    options?: { retryInterval?: number; successStates?: string[] }
  ): Promise<any> {
    return this.bridge.waitForTransaction(
      transactionHash,
      options?.retryInterval
    );
  }
}
