# Bridge Communication Specification

This document details the bridge protocol used for communication between the WebView (web client) and the native React Native app.

## Protocol Overview

The bridge uses a JSON-RPC 2.0-inspired protocol with request/response correlation via unique IDs.

## Message Flow

```
┌─────────┐                    ┌──────────┐                    ┌────────────┐
│ WebView │                    │  Bridge  │                    │ Controller │
└────┬────┘                    └────┬─────┘                    └─────┬──────┘
     │                              │                                │
     │  1. Request (with ID)        │                                │
     ├─────────────────────────────>│                                │
     │                              │                                │
     │                              │  2. Validate origin/method     │
     │                              ├───────────┐                    │
     │                              │           │                    │
     │                              │<──────────┘                    │
     │                              │                                │
     │                              │  3. Execute method             │
     │                              ├───────────────────────────────>│
     │                              │                                │
     │                              │  4. Return result              │
     │                              │<───────────────────────────────┤
     │                              │                                │
     │  5. Response (matching ID)   │                                │
     │<─────────────────────────────┤                                │
     │                              │                                │
```

## Request Format

```typescript
interface BridgeRequest {
  id: string;           // Unique identifier (auto-generated)
  method: string;       // Method name (e.g., "controller.login")
  params?: any;         // Method-specific parameters
  timestamp: number;    // Unix timestamp in milliseconds
}
```

### Example Request

```json
{
  "id": "1704067200000-abc123",
  "method": "starknet.execute",
  "params": {
    "calls": [
      {
        "contractAddress": "0x1234...",
        "entrypoint": "transfer",
        "calldata": ["0x5678...", "100", "0"]
      }
    ]
  },
  "timestamp": 1704067200000
}
```

## Response Format

### Success Response

```typescript
interface BridgeSuccessResponse {
  id: string;           // Matching request ID
  result: any;          // Method-specific result
  timestamp: number;    // Unix timestamp in milliseconds
}
```

### Error Response

```typescript
interface BridgeErrorResponse {
  id: string;           // Matching request ID
  error: {
    code: number;       // Error code (see Error Codes section)
    message: string;    // Human-readable error message
    data?: any;         // Additional error data
  };
  timestamp: number;    // Unix timestamp in milliseconds
}
```

### Example Success Response

```json
{
  "id": "1704067200000-abc123",
  "result": {
    "transaction_hash": "0x9abc..."
  },
  "timestamp": 1704067201500
}
```

### Example Error Response

```json
{
  "id": "1704067200000-abc123",
  "error": {
    "code": -32001,
    "message": "Not connected. Please login first.",
    "data": null
  },
  "timestamp": 1704067201500
}
```

## Method Specifications

### 1. echo

**Purpose:** Test bridge communication

**Request:**
```typescript
{
  method: "echo",
  params: any
}
```

**Response:**
```typescript
{
  result: {
    echo: any  // Same as params
  }
}
```

**Example:**
```javascript
// Request
window.NativeBridge.request('echo', { test: 'hello' });

// Response
{ echo: { test: 'hello' } }
```

---

### 2. controller.login

**Purpose:** Authenticate user with Cartridge Controller

**Request:**
```typescript
{
  method: "controller.login",
  params: undefined
}
```

**Response:**
```typescript
{
  result: {
    address: string;      // Account address (0x...)
    username?: string;    // Username (if available)
  }
}
```

**Errors:**
- `-32002`: User rejected authentication
- `-32603`: Internal error during login

**Example:**
```javascript
const result = await window.NativeBridge.request('controller.login');
console.log('Logged in as:', result.address);
```

---

### 3. controller.logout

**Purpose:** Logout and clear session

**Request:**
```typescript
{
  method: "controller.logout",
  params: undefined
}
```

**Response:**
```typescript
{
  result: {
    success: boolean;
  }
}
```

**Example:**
```javascript
await window.NativeBridge.request('controller.logout');
```

---

### 4. controller.getAddress

**Purpose:** Get current account address

**Request:**
```typescript
{
  method: "controller.getAddress",
  params: undefined
}
```

