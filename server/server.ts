import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

// Import refactored modules
import { AttackQueue } from './models/AttackQueue';
import { CombatService, MAX_CHAIN_DEPTH } from './services/CombatService';
import { DamageCalculator } from './services/DamageCalculator';
import { EffectProcessor } from './services/EffectProcessor';
import { RoomManager } from './services/RoomManager';
import {
    AttackQueueItem,
    Card,
    Player,
    PlayerState,
    Room,
    AttackRequest,
    DefendRequest,
    AttackResult
} from './types';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Initialize services
const combatService = new CombatService();
const damageCalculator = new DamageCalculator();
const effectProcessor = new EffectProcessor();
const roomManager = new RoomManager();

io.on('connection', (socket: Socket) => {
    console.log(`???�라?�언???�결: ${socket.id}`);

    // �??�성
    socket.on('create-room', (data: { playerName: string, gameType: 'normal' | 'ranked' }) => {
        const { roomId, room } = roomManager.createRoom(data.playerName, socket.id, data.gameType);
        
        socket.join(roomId);

        socket.emit('room-created', {
            roomId,
            room
        });

        console.log(`?�� �??�성: ${roomId} by ${data.playerName}`);
    });

    // �?참�?
    socket.on('join-room', (data: { roomId: string, playerName: string }) => {
        const result = roomManager.joinRoom(data.roomId, data.playerName, socket.id);

        if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
        }

        socket.join(data.roomId);

        // 방의 모든 ?�레?�어?�게 ?�데?�트
        io.to(data.roomId).emit('room-updated', { room: result.room });

        socket.emit('room-joined', {
            roomId: data.roomId,
            room: result.room
        });

        console.log(`?�� ${data.playerName} 참�?: ${data.roomId}`);
    });

    // �??��?�?
    socket.on('leave-room', (data: { roomId: string }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room) return;

        const player = room.players.find((p: Player) => p.socketId === socket.id);
        if (!player) return;

        const result = roomManager.removePlayer(socket.id);
        socket.leave(data.roomId);

        if (result.isEmpty) {
            console.log(`?���?�???��: ${data.roomId}`);
        } else if (result.room) {
            io.to(data.roomId).emit('room-updated', { room: result.room });
        }

        console.log(`?�� ${player.name} ?�장: ${data.roomId}`);
    });

    // 준�??�태 ?��?
    socket.on('toggle-ready', (data: { roomId: string }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room) return;

        const player = room.players.find((p: Player) => p.socketId === socket.id);
        if (!player) return;

        roomManager.setPlayerReady(data.roomId, player.id, !player.isReady);

        io.to(data.roomId).emit('room-updated', { room });

        console.log(`??${player.name} 준�? ${player.isReady}`);
    });

    // 게임 ?�작
    socket.on('start-game', (data: { roomId: string }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room) return;

        const player = room.players.find((p: Player) => p.socketId === socket.id);
        if (!player || player.id !== room.hostId) {
            socket.emit('error', { message: '?�스?�만 게임???�작?????�습?�다.' });
            return;
        }

        // 게임 ?�작???�해 최소 ?�레?�어 ?��? ?�인 (2�??�상)
        if (room.players.length < 2) {
            socket.emit('error', { message: '게임???�작?�려�?최소 2�??�상???�레?�어가 ?�요?�니??' });
            return;
        }

        // Start game using RoomManager
        roomManager.startGame(data.roomId);

        // Initialize attack queue
        room.attackQueue = new AttackQueue();
        console.log(`[AttackQueue] Initialized for room ${data.roomId}`);

        // Broadcast authoritative game start and initial turn
        io.to(data.roomId).emit('game-starting', { room });
        io.to(data.roomId).emit('turn-start', { roomId: data.roomId, currentPlayerId: room.players[0].id, currentTurn: room.currentTurn });

        console.log(`?�� 게임 ?�작: ${data.roomId} (turn=${room.currentTurn}, player=${room.players[0].name})`);
    });

    // 게임 ?�션 (카드 ?�용, 공격 ??
    socket.on('game-action', (data: { roomId: string, action: unknown }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) return;

        // 모든 ?�레?�어?�게 ?�션 브로?�캐?�트
        socket.to(data.roomId).emit('game-action', data.action);
    });

    // 공격 ?�션 (??기반?�로 ?�구??
    socket.on('player-attack', (data: { roomId: string, attackerId: string, targetId: string, cards: Card[], damage: number, requestId?: string, force?: boolean }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            socket.emit('error', { message: '게임 중이 ?�닌 방입?�다.' });
            return;
        }

        // Find attacker by socket id to ensure authenticity
        const attacker = room.players.find((p: Player) => p.socketId === socket.id);
        if (!attacker || attacker.id !== data.attackerId) {
            socket.emit('error', { message: '?�효?��? ?��? 공격?�입?�다.' });
            return;
        }

        // Ensure it's attacker's turn according to server-side tracking
        const currentIndex = room.currentPlayerIndex ?? 0;
        const currentPlayer = room.players[currentIndex];
        // Test override: allow force=true to bypass turn check (used by integration test harness)
        if (attacker.id !== currentPlayer.id && !data.force) {
            socket.emit('error', { message: '?�재 차�?가 ?�닙?�다.' });
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

        // Use CombatService to calculate damage
        const cards = Array.isArray(data.cards) ? data.cards as Card[] : [];
        const { damage: damageFromCards, mentalDamage: mentalDamageFromCards, heal: healFromCards, attribute: attackAttribute } = 
            combatService.calculateAttackDamage(cards);
        
        // Ensure playerStates exists
        if (!room.playerStates) {
            room.playerStates = {};
            for (const p of room.players) {
                room.playerStates[p.id] = { health: 100, mentalPower: 100, alive: true };
            }
        }
        
        // Check if attacker has enough mana and deduct cost
        const attackerState = room.playerStates[attacker.id];
        if (!combatService.canAffordCards(attackerState, cards)) {
            socket.emit('error', { message: '마나가 부족합?�다!' });
            return;
        }
        
        const totalCost = combatService.deductManaCost(attackerState, cards);
        if (totalCost > 0) {
            console.log(`[Attack] ${attacker.name} used ${totalCost} mana (remaining: ${attackerState.mentalPower})`);
        }

        let damage = 0;
        if (cards.length > 0) {
            damage = damageFromCards;
            if (typeof data.damage === 'number') {
                console.warn(`Server: Ignoring client-sent damage=${data.damage} because cards were provided. Using damageFromCards=${damageFromCards}`);
            }
        } else {
            damage = typeof data.damage === 'number' ? data.damage : 0;
        }

        console.log(`Server: computed damage (fromClient=${data.damage ?? 'null'}, fromCards=${damageFromCards}) => final=${damage}, mentalDamage=${mentalDamageFromCards}`);

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
            socket.emit('error', { message: '?�겟을 찾을 ???�습?�다.' });
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
            cardsUsedIds: pendingCards.map((c: Card) => c && c.id).filter(Boolean),
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

    // ?�에???�음 공격 처리
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
        console.log(`?�� defend-request emitted to room ${room.id} for defender ${attackItem.targetId}, expiresAt=${expiresAt}`);

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

    // defender response handler - server authoritative defense resolution (??기반)
    socket.on('player-defend', (data: { roomId: string, requestId: string, defenderId: string, cards: Card[], defense?: number }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) return;

        if (!room.attackQueue) {
            socket.emit('error', { message: '공격 ?��? 초기?�되지 ?�았?�니??' });
            return;
        }

        // Find attack in queue by requestId
        const attackItem = room.attackQueue.getAttackByRequestId(data.requestId);
        if (!attackItem) {
            socket.emit('error', { message: '?�당 방어 ?�청??찾을 ???�습?�다.' });
            return;
        }

        // validate defender
        if (attackItem.targetId !== data.defenderId) {
            socket.emit('error', { message: '?�신?� ??공격??방어?��? ?�닙?�다.' });
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
                socket.emit('error', { message: '마나가 부족합?�다!' });
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

    // ?�에??공격 ?�결 ?�수
    function resolveAttackFromQueue(room: Room, requestId: string, defenderCards: Card[] | null): void {
        if (!room.attackQueue) return;

        const attackItem = room.attackQueue.getAttackByRequestId(requestId);
        if (!attackItem) {
            console.warn(`[resolveAttackFromQueue] Attack not found: ${requestId}`);
            return;
        }

        console.log(`[resolveAttackFromQueue] Resolving attack ${attackItem.id}, chainDepth=${attackItem.chainDepth}`);

        const defenderCardArray = Array.isArray(defenderCards) ? defenderCards : [];
        const defenderCardIds = defenderCardArray.map(c => c?.id).filter(Boolean);

        // Broadcast defender's chosen cards immediately
        io.to(room.id).emit('player-defend', {
            defenderId: attackItem.targetId,
            cards: defenderCardArray,
            cardIds: defenderCardIds
        });

        // Use CombatService to process defense
        const { defenseValue, isEffective, appliedDefense } = combatService.processDefense(
            attackItem.attackAttribute,
            defenderCardArray
        );

        const targetState = room.playerStates?.[attackItem.targetId];
        const prevHealth = targetState?.health || 0;
        const prevMentalPower = targetState?.mentalPower || 0;
        
        // Defense cards can only block health damage, NOT mental damage
        const finalDamage = damageCalculator.applyDefenseReduction(attackItem.damage, appliedDefense);
        const finalMentalDamage = attackItem.mentalDamage || 0;

        // Check for special defense effects FIRST (reflect/bounce) - BEFORE applying damage
        const specialEffect = combatService.checkSpecialEffects(defenderCardArray);

        // If special effects exist, handle them WITHOUT applying damage to defender
        if (specialEffect) {
            const chainDepth = attackItem.chainDepth + 1;

            // Check chain depth limit
            if (chainDepth > MAX_CHAIN_DEPTH) {
                console.warn(`[resolveAttackFromQueue] Max chain depth reached (${chainDepth}), stopping chain`);
                // Continue to resolve normally (fall through to normal damage application)
            } else if (specialEffect.type === 'reflect') {
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
                    targetHealth: targetState?.health || 0,
                    targetPrevMentalPower: prevMentalPower,
                    targetMentalPower: targetState?.mentalPower || 0,
                    attackerMentalPower: room.playerStates?.[attackItem.attackerId]?.mentalPower || 0,
                    eliminated: false,
                    cardsUsed: attackItem.cardsUsed || [],
                    cardsUsedIds: attackItem.cardsUsedIds || [],
                    defenseCards: defenderCardArray,
                    defenseCardIds: defenderCardIds,
                    defenseApplied: finalDamage,  // show original attack damage as "blocked"
                    appliedDebuffs: [],
                    nextPlayerId: null,  // no turn change yet
                    currentTurn: room.currentTurn || 1,
                    timestamp: Date.now(),
                    requestId: attackItem.requestId,
                    chainSource: attackItem.chainSource,
                    isReflected: true,
                    originalDamage: attackItem.damage,
                    originalMentalDamage: attackItem.mentalDamage || 0
                });
                
                // Prevent self-reflection infinite loop (attacker attacking themselves)
                if (attackItem.targetId === attackItem.attackerId) {
                    console.warn(`[resolveAttackFromQueue] Self-reflection detected (attacker=${attackItem.attackerId}), sending new defend-request to same player`);
                    room.attackQueue.removeAttack(attackItem.id);
                    
                    // Use CombatService to create self-reflect attack
                    const selfReflectAttack = combatService.createSelfReflectAttack(attackItem, room);
                    
                    room.attackQueue.enqueue(selfReflectAttack);
                    processNextAttack(room, selfReflectAttack);
                    return;
                }

                // Use CombatService to create reflect attack
                const reflectAttack = combatService.createReflectAttack(attackItem, room);

                // Remove current attack from queue
                room.attackQueue.removeAttack(attackItem.id);

                // Add new reflect attack to queue
                room.attackQueue.enqueue(reflectAttack);

                // Process the reflected attack
                processNextAttack(room, reflectAttack);

                // Do NOT advance turn - wait for chain to resolve
                return;

            } else if (specialEffect.type === 'bounce') {
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
                    targetHealth: targetState?.health || 0,
                    targetPrevMentalPower: prevMentalPower,
                    targetMentalPower: targetState?.mentalPower || 0,
                    attackerMentalPower: room.playerStates?.[attackItem.attackerId]?.mentalPower || 0,
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

                // Use CombatService to select random bounce target
                const bounceTarget = combatService.selectBounceTarget(room, attackItem.targetId);
                
                if (!bounceTarget) {
                    console.warn(`[resolveAttackFromQueue] No bounce targets available`);
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

                console.log(`[resolveAttackFromQueue] Bouncing attack to ${bounceTarget.name}`);

                // Use CombatService to create bounce attack
                const bounceAttack = combatService.createBounceAttack(
                    attackItem,
                    bounceTarget.id,
                    bounceTarget.name,
                    room
                );

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

        // No special effects - apply damage normally using CombatService
        console.log(`[resolveAttackFromQueue] No special effects, applying damage normally`);
        
        if (!targetState) {
            console.error(`[resolveAttackFromQueue] No target state found for ${attackItem.targetId}`);
            return;
        }

        // Apply heal if present
        if (attackItem.heal && attackItem.heal > 0) {
            combatService.applyHeal(targetState, attackItem.heal);
        }

        // Apply damage (health and mental)
        const { finalHealthDamage, finalMentalDamage: appliedMentalDamage } = 
            combatService.applyDamage(targetState, attackItem.damage, finalMentalDamage, appliedDefense);
        
        if (appliedMentalDamage > 0) {
            console.log(`[Mental Attack] ${attackItem.targetName} lost ${appliedMentalDamage} mana (remaining: ${targetState.mentalPower})`);
        }

        // Apply debuffs from attacker's cards
        const appliedDebuffs = combatService.applyDebuffs(targetState, attackItem.cardsUsed);

        // Finalize attack
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

        console.log(`??Attack resolved: ${attackItem.id}, next player: ${nextPlayerId}`);
    }

    // helper to resolve pending attack with no defense (DEPRECATED - kept for compatibility)
    function resolvePendingAttack(room: Room, pendingId: string, defenderCards: Card[] | null) {
        const pending = room.pendingAttacks && room.pendingAttacks[pendingId];
        if (!pending) return;

        const targetState = room.playerStates && room.playerStates[pending.targetId];
        if (!targetState) return;

        const prevHealth = targetState.health;
        const finalDamage = pending.damage || 0;
        const healAmount = pending.heal || 0;

        // Apply heal using CombatService
        if (healAmount > 0) {
            combatService.applyHeal(targetState, healAmount);
        }

        // Apply damage using CombatService
        const { finalHealthDamage } = combatService.applyDamage(targetState, finalDamage, 0, 0);

        // Extract and apply debuffs using CombatService
        const atkCards = (pending.cardsUsed || []) as Card[];
        const appliedDebuffs = combatService.applyDebuffs(targetState, atkCards);

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

    // ??종료
    socket.on('turn-end', (data: { roomId: string, playerId: string, nextPlayerId: string }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) return;

        console.log(`?�� ??종료: ${data.playerId} -> ${data.nextPlayerId}`);
        io.to(data.roomId).emit('turn-end', data);
    });

    // ?�수 ?�벤??
    socket.on('special-event', (data: { roomId: string, eventType: string, eventData: unknown }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) return;

        console.log(`???�수 ?�벤?? ${data.eventType}`);
        io.to(data.roomId).emit('special-event', data);
    });

    // TEST-HOOK: forcefully set a player's authoritative health (for integration tests)
    socket.on('force-set-health', (data: { roomId: string, playerId: string, health: number }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) return;
        room.playerStates = room.playerStates || {};
        room.playerStates[data.playerId] = room.playerStates[data.playerId] || { health: 100, mentalPower: 100, alive: true };
        room.playerStates[data.playerId].health = Math.max(0, Math.min(100, data.health));
        console.log(`TEST-HOOK: set health for ${data.playerId} = ${room.playerStates[data.playerId].health}`);
        io.to(data.roomId).emit('player-state-update', { roomId: data.roomId, playerId: data.playerId, health: room.playerStates[data.playerId].health });
    });

    // ?�레?�어 ?�태 ?�데?�트
    socket.on('player-state-update', (data: { roomId: string, playerId: string, health: number, mentalPower: number, cards: Card[] }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) return;

        io.to(data.roomId).emit('player-state-update', data);
    });

    // 게임 종료
    socket.on('game-over', (data: { roomId: string, winnerId: string, stats: unknown }) => {
        const room = roomManager.getRoom(data.roomId);
        if (!room) return;

        room.isPlaying = false;
        console.log(`?�� 게임 종료: ${data.roomId}, ?�자: ${data.winnerId}`);
        io.to(data.roomId).emit('game-over', data);
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log(`❌ 클라이언트 연결 해제: ${socket.id}`);

        const result = roomManager.removePlayer(socket.id);
        
        if (result.roomId) {
            if (result.isEmpty) {
                console.log(`🗑️ 방 삭제: ${result.roomId}`);
            } else if (result.room && result.player) {
                io.to(result.roomId).emit('room-updated', { room: result.room });
                io.to(result.roomId).emit('player-disconnected', { playerName: result.player.name });
            }
        }
    });

    // 방 목록 요청
    socket.on('get-rooms', (data?: { gameType?: 'normal' | 'ranked' }) => {
        const availableRooms = roomManager.getAvailableRooms(data?.gameType);
        socket.emit('rooms-list', { rooms: availableRooms });
    });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`?? ?�버 ?�행 �? http://localhost:${PORT}`);
});

// Cleanup processedRequests older than TTL to avoid memory growth
const PROCESSED_REQUEST_TTL = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

setInterval(() => {
    const cutoff = Date.now() - PROCESSED_REQUEST_TTL;
    for (const room of roomManager.getAllRooms()) {
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


