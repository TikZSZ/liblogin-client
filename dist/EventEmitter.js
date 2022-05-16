export class EventEmitter {
    handlers;
    constructor() {
        this.handlers = {};
    }
    emit(event, value) {
        this.handlers[event]?.forEach(h => h(value));
    }
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [handler];
        }
        else {
            this.handlers[event].push(handler);
        }
    }
}
