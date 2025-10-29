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

// Safety: prevent infinite reflect/bounce chains
const MAX_CHAIN_DEPTH = 6;

// 공격 큐 아이템 인터페이스
interface AttackQueueItem {
    id: string;                          // 공격 고유 ID
    requestId: string;                   // 클라이언트 요청 ID
    attackerId: string;
    attackerName: string;
    targetId: string;
    targetName: string;
    damage: number;
    mentalDamage?: number;               // 정신 공격력
    heal?: number;
    cardsUsed: any[];
    cardsUsedIds: string[];
    attackAttribute: string | null;
    chainDepth: number;                  // 연쇄 깊이
    parentAttackId?: string;             // 부모 공격 ID (reflect/bounce에서 파생된 경우)
    chainSource?: 'reflect' | 'bounce';  // 연쇄 타입
    status: 'pending' | 'defending' | 'resolved';  // 공격 상태
    timeoutId?: NodeJS.Timeout;          // 타임아웃 ID
    timestamp: number;
    roomId: string;
}

// 공격 큐 클래스
class AttackQueue {
    private queue: AttackQueueItem[] = [];
    private currentAttackId: string | null = null;

    // 큐에 공격 추가
    enqueue(attack: AttackQueueItem): void {
        this.queue.push(attack);
        console.log(`[AttackQueue] Enqueued attack ${attack.id}, queue length: ${this.queue.length}`);
    }

    // 큐에서 다음 공격 가져오기
    dequeue(): AttackQueueItem | null {
        const attack = this.queue.shift();
        if (attack) {
            this.currentAttackId = attack.id;
            console.log(`[AttackQueue] Dequeued attack ${attack.id}, remaining: ${this.queue.length}`);
        }
        return attack || null;
    }

    // 현재 처리 중인 공격 가져오기
    getCurrentAttack(): AttackQueueItem | null {
        if (!this.currentAttackId) return null;
        // 큐의 첫 번째 항목이거나 이미 dequeue된 경우
        return this.queue.find(a => a.id === this.currentAttackId) || null;
    }

    // ID로 공격 찾기
    getAttackById(id: string): AttackQueueItem | null {
        return this.queue.find(a => a.id === id) || null;
    }

    // requestId로 공격 찾기
    getAttackByRequestId(requestId: string): AttackQueueItem | null {
        return this.queue.find(a => a.requestId === requestId) || null;
    }

    // 공격 상태 업데이트
    updateAttackStatus(id: string, status: AttackQueueItem['status']): void {
        const attack = this.queue.find(a => a.id === id);
        if (attack) {
            attack.status = status;
            console.log(`[AttackQueue] Updated attack ${id} status to ${status}`);
        }
    }

    // 공격 제거
    removeAttack(id: string): void {
        const index = this.queue.findIndex(a => a.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            console.log(`[AttackQueue] Removed attack ${id}, remaining: ${this.queue.length}`);
        }
        if (this.currentAttackId === id) {
            this.currentAttackId = null;
        }
    }

    // 큐 비우기
    clear(): void {
        this.queue = [];
        this.currentAttackId = null;
        console.log(`[AttackQueue] Cleared queue`);
    }

    // 큐 크기
    size(): number {
        return this.queue.length;
    }

