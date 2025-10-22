import { Card, CardType, CardEffect } from '../types';

// 카드 데이터베이스
export const CARD_DATABASE: Card[] = [
    // ===== 공격 카드 =====
    {
        id: 'atk_001',
        name: '베기',
        type: CardType.ATTACK,
        healthDamage: 10,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '기본 공격. 상대에게 10의 데미지를 입힙니다.'
    },
    {
        id: 'atk_002',
        name: '강타',
        type: CardType.ATTACK,
        healthDamage: 15,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '강력한 일격. 상대에게 15의 데미지를 입힙니다.'
    },
    {
        id: 'atk_003',
        name: '추가 베기',
        type: CardType.ATTACK,
        healthDamage: 3,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 1,
        effect: CardEffect.NONE,
        description: '+3 데미지. 다른 공격 카드와 함께 사용 가능.'
    },
    {
        id: 'atk_004',
        name: '연타',
        type: CardType.ATTACK,
        healthDamage: 4,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 1,
        effect: CardEffect.NONE,
        description: '+4 데미지. 다른 공격 카드와 함께 사용 가능.'
    },
    {
        id: 'atk_005',
        name: '참수',
        type: CardType.ATTACK,
        healthDamage: 25,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '치명적인 일격! 상대에게 25의 강력한 데미지를 입힙니다.'
    },
    {
        id: 'atk_006',
        name: '정신 공격',
        type: CardType.ATTACK,
        healthDamage: 5,
        mentalDamage: 10,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '체력 5, 정신력 10의 데미지를 입힙니다.'
    },
    {
        id: 'atk_007',
        name: '찌르기',
        type: CardType.ATTACK,
        healthDamage: 12,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '빠른 찌르기. 12의 데미지를 입힙니다.'
    },
    {
        id: 'atk_008',
        name: '회전베기',
        type: CardType.ATTACK,
        healthDamage: 18,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '회전하며 베기. 18의 데미지를 입힙니다.'
    },
    {
        id: 'atk_009',
        name: '빠른 공격',
        type: CardType.ATTACK,
        healthDamage: 5,
        mentalDamage: 2,
        defense: 0,
        mentalCost: 0,
        plusLevel: 1,
        effect: CardEffect.NONE,
        description: '+5 체력, +2 정신력 데미지. 다른 공격 카드와 함께 사용 가능.'
    },
    {
        id: 'atk_010',
        name: '약점 공격',
        type: CardType.ATTACK,
        healthDamage: 8,
        mentalDamage: 8,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '약점을 노린다. 체력과 정신력에 각각 8 데미지.'
    },

    // ===== 방어 카드 =====
    {
        id: 'def_001',
        name: '막기',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 10,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '10의 데미지를 막습니다.'
    },
    {
        id: 'def_002',
        name: '철벽',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 20,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '20의 데미지를 막습니다.'
    },
    {
        id: 'def_003',
        name: '되받아치기',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.REFLECT,
        description: '공격을 그대로 반사하여 공격자에게 되돌려줍니다.'
    },
    {
        id: 'def_004',
        name: '튕기기',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.BOUNCE,
        description: '공격을 다른 랜덤한 플레이어에게 튕겨냅니다.'
    },
    {
        id: 'def_005',
        name: '반격',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 5,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.ON_DAMAGE,
        description: '5의 데미지를 막고, 받은 데미지의 절반을 공격자에게 돌려줍니다.'
    },
    {
        id: 'def_006',
        name: '방패',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 15,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '견고한 방패. 15의 데미지를 막습니다.'
    },
    {
        id: 'def_007',
        name: '회피',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 12,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '재빠르게 회피. 12의 데미지를 막습니다.'
    },
    {
        id: 'def_008',
        name: '강철 갑옷',
        type: CardType.DEFENSE,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 25,
        mentalCost: 0,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '최강의 방어. 25의 데미지를 막습니다.'
    },

    // ===== 마법 카드 =====
    {
        id: 'mag_001',
        name: '치유',
        type: CardType.MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 15,
        plusLevel: 0,
        effect: CardEffect.HEAL,
        description: '체력을 20 회복합니다. 정신력 15 소모.'
    },
    {
        id: 'mag_002',
        name: '파이어볼',
        type: CardType.MAGIC,
        healthDamage: 20,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 10,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '불꽃을 날려 20의 데미지를 입힙니다. 정신력 10 소모.'
    },
    {
        id: 'mag_003',
        name: '정신 붕괴',
        type: CardType.MAGIC,
        healthDamage: 0,
        mentalDamage: 25,
        defense: 0,
        mentalCost: 20,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '상대의 정신력에 25의 데미지를 입힙니다. 정신력 20 소모.'
    },
    {
        id: 'mag_004',
        name: '축복',
        type: CardType.MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 10,
        plusLevel: 0,
        effect: CardEffect.BUFF,
        description: '체력과 정신력을 각각 10씩 회복합니다. 정신력 10 소모.'
    },
    {
        id: 'mag_005',
        name: '아이스 볼트',
        type: CardType.MAGIC,
        healthDamage: 15,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 8,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '얼음 화살을 쏜다. 15의 데미지. 정신력 8 소모.'
    },
    {
        id: 'mag_006',
        name: '라이트닝',
        type: CardType.MAGIC,
        healthDamage: 28,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 18,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '번개를 떨어뜨린다. 28의 강력한 데미지! 정신력 18 소모.'
    },
    {
        id: 'mag_007',
        name: '마나 흡수',
        type: CardType.MAGIC,
        healthDamage: 0,
        mentalDamage: 15,
        defense: 0,
        mentalCost: 5,
        plusLevel: 0,
        effect: CardEffect.NONE,
        description: '상대의 정신력 15를 빼앗는다. 정신력 5 소모.'
    },
    {
        id: 'mag_008',
        name: '대치유',
        type: CardType.MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 25,
        plusLevel: 0,
        effect: CardEffect.HEAL,
        description: '강력한 치유. 체력을 35 회복합니다. 정신력 25 소모.'
    },

    // ===== 필드 마법 카드 =====
    {
        id: 'field_001',
        name: '화염의 대지',
        type: CardType.FIELD_MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 20,
        plusLevel: 0,
        effect: CardEffect.DEBUFF,
        description: '모든 적에게 매 턴 5의 데미지. 발동자는 공격력 +5. 정신력 20 소모.'
    },
    {
        id: 'field_002',
        name: '치유의 성역',
        type: CardType.FIELD_MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 25,
        plusLevel: 0,
        effect: CardEffect.HEAL,
        description: '발동자는 매 턴 체력 10 회복. 정신력 25 소모.'
    },
    {
        id: 'field_003',
        name: '혼돈의 소용돌이',
        type: CardType.FIELD_MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 15,
        plusLevel: 0,
        effect: CardEffect.DEBUFF,
        description: '모든 플레이어의 공격 대상이 랜덤으로 지정됩니다. 정신력 15 소모.'
    },
    {
        id: 'field_004',
        name: '얼음 왕국',
        type: CardType.FIELD_MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 18,
        plusLevel: 0,
        effect: CardEffect.DEBUFF,
        description: '모든 적의 공격력 -3. 발동자의 방어력 +5. 정신력 18 소모.'
    },
    {
        id: 'field_005',
        name: '마력의 폭풍',
        type: CardType.FIELD_MAGIC,
        healthDamage: 0,
        mentalDamage: 0,
        defense: 0,
        mentalCost: 22,
        plusLevel: 0,
        effect: CardEffect.BUFF,
        description: '발동자의 마법 소모량 -5. 매 턴 정신력 5 회복. 정신력 22 소모.'
    }
];

// 카드 ID로 카드 찾기
export function getCardById(id: string): Card | undefined {
    return CARD_DATABASE.find(card => card.id === id);
}

// 랜덤 카드 뽑기
export function drawRandomCards(count: number): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * CARD_DATABASE.length);
        // 카드 객체를 복사하여 각 카드가 고유한 인스턴스를 가지도록 함
        cards.push({ ...CARD_DATABASE[randomIndex], id: `${CARD_DATABASE[randomIndex].id}_${Date.now()}_${i}` });
    }
    return cards;
}

// 카드 덱 생성 및 셔플
export function createShuffledDeck(): Card[] {
    const deck: Card[] = [];
    // 각 카드를 여러 장씩 추가 (총 100장 정도의 덱)
    CARD_DATABASE.forEach(card => {
        const copies = card.type === CardType.FIELD_MAGIC ? 2 : 5;
        for (let i = 0; i < copies; i++) {
            deck.push({ ...card, id: `${card.id}_${i}` });
        }
    });
    
    // 피셔-예이츠 셔플
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
}
