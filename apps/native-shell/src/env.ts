export function getNativeWebUrl(): string {
  const url = process.env.EXPO_PUBLIC_NATIVE_WEB_URL;
  if (!url) {
    throw new Error(
      "Missing EXPO_PUBLIC_NATIVE_WEB_URL. Set it in your shell env before starting Expo."
    );
  }
  return url;
}

export function getWebOrigin(webUrl: string): string {
  try {
    return new URL(webUrl).origin;
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_NATIVE_WEB_URL: ${webUrl}`);
  }
}

