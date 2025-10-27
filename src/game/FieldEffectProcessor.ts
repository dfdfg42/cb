import { FieldMagicEffect, PlayerState, AttributeType } from '../types/gameTypes';

export class FieldEffectProcessor {
  static processFieldEffect(
    effect: FieldMagicEffect,
    players: PlayerState[],
    currentPlayer: PlayerState
  ): {
    damage: number;
    effects: string[];
    targets: PlayerState[];
  } {
    const result = {
      damage: 0,
      effects: [] as string[],
      targets: [] as PlayerState[],
    };

    // 효과 문자열 파싱
    const effectStr = effect.effect.toLowerCase();
    const damage = this.parseEffectDamage(effectStr);
    const probability = this.parseEffectProbability(effectStr);

    // 확률 체크
    if (Math.random() > probability) {
      return result;
    }

    // 속성별 특수 효과 처리
    if (effectStr.includes('안개')) {
      result.effects.push('명중률 감소');
    }
    if (effectStr.includes('hp 흡수')) {
      result.effects.push('HP 흡수');
    }
    if (effectStr.includes('재앙')) {
      if (effectStr.includes('섬광')) {
        result.effects.push('재앙: 섬광');
        damage.value *= 1.5;
      }
      if (effectStr.includes('먹구름')) {
        result.effects.push('재앙: 먹구름');
        result.targets = this.selectRandomTargets(players, 2, currentPlayer);
      }
    }

    // 데미지가 있는 경우 타겟 선택
    if (damage.value > 0) {
      if (result.targets.length === 0) {
        result.targets = this.selectRandomTargets(players, 1, currentPlayer);
      }
      result.damage = damage.value;
    }

    return result;
  }

  private static parseEffectDamage(effect: string): { value: number } {
    const match = effect.match(/atk\s*(\d+)/i);
    return {
      value: match ? parseInt(match[1], 10) : 0
    };
  }

  private static parseEffectProbability(effect: string): number {
    const match = effect.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) / 100 : 1.0;
  }

  private static selectRandomTargets(
    players: PlayerState[],
    count: number,
    excludePlayer?: PlayerState
  ): PlayerState[] {
    const alivePlayers = players.filter(p => p.isAlive && p !== excludePlayer);
    const targets: PlayerState[] = [];
    
    while (targets.length < count && alivePlayers.length > 0) {
      const index = Math.floor(Math.random() * alivePlayers.length);
      targets.push(alivePlayers[index]);
      alivePlayers.splice(index, 1);
    }

    return targets;
  }

  // 속성별 추가 효과 적용
  static applyAttributeEffects(
    attribute: AttributeType,
    damage: number
  ): number {
    switch (attribute) {
      case AttributeType.WATER:
        // 수속성은 데미지가 낮지만 안정적
        return Math.min(damage * 0.8, 5);
      case AttributeType.FIRE:
        // 화속성은 데미지가 높지만 불안정
        return Math.random() < 0.75 ? damage * 1.2 : 0;
      case AttributeType.LIGHT:
        // 광속성은 방어 불가 및 높은 데미지
        return damage * 1.5;
      case AttributeType.DARK:
        // 암속성은 낮은 데미지지만 지속적
        return damage + Math.floor(damage * 0.2);
      default:
        return damage;
    }
  }
}