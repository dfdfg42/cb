import { io, Socket } from 'socket.io-client';

// 소켓 클라이언트 타입
interface ServerRoom {
    id: string;
    name: string;
    players: ServerPlayer[];
    maxPlayers: number;
    gameType: 'normal' | 'ranked';
    isPlaying: boolean;
    hostId: string;
}

interface ServerPlayer {
    id: string;
    socketId: string;
    name: string;
    isReady: boolean;
}

export class SocketClient {
    private static instance: SocketClient;
    private socket: Socket | null = null;
    private serverUrl: string = 'http://localhost:3001';
    private currentRoomId: string | null = null;
    private playerName: string = '';

    // 이벤트 콜백
    private onRoomCreated?: (data: { roomId: string, room: ServerRoom }) => void;
    private onRoomJoined?: (data: { roomId: string, room: ServerRoom }) => void;
    private onRoomUpdated?: (data: { room: ServerRoom }) => void;
    private onGameStarting?: (data: { room: ServerRoom }) => void;
    private onGameAction?: (action: any) => void;
    private onError?: (data: { message: string }) => void;
    private onPlayerDisconnected?: (data: { playerName: string }) => void;
    private onPlayerAttack?: (data: any) => void;
    private onAttackResolved?: (data: any) => void;
    private onDefendRequest?: (data: any) => void;
    private onAttackAnnounced?: (data: any) => void;
    private onPlayerDefend?: (data: any) => void;
    private onTurnEnd?: (data: any) => void;
    private onTurnStart?: (data: any) => void;
    private onSpecialEvent?: (data: any) => void;
    private onPlayerStateUpdate?: (data: any) => void;
    private onGameOver?: (data: any) => void;
    private onRoomsList?: (data: { rooms: ServerRoom[] }) => void;

    private constructor() {}

    public static getInstance(): SocketClient {
        if (!SocketClient.instance) {
            SocketClient.instance = new SocketClient();
        }
        return SocketClient.instance;
    }

