/**
 * Cartridge Controller Types
 */

export interface CartridgeAccount {
  address: string;
  username?: string;
}

export interface CartridgeSession {
  account: CartridgeAccount;
  expiresAt: number;
}

export interface CartridgeConfig {
  rpcUrl: string;
  chainId: string;
}
