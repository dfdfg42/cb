/**
 * Combat Validator
 * 
 * Shared validation logic for attack and defense rules.
 */

import { Card, ValidationResult } from './CardValidator';

export class CombatValidator {
    /**
     * Validate attack
     */
    static validateAttack(
        attackerId: string,
        targetId: string,
        cards: Card[],
        attackerMentalPower: number
    ): ValidationResult {
        // Check if attacker and target are different
        if (attackerId === targetId) {
            return { valid: false, error: '자신을 공격할 수 없습니다!' };
        }

        // Check if cards are provided
        if (!cards || cards.length === 0) {
            return { valid: false, error: '공격 카드를 선택해주세요!' };
        }

        // Validate card costs
        const totalCost = cards.reduce((sum, card) => {
            return sum + (card.cost || 0) + (card.mentalCost || 0);
        }, 0);

        if (totalCost > attackerMentalPower) {
            return { valid: false, error: '마나가 부족합니다!' };
        }

        // Validate that cards are attack-capable
        const hasAttackCards = cards.some(card => 
            card.damage || card.healthDamage || card.mentalDamage || 
            card.type === 'ATTACK' || card.type === 'attack' ||
            card.type === 'MAGIC' || card.type === 'magic'
        );

        if (!hasAttackCards) {
            return { valid: false, error: '공격 가능한 카드가 없습니다!' };
        }

        return { valid: true };
    }

    /**
     * Validate defense
     */
    static validateDefense(
        defenderId: string,
        attackTargetId: string,
        cards: Card[],
        defenderMentalPower: number
    ): ValidationResult {
        // Check if defender is the actual target
        if (defenderId !== attackTargetId) {
            return { valid: false, error: '당신이 방어할 공격이 아닙니다!' };
        }

        // Allow empty defense (no cards used)
        if (!cards || cards.length === 0) {
            return { valid: true }; // Valid to not defend
        }

        // Validate card costs
        const totalCost = cards.reduce((sum, card) => {
            return sum + (card.cost || 0) + (card.mentalCost || 0);
        }, 0);

        if (totalCost > defenderMentalPower) {
            return { valid: false, error: '마나가 부족합니다!' };
        }

        // Validate that cards are defense-capable
        const hasDefenseCards = cards.every(card => 
            card.defense !== undefined || 
            card.type === 'DEFENSE' || card.type === 'defense' ||
            card.type === 'MAGIC' || card.type === 'magic' ||
            card.effect === 'reflect' || card.effect === 'bounce'
        );

        if (!hasDefenseCards) {
            return { valid: false, error: '방어 카드 또는 마법 카드만 사용 가능합니다!' };
        }

        return { valid: true };
    }

    /**
     * Check if target is valid (alive)
     */
    static validateTarget(targetId: string, players: any[]): ValidationResult {
        const target = players.find(p => p.id === targetId);

        if (!target) {
            return { valid: false, error: '타겟을 찾을 수 없습니다!' };
        }

        if (!target.isAlive || target.health <= 0) {
            return { valid: false, error: '이미 쓰러진 플레이어는 공격할 수 없습니다!' };
        }

        return { valid: true };
    }

    /**
     * Validate turn
     */
    static validateTurn(playerId: string, currentPlayerId: string): ValidationResult {
        if (playerId !== currentPlayerId) {
            return { valid: false, error: '현재 차례가 아닙니다!' };
        }

        return { valid: true };
    }
}
