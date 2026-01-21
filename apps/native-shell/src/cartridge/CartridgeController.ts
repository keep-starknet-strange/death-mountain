/**
 * Native Adapter for Cartridge Controller
 * 
 * This adapter wraps the native controller.c implementation to match the unified
 * ICartridgeController interface. It uses the existing useControllerSession hook
 * which interfaces with the Rust-based controller.c module.
 */

import { Account, RpcProvider } from "starknet";
import { useControllerSession } from "@/controller/useControllerSession";

/**
 * Unified interface for Cartridge Controller operations
 * This matches the interface defined in client/src/utils/cartridgeAdapter.ts
 */
export interface ICartridgeController {
  initialize(): Promise<void>;
  connect(): Promise<{ address: string; username?: string }>;
  disconnect(): Promise<void>;
  getAccount(): Account | null;
  getAddress(): string | null;
  getUsername(): string | null;
  isConnected(): boolean;
  execute(calls: any[]): Promise<{ transaction_hash: string }>;
  waitForTransaction(transactionHash: string, options?: { retryInterval?: number }): Promise<any>;
  openProfile(): Promise<void>;
  openStarterPack(packId: string): Promise<void>;
}

export interface CartridgeControllerConfig {
  policies?: Array<{ target: string; method: string }>;
  namespace: string;
  slot: string;
  preset: string;
  chains: Array<{ rpcUrl: string }>;
  defaultChainId: string;
  tokens?: any;
}

/**
 * Native implementation of Cartridge Controller
 * 
 * This class adapts the native controller.c implementation (via useControllerSession)
 * to match the unified ICartridgeController interface.
 * 
 * Note: This is a factory function that returns a controller instance, since
 * React hooks can only be used in React components. The actual implementation
 * will need to be used within a React component context.
 */
export class CartridgeNativeAdapter implements ICartridgeController {
  private session: ReturnType<typeof useControllerSession>;
  private provider: RpcProvider | null = null;
  private account: Account | null = null;
  private config: CartridgeControllerConfig;

  constructor(
    config: CartridgeControllerConfig,
    session: ReturnType<typeof useControllerSession>
  ) {
    this.config = config;
    this.session = session;
    this.provider = new RpcProvider({
      nodeUrl: config.chains[0].rpcUrl,
    });
  }

  async initialize(): Promise<void> {
    // Check if already connected
    const address = this.session.getAddress();
    if (address) {
      // Create account adapter for existing session
      this.account = this.createAccountAdapter(address);
    }
  }

  async connect(): Promise<{ address: string; username?: string }> {
    try {
      // Convert config policies to login params format
      const policies = (this.config.policies || []).map((p) => ({
        contractAddress: p.target,
        entrypoint: p.method,
      }));

      await this.session.login({
        rpcUrl: this.config.chains[0].rpcUrl,
        policies,
      });

      const address = this.session.getAddress();
      if (!address) {
        throw new Error("Login did not return an address");
      }

      this.account = this.createAccountAdapter(address);
      const username = this.session.getUsername();

      return {
        address,
        username: username || undefined,
      };
    } catch (error) {
      console.error("Native login failed:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.session.logout();
      this.account = null;
    } catch (error) {
      console.error("Native logout failed:", error);
      throw error;
    }
  }

  getAccount(): Account | null {
    return this.account;
  }

  getAddress(): string | null {
    return this.session.getAddress();
  }

  getUsername(): string | null {
    return this.session.getUsername();
  }

  isConnected(): boolean {
    return this.session.getAddress() !== null;
  }

  async execute(calls: any[]): Promise<{ transaction_hash: string }> {
    if (!this.isConnected()) {
      throw new Error("Not connected. Please connect first.");
    }

    try {
      const result = await this.session.execute(calls);
      return result;
    } catch (error) {
      console.error("Execute failed:", error);
      throw error;
    }
  }

  async waitForTransaction(
    transactionHash: string,
    options?: { retryInterval?: number }
  ): Promise<any> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    try {
      const receipt = await this.provider.waitForTransaction(transactionHash, {
        retryInterval: options?.retryInterval || 350,
        successStates: ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
      });
      return receipt;
    } catch (error) {
      console.error("Wait for transaction failed:", error);
      throw error;
    }
  }

  async openProfile(): Promise<void> {
    try {
      await this.session.openProfile();
    } catch (error) {
      console.error("Failed to open profile:", error);
      throw error;
    }
  }

  async openStarterPack(packId: string): Promise<void> {
    // Build the starter pack URL
    const url = `https://x.cartridge.gg/starter-pack/${packId}`;
    
    // Note: This adapter is not currently used in the native shell.
    // The web client calls openBuyTicket which uses nativeShellRpcRequest
    // to call "controller.openInWebView" directly via the bridge.
    // If this adapter is used in the future, it would need a bridge callback
    // or the session would need to expose a method to open URLs.
    console.warn("openStarterPack called on native adapter - this should be called via bridge from web client");
    throw new Error(
      `openStarterPack not directly supported. Use bridge method "controller.openInWebView" with url: ${url}`
    );
  }

  /**
   * Create an account adapter that matches Starknet Account interface
   */
  private createAccountAdapter(address: string): Account {
    return {
      address,
      execute: async (calls: any[]) => {
        const result = await this.session.execute(calls);
        return { transaction_hash: result.transaction_hash } as any;
      },
      waitForTransaction: async (txHash: string, opts?: any) => {
        return this.waitForTransaction(txHash, opts);
      },
    } as Account;
  }
}

/**
 * Factory function to create a native adapter
 * This should be called from within a React component that has access to useControllerSession
 */
export function createCartridgeNativeAdapter(
  config: CartridgeControllerConfig
): (session: ReturnType<typeof useControllerSession>) => CartridgeNativeAdapter {
  return (session: ReturnType<typeof useControllerSession>) => {
    return new CartridgeNativeAdapter(config, session);
  };
}
