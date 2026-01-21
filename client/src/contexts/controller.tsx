import { useStarknetApi } from "@/api/starknet";
import { useGameTokens } from "@/dojo/useGameTokens";
import { useSystemCalls } from "@/dojo/useSystemCalls";
import { useGameStore } from "@/stores/gameStore";
import { useUIStore } from "@/stores/uiStore";
import { Payment } from "@/types/game";
import { useAnalytics } from "@/utils/analytics";
import { ChainId, NETWORKS } from "@/utils/networkConfig";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Account, RpcProvider } from "starknet";
import { useDynamicConnector } from "./starknet";
import { delay } from "@/utils/utils";
import { useDungeon } from "@/dojo/useDungeon";
import { isNativeShell } from "@/nativeShell/isNativeShell";
import { nativeShellRpcRequest } from "@/nativeShell/rpc";
import {
  useCartridgeAccount,
  useCartridgeConnect,
  useCartridgeController,
} from "./cartridgeController";

export interface ControllerContext {
  account: any;
  address: string | undefined;
  playerName: string;
  isPending: boolean;
  tokenBalances: Record<string, string>;
  goldenPassIds: number[];
  openProfile: () => void;
  login: () => void;
  logout: () => void;
  enterDungeon: (payment: Payment, txs: any[]) => void;
  showTermsOfService: boolean;
  acceptTermsOfService: () => void;
  openBuyTicket: () => void;
  bulkMintGames: (amount: number, callback: () => void) => void;
}

// Create a context
const ControllerContext = createContext<ControllerContext>(
  {} as ControllerContext
);

