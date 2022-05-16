import type { MessageTypes, HashConnectTypes } from "hashconnect";
export declare namespace LibLoginTypes {
    interface WalletState {
        privKey: string;
        state: HashConnectTypes.ConnectionState;
        pairedWalletData?: HashConnectTypes.WalletMetadata;
        pairedAccounts: string[];
    }
    type Network = "mainnet" | "testnet";
    enum Status {
        Connected = "connected",
        Error = "error",
        NoWallet = "wallet-not-found",
        Disconnected = "not-connected"
    }
    enum ConnectionState {
        Connected = "Connected",
        Disconnected = "Disconnected"
    }
    interface AuthResponse extends MessageTypes.AuthenticationResponse {
        userSignature?: string;
        signedPayload?: {
            serverSignature: string;
            originalPayload: {
                url: string;
                data: any;
            };
        };
    }
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
    interface WalletMetadata extends HashConnectTypes.WalletMetadata {
    }
}
export default LibLoginTypes;
