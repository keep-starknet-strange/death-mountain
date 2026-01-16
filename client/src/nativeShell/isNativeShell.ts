export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).ReactNativeWebView && (window as any).__NATIVE_SHELL__);
}

