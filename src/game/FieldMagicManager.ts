import { Card, FieldMagic, GameSession, Player } from '../types';
import { IUIManager } from '../ui/IUIManager';

type DamageApplier = (target: Player, healthDamage: number, mentalDamage: number) => void;

const FIELD_FIRE = '화염의 대지';
const FIELD_HEAL = '치유의 성역';
const FIELD_ICE = '얼음 왕국';
const FIELD_STORM = '마력의 폭풍';
const FIELD_CHAOS = '혼돈의 소용돌이';

/**
 * FieldMagicManager
 *
 * 필드 마법의 지속 효과, 공격/방어 보정, 정신력 소모 감소 등을
 * 한 곳에서 관리하여 GameManager/CombatManager가 간결하게 사용할 수 있도록 합니다.
 */
export class FieldMagicManager {
    static readonly DEFAULT_DURATION = 5;
    static readonly FIRE_FIELD_DAMAGE = 5;
    static readonly FIRE_FIELD_ATTACK_BONUS = 5;
    static readonly ICE_FIELD_ATTACK_PENALTY = 3;
    static readonly ICE_FIELD_DEFENSE_BONUS = 5;
    static readonly HEAL_FIELD_AMOUNT = 10;
    static readonly STORM_FIELD_REDUCTION = 5;
    static readonly STORM_FIELD_MENTAL_REGEN = 5;

    /**
     * 카드에서 필드 마법 객체 생성
     */
    static createFieldMagic(card: Card, casterId: string): FieldMagic {
        return {
            id: card.id,
            name: card.name,
            casterId,
            effect: card.effect,
            duration: FieldMagicManager.DEFAULT_DURATION
        };
    }

    /**
     * 턴 시작 시 필드 마법 지속 효과 적용
     */
    static applyTurnStartEffects(
        session: GameSession,
        uiManager: IUIManager,
        applyDamage: DamageApplier
    ): void {
        const fieldMagic = session.fieldMagic;
        if (!fieldMagic) return;

        const caster = session.players.find(p => p.id === fieldMagic.casterId);

        switch (fieldMagic.name) {
            case FIELD_FIRE:
                session.players.forEach(player => {
                    if (player.id !== fieldMagic.casterId && player.isAlive) {
                        applyDamage(player, FieldMagicManager.FIRE_FIELD_DAMAGE, 0);
                        uiManager.addLogMessage(
                            `🔥 ${player.name}이(가) 화염의 대지에서 ${FieldMagicManager.FIRE_FIELD_DAMAGE} 데미지를 받았습니다!`
                        );
                    }
                });
                break;
            case FIELD_HEAL:
                if (caster && caster.isAlive) {
                    const before = caster.health;
                    const maxHealth = caster.maxHealth ?? 100;
                    caster.health = Math.min(maxHealth, caster.health + FieldMagicManager.HEAL_FIELD_AMOUNT);
                    if (caster.health > before) {
                        uiManager.addLogMessage(
                            `✨ ${caster.name}이(가) 치유의 성역에서 체력 ${caster.health - before}을(를) 회복했습니다!`
                        );
                    }
                }
                break;
            case FIELD_ICE:
                uiManager.addLogMessage(`❄️ 얼음 왕국이 모든 적의 공격력을 약화시킵니다!`);
                break;
            case FIELD_STORM:
                if (caster && caster.isAlive) {
                    const beforeMP = caster.mentalPower;
                    const maxMental = caster.maxMentalPower ?? 100;
                    caster.mentalPower = Math.min(maxMental, caster.mentalPower + FieldMagicManager.STORM_FIELD_MENTAL_REGEN);
                    if (caster.mentalPower > beforeMP) {
                        uiManager.addLogMessage(
                            `⚡ ${caster.name}이(가) 마력의 폭풍으로 정신력 ${caster.mentalPower - beforeMP}을(를) 회복했습니다!`
                        );
                    }
                }
                break;
            case FIELD_CHAOS:
                uiManager.addLogMessage(`🌀 혼돈의 소용돌이가 전장을 휘감습니다!`);
                break;
            default:
                break;
        }

        fieldMagic.duration -= 1;
        if (fieldMagic.duration <= 0) {
            FieldMagicManager.endFieldMagic(session, uiManager);
        }
    }

    /**
     * 필드 마법 종료 및 UI 업데이트
     */
    static endFieldMagic(
        session: GameSession,
        uiManager?: IUIManager,
        customMessage?: string
    ): void {
        const endedField = session.fieldMagic;
        if (!endedField) return;

        const message = customMessage ?? `필드 마법 [${endedField.name}]의 효과가 끝났습니다!`;
        uiManager?.addLogMessage(message);
        uiManager?.updateFieldMagic(null);
        session.fieldMagic = undefined;
    }

    /**
     * 공격력 보정 (양수: 증가, 음수: 감소)
     */
    static getAttackModifier(fieldMagic: FieldMagic | undefined, attackerId: string): number {
        if (!fieldMagic) return 0;

        if (fieldMagic.name === FIELD_FIRE && fieldMagic.casterId === attackerId) {
            return FieldMagicManager.FIRE_FIELD_ATTACK_BONUS;
        }

        if (fieldMagic.name === FIELD_ICE && fieldMagic.casterId !== attackerId) {
            return -FieldMagicManager.ICE_FIELD_ATTACK_PENALTY;
        }

        return 0;
    }

    /**
     * 방어력 보정 (양수만 사용)
     */
    static getDefenseBonus(fieldMagic: FieldMagic | undefined, defenderId: string): number {
        if (!fieldMagic) return 0;
        if (fieldMagic.name === FIELD_ICE && fieldMagic.casterId === defenderId) {
            return FieldMagicManager.ICE_FIELD_DEFENSE_BONUS;
        }
        return 0;
    }

    /**
     * 정신력 소모량 계산 (필드 마법에 따른 감소 적용)
     */
    static getEffectiveMentalCost(
        baseCost: number,
        fieldMagic: FieldMagic | undefined,
        playerId: string
    ): number {
        if (!fieldMagic) return baseCost;
        if (fieldMagic.name === FIELD_STORM && fieldMagic.casterId === playerId) {
            return Math.max(0, baseCost - FieldMagicManager.STORM_FIELD_REDUCTION);
        }
        return baseCost;
    }

    /**
     * 공격 대상이 랜덤으로 지정되어야 하는지 여부
     */
    static shouldRandomizeTarget(fieldMagic: FieldMagic | undefined): boolean {
        return fieldMagic?.name === FIELD_CHAOS;
    }
}
