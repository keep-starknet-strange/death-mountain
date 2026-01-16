/// <reference types="vite/client" />

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __NATIVE_SHELL__?: { nonce: string; origin: string; platform?: string };
  }
}

export {};
