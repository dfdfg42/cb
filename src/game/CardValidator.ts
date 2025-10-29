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
        if (normalAttacks.length > 0 && cards.length > 1) {
            return { valid: false, error: '일반 공격 카드는 1장만 사용 가능합니다!' };
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

        const firstPlusCard = plusCards[0];
        const maxCards = firstPlusCard.plusLevel + 1;
        
        // 같은 카드만 선택 가능
        const allSameCard = plusCards.every(c => c.name === firstPlusCard.name);
        if (!allSameCard) {
            return { 
                valid: false, 
                error: '+ 접두사 카드는 같은 종류만 함께 사용 가능합니다!' 
            };
        }
        
        if (plusCards.length > maxCards) {
            return { 
                valid: false, 
                error: `이 카드는 최대 ${maxCards}장까지 사용 가능합니다!` 
            };
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
