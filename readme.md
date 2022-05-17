# liblogin-client

---

> ## This package is part of Liblogin

### `For use on client side only!!`
For server side use [LibLoginServer](https://www.npmjs.com/package/liblogin-serv)
#### Contents of LibLogin ->

- ###### [BaseWallet](#basewallet-class) `Class` 
- ###### [Wallet](#wallet-class) `Class`
- ###### [LibLoginEvents](#libloginevents) `Type`
- ###### [Status](#status) `Type`


## How to connect

```typescript
import { Wallet, LibLoginTypes } from "liblogin-client";

const AppMetaData = {
  name: "LibLogin",
  description: "LibLogin is login solution for hedera",
  icon: "",
};

const wallet = new Wallet(AppMetaData, {
  debug: false,
  multiAccount: true,
  network: "testnet",
});

const walletsMeta: LibLoginTypes.WalletMetadata[] = [];

wallet.on("walletsFound", (walletMeta) => {
  walletsMeta.push(walletMeta);
  console.log("found wallet", walletMeta);
});

wallet.on("statusChange", (status) => {
  console.log(status);
});

/** fired only on initial pair*/

wallet.on("pair", (val) => {
  console.log("paired and here is the data", val);
});

const connectedAccountIds: string[] = [];

/** @type account ids of all accounts the user connected*/
/** fired on initial pair and subsequent pairs*/
wallet.on("walletConnect", (accountIds) => {
  connectedAccountIds.push(...accountIds);
  console.log("wallet connected by", accountIds);
});

export { wallet };

///// otherfile.ts

// find all wallet extensions, walletsFound event emiited
// wrapper around hashconnect.findLocalWallets
wallet.init();

/** @type walletMetadata is one of wallets provided by walletsFound event*/
const connectData = await wallet.connect(walletMetadata);

// if initial pair
const { pairingString, connectLocalWallet } = connectData;

/** wallet.connect will automatically connect with previosuly
 * paired data and emit walletConnect with all account IDs
 */
```

For all available events see [LibLoginEvents](#libloginevents)

### How to send transaction

```typescript
const resp = await wallet.sendTransaction(
  Transaction /* Transaction or UInt8Array */,
  {
    accountToSign:
      await wallet.accounts()[0] /** or select a account id provided by walletConnect event*/,
    getRecord: true,
    returnTransaction: false,
  }
);
if (resp.success) {
  const receipt = TransactionReceipt.fromBytes(resp.receipt!);
}
```

## How to authenticate

```typescript
/** @type payloadToSign is generated by server using liblogin-server */
/** https://www.npmjs.com/package/liblogin-serv */
const { serverSig, payload } = payloadToSign;

const authResp = await wallet.authenticate({
  accountToAuthenticate: await wallet.accounts()[0],
  serverAccountId: ServerAccountId,
  payload: payload,
  serverSig: serverSig,
});
if (authResp.success) {
  const { userSignature, signedPayload } = authResp;

  /** send userSignature and signedPayload on backend and let liblogin-server take care of the rest*/
}
```

- ## All signatures in liblogin are by default base64 encoded
- ## All signed transactions returned through liblogin are UInt8Arrays
- ## All receipts returned are also in UInt8Array format

### `BaseWallet` Class

#### It's an abstract class that encapsulates most of hashpack logic except the storage mechanism used. For which it needs 3 functions

```typescript
/**
 * @param data hashconnect state that needs to be persisted
 * the storage mechanism could be anything it
 * could be a backend server, localstorage , or a mock function
*/
protected abstract store(data: LibLoginTypes.WalletState): Promise<LibLoginTypes.WalletState>;

/** load the state this is called anytime hashconnect needs state.
 *  If using servers to store state use cacheing
 *  to prevent requests for stale data
 * */

protected abstract load(): Promise<LibLoginTypes.WalletState | null>;

// clear the state
protected abstract clear(): Promise<void>;
```

```typescript
export declare abstract class BaseWallet extends EventEmitter<LibLoginTypes.LibLoginEvents> {
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
  /**
   * Array of all wallets found. Do not use this
   * directly instead use on WalletsFound event since this
   * is all asynchronous there is no way to know when wallets
   * are added to array "initially"
   */
  wallets: HashConnectTypes.WalletMetadata[];

  constructor(
    AppMetaData: HashConnectTypes.AppMetadata,
    config: {
      network: LibLoginTypes.Network;
      debug: boolean;
      multiAccount: boolean;
    }
  );
  /**
   * Starts looking for local wallets. Wallets are only found
   * in https, use pairing string for http or unsupported platforms
   */
  init(): void;
  findLocalWallets(): void;

  sendTransaction: (
    transaction: Transaction | Uint8Array,
    options: MessageTypes.TransactionMetadata
  ) => Promise<{
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
  connect(walletToConnect?: HashConnectTypes.WalletMetadata): Promise<
    | undefined
    | {
        pairingString: string;
        connectLocalWallet: Function;
      }
  >;
  /**
   * Used for disconnecting the wallet and clearing local wallet state
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
}
```

### `Wallet Class`

#### Wallet class extends BaseWallet and provides localstorage based storage mechanism which is what mostly people would use.

`But its evident we can use anything to persists the data not just local storage, below is a implementation example`

```typescript
export class Wallet extends BaseWallet {
  private localStorageKey = "state";

  private cache: LibLoginTypes.WalletState | null = null;

  private updateCacheAndReturn(data: LibLoginTypes.WalletState) {
    this.cache = data;
    return data;
  }

  public setLocalStorageKey(key: string) {
    this.localStorageKey = this.localStorageKey;
  }

  protected store = async (
    data: LibLoginTypes.WalletState
  ): Promise<LibLoginTypes.WalletState> => {
    localStorage.setItem(this.localStorageKey, JSON.stringify(data));
    return this.updateCacheAndReturn(data);
  };

  protected load = async (): Promise<LibLoginTypes.WalletState | null> => {
    if (this.cache) return this.cache;
    const state = localStorage.getItem(this.localStorageKey);
    let data: LibLoginTypes.WalletState | null;
    if (!state) return null;
    try {
      data = JSON.parse(state);
    } catch (err) {
      console.log(err);
      data = null;
      return data;
    }
    return this.updateCacheAndReturn(data!);
  };

  protected async clear(): Promise<void> {
    localStorage.removeItem(this.localStorageKey);
    this.cache = null;
    return;
  }
}
```

##

### `LibLoginEvents`

##

```typescript
interface LibLoginEvents {
  pair: {
    accountIds: string[];
    pairingData: MessageTypes.ApprovePairing;
  };
  walletsFound: HashConnectTypes.WalletMetadata;
  walletConnect: {
    accountIds: string[];
  };
  connectionStateChange: LibLoginTypes.ConnectionState;
  statusChange: LibLoginTypes.Status;
}
```

##

### `Status`

##

```typescript
enum Status {
  Connected = "connected",
  Error = "error",
  NoWallet = "wallet-not-found",
  Disconnected = "not-connected",
}
```
