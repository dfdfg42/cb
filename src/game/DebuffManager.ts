import { PlayerState } from '../types/gameTypes';
import { DebuffType } from '../types';

export interface Debuff {
  id: string;
  name: string;
  description: string;
  duration: number;
  type: DebuffType;  // Add type property
  effect: (player: PlayerState) => void;
}

export class DebuffManager {
  private static readonly DEBUFFS: Debuff[] = [
    {
      id: 'card_destruction',
      name: '카드 소멸',
      description: '매 턴 카드 1장 자동 소멸',
      duration: -1, // 정신력 회복될 때까지
      type: DebuffType.CARD_DECAY,
      effect: (player: PlayerState) => {
        if (player.cards.length > 0) {
          const randomIndex = Math.floor(Math.random() * player.cards.length);
          player.cards.splice(randomIndex, 1);
        }
      }
    },
    {
      id: 'random_target',
      name: '혼돈의 표적',
      description: '공격 대상 랜덤 지정',
      duration: -1,
      type: DebuffType.RANDOM_TARGET,
      effect: () => {} // 대상 선택 시스템에서 처리
    },
    {
      id: 'mental_drain',
      name: '정신력 고갈',
      description: 'MP 회복량 50% 감소',
      duration: -1,
      type: DebuffType.MENTAL_DRAIN,
      effect: (player: PlayerState) => {
        // MP 회복 시스템에서 참조
        // Mental drain reduces MP recovery by 50%
        // Since recovery is event-based, we apply a small ongoing penalty
        if (player.mentalPower > 0) {
          player.mentalPower = Math.max(0, player.mentalPower - 1);
        }
      }
    }
  ];

  // 정신력 0 체크 및 디버프 적용
  static checkAndApplyDebuff(player: PlayerState): void {
    if (player.mentalPower <= 0 && player.debuffs.length === 0) {
      this.applyRandomDebuff(player);
    }
  }

  // 랜덤 디버프 적용
  private static applyRandomDebuff(player: PlayerState): void {
    const randomDebuff = this.DEBUFFS[Math.floor(Math.random() * this.DEBUFFS.length)];
    player.debuffs.push(randomDebuff.id);
  }

  // 디버프 해제 (정신력 회복 시)
  static removeDebuffs(player: PlayerState): void {
    if (player.mentalPower > 0) {
      player.debuffs = [];
    }
  }

  // 턴 시작 시 디버프 효과 적용
  static applyDebuffEffects(player: PlayerState): void {
    player.debuffs.forEach(debuffId => {
      const debuff = this.DEBUFFS.find(d => d.id === debuffId);
      if (debuff) {
        debuff.effect(player);
      }
    });
  }

  // 디버프 상태 확인
  static getDebuffInfo(player: PlayerState): Debuff[] {
    return player.debuffs.map(debuffId => 
      this.DEBUFFS.find(d => d.id === debuffId)
    ).filter((debuff): debuff is Debuff => debuff !== undefined);
  }

  // 특정 디버프 활성화 여부 확인
  static hasDebuff(player: PlayerState, debuffId: string): boolean {
    return player.debuffs.includes(debuffId);
  }
}