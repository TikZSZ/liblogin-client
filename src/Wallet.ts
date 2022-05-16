import type { HashConnectTypes } from "hashconnect";
import type {LibLoginTypes} from "./LibLoginTypes.js";
import { BaseWallet } from "./BaseWallet.js";

export class Wallet extends BaseWallet {
  private localStorageKey = "state";

  private cache: LibLoginTypes.WalletState | null = null

  constructor(
    AppMetaData: HashConnectTypes.AppMetadata,
    config: {
      network: LibLoginTypes.Network;
      debug: boolean;
      multiAccount: boolean;
    }
  ){
    super(AppMetaData,config)
  }

  private updateCacheAndReturn(data:LibLoginTypes.WalletState){
    this.cache = data
    return data
  }

  public setLocalStorageKey(key: string) {
    this.localStorageKey = this.localStorageKey;
  }

  protected store = async (
    data: LibLoginTypes.WalletState
  ): Promise<LibLoginTypes.WalletState> => {
    localStorage.setItem(this.localStorageKey, JSON.stringify(data));
    return this.updateCacheAndReturn(data)
  };

  protected load = async (): Promise<LibLoginTypes.WalletState | null> => {
    if(this.cache) return this.cache
    const state = localStorage.getItem(this.localStorageKey);
    let data: LibLoginTypes.WalletState | null;
    if (!state) return null;
    try {
      data = JSON.parse(state);
    } catch (err) {
      console.log(err);
      data = null;
      return data
    }
    return this.updateCacheAndReturn(data!)
  };

  protected async clear(): Promise<void> {
    localStorage.removeItem(this.localStorageKey);
    this.cache = null
    return
  }
}

export default Wallet

