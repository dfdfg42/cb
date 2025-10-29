/**
 * EventEmitter - 간단한 이벤트 발행/구독 시스템
 * 게임 내 이벤트를 관리하기 위한 퍼블리셔-구독자 패턴 구현
 */
export class EventEmitter {
    private events: Map<string, Array<(...args: any[]) => void>>;

    constructor() {
        this.events = new Map();
    }

    /**
     * 이벤트 구독
     */
    public on(event: string, callback: (...args: any[]) => void): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(callback);
    }

    /**
     * 일회성 이벤트 구독
     */
    public once(event: string, callback: (...args: any[]) => void): void {
        const wrappedCallback = (...args: any[]) => {
            callback(...args);
            this.off(event, wrappedCallback);
        };
        this.on(event, wrappedCallback);
    }

    /**
     * 이벤트 구독 해제
     */
    public off(event: string, callback: (...args: any[]) => void): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 이벤트 발행
     */
    public emit(event: string, ...args: any[]): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * 모든 구독 해제
     */
    public removeAllListeners(event?: string): void {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * 이벤트에 등록된 리스너 수 반환
     */
    public listenerCount(event: string): number {
        const callbacks = this.events.get(event);
        return callbacks ? callbacks.length : 0;
    }
}
