export declare class EventEmitter<T> {
    private handlers;
    constructor();
    emit<K extends keyof T>(event: K, value: T[K]): void;
    on<K extends keyof T>(event: K, handler: (value: T[K]) => void): void;
}
