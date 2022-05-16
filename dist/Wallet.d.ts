import type { HashConnectTypes } from "hashconnect";
import type { LibLoginTypes } from "./LibLoginTypes.js";
import { BaseWallet } from "./BaseWallet.js";
export declare class Wallet extends BaseWallet {
    private localStorageKey;
    private cache;
    constructor(AppMetaData: HashConnectTypes.AppMetadata, config: {
        network: LibLoginTypes.Network;
        debug: boolean;
        multiAccount: boolean;
    });
    private updateCacheAndReturn;
    setLocalStorageKey(key: string): void;
    protected store: (data: LibLoginTypes.WalletState) => Promise<LibLoginTypes.WalletState>;
    protected load: () => Promise<LibLoginTypes.WalletState | null>;
    protected clear(): Promise<void>;
}
export default Wallet;
