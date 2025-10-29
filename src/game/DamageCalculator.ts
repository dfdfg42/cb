import { Card } from '../types';

/**
 * Consolidated DamageCalculator
 * - 단위 테스트 및 GameManager 통합용으로 핵심 계산 기능만 제공합니다.
 */
export class DamageCalculator {
  public static getAttributeMultiplier(attackAttr?: string, defenseAttr?: string): number | typeof Infinity {
    if (!attackAttr) return 1;
    if (attackAttr === 'fire' && defenseAttr === 'water') return 0.5;
    if (attackAttr === 'water' && defenseAttr === 'fire') return 2.0;
    if (attackAttr === 'light') return 1.5;
    if (attackAttr === 'dark' && (!defenseAttr || defenseAttr === 'none')) return Infinity;
    return 1;
  }

  // HP 데미지 계산: 공격 카드 합산 - 방어 합산, 반사/튕김/즉사 플래그 포함
  public static calculateHealthDamage(attackCards: Card[], defenseCards: Card[], defenderAttr?: string) {
    let totalAttack = 0;
    let totalDefense = 0;
    let isReflect = false;
    let isBounce = false;
    let absorb = 0;
    let isLethal = false;

    for (const ac of attackCards || []) {
      const multiplier = this.getAttributeMultiplier((ac as any).attribute, defenderAttr) as number;
      if (multiplier === Infinity) {
        isLethal = true;
        break;
      }
      const atk = (ac.healthDamage || 0) * multiplier;
      totalAttack += atk;
      if (Array.isArray((ac as any).specialEffects)) {
        for (const s of (ac as any).specialEffects) {
          if (typeof s === 'string' && s.includes('흡수')) absorb += Math.floor(atk * 0.5);
        }
      }
    }

    for (const dc of defenseCards || []) {
      if ((dc as any).effect === 'reflect') {
        isReflect = true;
        continue;
      }
      if ((dc as any).effect === 'bounce') {
        isBounce = true;
        continue;
      }
      totalDefense += (dc.defense || 0);
    }

    if (isLethal) return { damage: 0, isLethal: true, isReflect, isBounce, absorb };

    const final = Math.max(0, Math.floor(totalAttack - totalDefense));
    return { damage: final, isLethal: false, isReflect, isBounce, absorb };
  }

  public static calculateMentalDamage(attackCards: Card[]) {
    let total = 0;
    for (const ac of attackCards || []) total += ac.mentalDamage || 0;
    return Math.max(0, Math.floor(total));
  }

  public static calculateMPCost(cards: Card[]) {
    return (cards || []).reduce((s, c) => s + (c.mentalCost || 0), 0);
  }
}

export default DamageCalculator;