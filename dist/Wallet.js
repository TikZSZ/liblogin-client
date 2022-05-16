import { BaseWallet } from "./BaseWallet.js";
export class Wallet extends BaseWallet {
    localStorageKey = "state";
    cache = null;
    constructor(AppMetaData, config) {
        super(AppMetaData, config);
    }
    updateCacheAndReturn(data) {
        this.cache = data;
        return data;
    }
    setLocalStorageKey(key) {
        this.localStorageKey = this.localStorageKey;
    }
    store = async (data) => {
        localStorage.setItem(this.localStorageKey, JSON.stringify(data));
        return this.updateCacheAndReturn(data);
    };
    load = async () => {
        if (this.cache)
            return this.cache;
        const state = localStorage.getItem(this.localStorageKey);
        let data;
        if (!state)
            return null;
        try {
            data = JSON.parse(state);
        }
        catch (err) {
            console.log(err);
            data = null;
            return data;
        }
        return this.updateCacheAndReturn(data);
    };
    async clear() {
        localStorage.removeItem(this.localStorageKey);
        this.cache = null;
        return;
    }
}
export default Wallet;