    // 서버 연결
    public connect(playerName: string): void {
        if (this.socket?.connected) {
            console.log('이미 서버에 연결되어 있습니다.');
            return;
        }

        this.playerName = playerName;
        this.socket = io(this.serverUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        this.setupEventListeners();
        console.log('🔌 서버 연결 시도...');
    }

    // 연결 해제
    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.currentRoomId = null;
            console.log('🔌 서버 연결 해제');
        }
    }

    // 방 생성
    public createRoom(gameType: 'normal' | 'ranked'): void {
        if (!this.socket?.connected) {
            console.error('서버에 연결되지 않았습니다.');
            return;
        }

        this.socket.emit('create-room', {
            playerName: this.playerName,
            gameType
        });
    }

    // 방 참가
    public joinRoom(roomId: string): void {
        if (!this.socket?.connected) {
            console.error('서버에 연결되지 않았습니다.');
            return;
        }

        this.socket.emit('join-room', {
            roomId,
            playerName: this.playerName
        });
    }

    // 방 나가기
    public leaveRoom(): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('leave-room', {
            roomId: this.currentRoomId
        });

        this.currentRoomId = null;
    }

    // 준비 상태 토글
    public toggleReady(): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('toggle-ready', {
            roomId: this.currentRoomId
        });
    }

    // 게임 시작
    public startGame(): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('start-game', {
            roomId: this.currentRoomId
        });
    }

    // 게임 액션 전송
    public sendGameAction(action: any): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('game-action', {
            roomId: this.currentRoomId,
            action
        });
    }

    // 공격 액션 전송
    public sendAttack(attackerId: string, targetId: string, cards: any[], damage: number): string | null {
        if (!this.socket?.connected || !this.currentRoomId) return null;

        const requestId = this.generateRequestId();

        this.socket.emit('player-attack', {
            requestId,
            roomId: this.currentRoomId,
            attackerId,
            targetId,
            cards,
            damage
        });

        return requestId;
    }

    private generateRequestId(): string {
        // Prefer standard Web Crypto API if available (browser). Avoid requiring Node's 'crypto' here
        try {
            const webCrypto = (globalThis as any).crypto;
            if (webCrypto && typeof webCrypto.randomUUID === 'function') {
                return webCrypto.randomUUID();
            }
        } catch (e) {
            // ignore
        }

        // Fallback simple random id (safe for browser/Node bundlers)
        return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
    }

    // 방어 액션 전송
    public sendDefend(defenderId: string, cards: any[], defense: number): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('player-defend', {
            roomId: this.currentRoomId,
            defenderId,
            cards,
            defense
        });
    }

    // send defend with requestId (server uses requestId to match pending attack)
    public sendDefendWithRequest(requestId: string, defenderId: string, cards: any[], defense: number): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('player-defend', {
            roomId: this.currentRoomId,
            requestId,
            defenderId,
            cards,
            defense
        });
    }

    // 턴 종료 전송
    public sendTurnEnd(playerId: string, nextPlayerId: string): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('turn-end', {
            roomId: this.currentRoomId,
            playerId,
            nextPlayerId
        });
    }

    // 특수 이벤트 전송
    public sendSpecialEvent(eventType: string, eventData: any): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('special-event', {
            roomId: this.currentRoomId,
            eventType,
            eventData
        });
    }

    // 플레이어 상태 업데이트 전송
    public sendPlayerStateUpdate(playerId: string, health: number, mentalPower: number, cards: any[]): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('player-state-update', {
            roomId: this.currentRoomId,
            playerId,
            health,
            mentalPower,
            cards
        });
    }

    // 게임 종료 전송
    public sendGameOver(winnerId: string, stats: any): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('game-over', {
            roomId: this.currentRoomId,
            winnerId,
            stats
        });
    }

    // 방 목록 요청
    public getRooms(gameType?: 'normal' | 'ranked'): void {
        if (!this.socket?.connected) return;
        this.socket.emit('get-rooms', { gameType });
    }

    // 이벤트 리스너 설정
    private setupEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ 서버 연결 성공');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ 서버 연결 해제');
        });

        this.socket.on('room-created', (data) => {
            this.currentRoomId = data.roomId;
            console.log('🏠 방 생성:', data.roomId);
            this.onRoomCreated?.(data);
        });

        this.socket.on('room-joined', (data) => {
            this.currentRoomId = data.roomId;
            console.log('👤 방 참가:', data.roomId);
            this.onRoomJoined?.(data);
        });

        this.socket.on('room-updated', (data) => {
            console.log('🔄 방 업데이트');
            this.onRoomUpdated?.(data);
        });

        this.socket.on('game-starting', (data) => {
            console.log('🎮 게임 시작!');
            this.onGameStarting?.(data);
        });

        this.socket.on('game-action', (action) => {
            console.log('🎯 게임 액션 수신:', action);
            this.onGameAction?.(action);
        });

        this.socket.on('player-attack', (data) => {
            console.log('⚔️ 공격 수신:', data);
            this.onPlayerAttack?.(data);
        });

        this.socket.on('defend-request', (data) => {
            console.log('🛡️ defend-request 수신:', data);
            this.onDefendRequest?.(data);
        });

        this.socket.on('attack-announced', (data) => {
            console.log('📣 attack-announced:', data);
            this.onAttackAnnounced?.(data);
        });

        this.socket.on('attack-resolved', (data) => {
            console.log('✅ attack-resolved 수신:', data);
            this.onAttackResolved?.(data);
        });

        this.socket.on('player-defend', (data) => {
            console.log('🛡️ 방어 수신:', data);
            this.onPlayerDefend?.(data);
        });

        this.socket.on('turn-end', (data) => {
            console.log('🔄 턴 종료 수신:', data);
            this.onTurnEnd?.(data);
        });

        this.socket.on('turn-start', (data) => {
            console.log('🔄 턴 시작 수신:', data);
            this.onTurnStart?.(data);
        });

        this.socket.on('special-event', (data) => {
            console.log('✨ 특수 이벤트 수신:', data);
            this.onSpecialEvent?.(data);
        });

        this.socket.on('player-state-update', (data) => {
            console.log('📊 플레이어 상태 업데이트:', data);
            this.onPlayerStateUpdate?.(data);
        });

        this.socket.on('game-over', (data) => {
            console.log('🏁 게임 종료:', data);
            this.onGameOver?.(data);
        });

        this.socket.on('player-disconnected', (data) => {
            console.log('👋 플레이어 연결 해제:', data.playerName);
            this.onPlayerDisconnected?.(data);
        });

        this.socket.on('error', (data) => {
            console.error('⚠️ 에러:', data.message);
            this.onError?.(data);
        });

        this.socket.on('rooms-list', (data) => {
            console.log('📋 방 목록:', data.rooms);
            this.onRoomsList?.(data);
        });
    }

    // 콜백 설정 메서드
    public setOnRoomCreated(callback: (data: { roomId: string, room: ServerRoom }) => void): void {
        this.onRoomCreated = callback;
    }

    public setOnRoomJoined(callback: (data: { roomId: string, room: ServerRoom }) => void): void {
        this.onRoomJoined = callback;
    }

    public setOnRoomUpdated(callback: (data: { room: ServerRoom }) => void): void {
        this.onRoomUpdated = callback;
    }

    public setOnGameStarting(callback: (data: { room: ServerRoom }) => void): void {
        this.onGameStarting = callback;
    }

    public setOnRoomsList(callback: (data: { rooms: ServerRoom[] }) => void): void {
        this.onRoomsList = callback;
    }

    public setOnGameAction(callback: (action: any) => void): void {
        this.onGameAction = callback;
    }

    public setOnDefendRequest(callback: (data: any) => void): void {
        this.onDefendRequest = callback;
    }

    public setOnAttackAnnounced(callback: (data: any) => void): void {
        this.onAttackAnnounced = callback;
    }

    public setOnError(callback: (data: { message: string }) => void): void {
        this.onError = callback;
    }

    public setOnPlayerDisconnected(callback: (data: { playerName: string }) => void): void {
        this.onPlayerDisconnected = callback;
    }

    public setOnPlayerAttack(callback: (data: any) => void): void {
        this.onPlayerAttack = callback;
    }

    public setOnAttackResolved(callback: (data: any) => void): void {
        this.onAttackResolved = callback;
    }

    public setOnPlayerDefend(callback: (data: any) => void): void {
        this.onPlayerDefend = callback;
    }

    public setOnTurnEnd(callback: (data: any) => void): void {
        this.onTurnEnd = callback;
    }

    public setOnTurnStart(callback: (data: any) => void): void {
        this.onTurnStart = callback;
    }

    public setOnSpecialEvent(callback: (data: any) => void): void {
        this.onSpecialEvent = callback;
    }

    public setOnPlayerStateUpdate(callback: (data: any) => void): void {
        this.onPlayerStateUpdate = callback;
    }

    public setOnGameOver(callback: (data: any) => void): void {
        this.onGameOver = callback;
    }

    // Getter
    public isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    public getCurrentRoomId(): string | null {
        return this.currentRoomId;
    }
}

export const socketClient = SocketClient.getInstance();