// Create a provider component
export const ControllerProvider = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const { setShowOverlay } = useGameStore();
  const { account, address, isConnecting } = useAccount();
  const { buyGame } = useSystemCalls();
  const { connector, connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const dungeon = useDungeon();
  const { currentNetworkConfig } = useDynamicConnector();
  const { createBurnerAccount, getTokenBalances, goldenPassReady } =
    useStarknetApi();
  const { getGameTokens } = useGameTokens();
  const { skipIntroOutro } = useUIStore();
  const [burner, setBurner] = useState<Account | null>(null);
  const [userName, setUserName] = useState<string>();
  const [creatingBurner, setCreatingBurner] = useState(false);
  const [tokenBalances, setTokenBalances] = useState({});
  const [goldenPassIds, setGoldenPassIds] = useState<number[]>([]);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  const { identifyAddress } = useAnalytics();
  const nativeShell = isNativeShell();

  // Cartridge Controller hooks (for web with Cartridge, not native shell)
  // Always call hooks (React requirement), but only use them when not native and not burner
  const useCartridge = !nativeShell && currentNetworkConfig.chainId !== ChainId.WP_PG_SLOT;
  
  // Always call hooks (React rules) - they return safe defaults if provider not available
  const cartridgeAccountData = useCartridgeAccount();
  const cartridgeConnectData = useCartridgeConnect();
  const cartridgeControllerData = useCartridgeController();

  // Only use Cartridge data when appropriate
  const cartridgeAccount = useCartridge && cartridgeAccountData.isConnected ? cartridgeAccountData : null;
  const cartridgeConnect = useCartridge ? cartridgeConnectData : null;
  const cartridgeController = useCartridge && cartridgeControllerData ? cartridgeControllerData : null;

  const demoRpcProvider = useMemo(
    () => new RpcProvider({ nodeUrl: NETWORKS.WP_PG_SLOT.rpcUrl }),
    []
  );

  useEffect(() => {
    // Use Cartridge account if available, otherwise use Starknet account
    const activeAccount = cartridgeAccount?.account || account;
    const activeAddress = cartridgeAccount?.address || address;

    if (activeAccount && activeAddress) {
      fetchTokenBalances();
      identifyAddress({ address: activeAddress });

      // Check if terms have been accepted
      const termsAccepted = typeof window !== 'undefined'
        ? localStorage.getItem('termsOfServiceAccepted')
        : null;

      if (!termsAccepted) {
        setShowTermsOfService(true);
      }
    }
  }, [account, address, cartridgeAccount]);

  useEffect(() => {
    if (
      localStorage.getItem("burner") &&
      localStorage.getItem("burner_version") === "6"
    ) {
      let burner = JSON.parse(localStorage.getItem("burner") as string);
      setBurner(
        new Account({
          provider: demoRpcProvider,
          address: burner.address,
          signer: burner.privateKey,
        })
      );
    } else {
      createBurner();
    }
  }, []);

  // Get username from Cartridge Controller or connector
  useEffect(() => {
    if (useCartridge && cartridgeController?.username) {
      setUserName(cartridgeController.username);
    } else {
      const getUsername = async () => {
        try {
          const name = await (connector as any)?.username();
          if (name) setUserName(name);
        } catch (error) {
          console.error("Error getting username:", error);
        }
      };

      if (connector) getUsername();
    }
  }, [connector, useCartridge, cartridgeController?.username]);

  // Listen for native shell account ready event and re-check account
  useEffect(() => {
    if (!nativeShell) return;

    const handleAccountReady = async () => {
      console.log("[Controller] Native shell account ready event received");
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'controller.tsx:155',message:'Account ready event received',data:{currentAddress:address,hasAddress:!!address},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      const nativeShellConnector = connectors.find((conn) => conn.id === "native-shell");
      if (!nativeShellConnector) {
        console.warn("[Controller] Native shell connector not found");
        return;
      }

      try {
        // Check if account is available - retry a few times if not ready yet
        let account = null;
        let retries = 0;
        const maxRetries = 5;
        
        while (!account && retries < maxRetries) {
          try {
            account = await (nativeShellConnector as any).account();
            if (!account) {
              retries++;
              if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } catch (err) {
            retries++;
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'controller.tsx:175',message:'Account check result',data:{hasAccount:!!account,retries,address:account?.address||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        
        if (!account) {
          console.log("[Controller] No account available yet after retries, will check again later");
          // Set up a retry mechanism - check again in a few seconds
          setTimeout(() => {
            const checkAgain = async () => {
              try {
                const retryAccount = await (nativeShellConnector as any).account();
                if (retryAccount && !address) {
                  console.log("[Controller] Account now available, connecting...");
                  await connect({ connector: nativeShellConnector });
                  const retryUsername = await (nativeShellConnector as any).username();
                  if (retryUsername) setUserName(retryUsername);
                }
              } catch (err) {
                console.error("[Controller] Retry check failed:", err);
              }
            };
            checkAgain();
          }, 3000);
          return;
        }

        // If not connected, connect now
        if (!address) {
          console.log("[Controller] Account available but not connected, connecting...");
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'controller.tsx:195',message:'Connecting account',data:{accountAddress:account.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          await connect({ connector: nativeShellConnector });
        }

        // Fetch username after connection (or if already connected)
        // This ensures the username is displayed even if we were already connected
        try {
          const username = await (nativeShellConnector as any).username();
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'controller.tsx:204',message:'Username fetched',data:{username:username||null,hasUsername:!!username},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          if (username) {
            console.log("[Controller] Fetched username:", username);
            setUserName(username);
          }
        } catch (usernameError) {
          console.warn("[Controller] Could not fetch username:", usernameError);
        }

        // Force a refresh of token balances and other account-dependent data
        // This ensures the UI is fully updated
        setTimeout(() => {
          console.log("[Controller] Refreshing account data after connection");
          fetchTokenBalances();
        }, 500);
      } catch (error) {
        console.error("[Controller] Error handling account ready:", error);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'controller.tsx:217',message:'Account ready handler error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
      }
    };

    window.addEventListener('nativeShellAccountReady', handleAccountReady);
    return () => {
      window.removeEventListener('nativeShellAccountReady', handleAccountReady);
    };
  }, [nativeShell, connectors, connect, address]);

  const enterDungeon = async (payment: Payment, txs: any[]) => {
    // Use the active account (Cartridge or native shell or burner)
    const accountToUse = currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
      ? burner
      : (cartridgeAccount?.account || account);
    
    let gameId = await buyGame(
      accountToUse,
      payment,
      userName || "Adventurer",
      txs,
      1,
      () => {
        navigate(`/${dungeon.id}/play?mode=entering`);
      }
    );

    if (gameId) {
      await delay(2000);
      navigate(`/${dungeon.id}/play?id=${gameId}`, { replace: true });
      fetchTokenBalances();
      if (!skipIntroOutro) {
        setShowOverlay(false);
      }
    } else {
      navigate(`/${dungeon.id}`, { replace: true });
    }
  };

  const bulkMintGames = async (amount: number, callback: () => void) => {
    amount = Math.min(amount, 50);

    // Use the active account (Cartridge or native shell or burner)
    const accountToUse = currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
      ? burner
      : (cartridgeAccount?.account || account);

    await buyGame(
      accountToUse,
      { paymentType: "Ticket" },
      userName || "Adventurer",
      [],
      amount,
      () => {
        setTokenBalances(prev => ({
          ...prev,
          "TICKET": (Number((prev as any)["TICKET"]) - amount).toString()
        }));
        callback();
      }
    );
  };

  const createBurner = async () => {
    setCreatingBurner(true);
    let account = await createBurnerAccount(demoRpcProvider);

    if (account) {
      setBurner(account);
    }
    setCreatingBurner(false);
  };

  // Determine which account/address to use
  const activeAccount = currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
    ? burner
    : (cartridgeAccount?.account || account);
  
  const activeAddress = currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
    ? burner?.address
    : (cartridgeAccount?.address || address);

  async function fetchTokenBalances() {
    let balances = await getTokenBalances(NETWORKS.SN_MAIN.paymentTokens);
    setTokenBalances(balances);

    if (!activeAddress) return;

    let goldenTokenAddress = NETWORKS.SN_MAIN.goldenToken;
    const allTokens = await getGameTokens(activeAddress, goldenTokenAddress);

    if (allTokens.length > 0) {
      const cooldowns = await goldenPassReady(goldenTokenAddress, allTokens);
      setGoldenPassIds(cooldowns);
    }
  }

  const acceptTermsOfService = () => {
    setShowTermsOfService(false);
  };

  return (
    <ControllerContext.Provider
      value={{
        account: activeAccount,
        address: activeAddress,
        playerName: userName || "Adventurer",
        isPending: isConnecting || isPending || creatingBurner || (cartridgeConnect?.isPending || false),
        tokenBalances,
        goldenPassIds,
        showTermsOfService,
        acceptTermsOfService,

        openProfile: async () => {
          if (useCartridge && cartridgeController?.controller) {
            try {
              await cartridgeController.controller.openProfile();
            } catch (error) {
              console.error("Failed to open profile:", error);
            }
          } else {
            try {
              await (connector as any)?.openProfile?.();
            } catch (error) {
              console.error("Failed to open profile:", error);
            }
          }
        },
        openBuyTicket: async () => {
          const packId = "ls2-dungeon-ticket-mainnet";
          const url = `https://x.cartridge.gg/starter-pack/${packId}`;
          
          if (nativeShell) {
            try {
              // In native shell, use the bridge to open in WebView
              await nativeShellRpcRequest("controller.openInWebView", { url });
            } catch (error) {
              console.error("Failed to open buy ticket page:", error);
            }
          } else if (useCartridge && cartridgeController?.controller) {
            // Use Cartridge controller's openStarterPack if available
            try {
              await cartridgeController.controller.openStarterPack(packId);
            } catch (error) {
              // Fallback to opening URL
              console.warn("openStarterPack not available, opening URL:", error);
              window.open(url, '_blank');
            }
          } else {
            // Fallback: open in new window
            window.open(url, '_blank');
          }
        },
        login: () => {
          if (nativeShell) {
            const nativeShellConnector = connectors.find((conn) => conn.id === "native-shell");
            if (!nativeShellConnector) {
              throw new Error("Native shell connector not available. Please use the native app.");
            }
            return connect({ connector: nativeShellConnector });
          } else if (useCartridge && cartridgeConnect) {
            return cartridgeConnect.connect();
          } else {
            throw new Error("No available connector");
          }
        },
        logout: () => {
          if (useCartridge && cartridgeConnect) {
            return cartridgeConnect.disconnect();
          } else {
            return disconnect();
          }
        },
        enterDungeon,
        bulkMintGames,
      }}
    >
      {children}
    </ControllerContext.Provider>
  );
};

export const useController = () => {
  const context = useContext(ControllerContext);
  if (!context) {
    throw new Error("useController must be used within a ControllerProvider");
  }
  return context;
};
