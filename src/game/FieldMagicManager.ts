import { Card, AttributeType, PlayerState } from '../types/gameTypes';

type AnyCard = { [k: string]: any };

export class DamageCalculator {
  // 속성 상성 계산 (defenderAttr가 필요하면 전달하세요)
  private static getAttributeMultiplier(
    attackAttr: AttributeType | undefined,
    defenseAttr: AttributeType | undefined
  ): number | typeof Infinity {
    if (attackAttr === undefined) return 1.0;
    if (attackAttr === AttributeType.FIRE && defenseAttr === AttributeType.WATER) {
      return 0.5; // 불속성이 물속성에 약함
    }
    if (attackAttr === AttributeType.WATER && defenseAttr === AttributeType.FIRE) {
      return 2.0; // 물속성이 불속성에 강함
    }
    if (attackAttr === AttributeType.LIGHT) {
      return 1.5; // 광속성은 기본적으로 강력
    }
    // 암속성 + 무속성 즉사 규칙 (주의: 무한을 리턴하면 호출부에서 즉시 처리해야 함)
    if (attackAttr === AttributeType.DARK && defenseAttr === AttributeType.NONE) {
      return Infinity;
    }
    return 1.0;
  }

  // HP 데미지 계산
  static calculateHealthDamage(
    defender: PlayerState,
    attackCards: Card[],
    defenseCards: Card[],
  ): {
    damage: number;
    isLethal: boolean;
    effects: string[];
  } {
    let totalDamage = 0;
    let isLethal = false;
    const effects: string[] = [];

    // 방어 카드의 방어력 계산 (안전 검사)
    let totalDefense = 0;
    for (const c of defenseCards || []) {
      const card = c as AnyCard;
      // defense 키가 있거나 camelCase/snake_case 모두 대응
      const defVal = typeof card.defense === 'number'
        ? card.defense
        : typeof card.defense_value === 'number'
        ? card.defense_value
        : 0;
      totalDefense += defVal;
    }

    // 공격 카드 처리 — 카드별로 독립적으로 계산(흡수/반동은 카드 단위로 계산해 effects에 기록)
    for (const ac of attackCards || []) {
      const card = ac as AnyCard;
      const baseAttack = typeof card.attack === 'number' ? card.attack : 0;
      // 카드에 attribute가 없을 수도 있으니 defensive
      const attackAttr: AttributeType | undefined = card.attribute as AttributeType | undefined;

      // 방어자의 속성 (있다면 사용, 아니면 undefined)
      const defenderAttr: AttributeType | undefined = (defender && (defender.attribute as AttributeType)) || undefined;

      const multiplier = this.getAttributeMultiplier(attackAttr, defenderAttr);

      // 즉사(무한) 처리: 우선적으로 체크하고 바로 반환(치명타 우선)
      if (multiplier === Infinity) {
        isLethal = true;
        effects.push(`"${card.name ?? '무기'}"에 의한 즉사 효과`);
        // 즉사면 대미지는 의미 없으므로 0으로 두고 반복문 탈출
        totalDamage = 0;
        break;
      }

      const cardDamage = baseAttack * (typeof multiplier === 'number' ? multiplier : 1);

      // 특수 효과 처리 (문자열 배열로 가정하되 안전 검사)
      let cardAbsorb = 0;
      let cardRecoil = 0;
      if (Array.isArray(card.specialEffects)) {
        for (const effect of card.specialEffects) {
          if (typeof effect !== 'string') continue;
          const lower = effect.toLowerCase();

          if (lower.includes('hp 흡수') || lower.includes('흡수')) {
            // 흡수는 보통 가한 대미지의 일부로 계산 — 여기서는 50% 규칙을 사용
            cardAbsorb += Math.floor(cardDamage * 0.5);
            effects.push(`"${card.name ?? '무기'}" 흡수: ${Math.floor(cardDamage * 0.5)}`);
          }
          if (lower.includes('반동')) {
            cardRecoil += Math.floor(cardDamage * 0.5);
            effects.push(`"${card.name ?? '무기'}" 반동: ${Math.floor(cardDamage * 0.5)}`);
          }
          // 여기에 다른 텍스트 기반 특수효과 파싱 추가 가능
        }
      }

      totalDamage += cardDamage;
      // 흡수/반동은 데미지 합산에 포함되진 않음(효과 요약으로만 기록). 필요시 로직 변경 가능.
      if (cardAbsorb > 0) {
        // 흡수는 공격자가 회복해야 하면 호출자가 attacker 상태에 반영
        // 여기서는 effects에만 기록
      }
      if (cardRecoil > 0) {
        // 반동은 호출자가 defender의 반격으로 처리하도록 effects에 기록
      }
    }

    // 즉사면 방어 계산 없이 바로 결과 반환
    if (isLethal) {
      return {
        damage: 0,
        isLethal,
        effects
      };
    }

    // 최종 데미지 계산 (방어력 적용)
    totalDamage = Math.max(0, Math.floor(totalDamage - totalDefense));

    return {
      damage: totalDamage,
      isLethal,
      effects
    };
  }

  // MP (정신력) 데미지 계산 — 마법/필드마법 등
  static calculateMentalDamage(
    attackCards: Card[],
  ): {
    damage: number;
    effects: string[];
  } {
    let totalDamage = 0;
    const effects: string[] = [];

    for (const ac of attackCards || []) {
      const card = ac as AnyCard;
      // 지원: camelCase와 snake_case 모두 수용
      const mental = typeof card.mentalDamage === 'number'
        ? card.mentalDamage
        : typeof card.mental_damage === 'number'
        ? card.mental_damage
        : 0;

      // 또는 마법이 'attack' 필드지만 category가 '마법'이면 정신력 공격으로 취급할 수도 있음.
      // 예: if (card.category === '마법' && typeof card.attack === 'number') { ... }
      totalDamage += mental;

      // 특수효과 표기(예: 전체공격 확률 등)
      if (Array.isArray(card.specialEffects)) {
        for (const effect of card.specialEffects) {
          if (typeof effect !== 'string') continue;
          if (effect.toLowerCase().includes('전체') || effect.toLowerCase().includes('전체공격')) {
            effects.push(`"${card.name ?? '마법'}"은(는) 전체 정신력 공격 효과를 가질 수 있음`);
          }
        }
      }
    }

    return {
      damage: Math.max(0, Math.floor(totalDamage)),
      effects
    };
  }

  // MP 소모 계산 (camelCase/snake_case 모두 지원)
  static calculateMPCost(cards: Card[]): number {
    return cards.reduce((total, c) => {
      const card = c as AnyCard;
      const mp = typeof card.mpCost === 'number'
        ? card.mpCost
        : typeof card.mp_cost === 'number'
        ? card.mp_cost
        : 0;
      return total + mp;
    }, 0);
  }
}
