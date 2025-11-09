import { Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager';
import { CombatService, MAX_CHAIN_DEPTH } from '../services/CombatService';
import { DamageCalculator } from '../services/DamageCalculator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ErrorCode } from '../constants/ErrorCodes';
import { DEFEND_TIMEOUT_MS, ATTACK_ID_PREFIX, REQUEST_ID_PREFIX } from '../constants/GameConstants';
import { AttackQueue } from '../models/AttackQueue';
import {
    PlayerAttackEvent,
    PlayerDefendEvent,
    SocketEvents
} from '../types/events';
import { Player, Card, AttackQueueItem, Room } from '../types';

/**
 * Combat Event Handler
 * 
 * Handles all combat-related socket events:
 * - player-attack
 * - player-defend
 * - attack resolution logic
 */
export class CombatEventHandler {
    private io: any;
    private roomManager: RoomManager;
    private combatService: CombatService;
    private damageCalculator: DamageCalculator;
    private errorHandler: ErrorHandler;

    constructor(
        io: any,
        roomManager: RoomManager,
        combatService: CombatService,
        damageCalculator: DamageCalculator,
        errorHandler: ErrorHandler
    ) {
        this.io = io;
        this.roomManager = roomManager;
        this.combatService = combatService;
        this.damageCalculator = damageCalculator;
        this.errorHandler = errorHandler;
    }

    /**
     * Handle player-attack event
     */
    handlePlayerAttack(socket: Socket, data: PlayerAttackEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            this.errorHandler.handleGameNotStarted(socket, data.roomId);
            return;
        }

        // Find attacker by socket id to ensure authenticity
        const attacker = room.players.find((p: Player) => p.socketId === socket.id);
        if (!attacker || attacker.id !== data.attackerId) {
            this.errorHandler.sendError(socket, ErrorCode.ATTACK_INVALID);
            return;
        }

        // Ensure it's attacker's turn according to server-side tracking
        const currentIndex = room.currentPlayerIndex ?? 0;
        const currentPlayer = room.players[currentIndex];
        // Test override: allow force=true to bypass turn check (used by integration test harness)
        if (attacker.id !== currentPlayer.id && !data.force) {
            this.errorHandler.handleInvalidTurn(socket, currentPlayer.id, attacker.id);
            return;
        }

        // Idempotency: if requestId already processed, re-send stored resolved
        const reqId = data.requestId;
        if (reqId && room.processedRequests && room.processedRequests[reqId]) {
            this.resendCachedAttackResult(room, reqId);
            return;
        }

        // Use CombatService to calculate damage
        const cards = Array.isArray(data.cards) ? data.cards as Card[] : [];
        const { damage: damageFromCards, mentalDamage: mentalDamageFromCards, heal: healFromCards, attribute: attackAttribute } = 
            this.combatService.calculateAttackDamage(cards);
        
        // Ensure playerStates exists
        this.ensurePlayerStates(room);
        
        // Check if attacker has enough mana and deduct cost
        const attackerState = room.playerStates![attacker.id];
        if (!this.combatService.canAffordCards(attackerState, cards)) {
            this.errorHandler.handleInsufficientMana(
                socket,
                this.damageCalculator.calculateTotalCost(cards),
                attackerState.mentalPower
            );
            return;
        }
        
        const totalCost = this.combatService.deductManaCost(attackerState, cards);
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

        const targetState = room.playerStates![data.targetId];
        const targetPlayer = room.players.find(p => p.id === data.targetId);
        if (!targetState || !targetPlayer) {
            this.errorHandler.handleTargetNotFound(socket, data.targetId);
            return;
        }

        // Initialize attack queue if not exists
        if (!room.attackQueue) {
            room.attackQueue = new AttackQueue();
        }

        // Create attack queue item
        const attackId = `${ATTACK_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
        const requestId = reqId || `${REQUEST_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
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
        this.processNextAttack(room, attackItem);
    }

    /**
     * Handle player-defend event
     */
    handlePlayerDefend(socket: Socket, data: PlayerDefendEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            return;
        }

        if (!room.attackQueue) {
            this.errorHandler.handleAttackQueueNotInitialized(socket, data.roomId);
            return;
        }

        // Find attack in queue by requestId
        const attackItem = room.attackQueue.getAttackByRequestId(data.requestId);
        if (!attackItem) {
            this.errorHandler.handleDefenseRequestNotFound(socket, data.requestId);
            return;
        }

        // validate defender
        if (attackItem.targetId !== data.defenderId) {
            this.errorHandler.handleInvalidDefense(socket, data.defenderId, attackItem.targetId);
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
                this.errorHandler.handleInsufficientMana(
                    socket,
                    totalDefenseCost,
                    defenderState?.mentalPower || 0
                );
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
        this.resolveAttackFromQueue(room, data.requestId, defenderCards);
    }

    /**
     * Process next attack in queue (send defend-request)
     */
    private processNextAttack(room: Room, attackItem: AttackQueueItem): void {
        // Ensure server turn tracker aligns with the upcoming attacker (important for reflect chains)
        const attackerIndex = room.players.findIndex(p => p.id === attackItem.attackerId);
        if (attackerIndex !== -1) {
            room.currentPlayerIndex = attackerIndex;
        }

        // Broadcast announcement so UI can show center info for everyone
        this.io.to(room.id).emit(SocketEvents.ATTACK_ANNOUNCED, {
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
        const expiresAt = Date.now() + DEFEND_TIMEOUT_MS;

        this.io.to(room.id).emit(SocketEvents.DEFEND_REQUEST, {
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
        console.log(`📤 defend-request emitted to room ${room.id} for defender ${attackItem.targetId}, expiresAt=${expiresAt}`);

        // set timeout to auto-resolve if defender doesn't respond in time
        const timeoutId = setTimeout(() => {
            // if still in queue, resolve without defense
            if (room.attackQueue && room.attackQueue.getAttackByRequestId(attackItem.requestId)) {
                this.resolveAttackFromQueue(room, attackItem.requestId, null);
            }
        }, DEFEND_TIMEOUT_MS);

        // attach timeout id
        attackItem.timeoutId = timeoutId;
    }

    /**
     * Resolve attack from queue
     * This is the main combat resolution logic extracted from server.ts
     */
    private resolveAttackFromQueue(room: Room, requestId: string, defenderCards: Card[] | null): void {
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
        this.io.to(room.id).emit(SocketEvents.PLAYER_DEFEND, {
            defenderId: attackItem.targetId,
            cards: defenderCardArray,
            cardIds: defenderCardIds
        });

        // Use CombatService to process defense
        const { defenseValue, isEffective, appliedDefense } = this.combatService.processDefense(
            attackItem.attackAttribute,
            defenderCardArray
        );

        const targetState = room.playerStates?.[attackItem.targetId];
        const prevHealth = targetState?.health || 0;
        const prevMentalPower = targetState?.mentalPower || 0;
        
        // Defense cards can only block health damage, NOT mental damage
        const finalDamage = this.damageCalculator.applyDefenseReduction(attackItem.damage, appliedDefense);
        const finalMentalDamage = attackItem.mentalDamage || 0;

        // Check for special defense effects FIRST (reflect/bounce) - BEFORE applying damage
        const specialEffect = this.combatService.checkSpecialEffects(defenderCardArray);

        // If special effects exist, handle them WITHOUT applying damage to defender
        if (specialEffect) {
            this.handleSpecialEffect(room, attackItem, specialEffect, defenderCardArray, defenderCardIds, finalDamage, prevHealth, prevMentalPower);
            return;
        }

        // No special effects - apply damage normally
        this.applyNormalDamage(room, attackItem, defenderCardArray, defenderCardIds, appliedDefense, finalDamage, finalMentalDamage, prevHealth, prevMentalPower);
    }

    /**
     * Handle special effects (reflect/bounce)
     */
    private handleSpecialEffect(
        room: Room,
        attackItem: AttackQueueItem,
        specialEffect: { type: 'reflect' | 'bounce'; card: Card },
        defenderCardArray: Card[],
        defenderCardIds: string[],
        finalDamage: number,
        prevHealth: number,
        prevMentalPower: number
    ): void {
        const targetState = room.playerStates?.[attackItem.targetId];
        const chainDepth = attackItem.chainDepth + 1;

        // Check chain depth limit
        if (chainDepth > MAX_CHAIN_DEPTH) {
            console.warn(`[handleSpecialEffect] Max chain depth reached (${chainDepth}), stopping chain`);
            // Fall through to apply normal damage
            this.applyNormalDamage(
                room, attackItem, defenderCardArray, defenderCardIds,
                0, finalDamage, attackItem.mentalDamage || 0, prevHealth, prevMentalPower
            );
            return;
        }

        if (specialEffect.type === 'reflect') {
            this.handleReflect(room, attackItem, defenderCardArray, defenderCardIds, finalDamage, prevHealth, prevMentalPower, targetState, chainDepth);
        } else if (specialEffect.type === 'bounce') {
            this.handleBounce(room, attackItem, defenderCardArray, defenderCardIds, finalDamage, prevHealth, prevMentalPower, targetState, chainDepth);
        }
    }

    /**
     * Handle reflect effect
     */
    private handleReflect(
        room: Room,
        attackItem: AttackQueueItem,
        defenderCardArray: Card[],
        defenderCardIds: string[],
        finalDamage: number,
        prevHealth: number,
        prevMentalPower: number,
        targetState: any,
        chainDepth: number
    ): void {
        console.log(`[handleReflect] Creating reflect chain attack (depth ${chainDepth})`);
        
        // Broadcast defense card consumption immediately
        this.io.to(room.id).emit(SocketEvents.ATTACK_RESOLVED, {
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
            defenseApplied: finalDamage,
            appliedDebuffs: [],
            nextPlayerId: null,
            currentTurn: room.currentTurn || 1,
            timestamp: Date.now(),
            requestId: attackItem.requestId,
            chainSource: attackItem.chainSource,
            isReflected: true,
            originalDamage: attackItem.damage,
            originalMentalDamage: attackItem.mentalDamage || 0
        });
        
        // Prevent self-reflection infinite loop
        if (attackItem.targetId === attackItem.attackerId) {
            console.warn(`[handleReflect] Self-reflection detected, sending new defend-request`);
            room.attackQueue!.removeAttack(attackItem.id);
            
            const selfReflectAttack = this.combatService.createSelfReflectAttack(attackItem, room);
            room.attackQueue!.enqueue(selfReflectAttack);
            this.processNextAttack(room, selfReflectAttack);
            return;
        }

        // Create and process reflect attack
        const reflectAttack = this.combatService.createReflectAttack(attackItem, room);
        room.attackQueue!.removeAttack(attackItem.id);
        room.attackQueue!.enqueue(reflectAttack);
        this.processNextAttack(room, reflectAttack);
    }

    /**
     * Handle bounce effect
     */
    private handleBounce(
        room: Room,
        attackItem: AttackQueueItem,
        defenderCardArray: Card[],
        defenderCardIds: string[],
        finalDamage: number,
        prevHealth: number,
        prevMentalPower: number,
        targetState: any,
        chainDepth: number
    ): void {
        console.log(`[handleBounce] Creating bounce chain attack (depth ${chainDepth})`);

        // Broadcast defense card consumption immediately
        this.io.to(room.id).emit(SocketEvents.ATTACK_RESOLVED, {
            attackerId: attackItem.attackerId,
            attackerName: attackItem.attackerName,
            targetId: attackItem.targetId,
            targetName: attackItem.targetName,
            damageApplied: 0,
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
            defenseApplied: finalDamage,
            appliedDebuffs: [],
            nextPlayerId: null,
            currentTurn: room.currentTurn,
            timestamp: Date.now(),
            requestId: attackItem.requestId,
            chainSource: attackItem.chainSource,
            isBounced: true,
            originalDamage: attackItem.damage,
            originalMentalDamage: attackItem.mentalDamage || 0
        });

        // Select bounce target
        const bounceTarget = this.combatService.selectBounceTarget(room, attackItem.targetId);
        
        if (!bounceTarget) {
            console.warn(`[handleBounce] No bounce targets available`);
            this.advanceTurnAndEnd(room, attackItem.attackerId);
            return;
        }

        console.log(`[handleBounce] Bouncing attack to ${bounceTarget.name}`);

        // Create and process bounce attack
        const bounceAttack = this.combatService.createBounceAttack(
            attackItem,
            bounceTarget.id,
            bounceTarget.name,
            room
        );

        room.attackQueue!.removeAttack(attackItem.id);
        room.attackQueue!.enqueue(bounceAttack);
        this.processNextAttack(room, bounceAttack);
    }

    /**
     * Apply normal damage (no special effects)
     */
    private applyNormalDamage(
        room: Room,
        attackItem: AttackQueueItem,
        defenderCardArray: Card[],
        defenderCardIds: string[],
        appliedDefense: number,
        finalDamage: number,
        finalMentalDamage: number,
        prevHealth: number,
        prevMentalPower: number
    ): void {
        console.log(`[applyNormalDamage] Applying damage normally`);
        
        const targetState = room.playerStates?.[attackItem.targetId];
        if (!targetState) {
            console.error(`[applyNormalDamage] No target state found for ${attackItem.targetId}`);
            return;
        }

        // Apply heal if present
        if (attackItem.heal && attackItem.heal > 0) {
            this.combatService.applyHeal(targetState, attackItem.heal);
        }

        // Apply damage (health and mental)
        const { finalHealthDamage, finalMentalDamage: appliedMentalDamage } = 
            this.combatService.applyDamage(targetState, attackItem.damage, finalMentalDamage, appliedDefense);
        
        if (appliedMentalDamage > 0) {
            console.log(`[Mental Attack] ${attackItem.targetName} lost ${appliedMentalDamage} mana (remaining: ${targetState.mentalPower})`);
        }

        // Apply debuffs from attacker's cards
        const appliedDebuffs = this.combatService.applyDebuffs(targetState, attackItem.cardsUsed);

        // Finalize attack
        console.log(`[applyNormalDamage] Finalizing attack ${attackItem.id}`);

        // Remove attack from queue
        room.attackQueue!.removeAttack(attackItem.id);

        // Advance turn
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
            targetHealth: targetState.health,
            targetPrevMentalPower: prevMentalPower,
            targetMentalPower: targetState.mentalPower,
            attackerMentalPower: room.playerStates?.[attackItem.attackerId]?.mentalPower || 0,
            eliminated: !targetState.alive,
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
        this.io.to(room.id).emit(SocketEvents.ATTACK_RESOLVED, resolved);
        this.io.to(room.id).emit(SocketEvents.TURN_END, { 
            roomId: room.id, 
            playerId: attackItem.attackerId, 
            nextPlayerId 
        });
        this.io.to(room.id).emit(SocketEvents.TURN_START, { 
            roomId: room.id, 
            currentPlayerId: nextPlayerId, 
            currentTurn: room.currentTurn 
        });

        console.log(`✅ Attack resolved: ${attackItem.id}, next player: ${nextPlayerId}`);
    }

    /**
     * Advance turn and end attack chain
     */
    private advanceTurnAndEnd(room: Room, attackerId: string): void {
        const currentIndex = room.currentPlayerIndex ?? 0;
        const nextIndex = (currentIndex + 1) % room.players.length;
        room.currentPlayerIndex = nextIndex;
        room.currentTurn = (room.currentTurn || 1) + (nextIndex === 0 ? 1 : 0);
        const nextPlayerId = room.players[nextIndex].id;
        
        this.io.to(room.id).emit(SocketEvents.TURN_END, { 
            roomId: room.id, 
            playerId: attackerId, 
            nextPlayerId 
        });
        this.io.to(room.id).emit(SocketEvents.TURN_START, { 
            roomId: room.id, 
            currentPlayerId: nextPlayerId, 
            currentTurn: room.currentTurn 
        });
    }

    /**
     * Ensure player states exist for all players in room
     */
    private ensurePlayerStates(room: Room): void {
        if (!room.playerStates) {
            room.playerStates = {};
            for (const p of room.players) {
                room.playerStates[p.id] = { health: 100, mentalPower: 100, alive: true };
            }
        }
    }

    /**
     * Resend cached attack result for idempotency
     */
    private resendCachedAttackResult(room: Room, requestId: string): void {
        const cachedEntry = room.processedRequests![requestId];
        const cached = cachedEntry.resolved;
        this.io.to(room.id).emit(SocketEvents.ATTACK_RESOLVED, cached);
        // Also emit turn events based on cached if present
        if (cached.nextPlayerId) {
            this.io.to(room.id).emit(SocketEvents.TURN_END, { 
                roomId: room.id, 
                playerId: cached.attackerId, 
                nextPlayerId: cached.nextPlayerId 
            });
            this.io.to(room.id).emit(SocketEvents.TURN_START, { 
                roomId: room.id, 
                currentPlayerId: cached.nextPlayerId, 
                currentTurn: cached.currentTurn 
            });
        }
    }

    /**
     * Setup combat event listeners for a socket
     */
    setupListeners(socket: Socket): void {
        socket.on(SocketEvents.PLAYER_ATTACK, (data: PlayerAttackEvent) => {
            this.handlePlayerAttack(socket, data);
        });

        socket.on(SocketEvents.PLAYER_DEFEND, (data: PlayerDefendEvent) => {
            this.handlePlayerDefend(socket, data);
        });
    }
}
