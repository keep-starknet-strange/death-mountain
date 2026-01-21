/**
 * Cartridge Controller Context Provider
 * 
 * Provides React context and hooks for Cartridge Controller using @cartridge/controller directly.
 * This replaces the ControllerConnector approach for a unified implementation.
 */

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Account } from "starknet";
import {
  CartridgeWebAdapter,
} from "@/utils/cartridgeWebAdapter";
import {
  ICartridgeController,
  createControllerConfig,
} from "@/utils/cartridgeAdapter";
import { getNetworkConfig, ChainId } from "@/utils/networkConfig";

interface CartridgeControllerContextValue {
  controller: ICartridgeController | null;
  account: Account | null;
  address: string | null;
  username: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const CartridgeControllerContext = createContext<CartridgeControllerContextValue | null>(
  null
);

/**
 * Provider component for Cartridge Controller
 */
export function CartridgeControllerProvider({ children }: PropsWithChildren) {
  const [controller, setController] = useState<ICartridgeController | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize controller on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const networkConfig = getNetworkConfig(ChainId.SN_MAIN);
    const config = createControllerConfig(networkConfig);
    const adapter = new CartridgeWebAdapter(config);

    // Initialize the adapter
    adapter.initialize().then(() => {
      setController(adapter);

      // Check if already connected after initialization
      if (adapter.isConnected()) {
        const connectedAccount = adapter.getAccount();
        const connectedAddress = adapter.getAddress();
        const connectedUsername = adapter.getUsername();

        if (connectedAccount) {
          setAccount(connectedAccount);
          setAddress(connectedAddress);
          setUsername(connectedUsername);
        }
      }
    }).catch((error) => {
      console.error("Failed to initialize Cartridge Controller:", error);
    });
  }, []);

  // Update state when controller changes
  useEffect(() => {
    if (!controller) return;

    // Check connection state initially
    const checkConnection = () => {
      if (controller.isConnected()) {
        const currentAccount = controller.getAccount();
        const currentAddress = controller.getAddress();
        const currentUsername = controller.getUsername();

        // Only update if values actually changed to avoid unnecessary re-renders
        setAccount((prev) => {
          if (prev?.address !== currentAccount?.address) return currentAccount;
          return prev;
        });
        setAddress((prev) => {
          if (prev !== currentAddress) return currentAddress;
          return prev;
        });
        setUsername((prev) => {
          if (prev !== currentUsername) return currentUsername;
          return prev;
        });
      } else {
        // Only clear if we were previously connected
        setAccount((prev) => {
          if (prev !== null) return null;
          return prev;
        });
        setAddress((prev) => {
          if (prev !== null) return null;
          return prev;
        });
        setUsername((prev) => {
          if (prev !== null) return null;
          return prev;
        });
      }
    };

    checkConnection();

    // Check connection state on window focus (user might have connected in another tab)
    const handleFocus = () => {
      checkConnection();
    };
    window.addEventListener("focus", handleFocus);

    // Set up a reasonable polling interval (10 seconds) as fallback
    // In a production app, you'd want to use events from the controller if available
    const interval = setInterval(checkConnection, 10000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [controller]);

  const connect = useCallback(async () => {
    if (!controller) {
      throw new Error("Controller not initialized");
    }

    setIsConnecting(true);
    try {
      const result = await controller.connect();
      setAddress(result.address);
      setUsername(result.username || null);

      const connectedAccount = controller.getAccount();
      setAccount(connectedAccount);

      // Fetch username if not provided
      if (!result.username) {
        try {
          const fetchedUsername = controller.getUsername();
          if (fetchedUsername) {
            setUsername(fetchedUsername);
          }
        } catch (error) {
          console.warn("Could not fetch username:", error);
        }
      }
    } catch (error) {
      console.error("Failed to connect:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [controller]);

  const disconnect = useCallback(async () => {
    if (!controller) {
      return;
    }

    try {
      await controller.disconnect();
      setAccount(null);
      setAddress(null);
      setUsername(null);
    } catch (error) {
      console.error("Failed to disconnect:", error);
      throw error;
    }
  }, [controller]);

  const value = useMemo(
    () => ({
      controller,
      account,
      address,
      username,
      isConnected: controller?.isConnected() || false,
      isConnecting,
      connect,
      disconnect,
    }),
    [controller, account, address, username, isConnecting, connect, disconnect]
  );

  return (
    <CartridgeControllerContext.Provider value={value}>
      {children}
    </CartridgeControllerContext.Provider>
  );
}

/**
 * Hook to access Cartridge Controller context
 * Returns null if provider is not available (for graceful fallback)
 */
export function useCartridgeController() {
  const context = useContext(CartridgeControllerContext);
  return context;
}

/**
 * Hook to get the current account (similar to useAccount from @starknet-react/core)
 * Returns null values if provider is not available
 */
export function useCartridgeAccount() {
  const context = useCartridgeController();
  if (!context) {
    return {
      account: null,
      address: undefined,
      isConnected: false,
    };
  }
  return {
    account: context.account,
    address: context.address || undefined,
    isConnected: context.isConnected,
  };
}

/**
 * Hook to get connection functions (similar to useConnect from @starknet-react/core)
 * Returns no-op functions if provider is not available
 */
export function useCartridgeConnect() {
  const context = useCartridgeController();
  if (!context) {
    return {
      connect: async () => {},
      disconnect: async () => {},
      isPending: false,
    };
  }
  return {
    connect: context.connect,
    disconnect: context.disconnect,
    isPending: context.isConnecting,
  };
}
