/**
 * Bridge Handler
 * 
 * Handles communication between the WebView and native code using a JSON-RPC-like protocol.
 */

import { getCartridgeController } from '@/cartridge/CartridgeController';
import {
  BridgeRequest,
  BridgeResponse,
  BridgeMethod,
  BridgeErrorCode,
  ExecuteParams,
  WaitForTransactionParams,
} from '@/types/bridge';
import {
  isMethodAllowed,
  validateBridgeRequest,
} from '@/utils/security';

export class BridgeHandler {
  private controller = getCartridgeController();

  /**
   * Handle incoming bridge request from WebView
   */
  async handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
    // Validate request structure
    if (!validateBridgeRequest(request)) {
      return this.createErrorResponse(
        request.id || 'unknown',
        BridgeErrorCode.INVALID_REQUEST,
        'Invalid request format'
      );
    }

    // Validate method is allowed
    if (!isMethodAllowed(request.method)) {
      return this.createErrorResponse(
        request.id,
        BridgeErrorCode.METHOD_NOT_FOUND,
        `Method not allowed: ${request.method}`
      );
    }

    try {
      const result = await this.executeMethod(request.method, request.params);
      return this.createSuccessResponse(request.id, result);
    } catch (error: any) {
      console.error(`Bridge method ${request.method} failed:`, error);
      
      // Map error to appropriate error code
      let errorCode = BridgeErrorCode.INTERNAL_ERROR;
      let errorMessage = error.message || 'Internal error';
      
      if (error.message?.includes('Not connected')) {
        errorCode = BridgeErrorCode.NOT_CONNECTED;
      } else if (error.message?.includes('rejected')) {
        errorCode = BridgeErrorCode.USER_REJECTED;
      } else if (error.message?.includes('transaction')) {
        errorCode = BridgeErrorCode.TRANSACTION_FAILED;
      }
      
      return this.createErrorResponse(request.id, errorCode, errorMessage, error);
    }
  }

  /**
   * Execute a specific bridge method
   */
  private async executeMethod(method: string, params?: any): Promise<any> {
    switch (method) {
      case BridgeMethod.ECHO:
        return this.handleEcho(params);
      
      case BridgeMethod.CONTROLLER_LOGIN:
        return this.handleLogin();
      
      case BridgeMethod.CONTROLLER_LOGOUT:
        return this.handleLogout();
      
      case BridgeMethod.CONTROLLER_GET_ADDRESS:
        return this.handleGetAddress();
      
      case BridgeMethod.CONTROLLER_GET_USERNAME:
        return this.handleGetUsername();
      
      case BridgeMethod.CONTROLLER_OPEN_PROFILE:
        return this.handleOpenProfile();
      
      case BridgeMethod.STARKNET_EXECUTE:
        return this.handleExecute(params);
      
      case BridgeMethod.STARKNET_WAIT_FOR_TRANSACTION:
        return this.handleWaitForTransaction(params);
      
      default:
        throw new Error(`Method not implemented: ${method}`);
    }
  }

  /**
   * Echo method for testing bridge communication
   */
  private async handleEcho(params: any): Promise<any> {
    return { echo: params };
  }

  /**
   * Handle controller login
   */
  private async handleLogin(): Promise<{ address: string; username?: string }> {
    const account = await this.controller.login();
    return {
      address: account.address,
      username: account.username,
    };
  }

  /**
   * Handle controller logout
   */
  private async handleLogout(): Promise<{ success: boolean }> {
    await this.controller.logout();
    return { success: true };
  }

  /**
   * Get current account address
   */
  private async handleGetAddress(): Promise<{ address: string | null }> {
    const address = this.controller.getAddress();
    return { address };
  }

  /**
   * Get current username
   */
  private async handleGetUsername(): Promise<{ username: string | null }> {
    const username = this.controller.getUsername();
    return { username };
  }

  /**
   * Open Cartridge profile
   */
  private async handleOpenProfile(): Promise<{ success: boolean }> {
    await this.controller.openProfile();
    return { success: true };
  }

  /**
   * Execute transaction calls
   */
  private async handleExecute(params: ExecuteParams): Promise<{ transaction_hash: string }> {
    if (!params || !params.calls || !Array.isArray(params.calls)) {
      throw new Error('Invalid execute params: calls array required');
    }

    // Validate call structure
    for (const call of params.calls) {
      if (!call.contractAddress || !call.entrypoint || !Array.isArray(call.calldata)) {
        throw new Error('Invalid call structure');
      }
    }

    const result = await this.controller.execute(params.calls);
    return result;
  }

  /**
   * Wait for transaction confirmation
   */
  private async handleWaitForTransaction(
    params: WaitForTransactionParams
  ): Promise<any> {
    if (!params || !params.transactionHash) {
      throw new Error('Invalid params: transactionHash required');
    }

    const receipt = await this.controller.waitForTransaction(
      params.transactionHash,
      { retryInterval: params.retryInterval }
    );
    
    return receipt;
  }

  /**
   * Create success response
   */
  private createSuccessResponse(id: string, result: any): BridgeResponse {
    return {
      id,
      result,
      timestamp: Date.now(),
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string,
    code: BridgeErrorCode,
    message: string,
    data?: any
  ): BridgeResponse {
    return {
      id,
      error: {
        code,
        message,
        data,
      },
      timestamp: Date.now(),
    };
  }
}

// Singleton instance
let handlerInstance: BridgeHandler | null = null;

export function getBridgeHandler(): BridgeHandler {
  if (!handlerInstance) {
    handlerInstance = new BridgeHandler();
  }
  return handlerInstance;
}
