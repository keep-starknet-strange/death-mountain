/**
 * Unified Cartridge Controller Adapter Interface
 * 
 * This provides a unified interface for Cartridge Controller across web and native environments.
 * Both implementations will use @cartridge/controller directly.
 */

import { Account } from "starknet";
import { NetworkConfig } from "./networkConfig";

/**
 * Unified interface for Cartridge Controller operations
 */
export interface ICartridgeController {
  /**
   * Initialize the controller and restore any existing session
   */
  initialize(): Promise<void>;

  /**
   * Connect/login with Cartridge Controller
   * Returns the account address and username
   */
  connect(): Promise<{ address: string; username?: string }>;

  /**
   * Disconnect/logout from Cartridge Controller
   */
  disconnect(): Promise<void>;

  /**
   * Get the current connected account
   */
  getAccount(): Account | null;

  /**
   * Get the current account address
   */
  getAddress(): string | null;

  /**
   * Get the current username
   */
  getUsername(): string | null;

  /**
   * Check if user is connected
   */
  isConnected(): boolean;

  /**
   * Execute transaction calls
   */
  execute(calls: any[]): Promise<{ transaction_hash: string }>;

  /**
   * Wait for a transaction to be confirmed
   */
  waitForTransaction(
    transactionHash: string,
    options?: { retryInterval?: number }
  ): Promise<any>;

  /**
   * Open Cartridge profile
   */
  openProfile(): Promise<void>;

  /**
   * Open Cartridge starter pack purchase
   */
  openStarterPack(packId: string): Promise<void>;
}

/**
 * Configuration for Cartridge Controller
 */
export interface CartridgeControllerConfig {
  policies?: Array<{
    target: string;
    method: string;
  }>;
  namespace: string;
  slot: string;
  preset: string;
  chains: Array<{
    rpcUrl: string;
  }>;
  defaultChainId: string;
  tokens?: any;
}

/**
 * Create Cartridge Controller configuration from network config
 */
export function createControllerConfig(
  networkConfig: NetworkConfig
): CartridgeControllerConfig {
  return {
    policies: networkConfig.policies,
    namespace: networkConfig.namespace,
    slot: networkConfig.slot,
    preset: networkConfig.preset,
    chains: networkConfig.chains,
    defaultChainId: networkConfig.chainId,
    tokens: networkConfig.tokens,
  };
}
