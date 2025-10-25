#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const io = require('socket.io-client');

const ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'server', 'server.ts');

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function run() {
  console.log('Integration test: starting server (ts-node/register)');

  // preflight: ensure ts-node is installed
  try {
    require.resolve('ts-node');
  } catch (err) {
    console.error('ts-node not found. Please install dev dependency: npm install --save-dev ts-node');
    process.exit(2);
  }

  // use transpile-only register to avoid compile-time type errors blocking runtime test
  // spawn via npx ts-node to ensure proper CLI loader is used
  const serverProc = spawn('npx', ['ts-node', SERVER_PATH], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  serverProc.stdout.on('data', (d) => process.stdout.write(`[server] ${d.toString()}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`[server.err] ${d.toString()}`));

  // give server a moment to start
  await wait(700);

  const url = 'http://localhost:3001';

  const a = io.connect(url, { reconnectionDelay: 0, forceNew: true });
  const b = io.connect(url, { reconnectionDelay: 0, forceNew: true });

  try {
    await Promise.all([
      new Promise(res => a.on('connect', res)),
      new Promise(res => b.on('connect', res))
    ]);

    console.log('Both clients connected');

    const room = await new Promise((resolve, reject) => {
      a.emit('create-room', { playerName: 'Attacker', gameType: 'normal' });
      a.once('room-created', (msg) => resolve(msg.room));
      setTimeout(() => reject(new Error('room-create timeout')), 2000);
    });

    console.log('Room created:', room.id);

    // join with defender
    await new Promise((resolve, reject) => {
      b.emit('join-room', { roomId: room.id, playerName: 'Defender' });
      b.once('room-joined', () => resolve());
      setTimeout(() => reject(new Error('join-room timeout')), 2000);
    });

    console.log('Defender joined');

    // get latest room info by requesting rooms-list or listening to room-updated
    // rely on server's room map: attacker is host and attacker id is room.players[0].id
    // need to wait a tick for server to populate defender into room.players
    await wait(300);

    // fetch room list to get updated players
    const fetchedRoom = await new Promise((resolve, reject) => {
      a.once('rooms-list', (data) => {
        const found = (data.rooms || []).find(r => r.id === room.id);
        if (found) resolve(found); else reject(new Error('room not found in rooms-list'));
      });
      a.emit('get-rooms', {});
      setTimeout(() => reject(new Error('get-rooms timeout')), 1500);
    }).catch(() => room); // fallback to original

    // get attacker and defender ids from current room object if possible
    const attackerId = (fetchedRoom.players && fetchedRoom.players[0] && fetchedRoom.players[0].id) || room.players[0].id;
    const defenderId = (fetchedRoom.players && fetchedRoom.players[1] && fetchedRoom.players[1].id) || (room.players[1] && room.players[1].id) || null;

    if (!defenderId) {
      console.error('Could not determine defender id, aborting');
      process.exit(2);
    }

    // start game as host
    a.emit('start-game', { roomId: room.id });

    await new Promise((resolve, reject) => {
      a.once('game-starting', () => resolve());
      setTimeout(() => reject(new Error('start-game timeout')), 2000);
    });

    console.log('Game started, performing attack sequence');

    // Prepare promise to await attack-resolved
    const attackResolvedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('attack-resolved timeout')), 5000);
      a.once('attack-resolved', (resolved) => { clearTimeout(timeout); resolve(resolved); });
      b.once('attack-resolved', (resolved) => { /* noop */ });
    });

    // Defender listener for defend-request -> respond immediately with empty defense
    b.once('defend-request', (data) => {
      console.log('Defender received defend-request', data.requestId);
      b.emit('player-defend', { roomId: room.id, requestId: data.requestId, defenderId, cards: [], defense: 0 });
    });

    // send attack from attacker
    const requestId = 'itest_' + Date.now();
    a.emit('player-attack', { roomId: room.id, attackerId, targetId: defenderId, cards: [], damage: 12, requestId });

    const resolved = await attackResolvedPromise;
    console.log('attack-resolved received:', resolved);

    if (resolved && resolved.requestId === requestId) {
      console.log('Integration test SUCCESS: requestId matched and resolved');
    } else {
      console.error('Integration test FAILED: requestId mismatch or no resolved');
      process.exit(3);
    }

    // cleanup
    a.disconnect(); b.disconnect();
    serverProc.kill();
    process.exit(0);
  } catch (err) {
    console.error('Integration test error:', err && err.stack ? err.stack : err);
    try { a.disconnect(); b.disconnect(); } catch(e){}
    serverProc.kill();
    process.exit(5);
  }
}

run();