**Response:**
```typescript
{
  result: {
    address: string | null;  // null if not logged in
  }
}
```

**Example:**
```javascript
const { address } = await window.NativeBridge.request('controller.getAddress');
```

---

### 5. controller.getUsername

**Purpose:** Get current username

**Request:**
```typescript
{
  method: "controller.getUsername",
  params: undefined
}
```

**Response:**
```typescript
{
  result: {
    username: string | null;  // null if not available
  }
}
```

**Example:**
```javascript
const { username } = await window.NativeBridge.request('controller.getUsername');
```

---

### 6. controller.openProfile

**Purpose:** Open Cartridge profile (if supported)

**Request:**
```typescript
{
  method: "controller.openProfile",
  params: undefined
}
```

**Response:**
```typescript
{
  result: {
    success: boolean;
  }
}
```

**Note:** This method may be stubbed if the native SDK doesn't support it.

---

### 7. starknet.execute

**Purpose:** Execute transaction calls

**Request:**
```typescript
{
  method: "starknet.execute",
  params: {
    calls: Array<{
      contractAddress: string;
      entrypoint: string;
      calldata: string[];
    }>;
  }
}
```

**Response:**
```typescript
{
  result: {
    transaction_hash: string;
  }
}
```

**Errors:**
- `-32001`: Not connected (login required)
- `-32002`: User rejected transaction
- `-32003`: Transaction failed
- `-32602`: Invalid call structure

**Example:**
```javascript
const result = await window.NativeBridge.request('starknet.execute', {
  calls: [
    {
      contractAddress: '0x1234...',
      entrypoint: 'transfer',
      calldata: ['0x5678...', '100', '0']
    }
  ]
});
console.log('Transaction hash:', result.transaction_hash);
```

---

### 8. starknet.waitForTransaction

**Purpose:** Wait for transaction confirmation

**Request:**
```typescript
{
  method: "starknet.waitForTransaction",
  params: {
    transactionHash: string;
    retryInterval?: number;  // Optional, default: 350ms
  }
}
```

**Response:**
```typescript
{
  result: {
    transaction_hash: string;
    execution_status: string;  // "ACCEPTED_ON_L2" | "ACCEPTED_ON_L1" | "REVERTED"
    events: Array<any>;
    // ... other receipt fields
  }
}
```

**Errors:**
- `-32001`: Not connected
- `-32003`: Transaction failed or timeout
- `-32602`: Invalid transaction hash

**Example:**
```javascript
const receipt = await window.NativeBridge.request('starknet.waitForTransaction', {
  transactionHash: '0x9abc...',
  retryInterval: 500
});
console.log('Status:', receipt.execution_status);
```

## Error Codes

| Code | Name | Description | Typical Cause |
|------|------|-------------|---------------|
| -32600 | INVALID_REQUEST | Invalid request format | Missing required fields, wrong types |
| -32601 | METHOD_NOT_FOUND | Method not allowed | Method not in allowlist |
| -32602 | INVALID_PARAMS | Invalid parameters | Wrong parameter structure |
| -32603 | INTERNAL_ERROR | Internal error | Unexpected error in handler |
| -32000 | UNAUTHORIZED | Unauthorized origin | Origin not in allowlist |
| -32001 | NOT_CONNECTED | Not connected | Login required before action |
| -32002 | USER_REJECTED | User rejected | User cancelled in UI |
| -32003 | TRANSACTION_FAILED | Transaction failed | On-chain error or timeout |

## Security

### Origin Validation

Every message is validated against an allowlist of origins:

```typescript
// Production
const ALLOWED_ORIGINS = [
  'https://lootsurvivor.io',
  'https://staging.lootsurvivor.io'
];

// Development (additional)
if (__DEV__) {
  ALLOWED_ORIGINS.push(
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'file://'
  );
}
```

Messages from unauthorized origins are silently dropped.

### Method Validation

Only explicitly allowed methods can be called:

```typescript
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
```

Attempts to call other methods return `METHOD_NOT_FOUND` error.

### Request Validation

Each request is validated for:

