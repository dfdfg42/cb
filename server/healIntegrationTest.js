#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const io = require('socket.io-client');

const ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'server', 'server.ts');

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function run() {
  console.log('Heal integration test: starting server (ts-node)');

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

  try {
    await Promise.all([
      new Promise(res => a.on('connect', res)),
      new Promise(res => b.on('connect', res))
    ]);

    console.log('Both clients connected');

    // Debug listeners to observe announcements/resolutions
    a.on('attack-announced', (d) => console.log('[a] attack-announced', d && d.requestId));
    b.on('attack-announced', (d) => console.log('[b] attack-announced', d && d.requestId));
    a.on('attack-resolved', (d) => console.log('[a] attack-resolved evt', d && d.requestId));
    b.on('attack-resolved', (d) => console.log('[b] attack-resolved evt', d && d.requestId));
    a.on('error', (e) => console.log('[a] error', e));
    b.on('error', (e) => console.log('[b] error', e));
    a.on('connect_error', (e) => console.log('[a] connect_error', e && e.message));
    b.on('connect_error', (e) => console.log('[b] connect_error', e && e.message));

    let room = await new Promise((resolve, reject) => {
      a.emit('create-room', { playerName: 'Attacker', gameType: 'normal' });
      a.once('room-created', (msg) => resolve(msg.room));
      setTimeout(() => reject(new Error('room-create timeout')), 2000);
    });

    console.log('Room created:', room.id);

    // Join and capture the updated room object returned by the server
    const joinedRoom = await new Promise((resolve, reject) => {
      b.emit('join-room', { roomId: room.id, playerName: 'Defender' });
      b.once('room-joined', (msg) => resolve(msg.room));
      setTimeout(() => reject(new Error('join-room timeout')), 2000);
    });

    // use the most recent room representation
    if (joinedRoom) room = joinedRoom;

    console.log('Defender joined');
    await wait(300);

    // Start game
    a.emit('start-game', { roomId: room.id });
    await new Promise((resolve, reject) => { a.once('game-starting', () => resolve()); setTimeout(() => reject(new Error('start-game timeout')), 2000); });
    console.log('Game started');

    // Get attacker/defender ids from room map by requesting rooms-list
    const fetchedRoom = await new Promise((resolve, reject) => {
      a.once('rooms-list', (data) => {
        const found = (data.rooms || []).find(r => r.id === room.id);
        if (found) resolve(found); else resolve(room);
      });
      a.emit('get-rooms', {});
      setTimeout(() => resolve(room), 1000);
    }).catch(() => room);

    const attackerId = (fetchedRoom.players && fetchedRoom.players[0] && fetchedRoom.players[0].id) || room.players[0].id;
    const defenderId = (fetchedRoom.players && fetchedRoom.players[1] && fetchedRoom.players[1].id) || (room.players[1] && room.players[1].id) || null;

    if (!defenderId) { console.error('Could not determine defender id'); process.exit(2); }

    // Step 1: Attacker deals 30 damage to Defender
      // For a simpler, deterministic test: set defender HP to 60 via test-hook,
      // then have the attacker use a HEAL card (heal 20) on the defender and verify healApplied.
      console.log('Setting defender HP to 60 via test hook');
      a.emit('force-set-health', { roomId: room.id, playerId: defenderId, health: 60 });
      await wait(200);

      // Prepare to capture defend-request and resolution
      b.once('defend-request', (data) => {
        // defender auto-defend none
        b.emit('player-defend', { roomId: room.id, requestId: data.requestId, defenderId, cards: [], defense: 0 });
      });

      const healCard = {
        id: 'mag_001_test_heal',
        name: '테스트 치유',
        type: 'magic',
        healthDamage: 20,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: 'heal',
        description: '체력을 20 회복합니다.'
      };

      const stepResolved = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('attack-resolved timeout')), 5000);
        a.once('attack-resolved', (resolved) => { clearTimeout(timeout); resolve(resolved); });
      });

      const reqHeal = 'heal_single_' + Date.now();
      console.log('Attacker emits heal attack targeting defender, req=', reqHeal);
      a.emit('player-attack', { roomId: room.id, attackerId, targetId: defenderId, cards: [healCard], damage: 0, requestId: reqHeal });

      const res = await stepResolved;
      console.log('Resolved:', res);

      if (res && res.healApplied && res.healApplied > 0) {
        console.log('Heal integration test SUCCESS: healApplied=', res.healApplied, 'targetHealth=', res.targetHealth);
      } else {
        console.error('Heal integration test FAILED: healApplied missing or zero', res);
        process.exit(3);
      }

    // cleanup
    a.disconnect(); b.disconnect(); serverProc.kill(); process.exit(0);
  } catch (err) {
    console.error('Heal integration test error:', err && err.stack ? err.stack : err);
    try { a.disconnect(); b.disconnect(); } catch(e){}
    serverProc.kill();
    process.exit(5);
  }
}

run();
