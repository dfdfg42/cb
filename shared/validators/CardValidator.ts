/**
 * Card Validator
 * 
 * Shared validation logic for card usage rules.
 * Used by both client and server to ensure consistency.
 */

import { ValidationResult as ImportedValidationResult } from '../types';

export type ValidationResult = ImportedValidationResult;

export interface Card {
    id: string;
    name: string;
    type: string;
    cost?: number;
    mentalCost: number;
    plusLevel?: number;
    attribute?: string;
    defense?: number;
    damage?: number;
    healthDamage?: number;
    mentalDamage?: number;
    effect?: string;
}

export class CardValidator {
    /**
     * Validate if cards can be played
     */
    static validateCards(cards: Card[], playerMentalPower: number): ValidationResult {
        if (cards.length === 0) {
            return { valid: false, error: '카드를 선택해주세요!' };
        }

        // Field magic validation
        const fieldMagicResult = this.validateFieldMagic(cards);
        if (!fieldMagicResult.valid) {
            return fieldMagicResult;
        }

        // If field magic is present and valid, skip other checks
        const fieldMagicCards = cards.filter(c => c.type === 'FIELD_MAGIC' || c.type === 'field_magic');
        if (fieldMagicCards.length > 0) {
            return this.validateMentalCost(cards, playerMentalPower);
        }

        // Magic card validation
        const magicResult = this.validateMagicCards(cards);
        if (!magicResult.valid) {
            return magicResult;
        }

        // Mental cost validation
        const costResult = this.validateMentalCost(cards, playerMentalPower);
        if (!costResult.valid) {
            return costResult;
        }

        // Plus card validation
        const plusResult = this.validatePlusCards(cards);
        if (!plusResult.valid) {
            return plusResult;
        }

        // Normal attack card validation
        const normalAttackResult = this.validateNormalAttackCards(cards);
        if (!normalAttackResult.valid) {
            return normalAttackResult;
        }

        return { valid: true };
    }

    /**
     * Validate field magic cards
     */
    static validateFieldMagic(cards: Card[]): ValidationResult {
        const fieldMagicCards = cards.filter(c => 
            c.type === 'FIELD_MAGIC' || c.type === 'field_magic'
        );
        
        if (fieldMagicCards.length > 0 && cards.length > 1) {
            return { valid: false, error: '필드 마법은 단독으로만 사용 가능합니다!' };
        }

        return { valid: true };
    }

    /**
     * Validate magic cards (max 1 per turn)
     */
    static validateMagicCards(cards: Card[]): ValidationResult {
        const magicCards = cards.filter(c => 
            c.type === 'MAGIC' || c.type === 'magic'
        );
        
        if (magicCards.length > 1) {
            return { valid: false, error: '마법 카드는 한 번에 1장만 사용 가능합니다!' };
        }

        return { valid: true };
    }

    /**
     * Validate mental cost
     */
    static validateMentalCost(cards: Card[], playerMentalPower: number): ValidationResult {
        const totalMentalCost = cards.reduce((sum, card) => {
            return sum + (card.mentalCost || 0) + (card.cost || 0);
        }, 0);

        if (totalMentalCost > playerMentalPower) {
            return { valid: false, error: '정신력이 부족합니다!' };
        }

        return { valid: true };
    }

    /**
     * Validate plus level cards
     */
    static validatePlusCards(cards: Card[]): ValidationResult {
        const plusCards = cards.filter(c => (c.plusLevel || 0) > 0);
        
        if (plusCards.length === 0) {
            return { valid: true };
        }

        const usageMap = new Map<string, { count: number; limit: number }>();

        for (const card of plusCards) {
            const key = card.name;
            const limit = (card.plusLevel || 0) + 1;
            const entry = usageMap.get(key);

            if (entry) {
                const effectiveLimit = Math.max(entry.limit, limit);
                const nextCount = entry.count + 1;
                if (nextCount > effectiveLimit) {
                    return {
                        valid: false,
                        error: `${card.name} 카드는 최대 ${effectiveLimit}장까지 사용 가능합니다!`
                    };
                }

                usageMap.set(key, { count: nextCount, limit: effectiveLimit });
            } else {
                if (limit <= 0) {
                    return {
                        valid: false,
                        error: `${card.name} 카드는 현재 사용할 수 없습니다!`
                    };
                }

                usageMap.set(key, { count: 1, limit });
            }
        }

        return { valid: true };
    }

    /**
     * Validate normal attack cards (only 1 allowed, no mixing)
     */
    static validateNormalAttackCards(cards: Card[]): ValidationResult {
        const normalAttacks = cards.filter(c => 
            (c.type === 'ATTACK' || c.type === 'attack') && (c.plusLevel || 0) === 0
        );

        // 일반 공격은 한 번에 여러 장 사용할 수 없음
        if (normalAttacks.length > 1) {
            return { valid: false, error: '일반 공격 카드는 1장만 사용 가능합니다!' };
        }

        // 일반 공격 1장 선택 시, 다른 카드가 있다면 반드시 + 접두사 카드만 허용
        if (normalAttacks.length === 1 && cards.length > 1) {
            const others = cards.filter(c => c.id !== normalAttacks[0].id);
            const allOthersArePlus = others.every(c => (c.plusLevel || 0) > 0);
            if (!allOthersArePlus) {
                return { valid: false, error: '일반 공격 카드는 1장만 사용 가능합니다!' };
            }
            // plus 규칙은 validatePlusCards에서 검증됨
        }

        return { valid: true };
    }

    /**
     * Calculate total cost of cards
     */
    static calculateTotalCost(cards: Card[]): number {
        return cards.reduce((sum, card) => {
            return sum + (card.cost || 0) + (card.mentalCost || 0);
        }, 0);
    }
}
