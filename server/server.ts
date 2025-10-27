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

// 서버에서 관리하는 플레이어 상태 (HP 등)
interface PlayerState {
    health: number;
    mentalPower: number;
    alive: boolean;
    debuffs?: string[];
}

interface Room {
    id: string;
    name: string;
    players: Player[];
    maxPlayers: number;
    gameType: 'normal' | 'ranked';
    isPlaying: boolean;
    hostId: string;
    // server-authoritative turn tracking
    currentPlayerIndex?: number; // index into players[] for whose turn it is
    currentTurn?: number;
    // per-player authoritative state (initialized on game start)
    playerStates?: Record<string, PlayerState>;
    // processed requests for idempotency: requestId -> resolved payload
    processedRequests?: Record<string, { resolved: any, timestamp: number }>;
    // pending attacks waiting for defender response
    pendingAttacks?: Record<string, any>;
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

        // Remove authoritative player state if present
        if (room.playerStates && player && player.id) {
            delete room.playerStates[player.id];
        }

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

        // 게임 시작을 위해 최소 플레이어 수를 확인 (2명 이상)
        if (room.players.length < 2) {
            socket.emit('error', { message: '게임을 시작하려면 최소 2명 이상의 플레이어가 필요합니다.' });
            return;
        }

        // Mark room as playing and initialize server-side turn tracking
        room.isPlaying = true;
        room.currentPlayerIndex = 0;
        room.currentTurn = 1;

        // Initialize authoritative player states (example defaults)
        room.playerStates = {};
        for (const p of room.players) {
            room.playerStates[p.id] = {
                health: 100,
                mentalPower: 0,
                alive: true,
                debuffs: []
            };
        }

        // Broadcast authoritative game start and initial turn
        io.to(data.roomId).emit('game-starting', { room });
        io.to(data.roomId).emit('turn-start', { roomId: data.roomId, currentPlayerId: room.players[0].id, currentTurn: room.currentTurn });

