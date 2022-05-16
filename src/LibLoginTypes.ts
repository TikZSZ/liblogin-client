import type {MessageTypes,HashConnectTypes} from "hashconnect"

export namespace LibLoginTypes {
  export interface WalletState {
    privKey: string;
    state: HashConnectTypes.ConnectionState;
    pairedWalletData?: HashConnectTypes.WalletMetadata;
    pairedAccounts: string[];
  }
  export type Network = "mainnet" | "testnet";
  export enum Status {
    Connected = "connected",
    Error = "error",
    NoWallet = "wallet-not-found",
    Disconnected = "not-connected"
  }
  export enum ConnectionState {
    Connected = "Connected",
    Disconnected = "Disconnected",
  }

  export interface AuthResponse extends MessageTypes.AuthenticationResponse {
    userSignature?: string,
    signedPayload?: {
      serverSignature: string;
      originalPayload: {
        url: string;
        data: any;
      };
    };
  }
  export interface LibLoginEvents {
    pair: {
      accountIds: string[],
      pairingData: MessageTypes.ApprovePairing
    },
    walletsFound: HashConnectTypes.WalletMetadata,
    walletConnect: { accountIds: string[] },
    connectionStateChange: LibLoginTypes.ConnectionState,
    statusChange: LibLoginTypes.Status
  }
  export interface WalletMetadata extends HashConnectTypes.WalletMetadata{} 
  
}

export default LibLoginTypes;
