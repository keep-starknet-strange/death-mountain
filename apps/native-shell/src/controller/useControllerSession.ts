import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import Controller, {
  SessionAccount,
  type SessionAccountInterface,
  type Call,
  type SessionPolicy,
} from "../../modules/controller/src";

type LoginParams = {
  // Optional overrides; the web app can pass these if needed.
  rpcUrl?: string;
  cartridgeApiUrl?: string;
  keychainUrl?: string;
  maxFee?: string;
  policies?: Array<{
    contractAddress: string;
    entrypoint: string;
  }>;
};

type ExecuteParams = {
  calls: Call[];
};

type ControllerSession = {
  login: (params: LoginParams) => Promise<{ ok: true }>;
  logout: () => Promise<{ ok: true }>;
  getAddress: () => string | null;
  getUsername: () => string | null;
  openProfile: () => Promise<{ ok: true; url?: string }>;
  execute: (calls: ExecuteParams["calls"]) => Promise<{ transaction_hash: string }>;
  clearSessionStorage: () => Promise<void>;
  buildSessionUrl: (params: LoginParams) => string;
  triggerSubscription: () => Promise<boolean>;
};

const STORAGE_KEY = "death_mountain_session_private_key";

// Defaults (can be overridden by bridge params).
const DEFAULT_RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet";
const DEFAULT_CARTRIDGE_API_URL = "https://api.cartridge.gg";
const DEFAULT_KEYCHAIN_URL = "https://x.cartridge.gg";

function generateRandomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildSessionUrl(opts: {
  keychainUrl: string;
  publicKey: string;
  rpcUrl: string;
  policies: Array<{ target: string; method: string }>;
}): string {
  // Build URL parameters exactly as Cartridge expects
  const params = new URLSearchParams();
  params.append("public_key", opts.publicKey);
  params.append("rpc_url", opts.rpcUrl);
  
  // Only add policies if there are any
  if (opts.policies.length > 0) {
    params.append("policies", JSON.stringify(opts.policies));
  }
  
  const url = `${opts.keychainUrl}/session?${params.toString()}`;
  // eslint-disable-next-line no-console
  console.log("🔗 Built session URL:", url);
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:69',message:'Session URL built with policies',data:{url,hasPolicies:opts.policies.length>0,policiesCount:opts.policies.length,policiesSample:opts.policies.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
  // #endregion
  return url;
}

