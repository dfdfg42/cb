import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// 게임 세션 타입
interface Player {
    id: string;
    socketId: string;
    name: string;
    isReady: boolean;
}

interface Room {
    id: string;
    name: string;
    players: Player[];
    maxPlayers: number;
    gameType: 'normal' | 'ranked';
    isPlaying: boolean;
    hostId: string;
}

// 방 목록
const rooms = new Map<string, Room>();

// 유틸리티 함수
function generateRoomId(): string {
    // Use crypto.randomUUID when available for stable unique ids
    try {
        // Node 14.17+ has crypto.randomUUID
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const crypto = require('crypto');
        if (typeof crypto.randomUUID === 'function') {
            return `room_${crypto.randomUUID()}`;
        }
    } catch (e) {
        // ignore and fallback
    }

    // fallback to timestamp+random
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

io.on('connection', (socket: Socket) => {
    console.log(`✅ 클라이언트 연결: ${socket.id}`);

    // 방 생성
    socket.on('create-room', (data: { playerName: string, gameType: 'normal' | 'ranked' }) => {
        const roomId = generateRoomId();
        const player: Player = {
            id: `player_${Date.now()}`,
            socketId: socket.id,
            name: data.playerName,
            isReady: false
        };

        const room: Room = {
            id: roomId,
            name: `${data.playerName}의 방`,
            players: [player],
            maxPlayers: 4,
            gameType: data.gameType,
            isPlaying: false,
            hostId: player.id
        };

        rooms.set(roomId, room);
        socket.join(roomId);

        socket.emit('room-created', {
            roomId,
            room
        });

        console.log(`🏠 방 생성: ${roomId} by ${data.playerName}`);
    });

    // 방 참가
    socket.on('join-room', (data: { roomId: string, playerName: string }) => {
        const room = rooms.get(data.roomId);

        if (!room) {
            socket.emit('error', { message: '방을 찾을 수 없습니다.' });
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: '방이 가득 찼습니다.' });
            return;
        }

        if (room.isPlaying) {
            socket.emit('error', { message: '게임이 이미 시작되었습니다.' });
            return;
        }

        const player: Player = {
            id: `player_${Date.now()}`,
            socketId: socket.id,
            name: data.playerName,
            isReady: false
        };

        room.players.push(player);
        socket.join(data.roomId);

        // 방의 모든 플레이어에게 업데이트
        io.to(data.roomId).emit('room-updated', { room });

        socket.emit('room-joined', {
            roomId: data.roomId,
            room
        });

        console.log(`👤 ${data.playerName} 참가: ${data.roomId}`);
    });

    // 방 나가기
    socket.on('leave-room', (data: { roomId: string }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        socket.leave(data.roomId);

        // 방이 비었으면 삭제
        if (room.players.length === 0) {
            rooms.delete(data.roomId);
            console.log(`🗑️ 방 삭제: ${data.roomId}`);
        } else {
            // 호스트가 나갔으면 다음 플레이어가 호스트
            if (room.hostId === player.id) {
                room.hostId = room.players[0].id;
            }
            io.to(data.roomId).emit('room-updated', { room });
        }

        console.log(`👋 ${player.name} 퇴장: ${data.roomId}`);
    });

    // 준비 상태 토글
    socket.on('toggle-ready', (data: { roomId: string }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        player.isReady = !player.isReady;

        io.to(data.roomId).emit('room-updated', { room });

        console.log(`✋ ${player.name} 준비: ${player.isReady}`);
    });

    // 게임 시작
    socket.on('start-game', (data: { roomId: string }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.id !== room.hostId) {
            socket.emit('error', { message: '호스트만 게임을 시작할 수 있습니다.' });
            return;
        }

        // 모든 플레이어가 준비되었는지 확인 (호스트 제외)
        const allReady = room.players
            .filter(p => p.id !== room.hostId)
            .every(p => p.isReady);

        if (!allReady && room.players.length > 1) {
            socket.emit('error', { message: '모든 플레이어가 준비되지 않았습니다.' });
            return;
        }

        room.isPlaying = true;

        // 게임 시작 신호
        io.to(data.roomId).emit('game-starting', { room });

        console.log(`🎮 게임 시작: ${data.roomId}`);
    });

    // 게임 액션 (카드 사용, 공격 등)
    socket.on('game-action', (data: { roomId: string, action: any }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        // 모든 플레이어에게 액션 브로드캐스트
        socket.to(data.roomId).emit('game-action', data.action);
    });

    // 공격 액션
    socket.on('player-attack', (data: { roomId: string, attackerId: string, targetId: string, cards: any[], damage: number }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        console.log(`⚔️ 공격: ${data.attackerId} -> ${data.targetId}, 데미지: ${data.damage}`);
        io.to(data.roomId).emit('player-attack', data);
    });

    // 방어 액션
    socket.on('player-defend', (data: { roomId: string, defenderId: string, cards: any[], defense: number }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        console.log(`🛡️ 방어: ${data.defenderId}, 방어력: ${data.defense}`);
        io.to(data.roomId).emit('player-defend', data);
    });

    // 턴 종료
    socket.on('turn-end', (data: { roomId: string, playerId: string, nextPlayerId: string }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        console.log(`🔄 턴 종료: ${data.playerId} -> ${data.nextPlayerId}`);
        io.to(data.roomId).emit('turn-end', data);
    });

    // 특수 이벤트
    socket.on('special-event', (data: { roomId: string, eventType: string, eventData: any }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        console.log(`✨ 특수 이벤트: ${data.eventType}`);
        io.to(data.roomId).emit('special-event', data);
    });

    // 플레이어 상태 업데이트
    socket.on('player-state-update', (data: { roomId: string, playerId: string, health: number, mentalPower: number, cards: any[] }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        io.to(data.roomId).emit('player-state-update', data);
    });

    // 게임 종료
    socket.on('game-over', (data: { roomId: string, winnerId: string, stats: any }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        room.isPlaying = false;
        console.log(`🏁 게임 종료: ${data.roomId}, 승자: ${data.winnerId}`);
        io.to(data.roomId).emit('game-over', data);
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log(`❌ 클라이언트 연결 해제: ${socket.id}`);

        // 플레이어가 속한 방 찾기
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);

                // 방이 비었으면 삭제
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`🗑️ 방 삭제: ${roomId}`);
                } else {
                    // 호스트가 나갔으면 다음 플레이어가 호스트
                    if (room.hostId === player.id) {
                        room.hostId = room.players[0].id;
                    }
                    io.to(roomId).emit('room-updated', { room });
                    io.to(roomId).emit('player-disconnected', { playerName: player.name });
                }
                break;
            }
        }
    });

    // 방 목록 요청
    socket.on('get-rooms', (data?: { gameType?: 'normal' | 'ranked' }) => {
        let availableRooms = Array.from(rooms.values())
            .filter(room => !room.isPlaying && room.players.length < room.maxPlayers);

        // 선택한 gameType이 있으면 해당 타입의 방만 반환
        if (data && data.gameType) {
            availableRooms = availableRooms.filter(r => r.gameType === data.gameType);
        }

        socket.emit('rooms-list', { rooms: availableRooms });
    });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
