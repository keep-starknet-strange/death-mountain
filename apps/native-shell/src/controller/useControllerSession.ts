import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import Controller, {
  SessionAccount,
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
  return url;
}

export function useControllerSession(): ControllerSession {
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [sessionAccount, setSessionAccount] = useState<SessionAccount | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const inFlightLoginRef = useRef<Promise<void> | null>(null);

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
    if (inFlightLoginRef.current) {
      await inFlightLoginRef.current;
      return { ok: true as const };
    }

    if (!privateKey || !publicKey) {
      throw new Error("Key not ready yet");
    }

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

    // Create the session in the background while the user authorizes.
    const doLogin = (async () => {
      // The WebView navigation is handled by the bridge handler
      // We just need to create the session subscription
      // eslint-disable-next-line no-console
      console.log("🔄 Creating session subscription...");
      // eslint-disable-next-line no-console
      console.log("📋 Session policies:", JSON.stringify(nativePolicies, null, 2));

      // eslint-disable-next-line no-console
      console.log("🔄 Creating session from subscribe...");
      // eslint-disable-next-line no-console
      console.log("  Private key:", privateKey?.substring(0, 10) + "...");
      // eslint-disable-next-line no-console
      console.log("  RPC URL:", rpcUrl);
      // eslint-disable-next-line no-console
      console.log("  Cartridge API URL:", cartridgeApiUrl);
      
      let session: SessionAccount;
      try {
        session = SessionAccount.createFromSubscribe(
          privateKey,
          sessionPolicies,
          rpcUrl,
          cartridgeApiUrl
        );
        // eslint-disable-next-line no-console
        console.log("✅ Session subscription created");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("❌ Failed to create session subscription:", err);
        throw err;
      }

      // eslint-disable-next-line no-console
      console.log("✅ Session account created:", session.address());
      // eslint-disable-next-line no-console
      console.log("👤 Username:", session.username());
      setSessionAccount(session);
      setUsername(session.username() || null);
      setAddress(session.address() || null);

      // The session subscription happens independently via WebSocket
      // Wait for the user to complete authentication in the WebView
      // eslint-disable-next-line no-console
      console.log("⏳ Waiting for session subscription via WebSocket...");
      // eslint-disable-next-line no-console
      console.log("💡 Complete authentication in the page, then it will redirect back");
      
      // Wait for the subscription to establish
      // The Cartridge page should redirect back after authentication
      await new Promise(resolve => setTimeout(resolve, 30000));
    })();

    inFlightLoginRef.current = doLogin;
    try {
      await doLogin;
    } finally {
      inFlightLoginRef.current = null;
    }

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
  };
}

