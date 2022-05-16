export var LibLoginTypes;
(function (LibLoginTypes) {
    let Status;
    (function (Status) {
        Status["Connected"] = "connected";
        Status["Error"] = "error";
        Status["NoWallet"] = "wallet-not-found";
        Status["Disconnected"] = "not-connected";
    })(Status = LibLoginTypes.Status || (LibLoginTypes.Status = {}));
    let ConnectionState;
    (function (ConnectionState) {
        ConnectionState["Connected"] = "Connected";
        ConnectionState["Disconnected"] = "Disconnected";
    })(ConnectionState = LibLoginTypes.ConnectionState || (LibLoginTypes.ConnectionState = {}));
})(LibLoginTypes || (LibLoginTypes = {}));
export default LibLoginTypes;
