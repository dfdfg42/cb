#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const io = require('socket.io-client');

const ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'server', 'server.ts');

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function run() {
  console.log('Bounce integration test: starting server (ts-node)');

  try {
    require.resolve('ts-node');
  } catch (err) {
    console.error('ts-node not found. Please install dev dependency: npm install --save-dev ts-node');
    process.exit(2);
  }

  const serverProc = spawn('npx', ['ts-node', SERVER_PATH], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  serverProc.stdout.on('data', (d) => process.stdout.write(`[server] ${d.toString()}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`[server.err] ${d.toString()}`));

  await wait(700);

  const url = 'http://localhost:3001';
  const a = io.connect(url, { reconnectionDelay: 0, forceNew: true });
  const b = io.connect(url, { reconnectionDelay: 0, forceNew: true });
  const c = io.connect(url, { reconnectionDelay: 0, forceNew: true });

  try {
    await Promise.all([
      new Promise(res => a.on('connect', res)),
      new Promise(res => b.on('connect', res)),
      new Promise(res => c.on('connect', res))
    ]);

    console.log('3 clients connected');

    const room = await new Promise((resolve, reject) => {
      a.emit('create-room', { playerName: 'Attacker', gameType: 'normal' });
      a.once('room-created', (msg) => resolve(msg.room));
      setTimeout(() => reject(new Error('room-create timeout')), 2000);
    });

    console.log('Room created:', room.id);

    await new Promise((resolve, reject) => {
      b.emit('join-room', { roomId: room.id, playerName: 'Defender' });
      b.once('room-joined', () => resolve());
      setTimeout(() => reject(new Error('join-room timeout')), 2000);
    });

    console.log('Defender joined');

    await new Promise((resolve, reject) => {
      c.emit('join-room', { roomId: room.id, playerName: 'Other' });
      c.once('room-joined', () => resolve());
      setTimeout(() => reject(new Error('join-room 3 timeout')), 2000);
    });

    console.log('Third player joined');

    await wait(300);

    const fetchedRoom = await new Promise((resolve, reject) => {
      a.once('rooms-list', (data) => {
        const found = (data.rooms || []).find(r => r.id === room.id);
        if (found) resolve(found); else resolve(room);
      });
      a.emit('get-rooms', {});
      setTimeout(() => resolve(room), 1500);
    });

    const players = fetchedRoom.players || room.players;
    const attackerId = players[0].id;
    const defenderId = players[1].id;

    console.log('AttackerId=', attackerId, ' DefenderId=', defenderId);

    // start game
    a.emit('start-game', { roomId: room.id });
    await new Promise((resolve, reject) => {
      a.once('game-starting', () => resolve());
      setTimeout(() => reject(new Error('start-game timeout')), 2000);
    });

    console.log('Game started - performing bounce test');

    // Prepare to capture final resolved payload
    const finalResolved = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('final attack-resolved timeout')), 8000);
      a.once('attack-resolved', (resolved) => { clearTimeout(t); resolve(resolved); });
      b.once('attack-resolved', (resolved) => { /* noop */ });
      c.once('attack-resolved', (resolved) => { /* noop */ });
    });

    // Each client will respond to defend-request only when addressed
    a.on('defend-request', (data) => {
      if (data.defenderId !== attackerId) return;
      console.log('Attacker handling defend-request (became defender)', data.requestId);
      a.emit('player-defend', { roomId: room.id, requestId: data.requestId, defenderId: attackerId, cards: [], defense: 0 });
    });

    b.on('defend-request', (data) => {
      if (data.defenderId !== defenderId) return;
      console.log('Defender handling defend-request', data.requestId);
      const bounceCard = { id: 'test_def_bounce_1', effect: 'bounce', type: 'defense', defense: 0 };
      b.emit('player-defend', { roomId: room.id, requestId: data.requestId, defenderId, cards: [bounceCard], defense: 0 });
    });

    c.on('defend-request', (data) => {
      if (data.defenderId !== players[2].id) return;
      console.log('Third player handling defend-request', data.requestId);
      c.emit('player-defend', { roomId: room.id, requestId: data.requestId, defenderId: players[2].id, cards: [], defense: 0 });
    });

    // send initial attack
    const requestId = 'bce_' + Date.now();
    a.emit('player-attack', { roomId: room.id, attackerId, targetId: defenderId, cards: [], damage: 12, requestId });

    const resolved = await finalResolved;
    console.log('FINAL resolved:', resolved);

    if (!resolved.nextPlayerId) {
      console.error('No nextPlayerId in resolved payload - test fails');
      process.exit(3);
    }

    console.log('Bounce integration test SUCCESS');

    // cleanup
    a.disconnect(); b.disconnect(); c.disconnect();
    serverProc.kill();
    process.exit(0);

  } catch (err) {
    console.error('Bounce test error:', err && err.stack ? err.stack : err);
    try { a.disconnect(); b.disconnect(); c.disconnect(); } catch (e) {}
    serverProc.kill();
    process.exit(5);
  }
}

run();
