// @ts-ignore
import { Transaction } from "@hashgraph/sdk";
import { HashConnect } from "hashconnect";
import { LibLoginTypes } from "./LibLoginTypes.js";
import type { HashConnectTypes,MessageTypes } from "hashconnect"
import { Buffer } from "buffer"
import {EventEmitter} from "./EventEmitter.js"


export abstract class BaseWallet extends EventEmitter<LibLoginTypes.LibLoginEvents> {
  private hashconnect: HashConnect;
  /**
   * Keeps track of wallet connected, not found, not connected etc 
   */
  public status: LibLoginTypes.Status = LibLoginTypes.Status.Disconnected;

  /**
   * at least 1 local wallet extension found
   */
  public get walletFound() {
    return this.wallets.length > 0;
  }

  /**
   * Get the current topic used for relay node communications.
   * Not recommended to use until provided methods do not suffice.
   */
  public async topic() {
    const savedState = await this.load();
    if (!this.isStateValid(savedState)) throw new Error("Not paired");
    return savedState.state.topic;
  }

  /**
   * Keeps track of relay node connection (hashconnect specific)
   */
  public connected = false;

  public wallets: HashConnectTypes.WalletMetadata[] = [];

  protected abstract store(
    data: LibLoginTypes.WalletState
  ): Promise<LibLoginTypes.WalletState>;

  protected abstract load(): Promise<LibLoginTypes.WalletState | null>;

  protected abstract clear(): Promise<void>;

  constructor(
    private AppMetaData: HashConnectTypes.AppMetadata,
    private config: {
      network: LibLoginTypes.Network;
      debug: boolean;
      multiAccount: boolean;
    }
  ) {
    super()
    // init client
    this.hashconnect = new HashConnect(config.debug);
    // type incompatibility b/w hashconnect enum and lib login enum
    // tl;dr nothing serious
    this.hashconnect.connectionStatusChange.on(
      this.onConnectionChangeEvent as any
    );
    // find all local wallets
    this.hashconnect.foundExtensionEvent.on(this.onWalletsFoundEvent);
    // add event lister for pair events
    this.hashconnect.pairingEvent.on(this.onPairingEvent);
    // add event listener for additionalAccountRequest
    this.hashconnect.additionalAccountRequestEvent.on(
      this.onAdditionalAccountRequestEvent
    );
  }

  /**
   * Starts looking for local wallets. Wallets are only found in https, use pairing string for http or unsupported platforms
   */
  init() {
    return this.findLocalWallets();
  }

  // BaseWallet provided hooks for handling hashconnect events

  private onAdditionalAccountRequestEvent(
    data: MessageTypes.AdditionalAccountRequest
  ) {
    if (this.config.debug) console.log(data);
  }

  private onConnectionChangeEvent = (state: LibLoginTypes.ConnectionState) => {
    if (this.config.debug) console.log(state);

    if (state === LibLoginTypes.ConnectionState.Connected) {
      this.connected = true;
    } else {
      this.connected = false;
      this.status = LibLoginTypes.Status.Disconnected;
    }
    this.onConnectionStateChange(state);
  };

  private onWalletsFoundEvent = (
    walletMetadata: HashConnectTypes.WalletMetadata
  ) => {
    this.wallets.push(walletMetadata);
    this.onWalletsFound(walletMetadata);
  };

  private onPairingEvent = async (pairingData: MessageTypes.ApprovePairing) => {
    let savedState = await this.load();
    if (!savedState) return;
    if (this.config.debug) console.log("onPairEvent", pairingData);
    savedState.pairedWalletData = pairingData.metadata;
    savedState.pairedAccounts.push(...pairingData.accountIds);
    await this.store(savedState);
    this.updateStatus(LibLoginTypes.Status.Connected);
    this.onPair(pairingData.accountIds, pairingData);
    this.onWalletConnect(savedState.pairedAccounts);
  };

  private isStateValid(
    data: LibLoginTypes.WalletState | null
  ): data is LibLoginTypes.WalletState {
    let status = true;
    if (!data) return false;
    if (!data.state.topic) status = false;
    if (!data.privKey) status = false;
    if (data.pairedAccounts.length < 1) status = false;
    return status;
  }

  private updateStatus(status: LibLoginTypes.Status) {
    this.status = status;
    this.onStatusChange(status);
  }

  // BaseWallet provided methods

  public findLocalWallets() {
    return this.hashconnect.findLocalWallets();
  }

  public sendTransaction = async (
    transaction: Transaction | Uint8Array,
    options: MessageTypes.TransactionMetadata
  ) => {
    const savedState = await this.load();
    if (
      !this.isStateValid(savedState) ||
      this.status !== LibLoginTypes.Status.Connected
    )
      throw new Error("wallet not paired");
    const response = await this.hashconnect.sendTransaction(
      savedState.state.topic,
      {
        topic: savedState.state.topic,
        metadata: options,
        byteArray:
          transaction instanceof Transaction
            ? transaction.toBytes()
            : transaction,
      }
    );
    if (!response.success)
      console.error(`Transaction failed due to ${response.error}`);
    const {signedTransaction,receipt,...rest} = response
    return {
      signedTransaction: response.signedTransaction as Uint8Array | undefined,
      ...rest,
      receipt: receipt as Uint8Array | undefined
    };
  };

