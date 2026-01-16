export type RpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type RpcRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: unknown;
};

export type RpcResponse =
  | { jsonrpc: "2.0"; id: string; result: unknown }
  | { jsonrpc: "2.0"; id: string; error: RpcError };

export function createRpcError(code: number, message: string, data?: unknown): RpcError {
  return data === undefined ? { code, message } : { code, message, data };
}

