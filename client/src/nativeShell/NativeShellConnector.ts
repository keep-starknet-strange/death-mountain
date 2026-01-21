import { isNativeShell } from "@/nativeShell/isNativeShell";
import { nativeShellRpcRequest } from "@/nativeShell/rpc";
import { RpcProvider } from "starknet";

type StarknetCall = {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
};

function createBridgedAccount(address: string, rpcUrl?: string) {
  const provider = rpcUrl ? new RpcProvider({ nodeUrl: rpcUrl }) : undefined;
  return {
    address,
    // starknet.js returns { transaction_hash, ... } for Account.execute()
    execute: async (calls: StarknetCall[]) => {
      return await nativeShellRpcRequest<{ transaction_hash: string }>(
        "starknet.execute",
        { calls }
      );
    },
    // Used by `client/src/dojo/useSystemCalls.ts` for receipt polling
    waitForTransaction: async (txHash: string, opts?: any) => {
      if (!provider) {
        throw new Error("Native shell connector missing rpcUrl for waitForTransaction");
      }
      return await provider.waitForTransaction(txHash, opts);
    },
  };
}

/**
 * Minimal Starknet React connector that delegates login + signing to the native shell bridge.
 *
 * Important: This is ONLY constructed when `isNativeShell()` is true, so it cannot affect browsers.
 */
export class NativeShellConnector {
  public readonly id = "native-shell";
  public readonly name = "Native Shell";
  private readonly loginParams: Record<string, unknown>;
  private readonly rpcUrl?: string;

  constructor(opts?: {
    rpcUrl?: string;
    cartridgeApiUrl?: string;
    keychainUrl?: string;
    policies?: Array<{ target: string; method: string }>;
  }) {
    this.rpcUrl = opts?.rpcUrl;
    this.loginParams = {
      ...(opts?.rpcUrl ? { rpcUrl: opts.rpcUrl } : {}),
      ...(opts?.cartridgeApiUrl ? { cartridgeApiUrl: opts.cartridgeApiUrl } : {}),
      ...(opts?.keychainUrl ? { keychainUrl: opts.keychainUrl } : {}),
      ...(opts?.policies
        ? {
            policies: opts.policies.map((p) => ({
              contractAddress: p.target,
              entrypoint: p.method,
            })),
          }
        : {}),
    };
  }

  available() {
    return isNativeShell();
  }

  async connect(_opts?: any) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NativeShellConnector.ts:69',message:'NativeShellConnector.connect called',data:{loginParams:this.loginParams,hasPolicies:!!this.loginParams.policies,policiesCount:Array.isArray(this.loginParams.policies)?this.loginParams.policies.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    await nativeShellRpcRequest("controller.login", this.loginParams);
    const address = await nativeShellRpcRequest<string | null>("controller.getAddress", {});
    if (!address) throw new Error("Native shell login did not return an address");
    return { account: createBridgedAccount(address, this.rpcUrl) };
  }

  async disconnect() {
    await nativeShellRpcRequest("controller.logout", {});
  }

  async account() {
    const address = await nativeShellRpcRequest<string | null>("controller.getAddress", {});
    if (!address) return undefined;
    return createBridgedAccount(address, this.rpcUrl);
  }

  async chainId() {
    // The web app config already pins the chain; we don't expose a native chain switch in this stage.
    return undefined;
  }

  // Used by `client/src/contexts/controller.tsx`
  async username() {
    return await nativeShellRpcRequest<string | null>("controller.getUsername", {});
  }

  async openProfile() {
    return await nativeShellRpcRequest("controller.openProfile", {});
  }

  async clearCache() {
    return await nativeShellRpcRequest("controller.clearCache", {});
  }
}