  public authenticate = async (authData: {
    accountToAuthenticate: string;
    serverAccountId: string;
    serverSig: string;
    payload: {
      url: string;
      data: any;
    };
  }): Promise<LibLoginTypes.AuthResponse> => {
    const savedState = await this.load();
    if (!this.isStateValid(savedState)) throw new Error("not paired");
    const { accountToAuthenticate, serverAccountId, serverSig, payload } =
      authData;
    const UInt8Sig = Buffer.from(serverSig, "base64")
    const response = await this.hashconnect.authenticate(
      savedState.state.topic,
      accountToAuthenticate,
      serverAccountId,
      UInt8Sig,
      payload
    );
    if (!response.success)
      console.error(`Transaction failed due to ${response.error}`);
    if (response.success && response.signedPayload && response.userSignature) {
      let signedP = response.signedPayload
      response.signedPayload = {
        originalPayload: signedP.originalPayload,
        serverSignature: Buffer.from(signedP.serverSignature as Uint8Array).toString("base64")
      }
      response.userSignature = Buffer.from(response.userSignature as Uint8Array).toString('base64')
    }
    return response as LibLoginTypes.AuthResponse;
  };

  /**
   * Use this method for initial and subsequent wallet connections
   * @param walletToConnect walletMetadata of wallet to connect to found in wallets property
   */
  public async connect(walletToConnect?: HashConnectTypes.WalletMetadata):Promise<undefined|{pairingString:string,connectLocalWallet:Function

  }> {

    // get saved client wallet data
    const savedState = await this.load();
    if (this.config.debug) console.log(savedState);

    // if data exists connect to selected local wallet
    if (savedState) {
      if (this.config.debug) console.log(1);
      //if partial data is found prompt a local wallet connection
      if (savedState.pairedAccounts.length === 0) {
        if (this.config.debug) console.log(2);
        this.clear();
        return this.connect(walletToConnect)
      }
      try {
        const initData = await this.hashconnect.init(
          this.AppMetaData,
          savedState.privKey
        );
        const state = await this.hashconnect.connect(
          savedState.state.topic,
          savedState.pairedWalletData
        );
        this.updateStatus(LibLoginTypes.Status.Connected);
        this.onWalletConnect(savedState.pairedAccounts);
      } catch (err) {
        if (this.config.debug) console.log(err);
        this.updateStatus(LibLoginTypes.Status.Error);
      }
    }

    // if data does not exist start preparing for local wallet connection
    else {
      const initData = await this.hashconnect.init(this.AppMetaData);
      const state = await this.hashconnect.connect();
      let stateToSave: LibLoginTypes.WalletState = {
        privKey: initData.privKey,
        state,
        pairedAccounts: [],
      };
      await this.store(stateToSave);
      const pairingString = this.hashconnect.generatePairingString(
        state,
        this.config.network,
        this.config.multiAccount
      );
      return {
        pairingString,
        /**
         * Call this function to prompt the wallet extension to get connection authorization from user
         */
        connectLocalWallet: () => {
          if (this.config.debug) console.log("trying to connect locally");
          if (!this.walletFound)
            throw new Error(
              "No wallets found cant connect locally, use pairing string"
            );
          this.hashconnect.connectToLocalWallet(pairingString);
        },
      };
    }
  }

  public async requestAdditionalAccounts() {
    const savedState = await this.load();
    if (
      !this.isStateValid(savedState) ||
      this.status !== LibLoginTypes.Status.Disconnected
    ) {
      throw new Error(" no account paired ");
      return;
    }
    if (this.config.debug) console.log("getting additional accounts");
    const response = await this.hashconnect.requestAdditionalAccounts(
      savedState.state.topic,
      {
        topic: savedState.state.topic,
        network: this.config.network,
        multiAccount: this.config.multiAccount,
      }
    );
    if (this.config.debug) console.log("got additional accounts response");
    this.onAdditionalAccountResponse(response);
  }

  /**
   * Used for disconnecting the wallet and deleting local wallet state
   */
  public async disconnect() {
    this.updateStatus(LibLoginTypes.Status.Disconnected);
    await this.clear();
    return;
  }

  /**
    Hashconnect instance, not recommended until and unless provided methods do not suffice
  */
  public get HCI() {
    return this.hashconnect;
  }

  /**
   * @returns accountIds that are currently connected that could be used for transactions
   */
  public async accounts() {
    const savedState = await this.load();
    if (!this.isStateValid(savedState)) throw new Error("No accounts paired");
    return savedState.pairedAccounts;
  }

  // User provided hooks for handling hashconnect events
  /**
   * Runs after user connects wallet for first time
   * @param accountIds list of all accounts selected for connection by user
   * @param pairingData Hashconnect specific ApprovePairing
   */
  private onPair(
    accountIds: string[],
    pairingData: MessageTypes.ApprovePairing
  ): void {
    this.emit("pair", { accountIds, pairingData })
  }

  /**
   * Runs each time a wallet extension is found
   */
  private onWalletsFound(walletMetadata: HashConnectTypes.WalletMetadata): void {
    this.emit('walletsFound', walletMetadata)
  }

  private onAdditionalAccountResponse(
    data: MessageTypes.AdditionalAccountResponse
  ): void { }

  /**
   * Similar to onPair hook but also runs for subsequent connections
   */
  private onWalletConnect(accountIds: string[]): void {
    this.emit("walletConnect", { accountIds })
  }
  /**
   * Runs on connection status change with hashconnect relay nodes
   */
  private onConnectionStateChange(status: LibLoginTypes.ConnectionState): void {
    this.emit("connectionStateChange", status)
  }
  /**
   * LibLogin specific status hooks. Called when wallet connected, not found, *  ,not connected or some error occurs.
   */
  private onStatusChange(status: LibLoginTypes.Status): void {
    this.emit("statusChange", status)
  }
}