    // 큐가 비어있는지
    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    // 다음 공격 처리 가능 여부
    canProcessNext(): boolean {
        return this.currentAttackId === null || this.queue.length > 0;
    }
}

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
    // 공격 큐 시스템 (NEW)
    attackQueue?: AttackQueue;
    // DEPRECATED: 이전 pendingAttacks 방식 (큐로 대체됨)
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
                mentalPower: 100,  // 초기 마나 100으로 설정
                alive: true,
                debuffs: []
            };
        }

        // Initialize attack queue
        room.attackQueue = new AttackQueue();
        console.log(`[AttackQueue] Initialized for room ${data.roomId}`);

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

    // 공격 액션 (큐 기반으로 재구성)
    socket.on('player-attack', (data: { roomId: string, attackerId: string, targetId: string, cards: any[], damage: number, requestId?: string, force?: boolean }) => {
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
        // Test override: allow force=true to bypass turn check (used by integration test harness)
        if (attacker.id !== currentPlayer.id && !data.force) {
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

        // Compute authoritative damage / heal / mental on server
        let damageFromCards = 0;
        let healFromCards = 0;
        let mentalDamageFromCards = 0;
        let totalCost = 0;
        if (Array.isArray(data.cards) && data.cards.length > 0) {
            for (const c of data.cards) {
                if (!c) continue;
                // accumulate card costs (check both cost and mentalCost fields)
                if (typeof c.cost === 'number') totalCost += c.cost;
                if (typeof c.mentalCost === 'number') totalCost += c.mentalCost;
                
                // If card declares heal via effect, try to extract amount
                if (c.effect && String(c.effect).toLowerCase() === 'heal') {
                    // prefer healthDamage field
                    if (typeof c.healthDamage === 'number' && c.healthDamage > 0) {
                        healFromCards += c.healthDamage;
                    } else if (typeof c.damage === 'number' && c.damage > 0) {
                        // fallback to damage field
                        healFromCards += c.damage;
                    } else if (c.description && typeof c.description === 'string') {
                        const m = c.description.match(/(\d+)/);
                        if (m) healFromCards += parseInt(m[1], 10);
                    }
                    // do not add to damage
                } else {
                    if (typeof c.healthDamage === 'number') damageFromCards += c.healthDamage;
                    else if (typeof c.damage === 'number') damageFromCards += c.damage;
                    else if (typeof c.phys_atk === 'number') damageFromCards += c.phys_atk; // fallback for alternate card formats
                    
                    // Add mental damage
                    if (typeof c.mentalDamage === 'number') mentalDamageFromCards += c.mentalDamage;
                    else if (typeof c.mental_atk === 'number') mentalDamageFromCards += c.mental_atk;
                }
            }
        }
        
        // Ensure playerStates exists
        if (!room.playerStates) {
            room.playerStates = {};
            for (const p of room.players) {
                room.playerStates[p.id] = { health: 100, mentalPower: 100, alive: true };
            }
        }
        
        // Check if attacker has enough mana
        const attackerState = room.playerStates[attacker.id];
        if (totalCost > 0) {
            if (!attackerState || attackerState.mentalPower < totalCost) {
                socket.emit('error', { message: '마나가 부족합니다!' });
                return;
            }
            // Deduct mana
            attackerState.mentalPower = Math.max(0, attackerState.mentalPower - totalCost);
            console.log(`[Attack] ${attacker.name} used ${totalCost} mana (remaining: ${attackerState.mentalPower})`);
        }

        let damage = 0;
        if (Array.isArray(data.cards) && data.cards.length > 0) {
            damage = damageFromCards;
            if (typeof data.damage === 'number') {
                console.warn(`Server: Ignoring client-sent damage=${data.damage} because cards were provided. Using damageFromCards=${damageFromCards}`);
            }
        } else {
            damage = typeof data.damage === 'number' ? data.damage : 0;
        }

        console.log(`Server: computed damage (fromClient=${data.damage ?? 'null'}, fromCards=${damageFromCards}) => final=${damage}, mentalDamage=${mentalDamageFromCards}`);

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
                room.playerStates[p.id] = { health: 100, mentalPower: 100, alive: true };
            }
        }

        const targetState = room.playerStates[data.targetId];
        const targetPlayer = room.players.find(p => p.id === data.targetId);
        if (!targetState || !targetPlayer) {
            socket.emit('error', { message: '타겟을 찾을 수 없습니다.' });
            return;
        }

        // Initialize attack queue if not exists
        if (!room.attackQueue) {
            room.attackQueue = new AttackQueue();
        }

        // Create attack queue item
        const attackId = `atk_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
        const requestId = reqId || `srvreq_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
        const pendingCards = Array.isArray(data.cards) ? data.cards : [];

        const attackItem: AttackQueueItem = {
            id: attackId,
            requestId: requestId,
            attackerId: attacker.id,
            attackerName: attacker.name,
            targetId: data.targetId,
            targetName: targetPlayer.name,
            damage,
            mentalDamage: mentalDamageFromCards || 0,
            heal: healFromCards || 0,
            cardsUsed: pendingCards,
            cardsUsedIds: pendingCards.map((c: any) => c && c.id).filter(Boolean),
            attackAttribute,
            chainDepth: 0,  // Initial attack has depth 0
            status: 'pending',
            timestamp: Date.now(),
            roomId: data.roomId
        };

        // Add to queue
        room.attackQueue.enqueue(attackItem);

        // Process the attack (send defend-request)
        processNextAttack(room, attackItem);
    });

    // 큐에서 다음 공격 처리
    function processNextAttack(room: Room, attackItem: AttackQueueItem): void {
        // Broadcast announcement so UI can show center info for everyone
        io.to(room.id).emit('attack-announced', {
            requestId: attackItem.requestId,
            attackerId: attackItem.attackerId,
            attackerName: attackItem.attackerName,
            targetId: attackItem.targetId,
            damage: attackItem.damage,
            mentalDamage: attackItem.mentalDamage || 0,
            attackAttribute: attackItem.attackAttribute,
            cardsUsed: attackItem.cardsUsed || [],
            cardsUsedIds: attackItem.cardsUsedIds || [],
            chainSource: attackItem.chainSource
        });

        // Update attack status
        if (room.attackQueue) {
            room.attackQueue.updateAttackStatus(attackItem.id, 'defending');
        }

        // Broadcast a defend-request to the room
        const DEFEND_TIMEOUT_MS = 20000; // 20 seconds to respond
        const expiresAt = Date.now() + DEFEND_TIMEOUT_MS;

        io.to(room.id).emit('defend-request', {
            requestId: attackItem.requestId,
            attackerId: attackItem.attackerId,
            attackerName: attackItem.attackerName,
            defenderId: attackItem.targetId,
            defenderName: attackItem.targetName,
            damage: attackItem.damage,
            mentalDamage: attackItem.mentalDamage || 0,
            attackAttribute: attackItem.attackAttribute,
            roomId: room.id,
            expiresAt,
            chainSource: attackItem.chainSource
        });
        console.log(`🔔 defend-request emitted to room ${room.id} for defender ${attackItem.targetId}, expiresAt=${expiresAt}`);

        // set timeout to auto-resolve if defender doesn't respond in time
        const timeoutId = setTimeout(() => {
            // if still in queue, resolve without defense
            if (room.attackQueue && room.attackQueue.getAttackByRequestId(attackItem.requestId)) {
                resolveAttackFromQueue(room, attackItem.requestId, null);
            }
        }, DEFEND_TIMEOUT_MS);

        // attach timeout id
        attackItem.timeoutId = timeoutId;
    }

    // defender response handler - server authoritative defense resolution (큐 기반)
    socket.on('player-defend', (data: { roomId: string, requestId: string, defenderId: string, cards: any[], defense?: number }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;

        if (!room.attackQueue) {
            socket.emit('error', { message: '공격 큐가 초기화되지 않았습니다.' });
            return;
        }

        // Find attack in queue by requestId
        const attackItem = room.attackQueue.getAttackByRequestId(data.requestId);
        if (!attackItem) {
            socket.emit('error', { message: '해당 방어 요청을 찾을 수 없습니다.' });
            return;
        }

        // validate defender
        if (attackItem.targetId !== data.defenderId) {
            socket.emit('error', { message: '당신은 이 공격의 방어자가 아닙니다.' });
            return;
        }

        // Check defense card costs and deduct mana
        let totalDefenseCost = 0;
        const defenderCards = data.cards || [];
        for (const c of defenderCards) {
            if (c && typeof c.cost === 'number') {
                totalDefenseCost += c.cost;
            }
            if (c && typeof c.mentalCost === 'number') {
                totalDefenseCost += c.mentalCost;
            }
        }
        
        if (totalDefenseCost > 0 && room.playerStates) {
            const defenderState = room.playerStates[data.defenderId];
            if (!defenderState || defenderState.mentalPower < totalDefenseCost) {
                socket.emit('error', { message: '마나가 부족합니다!' });
                return;
            }
            // Deduct mana
            defenderState.mentalPower = Math.max(0, defenderState.mentalPower - totalDefenseCost);
            console.log(`[Defend] Defender ${data.defenderId} used ${totalDefenseCost} mana (remaining: ${defenderState.mentalPower})`);
        }

        // cancel timeout
        if (attackItem.timeoutId) {
            clearTimeout(attackItem.timeoutId);
            attackItem.timeoutId = undefined;
        }

        // Resolve attack with defense
        resolveAttackFromQueue(room, data.requestId, defenderCards);
    });

    // 큐에서 공격 해결 함수
    function resolveAttackFromQueue(room: Room, requestId: string, defenderCards: any[] | null): void {
        if (!room.attackQueue) return;

        const attackItem = room.attackQueue.getAttackByRequestId(requestId);
        if (!attackItem) {
            console.warn(`[resolveAttackFromQueue] Attack not found: ${requestId}`);
            return;
        }

        console.log(`[resolveAttackFromQueue] Resolving attack ${attackItem.id}, chainDepth=${attackItem.chainDepth}`);

        // compute defense value
        let defenseValue = 0;
        const defenderCardArray = Array.isArray(defenderCards) ? defenderCards : [];
        const defenderCardIds = defenderCardArray.map((c: any) => c && c.id).filter(Boolean);

        for (const c of defenderCardArray) {
            if (c && typeof c.defense === 'number') defenseValue += c.defense;
        }

        // broadcast defender's chosen cards immediately so all clients can show center UI
        io.to(room.id).emit('player-defend', {
            defenderId: attackItem.targetId,
            cards: defenderCardArray,
            cardIds: defenderCardIds
        });

        // check attribute matching rules
        const attackAttr = attackItem.attackAttribute;
        const defenseEffective = isDefenseEffective(attackAttr, defenderCardArray);

        // if defense not effective, treat as no defense
        const appliedDefense = defenseEffective ? defenseValue : 0;

        // Apply final damage and mental damage
        const targetState = room.playerStates && room.playerStates[attackItem.targetId];
        const prevHealth = targetState ? targetState.health : 0;
        const prevMentalPower = targetState ? targetState.mentalPower : 0;
        
        // Defense cards can only block health damage, NOT mental damage
        const finalDamage = Math.max(0, attackItem.damage - appliedDefense);
        const finalMentalDamage = attackItem.mentalDamage || 0;  // Mental damage is NEVER reduced by defense

        // Check for special defense effects FIRST (reflect / bounce) - BEFORE applying damage
        const specialEffectsToProcess: Array<{ type: 'reflect' | 'bounce'; card: any }> = [];
        for (const dc of defenderCardArray) {
            if (!dc || !dc.effect) continue;
            if (dc.effect === 'reflect' || dc.effect === 'bounce') {
                specialEffectsToProcess.push({ type: dc.effect as any, card: dc });
                console.log(`[resolveAttackFromQueue] Found special effect: ${dc.effect}`);
            }
        }

        // If special effects exist, handle them WITHOUT applying damage to defender
        if (specialEffectsToProcess.length > 0) {
            const eff = specialEffectsToProcess[0];
            const chainDepth = attackItem.chainDepth + 1;

            // Check chain depth limit
            if (chainDepth > MAX_CHAIN_DEPTH) {
                console.warn(`[resolveAttackFromQueue] Max chain depth reached (${chainDepth}), stopping chain`);
                // Continue to resolve normally
            } else if (eff.type === 'reflect') {
                console.log(`[resolveAttackFromQueue] Creating reflect chain attack (depth ${chainDepth})`);
                
                // Broadcast defense card consumption immediately (for self-reflect or normal reflect)
                io.to(room.id).emit('attack-resolved', {
                    attackerId: attackItem.attackerId,
                    attackerName: attackItem.attackerName,
                    targetId: attackItem.targetId,
                    targetName: attackItem.targetName,
                    damageApplied: 0,  // reflected, no damage to defender
                    mentalDamageApplied: 0,
                    healApplied: 0,
                    targetPrevHealth: prevHealth,
                    targetHealth: targetState ? targetState.health : 0,
                    targetPrevMentalPower: prevMentalPower,
                    targetMentalPower: targetState ? targetState.mentalPower : 0,
                    attackerMentalPower: room.playerStates && room.playerStates[attackItem.attackerId] ? room.playerStates[attackItem.attackerId].mentalPower : 0,
                    eliminated: false,
                    cardsUsed: attackItem.cardsUsed || [],
                    cardsUsedIds: attackItem.cardsUsedIds || [],
                    defenseCards: defenderCardArray,
                    defenseCardIds: defenderCardIds,
                    defenseApplied: finalDamage,  // show original attack damage as "blocked"
                    appliedDebuffs: [],
                    nextPlayerId: null,  // no turn change yet
                    currentTurn: room.currentTurn,
                    timestamp: Date.now(),
                    requestId: attackItem.requestId,
                    chainSource: attackItem.chainSource,
                    isReflected: true,
                    originalDamage: attackItem.damage,  // USE ORIGINAL, not finalDamage!
                    originalMentalDamage: attackItem.mentalDamage || 0
                });
                
                // Prevent self-reflection infinite loop (attacker attacking themselves)
                if (attackItem.targetId === attackItem.attackerId) {
                    console.warn(`[resolveAttackFromQueue] Self-reflection detected (attacker=${attackItem.attackerId}), sending new defend-request to same player`);
                    // Remove current attack and create new defend-request for same player
                    room.attackQueue.removeAttack(attackItem.id);
                    
                    // Create new attack with original damage (not reduced by defense)
                    const newAttackId = `atk_self_refl_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
                    const newRequestId = `srv_self_refl_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;

                    const selfReflectAttack: AttackQueueItem = {
                        id: newAttackId,
                        requestId: newRequestId,
                        attackerId: attackItem.attackerId,  // same attacker
                        attackerName: attackItem.attackerName,
                        targetId: attackItem.attackerId,  // same as attacker (self-target)
                        targetName: attackItem.attackerName,
                        damage: attackItem.damage,  // original attack damage (not finalDamage!)
                        mentalDamage: attackItem.mentalDamage || 0,
                        cardsUsed: [],
                        cardsUsedIds: [],
                        attackAttribute: null,
                        chainDepth,
                        parentAttackId: attackItem.id,
                        chainSource: 'reflect',
                        status: 'pending',
                        timestamp: Date.now(),
                        roomId: room.id
                    };

                    room.attackQueue.enqueue(selfReflectAttack);
                    processNextAttack(room, selfReflectAttack);
                    return;
                }

                // Create new attack item for reflection (normal reflect to another player)
                const newAttackId = `atk_refl_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
                const newRequestId = `srv_refl_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;

                const reflectAttack: AttackQueueItem = {
                    id: newAttackId,
                    requestId: newRequestId,
                    attackerId: attackItem.targetId,  // defender becomes attacker
                    attackerName: room.players.find(p => p.id === attackItem.targetId)?.name || 'unknown',
                    targetId: attackItem.attackerId,  // attacker becomes target
                    targetName: attackItem.attackerName,
                    damage: attackItem.damage,  // USE ORIGINAL ATTACK DAMAGE, not finalDamage!
                    mentalDamage: attackItem.mentalDamage || 0,  // USE ORIGINAL MENTAL DAMAGE
                    cardsUsed: [],
                    cardsUsedIds: [],
                    attackAttribute: null,
                    chainDepth,
                    parentAttackId: attackItem.id,
                    chainSource: 'reflect',
                    status: 'pending',
                    timestamp: Date.now(),
                    roomId: room.id
                };

                // Remove current attack from queue
                room.attackQueue.removeAttack(attackItem.id);

                // Add new reflect attack to queue
                room.attackQueue.enqueue(reflectAttack);

                // Process the reflected attack
                processNextAttack(room, reflectAttack);

                // Do NOT advance turn - wait for chain to resolve
                return;

            } else if (eff.type === 'bounce') {
                console.log(`[resolveAttackFromQueue] Creating bounce chain attack (depth ${chainDepth})`);

                // Broadcast defense card consumption immediately before checking bounce targets
                io.to(room.id).emit('attack-resolved', {
                    attackerId: attackItem.attackerId,
                    attackerName: attackItem.attackerName,
                    targetId: attackItem.targetId,
                    targetName: attackItem.targetName,
                    damageApplied: 0,  // bounced, no damage to defender
                    mentalDamageApplied: 0,
                    healApplied: 0,
                    targetPrevHealth: prevHealth,
                    targetHealth: targetState ? targetState.health : 0,
                    targetPrevMentalPower: prevMentalPower,
                    targetMentalPower: targetState ? targetState.mentalPower : 0,
                    attackerMentalPower: room.playerStates && room.playerStates[attackItem.attackerId] ? room.playerStates[attackItem.attackerId].mentalPower : 0,
                    eliminated: false,
                    cardsUsed: attackItem.cardsUsed || [],
                    cardsUsedIds: attackItem.cardsUsedIds || [],
                    defenseCards: defenderCardArray,
                    defenseCardIds: defenderCardIds,
                    defenseApplied: finalDamage,  // show original attack damage as "blocked"
                    appliedDebuffs: [],
                    nextPlayerId: null,  // no turn change yet
                    currentTurn: room.currentTurn,
                    timestamp: Date.now(),
                    requestId: attackItem.requestId,
                    chainSource: attackItem.chainSource,
                    isBounced: true,
                    originalDamage: attackItem.damage,  // USE ORIGINAL, not finalDamage!
                    originalMentalDamage: attackItem.mentalDamage || 0
                });

                // Pick random alive player (NO exclusions - anyone can be bounced to, even the current defender)
                const alive = room.players.filter(p => room.playerStates && room.playerStates[p.id] && room.playerStates[p.id].alive);
                
                if (alive.length === 0) {
                    // No alive players at all - this shouldn't happen but handle gracefully
                    console.warn(`[resolveAttackFromQueue] No bounce targets available (no alive players)`);
                    room.attackQueue.removeAttack(attackItem.id);
                    
                    const currentIndex = room.currentPlayerIndex ?? 0;
                    const nextIndex = (currentIndex + 1) % room.players.length;
                    room.currentPlayerIndex = nextIndex;
                    room.currentTurn = (room.currentTurn || 1) + (nextIndex === 0 ? 1 : 0);
                    const nextPlayerId = room.players[nextIndex].id;
                    
                    io.to(room.id).emit('turn-end', { roomId: room.id, playerId: attackItem.attackerId, nextPlayerId });
                    io.to(room.id).emit('turn-start', { roomId: room.id, currentPlayerId: nextPlayerId, currentTurn: room.currentTurn });
                    return;
                }

                // Random selection from ALL alive players (including attacker and defender)
                const rnd = alive[Math.floor(Math.random() * alive.length)];
                const bounceTargetId = rnd.id;
                console.log(`[resolveAttackFromQueue] Bouncing attack to ${rnd.name} (from ${alive.length} candidates, including current defender)`);



                const newAttackId = `atk_bounce_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
                const newRequestId = `srv_bounce_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;

                const bounceAttack: AttackQueueItem = {
                    id: newAttackId,
                    requestId: newRequestId,
                    attackerId: attackItem.attackerId,  // original attacker remains
                    attackerName: attackItem.attackerName,
                    targetId: bounceTargetId,  // new random target
                    targetName: room.players.find(p => p.id === bounceTargetId)?.name || 'unknown',
                    damage: attackItem.damage,  // USE ORIGINAL ATTACK DAMAGE, not finalDamage!
                    mentalDamage: attackItem.mentalDamage || 0,  // USE ORIGINAL MENTAL DAMAGE
                    cardsUsed: [],
                    cardsUsedIds: [],
                    attackAttribute: null,
                    chainDepth,
                    parentAttackId: attackItem.id,
                    chainSource: 'bounce',
                    status: 'pending',
                    timestamp: Date.now(),
                    roomId: room.id
                };

                // Remove current attack from queue
                room.attackQueue.removeAttack(attackItem.id);

                // Add new bounce attack to queue
                room.attackQueue.enqueue(bounceAttack);

                // Process the bounced attack
                processNextAttack(room, bounceAttack);

                // Do NOT advance turn - wait for chain to resolve
                return;
            }
        }

        // No special effects - apply damage normally
        console.log(`[resolveAttackFromQueue] No special effects, applying damage normally`);
        
        // Apply any heals first (heals are not blocked by defense)
        if (attackItem.heal && attackItem.heal > 0 && targetState) {
            targetState.health = Math.min(100, (targetState.health || 0) + attackItem.heal);
        }

        if (targetState) {
            // Apply health damage
            targetState.health = Math.max(0, (targetState.health || 0) - finalDamage);
            
            // Apply mental damage (reduces mentalPower)
            if (finalMentalDamage > 0) {
                targetState.mentalPower = Math.max(0, (targetState.mentalPower || 0) - finalMentalDamage);
                console.log(`[Mental Attack] ${attackItem.targetName} lost ${finalMentalDamage} mana (remaining: ${targetState.mentalPower})`);
            }
            
            if (targetState.health <= 0) targetState.alive = false;
        }

        // apply card effects (debuffs) from attacker's cards
        const appliedDebuffs: string[] = [];
        try {
            const atkCards = attackItem.cardsUsed || [];
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

        // No special effects or chain limit reached - finalize attack
        console.log(`[resolveAttackFromQueue] Finalizing attack ${attackItem.id}`);

        // Remove attack from queue
        room.attackQueue.removeAttack(attackItem.id);

        // Advance turn (simple round-robin)
        const currentIndex = room.currentPlayerIndex ?? 0;
        const nextIndex = (currentIndex + 1) % room.players.length;
        room.currentPlayerIndex = nextIndex;
        room.currentTurn = (room.currentTurn || 1) + (nextIndex === 0 ? 1 : 0);
        const nextPlayerId = room.players[nextIndex].id;

        // Build resolved payload
        const resolved = {
            attackerId: attackItem.attackerId,
            attackerName: attackItem.attackerName,
            targetId: attackItem.targetId,
            targetName: attackItem.targetName,
            damageApplied: finalDamage,
            mentalDamageApplied: finalMentalDamage,
            healApplied: attackItem.heal || 0,
            targetPrevHealth: prevHealth,
            targetHealth: targetState ? targetState.health : 0,
            targetPrevMentalPower: prevMentalPower,
            targetMentalPower: targetState ? targetState.mentalPower : 0,
            attackerMentalPower: room.playerStates && room.playerStates[attackItem.attackerId] ? room.playerStates[attackItem.attackerId].mentalPower : 0,
            eliminated: targetState ? !targetState.alive : false,
            cardsUsed: attackItem.cardsUsed || [],
            cardsUsedIds: attackItem.cardsUsedIds || [],
            defenseCards: defenderCardArray,
            defenseCardIds: defenderCardIds,
            defenseApplied: appliedDefense,
            appliedDebuffs,
            nextPlayerId,
            currentTurn: room.currentTurn,
            timestamp: Date.now(),
            requestId: attackItem.requestId,
            chainSource: attackItem.chainSource
        };

        // Store for idempotency
        room.processedRequests = room.processedRequests || {};
        room.processedRequests[attackItem.requestId] = { resolved, timestamp: Date.now() };

        // Broadcast resolution
        io.to(room.id).emit('attack-resolved', resolved);
        io.to(room.id).emit('turn-end', { roomId: room.id, playerId: attackItem.attackerId, nextPlayerId });
        io.to(room.id).emit('turn-start', { roomId: room.id, currentPlayerId: nextPlayerId, currentTurn: room.currentTurn });

        console.log(`✅ Attack resolved: ${attackItem.id}, next player: ${nextPlayerId}`);
    }

    // helper to resolve pending attack with no defense (DEPRECATED - kept for compatibility)
    function resolvePendingAttack(room: Room, pendingId: string, defenderCards: any[] | null) {
        const pending = room.pendingAttacks && room.pendingAttacks[pendingId];
        if (!pending) return;

        // apply heal first (heals are not blocked by defense), then damage
        const targetState = room.playerStates && room.playerStates[pending.targetId];
        const prevHealth = targetState ? targetState.health : 0;
        const finalDamage = pending.damage || 0; // no defense

        if (pending.heal && pending.heal > 0 && targetState) {
            targetState.health = Math.min(100, (targetState.health || 0) + pending.heal);
        }

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
            healApplied: pending.heal || 0,
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

    // TEST-HOOK: forcefully set a player's authoritative health (for integration tests)
    socket.on('force-set-health', (data: { roomId: string, playerId: string, health: number }) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.isPlaying) return;
        room.playerStates = room.playerStates || {};
        room.playerStates[data.playerId] = room.playerStates[data.playerId] || { health: 100, mentalPower: 100, alive: true };
        room.playerStates[data.playerId].health = Math.max(0, Math.min(100, data.health));
        console.log(`TEST-HOOK: set health for ${data.playerId} = ${room.playerStates[data.playerId].health}`);
        io.to(data.roomId).emit('player-state-update', { roomId: data.roomId, playerId: data.playerId, health: room.playerStates[data.playerId].health });
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
