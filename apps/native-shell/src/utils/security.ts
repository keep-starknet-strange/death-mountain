import Constants from 'expo-constants';

/**
 * Security utilities for bridge communication
 */

const ALLOWED_ORIGINS = (
  Constants.expoConfig?.extra?.allowedOrigins ||
  process.env.EXPO_PUBLIC_ALLOWED_ORIGINS ||
  ''
)
  .split(',')
  .map((origin: string) => origin.trim())
  .filter(Boolean);

const ALLOWED_METHODS = [
  'echo',
  'controller.login',
  'controller.logout',
  'controller.getAddress',
  'controller.getUsername',
  'controller.openProfile',
  'starknet.execute',
  'starknet.waitForTransaction',
];

/**
 * Validates if an origin is allowed to communicate with the bridge
 */
export function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  
  // Allow localhost and file:// for development
  if (__DEV__) {
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin === 'file://'
    ) {
      return true;
    }
  }
  
  return ALLOWED_ORIGINS.some((allowed: string) => {
    if (allowed === '*') return true;
    return origin === allowed || origin.startsWith(allowed);
  });
}

/**
 * Validates if a method is allowed to be called
 */
export function isMethodAllowed(method: string): boolean {
  return ALLOWED_METHODS.includes(method);
}

/**
 * Generates a secure random request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validates a bridge request structure
 */
export function validateBridgeRequest(request: any): boolean {
  if (!request || typeof request !== 'object') return false;
  if (typeof request.id !== 'string') return false;
  if (typeof request.method !== 'string') return false;
  if (typeof request.timestamp !== 'number') return false;
  
  // Check if timestamp is within reasonable range (5 minutes)
  const now = Date.now();
  if (Math.abs(now - request.timestamp) > 5 * 60 * 1000) return false;
  
  return true;
}
