/**
 * Web Adapter for Cartridge Controller
 * 
 * This adapter uses @cartridge/controller directly for web environments,
 * replacing the ControllerConnector approach.
 */

import Controller from "@cartridge/controller";
import { Account, RpcProvider } from "starknet";
import {
  ICartridgeController,
  CartridgeControllerConfig,
} from "./cartridgeAdapter";

export class CartridgeWebAdapter implements ICartridgeController {
  private controller: Controller | null = null;
  private account: Account | null = null;
  private username: string | null = null;
  private config: CartridgeControllerConfig;
  private provider: RpcProvider;

  constructor(config: CartridgeControllerConfig) {
    this.config = config;
    this.provider = new RpcProvider({
      nodeUrl: config.chains[0].rpcUrl,
    });

    // Convert policies array to Controller format if needed
    // Controller expects policies as an object with contracts, but ControllerConnector
    // accepts an array format. We'll pass it as-is and let Controller handle it,
    // or convert if needed based on actual Controller API
    const controllerPolicies = config.policies
      ? this.convertPolicies(config.policies)
      : undefined;

    // Initialize Controller
    this.controller = new Controller({
      policies: controllerPolicies,
      namespace: config.namespace,
      slot: config.slot,
      preset: config.preset,
      chains: config.chains,
      defaultChainId: config.defaultChainId,
      tokens: config.tokens,
    });
  }

  /**
   * Convert policies array format to Controller's SessionPolicies format
   * Controller expects: { contracts: { [address]: { name?, description?, methods: [...] } } }
   */
  private convertPolicies(
    policies: Array<{ target: string; method: string }>
  ): { contracts: Record<string, { methods: Array<{ name: string; entrypoint: string }> }> } {
    const contracts: Record<string, { methods: Array<{ name: string; entrypoint: string }> }> = {};

    for (const policy of policies) {
      if (!contracts[policy.target]) {
        contracts[policy.target] = { methods: [] };
      }
      contracts[policy.target].methods.push({
        name: policy.method,
        entrypoint: policy.method,
      });
    }

    return { contracts };
  }

  async initialize(): Promise<void> {
    // Controller may auto-connect if session exists
    // Try to restore session by checking if controller has a current account
    try {
      if (this.controller) {
        // Check if controller has a way to get current account without connecting
        // Some controllers expose a getAccount() or account() method
        if (typeof (this.controller as any).account === 'function') {
          try {
            const existingAccount = await (this.controller as any).account();
            if (existingAccount) {
              this.account = existingAccount;
              // Try to get username
              if (typeof (this.controller as any).username === 'function') {
                this.username = await (this.controller as any).username() || null;
              }
            }
          } catch (error) {
            // No existing session, that's fine
            console.debug("No existing session to restore:", error);
          }
        }
        // If no account method, we'll rely on connect() to restore session when called
      }
    } catch (error) {
      console.error("Failed to initialize Cartridge Controller:", error);
    }
  }

  async connect(): Promise<{ address: string; username?: string }> {
    if (!this.controller) {
      throw new Error("Controller not initialized");
    }

    try {
      // Connect using Cartridge Controller
      const account = await this.controller.connect();
      this.account = account;
      this.username = null; // Username will be fetched separately if needed

      // Try to get username from controller if available
      // Controller has a username() method that returns the username
      try {
        if (this.controller && typeof (this.controller as any).username === 'function') {
          this.username = await (this.controller as any).username();
        }
      } catch (error) {
        // Username fetching is optional - controller may not have username yet
        console.warn("Could not fetch username:", error);
      }

      return {
        address: account.address,
        username: this.username || undefined,
      };
    } catch (error) {
      console.error("Failed to connect to Cartridge Controller:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.controller) {
      return;
    }

    try {
      // Disconnect from controller
      if ((this.controller as any).disconnect) {
        await (this.controller as any).disconnect();
      }
      this.account = null;
      this.username = null;
    } catch (error) {
      console.error("Failed to disconnect from Cartridge Controller:", error);
      throw error;
    }
  }

  getAccount(): Account | null {
    return this.account;
  }

  getAddress(): string | null {
    return this.account?.address || null;
  }

  getUsername(): string | null {
    return this.username;
  }

  isConnected(): boolean {
    return this.account !== null;
  }

  async execute(calls: any[]): Promise<{ transaction_hash: string }> {
    if (!this.account) {
      throw new Error("Not connected. Please connect first.");
    }

    try {
      const result = await this.account.execute(calls);
      return { transaction_hash: result.transaction_hash };
    } catch (error) {
      console.error("Execute failed:", error);
      throw error;
    }
  }

  async waitForTransaction(
    transactionHash: string,
    options?: { retryInterval?: number }
  ): Promise<any> {
    if (!this.account) {
      throw new Error("Not connected. Please connect first.");
    }

    try {
      const receipt = await this.account.waitForTransaction(transactionHash, {
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
    if (!this.controller) {
      throw new Error("Controller not initialized");
    }

    try {
      // Open Cartridge profile - this may open a modal or redirect
      if ((this.controller as any).openProfile) {
        await (this.controller as any).openProfile();
      } else {
        console.warn("openProfile not available on controller");
      }
    } catch (error) {
      console.error("Failed to open profile:", error);
      throw error;
    }
  }

  async openStarterPack(packId: string): Promise<void> {
    if (!this.controller) {
      throw new Error("Controller not initialized");
    }

    try {
      // Open Cartridge starter pack purchase
      if ((this.controller as any).openStarterPack) {
        await (this.controller as any).openStarterPack(packId);
      } else {
        console.warn("openStarterPack not available on controller");
      }
    } catch (error) {
      console.error("Failed to open starter pack:", error);
      throw error;
    }
  }

  /**
   * Get the underlying controller instance (for advanced usage)
   */
  getController(): Controller | null {
    return this.controller;
  }
}
