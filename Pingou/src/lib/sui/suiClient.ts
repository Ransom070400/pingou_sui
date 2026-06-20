// @mysten/sui v2 split the client into modular transports. The JSON-RPC client
// (formerly `SuiClient`) is now `SuiJsonRpcClient`, and it's `.core`-extended so
// Seal's SealCompatibleClient accepts it directly.
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { SUI_RPC_URL, SUI_NETWORK } from './config';

/** Shared read-only Sui client for the active network. */
export const suiClient = new SuiJsonRpcClient({ url: SUI_RPC_URL, network: SUI_NETWORK });