export function useControllerSession(): ControllerSession {
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [sessionAccount, setSessionAccount] = useState<SessionAccountInterface | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const inFlightLoginRef = useRef<Promise<void> | null>(null);
  const shouldSubscribeRef = useRef<boolean>(false);
  const subscribeParamsRef = useRef<{
    privateKey: string;
    sessionPolicies: any;
    rpcUrl: string;
    cartridgeApiUrl: string;
  } | null>(null);

  const publicKey = useMemo(() => {
    if (!privateKey) return null;
    return Controller.controller.getPublicKey(privateKey);
  }, [privateKey]);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored && stored.length > 10) {
        setPrivateKey(stored);
        return;
      }
      const next = generateRandomKey();
      await SecureStore.setItemAsync(STORAGE_KEY, next);
      setPrivateKey(next);
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Failed to init session key:", err);
    });
  }, []);

  const buildSessionUrlCallback = useCallback((params: LoginParams): string => {
    if (!privateKey || !publicKey) {
      throw new Error("Key not ready yet");
    }

    const rpcUrl = params.rpcUrl ?? DEFAULT_RPC_URL;
    const keychainUrl = params.keychainUrl ?? DEFAULT_KEYCHAIN_URL;

    const policies = (params.policies ?? []).map((p) => ({
      target: p.contractAddress,
      method: p.entrypoint,
    }));

    const url = buildSessionUrl({
      keychainUrl,
      publicKey,
      rpcUrl,
      policies,
    });

    return url;
  }, [privateKey, publicKey]);

  const login = useCallback(async (params: LoginParams) => {
    // Prevent concurrent login attempts
    if (inFlightLoginRef.current) {
      // eslint-disable-next-line no-console
      console.log("⏳ Login already in progress, waiting...");
      await inFlightLoginRef.current;
      return { ok: true as const };
    }

    if (!privateKey || !publicKey) {
      throw new Error("Key not ready yet");
    }

    // Mark login as in progress
    const loginPromise = Promise.resolve();
    inFlightLoginRef.current = loginPromise;

    const rpcUrl = params.rpcUrl ?? DEFAULT_RPC_URL;
    const cartridgeApiUrl = params.cartridgeApiUrl ?? DEFAULT_CARTRIDGE_API_URL;
    const keychainUrl = params.keychainUrl ?? DEFAULT_KEYCHAIN_URL;

    const policies = (params.policies ?? []).map((p) => ({
      target: p.contractAddress,
      method: p.entrypoint,
    }));

    // If the web app doesn't pass policies yet, we still let Controller create a session,
    // but it will likely be useless. Better to pass policies from the web app later.
    const nativePolicies: SessionPolicy[] = (params.policies ?? []).map((p) => ({
      contractAddress: p.contractAddress,
      entrypoint: p.entrypoint,
    }));

    const sessionPolicies = {
      policies: nativePolicies,
      maxFee: params.maxFee ?? "0x2386f26fc10000",
    };

    const url = buildSessionUrl({
      keychainUrl,
      publicKey,
      rpcUrl,
      policies,
    });

    // eslint-disable-next-line no-console
    console.log("🔐 Opening controller session URL:", url);
    // eslint-disable-next-line no-console
    console.log("📋 Session policies:", JSON.stringify(nativePolicies, null, 2));
    // eslint-disable-next-line no-console
    console.log("🌐 Keychain URL:", keychainUrl);
    // eslint-disable-next-line no-console
    console.log("🔑 Public key:", publicKey);

    // Validate URL before opening
    try {
      const testUrl = new URL(url);
      // eslint-disable-next-line no-console
      console.log("✅ URL is valid:", testUrl.toString());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("❌ Invalid URL:", err);
      throw new Error("Invalid session URL: " + err);
    }

    // Store subscription parameters for immediate use
    subscribeParamsRef.current = {
      privateKey,
      sessionPolicies,
      rpcUrl,
      cartridgeApiUrl,
    };
    shouldSubscribeRef.current = true;

    // Start subscription BEFORE opening browser - single attempt
    // createFromSubscribe will handle retries internally
    // eslint-disable-next-line no-console
    console.log("🚀 Starting session subscription (single attempt, before browser)...");
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:203',message:'Starting subscription before browser',data:{hasParams:!!subscribeParamsRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    
    // Start subscription immediately in background (non-blocking)
    // It will complete when the user finishes auth on Cartridge
    triggerSubscription().then(success => {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:212',message:'Subscription completed',data:{success,address:address||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      if (success) {
        console.log("✅ Session subscription completed successfully");
      } else {
        console.log("⚠️ Session subscription did not complete");
      }
      inFlightLoginRef.current = null;
    }).catch(error => {
      console.error("❌ Session subscription error:", error);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:220',message:'Subscription error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      inFlightLoginRef.current = null;
    });

    // Return immediately - subscription is running in background
    // Browser will open, and when subscription succeeds, it will auto-dismiss
    return { ok: true as const };
  }, [privateKey, publicKey]);

  const logout = useCallback(async () => {
    setSessionAccount(null);
    setUsername(null);
    setAddress(null);
    // Clear the stored private key to force fresh session on next login
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      // Generate a new key for next session
      const next = generateRandomKey();
      await SecureStore.setItemAsync(STORAGE_KEY, next);
      setPrivateKey(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to clear session key:", err);
    }
    return { ok: true as const };
  }, []);

  const getAddress = useCallback(() => address, [address]);
  const getUsername = useCallback(() => username, [username]);

  const openProfile = useCallback(async () => {
    // Native Controller profile UI is not yet exposed by Controller.c bindings.
    // We open the public profile site as a best-effort substitute.
    const url = "https://x.cartridge.gg/";
    // eslint-disable-next-line no-console
    console.log("🔗 Opening profile URL:", url);
    const result = await WebBrowser.openBrowserAsync(url, { 
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN 
    });
    // eslint-disable-next-line no-console
    console.log("📱 Profile browser result:", result);
    return { ok: true as const, url };
  }, []);

  /**
   * Trigger session subscription - single attempt
   * createFromSubscribe handles retries internally
   */
  const triggerSubscription = useCallback(async (): Promise<boolean> => {
    if (!shouldSubscribeRef.current || !subscribeParamsRef.current) {
      return false; // No pending subscription
    }

    const { privateKey, sessionPolicies, rpcUrl, cartridgeApiUrl } = subscribeParamsRef.current;
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:297',message:'Starting single-attempt subscription',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
    // #endregion

    try {
      // Single attempt - createFromSubscribe should handle retries internally
      // #region agent log
      const beforeSubscribe = Date.now();
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:303',message:'Calling createFromSubscribe',data:{timestamp:beforeSubscribe},timestamp:beforeSubscribe,sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      
      const session = SessionAccount.createFromSubscribe(
        privateKey,
        sessionPolicies,
        rpcUrl,
        cartridgeApiUrl
      );
      
      // #region agent log
      const afterSubscribe = Date.now();
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:312',message:'createFromSubscribe succeeded',data:{duration:afterSubscribe-beforeSubscribe,address:session.address(),username:session.username()},timestamp:afterSubscribe,sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      
      console.log("✅ Session subscription created successfully");
      
      const sessionAddress = session.address() || null;
      const sessionUsername = session.username() || null;
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:322',message:'Setting session state',data:{address:sessionAddress,username:sessionUsername},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      
      setSessionAccount(session);
      setUsername(sessionUsername);
      setAddress(sessionAddress);
      
      // Clear subscription flags
      shouldSubscribeRef.current = false;
      subscribeParamsRef.current = null;
      
      return true; // Success!
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useControllerSession.ts:336',message:'createFromSubscribe failed',data:{error:String(err).substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      
      console.error("❌ Failed to create session subscription:", err);
      shouldSubscribeRef.current = false;
      subscribeParamsRef.current = null;
      return false;
    }
    
    return false;
  }, []);

  const execute = useCallback(async (calls: Call[]) => {
    if (!sessionAccount) {
      throw new Error("Not logged in");
    }
    if (!Array.isArray(calls) || calls.length === 0) {
      throw new Error("Missing calls");
    }
    const txHash = sessionAccount.executeFromOutside(calls);
    return { transaction_hash: txHash };
  }, [sessionAccount]);

  const clearSessionStorage = useCallback(async () => {
    // Force clear all session data and regenerate key
    setSessionAccount(null);
    setUsername(null);
    setAddress(null);
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      const next = generateRandomKey();
      await SecureStore.setItemAsync(STORAGE_KEY, next);
      setPrivateKey(next);
      // eslint-disable-next-line no-console
      console.log("✅ Session storage cleared and regenerated");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to clear session storage:", err);
      throw err;
    }
  }, []);

  return {
    login,
    logout,
    getAddress,
    getUsername,
    openProfile,
    execute,
    clearSessionStorage,
    buildSessionUrl: buildSessionUrlCallback,
    triggerSubscription, // Expose for navigation handler
  };
}

