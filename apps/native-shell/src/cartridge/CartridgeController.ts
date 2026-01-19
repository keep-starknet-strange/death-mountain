/**
 * Cartridge Controller Integration
 * 
 * This module integrates Cartridge's native Controller for React Native.
 * Based on: https://github.com/cartridge-gg/controller.c/tree/main/examples/react-native
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { CartridgeAccount, CartridgeSession } from '@/types/cartridge';

const SESSION_KEY = 'cartridge_session';
const ACCOUNT_KEY = 'cartridge_account';

type StarknetCall = any;

export class CartridgeController {
  private rpcUrl: string;
  private provider: any | null = null;
  private account: any | null = null;
  private session: CartridgeSession | null = null;
  private chainId: string;

  constructor() {
    this.rpcUrl = Constants.expoConfig?.extra?.cartridgeRpcUrl || 
                   process.env.EXPO_PUBLIC_CARTRIDGE_RPC_URL || 
                   'https://api.cartridge.gg/x/starknet/mainnet';
    
    this.chainId = Constants.expoConfig?.extra?.chainId || 
                   process.env.EXPO_PUBLIC_CHAIN_ID || 
                   'SN_MAIN';
  }

  private async getProvider(): Promise<any> {
    if (this.provider) return this.provider;
    const starknet: any = await import('starknet');
    const RpcProvider = starknet.RpcProvider as any;
    this.provider = new RpcProvider({ nodeUrl: this.rpcUrl });
    return this.provider;
  }

  /**
   * Initialize the controller and restore session if available
   */
  async initialize(): Promise<void> {
    try {
      const sessionData = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionData) {
        this.session = JSON.parse(sessionData);
        
        // Check if session is still valid
        if (this.session && this.session.expiresAt > Date.now()) {
          const accountData = await SecureStore.getItemAsync(ACCOUNT_KEY);
          if (accountData) {
            // NOTE: We lazy-load starknet so app startup can't crash due to missing RN polyfills.
            // If the import fails, we keep the session metadata but skip restoring an Account.
            try {
              const starknet: any = await import('starknet');
              const Account = starknet.Account as any;
              const { address, privateKey } = JSON.parse(accountData);
              const provider = await this.getProvider();
              this.account = new Account(provider, address, privateKey);
            } catch (error) {
              console.error('Failed to restore Starknet account (will require re-login):', error);
              this.account = null;
            }
          }
        } else {
          // Session expired, clear it
          await this.clearSession();
        }
      }
    } catch (error) {
      console.error('Failed to initialize CartridgeController:', error);
    }
  }

  /**
   * Login with Cartridge Controller
   * 
   * Note: In a real implementation, this would use Cartridge's native SDK
   * to handle passkey authentication. For now, this is a placeholder that
   * demonstrates the interface.
   */
  async login(): Promise<CartridgeAccount> {
    try {
      // TODO: Integrate actual Cartridge native SDK login flow
      // This would typically involve:
      // 1. Calling Cartridge's native module for passkey authentication
      // 2. Creating a session key
      // 3. Storing the session securely
      
      // For now, we'll throw an error indicating this needs implementation
      throw new Error(
        'Cartridge native SDK integration required. ' +
        'Please implement using @cartridge/controller native modules.'
      );
      
      // Example of what the implementation would look like:
      /*
      const { account, sessionKey, expiresAt } = await CartridgeNative.login({
        chainId: this.chainId,
        policies: [...], // Define your policies here
      });
      
      this.account = new Account(this.provider, account.address, sessionKey);
      this.session = {
        account: {
          address: account.address,
          username: account.username,
        },
        expiresAt,
      };
      
      await this.saveSession();
      return this.session.account;
      */
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    await this.clearSession();
    this.account = null;
    this.session = null;
  }

  /**
   * Get the current account address
   */
  getAddress(): string | null {
    return this.session?.account.address || null;
  }

  /**
   * Get the current username
   */
  getUsername(): string | null {
    return this.session?.account.username || null;
  }

  /**
   * Check if user is connected
   */
  isConnected(): boolean {
    return this.account !== null && this.session !== null;
  }

  /**
   * Execute transaction calls
   */
  async execute(calls: StarknetCall[]): Promise<{ transaction_hash: string }> {
    if (!this.account) {
      throw new Error('Not connected. Please login first.');
    }

    try {
      const result = await this.account.execute(calls);
      return { transaction_hash: result.transaction_hash };
    } catch (error) {
      console.error('Execute failed:', error);
      throw error;
    }
  }

  /**
   * Wait for a transaction to be confirmed
   */
  async waitForTransaction(
    transactionHash: string,
    options?: { retryInterval?: number }
  ): Promise<any> {
    if (!this.account) {
      throw new Error('Not connected. Please login first.');
    }

    try {
      const receipt = await this.account.waitForTransaction(transactionHash, {
        retryInterval: options?.retryInterval || 350,
        successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
      });
      return receipt;
    } catch (error) {
      console.error('Wait for transaction failed:', error);
      throw error;
    }
  }

  /**
   * Open Cartridge profile (if supported by native SDK)
   */
  async openProfile(): Promise<void> {
    // TODO: Implement with Cartridge native SDK
    console.log('openProfile called - requires Cartridge native SDK implementation');
  }

  /**
   * Save session to secure storage
   */
  private async saveSession(): Promise<void> {
    if (!this.session || !this.account) return;

    try {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(this.session));
      // Note: In production, you'd store the session key, not the private key
      // This is a simplified example
      await SecureStore.setItemAsync(
        ACCOUNT_KEY,
        JSON.stringify({
          address: this.account.address,
          // Store session key securely
        })
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Clear session from secure storage
   */
  private async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(ACCOUNT_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }
}

// Singleton instance
let controllerInstance: CartridgeController | null = null;

export function getCartridgeController(): CartridgeController {
  if (!controllerInstance) {
    controllerInstance = new CartridgeController();
  }
  return controllerInstance;
}
