import { Transaction } from "@hashgraph/sdk";
import { HashConnect } from "hashconnect";
import { LibLoginTypes } from "./LibLoginTypes.js";
import type { HashConnectTypes, MessageTypes } from "hashconnect";
import { EventEmitter } from "./EventEmitter.js";

export declare abstract class BaseWallet extends EventEmitter<LibLoginTypes.LibLoginEvents> {
    private AppMetaData;
    private config;
    private hashconnect;
    /**
     * Keeps track of wallet connected, not found, not connected etc
     */
    status: LibLoginTypes.Status;
    /**
     * at least 1 local wallet extension found
     */
    get walletFound(): boolean;
    /**
     * Get the current topic used for relay node communications.
     * Not recommended to use until provided methods do not suffice.
     */
    topic(): Promise<string>;
    /**
     * Keeps track of relay node connection (hashconnect specific)
     */
    connected: boolean;
    wallets: HashConnectTypes.WalletMetadata[];
    protected abstract store(data: LibLoginTypes.WalletState): Promise<LibLoginTypes.WalletState>;
    protected abstract load(): Promise<LibLoginTypes.WalletState | null>;
    protected abstract clear(): Promise<void>;
    constructor(AppMetaData: HashConnectTypes.AppMetadata, config: {
        network: LibLoginTypes.Network;
        debug: boolean;
        multiAccount: boolean;
    });
    /**
     * Starts looking for local wallets. Wallets are only found in https, use pairing string for http or unsupported platforms
     */
    init(): void;
    private onAdditionalAccountRequestEvent;
    private onConnectionChangeEvent;
    private onWalletsFoundEvent;
    private onPairingEvent;
    private isStateValid;
    private updateStatus;
    findLocalWallets(): void;
    sendTransaction: (transaction: Transaction | Uint8Array, options: MessageTypes.TransactionMetadata) => Promise<{
        receipt: Uint8Array | undefined;
        success: boolean;
        response?: string | object | undefined;
        record?: string | Uint8Array | undefined;
        error?: string | undefined;
        topic: string;
        id?: string | undefined;
        signedTransaction: Uint8Array | undefined;
    }>;
    authenticate: (authData: {
        accountToAuthenticate: string;
        serverAccountId: string;
        serverSig: string;
        payload: {
            url: string;
            data: any;
        };
    }) => Promise<LibLoginTypes.AuthResponse>;
    /**
     * Use this method for initial and subsequent wallet connections
     * @param walletToConnect walletMetadata of wallet to connect to found in wallets property
     */
    connect(walletToConnect?: HashConnectTypes.WalletMetadata): Promise<undefined | {
        pairingString: string;
        connectLocalWallet: Function;
    }>;
    requestAdditionalAccounts(): Promise<void>;
    /**
     * Used for disconnecting the wallet and deleting local wallet state
     */
    disconnect(): Promise<void>;
    /**
      Hashconnect instance, not recommended until and unless provided methods do not suffice
    */
    get HCI(): HashConnect;
    /**
     * @returns accountIds that are currently connected that could be used for transactions
     */
    accounts(): Promise<string[]>;
    /**
     * Runs after user connects wallet for first time
     * @param accountIds list of all accounts selected for connection by user
     * @param pairingData Hashconnect specific ApprovePairing
     */
    private onPair;
    /**
     * Runs each time a wallet extension is found
     */
    private onWalletsFound;
    private onAdditionalAccountResponse;
    /**
     * Similar to onPair hook but also runs for subsequent connections
     */
    private onWalletConnect;
    /**
     * Runs on connection status change with hashconnect relay nodes
     */
    private onConnectionStateChange;
    /**
     * LibLogin specific status hooks. Called when wallet connected, not found, *  ,not connected or some error occurs.
     */
    private onStatusChange;
}
