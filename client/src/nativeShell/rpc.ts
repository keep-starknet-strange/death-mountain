import { isNativeShell } from "@/nativeShell/isNativeShell";

type RpcError = { code: number; message: string; data?: unknown };
type RpcResponse =
  | { jsonrpc: "2.0"; id: string; result: unknown }
  | { jsonrpc: "2.0"; id: string; error: RpcError };

type RpcRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type NativeShellContext = {
  nonce: string;
  origin: string;
};

function getNativeShellContext(): NativeShellContext {
  const ctx = (window as any).__NATIVE_SHELL__ as NativeShellContext | undefined;
  if (!ctx?.nonce || !ctx?.origin) {
    throw new Error("Native shell context missing (nonce/origin)");
  }
  return ctx;
}

const pending = new Map<
  string,
  { resolve: (v: any) => void; reject: (e: any) => void; timeout: any }
>();

let initialized = false;
function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const handler = (event: MessageEvent) => {
    let msg: RpcResponse | null = null;
    try {
      msg = JSON.parse(event.data as any) as RpcResponse;
    } catch {
      return;
    }
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.id !== "string") return;

    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    clearTimeout(entry.timeout);

    if ("error" in msg) {
      const err = new Error(msg.error.message);
      (err as any).code = msg.error.code;
      (err as any).data = msg.error.data;
      entry.reject(err);
    } else {
      entry.resolve(msg.result);
    }
  };

  // Different WebView impls deliver to either window or document.
  window.addEventListener("message", handler);
  document.addEventListener("message", handler as any);
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function nativeShellRpcRequest<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  if (!isNativeShell()) {
    throw new Error("nativeShellRpcRequest called outside native shell");
  }
  ensureInitialized();

  const { nonce, origin } = getNativeShellContext();
  const id = createId();
  const timeoutMs = opts.timeoutMs ?? 60_000;

  const req: RpcRequest = {
    jsonrpc: "2.0",
    id,
    method,
    params: { ...params, nonce, origin },
  };

  const payload = JSON.stringify(req);

  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Native shell RPC timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });

    (window as any).ReactNativeWebView.postMessage(payload);
  });
}