        console.log(`🎮 게임 시작: ${data.roomId} (turn=${room.currentTurn}, player=${room.players[0].name})`);
    });

    // 게임 액션 (카드 사용, 공격 등)
    socket.on('game-action', (data: { roomId: string, action: any }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        // 모든 플레이어에게 액션 브로드캐스트
        socket.to(data.roomId).emit('game-action', data.action);
    });

    // 공격 액션
    socket.on('player-attack', (data: { roomId: string, attackerId: string, targetId: string, cards: any[], damage: number, requestId?: string }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) {
            socket.emit('error', { message: '게임 중이 아닌 방입니다.' });
            return;
        }

        // Find attacker by socket id to ensure authenticity
        const attacker = room.players.find(p => p.socketId === socket.id);
        if (!attacker || attacker.id !== data.attackerId) {
            socket.emit('error', { message: '유효하지 않은 공격자입니다.' });
            return;
        }

        // Ensure it's attacker's turn according to server-side tracking
        const currentIndex = room.currentPlayerIndex ?? 0;
        const currentPlayer = room.players[currentIndex];
        if (attacker.id !== currentPlayer.id) {
            socket.emit('error', { message: '현재 차례가 아닙니다.' });
            return;
        }

        // Idempotency: if requestId already processed, re-send stored resolved
        const reqId = data.requestId;
        if (reqId && room.processedRequests && room.processedRequests[reqId]) {
            const cachedEntry = room.processedRequests[reqId];
            const cached = cachedEntry.resolved;
            io.to(data.roomId).emit('attack-resolved', cached);
            // Also emit turn events based on cached if present
            if (cached.nextPlayerId) {
                io.to(data.roomId).emit('turn-end', { roomId: data.roomId, playerId: cached.attackerId, nextPlayerId: cached.nextPlayerId });
                io.to(data.roomId).emit('turn-start', { roomId: data.roomId, currentPlayerId: cached.nextPlayerId, currentTurn: cached.currentTurn });
            }
            return;
        }

        // Compute authoritative damage on server
        let damage = typeof data.damage === 'number' ? data.damage : 0;
        if (Array.isArray(data.cards)) {
            for (const c of data.cards) {
                if (c && (typeof c.healthDamage === 'number' || typeof c.damage === 'number')) {
                    damage += (typeof c.healthDamage === 'number' ? c.healthDamage : (c.damage || 0));
                }
            }
        }

        // determine attack attribute if provided on cards
        let attackAttribute: string | null = null;
        if (Array.isArray(data.cards)) {
            for (const c of data.cards) {
                if (c && c.attribute) {
                    attackAttribute = c.attribute;
                    break;
                }
            }
        }

        // Ensure playerStates exists
        if (!room.playerStates) {
            room.playerStates = {};
            for (const p of room.players) {
                room.playerStates[p.id] = { health: 100, mentalPower: 0, alive: true };
            }
        }

        const targetState = room.playerStates[data.targetId];
        const targetPlayer = room.players.find(p => p.id === data.targetId);
        if (!targetState || !targetPlayer) {
            socket.emit('error', { message: '타겟을 찾을 수 없습니다.' });
            return;
        }
        // Instead of immediate application, create a pending attack and give defender chance to respond
        const pendingId = reqId || `srvreq_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
        room.pendingAttacks = room.pendingAttacks || {};

        const pendingCards = Array.isArray(data.cards) ? data.cards : [];
        const pending = {
            requestId: pendingId,
            attackerId: attacker.id,
            attackerName: attacker.name,
            targetId: data.targetId,
            targetName: targetPlayer.name,
            damage,
            cardsUsed: pendingCards,
            // store card ids separately for clients to reliably remove used cards
            cardsUsedIds: pendingCards.map((c: any) => c && c.id).filter(Boolean),
            attackAttribute,
            timestamp: Date.now()
        };

        // include roomId for convenience
        (pending as any).roomId = data.roomId;

        room.pendingAttacks[pendingId] = pending;

        // Broadcast announcement so UI can show center info for everyone
        io.to(data.roomId).emit('attack-announced', {
            requestId: pendingId,
            attackerId: attacker.id,
            attackerName: attacker.name,
            targetId: data.targetId,
            damage,
            attackAttribute,
            cardsUsed: pending.cardsUsed || [],
            cardsUsedIds: pending.cardsUsedIds || []
        });
        // Broadcast a defend-request to the room so all clients see the pending attack
        // Include an expiresAt timestamp so clients can show a synchronized countdown.
        const DEFEND_TIMEOUT_MS = 20000; // 20 seconds to respond
        const expiresAt = Date.now() + DEFEND_TIMEOUT_MS;

        io.to(data.roomId).emit('defend-request', {
            requestId: pendingId,
            attackerId: attacker.id,
            attackerName: attacker.name,
            defenderId: pending.targetId,
            defenderName: pending.targetName,
            damage,
            attackAttribute,
            roomId: data.roomId,
            expiresAt
        });
        console.log(`🔔 defend-request emitted to room ${data.roomId} for defender ${pending.targetId}, expiresAt=${expiresAt}`);

        // set timeout to auto-resolve if defender doesn't respond in time
        const timeoutId = setTimeout(() => {
            // if still pending, resolve without defense
            if (room.pendingAttacks && room.pendingAttacks[pendingId]) {
                resolvePendingAttack(room, pendingId, null);
            }
        }, DEFEND_TIMEOUT_MS);

        // attach timeout id for possible cancellation
        room.pendingAttacks[pendingId].timeoutId = timeoutId;
    });

    // defender response handler - server authoritative defense resolution
    socket.on('player-defend', (data: { roomId: string, requestId: string, defenderId: string, cards: any[], defense?: number }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        if (!data.requestId || !room.pendingAttacks || !room.pendingAttacks[data.requestId]) {
            socket.emit('error', { message: '해당 방어 요청을 찾을 수 없습니다.' });
            return;
        }

        const pending = room.pendingAttacks[data.requestId];

        // validate defender
        if (pending.targetId !== data.defenderId) {
            socket.emit('error', { message: '당신은 이 공격의 방어자가 아닙니다.' });
            return;
        }

        // cancel timeout
        if (pending.timeoutId) clearTimeout(pending.timeoutId);

    // compute defense value
    let defenseValue = typeof data.defense === 'number' ? data.defense : 0;
    const defenderCards = Array.isArray(data.cards) ? data.cards : [];
    const defenderCardIds = defenderCards.map((c: any) => c && c.id).filter(Boolean);
        for (const c of defenderCards) {
            if (c && typeof c.defense === 'number') defenseValue += c.defense;
        }

        // broadcast defender's chosen cards immediately so all clients can show center UI
        io.to(data.roomId).emit('player-defend', {
            defenderId: data.defenderId,
            cards: defenderCards,
            cardIds: defenderCardIds
        });

        // check attribute matching rules
        const attackAttr = pending.attackAttribute;
        const defenseEffective = isDefenseEffective(attackAttr, defenderCards);

        // if defense not effective, treat as no defense
        const appliedDefense = defenseEffective ? defenseValue : 0;

        // Apply final damage
    const targetState = room.playerStates && room.playerStates[pending.targetId];
        const prevHealth = targetState ? targetState.health : 0;
        const finalDamage = Math.max(0, pending.damage - appliedDefense);

        if (targetState) {
            targetState.health = Math.max(0, (targetState.health || 0) - finalDamage);
            if (targetState.health <= 0) targetState.alive = false;
        }

        // apply card effects (debuffs) from attacker's cards
    const appliedDebuffs: string[] = [];
        try {
            const atkCards = pending.cardsUsed || [];
            for (const ac of atkCards) {
                if (ac && ac.effect && ac.effect !== 'reflect' && ac.effect !== 'bounce') {
                    if (targetState) {
                        targetState.debuffs = targetState.debuffs || [];
                        if (!targetState.debuffs.includes(ac.effect)) {
                            targetState.debuffs.push(ac.effect);
                            appliedDebuffs.push(ac.effect);
                        }
                    }
                }
            }
        } catch (e) {
            // ignore malformed card effects
        }

        // handle special defense effects (reflect / bounce)
        let reflectDamage = 0;
        let bounceTargetId: string | null = null;
    // attackerState used for reflect resolution
    const attackerState = room.playerStates && room.playerStates[pending.attackerId];
        for (const dc of defenderCards) {
            if (!dc || !dc.effect) continue;
            if (dc.effect === 'reflect') {
                reflectDamage = finalDamage;
            } else if (dc.effect === 'bounce') {
                // pick another random alive player (excluding defender)
                const alive = room.players.filter(p => p.id !== data.defenderId && room.playerStates && room.playerStates[p.id] && room.playerStates[p.id].alive);
                if (alive.length > 0) {
                    const rnd = alive[Math.floor(Math.random() * alive.length)];
                    bounceTargetId = rnd.id;
                    const btState = room.playerStates && room.playerStates[bounceTargetId];
                    if (btState) {
                        btState.health = Math.max(0, btState.health - finalDamage);
                        if (btState.health <= 0) btState.alive = false;
                    }
                }
            }
        }

            // apply reflect if any
            if (reflectDamage > 0 && attackerState) {
                attackerState.health = Math.max(0, attackerState.health - reflectDamage);
                if (attackerState.health <= 0) attackerState.alive = false;
            }

        // Advance turn (simple round-robin)
        const currentIndex = room.currentPlayerIndex ?? 0;
        const nextIndex = (currentIndex + 1) % room.players.length;
        room.currentPlayerIndex = nextIndex;
        room.currentTurn = (room.currentTurn || 1) + (nextIndex === 0 ? 1 : 0);
        const nextPlayerId = room.players[nextIndex].id;

        // Build resolved payload
        const resolved = {
            attackerId: pending.attackerId,
            attackerName: pending.attackerName,
            targetId: pending.targetId,
            targetName: pending.targetName,
            damageApplied: finalDamage,
            targetPrevHealth: prevHealth,
            targetHealth: targetState ? targetState.health : 0,
            eliminated: targetState ? !targetState.alive : false,
            cardsUsed: pending.cardsUsed || [],
            cardsUsedIds: pending.cardsUsedIds || [],
            defenseCards: defenderCards,
            defenseCardIds: defenderCardIds,
            defenseApplied: appliedDefense,
            reflectDamage,
            bounceTargetId,
            appliedDebuffs,
            nextPlayerId,
            currentTurn: room.currentTurn,
            timestamp: Date.now(),
            requestId: pending.requestId
        };

        // store for idempotency
        room.processedRequests = room.processedRequests || {};
        room.processedRequests[pending.requestId] = { resolved, timestamp: Date.now() };

    // cleanup pending
    if (room.pendingAttacks) delete room.pendingAttacks[pending.requestId];

        // Broadcast resolution
        io.to(data.roomId).emit('defense-resolved', resolved);
        io.to(data.roomId).emit('attack-resolved', resolved);
        io.to(data.roomId).emit('turn-end', { roomId: data.roomId, playerId: pending.attackerId, nextPlayerId });
        io.to(data.roomId).emit('turn-start', { roomId: data.roomId, currentPlayerId: nextPlayerId, currentTurn: room.currentTurn });
    });

    // helper to resolve pending attack with no defense
    function resolvePendingAttack(room: Room, pendingId: string, defenderCards: any[] | null) {
        const pending = room.pendingAttacks && room.pendingAttacks[pendingId];
        if (!pending) return;

        // apply damage to target
        const targetState = room.playerStates && room.playerStates[pending.targetId];
        const prevHealth = targetState ? targetState.health : 0;
        const finalDamage = pending.damage; // no defense
        if (targetState) {
            targetState.health = Math.max(0, (targetState.health || 0) - finalDamage);
            if (targetState.health <= 0) targetState.alive = false;
        }

    // apply card effects (debuffs) from attacker's cards when no defense used
        const appliedDebuffs: string[] = [];
        try {
            const atkCards = pending.cardsUsed || [];
            for (const ac of atkCards) {
                if (ac && ac.effect && ac.effect !== 'reflect' && ac.effect !== 'bounce') {
                    if (targetState) {
                        targetState.debuffs = targetState.debuffs || [];
                        if (!targetState.debuffs.includes(ac.effect)) {
                            targetState.debuffs.push(ac.effect);
                            appliedDebuffs.push(ac.effect);
                        }
                    }
                }
            }
        } catch (e) {}

        // Advance turn
        const currentIndex = room.currentPlayerIndex ?? 0;
        const nextIndex = (currentIndex + 1) % room.players.length;
        room.currentPlayerIndex = nextIndex;
        room.currentTurn = (room.currentTurn || 1) + (nextIndex === 0 ? 1 : 0);
        const nextPlayerId = room.players[nextIndex].id;

        const resolved = {
            attackerId: pending.attackerId,
            attackerName: pending.attackerName,
            targetId: pending.targetId,
            targetName: pending.targetName,
            damageApplied: finalDamage,
            targetPrevHealth: prevHealth,
            targetHealth: targetState ? targetState.health : 0,
            eliminated: targetState ? !targetState.alive : false,
            cardsUsed: pending.cardsUsed || [],
            cardsUsedIds: pending.cardsUsedIds || [],
            defenseCards: defenderCards || [],
            defenseCardIds: defenderCards ? defenderCards.map(dc => dc && dc.id).filter(Boolean) : [],
            defenseApplied: 0,
            appliedDebuffs,
            nextPlayerId,
            currentTurn: room.currentTurn,
            timestamp: Date.now(),
            requestId: pending.requestId
        };

        room.processedRequests = room.processedRequests || {};
        room.processedRequests[pending.requestId] = { resolved, timestamp: Date.now() };

        // cleanup
        if (room.pendingAttacks) delete room.pendingAttacks[pending.requestId];

        io.to(room.id).emit('attack-resolved', resolved);
        io.to(room.id).emit('turn-end', { roomId: room.id, playerId: pending.attackerId, nextPlayerId });
        io.to(room.id).emit('turn-start', { roomId: room.id, currentPlayerId: nextPlayerId, currentTurn: room.currentTurn });
    }

    // attribute-defense matching helper
    function isDefenseEffective(attackAttr: string | null, defenseCards: any[]): boolean {
        if (!attackAttr) return true; // if attack attribute unknown, allow defenses

        // normalize attribute strings because card data may use Korean strings
        const normalize = (a: string | undefined | null) => {
            if (!a) return 'none';
            const s = String(a).toLowerCase();
            if (s === '화염' || s === 'fire' || s === 'flame') return 'fire';
            if (s === '물' || s === 'water' || s === 'aqua' || s === 'water') return 'water';
            if (s === '빛' || s === 'light') return 'light';
            if (s === '암흑' || s === 'dark' || s === 'darkness') return 'dark';
            if (s === '없음' || s === 'none' || s === '') return 'none';
            return s; // fallback
        };

        const attackNorm = normalize(attackAttr);
        const defendAttrs = defenseCards.map(dc => normalize(dc && dc.attribute)).filter(Boolean);

        // dark can be blocked by any defense (as long as at least one defense card used)
        if (attackNorm === 'dark') return defendAttrs.length > 0;
        // light can only be blocked by light defense
        if (attackNorm === 'light') return defendAttrs.includes('light');
        // fire attack is blocked by water defense
        if (attackNorm === 'fire') return defendAttrs.includes('water');
        // water attack is blocked by fire defense
        if (attackNorm === 'water') return defendAttrs.includes('fire');
        // default: allow any defense if defender used at least one defense card
        return defendAttrs.length > 0;
    }

    // (legacy simple defend handler removed) - authoritative defend handled above with requestId

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

                // Remove authoritative player state if present
                if (room.playerStates && player && player.id) {
                    delete room.playerStates[player.id];
                }

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

// Cleanup processedRequests older than TTL to avoid memory growth
const PROCESSED_REQUEST_TTL = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

setInterval(() => {
    const cutoff = Date.now() - PROCESSED_REQUEST_TTL;
    for (const [, room] of rooms.entries()) {
        if (!room.processedRequests) continue;
        for (const [reqId, entry] of Object.entries(room.processedRequests)) {
            if (entry.timestamp < cutoff) {
                delete room.processedRequests[reqId];
            }
        }
        // If processedRequests becomes empty, delete the object to free memory
        if (Object.keys(room.processedRequests).length === 0) {
            delete room.processedRequests;
        }
    }
}, CLEANUP_INTERVAL);
