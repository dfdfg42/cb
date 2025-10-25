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
