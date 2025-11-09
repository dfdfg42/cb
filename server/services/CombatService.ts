import { Room, Player, PlayerState, AttackQueueItem, Card } from '../types';
import { DamageCalculator } from './DamageCalculator';
import { EffectProcessor } from './EffectProcessor';

export const MAX_CHAIN_DEPTH = 6;

/**
 * Combat service
 * Handles all combat-related logic including damage application, special effects, and chain attacks
 */
export class CombatService {
    private damageCalc: DamageCalculator;
    private effectProc: EffectProcessor;

    constructor() {
        this.damageCalc = new DamageCalculator();
        this.effectProc = new EffectProcessor();
    }

    /**
     * Validate if player can afford card costs
     */
    canAffordCards(playerState: PlayerState, cards: Card[]): boolean {
        const cost = this.damageCalc.calculateTotalCost(cards);
        return playerState.mentalPower >= cost;
    }

    /**
     * Deduct mana cost from player
     */
    deductManaCost(playerState: PlayerState, cards: Card[]): number {
        const cost = this.damageCalc.calculateTotalCost(cards);
        playerState.mentalPower = Math.max(0, playerState.mentalPower - cost);
        return cost;
    }

    /**
     * Calculate damage from attack cards
     */
    calculateAttackDamage(cards: Card[]): {
        damage: number;
        mentalDamage: number;
        heal: number;
        attribute: string | null;
    } {
        const { damage, mentalDamage, heal } = this.damageCalc.calculateDamageFromCards(cards);
        const attribute = this.damageCalc.extractAttackAttribute(cards);
        
        return { damage, mentalDamage, heal, attribute };
    }

    /**
     * Process defense cards and calculate effective defense
     */
    processDefense(
        attackAttribute: string | null,
        defenseCards: Card[]
    ): {
        defenseValue: number;
        isEffective: boolean;
        appliedDefense: number;
    } {
        const defenseValue = this.damageCalc.calculateDefenseValue(defenseCards);
        const isEffective = this.damageCalc.isDefenseEffective(attackAttribute, defenseCards);
        const appliedDefense = isEffective ? defenseValue : 0;
        
        return { defenseValue, isEffective, appliedDefense };
    }

    /**
     * Check for special defense effects (reflect/bounce)
     */
    checkSpecialEffects(defenseCards: Card[]): { type: 'reflect' | 'bounce'; card: Card } | null {
        return this.effectProc.findSpecialDefenseEffect(defenseCards);
    }

    /**
     * Apply damage to target (health and mental)
     * Note: Defense cards only block health damage, NOT mental damage
     */
    applyDamage(
        targetState: PlayerState,
        healthDamage: number,
        mentalDamage: number,
        appliedDefense: number
    ): {
        finalHealthDamage: number;
        finalMentalDamage: number;
        prevHealth: number;
        prevMentalPower: number;
    } {
        const prevHealth = targetState.health;
        const prevMentalPower = targetState.mentalPower;
        
        // Apply health damage (reduced by defense)
        const finalHealthDamage = this.damageCalc.applyDefenseReduction(healthDamage, appliedDefense);
        targetState.health = Math.max(0, targetState.health - finalHealthDamage);
        
        // Apply mental damage (NOT reduced by defense)
        const finalMentalDamage = mentalDamage;
        targetState.mentalPower = Math.max(0, targetState.mentalPower - finalMentalDamage);
        
        // Check if eliminated
        if (targetState.health <= 0) {
            targetState.alive = false;
        }
        
        return { finalHealthDamage, finalMentalDamage, prevHealth, prevMentalPower };
    }

    /**
     * Apply heal to target
     */
    applyHeal(targetState: PlayerState, healAmount: number): void {
        if (healAmount > 0) {
            targetState.health = Math.min(100, targetState.health + healAmount);
        }
    }

    /**
     * Apply debuffs from attacker's cards
     */
    applyDebuffs(targetState: PlayerState, attackCards: Card[]): string[] {
        const newDebuffs = this.effectProc.extractDebuffs(attackCards);
        const { debuffs, applied } = this.effectProc.applyDebuffs(targetState.debuffs, newDebuffs);
        targetState.debuffs = debuffs;
        return applied;
    }

    /**
     * Create reflect attack (swap attacker and defender)
     */
    createReflectAttack(
        originalAttack: AttackQueueItem,
        room: Room
    ): AttackQueueItem {
        const newAttackId = `atk_refl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newRequestId = `srv_refl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        return {
            id: newAttackId,
            requestId: newRequestId,
            attackerId: originalAttack.targetId, // Defender becomes attacker
            attackerName: room.players.find(p => p.id === originalAttack.targetId)?.name || 'unknown',
            targetId: originalAttack.attackerId, // Attacker becomes target
            targetName: originalAttack.attackerName,
            damage: originalAttack.damage, // Original damage
            mentalDamage: originalAttack.mentalDamage || 0,
            cardsUsed: [],
            cardsUsedIds: [],
            attackAttribute: null,
            chainDepth: originalAttack.chainDepth + 1,
            parentAttackId: originalAttack.id,
            chainSource: 'reflect',
            status: 'pending',
            timestamp: Date.now(),
            roomId: room.id
        };
    }

    /**
     * Create bounce attack (random target)
     */
    createBounceAttack(
        originalAttack: AttackQueueItem,
        targetId: string,
        targetName: string,
        room: Room
    ): AttackQueueItem {
        const newAttackId = `atk_bounce_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newRequestId = `srv_bounce_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        return {
            id: newAttackId,
            requestId: newRequestId,
            attackerId: originalAttack.attackerId, // Original attacker remains
            attackerName: originalAttack.attackerName,
            targetId,
            targetName,
            damage: originalAttack.damage, // Original damage
            mentalDamage: originalAttack.mentalDamage || 0,
            cardsUsed: [],
            cardsUsedIds: [],
            attackAttribute: null,
            chainDepth: originalAttack.chainDepth + 1,
            parentAttackId: originalAttack.id,
            chainSource: 'bounce',
            status: 'pending',
            timestamp: Date.now(),
            roomId: room.id
        };
    }

    /**
     * Create self-reflect attack (attacker attacking themselves)
     */
    createSelfReflectAttack(
        originalAttack: AttackQueueItem,
        room: Room
    ): AttackQueueItem {
        const newAttackId = `atk_self_refl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newRequestId = `srv_self_refl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        return {
            id: newAttackId,
            requestId: newRequestId,
            attackerId: originalAttack.attackerId, // Same attacker
            attackerName: originalAttack.attackerName,
            targetId: originalAttack.attackerId, // Same as attacker (self-target)
            targetName: originalAttack.attackerName,
            damage: originalAttack.damage, // Original damage
            mentalDamage: originalAttack.mentalDamage || 0,
            cardsUsed: [],
            cardsUsedIds: [],
            attackAttribute: null,
            chainDepth: originalAttack.chainDepth + 1,
            parentAttackId: originalAttack.id,
            chainSource: 'reflect',
            status: 'pending',
            timestamp: Date.now(),
            roomId: room.id
        };
    }

    /**
     * Select random bounce target (all alive players)
     */
    selectBounceTarget(room: Room, currentDefenderId: string): Player | null {
        const alive = room.players.filter(
            p => room.playerStates && room.playerStates[p.id]?.alive
        );
        
        if (alive.length === 0) return null;
        
        // Random selection from ALL alive players (no exclusions)
        const randomIndex = Math.floor(Math.random() * alive.length);
        return alive[randomIndex];
    }
}
