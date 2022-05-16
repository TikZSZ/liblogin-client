// @ts-ignore
import { Transaction } from "@hashgraph/sdk";
import { HashConnect } from "hashconnect";
import { LibLoginTypes } from "./LibLoginTypes.js";
import { Buffer } from "buffer";
import { EventEmitter } from "./EventEmitter.js";
export class BaseWallet extends EventEmitter {
    AppMetaData;
    config;
    hashconnect;
    /**
     * Keeps track of wallet connected, not found, not connected etc
     */
    status = LibLoginTypes.Status.Disconnected;
    /**
     * at least 1 local wallet extension found
     */
    get walletFound() {
        return this.wallets.length > 0;
    }
    /**
     * Get the current topic used for relay node communications.
     * Not recommended to use until provided methods do not suffice.
     */
    async topic() {
        const savedState = await this.load();
        if (!this.isStateValid(savedState))
            throw new Error("Not paired");
        return savedState.state.topic;
    }
    /**
     * Keeps track of relay node connection (hashconnect specific)
     */
    connected = false;
    wallets = [];
    constructor(AppMetaData, config) {
        super();
        this.AppMetaData = AppMetaData;
        this.config = config;
        // init client
        this.hashconnect = new HashConnect(config.debug);
        // type incompatibility b/w hashconnect enum and lib login enum
        // tl;dr nothing serious
        this.hashconnect.connectionStatusChange.on(this.onConnectionChangeEvent);
        // find all local wallets
        this.hashconnect.foundExtensionEvent.on(this.onWalletsFoundEvent);
        // add event lister for pair events
        this.hashconnect.pairingEvent.on(this.onPairingEvent);
        // add event listener for additionalAccountRequest
        this.hashconnect.additionalAccountRequestEvent.on(this.onAdditionalAccountRequestEvent);
    }
    /**
     * Starts looking for local wallets. Wallets are only found in https, use pairing string for http or unsupported platforms
     */
    init() {
        return this.findLocalWallets();
    }
    // BaseWallet provided hooks for handling hashconnect events
    onAdditionalAccountRequestEvent(data) {
        if (this.config.debug)
            console.log(data);
    }
    onConnectionChangeEvent = (state) => {
        if (this.config.debug)
            console.log(state);
        if (state === LibLoginTypes.ConnectionState.Connected) {
            this.connected = true;
        }
        else {
            this.connected = false;
            this.status = LibLoginTypes.Status.Disconnected;
        }
        this.onConnectionStateChange(state);
    };
    onWalletsFoundEvent = (walletMetadata) => {
        this.wallets.push(walletMetadata);
        this.onWalletsFound(walletMetadata);
    };
    onPairingEvent = async (pairingData) => {
        let savedState = await this.load();
        if (!savedState)
            return;
        if (this.config.debug)
            console.log("onPairEvent", pairingData);
        savedState.pairedWalletData = pairingData.metadata;
        savedState.pairedAccounts.push(...pairingData.accountIds);
        await this.store(savedState);
        this.updateStatus(LibLoginTypes.Status.Connected);
        this.onPair(pairingData.accountIds, pairingData);
        this.onWalletConnect(savedState.pairedAccounts);
    };
    isStateValid(data) {
        let status = true;
        if (!data)
            return false;
        if (!data.state.topic)
            status = false;
        if (!data.privKey)
            status = false;
        if (data.pairedAccounts.length < 1)
            status = false;
        return status;
    }
    updateStatus(status) {
        this.status = status;
        this.onStatusChange(status);
    }
    // BaseWallet provided methods
    findLocalWallets() {
        return this.hashconnect.findLocalWallets();
    }
    sendTransaction = async (transaction, options) => {
        const savedState = await this.load();
        if (!this.isStateValid(savedState) ||
            this.status !== LibLoginTypes.Status.Connected)
            throw new Error("wallet not paired");
        const response = await this.hashconnect.sendTransaction(savedState.state.topic, {
            topic: savedState.state.topic,
            metadata: options,
            byteArray: transaction instanceof Transaction
                ? transaction.toBytes()
                : transaction,
        });
        if (!response.success)
            console.error(`Transaction failed due to ${response.error}`);
        const { signedTransaction, receipt, ...rest } = response;
        return {
            signedTransaction: response.signedTransaction,
            ...rest,
            receipt: receipt
        };
    };
    authenticate = async (authData) => {
        const savedState = await this.load();
        if (!this.isStateValid(savedState))
            throw new Error("not paired");
        const { accountToAuthenticate, serverAccountId, serverSig, payload } = authData;
        const UInt8Sig = Buffer.from(serverSig, "base64");
        const response = await this.hashconnect.authenticate(savedState.state.topic, accountToAuthenticate, serverAccountId, UInt8Sig, payload);
        if (!response.success)
            console.error(`Transaction failed due to ${response.error}`);
        if (response.success && response.signedPayload && response.userSignature) {
            let signedP = response.signedPayload;
            response.signedPayload = {
                originalPayload: signedP.originalPayload,
                serverSignature: Buffer.from(signedP.serverSignature).toString("base64")
            };
            response.userSignature = Buffer.from(response.userSignature).toString('base64');
        }
        return response;
    };
    /**
     * Use this method for initial and subsequent wallet connections
     * @param walletToConnect walletMetadata of wallet to connect to found in wallets property
     */
    async connect(walletToConnect) {
        // get saved client wallet data
        const savedState = await this.load();
        if (this.config.debug)
            console.log(savedState);
        // if data exists connect to selected local wallet
        if (savedState) {
            if (this.config.debug)
                console.log(1);
            //if partial data is found prompt a local wallet connection
            if (savedState.pairedAccounts.length === 0) {
                if (this.config.debug)
                    console.log(2);
                this.clear();
                return this.connect(walletToConnect);
            }
            try {
                const initData = await this.hashconnect.init(this.AppMetaData, savedState.privKey);
                const state = await this.hashconnect.connect(savedState.state.topic, savedState.pairedWalletData);
                this.updateStatus(LibLoginTypes.Status.Connected);
                this.onWalletConnect(savedState.pairedAccounts);
            }
            catch (err) {
                if (this.config.debug)
                    console.log(err);
                this.updateStatus(LibLoginTypes.Status.Error);
            }
        }
        // if data does not exist start preparing for local wallet connection
        else {
            const initData = await this.hashconnect.init(this.AppMetaData);
            const state = await this.hashconnect.connect();
            let stateToSave = {
                privKey: initData.privKey,
                state,
                pairedAccounts: [],
            };
            await this.store(stateToSave);
            const pairingString = this.hashconnect.generatePairingString(state, this.config.network, this.config.multiAccount);
            return {
                pairingString,
                /**
                 * Call this function to prompt the wallet extension to get connection authorization from user
                 */
                connectLocalWallet: () => {
                    if (this.config.debug)
                        console.log("trying to connect locally");
                    if (!this.walletFound)
                        throw new Error("No wallets found cant connect locally, use pairing string");
                    this.hashconnect.connectToLocalWallet(pairingString);
                },
            };
        }
    }
    async requestAdditionalAccounts() {
        const savedState = await this.load();
        if (!this.isStateValid(savedState) ||
            this.status !== LibLoginTypes.Status.Disconnected) {
            throw new Error(" no account paired ");
            return;
        }
        if (this.config.debug)
            console.log("getting additional accounts");
        const response = await this.hashconnect.requestAdditionalAccounts(savedState.state.topic, {
            topic: savedState.state.topic,
            network: this.config.network,
            multiAccount: this.config.multiAccount,
        });
        if (this.config.debug)
            console.log("got additional accounts response");
        this.onAdditionalAccountResponse(response);
    }
    /**
     * Used for disconnecting the wallet and deleting local wallet state
     */
    async disconnect() {
        this.updateStatus(LibLoginTypes.Status.Disconnected);
        await this.clear();
        return;
    }
    /**
      Hashconnect instance, not recommended until and unless provided methods do not suffice
    */
    get HCI() {
        return this.hashconnect;
    }
    /**
     * @returns accountIds that are currently connected that could be used for transactions
     */
    async accounts() {
        const savedState = await this.load();
        if (!this.isStateValid(savedState))
            throw new Error("No accounts paired");
        return savedState.pairedAccounts;
    }
    // User provided hooks for handling hashconnect events
    /**
     * Runs after user connects wallet for first time
     * @param accountIds list of all accounts selected for connection by user
     * @param pairingData Hashconnect specific ApprovePairing
     */
    onPair(accountIds, pairingData) {
        this.emit("pair", { accountIds, pairingData });
    }
    /**
     * Runs each time a wallet extension is found
     */
    onWalletsFound(walletMetadata) {
        this.emit('walletsFound', walletMetadata);
    }
    onAdditionalAccountResponse(data) { }
    /**
     * Similar to onPair hook but also runs for subsequent connections
     */
    onWalletConnect(accountIds) {
        this.emit("walletConnect", { accountIds });
    }
    /**
     * Runs on connection status change with hashconnect relay nodes
     */
    onConnectionStateChange(status) {
        this.emit("connectionStateChange", status);
    }
    /**
     * LibLogin specific status hooks. Called when wallet connected, not found, *  ,not connected or some error occurs.
     */
    onStatusChange(status) {
        this.emit("statusChange", status);
    }
}
