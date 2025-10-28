const io = require('socket.io-client');

function wait(ms){return new Promise(r=>setTimeout(r,ms));}

async function run(){
  const url = 'http://localhost:3001';
  console.log('Connecting to', url);
  const a = io.connect(url, { reconnectionDelay: 0, forceNew: true });
  const b = io.connect(url, { reconnectionDelay: 0, forceNew: true });

  await Promise.all([new Promise(r=>a.on('connect',r)), new Promise(r=>b.on('connect',r))]);
  console.log('Both connected');

  // listen for server logs events
  a.on('attack-announced', (d)=>console.log('[A] attack-announced', d));
  a.on('defend-request', (d)=>console.log('[A] defend-request', d));
  a.on('defense-resolved', (d)=>console.log('[A] defense-resolved', d));
  a.on('attack-resolved', (d)=>console.log('[A] attack-resolved', d));
  a.on('turn-start', (d)=>console.log('[A] turn-start', d));
  a.on('turn-end', (d)=>console.log('[A] turn-end', d));

  b.on('attack-announced', (d)=>console.log('[B] attack-announced', d));
  b.on('defend-request', (d)=>console.log('[B] defend-request', d));
  b.on('defense-resolved', (d)=>console.log('[B] defense-resolved', d));
  b.on('attack-resolved', (d)=>console.log('[B] attack-resolved', d));
  b.on('turn-start', (d)=>console.log('[B] turn-start', d));
  b.on('turn-end', (d)=>console.log('[B] turn-end', d));

  // create room with A
  let room;
  a.emit('create-room', { playerName: 'Attacker', gameType: 'normal' });
  room = await new Promise((resolve, reject)=>{
    a.once('room-created', (msg)=>resolve(msg.room));
    setTimeout(()=>reject(new Error('room-create-timeout')), 2000);
  });
  console.log('room created', room.id);

  // B join
  b.emit('join-room', { roomId: room.id, playerName: 'Defender' });
  await new Promise((resolve, reject)=>{
    b.once('room-joined', ()=>resolve());
    setTimeout(()=>reject(new Error('join-timeout')),2000);
  });
  console.log('defender joined');

  await wait(300);

  // fetch updated room info (players list) from server
  const updatedRoom = await new Promise((resolve, reject) => {
    a.once('rooms-list', (data) => {
      const found = (data.rooms || []).find(r => r.id === room.id);
      resolve(found || room);
    });
    a.emit('get-rooms', {});
    setTimeout(() => resolve(room), 1000);
  });

  // Start game by host A
  a.emit('start-game', { roomId: room.id });
  await new Promise((resolve, reject)=>{
    a.once('game-starting', ()=>resolve());
    setTimeout(()=>reject(new Error('start-game timeout')),2000);
  });
  console.log('game-starting received');

  // listen for defend-request on B and auto respond
  b.on('defend-request', (data)=>{
    console.log('[B] defend-request received, responding with empty defense', data.requestId);
    b.emit('player-defend', { roomId: room.id, requestId: data.requestId, defenderId: data.defenderId, cards: [], defense: 0 });
  });

  // wait a bit then send attack
  await wait(200);
  // try to detect attacker/defender ids from updatedRoom (server may have refreshed players)
  const attackerId = (updatedRoom && updatedRoom.players && updatedRoom.players[0] && updatedRoom.players[0].id) || (room.players && room.players[0] && room.players[0].id);
  const defenderId = (updatedRoom && updatedRoom.players && updatedRoom.players[1] && updatedRoom.players[1].id) || (room.players && room.players[1] && room.players[1].id) || null;
  console.log('attackerId', attackerId, 'defenderId', defenderId);

  const requestId = 'sint_' + Date.now();
  a.emit('player-attack', { roomId: room.id, attackerId, targetId: defenderId, cards: [], damage: 15, requestId });
  console.log('attack sent, requestId=', requestId);

  // wait for attack-resolved
  await new Promise((resolve, reject)=>{
    const to = setTimeout(()=>reject(new Error('attack-resolved timeout')), 5000);
    a.once('attack-resolved', (resolved) => { clearTimeout(to); console.log('attack-resolved ->', resolved); resolve(resolved); });
  });

  console.log('test done, disconnecting');
  a.disconnect(); b.disconnect();
  process.exit(0);
}

run().catch(e=>{console.error('ERROR', e); process.exit(1);});
