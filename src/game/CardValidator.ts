import { Card, CardType, Player } from '../types';

/**
 * CardValidator - 카드 사용 규칙 검증
 * 클라이언트 측 카드 선택 유효성 검사
 */
export class CardValidator {
    /**
     * 카드를 플레이할 수 있는지 검증
     */
    public static canPlayCards(cards: Card[], player: Player): {
        valid: boolean;
        error?: string;
    } {
        if (cards.length === 0) {
            return { valid: false, error: '카드를 선택해주세요!' };
        }

        // 필드 마법 카드 확인
        const fieldMagicCards = cards.filter(c => c.type === CardType.FIELD_MAGIC);
        if (fieldMagicCards.length > 0) {
            if (cards.length > 1) {
                return { valid: false, error: '필드 마법은 단독으로만 사용 가능합니다!' };
            }
            // 필드 마법은 정신력만 확인
            const mentalCost = fieldMagicCards[0].mentalCost;
            if (mentalCost > player.mentalPower) {
                return { valid: false, error: '정신력이 부족합니다!' };
            }
            return { valid: true };
        }

        // 마법 카드는 1장만 가능
        const magicCards = cards.filter(c => c.type === CardType.MAGIC);
        if (magicCards.length > 1) {
            return { valid: false, error: '마법 카드는 한 번에 1장만 사용 가능합니다!' };
        }

        // 정신력 확인
        const totalMentalCost = cards.reduce((sum, card) => sum + card.mentalCost, 0);
        if (totalMentalCost > player.mentalPower) {
            return { valid: false, error: '정신력이 부족합니다!' };
        }

        // + 접두사 카드 확인
        const plusValidation = this.validatePlusCards(cards);
        if (!plusValidation.valid) {
            return plusValidation;
        }

        // 일반 공격 카드 + 다른 카드 혼합 불가
        const normalAttacks = cards.filter(c => c.type === CardType.ATTACK && c.plusLevel === 0);
        // 일반 공격 카드는 한 번에 여러 장 사용할 수 없음
        if (normalAttacks.length > 1) {
            return { valid: false, error: '일반 공격 카드는 1장만 사용 가능합니다!' };
        }
        // 일반 공격 1장 선택 시, 다른 카드가 있다면 반드시 + 접두사 카드만 허용
        if (normalAttacks.length === 1 && cards.length > 1) {
            const others = cards.filter(c => c.id !== normalAttacks[0].id);
            const allOthersArePlus = others.every(c => c.plusLevel > 0);
            if (!allOthersArePlus) {
                return { valid: false, error: '일반 공격 카드는 1장만 사용 가능합니다!' };
            }
            // plus 카드 규칙은 validatePlusCards에서 확인되므로 여기서는 통과시킴
        }

        return { valid: true };
    }

    /**
     * + 접두사 카드 검증
     */
    public static validatePlusCards(cards: Card[]): {
        valid: boolean;
        error?: string;
    } {
        const plusCards = cards.filter(c => c.plusLevel > 0);
        if (plusCards.length === 0) {
            return { valid: true };
        }

        const usageMap = new Map<string, { count: number; limit: number }>();

        for (const card of plusCards) {
            const key = card.name;
            const limit = card.plusLevel + 1;
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
     * 공격 카드 검증
     */
    public static validateAttackCards(cards: Card[]): {
        valid: boolean;
        error?: string;
    } {
        if (cards.length === 0) {
            return { valid: false, error: '카드를 선택해주세요!' };
        }

        // 필드 마법이 포함된 경우
        const fieldMagicCards = cards.filter(c => c.type === CardType.FIELD_MAGIC);
        if (fieldMagicCards.length > 0 && cards.length > 1) {
            return { valid: false, error: '필드 마법은 단독으로만 사용 가능합니다!' };
        }

        // 마법 카드는 1장만
        const magicCards = cards.filter(c => c.type === CardType.MAGIC);
        if (magicCards.length > 1) {
            return { valid: false, error: '마법 카드는 한 번에 1장만 사용 가능합니다!' };
        }

        return { valid: true };
    }

    /**
     * 방어 카드 검증
     */
    public static validateDefenseCards(cards: Card[]): {
        valid: boolean;
        error?: string;
    } {
        const validDefense = cards.every(c => 
            c.type === CardType.DEFENSE || 
            c.type === CardType.MAGIC
        );

        if (!validDefense) {
            return { 
                valid: false, 
                error: '방어 카드 또는 마법 카드만 사용 가능합니다!' 
            };
        }

        return { valid: true };
    }

    /**
     * 정신력 소비 계산 및 검증
     */
    public static validateManaCost(cards: Card[], player: Player): {
        valid: boolean;
        totalCost: number;
        error?: string;
    } {
        const totalCost = cards.reduce((sum, card) => sum + card.mentalCost, 0);
        
        if (totalCost > player.mentalPower) {
            return { 
                valid: false, 
                totalCost,
                error: `정신력이 부족합니다! (필요: ${totalCost}, 보유: ${player.mentalPower})` 
            };
        }

        return { valid: true, totalCost };
    }
}
