import { GameState, PlayerState, Card } from '../types/gameTypes';

export interface NetworkEvent {
  type: string;
  data: any;
}

export class NetworkManager {
  private socket!: WebSocket;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.connect();
  }

  // 소켓 연결
  private connect(): void {
    this.socket = new WebSocket(this.serverUrl);
    this.setupSocketListeners();
  }

  // 소켓 리스너 설정
  private setupSocketListeners(): void {
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connection_established', null);
    };

    this.socket.onclose = () => {
      this.handleDisconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('connection_error', error);
    };

    this.socket.onmessage = (message) => {
      try {
        const event: NetworkEvent = JSON.parse(message.data);
        this.handleEvent(event);
      } catch (error) {
        console.error('Message parsing error:', error);
      }
    };
  }

  // 연결 끊김 처리 및 재연결
  private handleDisconnect(): void {
    this.emit('connection_lost', null);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 1000 * Math.pow(2, this.reconnectAttempts);
      this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

      setTimeout(() => {
        this.connect(); // ✅ 새 WebSocket 객체 생성
      }, delay);
    } else {
      this.emit('reconnect_failed', null);
    }
  }

  // 이벤트 전송
  send(event: NetworkEvent): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    } else {
      console.warn('Socket not open, queuing or dropping event:', event.type);
      this.emit('send_failed', event);
    }
  }

  // 이벤트 핸들러 등록
  on(eventType: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  // 이벤트 발생
  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // 서버에서 수신한 이벤트 처리
  private handleEvent(event: NetworkEvent): void {
    this.emit(event.type, event.data);
  }

  // 게임 상태 동기화
  syncGameState(state: GameState): void {
    this.send({ type: 'sync_game_state', data: state });
  }

  // 카드 사용 이벤트
  sendCardPlay(playerId: string, cards: Card[], targetId?: string): void {
    this.send({ type: 'play_cards', data: { playerId, cards, targetId } });
  }

  // 턴 종료 이벤트
  sendTurnEnd(playerId: string): void {
    this.send({ type: 'turn_end', data: { playerId } });
  }

  // 준비 상태 변경
  sendReadyState(playerId: string, isReady: boolean): void {
    this.send({ type: 'ready_state_change', data: { playerId, isReady } });
  }

  // 게임 종료 이벤트
  sendGameEnd(winner: PlayerState): void {
    this.send({ type: 'game_end', data: { winner } });
  }

  // 연결 종료
  disconnect(): void {
    this.socket.close();
  }
}
