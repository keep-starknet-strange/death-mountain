import {
  ChainId,
  getNetworkConfig,
  NetworkConfig,
} from "@/utils/networkConfig";
import { mainnet } from "@starknet-react/chains";
import { jsonRpcProvider, StarknetConfig, voyager } from "@starknet-react/core";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState
} from "react";
import { isNativeShell } from "@/nativeShell/isNativeShell";
import { NativeShellConnector } from "@/nativeShell/NativeShellConnector";

interface DynamicConnectorContext {
  setCurrentNetworkConfig: (network: NetworkConfig) => void;
  currentNetworkConfig: NetworkConfig;
}

const DynamicConnectorContext = createContext<DynamicConnectorContext | null>(
  null
);

const controllerConfig = getNetworkConfig(ChainId.SN_MAIN);

const nativeShellConnector =
  typeof window !== "undefined" && isNativeShell()
    ? new NativeShellConnector({
        rpcUrl: controllerConfig.rpcUrl,
        policies: controllerConfig.policies,
      })
    : null;
// #region agent log
typeof window !== "undefined" && isNativeShell() && fetch('http://127.0.0.1:7245/ingest/dbb5642d-cb63-4348-b628-e32d2a4b7cdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'starknet.tsx:34',message:'NativeShellConnector created with policies',data:{hasPolicies:!!controllerConfig.policies,policiesCount:controllerConfig.policies?.length??0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
// #endregion

// Error handling: warn if native shell connector is not available
if (!nativeShellConnector && typeof window !== "undefined") {
  console.error("Native shell connector not available. App requires native shell.");
}

export function DynamicConnectorProvider({ children }: PropsWithChildren) {
  const [currentNetworkConfig, setCurrentNetworkConfig] =
    useState<NetworkConfig>(getNetworkConfig(ChainId.SN_MAIN));

  const rpc = useCallback(() => {
    return { nodeUrl: controllerConfig.chains[0].rpcUrl };
  }, []);

  return (
    <DynamicConnectorContext.Provider
      value={{
        setCurrentNetworkConfig,
        currentNetworkConfig,
      }}
    >
      <StarknetConfig
        chains={[mainnet]}
        provider={jsonRpcProvider({ rpc })}
        connectors={[
          ...(nativeShellConnector ? [nativeShellConnector as any] : []),
        ]}
        explorer={voyager}
        autoConnect={true}
      >
        {children}
      </StarknetConfig>
    </DynamicConnectorContext.Provider>
  );
}

export function useDynamicConnector() {
  const context = useContext(DynamicConnectorContext);
  if (!context) {
    throw new Error(
      "useDynamicConnector must be used within a DynamicConnectorProvider"
    );
  }
  return context;
}
