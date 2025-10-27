import { Card, AttributeType } from '../types/gameTypes';

export class DamageCalculator {
  // 방어 카드가 해당 공격 속성을 막을 수 있는지 판단하는 규칙
  private static canDefenseBlock(attackAttr: AttributeType, defenseAttr: AttributeType): boolean {
    // Normalize by comparing underlying string values; accept Korean/English inputs elsewhere
    const a = String(attackAttr).toLowerCase();
    const d = String(defenseAttr).toLowerCase();

    if (a === 'fire' || a === '화염') return (d === 'water' || d === '물');
    if (a === 'water' || a === '물') return (d === 'fire' || d === '화염');
    if (a === 'light' || a === '빛') return (d === 'light' || d === '빛');
    if (a === 'dark' || a === '암흑') return true;
    return true;
  }

  // HP 데미지 계산
  static calculateHealthDamage(
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

    // 공격 카드들의 데미지 합산
    // 조직화: 공격을 속성별로 집계하고, 방어는 속성 규칙에 따라 소진하면서 차감
    const attackByAttr: Record<string, number> = {};
    attackCards.forEach(card => {
      if ('attack' in card) {
        const baseAttack = (card as any).attack || 0;
        const attr = (card as any).attribute || AttributeType.NONE;
        attackByAttr[attr] = (attackByAttr[attr] || 0) + baseAttack;

        // 특수 효과(예: 즉사 등) — 현재 즉사/특수 효과는 별도 로직이 없으므로 effects에 표기
        if ('specialEffects' in card) {
          const specialEffects = (card as any).specialEffects || [];
          specialEffects.forEach((effect: string) => {
            if (effect.includes('즉사')) {
              isLethal = true;
              effects.push('즉사 효과 발동');
            }
            if (effect.includes('HP 흡수')) {
              effects.push(`HP 흡수`);
            }
            if (effect.includes('반동')) {
              effects.push(`반동 데미지`);
            }
          });
        }
      }
    });

    // 방어 카드 속성별 방어력 풀 생성
    const defensePool: Record<string, number> = {};
    defenseCards.forEach(card => {
      if ('defense' in card) {
        const defVal = (card as any).defense || 0;
        const defAttr = (card as any).attribute || AttributeType.NONE;
        defensePool[defAttr] = (defensePool[defAttr] || 0) + defVal;
      }
    });

    // 공격 속성별로 방어를 소진하며 최종 데미지 계산 (큰 데미지 먼저 소진)
    const attrs = Object.keys(attackByAttr).sort((a, b) => (attackByAttr[b] - attackByAttr[a]));
    attrs.forEach(attrKey => {
      const attackAttr = attrKey as AttributeType;
      let remainingAttack = attackByAttr[attrKey];

      // determine which defense attributes can block this attackAttr
      const allowedDefAttrs: AttributeType[] = [];
      // collect all possible defense pools depending on rules
      Object.keys(defensePool).forEach(defAttrKey => {
        const defAttr = defAttrKey as AttributeType;
        if (this.canDefenseBlock(attackAttr, defAttr)) {
          allowedDefAttrs.push(defAttr);
        }
      });

      // consume defense from allowed pools until attack is absorbed or defenses exhausted
      for (const defAttr of allowedDefAttrs) {
        if (remainingAttack <= 0) break;
        const available = defensePool[defAttr] || 0;
        if (available <= 0) continue;
        const used = Math.min(available, remainingAttack);
        defensePool[defAttr] = available - used;
        remainingAttack -= used;
      }

      // any remaining attack becomes damage
      totalDamage += Math.max(0, remainingAttack);
    });

    return {
      damage: totalDamage,
      isLethal,
      effects
    };
  }

  // MP 데미지 계산
  static calculateMentalDamage(
    attackCards: Card[],
  ): {
    damage: number;
    effects: string[];
  } {
    let totalDamage = 0;
    const effects: string[] = [];

    attackCards.forEach(card => {
      if ('mentalDamage' in card) {
        totalDamage += (card as any).mentalDamage;
      }
    });

    return {
      damage: totalDamage,
      effects
    };
  }

  // MP 소모 계산
  static calculateMPCost(cards: Card[]): number {
    return cards.reduce((total, card) => {
      if ('mpCost' in card) {
        return total + (card as any).mpCost;
      }
      return total;
    }, 0);
  }
}