1. **Structure:** Must have `id`, `method`, and `timestamp` fields
2. **Types:** Fields must be correct types
3. **Timestamp:** Must be within 5 minutes of current time
4. **Method:** Must be in allowlist
5. **Origin:** Must be in allowlist

### Timeout Protection

Requests automatically timeout after 30 seconds:

```javascript
// In WebView injected JavaScript
setTimeout(() => {
  if (this.pendingRequests.has(id)) {
    this.pendingRequests.delete(id);
    reject(new Error('Request timeout'));
  }
}, 30000);
```

## WebView Setup

### Injected JavaScript

The bridge is initialized via injected JavaScript:

```javascript
window.__NATIVE_SHELL__ = true;

window.NativeBridge = {
  pendingRequests: new Map(),
  requestId: 0,
  
  request: function(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++this.requestId);
      const timestamp = Date.now();
      
      this.pendingRequests.set(id, { resolve, reject });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        id, method, params, timestamp
      }));
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  },
  
  handleResponse: function(response) {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    
    this.pendingRequests.delete(response.id);
    
    if (response.error) {
      pending.reject(response.error);
    } else {
      pending.resolve(response.result);
    }
  }
};

// Listen for responses
document.addEventListener('message', (event) => {
  const response = JSON.parse(event.data);
  window.NativeBridge.handleResponse(response);
});

window.addEventListener('message', (event) => {
  const response = JSON.parse(event.data);
  window.NativeBridge.handleResponse(response);
});
```

### Message Handling

Native side handles messages via `onMessage`:

```typescript
const handleMessage = async (event: WebViewMessageEvent) => {
  const { origin, data } = event.nativeEvent;
  
  // Validate origin
  if (!isOriginAllowed(origin)) {
    console.warn(`Blocked message from: ${origin}`);
    return;
  }
  
  // Parse and handle request
  const request = JSON.parse(data);
  const response = await bridgeHandler.handleRequest(request);
  
  // Send response back
  webViewRef.current?.postMessage(JSON.stringify(response));
};
```

## Best Practices

### For Web Client Developers

1. **Always check if in native shell:**
   ```typescript
   if (isNativeShell()) {
     // Use bridge
   } else {
     // Use browser wallet
   }
   ```

2. **Handle errors gracefully:**
   ```typescript
   try {
     const result = await bridge.execute(calls);
   } catch (error) {
     if (error.code === -32002) {
       // User rejected
     } else if (error.code === -32001) {
       // Not logged in
     }
   }
   ```

3. **Don't assume immediate responses:**
   - Network calls may take time
   - User may need to approve in UI
   - Always show loading states

### For Native Developers

1. **Validate everything:**
   - Origin, method, params, timestamp
   - Never trust WebView input

2. **Log security events:**
   ```typescript
   console.warn(`Blocked message from unauthorized origin: ${origin}`);
   ```

3. **Handle errors properly:**
   - Return structured error responses
   - Include helpful error messages
   - Log errors for debugging

4. **Test thoroughly:**
   - Test each method individually
   - Test error cases
   - Test with malformed requests
   - Test timeout behavior

## Testing

### Manual Testing

```javascript
// In WebView console

// Test echo
await window.NativeBridge.request('echo', { test: 123 });

// Test login
await window.NativeBridge.request('controller.login');

// Test get address
await window.NativeBridge.request('controller.getAddress');

// Test execute (requires login)
await window.NativeBridge.request('starknet.execute', {
  calls: [/* ... */]
});
```

### Automated Testing

Consider adding tests for:
- Request/response correlation
- Timeout behavior
- Error handling
- Origin validation
- Method validation
- Parameter validation

## Future Extensions

Potential future methods:

- `starknet.signMessage` - Sign arbitrary messages
- `starknet.getBalance` - Get token balances
- `controller.openStarterPack` - Open Cartridge starter pack
- `analytics.track` - Track events natively
- `storage.set/get` - Shared storage between web/native

When adding new methods:
1. Update `ALLOWED_METHODS` in security.ts
2. Add handler in BridgeHandler.ts
3. Update this specification
4. Update README.md method table
5. Add TypeScript types
6. Test thoroughly
