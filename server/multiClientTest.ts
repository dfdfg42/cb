import { io, Socket } from 'socket.io-client';

type Mode = 'normal' | 'ranked';

const SERVER_URL = 'http://localhost:3001';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runClient(name: string, mode: Mode, waitBeforeConnect = 0) {
    await sleep(waitBeforeConnect);
    const socket: Socket = io(SERVER_URL, { reconnection: false });

    socket.on('connect', () => {
        console.log(`[${name}] connected -> ${socket.id}`);
        socket.emit('get-rooms', { gameType: mode });
    });

    socket.on('connect_error', (err) => {
        console.error(`[${name}] connect_error:`, err);
    });

    socket.on('connect_timeout', () => {
        console.error(`[${name}] connect_timeout`);
    });

    socket.on('rooms-list', (data: { rooms: any[] }) => {
        console.log(`[${name}] rooms-list: ${data.rooms.map(r => r.id + '(' + r.players.length + '/' + r.maxPlayers + ')').join(', ')}`);

        const target = data.rooms.find(r => r.gameType === mode && r.players.length < r.maxPlayers && !r.isPlaying);
        if (target) {
            console.log(`[${name}] joining existing room ${target.id}`);
            socket.emit('join-room', { roomId: target.id, playerName: name });
        } else {
            console.log(`[${name}] creating new room`);
            socket.emit('create-room', { playerName: name, gameType: mode });
        }
    });

    socket.on('room-created', (data) => {
        console.log(`[${name}] room-created: ${data.roomId}`);
    });

    socket.on('room-joined', (data) => {
        console.log(`[${name}] room-joined: ${data.roomId}`);
    });

    socket.on('room-updated', (data) => {
        console.log(`[${name}] room-updated: players=${data.room.players.map((p:any) => p.name).join(', ')}`);
        // If this client is the host (first player)
        try {
            const me = data.room.players.find((p: any) => p.socketId === socket.id);
            if (me && data.room.players.length >= 2 && data.room.players[0].id === me.id) {
                // If the room hasn't started yet, wait shortly to allow others to ready, then start
                if (!data.room.isPlaying) {
                    console.log(`[${name}] will attempt start-game for room ${data.room.id} shortly`);
                    setTimeout(() => {
                        try {
                            console.log(`[${name}] starting game for room ${data.room.id}`);
                            socket.emit('start-game', { roomId: data.room.id });
                        } catch (e) {}
                    }, 600);
                    return;
                }

                // pick a random target that's not the attacker
                const targets = data.room.players.filter((p: any) => p.id !== me.id && p.isAlive !== false);
                if (targets.length > 0) {
                    const target = targets[Math.floor(Math.random() * targets.length)];
                    const reqId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2,6)}`;
                    const cards = [{ id: 'test-card-1', name: 'Sim Strike', damage: 5 }];
                    const damage = 5;
                    console.log(`[${name}] sending test attack ${me.id} -> ${target.id} (req=${reqId})`);
                    setTimeout(() => {
                        socket.emit('player-attack', { requestId: reqId, roomId: data.room.id, attackerId: me.id, targetId: target.id, cards, damage });
                    }, 300 + Math.random() * 500);
                }
            }
        } catch (e) {
            // ignore
        }
    });

    socket.on('attack-resolved', (data) => {
        console.log(`[${name}] attack-resolved:`, data);
    });

    socket.on('error', (err) => {
        console.error(`[${name}] error:`, err);
    });

    // keep connection for a short while then disconnect
    setTimeout(() => {
        console.log(`[${name}] disconnecting`);
        socket.disconnect();
    }, 8000 + Math.floor(Math.random() * 4000));
}

async function main() {
    console.log('Starting multi-client test...');

    // Launch 10 clients to stress-test room allocation (max 4 per room)
    const clientCount = 10;
    for (let i = 0; i < clientCount; i++) {
        const name = `TestUser${i + 1}`;
        // stagger connections to avoid exact simultaneous bursts
        const delay = i * 200; // 0ms, 200ms, 400ms, ...
        runClient(name, 'normal', delay);
    }

    // allow test to run
    // 충분히 기다려 모든 이벤트 흐름을 관찰
    await sleep(45000);
    console.log('Test finished.');
}

main().catch(err => {
    console.error('Test script error:', err);
    process.exit(1);
});
