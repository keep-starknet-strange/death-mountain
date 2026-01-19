/**
 * Bridge Types
 * Defines the communication protocol between the WebView and native code
 */

export interface BridgeRequest {
  id: string;
  method: string;
  params?: any;
  timestamp: number;
}

export interface BridgeResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  timestamp: number;
}

export interface BridgeError {
  code: number;
  message: string;
  data?: any;
}

// Bridge method names
export enum BridgeMethod {
  // Echo for testing
  ECHO = 'echo',
  
  // Controller methods
  CONTROLLER_LOGIN = 'controller.login',
  CONTROLLER_LOGOUT = 'controller.logout',
  CONTROLLER_GET_ADDRESS = 'controller.getAddress',
  CONTROLLER_GET_USERNAME = 'controller.getUsername',
  CONTROLLER_OPEN_PROFILE = 'controller.openProfile',
  
  // Starknet methods
  STARKNET_EXECUTE = 'starknet.execute',
  STARKNET_WAIT_FOR_TRANSACTION = 'starknet.waitForTransaction',
}

// Error codes
export enum BridgeErrorCode {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  UNAUTHORIZED = -32000,
  NOT_CONNECTED = -32001,
  USER_REJECTED = -32002,
  TRANSACTION_FAILED = -32003,
}

// Method-specific types
export interface ExecuteCallData {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

export interface ExecuteParams {
  calls: ExecuteCallData[];
}

export interface ExecuteResult {
  transaction_hash: string;
}

export interface WaitForTransactionParams {
  transactionHash: string;
  retryInterval?: number;
}

export interface WaitForTransactionResult {
  transaction_hash: string;
  execution_status: string;
  events: any[];
}
