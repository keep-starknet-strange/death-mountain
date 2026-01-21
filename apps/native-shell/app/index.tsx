import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { StatusBar } from "expo-status-bar";
import { getNativeWebUrl, getWebOrigin } from "@/env";
import { createNonce } from "@/utils/nonce";
import { useControllerSession } from "@/controller/useControllerSession";
import { createRpcError, type RpcRequest, type RpcResponse } from "@/webRpc/rpc";

const ALLOWED_METHODS = new Set([
  "controller.login",
  "controller.logout",
  "controller.getAddress",
  "controller.getUsername",
  "controller.openProfile",
  "controller.clearCache",
  "controller.openInWebView",
  "starknet.execute",
  "starknet.waitForTransaction",
]);

export default function NativeShellScreen() {
  const [webError, setWebError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const targetUrlRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();

  let webUrl: string | null = null;
  let webOrigin: string | null = null;
  try {
    webUrl = getNativeWebUrl();
    webOrigin = getWebOrigin(webUrl);
    console.log("[NativeShell] Loading web URL:", webUrl);
    console.log("[NativeShell] Web origin:", webOrigin);
  } catch (e: any) {
    console.error("[NativeShell] Failed to get web URL:", e);
    setTimeout(() => setWebError(e?.message ?? String(e)), 0);
  }

  if (!webUrl || !webOrigin) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: "black", padding: 16, justifyContent: "center" }}
      >
        <StatusBar style="light" />
        <Text style={{ color: "white", fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
          Native Shell failed to start
        </Text>
        <Text style={{ color: "white", opacity: 0.85 }}>
          {webError ?? "Missing EXPO_PUBLIC_NATIVE_WEB_URL"}
        </Text>
      </SafeAreaView>
    );
  }
  const nonce = useMemo(() => createNonce(), []);
  const webviewRef = useRef<WebView>(null);

  const session = useControllerSession();
  
  useEffect(() => {
    console.log("[NativeShell] Component mounted");
    console.log("[NativeShell] webUrl:", webUrl);
    console.log("[NativeShell] webOrigin:", webOrigin);
    console.log("[NativeShell] WebView ref exists:", !!webviewRef.current);
  }, [webUrl, webOrigin]);

  const allowedOrigins = useMemo(() => {
    const set = new Set<string>();
    set.add(webOrigin);
    try {
      const u = new URL(webOrigin);
      if (u.hostname.startsWith("www.")) {
        set.add(`${u.protocol}//${u.hostname.slice(4)}`);
      } else {
        set.add(`${u.protocol}//www.${u.hostname}`);
      }
      
      // If it's localhost, allow all localhost ports
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        set.add("http://localhost:5173");
        set.add("http://localhost:5174");
        set.add("http://localhost:8081");
        set.add("http://127.0.0.1:5173");
        set.add("http://127.0.0.1:5174");
        set.add("http://127.0.0.1:8081");
      }
    } catch {
      // ignore
    }
    
    // Allow Cartridge authentication domains to load in the WebView
    set.add("https://x.cartridge.gg");
    set.add("https://www.x.cartridge.gg");
    set.add("http://x.cartridge.gg");
    set.add("http://www.x.cartridge.gg");
    set.add("https://cartridge.gg");
    set.add("https://www.cartridge.gg");
    set.add("https://api.cartridge.gg");
    
    // Allow Stripe (used by Cartridge for payments)
    set.add("https://js.stripe.com");
    set.add("https://m.stripe.com");
    set.add("https://checkout.stripe.com");
    
    return set;
  }, [webOrigin]);

  const allowedExternalOrigins = useMemo(() => {
    // Strict allowlist for pages we intentionally open outside the WebView.
    // NOTE: x.cartridge.gg is NOT in this list so authentication happens in the main WebView
    const set = new Set<string>([
      // Empty for now - let all navigation happen in the WebView
      // Can add specific domains here if needed
    ]);
    return set;
  }, []);

  const injectedBeforeLoad = useMemo(() => {
    // Keep this as a single expression; WebView expects it to be valid JS.
    return `
      (function () {
        try {
          window.__NATIVE_SHELL__ = Object.freeze({
            nonce: ${JSON.stringify(nonce)},
            origin: ${JSON.stringify(webOrigin)},
            platform: ${JSON.stringify(Platform.OS)},
          });
        } catch (e) {}
        true;
      })();
    `;
  }, [nonce, webOrigin]);

  const postToWeb = (message: RpcResponse) => {
    webviewRef.current?.postMessage(JSON.stringify(message));
  };

  const handleExternalNavigation = useCallback(async (url: string) => {
    // Open allowlisted external links in an in-app browser (not Safari app-switch).
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, []);

  const isAllowedNavigation = useCallback(
    (url: string) => {
      // For development: Allow ALL navigation
      console.log("[WebView] Allowing navigation:", url);
      return true;
    },
    []
  );

  const handleMessage = async (event: WebViewMessageEvent) => {
    let req: RpcRequest | null = null;
    let message: any = null;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      // Check if it's an RPC request
      if (data.jsonrpc === "2.0" && typeof data.id === "string") {
        req = data as RpcRequest;
      } else {
        return;
      }
    } catch {
      return;
    }


    if (!req || req.jsonrpc !== "2.0" || typeof req.id !== "string") {
      return;
    }

    if (typeof req.method !== "string" || !ALLOWED_METHODS.has(req.method)) {
      postToWeb({
        jsonrpc: "2.0",
        id: req.id,
        error: createRpcError(-32601, "Method not found"),
      });
      return;
    }

    // Bridge hardening: require per-session nonce + expected origin.
    const reqNonce = (req.params as any)?.nonce;
    const reqOrigin = (req.params as any)?.origin;
    if (reqNonce !== nonce || reqOrigin !== webOrigin) {
      postToWeb({
        jsonrpc: "2.0",
        id: req.id,
        error: createRpcError(-32000, "Unauthorized"),
      });
      return;
    }

    try {
      switch (req.method) {
        case "controller.login": {
          // Get the session URL from the session hook
          const loginParams = (req.params as any) ?? {};
          console.log("[NativeShell] ✅ controller.login called");
          console.log("[NativeShell] Login params:", JSON.stringify(loginParams));
          
          try {
            // Save the current URL to return to after authentication
            const savedReturnUrl = currentUrl || webUrl;
            setReturnUrl(savedReturnUrl);
            
            // Build session URL
            const sessionUrl = session.buildSessionUrl(loginParams);
            console.log("[NativeShell] 🔗 Built session URL:", sessionUrl);
            console.log("[NativeShell] Will return to:", savedReturnUrl);
            
            // Step 1: Start subscription BEFORE opening browser (single attempt)
            console.log("[NativeShell] 🚀 Starting session subscription (before browser)...");
            session.login(loginParams).then(result => {
              console.log("[NativeShell] ✅ Session subscription started:", result);
            }).catch(err => {
              console.error("[NativeShell] ❌ Session login failed:", err);
              postToWeb({ 
                jsonrpc: "2.0", 
                id: req.id, 
                error: createRpcError(-32001, err?.message ?? "Login failed") 
              });
              return;
            });
            
            // Step 2: Navigate to Cartridge auth page
            console.log("[NativeShell] 📱 Navigating WebView to Cartridge auth page...");
            setTargetUrl(sessionUrl);
            targetUrlRef.current = sessionUrl;
            setWebViewKey(prev => prev + 1);
            
            // Step 3: Simple polling - auto-dismiss when session is ready
            console.log("[NativeShell] 🔍 Polling for session readiness (auto-dismiss on success)...");
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:293',message:'Polling started',data:{savedReturnUrl,targetUrl:sessionUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            let checkCount = 0;
            const maxChecks = 60; // Check for up to 60 seconds
            const pollInterval = setInterval(() => {
              checkCount++;
              const address = session.getAddress();
              
              // #region agent log
              fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:302',message:'Poll check',data:{checkCount,maxChecks,address:address||null,hasAddress:!!address},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
              // #endregion
              
              if (address) {
                // Session ready - auto-dismiss
                console.log("[NativeShell] ✅ Session ready, auto-dismissing:", address);
                // #region agent log
                fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:310',message:'Auto-dismissing on success',data:{address,checkCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
                // #endregion
                
                clearInterval(pollInterval);
                
                // Navigate back
                setTargetUrl(null);
                setReturnUrl(null);
                targetUrlRef.current = null;
                setWebViewKey(prev => prev + 1);
                
                // Trigger account refresh
                setTimeout(() => {
                  webviewRef.current?.injectJavaScript(`
                    window.dispatchEvent(new Event('focus'));
                    window.dispatchEvent(new Event('visibilitychange'));
                    window.dispatchEvent(new CustomEvent('nativeShellAccountReady'));
                    true;
                  `);
                }, 300);
                
                postToWeb({ jsonrpc: "2.0", id: req.id, result: { ok: true } });
              } else if (checkCount >= maxChecks) {
                console.log("[NativeShell] ⏰ Max checks reached");
                clearInterval(pollInterval);
                postToWeb({ jsonrpc: "2.0", id: req.id, result: { ok: true } });
              }
            }, 1000);
            
          } catch (error) {
            console.error("[NativeShell] ❌ Error in login handler:", error);
            postToWeb({ 
              jsonrpc: "2.0", 
              id: req.id, 
              error: createRpcError(-32001, String(error)) 
            });
          }
          
          // Return immediately so the bridge doesn't block
          return;
        }
        case "controller.logout": {
          const result = await session.logout();
          postToWeb({ jsonrpc: "2.0", id: req.id, result });
          return;
        }
        case "controller.getAddress": {
          postToWeb({ jsonrpc: "2.0", id: req.id, result: session.getAddress() });
          return;
        }
        case "controller.getUsername": {
          postToWeb({ jsonrpc: "2.0", id: req.id, result: session.getUsername() });
          return;
        }
        case "controller.openProfile": {
          const result = await session.openProfile();
          postToWeb({ jsonrpc: "2.0", id: req.id, result });
          return;
        }
        case "controller.clearCache": {
          await session.clearSessionStorage();
          postToWeb({ jsonrpc: "2.0", id: req.id, result: { ok: true } });
          return;
        }
        case "controller.openInWebView": {
          const url = (req.params as any)?.url;
          if (!url) {
            postToWeb({ jsonrpc: "2.0", id: req.id, error: createRpcError(-32602, "Missing url parameter") });
            return;
          }
          // Navigate the main WebView to the URL
          console.log("[NativeShell] Opening URL in main WebView:", url);
          webviewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(url)}; true;`
          );
          postToWeb({ jsonrpc: "2.0", id: req.id, result: { ok: true } });
          return;
        }
        case "starknet.execute": {
          const calls = (req.params as any)?.calls;
          const result = await session.execute(calls);
          postToWeb({ jsonrpc: "2.0", id: req.id, result });
          return;
        }
        case "starknet.waitForTransaction": {
          // Optional. For now we return a stub so the web app can handle its own polling.
          postToWeb({
            jsonrpc: "2.0",
            id: req.id,
            result: { status: "unsupported_in_shell" },
          });
          return;
        }
      }
    } catch (err: any) {
      postToWeb({
        jsonrpc: "2.0",
        id: req.id,
        error: createRpcError(-32001, err?.message ?? "Native error"),
      });
    }
  };

  // Use targetUrl if set (for navigation), otherwise use webUrl
  const activeUrl = targetUrl || webUrl;
  console.log("[NativeShell] Rendering WebView with URL:", activeUrl);
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:399',message:'WebView activeUrl computed',data:{activeUrl,targetUrl,webUrl,returnUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "black" }}>
      <StatusBar style="light" />
      <WebView
        key={webViewKey}
        ref={webviewRef}
        source={{ uri: activeUrl }}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "black" }}>
            <Text style={{ color: "white" }}>Loading...</Text>
          </View>
        )}
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
        // We'll enforce allowlisted origins ourselves in `onShouldStartLoadWithRequest`.
        // Allow both HTTP and HTTPS (localhost uses HTTP)
        originWhitelist={["http://*", "https://*"]}
        // Cache management: disable cache to prevent stale controller page data
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        onLoadStart={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log("[WebView] Load started:", nativeEvent.url);
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:348',message:'WebView load started',data:{url:nativeEvent.url,targetUrl,returnUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
          // #endregion
          setWebError(null);
        }}
        onLoad={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log("[WebView] Load complete:", nativeEvent.url);
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:424',message:'WebView load complete',data:{url:nativeEvent.url,targetUrl,returnUrl,isCartridgeUrl:nativeEvent.url.includes('cartridge.gg')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'O'})}).catch(()=>{});
          // #endregion
          setWebError(null);
        }}
        onLoadEnd={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log("[WebView] Load ended:", nativeEvent.url, "Loading:", nativeEvent.loading);
        }}
        onShouldStartLoadWithRequest={(req) => {
          console.log("[WebView] onShouldStartLoadWithRequest:", req.url);
          
          // For development: Allow ALL navigation in the WebView
          // Don't open anything externally
          const ok = isAllowedNavigation(req.url);
          console.log("[WebView] Navigation allowed:", ok);
          return ok;
        }}
        onNavigationStateChange={(nav) => {
          // Simply track the current URL for reference
          // Navigation back to game is handled by polling in the login handler
          const newUrl = nav.url;
          setCurrentUrl(newUrl);
          console.log("[NativeShell] 🔍 Navigation changed:", newUrl);
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:425',message:'Navigation state changed',data:{newUrl,loading:nav.loading,canGoBack:nav.canGoBack,targetUrl,returnUrl,activeUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
        }}
        onOpenWindow={(e) => {
          // iOS: target=_blank / window.open often ends up here. Force it into the same WebView.
          const targetUrl = (e as any)?.nativeEvent?.targetUrl as string | undefined;
          if (!targetUrl) return;
          try {
            const nextOrigin = new URL(targetUrl).origin;
            if (allowedExternalOrigins.has(nextOrigin)) {
              handleExternalNavigation(targetUrl).catch((err: any) => {
                setWebError(err?.message ?? `Failed opening: ${targetUrl}`);
              });
              return;
            }
          } catch {
            // ignore
          }

          if (!isAllowedNavigation(targetUrl)) {
            setWebError(`Blocked popup to: ${targetUrl}`);
            return;
          }

          setWebError(null);
          webviewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(targetUrl)}; true;`
          );
        }}
        onError={(e) => {
          console.log("[WebView] Error:", e.nativeEvent.description);
          setWebError(e.nativeEvent.description || "WebView error");
        }}
        onHttpError={(e) => {
          console.log("[WebView] HTTP Error:", e.nativeEvent.statusCode, e.nativeEvent.url);
          setWebError(`HTTP ${e.nativeEvent.statusCode} loading ${e.nativeEvent.url}`);
        }}
        {...({ onConsoleMessage: (event: { nativeEvent: { message: string } }) => {
          console.log("[WebView Console]", event.nativeEvent.message);
        } } as any)}
        javaScriptEnabled
        domStorageEnabled
        // Workers need a real origin; we intentionally load HTTPS, not file://.
        // (If you ever switch to offline bundling, serve via a local HTTP server.)
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
      />

      {/* Minimal debug overlay (helps when the screen looks “blank”) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: Math.max(10, insets.bottom + 6),
          backgroundColor: "rgba(0,0,0,0.6)",
          padding: 8,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: "white", fontSize: 12 }} numberOfLines={1}>
          URL: {currentUrl ?? activeUrl}
        </Text>
        {!!webError && (
          <Text style={{ color: "white", fontSize: 12, opacity: 0.9 }} numberOfLines={2}>
            WebView: {webError}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

